import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  GrowthLeadServiceError,
  createGrowthLeadService,
} from "../growth-lead-service.js";

const COMPANY_ID = "01900000-0000-7000-8000-000000000001";
const OTHER_COMPANY_ID = "01900000-0000-7000-8000-000000000002";
const SITE_ID = "01900000-0000-7000-8000-000000000003";
const LEAD_ID = "01900000-0000-7000-8000-000000000004";
const USER_ID = "01900000-0000-7000-8000-000000000005";
const ACTOR_ID = "01900000-0000-7000-8000-000000000006";
const CONTACT_ID = "01900000-0000-7000-8000-000000000008";
const NOW = new Date("2026-06-14T21:30:00.000Z");

function buildPrisma({ lead: leadOverride } = {}) {
  const lead = {
    id: LEAD_ID,
    companyId: COMPANY_ID,
    siteId: SITE_ID,
    formId: null,
    status: "new",
    priority: "normal",
    name: "Ana",
    email: "ana@example.com",
    emailNormalized: "ana@example.com",
    phone: null,
    phoneNormalized: null,
    companyName: null,
    message: null,
    source: "manual",
    attribution: null,
    assigneeUserId: null,
    contactId: null,
    discardReason: null,
    notesSummary: null,
    qualifiedAt: null,
    convertedAt: null,
    enabled: true,
    createdAt: NOW,
    updatedAt: NOW,
    ...leadOverride,
  };
  const state = {
    leads: [lead],
    files: [
      {
        id: "file-1",
        entityId: COMPANY_ID,
        moduleKey: "atlas.growth",
        entityType: "GrowthLead",
        metadata: { sourceEntityId: LEAD_ID },
        enabled: true,
        originalName: "brief.pdf",
      },
      {
        id: "file-other-company",
        entityId: OTHER_COMPANY_ID,
        moduleKey: "atlas.growth",
        entityType: "GrowthLead",
        metadata: { sourceEntityId: LEAD_ID },
        enabled: true,
        originalName: "private.pdf",
      },
    ],
    activities: [],
    audits: [],
    notifications: [],
    contacts: [],
    calls: {
      listWhere: null,
    },
  };

  function matchesLead(where, row) {
    if (where.id && row.id !== where.id) return false;
    if (where.companyId && row.companyId !== where.companyId) return false;
    if (where.enabled !== undefined && row.enabled !== where.enabled) return false;
    return true;
  }

  const prisma = {
    _state: state,
    websiteSite: {
      findFirst: async ({ where }) =>
        where.companyId === COMPANY_ID && (!where.id || where.id === SITE_ID)
          ? { id: SITE_ID, companyId: COMPANY_ID, enabled: true }
          : null,
    },
    membership: {
      findFirst: async ({ where }) =>
        where.companyId === COMPANY_ID && where.userId === USER_ID
          ? { id: "membership-1" }
          : null,
      findMany: async ({ where }) =>
        where.companyId === COMPANY_ID
          ? [
              {
                user: {
                  id: USER_ID,
                  displayName: "Ana Ventas",
                  email: "ana@atlas.test",
                },
              },
            ]
          : [],
    },
    growthLead: {
      findFirst: async ({ where }) =>
        state.leads.find((row) => matchesLead(where, row)) ?? null,
      findMany: async ({ where }) => {
        state.calls.listWhere = where;
        return state.leads.filter((row) => row.companyId === where.companyId);
      },
      count: async ({ where }) =>
        state.leads.filter((row) => row.companyId === where.companyId).length,
      groupBy: async () => [
        { status: "new", _count: { _all: 1 } },
      ],
      create: async ({ data }) => {
        const row = {
          id: `01900000-0000-7000-8000-0000000000${state.leads.length + 10}`,
          createdAt: NOW,
          updatedAt: NOW,
          convertedAt: null,
          contactId: null,
          discardReason: null,
          notesSummary: null,
          enabled: true,
          ...data,
        };
        state.leads.push(row);
        return row;
      },
      update: async ({ where, data }) => {
        const row = state.leads.find((item) => item.id === where.id);
        Object.assign(row, data, { updatedAt: NOW });
        return row;
      },
      updateMany: async ({ where, data }) => {
        const row = state.leads.find(
          (item) =>
            item.id === where.id &&
            item.companyId === where.companyId &&
            item.enabled === where.enabled &&
            item.convertedAt === where.convertedAt &&
            item.status !== where.status.not &&
            sameDate(item.updatedAt, where.updatedAt),
        );
        if (!row) return { count: 0 };
        Object.assign(row, data, { updatedAt: NOW });
        return { count: 1 };
      },
      findUnique: async ({ where }) =>
        state.leads.find((item) => item.id === where.id) ?? null,
    },
    growthLeadActivity: {
      findMany: async ({ where }) =>
        state.activities.filter((row) => row.leadId === where.leadId),
      create: async ({ data }) => {
        const row = {
          id: `activity-${state.activities.length + 1}`,
          occurredAt: NOW,
          createdAt: NOW,
          ...data,
        };
        state.activities.push(row);
        return row;
      },
    },
    websiteFormSubmission: {
      findMany: async () => [],
    },
    fileAsset: {
      findMany: async ({ where }) =>
        state.files.filter(
          (row) =>
            row.entityId === where.entityId &&
            row.moduleKey === where.moduleKey &&
            row.entityType === where.entityType &&
            row.enabled === where.enabled &&
            row.metadata.sourceEntityId === where.metadata.equals,
        ),
      findFirst: async ({ where }) =>
        state.files.find(
          (row) =>
            row.id === where.id &&
            row.entityId === where.entityId &&
            row.moduleKey === where.moduleKey &&
            row.entityType === where.entityType &&
            row.metadata.sourceEntityId === where.metadata.equals,
        ) ?? null,
      update: async ({ where, data }) => {
        const row = state.files.find((item) => item.id === where.id);
        Object.assign(row, data);
        return row;
      },
    },
    contact: {
      findFirst: async ({ where }) =>
        state.contacts.find(
          (row) =>
            row.id === where.id &&
            row.companyId === where.companyId &&
            row.enabled === where.enabled,
        ) ?? null,
      create: async ({ data }) => {
        const row = {
          id: CONTACT_ID,
          enabled: true,
          createdAt: NOW,
          updatedAt: NOW,
          ...data,
        };
        state.contacts.push(row);
        return row;
      },
    },
    auditLog: {
      create: async ({ data }) => {
        state.audits.push(data);
        return data;
      },
    },
    $transaction: async (callback) => callback(prisma),
  };

  return prisma;
}

