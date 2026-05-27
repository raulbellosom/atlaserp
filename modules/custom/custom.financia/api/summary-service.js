import { normalizeOptionalString, firstRow, isTableNotFoundError } from './service-helpers.js'
import { FinanciaServiceError, createFinanciaService } from './financia-service.js'

export function createSummaryService({ prisma }) {
  const financiaService = createFinanciaService({ prisma })

  /**
   * Returns KPI cards + chart data for the AccountScreen Resumen tab.
   * @returns {{ kpis, balance_series, by_category }}
   */
  async function getAccountSummary({ companyId, accountId, dateFrom, dateTo }) {
    const account = await financiaService.getAccount({ companyId, accountId })
    const from = normalizeOptionalString(dateFrom) ?? null
    const to   = normalizeOptionalString(dateTo)   ?? null

    try {
      const openingBalance = Number(account.opening_balance ?? 0)

      // KPIs for the requested period
      const kpiRows = await prisma.$queryRaw`
        SELECT
          COALESCE(SUM(COALESCE(deposito, 0)), 0) AS total_deposito,
          COALESCE(SUM(COALESCE(retiro,   0)), 0) AS total_retiro
        FROM financia_transaction
        WHERE account_id = ${accountId}::uuid
          AND company_id = ${companyId}::uuid
          AND enabled = true
          AND (${from}::date IS NULL OR fecha >= ${from}::date)
          AND (${to}::date   IS NULL OR fecha <= ${to}::date)
      `

      // Current balance (all-time, not period-filtered)
      const balanceRows = await prisma.$queryRaw`
        SELECT
          COALESCE(SUM(COALESCE(deposito,0) - COALESCE(retiro,0)) FILTER (WHERE enabled=true), 0)
          AS net_movement
        FROM financia_transaction
        WHERE account_id = ${accountId}::uuid AND company_id = ${companyId}::uuid
      `

      const kpiRow         = firstRow(kpiRows) ?? {}
      const totalDep       = Number(kpiRow.total_deposito ?? 0)
      const totalRet       = Number(kpiRow.total_retiro   ?? 0)
      const currentBalance = openingBalance + Number(firstRow(balanceRows)?.net_movement ?? 0)

      // Balance series: last saldo_actual per day within period
      const seriesRows = await prisma.$queryRaw`
        WITH ranked AS (
          SELECT
            fecha,
            ${openingBalance} +
              SUM(COALESCE(deposito,0) - COALESCE(retiro,0))
              OVER (
                PARTITION BY account_id ORDER BY fecha, created_at
                ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
              ) AS balance,
            ROW_NUMBER() OVER (PARTITION BY fecha ORDER BY created_at DESC) AS rn
          FROM financia_transaction
          WHERE account_id = ${accountId}::uuid
            AND company_id = ${companyId}::uuid
            AND enabled = true
            AND (${from}::date IS NULL OR fecha >= ${from}::date)
            AND (${to}::date   IS NULL OR fecha <= ${to}::date)
        )
        SELECT fecha, balance FROM ranked WHERE rn = 1
        ORDER BY fecha
      `

      // By category
      const byCategoryRows = await prisma.$queryRaw`
        SELECT
          COALESCE(c.name,  'Sin categoria') AS category_name,
          COALESCE(c.color, '#94A3B8')       AS color,
          COALESCE(SUM(COALESCE(t.deposito, 0)), 0) AS deposito,
          COALESCE(SUM(COALESCE(t.retiro,   0)), 0) AS retiro
        FROM financia_transaction t
        LEFT JOIN financia_category c ON c.id = t.category_id
        WHERE t.account_id = ${accountId}::uuid
          AND t.company_id = ${companyId}::uuid
          AND t.enabled = true
          AND (${from}::date IS NULL OR t.fecha >= ${from}::date)
          AND (${to}::date   IS NULL OR t.fecha <= ${to}::date)
        GROUP BY c.name, c.color
        ORDER BY (deposito + retiro) DESC
      `

      return {
        kpis: {
          opening_balance: openingBalance,
          current_balance: currentBalance,
          total_deposito:  totalDep,
          total_retiro:    totalRet,
          net:             totalDep - totalRet,
        },
        balance_series: seriesRows.map((r) => ({
          fecha:   r.fecha instanceof Date ? r.fecha.toISOString().slice(0, 10) : String(r.fecha).slice(0, 10),
          balance: Number(r.balance),
        })),
        by_category: byCategoryRows.map((r) => ({
          category_name: r.category_name,
          color:         r.color,
          deposito:      Number(r.deposito),
          retiro:        Number(r.retiro),
        })),
      }
    } catch (err) {
      if (err instanceof FinanciaServiceError) throw err
      if (isTableNotFoundError(err)) throw new FinanciaServiceError('El modulo Financia no esta instalado.', 503)
      throw err
    }
  }

  return { getAccountSummary }
}
