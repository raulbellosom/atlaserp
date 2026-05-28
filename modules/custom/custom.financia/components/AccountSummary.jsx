// modules/custom/custom.financia/components/AccountSummary.jsx
import { useQuery } from '@tanstack/react-query'
import { ResponsiveLine } from '@nivo/line'
import { ResponsiveBar }  from '@nivo/bar'
import { ResponsivePie }  from '@nivo/pie'
import { Wallet, TrendingUp, ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import { useAuth } from '../../../../apps/desktop/src/auth/AuthProvider'

const API_BASE = import.meta.env.VITE_ATLAS_API_URL || 'http://localhost:4010'

// ── Nivo shared theme ────────────────────────────────────────────────────────
// Uses neutral colors that read well in both light and dark contexts.
const THEME = {
  text: { fontSize: 11, fill: '#94a3b8' },
  axis: {
    domain: { line: { stroke: '#e2e8f0', strokeWidth: 1 } },
    ticks: {
      line: { stroke: '#e2e8f0', strokeWidth: 1 },
      text: { fill: '#94a3b8', fontSize: 10 },
    },
  },
  grid: { line: { stroke: '#f1f5f9', strokeWidth: 1 } },
  legends: { text: { fill: '#64748b', fontSize: 11 } },
  tooltip: {
    container: {
      background: '#ffffff',
      color: '#1e293b',
      fontSize: 12,
      borderRadius: 10,
      boxShadow: '0 4px 24px rgba(0,0,0,.10)',
      padding: '8px 14px',
      border: '1px solid #e2e8f0',
    },
  },
}

const COLOR_INCOME  = '#22c55e'
const COLOR_EXPENSE = '#f43f5e'
const COLOR_BALANCE = '#16a34a'

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtCurrency(val, currency = 'MXN') {
  return Number(val ?? 0).toLocaleString('es-MX', {
    style: 'currency', currency, minimumFractionDigits: 2,
  })
}

function fmtShort(dateStr) {
  if (!dateStr) return ''
  const parts = String(dateStr).split('-')
  return `${parts[2]}/${parts[1]}`
}

function fmtCompact(v) {
  return Number(v).toLocaleString('es-MX', { notation: 'compact', maximumFractionDigits: 1 })
}

// ── Tooltip primitives ───────────────────────────────────────────────────────

function Tip({ label, value, color }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '8px 14px', boxShadow: '0 4px 24px rgba(0,0,0,.10)', fontSize: 12, minWidth: 140 }}>
      {label && <div style={{ color: '#94a3b8', marginBottom: 2 }}>{label}</div>}
      <div style={{ color: color ?? '#1e293b', fontWeight: 600 }}>{value}</div>
    </div>
  )
}

// ── KPI card ─────────────────────────────────────────────────────────────────

const ACCENTS = {
  green:   { icon: 'text-green-600 bg-green-50',  value: 'text-green-700'  },
  red:     { icon: 'text-rose-500  bg-rose-50',   value: 'text-rose-600'   },
  blue:    { icon: 'text-blue-600  bg-blue-50',   value: 'text-blue-700'   },
  neutral: { icon: 'text-slate-500 bg-slate-100', value: ''                },
}

