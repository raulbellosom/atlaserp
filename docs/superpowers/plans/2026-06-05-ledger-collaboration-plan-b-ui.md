# atlas.ledger Collaboration & Groups — Plan B (UI)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add group and collaboration screens to the ledger frontend: tabbed accounts list, access panel on account detail, group manager, membership manager, and a reusable user-search modal in `@atlas/ui`.

**Architecture:** `UserSearchModal` is a new component in `packages/ui` shared across all invite flows. New screens live in `apps/desktop/src/modules/atlas.ledger/screens/`. Two existing screens (`AccountsScreen`, `AccountScreen`) are modified. All new routes are registered in `ModuleOutlet.jsx`.

**Tech Stack:** React, TanStack Query, Zustand (if needed), `@atlas/ui`, Tailwind, Lucide icons. All UI text in Spanish.

**Spec:** `docs/superpowers/specs/2026-06-05-ledger-collaboration-groups-design.md`

**Prerequisite:** Plan A (API) must be deployed before testing this UI.

---

## File map

| Action | File |
|---|---|
| Create | `packages/ui/src/components/UserSearchModal.jsx` |
| Modify | `packages/ui/src/index.js` |
| Modify | `apps/desktop/src/modules/atlas.ledger/screens/AccountsScreen.jsx` |
| Modify | `apps/desktop/src/modules/atlas.ledger/screens/AccountScreen.jsx` |
| Create | `apps/desktop/src/modules/atlas.ledger/screens/GroupsScreen.jsx` |
| Create | `apps/desktop/src/modules/atlas.ledger/screens/GroupScreen.jsx` |
| Create | `apps/desktop/src/modules/atlas.ledger/screens/MembershipsScreen.jsx` |
| Modify | `apps/desktop/src/app/ModuleOutlet.jsx` |

---

## Task 1: UserSearchModal component

**Files:**
- Create: `packages/ui/src/components/UserSearchModal.jsx`
- Modify: `packages/ui/src/index.js`

- [ ] **Step 1: Create UserSearchModal.jsx**

```jsx
// packages/ui/src/components/UserSearchModal.jsx
import { useState, useEffect, useRef } from 'react'
import { Dialog } from './Dialog.jsx'
import { Button } from './Button.jsx'
import { SelectField } from './FormFields.jsx'
import { Search, User } from 'lucide-react'

/**
 * Props:
 *   open         boolean
 *   onClose      () => void
 *   onConfirm    (userId: string, role: string) => void
 *   roles        Array<{ value: string, label: string }>
 *   excludeIds   string[]  — user ids to hide from results (optional)
 *   apiBase      string    — VITE_ATLAS_API_URL
 *   token        string    — Bearer token
 */
export function UserSearchModal({ open, onClose, onConfirm, roles = [], excludeIds = [], apiBase, token }) {
  const [query, setQuery]         = useState('')
  const [results, setResults]     = useState([])
  const [loading, setLoading]     = useState(false)
  const [selected, setSelected]   = useState(null)
  const [role, setRole]           = useState(roles[0]?.value ?? '')
  const debounceRef               = useRef(null)

  useEffect(() => {
    if (!open) {
      setQuery('')
      setResults([])
      setSelected(null)
      setRole(roles[0]?.value ?? '')
    }
  }, [open, roles])

  useEffect(() => {
    if (query.length < 2) {
      setResults([])
      return
    }
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(
          `${apiBase}/users/search?q=${encodeURIComponent(query)}&limit=10`,
          { headers: { Authorization: `Bearer ${token}` } }
        )
        if (!res.ok) { setResults([]); return }
        const json = await res.json()
        const filtered = (json.data ?? []).filter((u) => !excludeIds.includes(u.id))
        setResults(filtered)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => clearTimeout(debounceRef.current)
  }, [query, apiBase, token, excludeIds])

  function handleConfirm() {
    if (!selected || !role) return
    onConfirm(selected.id, role)
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose} title="Buscar usuario">
      <div className="space-y-4">
        {/* Search input */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
          <input
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelected(null) }}
            placeholder="Nombre o correo electrónico..."
            className="w-full pl-8 pr-3 py-2 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
            autoFocus
          />
        </div>

        {/* Results */}
        {query.length >= 2 && (
          <div className="max-h-52 overflow-y-auto rounded-md border border-[hsl(var(--border))]">
            {loading && (
              <div className="p-3 text-sm text-[hsl(var(--muted-foreground))]">Buscando...</div>
            )}
            {!loading && results.length === 0 && (
              <div className="p-3 text-sm text-[hsl(var(--muted-foreground))]">No se encontraron usuarios.</div>
            )}
            {!loading && results.map((user) => (
              <button
                key={user.id}
                onClick={() => setSelected(user)}
                className={[
                  'w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-[hsl(var(--muted)/0.5)] transition-colors',
                  selected?.id === user.id ? 'bg-[hsl(var(--muted))]' : '',
                ].join(' ')}
              >
                <div className="shrink-0 w-7 h-7 rounded-full bg-[hsl(var(--muted))] flex items-center justify-center">
                  <User size={12} className="text-[hsl(var(--muted-foreground))]" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{user.display_name}</div>
                  <div className="text-xs text-[hsl(var(--muted-foreground))] truncate">{user.email}</div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Role selector — only shown after selecting a user */}
        {selected && roles.length > 0 && (
          <SelectField
            label="Rol"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            options={roles}
          />
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleConfirm}
            disabled={!selected || !role}
          >
            Confirmar
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
```

