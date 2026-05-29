import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { useCreateEvent, useUpdateEvent, useCalendars } from '../hooks/useCalendarData'
import { toast } from 'sonner'

const FREQ_OPTIONS = [
  { value: '', label: 'Sin repeticion' },
  { value: 'DAILY', label: 'Diario' },
  { value: 'WEEKLY', label: 'Semanal' },
  { value: 'MONTHLY', label: 'Mensual' },
]

function toLocalDatetimeValue(isoStr) {
  if (!isoStr) return ''
  const d = new Date(isoStr)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const EMPTY_FORM = {
  title: '', description: '', calendarId: '',
  startAt: '', endAt: '', allDay: false,
  location: '', videoUrl: '', color: '',
  recurrenceFreq: '', recurrenceInterval: 1,
}

export default function EventFormModal({ event, defaultDate, defaultCalendarId, onClose, onSaved }) {
  const isEdit = Boolean(event?.id)
  const createEvent = useCreateEvent()
  const updateEvent = useUpdateEvent()
  const { data: calData } = useCalendars()
  const allCalendars = [...(calData?.owned ?? []), ...(calData?.shared ?? [])]

  const [form, setForm] = useState(() => {
    const now = new Date()
    const base = defaultDate ? `${defaultDate}T` : `${now.toISOString().slice(0,10)}T`
    return {
      ...EMPTY_FORM,
      calendarId: defaultCalendarId || allCalendars[0]?.id || '',
      startAt: base + '09:00',
      endAt: base + '10:00',
    }
  })

  useEffect(() => {
    if (event?.id) {
      setForm({
        title: event.title ?? '',
        description: event.description ?? '',
        calendarId: event.calendarId ?? '',
        startAt: toLocalDatetimeValue(event.startAt),
        endAt: toLocalDatetimeValue(event.endAt),
        allDay: event.allDay ?? false,
        location: event.location ?? '',
        videoUrl: event.videoUrl ?? '',
        color: event.color ?? '',
        recurrenceFreq: event.recurrenceRule?.freq ?? '',
        recurrenceInterval: event.recurrenceRule?.interval ?? 1,
      })
    }
  }, [event?.id])

  useEffect(() => {
    if (!form.calendarId && allCalendars.length > 0) {
      setForm(f => ({ ...f, calendarId: allCalendars[0].id }))
    }
  }, [allCalendars.length])

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.title.trim()) { toast.error('El titulo es requerido'); return }
    if (!form.calendarId) { toast.error('Selecciona un calendario'); return }
    if (!form.startAt) { toast.error('La fecha de inicio es requerida'); return }

    const recurrenceRule = form.recurrenceFreq
      ? { freq: form.recurrenceFreq, interval: Number(form.recurrenceInterval) || 1 }
      : null

    const payload = {
      calendarId: form.calendarId,
      title: form.title.trim(),
      description: form.description.trim() || null,
      startAt: new Date(form.startAt).toISOString(),
      endAt: form.endAt ? new Date(form.endAt).toISOString() : null,
      allDay: form.allDay,
      location: form.location.trim() || null,
      videoUrl: form.videoUrl.trim() || null,
      color: form.color || null,
      recurrenceRule,
    }

    try {
      if (isEdit) {
        await updateEvent.mutateAsync({ id: event.id, ...payload })
        toast.success('Evento actualizado')
      } else {
        await createEvent.mutateAsync(payload)
        toast.success('Evento creado')
      }
      onSaved?.()
      onClose()
    } catch (err) {
      toast.error(err.message || 'Error al guardar el evento')
    }
  }

  const isPending = createEvent.isPending || updateEvent.isPending

  const inputCls = 'w-full text-sm rounded-lg border border-[hsl(var(--border))] px-2.5 py-1.5 bg-[hsl(var(--surface-2))] text-[hsl(var(--foreground))] outline-none focus:border-violet-500 transition-colors'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        className="bg-[hsl(var(--surface-1))] rounded-xl shadow-xl w-full max-w-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[hsl(var(--border))]">
          <h2 className="text-base font-semibold text-[hsl(var(--foreground))]">
            {isEdit ? 'Editar evento' : 'Nuevo evento'}
          </h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded hover:bg-[hsl(var(--muted))]">
            <X size={15} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3 max-h-[70vh] overflow-y-auto">
          <input
            type="text"
            placeholder="Titulo del evento *"
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            className="w-full text-base font-medium bg-transparent border-b border-[hsl(var(--border))] pb-2 outline-none text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:border-violet-500 transition-colors"
            required
            autoFocus
          />

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.allDay} onChange={(e) => set('allDay', e.target.checked)} className="rounded" />
            <span className="text-sm text-[hsl(var(--foreground))]">Todo el dia</span>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[hsl(var(--muted-foreground))] mb-1 block">Inicio *</label>
              <input
                type={form.allDay ? 'date' : 'datetime-local'}
                value={form.allDay ? form.startAt.slice(0,10) : form.startAt}
                onChange={(e) => set('startAt', e.target.value)}
                className={inputCls}
                required
              />
            </div>
            <div>
              <label className="text-xs text-[hsl(var(--muted-foreground))] mb-1 block">Fin</label>
              <input
                type={form.allDay ? 'date' : 'datetime-local'}
                value={form.allDay ? (form.endAt?.slice(0,10) ?? '') : form.endAt}
                onChange={(e) => set('endAt', e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-[hsl(var(--muted-foreground))] mb-1 block">Calendario *</label>
            <select value={form.calendarId} onChange={(e) => set('calendarId', e.target.value)} className={inputCls} required>
              <option value="">Seleccionar...</option>
              {allCalendars.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <textarea
            placeholder="Descripcion (opcional)"
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            rows={2}
            className={inputCls + ' resize-none'}
          />

          <input
            type="text"
            placeholder="Ubicacion"
            value={form.location}
            onChange={(e) => set('location', e.target.value)}
            className={inputCls}
          />

          <input
            type="url"
            placeholder="URL de videollamada (https://...)"
            value={form.videoUrl}
            onChange={(e) => set('videoUrl', e.target.value)}
            className={inputCls}
          />

          <div>
            <label className="text-xs text-[hsl(var(--muted-foreground))] mb-1 block">Repeticion</label>
            <select value={form.recurrenceFreq} onChange={(e) => set('recurrenceFreq', e.target.value)} className={inputCls}>
              {FREQ_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {form.recurrenceFreq && (
            <div>
              <label className="text-xs text-[hsl(var(--muted-foreground))] mb-1 block">Intervalo</label>
              <input
                type="number"
                min={1}
                max={99}
                value={form.recurrenceInterval}
                onChange={(e) => set('recurrenceInterval', e.target.value)}
                className={inputCls}
              />
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[hsl(var(--border))]">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm rounded-lg hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="px-4 py-1.5 text-sm rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-medium disabled:opacity-50"
          >
            {isPending ? 'Guardando...' : isEdit ? 'Actualizar' : 'Crear evento'}
          </button>
        </div>
      </form>
    </div>
  )
}
