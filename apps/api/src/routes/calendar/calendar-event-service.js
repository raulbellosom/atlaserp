import { CalendarServiceError } from './calendar-service.js'

function expandRecurrence(event, rangeStart, rangeEnd) {
  const rule = event.recurrenceRule
  if (!rule) return []

  const instances = []
  const { freq, interval = 1, until, count } = rule
  const start = new Date(event.startAt)
  const duration = event.endAt ? new Date(event.endAt) - start : 60 * 60 * 1000
  const rangeStartMs = new Date(rangeStart).getTime()
  const rangeEndMs = new Date(rangeEnd).getTime()
  const untilMs = until ? new Date(until).getTime() : Infinity
  const maxInstances = count ?? 365

  let current = new Date(start)
  let generated = 0

  while (current.getTime() <= rangeEndMs && current.getTime() <= untilMs && generated < maxInstances) {
    if (current.getTime() >= rangeStartMs) {
      const instanceEnd = new Date(current.getTime() + duration)
      instances.push({
        ...event,
        id: `${event.id}_${current.toISOString().slice(0, 10).replace(/-/g, '')}`,
        startAt: new Date(current),
        endAt: instanceEnd,
        _isRecurrenceInstance: true,
        _baseEventId: event.id,
      })
      generated++
    }

    if (freq === 'DAILY') {
      current = new Date(current.getTime() + interval * 24 * 60 * 60 * 1000)
    } else if (freq === 'WEEKLY') {
      current = new Date(current.getTime() + interval * 7 * 24 * 60 * 60 * 1000)
    } else if (freq === 'MONTHLY') {
      const next = new Date(current)
      next.setMonth(next.getMonth() + interval)
      current = next
    } else {
      break
    }
  }

  return instances
}

