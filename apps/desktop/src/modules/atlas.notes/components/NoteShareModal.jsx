import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@atlas/ui'
import { useNoteShares, useShareNote, useUpdateNoteShare, useRevokeNoteShare } from '../hooks/useNoteShares.js'
import { atlas } from '../../../lib/atlas'
import { useAuth } from '../../../auth/AuthProvider'

export function NoteShareModal({ noteId, open, onOpenChange }) {
  const { session } = useAuth()
  const token = session?.access_token
  const { data, isLoading } = useNoteShares(noteId)
  const shareNote = useShareNote()
  const updateShare = useUpdateNoteShare()
  const revokeShare = useRevokeNoteShare()
  const [searchEmail, setSearchEmail] = useState('')
  const [searchResult, setSearchResult] = useState(null)
  const [searching, setSearching] = useState(false)
  const [permission, setPermission] = useState('read')

  const shares = data?.shares ?? []

  async function handleSearch(e) {
    e.preventDefault()
    if (!searchEmail.trim() || !token) return
    setSearching(true)
    setSearchResult(null)
    try {
      const res = await atlas.contacts.list({ search: searchEmail.trim(), limit: 1 }, token)
      const contact = res?.contacts?.[0]
      if (contact) {
        setSearchResult(contact)
      } else {
        setSearchResult({ notFound: true })
      }
    } catch (_) {
      setSearchResult({ notFound: true })
    } finally {
      setSearching(false)
    }
  }

  function handleShare() {
    if (!searchResult || searchResult.notFound || !searchResult.user_id) return
    shareNote.mutate({
      noteId,
      targetUserId: searchResult.user_id,
      permission,
    }, {
      onSuccess: () => {
        setSearchEmail('')
        setSearchResult(null)
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Compartir nota</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 min-w-72">
          {/* Search user to share with */}
          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              type="email"
              value={searchEmail}
              onChange={e => setSearchEmail(e.target.value)}
              placeholder="Correo del usuario..."
              className="flex-1 text-sm border border-gray-200 rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-400"
            />
            <button type="submit" disabled={searching || !searchEmail} className="px-3 py-1.5 text-sm bg-amber-500 text-white rounded hover:bg-amber-600 disabled:opacity-40">
              {searching ? '...' : 'Buscar'}
            </button>
          </form>

          {searchResult && !searchResult.notFound && (
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{searchResult.name ?? searchResult.email}</p>
                <p className="text-xs text-gray-500 truncate">{searchResult.email}</p>
              </div>
              <select
                value={permission}
                onChange={e => setPermission(e.target.value)}
                className="text-xs border border-gray-200 rounded px-1 py-1"
              >
                <option value="read">Solo lectura</option>
                <option value="edit">Edicion</option>
              </select>
              <button
                onClick={handleShare}
                disabled={shareNote.isPending}
                className="px-3 py-1 text-xs bg-amber-500 text-white rounded hover:bg-amber-600 disabled:opacity-40"
              >
                Compartir
              </button>
            </div>
          )}

          {searchResult?.notFound && (
            <p className="text-xs text-red-500">No se encontro un usuario con ese correo.</p>
          )}

          {/* Current shares */}
          {isLoading ? (
            <p className="text-xs text-gray-400">Cargando...</p>
          ) : shares.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-500">Acceso actual</p>
              {shares.map(share => (
                <div key={share.id} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 truncate">{share.display_name ?? share.user_email}</p>
                    <p className="text-xs text-gray-400 truncate">{share.user_email}</p>
                  </div>
                  <select
                    value={share.permission}
                    onChange={e => updateShare.mutate({ noteId, shareId: share.id, permission: e.target.value })}
                    className="text-xs border border-gray-200 rounded px-1 py-1"
                  >
                    <option value="read">Solo lectura</option>
                    <option value="edit">Edicion</option>
                  </select>
                  <button
                    onClick={() => revokeShare.mutate({ noteId, shareId: share.id })}
                    className="text-xs text-red-400 hover:text-red-600 px-1"
                    title="Revocar acceso"
                  >x</button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400">Esta nota no se ha compartido con nadie.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
