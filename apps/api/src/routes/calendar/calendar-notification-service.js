import { CalendarServiceError } from './calendar-service.js'
import { createNotificationService } from '../../services/notification-service.js'

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
    const pendingReminders = await prisma.calendarReminder.findMany({
      where: { sentAt: null },
      include: {
        event: { select: { id: true, title: true, startAt: true, enabled: true } },
      },
    })

    const toFire = pendingReminders.filter((r) => {
      if (!r.event.enabled) return false
      const triggerTime = new Date(r.event.startAt.getTime() - r.minutesBefore * 60 * 1000)
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
            link: `/app/m/atlas.calendar?eventId=${reminder.eventId}`,
            recipients: { userIds: [reminder.userId] },
            channels: ['in_app', 'email'],
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
