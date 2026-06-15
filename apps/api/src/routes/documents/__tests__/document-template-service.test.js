import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  createDocumentTemplateService,
  DocumentTemplateServiceError,
} from "../document-template-service.js";

const COMPANY_ID = "11111111-1111-7111-8111-111111111111";
const TEMPLATE_ID = "22222222-2222-7222-8222-222222222222";
const VERSION_ID = "33333333-3333-7333-8333-333333333333";
const ACTOR_ID = "44444444-4444-7444-8444-444444444444";
const UPDATED_AT = new Date("2026-06-14T12:00:00.000Z");
const NOW = new Date("2026-06-14T13:00:00.000Z");

const validBlocks = [
  {
    id: "title",
    type: "heading",
    text: "Lead {{lead.name}}",
    level: 1,
  },
];

function createPrisma(overrides = {}) {
  const calls = [];
  const prisma = {
    documentTemplate: {
      count: async () => 0,
      findMany: async () => [],
      findFirst: async () => null,
      create: async ({ data }) => ({
        id: TEMPLATE_ID,
        ...data,
        publishedVersionId: null,
        enabled: true,
        createdAt: NOW,
        updatedAt: NOW,
      }),
      updateMany: async () => ({ count: 1 }),
      update: async ({ data }) => ({ id: TEMPLATE_ID, ...data }),
    },
    documentTemplateVersion: {
      findMany: async () => [],
      findFirst: async () => null,
      create: async ({ data }) => ({
        id: VERSION_ID,
        ...data,
        status: "draft",
        createdAt: NOW,
        updatedAt: NOW,
      }),
      updateMany: async () => ({ count: 1 }),
      update: async ({ data }) => ({ id: VERSION_ID, ...data }),
    },
    auditLog: {
      create: async ({ data }) => {
        calls.push(["audit", data]);
        return data;
      },
    },
    $transaction: async (callback) => callback(prisma),
  };

  for (const [model, methods] of Object.entries(overrides)) {
    prisma[model] = { ...prisma[model], ...methods };
  }
  return { prisma, calls };
}

function createRegistry() {
  return {
    getSchema() {
      return {
        sourceType: "growth.lead",
        fields: [{ path: "lead.name", label: "Nombre", type: "string" }],
        collections: [],
      };
    },
  };
}

