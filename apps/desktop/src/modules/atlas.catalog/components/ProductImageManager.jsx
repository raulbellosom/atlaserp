// apps/desktop/src/modules/atlas.catalog/components/ProductImageManager.jsx
import { useEffect, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { cn } from '@atlas/ui'
import { ImagePlus, Star, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { atlas } from '../../../lib/atlas.js'

/**
 * Props:
 *   token       string
 *   coverId     string | null    — current cover_asset_id UUID
 *   imageIds    string[]         — current gallery asset UUIDs
 *   onChange    ({ coverId, imageIds }) => void
 */
export default function ProductImageManager({ token, coverId, imageIds = [], onChange }) {
  const coverInputRef   = useRef(null)
  const galleryInputRef = useRef(null)
  const [signedUrls, setSignedUrls] = useState({})

  const allIds = [...new Set([coverId, ...imageIds].filter(Boolean))]

  useEffect(() => {
    if (!allIds.length || !token) return
    atlas.files.batchSignedUrls(allIds, token)
      .then(res => {
        const map = {}
        const items = res?.data ?? res?.urls ?? []
        if (Array.isArray(items)) {
          items.forEach(item => { if (item?.fileId && item?.url) map[item.fileId] = item.url })
        } else if (typeof items === 'object' && items !== null) {
          Object.assign(map, items)
        }
        setSignedUrls(map)
      })
      .catch(() => null)
  }, [allIds.join(','), token])

  const uploadMutation = useMutation({
    mutationFn: async (file) => {
      const form = new FormData()
      form.append('file', file)
      const res = await atlas.files.upload(form, token)
      return res?.data ?? res
    },
  })

  async function handleCoverUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const asset = await uploadMutation.mutateAsync(file)
      onChange({ coverId: asset.id, imageIds })
      toast.success('Imagen de portada actualizada')
    } catch (err) {
      toast.error(err?.message ?? 'Error al subir imagen')
    } finally { e.target.value = '' }
  }

  async function handleGalleryUpload(e) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    const uploaded = []
    for (const file of files) {
      try {
        const asset = await uploadMutation.mutateAsync(file)
        uploaded.push(asset.id)
      } catch (err) {
        toast.error(`Error subiendo ${file.name}: ${err?.message}`)
      }
    }
    if (uploaded.length) {
      onChange({ coverId, imageIds: [...imageIds, ...uploaded] })
      toast.success(`${uploaded.length} imagen(es) agregada(s)`)
    }
    e.target.value = ''
  }

  function removeCover() { onChange({ coverId: null, imageIds }) }
  function removeFromGallery(id) { onChange({ coverId, imageIds: imageIds.filter(i => i !== id) }) }
  function promoteTocover(id) { onChange({ coverId: id, imageIds: imageIds.filter(i => i !== id) }) }

  return (
    <div className="space-y-6">
      {/* Cover */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-3">Imagen de portada</p>
        <div className="flex items-start gap-4">
          <button
            type="button"
            onClick={() => coverInputRef.current?.click()}
            className={cn(
              'relative h-32 w-32 rounded-2xl border-2 border-dashed border-[hsl(var(--border))] overflow-hidden',
              'bg-[hsl(var(--muted))]/40 transition-colors hover:bg-[hsl(var(--muted))]/60 hover:border-[hsl(var(--foreground))]/30',
              'flex flex-col items-center justify-center gap-1',
            )}
          >
            {coverId && signedUrls[coverId] ? (
              <>
                <img src={signedUrls[coverId]} alt="Portada" className="absolute inset-0 h-full w-full object-cover" />
                <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                  <p className="text-white text-xs font-medium">Cambiar</p>
                </div>
              </>
            ) : (
              <>
                <ImagePlus className="h-6 w-6 text-[hsl(var(--muted-foreground))]" />
                <p className="text-xs text-[hsl(var(--muted-foreground))]">Subir portada</p>
              </>
            )}
          </button>
          {coverId && (
            <button
              type="button"
              onClick={removeCover}
              className="mt-1 flex items-center gap-1 text-xs text-red-500 hover:text-red-700"
            >
              <Trash2 className="h-3 w-3" /> Quitar portada
            </button>
          )}
        </div>
        <input ref={coverInputRef} type="file" accept="image/*" className="sr-only" onChange={handleCoverUpload} />
      </div>

      {/* Gallery */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-3">Galeria adicional</p>
        <div className="flex flex-wrap gap-3">
          {imageIds.map(id => (
            <div key={id} className="group relative h-24 w-24 rounded-xl border border-[hsl(var(--border))] overflow-hidden bg-[hsl(var(--muted))]">
              {signedUrls[id] && <img src={signedUrls[id]} alt="" className="h-full w-full object-cover" />}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => promoteTocover(id)}
                  className="flex items-center gap-1 text-xs text-white hover:text-yellow-300"
                >
                  <Star className="h-3 w-3" /> Portada
                </button>
                <button
                  type="button"
                  onClick={() => removeFromGallery(id)}
                  className="flex items-center gap-1 text-xs text-white hover:text-red-300"
                >
                  <Trash2 className="h-3 w-3" /> Quitar
                </button>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() => galleryInputRef.current?.click()}
            className="h-24 w-24 rounded-xl border-2 border-dashed border-[hsl(var(--border))] flex flex-col items-center justify-center gap-1 text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--foreground))]/30 hover:bg-[hsl(var(--muted))]/40 transition-colors"
          >
            <ImagePlus className="h-5 w-5" />
            <span className="text-xs">Agregar</span>
          </button>
        </div>
        <input ref={galleryInputRef} type="file" accept="image/*" multiple className="sr-only" onChange={handleGalleryUpload} />
      </div>
    </div>
  )
}
