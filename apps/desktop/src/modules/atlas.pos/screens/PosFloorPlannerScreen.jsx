import { useReducer, useState, useEffect, useCallback, useRef } from 'react'
import { Pencil, LayoutGrid, Settings2, ZoomIn, ZoomOut, RotateCcw, Grid, Ruler } from 'lucide-react'
import {
  Button, SelectField, Badge,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
  Sheet, SheetContent, SheetHeader, SheetTitle,
  TextField, EmptyState,
} from '@atlas/ui'
import { usePosOutlets } from '../hooks/usePosSettings'
import {
  usePosFloors,
  usePosFloorDetail,
  useCreatePosFloor,
  useUpdatePosFloor,
  useSaveFloorLayout,
  usePublishFloor,
} from '../hooks/usePosFloor'
import FloorCanvas from '../components/FloorCanvas'
import FloorToolbox, { FloorToolboxContent } from '../components/FloorToolbox'
import FloorPropertiesPanel from '../components/FloorPropertiesPanel'

const DEFAULT_SIZES = {
  TABLE_SQUARE: { width: 80,  height: 80  },
  TABLE_ROUND:  { width: 80,  height: 80  },
  BAR:          { width: 200, height: 60  },
  WALL:         { width: 150, height: 20  },
  PLANT:        { width: 44,  height: 44  },
  DOOR:         { width: 64,  height: 20  },
  FLOOR_ZONE:   { width: 220, height: 160 },
  PILLAR:       { width: 40,  height: 40  },
  SOFA:         { width: 160, height: 55  },
  WINDOW:       { width: 80,  height: 14  },
  STAIRS:       { width: 80,  height: 100 },
  POLYGON:      { width: 120, height: 100 },
}

function elementsFromFloor(floor) {
  if (!floor?.elements) return []
  return floor.elements.map((el) => {
    const table = floor.tables?.find((t) => t.id === el.tableId)
    const elStyle = el.style ?? {}
    const isTable = el.kind?.startsWith('TABLE_')
    return {
      id: el.id,
      kind: el.kind,
      x: parseFloat(el.x),
      y: parseFloat(el.y),
      width: parseFloat(el.width),
      height: parseFloat(el.height),
      label: el.label ?? null,
      tableId: el.tableId ?? null,
      tableName: table?.name ?? '',
      capacity: isTable ? (table?.capacity ?? 2) : (elStyle.capacity ?? 0),
      chairStyle: elStyle.chairStyle ?? 'auto',
      color: elStyle.color ?? 'neutral',
      points: el.kind === 'POLYGON' ? (elStyle.points ?? []) : undefined,
    }
  })
}

function canvasReducer(state, action) {
  switch (action.type) {
    case 'LOAD':
      return { elements: action.elements, dirty: false }
    case 'ADD': {
      // FLOOR_ZONE and POLYGON go to beginning (render behind everything)
      const els = (action.element.kind === 'FLOOR_ZONE' || action.element.kind === 'POLYGON')
        ? [action.element, ...state.elements]
        : [...state.elements, action.element]
      return { elements: els, dirty: true }
    }
    case 'MOVE': {
      return {
        elements: state.elements.map((el) => {
          if (el.id !== action.id) return el
          const newX = Math.max(0, action.x)
          const newY = Math.max(0, action.y)
          if (el.kind === 'POLYGON' && el.points?.length) {
            const ddx = newX - el.x
            const ddy = newY - el.y
            return { ...el, x: newX, y: newY, points: el.points.map((p) => ({ x: p.x + ddx, y: p.y + ddy })) }
          }
          return { ...el, x: newX, y: newY }
        }),
        dirty: true,
      }
    }
    case 'RESIZE':
      return {
        elements: state.elements.map((el) =>
          el.id === action.id
            ? { ...el, width: Math.max(20, action.width), height: Math.max(20, action.height) }
            : el,
        ),
        dirty: true,
      }
    case 'UPDATE':
      return {
        elements: state.elements.map((el) =>
          el.id === action.id ? { ...el, ...action.patch } : el,
        ),
        dirty: true,
      }
    case 'REMOVE':
      return { elements: state.elements.filter((el) => el.id !== action.id), dirty: true }
    case 'BRING_FORWARD': {
      const idx = state.elements.findIndex((e) => e.id === action.id)
      if (idx < 0 || idx === state.elements.length - 1) return state
      const els = [...state.elements]
      ;[els[idx], els[idx + 1]] = [els[idx + 1], els[idx]]
      return { elements: els, dirty: true }
    }
    case 'SEND_BACKWARD': {
      const idx = state.elements.findIndex((e) => e.id === action.id)
      if (idx <= 0) return state
      const els = [...state.elements]
      ;[els[idx - 1], els[idx]] = [els[idx], els[idx - 1]]
      return { elements: els, dirty: true }
    }
    default:
      return state
  }
}

