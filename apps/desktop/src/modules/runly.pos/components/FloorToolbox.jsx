import { MousePointer2, Square, Circle, Coffee, Minus, Leaf, DoorOpen, LayoutDashboard, Columns3, Sofa, PanelTop, Footprints, PenLine, ChevronLeft, ChevronRight } from 'lucide-react'

// ─── SVG Previews ──────────────────────────────────────────────────────────

function TableSquarePreview() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32">
      <rect x="6" y="1" width="7" height="5" rx="1.5" className="fill-amber-200 dark:fill-amber-800 stroke-amber-400 dark:stroke-amber-600" strokeWidth="1" />
      <rect x="19" y="1" width="7" height="5" rx="1.5" className="fill-amber-200 dark:fill-amber-800 stroke-amber-400 dark:stroke-amber-600" strokeWidth="1" />
      <rect x="6" y="26" width="7" height="5" rx="1.5" className="fill-amber-200 dark:fill-amber-800 stroke-amber-400 dark:stroke-amber-600" strokeWidth="1" />
      <rect x="19" y="26" width="7" height="5" rx="1.5" className="fill-amber-200 dark:fill-amber-800 stroke-amber-400 dark:stroke-amber-600" strokeWidth="1" />
      <rect x="4" y="7" width="24" height="18" rx="3" className="fill-amber-50 dark:fill-amber-950/70 stroke-amber-400 dark:stroke-amber-500" strokeWidth="1.5" />
    </svg>
  )
}

function TableRoundPreview() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32">
      <circle cx="16" cy="4"  r="4" className="fill-amber-200 dark:fill-amber-800 stroke-amber-400 dark:stroke-amber-600" strokeWidth="1" />
      <circle cx="16" cy="28" r="4" className="fill-amber-200 dark:fill-amber-800 stroke-amber-400 dark:stroke-amber-600" strokeWidth="1" />
      <circle cx="4"  cy="16" r="4" className="fill-amber-200 dark:fill-amber-800 stroke-amber-400 dark:stroke-amber-600" strokeWidth="1" />
      <circle cx="28" cy="16" r="4" className="fill-amber-200 dark:fill-amber-800 stroke-amber-400 dark:stroke-amber-600" strokeWidth="1" />
      <circle cx="16" cy="16" r="9.5" className="fill-amber-50 dark:fill-amber-950/70 stroke-amber-400 dark:stroke-amber-500" strokeWidth="1.5" />
    </svg>
  )
}

function BarPreview() {
  return (
    <svg width="36" height="18" viewBox="0 0 36 18">
      <rect x="1" y="5" width="34" height="10" rx="2.5" className="fill-stone-200 dark:fill-stone-700 stroke-stone-400 dark:stroke-stone-500" strokeWidth="1.5" />
      <line x1="10" y1="5" x2="10" y2="15" className="stroke-stone-300 dark:stroke-stone-600" strokeWidth="1" />
      <line x1="19" y1="5" x2="19" y2="15" className="stroke-stone-300 dark:stroke-stone-600" strokeWidth="1" />
      <line x1="28" y1="5" x2="28" y2="15" className="stroke-stone-300 dark:stroke-stone-600" strokeWidth="1" />
    </svg>
  )
}

function WallPreview() {
  return (
    <svg width="36" height="12" viewBox="0 0 36 12">
      <rect x="1" y="3" width="34" height="7" rx="2" className="fill-zinc-400 dark:fill-zinc-500 stroke-zinc-500 dark:stroke-zinc-400" strokeWidth="1.5" />
    </svg>
  )
}

function PlantPreview() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <circle cx="14" cy="14" r="12" className="fill-green-100 dark:fill-green-900/50 stroke-green-500" strokeWidth="1.5" />
      <path d="M14 22v-8M14 14c0 0-4-2.5-4-7a4 4 0 0 1 8 0c0 4.5-4 7-4 7Z"
        className="stroke-green-600 dark:stroke-green-400" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function DoorPreview() {
  return (
    <svg width="32" height="24" viewBox="0 0 32 24">
      <rect x="2" y="1" width="10" height="22" rx="1.5" className="fill-sky-100 dark:fill-sky-900/40 stroke-sky-400 dark:stroke-sky-600" strokeWidth="1.5" />
      <path d="M12 23 A 11 11 0 0 0 23 12" className="stroke-sky-400 dark:stroke-sky-600" fill="none" strokeWidth="1.2" strokeDasharray="2 2" />
      <circle cx="10" cy="12" r="1.5" className="fill-sky-400 dark:fill-sky-600" />
    </svg>
  )
}

function FloorZonePreview() {
  return (
    <svg width="36" height="28" viewBox="0 0 36 28">
      <rect x="2" y="2" width="32" height="24" rx="3" className="fill-slate-100/60 dark:fill-slate-800/30 stroke-slate-400 dark:stroke-slate-500" strokeWidth="1.5" strokeDasharray="4 2" />
      <text x="18" y="16" textAnchor="middle" fontSize="7" className="fill-slate-500 dark:fill-slate-400" fontWeight="600">Zona</text>
    </svg>
  )
}

