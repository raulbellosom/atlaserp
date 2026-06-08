import { useState, useMemo } from 'react'
import { SearchInput, EmptyState } from '@atlas/ui'
import { ChevronRight } from 'lucide-react'
import { useStatuses, useTasks } from '../hooks/useProjectsData'

const PRIORITY_OPTIONS = [
  { value: '', label: 'Todas' },
  { value: 'URGENT', label: 'Urgente' },
  { value: 'HIGH', label: 'Alta' },
  { value: 'MEDIUM', label: 'Media' },
  { value: 'LOW', label: 'Baja' },
  { value: 'NONE', label: 'Normal' },
]

const PRIORITY_BADGE = {
  URGENT: { label: 'Urgente', cls: 'bg-red-500/20 text-red-400' },
  HIGH:   { label: 'Alta',    cls: 'bg-orange-500/20 text-orange-400' },
  MEDIUM: { label: 'Media',   cls: 'bg-blue-500/20 text-blue-400' },
  LOW:    { label: 'Baja',    cls: 'bg-slate-500/20 text-slate-400' },
  NONE:   { label: 'Normal',  cls: 'bg-muted text-muted-foreground' },
}

function isOverdue(dueDate) {
  if (!dueDate) return false
  return new Date(dueDate) < new Date()
}

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
}

export default function ListView({ projectId, onTaskClick }) {
  const { data: statusesData } = useStatuses(projectId)
  const { data: tasksData, isLoading } = useTasks(projectId, { parent_task_id: 'null' })
  const statuses = statusesData?.data ?? statusesData ?? []
  const tasks = tasksData?.data ?? tasksData ?? []

  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterPriority, setFilterPriority] = useState('')

  const statusMap = useMemo(() => {
    const m = {}
    for (const s of statuses) m[s.id] = s
    return m
  }, [statuses])

  const filtered = useMemo(() => {
    let list = tasks
    if (search) {
      const q = search.toLowerCase()
      list = list.filter((t) => t.title.toLowerCase().includes(q))
    }
    if (filterStatus) list = list.filter((t) => t.status_id === filterStatus)
    if (filterPriority) list = list.filter((t) => t.priority === filterPriority)
    return list.sort((a, b) => {
      const sA = statusMap[a.status_id]?.position ?? 0
      const sB = statusMap[b.status_id]?.position ?? 0
      if (sA !== sB) return sA - sB
      return a.position - b.position
    })
  }, [tasks, search, filterStatus, filterPriority, statusMap])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border flex-shrink-0 flex-wrap">
        <SearchInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar tareas..."
          className="w-48"
        />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="text-sm border border-border bg-background rounded px-2 py-1.5 text-muted-foreground"
        >
          <option value="">Estado: Todos</option>
          {statuses.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <select
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value)}
          className="text-sm border border-border bg-background rounded px-2 py-1.5 text-muted-foreground"
        >
          {PRIORITY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.value ? `Prioridad: ${o.label}` : 'Prioridad: Todas'}
            </option>
          ))}
        </select>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <p className="text-sm text-muted-foreground p-6">Cargando tareas...</p>
        )}
        {!isLoading && filtered.length === 0 && (
          <EmptyState title="Sin tareas" description="No hay tareas que coincidan con los filtros." />
        )}
        {filtered.length > 0 && (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-background border-b border-border">
              <tr>
                <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">Tarea</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide w-28">Asignado</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide w-24">Prioridad</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide w-24">Vence</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide w-28">Estado</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((task) => {
                const status = statusMap[task.status_id]
                const priority = PRIORITY_BADGE[task.priority] ?? PRIORITY_BADGE.NONE
                const overdue = isOverdue(task.due_date)
                return (
                  <tr
                    key={task.id}
                    onClick={() => onTaskClick(task.id)}
                    className="border-b border-border hover:bg-muted/50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="truncate max-w-xs">{task.title}</span>
                        {task._count?.subtasks > 0 && (
                          <span className="text-xs text-muted-foreground">({task._count.subtasks})</span>
                        )}
                        <ChevronRight size={14} className="ml-auto text-muted-foreground" />
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {task.assignee_profile?.full_name ?? '—'}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`text-xs rounded-full px-2 py-0.5 ${priority.cls}`}>
                        {priority.label}
                      </span>
                    </td>
                    <td className={`px-3 py-2.5 text-xs ${overdue ? 'text-red-400 font-medium' : 'text-muted-foreground'}`}>
                      {formatDate(task.due_date)}
                    </td>
                    <td className="px-3 py-2.5">
                      {status && (
                        <span
                          className="text-xs rounded-full px-2 py-0.5 border"
                          style={{ borderColor: `${status.color}50`, color: status.color }}
                        >
                          {status.name}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
