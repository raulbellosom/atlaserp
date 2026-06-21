import { useRef, useCallback } from 'react'

const ELEMENT_COLORS = {
  TABLE_SQUARE: { base: 'bg-amber-50 border-amber-400', selected: 'bg-primary/10 border-primary' },
  TABLE_ROUND:  { base: 'bg-amber-50 border-amber-400', selected: 'bg-primary/10 border-primary' },
  BAR:   { base: 'bg-slate-200 border-slate-500', selected: 'bg-slate-300 border-primary' },
  WALL:  { base: 'bg-slate-700 border-slate-900 text-white', selected: 'bg-slate-800 border-primary' },
  PLANT: { base: 'bg-green-100 border-green-500', selected: 'bg-green-200 border-primary' },
  DOOR:  { base: 'bg-yellow-50 border-yellow-400', selected: 'bg-yellow-100 border-primary' },
}

function CanvasElement({ el, isSelected, onPointerDown, onResizePointerDown }) {
  const colors = ELEMENT_COLORS[el.kind] ?? ELEMENT_COLORS.TABLE_SQUARE
  const colorClass = isSelected ? colors.selected : colors.base
  const isTable = el.kind === 'TABLE_SQUARE' || el.kind === 'TABLE_ROUND'
  const isRound = el.kind === 'TABLE_ROUND'

  return (
    <div
      className={[
        'absolute border-2 flex flex-col items-center justify-center overflow-hidden select-none',
        colorClass,
        isRound ? 'rounded-full' : 'rounded-md',
        isSelected ? 'shadow-md ring-2 ring-primary ring-offset-1' : '',
      ].join(' ')}
      style={{
        left: el.x,
        top: el.y,
        width: el.width,
        height: el.height,
        zIndex: isSelected ? 10 : 1,
        cursor: 'grab',
      }}
      onPointerDown={(e) => onPointerDown(e, el)}
      onClick={(e) => e.stopPropagation()}
    >
      {isTable ? (
        <>
          {el.tableName && (
            <span className="font-bold text-xs leading-tight text-center px-1 truncate w-full text-center">
              {el.tableName}
            </span>
          )}
          {el.capacity != null && (
            <span className="text-muted-foreground leading-tight text-center" style={{ fontSize: '10px' }}>
              {el.capacity}
            </span>
          )}
        </>
      ) : (
        el.label && (
          <span className="leading-tight text-center px-1 truncate w-full text-center" style={{ fontSize: '10px' }}>
            {el.label}
          </span>
        )
      )}

      {isSelected && (
        <div
          className="absolute bottom-0 right-0 w-3 h-3 bg-primary rounded-tl cursor-se-resize"
          onPointerDown={(e) => onResizePointerDown(e, el)}
          onClick={(e) => e.stopPropagation()}
        />
      )}
    </div>
  )
}

export default function FloorCanvas({
  floor,
  elements,
  selectedId,
  activeTool,
  onSelect,
  onMove,
  onResize,
  onPlace,
}) {
  const containerRef = useRef(null)
  const dragging = useRef(null)

  const canvasWidth = floor?.canvasWidth ?? 1200
  const canvasHeight = floor?.canvasHeight ?? 800

  function handleCanvasClick(e) {
    if (e.target !== containerRef.current && e.target.dataset.canvas !== 'true') return
    if (activeTool !== 'SELECT') {
      const rect = containerRef.current.getBoundingClientRect()
      const scrollEl = containerRef.current.parentElement
      const x = e.clientX - rect.left + (scrollEl?.scrollLeft ?? 0)
      const y = e.clientY - rect.top + (scrollEl?.scrollTop ?? 0)
      onPlace(activeTool, x, y)
    } else {
      onSelect(null)
    }
  }

  function handleElementPointerDown(e, element) {
    e.stopPropagation()
    onSelect(element.id)
    dragging.current = {
      mode: 'move',
      id: element.id,
      startX: e.clientX,
      startY: e.clientY,
      origX: element.x,
      origY: element.y,
    }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function handleResizePointerDown(e, element) {
    e.stopPropagation()
    dragging.current = {
      mode: 'resize',
      id: element.id,
      startX: e.clientX,
      startY: e.clientY,
      origW: element.width,
      origH: element.height,
    }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const handlePointerMove = useCallback((e) => {
    if (!dragging.current) return
    const dx = e.clientX - dragging.current.startX
    const dy = e.clientY - dragging.current.startY
    if (dragging.current.mode === 'move') {
      onMove(dragging.current.id, dragging.current.origX + dx, dragging.current.origY + dy)
    } else {
      onResize(
        dragging.current.id,
        Math.max(40, dragging.current.origW + dx),
        Math.max(40, dragging.current.origH + dy),
      )
    }
  }, [onMove, onResize])

  function handlePointerUp() {
    dragging.current = null
  }

  return (
    <div
      className="flex-1 overflow-auto bg-slate-100 select-none"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <div
        ref={containerRef}
        className="relative bg-white border border-border shadow-sm m-4"
        style={{
          width: canvasWidth,
          height: canvasHeight,
          cursor: activeTool !== 'SELECT' ? 'crosshair' : 'default',
        }}
        data-canvas="true"
        onClick={handleCanvasClick}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          data-canvas="true"
          style={{
            backgroundImage: 'radial-gradient(circle, #d1d5db 1px, transparent 1px)',
            backgroundSize: '20px 20px',
          }}
        />

        {(elements ?? []).map((el) => (
          <CanvasElement
            key={el.id}
            el={el}
            isSelected={el.id === selectedId}
            onPointerDown={handleElementPointerDown}
            onResizePointerDown={handleResizePointerDown}
          />
        ))}
      </div>
    </div>
  )
}
