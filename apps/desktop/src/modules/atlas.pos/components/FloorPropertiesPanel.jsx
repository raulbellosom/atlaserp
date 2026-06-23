import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button, TextField, SelectField, ConfirmDialog } from '@atlas/ui'

const KIND_LABELS = {
  TABLE_SQUARE: 'Mesa cuadrada',
  TABLE_ROUND:  'Mesa redonda',
  BAR:          'Barra',
  WALL:         'Pared',
  PLANT:        'Planta',
  DOOR:         'Puerta',
  FLOOR_ZONE:   'Zona / Área',
  PILLAR:       'Columna',
  SOFA:         'Sofá',
  WINDOW:       'Ventana',
  STAIRS:       'Escaleras',
  POLYGON:      'Área poligonal',
}

const KIND_BADGE = {
  TABLE_SQUARE: 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700',
  TABLE_ROUND:  'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700',
  BAR:          'bg-stone-100 dark:bg-stone-800/40 text-stone-700 dark:text-stone-300 border-stone-300 dark:border-stone-600',
  WALL:         'bg-zinc-100 dark:bg-zinc-800/40 text-zinc-700 dark:text-zinc-300 border-zinc-300 dark:border-zinc-600',
  PLANT:        'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700',
  DOOR:         'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 border-sky-300 dark:border-sky-700',
  FLOOR_ZONE:   'bg-slate-100 dark:bg-slate-800/30 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600',
  PILLAR:       'bg-zinc-100 dark:bg-zinc-800/40 text-zinc-700 dark:text-zinc-300 border-zinc-300 dark:border-zinc-600',
  SOFA:         'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 border-violet-300 dark:border-violet-700',
  WINDOW:       'bg-sky-50 dark:bg-sky-900/20 text-sky-600 dark:text-sky-400 border-sky-200 dark:border-sky-700',
  STAIRS:       'bg-slate-100 dark:bg-slate-800/30 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-600',
  POLYGON:      'bg-slate-100 dark:bg-slate-800/30 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600',
}

const CHAIR_STYLES = [
  { value: 'auto',       label: 'Alrededor (todos lados)' },
  { value: 'two_sides',  label: 'Dos lados (frente / atrás)' },
  { value: 'one_side',   label: 'Un lado (tipo terraza)' },
  { value: 'none',       label: 'Sin sillas' },
]

const ZONE_COLORS = [
  { value: 'neutral', label: 'Neutral (gris)' },
  { value: 'dining',  label: 'Comedor (azul)' },
  { value: 'outdoor', label: 'Exterior (verde)' },
  { value: 'bar',     label: 'Bar (ámbar)' },
  { value: 'vip',     label: 'VIP (violeta)' },
  { value: 'private', label: 'Privado (rojo)' },
]

function Section({ title, children }) {
  return (
    <div className="px-3 py-3 border-b border-border/60 last:border-b-0">
      <p className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-widest mb-2">{title}</p>
      <div className="flex flex-col gap-2.5">{children}</div>
    </div>
  )
}

const DEFAULT_CONTAINER = 'w-56 shrink-0 border-l border-border bg-card flex flex-col overflow-y-auto'

