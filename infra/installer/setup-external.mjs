#!/usr/bin/env node
// setup-external.mjs
//
// Production setup: Atlas ERP against an external (self-hosted or cloud) Supabase.
// Does NOT require npx or a local Supabase installation.
//
// Usage:
//   node setup-external.mjs                    # full setup
//   node setup-external.mjs --skip-pull        # skip docker pull (images already local)
//   node setup-external.mjs --skip-migrate     # skip db:migrate + db:seed
//   node setup-external.mjs --skip-dev-kit     # skip AME3 dev kit download
//   node setup-external.mjs --up-only          # only docker compose up, nothing else

import fs from "node:fs/promises";
import fsSync from "node:fs";
import { lookup } from "node:dns/promises";
import path from "node:path";
import readline from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import {
  getLiveKitComposeProfiles,
  normalizeLiveKitDomain,
  renderLiveKitConfig,
  renderManagedCaddyfile,
  resolveLiveKitConfig,
  toLiveKitHttpUrl,
} from "./lib/livekit-config.mjs";

const argv = new Set(process.argv.slice(2));
const skipPull    = argv.has("--skip-pull");
const skipMigrate = argv.has("--skip-migrate");
const skipDevKit  = argv.has("--skip-dev-kit");
const upOnly      = argv.has("--up-only");
const docsOnly    = argv.has("--docs-only");
const isWindows   = process.platform === "win32";

const __filename    = fileURLToPath(import.meta.url);
const __dirname     = path.dirname(__filename);
const installerDir  = __dirname;
const composeFile   = path.resolve(__dirname, "docker-compose.yml");
const linuxComposeOverride = path.resolve(__dirname, "docker-compose.linux.yml");
const envFile       = path.resolve(__dirname, ".env.external");
const envExampleFile = path.resolve(__dirname, ".env.external.example");
const devKitDir     = path.resolve(__dirname, "custom-modules", "_atlas-devkit");
const liveKitConfigFile = path.resolve(__dirname, "livekit", "livekit.yaml");
const liveKitCaddyFile = path.resolve(__dirname, "livekit", "Caddyfile");
const legacyLiveKitExternalProxyFile = path.resolve(__dirname, "livekit", "reverse-proxy.nginx.conf");
const isLinux = process.platform === "linux";
const composeFiles = isLinux && fsSync.existsSync(linuxComposeOverride)
  ? ["-f", composeFile, "-f", linuxComposeOverride]
  : ["-f", composeFile];

const docsRepoOwner = process.env.ATLAS_DOCS_REPO_OWNER ?? "raulbellosom";
const docsRepoName  = process.env.ATLAS_DOCS_REPO_NAME  ?? "atlaserp";
const docsRepoRef   = process.env.ATLAS_DOCS_REPO_REF   ?? "main";
const docsRawBase   = process.env.ATLAS_DOCS_RAW_BASE   ??
  `https://raw.githubusercontent.com/${docsRepoOwner}/${docsRepoName}/${docsRepoRef}`;
const DEVKIT_EXPORT_REPO_PATH = "infra/installer/devkit-export";

const apiImage    = process.env.ATLAS_API_IMAGE           ?? "raulbellosom/atlaserp:api-latest";
const workerImage = process.env.ATLAS_WORKER_IMAGE        ?? "raulbellosom/atlaserp:worker-latest";
const webImage    = process.env.ATLAS_WEB_EXTERNAL_IMAGE  ?? "raulbellosom/atlaserp:web-latest";
const liveKitImage = process.env.LIVEKIT_IMAGE ?? "livekit/livekit-server:v1.12.0";
const liveKitRedisImage = process.env.LIVEKIT_REDIS_IMAGE ?? "redis:7-alpine";
const liveKitCaddyImage = process.env.LIVEKIT_CADDY_IMAGE ?? "caddy:2-alpine";

// ── helpers ──────────────────────────────────────────────────────────────────