function sameDate(left, right) {
  return new Date(left).getTime() === new Date(right).getTime();
}

function buildService(prisma) {
  const notificationService = {
    publish: async (input) => {
      prisma._state.notifications.push(input);
      return { created: 1 };
    },
  };
  return createGrowthLeadService({
    prisma,
    notificationService,
    now: () => NOW,
  });
}

describe("createGrowthLeadService", () => {
  it("lists, associates, and removes only files owned by the lead company", async () => {
    const prisma = buildPrisma();
    const service = buildService(prisma);

    const files = await service.listLeadFiles({
      companyId: COMPANY_ID,
      id: LEAD_ID,
    });
    assert.deepEqual(files.map((file) => file.id), ["file-1"]);

    const associated = await service.associateLeadFile({
      companyId: COMPANY_ID,
      id: LEAD_ID,
      fileAssetId: "file-1",
    });
    assert.equal(associated.id, "file-1");

    await assert.rejects(
      () =>
        service.associateLeadFile({
          companyId: COMPANY_ID,
          id: LEAD_ID,
          fileAssetId: "file-other-company",
        }),
      (error) =>
        error instanceof GrowthLeadServiceError &&
        error.code === "lead_file_not_found",
    );

    const removed = await service.removeLeadFile({
      companyId: COMPANY_ID,
      id: LEAD_ID,
      fileAssetId: "file-1",
    });
    assert.equal(removed.enabled, false);
  });

  it("lists only active assignee candidates from the current company", async () => {
    const prisma = buildPrisma();
    const service = buildService(prisma);

    const assignees = await service.listAssignees({
      companyId: COMPANY_ID,
    });

    assert.deepEqual(assignees, [
      {
        id: USER_ID,
        displayName: "Ana Ventas",
        email: "ana@atlas.test",
      },
    ]);
  });

  it("scopes list queries to the company and applies inbox filters", async () => {
    const prisma = buildPrisma();
    const service = buildService(prisma);

    await service.listLeads({
      companyId: COMPANY_ID,
      query: {
        status: "new",
        priority: "high",
        assigneeId: USER_ID,
        formId: "01900000-0000-7000-8000-000000000007",
        campaign: "spring",
        search: "ana",
        page: 2,
        pageSize: 10,
      },
    });

    const where = prisma._state.calls.listWhere;
    assert.equal(where.companyId, COMPANY_ID);
    assert.equal(where.enabled, true);
    assert.equal(where.status, "new");
    assert.equal(where.priority, "high");
    assert.equal(where.assigneeUserId, USER_ID);
    assert.equal(where.formId, "01900000-0000-7000-8000-000000000007");
    assert.deepEqual(where.attribution, {
      path: ["campaign"],
      equals: "spring",
    });
    assert.ok(Array.isArray(where.OR));
  });

  it("creates a manual lead, activity, audit, and assignee notification", async () => {
    const prisma = buildPrisma();
    const service = buildService(prisma);

    const created = await service.createLead({
      companyId: COMPANY_ID,
      actorId: ACTOR_ID,
      data: {
        siteId: SITE_ID,
        name: "Luis",
        email: " LUIS@EXAMPLE.COM ",
        priority: "high",
        assigneeUserId: USER_ID,
      },
    });

    assert.equal(created.emailNormalized, "luis@example.com");
    assert.equal(prisma._state.activities.at(-1).activityType, "status_changed");
    assert.equal(prisma._state.audits.at(-1).action, "growth.lead.create");
    assert.equal(
      prisma._state.notifications.at(-1).input.eventType,
      "growth.lead.created",
    );
    assert.deepEqual(
      prisma._state.notifications.at(-1).input.recipients.userIds,
      [USER_ID],
    );
  });

  it("rejects invalid direct conversion and treats converted as terminal", async () => {
    const prisma = buildPrisma();
    const service = buildService(prisma);

    await assert.rejects(
      () =>
        service.updateLead({
          companyId: COMPANY_ID,
          actorId: ACTOR_ID,
          id: LEAD_ID,
          data: { status: "converted", updatedAt: NOW.toISOString() },
        }),
      (error) =>
        error instanceof GrowthLeadServiceError &&
        error.code === "invalid_status_transition",
    );

    prisma._state.leads[0].status = "converted";
    prisma._state.leads[0].convertedAt = NOW;
    await assert.rejects(
      () =>
        service.updateLead({
          companyId: COMPANY_ID,
          actorId: ACTOR_ID,
          id: LEAD_ID,
          data: { priority: "high", updatedAt: NOW.toISOString() },
        }),
      (error) => error.code === "lead_converted",
    );
  });

  it("reopens discarded leads to follow_up and clears the discard reason", async () => {
    const prisma = buildPrisma({
      lead: {
        status: "discarded",
        discardReason: "Sin presupuesto",
      },
    });
    const service = buildService(prisma);

    const updated = await service.updateLead({
      companyId: COMPANY_ID,
      actorId: ACTOR_ID,
      id: LEAD_ID,
      data: { status: "follow_up", updatedAt: NOW.toISOString() },
    });

    assert.equal(updated.status, "follow_up");
    assert.equal(updated.discardReason, null);
    assert.equal(prisma._state.activities.at(-1).activityType, "reopened");
  });

  it("rejects stale updates with a conflict", async () => {
    const prisma = buildPrisma();
    const service = buildService(prisma);

    await assert.rejects(
      () =>
        service.updateLead({
          companyId: COMPANY_ID,
          actorId: ACTOR_ID,
          id: LEAD_ID,
          data: {
            priority: "high",
            updatedAt: "2026-06-14T20:00:00.000Z",
          },
        }),
      (error) => error.code === "lead_update_conflict" && error.status === 409,
    );
  });

  it("rejects assignees outside the active company", async () => {
    const prisma = buildPrisma();
    const service = buildService(prisma);

    await assert.rejects(
      () =>
        service.updateLead({
          companyId: OTHER_COMPANY_ID,
          actorId: ACTOR_ID,
          id: LEAD_ID,
          data: {
            assigneeUserId: USER_ID,
            updatedAt: NOW.toISOString(),
          },
        }),
      (error) => error.status === 404,
    );

    await assert.rejects(
      () =>
        service.createLead({
          companyId: COMPANY_ID,
          actorId: ACTOR_ID,
          data: {
            siteId: SITE_ID,
            name: "Luis",
            assigneeUserId: ACTOR_ID,
          },
        }),
      (error) => error.code === "invalid_assignee",
    );
  });

  it("adds notes to the timeline and updates the summary optimistically", async () => {
    const prisma = buildPrisma();
    const service = buildService(prisma);

    const result = await service.addLeadNote({
      companyId: COMPANY_ID,
      actorId: ACTOR_ID,
      id: LEAD_ID,
      data: {
        note: "Llamar el lunes",
        updatedAt: NOW.toISOString(),
      },
    });

    assert.equal(result.lead.notesSummary, "Llamar el lunes");
    assert.equal(result.activity.activityType, "note");
    assert.deepEqual(result.activity.payload, { note: "Llamar el lunes" });
    assert.equal(prisma._state.audits.at(-1).action, "growth.lead.note");
  });

  it("blocks mutations while disabled and records enable state changes", async () => {
    const prisma = buildPrisma({ lead: { enabled: false } });
    const service = buildService(prisma);

    await assert.rejects(
      () =>
        service.addLeadNote({
          companyId: COMPANY_ID,
          actorId: ACTOR_ID,
          id: LEAD_ID,
          data: { note: "No aplica", updatedAt: NOW.toISOString() },
        }),
      (error) => error.code === "lead_disabled",
    );

    const enabled = await service.setLeadEnabled({
      companyId: COMPANY_ID,
      actorId: ACTOR_ID,
      id: LEAD_ID,
      enabled: true,
      updatedAt: NOW.toISOString(),
    });
    assert.equal(enabled.enabled, true);
    assert.equal(prisma._state.activities.at(-1).activityType, "enabled");
    assert.equal(prisma._state.audits.at(-1).action, "growth.lead.enable");
  });

  it("links an existing same-company Contact transactionally", async () => {
    const prisma = buildPrisma();
    prisma._state.contacts.push({
      id: CONTACT_ID,
      companyId: COMPANY_ID,
      type: "customer",
      name: "Ana",
      enabled: true,
    });
    const service = buildService(prisma);

    const result = await service.convertLead({
      companyId: COMPANY_ID,
      actorId: ACTOR_ID,
      id: LEAD_ID,
      permissions: ["contacts.contacts.read"],
      data: {
        mode: "existing",
        contactId: CONTACT_ID,
        updatedAt: NOW.toISOString(),
      },
    });

    assert.equal(result.contact.id, CONTACT_ID);
    assert.equal(result.lead.status, "converted");
    assert.equal(result.lead.contactId, CONTACT_ID);
    assert.equal(prisma._state.activities.at(-1).activityType, "converted");
    assert.deepEqual(prisma._state.activities.at(-1).payload, {
      mode: "existing",
      contactId: CONTACT_ID,
    });
    assert.equal(prisma._state.audits.at(-1).action, "growth.lead.convert");
  });

  it("creates one Contact and converts the lead in the same transaction", async () => {
    const prisma = buildPrisma();
    const service = buildService(prisma);

    const result = await service.convertLead({
      companyId: COMPANY_ID,
      actorId: ACTOR_ID,
      id: LEAD_ID,
      permissions: ["contacts.contacts.create"],
      data: {
        mode: "create",
        updatedAt: NOW.toISOString(),
        contact: {
          type: "customer",
          name: "Ana",
          email: "ana@example.com",
          phone: "+52 55 1234 5678",
        },
      },
    });

    assert.equal(prisma._state.contacts.length, 1);
    assert.equal(result.contact.companyId, COMPANY_ID);
    assert.equal(result.lead.contactId, CONTACT_ID);
  });

  it("requires the corresponding Contacts permission for each mode", async () => {
    const prisma = buildPrisma();
    const service = buildService(prisma);

    await assert.rejects(
      () =>
        service.convertLead({
          companyId: COMPANY_ID,
          actorId: ACTOR_ID,
          id: LEAD_ID,
          permissions: [],
          data: {
            mode: "create",
            updatedAt: NOW.toISOString(),
            contact: { type: "customer", name: "Ana" },
          },
        }),
      (error) =>
        error.status === 403 &&
        error.code === "contacts_permission_required",
    );
    assert.equal(prisma._state.contacts.length, 0);
  });

  it("rejects cross-company Contacts and concurrent conversion", async () => {
    const prisma = buildPrisma();
    prisma._state.contacts.push({
      id: CONTACT_ID,
      companyId: OTHER_COMPANY_ID,
      type: "customer",
      name: "Otro",
      enabled: true,
    });
    const service = buildService(prisma);

    await assert.rejects(
      () =>
        service.convertLead({
          companyId: COMPANY_ID,
          actorId: ACTOR_ID,
          id: LEAD_ID,
          permissions: ["contacts.contacts.read"],
          data: {
            mode: "existing",
            contactId: CONTACT_ID,
            updatedAt: NOW.toISOString(),
          },
        }),
      (error) => error.status === 404 && error.code === "contact_not_found",
    );

    prisma._state.leads[0].status = "converted";
    prisma._state.leads[0].convertedAt = NOW;
    await assert.rejects(
      () =>
        service.convertLead({
          companyId: COMPANY_ID,
          actorId: ACTOR_ID,
          id: LEAD_ID,
          permissions: ["contacts.contacts.create"],
          data: {
            mode: "create",
            updatedAt: NOW.toISOString(),
            contact: { type: "customer", name: "Ana" },
          },
        }),
      (error) => error.status === 409 && error.code === "lead_converted",
    );
    assert.equal(prisma._state.contacts.length, 1);
  });

  it("rolls back Contact creation when conversion activity fails", async () => {
    const prisma = buildPrisma();
    const originalTransaction = prisma.$transaction;
    prisma.$transaction = async (callback) => {
      const leads = prisma._state.leads.map((row) => ({ ...row }));
      const contacts = prisma._state.contacts.map((row) => ({ ...row }));
      try {
        return await originalTransaction(callback);
      } catch (error) {
        prisma._state.leads = leads;
        prisma._state.contacts = contacts;
        throw error;
      }
    };
    prisma.growthLeadActivity.create = async () => {
      throw new Error("activity failed");
    };
    const service = buildService(prisma);

    await assert.rejects(() =>
      service.convertLead({
        companyId: COMPANY_ID,
        actorId: ACTOR_ID,
        id: LEAD_ID,
        permissions: ["contacts.contacts.create"],
        data: {
          mode: "create",
          updatedAt: NOW.toISOString(),
          contact: { type: "customer", name: "Ana" },
        },
      }),
    );

    assert.equal(prisma._state.contacts.length, 0);
    assert.equal(prisma._state.leads[0].status, "new");
    assert.equal(prisma._state.leads[0].contactId, null);
  });
});
