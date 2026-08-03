import { useState } from 'react'
import { ImagePlus, Image as ImageIcon, Trash2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { atlas } from '../../../lib/atlas'
import { supabase } from '../../../lib/supabase'
import { withImageVariant } from '../../../lib/imageVariants.js'

const MAX_BANNER_BYTES = 20 * 1024 * 1024

// Cover/banner image for a note — reuses the same presign-image + atlas-notes
// bucket flow as in-body images (NoteToolbar.jsx), but persists the result on
// note.cover_url instead of inserting a TipTap node.
export function NoteCoverBanner({ coverUrl, editable, noteId, token, onChange, onRemove }) {
  const [uploading, setUploading] = useState(false)

  if (!coverUrl && !editable) return null

  async function handleFile(file) {
    if (!file || !token) return
    if (!file.type.startsWith('image/')) {
      toast.error('Selecciona un archivo de imagen valido.')
      return
    }
    if (file.size > MAX_BANNER_BYTES) {
      toast.error('La imagen no puede superar 20 MB.')
      return
    }
    setUploading(true)
    try {
      const presign = await atlas.notes.presignImage(
        { fileName: file.name, mimeType: file.type, noteId },
        token,
      )
      const { error } = await supabase.storage
        .from('atlas-notes')
        .uploadToSignedUrl(presign.objectKey, presign.uploadToken, file)
      if (error) throw error
      // Only persist after the upload is confirmed — never optimistically.
      onChange(presign.publicUrl)
    } catch (err) {
      toast.error(err?.message ?? 'No se pudo subir la portada.')
    } finally {
      setUploading(false)
    }
  }

  if (!coverUrl) {
    return (
      <div className="px-8 pt-4">
        <label
          className={[
            'inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground rounded-lg px-2.5 py-1.5 cursor-pointer transition-colors',
            uploading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-muted hover:text-foreground',
          ].join(' ')}
        >
          {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImagePlus className="w-3.5 h-3.5" />}
          Agregar portada
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={uploading}
            onChange={e => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (file) handleFile(file)
            }}
          />
        </label>
      </div>
    )
  }

  return (
    <div className="relative group/cover w-full aspect-[3/1] overflow-hidden bg-muted">
      <img src={withImageVariant(coverUrl, 'banner')} alt="" className="w-full h-full object-cover" draggable={false} />
      {editable && (
        <div className="absolute bottom-2 right-2 flex items-center gap-1.5 opacity-100 sm:opacity-0 sm:group-hover/cover:opacity-100 transition-opacity">
          <label
            className={[
              'flex items-center gap-1.5 text-xs font-medium bg-background/90 backdrop-blur-sm border border-border rounded-lg px-2.5 py-1.5 cursor-pointer shadow-sm transition-colors',
              uploading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-muted',
            ].join(' ')}
          >
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImageIcon className="w-3.5 h-3.5" />}
            Cambiar portada
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={uploading}
              onChange={e => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (file) handleFile(file)
              }}
            />
          </label>
          <button
            onClick={onRemove}
            className="flex items-center gap-1.5 text-xs font-medium bg-background/90 backdrop-blur-sm border border-border rounded-lg px-2.5 py-1.5 shadow-sm hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Quitar
          </button>
        </div>
      )}
    </div>
  )
}
