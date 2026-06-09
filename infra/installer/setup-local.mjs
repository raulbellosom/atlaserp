#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const argv = new Set(process.argv.slice(2));
const skipComposeUp = argv.has("--skip-compose-up");
const skipDevKit = argv.has("--skip-dev-kit");
const skipPull = argv.has("--skip-pull");
const isWindows = process.platform === "win32";
const npxCommand = "npx";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const installerDir = __dirname;
const composeFile = path.resolve(__dirname, "docker-compose.yml");
const linuxComposeOverride = path.resolve(__dirname, "docker-compose.linux.yml");
const localEnvFile = path.resolve(__dirname, ".env.local");
const supabaseWorkdir = path.resolve(__dirname, ".supabase-local");
const supabaseConfig = path.resolve(supabaseWorkdir, "supabase", "config.toml");
const devKitDir = path.resolve(__dirname, "custom-modules", "_atlas-devkit");

// Docker Desktop (Windows/macOS) injects host.docker.internal automatically.
// Linux Docker Engine does not — we handle it via --add-host for docker run and
// via docker-compose.linux.yml override for compose services.
const isLinux = process.platform === "linux";
const addHostArgs = isLinux ? ["--add-host", "host.docker.internal:host-gateway"] : [];
const composeFiles = isLinux
  ? ["-f", composeFile, "-f", linuxComposeOverride]
  : ["-f", composeFile];

const docsRepoOwner = process.env.ATLAS_DOCS_REPO_OWNER ?? "raulbellosom";
const docsRepoName = process.env.ATLAS_DOCS_REPO_NAME ?? "atlaserp";
const docsRepoRef = process.env.ATLAS_DOCS_REPO_REF ?? "main";
const docsRawBase =
  process.env.ATLAS_DOCS_RAW_BASE ??
  `https://raw.githubusercontent.com/${docsRepoOwner}/${docsRepoName}/${docsRepoRef}`;

const devKitFiles = [
  "AGENTS.md",
  "docs/ai-context/ame3-modules.md",
  "docs/ai-context/ame3-runtime-capabilities.md",
  "docs/02_module_system.md",
  "docs/03_custom_modules.md",
  "docs/architecture/atlas-module-engine-v3.md",
  "docs/TASKS.md",
];

const apiImage =
  process.env.ATLAS_API_LOCAL_IMAGE ?? "raulbellosom/atlaserp:api-latest";
const workerImage =
  process.env.ATLAS_WORKER_LOCAL_IMAGE ??
  "raulbellosom/atlaserp:worker-latest";
const webImage =
  process.env.ATLAS_WEB_LOCAL_IMAGE ?? "raulbellosom/atlaserp:web-latest";

const fallbackApiImage = "raulbellosom/atlaserp:api-latest";
const fallbackWorkerImage = "raulbellosom/atlaserp:worker-latest";
const fallbackWebImage = "raulbellosom/atlaserp:web-latest";

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

function capture(command, args, { cwd = installerDir, env = process.env } = {}) {
  const result = spawnSync(command, args, {
    cwd,
    env,
    stdio: "pipe",
    encoding: "utf8",
    shell: isWindows,
  });
  if (result.error) {
    throw new Error(`${command} ${args.join(" ")} failed: ${result.error.message}`);
  }
  if (result.status !== 0) {
    const stderr = (result.stderr ?? "").trim();
    throw new Error(
      `${command} ${args.join(" ")} failed with exit code ${result.status}${stderr ? `: ${stderr}` : ""}`
    );
  }
  return result.stdout ?? "";
}

async function exists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
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

function pullWithRetry(image, label, retries = 3, delayMs = 5000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    console.log(`[setup-local] Pulling ${label} (attempt ${attempt}/${retries})...`);
    const ok = tryRun("docker", ["pull", image]);
    if (ok) return image;
    if (attempt < retries) {
      console.warn(`[setup-local] Pull failed, retrying in ${delayMs / 1000}s...`);
      sleep(delayMs);
    }
  }
  throw new Error(`Could not pull ${label} image (${image}) after ${retries} attempts. Check your network and try again, or run with --skip-pull if the image is already local.`);
}

