import { useState } from 'react'
import {
  Eye, EyeOff, Lock, LockOpen, GripVertical, Plus, MoreVertical, CornerUpLeft,
} from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SortableList,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  ConfirmDialog,
} from '@atlas/ui'

// One layer row — a single line. `revealAll` (mobile) keeps every control
// visible; on desktop the drag handle and opacity slider fade in on hover while
// eye / lock / name / overflow stay put so a resting list is still fully usable.
function LayerRow({
  layer,
  isActive,
  revealAll,
  hasSelection,
  dragHandleProps,
  onSelect,
  onRename,
  onToggleVisible,
  onToggleLocked,
  onOpacity,
  onMoveSelectionHere,
  onDuplicate,
  onMergeDown,
  onRequestDelete,
  canMergeDown,
  canDelete,
}) {
  const hoverReveal = revealAll ? '' : 'opacity-0 group-hover:opacity-100 transition-opacity'

  return (
    <div
      className={[
        'group relative flex items-center gap-1 pl-2.5 pr-1.5 rounded-lg cursor-pointer transition-colors',
        revealAll ? 'h-11' : 'h-10',
        isActive ? 'glass-tinted' : 'hover:bg-black/4 dark:hover:bg-white/5',
      ].join(' ')}
      onClick={() => onSelect(layer.id)}
    >
      {isActive && (
        <span className="absolute left-0 top-1.5 bottom-1.5 w-0.75 rounded-full bg-amber-500" />
      )}

      <span
        className={[
          'shrink-0 flex items-center justify-center w-4 h-8 text-muted-foreground/50 cursor-grab active:cursor-grabbing touch-none',
          hoverReveal,
        ].join(' ')}
        aria-label="Reordenar capa"
        {...dragHandleProps}
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical size={13} />
      </span>

      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onToggleVisible(layer.id) }}
        className="shrink-0 flex items-center justify-center w-6 h-8 rounded-md hover:bg-black/6 dark:hover:bg-white/8"
        aria-label={layer.visible ? 'Ocultar capa' : 'Mostrar capa'}
      >
        {layer.visible
          ? <Eye size={14} />
          : <EyeOff size={14} className="text-muted-foreground/60" />}
      </button>

      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onToggleLocked(layer.id) }}
        className="shrink-0 flex items-center justify-center w-6 h-8 rounded-md hover:bg-black/6 dark:hover:bg-white/8"
        aria-label={layer.locked ? 'Desbloquear capa' : 'Bloquear capa'}
      >
        {layer.locked
          ? <Lock size={13} className="text-amber-500" />
          : <LockOpen size={13} className="text-muted-foreground/50" />}
      </button>

      <input
        value={layer.name}
        onChange={(e) => onRename(layer.id, e.target.value)}
        onClick={(e) => e.stopPropagation()}
        spellCheck={false}
        className={[
          'flex-1 min-w-0 h-8 bg-transparent border-0 px-1 text-xs truncate',
          'focus:outline-none focus:ring-1 focus:ring-amber-400/60 focus:bg-black/4 dark:focus:bg-white/6 rounded',
          isActive ? 'text-foreground font-medium' : 'text-foreground/80',
        ].join(' ')}
      />

      {hasSelection && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onMoveSelectionHere(layer.id) }}
          className="shrink-0 flex items-center gap-1 h-7 px-2 rounded-md text-[11px] font-medium text-amber-700 dark:text-amber-300 bg-amber-500/15 hover:bg-amber-500/25"
          title="Mover la seleccion a esta capa"
        >
          <CornerUpLeft size={12} /> Mover
        </button>
      )}

      <input
        type="range"
        min="0"
        max="100"
        value={Math.round((layer.opacity ?? 1) * 100)}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => onOpacity(layer.id, Number(e.target.value) / 100)}
        className={['w-10 shrink-0 h-1 accent-amber-500', hoverReveal].join(' ')}
        aria-label="Opacidad de la capa"
        title={`Opacidad ${Math.round((layer.opacity ?? 1) * 100)}%`}
      />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="shrink-0 flex items-center justify-center w-6 h-8 rounded-md text-muted-foreground/70 hover:bg-black/6 dark:hover:bg-white/8 data-[state=open]:bg-black/6 dark:data-[state=open]:bg-white/8"
            onClick={(e) => e.stopPropagation()}
            aria-label="Acciones de capa"
          >
            <MoreVertical size={14} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => onDuplicate(layer.id)}>Duplicar</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onMergeDown(layer.id)} disabled={!canMergeDown}>
            Combinar hacia abajo
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onRequestDelete(layer)} disabled={!canDelete}>
            Eliminar capa
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

