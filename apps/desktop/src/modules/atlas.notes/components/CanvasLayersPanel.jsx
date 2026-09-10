import { useState } from 'react'
import {
  DndContext, PointerSensor, KeyboardSensor, closestCenter, useSensor, useSensors, useDraggable,
} from '@dnd-kit/core'
import { SortableContext, useSortable, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Eye, EyeOff, Lock, LockOpen, GripVertical, Plus, MoreVertical,
  ChevronRight, ChevronDown, Trash2, Square, Circle, Diamond, ArrowRight,
  Minus, Pencil, Type, Image as ImageIcon, Frame,
} from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  ConfirmDialog,
} from '@atlas/ui'
import { LAYER_PALETTE, elementLabel } from '../lib/canvasLayers.js'

const TYPE_ICON = {
  rectangle: Square,
  ellipse: Circle,
  diamond: Diamond,
  arrow: ArrowRight,
  line: Minus,
  freedraw: Pencil,
  text: Type,
  image: ImageIcon,
  frame: Frame,
}

function ColorSwatch({ color, onPick }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="shrink-0 w-3.5 h-3.5 rounded-full ring-1 ring-black/15 dark:ring-white/20"
          style={{ backgroundColor: color }}
          aria-label="Color de la capa"
          title="Color de la capa"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="grid grid-cols-5 gap-1 p-2">
        {LAYER_PALETTE.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onPick(c)}
            className="w-5 h-5 rounded-full ring-1 ring-black/10 dark:ring-white/15 hover:scale-110 transition-transform"
            style={{ backgroundColor: c }}
            aria-label={c}
          />
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function ChildRow({ el, layerColor, onSelectElement, onToggleElementHidden, onToggleElementLocked, onDeleteElement }) {
  const Icon = TYPE_ICON[el.type] ?? Square
  const hidden = Boolean(el.customData?.hidden)
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `child:${el.id}` })

  return (
    <div
      className={[
        'group/child flex items-center gap-1 h-9 pl-6 pr-1.5 rounded-md cursor-pointer',
        isDragging ? 'opacity-40' : 'hover:bg-black/4 dark:hover:bg-white/5',
      ].join(' ')}
      onClick={() => onSelectElement(el.id)}
    >
      <span
        ref={setNodeRef}
        {...listeners}
        {...attributes}
        onClick={(e) => e.stopPropagation()}
        className="shrink-0 flex items-center justify-center w-5 h-7 text-muted-foreground/40 cursor-grab active:cursor-grabbing touch-none"
        aria-label="Arrastrar a otra capa"
        title="Arrastra a otra capa"
      >
        <GripVertical size={12} />
      </span>
      <span className="shrink-0 w-1 h-4 rounded-full" style={{ backgroundColor: layerColor }} />
      <Icon size={13} className="shrink-0 text-muted-foreground/70" />
      <span className={['flex-1 min-w-0 text-[11px] truncate', hidden ? 'text-muted-foreground/40 line-through' : 'text-foreground/70'].join(' ')}>
        {elementLabel(el)}
      </span>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onToggleElementHidden(el.id) }}
        className="shrink-0 flex items-center justify-center w-6 h-7 rounded hover:bg-black/6 dark:hover:bg-white/8"
        aria-label={hidden ? 'Mostrar' : 'Ocultar'}
      >
        {hidden ? <EyeOff size={13} className="text-muted-foreground/50" /> : <Eye size={13} />}
      </button>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onToggleElementLocked(el.id) }}
        className="shrink-0 flex items-center justify-center w-6 h-7 rounded hover:bg-black/6 dark:hover:bg-white/8"
        aria-label={el.locked ? 'Desbloquear' : 'Bloquear'}
      >
        {el.locked ? <Lock size={12} className="text-amber-500" /> : <LockOpen size={12} className="text-muted-foreground/40" />}
      </button>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onDeleteElement(el.id) }}
        className="shrink-0 flex items-center justify-center w-6 h-7 rounded text-muted-foreground/50 hover:text-red-500 hover:bg-red-500/10"
        aria-label="Eliminar"
      >
        <Trash2 size={12} />
      </button>
    </div>
  )
}

