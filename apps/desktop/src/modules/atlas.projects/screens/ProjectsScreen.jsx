import { useState } from 'react'
import { Plus, LayoutGrid, List, Calendar, Settings2, Users, Menu, X } from 'lucide-react'
import { Button, Badge, EmptyState, ErrorState } from '@atlas/ui'
import { useProjects } from '../hooks/useProjectsData'
import { getProjectIcon } from '../lib/projectIcons.js'
import KanbanView from '../components/KanbanView.jsx'
import ListView from '../components/ListView.jsx'
import TimelineView from '../components/TimelineView.jsx'
import TaskDetailPanel from '../components/TaskDetailPanel.jsx'
import ProjectFormModal from '../components/ProjectFormModal.jsx'
import TaskFormModal from '../components/TaskFormModal.jsx'
import StatusEditor from '../components/StatusEditor.jsx'
import MembersPanel from '../components/MembersPanel.jsx'

const VIEWS = [
  { key: 'kanban',    label: 'Kanban',   Icon: LayoutGrid },
  { key: 'list',      label: 'Lista',    Icon: List },
  { key: 'timeline',  label: 'Timeline', Icon: Calendar },
]

const LIFECYCLE_BADGE = {
  ACTIVE:    { label: 'Activo',     variant: 'success' },
  COMPLETED: { label: 'Completado', variant: 'secondary' },
  ARCHIVED:  { label: 'Archivado',  variant: 'outline' },
}

