import { useMemo } from 'react'
import { EmptyState } from '@atlas/ui'
import { CalendarOff } from 'lucide-react'
import { useTasks } from '../hooks/useProjectsData'

const COL_WIDTH = 120
const ROW_HEIGHT = 40

function getWeeks(start, end) {
  const weeks = []
  const cur = new Date(start)
  cur.setDate(cur.getDate() - cur.getDay())
  while (cur <= end) {
    weeks.push(new Date(cur))
    cur.setDate(cur.getDate() + 7)
  }
  return weeks
}

function weekLabel(d) {
  return d.toLocaleDateString('es-MX', { month: 'short', day: 'numeric' })
}

function msToPercent(ms, totalMs) {
  return Math.max(0, Math.min(100, (ms / totalMs) * 100))
}

export default function TimelineView({ projectId, onTaskClick }) {
  const { data: tasksData, isLoading } = useTasks(projectId, { parent_task_id: 'null' })
  const tasks = tasksData?.data ?? tasksData ?? []

  const datedTasks = tasks.filter((t) => t.start_date || t.due_date)
  const undatedTasks = tasks.filter((t) => !t.start_date && !t.due_date)

  const { weeks, timelineStart, totalMs } = useMemo(() => {
    if (datedTasks.length === 0) return { weeks: [], timelineStart: new Date(), totalMs: 1 }
    const dates = datedTasks
      .flatMap((t) => [t.start_date, t.due_date].filter(Boolean).map((d) => new Date(d)))
    const min = new Date(Math.min(...dates))
    const max = new Date(Math.max(...dates))
    min.setDate(min.getDate() - 7)
    max.setDate(max.getDate() + 7)
    return { weeks: getWeeks(min, max), timelineStart: min, totalMs: max - min }
  }, [datedTasks])

  if (isLoading) return <p className="text-sm text-muted-foreground p-6">Cargando...</p>

  if (datedTasks.length === 0) {
    return (
      <EmptyState
        icon={CalendarOff}
        title="Sin fechas"
        description="Agrega start_date o due_date a las tareas para verlas en el timeline."
      />
    )
  }

  const totalWidth = weeks.length * COL_WIDTH

  return (
    <div className="flex h-full overflow-hidden">
      <div className="w-44 flex-shrink-0 border-r border-border overflow-y-auto">
        <div style={{ height: ROW_HEIGHT }} className="border-b border-border" />
        {datedTasks.map((task) => (
          <div
            key={task.id}
            onClick={() => onTaskClick(task.id)}
            style={{ height: ROW_HEIGHT }}
            className="flex items-center px-3 text-sm truncate border-b border-border hover:bg-muted/50 cursor-pointer"
          >
            {task.title}
          </div>
        ))}
        {undatedTasks.length > 0 && (
          <>
            <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide border-b border-border">
              Sin fecha
            </div>
            {undatedTasks.map((task) => (
              <div
                key={task.id}
                onClick={() => onTaskClick(task.id)}
                style={{ height: ROW_HEIGHT }}
                className="flex items-center px-3 text-sm truncate border-b border-border text-muted-foreground hover:bg-muted/50 cursor-pointer"
              >
                {task.title}
              </div>
            ))}
          </>
        )}
      </div>

      <div className="flex-1 overflow-x-auto overflow-y-auto">
        <div style={{ minWidth: totalWidth }}>
          <div className="flex border-b border-border sticky top-0 bg-background z-10" style={{ height: ROW_HEIGHT }}>
            {weeks.map((w, i) => (
              <div
                key={i}
                style={{ width: COL_WIDTH }}
                className="flex-shrink-0 flex items-center justify-center text-xs text-muted-foreground border-r border-border"
              >
                {weekLabel(w)}
              </div>
            ))}
          </div>

          {datedTasks.map((task) => {
            const start = task.start_date ? new Date(task.start_date) : new Date(task.due_date)
            const end = task.due_date ? new Date(task.due_date) : new Date(task.start_date)
            const isMilestone = !task.start_date || task.start_date === task.due_date

            const leftPct = msToPercent(start - timelineStart, totalMs)
            const widthPct = isMilestone ? 0 : msToPercent(end - start, totalMs)

            return (
              <div
                key={task.id}
                style={{ height: ROW_HEIGHT, position: 'relative' }}
                className="border-b border-border"
              >
                {weeks.map((_, i) => (
                  <div
                    key={i}
                    style={{ position: 'absolute', left: i * COL_WIDTH, top: 0, bottom: 0, width: 1 }}
                    className="bg-border"
                  />
                ))}
                {isMilestone ? (
                  <div
                    onClick={() => onTaskClick(task.id)}
                    style={{
                      position: 'absolute',
                      left: `calc(${leftPct}% - 6px)`,
                      top: '50%',
                      transform: 'translateY(-50%) rotate(45deg)',
                      width: 12,
                      height: 12,
                      background: '#6366f1',
                      cursor: 'pointer',
                    }}
                    title={task.title}
                  />
                ) : (
                  <div
                    onClick={() => onTaskClick(task.id)}
                    style={{
                      position: 'absolute',
                      left: `${leftPct}%`,
                      width: `${widthPct}%`,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      height: 20,
                      background: '#6366f1',
                      borderRadius: 10,
                      minWidth: 20,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      paddingLeft: 8,
                      overflow: 'hidden',
                    }}
                    title={task.title}
                  >
                    <span className="text-[10px] text-white whitespace-nowrap overflow-hidden">{task.title}</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
