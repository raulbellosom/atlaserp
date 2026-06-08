import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../../auth/AuthProvider'
import { atlas } from '../../../lib/atlas'

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

export function useCreateProject() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => atlas.projects.createProject(data, token),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  })
}

export function useUpdateProject(projectId) {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => atlas.projects.updateProject(projectId, data, token),
    onSuccess: () => {
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects', projectId, 'members'] }),
  })
}

export function useRemoveMember(projectId) {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (userId) => atlas.projects.removeMember(projectId, userId, token),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects', projectId, 'members'] }),
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
  })
}

export function useCreateStatus(projectId) {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => atlas.projects.createStatus(projectId, data, token),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects', projectId, 'statuses'] }),
  })
}

export function useUpdateStatus(projectId) {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ statusId, ...data }) => atlas.projects.updateStatus(projectId, statusId, data, token),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects', projectId, 'statuses'] }),
  })
}

export function useDeleteStatus(projectId) {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (statusId) => atlas.projects.deleteStatus(projectId, statusId, token),
    onSuccess: () => {
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
  })
}

export function useTask(projectId, taskId) {
  const token = useToken()
  return useQuery({
    queryKey: ['projects', projectId, 'tasks', taskId],
    queryFn: () => atlas.projects.getTask(projectId, taskId, token),
    enabled: Boolean(token) && Boolean(projectId) && Boolean(taskId),
    staleTime: 30 * 1000,
  })
}

export function useCreateTask(projectId) {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => atlas.projects.createTask(projectId, data, token),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects', projectId, 'tasks'] }),
  })
}

export function useUpdateTask(projectId) {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ taskId, ...data }) => atlas.projects.updateTask(projectId, taskId, data, token),
    onSuccess: (_, { taskId }) => {
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects', projectId, 'tasks'] }),
  })
}

export function useDeleteTask(projectId) {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (taskId) => atlas.projects.deleteTask(projectId, taskId, token),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects', projectId, 'tasks'] }),
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
