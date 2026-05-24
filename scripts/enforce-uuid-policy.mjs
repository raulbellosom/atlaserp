import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const TARGETS = [
  "apps",
  "packages",
  "modules",
  "prisma/schema.prisma",
  "prisma/seed.js",
];

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "target",
  ".next",
  ".turbo",
  ".cache",
  "coverage",
  "docs",
]);

const SKIP_PATHS = [
  `${path.sep}prisma${path.sep}migrations${path.sep}`,
  `${path.sep}.tmp${path.sep}`,
];

const CHECK_EXT = new Set([".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".prisma"]);
const PATTERNS = [
  /cuid\(/,
  /\.cuid\(/,
];

function shouldSkipFile(absPath) {
  const normalized = absPath.toLowerCase();
  return SKIP_PATHS.some((segment) => normalized.includes(segment.toLowerCase()));
}

function collectFiles(entryPath, files = []) {
  const stat = fs.statSync(entryPath);
  if (stat.isFile()) {
    if (!shouldSkipFile(entryPath) && CHECK_EXT.has(path.extname(entryPath))) {
      files.push(entryPath);
    }
    return files;
  }

  const name = path.basename(entryPath);
  if (SKIP_DIRS.has(name)) return files;

  for (const child of fs.readdirSync(entryPath)) {
    collectFiles(path.join(entryPath, child), files);
  }
  return files;
}

function findViolations(absPath) {
  const text = fs.readFileSync(absPath, "utf8");
  const lines = text.split(/\r?\n/);
  const violations = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (PATTERNS.some((pattern) => pattern.test(line))) {
      violations.push({
        line: i + 1,
        content: line.trim(),
      });
    }
  }

  return violations;
}

const allFiles = [];
for (const target of TARGETS) {
  const absTarget = path.resolve(ROOT, target);
  if (!fs.existsSync(absTarget)) continue;
  collectFiles(absTarget, allFiles);
}

const findings = [];
for (const file of allFiles) {
  const violations = findViolations(file);
  if (violations.length > 0) {
    findings.push({
      file: path.relative(ROOT, file),
      violations,
    });
  }
}

if (findings.length > 0) {
  console.error("UUID policy violation: found legacy CUID usage.");
  for (const finding of findings) {
    for (const hit of finding.violations) {
      console.error(`- ${finding.file}:${hit.line} -> ${hit.content}`);
    }
  }
  process.exit(1);
}

console.log("UUID policy check passed.");
