// apps/api/src/routes/pfm/summary-service.js
import { toLocalIso } from "@atlas/core";
import { PfmServiceError, isTableNotFoundError, toPlainNumber } from "./service-helpers.js";

const NOT_INSTALLED = "El modulo de finanzas personales no esta instalado.";

// Scope: native movements in wallets the actor owns or is a member of.
// (Phase 1 keeps ledger-mirror wallets out of the aggregate; folded in Phase 2
// alongside the unified movement stream.)
export function createSummaryService({ prisma }) {
  async function getOverview({ companyId, actorId, month }) {
    if (!actorId) throw new PfmServiceError("Se requiere un usuario autenticado.", 401);
    const monthStart = `${month}-01`;
    try {
      const balanceRows = await prisma.$queryRaw`
        SELECT
          COALESCE(SUM(bal), 0) AS total_balance,
          COALESCE(SUM(bal) FILTER (WHERE kind IN ('CASH','DEBIT')), 0) AS spendable,
          COALESCE(SUM(GREATEST(0, -bal)) FILTER (WHERE kind = 'CREDIT'), 0) AS credit_debt,
          COALESCE(SUM(bal) FILTER (WHERE kind = 'INVESTMENT'), 0) AS investments
        FROM (
          SELECT w.kind,
            w.opening_balance + COALESCE(SUM(m.amount * CASE WHEN m.direction = 'INCOME' THEN 1 ELSE -1 END)
            FILTER (WHERE m.enabled = true AND m.status = 'POSTED'), 0) AS bal
          FROM pfm_wallet w
          LEFT JOIN pfm_movement m ON m.wallet_id = w.id
          WHERE w.company_id = ${companyId}::uuid AND w.enabled = true
            AND (w.owner_id = ${actorId}::uuid
                 OR EXISTS (SELECT 1 FROM pfm_wallet_member wm WHERE wm.wallet_id = w.id AND wm.user_id = ${actorId}::uuid))
          GROUP BY w.id
        ) s
      `;

      const totalsRows = await prisma.$queryRaw`
        SELECT
          COALESCE(SUM(m.amount) FILTER (WHERE m.direction = 'EXPENSE'
            AND m.is_adjustment = false
            AND m.occurred_on >= ${monthStart}::date
            AND m.occurred_on < (${monthStart}::date + INTERVAL '1 month')), 0) AS month_expense,
          COALESCE(SUM(m.amount) FILTER (WHERE m.direction = 'INCOME'
            AND m.is_adjustment = false
            AND m.occurred_on >= ${monthStart}::date
            AND m.occurred_on < (${monthStart}::date + INTERVAL '1 month')), 0) AS month_income,
          COALESCE(SUM(m.amount) FILTER (WHERE m.direction = 'EXPENSE'
            AND m.is_adjustment = false
            AND m.occurred_on >= (${monthStart}::date - INTERVAL '1 month')
            AND m.occurred_on < ${monthStart}::date), 0) AS prev_expense
        FROM pfm_movement m
        JOIN pfm_wallet w ON w.id = m.wallet_id
        WHERE m.company_id = ${companyId}::uuid AND m.enabled = true AND m.status = 'POSTED'
          AND (w.owner_id = ${actorId}::uuid
               OR EXISTS (SELECT 1 FROM pfm_wallet_member wm WHERE wm.wallet_id = w.id AND wm.user_id = ${actorId}::uuid))
      `;

      const byCategoryRows = await prisma.$queryRaw`
        SELECT m.category_id AS category_id, c.name AS name, c.color AS color, SUM(m.amount) AS total
        FROM pfm_movement m
        JOIN pfm_wallet w ON w.id = m.wallet_id
        LEFT JOIN pfm_category c ON c.id = m.category_id
        WHERE m.company_id = ${companyId}::uuid AND m.enabled = true AND m.status = 'POSTED'
          AND m.direction = 'EXPENSE'
          AND m.is_adjustment = false
          AND m.occurred_on >= ${monthStart}::date
          AND m.occurred_on < (${monthStart}::date + INTERVAL '1 month')
          AND (w.owner_id = ${actorId}::uuid
               OR EXISTS (SELECT 1 FROM pfm_wallet_member wm WHERE wm.wallet_id = w.id AND wm.user_id = ${actorId}::uuid))
        GROUP BY c.id, m.category_id, c.name, c.color
        ORDER BY total DESC
      `;

      const trendRows = await prisma.$queryRaw`
        WITH series AS (
          SELECT to_char(date_trunc('month', d), 'YYYY-MM') AS month
          FROM generate_series(${monthStart}::date - INTERVAL '5 months', ${monthStart}::date, INTERVAL '1 month') d
        )
        SELECT s.month,
          COALESCE(SUM(m.amount) FILTER (WHERE m.direction = 'EXPENSE'), 0) AS expense,
          COALESCE(SUM(m.amount) FILTER (WHERE m.direction = 'INCOME'), 0) AS income
        FROM series s
        LEFT JOIN pfm_movement m
          ON to_char(m.occurred_on, 'YYYY-MM') = s.month
          AND m.company_id = ${companyId}::uuid AND m.enabled = true AND m.status = 'POSTED'
          AND m.is_adjustment = false
        LEFT JOIN pfm_wallet w ON w.id = m.wallet_id
          AND (w.owner_id = ${actorId}::uuid
               OR EXISTS (SELECT 1 FROM pfm_wallet_member wm WHERE wm.wallet_id = w.id AND wm.user_id = ${actorId}::uuid))
        GROUP BY s.month
        ORDER BY s.month
      `;

      const totals = totalsRows[0] ?? {};
      const bal = balanceRows[0] ?? {};
      return {
        month,
        totalBalance: toPlainNumber(bal.total_balance),
        spendable: toPlainNumber(bal.spendable),
        creditDebt: toPlainNumber(bal.credit_debt),
        investments: toPlainNumber(bal.investments),
        monthExpense: toPlainNumber(totals.month_expense),
        monthIncome: toPlainNumber(totals.month_income),
        prevMonthExpense: toPlainNumber(totals.prev_expense),
        byCategory: byCategoryRows.map((r) => ({
          categoryId: r.category_id ?? null,
          name: r.name ?? "Sin categoria",
          color: r.color ?? "#9ca3af",
          total: toPlainNumber(r.total),
        })),
        trend: trendRows.map((r) => ({
          month: r.month,
          expense: toPlainNumber(r.expense),
          income: toPlainNumber(r.income),
        })),
      };
    } catch (err) {
      if (isTableNotFoundError(err)) throw new PfmServiceError(NOT_INSTALLED, 503);
      throw err;
    }
  }

  async function getUpcoming({ companyId, actorId, days = 14 }) {
    if (!actorId) throw new PfmServiceError("Se requiere un usuario autenticado.", 401);
    const horizon = toLocalIso(new Date(Date.now() + days * 86400000));
    try {
      const rows = await prisma.$queryRaw`
        SELECT m.id, m.wallet_id, w.name AS wallet_name, w.currency,
               m.direction, m.amount, m.occurred_on, m.merchant, m.status,
               m.recurring_rule_id, c.name AS category_name, c.color AS category_color
        FROM pfm_movement m
        JOIN pfm_wallet w ON w.id = m.wallet_id
        LEFT JOIN pfm_category c ON c.id = m.category_id
        WHERE m.company_id = ${companyId}::uuid
          AND m.enabled = true
          AND m.status = 'PENDING'
          AND m.occurred_on <= ${horizon}::date
          AND (w.owner_id = ${actorId}::uuid
               OR EXISTS (SELECT 1 FROM pfm_wallet_member wm WHERE wm.wallet_id = w.id AND wm.user_id = ${actorId}::uuid))
        ORDER BY m.occurred_on ASC
        LIMIT 100
      `;
      return {
        data: rows.map((r) => ({
          id: r.id,
          walletId: r.wallet_id,
          walletName: r.wallet_name,
          currency: r.currency,
          direction: r.direction,
          amount: toPlainNumber(r.amount),
          occurredOn: (r.occurred_on instanceof Date
            ? r.occurred_on.toISOString()
            : String(r.occurred_on)
          ).slice(0, 10),
          merchant: r.merchant ?? null,
          categoryName: r.category_name ?? null,
          categoryColor: r.category_color ?? null,
          fromRule: Boolean(r.recurring_rule_id),
        })),
      };
    } catch (err) {
      if (isTableNotFoundError(err)) throw new PfmServiceError(NOT_INSTALLED, 503);
      throw err;
    }
  }

  return { getOverview, getUpcoming };
}
