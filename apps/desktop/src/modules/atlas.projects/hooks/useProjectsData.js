import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuth } from '../../../auth/AuthProvider'
import { atlas } from '../../../lib/atlas'

function loadingMutation(msg) {
  return {
    onMutate: () => ({ toastId: toast.loading(msg) }),
    onSuccess: (_, __, ctx) => toast.dismiss(ctx?.toastId),
    onError:   (_, __, ctx) => toast.dismiss(ctx?.toastId),
  }
}

function useToken() {
  const { session } = useAuth()
  return session?.access_token
}

// ── Projects ──────────────────────────────────────────────────────────────────

export function useProjects() {
  const token = useToken()
  return useQuery({
    queryKey: ['projects'],
    queryFn: () => atlas.projects.listProjects(token),
    enabled: Boolean(token),
    staleTime: 2 * 60 * 1000,
  })
}

export function useProject(projectId) {
  const token = useToken()
  return useQuery({
    queryKey: ['projects', projectId],
    queryFn: () => atlas.projects.getProject(projectId, token),
    enabled: Boolean(token) && Boolean(projectId),
    staleTime: 60 * 1000,
  })
}

export function useSyncProjectCalendar(projectId) {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => atlas.projects.syncProjectCalendar(projectId, token),
    ...loadingMutation('Sincronizando calendario...'),
    onSuccess: (data, vars, ctx) => {
      toast.dismiss(ctx?.toastId)
      qc.invalidateQueries({ queryKey: ['projects'] })
      qc.invalidateQueries({ queryKey: ['projects', projectId] })
    },
  })
}

export function useCreateProject() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => atlas.projects.createProject(data, token),
    ...loadingMutation('Creando proyecto...'),
    onSuccess: (data, vars, ctx) => {
      toast.dismiss(ctx?.toastId)
      qc.invalidateQueries({ queryKey: ['projects'] })
    },
  })
}

export function useUpdateProject(projectId) {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => atlas.projects.updateProject(projectId, data, token),
    ...loadingMutation('Guardando proyecto...'),
    onSuccess: (data, vars, ctx) => {
      toast.dismiss(ctx?.toastId)
      qc.invalidateQueries({ queryKey: ['projects'] })
      qc.invalidateQueries({ queryKey: ['projects', projectId] })
    },
  })
}

export function useArchiveProject() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => atlas.projects.archiveProject(id, token),
    ...loadingMutation('Archivando proyecto...'),
    onSuccess: (data, vars, ctx) => {
      toast.dismiss(ctx?.toastId)
      qc.invalidateQueries({ queryKey: ['projects'] })
    },
  })
}

// ── Members ───────────────────────────────────────────────────────────────────

export function useProjectMembers(projectId) {
  const token = useToken()
  return useQuery({
    queryKey: ['projects', projectId, 'members'],
    queryFn: () => atlas.projects.listMembers(projectId, token),
    enabled: Boolean(token) && Boolean(projectId),
    staleTime: 60 * 1000,
  })
}

export function useAddMember(projectId) {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => atlas.projects.addMember(projectId, data, token),
    ...loadingMutation('Agregando miembro...'),
    onSuccess: (data, vars, ctx) => {
      toast.dismiss(ctx?.toastId)
      qc.invalidateQueries({ queryKey: ['projects', projectId, 'members'] })
    },
  })
}

export function useRemoveMember(projectId) {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (userId) => atlas.projects.removeMember(projectId, userId, token),
    ...loadingMutation('Eliminando miembro...'),
    onSuccess: (data, vars, ctx) => {
      toast.dismiss(ctx?.toastId)
      qc.invalidateQueries({ queryKey: ['projects', projectId, 'members'] })
    },
  })
}

// ── Statuses ──────────────────────────────────────────────────────────────────

export function useStatuses(projectId) {
  const token = useToken()
  return useQuery({
    queryKey: ['projects', projectId, 'statuses'],
    queryFn: () => atlas.projects.listStatuses(projectId, token),
    enabled: Boolean(token) && Boolean(projectId),
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  })
}

export function useCreateStatus(projectId) {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => atlas.projects.createStatus(projectId, data, token),
    ...loadingMutation('Creando estado...'),
    onSuccess: (data, vars, ctx) => {
      toast.dismiss(ctx?.toastId)
      qc.invalidateQueries({ queryKey: ['projects', projectId, 'statuses'] })
    },
  })
}

