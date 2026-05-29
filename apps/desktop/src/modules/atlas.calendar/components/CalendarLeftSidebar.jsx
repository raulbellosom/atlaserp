import { Plus, MoreHorizontal, Check, Pencil, Users } from 'lucide-react'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator,
} from '@atlas/ui'
import MiniCalendar from './MiniCalendar'
import { useCalendarStore } from '../stores/useCalendarStore'
import { useCalendars } from '../hooks/useCalendarData'
import { CalendarIcon } from '../calendarIcons'

function CalendarColorToggle({ color, checked, onChange }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className="w-4 h-4 shrink-0 rounded-sm flex items-center justify-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
      style={{
        backgroundColor: checked ? color : 'transparent',
        border: `2px solid ${color}`,
      }}
    >
      {checked && <Check size={9} color="#fff" strokeWidth={3} />}
    </button>
  )
}

function CalendarItem({ cal, isActive, allIds, onToggle, onEdit, onManage }) {
  const calColor = cal.color || '#6B46C1'
  return (
    <div className="flex items-center gap-2 py-1 group">
      <CalendarColorToggle
        color={calColor}
        checked={isActive}
        onChange={() => onToggle(cal.id, allIds)}
      />
      {cal.icon && (
        <CalendarIcon name={cal.icon} size={11} color={calColor} className="shrink-0" />
      )}
      <span
        className="text-xs text-[hsl(var(--foreground))] truncate flex-1 min-w-0 cursor-pointer select-none"
        onClick={() => onToggle(cal.id, allIds)}
      >
        {cal.name}
      </span>
      <div className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="p-0.5 rounded hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"
              title="Opciones"
            >
              <MoreHorizontal size={12} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={() => onEdit(cal)}>
              <Pencil size={13} className="mr-2 shrink-0" />
              Editar calendario
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onManage(cal)}>
              <Users size={13} className="mr-2 shrink-0" />
              Gestionar acceso
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

function SharedCalendarItem({ cal, isActive, allIds, onToggle }) {
  const calColor = cal.color || '#6B46C1'
  return (
    <div className="flex items-center gap-2 py-1">
      <CalendarColorToggle
        color={calColor}
        checked={isActive}
        onChange={() => onToggle(cal.id, allIds)}
      />
      {cal.icon && (
        <CalendarIcon name={cal.icon} size={11} color={calColor} className="shrink-0" />
      )}
      <span
        className="text-xs text-[hsl(var(--foreground))] truncate flex-1 min-w-0 cursor-pointer select-none"
        onClick={() => onToggle(cal.id, allIds)}
      >
        {cal.name}
      </span>
    </div>
  )
}

export default function CalendarLeftSidebar({ onNewCalendar, onEditCalendar, onShareCalendar }) {
  const { selectedDate, setSelectedDate, activeCalendarIds, toggleCalendarFilter } = useCalendarStore()
  const { data, isLoading } = useCalendars()
  const owned = data?.owned ?? []
  const shared = data?.shared ?? []

  const allIds = [...owned.map(c => c.id), ...shared.map(c => c.id)]

  function isActive(id) {
    return activeCalendarIds.length === 0 || activeCalendarIds.includes(id)
  }

  return (
    <aside className="w-56 shrink-0 flex flex-col border-r border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] overflow-y-auto">
      <div className="pt-3">
        <MiniCalendar selectedDate={selectedDate} onSelectDate={setSelectedDate} />
      </div>

      <div className="flex-1 px-3 pt-3 space-y-4 pb-4">
        <section>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
              Mis calendarios
            </span>
            <button
              onClick={onNewCalendar}
              className="p-0.5 rounded hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"
              title="Nuevo calendario"
            >
              <Plus size={12} />
            </button>
          </div>

          {isLoading && (
            <div className="text-xs text-[hsl(var(--muted-foreground))] py-1">Cargando...</div>
          )}

          {owned.map((cal) => (
            <CalendarItem
              key={cal.id}
              cal={cal}
              isActive={isActive(cal.id)}
              allIds={allIds}
              onToggle={toggleCalendarFilter}
              onEdit={onEditCalendar ?? (() => {})}
              onManage={onShareCalendar ?? (() => {})}
            />
          ))}
        </section>

        {shared.length > 0 && (
          <section>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))] mb-2">
              Compartidos
            </div>
            {shared.map((cal) => (
              <SharedCalendarItem
                key={cal.id}
                cal={cal}
                isActive={isActive(cal.id)}
                allIds={allIds}
                onToggle={toggleCalendarFilter}
              />
            ))}
          </section>
        )}
      </div>
    </aside>
  )
}