function run(command, args, { cwd = installerDir, env = process.env } = {}) {
  const result = spawnSync(command, args, {
    cwd,
    env,
    stdio: "inherit",
    shell: isWindows,
  });
  if (result.error) {
    throw new Error(`${command} ${args.join(" ")} failed: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status}`);
  }
}

function tryRun(command, args, { cwd = installerDir, env = process.env } = {}) {
  const result = spawnSync(command, args, {
    cwd,
    env,
    stdio: "inherit",
    shell: isWindows,
  });
  if (result.error) return false;
  return result.status === 0;
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function pullWithRetry(image, label, retries = 3, delayMs = 5000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    console.log(`[setup-external] Pulling ${label} (attempt ${attempt}/${retries})...`);
    if (tryRun("docker", ["pull", image])) return image;
    if (attempt < retries) {
      console.warn(`[setup-external] Pull failed — retrying in ${delayMs / 1000}s...`);
      sleep(delayMs);
    }
  }
  throw new Error(
    `Could not pull ${label} image (${image}) after ${retries} attempts.\n` +
    `Pull it manually and re-run with --skip-pull.`
  );
}

async function exists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

function parseEnvValue(content, key) {
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx < 1) continue;
    if (trimmed.slice(0, eqIdx).trim() !== key) continue;
    const raw = trimmed.slice(eqIdx + 1);
    if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
      return raw.slice(1, -1);
    }
    return raw;
  }
  return undefined;
}

function hasEnvKey(content, key) {
  return content.split(/\r?\n/).some((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return false;
    const eqIdx = trimmed.indexOf("=");
    return eqIdx > 0 && trimmed.slice(0, eqIdx).trim() === key;
  });
}

const OPTIONAL_VAR_GROUPS = [
  {
    header: [
      "# ── Deployment (CORS + public URLs) ─────────────────────────────────────────",
      "# Set these when exposing Atlas on a public domain (VPS + Nginx).",
      "# CORS_ORIGIN: public URL of the Atlas web app (e.g. https://atlas.yourdomain.com).",
      "# ATLAS_API_URL: public URL of the Atlas API (e.g. https://api.yourdomain.com).",
      "#   The web container reads ATLAS_API_URL at startup to reach the API from the browser.",
    ],
    vars: [
      { key: "CORS_ORIGIN",    placeholder: "http://localhost:5173",  comment: null },
      { key: "ATLAS_API_URL",  placeholder: "http://localhost:4010",  comment: null },
    ],
  },
  {
    header: [
      "# ── Custom module ZIP upload ─────────────────────────────────────────────────",
      "# Container-side path where custom-modules/ is mounted (matches docker-compose volume).",
      "# Required for POST /modules/:key/upload and DELETE /modules/:key/purge.",
    ],
    vars: [
      { key: "ATLAS_MODULES_DIR", placeholder: "/app/modules/custom", comment: null },
    ],
  },
  {
    header: [
      "# ── Google Calendar integration (optional) ───────────────────────────────────",
      "# Register OAuth credentials at: https://console.cloud.google.com → APIs & Services → Credentials",
      "# Leave placeholders to disable Google Calendar sync.",
    ],
    vars: [
      { key: "GOOGLE_OAUTH_CLIENT_ID",     placeholder: "<YOUR_GOOGLE_OAUTH_CLIENT_ID>",     comment: null },
      { key: "GOOGLE_OAUTH_CLIENT_SECRET", placeholder: "<YOUR_GOOGLE_OAUTH_CLIENT_SECRET>", comment: null },
      { key: "GOOGLE_OAUTH_REDIRECT_URI",  placeholder: "https://your-atlas-domain.com/app/google/calendar/callback", comment: null },
      {
        key: "GOOGLE_OAUTH_ENCRYPTION_KEY",
        placeholder: "<YOUR_GOOGLE_OAUTH_ENCRYPTION_KEY>",
        comment: "# Generate: node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\"",
      },
    ],
  },
  {
    header: [
      "# ── atlas.pfm — lectura de tickets con IA (opcional) ─────────────────────────",
      "# Sin GROQ_API_KEY el modulo funciona igual y la subida de tickets responde 503",
      "# (la UI cae a captura manual). Consigue una clave gratis en https://console.groq.com",
    ],
    vars: [
      { key: "PFM_VISION_PROVIDER",  placeholder: "groq", comment: null },
      { key: "GROQ_API_KEY",         placeholder: "",     comment: null },
      { key: "GROQ_BASE_URL",        placeholder: "https://api.groq.com", comment: null },
      { key: "PFM_VISION_MODEL",     placeholder: "meta-llama/llama-4-scout-17b-16e-instruct", comment: null },
      { key: "PFM_VISION_TIMEOUT_MS", placeholder: "20000", comment: null },
    ],
  },
  {
    header: [
      "# ── Atlas Calls / LiveKit ──────────────────────────────────────────────────",
      "# embedded starts LiveKit + Redis; external uses an existing RTC server; disabled hides calls.",
    ],
    vars: [
      { key: "LIVEKIT_MODE", placeholder: "embedded", comment: null },
      { key: "LIVEKIT_DOMAIN", placeholder: "", comment: "# Public hostname, for example rtc.example.com" },
      { key: "LIVEKIT_TLS_MODE", placeholder: "managed", comment: "# managed or external" },
      { key: "LIVEKIT_URL", placeholder: "", comment: "# Public browser URL, for example wss://rtc.yourdomain.com" },
      { key: "LIVEKIT_INTERNAL_URL", placeholder: "", comment: "# Derived automatically in embedded mode" },
      { key: "LIVEKIT_API_KEY", placeholder: "", comment: null },
      { key: "LIVEKIT_API_SECRET", placeholder: "", comment: null },
    ],
  },
];

