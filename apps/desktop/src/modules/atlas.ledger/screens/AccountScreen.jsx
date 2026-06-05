// apps/desktop/src/modules/atlas.ledger/screens/AccountScreen.jsx
import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, UserSearchModal, ConfirmDialog } from '@atlas/ui'
import { toast } from 'sonner'
import { FileText, Table, Download, Upload, ArrowLeft, Users, UserPlus, Trash2, FolderOpen } from 'lucide-react'
import SpreadsheetRegister from './SpreadsheetRegister.jsx'
import AccountSummary from './AccountSummary.jsx'
import { useAuth } from '../../../auth/AuthProvider'

const API_BASE = import.meta.env.VITE_ATLAS_API_URL || 'http://localhost:4010'

const TABS = [
  { key: 'registro', label: 'Registro' },
  { key: 'resumen',  label: 'Resumen'  },
  { key: 'acceso',   label: 'Acceso'   },
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
  const queryClient = useQueryClient()
  const [inviteOpen, setInviteOpen]     = useState(false)
  const [revokeTarget, setRevokeTarget] = useState(null)

  const { data: accountData, isLoading: accountLoading } = useQuery({
    queryKey: ['ledger-account', accountId],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/ledger/accounts/${accountId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('No se pudo cargar la cuenta.')
      return res.json()
    },
    enabled: !!accountId && !!token,
  })

  const { data: typesData } = useQuery({
    queryKey: ['ledger-types'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/ledger/types`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) return { data: [] }
      return res.json()
    },
    enabled: !!token,
  })

  const { data: categoriesData } = useQuery({
    queryKey: ['ledger-categories'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/ledger/categories`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) return { data: [] }
      return res.json()
    },
    enabled: !!token,
  })

  const { data: membersData, refetch: refetchMembers } = useQuery({
    queryKey: ['ledger-account-members', accountId],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/ledger/accounts/${accountId}/members`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) return { data: [] }
      return res.json()
    },
    enabled: !!accountId && !!token && activeTab === 'acceso',
  })

  const members  = membersData?.data ?? []
  const account    = accountData?.data ?? null
  const isOwner  = !!account?.owner_id
  const types      = typesData?.data ?? []
  const categories = categoriesData?.data ?? []

  async function handleExport(format) {
    const params = new URLSearchParams()
    if (dateFrom) params.set('from', dateFrom)
    if (dateTo)   params.set('to', dateTo)
    const url = `${API_BASE}/ledger/accounts/${accountId}/export/${format}?${params}`
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) { toast.error('No se pudo exportar el archivo.'); return }
      const blob = await res.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `ledger-${Date.now()}.${format}`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(a.href)
    } catch {
      toast.error('No se pudo exportar el archivo.')
    }
  }

  async function handleInvite(userId, role) {
    const res = await fetch(`${API_BASE}/ledger/accounts/${accountId}/members`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, role }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      toast.error(err.error ?? 'No se pudo invitar al colaborador.')
      return
    }
    toast.success('Colaborador invitado.')
    refetchMembers()
  }

  async function handleRevoke(targetUserId) {
    const res = await fetch(`${API_BASE}/ledger/accounts/${accountId}/members/${targetUserId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) { toast.error('No se pudo remover al colaborador.'); return }
    toast.success('Acceso revocado.')
    setRevokeTarget(null)
    refetchMembers()
  }

  async function handleMoveGroup(groupId) {
    const res = await fetch(`${API_BASE}/ledger/accounts/${accountId}/group`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ group_id: groupId }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      toast.error(err.error ?? 'No se pudo mover la cuenta.')
      return
    }
    toast.success(groupId ? 'Cuenta movida al grupo.' : 'Cuenta movida a personal.')
    queryClient.invalidateQueries({ queryKey: ['ledger-account', accountId] })
    refetchMembers()
  }

  return (
    <div className="flex flex-col h-full">

      {/* ── Page header ──────────────────────────────────────────────── */}
      <div className="px-6 pt-5 pb-4 border-b border-[hsl(var(--border))] flex items-start gap-4 justify-between shrink-0">
        <div className="min-w-0 flex-1">
          {/* Breadcrumb / eyebrow */}
          <button
            onClick={() => navigate('/app/m/atlas.ledger/accounts')}
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
              onClick={() => navigate(`/app/m/atlas.ledger/accounts/${accountId}/import`)}
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
        {activeTab === 'acceso' && account && (
          <div className="px-6 pb-6 space-y-6 max-w-2xl">
            {account.group_id ? (
              <div className="rounded-lg border border-[hsl(var(--border))] p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <FolderOpen size={14} /> Pertenece a un grupo
                </div>
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                  El acceso a esta cuenta está controlado por el grupo. Para gestionar miembros ve al grupo.
                </p>
                {isOwner && (
                  <Button variant="ghost" size="sm" onClick={() => handleMoveGroup(null)}>
                    Mover a personal
                  </Button>
                )}
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold">Colaboradores</h3>
                  {isOwner && (
                    <Button variant="ghost" size="sm" onClick={() => setInviteOpen(true)}>
                      <UserPlus size={14} className="mr-1" /> Invitar
                    </Button>
                  )}
                </div>
                {members.length === 0 ? (
                  <p className="text-sm text-[hsl(var(--muted-foreground))]">Esta cuenta no tiene colaboradores.</p>
                ) : (
                  <div className="space-y-2">
                    {members.map((m) => (
                      <div key={m.id} className="flex items-center justify-between rounded-lg border border-[hsl(var(--border))] px-3 py-2">
                        <div>
                          <div className="text-sm font-medium">{m.display_name}</div>
                          <div className="text-xs text-[hsl(var(--muted-foreground))]">{m.email} · {m.role}</div>
                        </div>
                        {isOwner && (
                          <Button variant="ghost" size="icon" onClick={() => setRevokeTarget(m)}>
                            <Trash2 size={14} />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <UserSearchModal
              open={inviteOpen}
              onClose={() => setInviteOpen(false)}
              onConfirm={handleInvite}
              roles={[
                { value: 'viewer', label: 'Viewer — solo ver' },
                { value: 'editor', label: 'Editor — ver y editar' },
              ]}
              excludeIds={members.map((m) => m.user_id)}
              apiBase={API_BASE}
              token={token}
            />

            <ConfirmDialog
              open={!!revokeTarget}
              onOpenChange={(v) => { if (!v) setRevokeTarget(null) }}
              onConfirm={() => handleRevoke(revokeTarget?.user_id)}
              title="Revocar acceso"
              description={`¿Remover a ${revokeTarget?.display_name} de esta cuenta?`}
              confirmLabel="Revocar"
            />
          </div>
        )}
      </div>
    </div>
  )
}
