import { useState } from 'react'
import { Eye, EyeOff, Lock, LockOpen, GripVertical, Plus, MoreVertical } from 'lucide-react'
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
  TextField,
  ConfirmDialog,
} from '@atlas/ui'

// One layer row. `dragHandleProps` comes from SortableList (dnd-kit) and works
// for mouse and touch.
function LayerRow({
  layer,
  isActive,
  count,
  dragHandleProps,
  onSelect,
  onRename,
  onToggleVisible,
  onToggleLocked,
  onOpacity,
  onDuplicate,
  onMergeDown,
  onRequestDelete,
  canMergeDown,
  canDelete,
}) {
  return (
    <div
      className={[
        'flex items-center gap-2 px-2 py-2 border-b border-border min-h-[44px] cursor-pointer',
        isActive ? 'bg-amber-50 dark:bg-amber-950/30' : 'hover:bg-muted',
      ].join(' ')}
      onClick={() => onSelect(layer.id)}
    >
      <button
        type="button"
        className="shrink-0 p-1 text-muted-foreground cursor-grab active:cursor-grabbing touch-none"
        aria-label="Reordenar capa"
        {...dragHandleProps}
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical size={14} />
      </button>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onToggleVisible(layer.id) }}
        className="shrink-0 p-1"
        aria-label={layer.visible ? 'Ocultar capa' : 'Mostrar capa'}
      >
        {layer.visible ? <Eye size={15} /> : <EyeOff size={15} className="text-muted-foreground" />}
      </button>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onToggleLocked(layer.id) }}
        className="shrink-0 p-1"
        aria-label={layer.locked ? 'Desbloquear capa' : 'Bloquear capa'}
      >
        {layer.locked ? <Lock size={15} /> : <LockOpen size={15} className="text-muted-foreground" />}
      </button>
      <div className="flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
        <TextField
          value={layer.name}
          onChange={(e) => onRename(layer.id, e.target.value)}
          className="text-xs"
        />
        <div className="text-[10px] text-muted-foreground mt-0.5">
          {count} elemento{count === 1 ? '' : 's'}
        </div>
      </div>
      <input
        type="range"
        min="0"
        max="100"
        value={Math.round((layer.opacity ?? 1) * 100)}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => onOpacity(layer.id, Number(e.target.value) / 100)}
        className="w-16 shrink-0 accent-amber-500"
        aria-label="Opacidad de la capa"
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="shrink-0 p-1"
            onClick={(e) => e.stopPropagation()}
            aria-label="Acciones de capa"
          >
            <MoreVertical size={15} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => onDuplicate(layer.id)}>Duplicar</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onMergeDown(layer.id)} disabled={!canMergeDown}>
            Combinar hacia abajo
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onRequestDelete(layer)} disabled={!canDelete}>
            Eliminar
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
  onSelect,
  onRename,
  onToggleVisible,
  onToggleLocked,
  onOpacity,
  onReorderList,
  onDuplicate,
  onMergeDown,
  onDelete,
}) {
  const [confirmDel, setConfirmDel] = useState(null)
  // Panel shows the topmost layer (highest order) first.
  const topFirst = [...layers].sort((a, b) => b.order - a.order)

  return (
    <div className="flex flex-col">
      <SortableList
        items={topFirst}
        onReorder={(reordered) => onReorderList(reordered)}
        renderItem={(layer, { dragHandleProps }) => {
          const idxFromTop = topFirst.findIndex((l) => l.id === layer.id)
          return (
            <LayerRow
              layer={layer}
              isActive={layer.id === activeLayerId}
              count={elementCounts?.[layer.id] ?? 0}
              dragHandleProps={dragHandleProps}
              onSelect={onSelect}
              onRename={onRename}
              onToggleVisible={onToggleVisible}
              onToggleLocked={onToggleLocked}
              onOpacity={onOpacity}
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
        description={`La capa "${confirmDel?.name ?? ''}" y sus elementos se eliminaran del lienzo.`}
        confirmLabel="Eliminar"
        onConfirm={() => {
          if (confirmDel) onDelete(confirmDel.id)
          setConfirmDel(null)
        }}
      />
    </div>
  )
}

export function CanvasLayersPanel({ open, onOpenChange, isMobile, onAddLayer, ...body }) {
  const header = (
    <div className="flex items-center justify-between px-3 h-11 border-b border-border">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Capas</span>
      <button
        type="button"
        onClick={onAddLayer}
        className="flex items-center gap-1 text-xs font-medium text-amber-600 hover:text-amber-700"
      >
        <Plus size={13} /> Nueva capa
      </button>
    </div>
  )

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="max-h-[70vh] overflow-y-auto p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Capas</SheetTitle>
          </SheetHeader>
          {header}
          <LayersBody {...body} />
        </SheetContent>
      </Sheet>
    )
  }

  if (!open) return null
  return (
    <div className="w-72 shrink-0 border-l border-border flex flex-col bg-background overflow-y-auto">
      {header}
      <LayersBody {...body} />
    </div>
  )
}