export default function ProjectsScreen() {
  const { data: projects, isLoading, isError, error } = useProjects()
  const [selectedId, setSelectedId] = useState(null)
  const [activeView, setActiveView] = useState('kanban')
  const [taskPanelId, setTaskPanelId] = useState(null)
  const [projectFormOpen, setProjectFormOpen] = useState(false)
  const [editingProject, setEditingProject] = useState(null)
  const [statusEditorOpen, setStatusEditorOpen] = useState(false)
  const [taskFormOpen, setTaskFormOpen] = useState(false)
  const [membersOpen, setMembersOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showSubtasks, setShowSubtasks] = useState(false)

  const projectList = projects?.data ?? projects ?? []
  const selectedProject = projectList.find((p) => p.id === selectedId) ?? projectList[0] ?? null
  const effectiveId = selectedProject?.id ?? null

  function openTask(taskId) { setTaskPanelId(taskId) }
  function closeTask() { setTaskPanelId(null) }
  function closeSidebar() { setSidebarOpen(false) }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60dvh]">
        <span className="text-sm text-muted-foreground">Cargando proyectos...</span>
      </div>
    )
  }

  if (isError) {
    return <ErrorState title="No se pudo cargar Proyectos" message={error?.message} />
  }

  return (
    <div className="flex h-full min-h-0 relative">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-10 bg-black/40 lg:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* Project list sidebar */}
      <aside className={[
        'w-60 shrink-0 border-r border-border flex flex-col bg-background',
        'transition-transform duration-200 ease-in-out',
        // Mobile: absolute drawer sliding from left
        'absolute inset-y-0 left-0 z-20',
        // Desktop: always visible inline (no absolute)
        'lg:relative lg:z-auto lg:translate-x-0',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
      ].join(' ')}>
        <div className="flex items-center justify-between px-3 pt-4 pb-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Proyectos
          </span>
          <button
            onClick={closeSidebar}
            className="lg:hidden text-muted-foreground hover:text-foreground transition-colors"
          >
            <X size={14} />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto px-2 space-y-0.5">
          {projectList.length === 0 && (
            <p className="px-2 py-3 text-xs text-muted-foreground">Sin proyectos</p>
          )}
          {projectList.map((p) => {
            const ProjIcon = getProjectIcon(p.icon)
            const isActive = p.id === effectiveId
            return (
              <button
                key={p.id}
                onClick={() => { setSelectedId(p.id); closeSidebar() }}
                className={[
                  'w-full text-left px-2 py-1.5 rounded text-sm flex items-center gap-2 transition-colors',
                  isActive
                    ? 'bg-accent text-accent-foreground font-medium'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                ].join(' ')}
              >
                <span
                  className="inline-flex w-5 h-5 rounded items-center justify-center shrink-0"
                  style={{ background: p.color ?? '#6366f1' }}
                >
                  <ProjIcon size={11} className="text-white" />
                </span>
                <span className="truncate flex-1">{p.name}</span>
              </button>
            )
          })}
        </nav>
        <div className="p-2 border-t border-border">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground text-xs"
            onClick={() => { setEditingProject(null); setProjectFormOpen(true) }}
          >
            <Plus size={14} className="mr-1" />
            Nuevo proyecto
          </Button>
        </div>
      </aside>

      {/* Main area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {!selectedProject ? (
          <div className="relative flex-1 flex flex-col">
            <div className="px-4 py-3 lg:hidden border-b border-border">
              <button
                className="text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu size={16} />
              </button>
            </div>
            <EmptyState
              title="Sin proyectos"
              description="Crea tu primer proyecto para empezar a gestionar tareas."
              action={{
                label: 'Nuevo proyecto',
                onClick: () => { setEditingProject(null); setProjectFormOpen(true) },
              }}
            />
          </div>
        ) : (
          <>
            {/* Project header */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0">
              {/* Mobile hamburger */}
              <button
                className="lg:hidden text-muted-foreground hover:text-foreground transition-colors shrink-0"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu size={16} />
              </button>

              {/* Project icon + name */}
              <ProjectBadge project={selectedProject} />
              <div className="flex-1 min-w-0">
                <h1 className="text-sm font-semibold leading-tight truncate">{selectedProject.name}</h1>
              </div>

              <Badge variant={LIFECYCLE_BADGE[selectedProject.status]?.variant ?? 'secondary'} className="text-xs hidden sm:inline-flex">
                {LIFECYCLE_BADGE[selectedProject.status]?.label ?? selectedProject.status}
              </Badge>

              <Button variant="ghost" size="icon" title="Miembros" onClick={() => setMembersOpen(true)}>
                <Users size={15} />
              </Button>
              <Button variant="ghost" size="icon" title="Gestionar columnas" className="hidden sm:flex" onClick={() => setStatusEditorOpen(true)}>
                <Settings2 size={15} />
              </Button>
              <Button size="sm" onClick={() => setTaskFormOpen(true)}>
                <Plus size={13} className="mr-1 hidden sm:inline" />
                <span className="hidden sm:inline">Nueva tarea</span>
                <Plus size={13} className="sm:hidden" />
              </Button>
              <Button variant="ghost" size="sm" className="hidden sm:flex" onClick={() => { setEditingProject(selectedProject); setProjectFormOpen(true) }}>
                Editar
              </Button>

              {/* View switcher */}
              <div className="flex gap-0.5 border border-border rounded-md p-0.5">
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
                    <span className="hidden md:inline">{label}</span>
                  </button>
                ))}
              </div>

              <button
                onClick={() => setShowSubtasks((v) => !v)}
                title={showSubtasks ? 'Ocultar subtareas' : 'Mostrar subtareas'}
                className={[
                  'text-xs px-2 py-1 rounded border transition-colors',
                  showSubtasks
                    ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-400'
                    : 'border-border text-muted-foreground hover:text-foreground',
                ].join(' ')}
              >
                Subtareas
              </button>
            </div>

            {/* Active view */}
            <div className="flex-1 min-h-0 overflow-hidden">
              {activeView === 'kanban'   && <KanbanView   projectId={effectiveId} onTaskClick={openTask} showSubtasks={showSubtasks} />}
              {activeView === 'list'     && <ListView     projectId={effectiveId} onTaskClick={openTask} showSubtasks={showSubtasks} />}
              {activeView === 'timeline' && <TimelineView projectId={effectiveId} onTaskClick={openTask} showSubtasks={showSubtasks} />}
            </div>
          </>
        )}
      </main>

      {/* Task detail panel */}
      {taskPanelId && (
        <TaskDetailPanel projectId={effectiveId} taskId={taskPanelId} onClose={closeTask} />
      )}

      <ProjectFormModal
        open={projectFormOpen}
        onOpenChange={setProjectFormOpen}
        project={editingProject}
        onCreated={(p) => setSelectedId(p.id)}
        onArchived={() => setSelectedId(null)}
      />

      {effectiveId && (
        <TaskFormModal open={taskFormOpen} onOpenChange={setTaskFormOpen} projectId={effectiveId} />
      )}

      {selectedProject && (
        <StatusEditor open={statusEditorOpen} onOpenChange={setStatusEditorOpen} projectId={effectiveId} />
      )}

      {selectedProject && (
        <MembersPanel open={membersOpen} onOpenChange={setMembersOpen} projectId={effectiveId} />
      )}
    </div>
  )
}

function ProjectBadge({ project }) {
  const ProjIcon = getProjectIcon(project.icon)
  return (
    <span
      className="w-6 h-6 rounded flex items-center justify-center shrink-0"
      style={{ background: project.color ?? '#6366f1' }}
    >
      <ProjIcon size={13} className="text-white" />
    </span>
  )
}
