import { toast } from 'sonner'
import { atlas } from '../../../lib/atlas'
import { supabase } from '../../../lib/supabase'
import { DEFAULT_IMAGE_WIDTH_PCT } from './imageSize.js'

const MAX_IMAGE_BYTES = 20 * 1024 * 1024

// Shared upload+insert flow for in-body note images — used by both the
// toolbar's "Insertar imagen" button and the slash command menu's "Imagen"
// item, so there is a single place that talks to /notes/presign-image and
// the atlas-notes bucket.
export async function uploadAndInsertNoteImage(file, { editor, noteId, token }) {
  if (!file || !token) return
  if (!file.type.startsWith('image/')) {
    toast.error('Selecciona un archivo de imagen valido.')
    return
  }
  if (file.size > MAX_IMAGE_BYTES) {
    toast.error('La imagen no puede superar 20 MB.')
    return
  }
  try {
    const presign = await atlas.notes.presignImage(
      { fileName: file.name, mimeType: file.type, noteId },
      token,
    )
    const { error } = await supabase.storage
      .from('atlas-notes')
      .uploadToSignedUrl(presign.objectKey, presign.uploadToken, file)
    if (error) throw error
    editor.chain().focus().insertContent({
      type: 'image',
      // Inserted at a sane starting scale, not the full column width — the
      // resize handle (ImageAnnotationOverlay) lets the user grow it from here.
      attrs: { src: presign.publicUrl, alt: file.name, width: DEFAULT_IMAGE_WIDTH_PCT },
    }).run()
  } catch (err) {
    toast.error(err?.message ?? 'No se pudo subir la imagen.')
  }
}

// Opens a native file picker and runs uploadAndInsertNoteImage on the chosen
// file. Used where there's no persistent <input type="file"> element to
// reuse (e.g. the slash command menu).
export function pickAndUploadNoteImage({ editor, noteId, token }) {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.style.display = 'none'
  input.onchange = () => {
    const file = input.files?.[0]
    if (file) uploadAndInsertNoteImage(file, { editor, noteId, token })
    input.remove()
  }
  document.body.appendChild(input)
  input.click()
}
