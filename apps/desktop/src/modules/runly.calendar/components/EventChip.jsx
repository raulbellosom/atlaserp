import { BellRing } from 'lucide-react'
import { hasReminder } from '../lib/reminder-utils'

export default function EventChip({
  event,
  onClick,
  compact = false,
  hideTime = false,
  hideReminder = false,
}) {
  const bg = event.color || event.calendar?.color || '#6B46C1'
  const reminder = !hideReminder && hasReminder(event)

  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick?.(event) }}
      title={event.title}
      className={[
        'w-full overflow-hidden text-left rounded px-1.5 text-white font-medium cursor-pointer',
        'hover:brightness-90 transition-all',
        compact ? 'h-5 text-[11px] leading-5 py-0' : 'text-xs py-0.5',
      ].join(' ')}
      style={{ backgroundColor: bg }}
    >
      <span className="flex min-w-0 items-center gap-1">
        {reminder && <BellRing size={compact ? 10 : 12} className="opacity-90 shrink-0" />}
        {!event.allDay && !compact && !hideTime && (
          <span className="opacity-80">
            {new Date(event.startAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false })}
          </span>
        )}
        <span className="min-w-0 flex-1 truncate">{event.title}</span>
      </span>
    </button>
  )
}
