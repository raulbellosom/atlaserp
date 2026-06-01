import { useNavigate } from 'react-router-dom'
import { LayoutTemplate } from 'lucide-react'
import { allTemplates } from '../../../website/atlasTemplates/index.js'

export default function WebsiteTemplatesScreen() {
  const navigate = useNavigate()

  return (
    <div className="p-8 space-y-8 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold text-[hsl(var(--foreground))]">Plantillas</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
          Selecciona una plantilla para previsualizarla y elegir las paginas que deseas crear.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {allTemplates.map((tpl) => (
          <button
            key={tpl.id}
            onClick={() => navigate(`/app/m/atlas.website/templates/${tpl.id}/preview`)}
            className="text-left rounded-xl border-2 border-[hsl(var(--border))] p-5 transition-all w-full hover:border-[hsl(var(--primary)/0.4)] hover:bg-[hsl(var(--muted)/0.4)] hover:shadow-sm cursor-pointer"
          >
            <div className="flex items-start gap-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                style={{ background: `${tpl.color}20` }}
              >
                <LayoutTemplate size={18} style={{ color: tpl.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-[hsl(var(--foreground))]">{tpl.label}</h3>
                <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5 line-clamp-2">
                  {tpl.description}
                </p>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-2">
                  {tpl.pages.length} pagina{tpl.pages.length !== 1 ? 's' : ''} · Clic para previsualizar
                </p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
