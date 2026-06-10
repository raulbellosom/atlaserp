import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createCalendarNotificationService } from "../calendar-notification-service.js";

const EVENT_ID   = "01971a2b-0000-7000-8000-000000000001";
const USER_ID    = "01971a2b-0000-7000-8000-000000000002";
const COMPANY_ID = "01971a2b-0000-7000-8000-000000000003";

function buildPrismaMock() {
  const now = new Date();
  const startAt = new Date(now.getTime() + 10 * 60 * 1000);
  const published = [];

  const reminder = {
    id: "rem-1",
    userId: USER_ID,
    eventId: EVENT_ID,
    minutesBefore: 15,
    sentAt: null,
    event: { id: EVENT_ID, title: "Reunion de equipo", startAt, allDay: false, enabled: true },
  };

  return {
    instanceConfig: { findFirst: async () => null },
    calendarReminder: {
      findMany: async () => [reminder],
      updateMany: async () => {},
    },
    calendarNotification: { createMany: async () => {} },
    // findFirst: used by processReminders to resolve membership.companyId
    // findMany: used by resolveRecipientUserIds inside notificationSvc.publish
    membership: {
      findFirst: async () => ({ companyId: COMPANY_ID }),
      findMany: async ({ where }) => {
        const ids = where?.userId?.in ?? [];
        return ids.map((id) => ({ userId: id }));
      },
    },
    $transaction: async (fn) =>
      fn({
        notification: {
          findFirst: async () => null,
          create: async ({ data }) => {
            published.push(data);
            return { id: "notif-1", ...data };
          },
        },
        notificationDelivery: { createMany: async () => {} },
      }),
    _published: published,
  };
}

describe("createCalendarNotificationService", () => {
  describe("processReminders", () => {
    it("publishes notification with ?open=event:<id> link format", async () => {
      const prisma = buildPrismaMock();
      const svc = createCalendarNotificationService({ prisma });

      await svc.processReminders();

      assert.ok(prisma._published.length > 0, "expected at least one notification published");
      const link = prisma._published[0].link;
      assert.ok(
        typeof link === "string" && link.includes(`?open=event:${EVENT_ID}`),
        `expected link to contain ?open=event:${EVENT_ID}, got: ${link}`,
      );
    });
  });
});
