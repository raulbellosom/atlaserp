import { useState } from 'react'
import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from 'lucide-react'
import { useCalendarStore } from '../stores/useCalendarStore'
import CalendarToolbar from '../components/CalendarToolbar'
import CalendarLeftSidebar from '../components/CalendarLeftSidebar'
import CalendarRightSidebar from '../components/CalendarRightSidebar'
import MonthView from '../components/MonthView'
import WeekView from '../components/WeekView'
import DayView from '../components/DayView'
import AgendaView from '../components/AgendaView'
import EventDetailModal from '../components/EventDetailModal'
import EventFormModal from '../components/EventFormModal'
import CalendarFormModal from '../components/CalendarFormModal'
import CalendarShareModal from '../components/CalendarShareModal'

export default function CalendarScreen() {
  const {
    activeView,
    selectedDate,
    setSelectedDate,
    leftSidebarOpen,
    rightSidebarOpen,
    toggleLeftSidebar,
    toggleRightSidebar,
  } = useCalendarStore()

  const [detailEvent, setDetailEvent] = useState(null)
  const [formState, setFormState] = useState(null)
  const [showCalendarForm, setShowCalendarForm] = useState(false)
  const [shareCalendar, setShareCalendar] = useState(null)

  function openNewEvent() {
    setFormState({ _isNew: true, defaultDate: selectedDate })
  }

  function openEditEvent(event) {
    setDetailEvent(null)
    setFormState(event)
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[hsl(var(--surface-1))]">
      {/* Top toolbar row */}
      <div className="flex items-center gap-1 border-b border-[hsl(var(--border))] shrink-0">
        <button
          onClick={toggleLeftSidebar}
          className="p-2 ml-2 rounded hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] shrink-0"
          title={leftSidebarOpen ? 'Ocultar sidebar izquierdo' : 'Mostrar sidebar izquierdo'}
        >
          {leftSidebarOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
        </button>

        <div className="flex-1 min-w-0">
          <CalendarToolbar onNewEvent={openNewEvent} />
        </div>

        <button
          onClick={toggleRightSidebar}
          className="p-2 mr-2 rounded hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] shrink-0"
          title={rightSidebarOpen ? 'Ocultar panel derecho' : 'Mostrar panel derecho'}
        >
          {rightSidebarOpen ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
        </button>
      </div>

      {/* Main area */}
      <div className="flex-1 flex overflow-hidden">
        {leftSidebarOpen && (
          <CalendarLeftSidebar
            onNewCalendar={() => setShowCalendarForm(true)}
            onShareCalendar={(cal) => setShareCalendar(cal)}
          />
        )}

        <div className="flex-1 flex overflow-hidden min-w-0">
          {activeView === 'month' && (
            <MonthView
              onEventClick={setDetailEvent}
              onDayClick={(dateStr) => setSelectedDate(dateStr)}
            />
          )}
          {activeView === 'week' && <WeekView onEventClick={setDetailEvent} />}
          {activeView === 'day' && <DayView onEventClick={setDetailEvent} />}
          {activeView === 'agenda' && <AgendaView onEventClick={setDetailEvent} />}
        </div>

        {rightSidebarOpen && (
          <CalendarRightSidebar onNewEvent={openNewEvent} />
        )}
      </div>

      {/* Modals */}
      {detailEvent && (
        <EventDetailModal
          event={detailEvent}
          onClose={() => setDetailEvent(null)}
          onEdit={openEditEvent}
          canEdit
          canDelete
        />
      )}

      {formState !== null && (
        <EventFormModal
          event={formState?._isNew ? undefined : formState}
          defaultDate={formState?._isNew ? selectedDate : undefined}
          onClose={() => setFormState(null)}
          onSaved={() => setFormState(null)}
        />
      )}

      {showCalendarForm && (
        <CalendarFormModal onClose={() => setShowCalendarForm(false)} />
      )}

      {shareCalendar && (
        <CalendarShareModal
          calendar={shareCalendar}
          onClose={() => setShareCalendar(null)}
        />
      )}
    </div>
  )
}
