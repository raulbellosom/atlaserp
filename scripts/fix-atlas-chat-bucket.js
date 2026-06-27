#!/usr/bin/env node
// One-time script: update atlas-chat Supabase bucket to allow audio/video MIME types
// Run: node scripts/fix-atlas-chat-bucket.js
import { readFileSync } from "fs";
import { createClient } from "../node_modules/.pnpm/node_modules/@supabase/supabase-js/dist/index.mjs";

const envRaw = readFileSync(new URL("../.env", import.meta.url), "utf-8");
const env = {};
for (const line of envRaw.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const idx = trimmed.indexOf("=");
  if (idx === -1) continue;
  env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
}

const supabaseUrl = env.SUPABASE_URL ?? "https://supabase.racoondevs.com";
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceKey) {
  console.error("SUPABASE_SERVICE_ROLE_KEY not found in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

const { data, error } = await supabase.storage.updateBucket("atlas-chat", {
  allowedMimeTypes: [
    "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml",
    "audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg", "audio/wav", "audio/aac",
    "video/mp4", "video/webm", "video/ogg", "video/quicktime",
    "application/pdf",
    "text/plain",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
    "application/zip",
    "application/x-zip-compressed",
  ],
});

if (error) {
  console.error("Error updating bucket:", error.message);
  process.exit(1);
}

console.log("atlas-chat bucket MIME types updated successfully.");
