// modules/custom/custom.financia/components/AccountScreen.jsx
import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@atlas/ui'
import { toast } from 'sonner'
import { FileText, Table, Download, Upload, ArrowLeft } from 'lucide-react'
import SpreadsheetRegister from './SpreadsheetRegister.jsx'
import AccountSummary from './AccountSummary.jsx'
import { useAuth } from '../../../../apps/desktop/src/auth/AuthProvider'

const API_BASE = import.meta.env.VITE_ATLAS_API_URL || 'http://localhost:4010'

const TABS = [
  { key: 'registro', label: 'Registro' },
  { key: 'resumen',  label: 'Resumen'  },
]

function fmtCurrency(amount, currency = 'MXN') {
  return Number(amount ?? 0).toLocaleString('es-MX', {
    style: 'currency', currency, minimumFractionDigits: 2,
  })
}

export default function AccountScreen() {
  // The route is a wildcard (*) so named params like :id are not extracted.
  // Wildcard for /accounts/UUID → "accounts/UUID" → split[1] = UUID.
  const { "*": wildcard } = useParams()
  const accountId = useMemo(() => wildcard?.split('/')[1] ?? null, [wildcard])
  const navigate = useNavigate()
  const { session } = useAuth()
  const token = session?.access_token ?? null

  const [activeTab, setActiveTab] = useState('registro')
  const [dateFrom, setDateFrom]   = useState('')
  const [dateTo, setDateTo]       = useState('')

  const { data: accountData, isLoading: accountLoading } = useQuery({
    queryKey: ['financia-account', accountId],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/financia/accounts/${accountId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('No se pudo cargar la cuenta.')
      return res.json()
    },
    enabled: !!accountId && !!token,
  })

  const { data: typesData } = useQuery({
    queryKey: ['financia-types'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/financia/types`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) return { data: [] }
      return res.json()
    },
    enabled: !!token,
  })

  const { data: categoriesData } = useQuery({
    queryKey: ['financia-categories'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/financia/categories`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) return { data: [] }
      return res.json()
    },
    enabled: !!token,
  })

  const account    = accountData?.data ?? null
  const types      = typesData?.data ?? []
  const categories = categoriesData?.data ?? []

  async function handleExport(format) {
    const params = new URLSearchParams()
    if (dateFrom) params.set('from', dateFrom)
    if (dateTo)   params.set('to', dateTo)
    const url = `${API_BASE}/financia/accounts/${accountId}/export/${format}?${params}`
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) { toast.error('No se pudo exportar el archivo.'); return }
      const blob = await res.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `financia-${Date.now()}.${format}`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(a.href)
    } catch {
      toast.error('No se pudo exportar el archivo.')
    }
  }

  return (
    <div className="flex flex-col h-full">

      {/* ── Page header ──────────────────────────────────────────────── */}
      <div className="px-6 pt-5 pb-4 border-b border-[hsl(var(--border))] flex items-start gap-4 justify-between shrink-0">
        <div className="min-w-0 flex-1">
          {/* Breadcrumb / eyebrow */}
          <button
            onClick={() => navigate('/app/m/custom.financia/accounts')}
            className="flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] mb-1.5 transition-colors"
          >
            <ArrowLeft size={11} />
            Cuentas bancarias
          </button>

          {/* Account name — skeleton while loading */}
          {accountLoading ? (
            <div className="space-y-1.5">
              <div className="h-7 w-44 rounded-lg bg-[hsl(var(--muted))] animate-pulse" />
              <div className="h-4 w-56 rounded bg-[hsl(var(--muted))] animate-pulse opacity-70" />
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold tracking-tight text-[hsl(var(--foreground))] truncate">
                {account?.name ?? 'Cuenta'}
              </h1>
              {account && (
                <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">
                  {account.bank}
                  <span className="mx-1.5 opacity-40">·</span>
                  {account.currency}
                  <span className="mx-1.5 opacity-40">·</span>
                  <span
                    className="font-semibold tabular-nums"
                    style={{ color: 'var(--module-accent, #16a34a)' }}
                  >
                    {fmtCurrency(account.current_balance, account.currency)}
                  </span>
                </p>
              )}
            </>
          )}
        </div>

        {/* Export / import actions — only shown in Registro tab */}
        {activeTab === 'registro' && (
          <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
            <Button variant="outline" size="sm" onClick={() => handleExport('pdf')}>
              <FileText size={12} />
              PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleExport('xlsx')}>
              <Table size={12} />
              Excel
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleExport('csv')}>
              <Download size={12} />
              CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/app/m/custom.financia/accounts/${accountId}/import`)}
            >
              <Upload size={12} />
              Importar
            </Button>
          </div>
        )}
      </div>

      {/* ── Tabs + date range filter ─────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-6 shrink-0">
        <div className="flex">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-(--module-accent,#16a34a) text-[hsl(var(--foreground))]'
                  : 'border-transparent text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Date range — only in Registro */}
        {activeTab === 'registro' && (
          <div className="flex items-center gap-2 py-2">
            <input
              type="date"
              className="text-xs border border-[hsl(var(--border))] rounded-md px-2 py-1 bg-[hsl(var(--background))] text-[hsl(var(--foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              title="Desde"
            />
            <span className="text-xs text-[hsl(var(--muted-foreground))]">—</span>
            <input
              type="date"
              className="text-xs border border-[hsl(var(--border))] rounded-md px-2 py-1 bg-[hsl(var(--background))] text-[hsl(var(--foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              title="Hasta"
            />
            {(dateFrom || dateTo) && (
              <button
                onClick={() => { setDateFrom(''); setDateTo('') }}
                className="text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
                title="Limpiar filtro"
              >
                ×
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Tab content ──────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'registro' && (
          <SpreadsheetRegister
            accountId={accountId}
            dateFrom={dateFrom || undefined}
            dateTo={dateTo || undefined}
            types={types}
            categories={categories}
          />
        )}
        {activeTab === 'resumen' && (
          <AccountSummary
            accountId={accountId}
            currency={account?.currency ?? 'MXN'}
            dateFrom={dateFrom || undefined}
            dateTo={dateTo || undefined}
          />
        )}
      </div>
    </div>
  )
}
