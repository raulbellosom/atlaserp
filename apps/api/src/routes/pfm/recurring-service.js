// apps/api/src/routes/pfm/recurring-service.js
import { PfmServiceError, isTableNotFoundError, toPlainNumber } from "./service-helpers.js";
import { computeNextRun, firstRunOnOrAfter } from "./pfm-rrule.js";

const NOT_INSTALLED = "El modulo de finanzas personales no esta instalado.";
const MATERIALIZE_CAP = 24; // safety bound on occurrences created per rule per run

function dayUTC(d) {
  // eslint-disable-next-line no-restricted-syntax -- deliberate UTC: recurrence day math is UTC-anchored
  const s = d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10);
  return new Date(`${s}T00:00:00.000Z`);
}

export function createRecurringService({ prisma, wallets, calendarBridge }) {
  async function assertOwner({ companyId, walletId, actorId }) {
    if (!(await wallets.isWalletOwner({ companyId, walletId, actorId }))) {
      throw new PfmServiceError(
        "Solo el propietario de la cartera gestiona los cargos recurrentes.",
        403,
      );
    }
  }

  function normalizeRule(row) {
    return {
      id: row.id,
      companyId: row.company_id ?? row.companyId,
      ownerId: row.owner_id ?? row.ownerId,
      walletId: row.wallet_id ?? row.walletId,
      label: row.label,
      categoryId: row.category_id ?? row.categoryId ?? null,
      direction: row.direction,
      amountMode: row.amount_mode ?? row.amountMode,
      amount: row.amount == null ? null : toPlainNumber(row.amount),
      rrule: row.rrule,
      autoPost: Boolean(row.auto_post ?? row.autoPost),
      nextRunAt:
        (row.next_run_at ?? row.nextRunAt) instanceof Date
          ? (row.next_run_at ?? row.nextRunAt).toISOString()
          : (row.next_run_at ?? row.nextRunAt),
      endOn: row.end_on ?? row.endOn ?? null,
      calendarEventId: row.calendar_event_id ?? row.calendarEventId ?? null,
      enabled: row.enabled,
    };
  }

  async function listRules({ companyId, actorId }) {
    if (!actorId) throw new PfmServiceError("Se requiere un usuario autenticado.", 401);
    try {
      const rows = await prisma.$queryRaw`
        SELECT r.* FROM pfm_recurring_rule r
        JOIN pfm_wallet w ON w.id = r.wallet_id
        WHERE r.company_id = ${companyId}::uuid
          AND r.enabled = true
          AND w.owner_id = ${actorId}::uuid
        ORDER BY r.next_run_at ASC
      `;
      return { data: rows.map(normalizeRule) };
    } catch (err) {
      if (isTableNotFoundError(err)) throw new PfmServiceError(NOT_INSTALLED, 503);
      throw err;
    }
  }

  async function createRule({ companyId, actorId, data }) {
    await assertOwner({ companyId, walletId: data.walletId, actorId });
    const firstRun = firstRunOnOrAfter(data.rrule, dayUTC(data.startOn));
    if (!firstRun) throw new PfmServiceError("Regla de recurrencia invalida.", 400);
    const rule = await prisma.pfmRecurringRule.create({
      data: {
        companyId,
        ownerId: actorId,
        walletId: data.walletId,
        label: data.label,
        categoryId: data.categoryId ?? null,
        direction: data.direction,
        amountMode: data.amountMode,
        amount: data.amountMode === "FIXED" ? data.amount : (data.amount ?? null),
        rrule: data.rrule,
        autoPost: data.amountMode === "FIXED" ? Boolean(data.autoPost) : false,
        nextRunAt: firstRun,
        endOn: data.endOn ? dayUTC(data.endOn) : null,
      },
    });
    await materializeRule(rule);
    await safeBridge(() => calendarBridge.syncRuleEvent(normalizeRule(rule)));
    const refreshed = await prisma.pfmRecurringRule.findUnique({ where: { id: rule.id } });
    return normalizeRule(refreshed ?? rule);
  }

  async function updateRule({ companyId, actorId, ruleId, data }) {
    const existing = await prisma.pfmRecurringRule.findFirst({
      where: { id: ruleId, companyId, enabled: true },
    });
    if (!existing) throw new PfmServiceError("Regla no encontrada.", 404);
    await assertOwner({ companyId, walletId: existing.walletId, actorId });
    const patch = {};
    for (const k of ["label", "categoryId", "amount", "rrule", "autoPost"]) {
      if (Object.prototype.hasOwnProperty.call(data, k)) patch[k] = data[k];
    }
    if ("endOn" in data) patch.endOn = data.endOn ? dayUTC(data.endOn) : null;
    if (patch.autoPost && existing.amountMode !== "FIXED") patch.autoPost = false;
    const updated = await prisma.pfmRecurringRule.update({ where: { id: ruleId }, data: patch });
    await safeBridge(() => calendarBridge.syncRuleEvent(normalizeRule(updated)));
    return normalizeRule(updated);
  }

  async function setRuleEnabled({ companyId, actorId, ruleId, enabled }) {
    const existing = await prisma.pfmRecurringRule.findFirst({ where: { id: ruleId, companyId } });
    if (!existing) throw new PfmServiceError("Regla no encontrada.", 404);
    await assertOwner({ companyId, walletId: existing.walletId, actorId });
    const updated = await prisma.pfmRecurringRule.update({
      where: { id: ruleId },
      data: { enabled },
    });
    if (!enabled) await safeBridge(() => calendarBridge.deleteRuleEvent(normalizeRule(updated)));
    else await safeBridge(() => calendarBridge.syncRuleEvent(normalizeRule(updated)));
    return { id: ruleId, enabled };
  }

  // Create the PENDING/POSTED movements for one rule up to `horizon`.
  async function materializeRule(ruleRow, { now = new Date(), horizonDays = 45 } = {}) {
    const rule = ruleRow.company_id ? ruleRow : toRow(ruleRow);
    const horizon = new Date(dayUTC(now).getTime() + horizonDays * 86400000);
    let cursor = dayUTC(rule.next_run_at);
    let created = 0;
    let guard = 0;
    while (cursor.getTime() <= horizon.getTime() && guard < MATERIALIZE_CAP) {
      guard += 1;
      if (rule.end_on && cursor.getTime() > dayUTC(rule.end_on).getTime()) {
        await prisma.pfmRecurringRule.update({
          where: { id: rule.id },
          data: { enabled: false },
        });
        return created;
      }
      const isAutoPost = rule.amount_mode === "FIXED" && rule.auto_post === true;
      try {
        await prisma.pfmMovement.create({
          data: {
            companyId: rule.company_id,
            ownerId: rule.owner_id,
            walletId: rule.wallet_id,
            categoryId: rule.category_id ?? null,
            direction: rule.direction,
            amount: rule.amount != null ? rule.amount : 0,
            occurredOn: cursor,
            status: isAutoPost ? "POSTED" : "PENDING",
            recurringRuleId: rule.id,
            merchant: rule.label,
          },
        });
        created += 1;
      } catch (err) {
        // 23505 = the partial unique guard already has this (rule, day) — skip.
        const code = err?.code ?? err?.meta?.code ?? "";
        if (
          !(
            String(code).includes("23505") ||
            String(err?.message ?? "").includes("duplicate key")
          )
        ) {
          throw err;
        }
      }
      const next = computeNextRun(rule.rrule, cursor);
      if (!next) break;
      cursor = dayUTC(next);
      await prisma.pfmRecurringRule.update({
        where: { id: rule.id },
        data: { nextRunAt: cursor },
      });
    }
    return created;
  }

  function toRow(normalized) {
    return {
      id: normalized.id,
      company_id: normalized.companyId,
      owner_id: normalized.ownerId,
      wallet_id: normalized.walletId,
      category_id: normalized.categoryId,
      direction: normalized.direction,
      amount_mode: normalized.amountMode,
      amount: normalized.amount,
      auto_post: normalized.autoPost,
      rrule: normalized.rrule,
      next_run_at: normalized.nextRunAt,
      end_on: normalized.endOn,
    };
  }

  // Worker entrypoint.
  async function materializeDueRules({ now = new Date(), horizonDays = 45 } = {}) {
    let dueRules;
    try {
      dueRules = await prisma.$queryRaw`
        SELECT * FROM pfm_recurring_rule
        WHERE enabled = true
          AND next_run_at <= ${new Date(dayUTC(now).getTime() + horizonDays * 86400000)}
        ORDER BY next_run_at ASC
        LIMIT 500
      `;
    } catch (err) {
      if (isTableNotFoundError(err)) return { processed: 0, created: 0 };
      throw err;
    }
    let created = 0;
    for (const rule of dueRules) {
      try {
        created += await materializeRule(rule, { now, horizonDays });
      } catch (err) {
        console.error("[atlas.pfm] materializeRule failed", rule.id, err?.message ?? err);
      }
    }
    return { processed: dueRules.length, created };
  }

  async function safeBridge(fn) {
    try {
      await fn();
    } catch (err) {
      console.error("[atlas.pfm] calendar bridge failed", err?.message ?? err);
    }
  }

  return {
    listRules,
    createRule,
    updateRule,
    setRuleEnabled,
    materializeRule,
    materializeDueRules,
  };
}
