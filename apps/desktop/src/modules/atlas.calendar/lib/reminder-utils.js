export function getPrimaryReminderMinutes(event) {
  if (!event || !Array.isArray(event.reminders) || event.reminders.length === 0) {
    return null
  }
  const first = event.reminders[0]
  const minutes = Number(first?.minutesBefore)
  return Number.isFinite(minutes) ? minutes : null
}

export function hasReminder(event) {
  return getPrimaryReminderMinutes(event) !== null
}

export function formatReminderLead(minutes) {
  if (!Number.isFinite(minutes)) return 'Sin recordatorio'
  if (minutes === 0) return 'A la hora del evento'
  if (minutes === 60) return '1 hora antes'
  return `${minutes} minutos antes`
}

export function formatReminderClock(event, minutes) {
  if (!event?.startAt || !Number.isFinite(minutes)) return null
  const start = new Date(event.startAt)
  if (Number.isNaN(start.getTime())) return null
  const trigger = new Date(start.getTime() - minutes * 60 * 1000)
  return trigger.toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

