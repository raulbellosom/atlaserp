#!/usr/bin/env node
// infra/docker/build-push.mjs
//
// Usage (from repo root):
//   node infra/docker/build-push.mjs              # build + push all 3 images
//   node infra/docker/build-push.mjs --build      # build only (all)
//   node infra/docker/build-push.mjs --push       # push only (all, images must exist)
//   node infra/docker/build-push.mjs --web        # build + push web image only
//   node infra/docker/build-push.mjs --api        # build + push api image only
//   node infra/docker/build-push.mjs --worker     # build + push worker image only
//   node infra/docker/build-push.mjs --web --build   # build web only, no push
//   node infra/docker/build-push.mjs --web --push    # push web only (image must exist)
//
// Via pnpm:
//   pnpm docker:build          # build all
//   pnpm docker:push           # push all
//   pnpm docker:release        # build + push all
//   pnpm docker:release:web    # build + push web only
//   pnpm docker:release:api    # build + push api only
//   pnpm docker:release:worker # build + push worker only

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const isWindows = process.platform === "win32";

const argv = new Set(process.argv.slice(2));
const buildOnly = argv.has("--build");
const pushOnly  = argv.has("--push");
const doBuild   = !pushOnly;
const doPush    = !buildOnly;

const REGISTRY = "raulbellosom/atlaserp";

const ALL_IMAGES = [
  {
    key:        "api",
    tag:        `${REGISTRY}:api-latest`,
    dockerfile: "infra/docker/api.Dockerfile",
    label:      "API",
  },
  {
    key:        "worker",
    tag:        `${REGISTRY}:worker-latest`,
    dockerfile: "infra/docker/worker.Dockerfile",
    label:      "Worker",
  },
  {
    key:        "web",
    tag:        `${REGISTRY}:web-latest`,
    dockerfile: "infra/docker/web.Dockerfile",
    label:      "Web",
  },
];

// Filter by --web / --api / --worker flags; default to all.
const explicitKeys = ALL_IMAGES.map((i) => i.key).filter((k) => argv.has(`--${k}`));
const images = explicitKeys.length > 0
  ? ALL_IMAGES.filter((i) => explicitKeys.includes(i.key))
  : ALL_IMAGES;

function run(command, args) {
  console.log(`\n$ ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: "inherit",
    shell: isWindows,
  });
  if (result.error) throw new Error(`${command}: ${result.error.message}`);
  if (result.status !== 0) process.exit(result.status);
}

if (doBuild) {
  console.log(`=== Building image(s): ${images.map((i) => i.label).join(", ")} ===`);
  for (const { tag, dockerfile, label } of images) {
    console.log(`\n--- Building ${label} (${tag}) ---`);
    run("docker", ["build", "-f", dockerfile, "-t", tag, "."]);
  }
  console.log("\nBuild done.");
}

if (doPush) {
  console.log(`\n=== Pushing image(s): ${images.map((i) => i.label).join(", ")} ===`);
  for (const { tag, label } of images) {
    console.log(`\n--- Pushing ${label} (${tag}) ---`);
    run("docker", ["push", tag]);
  }
  console.log("\nPush done.");
}
