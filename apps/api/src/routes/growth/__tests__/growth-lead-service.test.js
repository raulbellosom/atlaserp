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
    activities: [],
    audits: [],
    notifications: [],
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
});