function LayersBody({
  layers,
  activeLayerId,
  elementCounts,
  revealAll,
  selectionCount = 0,
  onSelect,
  onRename,
  onToggleVisible,
  onToggleLocked,
  onOpacity,
  onReorderList,
  onMoveSelectionHere,
  onDuplicate,
  onMergeDown,
  onDelete,
}) {
  const [confirmDel, setConfirmDel] = useState(null)
  // Topmost layer (highest order) first.
  const topFirst = [...layers].sort((a, b) => b.order - a.order)
  const hasSelection = selectionCount > 0

  return (
    <div className="flex flex-col gap-0.5 p-1.5 overflow-y-auto">
      <SortableList
        items={topFirst}
        onReorder={(reordered) => onReorderList(reordered)}
        renderItem={(layer, { dragHandleProps }) => {
          const idxFromTop = topFirst.findIndex((l) => l.id === layer.id)
          return (
            <LayerRow
              layer={layer}
              isActive={layer.id === activeLayerId}
              revealAll={revealAll}
              hasSelection={hasSelection}
              dragHandleProps={dragHandleProps}
              onSelect={onSelect}
              onRename={onRename}
              onToggleVisible={onToggleVisible}
              onToggleLocked={onToggleLocked}
              onOpacity={onOpacity}
              onMoveSelectionHere={onMoveSelectionHere}
              onDuplicate={onDuplicate}
              onMergeDown={onMergeDown}
              onRequestDelete={(l) =>
                (elementCounts?.[l.id] ?? 0) > 0 ? setConfirmDel(l) : onDelete(l.id)
              }
              canMergeDown={idxFromTop < topFirst.length - 1}
              canDelete={layers.length > 1}
            />
          )
        }}
      />
      <ConfirmDialog
        open={Boolean(confirmDel)}
        onOpenChange={(o) => !o && setConfirmDel(null)}
        title="Eliminar capa"
        description={`La capa "${confirmDel?.name ?? ''}" y todo lo que contiene se eliminaran del lienzo.`}
        confirmLabel="Eliminar"
        onConfirm={() => {
          if (confirmDel) onDelete(confirmDel.id)
          setConfirmDel(null)
        }}
      />
    </div>
  )
}

export function CanvasLayersPanel({
  open, onOpenChange, isMobile, onAddLayer, layers, activeLayerId, selectionCount = 0, ...body
}) {
  const activeName = layers.find((l) => l.id === activeLayerId)?.name ?? 'Capa 1'

  const header = (
    <div className="shrink-0 border-b border-(--glass-border-subtle)">
      <div className="flex items-center justify-between h-10 pl-3 pr-1.5">
        <div className="flex items-baseline gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Capas
          </span>
          <span className="text-[10px] text-muted-foreground/60">{layers.length}</span>
        </div>
        <button
          type="button"
          onClick={onAddLayer}
          aria-label="Nueva capa"
          title="Nueva capa"
          className="flex items-center justify-center w-7 h-7 rounded-md text-amber-600 hover:bg-amber-500/10 transition-colors"
        >
          <Plus size={15} />
        </button>
      </div>
      {selectionCount > 0 ? (
        <div className="px-3 pb-2 -mt-0.5 text-[11px] text-amber-700 dark:text-amber-300">
          {selectionCount} elemento{selectionCount === 1 ? '' : 's'} seleccionado
          {selectionCount === 1 ? '' : 's'} · toca «Mover» en una capa
        </div>
      ) : (
        <div className="px-3 pb-2 -mt-0.5 text-[11px] text-muted-foreground/70 truncate">
          Dibujando en <span className="text-foreground/80 font-medium">{activeName}</span>
        </div>
      )}
    </div>
  )

  const bodyEl = (
    <LayersBody
      layers={layers}
      activeLayerId={activeLayerId}
      selectionCount={selectionCount}
      revealAll={isMobile}
      {...body}
    />
  )

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="max-h-[75vh] p-0 gap-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Capas</SheetTitle>
          </SheetHeader>
          {header}
          {bodyEl}
        </SheetContent>
      </Sheet>
    )
  }

  if (!open) return null
  return (
    <div className="absolute top-3 right-3 bottom-3 w-64 z-20 rounded-2xl glass-strong overflow-hidden flex flex-col">
      {header}
      {bodyEl}
    </div>
  )
}
