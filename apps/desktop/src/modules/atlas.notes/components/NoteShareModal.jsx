import { useState, useEffect, useRef } from 'react'
import { Search, X, Check, UserPlus, Shield, Eye } from 'lucide-react'
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
  { value: 'edit',  label: 'Edicion' },
]

function UserAvatar({ name, size = 'sm' }) {
  const initial = (name ?? '?')[0].toUpperCase()
  const dim = size === 'sm' ? 'w-8 h-8 text-xs' : 'w-9 h-9 text-sm'
  return (
    <div className={`${dim} rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 font-semibold flex items-center justify-center shrink-0 select-none`}>
      {initial}
    </div>
  )
}

function PermissionSelect({ value, onChange, className = '' }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className={`text-xs rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))] px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer ${className}`}
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
  const [results, setResults]           = useState([])
  const [initialResults, setInitialResults] = useState([])
  const [searching, setSearching]       = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [permission, setPermission]     = useState('read')
  const [selectedUser, setSelectedUser] = useState(null)
  const searchRef  = useRef(null)
  const debounceRef = useRef(null)
  const dropdownRef = useRef(null)

  const shares = data?.shares ?? []

  // Auto-focus input when modal opens
  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => searchRef.current?.focus(), 80)
    return () => clearTimeout(t)
  }, [open])

  // Load initial user suggestions when modal opens
  useEffect(() => {
    if (!open || !token) return
    atlas.identity.listUsers(token, { pageSize: 8 }).then(res => {
      const users = res?.data ?? []
      const sharedIds = new Set(shares.map(s => s.shared_with_user_id))
      setInitialResults(users.filter(u => !sharedIds.has(u.id)))
    }).catch(() => {})
  }, [open, token, shares.length])

  // Live search as user types
  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setResults([])
      return
    }
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      if (!token) return
      setSearching(true)
      try {
        const res = await atlas.identity.listUsers(token, { search: query.trim(), pageSize: 8 })
        const users = res?.data ?? []
        const sharedIds = new Set(shares.map(s => s.shared_with_user_id))
        setResults(users.filter(u => !sharedIds.has(u.id)))
      } catch (_) {
        setResults([])
      } finally {
        setSearching(false)
      }
    }, 280)
    return () => clearTimeout(debounceRef.current)
  }, [query, token, shares])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const dropdownUsers = query.trim().length >= 2 ? results : initialResults

  function handleSelectUser(user) {
    setSelectedUser(user)
    setQuery(`${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email)
    setShowDropdown(false)
  }

  function handleShare() {
    if (!selectedUser) return
    shareNote.mutate(
      { noteId, targetUserId: selectedUser.id, permission },
      {
        onSuccess: () => {
          setSelectedUser(null)
          setQuery('')
          setResults([])
          setPermission('read')
        },
      },
    )
  }

  function handleClear() {
    setSelectedUser(null)
    setQuery('')
    setResults([])
    setShowDropdown(false)
    searchRef.current?.focus()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Compartir nota</DialogTitle>
        </DialogHeader>

        <div className="space-y-4" style={{ minWidth: 340 }}>

          {/* User search + dropdown */}
          <div className="relative" ref={dropdownRef}>
            <div className={[
              'flex items-center gap-2 px-3 py-2 border rounded-lg transition-colors bg-[hsl(var(--background))]',
              showDropdown ? 'border-amber-400 ring-1 ring-amber-400/50' : 'border-[hsl(var(--border))]',
            ].join(' ')}>
              <Search className="w-3.5 h-3.5 text-[hsl(var(--muted-foreground))] shrink-0" />
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={e => { setQuery(e.target.value); setSelectedUser(null) }}
                onFocus={() => setShowDropdown(true)}
                placeholder="Buscar por nombre o correo..."
                className="flex-1 text-sm bg-transparent focus:outline-none text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]"
              />
              {searching && (
                <div className="w-3.5 h-3.5 rounded-full border-2 border-amber-400 border-t-transparent animate-spin shrink-0" />
              )}
              {query && !searching && (
                <button onClick={handleClear} className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors shrink-0">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Dropdown — solid background, elevated shadow */}
            {showDropdown && (
              <div className="absolute top-full left-0 right-0 mt-1 z-[200] rounded-xl border border-[hsl(var(--border))] shadow-xl overflow-hidden"
                style={{ backgroundColor: 'hsl(var(--background))' }}
              >
                {!query.trim() && initialResults.length === 0 && (
                  <p className="px-4 py-3 text-xs text-[hsl(var(--muted-foreground))]">Cargando usuarios...</p>
                )}
                {dropdownUsers.length === 0 && query.trim().length >= 2 ? (
                  <p className="px-4 py-3 text-xs text-[hsl(var(--muted-foreground))]">No se encontraron usuarios.</p>
                ) : (
                  <>
                    {!query.trim() && initialResults.length > 0 && (
                      <p className="px-3 pt-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]/60">
                        Sugerencias
                      </p>
                    )}
                    {dropdownUsers.map(user => {
                      const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email
                      return (
                        <button
                          key={user.id}
                          onMouseDown={e => e.preventDefault()}
                          onClick={() => handleSelectUser(user)}
                          className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[hsl(var(--muted))] transition-colors text-left"
                        >
                          <UserAvatar name={fullName} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-[hsl(var(--foreground))] truncate">{fullName}</p>
                            <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">{user.email}</p>
                          </div>
                        </button>
                      )
                    })}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Selected user row — add permission + share */}
          {selectedUser && (
            <div className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-xl">
              <UserAvatar name={[selectedUser.firstName, selectedUser.lastName].filter(Boolean).join(' ') || selectedUser.email} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[hsl(var(--foreground))] truncate">
                  {[selectedUser.firstName, selectedUser.lastName].filter(Boolean).join(' ') || selectedUser.email}
                </p>
                <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">{selectedUser.email}</p>
              </div>
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

          {/* Current shares */}
          <div>
            <p className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))]/70 uppercase tracking-wider mb-2">
              Personas con acceso
            </p>

            {sharesLoading ? (
              <div className="flex items-center gap-2 py-3">
                <div className="w-4 h-4 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
                <span className="text-xs text-[hsl(var(--muted-foreground))]">Cargando...</span>
              </div>
            ) : shares.length === 0 ? (
              <div className="flex items-center gap-2.5 py-3 px-1 text-[hsl(var(--muted-foreground))]">
                <Shield className="w-4 h-4 opacity-40 shrink-0" />
                <p className="text-sm">Solo tu tienes acceso a esta nota.</p>
              </div>
            ) : (
              <div className="space-y-0.5">
                {shares.map(share => {
                  const name = share.display_name ?? share.user_email ?? '?'
                  return (
                    <div key={share.id} className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-[hsl(var(--muted))]/50 group transition-colors">
                      <UserAvatar name={name} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[hsl(var(--foreground))] truncate leading-tight">{name}</p>
                        <p className="text-xs text-[hsl(var(--muted-foreground))] truncate leading-tight">{share.user_email}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {share.permission === 'edit' ? (
                          <Eye className="w-3 h-3 text-[hsl(var(--muted-foreground))]/40 hidden group-hover:block" />
                        ) : null}
                        <PermissionSelect
                          value={share.permission}
                          onChange={val => updateShare.mutate({ noteId, shareId: share.id, permission: val })}
                        />
                        <button
                          onClick={() => revokeShare.mutate({ noteId, shareId: share.id })}
                          className="p-1.5 text-[hsl(var(--muted-foreground))]/40 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-md transition-colors opacity-0 group-hover:opacity-100"
                          title="Revocar acceso"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
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
