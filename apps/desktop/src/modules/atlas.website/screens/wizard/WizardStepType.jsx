const SITE_TYPES = [
  {
    value: 'website',
    label: 'Sitio informativo',
    description: 'Paginas estaticas con formulario de contacto',
    icon: (
      <svg viewBox="0 0 40 40" fill="none" className="w-10 h-10">
        <rect width="40" height="40" rx="12" fill="currentColor" fillOpacity="0.1"/>
        <path d="M8 28h24M8 22h16M8 16h24M20 28V10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        <rect x="22" y="14" width="10" height="14" rx="2" stroke="currentColor" strokeWidth="2"/>
      </svg>
    ),
    features: ['Paginas estaticas', 'Formulario de contacto', 'SEO optimizado'],
    accent: 'violet',
  },
  {
    value: 'ecommerce',
    label: 'Tienda online',
    description: 'Catalogo de productos, carrito y pagos',
    icon: (
      <svg viewBox="0 0 40 40" fill="none" className="w-10 h-10">
        <rect width="40" height="40" rx="12" fill="currentColor" fillOpacity="0.1"/>
        <path d="M6 8h4l2.5 14h15l2.5-10H12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="16" cy="26" r="2" stroke="currentColor" strokeWidth="2"/>
        <circle cx="24" cy="26" r="2" stroke="currentColor" strokeWidth="2"/>
      </svg>
    ),
    features: ['Catalogo de productos', 'Carrito de compras', 'Pasarela de pagos'],
    accent: 'emerald',
  },
  {
    value: 'blog',
    label: 'Blog / Contenido',
    description: 'Publicaciones, articulos y marketing de contenidos',
    icon: (
      <svg viewBox="0 0 40 40" fill="none" className="w-10 h-10">
        <rect width="40" height="40" rx="12" fill="currentColor" fillOpacity="0.1"/>
        <path d="M8 14h24M8 20h18M8 26h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    ),
    features: ['Posts y articulos', 'Categorias y etiquetas', 'RSS'],
    accent: 'orange',
  },
  {
    value: 'landing',
    label: 'Landing page',
    description: 'Pagina de captura con llamada a la accion',
    icon: (
      <svg viewBox="0 0 40 40" fill="none" className="w-10 h-10">
        <rect width="40" height="40" rx="12" fill="currentColor" fillOpacity="0.1"/>
        <rect x="8" y="10" width="24" height="22" rx="3" stroke="currentColor" strokeWidth="2"/>
        <path d="M14 22h12M14 17h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        <rect x="13" y="25" width="14" height="4" rx="2" fill="currentColor" fillOpacity="0.4"/>
      </svg>
    ),
    features: ['Hero visual', 'CTA destacado', 'Formulario integrado'],
    accent: 'sky',
  },
]

const ACCENT_CLASSES = {
  violet: {
    selected: 'border-violet-500/80 dark:border-violet-400 bg-violet-50/80 dark:bg-violet-950/30 ring-violet-300/50 dark:ring-violet-800/40',
    text:     'text-violet-700 dark:text-violet-300',
    badge:    'border-violet-300/70 dark:border-violet-600 text-violet-700 dark:text-violet-300 bg-violet-50/70 dark:bg-violet-950/40',
  },
  emerald: {
    selected: 'border-emerald-500/80 dark:border-emerald-400 bg-emerald-50/80 dark:bg-emerald-950/30 ring-emerald-300/50 dark:ring-emerald-800/40',
    text:     'text-emerald-700 dark:text-emerald-300',
    badge:    'border-emerald-300/70 dark:border-emerald-600 text-emerald-700 dark:text-emerald-300 bg-emerald-50/70 dark:bg-emerald-950/40',
  },
  orange: {
    selected: 'border-orange-500/80 dark:border-orange-400 bg-orange-50/80 dark:bg-orange-950/30 ring-orange-300/50 dark:ring-orange-800/40',
    text:     'text-orange-700 dark:text-orange-300',
    badge:    'border-orange-300/70 dark:border-orange-600 text-orange-700 dark:text-orange-300 bg-orange-50/70 dark:bg-orange-950/40',
  },
  sky: {
    selected: 'border-sky-500/80 dark:border-sky-400 bg-sky-50/80 dark:bg-sky-950/30 ring-sky-300/50 dark:ring-sky-800/40',
    text:     'text-sky-700 dark:text-sky-300',
    badge:    'border-sky-300/70 dark:border-sky-600 text-sky-700 dark:text-sky-300 bg-sky-50/70 dark:bg-sky-950/40',
  },
}

export function WizardStepType({ value, onNext, onBack }) {
  return (
    <div className="space-y-3">
      {SITE_TYPES.map((t) => {
        const isSelected = value === t.value
        const ac = ACCENT_CLASSES[t.accent]
        return (
          <button
            key={t.value}
            type="button"
            onClick={() => onNext(t.value)}
            className={`w-full group text-left rounded-2xl border-2 p-5 transition-all duration-200 ${
              isSelected
                ? `${ac.selected} ring-2 backdrop-blur-(--glass-blur) shadow-[0_4px_24px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.9)]`
                : 'border-white/65 dark:border-white/10 bg-[rgba(232,242,255,0.72)] dark:bg-white/4 backdrop-blur-(--glass-blur) shadow-[0_4px_24px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.92),0_0_0_1px_rgba(0,0,0,0.05)] hover:bg-[rgba(218,234,255,0.82)] dark:hover:bg-white/7 hover:shadow-[0_6px_32px_rgba(0,0,0,0.09),inset_0_1px_0_rgba(255,255,255,0.95),0_0_0_1px_rgba(0,0,0,0.07)]'
            }`}
          >
            <div className="flex items-start gap-4">
              <div className={`shrink-0 transition-colors ${isSelected ? ac.text : 'text-muted-foreground group-hover:text-foreground'}`}>
                {t.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`font-semibold text-base transition-colors ${isSelected ? ac.text : 'text-foreground'}`}>
                  {t.label}
                </p>
                <p className="text-sm text-muted-foreground mt-0.5">{t.description}</p>
                <div className="flex flex-wrap gap-2 mt-3">
                  {t.features.map((f) => (
                    <span
                      key={f}
                      className={`text-xs px-2.5 py-1 rounded-full font-medium border transition-colors ${
                        isSelected ? ac.badge : 'text-muted-foreground bg-background border-border'
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
      {onBack && (
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onBack}
            className="flex-1 py-3 rounded-xl font-semibold text-sm text-foreground border-2 border-border hover:bg-muted transition-all"
          >
            Atras
          </button>
        </div>
      )}
    </div>
  )
}