function KpiCard({ label, value, currency, icon: Icon, accent = 'neutral' }) {
  const a = ACCENTS[accent] ?? ACCENTS.neutral
  return (
    <div className="p-4 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] flex items-center gap-3">
      {Icon && (
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${a.icon}`}>
          <Icon size={18} />
        </div>
      )}
      <div className="min-w-0">
        <div className="text-xs text-[hsl(var(--muted-foreground))] mb-0.5 whitespace-nowrap">{label}</div>
        <div className={`text-sm font-bold font-mono tabular-nums truncate ${a.value}`}>
          {fmtCurrency(value, currency)}
        </div>
      </div>
    </div>
  )
}

// ── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, children, badge }) {
  return (
    <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
      <div className="flex items-center gap-2 mb-4">
        <h3 className="text-sm font-semibold text-[hsl(var(--foreground))]">{title}</h3>
        {badge}
      </div>
      {children}
    </div>
  )
}

function ColorDot({ color }) {
  return <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
}

// ── Main component ───────────────────────────────────────────────────────────

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

  // ── Data transforms ──────────────────────────────────────────────────────

  const lineData = balance_series.length > 1 ? [{
    id: 'Saldo',
    color: COLOR_BALANCE,
    data: balance_series.map((r) => ({ x: r.fecha, y: Number(r.balance) })),
  }] : null

  const totalIng = Number(kpis.total_deposito ?? 0)
  const totalEgr = Number(kpis.total_retiro   ?? 0)
  const pieData  = (totalIng > 0 || totalEgr > 0) ? [
    { id: 'Ingreso', label: 'Ingreso', value: totalIng, color: COLOR_INCOME  },
    { id: 'Egreso',  label: 'Egreso',  value: totalEgr, color: COLOR_EXPENSE },
  ] : null

  // Horizontal bar: one row per category
  const barData = by_category.map((r) => ({
    categoria: r.category_name,
    Ingreso:   Number(r.deposito),
    Egreso:    Number(r.retiro),
  }))

  const hasAnyChart = lineData || pieData || barData.length > 0

  return (
    <div className="p-6 overflow-y-auto h-full space-y-5">

      {/* ── KPI cards ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Saldo inicial"  value={kpis.opening_balance} currency={currency} icon={Wallet}        accent="neutral" />
        <KpiCard label="Saldo actual"   value={kpis.current_balance} currency={currency} icon={TrendingUp}    accent="blue"    />
        <KpiCard label="Total ingresos" value={kpis.total_deposito}  currency={currency} icon={ArrowDownLeft} accent="green"   />
        <KpiCard label="Total egresos"  value={kpis.total_retiro}    currency={currency} icon={ArrowUpRight}  accent="red"     />
      </div>

      {!hasAnyChart && (
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] py-16 text-center text-sm text-[hsl(var(--muted-foreground))]">
          Agrega movimientos para ver estadisticas.
        </div>
      )}

      {/* ── Saldo en el tiempo + Distribucion ──────────────────────────── */}
      {(lineData || pieData) && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">

          {/* Area chart */}
          {lineData && (
            <Section title="Saldo en el tiempo" badge={
              <span className="ml-auto text-xs font-mono font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                {fmtCurrency(kpis.current_balance, currency)}
              </span>
            }>
              <div className="lg:col-span-2" style={{ height: 200 }}>
                <ResponsiveLine
                  data={lineData}
                  theme={THEME}
                  margin={{ top: 8, right: 16, bottom: 42, left: 64 }}
                  xScale={{ type: 'point' }}
                  yScale={{ type: 'linear', nice: true }}
                  curve="monotoneX"
                  axisBottom={{
                    tickSize: 0,
                    tickPadding: 8,
                    format: fmtShort,
                    tickRotation: -30,
                  }}
                  axisLeft={{
                    tickSize: 0,
                    tickPadding: 8,
                    format: fmtCompact,
                  }}
                  enableGridX={false}
                  enableArea
                  areaOpacity={0.12}
                  enablePoints={balance_series.length <= 10}
                  pointSize={6}
                  pointColor={{ theme: 'background' }}
                  pointBorderWidth={2}
                  pointBorderColor={COLOR_BALANCE}
                  colors={[COLOR_BALANCE]}
                  lineWidth={2.5}
                  enableCrosshair
                  useMesh
                  tooltip={({ point }) => (
                    <Tip
                      label={fmtShort(String(point.data.x))}
                      value={fmtCurrency(point.data.y, currency)}
                      color={COLOR_BALANCE}
                    />
                  )}
                />
              </div>
            </Section>
          )}

          {/* Donut */}
          {pieData && (
            <Section title="Distribucion">
              <div style={{ height: 200 }}>
                <ResponsivePie
                  data={pieData}
                  theme={THEME}
                  margin={{ top: 8, right: 8, bottom: 48, left: 8 }}
                  innerRadius={0.62}
                  padAngle={2.5}
                  cornerRadius={5}
                  colors={{ datum: 'data.color' }}
                  enableArcLabels={false}
                  arcLinkLabelsSkipAngle={12}
                  arcLinkLabelsDiagonalLength={10}
                  arcLinkLabelsStraightLength={12}
                  arcLinkLabelsTextColor="#94a3b8"
                  arcLinkLabelsColor={{ from: 'color' }}
                  arcLinkLabelsThickness={1.5}
                  legends={[{
                    anchor: 'bottom',
                    direction: 'row',
                    translateY: 44,
                    itemWidth: 76,
                    itemHeight: 18,
                    symbolSize: 10,
                    symbolShape: 'circle',
                    itemTextColor: '#64748b',
                  }]}
                  tooltip={({ datum }) => (
                    <Tip
                      label={datum.label}
                      value={fmtCurrency(datum.value, currency)}
                      color={datum.color}
                    />
                  )}
                />
              </div>
            </Section>
          )}
        </div>
      )}

      {/* ── Por categoria ───────────────────────────────────────────────── */}
      {barData.length > 0 && (
        <Section
          title="Por categoria"
          badge={
            <div className="ml-auto flex items-center gap-3 text-xs text-[hsl(var(--muted-foreground))]">
              <span className="flex items-center gap-1.5"><ColorDot color={COLOR_INCOME} />Ingreso</span>
              <span className="flex items-center gap-1.5"><ColorDot color={COLOR_EXPENSE} />Egreso</span>
            </div>
          }
        >
          <div style={{ height: Math.max(180, barData.length * 52 + 24) }}>
            <ResponsiveBar
              data={barData}
              keys={['Ingreso', 'Egreso']}
              indexBy="categoria"
              theme={THEME}
              margin={{ top: 4, right: 16, bottom: 16, left: 124 }}
              layout="horizontal"
              groupMode="grouped"
              colors={[COLOR_INCOME, COLOR_EXPENSE]}
              borderRadius={4}
              padding={0.28}
              innerPadding={3}
              axisLeft={{
                tickSize: 0,
                tickPadding: 10,
              }}
              axisBottom={null}
              enableGridY={false}
              enableLabel={false}
              tooltip={({ id, value, indexValue }) => (
                <Tip
                  label={`${indexValue} · ${id}`}
                  value={fmtCurrency(value, currency)}
                  color={id === 'Ingreso' ? COLOR_INCOME : COLOR_EXPENSE}
                />
              )}
            />
          </div>
        </Section>
      )}

    </div>
  )
}
