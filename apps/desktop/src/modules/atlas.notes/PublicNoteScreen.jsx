import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { atlas } from '../../lib/atlas'
import { NoteEditor } from './components/NoteEditor.jsx'
import { NoteIcon } from './noteIcons.jsx'
import { ErrorState } from '@atlas/ui'

export default function PublicNoteScreen() {
  const { slug } = useParams()

  const { data, isLoading, error } = useQuery({
    queryKey: ['public-note', slug],
    queryFn: () => atlas.notes.getPublic(slug),
    enabled: !!slug,
    retry: false,
  })

  const note = data?.note

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-sm text-gray-400">Cargando nota...</div>
      </div>
    )
  }

  if (error || !note) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full p-8">
          <ErrorState
            title="Nota no encontrada"
            description="Esta nota no existe o el enlace publico fue desactivado."
          />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: note.background_color ?? '#ffffff' }}>
      <div className="max-w-3xl mx-auto py-12 px-4">
        <div className="flex items-center gap-3 mb-6">
          {note.icon && <NoteIcon name={note.icon} size={28} className="text-amber-500 shrink-0" />}
          <h1 className="text-2xl font-bold text-gray-900">{note.title || 'Nota'}</h1>
        </div>
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <NoteEditor note={note} readOnly />
        </div>
      </div>
    </div>
  )
}
