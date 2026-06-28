import { useState, useEffect, useRef } from 'react'
import { Search, X, Check, UserPlus, Shield, Users } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@atlas/ui'
import { useNoteShares, useShareNote, useUpdateNoteShare, useRevokeNoteShare } from '../hooks/useNoteShares.js'
import { atlas } from '../../../lib/atlas'
import { useAuth } from '../../../auth/AuthProvider'

const PERMISSION_OPTIONS = [
  { value: 'read',  label: 'Solo lectura' },
  { value: 'edit',  label: 'Puede editar' },
]

function UserInitials({ name, size = 'md' }) {
  const initial = (name ?? '?')[0].toUpperCase()
  const dim = size === 'sm' ? 'w-7 h-7 text-xs' : 'w-9 h-9 text-sm'
  return (
    <div className={`${dim} rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 font-semibold flex items-center justify-center shrink-0 select-none`}>
      {initial}
    </div>
  )
}

function PermissionSelect({ value, onChange }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="text-xs rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))] px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
    >
      {PERMISSION_OPTIONS.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}

export function NoteShareModal({ noteId, open, onOpenChange }) {
  const { session } = useAuth()
  const token = session?.access_token
  const { data, isLoading: sharesLoading } = useNoteShares(noteId)
  const shareNote   = useShareNote()
  const updateShare = useUpdateNoteShare()
  const revokeShare = useRevokeNoteShare()

  const [query, setQuery]               = useState('')
  const [userList, setUserList]         = useState([])
  const [searching, setSearching]       = useState(false)
  const [selectedUser, setSelectedUser] = useState(null)
  const [permission, setPermission]     = useState('read')
  const searchRef  = useRef(null)
  const debounceRef = useRef(null)

  const shares = data?.shares ?? []
  const sharedIds = new Set(shares.map(s => s.shared_with_user_id))

  // Auto-focus when modal opens + load initial suggestions
  useEffect(() => {
    if (!open || !token) return
    const t = setTimeout(() => searchRef.current?.focus(), 80)
    atlas.identity.listUsers(token, { pageSize: 10 })
      .then(res => {
        const users = (res?.data ?? []).filter(u => !sharedIds.has(u.id))
        setUserList(users)
      })
      .catch(() => {})
    return () => clearTimeout(t)
  }, [open, token, shares.length])

  // Live search
  useEffect(() => {
    clearTimeout(debounceRef.current)
    if (!query.trim() || query.length < 2) {
      // Restore initial suggestions when query is cleared
      if (!query.trim() && token) {
        atlas.identity.listUsers(token, { pageSize: 10 })
          .then(res => {
            const users = (res?.data ?? []).filter(u => !sharedIds.has(u.id))
            setUserList(users)
          })
          .catch(() => {})
      }
      return
    }
    debounceRef.current = setTimeout(async () => {
      if (!token) return
      setSearching(true)
      try {
        const res = await atlas.identity.listUsers(token, { search: query.trim(), pageSize: 10 })
        setUserList((res?.data ?? []).filter(u => !sharedIds.has(u.id)))
      } catch (_) {
        setUserList([])
      } finally {
        setSearching(false)
      }
    }, 280)
    return () => clearTimeout(debounceRef.current)
  }, [query, token])

  function handleShare() {
    if (!selectedUser) return
    shareNote.mutate(
      { noteId, targetUserId: selectedUser.id, permission },
      {
        onSuccess: () => {
          setSelectedUser(null)
          setQuery('')
          setPermission('read')
        },
      },
    )
  }

  function handleSelectUser(user) {
    setSelectedUser(prev => prev?.id === user.id ? null : user)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle>Compartir nota</DialogTitle>
        </DialogHeader>

        <div className="flex gap-5 min-h-0" style={{ minHeight: 320 }}>

          {/* ── Left panel: search + user list ── */}
          <div className="flex-1 flex flex-col min-w-0 gap-3">
            {/* Search */}
            <div className={[
              'flex items-center gap-2 px-3 py-2.5 border rounded-xl transition-colors bg-[hsl(var(--background))]',
              'border-[hsl(var(--border))] focus-within:border-amber-400 focus-within:ring-1 focus-within:ring-amber-400/40',
            ].join(' ')}>
              <Search className="w-3.5 h-3.5 text-[hsl(var(--muted-foreground))] shrink-0" />
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={e => { setQuery(e.target.value); setSelectedUser(null) }}
                placeholder="Buscar por nombre o correo..."
                className="flex-1 text-sm bg-transparent focus:outline-none text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]"
              />
              {searching && (
                <div className="w-3.5 h-3.5 rounded-full border-2 border-amber-400 border-t-transparent animate-spin shrink-0" />
              )}
              {query && !searching && (
                <button onClick={() => { setQuery(''); setSelectedUser(null) }} className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* User list */}
            <div className="flex-1 overflow-y-auto rounded-xl border border-[hsl(var(--border))]" style={{ minHeight: 0 }}>
              {userList.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 gap-2 text-[hsl(var(--muted-foreground))]">
                  {query.trim().length >= 2 ? (
                    <>
                      <Users className="w-8 h-8 opacity-30" />
                      <p className="text-sm">Sin resultados para "{query}"</p>
                    </>
                  ) : (
                    <>
                      <Users className="w-8 h-8 opacity-30" />
                      <p className="text-sm">Cargando usuarios...</p>
                    </>
                  )}
                </div>
              ) : (
                <>
                  <p className="px-3 pt-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]/60 sticky top-0 bg-[hsl(var(--background))]">
                    {query.trim().length >= 2 ? 'Resultados' : 'Sugerencias'}
                  </p>
                  {userList.map(user => {
                    const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email
                    const isSelected = selectedUser?.id === user.id
                    return (
                      <button
                        key={user.id}
                        onClick={() => handleSelectUser(user)}
                        className={[
                          'w-full flex items-center gap-3 px-3 py-2.5 transition-colors text-left',
                          isSelected
                            ? 'bg-amber-50 dark:bg-amber-950/30'
                            : 'hover:bg-[hsl(var(--muted))]',
                        ].join(' ')}
                      >
                        <UserInitials name={fullName} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[hsl(var(--foreground))] truncate leading-tight">{fullName}</p>
                          <p className="text-xs text-[hsl(var(--muted-foreground))] truncate leading-tight">{user.email}</p>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-amber-500 shrink-0" />}
                      </button>
                    )
                  })}
                </>
              )}
            </div>

            {/* Add selected user */}
            {selectedUser && (
              <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/30 rounded-xl">
                <UserInitials name={[selectedUser.firstName, selectedUser.lastName].filter(Boolean).join(' ') || selectedUser.email} size="sm" />
                <p className="flex-1 text-sm font-medium text-[hsl(var(--foreground))] truncate min-w-0">
                  {[selectedUser.firstName, selectedUser.lastName].filter(Boolean).join(' ') || selectedUser.email}
                </p>
                <PermissionSelect value={permission} onChange={setPermission} />
                <button
                  onClick={handleShare}
                  disabled={shareNote.isPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors disabled:opacity-40 shrink-0"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  Agregar
                </button>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="w-px bg-[hsl(var(--border))] shrink-0" />

          {/* ── Right panel: current shares ── */}
          <div className="w-60 shrink-0 flex flex-col gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]/70 pt-0.5">
              Personas con acceso
            </p>

            {sharesLoading ? (
              <div className="flex items-center gap-2 py-3">
                <div className="w-4 h-4 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
                <span className="text-xs text-[hsl(var(--muted-foreground))]">Cargando...</span>
              </div>
            ) : shares.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <Shield className="w-8 h-8 text-[hsl(var(--muted-foreground))]/30" />
                <p className="text-xs text-[hsl(var(--muted-foreground))] leading-snug">
                  Solo tu tienes acceso a esta nota
                </p>
              </div>
            ) : (
              <div className="space-y-0.5 overflow-y-auto flex-1">
                {shares.map(share => {
                  const name = share.display_name ?? share.user_email ?? '?'
                  return (
                    <div key={share.id} className="flex items-center gap-2.5 px-2 py-2.5 rounded-xl hover:bg-[hsl(var(--muted))]/60 group transition-colors">
                      <UserInitials name={name} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-[hsl(var(--foreground))] truncate leading-tight">{name}</p>
                        <p className="text-[10px] text-[hsl(var(--muted-foreground))] truncate leading-tight">{share.user_email}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <PermissionSelect
                          value={share.permission}
                          onChange={val => updateShare.mutate({ noteId, shareId: share.id, permission: val })}
                        />
                        <button
                          onClick={() => revokeShare.mutate({ noteId, shareId: share.id })}
                          className="p-1 text-[hsl(var(--muted-foreground))] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-md transition-colors"
                          title="Revocar acceso"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {/* Collapsed state: just show permission badge */}
                      <div className="group-hover:hidden shrink-0">
                        <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${
                          share.permission === 'edit'
                            ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
                            : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]'
                        }`}>
                          {share.permission === 'edit' ? 'Edita' : 'Lee'}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

        </div>
      </DialogContent>
    </Dialog>
  )
}
