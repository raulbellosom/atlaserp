import { useState, useRef } from 'react'
import { Button, ConfirmDialog } from '@atlas/ui'

const MAX_SIZE_MB = 100
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function DistUploadPanel({ site, onUpload, onDelete, isUploading, uploadError }) {
  const [file, setFile] = useState(null)
  const [fileError, setFileError] = useState(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const fileInputRef = useRef(null)

  const hasExistingDist = Boolean(site?.distUploadedAt)

  function handleFileChange(e) {
    setFileError(null)
    const selected = e.target.files?.[0]
    if (!selected) { setFile(null); return }
    if (!selected.name.endsWith('.zip')) {
      setFileError('Solo se aceptan archivos .zip')
      setFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }
    if (selected.size > MAX_SIZE_BYTES) {
      setFileError(`El archivo supera el limite de ${MAX_SIZE_MB}MB`)
      setFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }
    setFile(selected)
  }

  function handleUpload() {
    if (!file || isUploading) return
    onUpload(file)
    setFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="space-y-4">
      {hasExistingDist && (
        <div className="rounded-lg border border-[hsl(var(--border))] p-3 bg-[hsl(var(--muted)/0.3)] text-sm space-y-1">
          <p className="font-medium">Build actual</p>
          <p className="text-[hsl(var(--muted-foreground))]">
            Desplegado el {formatDate(site.distUploadedAt)}
          </p>
          <p className="text-[hsl(var(--muted-foreground))]">
            {site.distFileCount ?? 0} archivo{(site.distFileCount ?? 0) !== 1 ? 's' : ''}
            {site.distHasPrerender
              ? ' · Prerenderizado (multiples rutas HTML)'
              : ' · SPA (index.html fallback)'}
          </p>
        </div>
      )}

      <div className="space-y-2">
        <label className="text-sm font-medium block">Seleccionar archivo .zip</label>
        <input
          ref={fileInputRef}
          type="file"
          accept=".zip"
          onChange={handleFileChange}
          disabled={isUploading}
          className="block w-full text-sm text-[hsl(var(--muted-foreground))] file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:bg-[hsl(var(--primary))] file:text-white file:cursor-pointer disabled:opacity-50"
        />
        {fileError && <p className="text-xs text-red-600">{fileError}</p>}
        {uploadError && <p className="text-xs text-red-600">{uploadError}</p>}
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          Formato: .zip (max {MAX_SIZE_MB}MB). Incluye el output de tu bundler (Vite, Astro, Next.js static export, SvelteKit, etc.).
        </p>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Button
          type="button"
          onClick={handleUpload}
          disabled={!file || isUploading}
          size="sm"
        >
          {isUploading ? 'Subiendo...' : 'Subir build'}
        </Button>

        {hasExistingDist && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowDeleteConfirm(true)}
            disabled={isUploading}
            className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
          >
            Eliminar build
          </Button>
        )}
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