export function useUpdateStatus(projectId) {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ statusId, ...data }) => atlas.projects.updateStatus(projectId, statusId, data, token),
    ...loadingMutation('Guardando estado...'),
    onSuccess: (data, vars, ctx) => {
      toast.dismiss(ctx?.toastId)
      qc.invalidateQueries({ queryKey: ['projects', projectId, 'statuses'] })
    },
  })
}

export function useDeleteStatus(projectId) {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (statusId) => atlas.projects.deleteStatus(projectId, statusId, token),
    ...loadingMutation('Eliminando estado...'),
    onSuccess: (data, vars, ctx) => {
      toast.dismiss(ctx?.toastId)
      qc.invalidateQueries({ queryKey: ['projects', projectId, 'statuses'] })
      qc.invalidateQueries({ queryKey: ['projects', projectId, 'tasks'] })
    },
  })
}

// ── Tasks ─────────────────────────────────────────────────────────────────────

export function useTasks(projectId, filters = {}) {
  const token = useToken()
  return useQuery({
    queryKey: ['projects', projectId, 'tasks', filters],
    queryFn: () => atlas.projects.listTasks(projectId, filters, token),
    enabled: Boolean(token) && Boolean(projectId),
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
  })
}

export function useTask(projectId, taskId) {
  const token = useToken()
  return useQuery({
    queryKey: ['projects', projectId, 'tasks', taskId],
    queryFn: () => atlas.projects.getTask(projectId, taskId, token),
    enabled: Boolean(token) && Boolean(projectId) && Boolean(taskId),
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
  })
}

export function useCreateTask(projectId) {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => atlas.projects.createTask(projectId, data, token),
    onMutate: async ({ title, statusId, parentTaskId }) => {
      if (parentTaskId) return undefined
      await qc.cancelQueries({ queryKey: ['projects', projectId, 'tasks'] })
      const tempTask = {
        id: `temp-${Date.now()}`,
        title,
        statusId,
        priority: 'NONE',
        position: 9999,
        assignees: [],
        assignee: null,
        _count: { subtasks: 0, comments: 0, attachments: 0 },
        dueDate: null,
        startDate: null,
        taskNumber: null,
        parentTaskId: null,
        blockedBy: [],
        blocking: [],
        rrule: null,
        status: null,
        createdAt: new Date().toISOString(),
      }
      const snapshots = qc.getQueriesData({ queryKey: ['projects', projectId, 'tasks'], exact: false })
      for (const [queryKey] of snapshots) {
        qc.setQueryData(queryKey, (old) => {
          if (!old) return old
          const tasks = old?.data ?? old
          if (!Array.isArray(tasks)) return old
          const filters = queryKey[3] ?? {}
          if (filters.statusId && filters.statusId !== statusId) return old
          return Array.isArray(old) ? [...tasks, tempTask] : { ...old, data: [...tasks, tempTask] }
        })
      }
      return { snapshots }
    },
    onError: (_, __, ctx) => {
      for (const [queryKey, data] of ctx?.snapshots ?? []) {
        qc.setQueryData(queryKey, data)
      }
      toast.error('No se pudo crear la tarea')
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['projects', projectId, 'tasks'] })
    },
  })
}

export function useUpdateTask(projectId) {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ taskId, ...data }) => atlas.projects.updateTask(projectId, taskId, data, token),
    onMutate: async ({ taskId, ...patch }) => {
      await qc.cancelQueries({ queryKey: ['projects', projectId, 'tasks'] })
      await qc.cancelQueries({ queryKey: ['projects', projectId, 'tasks', taskId] })
      const listSnapshots = qc.getQueriesData({ queryKey: ['projects', projectId, 'tasks'], exact: false })
      const detailSnapshot = qc.getQueryData(['projects', projectId, 'tasks', taskId])
      for (const [queryKey] of listSnapshots) {
        qc.setQueryData(queryKey, (old) => {
          if (!old) return old
          const tasks = old?.data ?? old
          if (!Array.isArray(tasks)) return old
          const updated = tasks.map((t) => (t.id === taskId ? { ...t, ...patch } : t))
          return Array.isArray(old) ? updated : { ...old, data: updated }
        })
      }
      if (detailSnapshot) {
        qc.setQueryData(['projects', projectId, 'tasks', taskId], (old) =>
          old ? { ...old, ...patch } : old,
        )
      }
      return { listSnapshots, detailSnapshot }
    },
    onError: (_, { taskId }, ctx) => {
      for (const [queryKey, data] of ctx?.listSnapshots ?? []) {
        qc.setQueryData(queryKey, data)
      }
      if (ctx?.detailSnapshot !== undefined) {
        qc.setQueryData(['projects', projectId, 'tasks', taskId], ctx.detailSnapshot)
      }
    },
    onSettled: (_, __, { taskId }) => {
      qc.invalidateQueries({ queryKey: ['projects', projectId, 'tasks'] })
      qc.invalidateQueries({ queryKey: ['projects', projectId, 'tasks', taskId] })
    },
  })
}

