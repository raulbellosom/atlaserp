// modules/custom/custom.financia/components/AccountScreen.jsx
import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { PageHeader, Button } from '@atlas/ui'
import { Upload } from 'lucide-react'
import SpreadsheetRegister from './SpreadsheetRegister.jsx'
import AccountSummary from './AccountSummary.jsx'
import { useAuth } from '../../../../apps/desktop/src/auth/AuthProvider'

const API_BASE = import.meta.env.VITE_ATLAS_API_URL || 'http://localhost:4010'

const TABS = [
  { key: 'registro', label: 'Registro' },
  { key: 'resumen',  label: 'Resumen'  },
]

export default function AccountScreen() {
  const { id: accountId } = useParams()
  const navigate = useNavigate()
  const { session } = useAuth()
  const token = session?.access_token ?? null

  const [activeTab, setActiveTab] = useState('registro')
  const [dateFrom, setDateFrom]   = useState('')
  const [dateTo, setDateTo]       = useState('')

  const { data: accountData } = useQuery({
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

  function buildExportUrl(format) {
    const params = new URLSearchParams()
    if (dateFrom) params.set('from', dateFrom)
    if (dateTo)   params.set('to', dateTo)
    // Export endpoints require auth — pass token as query param since these are direct anchor downloads
    params.set('token', token ?? '')
    return `${API_BASE}/financia/accounts/${accountId}/export/${format}?${params}`
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title={account?.name ?? 'Cuenta'}
        subtitle={account ? `${account.bank} · ${account.currency}` : ''}
        breadcrumb={[
          { label: 'Cuentas', href: '/app/m/custom.financia/accounts' },
          { label: account?.name ?? '...' },
        ]}
        actions={
          activeTab === 'registro' ? (
            <div className="flex items-center gap-2">
              {/* Period filter */}
              <input
                type="date"
                className="text-xs border border-[hsl(var(--border))] rounded-md px-2 py-1.5 bg-[hsl(var(--background))]"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                placeholder="Desde"
              />
              <input
                type="date"
                className="text-xs border border-[hsl(var(--border))] rounded-md px-2 py-1.5 bg-[hsl(var(--background))]"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                placeholder="Hasta"
              />
              <Button variant="ghost" size="sm" asChild>
                <a href={buildExportUrl('pdf')} target="_blank" rel="noreferrer" download>PDF</a>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <a href={buildExportUrl('xlsx')} target="_blank" rel="noreferrer" download>Excel</a>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <a href={buildExportUrl('csv')} target="_blank" rel="noreferrer" download>CSV</a>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(`/app/m/custom.financia/accounts/${accountId}/import`)}
              >
                <Upload size={13} className="mr-1" />
                Importar
              </Button>
            </div>
          ) : null
        }
      />

      {/* Tabs */}
      <div className="flex border-b border-[hsl(var(--border))] px-6">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-[var(--module-accent,#2563EB)] text-[hsl(var(--foreground))]'
                : 'border-transparent text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
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
