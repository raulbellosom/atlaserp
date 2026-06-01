import { useState, useMemo, useEffect } from 'react'
import {
  AtlasWebBuilderProvider,
  AtlasWebRenderer,
  baseBlocks,
  serializePage,
  parsePage,
  defaultTheme,
} from '@raulbellosom/atlas-web-builder'
import '@raulbellosom/atlas-web-builder/styles'
import {
  Dialog,
  DialogContent,
  Button,
} from '@atlas/ui'
import {
  universalAtlasBlocks,
  ecommerceAtlasBlocks,
  bookingsAtlasBlocks,
  restaurantAtlasBlocks,
} from '../../../website/atlasBlocks/index.js'

const ALL_BLOCKS = [
  ...baseBlocks,
  ...universalAtlasBlocks,
  ...ecommerceAtlasBlocks,
  ...bookingsAtlasBlocks,
  ...restaurantAtlasBlocks,
]

function TemplatePagePreview({ page }) {
  const parsedPage = useMemo(() => {
    try {
      return parsePage(serializePage(page))
    } catch {
      return null
    }
  }, [page])

  if (!parsedPage) {
    return (
      <div className="flex items-center justify-center h-96 text-sm text-gray-400">
        Vista previa no disponible.
      </div>
    )
  }

  return (
    <AtlasWebBuilderProvider blocks={ALL_BLOCKS} theme={defaultTheme}>
      <AtlasWebRenderer page={parsedPage} mode="public" />
    </AtlasWebBuilderProvider>
  )
}

export function TemplatePreviewDialog({ template, open, onOpenChange, onApply, applying }) {
  const [selectedPageIds, setSelectedPageIds] = useState([])

  useEffect(() => {
    if (template) {
      setSelectedPageIds(template.pages.map((p) => p.id))
    }
  }, [template])

  function togglePage(pageId) {
    setSelectedPageIds((prev) =>
      prev.includes(pageId) ? prev.filter((id) => id !== pageId) : [...prev, pageId]
    )
  }

  const homePage = template?.pages[0]?.page ?? null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl p-0 overflow-hidden h-[85vh]">
        <div className="flex h-full overflow-hidden">

          {/* Left panel: info + page selection + apply */}
          <div className="w-64 shrink-0 flex flex-col border-r border-[hsl(var(--border))] bg-[hsl(var(--background))]">
            <div className="p-5 border-b border-[hsl(var(--border))]">
              <div className="flex items-center gap-2.5 mb-1.5">
                <div
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ background: template?.color }}
                />
                <h2 className="font-semibold text-[hsl(var(--foreground))] truncate">
                  {template?.label}
                </h2>
              </div>
              <p className="text-xs text-[hsl(var(--muted-foreground))] leading-relaxed line-clamp-3">
                {template?.description}
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-1">
              <p className="text-[11px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-2">
                Paginas incluidas
              </p>
              {template?.pages.map((p) => (
                <label
                  key={p.id}
                  className={`flex items-center gap-2.5 p-2.5 rounded-lg transition-colors ${
                    p.required
                      ? 'opacity-60'
                      : 'cursor-pointer hover:bg-[hsl(var(--muted)/0.5)]'
                  } ${selectedPageIds.includes(p.id) ? 'bg-[hsl(var(--muted)/0.3)]' : ''}`}
                >
                  <input
                    type="checkbox"
                    className="rounded shrink-0"
                    checked={selectedPageIds.includes(p.id)}
                    disabled={p.required}
                    onChange={() => { if (!p.required) togglePage(p.id) }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[hsl(var(--foreground))] truncate">
                      {p.label}
                    </p>
                    <p className="text-[11px] text-[hsl(var(--muted-foreground))] font-mono truncate">
                      {p.routePath}
                    </p>
                  </div>
                  {p.required && (
                    <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 shrink-0">
                      base
                    </span>
                  )}
                </label>
              ))}
            </div>

            <div className="p-4 border-t border-[hsl(var(--border))] space-y-2">
              <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
                Las rutas ya existentes seran omitidas.
              </p>
              <Button
                className="w-full"
                onClick={() => onApply(selectedPageIds)}
                disabled={applying || selectedPageIds.length === 0}
              >
                {applying
                  ? 'Creando paginas...'
                  : `Aplicar — ${selectedPageIds.length} pagina${selectedPageIds.length !== 1 ? 's' : ''}`}
              </Button>
            </div>
          </div>

          {/* Right panel: scaled live preview */}
          <div className="flex-1 relative overflow-hidden bg-gray-100">
            <div className="absolute inset-0 overflow-hidden">
              <div
                style={{
                  width: '1280px',
                  transformOrigin: 'top left',
                  transform: 'scale(0.5)',
                  pointerEvents: 'none',
                }}
              >
                {homePage && <TemplatePagePreview page={homePage} />}
              </div>
            </div>
            <div className="absolute bottom-3 right-3 bg-black/50 backdrop-blur-sm text-white text-[11px] px-2.5 py-1 rounded-full pointer-events-none">
              Vista previa de la pagina de inicio
            </div>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  )
}