async function writeComposeEnv(envFilePath) {
  const content = await fs.readFile(envFilePath, "utf8");
  const supabaseUrl  = parseEnvValue(content, "SUPABASE_URL")    ?? "";
  const anonKey      = parseEnvValue(content, "SUPABASE_ANON_KEY") ?? "";
  const atlasApiUrl  = parseEnvValue(content, "ATLAS_API_URL")   ?? "http://localhost:4010";

  // Docker Compose auto-loads ".env" (no extension) in the same directory for
  // ${VAR} interpolation. The web service uses ${ATLAS_API_URL}, ${SUPABASE_URL},
  // and ${SUPABASE_ANON_KEY} so the browser can reach them at runtime.
  const composeEnvFile = path.resolve(installerDir, ".env");
  const composeEnvContent = [
    "# Auto-generated by setup-external.mjs — do not edit manually.",
    "# Docker Compose reads this file to resolve ${SUPABASE_URL}, ${SUPABASE_ANON_KEY},",
    "# and ${ATLAS_API_URL} for the web service so the browser can reach them.",
    `SUPABASE_URL=${supabaseUrl}`,
    `SUPABASE_ANON_KEY=${anonKey}`,
    `ATLAS_API_URL=${atlasApiUrl}`,
    "",
  ].join("\n");
  await fs.writeFile(composeEnvFile, composeEnvContent, "utf8");
}

async function appendMissingOptionalVars(filePath) {
  const content = await fs.readFile(filePath, "utf8");
  const addedKeys = [];
  const lines = [];

  for (const group of OPTIONAL_VAR_GROUPS) {
    const missingVars = group.vars.filter((v) => !hasEnvKey(content, v.key));
    if (missingVars.length === 0) continue;
    lines.push("", ...group.header);
    for (const { key, placeholder, comment } of missingVars) {
      if (comment) lines.push(comment);
      lines.push(`${key}=${placeholder}`);
      addedKeys.push(key);
    }
  }

  if (addedKeys.length === 0) return;
  lines.push("");
  await fs.appendFile(filePath, lines.join("\n"), "utf8");

  console.warn("");
  console.warn("[setup-external] New variables appended to .env.external:");
  for (const key of addedKeys) console.warn(`  ${key}`);
  console.warn("  Review and fill them in before starting containers.");
}

