import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { Trash2 } from 'lucide-react'

export function NoteCard({ note, isSelected, onClick, onTrash }) {
  const excerpt = note.content
    ? note.content.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, 100)
    : ''

  const lastMod = note.updated_at
    ? formatDistanceToNow(new Date(note.updated_at), { addSuffix: true, locale: es })
    : ''

  return (
    <div
      onClick={onClick}
      className={`group relative px-4 py-3.5 cursor-pointer border-b border-gray-100/80 transition-all duration-100 ${
        isSelected
          ? 'bg-amber-50 border-l-[3px] border-l-amber-400 pl-3.25'
          : 'hover:bg-gray-50 border-l-[3px] border-l-transparent'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className={`text-sm truncate mb-0.5 ${isSelected ? 'font-semibold text-amber-900' : 'font-medium text-gray-900'}`}>
            {note.title || 'Sin titulo'}
          </h3>
          {excerpt && (
            <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{excerpt}</p>
          )}
          <div className="flex items-center gap-1.5 mt-2">
            {note.tags?.slice(0, 2).map(tag => (
              <span key={tag.id} className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-500">
                {tag.name}
              </span>
            ))}
            {note.tags?.length > 2 && (
              <span className="text-[10px] text-gray-400">+{note.tags.length - 2}</span>
            )}
            <span className="text-[10px] text-gray-400 ml-auto">{lastMod}</span>
          </div>
        </div>

        {onTrash && (
          <button
            onClick={e => { e.stopPropagation(); onTrash(note) }}
            className="opacity-0 group-hover:opacity-100 shrink-0 mt-0.5 p-1 text-gray-300 hover:text-red-400 hover:bg-red-50 rounded-md transition-all"
            title="Enviar a papelera"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}
