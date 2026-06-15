import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createDocumentGenerationService,
  DocumentGenerationServiceError,
} from "../document-generation-service.js";

const COMPANY_ID = "11111111-1111-7111-8111-111111111111";
const TEMPLATE_ID = "22222222-2222-7222-8222-222222222222";
const VERSION_ID = "33333333-3333-7333-8333-333333333333";
const SOURCE_ID = "44444444-4444-7444-8444-444444444444";
const GENERATED_ID = "55555555-5555-7555-8555-555555555555";
const FILE_ID = "66666666-6666-7666-8666-666666666666";
const ACTOR_ID = "77777777-7777-7777-8777-777777777777";
const NOW = new Date("2026-06-14T12:00:00.000Z");

const template = {
  id: TEMPLATE_ID,
  companyId: COMPANY_ID,
  key: "lead-summary",
  name: "Resumen del lead",
  sourceType: "growth.lead",
  publishedVersionId: VERSION_ID,
  enabled: true,
};
const version = {
  id: VERSION_ID,
  templateId: TEMPLATE_ID,
  versionNumber: 3,
  status: "published",
  blocks: [{ id: "p", type: "paragraph", text: "{{lead.name}}" }],
};

function createHarness({
  uploadError = null,
  transactionError = null,
  providerError = null,
} = {}) {
  const calls = [];
  const prisma = {
    documentTemplate: {
      findFirst: async () => template,
    },
    documentTemplateVersion: {
      findFirst: async () => version,
    },
    generatedDocument: {
      create: async ({ data }) => {
        calls.push(["generated.create", data]);
        return { id: GENERATED_ID, ...data, enabled: true };
      },
      update: async ({ where, data }) => {
        calls.push(["generated.update", { where, data }]);
        return { id: GENERATED_ID, ...data };
      },
      findMany: async () => [],
      count: async () => 0,
      findFirst: async () => null,
    },
    fileAsset: {
      create: async ({ data }) => {
        calls.push(["file.create", data]);
        return { id: FILE_ID, ...data };
      },
    },
    auditLog: {
      create: async ({ data }) => {
        calls.push(["audit", data]);
        return data;
      },
    },
    $transaction: async (callback) => {
      if (transactionError) throw transactionError;
      return callback(prisma);
    },
  };
  const bucket = {
    upload: async (objectKey, buffer, options) => {
      calls.push(["storage.upload", { objectKey, buffer, options }]);
      return { error: uploadError };
    },
    remove: async (keys) => {
      calls.push(["storage.remove", keys]);
      return { error: null };
    },
    createSignedUrl: async (objectKey, expiresIn) => ({
      data: { signedUrl: `https://files.invalid/${objectKey}?ttl=${expiresIn}` },
      error: null,
    }),
  };
  const supabaseAdmin = {
    storage: {
      from: (name) => {
        calls.push(["storage.bucket", name]);
        return bucket;
      },
    },
  };
  const providerRegistry = {
    load: async (input) => {
      calls.push(["provider.load", input]);
      if (providerError) throw providerError;
      return { lead: { name: "Ada Lovelace" } };
    },
  };
  const renderPdf = async (input) => {
    calls.push(["render", input]);
    return { buffer: Buffer.from("%PDF-test"), pageCount: 1, warnings: [] };
  };
  const resolveBranding = async () => ({
    companyName: "Atlas",
    primaryColor: "#0F766E",
    addressLines: [],
  });
  const service = createDocumentGenerationService({
    prisma,
    supabaseAdmin,
    providerRegistry,
    renderPdf,
    resolveBranding,
    now: () => NOW,
  });
  return { service, prisma, calls };
}

test("preview renders without creating generated metadata or files", async () => {
  const { service, calls } = createHarness();

  const preview = await service.preview({
    companyId: COMPANY_ID,
    templateId: TEMPLATE_ID,
    actorId: ACTOR_ID,
    permissions: ["growth.leads.read"],
    input: { sourceId: SOURCE_ID, versionId: VERSION_ID },
  });

  assert.equal(preview.buffer.toString(), "%PDF-test");
  assert.ok(calls.some(([name]) => name === "provider.load"));
  assert.ok(calls.some(([name]) => name === "render"));
  assert.equal(calls.some(([name]) => name === "generated.create"), false);
  assert.equal(calls.some(([name]) => name === "file.create"), false);
});

