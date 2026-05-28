export function TextBlock({ content, size }) {
  const sizeClass = size === 'large' ? 'text-lg' : size === 'small' ? 'text-sm' : 'text-base'
  return (
    <p className={`${sizeClass} text-gray-700 leading-relaxed`}>{content || 'Texto aqui...'}</p>
  )
}

TextBlock.fields = {
  content: { type: 'textarea', label: 'Contenido' },
  size: { type: 'select', label: 'Tamano', options: [
    { label: 'Normal', value: 'base' },
    { label: 'Grande', value: 'large' },
    { label: 'Pequeno', value: 'small' },
  ]},
}
