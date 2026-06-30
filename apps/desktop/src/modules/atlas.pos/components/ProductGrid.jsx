import { useState } from 'react'
import { ImageOff, X } from 'lucide-react'
import { EmptyState, Dialog, DialogContent, DialogTitle } from '@atlas/ui'
import { usePosCatalogCategories, usePosCatalogProducts } from '../hooks/usePosCatalog'

export default function ProductGrid({ onSelect }) {
  const { data: categories = [] } = usePosCatalogCategories()
  const [activeCat, setActiveCat] = useState(null)
  const [previewProduct, setPreviewProduct] = useState(null)

  const params = activeCat ? { category_id: activeCat } : {}
  const { data: products = [], isLoading } = usePosCatalogProducts(params)

  function handleImageClick(e, product) {
    if (!product.image_url) return
    e.stopPropagation()
    setPreviewProduct(product)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Category tabs */}
      <div className="flex gap-1.5 overflow-x-auto px-3 py-2.5 border-b border-border shrink-0 scrollbar-hide">
        <button
          onClick={() => setActiveCat(null)}
          className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors touch-manipulation ${
            !activeCat ? 'bg-foreground text-background shadow-sm' : 'bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80'
          }`}
        >
          Todos
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setActiveCat(c.id)}
            className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors touch-manipulation ${
              activeCat === c.id ? 'bg-foreground text-background shadow-sm' : 'bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80'
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* Product grid */}
      <div className="flex-1 overflow-y-auto p-3">
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border bg-card overflow-hidden animate-pulse">
                <div className="aspect-4/3 bg-muted/60" />
                <div className="px-2.5 pt-2 pb-2.5 space-y-1.5">
                  <div className="h-3.5 bg-muted rounded w-3/4" />
                  <div className="h-3.5 bg-muted rounded w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <EmptyState title="Sin productos" description="No hay productos en esta categoría." />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {products.map((p) => (
              <button
                key={p.id}
                onClick={() => onSelect(p)}
                className="group relative flex flex-col rounded-xl border border-border bg-card overflow-hidden shadow-sm hover:shadow-md hover:border-primary/50 active:scale-[0.97] transition-all touch-manipulation text-left"
              >
                {/* Image area */}
                {p.image_url ? (
                  <div className="aspect-4/3 w-full overflow-hidden bg-muted/30 shrink-0">
                    <img
                      src={p.image_url}
                      alt={p.name}
                      className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03] cursor-zoom-in"
                      onClick={(e) => handleImageClick(e, p)}
                    />
                  </div>
                ) : (
                  <div className="aspect-4/3 w-full bg-muted/40 flex items-center justify-center shrink-0">
                    <ImageOff size={22} className="text-muted-foreground/30" />
                  </div>
                )}

                {/* Footer */}
                <div className="px-2.5 pt-2 pb-2.5 flex flex-col gap-0.5 flex-1">
                  <span className="text-sm font-medium leading-tight line-clamp-2">{p.name}</span>
                  <span className="text-sm font-bold text-primary mt-auto">
                    ${parseFloat(p.price ?? p.base_price ?? 0).toFixed(2)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Image preview dialog */}
      <Dialog open={!!previewProduct} onOpenChange={(open) => !open && setPreviewProduct(null)}>
        <DialogContent size="md" className="p-0 overflow-hidden" aria-describedby={undefined}>
          {previewProduct && (
            <div className="relative">
              <DialogTitle className="sr-only">{previewProduct.name}</DialogTitle>
              <img
                src={previewProduct.image_url}
                alt={previewProduct.name}
                className="w-full max-h-[70vh] object-contain bg-muted/30"
              />
              <div className="px-4 py-3 border-t border-border">
                <p className="font-semibold text-sm">{previewProduct.name}</p>
                <p className="text-sm text-primary font-bold mt-0.5">
                  ${parseFloat(previewProduct.price ?? previewProduct.base_price ?? 0).toFixed(2)}
                </p>
              </div>
              <button
                onClick={() => setPreviewProduct(null)}
                className="absolute top-2 right-2 h-8 w-8 rounded-full bg-background/80 backdrop-blur flex items-center justify-center hover:bg-background transition-colors"
                aria-label="Cerrar"
              >
                <X size={16} />
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
