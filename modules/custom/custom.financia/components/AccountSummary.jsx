// modules/custom/custom.financia/components/AccountSummary.jsx
import { useQuery } from '@tanstack/react-query'
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { useAuth } from '../../../../apps/desktop/src/auth/AuthProvider'

const API_BASE = import.meta.env.VITE_ATLAS_API_URL || 'http://localhost:4010'

function KpiCard({ label, value, currency }) {
  const formatted = Number(value ?? 0).toLocaleString('es-MX', {
    style: 'currency', currency: currency ?? 'MXN', minimumFractionDigits: 2,
  })
  return (
    <div className="p-4 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
      <div className="text-xs text-[hsl(var(--muted-foreground))] mb-1">{label}</div>
      <div className="text-lg font-semibold font-mono">{formatted}</div>
    </div>
  )
}

function fmtShortDate(dateStr) {
  if (!dateStr) return ''
  const [, month, day] = String(dateStr).split('-')
  return `${day}/${month}`
}

export default function AccountSummary({ accountId, currency = 'MXN', dateFrom, dateTo }) {
  const { session } = useAuth()
  const token = session?.access_token ?? null

  const { data, isLoading, isError } = useQuery({
    queryKey: ['financia-summary', accountId, dateFrom, dateTo],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (dateFrom) params.set('from', dateFrom)
      if (dateTo)   params.set('to', dateTo)
      const res = await fetch(
        `${API_BASE}/financia/accounts/${accountId}/summary?${params}`,
        { headers: { Authorization: `Bearer ${token}` } },
      )
      if (!res.ok) throw new Error('No se pudo cargar el resumen.')
      return res.json()
    },
    enabled: !!accountId && !!token,
  })

  if (isLoading) {
    return (
      <div className="p-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-20 rounded-xl bg-[hsl(var(--muted))] animate-pulse" />
        ))}
      </div>
    )
  }

  if (isError) return <div className="p-4 text-sm text-red-500">No se pudo cargar el resumen.</div>

  const { kpis = {}, balance_series = [], by_category = [] } = data ?? {}

  return (
    <div className="p-6 space-y-8">
      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Saldo inicial"   value={kpis.opening_balance} currency={currency} />
        <KpiCard label="Saldo actual"    value={kpis.current_balance} currency={currency} />
        <KpiCard label="Total ingresos" value={kpis.total_deposito}  currency={currency} />
        <KpiCard label="Total egresos"  value={kpis.total_retiro}    currency={currency} />
      </div>

      {/* Balance over time */}
      {balance_series.length > 1 && (
        <div>
          <h3 className="text-sm font-semibold mb-3 text-[hsl(var(--foreground))]">Saldo en el tiempo</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={balance_series} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="fecha"
                tickFormatter={fmtShortDate}
                tick={{ fontSize: 11 }}
                stroke="hsl(var(--muted-foreground))"
              />
              <YAxis
                tick={{ fontSize: 11 }}
                stroke="hsl(var(--muted-foreground))"
                tickFormatter={(v) => v.toLocaleString('es-MX', { notation: 'compact' })}
              />
              <Tooltip
                formatter={(v) => [
                  Number(v).toLocaleString('es-MX', { style: 'currency', currency, minimumFractionDigits: 2 }),
                  'Saldo',
                ]}
                labelFormatter={fmtShortDate}
              />
              <Line
                type="monotone"
                dataKey="balance"
                stroke="var(--module-accent, #2563EB)"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* By category */}
      {by_category.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-3 text-[hsl(var(--foreground))]">Por categoria</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={by_category}
              margin={{ top: 4, right: 16, left: 0, bottom: 40 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="category_name"
                tick={{ fontSize: 10 }}
                angle={-30}
                textAnchor="end"
                interval={0}
                stroke="hsl(var(--muted-foreground))"
              />
              <YAxis
                tick={{ fontSize: 11 }}
                stroke="hsl(var(--muted-foreground))"
                tickFormatter={(v) => v.toLocaleString('es-MX', { notation: 'compact' })}
              />
              <Tooltip
                formatter={(v, name) => [
                  Number(v).toLocaleString('es-MX', { style: 'currency', currency, minimumFractionDigits: 2 }),
                  name === 'deposito' ? 'Ingreso' : 'Egreso',
                ]}
              />
              <Legend formatter={(v) => (v === 'deposito' ? 'Ingreso' : 'Egreso')} />
              <Bar dataKey="deposito" name="deposito" fill="#22C55E" radius={[3, 3, 0, 0]} />
              <Bar dataKey="retiro"   name="retiro"   fill="#EF4444" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {balance_series.length <= 1 && by_category.length === 0 && (
        <div className="text-center py-10 text-sm text-[hsl(var(--muted-foreground))]">
          Agrega movimientos para ver estadisticas.
        </div>
      )}
    </div>
  )
}