test("generates a pending database ID before building the storage key", async () => {
  const { service, calls } = createHarness();

  const result = await service.generate({
    companyId: COMPANY_ID,
    templateId: TEMPLATE_ID,
    actorId: ACTOR_ID,
    permissions: ["growth.leads.read"],
    input: { sourceId: SOURCE_ID },
  });

  const createIndex = calls.findIndex(([name]) => name === "generated.create");
  const uploadIndex = calls.findIndex(([name]) => name === "storage.upload");
  assert.ok(createIndex >= 0 && createIndex < uploadIndex);
  const upload = calls[uploadIndex][1];
  assert.match(
    upload.objectKey,
    new RegExp(
      `^modules/atlas\\.documents/GeneratedDocument/${GENERATED_ID}/`,
    ),
  );
  const file = calls.find(([name]) => name === "file.create")[1];
  assert.equal(file.entityId, COMPANY_ID);
  assert.equal(file.entityType, "GeneratedDocument");
  assert.equal(file.metadata.sourceEntityId, SOURCE_ID);
  assert.equal(result.status, "ready");
  assert.equal(result.fileAssetId, FILE_ID);
});

test("does not create pending metadata when the source provider fails", async () => {
  const providerError = new Error("source missing");
  const { service, calls } = createHarness({ providerError });

  await assert.rejects(
    service.generate({
      companyId: COMPANY_ID,
      templateId: TEMPLATE_ID,
      actorId: ACTOR_ID,
      permissions: ["growth.leads.read"],
      input: { sourceId: SOURCE_ID },
    }),
    providerError,
  );
  assert.equal(calls.some(([name]) => name === "generated.create"), false);
});

test("marks pending metadata failed when storage upload fails", async () => {
  const { service, calls } = createHarness({
    uploadError: new Error("storage unavailable"),
  });

  await assert.rejects(
    service.generate({
      companyId: COMPANY_ID,
      templateId: TEMPLATE_ID,
      actorId: ACTOR_ID,
      permissions: ["growth.leads.read"],
      input: { sourceId: SOURCE_ID },
    }),
    {
      name: "DocumentGenerationServiceError",
      code: "document_upload_failed",
    },
  );
  const failed = calls
    .filter(([name]) => name === "generated.update")
    .at(-1)[1].data;
  assert.equal(failed.status, "failed");
  assert.equal(failed.enabled, false);
});

test("removes the uploaded object when metadata transaction fails", async () => {
  const transactionError = new Error("database failed");
  const { service, calls } = createHarness({ transactionError });

  await assert.rejects(
    service.generate({
      companyId: COMPANY_ID,
      templateId: TEMPLATE_ID,
      actorId: ACTOR_ID,
      permissions: ["growth.leads.read"],
      input: { sourceId: SOURCE_ID },
    }),
    transactionError,
  );
  assert.ok(calls.some(([name]) => name === "storage.remove"));
});

test("rejects generated documents outside the active company", async () => {
  const { service, prisma } = createHarness();
  prisma.generatedDocument.findFirst = async () => null;

  await assert.rejects(
    service.getGenerated({
      companyId: COMPANY_ID,
      id: GENERATED_ID,
    }),
    (error) =>
      error instanceof DocumentGenerationServiceError &&
      error.status === 404 &&
      error.code === "generated_document_not_found",
  );
});

test("disables generated documents and records the audit entry", async () => {
  const { service, prisma, calls } = createHarness();
  prisma.generatedDocument.findFirst = async () => ({
    id: GENERATED_ID,
    companyId: COMPANY_ID,
    enabled: true,
  });

  const result = await service.setGeneratedEnabled({
    companyId: COMPANY_ID,
    id: GENERATED_ID,
    actorId: ACTOR_ID,
    input: { enabled: false },
  });

  assert.equal(result.enabled, false);
  assert.equal(calls.find(([name]) => name === "audit")[1].action, "documents.generated.disable");
});
