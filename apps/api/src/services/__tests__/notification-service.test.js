import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createNotificationService } from "../notification-service.js";

const AUTH_USER_ID = "auth-user-1";
const PROFILE_ID = "01900000-0000-7000-8000-000000000001";
const COMPANY_ID = "01900000-0000-7000-8000-000000000002";
const RECIPIENT_A = "01900000-0000-7000-8000-000000000003";
const RECIPIENT_B = "01900000-0000-7000-8000-000000000004";

function makeUuidFromInt(value) {
  return `01900000-0000-7000-8000-${value.toString(16).padStart(12, "0")}`;
}

function buildPrismaMock() {
  let seq = 10;
  const notifications = [];
  const deliveries = [];

  function inCompanyScope(row, where) {
    if (!Array.isArray(where?.OR)) return true;
    return where.OR.some((rule) => {
      if (Object.hasOwn(rule, "companyId")) {
        return row.companyId === rule.companyId;
      }
      return false;
    });
  }

  function matchWhere(row, where = {}) {
    if (where.userId && row.userId !== where.userId) return false;
    if (where.id && row.id !== where.id) return false;
    if (where.dedupeKey && row.dedupeKey !== where.dedupeKey) return false;
    if (where.readAt === null && row.readAt !== null) return false;
    if (!inCompanyScope(row, where)) return false;
    return true;
  }

  const txNotification = {
    findFirst: async ({ where }) => {
      if (where?.createdAt?.gte) {
        return (
          notifications.find(
            (row) =>
              row.userId === where.userId &&
              row.dedupeKey === where.dedupeKey &&
              row.createdAt >= where.createdAt.gte,
          ) ?? null
        );
      }
      return notifications.find((row) => matchWhere(row, where)) ?? null;
    },
    create: async ({ data }) => {
      const row = {
        id: makeUuidFromInt(seq),
        createdAt: new Date(),
        updatedAt: new Date(),
        readAt: null,
        ...data,
      };
      seq += 1;
      notifications.push(row);
      return row;
    },
  };

  const prisma = {
    _notifications: notifications,
    _deliveries: deliveries,
    userProfile: {
      findUnique: async ({ where }) =>
        where?.authUserId === AUTH_USER_ID ? { id: PROFILE_ID } : null,
    },
    membership: {
      findFirst: async () => ({ companyId: COMPANY_ID }),
      findMany: async ({ where }) => {
        const candidates = Array.isArray(where?.userId?.in)
          ? where.userId.in
          : [];
        return candidates
          .filter((id) => [PROFILE_ID, RECIPIENT_A, RECIPIENT_B].includes(id))
          .map((id) => ({ userId: id }));
      },
    },
    notification: {
      findMany: async ({ where, take }) => {
        const rows = notifications
          .filter((row) => matchWhere(row, where))
          .sort((a, b) => String(b.id).localeCompare(String(a.id)));
        return typeof take === "number" ? rows.slice(0, take) : rows;
      },
      findFirst: async ({ where }) =>
        notifications.find((row) => matchWhere(row, where)) ?? null,
      update: async ({ where, data }) => {
        const idx = notifications.findIndex((row) => row.id === where.id);
        if (idx < 0) throw new Error("not found");
        notifications[idx] = {
          ...notifications[idx],
          ...data,
          updatedAt: new Date(),
        };
        return notifications[idx];
      },
      updateMany: async ({ where, data }) => {
        let count = 0;
        for (let index = 0; index < notifications.length; index += 1) {
          if (!matchWhere(notifications[index], where)) continue;
          notifications[index] = {
            ...notifications[index],
            ...data,
            updatedAt: new Date(),
          };
          count += 1;
        }
        return { count };
      },
      ...txNotification,
    },
    notificationDelivery: {
      createMany: async ({ data }) => {
        deliveries.push(...data);
        return { count: data.length };
      },
    },
    notificationPreference: {
      findMany: async () => [],
      upsert: async ({ create, update }) => ({ ...create, ...update }),
    },
    pushSubscription: {
      upsert: async ({ create, update }) => ({ ...create, ...update }),
      findFirst: async () => null,
      delete: async () => ({ id: "deleted" }),
    },
    $transaction: async (fn) =>
      fn({
        notification: txNotification,
        notificationDelivery: prisma.notificationDelivery,
      }),
  };

  return prisma;
}