function setEnvValue(content, key, value) {
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, "m");
  return pattern.test(content) ? content.replace(pattern, line) : `${content.trimEnd()}\n${line}\n`;
}

async function writeLiveKitArtifacts(config) {
  await fs.mkdir(path.dirname(liveKitConfigFile), { recursive: true });
  if (config.mode !== "embedded") {
    await Promise.all([
      fs.rm(liveKitConfigFile, { force: true }),
      fs.rm(liveKitCaddyFile, { force: true }),
      fs.rm(legacyLiveKitExternalProxyFile, { force: true }),
    ]);
    return;
  }

  await fs.writeFile(
    liveKitConfigFile,
    renderLiveKitConfig({ ...config, isLinux }),
    { encoding: "utf8", mode: 0o600 },
  );
  try { await fs.chmod(liveKitConfigFile, 0o600); } catch { /* Windows does not apply POSIX modes. */ }

  if (config.managedTls) {
    await fs.writeFile(
      liveKitCaddyFile,
      renderManagedCaddyfile({ domain: config.domain, isLinux }),
      { encoding: "utf8", mode: 0o600 },
    );
    try { await fs.chmod(liveKitCaddyFile, 0o600); } catch { /* Windows does not apply POSIX modes. */ }
    await fs.rm(legacyLiveKitExternalProxyFile, { force: true });
  } else if (config.domain && config.tlsMode === "external") {
    await Promise.all([
      fs.rm(liveKitCaddyFile, { force: true }),
      fs.rm(legacyLiveKitExternalProxyFile, { force: true }),
    ]);
    console.log(
      `  External TLS: Atlas will not modify Nginx or certificates; proxy ${config.domain} to 127.0.0.1:7880.`,
    );
  } else {
    await Promise.all([
      fs.rm(liveKitCaddyFile, { force: true }),
      fs.rm(legacyLiveKitExternalProxyFile, { force: true }),
    ]);
  }
}

function removeInactiveLiveKitServices(config) {
  const composeArgs = [
    "compose",
    ...composeFiles,
    "--profile", "livekit",
    "--profile", "livekit-tls",
    "rm", "--stop", "--force",
  ];
  if (config.mode !== "embedded") {
    tryRun("docker", [...composeArgs, "livekit-caddy", "livekit", "livekit-redis"]);
  } else if (!config.managedTls) {
    tryRun("docker", [...composeArgs, "livekit-caddy"]);
  }
}

async function promptForLiveKitDomain() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error(
      "LIVEKIT_MODE=embedded requires LIVEKIT_DOMAIN in .env.external. "
      + "Add a value such as LIVEKIT_DOMAIN=rtc.example.com and re-run the installer.",
    );
  }
  const terminal = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await terminal.question("LiveKit public domain (for example rtc.example.com): ");
    const domain = normalizeLiveKitDomain(answer);
    if (!domain) throw new Error("LIVEKIT_DOMAIN cannot be empty in production embedded mode.");
    return domain;
  } finally {
    terminal.close();
  }
}

