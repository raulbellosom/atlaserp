import { Check, Globe, LayoutTemplate, Package2 } from 'lucide-react'

const SOURCE_OPTIONS = [
  {
    value: 'none',
    label: 'Sin sitio publico',
    description: 'La ruta raiz devuelve 404. Solo /app/ existe para el panel de administracion.',
    Icon: Globe,
    tags: ['Modo privado', 'Solo /app/'],
    accentBg: 'bg-slate-50 dark:bg-slate-900/30',
    accentText: 'text-slate-600 dark:text-slate-400',
    accentBorder: 'border-slate-400 dark:border-slate-500',
    accentRing: 'ring-slate-200 dark:ring-slate-800',
    accentTag: 'text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/30 border-slate-400 dark:border-slate-600',
  },
  {
    value: 'builder',
    label: 'Constructor de paginas',
    description: 'Sirve las paginas creadas con el editor visual del ERP.',
    Icon: LayoutTemplate,
    tags: ['Editor visual', 'Sin codigo'],
    accentBg: 'bg-violet-50 dark:bg-violet-900/20',
    accentText: 'text-violet-700 dark:text-violet-400',
    accentBorder: 'border-violet-500',
    accentRing: 'ring-violet-200 dark:ring-violet-900',
    accentTag: 'text-violet-700 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/20 border-violet-500',
  },
  {
    value: 'dist',
    label: 'Build propio (dist/)',
    description: 'Sirve tu app compilada de React, Astro, Next.js, SvelteKit u otro framework.',
    Icon: Package2,
    tags: ['React', 'Astro', 'Next.js', 'SvelteKit'],
    accentBg: 'bg-indigo-50 dark:bg-indigo-900/20',
    accentText: 'text-indigo-700 dark:text-indigo-400',
    accentBorder: 'border-indigo-500',
    accentRing: 'ring-indigo-200 dark:ring-indigo-900',
    accentTag: 'text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 border-indigo-500',
  },
]

export function WebsiteSourceSelector({ currentSource, onSelect, isLoading }) {
  return (
    <div className="grid gap-3">
      {SOURCE_OPTIONS.map((opt) => {
        const selected = currentSource === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => !isLoading && !selected && onSelect(opt.value)}
            disabled={isLoading}
            className={[
              'group relative text-left rounded-2xl border-2 p-5 transition-all duration-200',
              isLoading && !selected ? 'opacity-50 cursor-not-allowed' : '',
              selected
                ? `${opt.accentBorder} ${opt.accentBg} shadow-md ring-4 ${opt.accentRing}`
                : 'border-border bg-card hover:border-primary/40 hover:shadow-md cursor-pointer',
            ].join(' ')}
          >
            <div className="flex items-start gap-4">
              <div className={`shrink-0 transition-colors ${selected ? opt.accentText : 'text-muted-foreground group-hover:text-foreground'}`}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-muted/60">
                  <opt.Icon className="w-5 h-5" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className={`font-semibold text-base transition-colors ${selected ? opt.accentText : 'text-foreground'}`}>
                    {opt.label}
                  </p>
                  {selected && (
                    <span className={`shrink-0 ${opt.accentText}`}>
                      <Check className="w-5 h-5" />
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">{opt.description}</p>
                <div className="flex flex-wrap gap-2 mt-3">
                  {opt.tags.map((tag) => (
                    <span key={tag} className={[
                      'text-xs px-2.5 py-1 rounded-full font-medium border transition-colors',
                      selected
                        ? opt.accentTag
                        : 'text-muted-foreground bg-muted border-border',
                    ].join(' ')}>
                      {tag}
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
