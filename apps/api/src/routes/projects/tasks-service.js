export class TaskServiceError extends Error {
  constructor(message, status = 500) {
    super(message)
    this.name = 'TaskServiceError'
    this.status = status
  }
}

function toNoonUTC(val) {
  const str = String(val)
  const part = str.includes('T') ? str.slice(0, 10) : str
  return new Date(`${part}T12:00:00.000Z`)
}

const RRULE_PRESETS = {
  'FREQ=DAILY': (now) => new Date(now.getTime() + 24 * 60 * 60 * 1000),
  'FREQ=WEEKLY': (now) => new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
  'FREQ=WEEKLY;INTERVAL=2': (now) => new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
  'FREQ=MONTHLY': (now) => {
    const d = new Date(now)
    d.setMonth(d.getMonth() + 1)
    return d
  },
}

export function computeRruleNextAt(rrule) {
  const fn = RRULE_PRESETS[rrule]
  return fn ? fn(new Date()) : null
}

export function createTasksService({ prisma }) {
  async function listTasks(projectId, { statusId, assigneeId, priority, dueDateFrom, dueDateTo, parentTaskId, includeSubtasks } = {}) {
    const where = { projectId }
    if (statusId) where.statusId = statusId
    if (assigneeId) where.assigneeId = assigneeId
    if (priority) where.priority = priority
    if (dueDateFrom || dueDateTo) {
      where.dueDate = {}
      if (dueDateFrom) where.dueDate.gte = new Date(dueDateFrom)
      if (dueDateTo) where.dueDate.lte = new Date(dueDateTo)
    }
    if (!includeSubtasks) {
      where.parentTaskId = parentTaskId === undefined ? null : parentTaskId
    }
    return prisma.task.findMany({
      where,
      include: {
        assignee: { select: { id: true, firstName: true, lastName: true, avatarFileId: true } },
        assignees: {
          include: { user: { select: { id: true, firstName: true, lastName: true, avatarFileId: true } } },
          orderBy: { assignedAt: 'asc' },
        },
        status: true,
        parent: { select: { id: true, title: true } },
        _count: { select: { subtasks: true, comments: true } },
      },
      orderBy: [{ statusId: 'asc' }, { position: 'asc' }],
    })
  }

  async function getTask(taskId) {
    const task = await prisma.task.findFirst({
      where: { id: taskId },
      include: {
        assignee: { select: { id: true, firstName: true, lastName: true, avatarFileId: true } },
        assignees: {
          include: { user: { select: { id: true, firstName: true, lastName: true, avatarFileId: true } } },
          orderBy: { assignedAt: 'asc' },
        },
        status: true,
        subtasks: {
          include: {
            assignee: { select: { id: true, firstName: true, lastName: true, avatarFileId: true } },
            assignees: {
              include: { user: { select: { id: true, firstName: true, lastName: true, avatarFileId: true } } },
            },
          },
          orderBy: { position: 'asc' },
        },
        comments: {
          include: { author: { select: { id: true, firstName: true, lastName: true, avatarFileId: true } } },
          orderBy: { createdAt: 'asc' },
          take: 20,
        },
        parent: { select: { id: true, title: true } },
        fieldValues: { include: { field: true }, orderBy: { field: { position: 'asc' } } },
        blockedBy: {
          include: { blocker: { select: { id: true, title: true, taskNumber: true, statusId: true } } },
          orderBy: { createdAt: 'asc' },
        },
        blocking: {
          include: { blocked: { select: { id: true, title: true, taskNumber: true, statusId: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    })
    if (!task) throw new TaskServiceError('Tarea no encontrada.', 404)

    const attachments = await prisma.fileAsset.findMany({
      where: { entityType: 'Task', entityId: taskId },
      orderBy: { createdAt: 'asc' },
    })

    return { ...task, attachments }
  }

  async function createTask(projectId, createdBy, { title, description, statusId, assigneeId, priority = 'NONE', startDate, dueDate, parentTaskId }) {
    if (!title?.trim()) throw new TaskServiceError('El titulo es requerido.', 400)
    const status = await prisma.taskStatus.findFirst({ where: { id: statusId, projectId } })
    if (!status) throw new TaskServiceError('Estado no valido para este proyecto.', 400)
    const last = await prisma.task.findFirst({
      where: { projectId, statusId, parentTaskId: null },
      orderBy: { position: 'desc' },
    })
    const position = (last?.position ?? -1) + 1
    return prisma.$transaction(async (tx) => {
      let taskNumber = null
      if (!parentTaskId) {
        const updated = await tx.project.update({
          where: { id: projectId },
          data: { taskCounter: { increment: 1 } },
          select: { taskCounter: true },
        })
        taskNumber = updated.taskCounter
      }
      return tx.task.create({
        data: {
          projectId,
          statusId,
          parentTaskId: parentTaskId || null,
          title: title.trim(),
          description: description?.trim() || null,
          assigneeId: assigneeId || null,
          priority,
          startDate: startDate ? toNoonUTC(startDate) : null,
          dueDate: dueDate ? toNoonUTC(dueDate) : null,
          position,
          createdBy,
          ...(taskNumber !== null ? { taskNumber } : {}),
        },
      })
    })
  }

  async function updateTask(taskId, data) {
    const task = await prisma.task.findFirst({ where: { id: taskId } })
    if (!task) throw new TaskServiceError('Tarea no encontrada.', 404)
    const { title, description, assigneeId, priority, startDate, dueDate, statusId, rrule } = data
    const rruleNextAt = rrule !== undefined
      ? (rrule ? computeRruleNextAt(rrule) : null)
      : undefined
    return prisma.task.update({
      where: { id: taskId },
      data: {
        ...(title?.trim() ? { title: title.trim() } : {}),
        ...(description !== undefined ? { description: description?.trim() || null } : {}),
        ...(assigneeId !== undefined ? { assigneeId: assigneeId || null } : {}),
        ...(priority ? { priority } : {}),
        ...(startDate !== undefined ? { startDate: startDate ? toNoonUTC(startDate) : null } : {}),
        ...(dueDate !== undefined ? { dueDate: dueDate ? toNoonUTC(dueDate) : null } : {}),
        ...(statusId ? { statusId } : {}),
        ...(rrule !== undefined ? { rrule: rrule || null } : {}),
        ...(rruleNextAt !== undefined ? { rruleNextAt } : {}),
      },
    })
  }

  async function moveTask(taskId, { statusId, position }) {
    const task = await prisma.task.findFirst({ where: { id: taskId } })
    if (!task) throw new TaskServiceError('Tarea no encontrada.', 404)
    await prisma.task.updateMany({
      where: { projectId: task.projectId, statusId, position: { gte: position }, id: { not: taskId } },
      data: { position: { increment: 1 } },
    })
    return prisma.task.update({ where: { id: taskId }, data: { statusId, position } })
  }

  async function deleteTask(taskId) {
    const task = await prisma.task.findFirst({ where: { id: taskId } })
    if (!task) throw new TaskServiceError('Tarea no encontrada.', 404)
    await prisma.task.deleteMany({ where: { parentTaskId: taskId } })
    await prisma.task.delete({ where: { id: taskId } })
    return task
  }

  async function addAssignee(taskId, userId) {
    const task = await prisma.task.findFirst({ where: { id: taskId } })
    if (!task) throw new TaskServiceError('Tarea no encontrada.', 404)
    const existing = await prisma.projectTaskAssignee.findFirst({ where: { taskId, userId } })
    if (existing) throw new TaskServiceError('El usuario ya esta asignado a esta tarea.', 409)
    const row = await prisma.projectTaskAssignee.create({
      data: { taskId, userId },
      include: { user: { select: { id: true, firstName: true, lastName: true, avatarFileId: true } } },
    })
    if (!task.assigneeId) {
      await prisma.task.update({ where: { id: taskId }, data: { assigneeId: userId } })
    }
    return row
  }

  async function removeAssignee(taskId, userId) {
    const task = await prisma.task.findFirst({ where: { id: taskId } })
    if (!task) throw new TaskServiceError('Tarea no encontrada.', 404)
    const existing = await prisma.projectTaskAssignee.findFirst({ where: { taskId, userId } })
    if (!existing) throw new TaskServiceError('El usuario no esta asignado a esta tarea.', 404)
    await prisma.projectTaskAssignee.delete({ where: { taskId_userId: { taskId, userId } } })
    if (task.assigneeId === userId) {
      const next = await prisma.projectTaskAssignee.findFirst({
        where: { taskId },
        orderBy: { assignedAt: 'asc' },
      })
      await prisma.task.update({ where: { id: taskId }, data: { assigneeId: next?.userId ?? null } })
    }
  }

  async function listAssignees(taskId) {
    return prisma.projectTaskAssignee.findMany({
      where: { taskId },
      include: { user: { select: { id: true, firstName: true, lastName: true, avatarFileId: true } } },
      orderBy: { assignedAt: 'asc' },
    })
  }

  async function createComment(taskId, authorId, body) {
    if (!body?.trim()) throw new TaskServiceError('El comentario no puede estar vacio.', 400)
    if (body.trim().length > 5000) throw new TaskServiceError('El comentario no puede tener mas de 5000 caracteres.', 400)
    return prisma.taskComment.create({
      data: { taskId, authorId, body: body.trim() },
      include: { author: { select: { id: true, firstName: true, lastName: true, avatarFileId: true } } },
    })
  }

  async function listComments(taskId, { limit = 50, cursor } = {}) {
    return prisma.taskComment.findMany({
      where: { taskId, ...(cursor ? { id: { lt: cursor } } : {}) },
      include: { author: { select: { id: true, firstName: true, lastName: true, avatarFileId: true } } },
      orderBy: { createdAt: 'asc' },
      take: limit,
    })
  }

  async function updateComment(commentId, requesterId, body) {
    if (!body?.trim()) throw new TaskServiceError('El comentario no puede estar vacio.', 400)
    if (body.trim().length > 5000) throw new TaskServiceError('El comentario no puede tener mas de 5000 caracteres.', 400)
    const comment = await prisma.taskComment.findFirst({ where: { id: commentId } })
    if (!comment) throw new TaskServiceError('Comentario no encontrado.', 404)
    if (comment.authorId !== requesterId) throw new TaskServiceError('Solo el autor puede editar este comentario.', 403)
    return prisma.taskComment.update({
      where: { id: commentId },
      data: { body: body.trim(), editedAt: new Date() },
      include: { author: { select: { id: true, firstName: true, lastName: true, avatarFileId: true } } },
    })
  }

  async function deleteComment(commentId, requesterId) {
    const comment = await prisma.taskComment.findFirst({
      where: { id: commentId },
      include: { task: { include: { project: { include: { members: { where: { userId: requesterId } } } } } } },
    })
    if (!comment) throw new TaskServiceError('Comentario no encontrado.', 404)
    const isAuthor = comment.authorId === requesterId
    const isAdmin = comment.task?.project?.members?.some((m) => m.role === 'ADMIN')
    if (!isAuthor && !isAdmin) throw new TaskServiceError('No tienes permiso para eliminar este comentario.', 403)
    await prisma.taskComment.delete({ where: { id: commentId } })
  }

  async function bulkUpdateTasks(projectId, taskIds, patch) {
    if (!taskIds?.length) throw new TaskServiceError('Se requiere al menos una tarea.', 400)
    const { statusId, assigneeId, priority } = patch
    if (!statusId && assigneeId === undefined && !priority)
      throw new TaskServiceError('Se requiere al menos un campo para actualizar.', 400)
    await prisma.task.updateMany({
      where: { id: { in: taskIds }, projectId },
      data: {
        ...(statusId ? { statusId } : {}),
        ...(assigneeId !== undefined ? { assigneeId: assigneeId || null } : {}),
        ...(priority ? { priority } : {}),
      },
    })
    return { updated: taskIds.length }
  }

  async function bulkDeleteTasks(projectId, taskIds) {
    if (!taskIds?.length) throw new TaskServiceError('Se requiere al menos una tarea.', 400)
    await prisma.task.deleteMany({ where: { parentTaskId: { in: taskIds }, projectId } })
    const result = await prisma.task.deleteMany({ where: { id: { in: taskIds }, projectId } })
    return { deleted: result.count }
  }

  return {
    listTasks, getTask, createTask, updateTask, moveTask, deleteTask,
    addAssignee, removeAssignee, listAssignees,
    createComment, listComments, updateComment, deleteComment,
    bulkUpdateTasks, bulkDeleteTasks,
  }
}
