export class CalendarServiceError extends Error {
  constructor(message, status = 500) {
    super(message);
    this.name = "CalendarServiceError";
    this.status = status;
  }
}

export function createCalendarService({ prisma }) {
  async function ensureDefaultCalendar(userId) {
    const existing = await prisma.calendarCalendar.findFirst({
      where: { ownerId: userId, isDefault: true, enabled: true },
    });
    if (existing) return existing;
    return prisma.calendarCalendar.create({
      data: {
        ownerId: userId,
        name: "Mi calendario",
        color: "#6B46C1",
        isDefault: true,
      },
    });
  }

  async function listCalendars(userId) {
    const owned = await prisma.calendarCalendar.findMany({
      where: { ownerId: userId, enabled: true },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      include: {
        shares: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
    });
    const shared = await prisma.calendarShare.findMany({
      where: { userId },
      include: { calendar: true },
    });
    const sharedCalendars = shared
      .filter((s) => s.calendar?.enabled && s.calendar?.ownerId !== userId)
      .map((s) => ({ ...s.calendar, _sharedRole: s.role, _shareId: s.id }));
    return { owned, shared: sharedCalendars };
  }

  async function createCalendar(userId, { name, color, icon }) {
    if (!name?.trim())
      throw new CalendarServiceError("El nombre es requerido.", 400);
    return prisma.calendarCalendar.create({
      data: {
        ownerId: userId,
        name: name.trim(),
        color: color ?? "#6B46C1",
        icon: icon || null,
      },
    });
  }

  async function updateCalendar(userId, calendarId, { name, color, icon }) {
    const calendar = await prisma.calendarCalendar.findFirst({
      where: { id: calendarId, ownerId: userId, enabled: true },
    });
    if (!calendar)
      throw new CalendarServiceError("Calendario no encontrado.", 404);
    return prisma.calendarCalendar.update({
      where: { id: calendarId },
      data: {
        ...(name?.trim() ? { name: name.trim() } : {}),
        ...(color ? { color } : {}),
        ...(icon !== undefined ? { icon: icon || null } : {}),
      },
    });
  }

  async function deleteCalendar(userId, calendarId) {
    const calendar = await prisma.calendarCalendar.findFirst({
      where: { id: calendarId, ownerId: userId, enabled: true },
    });
    if (!calendar)
      throw new CalendarServiceError("Calendario no encontrado.", 404);
    if (calendar.isDefault)
      throw new CalendarServiceError(
        "No se puede eliminar el calendario por defecto.",
        400,
      );
    await prisma.calendarCalendar.update({
      where: { id: calendarId },
      data: { enabled: false },
    });
    await prisma.calendarEvent.updateMany({
      where: { calendarId },
      data: { enabled: false },
    });
  }

  async function shareCalendar(ownerId, calendarId, { userId, role }) {
    const calendar = await prisma.calendarCalendar.findFirst({
      where: { id: calendarId, ownerId, enabled: true },
    });
    if (!calendar)
      throw new CalendarServiceError("Calendario no encontrado.", 404);
    if (userId === ownerId)
      throw new CalendarServiceError("No puedes invitarte a ti mismo.", 400);
    const validRoles = ["VIEWER", "EDITOR", "MANAGER"];
    if (!validRoles.includes(role))
      throw new CalendarServiceError("Rol invalido.", 400);
    try {
      return await prisma.calendarShare.create({
        data: { calendarId, userId, role },
      });
    } catch (err) {
      if (err?.code === "P2002")
        throw new CalendarServiceError(
          "El usuario ya tiene acceso a este calendario.",
          409,
        );
      throw err;
    }
  }

  async function updateShare(ownerId, calendarId, shareId, { role }) {
    const calendar = await prisma.calendarCalendar.findFirst({
      where: { id: calendarId, ownerId, enabled: true },
    });
    if (!calendar)
      throw new CalendarServiceError("Calendario no encontrado.", 404);
    const share = await prisma.calendarShare.findFirst({
      where: { id: shareId, calendarId },
    });
    if (!share)
      throw new CalendarServiceError("Acceso compartido no encontrado.", 404);
    const validRoles = ["VIEWER", "EDITOR", "MANAGER"];
    if (!validRoles.includes(role))
      throw new CalendarServiceError("Rol invalido.", 400);
    return prisma.calendarShare.update({
      where: { id: shareId },
      data: { role },
    });
  }

  async function deleteShare(ownerId, calendarId, shareId) {
    const calendar = await prisma.calendarCalendar.findFirst({
      where: { id: calendarId, ownerId, enabled: true },
    });
    if (!calendar)
      throw new CalendarServiceError("Calendario no encontrado.", 404);
    const share = await prisma.calendarShare.findFirst({
      where: { id: shareId, calendarId },
    });
    if (!share)
      throw new CalendarServiceError("Acceso compartido no encontrado.", 404);
    await prisma.calendarShare.delete({ where: { id: shareId } });
  }

  async function getCalendarRole(userId, calendarId) {
    const calendar = await prisma.calendarCalendar.findFirst({
      where: { id: calendarId, enabled: true },
    });
    if (!calendar) return null;
    if (calendar.ownerId === userId) return "OWNER";
    const share = await prisma.calendarShare.findFirst({
      where: { calendarId, userId },
    });
    return share?.role ?? null;
  }

  return {
    ensureDefaultCalendar,
    listCalendars,
    createCalendar,
    updateCalendar,
    deleteCalendar,
    shareCalendar,
    updateShare,
    deleteShare,
    getCalendarRole,
  };
}
