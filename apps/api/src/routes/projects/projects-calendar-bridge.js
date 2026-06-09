export function createProjectsCalendarBridge({ prisma }) {
  function isCalendarAvailable() {
    return typeof prisma.calendarCalendar?.create === 'function'
  }

  async function syncProjectCalendar(project) {
    if (!isCalendarAvailable()) return null
    try {
      if (project.calendarId) {
        await prisma.calendarCalendar.update({
          where: { id: project.calendarId },
          data: { name: project.name, color: project.color ?? '#6366f1' },
        })
        return project.calendarId
      }
      const calendar = await prisma.calendarCalendar.create({
        data: {
          ownerId: project.ownerId,
          name: project.name,
          color: project.color ?? '#6366f1',
          isDefault: false,
        },
      })
      await prisma.project.update({
        where: { id: project.id },
        data: { calendarId: calendar.id },
      })
      return calendar.id
    } catch {
      return null
    }
  }

  async function grantMemberCalendarAccess(calendarId, userId) {
    if (!isCalendarAvailable() || !calendarId) return
    try {
      const existing = await prisma.calendarShare.findFirst({ where: { calendarId, userId } })
      if (existing) return
      await prisma.calendarShare.create({ data: { calendarId, userId, role: 'VIEWER' } })
    } catch {
      // Calendar access is best-effort — never block project operations
    }
  }

  async function revokeMemberCalendarAccess(calendarId, userId) {
    if (!isCalendarAvailable() || !calendarId) return
    try {
      await prisma.calendarShare.deleteMany({ where: { calendarId, userId } })
    } catch {
      // Silently ignore
    }
  }

  async function syncTaskEvent(task, calendarId) {
    if (!isCalendarAvailable() || !calendarId || !task.dueDate) {
      if (task.calendarEventId) {
        await deleteTaskEvent(task.calendarEventId)
        await prisma.task.update({ where: { id: task.id }, data: { calendarEventId: null } })
      }
      return null
    }
    try {
      // Use date-only (midnight UTC) to avoid timezone shift in all-day event display
      const toDateUTC = (d) => {
        const s = new Date(d).toISOString().split('T')[0]
        return new Date(s + 'T00:00:00.000Z')
      }
      const startAt = toDateUTC(task.startDate ?? task.dueDate)
      const endAt = toDateUTC(task.dueDate)
      const eventData = {
        calendarId,
        title: task.title,
        startAt,
        endAt,
        allDay: true,
        sourceModule: 'atlas.projects',
        sourceEntityId: task.id,
      }
      if (task.calendarEventId) {
        await prisma.calendarEvent.update({
          where: { id: task.calendarEventId },
          data: { title: eventData.title, startAt: eventData.startAt, endAt: eventData.endAt, allDay: true },
        })
        return task.calendarEventId
      }
      const event = await prisma.calendarEvent.create({ data: eventData })
      await prisma.task.update({ where: { id: task.id }, data: { calendarEventId: event.id } })
      return event.id
    } catch {
      return null
    }
  }

  async function deleteTaskEvent(eventId) {
    if (!isCalendarAvailable() || !eventId) return
    try {
      await prisma.calendarEvent.delete({ where: { id: eventId } })
    } catch {
      // Event may already be deleted
    }
  }

  return {
    syncProjectCalendar,
    grantMemberCalendarAccess,
    revokeMemberCalendarAccess,
    syncTaskEvent,
    deleteTaskEvent,
  }
}
