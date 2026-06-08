import { useState } from 'react'
import { FolderKanban, Plus, LayoutGrid, List, Calendar, Settings2, Users } from 'lucide-react'
import {
  Button, Badge, EmptyState, ErrorState,
} from '@atlas/ui'
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
  { key: 'list', label: 'Lista', Icon: List },
  { key: 'timeline', label: 'Timeline', Icon: Calendar },
]

const LIFECYCLE_BADGE = {
  ACTIVE: { label: 'Activo', variant: 'default' },
  COMPLETED: { label: 'Completado', variant: 'secondary' },
  ARCHIVED: { label: 'Archivado', variant: 'outline' },
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

  const projectList = projects?.data ?? projects ?? []
  const selectedProject = projectList.find((p) => p.id === selectedId) ?? projectList[0] ?? null
  const effectiveId = selectedProject?.id ?? null

  function openTask(taskId) { setTaskPanelId(taskId) }
  function closeTask() { setTaskPanelId(null) }

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
    <div className="flex h-full min-h-0">
      {/* Left sidebar */}
      <aside className="w-52 flex-shrink-0 border-r border-border flex flex-col">
        <div className="px-3 pt-4 pb-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Proyectos
          </span>
        </div>
        <nav className="flex-1 overflow-y-auto px-2 space-y-0.5">
          {projectList.length === 0 && (
            <p className="px-2 py-3 text-xs text-muted-foreground">Sin proyectos</p>
          )}
          {projectList.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedId(p.id)}
              className={[
                'w-full text-left px-2 py-1.5 rounded text-sm truncate transition-colors',
                p.id === effectiveId
                  ? 'bg-accent text-accent-foreground font-medium'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              ].join(' ')}
            >
              <span
                className="inline-block w-2 h-2 rounded-full mr-2 shrink-0"
                style={{ background: p.color ?? '#6366f1' }}
              />
              {p.name}
            </button>
          ))}
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
          <EmptyState
            icon={FolderKanban}
            title="Sin proyectos"
            description="Crea tu primer proyecto para empezar a gestionar tareas."
            action={{
              label: 'Nuevo proyecto',
              onClick: () => { setEditingProject(null); setProjectFormOpen(true) },
            }}
          />
        ) : (
          <>
            {/* Project header */}
            <div className="flex items-center gap-3 px-6 py-4 border-b border-border flex-shrink-0">
              <div className="flex-1 min-w-0">
                <h1 className="text-lg font-semibold leading-tight truncate">{selectedProject.name}</h1>
                {selectedProject.description && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{selectedProject.description}</p>
                )}
              </div>
              <Badge variant={LIFECYCLE_BADGE[selectedProject.status]?.variant ?? 'secondary'}>
                {LIFECYCLE_BADGE[selectedProject.status]?.label ?? selectedProject.status}
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                title="Miembros"
                onClick={() => setMembersOpen(true)}
              >
                <Users size={16} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                title="Gestionar columnas"
                onClick={() => setStatusEditorOpen(true)}
              >
                <Settings2 size={16} />
              </Button>
              <Button
                size="sm"
                onClick={() => setTaskFormOpen(true)}
              >
                <Plus size={14} className="mr-1" />
                Nueva tarea
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setEditingProject(selectedProject); setProjectFormOpen(true) }}
              >
                Editar
              </Button>
              {/* View switcher */}
              <div className="flex gap-1 border border-border rounded-md p-0.5">
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
              {activeView === 'kanban' && (
                <KanbanView projectId={effectiveId} onTaskClick={openTask} />
              )}
              {activeView === 'list' && (
                <ListView projectId={effectiveId} onTaskClick={openTask} />
              )}
              {activeView === 'timeline' && (
                <TimelineView projectId={effectiveId} onTaskClick={openTask} />
              )}
            </div>
          </>
        )}
      </main>

      {/* Task detail panel */}
      {taskPanelId && (
        <TaskDetailPanel
          projectId={effectiveId}
          taskId={taskPanelId}
          onClose={closeTask}
        />
      )}

      {/* Project form modal */}
      <ProjectFormModal
        open={projectFormOpen}
        onOpenChange={setProjectFormOpen}
        project={editingProject}
        onCreated={(p) => setSelectedId(p.id)}
        onArchived={() => setSelectedId(null)}
      />

      {/* Task form modal */}
      {effectiveId && (
        <TaskFormModal
          open={taskFormOpen}
          onOpenChange={setTaskFormOpen}
          projectId={effectiveId}
        />
      )}

      {/* Status editor */}
      {selectedProject && (
        <StatusEditor
          open={statusEditorOpen}
          onOpenChange={setStatusEditorOpen}
          projectId={effectiveId}
        />
      )}

      {/* Members panel */}
      {selectedProject && (
        <MembersPanel
          open={membersOpen}
          onOpenChange={setMembersOpen}
          projectId={effectiveId}
        />
      )}
    </div>
  )
}
