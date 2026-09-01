// apps/api/src/routes/pfm/budgets-service.js
import { PfmServiceError, isTableNotFoundError, toPlainNumber } from "./service-helpers.js";

import { toLocalMonth } from "@atlas/core";

const NOT_INSTALLED = "El modulo de finanzas personales no esta instalado.";

function monthStartOf(now = new Date()) {
  return `${toLocalMonth(now)}-01`;
}

export function createBudgetsService({ prisma, notificationService = null }) {
  async function ownedBudget({ companyId, actorId, budgetId }) {
    const b = await prisma.pfmBudget.findFirst({
      where: { id: budgetId, companyId, ownerId: actorId, enabled: true },
    });
    if (!b) throw new PfmServiceError("Presupuesto no encontrado.", 404);
    return b;
  }

  async function createBudget({ companyId, actorId, data }) {
    if (!actorId) throw new PfmServiceError("Se requiere un usuario autenticado.", 401);
    try {
      return await prisma.pfmBudget.create({
        data: {
          companyId,
          ownerId: actorId,
          categoryId: data.categoryId,
          walletId: data.walletId ?? null,
          amount: data.amount,
          alertThreshold: data.alertThreshold ?? 0.8,
        },
      });
    } catch (err) {
      if (isTableNotFoundError(err)) throw new PfmServiceError(NOT_INSTALLED, 503);
      throw err;
    }
  }

  async function listBudgets({ companyId, actorId, month }) {
    if (!actorId) throw new PfmServiceError("Se requiere un usuario autenticado.", 401);
    const start = month ? `${month}-01` : monthStartOf();
    try {
      const rows = await prisma.$queryRaw`
        SELECT b.id, b.category_id, c.name AS category_name, b.wallet_id,
               b.amount, b.alert_threshold,
               COALESCE(SUM(m.amount) FILTER (
                 WHERE m.enabled = true AND m.status = 'POSTED' AND m.direction = 'EXPENSE'
                   AND m.occurred_on >= ${start}::date
                   AND m.occurred_on < (${start}::date + INTERVAL '1 month')
                   AND (b.wallet_id IS NULL OR m.wallet_id = b.wallet_id)
               ), 0) AS spent
        FROM pfm_budget b
        LEFT JOIN pfm_category c ON c.id = b.category_id
        LEFT JOIN pfm_movement m ON m.category_id = b.category_id AND m.company_id = ${companyId}::uuid
        WHERE b.company_id = ${companyId}::uuid AND b.owner_id = ${actorId}::uuid AND b.enabled = true
        GROUP BY b.id, c.name
        ORDER BY c.name
      `;
      return {
        data: rows.map((r) => {
          const amount = toPlainNumber(r.amount);
          const spent = toPlainNumber(r.spent);
          return {
            id: r.id,
            categoryId: r.category_id,
            categoryName: r.category_name ?? "Sin categoria",
            walletId: r.wallet_id ?? null,
            amount,
            spent,
            remaining: amount - spent,
            pct: amount > 0 ? spent / amount : 0,
            alertThreshold: toPlainNumber(r.alert_threshold),
          };
        }),
      };
    } catch (err) {
      if (isTableNotFoundError(err)) throw new PfmServiceError(NOT_INSTALLED, 503);
      throw err;
    }
  }

  async function updateBudget({ companyId, actorId, budgetId, data }) {
    await ownedBudget({ companyId, actorId, budgetId });
    const patch = {};
    if ("amount" in data) patch.amount = data.amount;
    if ("alertThreshold" in data) patch.alertThreshold = data.alertThreshold;
    return prisma.pfmBudget.update({ where: { id: budgetId }, data: patch });
  }

  async function setBudgetEnabled({ companyId, actorId, budgetId, enabled }) {
    await ownedBudget({ companyId, actorId, budgetId });
    await prisma.pfmBudget.update({ where: { id: budgetId }, data: { enabled } });
    return { id: budgetId, enabled };
  }

  // Worker entrypoint. Fires one notification per (budget, month, level); the
  // notification service dedupes on dedupeKey so re-runs are safe.
  async function evaluateBudgets({ now = new Date() } = {}) {
    if (!notificationService) return { evaluated: 0, alerted: 0 };
    const start = monthStartOf(now);
    const monthKey = start.slice(0, 7);
    let rows;
    try {
      rows = await prisma.$queryRaw`
        SELECT b.id, b.owner_id, b.company_id, b.category_id, c.name AS category_name,
               b.amount, b.alert_threshold, b.wallet_id,
               COALESCE(SUM(m.amount) FILTER (
                 WHERE m.enabled = true AND m.status = 'POSTED' AND m.direction = 'EXPENSE'
                   AND m.occurred_on >= ${start}::date
                   AND m.occurred_on < (${start}::date + INTERVAL '1 month')
                   AND (b.wallet_id IS NULL OR m.wallet_id = b.wallet_id)
               ), 0) AS spent
        FROM pfm_budget b
        LEFT JOIN pfm_category c ON c.id = b.category_id
        LEFT JOIN pfm_movement m ON m.category_id = b.category_id AND m.company_id = b.company_id
        WHERE b.enabled = true
        GROUP BY b.id, c.name
      `;
    } catch (err) {
      if (isTableNotFoundError(err)) return { evaluated: 0, alerted: 0 };
      throw err;
    }
    let alerted = 0;
    for (const r of rows) {
      const amount = toPlainNumber(r.amount);
      const spent = toPlainNumber(r.spent);
      if (amount <= 0) continue;
      const pct = spent / amount;
      const threshold = toPlainNumber(r.alert_threshold) || 0.8;
      const level = pct >= 1 ? "overage" : pct >= threshold ? "threshold" : null;
      if (!level) continue;
      const name = r.category_name ?? "una categoria";
      try {
        await notificationService.publish({
          companyId: r.company_id,
          actorId: r.owner_id,
          input: {
            eventType: `pfm.budget.${level}`,
            title:
              level === "overage"
                ? `Rebasaste tu presupuesto de ${name}`
                : `Vas al ${Math.round(pct * 100)}% de tu presupuesto de ${name}`,
            body: `Llevas ${spent.toFixed(2)} de ${amount.toFixed(2)} este mes.`,
            link: "/app/m/atlas.pfm/overview",
            priority: level === "overage" ? "high" : "medium",
            recipients: { userIds: [r.owner_id] },
            dedupeKey: `pfm.budget.${r.id}.${monthKey}.${level}`,
          },
        });
        alerted += 1;
      } catch (err) {
        console.error("[atlas.pfm] budget alert publish failed", r.id, err?.message ?? err);
      }
    }
    return { evaluated: rows.length, alerted };
  }

  return { createBudget, listBudgets, updateBudget, setBudgetEnabled, evaluateBudgets };
}
