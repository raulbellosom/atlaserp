import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { useCreateCalendar, useUpdateCalendar } from '../hooks/useCalendarData'
import { toast } from 'sonner'

const COLORS = ['#6B46C1','#2563EB','#16A34A','#DC2626','#D97706','#DB2777','#0891B2','#7C3AED']

export default function CalendarFormModal({ calendar, onClose }) {
  const isEdit = Boolean(calendar?.id)
  const createCalendar = useCreateCalendar()
  const updateCalendar = useUpdateCalendar()
  const [name, setName] = useState(calendar?.name ?? '')
  const [color, setColor] = useState(calendar?.color ?? COLORS[0])

  useEffect(() => {
    if (calendar) { setName(calendar.name); setColor(calendar.color) }
  }, [calendar?.id])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) { toast.error('El nombre es requerido'); return }
    try {
      if (isEdit) {
        await updateCalendar.mutateAsync({ id: calendar.id, name: name.trim(), color })
        toast.success('Calendario actualizado')
      } else {
        await createCalendar.mutateAsync({ name: name.trim(), color })
        toast.success('Calendario creado')
      }
      onClose()
    } catch (err) {
      toast.error(err.message || 'Error al guardar')
    }
  }

  const isPending = createCalendar.isPending || updateCalendar.isPending

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        className="bg-[hsl(var(--surface-1))] rounded-xl shadow-xl w-full max-w-sm overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[hsl(var(--border))]">
          <h2 className="text-base font-semibold text-[hsl(var(--foreground))]">
            {isEdit ? 'Editar calendario' : 'Nuevo calendario'}
          </h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded hover:bg-[hsl(var(--muted))]">
            <X size={15} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <input
            type="text"
            placeholder="Nombre del calendario"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full text-sm rounded-lg border border-[hsl(var(--border))] px-3 py-2 bg-[hsl(var(--surface-2))] text-[hsl(var(--foreground))] outline-none focus:border-violet-500 transition-colors"
            required
            autoFocus
          />
          <div>
            <div className="text-xs text-[hsl(var(--muted-foreground))] mb-2">Color</div>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={['w-7 h-7 rounded-full border-2 transition-all', color === c ? 'border-white scale-110 shadow-md ring-2 ring-offset-1' : 'border-transparent'].join(' ')}
                  style={{ backgroundColor: c, '--tw-ring-color': c }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[hsl(var(--border))]">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm rounded-lg hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]">
            Cancelar
          </button>
          <button type="submit" disabled={isPending} className="px-4 py-1.5 text-sm rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-medium disabled:opacity-50">
            {isPending ? 'Guardando...' : isEdit ? 'Actualizar' : 'Crear'}
          </button>
        </div>
      </form>
    </div>
  )
}
