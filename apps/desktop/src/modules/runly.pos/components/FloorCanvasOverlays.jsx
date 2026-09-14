// Hardcoded hex color — CSS vars in SVG stroke attrs are unreliable cross-browser
const POLY_COLOR = '#6366f1'

export function PolygonDrawingOverlay({ points, cursor, canvasWidth, canvasHeight }) {
  if (!cursor && points.length === 0) return null

  const nearFirst = cursor && points.length >= 3
    ? Math.hypot(cursor.x - points[0].x, cursor.y - points[0].y) < 16
    : false

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
        {points.length >= 3 && (
          <polygon points={closedStr} fill="rgba(99,102,241,0.09)" stroke="none" />
        )}

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

        {points.slice(1).map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={4} fill={POLY_COLOR} opacity={0.8} />
        ))}

        {cursor && !nearFirst && (
          <circle cx={cursor.x} cy={cursor.y} r={3} fill={POLY_COLOR} opacity={0.45} />
        )}
      </svg>

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

export function ContextMenuOverlay({ menu, onAction, onClose, hasClipboard }) {
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