// History-aware reducer wrapper for undo/redo (up to 50 steps)
function useHistoryReducer(reducer, initialState) {
  const [hist, setHist] = useState({ past: [], present: initialState, future: [] })
  const dispatch = useCallback((action) => {
    if (action.type === 'UNDO') {
      setHist((h) => h.past.length === 0 ? h : {
        past: h.past.slice(0, -1),
        present: h.past[h.past.length - 1],
        future: [h.present, ...h.future],
      })
      return
    }
    if (action.type === 'REDO') {
      setHist((h) => h.future.length === 0 ? h : {
        past: [...h.past, h.present],
        present: h.future[0],
        future: h.future.slice(1),
      })
      return
    }
    setHist((h) => ({
      past: action.type === 'LOAD' ? [] : [...h.past.slice(-49), h.present],
      present: reducer(h.present, action),
      future: [],
    }))
  }, [reducer])
  return [hist.present, dispatch, hist.past.length > 0, hist.future.length > 0]
}

export default function PosFloorPlannerScreen() {
  const [outletId, setOutletId] = useState('')
  const [floorId, setFloorId] = useState('')
  const [activeTool, setActiveTool] = useState('SELECT')
  const [selectedId, setSelectedId] = useState(null)

  const [newFloorDialog, setNewFloorDialog] = useState(false)
  const [newFloorName, setNewFloorName] = useState('')
  const [editFloorDialog, setEditFloorDialog] = useState(false)
  const [editFloorName, setEditFloorName] = useState('')
  const [mobileToolsOpen, setMobileToolsOpen] = useState(false)
  const [mobilePropsOpen, setMobilePropsOpen] = useState(false)

  const [zoom, setZoom] = useState(1)
  const [showGrid, setShowGrid] = useState(true)
  const [showRulers, setShowRulers] = useState(true)
  const [toolboxCollapsed, setToolboxCollapsed] = useState(false)
  const [propsCollapsed, setPropsCollapsed] = useState(false)

  const tempIdRef = useRef(0)
  const clipboardRef = useRef(null)
  const [canvas, dispatch, canUndo, canRedo] = useHistoryReducer(canvasReducer, { elements: [], dirty: false })

  // Refs so the keydown closure stays stable (only re-registers on floorId change)
  const selectedIdRef     = useRef(selectedId)
  const canvasElementsRef = useRef(canvas.elements)
  useEffect(() => { selectedIdRef.current = selectedId }, [selectedId])
  useEffect(() => { canvasElementsRef.current = canvas.elements }, [canvas.elements])

  const { data: outlets = [] } = usePosOutlets()
  const { data: floors = [] } = usePosFloors(outletId ? { outletId } : {})
  const { data: floor } = usePosFloorDetail(floorId)

  const createFloor = useCreatePosFloor()
  const updateFloor = useUpdatePosFloor()
  const saveLayout = useSaveFloorLayout()
  const publishFloor = usePublishFloor()

  useEffect(() => {
    if (!floor?.id) return
    dispatch({ type: 'LOAD', elements: elementsFromFloor(floor) })
    setSelectedId(null)
    setActiveTool('SELECT')
  }, [floor?.id])

  // Keyboard shortcuts
  // Keyboard shortcuts — uses capture phase so it fires before any child handler.
  // Reads selectedId and canvas.elements via refs to avoid re-registering on every state change.
  useEffect(() => {
    if (!floorId) return
    function onKeyDown(e) {
      if (e.target.closest('input, textarea, [contenteditable], [role="dialog"]')) return
      const ctrl = e.ctrlKey || e.metaKey
      const sel      = selectedIdRef.current
      const elements = canvasElementsRef.current

      if (ctrl && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault()
        dispatch({ type: 'UNDO' })
        setSelectedId(null)
        return
      }
      if (ctrl && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
        e.preventDefault()
        dispatch({ type: 'REDO' })
        setSelectedId(null)
        return
      }
      if (ctrl && (e.key === '+' || e.key === '=')) {
        e.preventDefault()
        setZoom((z) => Math.min(3, Math.round((z + 0.25) * 100) / 100))
        return
      }
      if (ctrl && e.key === '-') {
        e.preventDefault()
        setZoom((z) => Math.max(0.25, Math.round((z - 0.25) * 100) / 100))
        return
      }
      if (ctrl && e.key === '0') {
        e.preventDefault()
        setZoom(1)
        return
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && sel) {
        e.preventDefault()
        dispatch({ type: 'REMOVE', id: sel })
        setSelectedId(null)
        return
      }
      if (ctrl && e.key.toLowerCase() === 'c' && sel) {
        e.preventDefault()
        const el = elements.find((el) => el.id === sel)
        if (el) clipboardRef.current = el
        return
      }
      if (ctrl && e.key.toLowerCase() === 'v' && clipboardRef.current) {
        e.preventDefault()
        const el = clipboardRef.current
        const newId = `temp_${++tempIdRef.current}`
        dispatch({ type: 'ADD', element: { ...el, id: newId, x: el.x + 20, y: el.y + 20 } })
        setSelectedId(newId)
        return
      }
      if (ctrl && e.key.toLowerCase() === 'd' && sel) {
        e.preventDefault()
        const el = elements.find((el) => el.id === sel)
        if (el) {
          const newId = `temp_${++tempIdRef.current}`
          dispatch({ type: 'ADD', element: { ...el, id: newId, x: el.x + 20, y: el.y + 20 } })
          setSelectedId(newId)
        }
        return
      }
      if (e.key === 'Escape') {
        setSelectedId(null)
        setActiveTool('SELECT')
        return
      }
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && sel) {
        e.preventDefault()
        const nudge = e.shiftKey ? 10 : 1
        const el = elements.find((el) => el.id === sel)
        if (!el) return
        const dx = e.key === 'ArrowLeft' ? -nudge : e.key === 'ArrowRight' ? nudge : 0
        const dy = e.key === 'ArrowUp' ? -nudge : e.key === 'ArrowDown' ? nudge : 0
        dispatch({ type: 'MOVE', id: sel, x: el.x + dx, y: el.y + dy })
      }
    }
    window.addEventListener('keydown', onKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true })
  }, [floorId])

  function handleZoomChange(delta) {
    setZoom((z) => Math.max(0.25, Math.min(3, Math.round((z + delta) * 100) / 100)))
  }

  function handleContextAction(action, elementId) {
    switch (action) {
      case 'copy': {
        const el = canvas.elements.find((e) => e.id === elementId)
        if (el) clipboardRef.current = el
        break
      }
      case 'paste': {
        if (!clipboardRef.current) break
        const el = clipboardRef.current
        const newId = `temp_${++tempIdRef.current}`
        dispatch({ type: 'ADD', element: { ...el, id: newId, x: el.x + 20, y: el.y + 20 } })
        setSelectedId(newId)
        break
      }
      case 'duplicate': {
        const el = canvas.elements.find((e) => e.id === elementId)
        if (el) {
          const newId = `temp_${++tempIdRef.current}`
          dispatch({ type: 'ADD', element: { ...el, id: newId, x: el.x + 20, y: el.y + 20 } })
          setSelectedId(newId)
        }
        break
      }
      case 'delete': {
        dispatch({ type: 'REMOVE', id: elementId })
        setSelectedId(null)
        break
      }
      case 'bringForward':
        dispatch({ type: 'BRING_FORWARD', id: elementId })
        break
      case 'sendBackward':
        dispatch({ type: 'SEND_BACKWARD', id: elementId })
        break
    }
  }

  function handleOutletChange(id) {
    setOutletId(id)
    setFloorId('')
    setSelectedId(null)
    dispatch({ type: 'LOAD', elements: [] })
  }

  function handleFloorChange(id) {
    setFloorId(id)
    setSelectedId(null)
  }

  function handlePlace(kind, x, y, drawnW, drawnH, meta = {}) {
    if (kind === 'POLYGON') {
      if (!meta.points?.length) return
      const newId = `temp_${++tempIdRef.current}`
      dispatch({
        type: 'ADD',
        element: {
          id: newId,
          kind: 'POLYGON',
          x: Math.round(x),
          y: Math.round(y),
          width: Math.round(drawnW ?? 100),
          height: Math.round(drawnH ?? 80),
          label: 'Área',
          tableId: null, tableName: '',
          capacity: 0, chairStyle: 'auto', color: 'neutral',
          points: meta.points,
        },
      })
      setSelectedId(newId)
      setActiveTool('SELECT')
      return
    }
    const defaultSizes = DEFAULT_SIZES[kind] ?? { width: 80, height: 80 }
    const hasDrawnSize = drawnW != null && drawnH != null
    const width  = hasDrawnSize ? drawnW : defaultSizes.width
    const height = hasDrawnSize ? drawnH : defaultSizes.height
    const finalX = hasDrawnSize ? Math.round(x) : Math.round(x - width / 2)
    const finalY = hasDrawnSize ? Math.round(y) : Math.round(y - height / 2)
    const tableCount = canvas.elements.filter((el) => el.kind.startsWith('TABLE_')).length
    const isTable = kind.startsWith('TABLE_')
    dispatch({
      type: 'ADD',
      element: {
        id: `temp_${++tempIdRef.current}`,
        kind,
        x: finalX,
        y: finalY,
        width,
        height,
        label: kind === 'FLOOR_ZONE' ? 'Zona' : null,
        tableId: null,
        tableName: isTable ? `Mesa ${tableCount + 1}` : '',
        capacity: isTable ? 2 : 0,
        chairStyle: isTable ? 'auto' : undefined,
        color: kind === 'FLOOR_ZONE' ? 'neutral' : undefined,
      },
    })
    setActiveTool('SELECT')
  }

  function handleSave() {
    const payload = canvas.elements.map((el) => {
      const item = {
        ...(String(el.id).startsWith('temp_') ? {} : { id: el.id }),
        kind: el.kind,
        x: el.x,
        y: el.y,
        width: el.width,
        height: el.height,
        label: el.label || null,
        tableName: el.tableName || null,
        capacity: typeof el.capacity === 'number' ? el.capacity : undefined,
        chairStyle: el.chairStyle ?? undefined,
        color: el.color ?? undefined,
      }
      if (el.kind === 'POLYGON' && el.points?.length) {
        item.style = { points: el.points }
      }
      return item
    })
    saveLayout.mutate(
      { id: floorId, elements: payload },
      {
        onSuccess: (res) => {
          dispatch({ type: 'LOAD', elements: elementsFromFloor(res?.data ?? res) })
        },
      },
    )
  }

  function handlePublish() {
    publishFloor.mutate(floorId)
  }

  function handleCreateFloor() {
    if (!newFloorName.trim() || !outletId) return
    createFloor.mutate(
      { name: newFloorName.trim(), outletId },
      {
        onSuccess: (res) => {
          const created = res?.data ?? res
          setNewFloorDialog(false)
          setNewFloorName('')
          setFloorId(created.id)
        },
      },
    )
  }

  function openEditFloor() {
    if (!activeFloor) return
    setEditFloorName(activeFloor.name)
    setEditFloorDialog(true)
  }

  function handleEditFloor() {
    if (!editFloorName.trim() || !floorId) return
    updateFloor.mutate(
      { id: floorId, name: editFloorName.trim() },
      { onSuccess: () => setEditFloorDialog(false) },
    )
  }

  const handleMove = useCallback(
    (id, x, y) => dispatch({ type: 'MOVE', id, x, y }),
    [],
  )
  const handleResize = useCallback(
    (id, w, h) => dispatch({ type: 'RESIZE', id, width: w, height: h }),
    [],
  )
  const handleVertexMove = useCallback(
    (id, points, bounds) => dispatch({ type: 'UPDATE', id, patch: { points, ...bounds } }),
    [],
  )

  const handleAddVertex = useCallback((id, afterIndex, point) => {
    const el = canvas.elements.find((e) => e.id === id)
    if (!el?.points) return
    const newPts = [...el.points.slice(0, afterIndex + 1), point, ...el.points.slice(afterIndex + 1)]
    const xs = newPts.map((p) => p.x)
    const ys = newPts.map((p) => p.y)
    dispatch({ type: 'UPDATE', id, patch: {
      points: newPts,
      x: Math.max(0, Math.min(...xs)),
      y: Math.max(0, Math.min(...ys)),
      width: Math.max(10, Math.max(...xs) - Math.min(...xs)),
      height: Math.max(10, Math.max(...ys) - Math.min(...ys)),
    }})
  }, [canvas.elements])

  const handleDeleteVertex = useCallback((id, index) => {
    const el = canvas.elements.find((e) => e.id === id)
    if (!el?.points || el.points.length <= 3) return
    const newPts = el.points.filter((_, i) => i !== index)
    const xs = newPts.map((p) => p.x)
    const ys = newPts.map((p) => p.y)
    dispatch({ type: 'UPDATE', id, patch: {
      points: newPts,
      x: Math.max(0, Math.min(...xs)),
      y: Math.max(0, Math.min(...ys)),
      width: Math.max(10, Math.max(...xs) - Math.min(...xs)),
      height: Math.max(10, Math.max(...ys) - Math.min(...ys)),
    }})
  }, [canvas.elements])
  const handleUpdate = useCallback(
    (patch) => {
      if (!selectedId) return
      dispatch({ type: 'UPDATE', id: selectedId, patch })
    },
    [selectedId],
  )
  const handleRemove = useCallback(() => {
    if (!selectedId) return
    dispatch({ type: 'REMOVE', id: selectedId })
    setSelectedId(null)
  }, [selectedId])

  const selectedElement = canvas.elements.find((el) => el.id === selectedId) ?? null
  const activeFloor = floors.find((f) => f.id === floorId)

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <div className="border-b border-border bg-card shrink-0">

        {/* Mobile: 2-row compact layout */}
        <div className="md:hidden">
          <div className="flex items-center justify-between px-4 pt-3 pb-2 gap-3">
            <div className="min-w-0">
              <h1 className="text-sm font-semibold leading-tight truncate">Diseñador de planos</h1>
            </div>
            {floorId && (
              <div className="flex items-center gap-1.5 shrink-0">
                {activeFloor?.isActive && (
                  <Badge variant="secondary" className="text-xs">Activo</Badge>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSave}
                  disabled={!canvas.dirty || saveLayout.isPending}
                >
                  {saveLayout.isPending ? '...' : 'Guardar'}
                </Button>
                <Button
                  size="sm"
                  onClick={handlePublish}
                  disabled={activeFloor?.isActive || publishFloor.isPending || canvas.dirty}
                >
                  {publishFloor.isPending ? '...' : 'Publicar'}
                </Button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 px-4 pb-3 flex-wrap">
            <div className="flex-1 min-w-0">
              <SelectField
                value={outletId}
                onChange={handleOutletChange}
                options={outlets.map((o) => ({ value: o.id, label: o.name }))}
                placeholder="Sucursal"
              />
            </div>
            <div className="flex-1 min-w-0">
              <SelectField
                value={floorId}
                onChange={handleFloorChange}
                options={floors.map((f) => ({ value: f.id, label: f.name }))}
                placeholder={
                  !outletId ? 'Elige sucursal'
                  : floors.length === 0 ? 'Sin planos'
                  : 'Plano'
                }
                disabled={!outletId}
              />
            </div>
            {outletId && (
              <Button size="sm" variant="outline" onClick={() => setNewFloorDialog(true)}>
                + Plano
              </Button>
            )}
            {floorId && (
              <Button
                size="icon"
                variant="ghost"
                className="h-9 w-9 text-muted-foreground"
                onClick={openEditFloor}
                title="Renombrar plano"
              >
                <Pencil size={14} />
              </Button>
            )}
          </div>
        </div>

        {/* Desktop: compact single-row layout */}
        <div className="hidden md:flex items-center gap-3 px-4 py-1.5 flex-wrap">
          <h1 className="text-sm font-semibold shrink-0">Diseñador de planos</h1>
          <div className="w-px h-4 bg-border/60 shrink-0" />
          <div className="flex items-center gap-2 flex-1 min-w-0 flex-wrap">
            <div className="w-44">
              <SelectField
                value={outletId}
                onChange={handleOutletChange}
                options={outlets.map((o) => ({ value: o.id, label: o.name }))}
                placeholder="Sucursal"
              />
            </div>
            <div className="w-44">
              <SelectField
                value={floorId}
                onChange={handleFloorChange}
                options={floors.map((f) => ({ value: f.id, label: f.name }))}
                placeholder={
                  !outletId
                    ? 'Elige sucursal primero'
                    : floors.length === 0
                      ? 'Sin planos'
                      : 'Plano'
                }
                disabled={!outletId}
              />
            </div>
            {outletId && (
              <Button size="sm" variant="outline" onClick={() => setNewFloorDialog(true)}>
                + Plano
              </Button>
            )}
            {floorId && (
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                onClick={openEditFloor}
                title="Renombrar plano"
              >
                <Pencil size={14} />
              </Button>
            )}
          </div>
          {floorId && (
            <div className="flex items-center gap-2 shrink-0">
              {activeFloor?.isActive && (
                <Badge variant="secondary" className="text-xs">Activo</Badge>
              )}
              {canvas.dirty && (
                <span className="text-xs text-muted-foreground hidden sm:inline">Sin guardar</span>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={handleSave}
                disabled={!canvas.dirty || saveLayout.isPending}
              >
                {saveLayout.isPending ? 'Guardando...' : 'Guardar'}
              </Button>
              <Button
                size="sm"
                onClick={handlePublish}
                disabled={activeFloor?.isActive || publishFloor.isPending || canvas.dirty}
              >
                {publishFloor.isPending ? 'Publicando...' : 'Publicar'}
              </Button>
            </div>
          )}
        </div>
      </div>

      {!floorId ? (
        <div className="flex-1 flex items-center justify-center">
          <EmptyState
            title={outletId ? 'Selecciona o crea un plano' : 'Selecciona una sucursal'}
            description={
              outletId
                ? 'Elige un plano existente o crea uno nuevo con el botón "+ Plano".'
                : 'Elige la sucursal en la barra superior para ver sus planos.'
            }
          />
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          {/* Toolbox sidebar — desktop only */}
          <div className="hidden md:block md:shrink-0">
            <FloorToolbox
              activeTool={activeTool}
              onToolChange={setActiveTool}
              collapsed={toolboxCollapsed}
              onToggleCollapse={() => setToolboxCollapsed((c) => !c)}
            />
          </div>

          {/* Canvas */}
          <div className="relative flex-1 overflow-hidden">
            <FloorCanvas
              floor={floor}
              elements={canvas.elements}
              selectedId={selectedId}
              activeTool={activeTool}
              hasClipboard={clipboardRef.current != null}
              zoom={zoom}
              showGrid={showGrid}
              showRulers={showRulers}
              onSelect={setSelectedId}
              onMove={handleMove}
              onResize={handleResize}
              onPlace={handlePlace}
              onVertexMove={handleVertexMove}
              onAddVertex={handleAddVertex}
              onDeleteVertex={handleDeleteVertex}
              onContextAction={handleContextAction}
              onZoomChange={handleZoomChange}
            />

            {/* Floating zoom + grid controls — desktop */}
            <div className="hidden md:flex absolute bottom-4 right-4 items-center gap-1 z-20 bg-card/95 border border-border rounded-lg shadow-md px-2 py-1.5 backdrop-blur-sm">
              <button
                type="button"
                onClick={() => dispatch({ type: 'UNDO' })}
                disabled={!canUndo}
                title="Deshacer (Ctrl+Z)"
                className="w-7 h-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <RotateCcw size={13} />
              </button>
              <button
                type="button"
                onClick={() => dispatch({ type: 'REDO' })}
                disabled={!canRedo}
                title="Rehacer (Ctrl+Y)"
                className="w-7 h-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                style={{ transform: 'scaleX(-1)' }}
              >
                <RotateCcw size={13} />
              </button>
              <div className="w-px h-4 bg-border mx-0.5" />
              <button
                type="button"
                onClick={() => handleZoomChange(-0.25)}
                disabled={zoom <= 0.25}
                title="Alejar (Ctrl+-)"
                className="w-7 h-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ZoomOut size={13} />
              </button>
              <button
                type="button"
                onClick={() => setZoom(1)}
                title="Restablecer zoom (Ctrl+0)"
                className="w-12 h-7 flex items-center justify-center rounded text-xs font-mono text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                type="button"
                onClick={() => handleZoomChange(0.25)}
                disabled={zoom >= 3}
                title="Acercar (Ctrl++)"
                className="w-7 h-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ZoomIn size={13} />
              </button>
              <div className="w-px h-4 bg-border mx-0.5" />
              <button
                type="button"
                onClick={() => setShowGrid((g) => !g)}
                title={showGrid ? 'Ocultar cuadrícula' : 'Mostrar cuadrícula'}
                className={['w-7 h-7 flex items-center justify-center rounded transition-colors',
                  showGrid ? 'text-primary bg-primary/10 hover:bg-primary/20' : 'text-muted-foreground hover:text-foreground hover:bg-muted'].join(' ')}
              >
                <Grid size={13} />
              </button>
              <button
                type="button"
                onClick={() => setShowRulers((r) => !r)}
                title={showRulers ? 'Ocultar reglas' : 'Mostrar reglas'}
                className={['w-7 h-7 flex items-center justify-center rounded transition-colors',
                  showRulers ? 'text-primary bg-primary/10 hover:bg-primary/20' : 'text-muted-foreground hover:text-foreground hover:bg-muted'].join(' ')}
              >
                <Ruler size={13} />
              </button>
            </div>

            {/* Mobile floating action buttons */}
            <div className="md:hidden absolute bottom-4 left-3 flex flex-col gap-2 z-20">
              <button
                type="button"
                onClick={() => setMobileToolsOpen(true)}
                className="flex items-center gap-2 h-10 px-3.5 rounded-xl bg-card border border-border shadow-md text-sm font-medium text-foreground active:scale-95 transition-transform"
              >
                <LayoutGrid size={15} />
                Elementos
              </button>
              {selectedElement && (
                <button
                  type="button"
                  onClick={() => setMobilePropsOpen(true)}
                  className="flex items-center gap-2 h-10 px-3.5 rounded-xl bg-primary text-primary-foreground shadow-md text-sm font-medium active:scale-95 transition-transform"
                >
                  <Settings2 size={15} />
                  Editar
                </button>
              )}
            </div>
          </div>

          {/* Properties panel — desktop only, always rendered so collapse works */}
          <div className="hidden md:block md:shrink-0">
            <FloorPropertiesPanel
              element={selectedElement}
              onUpdate={handleUpdate}
              onRemove={handleRemove}
              collapsed={propsCollapsed}
              onToggleCollapse={() => setPropsCollapsed((c) => !c)}
            />
          </div>
        </div>
      )}

      {/* ── Mobile Sheets ─────────────────────────────────────────────────── */}

      {/* Toolbox sheet */}
      <Sheet open={mobileToolsOpen} onOpenChange={setMobileToolsOpen}>
        <SheetContent side="bottom" aria-describedby={undefined}>
          <SheetHeader>
            <SheetTitle>Elementos</SheetTitle>
          </SheetHeader>
          <div className="overflow-y-auto -mx-6 px-2">
            <FloorToolboxContent
              activeTool={activeTool}
              onToolChange={(t) => { setActiveTool(t); setMobileToolsOpen(false) }}
              showHints={false}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Properties sheet */}
      <Sheet open={mobilePropsOpen} onOpenChange={setMobilePropsOpen}>
        <SheetContent side="bottom" aria-describedby={undefined}>
          <SheetHeader>
            <SheetTitle>Propiedades</SheetTitle>
          </SheetHeader>
          {selectedElement && (
            <FloorPropertiesPanel
              element={selectedElement}
              onUpdate={handleUpdate}
              onRemove={() => { handleRemove(); setMobilePropsOpen(false) }}
              className="flex flex-col overflow-y-auto"
            />
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={newFloorDialog} onOpenChange={(v) => { setNewFloorDialog(v); if (!v) setNewFloorName('') }}>
        <DialogContent className="max-w-xs md:min-h-0">
          <DialogHeader>
            <DialogTitle>Nuevo plano</DialogTitle>
            <DialogDescription>Dale un nombre al plano de esta sucursal.</DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <TextField
              label="Nombre del plano"
              placeholder="Ej. Planta baja, Terraza..."
              value={newFloorName}
              onChange={(e) => setNewFloorName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateFloor()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setNewFloorDialog(false); setNewFloorName('') }}>
              Cancelar
            </Button>
            <Button onClick={handleCreateFloor} disabled={!newFloorName.trim() || createFloor.isPending}>
              {createFloor.isPending ? 'Creando...' : 'Crear plano'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editFloorDialog} onOpenChange={setEditFloorDialog}>
        <DialogContent className="max-w-xs md:min-h-0">
          <DialogHeader>
            <DialogTitle>Renombrar plano</DialogTitle>
            <DialogDescription>Cambia el nombre de "{activeFloor?.name}".</DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <TextField
              label="Nombre del plano"
              value={editFloorName}
              onChange={(e) => setEditFloorName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleEditFloor()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditFloorDialog(false)}>Cancelar</Button>
            <Button onClick={handleEditFloor} disabled={!editFloorName.trim() || updateFloor.isPending}>
              {updateFloor.isPending ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