- [ ] **Step 2: Export from packages/ui/src/index.js**

Open `packages/ui/src/index.js`. Find the last export line and add:

```js
export { UserSearchModal } from "./components/UserSearchModal.jsx";
```

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/components/UserSearchModal.jsx packages/ui/src/index.js
git commit -m "feat(ui): add UserSearchModal component"
```

---

## Task 2: Modify AccountsScreen — three tabs

**Files:**
- Modify: `apps/desktop/src/modules/atlas.ledger/screens/AccountsScreen.jsx`

- [ ] **Step 1: Replace AccountsScreen.jsx**

```jsx
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
  { key: 'own',    label: 'Mis cuentas',        icon: Landmark },
  { key: 'shared', label: 'Compartidas conmigo', icon: Users    },
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

  const { data: membershipData, isLoading: mbLoading, isError: mbError } = useQuery({
    queryKey: ['ledger-memberships', token],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/ledger/memberships`, { headers })
      if (!res.ok) return { data: { groups: [], accounts: [] } }
      return res.json()
    },
    enabled: !!token,
  })

  const { data: groupsData, isLoading: grpLoading, isError: grpError } = useQuery({
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
  const isError   = allError || mbError || grpError

  if (isLoading) {
    return (
      <div className="p-6 space-y-3">
        {[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-lg bg-[hsl(var(--muted))] animate-pulse" />)}
      </div>
    )
  }

  if (isError) return <ErrorState message="No se pudieron cargar las cuentas." />

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

        {/* Tabs */}
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
                      {group.member_count} miembro{group.member_count !== 1 ? 's' : ''} · {group.account_count} cuenta{group.account_count !== 1 ? 's' : ''}
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
            <div className="text-xs text-[hsl(var(--muted-foreground))] truncate">
              {account.account_number}
            </div>
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
```

- [ ] **Step 2: Commit**

```bash
git add apps/desktop/src/modules/atlas.ledger/screens/AccountsScreen.jsx
git commit -m "feat(ledger): AccountsScreen — tabbed view (own/shared/groups)"
```

---

## Task 3: Modify AccountScreen — add Acceso tab

**Files:**
- Modify: `apps/desktop/src/modules/atlas.ledger/screens/AccountScreen.jsx`

- [ ] **Step 1: Add the Acceso tab to the TABS array**

Find the `TABS` constant (around line 14):
```js
const TABS = [
  { key: 'registro', label: 'Registro' },
  { key: 'resumen',  label: 'Resumen'  },
]
```
Replace with:
```js
const TABS = [
  { key: 'registro', label: 'Registro' },
  { key: 'resumen',  label: 'Resumen'  },
  { key: 'acceso',   label: 'Acceso'   },
]
```

- [ ] **Step 2: Add imports for collaboration state**

Add to the import block at the top:

```js
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { UserSearchModal } from '@atlas/ui'
import { ConfirmDialog } from '@atlas/ui'
import { Users, UserPlus, Trash2, FolderOpen } from 'lucide-react'
```

- [ ] **Step 3: Add state and data queries for the Acceso tab**

Inside `AccountScreen`, after the existing `useQuery` calls, add:

```js
const queryClient = useQueryClient()
const [inviteOpen, setInviteOpen]         = useState(false)
const [revokeTarget, setRevokeTarget]     = useState(null) // { id, display_name }

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

const members = membersData?.data ?? []
const isOwner = account?.owner_id != null // true when API returns the account with owner_id set

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
  if (!res.ok) {
    toast.error('No se pudo remover al colaborador.')
    return
  }
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
```

- [ ] **Step 4: Render the Acceso tab panel**

Find where the tabs are rendered (the section that shows `activeTab === 'registro'` content). Add a new condition for `'acceso'`:

```jsx
{activeTab === 'acceso' && account && (
  <div className="px-6 pb-6 space-y-6 max-w-2xl">
    {/* Group membership indicator */}
    {account.group_id ? (
      <div className="rounded-lg border border-[hsl(var(--border))] p-4 space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <FolderOpen size={14} />
          Pertenece a un grupo
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
      <>
        {/* Collaborators section */}
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
      </>
    )}

    {/* UserSearchModal for inviting */}
    <UserSearchModal
      open={inviteOpen}
      onClose={() => setInviteOpen(false)}
      onConfirm={handleInvite}
      roles={[{ value: 'viewer', label: 'Viewer — solo ver' }, { value: 'editor', label: 'Editor — ver y editar' }]}
      excludeIds={members.map((m) => m.user_id)}
      apiBase={API_BASE}
      token={token}
    />

    {/* Revoke confirm dialog */}
    <ConfirmDialog
      open={!!revokeTarget}
      onClose={() => setRevokeTarget(null)}
      onConfirm={() => handleRevoke(revokeTarget?.user_id)}
      title="Revocar acceso"
      description={`¿Remover a ${revokeTarget?.display_name} de esta cuenta?`}
      confirmLabel="Revocar"
      variant="destructive"
    />
  </div>
)}
```

**Note:** The `AccountScreen.jsx` file accesses `account.owner_id`. Check what the API currently returns for `owner_id` after applying Plan A. If the field is absent (legacy account), `isOwner` will be false and the invite button won't show — that's the correct behavior for legacy accounts.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/modules/atlas.ledger/screens/AccountScreen.jsx
git commit -m "feat(ledger): AccountScreen — add Acceso tab with member management"
```

---

## Task 4: GroupsScreen

**Files:**
- Create: `apps/desktop/src/modules/atlas.ledger/screens/GroupsScreen.jsx`

- [ ] **Step 1: Create GroupsScreen.jsx**

```jsx
// apps/desktop/src/modules/atlas.ledger/screens/GroupsScreen.jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PageHeader, Button, EmptyState, ErrorState, Dialog } from '@atlas/ui'
import { Plus, FolderOpen } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '../../../auth/AuthProvider'

const API_BASE = import.meta.env.VITE_ATLAS_API_URL || 'http://localhost:4010'

export default function GroupsScreen() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const token = session?.access_token ?? null
  const queryClient = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName]       = useState('')

  const { data, isLoading, isError } = useQuery({
    queryKey: ['ledger-groups', token],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/ledger/groups`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('No se pudieron cargar los grupos.')
      return res.json()
    },
    enabled: !!token,
  })

  async function handleCreate(e) {
    e.preventDefault()
    if (!newName.trim()) return
    const res = await fetch(`${API_BASE}/ledger/groups`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim() }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      toast.error(err.error ?? 'No se pudo crear el grupo.')
      return
    }
    toast.success('Grupo creado.')
    setNewName('')
    setCreateOpen(false)
    queryClient.invalidateQueries({ queryKey: ['ledger-groups'] })
  }

  const groups = data?.data ?? []

  if (isLoading) {
    return (
      <div className="p-6 space-y-3">
        {[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-lg bg-[hsl(var(--muted))] animate-pulse" />)}
      </div>
    )
  }

  if (isError) return <ErrorState message="No se pudieron cargar los grupos." />

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-5">
        <PageHeader
          title="Grupos"
          description="Espacios compartidos para colaborar en cuentas bancarias."
          actions={
            <Button variant="primary" size="sm" onClick={() => setCreateOpen(true)}>
              <Plus size={14} className="mr-1" /> Nuevo grupo
            </Button>
          }
        />
      </div>

      <div className="flex-1 overflow-auto px-6 pb-6 pt-4">
        {groups.length === 0 ? (
          <EmptyState
            icon={<FolderOpen size={32} />}
            message="No tienes grupos todavía. Crea uno para empezar a colaborar."
          />
        ) : (
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
                  {group.member_count} miembro{group.member_count !== 1 ? 's' : ''} · {group.account_count} cuenta{group.account_count !== 1 ? 's' : ''}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} title="Nuevo grupo">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Nombre del grupo</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Ej. Finanzas Q2"
              className="w-full px-3 py-2 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
              autoFocus
              maxLength={128}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button type="submit" variant="primary" size="sm" disabled={!newName.trim()}>Crear</Button>
          </div>
        </form>
      </Dialog>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/desktop/src/modules/atlas.ledger/screens/GroupsScreen.jsx
git commit -m "feat(ledger): add GroupsScreen"
```

---

## Task 5: GroupScreen

**Files:**
- Create: `apps/desktop/src/modules/atlas.ledger/screens/GroupScreen.jsx`

- [ ] **Step 1: Create GroupScreen.jsx**

```jsx
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

  const group   = data?.data ?? null
  const members = group?.members ?? []
  const accounts = group?.accounts ?? []
  const myRole  = group?.role ?? null
  const isAdmin = myRole === 'admin'

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
    if (!res.ok) {
      toast.error('No se pudo remover al miembro.')
      return
    }
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
              (myRole === 'editor' || myRole === 'admin') && (
                <Button variant="primary" size="sm" onClick={() => navigate(`/app/m/atlas.ledger/accounts/new`)}>
                  <Plus size={14} className="mr-1" /> Nueva cuenta
                </Button>
              )
            ) : (
              myRole === 'admin' && (
                <Button variant="primary" size="sm" onClick={() => setInviteOpen(true)}>
                  <UserPlus size={14} className="mr-1" /> Invitar
                </Button>
              )
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
                      <div className="text-xs text-[hsl(var(--muted-foreground))]">{m.email} · <span className="capitalize">{m.role}</span></div>
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
        onClose={() => setRemoveTarget(null)}
        onConfirm={() => handleRemove(removeTarget?.user_id)}
        title="Remover miembro"
        description={`¿Remover a ${removeTarget?.display_name} del grupo?`}
        confirmLabel="Remover"
        variant="destructive"
      />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/desktop/src/modules/atlas.ledger/screens/GroupScreen.jsx
git commit -m "feat(ledger): add GroupScreen (cuentas + miembros tabs)"
```

---

## Task 6: MembershipsScreen

**Files:**
- Create: `apps/desktop/src/modules/atlas.ledger/screens/MembershipsScreen.jsx`

- [ ] **Step 1: Create MembershipsScreen.jsx**

```jsx
// apps/desktop/src/modules/atlas.ledger/screens/MembershipsScreen.jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { PageHeader, EmptyState, ErrorState, ConfirmDialog, Button } from '@atlas/ui'
import { LogOut, FolderOpen, Landmark } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '../../../auth/AuthProvider'

const API_BASE = import.meta.env.VITE_ATLAS_API_URL || 'http://localhost:4010'

export default function MembershipsScreen() {
  const navigate    = useNavigate()
  const { session } = useAuth()
  const token       = session?.access_token ?? null
  const queryClient = useQueryClient()
  const headers     = { Authorization: `Bearer ${token}` }

  const [leaveGroup, setLeaveGroup]     = useState(null) // { id, name }
  const [leaveAccount, setLeaveAccount] = useState(null) // { id, name }

  const { data, isLoading, isError } = useQuery({
    queryKey: ['ledger-memberships', token],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/ledger/memberships`, { headers })
      if (!res.ok) throw new Error('No se pudieron cargar las membresias.')
      return res.json()
    },
    enabled: !!token,
  })

  const groups   = data?.data?.groups   ?? []
  const accounts = data?.data?.accounts ?? []

  async function confirmLeaveGroup() {
    const res = await fetch(`${API_BASE}/ledger/memberships/groups/${leaveGroup.id}`, {
      method: 'DELETE', headers,
    })
    if (!res.ok) { toast.error('No se pudo salir del grupo.'); return }
    toast.success(`Saliste del grupo "${leaveGroup.name}".`)
    setLeaveGroup(null)
    queryClient.invalidateQueries({ queryKey: ['ledger-memberships'] })
    queryClient.invalidateQueries({ queryKey: ['ledger-groups'] })
  }

  async function confirmLeaveAccount() {
    const res = await fetch(`${API_BASE}/ledger/memberships/accounts/${leaveAccount.id}`, {
      method: 'DELETE', headers,
    })
    if (!res.ok) { toast.error('No se pudo salir de la cuenta compartida.'); return }
    toast.success(`Saliste de la cuenta "${leaveAccount.name}".`)
    setLeaveAccount(null)
    queryClient.invalidateQueries({ queryKey: ['ledger-memberships'] })
    queryClient.invalidateQueries({ queryKey: ['ledger-accounts'] })
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-3">
        {[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-lg bg-[hsl(var(--muted))] animate-pulse" />)}
      </div>
    )
  }

  if (isError) return <ErrorState message="No se pudieron cargar las membresias." />

  const isEmpty = groups.length === 0 && accounts.length === 0

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-5">
        <PageHeader
          title="Mis membresías"
          description="Grupos y cuentas a los que fuiste invitado."
        />
      </div>

      <div className="flex-1 overflow-auto px-6 pb-6 pt-4 space-y-8 max-w-2xl">
        {isEmpty && (
          <EmptyState icon={<LogOut size={32} />} message="No tienes membresías activas en grupos ni cuentas compartidas." />
        )}

        {groups.length > 0 && (
          <section>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <FolderOpen size={14} /> Grupos
            </h3>
            <div className="space-y-2">
              {groups.map((g) => (
                <div key={g.id} className="flex items-center justify-between rounded-lg border border-[hsl(var(--border))] px-3 py-2">
                  <button className="text-left" onClick={() => navigate(`/app/m/atlas.ledger/groups/${g.id}`)}>
                    <div className="text-sm font-medium">{g.name}</div>
                    <div className="text-xs text-[hsl(var(--muted-foreground))] capitalize">{g.role} · {g.member_count} miembro{g.member_count !== 1 ? 's' : ''}</div>
                  </button>
                  <Button variant="ghost" size="sm" onClick={() => setLeaveGroup(g)}>
                    <LogOut size={14} className="mr-1" /> Salir
                  </Button>
                </div>
              ))}
            </div>
          </section>
        )}

        {accounts.length > 0 && (
          <section>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Landmark size={14} /> Cuentas compartidas
            </h3>
            <div className="space-y-2">
              {accounts.map((a) => (
                <div key={a.id} className="flex items-center justify-between rounded-lg border border-[hsl(var(--border))] px-3 py-2">
                  <button className="text-left" onClick={() => navigate(`/app/m/atlas.ledger/accounts/${a.id}`)}>
                    <div className="text-sm font-medium">{a.name}</div>
                    <div className="text-xs text-[hsl(var(--muted-foreground))]">{a.bank} · <span className="capitalize">{a.role}</span> · Propietario: {a.owner_name}</div>
                  </button>
                  <Button variant="ghost" size="sm" onClick={() => setLeaveAccount(a)}>
                    <LogOut size={14} className="mr-1" /> Salir
                  </Button>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      <ConfirmDialog
        open={!!leaveGroup}
        onClose={() => setLeaveGroup(null)}
        onConfirm={confirmLeaveGroup}
        title="Salir del grupo"
        description={`¿Estás seguro de que quieres salir del grupo "${leaveGroup?.name}"?`}
        confirmLabel="Salir"
        variant="destructive"
      />

      <ConfirmDialog
        open={!!leaveAccount}
        onClose={() => setLeaveAccount(null)}
        onConfirm={confirmLeaveAccount}
        title="Salir de la cuenta compartida"
        description={`¿Estás seguro de que quieres salir de la cuenta "${leaveAccount?.name}"?`}
        confirmLabel="Salir"
        variant="destructive"
      />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/desktop/src/modules/atlas.ledger/screens/MembershipsScreen.jsx
git commit -m "feat(ledger): add MembershipsScreen (leave groups and accounts)"
```

---

## Task 7: Register new screens in ModuleOutlet.jsx

**Files:**
- Modify: `apps/desktop/src/app/ModuleOutlet.jsx`

- [ ] **Step 1: Add new screen imports to SCREEN_MAP**

Find the `SCREEN_MAP` object in `ModuleOutlet.jsx`. After the existing `"atlas.ledger:/accounts/:id/import"` entry, add:

```js
"atlas.ledger:/groups": lazy(
  () => import("../modules/atlas.ledger/screens/GroupsScreen.jsx"),
),
"atlas.ledger:/groups/:id": lazy(
  () => import("../modules/atlas.ledger/screens/GroupScreen.jsx"),
),
"atlas.ledger:/memberships": lazy(
  () => import("../modules/atlas.ledger/screens/MembershipsScreen.jsx"),
),
```

- [ ] **Step 2: Update the ledger routing logic**

Find the `if (moduleKey === "atlas.ledger")` block (around line 298). Extend the path matching to include the new routes:

```js
if (moduleKey === "atlas.ledger") {
  const modulePath = normalizedPath // e.g. "/groups/uuid" or "/accounts/uuid/import"

  if (modulePath.startsWith('/accounts/') && modulePath.endsWith('/import')) {
    return SCREEN_MAP["atlas.ledger:/accounts/:id/import"] ?? null
  }
  if (modulePath.startsWith('/accounts/')) {
    return SCREEN_MAP["atlas.ledger:/accounts/:id"] ?? null
  }
  if (modulePath.startsWith('/groups/')) {
    return SCREEN_MAP["atlas.ledger:/groups/:id"] ?? null
  }
  if (modulePath === '/groups') {
    return SCREEN_MAP["atlas.ledger:/groups"] ?? null
  }
  if (modulePath === '/memberships') {
    return SCREEN_MAP["atlas.ledger:/memberships"] ?? null
  }
  return null
}
```

**Note:** Check the exact variable name used in the existing code for `normalizedPath`. It might be called `modulePath`, `path`, `restPath`, or similar. Read the existing `if (moduleKey === "atlas.ledger")` block and match the variable names already in use.

- [ ] **Step 3: Verify the dev server starts without errors**

```bash
pnpm dev:frontend
```

Navigate to `http://localhost:5173/app/m/atlas.ledger/groups` — should render `GroupsScreen`.
Navigate to `http://localhost:5173/app/m/atlas.ledger/memberships` — should render `MembershipsScreen`.
Navigate to `http://localhost:5173/app/m/atlas.ledger/accounts` — should render `AccountsScreen` with three tabs.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/app/ModuleOutlet.jsx
git commit -m "feat(ledger): register groups, group detail, and memberships screens"
```

---

## Task 8: End-to-end smoke test

- [ ] **Step 1: Start the full dev stack**

```bash
pnpm dev
```

- [ ] **Step 2: Verify golden paths**

With a valid session:

1. Go to `/app/m/atlas.ledger/accounts` — three tabs visible (Mis cuentas / Compartidas conmigo / Grupos).
2. Click on a personal account → Acceso tab visible → click it → empty member list + "Invitar" button.
3. Click "Invitar" → `UserSearchModal` opens → type at least 2 chars → user list appears → select user → choose role → Confirmar.
4. Member appears in the list. ✓
5. Go to `/app/m/atlas.ledger/groups` → "Nuevo grupo" → create → group card appears.
6. Click group card → `GroupScreen` → Miembros tab → "Invitar" → invite a user.
7. Go to `/app/m/atlas.ledger/memberships` → see the invited user's view (if testing with another session).

- [ ] **Step 3: Final commit if any adjustments were needed**

```bash
git add -A
git commit -m "feat(ledger): collaboration UI — groups, members, memberships complete"
```
