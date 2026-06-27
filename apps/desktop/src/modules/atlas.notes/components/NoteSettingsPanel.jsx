import { useState } from 'react'
import { useNoteFolders } from '../hooks/useNoteFolders.js'
import { useNoteTags, useCreateNoteTag, useSetNoteTags } from '../hooks/useNoteTags.js'
import { ConfirmDialog } from '@atlas/ui'

const BACKGROUND_COLORS = [
  { label: 'Blanco', value: '#ffffff' },
  { label: 'Crema', value: '#fefce8' },
  { label: 'Menta', value: '#f0fdf4' },
  { label: 'Cielo', value: '#eff6ff' },
  { label: 'Lavanda', value: '#faf5ff' },
  { label: 'Rosa', value: '#fff1f2' },
]

export function NoteSettingsPanel({ note, onUpdate, onPublish, onUnpublish, onTrash }) {
  const { data: foldersData } = useNoteFolders()
  const { data: tagsData } = useNoteTags()
  const createTag = useCreateNoteTag()
  const setNoteTags = useSetNoteTags()
  const [trashOpen, setTrashOpen] = useState(false)
  const [newTagName, setNewTagName] = useState('')

  const folders = foldersData?.folders ?? []
  const allTags = tagsData?.tags ?? []
  const noteTags = note?.tags ?? []
  const noteTagIds = noteTags.map(t => t.id)

  const publicUrl = note?.public_slug
    ? `${window.location.origin}/p/notes/${note.public_slug}`
    : null

  function handleFolderChange(folderId) {
    onUpdate({ folder_id: folderId || null })
  }

  function handleBgChange(color) {
    onUpdate({ background_color: color })
  }

  function handleTagToggle(tagId) {
    const updated = noteTagIds.includes(tagId)
      ? noteTagIds.filter(id => id !== tagId)
      : [...noteTagIds, tagId]
    setNoteTags.mutate({ noteId: note.id, tagIds: updated })
  }

  function handleCreateTag(e) {
    e.preventDefault()
    if (!newTagName.trim()) return
    createTag.mutate({ name: newTagName.trim() }, {
      onSuccess: (res) => {
        const newId = res?.tag?.id
        if (newId) setNoteTags.mutate({ noteId: note.id, tagIds: [...noteTagIds, newId] })
        setNewTagName('')
      },
    })
  }

  if (!note) return null

  return (
    <div className="flex flex-col gap-4 p-4 text-sm overflow-y-auto h-full bg-white border-l border-gray-200">
      <h3 className="font-semibold text-gray-900 text-base">Ajustes de nota</h3>

      {/* Icon */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Icono</label>
        <input
          type="text"
          value={note.icon ?? ''}
          onChange={e => onUpdate({ icon: e.target.value })}
          placeholder="📝"
          maxLength={4}
          className="w-16 text-center text-2xl border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-amber-400"
        />
      </div>

      {/* Title */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Titulo</label>
        <input
          type="text"
          value={note.title ?? ''}
          onChange={e => onUpdate({ title: e.target.value })}
          className="w-full border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-400 text-sm"
        />
      </div>

      {/* Folder */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Carpeta</label>
        <select
          value={note.folder_id ?? ''}
          onChange={e => handleFolderChange(e.target.value)}
          className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-amber-400 bg-white"
        >
          <option value="">Sin carpeta</option>
          {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
      </div>

      {/* Background color */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Fondo</label>
        <div className="flex gap-2 flex-wrap">
          {BACKGROUND_COLORS.map(bg => (
            <button
              key={bg.value}
              onClick={() => handleBgChange(bg.value)}
              title={bg.label}
              className={`w-7 h-7 rounded-full border-2 transition-transform ${
                note.background_color === bg.value || (!note.background_color && bg.value === '#ffffff')
                  ? 'border-amber-500 scale-110'
                  : 'border-gray-200 hover:border-gray-400'
              }`}
              style={{ backgroundColor: bg.value }}
            />
          ))}
        </div>
      </div>

      {/* Tags */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Etiquetas</label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {allTags.map(tag => (
            <button
              key={tag.id}
              onClick={() => handleTagToggle(tag.id)}
              className={`px-2 py-0.5 rounded-full text-xs font-medium border transition-colors ${
                noteTagIds.includes(tag.id)
                  ? 'bg-amber-100 border-amber-300 text-amber-800'
                  : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              {tag.name}
            </button>
          ))}
        </div>
        <form onSubmit={handleCreateTag} className="flex gap-1">
          <input
            type="text"
            value={newTagName}
            onChange={e => setNewTagName(e.target.value)}
            placeholder="Nueva etiqueta..."
            className="flex-1 text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-amber-400"
          />
          <button type="submit" disabled={!newTagName.trim()} className="text-xs px-2 py-1 bg-amber-500 text-white rounded hover:bg-amber-600 disabled:opacity-40">+</button>
        </form>
      </div>

      {/* Public link */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Enlace publico</label>
        {publicUrl ? (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1">
              <input readOnly value={publicUrl} className="flex-1 text-xs border border-gray-200 rounded px-2 py-1 bg-gray-50 truncate" />
              <button onClick={() => navigator.clipboard.writeText(publicUrl)} className="text-xs px-2 py-1 border border-gray-200 rounded hover:bg-gray-50" title="Copiar">📋</button>
            </div>
            <button onClick={onUnpublish} className="text-xs text-red-500 hover:underline">Desactivar enlace publico</button>
          </div>
        ) : (
          <button
            onClick={onPublish}
            className="text-xs px-3 py-1.5 bg-amber-500 text-white rounded hover:bg-amber-600"
          >
            Generar enlace publico
          </button>
        )}
      </div>

      {/* Danger zone */}
      <div className="mt-auto pt-4 border-t border-gray-100">
        <button
          onClick={() => setTrashOpen(true)}
          className="w-full text-xs text-red-500 hover:bg-red-50 py-2 rounded border border-red-100 transition-colors"
        >
          Enviar a papelera
        </button>
      </div>

      <ConfirmDialog
        open={trashOpen}
        onOpenChange={setTrashOpen}
        title="Enviar nota a papelera"
        description="La nota se movera a la papelera. Puedes restaurarla desde alli."
        confirmLabel="Mover a papelera"
        onConfirm={() => { setTrashOpen(false); onTrash?.() }}
      />
    </div>
  )
}