function LayerRow({
  layer,
  isActive,
  revealAll,
  expanded,
  childElements,
  onToggleExpand,
  sortable,
  onSelect,
  onRename,
  onSetColor,
  onToggleVisible,
  onToggleLocked,
  onOpacity,
  onDuplicate,
  onMergeDown,
  onRequestDelete,
  canMergeDown,
  canDelete,
  childHandlers,
}) {
  const hoverReveal = revealAll ? '' : 'opacity-0 group-hover:opacity-100 transition-opacity'
  const childCount = childElements.length
  const { setNodeRef, transform, transition, isOver, isDragging } = sortable

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={[
        isOver ? 'rounded-lg ring-2 ring-amber-400/70' : '',
        isDragging ? 'opacity-50' : '',
      ].join(' ')}
    >
      <div
        className={[
          'group relative flex items-center gap-0.5 pr-1.5 rounded-lg cursor-pointer transition-colors',
          revealAll ? 'h-12' : 'h-11',
          isActive ? 'glass-tinted' : 'hover:bg-black/4 dark:hover:bg-white/5',
        ].join(' ')}
        onClick={() => onSelect(layer.id)}
      >
        <span
          className="absolute left-0 top-1.5 bottom-1.5 w-0.75 rounded-full"
          style={{ backgroundColor: layer.color }}
        />

        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggleExpand(layer.id) }}
          className="shrink-0 flex items-center justify-center w-8 h-9 rounded-md text-muted-foreground/70 hover:bg-black/6 dark:hover:bg-white/8"
          aria-label={expanded ? 'Contraer capa' : 'Expandir capa'}
        >
          {expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        </button>

        <span
          className={['shrink-0 flex items-center justify-center w-3.5 h-8 text-muted-foreground/50 cursor-grab active:cursor-grabbing touch-none', hoverReveal].join(' ')}
          aria-label="Reordenar capa"
          {...sortable.attributes}
          {...sortable.listeners}
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical size={13} />
        </span>

        <ColorSwatch color={layer.color} onPick={(c) => onSetColor(layer.id, c)} />

        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggleVisible(layer.id) }}
          className="shrink-0 flex items-center justify-center w-7 h-8 rounded-md hover:bg-black/6 dark:hover:bg-white/8"
          aria-label={layer.visible ? 'Ocultar capa' : 'Mostrar capa'}
        >
          {layer.visible ? <Eye size={15} /> : <EyeOff size={15} className="text-muted-foreground/60" />}
        </button>

        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggleLocked(layer.id) }}
          className="shrink-0 flex items-center justify-center w-7 h-8 rounded-md hover:bg-black/6 dark:hover:bg-white/8"
          aria-label={layer.locked ? 'Desbloquear capa' : 'Bloquear capa'}
        >
          {layer.locked ? <Lock size={14} className="text-amber-500" /> : <LockOpen size={14} className="text-muted-foreground/50" />}
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

        {childCount > 0 && (
          <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground/50 w-4 text-right">{childCount}</span>
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
              className="shrink-0 flex items-center justify-center w-7 h-8 rounded-md text-muted-foreground/70 hover:bg-black/6 dark:hover:bg-white/8 data-[state=open]:bg-black/6 dark:data-[state=open]:bg-white/8"
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
              Eliminar capa
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {expanded && (
        <div className="mt-0.5 mb-1 flex flex-col gap-px">
          {childCount === 0 ? (
            <div className="pl-8 py-1.5 text-[11px] text-muted-foreground/40">Capa vacia</div>
          ) : (
            childElements.map((el) => (
              <ChildRow key={el.id} el={el} layerColor={layer.color} {...childHandlers} />
            ))
          )}
        </div>
      )}
    </div>
  )
}

function SortableLayerRow({ layer, ...rest }) {
  const sortable = useSortable({ id: `layer:${layer.id}` })
  return <LayerRow layer={layer} sortable={sortable} {...rest} />
}

