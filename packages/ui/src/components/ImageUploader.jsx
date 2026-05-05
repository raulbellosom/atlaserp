import { useState, useRef } from 'react'
import { ImagePlus, X } from 'lucide-react'
import { ImageViewer } from './ImageViewer.jsx'
import { Button } from './Button.jsx'
import { cn } from '../lib/utils.js'

export function ImageUploader({
  value = [],
  onChange,
  maxFiles = 1,
  accept = 'image/*',
  maxSizeMB = 5,
  className,
}) {
  const [viewer, setViewer] = useState(null)
  const inputRef = useRef(null)

  const isMultiple = maxFiles > 1
  const isFull = value.length >= maxFiles

  function handleFiles(files) {
    const valid = Array.from(files).filter((f) => {
      if (f.size > maxSizeMB * 1024 * 1024) return false
      return true
    })
    const next = isMultiple ? [...value, ...valid].slice(0, maxFiles) : valid.slice(0, 1)
    onChange(next)
  }

  function handleDrop(e) {
    e.preventDefault()
    handleFiles(e.dataTransfer.files)
  }

  function handleRemove(index) {
    onChange(value.filter((_, i) => i !== index))
  }

  function objectUrl(file) {
    return typeof file === 'string' ? file : URL.createObjectURL(file)
  }

  function fileName(file) {
    return typeof file === 'string' ? file.split('/').pop() : file.name
  }

  return (
    <div className={cn('space-y-3', className)}>
      {value.length > 0 && (
        <div className={cn('flex flex-wrap gap-2', !isMultiple && 'flex-col')}>
          {value.map((file, i) => {
            const src = objectUrl(file)
            return (
              <div
                key={i}
                className="group relative overflow-hidden rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted))]"
                style={isMultiple ? { width: 80, height: 80 } : { height: 120 }}
              >
                <img
                  src={src}
                  alt={`Imagen ${i + 1}`}
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 flex items-center justify-center gap-1 bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    type="button"
                    aria-label="Ver imagen"
                    onClick={() => setViewer({ src, fileName: fileName(file) })}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm hover:bg-white/30"
                  >
                    <span className="text-xs">+</span>
                  </button>
                  <button
                    type="button"
                    aria-label="Eliminar imagen"
                    onClick={() => handleRemove(i)}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm hover:bg-red-500/80"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {!isFull && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--muted))]/40 px-4 py-8 text-center transition-colors hover:bg-[hsl(var(--muted))]/60 hover:border-(--brand-primary)"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--muted))]">
            <ImagePlus className="h-5 w-5 text-[hsl(var(--muted-foreground))]" />
          </div>
          <div>
            <p className="text-sm font-medium text-[hsl(var(--foreground))]">
              Arrastra una imagen o haz clic
            </p>
            <p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">
              {accept.replace('image/', '').replace('*', 'PNG, JPG, WebP')} · máx. {maxSizeMB} MB
            </p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            multiple={isMultiple}
            className="sr-only"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </button>
      )}

      {viewer && (
        <ImageViewer
          open
          src={viewer.src}
          fileName={viewer.fileName}
          onClose={() => setViewer(null)}
        />
      )}
    </div>
  )
}
