// Read-only floor canvas for waiter order-taking.
// Tables are clickable with live status overlays; all other elements are decorative.
// Supports pinch-zoom, two-finger pan, and Ctrl+scroll zoom toward cursor.

import { useRef, useState, useEffect, useLayoutEffect, useMemo, useCallback } from 'react'
import { Minus, Plus, Maximize2 } from 'lucide-react'
import { CHAIR_PAD, squareChairPositions, roundChairPositions } from './FloorCanvasHelpers.jsx'
import { POLYGON_ZONE_COLORS } from './FloorCanvasDecor.jsx'

const TABLE_STATUS_STYLE = {
  AVAILABLE:      { ring: '#16a34a', fill: 'rgba(220,252,231,0.97)', ringWidth: 2,   label: 'Disponible',   dot: '#22c55e', textColor: '#14532d' },
  OCCUPIED:       { ring: '#d97706', fill: 'rgba(254,243,199,0.97)', ringWidth: 2.5, label: 'Ocupada',      dot: '#f59e0b', textColor: '#78350f' },
  BILL_REQUESTED: { ring: '#ea580c', fill: 'rgba(255,237,213,0.97)', ringWidth: 3,   label: 'Cuenta',       dot: '#f97316', textColor: '#7c2d12' },
  DIRTY:          { ring: '#64748b', fill: 'rgba(241,245,249,0.97)', ringWidth: 1.5, label: 'Sucia',        dot: '#94a3b8', textColor: '#334155' },
  RESERVED:       { ring: '#2563eb', fill: 'rgba(219,234,254,0.97)', ringWidth: 2,   label: 'Reservada',    dot: '#3b82f6', textColor: '#1e3a8a' },
  DISABLED:       { ring: '#cbd5e1', fill: 'rgba(248,250,252,0.80)', ringWidth: 1,   label: 'No disponible',dot: '#cbd5e1', textColor: '#94a3b8' },
}

const DEFAULT_STATUS = TABLE_STATUS_STYLE.AVAILABLE


// ─── Operational table element ────────────────────────────────────────────────

