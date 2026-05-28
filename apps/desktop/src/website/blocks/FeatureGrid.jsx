const DEFAULT_FEATURES = [
  { icon: '★', title: 'Caracteristica 1', description: 'Descripcion de la caracteristica.' },
  { icon: '●', title: 'Caracteristica 2', description: 'Descripcion de la caracteristica.' },
  { icon: '◆', title: 'Caracteristica 3', description: 'Descripcion de la caracteristica.' },
]

export function FeatureGrid({ title, features, columns }) {
  const items = (features && features.length > 0) ? features : DEFAULT_FEATURES
  const cols = columns === '2' ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-3'

  return (
    <div className="space-y-8">
      {title && <h2 className="text-3xl font-semibold text-center text-gray-900">{title}</h2>}
      <div className={`grid gap-6 ${cols}`}>
        {items.map((f, i) => (
          <div key={i} className="rounded-xl border border-gray-200 p-6 space-y-2">
            {f.icon        && <span className="text-2xl">{f.icon}</span>}
            {f.title       && <h3 className="font-semibold text-gray-900">{f.title}</h3>}
            {f.description && <p className="text-sm text-gray-600">{f.description}</p>}
          </div>
        ))}
      </div>
    </div>
  )
}

FeatureGrid.fields = {
  title:    { type: 'text',   label: 'Titulo de la seccion' },
  columns:  { type: 'select', label: 'Columnas', options: [
    { label: '2', value: '2' }, { label: '3', value: '3' },
  ]},
  features: {
    type:       'array',
    label:      'Caracteristicas',
    arrayFields: {
      icon:        { type: 'text',     label: 'Icono (emoji o texto)' },
      title:       { type: 'text',     label: 'Titulo' },
      description: { type: 'textarea', label: 'Descripcion' },
    },
  },
}
