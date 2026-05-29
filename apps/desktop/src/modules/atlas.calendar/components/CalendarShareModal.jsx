import { useState } from 'react'
import { X, Trash2 } from 'lucide-react'
import { useShareCalendar, useUpdateShare, useDeleteShare } from '../hooks/useCalendarData'
import { toast } from 'sonner'

const ROLES = [
  { value: 'VIEWER', label: 'Solo ver' },
  { value: 'EDITOR', label: 'Editar eventos' },
  { value: 'MANAGER', label: 'Gestionar todo' },
]

export default function CalendarShareModal({ calendar, onClose }) {
  const shareCalendar = useShareCalendar()
  const updateShare = useUpdateShare()
  const deleteShare = useDeleteShare()
  const [userId, setUserId] = useState('')
  const [role, setRole] = useState('VIEWER')

  const shares = calendar?.shares ?? []

  async function handleAdd(e) {
    e.preventDefault()
    if (!userId.trim()) { toast.error('Ingresa un ID de usuario'); return }
    try {
      await shareCalendar.mutateAsync({ calendarId: calendar.id, userId: userId.trim(), role })
      toast.success('Acceso compartido')
      setUserId('')
    } catch (err) {
      toast.error(err.message || 'Error al compartir')
    }
  }

  async function handleRoleChange(shareId, newRole) {
    try {
      await updateShare.mutateAsync({ calendarId: calendar.id, shareId, role: newRole })
      toast.success('Rol actualizado')
    } catch (err) {
      toast.error(err.message || 'Error al actualizar')
    }
  }

  async function handleRevoke(shareId) {
    try {
      await deleteShare.mutateAsync({ calendarId: calendar.id, shareId })
      toast.success('Acceso revocado')
    } catch (err) {
      toast.error(err.message || 'Error al revocar')
    }
  }

  const selectCls = 'text-xs rounded border border-[hsl(var(--border))] px-1.5 py-1 bg-[hsl(var(--surface-2))] text-[hsl(var(--foreground))] outline-none'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className="bg-[hsl(var(--surface-1))] rounded-xl shadow-xl w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[hsl(var(--border))]">
          <h2 className="text-base font-semibold text-[hsl(var(--foreground))] truncate">
            Compartir "{calendar?.name}"
          </h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded hover:bg-[hsl(var(--muted))] shrink-0">
            <X size={15} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <form onSubmit={handleAdd} className="flex gap-2">
            <input
              type="text"
              placeholder="ID del usuario a invitar"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="flex-1 text-sm rounded-lg border border-[hsl(var(--border))] px-3 py-1.5 bg-[hsl(var(--surface-2))] text-[hsl(var(--foreground))] outline-none focus:border-violet-500"
            />
            <select value={role} onChange={(e) => setRole(e.target.value)} className={selectCls + ' text-sm px-2 py-1.5'}>
              {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
            <button
              type="submit"
              disabled={shareCalendar.isPending}
              className="px-3 py-1.5 text-sm rounded-lg bg-violet-600 text-white font-medium hover:bg-violet-700 disabled:opacity-50 whitespace-nowrap"
            >
              Invitar
            </button>
          </form>

          {shares.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-[hsl(var(--muted-foreground))] mb-2">Accesos actuales</div>
              <div className="space-y-2">
                {shares.map((s) => (
                  <div key={s.id} className="flex items-center gap-2 py-1 border-b border-[hsl(var(--border))]/50 last:border-0">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-[hsl(var(--foreground))] truncate">
                        {s.user?.firstName && s.user?.lastName
                          ? `${s.user.firstName} ${s.user.lastName}`
                          : s.user?.email ?? s.userId}
                      </div>
                    </div>
                    <select
                      value={s.role}
                      onChange={(e) => handleRoleChange(s.id, e.target.value)}
                      className={selectCls}
                    >
                      {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                    <button
                      onClick={() => handleRevoke(s.id)}
                      disabled={deleteShare.isPending}
                      className="p-1 rounded hover:bg-[hsl(var(--muted))] disabled:opacity-50"
                    >
                      <Trash2 size={13} className="text-[hsl(var(--muted-foreground))]" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {shares.length === 0 && (
            <p className="text-xs text-[hsl(var(--muted-foreground))] text-center py-2">
              Este calendario no tiene accesos compartidos aun.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
