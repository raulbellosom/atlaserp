import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import { PERMISSION_CATALOG } from "../../../permission-catalog.js";
import { coreModules } from "../core-modules.js";
import { atlasDocumentsManifest } from "../feature-modules.js";

const repoRoot = new URL("../../../../../../", import.meta.url);

async function readRepoFile(path) {
  return readFile(new URL(path, repoRoot), "utf8");
}

test("Prisma declares versioned document templates and generated assets", async () => {
  const schema = await readRepoFile("prisma/schema.prisma");
  const template =
    schema.match(/model DocumentTemplate \{([\s\S]*?)\n\}/)?.[1] ?? "";
  const version =
    schema.match(/model DocumentTemplateVersion \{([\s\S]*?)\n\}/)?.[1] ?? "";
  const generated =
    schema.match(/model GeneratedDocument \{([\s\S]*?)\n\}/)?.[1] ?? "";

  assert.match(template, /publishedVersionId\s+String\?/);
  assert.match(template, /@@unique\(\[companyId, key\]\)/);
  assert.match(version, /blocks\s+Json/);
  assert.match(version, /@@unique\(\[templateId, versionNumber\]\)/);
  assert.match(generated, /fileAssetId\s+String\?/);
  assert.match(generated, /fileAsset\s+FileAsset\?/);
  assert.match(generated, /@@index\(\[companyId, generatedAt\]\)/);
});

test("forward migration creates document tables, constraints, and indexes", async () => {
  const migration = await readRepoFile(
    "prisma/migrations/20260614220000_add_atlas_documents/migration.sql",
  );

  for (const table of [
    "document_template",
    "document_template_version",
    "generated_document",
  ]) {
    assert.match(migration, new RegExp(`CREATE TABLE "${table}"`));
  }
  assert.match(
    migration,
    /CREATE UNIQUE INDEX "document_template_company_id_key_key"/,
  );
  assert.match(
    migration,
    /CREATE UNIQUE INDEX "document_template_version_template_id_version_number_key"/,
  );
  assert.match(migration, /generated_document_file_asset_id_fkey/);
  assert.match(migration, /CHECK \("status" IN \('draft', 'published'\)\)/);
  assert.match(migration, /CHECK \("status" IN \('pending', 'ready', 'failed'\)\)/);
});

test("atlas.documents is an official core module with granular permissions", () => {
  assert.equal(atlasDocumentsManifest.key, "atlas.documents");
  assert.equal(atlasDocumentsManifest.core, true);
  assert.equal(atlasDocumentsManifest.icon, "Files");
  assert.equal(atlasDocumentsManifest.color, "#0F766E");
  assert.deepEqual(atlasDocumentsManifest.pwa, {
    shortName: "Documentos",
    startPath: "/templates",
  });
  assert.deepEqual(
    atlasDocumentsManifest.dependencies.map((item) => item.key),
    ["atlas.core", "atlas.files", "atlas.company"],
  );
  assert.ok(
    coreModules.some((manifest) => manifest.key === "atlas.documents"),
  );

  const permissionKeys = atlasDocumentsManifest.permissions.map(
    (permission) => permission.key,
  );
  for (const permissionKey of [
    "documents.access",
    "documents.templates.read",
    "documents.templates.create",
    "documents.templates.update",
    "documents.templates.delete",
    "documents.templates.publish",
    "documents.generated.read",
    "documents.generated.create",
    "documents.generated.delete",
  ]) {
    assert.ok(permissionKeys.includes(permissionKey), permissionKey);
    assert.ok(PERMISSION_CATALOG[permissionKey], permissionKey);
  }
});
