import { NodeViewWrapper } from '@tiptap/react'
import { useRef, useState, useEffect } from 'react'

const COLORS = ['#1a1a1a', '#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ffffff']
const SIZES = [2, 4, 8, 14, 20]

export function DrawingCanvas({ node, updateAttributes, editor }) {
  const canvasRef = useRef(null)
  const isDrawing = useRef(false)
  const currentStroke = useRef([])
  const strokesRef = useRef(JSON.parse(node.attrs.strokes || '[]'))
  const [tool, setTool] = useState('pen')
  const [color, setColor] = useState('#1a1a1a')
  const [size, setSize] = useState(4)
  const [strokeCount, setStrokeCount] = useState(strokesRef.current.length)

  useEffect(() => {
    strokesRef.current = JSON.parse(node.attrs.strokes || '[]')
    redraw()
    setStrokeCount(strokesRef.current.length)
  }, [node.attrs.strokes])

  function redraw() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    strokesRef.current.forEach(s => paintStroke(ctx, s))
  }

  function paintStroke(ctx, stroke) {
    if (!stroke.points || stroke.points.length < 2) return
    ctx.save()
    ctx.beginPath()
    ctx.globalCompositeOperation = stroke.tool === 'eraser' ? 'destination-out' : 'source-over'
    ctx.strokeStyle = stroke.tool === 'eraser' ? 'rgba(0,0,0,1)' : stroke.color
    ctx.lineWidth = stroke.size
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y)
    stroke.points.forEach(p => ctx.lineTo(p.x, p.y))
    ctx.stroke()
    ctx.restore()
  }

  function getPos(e) {
    const rect = canvasRef.current.getBoundingClientRect()
    const scaleX = canvasRef.current.width / rect.width
    const scaleY = canvasRef.current.height / rect.height
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY }
  }

  function onPointerDown(e) {
    e.preventDefault()
    isDrawing.current = true
    currentStroke.current = [getPos(e)]
  }

  function onPointerMove(e) {
    e.preventDefault()
    if (!isDrawing.current) return
    const pos = getPos(e)
    currentStroke.current.push(pos)
    const ctx = canvasRef.current.getContext('2d')
    const pts = currentStroke.current
    if (pts.length < 2) return
    paintStroke(ctx, { tool, color, size, points: [pts[pts.length - 2], pts[pts.length - 1]] })
  }

  function onPointerUp(e) {
    e.preventDefault()
    if (!isDrawing.current || !currentStroke.current.length) return
    isDrawing.current = false
    const newStroke = { tool, color, size, points: currentStroke.current }
    currentStroke.current = []
    const updated = [...strokesRef.current, newStroke]
    strokesRef.current = updated
    setStrokeCount(updated.length)
    updateAttributes({ strokes: JSON.stringify(updated) })
  }

  function undoLast() {
    const updated = strokesRef.current.slice(0, -1)
    strokesRef.current = updated
    setStrokeCount(updated.length)
    updateAttributes({ strokes: JSON.stringify(updated) })
  }

  function clearAll() {
    strokesRef.current = []
    setStrokeCount(0)
    updateAttributes({ strokes: '[]' })
    const ctx = canvasRef.current?.getContext('2d')
    ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
  }

  const editable = editor?.isEditable !== false

  return (
    <NodeViewWrapper className="my-4 select-none">
      <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        {editable && (
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b border-gray-200 flex-wrap">
            <button onClick={() => setTool('pen')} className={`px-2 py-1 text-xs rounded font-medium ${tool === 'pen' ? 'bg-amber-100 text-amber-700' : 'text-gray-600 hover:bg-gray-100'}`}>Lapiz</button>
            <button onClick={() => setTool('eraser')} className={`px-2 py-1 text-xs rounded font-medium ${tool === 'eraser' ? 'bg-gray-200' : 'text-gray-600 hover:bg-gray-100'}`}>Borrador</button>
            <div className="h-4 w-px bg-gray-200" />
            <div className="flex gap-1">
              {COLORS.map(c => (
                <button key={c} onClick={() => { setTool('pen'); setColor(c) }}
                  className={`w-5 h-5 rounded-full border-2 ${color === c && tool === 'pen' ? 'border-amber-500 scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: c === '#ffffff' ? '#f3f4f6' : c }} />
              ))}
            </div>
            <div className="h-4 w-px bg-gray-200" />
            <div className="flex gap-1 items-center">
              {SIZES.map(s => (
                <button key={s} onClick={() => setSize(s)} className={`flex items-center justify-center w-6 h-6 rounded ${size === s ? 'bg-amber-100' : 'hover:bg-gray-100'}`}>
                  <div className="rounded-full bg-gray-700" style={{ width: Math.min(s, 14), height: Math.min(s, 14) }} />
                </button>
              ))}
            </div>
            <div className="ml-auto flex gap-1">
              <button onClick={undoLast} disabled={strokeCount === 0} className="px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 rounded disabled:opacity-30">Deshacer</button>
              <button onClick={clearAll} disabled={strokeCount === 0} className="px-2 py-1 text-xs text-red-500 hover:bg-red-50 rounded disabled:opacity-30">Limpiar</button>
            </div>
          </div>
        )}
        <canvas
          ref={canvasRef}
          width={node.attrs.canvasWidth}
          height={node.attrs.canvasHeight}
          onPointerDown={editable ? onPointerDown : undefined}
          onPointerMove={editable ? onPointerMove : undefined}
          onPointerUp={editable ? onPointerUp : undefined}
          onPointerLeave={editable ? onPointerUp : undefined}
          style={{
            touchAction: 'none',
            display: 'block',
            width: '100%',
            cursor: editable ? (tool === 'eraser' ? 'cell' : 'crosshair') : 'default',
            backgroundColor: node.attrs.backgroundColor,
          }}
        />
      </div>
    </NodeViewWrapper>
  )
}
