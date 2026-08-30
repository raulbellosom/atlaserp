import { useEffect, useRef, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@atlas/ui'
import { clampCropRect, applyAspectRatio } from '../lib/imageCrop.js'

const PRESETS = [
  { id: 'free', label: 'Libre', ratio: null },
  { id: '1', label: '1:1', ratio: 1 },
  { id: '43', label: '4:3', ratio: 4 / 3 },
  { id: '169', label: '16:9', ratio: 16 / 9 },
]

const DEFAULT_RECT = { x: 0.05, y: 0.05, w: 0.9, h: 0.9 }
const HANDLES = ['nw', 'ne', 'sw', 'se']

// Non-destructive image cropper. `crop` (nullable) is a rect in fractions of
// the original image; `onApply(rect|null)` receives the new crop (null clears).
export function ImageCropModal({ open, onOpenChange, src, crop, onApply }) {
  const areaRef = useRef(null)
  const gestureRef = useRef(null) // { mode, pointerId, start:{x,y}, startRect }
  const [rect, setRect] = useState(crop ?? DEFAULT_RECT)
  const [preset, setPreset] = useState('free')
  const [nat, setNat] = useState(null) // { w, h }

  useEffect(() => {
    if (open) {
      setRect(crop ?? DEFAULT_RECT)
      setPreset('free')
    }
    // Only reset on open/close transitions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Convert a pixel aspect ratio to fraction space using natural dimensions.
  function ratioFrac(pixelRatio) {
    if (!pixelRatio) return null
    if (!nat) return pixelRatio
    return pixelRatio * (nat.h / nat.w)
  }

  function selectPreset(p) {
    setPreset(p.id)
    setRect((r) => applyAspectRatio(r, ratioFrac(p.ratio)))
  }

  function pointerFrac(e) {
    const b = areaRef.current.getBoundingClientRect()
    return { x: (e.clientX - b.left) / b.width, y: (e.clientY - b.top) / b.height }
  }

  const startGesture = (mode) => (e) => {
    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    gestureRef.current = { mode, pointerId: e.pointerId, start: pointerFrac(e), startRect: rect }
  }

  function onAreaPointerMove(e) {
    const g = gestureRef.current
    if (!g || g.pointerId !== e.pointerId) return
    const now = pointerFrac(e)
    const dx = now.x - g.start.x
    const dy = now.y - g.start.y
    let next = { ...g.startRect }
    if (g.mode === 'move') {
      next.x = g.startRect.x + dx
      next.y = g.startRect.y + dy
      setRect(clampCropRect(next))
      return
    }
    if (g.mode.includes('e')) next.w = g.startRect.w + dx
    if (g.mode.includes('s')) next.h = g.startRect.h + dy
    if (g.mode.includes('w')) {
      next.x = g.startRect.x + dx
      next.w = g.startRect.w - dx
    }
    if (g.mode.includes('n')) {
      next.y = g.startRect.y + dy
      next.h = g.startRect.h - dy
    }
    const r = ratioFrac(PRESETS.find((p) => p.id === preset)?.ratio)
    setRect(r ? applyAspectRatio(next, r) : clampCropRect(next))
  }

  function endGesture(e) {
    const g = gestureRef.current
    if (!g || g.pointerId !== e.pointerId) return
    gestureRef.current = null
  }

  const pct = (v) => `${v * 100}%`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="2xl" mobileVariant="center">
        <DialogHeader>
          <DialogTitle>Recortar imagen</DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap gap-1.5 mb-3">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => selectPreset(p)}
              className={`px-3 h-9 rounded-lg text-xs font-medium border transition-colors ${
                preset === p.id
                  ? 'bg-amber-500 text-white border-amber-500'
                  : 'border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div
          ref={areaRef}
          className="relative w-full max-h-[60dvh] select-none overflow-hidden rounded-lg bg-[hsl(var(--muted))]"
          style={{ touchAction: 'none', aspectRatio: nat ? String(nat.w / nat.h) : '3 / 2' }}
          onPointerMove={onAreaPointerMove}
          onPointerUp={endGesture}
          onPointerCancel={endGesture}
        >
          <img
            src={src}
            alt=""
            draggable={false}
            className="absolute inset-0 w-full h-full object-contain pointer-events-none"
            onLoad={(e) => setNat({ w: e.target.naturalWidth, h: e.target.naturalHeight })}
          />

          <div className="absolute left-0 right-0 top-0 bg-black/50 pointer-events-none" style={{ height: pct(rect.y) }} />
          <div className="absolute left-0 right-0 bottom-0 bg-black/50 pointer-events-none" style={{ height: pct(1 - rect.y - rect.h) }} />
          <div className="absolute left-0 bg-black/50 pointer-events-none" style={{ top: pct(rect.y), height: pct(rect.h), width: pct(rect.x) }} />
          <div className="absolute right-0 bg-black/50 pointer-events-none" style={{ top: pct(rect.y), height: pct(rect.h), width: pct(1 - rect.x - rect.w) }} />

          <div
            className="absolute border-2 border-white cursor-move"
            style={{ left: pct(rect.x), top: pct(rect.y), width: pct(rect.w), height: pct(rect.h), touchAction: 'none' }}
            onPointerDown={startGesture('move')}
          >
            {HANDLES.map((h) => (
              <button
                key={h}
                aria-label={`Ajustar esquina ${h}`}
                onPointerDown={startGesture(h)}
                className="absolute w-11 h-11 -m-5"
                style={{
                  left: h.includes('w') ? 0 : undefined,
                  right: h.includes('e') ? 0 : undefined,
                  top: h.includes('n') ? 0 : undefined,
                  bottom: h.includes('s') ? 0 : undefined,
                  touchAction: 'none',
                }}
              >
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white border border-black/20 shadow" />
              </button>
            ))}
          </div>
        </div>

        <DialogFooter>
          <button
            onClick={() => onApply(null)}
            className="px-3 h-9 rounded-lg text-xs font-medium text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] sm:mr-auto"
          >
            Restablecer
          </button>
          <button
            onClick={() => onOpenChange(false)}
            className="px-3 h-9 rounded-lg text-xs font-medium border border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]"
          >
            Cancelar
          </button>
          <button
            onClick={() => onApply(clampCropRect(rect))}
            className="px-4 h-9 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white"
          >
            Aplicar
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
