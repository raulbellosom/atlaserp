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
      {SOURCE_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => !isLoading && onSelect(option.value)}
          disabled={isLoading || currentSource === option.value}
          className={[
            'w-full text-left px-4 py-3 rounded-lg border transition-colors',
            currentSource === option.value
              ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.05)]'
              : 'border-[hsl(var(--border))] hover:border-[hsl(var(--primary)/0.5)]',
            isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
          ].join(' ')}
        >
          <div className="flex items-center gap-3">
            <div
              className={[
                'w-4 h-4 rounded-full border-2 flex-shrink-0',
                currentSource === option.value
                  ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]'
                  : 'border-[hsl(var(--muted-foreground))]',
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
      ))}
    </div>
  )
}
