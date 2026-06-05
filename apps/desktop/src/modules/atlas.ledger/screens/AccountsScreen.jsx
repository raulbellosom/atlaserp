// apps/desktop/src/modules/atlas.ledger/screens/AccountsScreen.jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { PageHeader, Button, EmptyState, ErrorState } from '@atlas/ui'
import { Plus, Landmark, Users, FolderOpen } from 'lucide-react'
import { useAuth } from '../../../auth/AuthProvider'

const API_BASE = import.meta.env.VITE_ATLAS_API_URL || 'http://localhost:4010'

function fmtCurrency(amount, currency = 'MXN') {
  return Number(amount ?? 0).toLocaleString('es-MX', { style: 'currency', currency, minimumFractionDigits: 2 })
}

const TABS = [
  { key: 'own',    label: 'Mis cuentas',        icon: Landmark   },
  { key: 'shared', label: 'Compartidas conmigo', icon: Users      },
  { key: 'groups', label: 'Grupos',              icon: FolderOpen },
]

export default function AccountsScreen() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const token = session?.access_token ?? null
  const [activeTab, setActiveTab] = useState('own')

  const headers = { Authorization: `Bearer ${token}` }

  const { data: allData, isLoading: allLoading, isError: allError } = useQuery({
    queryKey: ['ledger-accounts', token],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/ledger/accounts`, { headers })
      if (!res.ok) throw new Error('No se pudieron cargar las cuentas.')
      return res.json()
    },
    enabled: !!token,
  })

  const { data: membershipData, isLoading: mbLoading } = useQuery({
    queryKey: ['ledger-memberships', token],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/ledger/memberships`, { headers })
      if (!res.ok) return { data: { groups: [], accounts: [] } }
      return res.json()
    },
    enabled: !!token,
  })

  const { data: groupsData, isLoading: grpLoading } = useQuery({
    queryKey: ['ledger-groups', token],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/ledger/groups`, { headers })
      if (!res.ok) return { data: [] }
      return res.json()
    },
    enabled: !!token,
  })

  const ownAccounts    = (allData?.data ?? []).filter((a) => a.owner_id != null && a.group_id == null)
  const sharedAccounts = membershipData?.data?.accounts ?? []
  const groups         = groupsData?.data ?? []

  const isLoading = allLoading || mbLoading || grpLoading

  if (isLoading) {
    return (
      <div className="p-6 space-y-3">
        {[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-lg bg-[hsl(var(--muted))] animate-pulse" />)}
      </div>
    )
  }

  if (allError) return <ErrorState message="No se pudieron cargar las cuentas." />

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-5">
        <PageHeader
          title="Cuentas bancarias"
          description="Registro de saldos y movimientos por cuenta bancaria."
          actions={
            activeTab !== 'groups' ? (
              <Button variant="primary" size="sm" onClick={() => navigate('/app/m/atlas.ledger/accounts/new')}>
                <Plus size={14} className="mr-1" /> Nueva cuenta
              </Button>
            ) : (
              <Button variant="primary" size="sm" onClick={() => navigate('/app/m/atlas.ledger/groups')}>
                <FolderOpen size={14} className="mr-1" /> Ver grupos
              </Button>
            )
          }
        />

        <div className="flex gap-1 mt-4 border-b border-[hsl(var(--border))]">
          {TABS.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={[
                  'flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                  activeTab === tab.key
                    ? 'border-[hsl(var(--primary))] text-[hsl(var(--primary))]'
                    : 'border-transparent text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]',
                ].join(' ')}
              >
                <Icon size={14} />
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex-1 overflow-auto px-6 pb-6 pt-4">
        {activeTab === 'own' && (
          ownAccounts.length === 0
            ? <EmptyState icon={<Landmark size={32} />} message="No tienes cuentas personales. Crea una para comenzar." />
            : <AccountGrid accounts={ownAccounts} onSelect={(id) => navigate(`/app/m/atlas.ledger/accounts/${id}`)} />
        )}

        {activeTab === 'shared' && (
          sharedAccounts.length === 0
            ? <EmptyState icon={<Users size={32} />} message="Nadie ha compartido cuentas contigo." />
            : <AccountGrid accounts={sharedAccounts} onSelect={(id) => navigate(`/app/m/atlas.ledger/accounts/${id}`)} />
        )}

        {activeTab === 'groups' && (
          groups.length === 0
            ? <EmptyState icon={<FolderOpen size={32} />} message="No perteneces a ningún grupo. Pide que te inviten o crea uno." />
            : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {groups.map((group) => (
                  <button
                    key={group.id}
                    onClick={() => navigate(`/app/m/atlas.ledger/groups/${group.id}`)}
                    className="text-left p-4 rounded-xl border border-[hsl(var(--border))] hover:border-[hsl(var(--ring))] hover:bg-[hsl(var(--muted)/0.4)] transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <FolderOpen size={14} className="text-[hsl(var(--muted-foreground))]" />
                      <span className="text-xs text-[hsl(var(--muted-foreground))] capitalize">{group.my_role}</span>
                    </div>
                    <div className="font-semibold text-sm truncate">{group.name}</div>
                    <div className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                      {group.member_count} miembro{Number(group.member_count) !== 1 ? 's' : ''} · {group.account_count} cuenta{Number(group.account_count) !== 1 ? 's' : ''}
                    </div>
                  </button>
                ))}
              </div>
            )
        )}
      </div>
    </div>
  )
}

function AccountGrid({ accounts, onSelect }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {accounts.map((account) => (
        <button
          key={account.id}
          onClick={() => onSelect(account.id)}
          className="text-left p-4 rounded-xl border border-[hsl(var(--border))] hover:border-[hsl(var(--ring))] hover:bg-[hsl(var(--muted)/0.4)] transition-colors"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-[hsl(var(--muted-foreground))] truncate">{account.bank}</span>
            <span className="text-xs text-[hsl(var(--muted-foreground))]">{account.currency}</span>
          </div>
          <div className="font-semibold text-sm truncate">{account.name}</div>
          {account.account_number && (
            <div className="text-xs text-[hsl(var(--muted-foreground))] truncate">{account.account_number}</div>
          )}
          <div className="mt-2 font-mono text-sm font-semibold">
            {Number(account.current_balance ?? 0).toLocaleString('es-MX', {
              style: 'currency', currency: account.currency ?? 'MXN', minimumFractionDigits: 2,
            })}
          </div>
          {account.role && (
            <div className="mt-1 text-xs text-[hsl(var(--muted-foreground))] capitalize">{account.role}</div>
          )}
        </button>
      ))}
    </div>
  )
}
