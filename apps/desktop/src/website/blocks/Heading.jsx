const TAG_MAP = { h1: 'h1', h2: 'h2', h3: 'h3', h4: 'h4' }
const SIZE_MAP = {
  h1: 'text-4xl font-bold',
  h2: 'text-3xl font-semibold',
  h3: 'text-2xl font-semibold',
  h4: 'text-xl font-medium',
}

export function Heading({ text, level, align }) {
  const Tag = TAG_MAP[level] || 'h2'
  return (
    <Tag
      className={`${SIZE_MAP[level] || SIZE_MAP.h2} text-gray-900 ${align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : ''}`}
    >
      {text || 'Titulo'}
    </Tag>
  )
}

Heading.fields = {
  text:  { type: 'text',   label: 'Texto' },
  level: { type: 'select', label: 'Nivel', options: [
    { label: 'H1', value: 'h1' }, { label: 'H2', value: 'h2' },
    { label: 'H3', value: 'h3' }, { label: 'H4', value: 'h4' },
  ]},
  align: { type: 'select', label: 'Alineacion', options: [
    { label: 'Izquierda', value: 'left' },
    { label: 'Centro',    value: 'center' },
    { label: 'Derecha',   value: 'right' },
  ]},
}
