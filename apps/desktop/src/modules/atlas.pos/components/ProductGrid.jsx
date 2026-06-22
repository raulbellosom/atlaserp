import { useState } from 'react'
import { ImageOff } from 'lucide-react'
import { EmptyState } from '@atlas/ui'
import { usePosCatalogCategories, usePosCatalogProducts } from '../hooks/usePosCatalog'

export default function ProductGrid({ onSelect }) {
  const { data: categories = [] } = usePosCatalogCategories()
  const [activeCat, setActiveCat] = useState(null)

  const params = activeCat ? { category_id: activeCat } : {}
  const { data: products = [], isLoading } = usePosCatalogProducts(params)

  return (
    <div className="flex flex-col h-full">
      {/* Category tabs */}
      <div className="flex gap-1.5 overflow-x-auto px-3 py-2.5 border-b border-border shrink-0 scrollbar-hide">
        <button
          onClick={() => setActiveCat(null)}
          className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors touch-manipulation ${
            !activeCat ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80'
          }`}
        >
          Todos
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setActiveCat(c.id)}
            className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors touch-manipulation ${
              activeCat === c.id ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80'
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* Product grid */}
      <div className="flex-1 overflow-y-auto p-3">
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-3/4 rounded-xl border border-border bg-muted/40 animate-pulse" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <EmptyState title="Sin productos" description="No hay productos en esta categoría." />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {products.map((p) => (
              <button
                key={p.id}
                onClick={() => onSelect(p)}
                className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-3 text-center hover:border-primary hover:bg-primary/5 active:scale-[0.97] transition-all touch-manipulation"
              >
                {p.image_url ? (
                  <img src={p.image_url} alt={p.name} className="h-16 w-16 rounded-lg object-cover" />
                ) : (
                  <div className="h-16 w-16 rounded-lg bg-muted flex items-center justify-center">
                    <ImageOff size={24} className="text-muted-foreground/40" />
                  </div>
                )}
                <span className="text-sm font-medium leading-tight line-clamp-2 w-full">{p.name}</span>
                <span className="text-sm font-bold text-primary mt-auto">
                  ${parseFloat(p.price ?? p.base_price ?? 0).toFixed(2)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
