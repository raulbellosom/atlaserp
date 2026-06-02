#!/usr/bin/env node
// infra/docker/build-push.mjs
//
// Usage (from repo root):
//   node infra/docker/build-push.mjs           # build + push all 3 images
//   node infra/docker/build-push.mjs --build   # build only
//   node infra/docker/build-push.mjs --push    # push only (images must already exist)
//
// Or via pnpm:
//   pnpm docker:build
//   pnpm docker:push
//   pnpm docker:release

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const isWindows = process.platform === "win32";

const argv = new Set(process.argv.slice(2));
const buildOnly = argv.has("--build");
const pushOnly = argv.has("--push");
const doBuild = !pushOnly;
const doPush = !buildOnly;

const REGISTRY = "raulbellosom/atlaserp";

const images = [
  {
    tag: `${REGISTRY}:api-latest`,
    dockerfile: "infra/docker/api.Dockerfile",
    label: "API",
  },
  {
    tag: `${REGISTRY}:worker-latest`,
    dockerfile: "infra/docker/worker.Dockerfile",
    label: "Worker",
  },
  {
    tag: `${REGISTRY}:web-latest`,
    dockerfile: "infra/docker/web.Dockerfile",
    label: "Web",
  },
];

function run(command, args) {
  console.log(`\n$ ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: "inherit",
    shell: isWindows,
  });
  if (result.error) throw new Error(`${command}: ${result.error.message}`);
  if (result.status !== 0) {
    process.exit(result.status);
  }
}

if (doBuild) {
  console.log("=== Building images ===");
  for (const { tag, dockerfile, label } of images) {
    console.log(`\n--- Building ${label} (${tag}) ---`);
    run("docker", ["build", "-f", dockerfile, "-t", tag, "."]);
  }
  console.log("\nAll images built.");
}

if (doPush) {
  console.log("\n=== Pushing images ===");
  for (const { tag, label } of images) {
    console.log(`\n--- Pushing ${label} (${tag}) ---`);
    run("docker", ["push", tag]);
  }
  console.log("\nAll images pushed.");
}
