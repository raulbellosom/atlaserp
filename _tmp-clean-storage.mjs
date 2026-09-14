import { readFileSync } from "node:fs";

const ENV_FILE = process.argv[2] || ".env.local"; // pass .env.external as arg if that's your profile

function loadEnv(path) {
  const out = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

const env = loadEnv(ENV_FILE);
const URL_BASE = (env.SUPABASE_URL || "").replace(/\/$/, "");
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_BASE || !KEY) {
  console.error(`Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in ${ENV_FILE}`);
  process.exit(1);
}
const HEADERS = { Authorization: `Bearer ${KEY}`, apikey: KEY, "Content-Type": "application/json" };
const BUCKETS = ["module-bundles", "atlas-website", "atlas-notes", "atlas-chat", "atlas-files"];
const DRY_RUN = process.argv.includes("--dry-run");

async function listAll(bucket, prefix = "") {
  const files = [];
  let offset = 0;
  const limit = 1000;
  for (;;) {
    const res = await fetch(`${URL_BASE}/storage/v1/object/list/${bucket}`, {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify({ prefix, limit, offset, sortBy: { column: "name", order: "asc" } }),
    });
    if (!res.ok) {
      console.log(`  list failed for ${bucket}/${prefix}: ${res.status} ${await res.text()}`);
      return files;
    }
    const items = await res.json();
    if (!items.length) break;
    for (const item of items) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id === null) {
        const nested = await listAll(bucket, path);
        files.push(...nested);
      } else {
        files.push(path);
      }
    }
    if (items.length < limit) break;
    offset += limit;
  }
  return files;
}

async function removeBatch(bucket, paths) {
  if (!paths.length) return;
  const res = await fetch(`${URL_BASE}/storage/v1/object/${bucket}`, {
    method: "DELETE",
    headers: HEADERS,
    body: JSON.stringify({ prefixes: paths }),
  });
  if (!res.ok) {
    console.log(`  delete batch failed for ${bucket}: ${res.status} ${await res.text()}`);
  }
}

for (const bucket of BUCKETS) {
  const files = await listAll(bucket);
  console.log(`${bucket}: ${files.length} object(s)`);
  if (!DRY_RUN && files.length) {
    for (let i = 0; i < files.length; i += 100) {
      await removeBatch(bucket, files.slice(i, i + 100));
    }
    const remaining = await listAll(bucket);
    console.log(`  -> after delete: ${remaining.length} object(s) remaining`);
  }
}
