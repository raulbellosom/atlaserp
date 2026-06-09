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
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const argv = new Set(process.argv.slice(2));
const skipPull    = argv.has("--skip-pull");
const skipMigrate = argv.has("--skip-migrate");
const skipDevKit  = argv.has("--skip-dev-kit");
const upOnly      = argv.has("--up-only");
const isWindows   = process.platform === "win32";

const __filename    = fileURLToPath(import.meta.url);
const __dirname     = path.dirname(__filename);
const installerDir  = __dirname;
const composeFile   = path.resolve(__dirname, "docker-compose.yml");
const envFile       = path.resolve(__dirname, ".env.external");
const envExampleFile = path.resolve(__dirname, ".env.external.example");
const devKitDir     = path.resolve(__dirname, "custom-modules", "_atlas-devkit");

const docsRepoOwner = process.env.ATLAS_DOCS_REPO_OWNER ?? "raulbellosom";
const docsRepoName  = process.env.ATLAS_DOCS_REPO_NAME  ?? "atlaserp";
const docsRepoRef   = process.env.ATLAS_DOCS_REPO_REF   ?? "main";
const docsRawBase   = process.env.ATLAS_DOCS_RAW_BASE   ??
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

const apiImage    = process.env.ATLAS_API_IMAGE           ?? "raulbellosom/atlaserp:api-latest";
const workerImage = process.env.ATLAS_WORKER_IMAGE        ?? "raulbellosom/atlaserp:worker-latest";
const webImage    = process.env.ATLAS_WEB_EXTERNAL_IMAGE  ?? "raulbellosom/atlaserp:web-latest";

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

function hasEnvKey(content, key) {
  return content.split(/\r?\n/).some((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return false;
    const eqIdx = trimmed.indexOf("=");
    return eqIdx > 0 && trimmed.slice(0, eqIdx).trim() === key;
  });
}

const GOOGLE_OPTIONAL_VARS = [
  { key: "GOOGLE_OAUTH_CLIENT_ID",     placeholder: "<YOUR_GOOGLE_OAUTH_CLIENT_ID>",     comment: null },
  { key: "GOOGLE_OAUTH_CLIENT_SECRET", placeholder: "<YOUR_GOOGLE_OAUTH_CLIENT_SECRET>", comment: null },
  { key: "GOOGLE_OAUTH_REDIRECT_URI",  placeholder: "https://your-atlas-domain.com/app/google/calendar/callback", comment: null },
  {
    key: "GOOGLE_OAUTH_ENCRYPTION_KEY",
    placeholder: "<YOUR_GOOGLE_OAUTH_ENCRYPTION_KEY>",
    comment: "# Generate: node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\"",
  },
];

async function appendMissingOptionalVars(filePath) {
  const content = await fs.readFile(filePath, "utf8");
  const missing = GOOGLE_OPTIONAL_VARS.filter((v) => !hasEnvKey(content, v.key));
  if (missing.length === 0) return;

  const lines = [
    "",
    "# ── Google Calendar integration (optional) ───────────────────────────────────",
    "# Register OAuth credentials at: https://console.cloud.google.com → APIs & Services → Credentials",
    "# Leave placeholders to disable Google Calendar sync.",
  ];
  for (const { key, placeholder, comment } of missing) {
    if (comment) lines.push(comment);
    lines.push(`${key}=${placeholder}`);
  }
  lines.push("");

  await fs.appendFile(filePath, lines.join("\n"), "utf8");

  console.warn("");
  console.warn("[setup-external] New optional variables appended to .env.external:");
  for (const { key } of missing) console.warn(`  ${key}`);
  console.warn("  Fill them in before starting containers if you want Google Calendar sync.");
}

async function downloadTextFile(url) {
  const response = await fetch(url, {
    headers: { "User-Agent": "atlaserp-installer" },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} fetching ${url}`);
  return response.text();
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
  const ok = [];
  const failed = [];

  for (const rel of devKitFiles) {
    const url = `${docsRawBase}/${rel}`;
    const dest = path.resolve(devKitDir, rel);
    try {
      const content = await downloadTextFile(url);
      await fs.mkdir(path.dirname(dest), { recursive: true });
      await fs.writeFile(dest, content, "utf8");
      ok.push(rel);
    } catch (err) {
      failed.push({ rel, err });
    }
  }

  if (failed.length > 0) {
    console.warn(`[setup-external] Dev Kit: ${ok.length} ok, ${failed.length} failed.`);
    for (const { rel, err } of failed) console.warn(`  - ${rel}: ${err.message}`);
  } else {
    console.log(`[3/5] Dev Kit ready at ${devKitDir} (${ok.length} files).`);
  }
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  // ── 1. Validate environment file ──────────────────────────────────────────
  if (!upOnly) {
    console.log("[1/5] Checking .env.external...");
    if (!(await exists(envFile))) {
      if (await exists(envExampleFile)) {
        await fs.copyFile(envExampleFile, envFile);
        console.error("");
        console.error("  .env.external was not found — copied from .env.external.example.");
        console.error("  Edit .env.external with your Supabase credentials and re-run:");
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
  run(
    "docker",
    ["compose", "-f", composeFile, "--profile", "external", "up", "-d"],
    {
      env: {
        ...process.env,
        ATLAS_API_IMAGE:          resolvedApiImage,
        ATLAS_WORKER_IMAGE:       resolvedWorkerImage,
        ATLAS_WEB_EXTERNAL_IMAGE: resolvedWebImage,
      },
    },
  );

  console.log("");
  console.log("Atlas ERP is ready (external mode):");
  console.log("  Web:  http://localhost:5173");
  console.log("  API:  http://localhost:4010");
  if (!upOnly) {
    console.log(`  Dev Kit: ${devKitDir}`);
  }
}

main().catch((err) => {
  console.error("");
  console.error("[setup-external] Error:", err.message);
  process.exit(1);
});