async function downloadTextFile(url) {
  const response = await fetch(url, {
    headers: { "User-Agent": "atlaserp-installer" },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} when downloading ${url}`);
  }
  return response.text();
}

async function writeDevKitReadme(downloadedFiles) {
  const readmePath = path.resolve(devKitDir, "README.md");
  const fileList = downloadedFiles.map((item) => `- ${item}`).join("\n");
  const content = `# Atlas ERP Dev Kit (AME3)

This folder is auto-generated by setup-local.mjs.
Source repository: https://github.com/${docsRepoOwner}/${docsRepoName}
Source ref: ${docsRepoRef}

Downloaded documentation:
${fileList}

Recommended workflow for AI assistants:
1. Read AGENTS.md first.
2. Read docs/ai-context/ame3-modules.md before creating or editing modules.
3. Read docs/ai-context/ame3-runtime-capabilities.md for available UI components and view kinds.
4. Follow AME3 rules exactly (no prisma model accessors for module tables, no prisma/schema.prisma edits for module tables).
5. Custom React components in components/index.js are compiled at install time — no web image rebuild needed.
6. Use @atlas/ui primitives and blueprint kinds (TABLE, FORM, DETAIL, CUSTOM) from ame3-runtime-capabilities.md.

Custom modules directory:
- Host: custom-modules/
- Runtime mount: /app/modules/custom

Key commands:
  Sync module manifests:  curl -X POST http://localhost:4010/modules/sync -H "Authorization: Bearer <TOKEN>"
  Install a module:       curl -X POST http://localhost:4010/modules/<key>/install -H "Authorization: Bearer <TOKEN>"
  Rebuild bundle:         curl -X POST http://localhost:4010/modules/<key>/sync -H "Authorization: Bearer <TOKEN>"
  Verify bundle:          curl http://localhost:4010/modules/<key>/bundle.js
`;
  await fs.writeFile(readmePath, content, "utf8");
}

async function downloadDevKit() {
  if (skipDevKit) {
    console.log("[5/8] Skipping Dev Kit download (--skip-dev-kit).");
    return;
  }

  if (typeof fetch !== "function") {
    console.warn("[setup-local] Dev Kit skipped: this Node.js runtime does not provide global fetch().");
    return;
  }

  await fs.mkdir(devKitDir, { recursive: true });
  const downloadedFiles = [];
  const failedFiles = [];

  for (const relativePath of devKitFiles) {
    const url = `${docsRawBase}/${relativePath}`;
    const targetPath = path.resolve(devKitDir, relativePath);
    try {
      const content = await downloadTextFile(url);
      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      await fs.writeFile(targetPath, content, "utf8");
      downloadedFiles.push(relativePath);
    } catch (error) {
      failedFiles.push({ relativePath, error });
    }
  }

  await writeDevKitReadme(downloadedFiles);

  if (failedFiles.length > 0) {
    console.warn(
      `[setup-local] Dev Kit downloaded with warnings (${downloadedFiles.length} ok, ${failedFiles.length} failed).`
    );
    for (const item of failedFiles) {
      console.warn(`  - ${item.relativePath}: ${item.error.message}`);
    }
    return;
  }

  console.log(
    `[5/8] Dev Kit ready at ${devKitDir} (${downloadedFiles.length} files).`
  );
}

function replaceUrlHost(urlValue, targetHost) {
  if (!urlValue) return urlValue;
  try {
    const url = new URL(urlValue);
    if (["127.0.0.1", "localhost", "host.docker.internal"].includes(url.hostname)) {
      url.hostname = targetHost;
      return url.toString().replace(/\/$/, "");
    }
  } catch {
    return urlValue;
  }
  return urlValue;
}

function parseSupabaseStatusEnv(statusOutput) {
  const envMap = new Map();
  const lines = statusOutput.split(/\r?\n/).map((line) => line.trim());
  for (const line of lines) {
    const match = /^([A-Z0-9_]+)="(.*)"$/.exec(line);
    if (match) {
      envMap.set(match[1], match[2]);
    }
  }
  return envMap;
}

async function writeLocalEnv(envMap) {
  const requiredKeys = ["API_URL", "ANON_KEY", "SERVICE_ROLE_KEY", "JWT_SECRET", "DB_URL"];
  const missing = requiredKeys.filter((key) => !envMap.get(key));
  if (missing.length > 0) {
    throw new Error(
      `Could not read required Supabase variables from status output: ${missing.join(", ")}`
    );
  }

  const containerSupabaseUrl = replaceUrlHost(envMap.get("API_URL"), "host.docker.internal");
  const containerDbUrl = replaceUrlHost(envMap.get("DB_URL"), "host.docker.internal");
  // On a VPS exposed via Nginx, set ATLAS_SUPABASE_PUBLIC_URL to the public Supabase URL
  // (e.g. https://supabase.yourdomain.com) so the browser can reach it from the internet.
  const browserSupabaseUrl = process.env.ATLAS_SUPABASE_PUBLIC_URL
    ? process.env.ATLAS_SUPABASE_PUBLIC_URL.replace(/\/$/, "")
    : replaceUrlHost(envMap.get("API_URL"), "localhost");

  // Preserve user-configured vars across re-runs so re-generating Supabase credentials
  // does not wipe deployment-specific settings (CORS, Google OAuth, etc.).
  let existingEnvContent = "";
  try { existingEnvContent = await fs.readFile(localEnvFile, "utf8"); } catch { /* first run */ }

  const corsOrigin         = parseEnvValue(existingEnvContent, "CORS_ORIGIN")                 || "http://localhost:5173";
  const googleClientId     = parseEnvValue(existingEnvContent, "GOOGLE_OAUTH_CLIENT_ID")     || "<YOUR_GOOGLE_OAUTH_CLIENT_ID>";
  const googleClientSecret = parseEnvValue(existingEnvContent, "GOOGLE_OAUTH_CLIENT_SECRET") || "<YOUR_GOOGLE_OAUTH_CLIENT_SECRET>";
  const googleRedirectUri  = parseEnvValue(existingEnvContent, "GOOGLE_OAUTH_REDIRECT_URI")  || "https://your-atlas-domain.com/app/google/calendar/callback";
  // Auto-generate a stable 32-byte key on first run; preserve on subsequent runs.
  const googleEncryptionKey = parseEnvValue(existingEnvContent, "GOOGLE_OAUTH_ENCRYPTION_KEY")
    || crypto.randomBytes(32).toString("base64");

  const envContent = `# Auto-generated by infra/installer/setup-local.mjs
# Re-run the script anytime to refresh local Supabase credentials.
# Deployment-specific vars (CORS_ORIGIN, Google OAuth) are preserved across re-runs.

NODE_ENV=production
ATLAS_API_PORT=4010
ATLAS_TIME_ZONE=America/Mexico_City
TZ=America/Mexico_City

SUPABASE_URL=${containerSupabaseUrl}
SUPABASE_ANON_KEY=${envMap.get("ANON_KEY")}
SUPABASE_SERVICE_ROLE_KEY=${envMap.get("SERVICE_ROLE_KEY")}
SUPABASE_JWT_SECRET=${envMap.get("JWT_SECRET")}

# Keep Atlas JWT aligned with Supabase local JWT secret.
JWT_SECRET=${envMap.get("JWT_SECRET")}

DATABASE_URL=${containerDbUrl}
DIRECT_URL=${containerDbUrl}

VITE_SUPABASE_URL=${browserSupabaseUrl}
VITE_SUPABASE_ANON_KEY=${envMap.get("ANON_KEY")}
VITE_ATLAS_API_URL=http://localhost:4010
CORS_ORIGIN=${corsOrigin}

# ── Google Calendar integration (optional) ───────────────────────────────────
# Register OAuth credentials at: https://console.cloud.google.com → APIs & Services → Credentials
# Leave placeholders to disable Google Calendar sync.
GOOGLE_OAUTH_CLIENT_ID=${googleClientId}
GOOGLE_OAUTH_CLIENT_SECRET=${googleClientSecret}
GOOGLE_OAUTH_REDIRECT_URI=${googleRedirectUri}
# Stable 32-byte base64 key — auto-generated on first run. Changing it invalidates stored tokens.
GOOGLE_OAUTH_ENCRYPTION_KEY=${googleEncryptionKey}
`;

  await fs.writeFile(localEnvFile, envContent, "utf8");

  // Docker Compose auto-loads a file named exactly ".env" in the same directory
  // for ${VAR} interpolation. The web service reads ${SUPABASE_URL} and
  // ${SUPABASE_ANON_KEY} from here to pass them into runtime-config.js.
  // Must use the browser-accessible URL (localhost), not host.docker.internal.
  const composeEnvFile = path.resolve(installerDir, ".env");
  const composeEnvContent = `# Auto-generated by setup-local.mjs — do not edit manually.
# Docker Compose reads this file to resolve \${SUPABASE_URL}, \${SUPABASE_ANON_KEY}, and
# \${ATLAS_API_URL} in the web service so the browser can reach them.
# For VPS deployment, re-run with ATLAS_SUPABASE_PUBLIC_URL and ATLAS_API_URL set:
#   ATLAS_SUPABASE_PUBLIC_URL=https://supabase.yourdomain.com ATLAS_API_URL=https://api.yourdomain.com node setup-local.mjs
SUPABASE_URL=${browserSupabaseUrl}
SUPABASE_ANON_KEY=${envMap.get("ANON_KEY")}
${process.env.ATLAS_API_URL ? `ATLAS_API_URL=${process.env.ATLAS_API_URL}` : "# ATLAS_API_URL defaults to http://localhost:4010 — override for VPS/public deployments"}
`;
  await fs.writeFile(composeEnvFile, composeEnvContent, "utf8");
}

async function main() {
  console.log("[1/8] Validating dependencies...");
  run("docker", ["compose", "version"]);
  run(npxCommand, ["--version"]);

  if (!(await exists(supabaseWorkdir))) {
    await fs.mkdir(supabaseWorkdir, { recursive: true });
  }

  console.log("[2/8] Initializing Supabase project (if missing)...");
  if (!(await exists(supabaseConfig))) {
    run(npxCommand, ["--yes", "supabase", "init", "--yes", "--workdir", supabaseWorkdir]);
  }

  console.log("[3/8] Starting Supabase local stack...");
  run(npxCommand, [
    "--yes",
    "supabase",
    "start",
    "--workdir",
    supabaseWorkdir,
    "-x",
    "logflare",
    "-x",
    "vector",
  ]);

  console.log("[4/8] Reading Supabase runtime credentials...");
  const statusOutput = capture(npxCommand, [
    "--yes",
    "supabase",
    "status",
    "--workdir",
    supabaseWorkdir,
    "-o",
    "env",
  ]);
  const envMap = parseSupabaseStatusEnv(statusOutput);
  await writeLocalEnv(envMap);
  console.log(`Generated ${localEnvFile}`);

  await downloadDevKit();

  if (skipComposeUp) {
    console.log("[6/8] Skipping image pull and compose up (--skip-compose-up).");
    return;
  }

  let resolvedApiImage = apiImage;
  let resolvedWorkerImage = workerImage;
  let resolvedWebImage = webImage;

  if (skipPull) {
    console.log("[6/8] Skipping image pull (--skip-pull). Using local images.");
  } else {
    console.log("[6/8] Pulling Atlas local runtime images...");
    resolvedApiImage = pullWithRetry(apiImage, "API");
    resolvedWorkerImage = pullWithRetry(workerImage, "Worker");
    resolvedWebImage = pullWithRetry(webImage, "Web");
  }

  console.log("[7/8] Running migrations and seed...");
  run("docker", [
    "run", "--rm",
    ...addHostArgs,
    "--env-file", localEnvFile,
    resolvedApiImage, "pnpm", "db:migrate",
  ]);
  run("docker", [
    "run", "--rm",
    ...addHostArgs,
    "--env-file", localEnvFile,
    resolvedApiImage, "pnpm", "db:seed",
  ]);

  console.log("[8/8] Starting Atlas local profile...");
  run(
    "docker",
    ["compose", ...composeFiles, "--profile", "local", "up", "-d"],
    {
      env: {
        ...process.env,
        ATLAS_API_LOCAL_IMAGE: resolvedApiImage,
        ATLAS_WORKER_LOCAL_IMAGE: resolvedWorkerImage,
        ATLAS_WEB_LOCAL_IMAGE: resolvedWebImage,
      },
    }
  );

  console.log("");
  console.log("Local installation is ready:");
  console.log("- Atlas web: http://localhost:5173");
  console.log("- Atlas API: http://localhost:4010");
  console.log("- Supabase API gateway: http://localhost:54321");
  console.log("- Supabase Studio: http://localhost:54323");
  console.log(`- AME3 Dev Kit: ${devKitDir}`);
}

main().catch((error) => {
  console.error("");
  console.error("[setup-local] Error:");
  console.error(error.message);
  process.exit(1);
});
