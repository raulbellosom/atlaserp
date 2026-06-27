// Read-only floor canvas for waiter order-taking.
// Tables are clickable with live status overlays; all other elements are decorative.
// Supports pinch-zoom, two-finger pan, and Ctrl+scroll zoom toward cursor.

import { useRef, useState, useEffect, useLayoutEffect, useMemo } from 'react'
import { Minus, Plus, RotateCcw } from 'lucide-react'
import { CHAIR_PAD, squareChairPositions, roundChairPositions } from './FloorCanvasHelpers.jsx'
import { POLYGON_ZONE_COLORS } from './FloorCanvasDecor.jsx'

const TABLE_STATUS_STYLE = {
  AVAILABLE:      { ring: '#22c55e', fill: 'rgba(34,197,94,0.14)',   label: 'Disponible',   dot: '#22c55e' },
  OCCUPIED:       { ring: '#f59e0b', fill: 'rgba(245,158,11,0.2)',   label: 'Ocupada',      dot: '#f59e0b' },
  BILL_REQUESTED: { ring: '#f97316', fill: 'rgba(249,115,22,0.2)',   label: 'Cuenta',       dot: '#f97316' },
  DIRTY:          { ring: '#94a3b8', fill: 'rgba(148,163,184,0.14)', label: 'Sucia',        dot: '#94a3b8' },
  RESERVED:       { ring: '#3b82f6', fill: 'rgba(59,130,246,0.18)',  label: 'Reservada',    dot: '#3b82f6' },
  DISABLED:       { ring: '#d1d5db', fill: 'rgba(209,213,219,0.1)',  label: 'No disponible',dot: '#d1d5db' },
}

const DEFAULT_STATUS = TABLE_STATUS_STYLE.AVAILABLE


// ─── Operational table element ────────────────────────────────────────────────

