import { useState, useRef } from 'react'
import { Button, ConfirmDialog } from '@atlas/ui'
import { Upload, FileArchive, X, Trash2, CheckCircle2 } from 'lucide-react'

const MAX_SIZE_MB = 100
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function DistUploadPanel({ site, onUpload, onDelete, isUploading, uploadError }) {
  const [file, setFile]               = useState(null)
  const [fileError, setFileError]     = useState(null)
  const [isDragging, setIsDragging]   = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const inputRef = useRef(null)

  const hasExistingDist = Boolean(site?.distUploadedAt)

  function validate(f) {
    if (!f.name.endsWith('.zip')) return 'Solo se aceptan archivos .zip'
    if (f.size > MAX_SIZE_BYTES) return `El archivo supera el limite de ${MAX_SIZE_MB} MB`
    return null
  }

  function pick(f) {
    if (!f) return
    const err = validate(f)
    if (err) { setFileError(err); setFile(null); return }
    setFileError(null)
    setFile(f)
  }

  function handleInputChange(e) { pick(e.target.files?.[0] ?? null) }

  function handleDrop(e) {
    e.preventDefault()
    setIsDragging(false)
    pick(e.dataTransfer.files?.[0] ?? null)
  }

  function handleUpload() {
    if (!file || isUploading) return
    onUpload(file)
    setFile(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  function clearFile() {
    setFile(null)
    setFileError(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="space-y-4">

      {/* Existing build info */}
      {hasExistingDist && (
        <div className="flex items-start gap-3 rounded-2xl border border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-950/30 p-4">
          <CheckCircle2 className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-indigo-800 dark:text-indigo-300">Build activo</p>
            <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-0.5">
              Desplegado el {formatDate(site.distUploadedAt)} &middot; {site.distFileCount ?? 0} archivo{(site.distFileCount ?? 0) !== 1 ? 's' : ''}
              {site.distHasPrerender ? ' · Prerenderizado' : ' · SPA'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            disabled={isUploading}
            className="shrink-0 flex items-center gap-1.5 text-xs font-medium text-red-500 hover:text-red-700 transition-colors disabled:opacity-40"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Eliminar
          </button>
        </div>
      )}

      {/* Drop zone */}
      <div
        onClick={() => !isUploading && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); if (!isUploading) setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={[
          'flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed py-8 px-4 text-center select-none transition-all duration-200',
          isUploading
            ? 'opacity-50 cursor-not-allowed border-border bg-muted/30'
            : isDragging
              ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30 cursor-copy'
              : file
                ? 'border-indigo-300 dark:border-indigo-700 bg-indigo-50/50 dark:bg-indigo-950/20 cursor-pointer'
                : 'border-border bg-muted/30 hover:border-primary/40 hover:bg-muted/50 cursor-pointer',
        ].join(' ')}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".zip"
          onChange={handleInputChange}
          disabled={isUploading}
          className="sr-only"
        />

        {file ? (
          <>
            <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
              <FileArchive className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-indigo-800">{file.name}</p>
              <p className="text-xs text-indigo-500 mt-0.5">{formatBytes(file.size)} · listo para subir</p>
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); clearFile() }}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
            >
              <X className="w-3 h-3" /> Cambiar archivo
            </button>
          </>
        ) : (
          <>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${isDragging ? 'bg-indigo-100 dark:bg-indigo-900/40' : 'bg-muted'}`}>
              <Upload className={`w-5 h-5 transition-colors ${isDragging ? 'text-indigo-600 dark:text-indigo-400' : 'text-muted-foreground'}`} />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                {isDragging ? 'Suelta el archivo aqui' : 'Arrastra tu .zip aqui'}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">o haz clic para seleccionar · max {MAX_SIZE_MB} MB</p>
            </div>
          </>
        )}
      </div>

      {(fileError || uploadError) && (
        <p className="text-xs text-red-600 flex items-center gap-1">
          <X className="w-3 h-3" /> {fileError || uploadError}
        </p>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleUpload}
          disabled={!file || isUploading}
          className={[
            'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200',
            'disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-md hover:-translate-y-0.5 active:translate-y-0',
            file && !isUploading
              ? 'bg-primary text-primary-foreground hover:bg-primary/90'
              : 'bg-muted text-muted-foreground',
          ].join(' ')}
        >
          <Upload className="w-4 h-4" />
          {isUploading ? 'Subiendo...' : 'Subir build'}
        </button>
      </div>

      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Eliminar build"
        description="Se eliminaran todos los archivos del build actual. El sitio volvera al constructor de paginas hasta que subas un nuevo build. Esta accion no se puede deshacer."
        confirmLabel="Eliminar"
        onConfirm={() => { setShowDeleteConfirm(false); onDelete() }}
      />
    </div>
  )
}
