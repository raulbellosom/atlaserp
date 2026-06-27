export const CHAIR_PAD = 18

export function squareChairPositions(width, height, capacity, style = 'auto') {
  if (style === 'none' || !capacity) return []
  const n = Math.min(capacity, 20)
  const CW_H  = Math.min(18, Math.max(8, (width  - 8) / 4))
  const CW_V  = Math.min(18, Math.max(8, (height - 8) / 4))
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

  let topN = 0, botN = 0, leftN = 0, rightN = 0

  if (style === 'two_sides') {
    topN = Math.ceil(n / 2)
    botN = Math.floor(n / 2)
  } else {
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

export function roundChairPositions(width, height, capacity, style = 'auto') {
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

export function TableSvg({ width, height, isRound, capacity, tableName, chairStyle, isSelected }) {
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