function OperationalTable({ el, table, onClick }) {
  const status = table?.status ?? 'AVAILABLE'
  const style = TABLE_STATUS_STYLE[status] ?? DEFAULT_STATUS
  const isDisabled = status === 'DISABLED'
  const isRound = el.kind === 'TABLE_ROUND'

  const tableName = table?.name ?? el.label ?? ''
  const capacity = table?.capacity ?? el.style?.capacity ?? 0
  const chairStyle = el.style?.chairStyle ?? 'auto'

  const svgW = el.width + CHAIR_PAD * 2
  const svgH = el.height + CHAIR_PAD * 2
  const ox = CHAIR_PAD
  const oy = CHAIR_PAD
  const tableR = Math.min(el.width, el.height) / 2
  const chairs = isRound
    ? roundChairPositions(el.width, el.height, capacity)
    : squareChairPositions(el.width, el.height, capacity, chairStyle)

  const displayName = tableName.length > 9 ? tableName.slice(0, 8) + '…' : tableName

  return (
    <div
      className="absolute select-none"
      style={{
        left: el.x, top: el.y,
        width: el.width, height: el.height,
        zIndex: 10,
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        overflow: 'visible',
        opacity: isDisabled ? 0.45 : 1,
      }}
      onClick={() => !isDisabled && onClick(table ?? { id: el.tableId, name: tableName, capacity, status: 'AVAILABLE' })}
    >
      <svg
        width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`}
        style={{ position: 'absolute', left: -CHAIR_PAD, top: -CHAIR_PAD, overflow: 'visible', pointerEvents: 'none' }}
      >
        {chairs.map((c, i) =>
          c.r ? (
            <circle key={i} cx={c.cx} cy={c.cy} r={c.r}
              fill={style.fill} stroke={style.ring} strokeWidth={1.5} opacity={0.8} />
          ) : (
            <rect key={i} x={c.x} y={c.y} width={c.w} height={c.h} rx={c.rx ?? 3}
              fill={style.fill} stroke={style.ring} strokeWidth={1.5} opacity={0.8} />
          )
        )}
        {isRound ? (
          <circle cx={ox + el.width / 2} cy={oy + el.height / 2} r={tableR - 2}
            fill={style.fill} stroke={style.ring} strokeWidth={2.5} />
        ) : (
          <rect x={ox + 1} y={oy + 1} width={el.width - 2} height={el.height - 2} rx={8}
            fill={style.fill} stroke={style.ring} strokeWidth={2.5} />
        )}
        {displayName && (
          <text x={ox + el.width / 2} y={oy + el.height / 2 + (capacity ? -6 : 1)}
            textAnchor="middle" dominantBaseline="middle"
            fontSize={Math.min(12, el.width / 6)} fontWeight="700" fontFamily="inherit"
            fill={style.ring}
          >{displayName}</text>
        )}
        <text x={ox + el.width / 2} y={oy + el.height / 2 + (displayName ? 8 : 1)}
          textAnchor="middle" dominantBaseline="middle"
          fontSize={8} fontFamily="inherit" fill={style.ring} opacity={0.85}
        >{style.label}</text>
        <circle cx={ox + el.width - 6} cy={oy + 6} r={4}
          fill={style.dot} stroke="white" strokeWidth={1.2} />
      </svg>
    </div>
  )
}

const ZONE_COLORS = {
  neutral: 'border-slate-400/60  dark:border-slate-500/60  bg-slate-100/30  dark:bg-slate-800/20  text-slate-600  dark:text-slate-400',
  dining:  'border-blue-400/60   dark:border-blue-600/60   bg-blue-50/30    dark:bg-blue-900/20   text-blue-600   dark:text-blue-400',
  outdoor: 'border-green-400/60  dark:border-green-600/60  bg-green-50/30   dark:bg-green-900/20  text-green-600  dark:text-green-400',
  bar:     'border-amber-400/60  dark:border-amber-600/60  bg-amber-50/30   dark:bg-amber-900/20  text-amber-600  dark:text-amber-400',
  vip:     'border-purple-400/60 dark:border-purple-600/60 bg-purple-50/30  dark:bg-purple-900/20 text-purple-600 dark:text-purple-400',
  private: 'border-rose-400/60   dark:border-rose-600/60   bg-rose-50/30    dark:bg-rose-900/20   text-rose-600   dark:text-rose-400',
}

// ─── Decorative element (non-interactive) ─────────────────────────────────────

function DecorElement({ el }) {
  const { kind } = el
  const color = el.style?.color ?? 'neutral'

  if (kind === 'POLYGON') {
    const points = el.style?.points ?? []
    if (!points.length) return <div className="w-full h-full rounded border-2 border-dashed border-border bg-muted/20" />
    const ex = Number(el.x)
    const ey = Number(el.y)
    const ew = Number(el.width)
    const eh = Number(el.height)
    const pts = points.map((p) => `${Number(p.x) - ex},${Number(p.y) - ey}`).join(' ')
    const zc = POLYGON_ZONE_COLORS[color] ?? POLYGON_ZONE_COLORS.neutral
    return (
      <div className="absolute inset-0" style={{ overflow: 'visible' }}>
        <svg width={ew} height={eh} style={{ overflow: 'visible', position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }}>
          <polygon points={pts} fill={zc.fill} stroke={zc.stroke} strokeWidth={1.5} strokeDasharray="6 3" />
          {el.label && (
            <text x={ew / 2} y={eh / 2} textAnchor="middle" dominantBaseline="middle"
              fontSize={11} fontWeight={600} fontFamily="inherit" fill={zc.stroke} opacity={0.8}
            >{el.label}</text>
          )}
        </svg>
      </div>
    )
  }
  if (kind === 'FLOOR_ZONE') {
    const zc = ZONE_COLORS[color] ?? ZONE_COLORS.neutral
    return (
      <div className={['w-full h-full rounded border-2 border-dashed flex items-start justify-start p-2', zc].join(' ')}>
        <span className="text-xs font-semibold opacity-80 leading-tight pointer-events-none select-none">{el.label || 'Zona'}</span>
      </div>
    )
  }
  if (kind === 'WALL') {
    return (
      <div className="w-full h-full rounded-sm flex items-center justify-center bg-zinc-400 dark:bg-zinc-500 border-2 border-zinc-500 dark:border-zinc-400 opacity-80">
        {el.label && <span className="text-white text-xs font-medium truncate px-1">{el.label}</span>}
      </div>
    )
  }
  if (kind === 'BAR') {
    return (
      <div className="w-full h-full rounded-lg flex items-center justify-center bg-stone-200 dark:bg-stone-700 border border-stone-400 dark:border-stone-500 opacity-80">
        <span className="text-stone-700 dark:text-stone-200 text-xs font-semibold uppercase tracking-wide">{el.label || 'Barra'}</span>
      </div>
    )
  }
  if (kind === 'PLANT') {
    return (
      <div className="w-full h-full rounded-full flex items-center justify-center bg-green-100 dark:bg-green-900/50 border-2 border-green-500 opacity-70">
        <svg viewBox="0 0 24 24" fill="none" className="w-1/2 h-1/2 text-green-600 dark:text-green-400">
          <path d="M12 22V12M12 12C12 12 7 9 7 4a5 5 0 0 1 10 0c0 5-5 8-5 8Z" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
        </svg>
      </div>
    )
  }
  if (kind === 'DOOR') {
    return (
      <div className="w-full h-full rounded-sm relative overflow-hidden bg-sky-50 dark:bg-sky-900/30 border-2 border-sky-400 dark:border-sky-600 opacity-60">
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 60 24" preserveAspectRatio="none">
          <rect x="1" y="1" width="14" height="22" rx="1" className="fill-sky-200 dark:fill-sky-800 stroke-sky-400 dark:stroke-sky-600" strokeWidth="1.5" />
          <path d="M 15 23 A 14 14 0 0 0 29 9" className="stroke-sky-400 dark:stroke-sky-600" fill="none" strokeWidth="1" strokeDasharray="2 1" />
        </svg>
      </div>
    )
  }
  if (kind === 'PILLAR') {
    return (
      <div className="w-full h-full rounded-full flex items-center justify-center bg-zinc-300 dark:bg-zinc-600 border-4 border-zinc-500 dark:border-zinc-400 opacity-70">
        <div className="w-1/3 h-1/3 rounded-full bg-zinc-400 dark:bg-zinc-500" />
      </div>
    )
  }
  if (kind === 'SOFA') {
    return (
      <div className="w-full h-full rounded-xl relative overflow-hidden bg-violet-100 dark:bg-violet-900/40 border-2 border-violet-400 dark:border-violet-600">
        <div className="absolute top-0 left-0 right-0 h-1/3 bg-violet-200 dark:bg-violet-800/60 border-b border-violet-300 dark:border-violet-700 rounded-t-xl" />
        {el.label && <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-violet-700 dark:text-violet-300 pointer-events-none">{el.label}</span>}
      </div>
    )
  }
  if (kind === 'WINDOW') {
    const panes = Math.max(2, Math.floor(Number(el.width) / 25))
    return (
      <div className="w-full h-full relative overflow-hidden bg-sky-100 dark:bg-sky-900/30 border-2 border-sky-300 dark:border-sky-600">
        <div className="absolute inset-0 flex">
          {Array.from({ length: panes }).map((_, i) => (
            <div key={i} className="flex-1 border-r last:border-r-0 border-sky-300 dark:border-sky-600" />
          ))}
        </div>
        <div className="absolute top-0.5 left-1 w-1/4 h-0.5 bg-white/60 rounded" />
      </div>
    )
  }
  if (kind === 'STAIRS') {
    const steps = Math.max(3, Math.floor(Number(el.height) / 18))
    const ew = Number(el.width)
    const eh = Number(el.height)
    return (
      <div className="w-full h-full relative overflow-hidden bg-slate-200 dark:bg-slate-700 border-2 border-slate-400 dark:border-slate-500">
        <svg className="absolute inset-0 w-full h-full" viewBox={`0 0 ${ew} ${eh}`} preserveAspectRatio="none">
          {Array.from({ length: steps }).map((_, i) => {
            const y = (i / steps) * eh
            const x = (i / steps) * ew
            return (
              <g key={i}>
                <line x1={x} y1={y} x2={ew} y2={y} className="stroke-slate-400 dark:stroke-slate-500" strokeWidth="1.5" />
                <line x1={x} y1={y} x2={x} y2={eh} className="stroke-slate-400 dark:stroke-slate-500" strokeWidth="1.5" />
              </g>
            )
          })}
        </svg>
        {el.label && <span className="absolute top-1 left-1 text-[9px] text-slate-600 dark:text-slate-300 font-medium pointer-events-none">{el.label}</span>}
      </div>
    )
  }
  return (
    <div className="w-full h-full rounded border border-border/40 bg-muted/20">
      {el.label && <span className="text-[9px] text-muted-foreground p-1">{el.label}</span>}
    </div>
  )
}

// ─── Main operational canvas ──────────────────────────────────────────────────

export default function FloorOperationalCanvas({ floor, elements = [], tableStates = {}, onTableClick }) {
  const scrollRef        = useRef(null)
  const zoomRef          = useRef(1)
  const pendingScrollRef = useRef(null)
  const lastPinchDistRef   = useRef(null)
  const lastPinchAnchorRef = useRef(null)
  const [zoom, setZoom] = useState(1)

  // Match the planner's minimum canvas size so the layout looks identical
  const canvasWidth  = Math.max(floor?.canvasWidth  ?? 2000, 2000)
  const canvasHeight = Math.max(floor?.canvasHeight ?? 1400, 1400)

  // Prisma Decimal columns serialize as strings over JSON — normalize to numbers
  const normalizedElements = useMemo(
    () => elements.map((el) => ({
      ...el,
      x: parseFloat(el.x),
      y: parseFloat(el.y),
      width: parseFloat(el.width),
      height: parseFloat(el.height),
    })),
    [elements],
  )

  const tableElements = normalizedElements.filter((el) => el.kind === 'TABLE_SQUARE' || el.kind === 'TABLE_ROUND')
  const decorElements = normalizedElements.filter((el) => el.kind !== 'TABLE_SQUARE' && el.kind !== 'TABLE_ROUND')

  useEffect(() => { zoomRef.current = zoom }, [zoom])

  // Ctrl+scroll: zoom toward cursor
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    function onWheel(e) {
      if (!e.ctrlKey) return
      e.preventDefault()
      const rect    = el.getBoundingClientRect()
      const cursorX = e.clientX - rect.left
      const cursorY = e.clientY - rect.top
      const oldZoom = zoomRef.current
      const delta   = e.deltaY < 0 ? 0.15 : -0.15
      const newZoom = Math.max(0.3, Math.min(3, Math.round((oldZoom + delta) * 100) / 100))
      if (newZoom === oldZoom) return
      const cx = (cursorX - 12 + el.scrollLeft) / oldZoom
      const cy = (cursorY - 12 + el.scrollTop)  / oldZoom
      pendingScrollRef.current = { left: cx * newZoom + 12 - cursorX, top: cy * newZoom + 12 - cursorY }
      setZoom(newZoom)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // Apply cursor-anchored scroll after zoom re-renders
  useLayoutEffect(() => {
    const pending = pendingScrollRef.current
    if (!pending) return
    pendingScrollRef.current = null
    const el = scrollRef.current
    if (el) {
      el.scrollLeft = Math.max(0, pending.left)
      el.scrollTop  = Math.max(0, pending.top)
    }
  }, [zoom])

  // Touch: two-finger pan + pinch-zoom toward pinch center
  function handleTouchStart(e) {
    if (e.touches.length === 2) {
      const [t1, t2] = e.touches
      lastPinchDistRef.current = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY)
      const el = scrollRef.current
      if (el) {
        const rect = el.getBoundingClientRect()
        const cx = (t1.clientX + t2.clientX) / 2 - rect.left
        const cy = (t1.clientY + t2.clientY) / 2 - rect.top
        lastPinchAnchorRef.current = {
          canvasX: (cx - 12 + el.scrollLeft) / zoomRef.current,
          canvasY: (cy - 12 + el.scrollTop)  / zoomRef.current,
        }
      }
    }
  }

  function handleTouchMove(e) {
    if (e.touches.length !== 2) return
    const [t1, t2] = e.touches
    const el = scrollRef.current
    if (!el || !lastPinchAnchorRef.current) return
    const newDist    = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY)
    const rect       = el.getBoundingClientRect()
    const newCenterX = (t1.clientX + t2.clientX) / 2 - rect.left
    const newCenterY = (t1.clientY + t2.clientY) / 2 - rect.top
    const { canvasX, canvasY } = lastPinchAnchorRef.current
    const cz = zoomRef.current
    // Pan: keep anchor canvas point at current finger center
    el.scrollLeft = canvasX * cz + 12 - newCenterX
    el.scrollTop  = canvasY * cz + 12 - newCenterY
    // Zoom
    if (lastPinchDistRef.current !== null) {
      const delta = (newDist - lastPinchDistRef.current) / 280
      if (Math.abs(delta) > 0.004) {
        const newZoom = Math.max(0.3, Math.min(3, Math.round((cz + delta) * 100) / 100))
        if (newZoom !== cz) {
          pendingScrollRef.current = { left: canvasX * newZoom + 12 - newCenterX, top: canvasY * newZoom + 12 - newCenterY }
          setZoom(newZoom)
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

  const pct = Math.round(zoom * 100)

  return (
    <div className="relative flex-1 h-full overflow-hidden">
      {/* Scrollable canvas area */}
      <div
        ref={scrollRef}
        className="absolute inset-0 overflow-auto bg-muted/40 select-none"
        style={{ touchAction: 'pan-x pan-y' }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Zoom wrapper */}
        <div style={{ width: canvasWidth * zoom + 24, height: canvasHeight * zoom + 24, flexShrink: 0 }}>
          <div
            className="relative bg-card border border-border shadow-md rounded-sm"
            style={{
              width: canvasWidth, height: canvasHeight,
              marginLeft: 12, marginTop: 12,
              transform: zoom !== 1 ? `scale(${zoom})` : undefined,
              transformOrigin: '0 0',
            }}
          >
            {/* Dot grid */}
            <div
              className="absolute inset-0 pointer-events-none rounded-sm text-foreground/6"
              style={{ backgroundImage: 'radial-gradient(circle, currentColor 1.5px, transparent 1.5px)', backgroundSize: '24px 24px' }}
            />
            <div className="absolute inset-2 border border-dashed border-border/30 pointer-events-none rounded-sm" />

            {/* Decor elements (bottom layer) */}
            {decorElements.map((el, i) => (
              <div
                key={el.id ?? i}
                className="absolute"
                style={{ left: el.x, top: el.y, width: el.width, height: el.height, zIndex: el.kind === 'FLOOR_ZONE' ? 0 : i + 1 }}
              >
                <DecorElement el={el} />
              </div>
            ))}

            {/* Table elements (top layer, interactive) */}
            {tableElements.map((el) => (
              <OperationalTable
                key={el.id}
                el={el}
                table={el.tableId ? tableStates[el.tableId] : null}
                onClick={onTableClick}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Floating zoom control — bottom right */}
      <div className="absolute bottom-4 right-4 flex items-center gap-1 rounded-xl bg-card/90 border border-border shadow-lg backdrop-blur-sm px-1 py-1 z-10">
        <button
          type="button"
          onClick={() => setZoom((z) => Math.max(0.3, Math.round((z - 0.15) * 100) / 100))}
          className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors active:scale-95"
          title="Alejar"
        >
          <Minus size={16} />
        </button>
        <button
          type="button"
          onClick={() => setZoom(1)}
          className="min-w-13 h-9 px-2 text-xs font-mono font-medium text-foreground hover:bg-muted rounded-lg transition-colors active:scale-95"
          title="Restablecer zoom"
        >
          {pct}%
        </button>
        <button
          type="button"
          onClick={() => setZoom((z) => Math.min(3, Math.round((z + 0.15) * 100) / 100))}
          className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors active:scale-95"
          title="Acercar"
        >
          <Plus size={16} />
        </button>
      </div>
    </div>
  )
}
