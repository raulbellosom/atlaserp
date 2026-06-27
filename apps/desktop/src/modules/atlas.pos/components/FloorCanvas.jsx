import { useRef, useState, useEffect, useLayoutEffect } from 'react'
import { TableSvg } from './FloorCanvasHelpers.jsx'
import { DecorVisual, PolygonVisual, DrawingPreview } from './FloorCanvasDecor.jsx'
import { PolygonDrawingOverlay, ContextMenuOverlay } from './FloorCanvasOverlays.jsx'
import { CanvasRulerH, CanvasRulerV, CursorCrosshair } from './FloorCanvasRulers.jsx'

const MIN_DRAW_SIZE = 16 // px — below this, treat as single click

// ─── Canvas element ────────────────────────────────────────────────────────

function CanvasElement({ el, arrIndex, isSelected, onPointerDown, onResizePointerDown, onContextMenu, onVertexPointerDown, onAddVertex, onDeleteVertex }) {
  const isTable = el.kind === 'TABLE_SQUARE' || el.kind === 'TABLE_ROUND'
  const isRound = el.kind === 'TABLE_ROUND'
  const isZone = el.kind === 'FLOOR_ZONE'
  const isPolygon = el.kind === 'POLYGON'
  const pts = el.points ?? []

  return (
    <div
      className="absolute select-none"
      style={{
        left: el.x, top: el.y, width: el.width, height: el.height,
        zIndex: isSelected ? 100 : (isZone || isPolygon) ? 0 : arrIndex + 1,
        cursor: 'grab', overflow: 'visible',
      }}
      onPointerDown={(e) => onPointerDown(e, el)}
      onContextMenu={(e) => onContextMenu(e, el)}
      onClick={(e) => e.stopPropagation()}
    >
      {isTable
        ? <TableSvg width={el.width} height={el.height} isRound={isRound} capacity={el.capacity}
            tableName={el.tableName} chairStyle={el.chairStyle} isSelected={isSelected} />
        : isPolygon
          ? <PolygonVisual el={el} isSelected={isSelected} />
          : <DecorVisual el={el} isSelected={isSelected} />
      }

      {/* Polygon vertex editing handles (only when selected) */}
      {isPolygon && isSelected && pts.length > 0 && (
        <>
          {/* Edge midpoint handles — click to insert a new vertex */}
          {pts.map((p, i) => {
            const next = pts[(i + 1) % pts.length]
            const mx = (p.x + next.x) / 2
            const my = (p.y + next.y) / 2
            return (
              <div
                key={`mid-${i}`}
                title="Clic para agregar vértice aquí"
                style={{
                  position: 'absolute',
                  left: mx - el.x, top: my - el.y,
                  width: 10, height: 10,
                  marginLeft: -5, marginTop: -5,
                  borderRadius: '50%',
                  background: '#6366f1',
                  border: '1.5px solid white',
                  cursor: 'copy',
                  zIndex: 25,
                  opacity: 0.45,
                  touchAction: 'none',
                }}
                onPointerDown={(e) => {
                  e.stopPropagation()
                  onAddVertex(el.id, i, { x: Math.round(mx), y: Math.round(my) })
                }}
                onClick={(e) => e.stopPropagation()}
              />
            )
          })}

          {/* Vertex handles — drag to move, right-click to delete */}
          {pts.map((p, i) => (
            <div
              key={`v-${i}`}
              title={pts.length > 3 ? 'Arrastrar para mover · Clic derecho para eliminar' : 'Arrastrar para mover'}
              style={{
                position: 'absolute',
                left: p.x - el.x, top: p.y - el.y,
                width: 16, height: 16,
                marginLeft: -8, marginTop: -8,
                borderRadius: '50%',
                background: '#6366f1',
                border: '2.5px solid white',
                cursor: 'move',
                zIndex: 30,
                boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
                touchAction: 'none',
              }}
              onPointerDown={(e) => { e.stopPropagation(); onVertexPointerDown(e, el, i) }}
              onContextMenu={(e) => {
                e.preventDefault(); e.stopPropagation()
                if (pts.length > 3) onDeleteVertex(el.id, i)
              }}
              onClick={(e) => e.stopPropagation()}
            />
          ))}
        </>
      )}

      {/* Resize handle — not for POLYGON (vertices define its shape) */}
      {isSelected && !isPolygon && (
        <div
          className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-primary rounded-tl-md cursor-se-resize z-20 flex items-center justify-center"
          onPointerDown={(e) => { e.stopPropagation(); onResizePointerDown(e, el) }}
          onClick={(e) => e.stopPropagation()}
        >
          <svg width="6" height="6" viewBox="0 0 6 6" className="text-primary-foreground">
            <path d="M1 5L5 1M3 5L5 3" stroke="currentColor" strokeWidth={1.2} strokeLinecap="round" />
          </svg>
        </div>
      )}
    </div>
  )
}

