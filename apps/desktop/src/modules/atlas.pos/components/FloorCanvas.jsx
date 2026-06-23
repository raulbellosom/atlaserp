import { useRef, useState, useEffect, useLayoutEffect } from 'react'

const CHAIR_PAD = 18

// ─── Chair helpers ────────────────────────────────────────────────────────

function squareChairPositions(width, height, capacity, style = 'auto') {
  if (style === 'none' || !capacity) return []
  const n = Math.min(capacity, 20)
  // CW: chair size parallel to the table edge; DEPTH: perpendicular (how thick the chair is)
  const CW_H  = Math.min(18, Math.max(8, (width  - 8) / 4)) // for top/bottom chairs
  const CW_V  = Math.min(18, Math.max(8, (height - 8) / 4)) // for left/right chairs
  const DEPTH = 9
  const GAP   = 5
  const ox = CHAIR_PAD
  const oy = CHAIR_PAD

  if (style === 'one_side') {
    const sp = width / (n + 1)
    return Array.from({ length: n }, (_, i) => ({
      x: ox + sp * (i + 1) - CW_H / 2, y: oy + height + GAP, w: CW_H, h: DEPTH, rx: 3,
    }))
  }

  // Distribute counts per side
  let topN = 0, botN = 0, leftN = 0, rightN = 0

  if (style === 'two_sides') {
    // All chairs split between top and bottom only
    topN = Math.ceil(n / 2)
    botN = Math.floor(n / 2)
  } else {
    // 'auto': cycle top → bottom → left → right
    // n=1: 1,0,0,0  n=2: 1,1,0,0  n=3: 1,1,1,0  n=4: 1,1,1,1
    // n=5: 2,1,1,1  n=6: 2,2,1,1  n=7: 2,2,2,1  n=8: 2,2,2,2
    for (let i = 0; i < n; i++) {
      const side = i % 4
      if (side === 0) topN++
      else if (side === 1) botN++
      else if (side === 2) leftN++
      else rightN++
    }
  }

  const chairs = []
  if (topN > 0) {
    const sp = width / (topN + 1)
    for (let i = 0; i < topN; i++)
      chairs.push({ x: ox + sp * (i + 1) - CW_H / 2, y: oy - DEPTH - GAP, w: CW_H, h: DEPTH, rx: 3 })
  }
  if (botN > 0) {
    const sp = width / (botN + 1)
    for (let i = 0; i < botN; i++)
      chairs.push({ x: ox + sp * (i + 1) - CW_H / 2, y: oy + height + GAP, w: CW_H, h: DEPTH, rx: 3 })
  }
  if (leftN > 0) {
    const sp = height / (leftN + 1)
    for (let i = 0; i < leftN; i++)
      chairs.push({ x: ox - DEPTH - GAP, y: oy + sp * (i + 1) - CW_V / 2, w: DEPTH, h: CW_V, rx: 3 })
  }
  if (rightN > 0) {
    const sp = height / (rightN + 1)
    for (let i = 0; i < rightN; i++)
      chairs.push({ x: ox + width + GAP, y: oy + sp * (i + 1) - CW_V / 2, w: DEPTH, h: CW_V, rx: 3 })
  }
  return chairs
}

function roundChairPositions(width, height, capacity, style = 'auto') {
  if (style === 'none' || !capacity) return []
  const n = Math.min(capacity, 12)
  const tableR = Math.min(width, height) / 2
  const cx = CHAIR_PAD + width / 2
  const cy = CHAIR_PAD + height / 2
  const CR = 7
  const dist = tableR + CR + 4

  if (style === 'one_side') {
    return Array.from({ length: n }, (_, i) => {
      const angle = (i / (n - 1 || 1)) * Math.PI * 0.9 + Math.PI * 0.05
      return { cx: cx + Math.cos(angle) * dist, cy: cy + Math.sin(angle) * dist, r: CR }
    })
  }
  if (style === 'two_sides') {
    const half = Math.ceil(n / 2)
    const top = Array.from({ length: half }, (_, i) => {
      const a = -Math.PI + (i / (half - 1 || 1)) * Math.PI
      return { cx: cx + Math.cos(a) * dist, cy: cy + Math.sin(a) * dist, r: CR }
    })
    const bot = Array.from({ length: n - half }, (_, i) => {
      const a = (i / (n - half - 1 || 1)) * Math.PI
      return { cx: cx + Math.cos(a) * dist, cy: cy + Math.sin(a) * dist, r: CR }
    })
    return [...top, ...bot]
  }
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2
    return { cx: cx + Math.cos(a) * dist, cy: cy + Math.sin(a) * dist, r: CR }
  })
}

