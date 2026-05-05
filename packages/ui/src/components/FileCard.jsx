import { Download, File, FileImage, FileText, Film, Music, X } from 'lucide-react'
import { Button } from './Button.jsx'
import { cn } from '../lib/utils.js'

function getMimeIcon(mimeType = '') {
  if (mimeType.startsWith('image/')) return FileImage
  if (mimeType.startsWith('video/')) return Film
  if (mimeType.startsWith('audio/')) return Music
  if (mimeType === 'application/pdf' || mimeType.includes('text')) return FileText
  return File
}

function getMimeColor(mimeType = '') {
  if (mimeType.startsWith('image/')) return 'text-violet-500'
  if (mimeType === 'application/pdf') return 'text-red-500'
  if (mimeType.startsWith('video/')) return 'text-blue-500'
  if (mimeType.startsWith('audio/')) return 'text-amber-500'
  return 'text-[hsl(var(--muted-foreground))]'
}

function formatBytes(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function FileCard({ name, mimeType, sizeBytes, url, onRemove, className }) {
  const Icon = getMimeIcon(mimeType)
  const iconColor = getMimeColor(mimeType)

  function handleDownload() {
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    a.click()
  }

  return (
    <div className={cn('group relative flex items-center gap-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3 transition-shadow hover:shadow-sm', className)}>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--muted))]">
        <Icon className={cn('h-5 w-5', iconColor)} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-[hsl(var(--foreground))]">{name}</p>
        {sizeBytes != null && (
          <p className="text-xs text-[hsl(var(--muted-foreground))]">{formatBytes(sizeBytes)}</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {url && (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Descargar archivo"
            onClick={handleDownload}
          >
            <Download className="h-4 w-4" />
          </Button>
        )}
        {onRemove && (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Eliminar archivo"
            onClick={onRemove}
            className="text-[hsl(var(--muted-foreground))] hover:text-destructive"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
