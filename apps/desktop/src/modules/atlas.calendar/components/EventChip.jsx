export default function EventChip({ event, onClick, compact = false }) {
  const bg = event.color || event.calendar?.color || '#6B46C1'

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
      {!event.allDay && !compact && (
        <span className="opacity-80 mr-1">
          {new Date(event.startAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false })}
        </span>
      )}
      {event.title}
    </button>
  )
}