function PolygonPreview() {
  return (
    <svg width="36" height="28" viewBox="0 0 36 28">
      <polygon points="18,2 34,12 28,26 8,26 2,12"
        className="fill-slate-100/60 dark:fill-slate-800/30 stroke-slate-400 dark:stroke-slate-500" strokeWidth="1.5" strokeDasharray="4 2" />
      <circle cx="18" cy="2" r="2" className="fill-slate-400 dark:fill-slate-500" />
      <circle cx="34" cy="12" r="2" className="fill-slate-400 dark:fill-slate-500" />
      <circle cx="28" cy="26" r="2" className="fill-slate-400 dark:fill-slate-500" />
      <circle cx="8" cy="26" r="2" className="fill-slate-400 dark:fill-slate-500" />
      <circle cx="2" cy="12" r="2" className="fill-slate-400 dark:fill-slate-500" />
    </svg>
  )
}

function PillarPreview() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" className="fill-zinc-300 dark:fill-zinc-600 stroke-zinc-500 dark:stroke-zinc-400" strokeWidth="2" />
      <circle cx="12" cy="12" r="4" className="fill-zinc-400 dark:fill-zinc-500" />
    </svg>
  )
}

function SofaPreview() {
  return (
    <svg width="36" height="22" viewBox="0 0 36 22">
      <rect x="1" y="1" width="34" height="8" rx="2" className="fill-violet-200 dark:fill-violet-800/60 stroke-violet-400 dark:stroke-violet-600" strokeWidth="1.5" />
      <rect x="1" y="10" width="10" height="11" rx="2" className="fill-violet-100 dark:fill-violet-900/40 stroke-violet-400 dark:stroke-violet-600" strokeWidth="1.5" />
      <rect x="13" y="10" width="10" height="11" rx="2" className="fill-violet-100 dark:fill-violet-900/40 stroke-violet-400 dark:stroke-violet-600" strokeWidth="1.5" />
      <rect x="25" y="10" width="10" height="11" rx="2" className="fill-violet-100 dark:fill-violet-900/40 stroke-violet-400 dark:stroke-violet-600" strokeWidth="1.5" />
    </svg>
  )
}

function WindowPreview() {
  return (
    <svg width="36" height="16" viewBox="0 0 36 16">
      <rect x="1" y="4" width="34" height="8" rx="1.5" className="fill-sky-100 dark:fill-sky-900/30 stroke-sky-300 dark:stroke-sky-600" strokeWidth="1.5" />
      <line x1="13" y1="4" x2="13" y2="12" className="stroke-sky-300 dark:stroke-sky-600" strokeWidth="1" />
      <line x1="23" y1="4" x2="23" y2="12" className="stroke-sky-300 dark:stroke-sky-600" strokeWidth="1" />
      <line x1="1" y1="8" x2="35" y2="8" className="stroke-sky-200 dark:stroke-sky-700" strokeWidth="0.5" strokeDasharray="2 1" />
    </svg>
  )
}

function StairsPreview() {
  return (
    <svg width="24" height="28" viewBox="0 0 24 28">
      {[0,1,2,3].map((i) => (
        <rect key={i} x={i * 5} y={i * 6} width={24 - i * 5} height={28 - i * 6} rx="1"
          className="fill-slate-200 dark:fill-slate-700 stroke-slate-400 dark:stroke-slate-500" strokeWidth="1.2" />
      ))}
    </svg>
  )
}

// ─── Tool definitions ──────────────────────────────────────────────────────

