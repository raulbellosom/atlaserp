import { computeRruleNextAt } from './tasks-service.js'

export function createRecurringTasksService({ prisma }) {
  async function processRecurringTasks() {
    const now = new Date()

    // Find tasks whose recurrence is due: rrule set, status is "done", rruleNextAt overdue
    const dueTasks = await prisma.$queryRaw`
      SELECT t.id, t.project_id, t.title, t.description, t.priority, t.rrule,
             t.task_number, t.parent_task_id
      FROM task t
      JOIN task_status ts ON ts.id = t.status_id
      WHERE t.rrule IS NOT NULL
        AND t.rrule_next_at IS NOT NULL
        AND t.rrule_next_at <= ${now}
        AND ts.is_done = true
    `

    if (dueTasks.length === 0) return { processed: 0, created: 0 }

    let created = 0
    for (const task of dueTasks) {
      try {
        // Find the default (non-done) status for the project
        const defaultStatus = await prisma.taskStatus.findFirst({
          where: { projectId: task.project_id, isDefault: true },
          select: { id: true },
        }) ?? await prisma.taskStatus.findFirst({
          where: { projectId: task.project_id, isDone: false },
          orderBy: { position: 'asc' },
          select: { id: true },
        })
        if (!defaultStatus) continue

        // Next position in that status
        const maxPos = await prisma.task.aggregate({
          where: { projectId: task.project_id, statusId: defaultStatus.id },
          _max: { position: true },
        })
        const position = (maxPos._max.position ?? -1) + 1

        // Increment project taskCounter and get next taskNumber
        const updatedProject = await prisma.project.update({
          where: { id: task.project_id },
          data: { taskCounter: { increment: 1 } },
          select: { taskCounter: true, ownerId: true },
        })

        const nextAt = computeRruleNextAt(task.rrule)

        // Find a "creator" — use project owner as fallback
        const createdBy = updatedProject.ownerId

        await prisma.task.create({
          data: {
            projectId: task.project_id,
            statusId: defaultStatus.id,
            title: task.title,
            description: task.description,
            priority: task.priority,
            rrule: task.rrule,
            rruleNextAt: nextAt,
            position,
            taskNumber: updatedProject.taskCounter,
            createdBy,
          },
        })

        // Clear rruleNextAt on the completed task so it's not picked up again
        await prisma.task.update({
          where: { id: task.id },
          data: { rruleNextAt: null },
        })

        created += 1
      } catch (err) {
        console.error('[recurring] failed to create recurrence for task', task.id, err?.message ?? err)
      }
    }

    return { processed: dueTasks.length, created }
  }

  return { processRecurringTasks }
}
