import { useState, useCallback } from 'react'
import { PageHeader, ConfirmDialog } from '@atlas/ui'
import { useNotes, useCreateNote } from './hooks/useNotes.js'
import { useUpdateNote, useTrashNote, useRestoreNote, usePermanentDeleteNote } from './hooks/useNote.js'
import { usePublishNote, useUnpublishNote } from './hooks/useNoteShares.js'
import { NotesSidebar } from './components/NotesSidebar.jsx'
import { NotesList } from './components/NotesList.jsx'
import { NoteEditor } from './components/NoteEditor.jsx'
import { NoteSettingsPanel } from './components/NoteSettingsPanel.jsx'
import { NoteShareModal } from './components/NoteShareModal.jsx'

export default function NotesScreen() {
  const [activeView, setActiveView] = useState('all')
  const [selectedNote, setSelectedNote] = useState(null)
  const [rightPanel, setRightPanel] = useState('editor') // 'editor' | 'settings'
  const [shareOpen, setShareOpen] = useState(false)
  const [restoreConfirmOpen, setRestoreConfirmOpen] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [noteToAction, setNoteToAction] = useState(null)

  const queryParams = buildQueryParams(activeView)
  const { data, isLoading } = useNotes(queryParams)
  const notes = data?.notes ?? []

  const createNote = useCreateNote()
  const updateNote = useUpdateNote()
  const trashNote = useTrashNote()
  const restoreNote = useRestoreNote()
  const permanentDelete = usePermanentDeleteNote()
  const publishNote = usePublishNote()
  const unpublishNote = useUnpublishNote()

  const isTrashView = activeView === 'trash'

  function handleCreateNote() {
    createNote.mutate(
      { title: 'Nueva nota', content: '', icon: '📝' },
      { onSuccess: (res) => { if (res?.note) setSelectedNote(res.note) } },
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
      onSuccess: () => { if (selectedNote?.id === target.id) setSelectedNote(null) },
    })
  }

  function handleRestore(note) {
    setNoteToAction(note)
    setRestoreConfirmOpen(true)
  }

  function handlePermanentDelete(note) {
    setNoteToAction(note)
    setDeleteConfirmOpen(true)
  }

  function handlePublish() {
    if (!selectedNote) return
    publishNote.mutate(selectedNote.id, {
      onSuccess: (res) => { if (res?.note) setSelectedNote(res.note) },
    })
  }

  function handleUnpublish() {
    if (!selectedNote) return
    unpublishNote.mutate(selectedNote.id, {
      onSuccess: (res) => { if (res?.note) setSelectedNote(res.note) },
    })
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Notas"
        actions={
          <div className="flex items-center gap-2">
            {selectedNote && (
              <>
                <button
                  onClick={() => setRightPanel(p => p === 'editor' ? 'settings' : 'editor')}
                  className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                    rightPanel === 'settings'
                      ? 'bg-amber-100 border-amber-300 text-amber-800'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {rightPanel === 'settings' ? 'Mostrar editor' : 'Ajustes'}
                </button>
                <button
                  onClick={() => setShareOpen(true)}
                  className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
                >
                  Compartir
                </button>
              </>
            )}
            {!isTrashView && (
              <button
                onClick={handleCreateNote}
                disabled={createNote.isPending}
                className="px-3 py-1.5 text-sm rounded-lg bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50"
              >
                + Nueva nota
              </button>
            )}
          </div>
        }
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Left: Sidebar */}
        <div className="w-48 shrink-0 overflow-y-auto">
          <NotesSidebar
            activeView={activeView}
            onViewChange={(v) => {
              setActiveView(v)
              setSelectedNote(null)
            }}
          />
        </div>

        {/* Middle: Notes list */}
        <div className="w-72 shrink-0 border-x border-gray-200 overflow-hidden flex flex-col">
          <NotesList
            notes={notes}
            selectedNoteId={selectedNote?.id}
            onSelect={(note) => {
              setSelectedNote(note)
              setRightPanel('editor')
            }}
            onTrash={!isTrashView ? handleTrash : undefined}
            isLoading={isLoading}
            showTrash={isTrashView}
          />
          {isTrashView && notes.length > 0 && selectedNote && (
            <div className="px-3 py-2 border-t border-gray-200 flex gap-2">
              <button
                onClick={() => handleRestore(selectedNote)}
                className="flex-1 text-xs py-1.5 border border-gray-200 rounded hover:bg-gray-50"
              >
                Restaurar
              </button>
              <button
                onClick={() => handlePermanentDelete(selectedNote)}
                className="flex-1 text-xs py-1.5 border border-red-200 text-red-500 rounded hover:bg-red-50"
              >
                Eliminar
              </button>
            </div>
          )}
        </div>

        {/* Right: Editor or Settings */}
        <div
          className="flex-1 overflow-hidden"
          style={selectedNote?.background_color ? { backgroundColor: selectedNote.background_color } : {}}
        >
          {!selectedNote ? (
            <div className="flex items-center justify-center h-full text-sm text-gray-400">
              Selecciona o crea una nota
            </div>
          ) : rightPanel === 'settings' ? (
            <NoteSettingsPanel
              note={selectedNote}
              onUpdate={handleUpdateNote}
              onPublish={handlePublish}
              onUnpublish={handleUnpublish}
              onTrash={() => handleTrash(selectedNote)}
            />
          ) : (
            <NoteEditor note={selectedNote} readOnly={isTrashView} />
          )}
        </div>
      </div>

      {/* Share modal */}
      {selectedNote && (
        <NoteShareModal
          noteId={selectedNote.id}
          open={shareOpen}
          onOpenChange={setShareOpen}
        />
      )}

      {/* Restore confirm */}
      <ConfirmDialog
        open={restoreConfirmOpen}
        onOpenChange={setRestoreConfirmOpen}
        title="Restaurar nota"
        description="La nota se movera de vuelta a tu lista de notas."
        confirmLabel="Restaurar"
        onConfirm={() => {
          setRestoreConfirmOpen(false)
          if (noteToAction) {
            restoreNote.mutate(noteToAction.id, {
              onSuccess: () => setSelectedNote(null),
            })
          }
        }}
      />

      {/* Permanent delete confirm */}
      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Eliminar nota permanentemente"
        description="Esta accion no se puede deshacer. La nota se eliminara para siempre."
        confirmLabel="Eliminar permanentemente"
        onConfirm={() => {
          setDeleteConfirmOpen(false)
          if (noteToAction) {
            permanentDelete.mutate(noteToAction.id, {
              onSuccess: () => setSelectedNote(null),
            })
          }
        }}
      />
    </div>
  )
}

function buildQueryParams(view) {
  if (view === 'trash') return { is_trashed: true }
  if (view === 'recent') return { sort: 'updated_at', limit: 20 }
  if (view === 'shared') return { shared_with_me: true }
  if (view.startsWith('folder:')) return { folder_id: view.replace('folder:', '') }
  return {}
}