const SECTIONS = [
  {
    tools: [
      { id: 'SELECT', label: 'Seleccionar', description: 'Mover y redimensionar', Icon: MousePointer2, Preview: null },
    ],
  },
  {
    header: 'Mesas',
    tools: [
      { id: 'TABLE_SQUARE', label: 'Mesa cuadrada', description: 'Mesa rectangular',   Icon: Square,         Preview: TableSquarePreview },
      { id: 'TABLE_ROUND',  label: 'Mesa redonda',  description: 'Mesa circular',       Icon: Circle,         Preview: TableRoundPreview },
    ],
  },
  {
    header: 'Mobiliario',
    tools: [
      { id: 'BAR',   label: 'Barra',    description: 'Barra de servicio',   Icon: Coffee,        Preview: BarPreview },
      { id: 'SOFA',  label: 'Sofá',     description: 'Zona lounge / espera', Icon: Sofa,          Preview: SofaPreview },
      { id: 'PLANT', label: 'Planta',   description: 'Decoración verde',    Icon: Leaf,          Preview: PlantPreview },
    ],
  },
  {
    header: 'Arquitectura',
    tools: [
      { id: 'WALL',       label: 'Pared',       description: 'Pared o división',        Icon: Minus,          Preview: WallPreview },
      { id: 'WINDOW',     label: 'Ventana',      description: 'Ventana o cristalera',   Icon: PanelTop,       Preview: WindowPreview },
      { id: 'DOOR',       label: 'Puerta',       description: 'Entrada o salida',       Icon: DoorOpen,       Preview: DoorPreview },
      { id: 'PILLAR',     label: 'Columna',      description: 'Pilar estructural',      Icon: Columns3,       Preview: PillarPreview },
      { id: 'STAIRS',     label: 'Escaleras',    description: 'Tramo de escalera',      Icon: Footprints,     Preview: StairsPreview },
    ],
  },
  {
    header: 'Zonas',
    tools: [
      { id: 'FLOOR_ZONE', label: 'Zona / Área',  description: 'Área rectangular (terraza, VIP…)', Icon: LayoutDashboard, Preview: FloorZonePreview },
      { id: 'POLYGON',    label: 'Polígono',      description: 'Área de forma libre (clic por vértice)', Icon: PenLine, Preview: PolygonPreview },
    ],
  },
]

// ─── Tool button ───────────────────────────────────────────────────────────

function ToolButton({ tool, isActive, onClick }) {
  const { Icon, Preview } = tool
  return (
    <button
      type="button"
      onClick={onClick}
      title={tool.description}
      className={[
        'group flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-colors w-full',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        isActive
          ? 'bg-primary/10 text-primary'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      ].join(' ')}
    >
      <div className={[
        'flex h-6 w-6 shrink-0 items-center justify-center rounded border transition-colors',
        isActive
          ? 'border-primary/40 bg-primary/10 text-primary'
          : 'border-border bg-background text-muted-foreground group-hover:text-foreground',
      ].join(' ')}>
        <Icon size={12} strokeWidth={2.2} />
      </div>

      <span className={['flex-1 text-xs font-medium leading-tight truncate', isActive ? 'text-primary' : ''].join(' ')}>
        {tool.label}
      </span>

      {Preview && (
        <div className={[
          'shrink-0 rounded border p-0.5 flex items-center justify-center transition-colors',
          isActive ? 'border-primary/30 bg-primary/5' : 'border-border bg-muted/40',
        ].join(' ')}>
          <Preview />
        </div>
      )}
    </button>
  )
}

// ─── Toolbox content (reusable in sidebar or Sheet) ───────────────────────

export function FloorToolboxContent({ activeTool, onToolChange, showHints = true }) {
  return (
    <>
      <div className="flex flex-col gap-0.5 p-2 flex-1">
        {SECTIONS.map((section, si) => (
          <div key={si} className={si > 0 ? 'mt-2' : ''}>
            {section.header && (
              <p className="px-2 pb-1 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest">
                {section.header}
              </p>
            )}
            <div className="flex flex-col gap-0.5">
              {section.tools.map((tool) => (
                <ToolButton
                  key={tool.id}
                  tool={tool}
                  isActive={activeTool === tool.id}
                  onClick={() => onToolChange(tool.id)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {showHints && (
        <div className="px-3 py-2 border-t border-border/60 space-y-0.5">
          <p className="text-[10px] text-muted-foreground/50 leading-tight">
            Clic para colocar · Clic derecho: opciones
          </p>
          <p className="text-[10px] text-muted-foreground/40 leading-tight">
            Polígono: clic por vértice · doble clic para cerrar
          </p>
          <p className="text-[10px] text-muted-foreground/40 leading-tight">
            Ctrl+C / Ctrl+V / Ctrl+D · Del · ↑↓←→
          </p>
          <p className="text-[10px] text-muted-foreground/40 leading-tight">
            Ctrl+Z deshacer · Ctrl+Y rehacer · Ctrl+scroll zoom
          </p>
        </div>
      )}
    </>
  )
}

// ─── Toolbox sidebar (desktop) ─────────────────────────────────────────────

export default function FloorToolbox({ activeTool, onToolChange, collapsed, onToggleCollapse }) {
  if (collapsed) {
    return (
      <div className="w-10 shrink-0 border-r border-border bg-card flex flex-col items-center pt-2 gap-1">
        <button
          type="button"
          onClick={onToggleCollapse}
          title="Expandir herramientas"
          className="w-7 h-7 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    )
  }
  return (
    <div className="w-52 shrink-0 border-r border-border bg-card flex flex-col overflow-y-auto">
      <div className="px-3 pt-3 pb-2 border-b border-border/60 flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Elementos</p>
        <button
          type="button"
          onClick={onToggleCollapse}
          title="Colapsar"
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft size={12} />
        </button>
      </div>
      <FloorToolboxContent activeTool={activeTool} onToolChange={onToolChange} />
    </div>
  )
}
