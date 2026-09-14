const COLOR_KEYS = [
  { key: 'primary',    label: 'Color principal' },
  { key: 'secondary',  label: 'Color secundario' },
  { key: 'accent',     label: 'Acento' },
  { key: 'background', label: 'Fondo' },
  { key: 'surface',    label: 'Superficie' },
  { key: 'text',       label: 'Texto' },
  { key: 'muted',      label: 'Atenuado' },
  { key: 'border',     label: 'Borde' },
  { key: 'success',    label: 'Exito' },
  { key: 'warning',    label: 'Advertencia' },
  { key: 'error',      label: 'Error' },
]

const DEFAULTS = {
  primary:    '#6366f1',
  secondary:  '#64748b',
  accent:     '#f59e0b',
  background: '#ffffff',
  surface:    '#f8fafc',
  text:       '#111827',
  muted:      '#6b7280',
  border:     '#e2e8f0',
  success:    '#22c55e',
  warning:    '#f59e0b',
  error:      '#ef4444',
}

export default function ThemeColorEditor({ tokens = {}, onChange }) {
  const merged = { ...DEFAULTS, ...tokens }

  function handleChange(key, value) {
    onChange({ ...merged, [key]: value })
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-[hsl(var(--muted-foreground))]">
        Define los colores del sitio publico.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {COLOR_KEYS.map(({ key, label }) => (
          <div key={key} className="flex items-center gap-3 p-3 rounded-lg border border-[hsl(var(--border))]">
            <input
              type="color"
              value={merged[key] || '#000000'}
              onChange={(e) => handleChange(key, e.target.value)}
              className="w-8 h-8 rounded cursor-pointer border border-[hsl(var(--border))] p-0.5 bg-transparent"
            />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-[hsl(var(--foreground))]">{label}</p>
              <input
                type="text"
                value={merged[key] || ''}
                onChange={(e) => handleChange(key, e.target.value)}
                className="text-xs font-mono text-[hsl(var(--muted-foreground))] bg-transparent border-none outline-none w-full"
                placeholder="#000000"
              />
            </div>
            <div
              className="w-6 h-6 rounded-full border border-[hsl(var(--border))] shrink-0"
              style={{ backgroundColor: merged[key] }}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
