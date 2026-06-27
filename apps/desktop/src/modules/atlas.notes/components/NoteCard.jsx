import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

export function NoteCard({ note, isSelected, onClick, onTrash }) {
  const excerpt = note.content
    ? note.content.replace(/<[^>]*>/g, '').slice(0, 120)
    : 'Sin contenido'

  const lastMod = note.updated_at
    ? formatDistanceToNow(new Date(note.updated_at), { addSuffix: true, locale: es })
    : ''

  return (
    <div
      onClick={onClick}
      className={`group relative px-4 py-3 cursor-pointer border-b border-gray-100 hover:bg-amber-50 transition-colors ${
        isSelected ? 'bg-amber-50 border-l-2 border-l-amber-400' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            {note.icon && <span className="text-base leading-none">{note.icon}</span>}
            <h3 className="text-sm font-semibold text-gray-900 truncate">
              {note.title || 'Sin titulo'}
            </h3>
          </div>
          <p className="text-xs text-gray-500 line-clamp-2 leading-snug">{excerpt}</p>
          <div className="flex items-center gap-2 mt-1.5">
            {note.tags?.slice(0, 3).map(tag => (
              <span key={tag.id} className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                {tag.name}
              </span>
            ))}
            <span className="text-xs text-gray-400 ml-auto">{lastMod}</span>
          </div>
        </div>
        {onTrash && (
          <button
            onClick={e => { e.stopPropagation(); onTrash(note) }}
            className="opacity-0 group-hover:opacity-100 shrink-0 p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-all"
            title="Enviar a papelera"
          >
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}
