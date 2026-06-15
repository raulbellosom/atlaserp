import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createDocumentProviderRegistry,
  DocumentProviderError,
} from "../document-provider-registry.js";
import { createGrowthLeadDocumentProvider } from "../providers/growth-lead-provider.js";

const COMPANY_ID = "11111111-1111-7111-8111-111111111111";
const OTHER_COMPANY_ID = "22222222-2222-7222-8222-222222222222";
const LEAD_ID = "33333333-3333-7333-8333-333333333333";

function createProvider() {
  return {
    sourceType: "test.record",
    permissionKey: "test.records.read",
    getSchema() {
      return {
        sourceType: "test.record",
        fields: [{ path: "record.name", label: "Nombre", type: "string" }],
        collections: [],
      };
    },
    async load(input) {
      return { record: input };
    },
  };
}

test("registers providers and resolves schema and data", async () => {
  const registry = createDocumentProviderRegistry();
  registry.register(createProvider());

  assert.equal(
    registry.getSchema({
      sourceType: "test.record",
      permissionKeys: ["test.records.read"],
    }).sourceType,
    "test.record",
  );
  assert.deepEqual(
    await registry.load({
      sourceType: "test.record",
      companyId: COMPANY_ID,
      sourceId: LEAD_ID,
      actorId: "actor-1",
      permissionKeys: ["test.records.read"],
    }),
    {
      record: {
        companyId: COMPANY_ID,
        sourceId: LEAD_ID,
        actorId: "actor-1",
      },
    },
  );
});

test("rejects duplicate, unknown, and unauthorized providers", async () => {
  const registry = createDocumentProviderRegistry();
  registry.register(createProvider());

  assert.throws(() => registry.register(createProvider()), {
    name: "DocumentProviderError",
    code: "provider_already_registered",
  });
  assert.throws(
    () =>
      registry.getSchema({
        sourceType: "missing.record",
        permissionKeys: ["test.records.read"],
      }),
    {
      name: "DocumentProviderError",
      status: 404,
      code: "provider_not_found",
    },
  );
  await assert.rejects(
    registry.load({
      sourceType: "test.record",
      companyId: COMPANY_ID,
      sourceId: LEAD_ID,
      actorId: "actor-1",
      permissionKeys: [],
    }),
    {
      name: "DocumentProviderError",
      status: 403,
      code: "source_permission_denied",
    },
  );
});

test("growth.lead provider returns safe related data for the active company", async () => {
  const calls = [];
  const prisma = {
    growthLead: {
      findFirst: async (query) => {
        calls.push(["lead", query]);
        return {
          id: LEAD_ID,
          companyId: COMPANY_ID,
          status: "qualified",
          priority: "high",
          name: "Ada Lovelace",
          email: "ada@example.com",
          phone: "+52 555 000 0000",
          companyName: "Analytical Engines",
          message: "Necesito una propuesta.",
          source: "website",
          attribution: {
            source: "newsletter",
            medium: "email",
            campaign: "lanzamiento",
          },
          contactId: "44444444-4444-7444-8444-444444444444",
          firstSubmissionAt: new Date("2026-06-01T12:00:00.000Z"),
          lastSubmissionAt: new Date("2026-06-10T12:00:00.000Z"),
          qualifiedAt: new Date("2026-06-11T12:00:00.000Z"),
          convertedAt: null,
        };
      },
    },
    contact: {
      findFirst: async (query) => {
        calls.push(["contact", query]);
        return {
          id: "44444444-4444-7444-8444-444444444444",
          name: "Ada Lovelace",
          email: "ada@example.com",
          phone: "+52 555 000 0000",
        };
      },
    },
    websiteFormSubmission: {
      findMany: async (query) => {
        calls.push(["submissions", query]);
        return [
          {
            id: "55555555-5555-7555-8555-555555555555",
            formId: "66666666-6666-7666-8666-666666666666",
            submittedAt: new Date("2026-06-10T12:00:00.000Z"),
            form: { name: "Contacto" },
          },
        ];
      },
    },
  };
  const registry = createDocumentProviderRegistry();
  const provider = createGrowthLeadDocumentProvider({ prisma });
  registry.register(provider);

  const result = await registry.load({
    sourceType: "growth.lead",
    companyId: COMPANY_ID,
    sourceId: LEAD_ID,
    actorId: "actor-1",
    permissionKeys: ["growth.leads.read"],
  });

  assert.equal(result.lead.name, "Ada Lovelace");
  assert.deepEqual(result.attribution, {
    source: "newsletter",
    medium: "email",
    campaign: "lanzamiento",
  });
  assert.deepEqual(
    provider
      .getSchema()
      .fields.filter((field) => field.path.startsWith("attribution."))
      .map((field) => field.path),
    ["attribution.source", "attribution.medium", "attribution.campaign"],
  );
  assert.equal(result.contact.name, "Ada Lovelace");
  assert.equal(result.summary.submissionCount, 1);
  assert.deepEqual(result.submissions, [
    {
      id: "55555555-5555-7555-8555-555555555555",
      formId: "66666666-6666-7666-8666-666666666666",
      formName: "Contacto",
      submittedAt: new Date("2026-06-10T12:00:00.000Z"),
    },
  ]);
  assert.equal(calls[0][1].where.companyId, COMPANY_ID);
  assert.equal(calls[1][1].where.companyId, COMPANY_ID);
  assert.equal(calls[2][1].where.companyId, COMPANY_ID);
  assert.equal("data" in calls[2][1].select, false);
});

test("growth.lead provider rejects a source from another company", async () => {
  const provider = createGrowthLeadDocumentProvider({
    prisma: {
      growthLead: { findFirst: async () => null },
      contact: { findFirst: async () => null },
      websiteFormSubmission: { findMany: async () => [] },
    },
  });

  await assert.rejects(
    provider.load({
      companyId: OTHER_COMPANY_ID,
      sourceId: LEAD_ID,
      actorId: "actor-1",
    }),
    (error) =>
      error instanceof DocumentProviderError &&
      error.status === 404 &&
      error.code === "source_not_found",
  );
});
