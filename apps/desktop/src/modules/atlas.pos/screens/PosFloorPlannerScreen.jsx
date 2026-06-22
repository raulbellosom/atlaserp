import { useReducer, useState, useEffect, useCallback, useRef } from 'react'
import { Pencil } from 'lucide-react'
import {
  Button, Label, SelectField, Badge,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
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
import FloorToolbox from '../components/FloorToolbox'
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

export default function PosFloorPlannerScreen() {
  const [outletId, setOutletId] = useState('')
  const [floorId, setFloorId] = useState('')
  const [activeTool, setActiveTool] = useState('SELECT')
  const [selectedId, setSelectedId] = useState(null)

  const [newFloorDialog, setNewFloorDialog] = useState(false)
  const [newFloorName, setNewFloorName] = useState('')
  const [editFloorDialog, setEditFloorDialog] = useState(false)
  const [editFloorName, setEditFloorName] = useState('')

  const tempIdRef = useRef(0)
  const clipboardRef = useRef(null)
  const [canvas, dispatch] = useReducer(canvasReducer, { elements: [], dirty: false })

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
  useEffect(() => {
    if (!floorId) return
    function onKeyDown(e) {
      // Don't fire when typing in inputs
      if (e.target.closest('input, textarea, [contenteditable], [role="dialog"]')) return
      const ctrl = e.ctrlKey || e.metaKey

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        e.preventDefault()
        dispatch({ type: 'REMOVE', id: selectedId })
        setSelectedId(null)
        return
      }
      if (ctrl && e.key.toLowerCase() === 'c' && selectedId) {
        e.preventDefault()
        const el = canvas.elements.find((el) => el.id === selectedId)
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
      if (ctrl && e.key.toLowerCase() === 'd' && selectedId) {
        e.preventDefault()
        const el = canvas.elements.find((el) => el.id === selectedId)
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
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && selectedId) {
        e.preventDefault()
        const nudge = e.shiftKey ? 10 : 1
        const el = canvas.elements.find((el) => el.id === selectedId)
        if (!el) return
        const dx = e.key === 'ArrowLeft' ? -nudge : e.key === 'ArrowRight' ? nudge : 0
        const dy = e.key === 'ArrowUp' ? -nudge : e.key === 'ArrowDown' ? nudge : 0
        dispatch({ type: 'MOVE', id: selectedId, x: el.x + dx, y: el.y + dy })
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [floorId, selectedId, canvas.elements])

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
      {/* Toolbar */}
      <div className="flex items-center gap-4 px-4 py-2.5 border-b border-border bg-card shrink-0 flex-wrap">
        <div className="shrink-0">
          <h1 className="text-sm font-semibold leading-tight">Diseñador de planos</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Crea y edita el layout de tus sucursales</p>
        </div>

        <div className="flex items-end gap-2 flex-1 min-w-0 flex-wrap">
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">Sucursal</Label>
            <div className="w-44">
              <SelectField
                value={outletId}
                onChange={handleOutletChange}
                options={outlets.map((o) => ({ value: o.id, label: o.name }))}
                placeholder="Selecciona sucursal"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">Plano</Label>
            <div className="w-44">
              <SelectField
                value={floorId}
                onChange={handleFloorChange}
                options={floors.map((f) => ({ value: f.id, label: f.name }))}
                placeholder={
                  !outletId
                    ? 'Primero elige sucursal'
                    : floors.length === 0
                      ? 'Sin planos — crea uno'
                      : 'Selecciona plano'
                }
                disabled={!outletId}
              />
            </div>
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
              className="h-9 w-9 text-muted-foreground hover:text-foreground"
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
          <FloorToolbox activeTool={activeTool} onToolChange={setActiveTool} />
          <FloorCanvas
            floor={floor}
            elements={canvas.elements}
            selectedId={selectedId}
            activeTool={activeTool}
            hasClipboard={clipboardRef.current != null}
            onSelect={setSelectedId}
            onMove={handleMove}
            onResize={handleResize}
            onPlace={handlePlace}
            onVertexMove={handleVertexMove}
            onAddVertex={handleAddVertex}
            onDeleteVertex={handleDeleteVertex}
            onContextAction={handleContextAction}
          />
          {selectedElement && (
            <FloorPropertiesPanel
              element={selectedElement}
              onUpdate={handleUpdate}
              onRemove={handleRemove}
            />
          )}
        </div>
      )}

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