export function useMoveTask(projectId) {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ taskId, statusId, position }) =>
      atlas.projects.moveTask(projectId, taskId, { statusId, position }, token),
    onMutate: async ({ taskId, statusId }) => {
      await qc.cancelQueries({ queryKey: ['projects', projectId, 'tasks'] })
      const snapshots = qc.getQueriesData({ queryKey: ['projects', projectId, 'tasks'], exact: false })
      for (const [queryKey] of snapshots) {
        qc.setQueryData(queryKey, (old) => {
          if (!old) return old
          const tasks = old?.data ?? old
          if (!Array.isArray(tasks)) return old
          const updated = tasks.map((t) => (t.id === taskId ? { ...t, statusId } : t))
          return Array.isArray(old) ? updated : { ...old, data: updated }
        })
      }
      return { snapshots }
    },
    onError: (_, __, ctx) => {
      for (const [queryKey, data] of ctx?.snapshots ?? []) {
        qc.setQueryData(queryKey, data)
      }
      toast.error('No se pudo mover la tarea')
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['projects', projectId, 'tasks'] })
    },
  })
}

export function useDeleteTask(projectId) {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (taskId) => atlas.projects.deleteTask(projectId, taskId, token),
    ...loadingMutation('Eliminando tarea...'),
    onSuccess: (data, vars, ctx) => {
      toast.dismiss(ctx?.toastId)
      qc.invalidateQueries({ queryKey: ['projects', projectId, 'tasks'] })
    },
  })
}

// ── Workspace users (for assignee picker) ────────────────────────────────────

export function useWorkspaceUsers() {
  const token = useToken()
  return useQuery({
    queryKey: ['identity', 'users'],
    queryFn: () => atlas.identity.listUsers(token),
    enabled: Boolean(token),
    staleTime: 5 * 60 * 1000,
  })
}

// ── Task Assignees ────────────────────────────────────────────────────────────

export function useAddAssignee(projectId, taskId) {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ userId }) => atlas.projects.addTaskAssignee(projectId, taskId, { userId }, token),
    ...loadingMutation('Asignando...'),
    onSuccess: (data, vars, ctx) => {
      toast.dismiss(ctx?.toastId)
      qc.invalidateQueries({ queryKey: ['projects', projectId, 'tasks'] })
      qc.invalidateQueries({ queryKey: ['projects', projectId, 'tasks', taskId] })
    },
  })
}

export function useRemoveAssignee(projectId, taskId) {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ userId }) => atlas.projects.removeTaskAssignee(projectId, taskId, userId, token),
    ...loadingMutation('Quitando asignado...'),
    onSuccess: (data, vars, ctx) => {
      toast.dismiss(ctx?.toastId)
      qc.invalidateQueries({ queryKey: ['projects', projectId, 'tasks'] })
      qc.invalidateQueries({ queryKey: ['projects', projectId, 'tasks', taskId] })
    },
  })
}

// ── Task Comments ─────────────────────────────────────────────────────────────

export function useCreateComment(projectId, taskId) {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ body }) => atlas.projects.createTaskComment(projectId, taskId, { body }, token),
    ...loadingMutation('Enviando comentario...'),
    onSuccess: (data, vars, ctx) => {
      toast.dismiss(ctx?.toastId)
      qc.invalidateQueries({ queryKey: ['projects', projectId, 'tasks', taskId] })
    },
  })
}

export function useUpdateComment(projectId, taskId) {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ commentId, body }) => atlas.projects.updateTaskComment(projectId, taskId, commentId, { body }, token),
    ...loadingMutation('Guardando comentario...'),
    onSuccess: (data, vars, ctx) => {
      toast.dismiss(ctx?.toastId)
      qc.invalidateQueries({ queryKey: ['projects', projectId, 'tasks', taskId] })
    },
  })
}

export function useDeleteComment(projectId, taskId) {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ commentId }) => atlas.projects.deleteTaskComment(projectId, taskId, commentId, token),
    ...loadingMutation('Eliminando comentario...'),
    onSuccess: (data, vars, ctx) => {
      toast.dismiss(ctx?.toastId)
      qc.invalidateQueries({ queryKey: ['projects', projectId, 'tasks', taskId] })
    },
  })
}