describe("createDocumentTemplateService", () => {
  test("scopes template listing and creation to the active company", async () => {
    const calls = [];
    const { prisma } = createPrisma({
      documentTemplate: {
        count: async ({ where }) => (calls.push(["count", where]), 1),
        findMany: async (query) => (calls.push(["list", query]), [{ id: TEMPLATE_ID }]),
        create: async ({ data }) => (calls.push(["create", data]), {
          id: TEMPLATE_ID,
          ...data,
          enabled: true,
          publishedVersionId: null,
          createdAt: NOW,
          updatedAt: NOW,
        }),
      },
    });
    const service = createDocumentTemplateService({
      prisma,
      providerRegistry: createRegistry(),
      now: () => NOW,
    });

    const listed = await service.listTemplates({
      companyId: COMPANY_ID,
      query: { sourceType: "growth.lead", enabled: true, page: 1, pageSize: 25 },
    });
    const created = await service.createTemplate({
      companyId: COMPANY_ID,
      actorId: ACTOR_ID,
      permissions: ["growth.leads.read"],
      input: {
        key: "lead-summary",
        name: "Resumen del lead",
        sourceType: "growth.lead",
      },
    });

    assert.equal(listed.total, 1);
    assert.equal(calls[0][1].companyId, COMPANY_ID);
    assert.equal(calls[1][1].where.companyId, COMPANY_ID);
    assert.equal(calls[2][1].companyId, COMPANY_ID);
    assert.equal(created.key, "lead-summary");
  });

  test("updates a template optimistically and records an audit entry", async () => {
    const modelCalls = [];
    const template = {
      id: TEMPLATE_ID,
      companyId: COMPANY_ID,
      key: "lead-summary",
      name: "Anterior",
      sourceType: "growth.lead",
      publishedVersionId: null,
      enabled: true,
      updatedAt: UPDATED_AT,
    };
    const { prisma, calls: auditCalls } = createPrisma({
      documentTemplate: {
        findFirst: async () => template,
        updateMany: async (query) => (
          modelCalls.push(["update", query]), { count: 1 }
        ),
      },
    });
    const service = createDocumentTemplateService({
      prisma,
      providerRegistry: createRegistry(),
      now: () => NOW,
    });

    const updated = await service.updateTemplate({
      companyId: COMPANY_ID,
      id: TEMPLATE_ID,
      actorId: ACTOR_ID,
      permissions: ["growth.leads.read"],
      input: {
        name: "Actualizado",
        updatedAt: UPDATED_AT.toISOString(),
      },
    });

    assert.equal(modelCalls[0][1].where.companyId, COMPANY_ID);
    assert.equal(
      modelCalls[0][1].where.updatedAt.getTime(),
      UPDATED_AT.getTime(),
    );
    assert.equal(updated.name, "Actualizado");
    assert.equal(
      auditCalls[0][1].after.updatedAt,
      NOW.toISOString(),
    );
  });

  test("rejects stale template updates", async () => {
    const { prisma } = createPrisma({
      documentTemplate: {
        findFirst: async () => ({
          id: TEMPLATE_ID,
          companyId: COMPANY_ID,
          sourceType: "growth.lead",
          updatedAt: UPDATED_AT,
        }),
        updateMany: async () => ({ count: 0 }),
      },
    });
    const service = createDocumentTemplateService({
      prisma,
      providerRegistry: createRegistry(),
    });

    await assert.rejects(
      service.updateTemplate({
        companyId: COMPANY_ID,
        id: TEMPLATE_ID,
        actorId: ACTOR_ID,
        permissions: ["growth.leads.read"],
        input: {
          name: "Actualizado",
          updatedAt: UPDATED_AT.toISOString(),
        },
      }),
      {
        name: "DocumentTemplateServiceError",
        status: 409,
        code: "template_update_conflict",
      },
    );
  });

  test("does not change the source type after a version is published", async () => {
    const { prisma } = createPrisma({
      documentTemplate: {
        findFirst: async () => ({
          id: TEMPLATE_ID,
          companyId: COMPANY_ID,
          sourceType: "growth.lead",
          publishedVersionId: VERSION_ID,
          updatedAt: UPDATED_AT,
        }),
      },
    });
    const service = createDocumentTemplateService({
      prisma,
      providerRegistry: createRegistry(),
    });

    await assert.rejects(
      service.updateTemplate({
        companyId: COMPANY_ID,
        id: TEMPLATE_ID,
        actorId: ACTOR_ID,
        permissions: ["growth.leads.read"],
        input: {
          sourceType: "sales.quote",
          updatedAt: UPDATED_AT.toISOString(),
        },
      }),
      {
        name: "DocumentTemplateServiceError",
        status: 409,
        code: "published_template_source_immutable",
      },
    );
  });

  test("creates the next draft version and rejects invalid block structures", async () => {
    const calls = [];
    const { prisma } = createPrisma({
      documentTemplate: {
        findFirst: async () => ({
          id: TEMPLATE_ID,
          companyId: COMPANY_ID,
          enabled: true,
        }),
      },
      documentTemplateVersion: {
        findFirst: async () => ({ versionNumber: 4 }),
        create: async ({ data }) => (calls.push(["version", data]), {
          id: VERSION_ID,
          ...data,
          status: "draft",
          updatedAt: NOW,
        }),
      },
    });
    const service = createDocumentTemplateService({
      prisma,
      providerRegistry: createRegistry(),
      now: () => NOW,
    });

    const version = await service.createVersion({
      companyId: COMPANY_ID,
      templateId: TEMPLATE_ID,
      actorId: ACTOR_ID,
      input: { blocks: validBlocks },
    });

    assert.equal(version.versionNumber, 5);
    assert.equal(calls[0][1].createdById, ACTOR_ID);
    await assert.rejects(
      service.createVersion({
        companyId: COMPANY_ID,
        templateId: TEMPLATE_ID,
        actorId: ACTOR_ID,
        input: { blocks: [{ id: "x", type: "html", html: "<b>x</b>" }] },
      }),
      {
        name: "ZodError",
      },
    );
  });

  test("reports concurrent draft numbering as a conflict", async () => {
    const { prisma } = createPrisma({
      documentTemplate: {
        findFirst: async () => ({
          id: TEMPLATE_ID,
          companyId: COMPANY_ID,
          enabled: true,
        }),
      },
      documentTemplateVersion: {
        findFirst: async () => ({ versionNumber: 4 }),
        create: async () => {
          const error = new Error("unique");
          error.code = "P2002";
          throw error;
        },
      },
    });
    const service = createDocumentTemplateService({
      prisma,
      providerRegistry: createRegistry(),
    });

    await assert.rejects(
      service.createVersion({
        companyId: COMPANY_ID,
        templateId: TEMPLATE_ID,
        actorId: ACTOR_ID,
        input: { blocks: validBlocks },
      }),
      {
        name: "DocumentTemplateServiceError",
        status: 409,
        code: "template_version_conflict",
      },
    );
  });

  test("published versions are immutable", async () => {
    const { prisma } = createPrisma({
      documentTemplateVersion: {
        findFirst: async () => ({
          id: VERSION_ID,
          templateId: TEMPLATE_ID,
          status: "published",
          updatedAt: UPDATED_AT,
          template: { companyId: COMPANY_ID },
        }),
      },
    });
    const service = createDocumentTemplateService({
      prisma,
      providerRegistry: createRegistry(),
    });

    await assert.rejects(
      service.updateVersion({
        companyId: COMPANY_ID,
        templateId: TEMPLATE_ID,
        versionId: VERSION_ID,
        actorId: ACTOR_ID,
        input: {
          updatedAt: UPDATED_AT.toISOString(),
          blocks: validBlocks,
        },
      }),
      {
        name: "DocumentTemplateServiceError",
        status: 409,
        code: "published_version_immutable",
      },
    );
  });

  test("rejects unknown bindings when publishing", async () => {
    const { prisma } = createPrisma({
      documentTemplate: {
        findFirst: async () => ({
          id: TEMPLATE_ID,
          companyId: COMPANY_ID,
          sourceType: "growth.lead",
          enabled: true,
        }),
      },
      documentTemplateVersion: {
        findFirst: async () => ({
          id: VERSION_ID,
          templateId: TEMPLATE_ID,
          status: "draft",
          blocks: [
            {
              id: "title",
              type: "heading",
              text: "{{lead.secret}}",
              level: 1,
            },
          ],
          updatedAt: UPDATED_AT,
        }),
      },
    });
    const service = createDocumentTemplateService({
      prisma,
      providerRegistry: createRegistry(),
    });

    await assert.rejects(
      service.publishVersion({
        companyId: COMPANY_ID,
        templateId: TEMPLATE_ID,
        versionId: VERSION_ID,
        actorId: ACTOR_ID,
        permissions: ["growth.leads.read"],
        input: { updatedAt: UPDATED_AT.toISOString() },
      }),
      (error) =>
        error instanceof DocumentTemplateServiceError &&
        error.status === 422 &&
        error.code === "unknown_document_binding" &&
        error.details[0].path === "lead.secret",
    );
  });

  test("publishes a valid version transactionally and activates it", async () => {
    const calls = [];
    const template = {
      id: TEMPLATE_ID,
      companyId: COMPANY_ID,
      sourceType: "growth.lead",
      enabled: true,
    };
    const version = {
      id: VERSION_ID,
      templateId: TEMPLATE_ID,
      status: "draft",
      blocks: validBlocks,
      updatedAt: UPDATED_AT,
    };
    const { prisma } = createPrisma({
      documentTemplate: {
        findFirst: async () => template,
        update: async (query) => (calls.push(["template", query]), {
          ...template,
          publishedVersionId: VERSION_ID,
        }),
      },
      documentTemplateVersion: {
        findFirst: async () => version,
        updateMany: async (query) => (calls.push(["version", query]), { count: 1 }),
      },
    });
    const service = createDocumentTemplateService({
      prisma,
      providerRegistry: createRegistry(),
      now: () => NOW,
    });

    const published = await service.publishVersion({
      companyId: COMPANY_ID,
      templateId: TEMPLATE_ID,
      versionId: VERSION_ID,
      actorId: ACTOR_ID,
      permissions: ["growth.leads.read"],
      input: { updatedAt: UPDATED_AT.toISOString() },
    });

    assert.equal(calls[0][1].data.status, "published");
    assert.equal(calls[1][1].data.publishedVersionId, VERSION_ID);
    assert.equal(published.publishedVersionId, VERSION_ID);
  });

  test("disables templates optimistically and audits the state change", async () => {
    const template = {
      id: TEMPLATE_ID,
      companyId: COMPANY_ID,
      enabled: true,
      updatedAt: UPDATED_AT,
    };
    const { prisma, calls } = createPrisma({
      documentTemplate: {
        findFirst: async () => template,
        updateMany: async () => ({ count: 1 }),
      },
    });
    const service = createDocumentTemplateService({
      prisma,
      providerRegistry: createRegistry(),
      now: () => NOW,
    });

    const result = await service.setTemplateEnabled({
      companyId: COMPANY_ID,
      id: TEMPLATE_ID,
      actorId: ACTOR_ID,
      input: {
        enabled: false,
        updatedAt: UPDATED_AT.toISOString(),
      },
    });

    assert.equal(result.enabled, false);
    assert.equal(calls.at(-1)[1].action, "documents.template.disable");
  });
});
