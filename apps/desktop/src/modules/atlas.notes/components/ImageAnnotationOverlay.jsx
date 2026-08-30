import { NodeViewWrapper } from '@tiptap/react'
import { useRef, useState } from 'react'
import { GripVertical } from 'lucide-react'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@atlas/ui'
import { findDropPosition, moveNode } from '../lib/dragReorder.js'
import { withImageVariant } from '../../../lib/imageVariants.js'

const COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#1a1a1a', '#ffffff']

export function ImageAnnotationOverlay({ node, updateAttributes, editor, getPos }) {
  const svgRef = useRef(null)
  const [tool, setTool] = useState('arrow')
  const [color, setColor] = useState('#ef4444')
  const [lineWidth, setLineWidth] = useState(2)
  const [draft, setDraft] = useState(null)
  // For inline text input — no window.prompt() allowed
  const [textInput, setTextInput] = useState(null) // { screenX, screenY, svgX, svgY }
  // Drop indicator shown while dragging the image to reorder it (mouse + touch)
  const [dropIndicator, setDropIndicator] = useState(null) // { top, left, width }
  const dragRef = useRef(null) // { pointerId, dropPos }
  const annotations = JSON.parse(node.attrs.annotations || '[]')

  const editable = editor?.isEditable !== false

  function getIndicatorRect(view, pos) {
    const { doc } = view.state
    let dom = pos < doc.content.size ? view.nodeDOM(pos) : null
    if (dom?.getBoundingClientRect) {
      const rect = dom.getBoundingClientRect()
      return { top: rect.top, left: rect.left, width: rect.width }
    }
    // Dropping after the last node — anchor below it
    let lastDom = null
    doc.forEach((_n, offset) => { lastDom = view.nodeDOM(offset) ?? lastDom })
    if (lastDom?.getBoundingClientRect) {
      const rect = lastDom.getBoundingClientRect()
      return { top: rect.bottom, left: rect.left, width: rect.width }
    }
    const containerRect = view.dom.getBoundingClientRect()
    return { top: containerRect.top, left: containerRect.left, width: containerRect.width }
  }

  function onHandlePointerDown(e) {
    if (!editable || typeof getPos !== 'function') return
    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { pointerId: e.pointerId, dropPos: null }
  }

  function onHandlePointerMove(e) {
    if (!dragRef.current || dragRef.current.pointerId !== e.pointerId) return
    const view = editor.view
    const dropPos = findDropPosition(view, e.clientY)
    dragRef.current.dropPos = dropPos
    setDropIndicator(getIndicatorRect(view, dropPos))
  }

  function onHandlePointerUp(e) {
    if (!dragRef.current || dragRef.current.pointerId !== e.pointerId) return
    const { dropPos } = dragRef.current
    dragRef.current = null
    setDropIndicator(null)
    if (dropPos !== null) {
      moveNode(editor, getPos(), dropPos)
    }
  }

  function getSvgPos(e) {
    const svg = svgRef.current
    const rect = svg.getBoundingClientRect()
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    }
  }

  function onMouseDown(e) {
    if (!editable || textInput) return
    e.preventDefault()
    if (tool === 'text') {
      // Show inline text input at click position — never window.prompt()
      const pos = getSvgPos(e)
      const svg = svgRef.current
      const rect = svg.getBoundingClientRect()
      setTextInput({
        svgX: pos.x,
        svgY: pos.y,
        screenX: e.clientX - rect.left,
        screenY: e.clientY - rect.top,
      })
      return
    }
    setDraft({ type: tool, color, lineWidth, start: getSvgPos(e), end: getSvgPos(e) })
  }

  function onMouseMove(e) {
    if (!draft || !editable) return
    setDraft(d => ({ ...d, end: getSvgPos(e) }))
  }

  function onMouseUp(e) {
    if (!draft || !editable) return
    const ann = { ...draft, id: Date.now(), end: getSvgPos(e) }
    const updated = [...annotations, ann]
    updateAttributes({ annotations: JSON.stringify(updated) })
    setDraft(null)
  }

  function commitTextInput(text) {
    if (text?.trim()) {
      const ann = {
        type: 'text',
        id: Date.now(),
        color,
        lineWidth,
        text: text.trim(),
        svgX: textInput.svgX,
        svgY: textInput.svgY,
      }
      const updated = [...annotations, ann]
      updateAttributes({ annotations: JSON.stringify(updated) })
    }
    setTextInput(null)
  }

  function removeAnnotation(id) {
    const updated = annotations.filter(a => a.id !== id)
    updateAttributes({ annotations: JSON.stringify(updated) })
  }

  function renderAnnotation(ann) {
    const W = 1000 // normalized SVG viewBox width
    const H = 1000
    if (ann.type === 'arrow') {
      const x1 = ann.start.x * W
      const y1 = ann.start.y * H
      const x2 = ann.end.x * W
      const y2 = ann.end.y * H
      return (
        <g key={ann.id} onClick={() => editable && removeAnnotation(ann.id)} className="cursor-pointer">
          <defs>
            <marker id={`ah-${ann.id}`} markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
              <path d="M0,0 L0,6 L8,3 z" fill={ann.color} />
            </marker>
          </defs>
          <line x1={x1} y1={y1} x2={x2} y2={y2}
            stroke={ann.color} strokeWidth={ann.lineWidth}
            markerEnd={`url(#ah-${ann.id})`} />
        </g>
      )
    }
    if (ann.type === 'rect') {
      const x = Math.min(ann.start.x, ann.end.x) * W
      const y = Math.min(ann.start.y, ann.end.y) * H
      const w = Math.abs(ann.end.x - ann.start.x) * W
      const h = Math.abs(ann.end.y - ann.start.y) * H
      return (
        <rect key={ann.id} x={x} y={y} width={w} height={h}
          stroke={ann.color} strokeWidth={ann.lineWidth} fill="none"
          onClick={() => editable && removeAnnotation(ann.id)} className="cursor-pointer" />
      )
    }
    if (ann.type === 'text') {
      return (
        <text key={ann.id} x={ann.svgX * W} y={ann.svgY * H}
          fill={ann.color} fontSize={ann.lineWidth * 8 + 12}
          fontWeight="bold" fontFamily="sans-serif"
          onClick={() => editable && removeAnnotation(ann.id)} className="cursor-pointer select-none">
          {ann.text}
        </text>
      )
    }
    return null
  }

  function renderDraft() {
    if (!draft) return null
    const W = 1000
    const H = 1000
    if (draft.type === 'arrow') {
      return (
        <line x1={draft.start.x * W} y1={draft.start.y * H}
          x2={draft.end.x * W} y2={draft.end.y * H}
          stroke={draft.color} strokeWidth={draft.lineWidth} strokeDasharray="6 3" />
      )
    }
    if (draft.type === 'rect') {
      const x = Math.min(draft.start.x, draft.end.x) * W
      const y = Math.min(draft.start.y, draft.end.y) * H
      const w = Math.abs(draft.end.x - draft.start.x) * W
      const h = Math.abs(draft.end.y - draft.start.y) * H
      return <rect x={x} y={y} width={w} height={h} stroke={draft.color} strokeWidth={draft.lineWidth} fill="none" strokeDasharray="6 3" />
    }
    return null
  }

  return (
    <NodeViewWrapper className="relative my-2 inline-block w-full">
      {editable && (
        <div className="flex items-center gap-2 py-1 px-2 bg-[hsl(var(--muted))] border border-[hsl(var(--border))] rounded-t text-xs flex-wrap">
          <button
            title="Arrastrar para mover la imagen"
            className="flex items-center justify-center w-7 h-7 -ml-1 rounded text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted-foreground)/0.1)] hover:text-[hsl(var(--foreground))] cursor-grab active:cursor-grabbing shrink-0"
            style={{ touchAction: 'none' }}
            onPointerDown={onHandlePointerDown}
            onPointerMove={onHandlePointerMove}
            onPointerUp={onHandlePointerUp}
            onPointerCancel={onHandlePointerUp}
          >
            <GripVertical className="w-4 h-4" />
          </button>
          <div className="h-4 w-px bg-[hsl(var(--border))]" />
          {['arrow', 'rect', 'text'].map(t => (
            <button key={t} onClick={() => setTool(t)}
              className={`px-2 py-0.5 rounded font-medium capitalize ${tool === t ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted-foreground)/0.1)]'}`}>
              {t === 'arrow' ? 'Flecha' : t === 'rect' ? 'Recuadro' : 'Texto'}
            </button>
          ))}
          <div className="h-4 w-px bg-[hsl(var(--border))]" />
          {COLORS.map(c => (
            <button key={c} onClick={() => setColor(c)}
              className={`w-4 h-4 rounded-full border-2 ${color === c ? 'border-amber-500 scale-110' : 'border-transparent'}`}
              style={{ backgroundColor: c === '#ffffff' ? '#f3f4f6' : c }} />
          ))}
          <div className="h-4 w-px bg-[hsl(var(--border))]" />
          <Select value={String(lineWidth)} onValueChange={v => setLineWidth(Number(v))}>
            <SelectTrigger className="h-6 w-auto min-w-14 px-1.5 py-0 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4, 6].map(w => (
                <SelectItem key={w} value={String(w)}>{w}px</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {annotations.length > 0 && (
            <button onClick={() => updateAttributes({ annotations: '[]' })} className="ml-auto text-xs text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 px-2 py-0.5 rounded">
              Limpiar
            </button>
          )}
        </div>
      )}
      <div className="relative" style={{ userSelect: 'none' }}>
        <img
          src={withImageVariant(node.attrs.src, 'content')}
          alt={node.attrs.alt ?? ''}
          className="w-full block rounded-b"
          draggable={false}
        />
        <svg
          ref={svgRef}
          viewBox="0 0 1000 1000"
          preserveAspectRatio="none"
          className="absolute inset-0 w-full h-full"
          style={{ cursor: editable ? (tool === 'text' ? 'text' : 'crosshair') : 'default' }}
          onMouseDown={editable ? onMouseDown : undefined}
          onMouseMove={editable ? onMouseMove : undefined}
          onMouseUp={editable ? onMouseUp : undefined}
          onMouseLeave={editable ? onMouseUp : undefined}
        >
          {annotations.map(renderAnnotation)}
          {renderDraft()}
        </svg>
        {/* Inline text input for text annotation tool — replaces window.prompt() */}
        {textInput && (
          <input
            autoFocus
            type="text"
            placeholder="Escribe una anotacion..."
            className="absolute bg-[hsl(var(--background))] text-[hsl(var(--foreground))] border border-amber-400 dark:border-amber-600 rounded px-2 py-1 text-sm shadow-lg outline-none z-10"
            style={{ left: textInput.screenX, top: textInput.screenY, minWidth: 180 }}
            onKeyDown={e => {
              if (e.key === 'Enter') commitTextInput(e.target.value)
              if (e.key === 'Escape') setTextInput(null)
            }}
            onBlur={e => commitTextInput(e.target.value)}
          />
        )}
      </div>
      {dropIndicator && (
        <div
          className="fixed h-0.5 bg-amber-500 rounded-full z-50 pointer-events-none"
          style={{ top: dropIndicator.top, left: dropIndicator.left, width: dropIndicator.width }}
        />
      )}
    </NodeViewWrapper>
  )
}
