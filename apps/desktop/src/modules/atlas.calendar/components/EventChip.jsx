import { BellRing } from 'lucide-react'
import { hasReminder } from '../lib/reminder-utils'

export default function EventChip({ event, onClick, compact = false }) {
  const bg = event.color || event.calendar?.color || '#6B46C1'
  const reminder = hasReminder(event)

  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick?.(event) }}
      title={event.title}
      className={[
        'w-full text-left rounded px-1.5 text-white font-medium truncate cursor-pointer',
        'hover:brightness-90 transition-all',
        compact ? 'text-[11px] py-px' : 'text-xs py-0.5',
      ].join(' ')}
      style={{ backgroundColor: bg }}
    >
      <span className="flex items-center gap-1">
        {reminder && <BellRing size={compact ? 10 : 12} className="opacity-90 shrink-0" />}
        {!event.allDay && !compact && (
          <span className="opacity-80">
            {new Date(event.startAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false })}
          </span>
        )}
        <span className="truncate">{event.title}</span>
      </span>
    </button>
  )
}
