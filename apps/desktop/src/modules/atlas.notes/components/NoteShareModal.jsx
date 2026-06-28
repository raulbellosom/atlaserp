import { useState, useEffect, useRef } from 'react'
import { Search, X, Check, UserPlus, Shield, Users } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@atlas/ui'
import { NoteIcon } from '../noteIcons.jsx'
import { useNoteShares, useShareNote, useUpdateNoteShare, useRevokeNoteShare } from '../hooks/useNoteShares.js'
import { atlas } from '../../../lib/atlas'
import { useAuth } from '../../../auth/AuthProvider'

const PERMISSION_OPTIONS = [
  { value: 'read',  label: 'Solo lectura' },
  { value: 'edit',  label: 'Puede editar' },
]

function UserAvatar({ name, avatarUrl, size = 'md' }) {
  const dim = size === 'sm' ? 'w-7 h-7 text-xs' : 'w-8 h-8 text-sm'
  const initial = (name ?? '?')[0].toUpperCase()
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className={`${dim} rounded-full object-cover shrink-0 select-none`}
      />
    )
  }
  return (
    <div className={`${dim} rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 font-semibold flex items-center justify-center shrink-0 select-none`}>
      {initial}
    </div>
  )
}

function PermissionSelect({ value, onChange }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-7 w-28 text-xs px-2 py-0 rounded-lg gap-1 shrink-0">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {PERMISSION_OPTIONS.map(o => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function NoteShareModal({ note, noteId, open, onOpenChange }) {
  const id = note?.id ?? noteId
  const { session } = useAuth()
  const token = session?.access_token
  const { data, isLoading: sharesLoading } = useNoteShares(id)
  const shareNote   = useShareNote()
  const updateShare = useUpdateNoteShare()
  const revokeShare = useRevokeNoteShare()

  const [query, setQuery]               = useState('')
  const [userList, setUserList]         = useState([])
  const [searching, setSearching]       = useState(false)
  const [selectedUser, setSelectedUser] = useState(null)
  const [permission, setPermission]     = useState('read')
  const searchRef   = useRef(null)
  const debounceRef = useRef(null)

  const shares = data?.shares ?? []
  const sharedIds = new Set(shares.map(s => s.shared_with_user_id))

  useEffect(() => {
    if (!open || !token) return
    const t = setTimeout(() => searchRef.current?.focus(), 80)
    atlas.identity.listUsers(token, { pageSize: 12 })
      .then(res => setUserList((res?.data ?? []).filter(u => !sharedIds.has(u.id))))
      .catch(() => {})
    return () => clearTimeout(t)
  }, [open, token, shares.length])

  useEffect(() => {
    clearTimeout(debounceRef.current)
    if (!query.trim() || query.length < 2) {
      if (!query.trim() && token) {
        atlas.identity.listUsers(token, { pageSize: 12 })
          .then(res => setUserList((res?.data ?? []).filter(u => !sharedIds.has(u.id))))
          .catch(() => {})
      }
      return
    }
    debounceRef.current = setTimeout(async () => {
      if (!token) return
      setSearching(true)
      try {
        const res = await atlas.identity.listUsers(token, { search: query.trim(), pageSize: 12 })
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
      { noteId: id, targetUserId: selectedUser.id, permission },
      {
        onSuccess: () => {
          setSelectedUser(null)
          setQuery('')
          setPermission('read')
        },
      },
    )
  }

  const bgColor = note?.background_color ?? null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl">
        {/* Colored strip tied to note background */}
        {bgColor && (
          <div
            className="absolute inset-x-0 top-0 h-1.5 rounded-t-2xl md:rounded-t-xl"
            style={{ backgroundColor: bgColor }}
          />
        )}

        <DialogHeader className={bgColor ? 'pt-1' : ''}>
          <DialogTitle className="flex items-center gap-2 min-w-0">
            {note?.icon && <NoteIcon name={note.icon} size={15} className="text-amber-500 shrink-0" />}
            <span className="shrink-0">Compartir nota</span>
            {note?.title && (
              <span className="text-sm font-normal text-muted-foreground truncate">
                — {note.title}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* ── Responsive two-panel layout ── */}
        <div className="flex flex-col md:flex-row gap-4 md:gap-5 mt-1">

          {/* ── Left / top panel: search + user list ── */}
          <div className="flex-1 flex flex-col gap-3 min-w-0">

            {/* Search input */}
            <div className={[
              'flex items-center gap-2 px-3 py-2.5 border rounded-xl transition-colors',
              'bg-[hsl(var(--background))] border-[hsl(var(--border))]',
              'focus-within:border-amber-400 focus-within:ring-1 focus-within:ring-amber-400/40',
            ].join(' ')}>
              <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={e => { setQuery(e.target.value); setSelectedUser(null) }}
                placeholder="Buscar por nombre o correo..."
                className="flex-1 min-w-0 text-sm bg-transparent focus:outline-none text-foreground placeholder:text-muted-foreground"
              />
              {searching && (
                <div className="w-3.5 h-3.5 rounded-full border-2 border-amber-400 border-t-transparent animate-spin shrink-0" />
              )}
              {query && !searching && (
                <button
                  onClick={() => { setQuery(''); setSelectedUser(null) }}
                  className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* User results */}
            <div className="overflow-y-auto rounded-xl border border-border max-h-52 md:max-h-64">
              {userList.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 gap-2 text-muted-foreground">
                  <Users className="w-7 h-7 opacity-30" />
                  <p className="text-sm">
                    {query.trim().length >= 2
                      ? `Sin resultados para "${query}"`
                      : 'Cargando usuarios...'}
                  </p>
                </div>
              ) : (
                <>
                  <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 sticky top-0 bg-background">
                    {query.trim().length >= 2 ? 'Resultados' : 'Sugerencias'}
                  </p>
                  {userList.map(user => {
                    const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email
                    const isSelected = selectedUser?.id === user.id
                    return (
                      <button
                        key={user.id}
                        onClick={() => setSelectedUser(prev => prev?.id === user.id ? null : user)}
                        className={[
                          'w-full flex items-center gap-3 px-3 py-2.5 transition-colors text-left',
                          isSelected ? 'bg-amber-50 dark:bg-amber-950/30' : 'hover:bg-muted',
                        ].join(' ')}
                      >
                        <UserAvatar name={fullName} avatarUrl={user.avatarUrl} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate leading-tight">{fullName}</p>
                          <p className="text-xs text-muted-foreground truncate leading-tight">{user.email}</p>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-amber-500 shrink-0" />}
                      </button>
                    )
                  })}
                </>
              )}
            </div>

            {/* Add selected user row */}
            {selectedUser && (
              <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/30 rounded-xl">
                <UserAvatar
                  name={[selectedUser.firstName, selectedUser.lastName].filter(Boolean).join(' ') || selectedUser.email}
                  avatarUrl={selectedUser.avatarUrl}
                  size="sm"
                />
                <p className="flex-1 min-w-0 text-sm font-medium text-foreground truncate">
                  {[selectedUser.firstName, selectedUser.lastName].filter(Boolean).join(' ') || selectedUser.email}
                </p>
                <PermissionSelect value={permission} onChange={setPermission} />
                <button
                  onClick={handleShare}
                  disabled={shareNote.isPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors disabled:opacity-40 shrink-0"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Agregar</span>
                </button>
              </div>
            )}
          </div>

          {/* ── Divider: horizontal on mobile, vertical on desktop ── */}
          <div className="h-px bg-border md:h-auto md:w-px md:self-stretch" />

          {/* ── Right / bottom panel: current shares ── */}
          <div className="md:w-56 md:shrink-0 flex flex-col gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              Personas con acceso
            </p>

            {sharesLoading ? (
              <div className="flex items-center gap-2 py-2">
                <div className="w-4 h-4 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
                <span className="text-xs text-muted-foreground">Cargando...</span>
              </div>
            ) : shares.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-5 text-center">
                <Shield className="w-7 h-7 text-muted-foreground/30" />
                <p className="text-xs text-muted-foreground leading-snug">
                  Solo tu tienes acceso a esta nota
                </p>
              </div>
            ) : (
              <div className="space-y-0.5 overflow-y-auto max-h-48 md:max-h-64">
                {shares.map(share => {
                  const name = share.display_name ?? share.user_email ?? '?'
                  return (
                    <div
                      key={share.id}
                      className="flex items-center gap-2 px-2 py-2 rounded-xl hover:bg-muted/60 group transition-colors"
                    >
                      <UserAvatar name={name} avatarUrl={null} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate leading-tight">{name}</p>
                        <p className="text-[10px] text-muted-foreground truncate leading-tight">{share.user_email}</p>
                      </div>
                      {/* Collapsed: badge; hover: controls */}
                      <div className="group-hover:hidden shrink-0">
                        <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${
                          share.permission === 'edit'
                            ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
                            : 'bg-muted text-muted-foreground'
                        }`}>
                          {share.permission === 'edit' ? 'Edita' : 'Lee'}
                        </span>
                      </div>
                      <div className="hidden group-hover:flex items-center gap-1 shrink-0">
                        <PermissionSelect
                          value={share.permission}
                          onChange={val => updateShare.mutate({ noteId: id, shareId: share.id, permission: val })}
                        />
                        <button
                          onClick={() => revokeShare.mutate({ noteId: id, shareId: share.id })}
                          className="p-1 text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-md transition-colors"
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