function OperationalTable({ el, table, onClick }) {
  const status = table?.status ?? 'AVAILABLE'
  const s = TABLE_STATUS_STYLE[status] ?? DEFAULT_STATUS
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
  const nameFontSize = Math.min(13, Math.max(9, el.width / 6))
  const showStatusLabel = el.height > 52
  const nameY = oy + el.height / 2 + (showStatusLabel && displayName ? -(nameFontSize * 0.55) : 0)

  return (
    <div
      className="absolute select-none"
      style={{
        left: el.x, top: el.y,
        width: el.width, height: el.height,
        zIndex: 10,
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        overflow: 'visible',
        opacity: isDisabled ? 0.4 : 1,
        filter: isDisabled ? undefined : 'drop-shadow(0 2px 6px rgba(0,0,0,0.13))',
        transition: 'filter 150ms',
      }}
      onClick={() => !isDisabled && onClick(table ?? { id: el.tableId, name: tableName, capacity, status: 'AVAILABLE' })}
    >
      <svg
        width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`}
        style={{ position: 'absolute', left: -CHAIR_PAD, top: -CHAIR_PAD, overflow: 'visible', pointerEvents: 'none' }}
      >
        {/* Chairs — white fill, status-colored stroke */}
        {chairs.map((c, i) =>
          c.r ? (
            <circle key={i} cx={c.cx} cy={c.cy} r={c.r}
              fill="rgba(255,255,255,0.85)" stroke={s.ring} strokeWidth={1.5} />
          ) : (
            <rect key={i} x={c.x} y={c.y} width={c.w} height={c.h} rx={c.rx ?? 3}
              fill="rgba(255,255,255,0.85)" stroke={s.ring} strokeWidth={1.5} />
          )
        )}

        {/* Table surface */}
        {isRound ? (
          <circle cx={ox + el.width / 2} cy={oy + el.height / 2} r={tableR - 1.5}
            fill={s.fill} stroke={s.ring} strokeWidth={s.ringWidth} />
        ) : (
          <rect x={ox + 1} y={oy + 1} width={el.width - 2} height={el.height - 2} rx={9}
            fill={s.fill} stroke={s.ring} strokeWidth={s.ringWidth} />
        )}

        {/* Table name */}
        {displayName && (
          <text x={ox + el.width / 2} y={nameY}
            textAnchor="middle" dominantBaseline="middle"
            fontSize={nameFontSize} fontWeight="700" fontFamily="inherit"
            fill={s.textColor}
          >{displayName}</text>
        )}

        {/* Status label — only if tall enough */}
        {showStatusLabel && (
          <text
            x={ox + el.width / 2}
            y={oy + el.height / 2 + (displayName ? nameFontSize * 0.75 : 0)}
            textAnchor="middle" dominantBaseline="middle"
            fontSize={Math.max(7.5, nameFontSize * 0.65)} fontFamily="inherit"
            fill={s.ring} opacity={0.9}
          >{s.label}</text>
        )}

        {/* Status dot — top-right */}
        <circle cx={ox + el.width - 8} cy={oy + 8} r={5}
          fill={s.dot} stroke="white" strokeWidth={1.5} />
      </svg>

      {/* Waiter avatar badge — colored with status ring */}
      {table?.waiterName && (
        <div
          title={table.waiterName}
          style={{ background: s.ring }}
          className="absolute -top-2.5 -left-2.5 h-6 w-6 rounded-full text-white text-[9px] font-bold flex items-center justify-center z-20 shadow ring-2 ring-white"
        >
          {table.waiterName.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('')}
        </div>
      )}
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

  // Fit view to all element bounds
  const fitToContent = useCallback(() => {
    if (!normalizedElements.length) return
    const el = scrollRef.current
    if (!el || el.clientWidth === 0) return

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const { x, y, width, height } of normalizedElements) {
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x + width > maxX) maxX = x + width
      if (y + height > maxY) maxY = y + height
    }

    const PAD = 72
    const contentW = maxX - minX + PAD * 2
    const contentH = maxY - minY + PAD * 2
    const fitZoom = Math.round(Math.min(el.clientWidth / contentW, el.clientHeight / contentH, 1) * 100) / 100
    const cx = (minX + maxX) / 2
    const cy = (minY + maxY) / 2

    pendingScrollRef.current = {
      left: Math.max(0, cx * fitZoom + 12 - el.clientWidth / 2),
      top:  Math.max(0, cy * fitZoom + 12 - el.clientHeight / 2),
    }
    setZoom(fitZoom)
  }, [normalizedElements])

  // Auto-fit on first load of each floor
  const autoFitFloorId = useRef(null)
  useEffect(() => {
    if (autoFitFloorId.current === floor?.id) return
    if (!normalizedElements.length) return
    fitToContent()
    autoFitFloorId.current = floor?.id
  }, [normalizedElements, floor?.id, fitToContent])

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
        className="absolute inset-0 overflow-auto select-none"
        style={{ touchAction: 'pan-x pan-y', background: 'hsl(var(--muted)/0.35)' }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Zoom wrapper */}
        <div style={{ width: canvasWidth * zoom + 24, height: canvasHeight * zoom + 24, flexShrink: 0 }}>
          <div
            className="relative bg-card border border-border/60 shadow-lg rounded-md"
            style={{
              width: canvasWidth, height: canvasHeight,
              marginLeft: 12, marginTop: 12,
              transform: zoom !== 1 ? `scale(${zoom})` : undefined,
              transformOrigin: '0 0',
            }}
          >
            {/* Dot grid */}
            <div
              className="absolute inset-0 pointer-events-none rounded-md text-foreground/4"
              style={{ backgroundImage: 'radial-gradient(circle, currentColor 1.5px, transparent 1.5px)', backgroundSize: '28px 28px' }}
            />
            <div className="absolute inset-3 border border-dashed border-border/20 pointer-events-none rounded-sm" />

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
            {tableElements.map((el) => {
              const boundTable = el.tableId ? tableStates[el.tableId] : null
              const isUnbound = Boolean(el.tableId) && !boundTable
              return (
                <div key={el.id} style={isUnbound ? { opacity: 0.25, pointerEvents: 'none' } : undefined}>
                  <OperationalTable el={el} table={boundTable} onClick={onTableClick} />
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Floating zoom control — bottom right */}
      <div className="absolute bottom-4 right-4 flex items-center gap-px rounded-xl bg-card/90 border border-border shadow-lg backdrop-blur-sm px-1 py-1 z-10">
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
          title="Restablecer zoom al 100%"
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
        <div className="w-px h-5 bg-border mx-0.5" />
        <button
          type="button"
          onClick={fitToContent}
          className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors active:scale-95"
          title="Ajustar vista a las mesas"
        >
          <Maximize2 size={14} />
        </button>
      </div>
    </div>
  )
}
