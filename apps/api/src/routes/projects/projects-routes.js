import { Hono } from 'hono'
import { createProjectsService, ProjectServiceError } from './projects-service.js'
import { createTasksService, TaskServiceError } from './tasks-service.js'
import { createProjectsCalendarBridge } from './projects-calendar-bridge.js'

function getUserId(c) {
  return c.get('userContext')?.profile?.id ?? null
}

function getCompanyId(c) {
  return c.get('companyId') ?? c.get('userContext')?.memberships?.[0]?.companyId ?? null
}

function handleError(c, err, fallback) {
  if (err instanceof ProjectServiceError || err instanceof TaskServiceError)
    return c.json({ error: err.message }, err.status)
  if (Number.isInteger(err?.status) && err.status >= 400 && err.status < 600)
    return c.json({ error: err.message || fallback }, err.status)
  if (process.env.NODE_ENV !== 'production') console.error('[atlas.projects]', err)
  return c.json({ error: fallback }, 500)
}

export function createProjectsRouter({ prisma, requirePermission }) {
  const app = new Hono()
  const projectsSvc = createProjectsService({ prisma })
  const tasksSvc = createTasksService({ prisma })
  const bridge = createProjectsCalendarBridge({ prisma })

  // --- Projects ---
  app.get('/projects', requirePermission('projects.project.read'), async (c) => {
    try {
      const projects = await projectsSvc.listProjects(getCompanyId(c), getUserId(c))
      return c.json(projects)
    } catch (err) { return handleError(c, err, 'Error al listar proyectos.') }
  })

  app.post('/projects', requirePermission('projects.project.create'), async (c) => {
    try {
      const body = await c.req.json()
      const project = await projectsSvc.createProject(getCompanyId(c), getUserId(c), body)
      await bridge.syncProjectCalendar(project)
      return c.json(project, 201)
    } catch (err) { return handleError(c, err, 'Error al crear proyecto.') }
  })

  app.get('/projects/:id', requirePermission('projects.project.read'), async (c) => {
    try {
      const project = await projectsSvc.getProject(c.req.param('id'), getUserId(c))
      return c.json(project)
    } catch (err) { return handleError(c, err, 'Error al obtener proyecto.') }
  })

  app.patch('/projects/:id', requirePermission('projects.project.update'), async (c) => {
    try {
      const body = await c.req.json()
      const project = await projectsSvc.updateProject(c.req.param('id'), getUserId(c), body)
      await bridge.syncProjectCalendar(project)
      return c.json(project)
    } catch (err) { return handleError(c, err, 'Error al actualizar proyecto.') }
  })

  app.delete('/projects/:id', requirePermission('projects.project.delete'), async (c) => {
    try {
      const project = await projectsSvc.archiveProject(c.req.param('id'), getUserId(c))
      return c.json(project)
    } catch (err) { return handleError(c, err, 'Error al archivar proyecto.') }
  })

  // --- Members ---
  app.get('/projects/:id/members', requirePermission('projects.project.read'), async (c) => {
    try {
      const project = await projectsSvc.getProject(c.req.param('id'), getUserId(c))
      return c.json(project.members)
    } catch (err) { return handleError(c, err, 'Error al listar miembros.') }
  })

  app.post('/projects/:id/members', requirePermission('projects.member.manage'), async (c) => {
    try {
      const projectId = c.req.param('id')
      const body = await c.req.json()
      const member = await projectsSvc.addMember(projectId, getUserId(c), body)
      const project = await prisma.project.findFirst({ where: { id: projectId } })
      if (project?.calendarId) await bridge.grantMemberCalendarAccess(project.calendarId, body.userId)
      return c.json(member, 201)
    } catch (err) { return handleError(c, err, 'Error al agregar miembro.') }
  })

  app.patch('/projects/:id/members/:uid', requirePermission('projects.member.manage'), async (c) => {
    try {
      const projectId = c.req.param('id')
      const userId = c.req.param('uid')
      const { role } = await c.req.json()
      const member = await prisma.projectMember.update({
        where: { projectId_userId: { projectId, userId } },
        data: { role },
      })
      return c.json(member)
    } catch (err) { return handleError(c, err, 'Error al actualizar miembro.') }
  })

  app.delete('/projects/:id/members/:uid', requirePermission('projects.member.manage'), async (c) => {
    try {
      const projectId = c.req.param('id')
      const userId = c.req.param('uid')
      await projectsSvc.removeMember(projectId, getUserId(c), userId)
      const project = await prisma.project.findFirst({ where: { id: projectId } })
      if (project?.calendarId) await bridge.revokeMemberCalendarAccess(project.calendarId, userId)
      return c.json({ ok: true })
    } catch (err) { return handleError(c, err, 'Error al remover miembro.') }
  })

  // --- Statuses ---
  app.get('/projects/:id/statuses', requirePermission('projects.task.read'), async (c) => {
    try {
      const statuses = await projectsSvc.listStatuses(c.req.param('id'))
      return c.json(statuses)
    } catch (err) { return handleError(c, err, 'Error al listar estados.') }
  })

  app.post('/projects/:id/statuses', requirePermission('projects.project.update'), async (c) => {
    try {
      const status = await projectsSvc.createStatus(c.req.param('id'), await c.req.json())
      return c.json(status, 201)
    } catch (err) { return handleError(c, err, 'Error al crear estado.') }
  })

  app.patch('/projects/:id/statuses/:sid', requirePermission('projects.project.update'), async (c) => {
    try {
      const status = await projectsSvc.updateStatus(c.req.param('sid'), await c.req.json())
      return c.json(status)
    } catch (err) { return handleError(c, err, 'Error al actualizar estado.') }
  })

  app.delete('/projects/:id/statuses/:sid', requirePermission('projects.project.update'), async (c) => {
    try {
      await projectsSvc.deleteStatus(c.req.param('sid'))
      return c.json({ ok: true })
    } catch (err) { return handleError(c, err, 'Error al eliminar estado.') }
  })

  // --- Tasks ---
  app.get('/projects/:id/tasks', requirePermission('projects.task.read'), async (c) => {
    try {
      const { status_id, assignee_id, priority, due_date_from, due_date_to, parent_task_id } = c.req.query()
      const tasks = await tasksSvc.listTasks(c.req.param('id'), {
        statusId: status_id,
        assigneeId: assignee_id,
        priority,
        dueDateFrom: due_date_from,
        dueDateTo: due_date_to,
        parentTaskId: parent_task_id,
      })
      return c.json(tasks)
    } catch (err) { return handleError(c, err, 'Error al listar tareas.') }
  })

  app.post('/projects/:id/tasks', requirePermission('projects.task.create'), async (c) => {
    try {
      const body = await c.req.json()
      const task = await tasksSvc.createTask(c.req.param('id'), getUserId(c), body)
      if (task.dueDate) {
        const project = await prisma.project.findFirst({ where: { id: task.projectId } })
        await bridge.syncTaskEvent(task, project?.calendarId)
      }
      return c.json(task, 201)
    } catch (err) { return handleError(c, err, 'Error al crear tarea.') }
  })

  app.get('/projects/:id/tasks/:tid', requirePermission('projects.task.read'), async (c) => {
    try {
      const task = await tasksSvc.getTask(c.req.param('tid'))
      return c.json(task)
    } catch (err) { return handleError(c, err, 'Error al obtener tarea.') }
  })

  app.patch('/projects/:id/tasks/:tid', requirePermission('projects.task.update'), async (c) => {
    try {
      const taskId = c.req.param('tid')
      const body = await c.req.json()
      const task = await tasksSvc.updateTask(taskId, body)
      if (body.dueDate !== undefined) {
        const project = await prisma.project.findFirst({ where: { id: task.projectId } })
        await bridge.syncTaskEvent(task, project?.calendarId)
      }
      return c.json(task)
    } catch (err) { return handleError(c, err, 'Error al actualizar tarea.') }
  })

  app.delete('/projects/:id/tasks/:tid', requirePermission('projects.task.delete'), async (c) => {
    try {
      const task = await tasksSvc.deleteTask(c.req.param('tid'))
      if (task.calendarEventId) await bridge.deleteTaskEvent(task.calendarEventId)
      return c.json({ ok: true })
    } catch (err) { return handleError(c, err, 'Error al eliminar tarea.') }
  })

  app.patch('/projects/:id/tasks/:tid/move', requirePermission('projects.task.update'), async (c) => {
    try {
      const task = await tasksSvc.moveTask(c.req.param('tid'), await c.req.json())
      return c.json(task)
    } catch (err) { return handleError(c, err, 'Error al mover tarea.') }
  })

  return app
}