export function createCalendarEventService({ prisma }) {
  async function getAccessibleCalendarIds(userId) {
    const owned = await prisma.calendarCalendar.findMany({
      where: { ownerId: userId, enabled: true },
      select: { id: true },
    })
    const shared = await prisma.calendarShare.findMany({
      where: { userId },
      select: { calendarId: true },
    })
    return [
      ...owned.map((c) => c.id),
      ...shared.map((s) => s.calendarId),
    ]
  }

  async function listEvents({ userId, start, end, calendarIds, sourceModule, sourceEntityId }) {
    if (!start || !end) throw new CalendarServiceError('start y end son requeridos.', 400)

    const accessibleIds = await getAccessibleCalendarIds(userId)
    const filterIds = calendarIds?.length
      ? calendarIds.filter((id) => accessibleIds.includes(id))
      : accessibleIds

    if (!filterIds.length) return []

    // Fetch all events that could produce instances in the range:
    // - non-recurring: startAt in [start, end] (filtered in JS below)
    // - recurring: startAt <= end (any series that could have future instances)
    // We avoid JSON-field null filtering (not supported in Prisma 7 Json columns)
    // by fetching all events with startAt <= end and filtering non-recurring ones in JS.
    const events = await prisma.calendarEvent.findMany({
      where: {
        calendarId: { in: filterIds },
        enabled: true,
        startAt: { lte: new Date(end) },
        ...(sourceModule ? { sourceModule } : {}),
        ...(sourceEntityId ? { sourceEntityId } : {}),
      },
      include: {
        calendar: { select: { id: true, name: true, color: true, ownerId: true } },
        attendees: { include: { user: { select: { id: true, firstName: true, lastName: true } } } },
      },
      orderBy: { startAt: 'asc' },
    })

    const rangeStartMs = new Date(start).getTime()
    const result = []
    for (const event of events) {
      if (!event.recurrenceRule) {
        // Non-recurring: include only if startAt is within [start, end]
        if (new Date(event.startAt).getTime() >= rangeStartMs) {
          result.push(event)
        }
      } else {
        const instances = expandRecurrence(event, start, end)
        result.push(...instances)
      }
    }

    return result.sort((a, b) => new Date(a.startAt) - new Date(b.startAt))
  }

  async function getEvent(userId, eventId) {
    const accessibleIds = await getAccessibleCalendarIds(userId)
    const event = await prisma.calendarEvent.findFirst({
      where: { id: eventId, calendarId: { in: accessibleIds }, enabled: true },
      include: {
        calendar: { select: { id: true, name: true, color: true, ownerId: true } },
        attendees: { include: { user: { select: { id: true, firstName: true, lastName: true } } } },
        reminders: { where: { userId }, select: { id: true, minutesBefore: true } },
        files: { include: { fileAsset: { select: { id: true, originalName: true, mimeType: true } } } },
      },
    })
    if (!event) throw new CalendarServiceError('Evento no encontrado.', 404)
    return event
  }

  async function createEvent(userId, data) {
    const {
      calendarId, title, description, startAt, endAt, allDay,
      location, videoUrl, color, recurrenceRule,
      sourceModule, sourceEntityId,
      attendeeIds, reminderMinutes,
    } = data

    if (!title?.trim()) throw new CalendarServiceError('El titulo es requerido.', 400)
    if (!startAt) throw new CalendarServiceError('La fecha de inicio es requerida.', 400)
    if (!calendarId) throw new CalendarServiceError('El calendario es requerido.', 400)

    const accessible = await getAccessibleCalendarIds(userId)
    if (!accessible.includes(calendarId)) throw new CalendarServiceError('No tienes acceso a ese calendario.', 403)

    const event = await prisma.calendarEvent.create({
      data: {
        calendarId,
        title: title.trim(),
        description: description?.trim() ?? null,
        startAt: new Date(startAt),
        endAt: endAt ? new Date(endAt) : null,
        allDay: allDay ?? false,
        location: location?.trim() ?? null,
        videoUrl: videoUrl?.trim() ?? null,
        color: color ?? null,
        recurrenceRule: recurrenceRule ?? null,
        sourceModule: sourceModule ?? null,
        sourceEntityId: sourceEntityId ?? null,
      },
    })

    if (attendeeIds?.length) {
      await prisma.calendarEventAttendee.createMany({
        data: attendeeIds.map((uid) => ({ eventId: event.id, userId: uid })),
        skipDuplicates: true,
      })
    }

    if (reminderMinutes?.length) {
      await prisma.calendarReminder.createMany({
        data: reminderMinutes.map((min) => ({ eventId: event.id, userId, minutesBefore: min })),
        skipDuplicates: true,
      })
    }

    return getEvent(userId, event.id)
  }

  async function updateEvent(userId, eventId, data) {
    const accessible = await getAccessibleCalendarIds(userId)
    const event = await prisma.calendarEvent.findFirst({
      where: { id: eventId, calendarId: { in: accessible }, enabled: true },
      include: { calendar: true },
    })
    if (!event) throw new CalendarServiceError('Evento no encontrado.', 404)

    const isOwner = event.calendar.ownerId === userId
    const share = await prisma.calendarShare.findFirst({ where: { calendarId: event.calendarId, userId } })
    const canEdit = isOwner || share?.role === 'EDITOR' || share?.role === 'MANAGER'
    if (!canEdit) throw new CalendarServiceError('No tienes permiso para editar este evento.', 403)

    const updateData = {}
    if (data.calendarId !== undefined && data.calendarId !== event.calendarId) {
      if (!accessible.includes(data.calendarId)) throw new CalendarServiceError('No tienes acceso al calendario destino.', 403)
      updateData.calendarId = data.calendarId
    }
    if (data.title !== undefined) updateData.title = data.title.trim()
    if (data.description !== undefined) updateData.description = data.description?.trim() ?? null
    if (data.startAt !== undefined) updateData.startAt = new Date(data.startAt)
    if (data.endAt !== undefined) updateData.endAt = data.endAt ? new Date(data.endAt) : null
    if (data.allDay !== undefined) updateData.allDay = data.allDay
    if (data.location !== undefined) updateData.location = data.location?.trim() ?? null
    if (data.videoUrl !== undefined) updateData.videoUrl = data.videoUrl?.trim() ?? null
    if (data.color !== undefined) updateData.color = data.color ?? null
    if (data.recurrenceRule !== undefined) updateData.recurrenceRule = data.recurrenceRule ?? null

    await prisma.calendarEvent.update({ where: { id: eventId }, data: updateData })
    return getEvent(userId, eventId)
  }

  async function deleteEvent(userId, eventId) {
    const accessible = await getAccessibleCalendarIds(userId)
    const event = await prisma.calendarEvent.findFirst({
      where: { id: eventId, calendarId: { in: accessible }, enabled: true },
      include: { calendar: true },
    })
    if (!event) throw new CalendarServiceError('Evento no encontrado.', 404)

    const isOwner = event.calendar.ownerId === userId
    const share = await prisma.calendarShare.findFirst({ where: { calendarId: event.calendarId, userId } })
    const canDelete = isOwner || share?.role === 'MANAGER'
    if (!canDelete) throw new CalendarServiceError('No tienes permiso para eliminar este evento.', 403)

    await prisma.calendarEvent.update({ where: { id: eventId }, data: { enabled: false } })
  }

  async function addAttendee(userId, eventId, attendeeUserId) {
    const accessible = await getAccessibleCalendarIds(userId)
    const event = await prisma.calendarEvent.findFirst({
      where: { id: eventId, calendarId: { in: accessible }, enabled: true },
      include: { calendar: true },
    })
    if (!event) throw new CalendarServiceError('Evento no encontrado.', 404)

    const isOwner = event.calendar.ownerId === userId
    const share = await prisma.calendarShare.findFirst({ where: { calendarId: event.calendarId, userId } })
    if (!isOwner && share?.role !== 'MANAGER') {
      throw new CalendarServiceError('No tienes permiso para agregar invitados.', 403)
    }

    try {
      return await prisma.calendarEventAttendee.create({ data: { eventId, userId: attendeeUserId } })
    } catch (err) {
      if (err?.code === 'P2002') throw new CalendarServiceError('El usuario ya es invitado.', 409)
      throw err
    }
  }

  async function updateAttendeeStatus(userId, eventId, attendeeId, status) {
    const validStatuses = ['ACCEPTED', 'DECLINED', 'PENDING']
    if (!validStatuses.includes(status)) throw new CalendarServiceError('Estado invalido.', 400)

    const attendee = await prisma.calendarEventAttendee.findFirst({
      where: { id: attendeeId, eventId, userId },
    })
    if (!attendee) throw new CalendarServiceError('Invitado no encontrado.', 404)
    return prisma.calendarEventAttendee.update({ where: { id: attendeeId }, data: { status } })
  }

  async function addReminder(userId, eventId, minutesBefore) {
    if (!Number.isFinite(minutesBefore) || minutesBefore < 0) {
      throw new CalendarServiceError('minutesBefore debe ser un numero positivo.', 400)
    }
    try {
      return await prisma.calendarReminder.create({ data: { eventId, userId, minutesBefore } })
    } catch (err) {
      if (err?.code === 'P2002') throw new CalendarServiceError('Ya existe ese recordatorio.', 409)
      throw err
    }
  }

  async function deleteReminder(userId, eventId, reminderId) {
    const reminder = await prisma.calendarReminder.findFirst({ where: { id: reminderId, eventId, userId } })
    if (!reminder) throw new CalendarServiceError('Recordatorio no encontrado.', 404)
    await prisma.calendarReminder.delete({ where: { id: reminderId } })
  }

  return {
    listEvents,
    getEvent,
    createEvent,
    updateEvent,
    deleteEvent,
    addAttendee,
    updateAttendeeStatus,
    addReminder,
    deleteReminder,
  }
}
