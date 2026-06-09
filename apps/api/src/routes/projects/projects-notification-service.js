import { createNotificationService } from '../../services/notification-service.js'

export function createProjectsNotificationService({ prisma, notificationService }) {
  const notifSvc = notificationService ?? createNotificationService({ prisma })

  async function notifyMemberAdded({ companyId, actorId, projectId, addedUserId }) {
    if (!addedUserId || addedUserId === actorId) return
    try {
      const project = await prisma.project.findFirst({
        where: { id: projectId },
        select: { name: true },
      })
      await notifSvc.publish({
        companyId,
        actorId: actorId ?? null,
        input: {
          eventType: 'projects.member.added',
          title: 'Te agregaron a un proyecto',
          body: `Ahora eres miembro de "${project?.name ?? 'Proyecto'}"`,
          link: '/app/m/atlas.projects',
          recipients: { userIds: [addedUserId] },
          channels: ['in_app', 'email', 'web_push'],
          priority: 'medium',
          sourceType: 'Project',
          sourceId: projectId,
          metadata: { projectId },
        },
      })
    } catch (err) {
      console.error('[projects.member.added]', err?.message ?? err)
    }
  }

  async function notifyTaskAssigned({ companyId, actorId, taskId, assignedUserId }) {
    if (!assignedUserId || assignedUserId === actorId) return
    try {
      const task = await prisma.task.findFirst({
        where: { id: taskId },
        include: { project: { select: { id: true, name: true } } },
      })
      if (!task) return
      await notifSvc.publish({
        companyId,
        actorId: actorId ?? null,
        input: {
          eventType: 'projects.task.assigned',
          title: 'Te asignaron una tarea',
          body: `"${task.title}"${task.project?.name ? ` en ${task.project.name}` : ''}`,
          link: '/app/m/atlas.projects',
          recipients: { userIds: [assignedUserId] },
          channels: ['in_app', 'email', 'web_push'],
          priority: 'medium',
          sourceType: 'Task',
          sourceId: taskId,
          metadata: { projectId: task.projectId, taskId, taskNumber: task.taskNumber },
        },
      })
    } catch (err) {
      console.error('[projects.task.assigned]', err?.message ?? err)
    }
  }

  async function notifyTaskUnassigned({ companyId, actorId, taskId, removedUserId }) {
    if (!removedUserId || removedUserId === actorId) return
    try {
      const task = await prisma.task.findFirst({
        where: { id: taskId },
        include: { project: { select: { id: true, name: true } } },
      })
      if (!task) return
      await notifSvc.publish({
        companyId,
        actorId: actorId ?? null,
        input: {
          eventType: 'projects.task.unassigned',
          title: 'Te removieron de una tarea',
          body: `"${task.title}"${task.project?.name ? ` en ${task.project.name}` : ''}`,
          link: '/app/m/atlas.projects',
          recipients: { userIds: [removedUserId] },
          channels: ['in_app', 'email', 'web_push'],
          priority: 'low',
          sourceType: 'Task',
          sourceId: taskId,
          metadata: { projectId: task.projectId, taskId, taskNumber: task.taskNumber },
        },
      })
    } catch (err) {
      console.error('[projects.task.unassigned]', err?.message ?? err)
    }
  }

  async function notifyTaskComment({ companyId, authorId, taskId, mentionedUserIds = [] }) {
    try {
      const task = await prisma.task.findFirst({
        where: { id: taskId },
        include: {
          project: { select: { id: true, name: true } },
          assignees: { select: { userId: true } },
        },
      })
      if (!task) return
      const assigneeIds = task.assignees.map((a) => a.userId)
      const mentionSet = new Set(mentionedUserIds.filter((id) => id !== authorId))

      // Direct @mentions get a higher-priority mention notification
      if (mentionSet.size > 0) {
        await notifSvc.publish({
          companyId,
          actorId: authorId ?? null,
          input: {
            eventType: 'projects.task.mention',
            title: 'Te mencionaron en un comentario',
            body: `"${task.title}"${task.project?.name ? ` en ${task.project.name}` : ''}`,
            link: '/app/m/atlas.projects',
            recipients: { userIds: [...mentionSet] },
            channels: ['in_app', 'email', 'web_push'],
            priority: 'medium',
            sourceType: 'Task',
            sourceId: taskId,
            metadata: { projectId: task.projectId, taskId, taskNumber: task.taskNumber },
          },
        })
      }

      // Assignees who were not @mentioned get the regular comment notification
      const commentRecipients = assigneeIds.filter((id) => id !== authorId && !mentionSet.has(id))
      if (commentRecipients.length > 0) {
        await notifSvc.publish({
          companyId,
          actorId: authorId ?? null,
          input: {
            eventType: 'projects.task.comment',
            title: 'Nuevo comentario en tu tarea',
            body: `"${task.title}"${task.project?.name ? ` en ${task.project.name}` : ''}`,
            link: '/app/m/atlas.projects',
            recipients: { userIds: commentRecipients },
            channels: ['in_app', 'email', 'web_push'],
            priority: 'low',
            sourceType: 'Task',
            sourceId: taskId,
            metadata: { projectId: task.projectId, taskId, taskNumber: task.taskNumber },
          },
        })
      }
    } catch (err) {
      console.error('[projects.task.comment]', err?.message ?? err)
    }
  }

  async function notifyTaskStatusChanged({ companyId, actorId, taskId, oldStatusId, newStatusId }) {
    if (!oldStatusId || !newStatusId || oldStatusId === newStatusId) return
    try {
      const [task, oldStatus, newStatus] = await Promise.all([
        prisma.task.findFirst({
          where: { id: taskId },
          include: {
            project: { select: { id: true, name: true } },
            assignees: { select: { userId: true } },
          },
        }),
        prisma.taskStatus.findFirst({ where: { id: oldStatusId }, select: { name: true } }),
        prisma.taskStatus.findFirst({ where: { id: newStatusId }, select: { name: true } }),
      ])
      if (!task) return
      const recipientIds = task.assignees.map((a) => a.userId).filter((id) => id !== actorId)
      if (!recipientIds.length) return
      await notifSvc.publish({
        companyId,
        actorId: actorId ?? null,
        input: {
          eventType: 'projects.task.status_changed',
          title: 'Estado de tarea actualizado',
          body: `"${task.title}" cambio de ${oldStatus?.name ?? 'anterior'} a ${newStatus?.name ?? 'nuevo'}`,
          link: '/app/m/atlas.projects',
          recipients: { userIds: recipientIds },
          channels: ['in_app', 'email', 'web_push'],
          priority: 'low',
          sourceType: 'Task',
          sourceId: taskId,
          metadata: {
            projectId: task.projectId,
            taskId,
            taskNumber: task.taskNumber,
            oldStatus: oldStatus?.name ?? null,
            newStatus: newStatus?.name ?? null,
          },
        },
      })
    } catch (err) {
      console.error('[projects.task.status_changed]', err?.message ?? err)
    }
  }

  // Called from the worker every hour. Sends one notification per assignee per task per calendar day.
  async function processTasksDueSoon() {
    const now = new Date()
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000)
    const dateKey = now.toISOString().slice(0, 10)

    const assignments = await prisma.projectTaskAssignee.findMany({
      where: {
        task: {
          is: {
            dueDate: { gte: now, lte: in24h },
            status: { isDone: false },
            project: { status: { not: 'ARCHIVED' } },
          },
        },
      },
      include: {
        task: {
          include: {
            project: { select: { id: true, name: true, companyId: true } },
          },
        },
      },
    })

    let published = 0
    for (const assignment of assignments) {
      const { task, userId } = assignment
      if (!task.project?.companyId) continue
      const dedupeKey = `projects.task.due_soon:Task:${task.id}:${userId}:${dateKey}`

      const existing = await prisma.notification.findFirst({
        where: { userId, dedupeKey },
        select: { id: true },
      })
      if (existing) continue

      try {
        await notifSvc.publish({
          companyId: task.project.companyId,
          actorId: null,
          input: {
            eventType: 'projects.task.due_soon',
            title: 'Tarea por vencer',
            body: `"${task.title}" vence en menos de 24 horas.`,
            link: '/app/m/atlas.projects',
            recipients: { userIds: [userId] },
            channels: ['in_app', 'email', 'web_push'],
            priority: 'high',
            sourceType: 'Task',
            sourceId: task.id,
            dedupeKey,
            metadata: {
              projectId: task.projectId,
              taskId: task.id,
              taskNumber: task.taskNumber,
            },
          },
        })
        published += 1
      } catch (err) {
        console.error('[projects.task.due_soon]', err?.message ?? err)
      }
    }

    return { processed: assignments.length, published }
  }

  return {
    notifyMemberAdded,
    notifyTaskAssigned,
    notifyTaskUnassigned,
    notifyTaskComment,
    notifyTaskStatusChanged,
    processTasksDueSoon,
  }
}
