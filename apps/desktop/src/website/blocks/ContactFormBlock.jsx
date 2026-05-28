export function ContactFormBlock({ title }) {
  return (
    <div className="rounded-xl border-2 border-dashed border-gray-200 p-8 text-center space-y-2">
      {title && <h3 className="font-semibold text-gray-900">{title}</h3>}
      <p className="text-sm text-gray-400">Formulario de contacto — disponible con atlas.forms</p>
    </div>
  )
}

ContactFormBlock.fields = {
  title: { type: 'text', label: 'Titulo del formulario' },
}
