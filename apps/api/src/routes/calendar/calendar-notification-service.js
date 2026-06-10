import { CalendarServiceError } from './calendar-service.js'
import { createNotificationService } from '../../services/notification-service.js'

// Returns the configured instance timezone from DB, falling back to Mexico City.
async function getInstanceTimeZone(prisma) {
  try {
    const row = await prisma.instanceConfig.findFirst({
      where: { key: 'instance_time_zone' },
      select: { value: true },
    })
    return row?.value || 'America/Mexico_City'
  } catch {
    return 'America/Mexico_City'
  }
}

// Returns a Date representing 9:00 AM on the same calendar day as utcMidnightDate
// but expressed in the given IANA timezone (handles DST correctly).
function getNineAMInTimeZone(utcMidnightDate, timeZone) {
  const hourInTz = Number(
    new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', hour12: false }).format(utcMidnightDate)
  )
  let hoursToAdd = 9 - hourInTz
  if (hoursToAdd < 0) hoursToAdd += 24
  const candidate = new Date(utcMidnightDate.getTime() + hoursToAdd * 60 * 60 * 1000)
  // Verify and adjust for DST edge cases (e.g. spring-forward at 2 AM).
  const actualHour = Number(
    new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', hour12: false }).format(candidate)
  )
  if (actualHour !== 9) {
    return new Date(candidate.getTime() + (9 - actualHour) * 60 * 60 * 1000)
  }
  return candidate
}

export function createCalendarNotificationService({ prisma }) {
  async function getNotifications(userId, { unreadOnly = true } = {}) {
    return prisma.calendarNotification.findMany({
      where: {
        userId,
        ...(unreadOnly ? { readAt: null } : {}),
      },
      include: {
        event: {
          select: { id: true, title: true, startAt: true, calendarId: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
  }

  async function markRead(userId, notificationId) {
    const notification = await prisma.calendarNotification.findFirst({
      where: { id: notificationId, userId },
    })
    if (!notification) throw new CalendarServiceError('Notificacion no encontrada.', 404)
    return prisma.calendarNotification.update({
      where: { id: notificationId },
      data: { readAt: new Date() },
    })
  }

  async function markAllRead(userId) {
    await prisma.calendarNotification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    })
  }

  async function processReminders() {
    const now = new Date()
    const notificationSvc = createNotificationService({ prisma })
    const instanceTz = await getInstanceTimeZone(prisma)

    const pendingReminders = await prisma.calendarReminder.findMany({
      where: { sentAt: null },
      include: {
        event: { select: { id: true, title: true, startAt: true, allDay: true, enabled: true } },
      },
    })

    const toFire = pendingReminders.filter((r) => {
      if (!r.event.enabled) return false
      let baseTime = r.event.startAt.getTime()
      if (r.event.allDay) {
        const d = new Date(r.event.startAt)
        // Only normalize when startAt is midnight UTC — this happens when the user
        // selects a date without a time component (pure date-only all-day event).
        // Events stored with an explicit local time (e.g. T09:00 local) are used as-is.
        if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0) {
          baseTime = getNineAMInTimeZone(d, instanceTz).getTime()
        }
      }
      const triggerTime = new Date(baseTime - r.minutesBefore * 60 * 1000)
      return triggerTime <= now
    })

    if (!toFire.length) return { processed: 0 }

    await prisma.calendarNotification.createMany({
      data: toFire.map((r) => ({
        userId: r.userId,
        eventId: r.eventId,
        type: 'REMINDER',
      })),
      skipDuplicates: true,
    })

    await prisma.calendarReminder.updateMany({
      where: { id: { in: toFire.map((r) => r.id) } },
      data: { sentAt: now },
    })

    let published = 0
    for (const reminder of toFire) {
      try {
        const membership = await prisma.membership.findFirst({
          where: { userId: reminder.userId, enabled: true },
          select: { companyId: true },
        })
        if (!membership?.companyId) continue
        const title = reminder.event?.title ?? 'Evento'
        await notificationSvc.publish({
          companyId: membership.companyId,
          actorId: null,
          input: {
            eventType: 'calendar.event.reminder',
            title: `Recordatorio: ${title}`,
            body: `Tu evento comienza pronto (${reminder.minutesBefore} min antes).`,
            link: `/app/m/atlas.calendar?open=event:${reminder.eventId}`,
            recipients: { userIds: [reminder.userId] },
            channels: ['in_app', 'email', 'web_push'],
            priority: 'high',
            sourceType: 'CalendarEvent',
            sourceId: reminder.eventId,
            dedupeKey: `calendar.reminder:${reminder.id}`,
            metadata: {
              minutesBefore: reminder.minutesBefore,
              startAt: reminder.event?.startAt ?? null,
            },
          },
        })
        published += 1
      } catch (err) {
        console.error('[calendar.reminder.notification]', err?.message ?? err)
      }
    }

    return { processed: toFire.length, published }
  }

  return { getNotifications, markRead, markAllRead, processReminders }
}
