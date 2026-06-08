import { useState } from 'react'
import { FolderKanban, Plus, LayoutGrid, List, Calendar, Settings2, Users, ArrowLeft, Circle } from 'lucide-react'
import { PageHeader, Button, Badge, EmptyState, ErrorState } from '@atlas/ui'
import { useProjects } from '../hooks/useProjectsData'
import KanbanView from '../components/KanbanView.jsx'
import ListView from '../components/ListView.jsx'
import TimelineView from '../components/TimelineView.jsx'
import TaskDetailPanel from '../components/TaskDetailPanel.jsx'
import ProjectFormModal from '../components/ProjectFormModal.jsx'
import TaskFormModal from '../components/TaskFormModal.jsx'
import StatusEditor from '../components/StatusEditor.jsx'
import MembersPanel from '../components/MembersPanel.jsx'

const VIEWS = [
  { key: 'kanban', label: 'Kanban', Icon: LayoutGrid },
  { key: 'list',   label: 'Lista',  Icon: List },
  { key: 'timeline', label: 'Timeline', Icon: Calendar },
]

const LIFECYCLE_BADGE = {
  ACTIVE:    { label: 'Activo',     variant: 'default' },
  COMPLETED: { label: 'Completado', variant: 'secondary' },
  ARCHIVED:  { label: 'Archivado',  variant: 'outline' },
}

