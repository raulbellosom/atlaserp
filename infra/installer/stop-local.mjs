#!/usr/bin/env node
// stop-local.mjs
//
// Usage:
//   node stop-local.mjs           # stop containers, keep Supabase data
//   node stop-local.mjs --reset   # stop + wipe all Supabase volumes (full clean)

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isWindows = process.platform === "win32";
const isReset = process.argv.includes("--reset");
const composeFile = path.resolve(__dirname, "docker-compose.yml");
const linuxComposeOverride = path.resolve(__dirname, "docker-compose.linux.yml");
const supabaseWorkdir = path.resolve(__dirname, ".supabase-local");
const composeFiles = process.platform === "linux" && fs.existsSync(linuxComposeOverride)
  ? ["-f", composeFile, "-f", linuxComposeOverride]
  : ["-f", composeFile];

function run(command, args, { cwd = __dirname, failOk = false } = {}) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
    shell: isWindows,
  });
  if (!failOk && result.error) throw new Error(`${command}: ${result.error.message}`);
  return result.status === 0;
}

function capture(command, args, { cwd = __dirname } = {}) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: "pipe",
    encoding: "utf8",
    shell: isWindows,
  });
  if (result.error) return "";
  return (result.stdout ?? "").trim();
}

function removeIfExists(filePath) {
  try {
    fs.rmSync(filePath, { recursive: true, force: true });
    console.log(`  Removed ${path.relative(__dirname, filePath)}`);
  } catch {
    // ignore
  }
}

console.log(isReset ? "[stop-local] Stopping and resetting Atlas local..." : "[stop-local] Stopping Atlas local...");

// 1. Stop Atlas containers
if (fs.existsSync(composeFile)) {
  console.log("\n[1] Stopping Atlas containers...");
  run("docker", ["compose", ...composeFiles, "--profile", "local", "down", "--remove-orphans"], { failOk: true });
} else {
  console.log("[1] docker-compose.yml not found, skipping compose down.");
}

// 2. Stop Supabase local stack
console.log("\n[2] Stopping Supabase local stack...");
if (fs.existsSync(supabaseWorkdir)) {
  const noBackup = isReset ? ["--no-backup"] : [];
  run("npx", ["--yes", "supabase", "stop", "--workdir", supabaseWorkdir, ...noBackup], { failOk: true });
} else {
  console.log("  .supabase-local not found — stopping by label instead...");
  // Fall back to label-based cleanup
  const containers = capture("docker", ["ps", "-a", "--filter", "label=com.supabase.cli.project=supabase-local", "-q"]);
  if (containers) {
    containers.split(/\s+/).filter(Boolean).forEach((id) => run("docker", ["stop", id], { failOk: true }));
  }
}

if (isReset) {
  // 3. Force-remove any remaining Supabase containers by label
  console.log("\n[3] Removing Supabase containers...");
  const containers = capture("docker", ["ps", "-a", "--filter", "label=com.supabase.cli.project=supabase-local", "-q"]);
  if (containers) {
    containers.split(/\s+/).filter(Boolean).forEach((id) => {
      run("docker", ["rm", "-f", id], { failOk: true });
    });
  } else {
    console.log("  No leftover containers.");
  }

  // 4. Remove networks
  console.log("\n[4] Removing Supabase networks...");
  const networks = capture("docker", ["network", "ls", "--filter", "label=com.supabase.cli.project=supabase-local", "-q"]);
  if (networks) {
    networks.split(/\s+/).filter(Boolean).forEach((id) => {
      run("docker", ["network", "rm", id], { failOk: true });
    });
  } else {
    console.log("  No leftover networks.");
  }

  // 5. Remove volumes
  console.log("\n[5] Removing Supabase volumes...");
  const volumes = capture("docker", ["volume", "ls", "--filter", "label=com.supabase.cli.project=supabase-local", "-q"]);
  if (volumes) {
    volumes.split(/\s+/).filter(Boolean).forEach((id) => {
      run("docker", ["volume", "rm", id], { failOk: true });
    });
  } else {
    console.log("  No leftover volumes.");
  }

  // 6. Remove generated files
  console.log("\n[6] Removing generated files...");
  removeIfExists(supabaseWorkdir);
  removeIfExists(path.resolve(__dirname, ".env.local"));
  removeIfExists(path.resolve(__dirname, ".env"));

  console.log("\nReset complete. Run `node setup-local.mjs` to start fresh.");
} else {
  console.log("\nStopped. Run `node setup-local.mjs` or `docker compose --profile local up -d` to restart.");
}
