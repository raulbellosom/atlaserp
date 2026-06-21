import { useReducer, useState, useEffect, useCallback, useRef } from 'react'
import {
  PageHeader,
  Button,
  SelectField,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Input,
  EmptyState,
  Badge,
} from '@atlas/ui'
import { usePosOutlets } from '../hooks/usePosSettings'
import {
  usePosFloors,
  usePosFloorDetail,
  useCreatePosFloor,
  useSaveFloorLayout,
  usePublishFloor,
} from '../hooks/usePosFloor'
import FloorCanvas from '../components/FloorCanvas'
import FloorToolbox from '../components/FloorToolbox'
import FloorPropertiesPanel from '../components/FloorPropertiesPanel'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_SIZES = {
  TABLE_SQUARE: { width: 80, height: 80 },
  TABLE_ROUND: { width: 80, height: 80 },
  BAR: { width: 200, height: 60 },
  WALL: { width: 150, height: 20 },
  PLANT: { width: 40, height: 40 },
  DOOR: { width: 60, height: 20 },
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function elementsFromFloor(floor) {
  if (!floor?.elements) return []
  return floor.elements.map((el) => {
    const table = floor.tables?.find((t) => t.id === el.tableId)
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
      capacity: table?.capacity ?? 2,
    }
  })
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

function canvasReducer(state, action) {
  switch (action.type) {
    case 'LOAD':
      return { elements: action.elements, dirty: false }
    case 'ADD':
      return { elements: [...state.elements, action.element], dirty: true }
    case 'MOVE':
      return {
        elements: state.elements.map((el) =>
          el.id === action.id
            ? { ...el, x: Math.max(0, action.x), y: Math.max(0, action.y) }
            : el
        ),
        dirty: true,
      }
    case 'RESIZE':
      return {
        elements: state.elements.map((el) =>
          el.id === action.id
            ? { ...el, width: Math.max(40, action.width), height: Math.max(40, action.height) }
            : el
        ),
        dirty: true,
      }
    case 'UPDATE':
      return {
        elements: state.elements.map((el) =>
          el.id === action.id ? { ...el, ...action.patch } : el
        ),
        dirty: true,
      }
    case 'REMOVE':
      return { elements: state.elements.filter((el) => el.id !== action.id), dirty: true }
    default:
      return state
  }
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function PosFloorPlannerScreen() {
  const [outletId, setOutletId] = useState('')
  const [floorId, setFloorId] = useState('')
  const [activeTool, setActiveTool] = useState('SELECT')
  const [selectedId, setSelectedId] = useState(null)
  const [newFloorDialog, setNewFloorDialog] = useState(false)
  const [newFloorName, setNewFloorName] = useState('')
  const tempIdRef = useRef(0)

  const [canvas, dispatch] = useReducer(canvasReducer, { elements: [], dirty: false })

  const { data: outlets = [] } = usePosOutlets()
  const { data: floors = [] } = usePosFloors(outletId ? { outletId } : {})
  const { data: floor } = usePosFloorDetail(floorId)

  const createFloor = useCreatePosFloor()
  const saveLayout = useSaveFloorLayout()
  const publishFloor = usePublishFloor()

  // Load floor elements only when floor ID changes (not on background refetch)
  useEffect(() => {
    if (!floor?.id) return
    dispatch({ type: 'LOAD', elements: elementsFromFloor(floor) })
    setSelectedId(null)
    setActiveTool('SELECT')
  }, [floor?.id])

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

  function handlePlace(kind, x, y) {
    const sizes = DEFAULT_SIZES[kind] ?? { width: 80, height: 80 }
    const tableCount = canvas.elements.filter((el) => el.kind.startsWith('TABLE_')).length
    dispatch({
      type: 'ADD',
      element: {
        id: `temp_${++tempIdRef.current}`,
        kind,
        x: Math.round(x - sizes.width / 2),
        y: Math.round(y - sizes.height / 2),
        ...sizes,
        label: null,
        tableId: null,
        tableName: kind.startsWith('TABLE_') ? `Mesa ${tableCount + 1}` : '',
        capacity: 2,
      },
    })
    setActiveTool('SELECT')
  }

  function handleSave() {
    const payload = canvas.elements.map((el) => ({
      ...(el.id.startsWith('temp_') ? {} : { id: el.id }),
      kind: el.kind,
      x: el.x,
      y: el.y,
      width: el.width,
      height: el.height,
      label: el.label ?? null,
      tableName: el.tableName,
      capacity: el.capacity,
    }))
    saveLayout.mutate(
      { id: floorId, elements: payload },
      {
        onSuccess: (res) => {
          dispatch({ type: 'LOAD', elements: elementsFromFloor(res?.data ?? res) })
        },
      }
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
      }
    )
  }

  const handleMove = useCallback((id, x, y) => dispatch({ type: 'MOVE', id, x, y }), [])
  const handleResize = useCallback((id, w, h) => dispatch({ type: 'RESIZE', id, width: w, height: h }), [])
  const handleUpdate = useCallback((patch) => {
    if (!selectedId) return
    dispatch({ type: 'UPDATE', id: selectedId, patch })
  }, [selectedId])
  const handleRemove = useCallback(() => {
    if (!selectedId) return
    dispatch({ type: 'REMOVE', id: selectedId })
    setSelectedId(null)
  }, [selectedId])

  const selectedElement = canvas.elements.find((el) => el.id === selectedId) ?? null
  const activeFloor = floors.find((f) => f.id === floorId)

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-card shrink-0 flex-wrap">
        <PageHeader title="Diseñador de planos" className="mr-2" />
        <div className="flex items-center gap-2 flex-wrap">
          <SelectField
            value={outletId}
            onChange={handleOutletChange}
            options={outlets.map((o) => ({ value: o.id, label: o.name }))}
            placeholder="Sucursal"
            className="w-40"
          />
          <SelectField
            value={floorId}
            onChange={handleFloorChange}
            options={floors.map((f) => ({ value: f.id, label: f.name }))}
            placeholder="Plano"
            className="w-40"
            disabled={!outletId}
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => setNewFloorDialog(true)}
            disabled={!outletId}
          >
            + Plano
          </Button>
        </div>
        {floorId && (
          <div className="flex items-center gap-2 ml-auto pl-2 border-l border-border">
            {activeFloor?.isActive && <Badge variant="default">Activo</Badge>}
            {canvas.dirty && (
              <span className="text-xs text-muted-foreground">Sin guardar</span>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={handleSave}
              disabled={!canvas.dirty || saveLayout.isPending}
            >
              Guardar
            </Button>
            <Button
              size="sm"
              onClick={handlePublish}
              disabled={activeFloor?.isActive || publishFloor.isPending || canvas.dirty}
            >
              Publicar
            </Button>
          </div>
        )}
      </div>

      {/* Main area */}
      {!floorId ? (
        <div className="flex-1 flex items-center justify-center">
          <EmptyState
            title="Selecciona un plano"
            description={
              outletId
                ? 'Selecciona un plano existente o crea uno nuevo con el boton + Plano.'
                : 'Primero selecciona una sucursal en la barra superior.'
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
            onSelect={setSelectedId}
            onMove={handleMove}
            onResize={handleResize}
            onPlace={handlePlace}
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

      {/* New floor dialog */}
      <Dialog open={newFloorDialog} onOpenChange={setNewFloorDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo plano</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Nombre del plano (ej. Planta baja)"
              value={newFloorName}
              onChange={(e) => setNewFloorName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateFloor()}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNewFloorDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleCreateFloor}
              disabled={!newFloorName.trim() || createFloor.isPending}
            >
              Crear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
