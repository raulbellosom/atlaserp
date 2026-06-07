import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Upload, FileArchive, X } from 'lucide-react'

function formatBytes(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function validateFile(file, accept, maxSizeMB) {
  if (accept) {
    const acceptList = accept.split(',').map(s => s.trim().toLowerCase())
    const fileName = file.name.toLowerCase()
    const mimeType = (file.type || '').toLowerCase()
    const matches = acceptList.some(a => {
      if (a.startsWith('.')) return fileName.endsWith(a)
      if (a.endsWith('/*')) return mimeType.startsWith(a.slice(0, -1))
      return mimeType === a
    })
    if (!matches) return `Tipo de archivo no permitido. Solo se aceptan: ${accept}`
  }
  if (maxSizeMB && file.size > maxSizeMB * 1024 * 1024) {
    return `El archivo supera el limite de ${maxSizeMB} MB`
  }
  return null
}

export function DistDropZone({
  onFile,
  accept,
  maxSizeMB = 10,
  fullScreenOverlay = false,
  overlayLabel,
  overlayHint,
  isUploading = false,
  file = null,
  onClear,
  emptyLabel = 'Arrastra tu archivo aqui',
  emptyHint = 'o haz clic para seleccionar',
  dragActiveLabel = 'Suelta el archivo aqui',
  error = null,
}) {
  const [isDraggingZone, setIsDraggingZone] = useState(false)
  const [isDraggingPage, setIsDraggingPage] = useState(false)
  const [localError, setLocalError] = useState(null)
  const inputRef = useRef(null)
  const dragCounter = useRef(0)

  function pick(f) {
    if (!f) return
    const err = validateFile(f, accept, maxSizeMB)
    if (err) { setLocalError(err); return }
    setLocalError(null)
    if (inputRef.current) inputRef.current.value = ''
    onFile(f)
  }

  useEffect(() => {
    if (!fullScreenOverlay) return

    const onEnter = (e) => {
      e.preventDefault()
      dragCounter.current++
      if (dragCounter.current === 1) setIsDraggingPage(true)
    }
    const onLeave = (e) => {
      e.preventDefault()
      dragCounter.current = Math.max(0, dragCounter.current - 1)
      if (dragCounter.current === 0) setIsDraggingPage(false)
    }
    const onOver = (e) => e.preventDefault()
    const onDrop = (e) => {
      e.preventDefault()
      dragCounter.current = 0
      setIsDraggingPage(false)
      setIsDraggingZone(false)
      if (!isUploading) pick(e.dataTransfer.files?.[0] ?? null)
    }

    document.addEventListener('dragenter', onEnter)
    document.addEventListener('dragleave', onLeave)
    document.addEventListener('dragover', onOver)
    document.addEventListener('drop', onDrop)
    return () => {
      document.removeEventListener('dragenter', onEnter)
      document.removeEventListener('dragleave', onLeave)
      document.removeEventListener('dragover', onOver)
      document.removeEventListener('drop', onDrop)
    }
  }, [fullScreenOverlay, isUploading])

  const displayError = localError || error

  const overlay = (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
      <div className="absolute inset-4 rounded-3xl bg-[hsl(var(--primary))]/8 border-2 border-dashed border-[hsl(var(--primary))]/50 backdrop-blur-sm" />
      <div className="relative flex flex-col items-center gap-4 text-center">
        <div className="flex h-24 w-24 items-center justify-center rounded-3xl border border-[hsl(var(--primary))]/30 bg-[hsl(var(--primary))]/15">
          <Upload className="h-12 w-12 text-[hsl(var(--primary))]" />
        </div>
        <div className="space-y-1">
          <p className="text-2xl font-bold text-[hsl(var(--foreground))]">{overlayLabel}</p>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">{overlayHint}</p>
        </div>
      </div>
    </div>
  )

  return (
    <>
      {fullScreenOverlay && isDraggingPage && createPortal(overlay, document.body)}

      <div className="space-y-2">
        <div
          onClick={() => !isUploading && inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); if (!isUploading) setIsDraggingZone(true) }}
          onDragLeave={() => setIsDraggingZone(false)}
          onDrop={(e) => {
            e.preventDefault()
            setIsDraggingZone(false)
            if (!isUploading) pick(e.dataTransfer.files?.[0] ?? null)
          }}
          className={[
            'flex flex-col items-center justify-center gap-2.5 rounded-2xl border-2 border-dashed py-8 px-4 text-center select-none transition-all duration-200',
            isUploading
              ? 'opacity-50 cursor-not-allowed border-border bg-muted/20'
              : isDraggingZone
                ? 'border-primary bg-primary/5 cursor-copy'
                : file
                  ? 'border-indigo-300 dark:border-indigo-700 bg-indigo-50/50 dark:bg-indigo-950/20 cursor-pointer'
                  : 'border-border bg-muted/20 hover:border-primary/40 hover:bg-muted/40 cursor-pointer',
          ].join(' ')}
        >
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            onChange={(e) => pick(e.target.files?.[0] ?? null)}
            disabled={isUploading}
            className="sr-only"
          />

          {file ? (
            <>
              <div className="w-11 h-11 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
                <FileArchive className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-indigo-800 dark:text-indigo-300">{file.name}</p>
                <p className="text-xs text-indigo-500 dark:text-indigo-400 mt-0.5">{formatBytes(file.size)} &middot; listo para subir</p>
              </div>
              {onClear && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setLocalError(null)
                    if (inputRef.current) inputRef.current.value = ''
                    onClear()
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <X className="w-3 h-3" /> Cambiar archivo
                </button>
              )}
            </>
          ) : (
            <>
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center transition-colors ${isDraggingZone ? 'bg-primary/10' : 'bg-muted'}`}>
                <Upload className={`w-5 h-5 transition-colors ${isDraggingZone ? 'text-primary' : 'text-muted-foreground'}`} />
              </div>
              <div>
                <p className="text-sm font-semibold">
                  {isDraggingZone ? dragActiveLabel : emptyLabel}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{emptyHint}</p>
              </div>
            </>
          )}
        </div>

        {displayError && (
          <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1.5">
            <X className="w-3 h-3 shrink-0" />
            {displayError}
          </p>
        )}
      </div>
    </>
  )
}
