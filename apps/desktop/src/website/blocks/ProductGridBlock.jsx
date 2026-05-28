export function ProductGridBlock({ title, count }) {
  return (
    <div className="rounded-xl border-2 border-dashed border-gray-200 p-8 text-center space-y-2">
      {title && <h3 className="font-semibold text-gray-900">{title}</h3>}
      <p className="text-sm text-gray-400">Grilla de {count || 4} productos — disponible con atlas.shop</p>
    </div>
  )
}

ProductGridBlock.fields = {
  title: { type: 'text',   label: 'Titulo' },
  count: { type: 'number', label: 'Cantidad de productos' },
}
