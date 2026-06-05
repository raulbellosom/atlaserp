// apps/desktop/src/modules/atlas.ledger/screens/GroupScreen.jsx
import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { PageHeader, Button, EmptyState, ErrorState, ConfirmDialog, UserSearchModal } from '@atlas/ui'
import { ArrowLeft, Plus, UserPlus, Trash2, Landmark } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '../../../auth/AuthProvider'

const API_BASE = import.meta.env.VITE_ATLAS_API_URL || 'http://localhost:4010'

const TABS = [
  { key: 'cuentas',  label: 'Cuentas'  },
  { key: 'miembros', label: 'Miembros' },
]

const ROLE_OPTIONS = [
  { value: 'viewer', label: 'Viewer — solo ver' },
  { value: 'editor', label: 'Editor — ver y editar' },
  { value: 'admin',  label: 'Admin — gestionar miembros' },
]

export default function GroupScreen() {
  const { '*': wildcard } = useParams()
  const groupId           = useMemo(() => wildcard?.split('/')[1] ?? null, [wildcard])
  const navigate          = useNavigate()
  const { session }       = useAuth()
  const token             = session?.access_token ?? null
  const queryClient       = useQueryClient()
  const headers           = { Authorization: `Bearer ${token}` }

  const [activeTab, setActiveTab]       = useState('cuentas')
  const [inviteOpen, setInviteOpen]     = useState(false)
  const [removeTarget, setRemoveTarget] = useState(null)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['ledger-group', groupId],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/ledger/groups/${groupId}`, { headers })
      if (!res.ok) throw new Error('No se pudo cargar el grupo.')
      return res.json()
    },
    enabled: !!groupId && !!token,
  })

  const group    = data?.data ?? null
  const members  = group?.members ?? []
  const accounts = group?.accounts ?? []
  const myRole   = group?.role ?? null

  async function handleInvite(userId, role) {
    const res = await fetch(`${API_BASE}/ledger/groups/${groupId}/members`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, role }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      toast.error(err.error ?? 'No se pudo invitar al miembro.')
      return
    }
    toast.success('Miembro invitado.')
    queryClient.invalidateQueries({ queryKey: ['ledger-group', groupId] })
  }

  async function handleRemove(targetUserId) {
    const res = await fetch(`${API_BASE}/ledger/groups/${groupId}/members/${targetUserId}`, {
      method: 'DELETE',
      headers,
    })
    if (!res.ok) { toast.error('No se pudo remover al miembro.'); return }
    toast.success('Miembro removido.')
    setRemoveTarget(null)
    queryClient.invalidateQueries({ queryKey: ['ledger-group', groupId] })
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-3">
        {[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-lg bg-[hsl(var(--muted))] animate-pulse" />)}
      </div>
    )
  }

  if (isError || !group) return <ErrorState message="No se pudo cargar el grupo." />

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-5">
        <button
          onClick={() => navigate('/app/m/atlas.ledger/groups')}
          className="flex items-center gap-1 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] mb-3 transition-colors"
        >
          <ArrowLeft size={14} /> Grupos
        </button>
        <PageHeader
          title={group.name}
          description={`${members.length} miembro${members.length !== 1 ? 's' : ''} · ${accounts.length} cuenta${accounts.length !== 1 ? 's' : ''}`}
          actions={
            activeTab === 'cuentas' ? (
              (myRole === 'editor' || myRole === 'admin') ? (
                <Button variant="primary" size="sm" onClick={() => navigate('/app/m/atlas.ledger/accounts/new')}>
                  <Plus size={14} className="mr-1" /> Nueva cuenta
                </Button>
              ) : null
            ) : (
              myRole === 'admin' ? (
                <Button variant="primary" size="sm" onClick={() => setInviteOpen(true)}>
                  <UserPlus size={14} className="mr-1" /> Invitar
                </Button>
              ) : null
            )
          }
        />

        <div className="flex gap-1 mt-4 border-b border-[hsl(var(--border))]">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={[
                'px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                activeTab === tab.key
                  ? 'border-[hsl(var(--primary))] text-[hsl(var(--primary))]'
                  : 'border-transparent text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]',
              ].join(' ')}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto px-6 pb-6 pt-4">
        {activeTab === 'cuentas' && (
          accounts.length === 0
            ? <EmptyState icon={<Landmark size={32} />} message="Este grupo no tiene cuentas todavía." />
            : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {accounts.map((account) => (
                  <button
                    key={account.id}
                    onClick={() => navigate(`/app/m/atlas.ledger/accounts/${account.id}`)}
                    className="text-left p-4 rounded-xl border border-[hsl(var(--border))] hover:border-[hsl(var(--ring))] hover:bg-[hsl(var(--muted)/0.4)] transition-colors"
                  >
                    <div className="font-semibold text-sm truncate">{account.name}</div>
                    <div className="mt-1 font-mono text-sm font-semibold">
                      {Number(account.current_balance ?? 0).toLocaleString('es-MX', {
                        style: 'currency', currency: account.currency ?? 'MXN', minimumFractionDigits: 2,
                      })}
                    </div>
                  </button>
                ))}
              </div>
            )
        )}

        {activeTab === 'miembros' && (
          members.length === 0
            ? <EmptyState icon={<UserPlus size={32} />} message="El grupo no tiene miembros activos." />
            : (
              <div className="space-y-2 max-w-xl">
                {members.map((m) => (
                  <div key={m.id} className="flex items-center justify-between rounded-lg border border-[hsl(var(--border))] px-3 py-2">
                    <div>
                      <div className="text-sm font-medium">{m.display_name}</div>
                      <div className="text-xs text-[hsl(var(--muted-foreground))]">
                        {m.email} · <span className="capitalize">{m.role}</span>
                      </div>
                    </div>
                    {myRole === 'admin' && (
                      <Button variant="ghost" size="icon" onClick={() => setRemoveTarget(m)}>
                        <Trash2 size={14} />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )
        )}
      </div>

      <UserSearchModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onConfirm={handleInvite}
        roles={ROLE_OPTIONS}
        excludeIds={members.map((m) => m.user_id)}
        apiBase={API_BASE}
        token={token}
      />

      <ConfirmDialog
        open={!!removeTarget}
        onOpenChange={(v) => { if (!v) setRemoveTarget(null) }}
        onConfirm={() => handleRemove(removeTarget?.user_id)}
        title="Remover miembro"
        description={`¿Remover a ${removeTarget?.display_name} del grupo?`}
        confirmLabel="Remover"
      />
    </div>
  )
}
