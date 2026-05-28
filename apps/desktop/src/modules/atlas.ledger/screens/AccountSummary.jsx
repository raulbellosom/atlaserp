// apps/desktop/src/modules/atlas.ledger/screens/AccountSummary.jsx
import { useQuery } from '@tanstack/react-query'
import {
  AreaChart, Area,
  BarChart, Bar,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { Wallet, TrendingUp, ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import { useAuth } from '../../../auth/AuthProvider'

const API_BASE = import.meta.env.VITE_ATLAS_API_URL || 'http://localhost:4010'

const C_INCOME  = '#22c55e'
const C_EXPENSE = '#f43f5e'
const C_BALANCE = '#16a34a'
const C_MUTED   = '#94a3b8'
const C_GRID    = '#f1f5f9'
const C_BORDER  = '#e2e8f0'

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(val, currency = 'MXN') {
  return Number(val ?? 0).toLocaleString('es-MX', {
    style: 'currency', currency, minimumFractionDigits: 2,
  })
}

function fmtCompact(v) {
  return Number(v).toLocaleString('es-MX', { notation: 'compact', maximumFractionDigits: 1 })
}

function fmtDay(dateStr) {
  if (!dateStr) return ''
  const p = String(dateStr).split('-')
  return `${p[2]}/${p[1]}`
}

// ── Shared tooltip shell ──────────────────────────────────────────────────────

function TooltipShell({ children }) {
  return (
    <div style={{
      background: '#fff',
      border: `1px solid ${C_BORDER}`,
      borderRadius: 10,
      padding: '8px 14px',
      boxShadow: '0 4px 24px rgba(0,0,0,.10)',
      fontSize: 12,
      minWidth: 130,
      lineHeight: 1.6,
    }}>
      {children}
    </div>
  )
}

// ── Custom tooltips ───────────────────────────────────────────────────────────

function BalanceTip({ active, payload, label, currency }) {
  if (!active || !payload?.length) return null
  return (
    <TooltipShell>
      <div style={{ color: C_MUTED, marginBottom: 2 }}>{fmtDay(label)}</div>
      <div style={{ color: C_BALANCE, fontWeight: 700 }}>{fmt(payload[0].value, currency)}</div>
    </TooltipShell>
  )
}

function CategoryTip({ active, payload, label, currency }) {
  if (!active || !payload?.length) return null
  return (
    <TooltipShell>
      <div style={{ color: C_MUTED, marginBottom: 4 }}>{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} style={{ color: p.color, fontWeight: 600 }}>
          {p.name}: {fmt(p.value, currency)}
        </div>
      ))}
    </TooltipShell>
  )
}

function PieTip({ active, payload, currency }) {
  if (!active || !payload?.length) return null
  const d = payload[0]
  return (
    <TooltipShell>
      <div style={{ color: d.payload.fill, fontWeight: 700 }}>{d.name}</div>
      <div style={{ color: '#1e293b' }}>{fmt(d.value, currency)}</div>
    </TooltipShell>
  )
}

// ── KPI card ─────────────────────────────────────────────────────────────────

const ACCENTS = {
  green:   'text-green-600 bg-green-50',
  red:     'text-rose-500 bg-rose-50',
  blue:    'text-blue-600 bg-blue-50',
  neutral: 'text-slate-500 bg-slate-100',
}

