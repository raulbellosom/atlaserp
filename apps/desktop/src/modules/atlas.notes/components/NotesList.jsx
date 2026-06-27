import { useState } from 'react'
import { NoteCard } from './NoteCard.jsx'
import { EmptyState } from '@atlas/ui'

export function NotesList({ notes = [], selectedNoteId, onSelect, onTrash, isLoading, showTrash = false }) {
  const [search, setSearch] = useState('')

  const filtered = search.trim()
    ? notes.filter(n =>
        n.title?.toLowerCase().includes(search.toLowerCase()) ||
        n.content?.replace(/<[^>]*>/g, '').toLowerCase().includes(search.toLowerCase())
      )
    : notes

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-gray-200">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar notas..."
          className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-400 bg-gray-50"
        />
      </div>
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-32 text-sm text-gray-400">Cargando...</div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title={search ? 'Sin resultados' : showTrash ? 'Papelera vacia' : 'Sin notas'}
            description={search ? 'Intenta con otro termino de busqueda' : showTrash ? 'Las notas eliminadas apareceran aqui' : 'Crea tu primera nota'}
          />
        ) : (
          filtered.map(note => (
            <NoteCard
              key={note.id}
              note={note}
              isSelected={note.id === selectedNoteId}
              onClick={() => onSelect(note)}
              onTrash={!showTrash ? onTrash : undefined}
            />
          ))
        )}
      </div>
    </div>
  )
}
