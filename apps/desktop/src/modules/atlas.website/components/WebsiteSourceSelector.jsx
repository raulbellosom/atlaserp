import { Check, Globe, LayoutTemplate, Package2 } from 'lucide-react'

const SOURCE_OPTIONS = [
  {
    value: 'none',
    label: 'Sin sitio publico',
    description: 'La ruta raiz devuelve 404. Solo /app/ existe para el panel de administracion.',
    Icon: Globe,
    tags: ['Modo privado', 'Solo /app/'],
    accentBorder: 'border-slate-400/70 dark:border-slate-500',
    accentText: 'text-slate-600 dark:text-slate-400',
    accentIconBg: 'bg-slate-100/80 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400',
    accentRing: 'ring-slate-300/50 dark:ring-slate-700/40',
    accentTag: 'text-slate-600 dark:text-slate-400 bg-slate-100/70 dark:bg-slate-900/30 border-slate-300/70 dark:border-slate-600',
  },
  {
    value: 'builder',
    label: 'Constructor de paginas',
    description: 'Sirve las paginas creadas con el editor visual del ERP.',
    Icon: LayoutTemplate,
    tags: ['Editor visual', 'Sin codigo'],
    accentBorder: 'border-violet-400/70 dark:border-violet-500',
    accentText: 'text-violet-600 dark:text-violet-400',
    accentIconBg: 'bg-violet-100/80 dark:bg-violet-900/30 text-violet-500 dark:text-violet-400',
    accentRing: 'ring-violet-300/50 dark:ring-violet-800/40',
    accentTag: 'text-violet-600 dark:text-violet-400 bg-violet-100/70 dark:bg-violet-900/20 border-violet-300/70 dark:border-violet-600',
  },
  {
    value: 'dist',
    label: 'Build propio (dist/)',
    description: 'Sirve tu app compilada de React, Astro, Next.js, SvelteKit u otro framework.',
    Icon: Package2,
    tags: ['React', 'Astro', 'Next.js', 'SvelteKit'],
    accentBorder: 'border-indigo-400/70 dark:border-indigo-500',
    accentText: 'text-indigo-600 dark:text-indigo-400',
    accentIconBg: 'bg-indigo-100/80 dark:bg-indigo-900/30 text-indigo-500 dark:text-indigo-400',
    accentRing: 'ring-indigo-300/50 dark:ring-indigo-800/40',
    accentTag: 'text-indigo-600 dark:text-indigo-400 bg-indigo-100/70 dark:bg-indigo-900/20 border-indigo-300/70 dark:border-indigo-600',
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
              'backdrop-blur-(--glass-blur)',
              isLoading && !selected ? 'opacity-50 cursor-not-allowed' : '',
              selected
                ? `${opt.accentBorder} bg-[rgba(240,245,255,0.88)] dark:bg-white/5 shadow-[0_4px_24px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.9)] ring-2 ${opt.accentRing}`
                : 'border-white/65 dark:border-white/10 bg-[rgba(232,242,255,0.72)] dark:bg-white/4 shadow-[0_4px_24px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.92),0_0_0_1px_rgba(0,0,0,0.05)] hover:bg-[rgba(218,234,255,0.82)] dark:hover:bg-white/7 cursor-pointer',
            ].join(' ')}
          >
            <div className="flex items-start gap-4">
              <div className="shrink-0">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                  selected
                    ? opt.accentIconBg
                    : 'bg-muted/60 text-muted-foreground group-hover:text-foreground'
                }`}>
                  <opt.Icon className="w-5 h-5" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className={`font-semibold text-base transition-colors ${
                    selected ? opt.accentText : 'text-foreground'
                  }`}>
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
                    <span
                      key={tag}
                      className={[
                        'text-xs px-2.5 py-1 rounded-full font-medium border transition-colors',
                        selected
                          ? opt.accentTag
                          : 'text-muted-foreground bg-muted/60 border-border/60',
                      ].join(' ')}
                    >
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