function LayersBody({
  layers,
  activeLayerId,
  layerElements = {},
  revealAll,
  expanded,
  onToggleExpand,
  onSelect,
  onRename,
  onSetColor,
  onToggleVisible,
  onToggleLocked,
  onOpacity,
  onReorderList,
  onMoveElementToLayer,
  onDuplicate,
  onMergeDown,
  onDelete,
  childHandlers,
}) {
  const [confirmDel, setConfirmDel] = useState(null)
  const topFirst = [...layers].sort((a, b) => b.order - a.order)
  // Long-press to start a drag: on touch a `distance` constraint fights the
  // scroll container and the drag never activates. `delay` + `tolerance` lets a
  // tap/scroll pass through and a hold begin the drag (standard mobile pattern).
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  )

  function handleDragEnd({ active, over }) {
    if (!over || active.id === over.id) return
    const a = String(active.id)
    const o = String(over.id)
    if (a.startsWith('child:') && o.startsWith('layer:')) {
      onMoveElementToLayer(a.slice('child:'.length), o.slice('layer:'.length))
      return
    }
    if (a.startsWith('layer:') && o.startsWith('layer:')) {
      const from = topFirst.findIndex((l) => `layer:${l.id}` === a)
      const to = topFirst.findIndex((l) => `layer:${l.id}` === o)
      if (from !== -1 && to !== -1) onReorderList(arrayMove(topFirst, from, to))
    }
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-0.5 px-1.5 pb-2 overflow-y-auto">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={topFirst.map((l) => `layer:${l.id}`)} strategy={verticalListSortingStrategy}>
          {topFirst.map((layer, idxFromTop) => (
            <SortableLayerRow
              key={layer.id}
              layer={layer}
              isActive={layer.id === activeLayerId}
              revealAll={revealAll}
              expanded={expanded.has(layer.id)}
              childElements={layerElements[layer.id] ?? []}
              onToggleExpand={onToggleExpand}
              onSelect={onSelect}
              onRename={onRename}
              onSetColor={onSetColor}
              onToggleVisible={onToggleVisible}
              onToggleLocked={onToggleLocked}
              onOpacity={onOpacity}
              onDuplicate={onDuplicate}
              onMergeDown={onMergeDown}
              onRequestDelete={(l) =>
                (layerElements[l.id]?.length ?? 0) > 0 ? setConfirmDel(l) : onDelete(l.id)
              }
              canMergeDown={idxFromTop < topFirst.length - 1}
              canDelete={layers.length > 1}
              childHandlers={childHandlers}
            />
          ))}
        </SortableContext>
      </DndContext>
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
  open, onOpenChange, isMobile, onAddLayer, layers, activeLayerId,
  selectionCount = 0, onMoveSelectionHere, ...body
}) {
  const [expanded, setExpanded] = useState(() => new Set())
  const toggleExpand = (id) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const activeName = layers.find((l) => l.id === activeLayerId)?.name ?? 'Capa 1'
  const topFirst = [...layers].sort((a, b) => b.order - a.order)

  const header = (
    <div className="shrink-0 border-b border-(--glass-border-subtle)">
      <div className="flex items-center gap-2 h-11 pl-3 pr-12">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Capas</span>
        <span className="text-[10px] text-muted-foreground/60">{layers.length}</span>
        <button
          type="button"
          onClick={onAddLayer}
          className="ml-auto flex items-center gap-1 h-7 px-2 rounded-md text-[11px] font-medium text-amber-600 hover:bg-amber-500/10 transition-colors"
        >
          <Plus size={13} /> Nueva capa
        </button>
      </div>
      {selectionCount > 0 ? (
        <div className="flex items-center gap-2 px-3 pb-2">
          <span className="text-[11px] text-muted-foreground/80">
            {selectionCount} seleccionado{selectionCount === 1 ? '' : 's'}
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-1 h-7 px-2 rounded-md text-[11px] font-medium text-amber-700 dark:text-amber-300 bg-amber-500/15 hover:bg-amber-500/25"
              >
                Mover a una capa <ChevronDown size={12} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel>Mover la seleccion a</DropdownMenuLabel>
              {topFirst.map((l) => (
                <DropdownMenuItem key={l.id} onSelect={() => onMoveSelectionHere(l.id)}>
                  <span className="w-2.5 h-2.5 rounded-full mr-2 shrink-0" style={{ backgroundColor: l.color }} />
                  {l.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : (
        <div className="px-3 pb-2 text-[11px] text-muted-foreground/70 truncate">
          Dibujando en <span className="text-foreground/80 font-medium">{activeName}</span>
        </div>
      )}
    </div>
  )

  const bodyEl = (
    <LayersBody
      layers={layers}
      activeLayerId={activeLayerId}
      revealAll={isMobile}
      expanded={expanded}
      onToggleExpand={toggleExpand}
      {...body}
    />
  )

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="h-[85vh] p-0 gap-0 pt-3">
          <SheetHeader className="sr-only">
            <SheetTitle>Capas</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col h-full min-h-0">
            {header}
            {bodyEl}
          </div>
        </SheetContent>
      </Sheet>
    )
  }

  if (!open) return null
  return (
    <div className="absolute top-3 right-3 bottom-3 w-72 z-20 rounded-2xl glass-strong overflow-hidden flex flex-col">
      {header}
      {bodyEl}
    </div>
  )
}
