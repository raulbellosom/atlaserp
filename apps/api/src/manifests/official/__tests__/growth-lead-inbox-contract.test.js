import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const schemaUrl = new URL(
  "../../../../../../prisma/schema.prisma",
  import.meta.url,
);
const migrationUrl = new URL(
  "../../../../../../prisma/migrations/20260614210000_add_growth_lead_inbox_fields/migration.sql",
  import.meta.url,
);

test("GrowthLead includes inbox-only operational fields", async () => {
  const schema = await readFile(schemaUrl, "utf8");
  const model = schema.match(/model GrowthLead \{([\s\S]*?)\n\}/)?.[1] ?? "";

  assert.match(model, /discardReason\s+String\?/);
  assert.match(model, /notesSummary\s+String\?/);
});

test("forward migration adds the missing lead inbox columns", async () => {
  const migration = await readFile(migrationUrl, "utf8");

  assert.match(migration, /ALTER TABLE "growth_lead"/);
  assert.match(migration, /ADD COLUMN "discard_reason" TEXT/);
  assert.match(migration, /ADD COLUMN "notes_summary" TEXT/);
});
