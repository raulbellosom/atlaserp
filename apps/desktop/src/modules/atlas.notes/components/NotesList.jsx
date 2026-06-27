import { useState } from 'react'
import { Search, X } from 'lucide-react'
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
    <div className="flex flex-col h-full bg-white">
      <div className="px-3 py-2.5 border-b border-gray-100">
        <div className="relative flex items-center">
          <Search className="absolute left-2.5 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar notas..."
            className="w-full pl-8 pr-7 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-300 focus:border-amber-300 transition-colors placeholder:text-gray-400"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2">
            <div className="w-5 h-5 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
            <span className="text-xs text-gray-400">Cargando notas...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-8">
            <EmptyState
              title={search ? 'Sin resultados' : showTrash ? 'Papelera vacia' : 'Sin notas'}
              description={
                search
                  ? 'Intenta con otro termino de busqueda'
                  : showTrash
                  ? 'Las notas eliminadas apareceran aqui'
                  : 'Crea tu primera nota con el boton superior'
              }
            />
          </div>
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
