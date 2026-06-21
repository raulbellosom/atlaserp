import { useState } from 'react'
import { EmptyState } from '@atlas/ui'
import { usePosCatalogCategories, usePosCatalogProducts } from '../hooks/usePosCatalog'

export default function ProductGrid({ onSelect }) {
  const { data: categories = [] } = usePosCatalogCategories()
  const [activeCat, setActiveCat] = useState(null)

  const params = activeCat ? { category_id: activeCat } : {}
  const { data: products = [], isLoading } = usePosCatalogProducts(params)

  return (
    <div className="flex flex-col h-full">
      <div className="flex gap-2 overflow-x-auto p-3 border-b border-border shrink-0 scrollbar-hide">
        <button
          onClick={() => setActiveCat(null)}
          className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            !activeCat ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
          }`}
        >
          Todos
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setActiveCat(c.id)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              activeCat === c.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {isLoading ? (
          <p className="text-sm text-muted-foreground p-4">Cargando productos...</p>
        ) : products.length === 0 ? (
          <EmptyState title="Sin productos" description="No hay productos en esta categoría." />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {products.map((p) => (
              <button
                key={p.id}
                onClick={() => onSelect(p)}
                className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-3 text-center hover:border-primary hover:bg-primary/5 active:scale-95 transition-all"
              >
                {p.image_url ? (
                  <img src={p.image_url} alt={p.name} className="h-16 w-16 rounded-lg object-cover" />
                ) : (
                  <div className="h-16 w-16 rounded-lg bg-muted flex items-center justify-center text-2xl text-muted-foreground">
                    ?
                  </div>
                )}
                <span className="text-sm font-medium leading-tight line-clamp-2">{p.name}</span>
                <span className="text-sm font-semibold text-primary">
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
