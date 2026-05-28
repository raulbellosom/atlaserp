export function CTA({ title, description, buttonLabel, buttonHref, variant }) {
  const bg = variant === 'dark' ? 'bg-gray-900 text-white' : 'bg-indigo-600 text-white'
  const btnClass = variant === 'dark'
    ? 'bg-white text-gray-900 hover:bg-gray-100'
    : 'bg-white text-indigo-600 hover:bg-indigo-50'

  return (
    <section className={`w-full rounded-2xl px-8 py-12 text-center space-y-4 ${bg}`}>
      {title       && <h2 className="text-2xl font-bold">{title}</h2>}
      {description && <p className="text-base opacity-80">{description}</p>}
      {buttonLabel && (
        <a
          href={buttonHref || '#'}
          className={`inline-block mt-2 px-6 py-3 rounded-lg font-semibold text-sm transition-colors ${btnClass}`}
        >
          {buttonLabel}
        </a>
      )}
    </section>
  )
}

CTA.fields = {
  title:       { type: 'text',     label: 'Titulo' },
  description: { type: 'textarea', label: 'Descripcion' },
  buttonLabel: { type: 'text',     label: 'Texto del boton' },
  buttonHref:  { type: 'text',     label: 'Enlace' },
  variant:     { type: 'select',   label: 'Estilo', options: [
    { label: 'Indigo', value: 'indigo' }, { label: 'Oscuro', value: 'dark' },
  ]},
}