// ─── Main canvas ───────────────────────────────────────────────────────────

export default function FloorCanvas({
  floor, elements, selectedId, activeTool, hasClipboard, zoom = 1, showGrid = true, showRulers = true,
  onSelect, onMove, onResize, onPlace, onVertexMove, onAddVertex, onDeleteVertex, onContextAction, onZoomChange,
}) {
  const containerRef       = useRef(null)
  const scrollContainerRef = useRef(null)
  const dragging           = useRef(null)
  const longPressTimer     = useRef(null)
  const longPressOrigin    = useRef(null)
  const drawingRef         = useRef(null)
  const polygonPointsRef   = useRef([])
  const lastVertexTimeRef  = useRef(0)
  const lastPinchDistRef   = useRef(null)
  const lastPinchAnchorRef = useRef(null) // { canvasX, canvasY }
  const panRef             = useRef(null) // { startX, startY, scrollLeft, scrollTop }
  const spacePressedRef    = useRef(false)
  const zoomRef            = useRef(zoom)
  const pendingScrollRef   = useRef(null)

  const [drawingPreview, setDrawingPreview] = useState(null)
  const [contextMenu, setContextMenu]       = useState(null)
  const [polygonPoints, setPolygonPoints]   = useState([])
  const [polygonCursor, setPolygonCursor]   = useState(null)
  const [cursorPos, setCursorPos]           = useState(null)
  const [isPanning, setIsPanning]           = useState(false)

  const canvasWidth  = Math.max(floor?.canvasWidth  ?? 2000, 2000)
  const canvasHeight = Math.max(floor?.canvasHeight ?? 1400, 1400)

  useEffect(() => { polygonPointsRef.current = polygonPoints }, [polygonPoints])
  useEffect(() => { zoomRef.current = zoom }, [zoom])

  // Non-passive wheel: zoom toward cursor position
  useEffect(() => {
    const el = scrollContainerRef.current
    if (!el || !onZoomChange) return
    function onWheel(e) {
      if (!e.ctrlKey) return
      e.preventDefault()
      const container = scrollContainerRef.current
      if (!container) return
      const rect     = container.getBoundingClientRect()
      const cursorX  = e.clientX - rect.left
      const cursorY  = e.clientY - rect.top
      const oldZoom  = zoomRef.current
      const delta    = e.deltaY < 0 ? 0.1 : -0.1
      const newZoom  = Math.max(0.25, Math.min(3, Math.round((oldZoom + delta) * 100) / 100))
      if (newZoom === oldZoom) return
      const cx = (cursorX - 12 + container.scrollLeft) / oldZoom
      const cy = (cursorY - 12 + container.scrollTop)  / oldZoom
      pendingScrollRef.current = { left: cx * newZoom + 12 - cursorX, top: cy * newZoom + 12 - cursorY }
      onZoomChange(delta)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [onZoomChange])

  // After zoom re-renders, apply the cursor-anchored scroll position
  useLayoutEffect(() => {
    const pending = pendingScrollRef.current
    if (!pending) return
    pendingScrollRef.current = null
    const container = scrollContainerRef.current
    if (container) {
      container.scrollLeft = Math.max(0, pending.left)
      container.scrollTop  = Math.max(0, pending.top)
    }
  }, [zoom])

  // Space key → pan cursor; released → restore
  useEffect(() => {
    function onKeyDown(e) {
      if (e.code !== 'Space' || e.repeat) return
      if (e.target.closest('input, textarea, [contenteditable]')) return
      e.preventDefault()
      spacePressedRef.current = true
      setIsPanning(true)
    }
    function onKeyUp(e) {
      if (e.code !== 'Space') return
      spacePressedRef.current = false
      panRef.current = null
      setIsPanning(false)
    }
    window.addEventListener('keydown', onKeyDown, { capture: true })
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown, { capture: true })
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  useEffect(() => {
    if (activeTool !== 'POLYGON') {
      setPolygonPoints([])
      setPolygonCursor(null)
    }
  }, [activeTool])

  useEffect(() => {
    if (activeTool !== 'POLYGON') return
    function onKey(e) {
      if (e.key === 'Enter') {
        e.preventDefault()
        const pts = polygonPointsRef.current
        if (pts.length >= 3) {
          const xs = pts.map((p) => p.x)
          const ys = pts.map((p) => p.y)
          onPlace('POLYGON', Math.min(...xs), Math.min(...ys),
            Math.max(20, Math.max(...xs) - Math.min(...xs)),
            Math.max(20, Math.max(...ys) - Math.min(...ys)),
            { points: pts },
          )
          setPolygonPoints([])
          setPolygonCursor(null)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [activeTool, onPlace])

  function getCanvasCoords(clientX, clientY) {
    if (!containerRef.current) return { x: 0, y: 0 }
    const rect = containerRef.current.getBoundingClientRect()
    return {
      x: (clientX - rect.left) / zoom,
      y: (clientY - rect.top) / zoom,
    }
  }

  function closePolygon(pts) {
    const points = pts ?? polygonPointsRef.current
    if (points.length < 3) { setPolygonPoints([]); setPolygonCursor(null); return }
    const xs = points.map((p) => p.x)
    const ys = points.map((p) => p.y)
    const minX = Math.min(...xs)
    const minY = Math.min(...ys)
    onPlace(
      'POLYGON', minX, minY,
      Math.max(20, Math.max(...xs) - minX),
      Math.max(20, Math.max(...ys) - minY),
      { points },
    )
    setPolygonPoints([])
    setPolygonCursor(null)
  }

  function addPolygonVertex(x, y) {
    const now = Date.now()
    if (now - lastVertexTimeRef.current < 280) return
    lastVertexTimeRef.current = now

    const current = polygonPointsRef.current
    if (current.length >= 3) {
      const first = current[0]
      if (Math.hypot(x - first.x, y - first.y) < 16) {
        closePolygon(current)
        return
      }
    }
    setPolygonPoints((prev) => [...prev, { x, y }])
  }

  function handleCanvasPointerDown(e) {
    if (e.target !== containerRef.current && e.target.dataset.canvas !== 'true') return
    if (contextMenu) { setContextMenu(null); return }

    if (activeTool === 'POLYGON') {
      e.preventDefault()
      const { x, y } = getCanvasCoords(e.clientX, e.clientY)
      addPolygonVertex(x, y)
      return
    }

    if (activeTool === 'SELECT') { onSelect(null); return }
    e.preventDefault()
    const { x, y } = getCanvasCoords(e.clientX, e.clientY)
    drawingRef.current = { kind: activeTool, startX: x, startY: y, currentX: x, currentY: y }
    setDrawingPreview({ kind: activeTool, x, y, width: 0, height: 0 })
  }

  function handleCanvasDblClick(e) {
    if (activeTool !== 'POLYGON') return
    e.preventDefault()
    const pts = polygonPointsRef.current
    const trimmed = pts.length > 3 ? pts.slice(0, -1) : pts
    if (trimmed.length >= 3) closePolygon(trimmed)
  }

  function handleCanvasContextMenu(e) {
    if (e.target === containerRef.current || e.target.dataset.canvas === 'true') {
      e.preventDefault()
      setContextMenu({ clientX: e.clientX, clientY: e.clientY, elementId: null })
    }
  }

  function handleElementPointerDown(e, element) {
    if (contextMenu) { setContextMenu(null); return }

    if (activeTool === 'POLYGON') {
      e.stopPropagation()
      const { x, y } = getCanvasCoords(e.clientX, e.clientY)
      addPolygonVertex(x, y)
      return
    }

    e.stopPropagation()
    onSelect(element.id)
    dragging.current = {
      mode: 'move', id: element.id,
      startX: e.clientX, startY: e.clientY,
      origX: element.x, origY: element.y,
    }
    e.currentTarget.setPointerCapture(e.pointerId)

    if (e.pointerType === 'touch') {
      longPressOrigin.current = { x: e.clientX, y: e.clientY }
      longPressTimer.current = setTimeout(() => {
        if (longPressOrigin.current) {
          dragging.current = null
          setContextMenu({ clientX: e.clientX, clientY: e.clientY, elementId: element.id })
          longPressOrigin.current = null
        }
      }, 550)
    }
  }

  function handleElementContextMenu(e, element) {
    e.preventDefault(); e.stopPropagation()
    onSelect(element.id)
    setContextMenu({ clientX: e.clientX, clientY: e.clientY, elementId: element.id })
  }

  function handleResizePointerDown(e, element) {
    dragging.current = {
      mode: 'resize', id: element.id,
      startX: e.clientX, startY: e.clientY,
      origW: element.width, origH: element.height,
    }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function handleVertexPointerDown(e, element, vertexIndex) {
    dragging.current = {
      mode: 'vertex', id: element.id, vertexIndex,
      startX: e.clientX, startY: e.clientY,
      origPoints: element.points,
    }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function handlePointerMove(e) {
    if (panRef.current) {
      const container = scrollContainerRef.current
      if (container) {
        container.scrollLeft = panRef.current.scrollLeft - (e.clientX - panRef.current.startX)
        container.scrollTop  = panRef.current.scrollTop  - (e.clientY - panRef.current.startY)
      }
      return
    }

    const coords = getCanvasCoords(e.clientX, e.clientY)
    if (coords.x >= 0 && coords.x <= canvasWidth && coords.y >= 0 && coords.y <= canvasHeight) {
      setCursorPos(coords)
    } else {
      setCursorPos(null)
    }

    if (longPressOrigin.current) {
      const dx = e.clientX - longPressOrigin.current.x
      const dy = e.clientY - longPressOrigin.current.y
      if (Math.sqrt(dx*dx + dy*dy) > 8) {
        clearTimeout(longPressTimer.current)
        longPressOrigin.current = null
      }
    }

    if (activeTool === 'POLYGON') {
      const { x, y } = getCanvasCoords(e.clientX, e.clientY)
      setPolygonCursor({ x, y })
      return
    }

    if (drawingRef.current) {
      const { x, y } = getCanvasCoords(e.clientX, e.clientY)
      drawingRef.current.currentX = x
      drawingRef.current.currentY = y
      const { startX, startY, kind } = drawingRef.current
      setDrawingPreview({
        kind,
        x: Math.max(0, Math.min(startX, x)),
        y: Math.max(0, Math.min(startY, y)),
        width:  Math.abs(x - startX),
        height: Math.abs(y - startY),
      })
      return
    }

    if (!dragging.current) return
    const dx = e.clientX - dragging.current.startX
    const dy = e.clientY - dragging.current.startY
    if (dragging.current.mode === 'vertex') {
      const newPoints = dragging.current.origPoints.map((p, i) =>
        i === dragging.current.vertexIndex ? { x: p.x + dx, y: p.y + dy } : p,
      )
      const xs = newPoints.map((p) => p.x)
      const ys = newPoints.map((p) => p.y)
      onVertexMove(dragging.current.id, newPoints, {
        x: Math.max(0, Math.min(...xs)),
        y: Math.max(0, Math.min(...ys)),
        width:  Math.max(10, Math.max(...xs) - Math.min(...xs)),
        height: Math.max(10, Math.max(...ys) - Math.min(...ys)),
      })
    } else if (dragging.current.mode === 'move') {
      onMove(dragging.current.id, dragging.current.origX + dx, dragging.current.origY + dy)
    } else {
      onResize(dragging.current.id, Math.max(20, dragging.current.origW + dx), Math.max(20, dragging.current.origH + dy))
    }
  }

  function handlePointerUp() {
    clearTimeout(longPressTimer.current)
    longPressOrigin.current = null
    panRef.current = null
    dragging.current = null

    if (drawingRef.current) {
      const { kind, startX, startY, currentX, currentY } = drawingRef.current
      drawingRef.current = null
      setDrawingPreview(null)

      const w = Math.abs(currentX - startX)
      const h = Math.abs(currentY - startY)
      if (w >= MIN_DRAW_SIZE || h >= MIN_DRAW_SIZE) {
        const x = Math.min(startX, currentX)
        const y = Math.min(startY, currentY)
        onPlace(kind, x, y, Math.max(20, w), Math.max(20, h))
      } else {
        onPlace(kind, startX, startY)
      }
    }
  }

  function handleScrollContainerPointerDown(e) {
    const container = scrollContainerRef.current
    if (!container) return
    const isMiddle = e.button === 1
    const isSpaceDrag = e.button === 0 && spacePressedRef.current
    if (!isMiddle && !isSpaceDrag) return
    e.preventDefault()
    panRef.current = { startX: e.clientX, startY: e.clientY, scrollLeft: container.scrollLeft, scrollTop: container.scrollTop }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function handleTouchStart(e) {
    if (e.touches.length === 2) {
      const [t1, t2] = e.touches
      lastPinchDistRef.current = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY)

      const container = scrollContainerRef.current
      if (container) {
        const rect = container.getBoundingClientRect()
        const cx = (t1.clientX + t2.clientX) / 2 - rect.left
        const cy = (t1.clientY + t2.clientY) / 2 - rect.top
        lastPinchAnchorRef.current = {
          canvasX: (cx - 12 + container.scrollLeft) / zoomRef.current,
          canvasY: (cy - 12 + container.scrollTop)  / zoomRef.current,
        }
      }

      dragging.current = null
      drawingRef.current = null
      setDrawingPreview(null)
    }
  }

  function handleTouchMove(e) {
    if (e.touches.length !== 2) return
    const [t1, t2] = e.touches
    const container = scrollContainerRef.current
    if (!container || !lastPinchAnchorRef.current) return

    const newDist    = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY)
    const rect       = container.getBoundingClientRect()
    const newCenterX = (t1.clientX + t2.clientX) / 2 - rect.left
    const newCenterY = (t1.clientY + t2.clientY) / 2 - rect.top
    const { canvasX, canvasY } = lastPinchAnchorRef.current
    const cz = zoomRef.current

    container.scrollLeft = canvasX * cz + 12 - newCenterX
    container.scrollTop  = canvasY * cz + 12 - newCenterY

    if (lastPinchDistRef.current !== null && onZoomChange) {
      const delta = (newDist - lastPinchDistRef.current) / 280
      if (Math.abs(delta) > 0.004) {
        const newZoom = Math.max(0.25, Math.min(3, Math.round((cz + delta) * 100) / 100))
        if (newZoom !== cz) {
          pendingScrollRef.current = {
            left: canvasX * newZoom + 12 - newCenterX,
            top:  canvasY * newZoom + 12 - newCenterY,
          }
          onZoomChange(delta)
        }
        lastPinchDistRef.current = newDist
      }
    }
  }

  function handleTouchEnd(e) {
    if (e.touches.length < 2) {
      lastPinchDistRef.current   = null
      lastPinchAnchorRef.current = null
    }
  }

  return (
    <div
      ref={scrollContainerRef}
      className="flex-1 overflow-auto bg-muted/40 select-none"
      onPointerDown={handleScrollContainerPointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={(e) => { handlePointerUp(e); setCursorPos(null) }}
      onContextMenu={handleCanvasContextMenu}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ touchAction: 'none', cursor: isPanning ? 'grab' : undefined }}
    >
      {/* Zoom wrapper — sets scroll area to scaled canvas dimensions */}
      <div style={{ width: canvasWidth * zoom + 24, height: canvasHeight * zoom + 24, flexShrink: 0 }}>
        <div
          ref={containerRef}
          className="relative bg-card border border-border shadow-md rounded-sm"
          style={{
            width: canvasWidth, height: canvasHeight,
            marginLeft: 12, marginTop: 12,
            transform: zoom !== 1 ? `scale(${zoom})` : undefined,
            transformOrigin: '0 0',
            cursor: activeTool === 'POLYGON'
              ? 'crosshair'
              : activeTool !== 'SELECT' ? 'crosshair' : 'default',
          }}
          data-canvas="true"
          onPointerDown={handleCanvasPointerDown}
          onDoubleClick={handleCanvasDblClick}
        >
          {/* Dot grid */}
          {showGrid && (
            <div
              className="absolute inset-0 pointer-events-none rounded-sm text-foreground/[0.07]"
              data-canvas="true"
              style={{ backgroundImage: 'radial-gradient(circle, currentColor 1.5px, transparent 1.5px)', backgroundSize: '24px 24px' }}
            />
          )}
          {/* Room border accent */}
          <div className="absolute inset-2 border border-dashed border-border/40 pointer-events-none rounded-sm" data-canvas="true" />

          {/* Rulers + live cursor crosshair */}
          {showRulers && <CanvasRulerH canvasWidth={canvasWidth} zoom={zoom} cursorX={cursorPos?.x ?? null} />}
          {showRulers && <CanvasRulerV canvasHeight={canvasHeight} zoom={zoom} cursorY={cursorPos?.y ?? null} />}
          {showRulers && <CursorCrosshair pos={cursorPos} canvasWidth={canvasWidth} canvasHeight={canvasHeight} zoom={zoom} />}

          {(elements ?? []).map((el, arrIndex) => (
            <CanvasElement
              key={el.id} el={el} arrIndex={arrIndex}
              isSelected={el.id === selectedId}
              onPointerDown={handleElementPointerDown}
              onResizePointerDown={handleResizePointerDown}
              onContextMenu={handleElementContextMenu}
              onVertexPointerDown={handleVertexPointerDown}
              onAddVertex={onAddVertex}
              onDeleteVertex={onDeleteVertex}
            />
          ))}

          {/* Draw-to-place ghost */}
          {drawingPreview && <DrawingPreview preview={drawingPreview} />}

          {/* Polygon drawing overlay */}
          {activeTool === 'POLYGON' && (
            <PolygonDrawingOverlay
              points={polygonPoints}
              cursor={polygonCursor}
              canvasWidth={canvasWidth}
              canvasHeight={canvasHeight}
            />
          )}
        </div>
      </div>

      {contextMenu && (
        <ContextMenuOverlay
          menu={contextMenu} hasClipboard={hasClipboard}
          onAction={onContextAction} onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  )
}
