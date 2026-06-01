import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { publishNotificationFromContext } from "../notification-publisher.js";

const COMPANY_ID = "01900000-0000-7000-8000-000000000001";
const ACTOR_ID = "01900000-0000-7000-8000-000000000002";
const RECIPIENT_ID = "01900000-0000-7000-8000-000000000003";

function makeUuid(index) {
  return `01900000-0000-7000-8000-${index.toString(16).padStart(12, "0")}`;
}

function buildContext(values) {
  return {
    get(key) {
      return values[key] ?? null;
    },
  };
}

function buildPrismaMock({ failMembership = false } = {}) {
  let sequence = 10;
  const notifications = [];

  const txNotification = {
    findFirst: async ({ where }) =>
      notifications.find(
        (row) =>
          row.userId === where.userId &&
          row.dedupeKey === where.dedupeKey &&
          row.createdAt >= where.createdAt.gte,
      ) ?? null,
    create: async ({ data }) => {
      const row = {
        id: makeUuid(sequence++),
        createdAt: new Date(),
        updatedAt: new Date(),
        readAt: null,
        ...data,
      };
      notifications.push(row);
      return row;
    },
  };

  const prisma = {
    _notifications: notifications,
    membership: {
      findMany: async ({ where }) => {
        if (failMembership) throw new Error("membership error");
        const ids = where?.userId?.in ?? [];
        return ids
          .filter((id) => id === RECIPIENT_ID || id === ACTOR_ID)
          .map((id) => ({ userId: id }));
      },
    },
    notificationDelivery: {
      createMany: async () => ({ count: 1 }),
    },
    $transaction: async (fn) =>
      fn({
        notification: txNotification,
        notificationDelivery: prisma.notificationDelivery,
      }),
  };

  return prisma;
}

describe("notification-publisher", () => {
  it("publishes using company and actor from request context", async () => {
    const prisma = buildPrismaMock();
    const c = buildContext({
      companyId: COMPANY_ID,
      userId: ACTOR_ID,
    });

    const result = await publishNotificationFromContext(prisma, c, {
      eventType: "calendar.event.invite",
      title: "Invitacion",
      recipients: { userIds: [RECIPIENT_ID] },
      channels: ["in_app"],
      priority: "high",
    });

    assert.equal(result.ok, true);
    assert.equal(result.data.created, 1);
    assert.equal(result.data.actorId, ACTOR_ID);
    assert.equal(prisma._notifications.length, 1);
    assert.equal(prisma._notifications[0].companyId, COMPANY_ID);
    assert.equal(prisma._notifications[0].userId, RECIPIENT_ID);
  });

  it("applies dedupe when same key is published quickly", async () => {
    const prisma = buildPrismaMock();
    const c = buildContext({ companyId: COMPANY_ID, userId: ACTOR_ID });
    const payload = {
      eventType: "website.sale.confirmed",
      title: "Venta",
      recipients: { userIds: [RECIPIENT_ID] },
      channels: ["in_app"],
      dedupeKey: "sale-1",
    };

    const first = await publishNotificationFromContext(prisma, c, payload);
    const second = await publishNotificationFromContext(prisma, c, payload);

    assert.equal(first.ok, true);
    assert.equal(first.data.created, 1);
    assert.equal(second.ok, true);
    assert.equal(second.data.created, 0);
    assert.equal(second.data.deduped, 1);
  });

  it("isolates errors and does not throw by default", async () => {
    const prisma = buildPrismaMock({ failMembership: true });
    const c = buildContext({ companyId: COMPANY_ID, userId: ACTOR_ID });

    const result = await publishNotificationFromContext(prisma, c, {
      eventType: "system.alert",
      title: "Error",
      recipients: { userIds: [RECIPIENT_ID] },
    });

    assert.equal(result.ok, false);
    assert.equal(result.reason, "publish_failed");
  });
});

