const SOURCE_OPTIONS = [
  {
    value: 'none',
    label: 'Sin sitio publico',
    description: 'La ruta raiz devuelve 404. Solo existe /app/ para el panel de administracion.',
  },
  {
    value: 'builder',
    label: 'Constructor de paginas',
    description: 'Sirve las paginas creadas en el editor visual del ERP.',
  },
  {
    value: 'dist',
    label: 'Build propio (dist/)',
    description: 'Sirve tu app compilada de React, Astro, Next.js (static export), SvelteKit u otro framework.',
  },
]

export function WebsiteSourceSelector({ currentSource, onSelect, isLoading }) {
  return (
    <div className="space-y-2">
      {SOURCE_OPTIONS.map((option) => {
        const selected = currentSource === option.value
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => !isLoading && !selected && onSelect(option.value)}
            disabled={isLoading}
            className={[
              'w-full text-left px-4 py-3 rounded-lg border transition-colors',
              selected
                ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/5 cursor-default'
                : 'border-[hsl(var(--border))] hover:border-[hsl(var(--primary))]/50 cursor-pointer',
              isLoading ? 'opacity-50 cursor-not-allowed' : '',
            ].join(' ')}
          >
            <div className="flex items-center gap-3">
              <div
                className={[
                  'w-4 h-4 rounded-full border-2 shrink-0 transition-colors',
                  selected
                    ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]'
                    : 'border-[hsl(var(--muted-foreground))] bg-transparent',
                ].join(' ')}
              />
              <div>
                <p className="text-sm font-medium">{option.label}</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
                  {option.description}
                </p>
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}