// ── Task Dependencies ─────────────────────────────────────────────────────────

export function useTaskDependencies(projectId, taskId) {
  const token = useToken()
  return useQuery({
    queryKey: ['projects', projectId, 'tasks', taskId, 'dependencies'],
    queryFn: () => atlas.projects.listTaskDependencies(projectId, taskId, token),
    enabled: Boolean(token) && Boolean(projectId) && Boolean(taskId),
    staleTime: 15 * 1000,
  })
}

export function useAddDependency(projectId, taskId) {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => atlas.projects.addTaskDependency(projectId, taskId, data, token),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects', projectId, 'tasks', taskId, 'dependencies'] }),
    onError: () => toast.error('No se pudo agregar la dependencia'),
  })
}

export function useRemoveDependency(projectId, taskId) {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (depId) => atlas.projects.removeTaskDependency(projectId, taskId, depId, token),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects', projectId, 'tasks', taskId, 'dependencies'] }),
    onError: () => toast.error('No se pudo eliminar la dependencia'),
  })
}

// ── Project Custom Fields ─────────────────────────────────────────────────────

export function useProjectFields(projectId) {
  const token = useToken()
  return useQuery({
    queryKey: ['projects', projectId, 'fields'],
    queryFn: () => atlas.projects.listProjectFields(projectId, token),
    enabled: Boolean(token) && Boolean(projectId),
    staleTime: 60 * 1000,
  })
}

export function useCreateField(projectId) {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => atlas.projects.createProjectField(projectId, data, token),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects', projectId, 'fields'] }),
    onError: () => toast.error('No se pudo crear el campo'),
  })
}

export function useUpdateField(projectId) {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ fieldId, ...data }) => atlas.projects.updateProjectField(projectId, fieldId, data, token),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects', projectId, 'fields'] }),
    onError: () => toast.error('No se pudo actualizar el campo'),
  })
}

export function useDeleteField(projectId) {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (fieldId) => atlas.projects.deleteProjectField(projectId, fieldId, token),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects', projectId, 'fields'] }),
    onError: () => toast.error('No se pudo eliminar el campo'),
  })
}

// ── Task Field Values ─────────────────────────────────────────────────────────

export function useTaskFieldValues(projectId, taskId) {
  const token = useToken()
  return useQuery({
    queryKey: ['projects', projectId, 'tasks', taskId, 'field-values'],
    queryFn: () => atlas.projects.getTaskFieldValues(projectId, taskId, token),
    enabled: Boolean(token) && Boolean(projectId) && Boolean(taskId),
    staleTime: 15 * 1000,
  })
}

export function useUpsertFieldValues(projectId, taskId) {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (entries) => atlas.projects.upsertTaskFieldValues(projectId, taskId, entries, token),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects', projectId, 'tasks', taskId, 'field-values'] }),
    onError: () => toast.error('No se pudo guardar el valor'),
  })
}

// ── Task Activity feed ────────────────────────────────────────────────────────

export function useTaskActivity(taskId, limit = 50) {
  const token = useToken()
  return useQuery({
    queryKey: ['activity', 'Task', taskId],
    queryFn: () => atlas.activity.listForEntity('Task', taskId, token, limit),
    enabled: Boolean(token) && Boolean(taskId),
    staleTime: 15 * 1000,
  })
}

// ── Bulk ──────────────────────────────────────────────────────────────────────

export function useBulkUpdateTasks(projectId) {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ taskIds, patch }) => atlas.projects.bulkUpdateTasks(projectId, { taskIds, patch }, token),
    ...loadingMutation('Actualizando tareas...'),
    onSuccess: (data, vars, ctx) => {
      toast.dismiss(ctx?.toastId)
      qc.invalidateQueries({ queryKey: ['projects', projectId, 'tasks'] })
    },
  })
}

export function useBulkDeleteTasks(projectId) {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ taskIds }) => atlas.projects.bulkDeleteTasks(projectId, { taskIds }, token),
    ...loadingMutation('Eliminando tareas...'),
    onSuccess: (data, vars, ctx) => {
      toast.dismiss(ctx?.toastId)
      qc.invalidateQueries({ queryKey: ['projects', projectId, 'tasks'] })
    },
  })
}

export function useAllTasksForPicker(projectId, enabled = false) {
  const token = useToken()
  return useQuery({
    queryKey: ['projects', projectId, 'tasks', '__picker__'],
    queryFn: () => atlas.projects.listTasks(projectId, {}, token),
    enabled: Boolean(token) && Boolean(projectId) && enabled,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}
