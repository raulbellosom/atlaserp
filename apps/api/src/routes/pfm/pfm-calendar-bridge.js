// apps/api/src/routes/pfm/pfm-calendar-bridge.js
//
// Best-effort mirror of atlas.pfm recurring rules onto atlas.calendar. Mirrors
// the projects-calendar-bridge.js contract: never throws into the caller; if the
// calendar module is not installed, every method is a no-op.

const SOURCE = "atlas.pfm";

function isCalendarAvailable(prisma) {
  return (
    typeof prisma?.calendarCalendar?.create === "function" &&
    typeof prisma?.calendarEvent?.create === "function"
  );
}

function ruleToRruleJson(rrule) {
  // Store the same compact shape pfm uses elsewhere; atlas.calendar treats
  // recurrenceRule as opaque Json for display/expansion.
  return { ...rrule };
}

function eventTitle(rule) {
  if (rule.amountMode === "VARIABLE" || rule.amount == null) return `${rule.label} (monto variable)`;
  const amt = Number(rule.amount).toLocaleString("es-MX", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${rule.label} ($${amt})`;
}

export function createPfmCalendarBridge({ prisma }) {
  async function ensureCalendar(ownerId) {
    const key = `pfm.calendarId.${ownerId}`;
    const cfg = await prisma.instanceConfig.findUnique({ where: { key } });
    if (cfg?.value) {
      const existing = await prisma.calendarCalendar.findFirst({
        where: { id: cfg.value, enabled: true },
        select: { id: true },
      });
      if (existing) return cfg.value;
    }
    const calendar = await prisma.calendarCalendar.create({
      data: { ownerId, name: "Finanzas personales", color: "#0ea5e9", isDefault: false },
    });
    await prisma.instanceConfig.upsert({
      where: { key },
      update: { value: calendar.id },
      create: { key, value: calendar.id },
    });
    return calendar.id;
  }

  async function syncRuleEvent(rule) {
    if (!isCalendarAvailable(prisma)) return null;
    try {
      const calendarId = await ensureCalendar(rule.ownerId);
      const startAt = new Date(String(rule.nextRunAt).slice(0, 10) + "T00:00:00.000Z");
      const payload = {
        calendarId,
        title: eventTitle(rule),
        startAt,
        allDay: true,
        recurrenceRule: ruleToRruleJson(rule.rrule),
        color: "#0ea5e9",
        sourceModule: SOURCE,
        sourceEntityId: rule.id,
      };
      if (rule.calendarEventId) {
        await prisma.calendarEvent.update({
          where: { id: rule.calendarEventId },
          data: {
            title: payload.title,
            startAt: payload.startAt,
            allDay: true,
            recurrenceRule: payload.recurrenceRule,
          },
        });
        return rule.calendarEventId;
      }
      const event = await prisma.calendarEvent.create({ data: payload });
      await prisma.pfmRecurringRule.update({
        where: { id: rule.id },
        data: { calendarEventId: event.id },
      });
      return event.id;
    } catch (err) {
      console.error("[atlas.pfm] pfm-calendar-bridge syncRuleEvent failed:", err?.message ?? err);
      return null;
    }
  }

  async function deleteRuleEvent(rule) {
    if (typeof prisma?.calendarEvent?.delete !== "function" || !rule.calendarEventId) return;
    try {
      await prisma.calendarEvent.delete({ where: { id: rule.calendarEventId } });
    } catch {
      // event already gone — fine
    }
  }

  // Monthly "payment due" reminder for a credit-card wallet.
  async function syncCreditReminder(wallet) {
    if (!isCalendarAvailable(prisma)) return null;
    if (wallet.kind !== "CREDIT" || !wallet.paymentDueDay) {
      if (wallet.creditReminderEventId) await deleteCreditReminder(wallet);
      return null;
    }
    try {
      const calendarId = await ensureCalendar(wallet.ownerId);
      const now = new Date();
      const dom = Math.min(Number(wallet.paymentDueDay), 28);
      let start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), dom));
      if (start.getTime() < Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())) {
        start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, dom));
      }
      const payload = {
        calendarId,
        title: `Fecha limite de pago — ${wallet.name}`,
        startAt: start,
        allDay: true,
        recurrenceRule: { freq: "MONTHLY", interval: 1, byMonthDay: Number(wallet.paymentDueDay) },
        color: "#ef4444",
        sourceModule: SOURCE,
        sourceEntityId: wallet.id,
      };
      if (wallet.creditReminderEventId) {
        await prisma.calendarEvent.update({
          where: { id: wallet.creditReminderEventId },
          data: {
            title: payload.title,
            startAt: payload.startAt,
            allDay: true,
            recurrenceRule: payload.recurrenceRule,
          },
        });
        return wallet.creditReminderEventId;
      }
      const event = await prisma.calendarEvent.create({ data: payload });
      await prisma.pfmWallet.update({
        where: { id: wallet.id },
        data: { creditReminderEventId: event.id },
      });
      return event.id;
    } catch (err) {
      console.error("[atlas.pfm] pfm-calendar-bridge syncCreditReminder failed:", err?.message ?? err);
      return null;
    }
  }

  async function deleteCreditReminder(wallet) {
    if (typeof prisma?.calendarEvent?.delete !== "function" || !wallet.creditReminderEventId) return;
    try {
      await prisma.calendarEvent.delete({ where: { id: wallet.creditReminderEventId } });
    } catch {
      // already gone
    }
  }

  return {
    ensureCalendar,
    syncRuleEvent,
    deleteRuleEvent,
    syncCreditReminder,
    deleteCreditReminder,
  };
}
