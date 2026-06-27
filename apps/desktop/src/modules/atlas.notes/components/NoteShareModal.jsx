import { useState, useEffect, useRef } from 'react'
import { Search, X, Check, ChevronDown } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  SelectField,
} from '@atlas/ui'
import { useNoteShares, useShareNote, useUpdateNoteShare, useRevokeNoteShare } from '../hooks/useNoteShares.js'
import { atlas } from '../../../lib/atlas'
import { useAuth } from '../../../auth/AuthProvider'

const PERMISSION_OPTIONS = [
  { value: 'read',  label: 'Solo lectura' },
  { value: 'edit',  label: 'Edicion' },
]

function UserAvatar({ user, size = 'sm' }) {
  const initials = [user.firstName, user.lastName]
    .filter(Boolean).map(s => s[0]).join('').toUpperCase() || (user.email?.[0] ?? '?').toUpperCase()
  const dim = size === 'sm' ? 'w-8 h-8 text-xs' : 'w-9 h-9 text-sm'
  if (user.avatarUrl) {
    return <img src={user.avatarUrl} className={`${dim} rounded-full object-cover shrink-0`} alt={initials} />
  }
  return (
    <div className={`${dim} rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 font-semibold flex items-center justify-center shrink-0`}>
      {initials}
    </div>
  )
}

export function NoteShareModal({ noteId, open, onOpenChange }) {
  const { session } = useAuth()
  const token = session?.access_token
  const { data, isLoading: sharesLoading } = useNoteShares(noteId)
  const shareNote = useShareNote()
  const updateShare = useUpdateNoteShare()
  const revokeShare = useRevokeNoteShare()

  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [permission, setPermission] = useState('read')
  const [selectedUser, setSelectedUser] = useState(null)
  const searchRef = useRef(null)
  const debounceRef = useRef(null)

  const shares = data?.shares ?? []

  // Live search as user types
  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setResults([])
      setShowDropdown(false)
      return
    }
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      if (!token) return
      setSearching(true)
      try {
        const res = await atlas.identity.listUsers(token, { search: query.trim(), pageSize: 8 })
        const users = res?.data ?? []
        // Exclude already-shared users
        const sharedIds = new Set(shares.map(s => s.user_id))
        setResults(users.filter(u => !sharedIds.has(u.id)))
        setShowDropdown(true)
      } catch (_) {
        setResults([])
      } finally {
        setSearching(false)
      }
    }, 280)
    return () => clearTimeout(debounceRef.current)
  }, [query, token, shares])

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
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Compartir nota</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 min-w-80">

          {/* User search */}
          <div className="relative">
            <div className={[
              'flex items-center gap-2 px-3 py-2 border rounded-lg transition-colors',
              showDropdown ? 'border-amber-400 ring-1 ring-amber-400' : 'border-border',
              'bg-background',
            ].join(' ')}>
              <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={e => { setQuery(e.target.value); setSelectedUser(null) }}
                onFocus={() => results.length > 0 && setShowDropdown(true)}
                placeholder="Buscar por nombre, apellido o correo..."
                className="flex-1 text-sm bg-transparent focus:outline-none text-foreground placeholder:text-muted-foreground"
              />
              {searching && (
                <div className="w-3.5 h-3.5 rounded-full border-2 border-amber-400 border-t-transparent animate-spin shrink-0" />
              )}
              {query && !searching && (
                <button onClick={handleClear} className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Results dropdown */}
            {showDropdown && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg z-50 overflow-hidden">
                {results.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-muted-foreground">No se encontraron usuarios.</p>
                ) : (
                  results.map(user => (
                    <button
                      key={user.id}
                      onClick={() => handleSelectUser(user)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted transition-colors text-left"
                    >
                      <UserAvatar user={user} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {[user.firstName, user.lastName].filter(Boolean).join(' ') || user.email}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Selected user + permission + share button */}
          {selectedUser && (
            <div className="flex items-center gap-3 p-3 bg-muted/50 border border-border rounded-lg">
              <UserAvatar user={selectedUser} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {[selectedUser.firstName, selectedUser.lastName].filter(Boolean).join(' ') || selectedUser.email}
                </p>
                <p className="text-xs text-muted-foreground truncate">{selectedUser.email}</p>
              </div>
              <SelectField
                value={permission}
                onChange={e => setPermission(e.target.value)}
                options={PERMISSION_OPTIONS}
                className="w-36"
              />
              <button
                onClick={handleShare}
                disabled={shareNote.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors disabled:opacity-40 shrink-0"
              >
                <Check className="w-3.5 h-3.5" />
                Compartir
              </button>
            </div>
          )}

          {/* Divider */}
          <div className="border-t border-border" />

          {/* Current shares */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Acceso actual</p>
            {sharesLoading ? (
              <div className="flex items-center gap-2 py-3">
                <div className="w-4 h-4 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
                <span className="text-xs text-muted-foreground">Cargando...</span>
              </div>
            ) : shares.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">Esta nota no se ha compartido con nadie.</p>
            ) : (
              <div className="space-y-1">
                {shares.map(share => (
                  <div key={share.id} className="flex items-center gap-3 py-2 px-1 rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground shrink-0">
                      {(share.display_name ?? share.user_email ?? '?')[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{share.display_name ?? share.user_email}</p>
                      <p className="text-xs text-muted-foreground truncate">{share.user_email}</p>
                    </div>
                    <SelectField
                      value={share.permission}
                      onChange={e => updateShare.mutate({ noteId, shareId: share.id, permission: e.target.value })}
                      options={PERMISSION_OPTIONS}
                      className="w-36"
                    />
                    <button
                      onClick={() => revokeShare.mutate({ noteId, shareId: share.id })}
                      className="p-1.5 text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors shrink-0"
                      title="Revocar acceso"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