// ─── Table SVG ────────────────────────────────────────────────────────────

function TableSvg({ width, height, isRound, capacity, tableName, chairStyle, isSelected }) {
  const svgW = width + CHAIR_PAD * 2
  const svgH = height + CHAIR_PAD * 2
  const ox = CHAIR_PAD
  const oy = CHAIR_PAD
  const tableR = Math.min(width, height) / 2
  const chairs = isRound
    ? roundChairPositions(width, height, capacity, chairStyle)
    : squareChairPositions(width, height, capacity, chairStyle)
  const selFill = isSelected ? 'var(--primary)' : undefined
  const displayName = tableName ? (tableName.length > 9 ? tableName.slice(0, 8) + '…' : tableName) : ''

  return (
    <svg
      width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`}
      style={{ position: 'absolute', left: -CHAIR_PAD, top: -CHAIR_PAD, overflow: 'visible', pointerEvents: 'none' }}
    >
      {chairs.map((c, i) =>
        c.r ? (
          <circle key={i} cx={c.cx} cy={c.cy} r={c.r}
            className="fill-amber-200 stroke-amber-400 dark:fill-amber-800 dark:stroke-amber-600"
            fill={isSelected ? selFill : undefined} stroke={isSelected ? selFill : undefined}
            opacity={isSelected ? 0.55 : 1} strokeWidth={1.5} />
        ) : (
          <rect key={i} x={c.x} y={c.y} width={c.w} height={c.h} rx={c.rx ?? 3}
            className="fill-amber-200 stroke-amber-400 dark:fill-amber-800 dark:stroke-amber-600"
            fill={isSelected ? selFill : undefined} stroke={isSelected ? selFill : undefined}
            opacity={isSelected ? 0.55 : 1} strokeWidth={1.5} />
        ),
      )}

      {isRound ? (
        <circle cx={ox + width/2} cy={oy + height/2} r={tableR - 2}
          className="fill-amber-50 stroke-amber-400 dark:fill-amber-950/70 dark:stroke-amber-500"
          stroke={isSelected ? 'var(--primary)' : undefined} strokeWidth={isSelected ? 2.5 : 2} />
      ) : (
        <rect x={ox+1} y={oy+1} width={width-2} height={height-2} rx={8}
          className="fill-amber-50 stroke-amber-400 dark:fill-amber-950/70 dark:stroke-amber-500"
          stroke={isSelected ? 'var(--primary)' : undefined} strokeWidth={isSelected ? 2.5 : 2} />
      )}

      {!isRound && width > 50 && height > 40 && (
        <line x1={ox+10} y1={oy+height/2} x2={ox+width-10} y2={oy+height/2}
          className="stroke-amber-200 dark:stroke-amber-800" strokeWidth={1} strokeLinecap="round" />
      )}

      {displayName && (
        <text x={ox+width/2} y={oy+height/2+(capacity?-5:1)} textAnchor="middle" dominantBaseline="middle"
          fontSize={Math.min(12, width/6)} fontWeight="700" fontFamily="inherit"
          className="fill-amber-900 dark:fill-amber-100">{displayName}</text>
      )}
      {capacity > 0 && (
        <text x={ox+width/2} y={oy+height/2+(displayName?10:1)} textAnchor="middle" dominantBaseline="middle"
          fontSize={9} fontFamily="inherit" className="fill-amber-700 dark:fill-amber-400">{capacity} pax</text>
      )}

      {isSelected && (
        isRound
          ? <circle cx={ox+width/2} cy={oy+height/2} r={tableR+5} fill="none" stroke="var(--primary)" strokeWidth={1.5} strokeDasharray="5 3" />
          : <rect x={ox-5} y={oy-5} width={width+10} height={height+10} rx={11} fill="none" stroke="var(--primary)" strokeWidth={1.5} strokeDasharray="5 3" />
      )}
    </svg>
  )
}

// ─── Decor shapes ──────────────────────────────────────────────────────────

const ZONE_COLORS = {
  neutral: 'border-slate-400/60  dark:border-slate-500/60  bg-slate-100/30  dark:bg-slate-800/20  text-slate-600  dark:text-slate-400',
  dining:  'border-blue-400/60   dark:border-blue-600/60   bg-blue-50/30    dark:bg-blue-900/20   text-blue-600   dark:text-blue-400',
  outdoor: 'border-green-400/60  dark:border-green-600/60  bg-green-50/30   dark:bg-green-900/20  text-green-600  dark:text-green-400',
  bar:     'border-amber-400/60  dark:border-amber-600/60  bg-amber-50/30   dark:bg-amber-900/20  text-amber-600  dark:text-amber-400',
  vip:     'border-purple-400/60 dark:border-purple-600/60 bg-purple-50/30  dark:bg-purple-900/20 text-purple-600 dark:text-purple-400',
  private: 'border-rose-400/60   dark:border-rose-600/60   bg-rose-50/30    dark:bg-rose-900/20   text-rose-600   dark:text-rose-400',
}

function DecorVisual({ el, isSelected }) {
  const sel = isSelected ? 'ring-2 ring-primary ring-offset-1' : ''
  const { kind } = el

  if (kind === 'FLOOR_ZONE') {
    const zc = ZONE_COLORS[el.color] ?? ZONE_COLORS.neutral
    return (
      <div className={['w-full h-full rounded border-2 border-dashed flex items-start justify-start p-2', zc, sel].join(' ')}>
        <span className="text-xs font-semibold opacity-80 leading-tight pointer-events-none select-none">{el.label || 'Zona'}</span>
      </div>
    )
  }
  if (kind === 'WALL') {
    return (
      <div className={['w-full h-full rounded-sm flex items-center justify-center bg-zinc-400 dark:bg-zinc-500 border-2', isSelected ? 'border-primary' : 'border-zinc-500 dark:border-zinc-400', sel].join(' ')}>
        {el.label && <span className="text-white text-xs font-medium truncate px-1">{el.label}</span>}
      </div>
    )
  }
  if (kind === 'BAR') {
    const stoolCount = el.capacity > 0 ? Math.min(el.capacity, Math.floor(el.width / 18)) : 0
    return (
      <div className={['w-full h-full rounded-lg flex items-center justify-center relative overflow-hidden bg-stone-200 dark:bg-stone-700 border-2', isSelected ? 'border-primary' : 'border-stone-400 dark:border-stone-500', sel].join(' ')}>
        {stoolCount > 0 && (
          <div className="absolute bottom-0 left-0 right-0 flex justify-around px-2">
            {Array.from({ length: stoolCount }).map((_, i) => (
              <div key={i} className="h-1.5 w-3 rounded-t-full bg-stone-400 dark:bg-stone-500" />
            ))}
          </div>
        )}
        <span className="text-stone-700 dark:text-stone-200 text-xs font-semibold uppercase tracking-wide">{el.label || 'Barra'}</span>
      </div>
    )
  }
  if (kind === 'PLANT') {
    return (
      <div className={['w-full h-full rounded-full flex items-center justify-center bg-green-100 dark:bg-green-900/50 border-2', isSelected ? 'border-primary' : 'border-green-500 dark:border-green-600', sel].join(' ')}>
        <svg viewBox="0 0 24 24" fill="none" className="w-1/2 h-1/2 text-green-600 dark:text-green-400">
          <path d="M12 22V12M12 12C12 12 7 9 7 4a5 5 0 0 1 10 0c0 5-5 8-5 8Z" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
        </svg>
      </div>
    )
  }
  if (kind === 'DOOR') {
    return (
      <div className={['w-full h-full rounded-sm relative overflow-hidden bg-sky-50 dark:bg-sky-900/30 border-2', isSelected ? 'border-primary' : 'border-sky-400 dark:border-sky-600', sel].join(' ')}>
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 60 24" preserveAspectRatio="none">
          <rect x="1" y="1" width="14" height="22" rx="1" className="fill-sky-200 dark:fill-sky-800 stroke-sky-400 dark:stroke-sky-600" strokeWidth="1.5" />
          <path d="M 15 23 A 14 14 0 0 0 29 9" className="stroke-sky-400 dark:stroke-sky-600" fill="none" strokeWidth="1" strokeDasharray="2 1" />
        </svg>
      </div>
    )
  }
  if (kind === 'PILLAR') {
    return (
      <div className={['w-full h-full rounded-full flex items-center justify-center bg-zinc-300 dark:bg-zinc-600 border-4', isSelected ? 'border-primary' : 'border-zinc-500 dark:border-zinc-400', sel].join(' ')}>
        <div className="w-1/3 h-1/3 rounded-full bg-zinc-400 dark:bg-zinc-500" />
      </div>
    )
  }
  if (kind === 'SOFA') {
    return (
      <div className={['w-full h-full rounded-xl relative overflow-hidden bg-violet-100 dark:bg-violet-900/40 border-2', isSelected ? 'border-primary' : 'border-violet-400 dark:border-violet-600', sel].join(' ')}>
        <div className="absolute top-0 left-0 right-0 h-1/3 bg-violet-200 dark:bg-violet-800/60 border-b border-violet-300 dark:border-violet-700 rounded-t-xl" />
        <div className="absolute bottom-0 left-0 right-0 h-2/3 flex gap-1 px-1 pb-1 pt-0.5">
          {Array.from({ length: Math.max(2, Math.floor(el.width / 50)) }).map((_, i) => (
            <div key={i} className="flex-1 rounded-md bg-violet-200 dark:bg-violet-800/40 border border-violet-300 dark:border-violet-700" />
          ))}
        </div>
        {el.label && <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-violet-700 dark:text-violet-300 pointer-events-none">{el.label}</span>}
      </div>
    )
  }
  if (kind === 'WINDOW') {
    const panes = Math.max(2, Math.floor(el.width / 25))
    return (
      <div className={['w-full h-full relative overflow-hidden bg-sky-100 dark:bg-sky-900/30 border-2', isSelected ? 'border-primary' : 'border-sky-300 dark:border-sky-600', sel].join(' ')}>
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
    const steps = Math.max(3, Math.floor(el.height / 18))
    return (
      <div className={['w-full h-full relative overflow-hidden bg-slate-200 dark:bg-slate-700 border-2', isSelected ? 'border-primary' : 'border-slate-400 dark:border-slate-500', sel].join(' ')}>
        <svg className="absolute inset-0 w-full h-full" viewBox={`0 0 ${el.width} ${el.height}`} preserveAspectRatio="none">
          {Array.from({ length: steps }).map((_, i) => {
            const y = (i / steps) * el.height
            const x = (i / steps) * el.width
            return (
              <g key={i}>
                <line x1={x} y1={y} x2={el.width} y2={y} className="stroke-slate-400 dark:stroke-slate-500" strokeWidth="1.5" />
                <line x1={x} y1={y} x2={x} y2={el.height} className="stroke-slate-400 dark:stroke-slate-500" strokeWidth="1.5" />
              </g>
            )
          })}
        </svg>
        {el.label && <span className="absolute top-1 left-1 text-[9px] text-slate-600 dark:text-slate-300 font-medium pointer-events-none">{el.label}</span>}
      </div>
    )
  }
  return (
    <div className={['w-full h-full rounded-md border-2 flex items-center justify-center bg-muted border-border', sel].join(' ')}>
      <span className="text-xs text-muted-foreground">{el.label}</span>
    </div>
  )
}

// ─── Polygon element visual ────────────────────────────────────────────────

function PolygonVisual({ el, isSelected }) {
  if (!el.points?.length) {
    return <div className="w-full h-full rounded border-2 border-dashed border-border bg-muted/20" />
  }
  const pts = el.points.map((p) => `${p.x - el.x},${p.y - el.y}`).join(' ')
  const zoneColors = POLYGON_ZONE_COLORS[el.color ?? 'neutral'] ?? POLYGON_ZONE_COLORS.neutral
  return (
    <div className="absolute inset-0" style={{ overflow: 'visible' }}>
      <svg
        width={el.width} height={el.height}
        style={{ overflow: 'visible', position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }}
      >
        <polygon
          points={pts}
          fill={zoneColors.fill}
          stroke={isSelected ? 'var(--primary)' : zoneColors.stroke}
          strokeWidth={isSelected ? 2.5 : 1.5}
          strokeDasharray="6 3"
        />
        {el.label && (
          <text x={el.width / 2} y={el.height / 2}
            textAnchor="middle" dominantBaseline="middle"
            fontSize={11} fontWeight={600} fontFamily="inherit"
            className="fill-slate-600 dark:fill-slate-300"
          >{el.label}</text>
        )}
      </svg>
    </div>
  )
}

// ─── Polygon drawing overlay (WIP while user clicks vertices) ─────────────
// Uses explicit SVG px dimensions + top/left positioning (reliable cross-browser)
// Uses hardcoded hex colors — CSS vars in SVG stroke attrs are unreliable

const POLY_COLOR = '#6366f1'  // indigo — matches typical --primary

function PolygonDrawingOverlay({ points, cursor, canvasWidth, canvasHeight }) {
  if (!cursor && points.length === 0) return null

  const nearFirst = cursor && points.length >= 3
    ? Math.hypot(cursor.x - points[0].x, cursor.y - points[0].y) < 16
    : false

  // All placed vertices + cursor (rubber-band endpoint), unless snapping to close
  const strokePts = [...points, ...(cursor && !nearFirst ? [cursor] : [])]
  const strokeStr = strokePts.map((p) => `${p.x},${p.y}`).join(' ')
  const closedStr = points.map((p) => `${p.x},${p.y}`).join(' ')

  const hint = points.length === 0
    ? 'Clic para colocar el primer vértice'
    : points.length < 3
      ? `${points.length} de mín. 3 vértices`
      : nearFirst
        ? 'Clic o Enter para cerrar'
        : `${points.length} vértices · Enter o clic en el primer punto`

  return (
    <>
      <svg
        style={{
          position: 'absolute', top: 0, left: 0,
          zIndex: 200, pointerEvents: 'none', overflow: 'visible',
        }}
        width={canvasWidth}
        height={canvasHeight}
      >
        {/* Light fill preview for 3+ vertices */}
        {points.length >= 3 && (
          <polygon points={closedStr} fill="rgba(99,102,241,0.09)" stroke="none" />
        )}

        {/* Main rubber-band polyline: placed vertices → cursor */}
        {strokePts.length >= 2 && (
          <polyline
            points={strokeStr}
            fill="none"
            stroke={POLY_COLOR}
            strokeWidth="1.5"
            strokeDasharray="5 3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Dotted close-guide: cursor → first vertex */}
        {cursor && points.length >= 2 && !nearFirst && (
          <line
            x1={cursor.x} y1={cursor.y}
            x2={points[0].x} y2={points[0].y}
            stroke={POLY_COLOR}
            strokeWidth="1"
            strokeOpacity="0.22"
            strokeDasharray="3 3"
          />
        )}

        {/* First vertex: small ring normally, large filled ring on snap */}
        {points.length > 0 && (
          <circle
            cx={points[0].x} cy={points[0].y}
            r={nearFirst ? 10 : 5}
            fill={nearFirst ? POLY_COLOR : 'none'}
            stroke={POLY_COLOR}
            strokeWidth={nearFirst ? 2.5 : 1.5}
            opacity={nearFirst ? 1 : 0.85}
          />
        )}

        {/* Subsequent vertices */}
        {points.slice(1).map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={4} fill={POLY_COLOR} opacity={0.8} />
        ))}

        {/* Cursor position dot */}
        {cursor && !nearFirst && (
          <circle cx={cursor.x} cy={cursor.y} r={3} fill={POLY_COLOR} opacity={0.45} />
        )}
      </svg>

      {/* Hint badge — HTML so it respects the theme (not SVG which can't use CSS vars) */}
      {cursor && (
        <div
          className="absolute pointer-events-none bg-popover border border-border text-foreground/80 text-[10px] font-medium px-2 py-0.5 rounded shadow-sm whitespace-nowrap"
          style={{ left: cursor.x + 14, top: cursor.y - 26, zIndex: 201 }}
        >
          {hint}
        </div>
      )}
    </>
  )
}

// ─── Drawing preview (drag-to-place ghost) ────────────────────────────────

const DRAW_PREVIEW_COLORS = {
  TABLE_SQUARE: 'border-amber-400   bg-amber-100/20   dark:bg-amber-900/20',
  TABLE_ROUND:  'border-amber-400   bg-amber-100/20   dark:bg-amber-900/20',
  BAR:          'border-stone-400   bg-stone-100/20   dark:bg-stone-800/20',
  WALL:         'border-zinc-500    bg-zinc-200/20    dark:bg-zinc-700/20',
  PLANT:        'border-green-500   bg-green-100/20   dark:bg-green-900/20',
  DOOR:         'border-sky-400     bg-sky-50/20      dark:bg-sky-900/20',
  FLOOR_ZONE:   'border-slate-400   bg-slate-100/15   dark:bg-slate-800/15',
  PILLAR:       'border-zinc-500    bg-zinc-200/20    dark:bg-zinc-700/20',
  SOFA:         'border-violet-400  bg-violet-100/20  dark:bg-violet-900/20',
  WINDOW:       'border-sky-300     bg-sky-50/20      dark:bg-sky-900/20',
  STAIRS:       'border-slate-400   bg-slate-200/20   dark:bg-slate-700/20',
}

const POLYGON_ZONE_COLORS = {
  neutral: { fill: 'rgba(100,116,139,0.12)', stroke: '#64748b' },
  dining:  { fill: 'rgba(59,130,246,0.12)',  stroke: '#3b82f6' },
  outdoor: { fill: 'rgba(34,197,94,0.12)',   stroke: '#22c55e' },
  bar:     { fill: 'rgba(245,158,11,0.12)',  stroke: '#f59e0b' },
  vip:     { fill: 'rgba(139,92,246,0.12)',  stroke: '#8b5cf6' },
  private: { fill: 'rgba(239,68,68,0.12)',   stroke: '#ef4444' },
}

function DrawingPreview({ preview }) {
  const w = Math.abs(preview.width)
  const h = Math.abs(preview.height)
  if (w < 4 || h < 4) return null
  const colors = DRAW_PREVIEW_COLORS[preview.kind] ?? 'border-primary bg-primary/10'
  return (
    <div
      className={['absolute pointer-events-none border-2 border-dashed rounded-sm flex items-end justify-end p-1', colors].join(' ')}
      style={{ left: preview.x, top: preview.y, width: w, height: h }}
    >
      <span className="text-[9px] text-muted-foreground bg-card/90 px-1 rounded leading-none py-0.5">
        {Math.round(w)} × {Math.round(h)}
      </span>
    </div>
  )
}

// ─── Context Menu ──────────────────────────────────────────────────────────

function ContextMenuOverlay({ menu, onAction, onClose, hasClipboard }) {
  const items = menu.elementId
    ? [
        { label: 'Duplicar',         shortcut: 'Ctrl+D', action: 'duplicate' },
        { label: 'Copiar',           shortcut: 'Ctrl+C', action: 'copy' },
        null,
        { label: 'Traer al frente',  action: 'bringForward' },
        { label: 'Enviar atrás',     action: 'sendBackward' },
        null,
        { label: 'Eliminar',         shortcut: 'Del',    action: 'delete', danger: true },
      ]
    : hasClipboard
      ? [{ label: 'Pegar', shortcut: 'Ctrl+V', action: 'paste' }]
      : []

  if (!items.length) return null

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose() }} />
      <div
        className="fixed z-50 rounded-2xl py-1.5 text-sm overflow-hidden"
        style={{
          left: Math.min(menu.clientX, window.innerWidth - 204),
          top: Math.min(menu.clientY, window.innerHeight - 224),
          minWidth: 188,
          // ── Liquid glass material ──────────────────────────────────────────
          background: 'rgba(14, 14, 22, 0.68)',
          backdropFilter: 'blur(32px) saturate(200%) brightness(1.08)',
          WebkitBackdropFilter: 'blur(32px) saturate(200%) brightness(1.08)',
          border: '1px solid rgba(255, 255, 255, 0.09)',
          boxShadow: [
            '0 12px 48px rgba(0,0,0,0.55)',
            '0 4px 16px rgba(0,0,0,0.35)',
            'inset 0 1px 0 rgba(255,255,255,0.10)',
            'inset 0 -1px 0 rgba(255,255,255,0.03)',
          ].join(', '),
        }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {/* Specular top highlight — simulates surface light reflection */}
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 pointer-events-none"
          style={{
            height: 1,
            background: 'linear-gradient(90deg, transparent 8%, rgba(255,255,255,0.22) 35%, rgba(255,255,255,0.22) 65%, transparent 92%)',
          }}
        />

        {items.map((item, i) =>
          item === null ? (
            <div
              key={i}
              className="mx-2 my-1.5"
              style={{ height: 1, background: 'rgba(255,255,255,0.07)' }}
            />
          ) : (
            <button
              key={item.action}
              type="button"
              onClick={() => { onAction(item.action, menu.elementId); onClose() }}
              className={[
                'group flex items-center justify-between rounded-lg transition-all duration-75',
                'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30',
                item.danger
                  ? 'text-red-400 hover:text-red-300 hover:bg-red-500/13'
                  : 'hover:bg-white/[0.07]',
              ].join(' ')}
              style={{
                width: 'calc(100% - 8px)',
                margin: '1px 4px',
                padding: '6px 10px',
                color: item.danger ? undefined : 'rgba(255,255,255,0.82)',
              }}
            >
              <span className="font-[450] tracking-[-0.01em]">{item.label}</span>
              {item.shortcut && (
                <span
                  className="ml-5 font-mono text-[10px] tabular-nums transition-colors group-hover:opacity-70"
                  style={{ color: 'rgba(255,255,255,0.30)' }}
                >
                  {item.shortcut}
                </span>
              )}
            </button>
          ),
        )}
      </div>
    </>
  )
}

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

// ─── Rulers ───────────────────────────────────────────────────────────────
// Rendered inside the scaled canvas div so they scale with zoom.
// All sizes divided by zoom to maintain constant screen-pixel appearance.
// Colors use hsl(var(--xxx)) — shadcn/ui variables store raw HSL values, not
// full color strings, so they MUST be wrapped in hsl() to be valid CSS colors.

const RULER_THICKNESS = 20 // screen-pixel height/width at zoom=1

function CanvasRulerH({ canvasWidth, zoom, cursorX = null }) {
  const step = zoom >= 1.5 ? 50 : zoom >= 0.75 ? 100 : zoom >= 0.4 ? 200 : 500
  const ticks = Array.from({ length: Math.ceil(canvasWidth / step) + 1 }, (_, i) => i * step)
  const sw = 0.75 / zoom
  const fs = 8 / zoom
  const rh = RULER_THICKNESS / zoom
  const TICK  = 'hsl(var(--foreground) / 0.22)'
  const LABEL = 'hsl(var(--foreground) / 0.5)'
  const BG    = 'hsl(var(--muted))'
  return (
    <svg style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 15 }}
         width={canvasWidth} height={rh}>
      <rect width={canvasWidth} height={rh} fill={BG} opacity={0.9} />
      <line x1={0} y1={rh} x2={canvasWidth} y2={rh} stroke={TICK} strokeWidth={sw} />
      {ticks.map((x) => {
        const major = x % 500 === 0
        const mid   = !major && x % 100 === 0
        const th    = (major ? 10 : mid ? 6 : 3) / zoom
        const showLabel = major || (zoom >= 0.5 && mid)
        return (
          <g key={x}>
            <line x1={x} y1={rh - th} x2={x} y2={rh} stroke={TICK} strokeWidth={sw} />
            {showLabel && x > 0 && (
              <text x={x + 2 / zoom} y={rh - th - 1.5 / zoom} fontSize={fs}
                    fontFamily="monospace" fill={LABEL}>{x}</text>
            )}
          </g>
        )
      })}
      {cursorX !== null && (
        <line x1={cursorX} y1={0} x2={cursorX} y2={rh}
              stroke="hsl(var(--primary))" strokeWidth={1.5 / zoom} opacity={0.7} />
      )}
    </svg>
  )
}

function CanvasRulerV({ canvasHeight, zoom, cursorY = null }) {
  const step = zoom >= 1.5 ? 50 : zoom >= 0.75 ? 100 : zoom >= 0.4 ? 200 : 500
  const ticks = Array.from({ length: Math.ceil(canvasHeight / step) + 1 }, (_, i) => i * step)
  const sw = 0.75 / zoom
  const fs = 8 / zoom
  const rw = RULER_THICKNESS / zoom
  const TICK  = 'hsl(var(--foreground) / 0.22)'
  const LABEL = 'hsl(var(--foreground) / 0.5)'
  const BG    = 'hsl(var(--muted))'
  return (
    <svg style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 16 }}
         width={rw} height={canvasHeight}>
      <rect width={rw} height={canvasHeight} fill={BG} opacity={0.9} />
      <line x1={rw} y1={0} x2={rw} y2={canvasHeight} stroke={TICK} strokeWidth={sw} />
      {ticks.map((y) => {
        const major = y % 500 === 0
        const mid   = !major && y % 100 === 0
        const tw    = (major ? 10 : mid ? 6 : 3) / zoom
        const showLabel = major || (zoom >= 0.5 && mid)
        return (
          <g key={y}>
            <line x1={rw - tw} y1={y} x2={rw} y2={y} stroke={TICK} strokeWidth={sw} />
            {showLabel && y > 0 && (
              <text x={-(y) - 2 / zoom} y={rw - tw - 1.5 / zoom}
                    fontSize={fs} fontFamily="monospace" fill={LABEL}
                    transform="rotate(-90)" textAnchor="end">{y}</text>
            )}
          </g>
        )
      })}
      {cursorY !== null && (
        <line x1={0} y1={cursorY} x2={rw} y2={cursorY}
              stroke="hsl(var(--primary))" strokeWidth={1.5 / zoom} opacity={0.7} />
      )}
    </svg>
  )
}

// Dashed crosshair lines from rulers to cursor position
function CursorCrosshair({ pos, canvasWidth, canvasHeight, zoom }) {
  if (!pos) return null
  const offset = RULER_THICKNESS / zoom
  const sw     = 0.75 / zoom
  const dash   = `${4 / zoom},${3 / zoom}`
  const color  = 'hsl(var(--primary) / 0.35)'
  return (
    <svg style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 14 }}
         width={canvasWidth} height={canvasHeight}>
      <line x1={pos.x} y1={offset} x2={pos.x} y2={pos.y}
            stroke={color} strokeWidth={sw} strokeDasharray={dash} />
      <line x1={offset} y1={pos.y} x2={pos.x} y2={pos.y}
            stroke={color} strokeWidth={sw} strokeDasharray={dash} />
    </svg>
  )
}

// ─── Main canvas ───────────────────────────────────────────────────────────

const MIN_DRAW_SIZE = 16 // px — below this, treat as single click

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
  // Stores the canvas coordinate under the pinch center at gesture start.
  // Used to keep that point fixed while panning and zooming simultaneously.
  const lastPinchAnchorRef = useRef(null) // { canvasX, canvasY }
  // Pan: middle-mouse or Space+drag
  const panRef             = useRef(null) // { startX, startY, scrollLeft, scrollTop }
  const spacePressedRef    = useRef(false)
  // Zoom toward cursor: wheel handler stores desired scroll; useLayoutEffect applies it
  const zoomRef            = useRef(zoom)
  const pendingScrollRef   = useRef(null)

  const [drawingPreview, setDrawingPreview] = useState(null)
  const [contextMenu, setContextMenu]       = useState(null)
  const [polygonPoints, setPolygonPoints]   = useState([])
  const [polygonCursor, setPolygonCursor]   = useState(null)
  const [cursorPos, setCursorPos]           = useState(null)
  const [isPanning, setIsPanning]           = useState(false)

  // Force minimum canvas dimensions so stored 1200×800 floors get more space
  const canvasWidth  = Math.max(floor?.canvasWidth  ?? 2000, 2000)
  const canvasHeight = Math.max(floor?.canvasHeight ?? 1400, 1400)

  // Keep refs in sync
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
      const cursorX  = e.clientX - rect.left  // relative to scroll container viewport
      const cursorY  = e.clientY - rect.top
      const oldZoom  = zoomRef.current
      const delta    = e.deltaY < 0 ? 0.1 : -0.1
      const newZoom  = Math.max(0.25, Math.min(3, Math.round((oldZoom + delta) * 100) / 100))
      if (newZoom === oldZoom) return
      // Canvas coordinate under cursor stays fixed after zoom
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

  // Clear polygon state when switching away from polygon tool
  useEffect(() => {
    if (activeTool !== 'POLYGON') {
      setPolygonPoints([])
      setPolygonCursor(null)
    }
  }, [activeTool])

  // Enter key closes polygon; Escape cancels it
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
    // Debounce: ignore rapid clicks (second click of a double-click, ~280ms window)
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

  // ── Canvas background pointer down: starts drawing ──────────────────────
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
    // Slice off the vertex added by the first click of this dblclick gesture
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

  // ── Element pointer down: drag / long-press ──────────────────────────────
  function handleElementPointerDown(e, element) {
    if (contextMenu) { setContextMenu(null); return }

    // In polygon mode, element clicks add vertices (same logic as canvas clicks)
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

  // ── Pointer move: drawing preview OR element drag ────────────────────────
  function handlePointerMove(e) {
    // Active pan (middle mouse or Space+drag): scroll container directly
    if (panRef.current) {
      const container = scrollContainerRef.current
      if (container) {
        container.scrollLeft = panRef.current.scrollLeft - (e.clientX - panRef.current.startX)
        container.scrollTop  = panRef.current.scrollTop  - (e.clientY - panRef.current.startY)
      }
      return
    }

    // Track cursor for crosshair overlay (always, so rulers show live position)
    const coords = getCanvasCoords(e.clientX, e.clientY)
    if (coords.x >= 0 && coords.x <= canvasWidth && coords.y >= 0 && coords.y <= canvasHeight) {
      setCursorPos(coords)
    } else {
      setCursorPos(null)
    }

    // Cancel long-press if touch moved
    if (longPressOrigin.current) {
      const dx = e.clientX - longPressOrigin.current.x
      const dy = e.clientY - longPressOrigin.current.y
      if (Math.sqrt(dx*dx + dy*dy) > 8) {
        clearTimeout(longPressTimer.current)
        longPressOrigin.current = null
      }
    }

    // Polygon cursor tracking (update preview line even before first vertex)
    if (activeTool === 'POLYGON') {
      const { x, y } = getCanvasCoords(e.clientX, e.clientY)
      setPolygonCursor({ x, y })
      return
    }

    // Drawing mode (drag-to-place ghost)
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

    // Element drag / resize / vertex drag
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

  // ── Pointer up: finalize drawing OR end drag ─────────────────────────────
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
        // Drag-to-draw: use drawn bounds as-is
        const x = Math.min(startX, currentX)
        const y = Math.min(startY, currentY)
        onPlace(kind, x, y, Math.max(20, w), Math.max(20, h))
      } else {
        // Single click: center element at cursor
        onPlace(kind, startX, startY)
      }
    }
  }

  // ── Pan: middle-mouse drag or Space+drag ────────────────────────────────
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

  // ── Touch: two-finger pan + pinch-zoom anchored to pinch center ──────────
  function handleTouchStart(e) {
    if (e.touches.length === 2) {
      const [t1, t2] = e.touches
      lastPinchDistRef.current = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY)

      // Record canvas coordinate under the pinch center so we can keep it fixed
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

    // Pan: scroll so the anchor canvas point stays under the current finger center
    container.scrollLeft = canvasX * cz + 12 - newCenterX
    container.scrollTop  = canvasY * cz + 12 - newCenterY

    // Zoom: also correct scroll for new zoom level
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

        {/* Polygon drawing overlay — always shown in POLYGON mode (zIndex 200 > all elements) */}
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