export default function ProjectsScreen() {
  const { data: projects, isLoading, isError, error } = useProjects()
  const [openProject, setOpenProject] = useState(null)
  const [activeView, setActiveView] = useState('kanban')
  const [taskPanelId, setTaskPanelId] = useState(null)
  const [projectFormOpen, setProjectFormOpen] = useState(false)
  const [editingProject, setEditingProject] = useState(null)
  const [statusEditorOpen, setStatusEditorOpen] = useState(false)
  const [taskFormOpen, setTaskFormOpen] = useState(false)
  const [membersOpen, setMembersOpen] = useState(false)

  const projectList = projects?.data ?? projects ?? []

  function openTask(taskId) { setTaskPanelId(taskId) }
  function closeTask() { setTaskPanelId(null) }
  function openNewProject() { setEditingProject(null); setProjectFormOpen(true) }
  function openEditProject() { setEditingProject(openProject); setProjectFormOpen(true) }

  if (isLoading) {
    return (
      <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-28 rounded-xl bg-muted animate-pulse" />
        ))}
      </div>
    )
  }

  if (isError) {
    return <ErrorState title="No se pudo cargar Proyectos" message={error?.message} />
  }

  /* ── Project detail view ─────────────────────────────────────────── */
  if (openProject) {
    const project = projectList.find((p) => p.id === openProject.id) ?? openProject
    return (
      <div className="flex flex-col h-full min-h-0">
        {/* Top bar */}
        <div className="flex items-center gap-2 px-6 py-3 border-b border-border shrink-0">
          <button
            onClick={() => { setOpenProject(null); setTaskPanelId(null) }}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mr-1"
          >
            <ArrowLeft size={14} />
            Proyectos
          </button>
          <span className="text-muted-foreground/40 text-xs">/</span>
          <div
            className="w-3 h-3 rounded-full shrink-0"
            style={{ background: project.color ?? '#6366f1' }}
          />
          <h1 className="font-semibold text-sm truncate flex-1">{project.name}</h1>
          <Badge variant={LIFECYCLE_BADGE[project.status]?.variant ?? 'secondary'} className="text-xs">
            {LIFECYCLE_BADGE[project.status]?.label ?? project.status}
          </Badge>
          <Button variant="ghost" size="icon" title="Miembros" onClick={() => setMembersOpen(true)}>
            <Users size={15} />
          </Button>
          <Button variant="ghost" size="icon" title="Gestionar columnas" onClick={() => setStatusEditorOpen(true)}>
            <Settings2 size={15} />
          </Button>
          <Button variant="ghost" size="sm" onClick={openEditProject}>Editar</Button>
          <Button size="sm" onClick={() => setTaskFormOpen(true)}>
            <Plus size={13} className="mr-1" />
            Nueva tarea
          </Button>
          {/* View switcher */}
          <div className="flex gap-0.5 border border-border rounded-md p-0.5 ml-1">
            {VIEWS.map(({ key, label, Icon }) => (
              <button
                key={key}
                onClick={() => setActiveView(key)}
                title={label}
                className={[
                  'flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors',
                  activeView === key
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                ].join(' ')}
              >
                <Icon size={13} />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Active view */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {activeView === 'kanban'   && <KanbanView   projectId={project.id} onTaskClick={openTask} />}
          {activeView === 'list'     && <ListView     projectId={project.id} onTaskClick={openTask} />}
          {activeView === 'timeline' && <TimelineView projectId={project.id} onTaskClick={openTask} />}
        </div>

        {taskPanelId && (
          <TaskDetailPanel projectId={project.id} taskId={taskPanelId} onClose={closeTask} />
        )}

        <TaskFormModal
          open={taskFormOpen}
          onOpenChange={setTaskFormOpen}
          projectId={project.id}
        />
        <StatusEditor
          open={statusEditorOpen}
          onOpenChange={setStatusEditorOpen}
          projectId={project.id}
        />
        <MembersPanel
          open={membersOpen}
          onOpenChange={setMembersOpen}
          projectId={project.id}
        />
        <ProjectFormModal
          open={projectFormOpen}
          onOpenChange={setProjectFormOpen}
          project={editingProject}
          onCreated={(p) => setOpenProject(p)}
          onArchived={() => setOpenProject(null)}
        />
      </div>
    )
  }

  /* ── Project list view ───────────────────────────────────────────── */
  return (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-5">
        <PageHeader
          eyebrow="Atlas ERP"
          title="Proyectos"
          description="Gestiona tus proyectos y tareas del equipo."
          actions={
            <Button size="sm" onClick={openNewProject}>
              <Plus size={14} className="mr-1" />
              Nuevo proyecto
            </Button>
          }
        />
      </div>

      <div className="flex-1 overflow-auto px-6 pb-6 pt-4">
        {projectList.length === 0 ? (
          <EmptyState
            icon={FolderKanban}
            title="Sin proyectos"
            description="Crea tu primer proyecto para empezar a gestionar tareas."
            action={{ label: 'Nuevo proyecto', onClick: openNewProject }}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projectList.map((p) => (
              <ProjectCard
                key={p.id}
                project={p}
                onClick={() => setOpenProject(p)}
              />
            ))}
          </div>
        )}
      </div>

      <ProjectFormModal
        open={projectFormOpen}
        onOpenChange={setProjectFormOpen}
        project={editingProject}
        onCreated={(p) => setOpenProject(p)}
        onArchived={() => {}}
      />
    </div>
  )
}

function ProjectCard({ project, onClick }) {
  const badge = LIFECYCLE_BADGE[project.status]
  const taskCount = project._count?.tasks ?? 0
  const members = project.members ?? []

  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left p-4 rounded-xl border border-border hover:border-ring hover:bg-muted/40 transition-colors"
    >
      <div className="flex items-center gap-2 mb-2">
        <span
          className="w-3 h-3 rounded-full shrink-0"
          style={{ background: project.color ?? '#6366f1' }}
        />
        <span className="font-semibold text-sm truncate flex-1">{project.name}</span>
        {badge && (
          <Badge variant={badge.variant} className="text-[10px] px-1.5 py-0">
            {badge.label}
          </Badge>
        )}
      </div>
      {project.description && (
        <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{project.description}</p>
      )}
      <div className="flex items-center justify-between mt-auto">
        <span className="text-xs text-muted-foreground">
          {taskCount} {taskCount === 1 ? 'tarea' : 'tareas'}
        </span>
        {members.length > 0 && (
          <div className="flex -space-x-1">
            {members.slice(0, 4).map((m) => {
              const u = m.user ?? m
              const initials = [u.firstName?.[0], u.lastName?.[0]].filter(Boolean).join('').toUpperCase() || '?'
              return (
                <span
                  key={m.id ?? u.id}
                  className="w-5 h-5 rounded-full bg-muted border border-background flex items-center justify-center text-[9px] font-medium text-muted-foreground"
                  title={[u.firstName, u.lastName].filter(Boolean).join(' ') || u.email || ''}
                >
                  {initials}
                </span>
              )
            })}
            {members.length > 4 && (
              <span className="w-5 h-5 rounded-full bg-muted border border-background flex items-center justify-center text-[9px] text-muted-foreground">
                +{members.length - 4}
              </span>
            )}
          </div>
        )}
      </div>
    </button>
  )
}