function KpiCard({ label, value, currency, icon: Icon, accent = 'neutral', valueClass = '' }) {
  return (
    <div className="p-4 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] flex items-center gap-3">
      {Icon && (
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${ACCENTS[accent]}`}>
          <Icon size={18} />
        </div>
      )}
      <div className="min-w-0">
        <div className="text-xs text-[hsl(var(--muted-foreground))] mb-0.5 whitespace-nowrap">{label}</div>
        <div className={`text-sm font-bold font-mono tabular-nums truncate ${valueClass}`}>
          {fmt(value, currency)}
        </div>
      </div>
    </div>
  )
}

// ── Section card ─────────────────────────────────────────────────────────────

function Section({ title, children, aside }) {
  return (
    <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
      <div className="flex items-center gap-2 mb-5">
        <h3 className="text-sm font-semibold text-[hsl(var(--foreground))]">{title}</h3>
        {aside && <div className="ml-auto">{aside}</div>}
      </div>
      {children}
    </div>
  )
}

function Dot({ color }) {
  return <span className="inline-block w-2 h-2 rounded-full" style={{ background: color }} />
}

// ── Custom legend label ───────────────────────────────────────────────────────

function renderLegend(value) {
  return <span style={{ color: '#64748b', fontSize: 11 }}>{value}</span>
}

// ── Main ─────────────────────────────────────────────────────────────────────

export default function AccountSummary({ accountId, currency = 'MXN', dateFrom, dateTo }) {
  const { session } = useAuth()
  const token = session?.access_token ?? null

  const { data, isLoading, isError } = useQuery({
    queryKey: ['ledger-summary', accountId, dateFrom, dateTo],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (dateFrom) params.set('from', dateFrom)
      if (dateTo)   params.set('to', dateTo)
      const res = await fetch(
        `${API_BASE}/ledger/accounts/${accountId}/summary?${params}`,
        { headers: { Authorization: `Bearer ${token}` } },
      )
      if (!res.ok) throw new Error('No se pudo cargar el resumen.')
      return res.json()
    },
    enabled: !!accountId && !!token,
  })

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-[72px] rounded-xl bg-[hsl(var(--muted))] animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2 h-64 rounded-xl bg-[hsl(var(--muted))] animate-pulse" />
          <div className="h-64 rounded-xl bg-[hsl(var(--muted))] animate-pulse" />
        </div>
        <div className="h-48 rounded-xl bg-[hsl(var(--muted))] animate-pulse" />
      </div>
    )
  }

  if (isError) return <div className="p-4 text-sm text-red-500">No se pudo cargar el resumen.</div>

  const { kpis = {}, balance_series = [], by_category = [] } = data ?? {}

  const totalIng = Number(kpis.total_deposito ?? 0)
  const totalEgr = Number(kpis.total_retiro   ?? 0)

  // Area chart data
  const areaData = balance_series.map((r) => ({ fecha: r.fecha, balance: Number(r.balance) }))

  // Donut data (income vs expense)
  const pieData = [
    { name: 'Ingreso', value: totalIng, fill: C_INCOME  },
    { name: 'Egreso',  value: totalEgr, fill: C_EXPENSE },
  ].filter((d) => d.value > 0)

  // Horizontal bar data for categories
  const barData = by_category.map((r) => ({
    categoria: r.category_name,
    Ingreso:   Number(r.deposito),
    Egreso:    Number(r.retiro),
  }))

  const hasData = areaData.length > 1 || barData.length > 0

  const barH = Math.max(180, barData.length * 52 + 32)

  return (
    <div className="p-6 overflow-y-auto h-full space-y-5">

      {/* ── KPIs ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard
          label="Saldo inicial"  value={kpis.opening_balance} currency={currency}
          icon={Wallet}        accent="neutral"
        />
        <KpiCard
          label="Saldo actual"   value={kpis.current_balance} currency={currency}
          icon={TrendingUp}    accent="blue"    valueClass="text-blue-700"
        />
        <KpiCard
          label="Total ingresos" value={kpis.total_deposito}  currency={currency}
          icon={ArrowDownLeft} accent="green"   valueClass="text-green-700"
        />
        <KpiCard
          label="Total egresos"  value={kpis.total_retiro}    currency={currency}
          icon={ArrowUpRight}  accent="red"     valueClass="text-rose-600"
        />
      </div>

      {!hasData && (
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] py-16 text-center text-sm text-[hsl(var(--muted-foreground))]">
          Agrega movimientos para ver estadisticas.
        </div>
      )}

      {/* ── Area + Donut ───────────────────────────────────────────────── */}
      {(areaData.length > 1 || pieData.length > 0) && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">

          {/* Area chart — balance over time */}
          {areaData.length > 1 && (
            <Section
              title="Saldo en el tiempo"
              aside={
                <span className="text-xs font-mono font-bold text-green-700 bg-green-50 px-2.5 py-1 rounded-full">
                  {fmt(kpis.current_balance, currency)}
                </span>
              }
            >
              <div className="lg:col-span-2">
                <ResponsiveContainer width="100%" height={210}>
                  <AreaChart data={areaData} margin={{ top: 4, right: 8, left: 0, bottom: 36 }}>
                    <defs>
                      <linearGradient id="balGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"   stopColor={C_BALANCE} stopOpacity={0.18} />
                        <stop offset="100%" stopColor={C_BALANCE} stopOpacity={0}    />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={C_GRID} vertical={false} />
                    <XAxis
                      dataKey="fecha"
                      tickFormatter={fmtDay}
                      tick={{ fontSize: 10, fill: C_MUTED }}
                      tickLine={false}
                      axisLine={{ stroke: C_BORDER }}
                      angle={-30}
                      textAnchor="end"
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tickFormatter={fmtCompact}
                      tick={{ fontSize: 10, fill: C_MUTED }}
                      tickLine={false}
                      axisLine={false}
                      width={52}
                    />
                    <Tooltip content={<BalanceTip currency={currency} />} />
                    <Area
                      type="monotone"
                      dataKey="balance"
                      stroke={C_BALANCE}
                      strokeWidth={2.5}
                      fill="url(#balGrad)"
                      dot={false}
                      activeDot={{ r: 5, strokeWidth: 0, fill: C_BALANCE }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Section>
          )}

          {/* Donut — income vs expense split */}
          {pieData.length > 0 && (
            <Section title="Distribucion">
              <ResponsiveContainer width="100%" height={210}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="46%"
                    innerRadius={62}
                    outerRadius={88}
                    paddingAngle={3}
                    cornerRadius={5}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  {/* Center label — total flow */}
                  <text x="50%" y="46%" textAnchor="middle" dominantBaseline="middle">
                    <tspan
                      x="50%" dy="-0.55em"
                      style={{ fontSize: 10, fill: C_MUTED }}
                    >
                      Flujo neto
                    </tspan>
                    <tspan
                      x="50%" dy="1.4em"
                      style={{ fontSize: 12, fontWeight: 700, fill: totalIng >= totalEgr ? '#15803d' : '#e11d48', fontFamily: 'monospace' }}
                    >
                      {fmtCompact(totalIng - totalEgr)}
                    </tspan>
                  </text>
                  <Tooltip content={<PieTip currency={currency} />} />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    formatter={renderLegend}
                    wrapperStyle={{ paddingTop: 12 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </Section>
          )}
        </div>
      )}

      {/* ── By category — horizontal grouped bar ───────────────────────── */}
      {barData.length > 0 && (
        <Section
          title="Por categoria"
          aside={
            <div className="flex items-center gap-3 text-xs text-[hsl(var(--muted-foreground))]">
              <span className="flex items-center gap-1.5"><Dot color={C_INCOME} />Ingreso</span>
              <span className="flex items-center gap-1.5"><Dot color={C_EXPENSE} />Egreso</span>
            </div>
          }
        >
          <ResponsiveContainer width="100%" height={barH}>
            <BarChart
              data={barData}
              layout="vertical"
              margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
              barCategoryGap="28%"
              barGap={3}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={C_GRID} horizontal={false} />
              <XAxis
                type="number"
                tickFormatter={fmtCompact}
                tick={{ fontSize: 10, fill: C_MUTED }}
                tickLine={false}
                axisLine={{ stroke: C_BORDER }}
              />
              <YAxis
                type="category"
                dataKey="categoria"
                width={110}
                tick={{ fontSize: 11, fill: '#475569' }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<CategoryTip currency={currency} />} />
              <Bar dataKey="Ingreso" fill={C_INCOME}  radius={[0, 4, 4, 0]} />
              <Bar dataKey="Egreso"  fill={C_EXPENSE} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Section>
      )}

    </div>
  )
}
