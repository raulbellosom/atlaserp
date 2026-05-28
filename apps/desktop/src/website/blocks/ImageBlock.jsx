export function ImageBlock({ src, alt, width, rounded }) {
  if (!src) {
    return (
      <div className="w-full h-48 bg-gray-100 rounded-lg flex items-center justify-center">
        <span className="text-gray-400 text-sm">Imagen</span>
      </div>
    )
  }
  return (
    <img
      src={src}
      alt={alt || ''}
      className={`${rounded ? 'rounded-xl' : ''} max-w-full`}
      style={width ? { width } : {}}
    />
  )
}

ImageBlock.fields = {
  src:     { type: 'text',  label: 'URL de imagen' },
  alt:     { type: 'text',  label: 'Texto alternativo' },
  width:   { type: 'text',  label: 'Ancho (CSS, ej: 100%)' },
  rounded: { type: 'radio', label: 'Esquinas redondeadas', options: [
    { label: 'Si', value: true }, { label: 'No', value: false },
  ]},
}
