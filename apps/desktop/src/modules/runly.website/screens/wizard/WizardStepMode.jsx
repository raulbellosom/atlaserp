import { Globe, Upload } from 'lucide-react'

const MODES = [
  {
    value: 'web_builder',
    label: 'Web Builder',
    description: 'Editor visual de paginas, bloques y plantillas.',
    icon: Globe,
    features: ['Editor visual', 'Plantillas prediseñadas', 'Blog y formularios'],
  },
  {
    value: 'zip',
    label: 'Subir ZIP / Pre-render',
    description: 'Sube el dist de tu proyecto ya compilado.',
    icon: Upload,
    features: ['Sitio estatico personalizado', 'Cualquier framework', 'Sin editor visual'],
  },
]

export function WizardStepMode({ value, onNext }) {
  return (
    <div className="space-y-3">
      {MODES.map((mode) => {
        const Icon = mode.icon
        const selected = value === mode.value
        return (
          <button
            key={mode.value}
            type="button"
            onClick={() => onNext(mode.value)}
            className={`w-full text-left rounded-2xl border-2 p-5 transition-all duration-200 ${
              selected
                ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                : 'border-border hover:border-primary/40 hover:bg-muted/40'
            }`}
          >
            <div className="flex items-start gap-4">
              <div className={`shrink-0 mt-0.5 ${selected ? 'text-primary' : 'text-muted-foreground'}`}>
                <Icon size={22} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`font-semibold text-base ${selected ? 'text-primary' : 'text-foreground'}`}>
                  {mode.label}
                </p>
                <p className="text-sm text-muted-foreground mt-0.5">{mode.description}</p>
                <div className="flex flex-wrap gap-2 mt-3">
                  {mode.features.map((f) => (
                    <span
                      key={f}
                      className={`text-xs px-2.5 py-1 rounded-full font-medium border ${
                        selected
                          ? 'border-primary/30 text-primary bg-primary/10'
                          : 'border-border text-muted-foreground bg-background'
                      }`}
                    >
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}
