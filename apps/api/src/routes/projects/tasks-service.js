export class TaskServiceError extends Error {
  constructor(message, status = 500) {
    super(message)
    this.name = 'TaskServiceError'
    this.status = status
  }
}

export function createTasksService({ prisma }) {
  async function listTasks(projectId, { statusId, assigneeId, priority, dueDateFrom, dueDateTo, parentTaskId } = {}) {
    const where = { projectId }
    if (statusId) where.statusId = statusId
    if (assigneeId) where.assigneeId = assigneeId
    if (priority) where.priority = priority
    if (dueDateFrom || dueDateTo) {
      where.dueDate = {}
      if (dueDateFrom) where.dueDate.gte = new Date(dueDateFrom)
      if (dueDateTo) where.dueDate.lte = new Date(dueDateTo)
    }
    where.parentTaskId = parentTaskId === undefined ? null : parentTaskId
    return prisma.task.findMany({
      where,
      include: {
        assignee: { select: { id: true, firstName: true, lastName: true, avatarFileId: true } },
        status: true,
        _count: { select: { subtasks: true } },
      },
      orderBy: [{ statusId: 'asc' }, { position: 'asc' }],
    })
  }

  async function getTask(taskId) {
    const task = await prisma.task.findFirst({
      where: { id: taskId },
      include: {
        assignee: { select: { id: true, firstName: true, lastName: true, avatarFileId: true } },
        status: true,
        subtasks: {
          include: { assignee: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
          orderBy: { position: 'asc' },
        },
      },
    })
    if (!task) throw new TaskServiceError('Tarea no encontrada.', 404)
    return task
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
    return prisma.task.create({
      data: {
        projectId,
        statusId,
        parentTaskId: parentTaskId || null,
        title: title.trim(),
        description: description?.trim() || null,
        assigneeId: assigneeId || null,
        priority,
        startDate: startDate ? new Date(startDate) : null,
        dueDate: dueDate ? new Date(dueDate) : null,
        position,
        createdBy,
      },
    })
  }

  async function updateTask(taskId, data) {
    const task = await prisma.task.findFirst({ where: { id: taskId } })
    if (!task) throw new TaskServiceError('Tarea no encontrada.', 404)
    const { title, description, assigneeId, priority, startDate, dueDate, statusId } = data
    return prisma.task.update({
      where: { id: taskId },
      data: {
        ...(title?.trim() ? { title: title.trim() } : {}),
        ...(description !== undefined ? { description: description?.trim() || null } : {}),
        ...(assigneeId !== undefined ? { assigneeId: assigneeId || null } : {}),
        ...(priority ? { priority } : {}),
        ...(startDate !== undefined ? { startDate: startDate ? new Date(startDate) : null } : {}),
        ...(dueDate !== undefined ? { dueDate: dueDate ? new Date(dueDate) : null } : {}),
        ...(statusId ? { statusId } : {}),
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

  return { listTasks, getTask, createTask, updateTask, moveTask, deleteTask }
}