async function configureLiveKit(filePath) {
  let content = await fs.readFile(filePath, "utf8");
  const mode = String(parseEnvValue(content, "LIVEKIT_MODE") || "embedded").trim().toLowerCase();
  let domain = String(parseEnvValue(content, "LIVEKIT_DOMAIN") || "").trim();
  if (mode === "embedded" && !domain) {
    domain = await promptForLiveKitDomain();
    content = setEnvValue(content, "LIVEKIT_DOMAIN", domain);
  }

  const config = resolveLiveKitConfig({
    deployment: "external",
    isLinux,
    values: {
      mode,
      domain,
      tlsMode: parseEnvValue(content, "LIVEKIT_TLS_MODE"),
      publicUrl: parseEnvValue(content, "LIVEKIT_URL"),
      internalUrl: parseEnvValue(content, "LIVEKIT_INTERNAL_URL"),
      apiKey: parseEnvValue(content, "LIVEKIT_API_KEY"),
      apiSecret: parseEnvValue(content, "LIVEKIT_API_SECRET"),
    },
  });

  for (const [key, value] of [
    ["LIVEKIT_MODE", config.mode],
    ["LIVEKIT_DOMAIN", config.domain],
    ["LIVEKIT_TLS_MODE", config.tlsMode],
    ["LIVEKIT_URL", config.publicUrl],
    ["LIVEKIT_INTERNAL_URL", config.internalUrl],
    ["LIVEKIT_API_KEY", config.apiKey],
    ["LIVEKIT_API_SECRET", config.apiSecret],
  ]) {
    content = setEnvValue(content, key, value);
  }
  await fs.writeFile(filePath, content, { encoding: "utf8", mode: 0o600 });
  try { await fs.chmod(filePath, 0o600); } catch { /* Windows does not apply POSIX modes. */ }
  await writeLiveKitArtifacts(config);
  return config;
}

function tryCapture(command, args, { cwd = installerDir, env = process.env } = {}) {
  const result = spawnSync(command, args, {
    cwd,
    env,
    stdio: "pipe",
    encoding: "utf8",
    shell: isWindows,
  });
  return {
    ok: !result.error && result.status === 0,
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`.trim(),
  };
}

async function validateLiveKitDns(config) {
  if (config.mode === "disabled") return;
  const hostname = config.domain || new URL(config.publicUrl).hostname;
  const addresses = await lookup(hostname, { all: true });
  if (!addresses.length) throw new Error(`LiveKit hostname did not resolve: ${hostname}`);
  console.log(`  LiveKit DNS: ${hostname} -> ${addresses.map((item) => item.address).join(", ")}`);
}

async function validateLiveKitRuntime(config) {
  if (config.mode === "disabled") return;

  console.log("[LiveKit] Validating Redis, LiveKit, API connectivity, and public TLS...");
  if (config.mode === "embedded") {
    const redisPort = isLinux ? "6380" : "6379";
    let redis = { ok: false, output: "Redis is not ready." };
    for (let attempt = 1; attempt <= 24; attempt += 1) {
      redis = tryCapture("docker", [
        "exec", "atlas-livekit-redis", "redis-cli", "-p", redisPort, "ping",
      ]);
      if (redis.ok && /PONG/i.test(redis.output)) break;
      await new Promise((resolve) => setTimeout(resolve, 2_500));
    }
    if (!redis.ok || !/PONG/i.test(redis.output)) {
      throw new Error(`LiveKit Redis health check failed: ${redis.output || "no response"}`);
    }
    console.log("  Redis: PONG");
  }

  let smokeResult = { ok: false, output: "API container is not ready." };
  for (let attempt = 1; attempt <= 24; attempt += 1) {
    smokeResult = tryCapture("docker", [
      "exec",
      "atlas-api-external",
      "node",
      "apps/api/src/scripts/livekit-smoke.js",
    ]);
    if (smokeResult.ok) break;
    await new Promise((resolve) => setTimeout(resolve, 5_000));
  }
  if (!smokeResult.ok) {
    throw new Error(`API-to-LiveKit smoke test failed: ${smokeResult.output}`);
  }
  console.log("  API -> LiveKit: temporary room created and deleted");

  const healthUrl = `${toLiveKitHttpUrl(config.publicUrl).replace(/\/$/, "")}/`;
  let lastError = "no response";
  for (let attempt = 1; attempt <= 24; attempt += 1) {
    try {
      const response = await fetch(healthUrl, { signal: AbortSignal.timeout(10_000) });
      if (response.ok) {
        console.log(`  Public TLS/WSS: ${config.publicUrl}`);
        return;
      }
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error.message;
    }
    await new Promise((resolve) => setTimeout(resolve, 5_000));
  }
  throw new Error(`Public LiveKit TLS validation failed for ${config.publicUrl}: ${lastError}`);
}

function getDevKitManifestRepoPath() {
  return `${DEVKIT_EXPORT_REPO_PATH}/manifest.json`;
}

async function downloadTextFile(url) {
  const response = await fetch(url, {
    headers: { "User-Agent": "atlaserp-installer" },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} fetching ${url}`);
  return response.text();
}

