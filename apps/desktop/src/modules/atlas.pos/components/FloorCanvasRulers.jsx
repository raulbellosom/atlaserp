// All sizes divided by zoom to maintain constant screen-pixel appearance.
// Colors use hsl(var(--xxx)) — shadcn/ui variables store raw HSL values, not
// full color strings, so they MUST be wrapped in hsl() to be valid CSS colors.

const RULER_THICKNESS = 20

export function CanvasRulerH({ canvasWidth, zoom, cursorX = null }) {
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

export function CanvasRulerV({ canvasHeight, zoom, cursorY = null }) {
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

export function CursorCrosshair({ pos, canvasWidth, canvasHeight, zoom }) {
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