export default function FloorPropertiesPanel({ element, onUpdate, onRemove, className, collapsed, onToggleCollapse }) {
  const [deleteOpen, setDeleteOpen] = useState(false)
  const containerClass = className ?? DEFAULT_CONTAINER

  if (collapsed) {
    return (
      <div className="w-10 shrink-0 border-l border-border bg-card flex flex-col items-center pt-2 gap-1">
        <button
          type="button"
          onClick={onToggleCollapse}
          title="Expandir propiedades"
          className="w-7 h-7 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft size={14} />
        </button>
        {element && (
          <div className="w-2 h-2 rounded-full bg-primary mt-1" title="Elemento seleccionado" />
        )}
      </div>
    )
  }

  if (!element) {
    return (
      <div className={containerClass}>
        <div className="px-3 pt-3 pb-2 border-b border-border/60 flex items-center justify-between">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Propiedades</p>
          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              title="Colapsar"
              className="w-6 h-6 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronRight size={12} />
            </button>
          )}
        </div>
        <div className="flex flex-col items-center px-4 pt-8 pb-6 gap-4">
          {/* Icon */}
          <div className="w-11 h-11 rounded-xl bg-muted/60 border border-border/50 flex items-center justify-center shrink-0">
            <svg width="20" height="20" viewBox="0 0 16 16" fill="none" className="text-muted-foreground/50">
              <rect x="3" y="5" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
              <rect x="5" y="2" width="3" height="3" rx="0.75" stroke="currentColor" strokeWidth="1.25" />
              <rect x="8" y="2" width="3" height="3" rx="0.75" stroke="currentColor" strokeWidth="1.25" />
            </svg>
          </div>
          {/* Copy */}
          <div className="text-center space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground">Sin selección</p>
            <p className="text-[11px] text-muted-foreground/55 leading-relaxed">
              Haz clic en una mesa u objeto del plano para ver y editar sus propiedades
            </p>
          </div>
          {/* Ghost skeleton rows */}
          <div className="w-full mt-1 space-y-2 opacity-20 pointer-events-none select-none" aria-hidden>
            <div className="h-7.5 rounded-md bg-muted/70 border border-border/40" />
            <div className="h-7.5 rounded-md bg-muted/70 border border-border/40" />
            <div className="grid grid-cols-2 gap-2">
              <div className="h-7.5 rounded-md bg-muted/70 border border-border/40" />
              <div className="h-7.5 rounded-md bg-muted/70 border border-border/40" />
            </div>
            <div className="h-7.5 rounded-md bg-muted/70 border border-border/40" />
          </div>
        </div>
        {/* Bottom delete button ghost */}
        <div className="px-3 py-3 mt-auto opacity-15 pointer-events-none select-none" aria-hidden>
          <div className="h-8 rounded-md bg-destructive/30 border border-destructive/20" />
        </div>
      </div>
    )
  }

  const isTable = element.kind.startsWith('TABLE_')
  const isBar = element.kind === 'BAR'
  const isZone = element.kind === 'FLOOR_ZONE'
  const isPolygon = element.kind === 'POLYGON'
  const hasLabel = !isTable && !isBar && !isZone && !isPolygon
  const badgeClass = KIND_BADGE[element.kind] ?? 'bg-muted text-foreground border-border'

  return (
    <div className={containerClass}>
      <div className="px-3 pt-3 pb-2 border-b border-border/60 flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Propiedades</p>
        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            title="Colapsar"
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronRight size={12} />
          </button>
        )}
      </div>

      {/* Type badge */}
      <div className="px-3 py-2.5 border-b border-border/60">
        <span className={['inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border', badgeClass].join(' ')}>
          {KIND_LABELS[element.kind] ?? element.kind}
        </span>
        <p className="text-[10px] text-muted-foreground/60 mt-1.5">
          {Math.round(element.width)} × {Math.round(element.height)} px
        </p>
      </div>

      {/* Table props */}
      {isTable && (
        <Section title="Mesa">
          <TextField
            label="Nombre"
            value={element.tableName ?? ''}
            onChange={(e) => onUpdate({ tableName: e.target.value })}
            placeholder="Ej. Mesa 1"
          />
          <TextField
            label="Capacidad (personas)"
            type="number" min={1} max={99}
            value={String(element.capacity ?? 2)}
            onChange={(e) => onUpdate({ capacity: Math.max(1, Number(e.target.value) || 1) })}
          />
          <div>
            <p className="text-xs text-muted-foreground mb-1">Disposición de sillas</p>
            <SelectField
              value={element.chairStyle ?? 'auto'}
              onChange={(v) => onUpdate({ chairStyle: v })}
              options={CHAIR_STYLES}
            />
          </div>
        </Section>
      )}

      {/* Bar props */}
      {isBar && (
        <Section title="Barra">
          <TextField
            label="Etiqueta (opcional)"
            value={element.label ?? ''}
            onChange={(e) => onUpdate({ label: e.target.value || null })}
            placeholder="Ej. Barra principal"
          />
          <TextField
            label="Taburetes (0 = sin asientos)"
            type="number" min={0} max={30}
            value={String(element.capacity ?? 0)}
            onChange={(e) => onUpdate({ capacity: Math.max(0, Number(e.target.value) || 0) })}
          />
        </Section>
      )}

      {/* Zone props */}
      {(isZone || isPolygon) && (
        <Section title={isPolygon ? 'Polígono' : 'Zona'}>
          <TextField
            label={isPolygon ? 'Nombre del área' : 'Nombre de la zona'}
            value={element.label ?? ''}
            onChange={(e) => onUpdate({ label: e.target.value || null })}
            placeholder="Ej. Terraza, VIP..."
          />
          <div>
            <p className="text-xs text-muted-foreground mb-1">Color</p>
            <SelectField
              value={element.color ?? 'neutral'}
              onChange={(v) => onUpdate({ color: v })}
              options={ZONE_COLORS}
            />
          </div>
          {isPolygon && (
            <p className="text-[10px] text-muted-foreground/60 leading-snug">
              {element.points?.length ?? 0} vértices · Mover para reubicar
            </p>
          )}
        </Section>
      )}

      {/* Generic label for other shapes */}
      {hasLabel && (
        <Section title="Etiqueta">
          <TextField
            label="Texto (opcional)"
            value={element.label ?? ''}
            onChange={(e) => onUpdate({ label: e.target.value || null })}
            placeholder="Sin etiqueta"
          />
        </Section>
      )}

      {/* Size — not shown for polygon (vertices define bounds) */}
      {!isPolygon && (
        <Section title="Tamaño">
          <div className="grid grid-cols-2 gap-2">
            <TextField label="Ancho" type="number" min={20}
              value={String(Math.round(element.width))}
              onChange={(e) => onUpdate({ width: Math.max(20, Number(e.target.value) || 20) })}
            />
            <TextField label="Alto" type="number" min={20}
              value={String(Math.round(element.height))}
              onChange={(e) => onUpdate({ height: Math.max(20, Number(e.target.value) || 20) })}
            />
          </div>
        </Section>
      )}

      {/* Position */}
      {!isPolygon && (
        <Section title="Posición">
          <div className="grid grid-cols-2 gap-2">
            <TextField label="X" type="number"
              value={String(Math.round(element.x))}
              onChange={(e) => onUpdate({ x: Number(e.target.value) || 0 })}
            />
            <TextField label="Y" type="number"
              value={String(Math.round(element.y))}
              onChange={(e) => onUpdate({ y: Number(e.target.value) || 0 })}
            />
          </div>
        </Section>
      )}

      <div className="px-3 py-3 mt-auto">
        <Button variant="destructive" size="sm" className="w-full" onClick={() => setDeleteOpen(true)}>
          Eliminar elemento
        </Button>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={(v) => !v && setDeleteOpen(false)}
        title="Eliminar elemento"
        description={
          isTable
            ? 'La mesa se eliminará del plano. Si tiene órdenes activas, no podrá desactivarse hasta que se cierren.'
            : 'Este elemento será eliminado del plano.'
        }
        detail={isTable ? element.tableName : (element.label ?? KIND_LABELS[element.kind])}
        confirmLabel="Eliminar"
        onConfirm={onRemove}
      />
    </div>
  )
}