async function downloadDevKitSnapshot({ devKitDir, docsRawBase }) {
  const manifestUrl = `${docsRawBase}/${getDevKitManifestRepoPath()}`;
  const manifestSource = await downloadTextFile(manifestUrl);
  const manifest = JSON.parse(manifestSource);
  const files = Array.isArray(manifest?.files) ? manifest.files : [];

  if (!files.length) {
    throw new Error("Dev Kit manifest does not contain any files.");
  }

  await fs.mkdir(devKitDir, { recursive: true });
  const downloadedFiles = [];
  const failedFiles = [];

  for (const relativePath of files) {
    const url = `${docsRawBase}/${DEVKIT_EXPORT_REPO_PATH}/${relativePath}`;
    const destination = path.resolve(devKitDir, relativePath);
    try {
      const content = await downloadTextFile(url);
      await fs.mkdir(path.dirname(destination), { recursive: true });
      await fs.writeFile(destination, content, "utf8");
      downloadedFiles.push(relativePath);
    } catch (error) {
      failedFiles.push({ relativePath, error });
    }
  }

  return { manifest, downloadedFiles, failedFiles };
}

async function downloadDevKit() {
  if (skipDevKit) {
    console.log("[3/5] Skipping Dev Kit download (--skip-dev-kit).");
    return;
  }
  if (typeof fetch !== "function") {
    console.warn("[setup-external] Dev Kit skipped: Node.js runtime has no global fetch().");
    return;
  }

  await fs.mkdir(devKitDir, { recursive: true });
  const { downloadedFiles: ok, failedFiles } = await downloadDevKitSnapshot({
    devKitDir,
    docsRawBase,
  });

  if (failedFiles.length > 0) {
    console.warn(`[setup-external] Dev Kit: ${ok.length} ok, ${failedFiles.length} failed.`);
    for (const { relativePath, error } of failedFiles) console.warn(`  - ${relativePath}: ${error.message}`);
  } else {
    console.log(`[3/5] Dev Kit ready at ${devKitDir} (${ok.length} files).`);
  }
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  let liveKit = resolveLiveKitConfig({
    deployment: "external",
    isLinux,
    values: { mode: "disabled" },
  });
  // ── docs-only shortcut ────────────────────────────────────────────────────
  if (docsOnly) {
    console.log("[setup-external] --docs-only: downloading Dev Kit files only.");
    await downloadDevKit();
    console.log("[setup-external] Done.");
    return;
  }

  // ── 1. Validate environment file ──────────────────────────────────────────
  if (!upOnly) {
    console.log("[1/5] Checking .env.external...");
    if (!(await exists(envFile))) {
      if (await exists(envExampleFile)) {
        await fs.copyFile(envExampleFile, envFile);
        console.error("");
        console.error("  .env.external was not found — copied from .env.external.example.");
        console.error("  Edit .env.external with Supabase credentials and LIVEKIT_DOMAIN, then re-run:");
        console.error(`    ${isWindows ? "node .\\setup-external.mjs" : "node ./setup-external.mjs"}`);
        console.error("");
      } else {
        console.error("");
        console.error("  .env.external not found. Create it:");
        console.error("    cp .env.external.example .env.external");
        console.error("  then fill in your credentials and re-run.");
        console.error("");
      }
      process.exit(1);
    }
    console.log("  .env.external found.");
    await appendMissingOptionalVars(envFile);
    liveKit = await configureLiveKit(envFile);
    await validateLiveKitDns(liveKit);
    await writeComposeEnv(envFile);
  }

  // When --up-only skips the env check above, still regenerate the compose .env
  // if .env.external already exists (ensures ATLAS_API_URL is always up to date).
  if (upOnly && (await exists(envFile))) {
    liveKit = await configureLiveKit(envFile);
    await validateLiveKitDns(liveKit);
    await writeComposeEnv(envFile);
  }

  // ── 2. Validate Docker ─────────────────────────────────────────────────────
  console.log("[2/5] Validating Docker...");
  run("docker", ["compose", "version"]);

  // ── 3. Dev Kit ─────────────────────────────────────────────────────────────
  if (!upOnly) {
    await downloadDevKit();
  } else {
    console.log("[3/5] Skipping Dev Kit (--up-only).");
  }

  // ── 4. Pull images ─────────────────────────────────────────────────────────
  await fs.mkdir(path.resolve(installerDir, "custom-modules"), { recursive: true });

  let resolvedApiImage    = apiImage;
  let resolvedWorkerImage = workerImage;
  let resolvedWebImage    = webImage;

  if (skipPull || upOnly) {
    console.log("[4/5] Skipping image pull.");
  } else {
    console.log("[4/5] Pulling Atlas images...");
    resolvedApiImage    = pullWithRetry(apiImage,    "API");
    resolvedWorkerImage = pullWithRetry(workerImage, "Worker");
    resolvedWebImage    = pullWithRetry(webImage,    "Web");
    if (liveKit.mode === "embedded") {
      pullWithRetry(liveKitImage, "LiveKit");
      pullWithRetry(liveKitRedisImage, "LiveKit Redis");
      if (liveKit.managedTls) pullWithRetry(liveKitCaddyImage, "LiveKit Caddy");
    }
    // Remove dangling layers left behind when `latest` tags are re-pulled.
    // This prevents disk accumulation on every deploy without touching other projects.
    console.log("     Pruning dangling images...");
    tryRun("docker", ["image", "prune", "-f"]);
  }

  // ── 5. Migrate + seed (first install or explicit reset) ───────────────────
  if (skipMigrate || upOnly) {
    console.log("[5/5] Skipping migrations.");
  } else {
    console.log("[5/5] Running migrations and seed...");
    // --add-host covers the case where DATABASE_URL points to localhost on the
    // same machine; harmless when pointing to a remote host.
    const dockerRunBase = [
      "run", "--rm",
      "--add-host", "host.docker.internal:host-gateway",
      "--env-file", envFile,
    ];
    run("docker", [...dockerRunBase, resolvedApiImage, "pnpm", "db:migrate"]);
    run("docker", [...dockerRunBase, resolvedApiImage, "pnpm", "db:seed"]);
  }

  // ── 6. Start containers ────────────────────────────────────────────────────
  console.log("\nStarting Atlas (external profile)...");
  removeInactiveLiveKitServices(liveKit);
  const liveKitProfiles = getLiveKitComposeProfiles(liveKit)
    .flatMap((profile) => ["--profile", profile]);
  run(
    "docker",
    ["compose", ...composeFiles, "--profile", "external", ...liveKitProfiles, "up", "-d", "--force-recreate"],
    {
      env: {
        ...process.env,
        ATLAS_API_IMAGE:          resolvedApiImage,
        ATLAS_WORKER_IMAGE:       resolvedWorkerImage,
        ATLAS_WEB_EXTERNAL_IMAGE: resolvedWebImage,
        LIVEKIT_IMAGE:            liveKitImage,
        LIVEKIT_REDIS_IMAGE:      liveKitRedisImage,
        LIVEKIT_CADDY_IMAGE:      liveKitCaddyImage,
      },
    },
  );

  await validateLiveKitRuntime(liveKit);

  console.log("");
  console.log("Atlas ERP is ready (external mode):");
  console.log("  Web:  http://localhost:5173");
  console.log("  API:  http://localhost:4010");
  if (liveKit.mode !== "disabled") console.log(`  LiveKit: ${liveKit.publicUrl}`);
  if (!upOnly) {
    console.log(`  Dev Kit: ${devKitDir}`);
  }
}

main().catch((err) => {
  console.error("");
  console.error("[setup-external] Error:", err.message);
  process.exit(1);
});
