const FONT_OPTIONS = [
  'Inter, sans-serif',
  'Roboto, sans-serif',
  'Poppins, sans-serif',
  'Open Sans, sans-serif',
  'Lato, sans-serif',
  'Montserrat, sans-serif',
  'Merriweather, serif',
  'Georgia, serif',
  'Playfair Display, serif',
  'Fira Code, monospace',
]

const SIZE_OPTIONS = ['14px', '15px', '16px', '17px', '18px']
const WEIGHT_OPTIONS = ['400', '500', '600', '700', '800']

const DEFAULTS = {
  bodyFont:       'Inter, sans-serif',
  headingFont:    'Inter, sans-serif',
  baseFontSize:   '16px',
  headingWeight:  '700',
}

export default function ThemeTypographyEditor({ typography = {}, onChange }) {
  const merged = { ...DEFAULTS, ...typography }

  function handleChange(key, value) {
    onChange({ ...merged, [key]: value })
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-[hsl(var(--muted-foreground))]">
        Define la tipografia del sitio publico.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-xs font-medium text-[hsl(var(--foreground))]">Fuente del cuerpo</label>
          <select
            value={merged.bodyFont}
            onChange={(e) => handleChange('bodyFont', e.target.value)}
            className="flex h-9 w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
          >
            {FONT_OPTIONS.map((f) => <option key={f} value={f}>{f.split(',')[0]}</option>)}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-[hsl(var(--foreground))]">Fuente de titulos</label>
          <select
            value={merged.headingFont}
            onChange={(e) => handleChange('headingFont', e.target.value)}
            className="flex h-9 w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
          >
            {FONT_OPTIONS.map((f) => <option key={f} value={f}>{f.split(',')[0]}</option>)}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-[hsl(var(--foreground))]">Tamano base</label>
          <select
            value={merged.baseFontSize}
            onChange={(e) => handleChange('baseFontSize', e.target.value)}
            className="flex h-9 w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
          >
            {SIZE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-[hsl(var(--foreground))]">Peso de titulos</label>
          <select
            value={merged.headingWeight}
            onChange={(e) => handleChange('headingWeight', e.target.value)}
            className="flex h-9 w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
          >
            {WEIGHT_OPTIONS.map((w) => <option key={w} value={w}>{w}</option>)}
          </select>
        </div>
      </div>

      <div className="rounded-xl border border-[hsl(var(--border))] p-5 space-y-2">
        <p className="text-xs text-[hsl(var(--muted-foreground))]">Vista previa</p>
        <h2
          style={{
            fontFamily: merged.headingFont,
            fontWeight: merged.headingWeight,
            fontSize: '1.5rem',
          }}
          className="text-[hsl(var(--foreground))]"
        >
          Titulo de ejemplo
        </h2>
        <p
          style={{
            fontFamily: merged.bodyFont,
            fontSize: merged.baseFontSize,
          }}
          className="text-[hsl(var(--muted-foreground))]"
        >
          Texto de ejemplo para visualizar la tipografia del cuerpo del sitio web.
        </p>
      </div>
    </div>
  )
}
