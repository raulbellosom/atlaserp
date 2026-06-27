import { useState, useCallback } from 'react'
import {
  Menu, X, Plus, ArrowLeft,
  Settings2, Share2, RotateCcw, Trash2, PenLine
} from 'lucide-react'
import { ConfirmDialog } from '@atlas/ui'
import { useNotes, useCreateNote } from './hooks/useNotes.js'
import { useUpdateNote, useTrashNote, useRestoreNote, usePermanentDeleteNote } from './hooks/useNote.js'
import { usePublishNote, useUnpublishNote } from './hooks/useNoteShares.js'
import { NotesSidebar } from './components/NotesSidebar.jsx'
import { NotesList } from './components/NotesList.jsx'
import { NoteEditor } from './components/NoteEditor.jsx'
import { NoteSettingsPanel } from './components/NoteSettingsPanel.jsx'
import { NoteShareModal } from './components/NoteShareModal.jsx'

export default function NotesScreen() {
  const [activeView, setActiveView]     = useState('all')
  const [selectedNote, setSelectedNote] = useState(null)
  const [rightPanel, setRightPanel]     = useState('editor')
  const [shareOpen, setShareOpen]       = useState(false)
  const [restoreOpen, setRestoreOpen]   = useState(false)
  const [deleteOpen, setDeleteOpen]     = useState(false)
  const [noteToAction, setNoteToAction] = useState(null)
  const [sidebarOpen, setSidebarOpen]   = useState(false)
  // mobile: 'list' | 'editor'
  const [mobileView, setMobileView]     = useState('list')

  const { data, isLoading } = useNotes(buildQueryParams(activeView))
  const notes       = data?.notes ?? []
  const isTrashView = activeView === 'trash'

  const createNote      = useCreateNote()
  const updateNote      = useUpdateNote()
  const trashNote       = useTrashNote()
  const restoreNote     = useRestoreNote()
  const permanentDelete = usePermanentDeleteNote()
  const publishNote     = usePublishNote()
  const unpublishNote   = useUnpublishNote()

  function handleCreateNote() {
    createNote.mutate(
      { title: 'Nueva nota', content: '' },
      {
        onSuccess: (res) => {
          if (res?.note) {
            setSelectedNote(res.note)
            setRightPanel('editor')
            setMobileView('editor')
          }
        },
      },
    )
  }

  const handleUpdateNote = useCallback((patch) => {
    if (!selectedNote) return
    updateNote.mutate(
      { noteId: selectedNote.id, data: patch },
      { onSuccess: (res) => { if (res?.note) setSelectedNote(res.note) } },
    )
  }, [selectedNote, updateNote])

  function handleTrash(note) {
    const target = note ?? selectedNote
    if (!target) return
    trashNote.mutate(target.id, {
      onSuccess: () => {
        if (selectedNote?.id === target.id) {
          setSelectedNote(null)
          setMobileView('list')
        }
      },
    })
  }

  function selectNote(note) {
    setSelectedNote(note)
    setRightPanel('editor')
    setMobileView('editor')
  }

  function changeView(v) {
    setActiveView(v)
    setSelectedNote(null)
    setMobileView('list')
    setSidebarOpen(false)
  }

  return (
    <div className="flex h-full min-h-0 relative overflow-hidden">

      {/* ── Mobile backdrop ─────────────────────────────────── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-10 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Panel 1: Folders/views sidebar ──────────────────── */}
      <aside
        className={[
          'w-52 shrink-0 border-r border-border flex flex-col bg-background',
          'transition-transform duration-200 ease-in-out',
          'fixed top-14 left-0 bottom-0 z-20',
          'lg:static lg:z-auto lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        ].join(' ')}
      >
        <div className="flex items-center justify-between px-3 pt-4 pb-2 shrink-0">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Notas
          </span>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <X size={14} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <NotesSidebar activeView={activeView} onViewChange={changeView} />
        </div>
      </aside>

      {/* ── Main area (list + editor) ────────────────────────── */}
      <div className="flex flex-1 min-w-0 overflow-hidden">

        {/* Panel 2: Note list */}
        <div className={[
          'shrink-0 border-r border-border flex flex-col bg-background',
          'w-full lg:w-72',
          mobileView === 'list' ? 'flex' : 'hidden lg:flex',
        ].join(' ')}>

          {/* List header */}
          <div className="flex items-center gap-2 px-3 h-11 border-b border-border shrink-0">
            <button
              className="lg:hidden p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setSidebarOpen(true)}
              title="Menu"
            >
              <Menu size={15} />
            </button>
            <span className="flex-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {VIEW_LABELS[activeView] ?? 'Notas'}
            </span>
            {!isTrashView && (
              <button
                onClick={handleCreateNote}
                disabled={createNote.isPending}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors disabled:opacity-50 shadow-sm"
              >
                <Plus size={13} />
                <span className="hidden sm:inline">Nueva</span>
              </button>
            )}
          </div>

          <NotesList
            notes={notes}
            selectedNoteId={selectedNote?.id}
            onSelect={selectNote}
            onTrash={!isTrashView ? handleTrash : undefined}
            isLoading={isLoading}
            showTrash={isTrashView}
          />

          {isTrashView && selectedNote && (
            <div className="px-3 py-2 border-t border-border flex gap-2 shrink-0">
              <button
                onClick={() => { setNoteToAction(selectedNote); setRestoreOpen(true) }}
                className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-2 border border-border rounded-lg hover:bg-muted text-foreground transition-colors"
              >
                <RotateCcw size={13} />
                Restaurar
              </button>
              <button
                onClick={() => { setNoteToAction(selectedNote); setDeleteOpen(true) }}
                className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-2 border border-red-200 text-red-500 rounded-lg hover:bg-red-50 transition-colors"
              >
                <Trash2 size={13} />
                Eliminar
              </button>
            </div>
          )}
        </div>

        {/* Panel 3: Editor / Settings */}
        <div
          className={[
            'flex-1 min-w-0 flex flex-col overflow-hidden bg-background',
            mobileView === 'editor' ? 'flex' : 'hidden lg:flex',
          ].join(' ')}
          style={selectedNote?.background_color ? { backgroundColor: selectedNote.background_color } : {}}
        >
          {/* Editor header */}
          <div className="flex items-center gap-2 px-3 h-11 border-b border-border shrink-0 bg-background/95 backdrop-blur-sm">
            {/* Mobile: back to list */}
            <button
              className="lg:hidden p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setMobileView('list')}
            >
              <ArrowLeft size={15} />
            </button>

            {/* Desktop: open sidebar hamburger (only when sidebar would be hidden — show always on lg for consistency but it's static) */}
            <button
              className="hidden lg:flex p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setSidebarOpen(true)}
              title="Abrir navegacion"
              style={{ display: 'none' }}
            >
              <Menu size={15} />
            </button>

            <span className="flex-1 text-xs text-muted-foreground truncate">
              {selectedNote ? (selectedNote.title || 'Sin titulo') : ''}
            </span>

            {selectedNote && (
              <div className="flex items-center gap-0.5">
                <button
                  onClick={() => setShareOpen(true)}
                  className="flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground rounded-lg transition-colors"
                >
                  <Share2 size={13} />
                  <span className="hidden sm:inline">Compartir</span>
                </button>
                <button
                  onClick={() => setRightPanel(p => p === 'editor' ? 'settings' : 'editor')}
                  className={`flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    rightPanel === 'settings'
                      ? 'bg-amber-100 text-amber-700'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <Settings2 size={13} />
                  <span className="hidden sm:inline">{rightPanel === 'settings' ? 'Editor' : 'Ajustes'}</span>
                </button>
              </div>
            )}
          </div>

          {/* Editor body */}
          {!selectedNote ? (
            <EmptyEditor onCreateNote={!isTrashView ? handleCreateNote : undefined} isTrash={isTrashView} />
          ) : rightPanel === 'settings' ? (
            <NoteSettingsPanel
              note={selectedNote}
              onUpdate={handleUpdateNote}
              onPublish={() => publishNote.mutate(selectedNote.id, { onSuccess: r => r?.note && setSelectedNote(r.note) })}
              onUnpublish={() => unpublishNote.mutate(selectedNote.id, { onSuccess: r => r?.note && setSelectedNote(r.note) })}
              onTrash={() => handleTrash(selectedNote)}
            />
          ) : (
            <NoteEditor note={selectedNote} readOnly={isTrashView} />
          )}
        </div>
      </div>

      {selectedNote && (
        <NoteShareModal noteId={selectedNote.id} open={shareOpen} onOpenChange={setShareOpen} />
      )}

      <ConfirmDialog
        open={restoreOpen}
        onOpenChange={setRestoreOpen}
        title="Restaurar nota"
        description="La nota se movera de vuelta a tu lista de notas activas."
        confirmLabel="Restaurar"
        onConfirm={() => {
          setRestoreOpen(false)
          if (noteToAction) restoreNote.mutate(noteToAction.id, { onSuccess: () => setSelectedNote(null) })
        }}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Eliminar nota permanentemente"
        description="Esta accion no se puede deshacer. La nota se eliminara para siempre."
        confirmLabel="Eliminar permanentemente"
        onConfirm={() => {
          setDeleteOpen(false)
          if (noteToAction) permanentDelete.mutate(noteToAction.id, { onSuccess: () => setSelectedNote(null) })
        }}
      />
    </div>
  )
}

function EmptyEditor({ onCreateNote, isTrash }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8 select-none">
      <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center">
        <PenLine size={22} className="text-amber-400" />
      </div>
      <div>
        <p className="text-sm font-medium text-foreground mb-1">
          {isTrash ? 'Papelera' : 'Selecciona una nota'}
        </p>
        <p className="text-xs text-muted-foreground leading-relaxed max-w-48">
          {isTrash
            ? 'Selecciona una nota para restaurarla o eliminarla definitivamente'
            : 'Elige una nota de la lista o crea una nueva'}
        </p>
      </div>
      {onCreateNote && (
        <button
          onClick={onCreateNote}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors shadow-sm"
        >
          <Plus size={13} />
          Nueva nota
        </button>
      )}
    </div>
  )
}

const VIEW_LABELS = {
  all:    'Todas las notas',
  recent: 'Recientes',
  shared: 'Compartidas',
  trash:  'Papelera',
}

function buildQueryParams(view) {
  if (view === 'trash')           return { trashed: true }
  if (view === 'recent')          return { pageSize: 20 }
  if (view === 'shared')          return { shared: true }
  if (view.startsWith('folder:')) return { folderId: view.replace('folder:', '') }
  return {}
}
