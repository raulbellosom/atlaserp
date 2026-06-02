#!/usr/bin/env node
// stop-external.mjs
//
// Stop (or reset) the Atlas external profile.
//
// Usage:
//   node stop-external.mjs           # stop containers, keep .env.external
//   node stop-external.mjs --reset   # stop + remove .env.external and .env

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const isWindows  = process.platform === "win32";
const isReset    = process.argv.includes("--reset");
const composeFile = path.resolve(__dirname, "docker-compose.yml");

function run(command, args, { cwd = __dirname, failOk = false } = {}) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
    shell: isWindows,
  });
  if (!failOk && result.error) throw new Error(`${command}: ${result.error.message}`);
  return result.status === 0;
}

function removeIfExists(filePath) {
  try {
    fs.rmSync(filePath, { recursive: true, force: true });
    console.log(`  Removed ${path.relative(__dirname, filePath)}`);
  } catch {
    // ignore
  }
}

console.log(
  isReset
    ? "[stop-external] Stopping and resetting Atlas external..."
    : "[stop-external] Stopping Atlas external..."
);

if (fs.existsSync(composeFile)) {
  console.log("\n[1] Stopping Atlas external containers...");
  run(
    "docker",
    ["compose", "-f", composeFile, "--profile", "external", "down", "--remove-orphans"],
    { failOk: true },
  );
} else {
  console.log("[1] docker-compose.yml not found — skipping compose down.");
}

if (isReset) {
  console.log("\n[2] Removing generated files...");
  removeIfExists(path.resolve(__dirname, ".env.external"));
  removeIfExists(path.resolve(__dirname, ".env"));
  console.log("\nReset complete. Run `node setup-external.mjs` to start fresh.");
} else {
  console.log(
    "\nStopped. Run `node setup-external.mjs --skip-pull --skip-migrate` to restart."
  );
}
