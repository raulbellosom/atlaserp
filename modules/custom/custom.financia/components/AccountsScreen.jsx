// modules/custom/custom.financia/components/AccountsScreen.jsx
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { PageHeader, Button, EmptyState, ErrorState } from '@atlas/ui'
import { Plus, Landmark } from 'lucide-react'
import { useAuth } from '../../../../apps/desktop/src/auth/AuthProvider'

const API_BASE = import.meta.env.VITE_ATLAS_API_URL || 'http://localhost:4010'

function fmtCurrency(amount, currency = 'MXN') {
  return Number(amount ?? 0).toLocaleString('es-MX', {
    style: 'currency', currency, minimumFractionDigits: 2,
  })
}

export default function AccountsScreen() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const token = session?.access_token ?? null

  const { data, isLoading, isError } = useQuery({
    queryKey: ['financia-accounts', token],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/financia/accounts`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('No se pudieron cargar las cuentas.')
      return res.json()
    },
    enabled: !!token,
  })

  if (isLoading) {
    return (
      <div className="p-6 space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 rounded-lg bg-[hsl(var(--muted))] animate-pulse" />
        ))}
      </div>
    )
  }

  if (isError) {
    return <ErrorState message="No se pudieron cargar las cuentas." />
  }

  const accounts = data?.data ?? []

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-5">
        <PageHeader
          title="Cuentas bancarias"
          description="Registro de saldos y movimientos por cuenta bancaria."
          actions={
            <Button
              variant="primary"
              size="sm"
              onClick={() => navigate('/app/m/custom.financia/accounts/new')}
            >
              <Plus size={14} className="mr-1" />
              Nueva cuenta
            </Button>
          }
        />
      </div>

      <div className="flex-1 overflow-auto px-6 pb-6">
        {accounts.length === 0 ? (
          <EmptyState
            icon={<Landmark size={32} />}
            message="No hay cuentas bancarias registradas."
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {accounts.map((account) => (
              <button
                key={account.id}
                onClick={() => navigate(`/app/m/custom.financia/accounts/${account.id}`)}
                className="text-left p-4 rounded-xl border border-[hsl(var(--border))] hover:border-[hsl(var(--ring))] hover:bg-[hsl(var(--muted)/0.4)] transition-colors"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-sm truncate">{account.name}</span>
                  <span className="text-xs text-[hsl(var(--muted-foreground))] ml-2 shrink-0">
                    {account.currency}
                  </span>
                </div>
                <div className="text-xs text-[hsl(var(--muted-foreground))] mb-2">{account.bank}</div>
                <div className="text-base font-mono font-semibold" style={{ color: 'var(--module-accent)' }}>
                  {fmtCurrency(account.current_balance, account.currency)}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
