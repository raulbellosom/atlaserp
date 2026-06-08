import { SelectField } from '@atlas/ui'

const FONT_RAW = [
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

const FONT_OPTIONS    = FONT_RAW.map((f) => ({ value: f, label: f.split(',')[0] }))
const SIZE_OPTIONS    = ['14px', '15px', '16px', '17px', '18px'].map((s) => ({ value: s, label: s }))
const WEIGHT_OPTIONS  = ['400', '500', '600', '700', '800'].map((w) => ({ value: w, label: w }))

const DEFAULTS = {
  bodyFont:      'Inter, sans-serif',
  headingFont:   'Inter, sans-serif',
  baseFontSize:  '16px',
  headingWeight: '700',
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
        <SelectField
          label="Fuente del cuerpo"
          value={merged.bodyFont}
          onChange={(v) => handleChange('bodyFont', v)}
          options={FONT_OPTIONS}
        />
        <SelectField
          label="Fuente de titulos"
          value={merged.headingFont}
          onChange={(v) => handleChange('headingFont', v)}
          options={FONT_OPTIONS}
        />
        <SelectField
          label="Tamano base"
          value={merged.baseFontSize}
          onChange={(v) => handleChange('baseFontSize', v)}
          options={SIZE_OPTIONS}
        />
        <SelectField
          label="Peso de titulos"
          value={merged.headingWeight}
          onChange={(v) => handleChange('headingWeight', v)}
          options={WEIGHT_OPTIONS}
        />
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