describe("notification-service", () => {
  it("publishes notifications for valid recipients", async () => {
    const prisma = buildPrismaMock();
    const service = createNotificationService({ prisma });

    const result = await service.publishFromContext({
      authUserId: AUTH_USER_ID,
      input: {
        eventType: "calendar.event.reminder",
        title: "Recordatorio",
        recipients: { userIds: [RECIPIENT_A, RECIPIENT_B] },
        channels: ["in_app", "email"],
        priority: "high",
      },
    });

    assert.equal(result.created, 2);
    assert.equal(result.deduped, 0);
    assert.equal(prisma._notifications.length, 2);
    assert.equal(prisma._deliveries.length, 4);
  });

  it("dedupes repeated publish with same dedupeKey in short window", async () => {
    const prisma = buildPrismaMock();
    const service = createNotificationService({ prisma });
    const payload = {
      eventType: "website.sale.confirmed",
      title: "Venta confirmada",
      recipients: { userIds: [RECIPIENT_A] },
      channels: ["in_app"],
      dedupeKey: "sale-100",
    };

    const first = await service.publishFromContext({
      authUserId: AUTH_USER_ID,
      input: payload,
    });
    const second = await service.publishFromContext({
      authUserId: AUTH_USER_ID,
      input: payload,
    });

    assert.equal(first.created, 1);
    assert.equal(second.created, 0);
    assert.equal(second.deduped, 1);
    assert.equal(prisma._notifications.length, 1);
  });

  it("lists unread notifications only", async () => {
    const prisma = buildPrismaMock();
    const service = createNotificationService({ prisma });

    await service.publishFromContext({
      authUserId: AUTH_USER_ID,
      input: {
        eventType: "system.alert",
        title: "Alerta",
        sourceId: "alerta-1",
        recipients: { userIds: [PROFILE_ID] },
      },
    });
    const created = prisma._notifications[0];
    await prisma.notification.update({
      where: { id: created.id },
      data: { readAt: new Date() },
    });
    await service.publishFromContext({
      authUserId: AUTH_USER_ID,
      input: {
        eventType: "system.alert",
        title: "Alerta 2",
        sourceId: "alerta-2",
        recipients: { userIds: [PROFILE_ID] },
      },
    });

    const result = await service.list({
      authUserId: AUTH_USER_ID,
      query: { unreadOnly: true },
    });

    assert.equal(result.data.length, 1);
    assert.equal(result.data[0].title, "Alerta 2");
    assert.equal(result.data[0].read, false);
  });

  it("marks one notification as read", async () => {
    const prisma = buildPrismaMock();
    const service = createNotificationService({ prisma });

    await service.publishFromContext({
      authUserId: AUTH_USER_ID,
      input: {
        eventType: "calendar.event.reminder",
        title: "Evento",
        recipients: { userIds: [PROFILE_ID] },
      },
    });

    const target = prisma._notifications[0];
    const updated = await service.markRead({
      authUserId: AUTH_USER_ID,
      id: target.id,
    });

    assert.equal(updated.id, target.id);
    assert.equal(updated.read, true);
    assert.ok(updated.readAt);
  });

  it("marks all unread notifications as read", async () => {
    const prisma = buildPrismaMock();
    const service = createNotificationService({ prisma });

    await service.publishFromContext({
      authUserId: AUTH_USER_ID,
      input: {
        eventType: "calendar.event.reminder",
        title: "Evento A",
        sourceId: "evento-a",
        recipients: { userIds: [PROFILE_ID] },
      },
    });
    await service.publishFromContext({
      authUserId: AUTH_USER_ID,
      input: {
        eventType: "calendar.event.reminder",
        title: "Evento B",
        sourceId: "evento-b",
        recipients: { userIds: [PROFILE_ID] },
      },
    });

    const result = await service.markAllRead({ authUserId: AUTH_USER_ID });
    assert.equal(result.updated, 2);

    const unread = await service.list({
      authUserId: AUTH_USER_ID,
      query: { unreadOnly: true },
    });
    assert.equal(unread.data.length, 0);
  });
});
