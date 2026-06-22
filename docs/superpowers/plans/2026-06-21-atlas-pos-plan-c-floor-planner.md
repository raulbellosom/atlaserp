# atlas.pos Plan C — Floor Planner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the POS Floor Planner — a visual drag/resize canvas editor for creating, editing, and publishing restaurant floor maps with table and decorative elements.

**Architecture:** Pure CSS absolute-positioning canvas (no canvas API, no third-party DnD libs). Canvas state managed with `useReducer` inside `PosFloorPlannerScreen`. Elements are local-only until "Guardar" calls `PUT /pos/floors/:id/layout`, which bulk-replaces all elements in a DB transaction (creating new PosTable rows for TABLE_ kinds). `useEffect([floor?.id])` loads server data into local reducer only when the selected floor changes.

**Tech Stack:** React + TanStack Query v5, Hono/Prisma backend, `useReducer` for canvas state, `@atlas/ui` (PageHeader, SelectField, Button, Input, EmptyState, ConfirmDialog, Dialog, Badge), Tailwind v4, `sonner` for toasts. No TypeScript.

---

## File map

| File | Action | Responsibility |
|---|---|---|
| `apps/api/src/routes/pos/validators.js` | Modify | Add `floorElementSchema` + `saveLayoutSchema` |
| `apps/api/src/routes/pos/pos-floor-service.js` | Modify | Add `getFloorWithLayout` + `saveLayout` service methods |
| `apps/api/src/routes/pos/pos-routes.js` | Modify | Import `saveLayoutSchema`, update `GET /pos/floors/:id` to return elements+tables, add `PUT /pos/floors/:id/layout` route |
| `packages/sdk/src/index.js` | Modify | Add `saveFloorLayout(id, data, token)` SDK method |
| `apps/desktop/src/modules/atlas.pos/hooks/usePosFloor.js` | Modify | Add `usePosFloorDetail`, `useCreatePosFloor`, `useSaveFloorLayout`, `usePublishFloor` hooks |
| `apps/desktop/src/modules/atlas.pos/components/FloorCanvas.jsx` | Create | Drag/resize canvas with absolutely-positioned elements |
| `apps/desktop/src/modules/atlas.pos/components/FloorToolbox.jsx` | Create | Left sidebar tool palette (SELECT + 6 element kinds) |
| `apps/desktop/src/modules/atlas.pos/components/FloorPropertiesPanel.jsx` | Create | Right sidebar properties for selected element (name, capacity, size, delete) |
| `apps/desktop/src/modules/atlas.pos/screens/PosFloorPlannerScreen.jsx` | Rewrite | Fullscreen composer: outlet/floor selectors, `useReducer` canvas state, save/publish flow |

---

## Prisma schema context (read-only, do NOT edit schema.prisma)

```
PosFloor    { id, companyId, outletId, name, isActive, canvasWidth(default 1200), canvasHeight(default 800) }
PosFloorElement { id, floorId, tableId(nullable), kind, x, y, width, height, rotation(default 0), label(nullable), style(nullable Json) }
PosTable    { id, companyId, floorId, zoneId(nullable), name, capacity(default 2), status, enabled }
```

Element `kind` values: `TABLE_SQUARE`, `TABLE_ROUND`, `BAR`, `WALL`, `PLANT`, `DOOR`.
TABLE_ kinds must link to a `PosTable` row via `tableId`. Non-TABLE kinds have `tableId = null`.

---

## Canvas element shape (local reducer state)

```js
{
  id: string,          // real UUID from DB, OR 'temp_<timestamp>' for unsaved elements
  kind: string,        // TABLE_SQUARE | TABLE_ROUND | BAR | WALL | PLANT | DOOR
  x: number,           // left in px (integer)
  y: number,           // top in px (integer)
  width: number,       // in px
  height: number,      // in px
  label: string|null,  // decorative elements
  tableId: string|null,// real UUID from DB (null for new TABLE_ elements not yet saved)
  tableName: string,   // TABLE_ kinds only (e.g. 'Mesa 1')
  capacity: number,    // TABLE_ kinds only
}
```

Default sizes by kind:
- `TABLE_SQUARE`: 80×80
- `TABLE_ROUND`: 80×80
- `BAR`: 200×60
- `WALL`: 150×20
- `PLANT`: 40×40
- `DOOR`: 60×20

---

## Task 1: Backend — layout endpoint

**Files:**
- Modify: `apps/api/src/routes/pos/validators.js`
- Modify: `apps/api/src/routes/pos/pos-floor-service.js`
- Modify: `apps/api/src/routes/pos/pos-routes.js`

- [ ] **Step 1: Add `floorElementSchema` and `saveLayoutSchema` to validators.js**

Open `apps/api/src/routes/pos/validators.js`. Append after the existing `updateTableSchema` block (around line 167):

```js
export const floorElementSchema = z.object({
  id: uuidSchema.optional(),
  kind: z.enum(['TABLE_SQUARE', 'TABLE_ROUND', 'BAR', 'WALL', 'PLANT', 'DOOR']),
  x: z.coerce.number().min(0),
  y: z.coerce.number().min(0),
  width: z.coerce.number().min(20),
  height: z.coerce.number().min(20),
  label: z.string().max(80).nullable().optional(),
  tableName: z.string().min(1).max(80).optional(),
  capacity: z.coerce.number().int().min(1).max(99).optional(),
  style: z.record(z.unknown()).nullable().optional(),
})

export const saveLayoutSchema = z.object({
  elements: z.array(floorElementSchema).max(500),
})
```

- [ ] **Step 2: Add `getFloorWithLayout` and `saveLayout` to pos-floor-service.js**

Open `apps/api/src/routes/pos/pos-floor-service.js`. Add these two functions inside `createPosFloorService`, after the existing `getFloorById` function:

```js
async function getFloorWithLayout({ companyId, id }) {
  const scopedCompanyId = requireCompanyId(companyId)
  const floor = await prisma.posFloor.findFirst({
    where: { id, companyId: scopedCompanyId },
    include: {
      elements: { orderBy: { createdAt: 'asc' } },
      tables: { where: { enabled: true }, orderBy: { createdAt: 'asc' } },
    },
  })
  if (!floor) throw new PosServiceError('Plano POS no encontrado.', 404)
  return floor
}

async function saveLayout({ companyId, id, actorId, elements }) {
  const scopedCompanyId = requireCompanyId(companyId)
  const floor = await prisma.posFloor.findFirst({ where: { id, companyId: scopedCompanyId } })
  if (!floor) throw new PosServiceError('Plano POS no encontrado.', 404)

  const incoming = elements ?? []
  const incomingIds = incoming.filter((e) => e.id).map((e) => e.id)

  await prisma.$transaction(async (tx) => {
    // find elements being removed (to soft-delete their linked tables)
    const removedElements = await tx.posFloorElement.findMany({
      where: { floorId: id, ...(incomingIds.length ? { id: { notIn: incomingIds } } : {}) },
    })

    // delete removed elements
    await tx.posFloorElement.deleteMany({
      where: { floorId: id, ...(incomingIds.length ? { id: { notIn: incomingIds } } : {}) },
    })

    // soft-delete tables from removed elements if no active orders
    for (const elem of removedElements) {
      if (!elem.tableId) continue
      const activeCount = await tx.posOrder.count({
        where: {
          tableId: elem.tableId,
          status: { in: ['DRAFT', 'OPEN', 'SENT', 'PARTIALLY_SERVED', 'SERVED'] },
        },
      })
      if (activeCount === 0) {
        await tx.posTable.update({ where: { id: elem.tableId }, data: { enabled: false } })
      }
    }

    // upsert incoming elements
    for (const elem of incoming) {
      const { id: elemId, kind, x, y, width, height, label, style, tableName, capacity } = elem
      const posData = {
        x,
        y,
        width,
        height,
        rotation: 0,
        label: label ?? null,
        style: style ?? null,
      }

      if (elemId) {
        await tx.posFloorElement.update({ where: { id: elemId }, data: posData })
      } else {
        let tableId = null
        if (kind.startsWith('TABLE_')) {
          const table = await tx.posTable.create({
            data: {
              companyId: scopedCompanyId,
              floorId: id,
              name: (tableName ?? 'Mesa').trim(),
              capacity: capacity ?? 2,
            },
          })
          tableId = table.id
        }
        await tx.posFloorElement.create({
          data: { floorId: id, tableId, kind, ...posData },
        })
      }
    }

    await writeAudit(tx, {
      actorId,
      entityType: 'PosFloor',
      entityId: id,
      action: 'pos.floor.save_layout',
      after: { elementCount: incoming.length },
    })
  })

  return getFloorWithLayout({ companyId: scopedCompanyId, id })
}
```

Also add both to the return object at the bottom of `createPosFloorService`:
```js
return {
  listFloors,
  createFloor,
  getFloorById,
  getFloorWithLayout,   // <-- add
  updateFloor,
  publishFloor,
  createTable,
  updateTable,
  updateTableStatus,
  getActiveMap,
  saveLayout,           // <-- add
}
```

- [ ] **Step 3: Import `saveLayoutSchema` in pos-routes.js and update routes**

In `apps/api/src/routes/pos/pos-routes.js`:

3a. Add `saveLayoutSchema` to the imports from `./validators.js` (the existing import block around line 8):
```js
import {
  addOrderLineSchema,
  cancelOrderSchema,
  cashMovementSchema,
  closeSessionSchema,
  createFloorSchema,
  createGuestSchema,
  createOrderSchema,
  createOutletSchema,
  createPaymentSchema,
  createStationSchema,
  createTableSchema,
  createTerminalSchema,
  kitchenStatusUpdateSchema,
  openSessionSchema,
  saveLayoutSchema,         // <-- add this line
  tableStatusUpdateSchema,
  updateFloorSchema,
  updateOrderLineSchema,
  updateOrderSchema,
  updateOutletSchema,
  updateSettingsSchema,
  updateStationSchema,
  updateTableSchema,
  updateTerminalSchema,
} from "./validators.js";
```

3b. Update `GET /pos/floors/:id` (around line 332) to use `getFloorWithLayout`:

Change:
```js
app.get("/pos/floors/:id", requirePermission("pos.floor.read"), async (c) => {
  try {
    return c.json({ data: await floorSvc.getFloorById({ ...context(c), id: c.req.param("id") }) });
  } catch (err) {
    return handleError(c, err, "No se pudo consultar el plano POS.");
  }
});
```

To:
```js
app.get("/pos/floors/:id", requirePermission("pos.floor.read"), async (c) => {
  try {
    return c.json({ data: await floorSvc.getFloorWithLayout({ ...context(c), id: c.req.param("id") }) });
  } catch (err) {
    return handleError(c, err, "No se pudo consultar el plano POS.");
  }
});
```

3c. Add `PUT /pos/floors/:id/layout` route right after `POST /pos/floors/:id/publish` (around line 355):

```js
app.put("/pos/floors/:id/layout", requirePermission("pos.floor.manage"), async (c) => {
  try {
    const data = await parseBody(c, saveLayoutSchema);
    return c.json({ data: await floorSvc.saveLayout({ ...context(c), id: c.req.param("id"), elements: data.elements }) });
  } catch (err) {
    return handleError(c, err, "No se pudo guardar el layout del plano POS.");
  }
});
```

- [ ] **Step 4: Syntax check API files**

```bash
node --check apps/api/src/routes/pos/validators.js
node --check apps/api/src/routes/pos/pos-floor-service.js
node --check apps/api/src/routes/pos/pos-routes.js
```

Expected: no output (clean).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/pos/validators.js apps/api/src/routes/pos/pos-floor-service.js apps/api/src/routes/pos/pos-routes.js
git commit -m "feat(pos): add floor layout endpoint with bulk element save"
```

---

## Task 2: SDK method + frontend hooks

**Files:**
- Modify: `packages/sdk/src/index.js`
- Modify: `apps/desktop/src/modules/atlas.pos/hooks/usePosFloor.js`

- [ ] **Step 1: Add `saveFloorLayout` SDK method**

In `packages/sdk/src/index.js`, find the existing `publishFloor` method (around line 1087):
```js
publishFloor: (id, token) =>
  request(`/pos/floors/${encodeURIComponent(id)}/publish`, {
    method: "POST",
    headers: withAuthHeaders(token),
  }),
```

Add `saveFloorLayout` immediately after it:
```js
saveFloorLayout: (id, data, token) =>
  request(`/pos/floors/${encodeURIComponent(id)}/layout`, {
    method: "PUT",
    headers: withAuthHeaders(token),
    body: JSON.stringify(data),
  }),
```

- [ ] **Step 2: Add four hooks to usePosFloor.js**

Open `apps/desktop/src/modules/atlas.pos/hooks/usePosFloor.js`. The file currently exports `usePosActiveMap`, `usePosFloors`, `useUpdateTableStatus`. Append the following four exports at the end of the file:

```js
export function usePosFloorDetail(id) {
  const token = useToken()
  return useQuery({
    queryKey: ['pos', 'floors', 'detail', id],
    queryFn: () => atlas.pos.getFloor(id, token),
    select: (res) => res?.data ?? res,
    enabled: Boolean(token) && Boolean(id),
    staleTime: 60 * 1000,
  })
}

export function useCreatePosFloor() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => atlas.pos.createFloor(data, token),
    onMutate: () => ({ toastId: toast.loading('Creando plano...') }),
    onSuccess: (_, __, ctx) => {
      toast.dismiss(ctx?.toastId)
      toast.success('Plano creado')
      qc.invalidateQueries({ queryKey: ['pos', 'floors'] })
    },
    onError: (err, __, ctx) => {
      toast.dismiss(ctx?.toastId)
      toast.error(err?.message ?? 'Error al crear plano')
    },
  })
}

export function useSaveFloorLayout() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, elements }) => atlas.pos.saveFloorLayout(id, { elements }, token),
    onMutate: () => ({ toastId: toast.loading('Guardando plano...') }),
    onSuccess: (_, vars, ctx) => {
      toast.dismiss(ctx?.toastId)
      toast.success('Plano guardado')
      qc.invalidateQueries({ queryKey: ['pos', 'floors', 'detail', vars.id] })
      qc.invalidateQueries({ queryKey: ['pos', 'tables'] })
    },
    onError: (err, __, ctx) => {
      toast.dismiss(ctx?.toastId)
      toast.error(err?.message ?? 'Error al guardar plano')
    },
  })
}

export function usePublishFloor() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => atlas.pos.publishFloor(id, token),
    onMutate: () => ({ toastId: toast.loading('Publicando plano...') }),
    onSuccess: (_, __, ctx) => {
      toast.dismiss(ctx?.toastId)
      toast.success('Plano publicado como activo')
      qc.invalidateQueries({ queryKey: ['pos', 'floors'] })
      qc.invalidateQueries({ queryKey: ['pos', 'tables'] })
    },
    onError: (err, __, ctx) => {
      toast.dismiss(ctx?.toastId)
      toast.error(err?.message ?? 'Error al publicar plano')
    },
  })
}
```

- [ ] **Step 3: Syntax check**

```bash
node --check packages/sdk/src/index.js
node --check apps/desktop/src/modules/atlas.pos/hooks/usePosFloor.js
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add packages/sdk/src/index.js apps/desktop/src/modules/atlas.pos/hooks/usePosFloor.js
git commit -m "feat(pos): add saveFloorLayout SDK method and floor planner hooks"
```

---

## Task 3: FloorCanvas component

**Files:**
- Create: `apps/desktop/src/modules/atlas.pos/components/FloorCanvas.jsx`

The canvas uses CSS absolute positioning inside a fixed-size container div. Interaction model:
- If `activeTool !== 'SELECT'`: clicking the canvas background places a new element at the cursor position (then resets tool to SELECT via `onPlace` callback).
- If `activeTool === 'SELECT'`: clicking background deselects; clicking an element selects it.
- Dragging a selected element moves it (`onMove` callback).
- Dragging the bottom-right corner handle resizes it (`onResize` callback).
- `onMouseMove` / `onMouseUp` are on the scroll-container (not the window) to prevent events leaking.

- [ ] **Step 1: Create FloorCanvas.jsx**

```jsx
import { useRef, useCallback } from 'react'

const ELEMENT_COLORS = {
  TABLE_SQUARE: { base: 'bg-amber-50 border-amber-400', selected: 'bg-primary/10 border-primary' },
  TABLE_ROUND:  { base: 'bg-amber-50 border-amber-400', selected: 'bg-primary/10 border-primary' },
  BAR:   { base: 'bg-slate-200 border-slate-500', selected: 'bg-slate-300 border-primary' },
  WALL:  { base: 'bg-slate-700 border-slate-900 text-white', selected: 'bg-slate-800 border-primary' },
  PLANT: { base: 'bg-green-100 border-green-500', selected: 'bg-green-200 border-primary' },
  DOOR:  { base: 'bg-yellow-50 border-yellow-400', selected: 'bg-yellow-100 border-primary' },
}

export default function FloorCanvas({ floor, elements, selectedId, activeTool, onSelect, onMove, onResize, onPlace }) {
  const containerRef = useRef(null)
  const dragging = useRef(null)

  function handleCanvasClick(e) {
    if (e.target !== containerRef.current && e.target.dataset.canvas !== 'true') return
    if (activeTool !== 'SELECT') {
      const rect = containerRef.current.getBoundingClientRect()
      const scrollEl = containerRef.current.parentElement
      const x = e.clientX - rect.left + (scrollEl?.scrollLeft ?? 0)
      const y = e.clientY - rect.top + (scrollEl?.scrollTop ?? 0)
      onPlace(activeTool, x, y)
    } else {
      onSelect(null)
    }
  }

  function handleElementPointerDown(e, element) {
    e.stopPropagation()
    onSelect(element.id)
    dragging.current = {
      mode: 'move',
      id: element.id,
      startX: e.clientX,
      startY: e.clientY,
      origX: element.x,
      origY: element.y,
    }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function handleResizePointerDown(e, element) {
    e.stopPropagation()
    dragging.current = {
      mode: 'resize',
      id: element.id,
      startX: e.clientX,
      startY: e.clientY,
      origW: element.width,
      origH: element.height,
    }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const handlePointerMove = useCallback((e) => {
    if (!dragging.current) return
    const dx = e.clientX - dragging.current.startX
    const dy = e.clientY - dragging.current.startY
    if (dragging.current.mode === 'move') {
      onMove(dragging.current.id, dragging.current.origX + dx, dragging.current.origY + dy)
    } else {
      onResize(
        dragging.current.id,
        Math.max(40, dragging.current.origW + dx),
        Math.max(40, dragging.current.origH + dy),
      )
    }
  }, [onMove, onResize])

  function handlePointerUp() {
    dragging.current = null
  }

  const canvasW = floor?.canvasWidth ?? 1200
  const canvasH = floor?.canvasHeight ?? 800

  return (
    <div
      className="flex-1 overflow-auto bg-slate-100 select-none"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <div
        data-canvas="true"
        ref={containerRef}
        onClick={handleCanvasClick}
        className={`relative bg-white border border-border shadow-sm m-4 ${
          activeTool !== 'SELECT' ? 'cursor-crosshair' : 'cursor-default'
        }`}
        style={{ width: canvasW, height: canvasH, minWidth: canvasW, minHeight: canvasH }}
      >
        {/* Grid dots */}
        <div
          data-canvas="true"
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(circle, #d1d5db 1px, transparent 1px)',
            backgroundSize: '20px 20px',
          }}
        />
        {elements.map((el) => {
          const isTable = el.kind.startsWith('TABLE_')
          const isRound = el.kind === 'TABLE_ROUND'
          const selected = el.id === selectedId
          const colors = ELEMENT_COLORS[el.kind] ?? ELEMENT_COLORS.BAR

          return (
            <div
              key={el.id}
              onPointerDown={(e) => handleElementPointerDown(e, el)}
              className={`absolute flex flex-col items-center justify-center border-2 text-center cursor-grab active:cursor-grabbing transition-shadow ${
                isRound ? 'rounded-full' : 'rounded-md'
              } ${selected ? colors.selected + ' shadow-md ring-2 ring-primary ring-offset-1' : colors.base}`}
              style={{ left: el.x, top: el.y, width: el.width, height: el.height, zIndex: selected ? 10 : 1 }}
            >
              {isTable && (
                <>
                  <span className="text-xs font-bold leading-tight px-1 truncate w-full text-center">
                    {el.tableName || 'Mesa'}
                  </span>
                  {el.capacity > 0 && (
                    <span className="text-[10px] text-muted-foreground">{el.capacity}p</span>
                  )}
                </>
              )}
              {!isTable && el.label && (
                <span className="text-[10px] leading-tight px-1 truncate">{el.label}</span>
              )}
              {selected && (
                <div
                  onPointerDown={(e) => handleResizePointerDown(e, el)}
                  className="absolute bottom-0 right-0 w-3 h-3 bg-primary rounded-tl cursor-se-resize"
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Syntax check**

```bash
node --check apps/desktop/src/modules/atlas.pos/components/FloorCanvas.jsx
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/modules/atlas.pos/components/FloorCanvas.jsx
git commit -m "feat(pos): add FloorCanvas component with drag and resize interaction"
```

---

## Task 4: FloorToolbox and FloorPropertiesPanel

**Files:**
- Create: `apps/desktop/src/modules/atlas.pos/components/FloorToolbox.jsx`
- Create: `apps/desktop/src/modules/atlas.pos/components/FloorPropertiesPanel.jsx`

- [ ] **Step 1: Create FloorToolbox.jsx**

```jsx
const TOOLS = [
  { id: 'SELECT', label: 'Seleccionar', preview: null },
  null,
  { id: 'TABLE_SQUARE', label: 'Mesa cuadrada', preview: 'square' },
  { id: 'TABLE_ROUND',  label: 'Mesa redonda',  preview: 'round' },
  null,
  { id: 'BAR',   label: 'Barra',  preview: 'bar' },
  { id: 'WALL',  label: 'Pared',  preview: 'wall' },
  { id: 'PLANT', label: 'Planta', preview: 'plant' },
  { id: 'DOOR',  label: 'Puerta', preview: 'door' },
]

function Preview({ type }) {
  if (!type) return <span className="w-4 h-4 text-xs flex items-center justify-center font-bold">&#8598;</span>
  if (type === 'square') return <div className="w-4 h-4 rounded border-2 border-current shrink-0" />
  if (type === 'round')  return <div className="w-4 h-4 rounded-full border-2 border-current shrink-0" />
  if (type === 'bar')    return <div className="w-4 h-2 rounded-sm bg-slate-500 shrink-0" />
  if (type === 'wall')   return <div className="w-4 h-1 bg-slate-700 shrink-0" />
  if (type === 'plant')  return <div className="w-4 h-4 rounded-full bg-green-500 shrink-0" />
  if (type === 'door')   return <div className="w-4 h-2 rounded-sm border border-current shrink-0" />
  return null
}

export default function FloorToolbox({ activeTool, onToolChange }) {
  return (
    <div className="w-44 shrink-0 border-r border-border bg-card flex flex-col overflow-y-auto">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 pt-4 pb-2">
        Herramientas
      </p>
      <div className="flex flex-col gap-0.5 px-2 pb-4">
        {TOOLS.map((tool, i) =>
          tool === null ? (
            <hr key={i} className="border-border my-1.5" />
          ) : (
            <button
              key={tool.id}
              onClick={() => onToolChange(tool.id)}
              className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-left transition-colors ${
                activeTool === tool.id
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <Preview type={tool.preview} />
              {tool.label}
            </button>
          )
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create FloorPropertiesPanel.jsx**

```jsx
import { useState } from 'react'
import { Button, Input, ConfirmDialog } from '@atlas/ui'

const KIND_LABELS = {
  TABLE_SQUARE: 'Mesa cuadrada',
  TABLE_ROUND: 'Mesa redonda',
  BAR: 'Barra',
  WALL: 'Pared',
  PLANT: 'Planta',
  DOOR: 'Puerta',
}

export default function FloorPropertiesPanel({ element, onUpdate, onRemove }) {
  const [deleteOpen, setDeleteOpen] = useState(false)
  const isTable = element.kind.startsWith('TABLE_')

  return (
    <div className="w-56 shrink-0 border-l border-border bg-card flex flex-col overflow-y-auto">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 pt-4 pb-2">
        Propiedades
      </p>
      <div className="flex flex-col gap-3 px-3 pb-4">
        <div>
          <p className="text-xs text-muted-foreground mb-0.5">Tipo</p>
          <p className="text-sm font-medium">{KIND_LABELS[element.kind] ?? element.kind}</p>
        </div>

        {isTable ? (
          <>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Nombre</label>
              <Input
                value={element.tableName ?? ''}
                onChange={(e) => onUpdate({ tableName: e.target.value })}
                placeholder="Mesa 1"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Capacidad</label>
              <Input
                type="number"
                min={1}
                max={99}
                value={element.capacity ?? 2}
                onChange={(e) => onUpdate({ capacity: Math.max(1, Number(e.target.value) || 1) })}
              />
            </div>
          </>
        ) : (
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Etiqueta</label>
            <Input
              value={element.label ?? ''}
              onChange={(e) => onUpdate({ label: e.target.value || null })}
              placeholder="Opcional"
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Ancho</label>
            <Input
              type="number"
              min={40}
              value={Math.round(element.width)}
              onChange={(e) => onUpdate({ width: Math.max(40, Number(e.target.value) || 40) })}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Alto</label>
            <Input
              type="number"
              min={40}
              value={Math.round(element.height)}
              onChange={(e) => onUpdate({ height: Math.max(40, Number(e.target.value) || 40) })}
            />
          </div>
        </div>

        <Button
          variant="destructive"
          size="sm"
          className="mt-1"
          onClick={() => setDeleteOpen(true)}
        >
          Eliminar elemento
        </Button>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={(v) => !v && setDeleteOpen(false)}
        title="Eliminar elemento"
        description={
          isTable
            ? 'La mesa se eliminara del plano. Si tiene ordenes activas, la mesa no podra deshabilitarse hasta que se cierren.'
            : 'Se eliminara este elemento del plano.'
        }
        detail={isTable ? element.tableName : element.label}
        confirmLabel="Eliminar"
        onConfirm={onRemove}
      />
    </div>
  )
}
```

- [ ] **Step 3: Syntax check**

```bash
node --check apps/desktop/src/modules/atlas.pos/components/FloorToolbox.jsx
node --check apps/desktop/src/modules/atlas.pos/components/FloorPropertiesPanel.jsx
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/modules/atlas.pos/components/FloorToolbox.jsx apps/desktop/src/modules/atlas.pos/components/FloorPropertiesPanel.jsx
git commit -m "feat(pos): add FloorToolbox and FloorPropertiesPanel components"
```

---

## Task 5: PosFloorPlannerScreen (compose)

**Files:**
- Rewrite: `apps/desktop/src/modules/atlas.pos/screens/PosFloorPlannerScreen.jsx`

This screen is fullscreen (`h-screen overflow-hidden`), composed of:
- A top header bar: outlet SelectField, floor SelectField, "+ Plano" button, "Guardar" button, "Publicar" button, active badge
- Below: `FloorToolbox` (left) + `FloorCanvas` (center, flex-1) + `FloorPropertiesPanel` (right, only when element selected)
- A Dialog for "Nuevo plano" (name input)

**`useReducer` state shape:**
```js
{ elements: [], dirty: false }
```

**`elementsFromFloor` helper** converts the API floor shape to canvas element shape:
```js
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
```

**`handleSave`** serializes canvas elements for the API (strips `temp_` prefix logic, keeps real `id` only for existing elements):
```js
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
  saveLayout.mutate({ id: floorId, elements: payload }, {
    onSuccess: (res) => {
      dispatch({ type: 'LOAD', elements: elementsFromFloor(res?.data ?? res) })
    },
  })
}
```

**Publish is disabled while there are unsaved changes** (`canvas.dirty === true`) — this forces the user to save first.

- [ ] **Step 1: Write PosFloorPlannerScreen.jsx**

```jsx
import { useReducer, useState, useEffect } from 'react'
import {
  PageHeader, Button, SelectField, Dialog, DialogContent,
  DialogHeader, DialogTitle, DialogFooter, Input, EmptyState, Badge,
} from '@atlas/ui'
import { usePosOutlets } from '../hooks/usePosSettings'
import {
  usePosFloors, usePosFloorDetail, useCreatePosFloor,
  useSaveFloorLayout, usePublishFloor,
} from '../hooks/usePosFloor'
import FloorCanvas from '../components/FloorCanvas'
import FloorToolbox from '../components/FloorToolbox'
import FloorPropertiesPanel from '../components/FloorPropertiesPanel'

const DEFAULT_SIZES = {
  TABLE_SQUARE: { width: 80, height: 80 },
  TABLE_ROUND:  { width: 80, height: 80 },
  BAR:   { width: 200, height: 60 },
  WALL:  { width: 150, height: 20 },
  PLANT: { width: 40,  height: 40 },
  DOOR:  { width: 60,  height: 20 },
}

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

export default function PosFloorPlannerScreen() {
  const [outletId, setOutletId] = useState('')
  const [floorId, setFloorId] = useState('')
  const [activeTool, setActiveTool] = useState('SELECT')
  const [selectedId, setSelectedId] = useState(null)
  const [newFloorDialog, setNewFloorDialog] = useState(false)
  const [newFloorName, setNewFloorName] = useState('')

  const [canvas, dispatch] = useReducer(canvasReducer, { elements: [], dirty: false })

  const { data: outlets = [] } = usePosOutlets()
  const { data: floors = [] } = usePosFloors(outletId ? { outletId } : {})
  const { data: floor } = usePosFloorDetail(floorId)

  const createFloor = useCreatePosFloor()
  const saveLayout = useSaveFloorLayout()
  const publishFloor = usePublishFloor()

  // Load floor elements into canvas when floor ID changes
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
        id: `temp_${Date.now()}`,
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
    saveLayout.mutate({ id: floorId, elements: payload }, {
      onSuccess: (res) => {
        dispatch({ type: 'LOAD', elements: elementsFromFloor(res?.data ?? res) })
      },
    })
  }

  function handlePublish() {
    publishFloor.mutate(floorId)
  }

  function handleCreateFloor() {
    if (!newFloorName.trim() || !outletId) return
    createFloor.mutate({ name: newFloorName.trim(), outletId }, {
      onSuccess: (res) => {
        const created = res?.data ?? res
        setNewFloorDialog(false)
        setNewFloorName('')
        setFloorId(created.id)
      },
    })
  }

  const selectedElement = canvas.elements.find((el) => el.id === selectedId) ?? null
  const activeFloor = floors.find((f) => f.id === floorId)

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-card shrink-0 flex-wrap">
        <PageHeader title="Disenador de plano" className="mr-2" />
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
            {canvas.dirty && <span className="text-xs text-muted-foreground">Sin guardar</span>}
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
            onMove={(id, x, y) => dispatch({ type: 'MOVE', id, x, y })}
            onResize={(id, w, h) => dispatch({ type: 'RESIZE', id, width: w, height: h })}
            onPlace={handlePlace}
          />
          {selectedElement && (
            <FloorPropertiesPanel
              element={selectedElement}
              onUpdate={(patch) => dispatch({ type: 'UPDATE', id: selectedElement.id, patch })}
              onRemove={() => {
                dispatch({ type: 'REMOVE', id: selectedElement.id })
                setSelectedId(null)
              }}
            />
          )}
        </div>
      )}

      <Dialog open={newFloorDialog} onOpenChange={setNewFloorDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nuevo plano</DialogTitle></DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Nombre del plano (ej. Planta baja)"
              value={newFloorName}
              onChange={(e) => setNewFloorName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateFloor()}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNewFloorDialog(false)}>Cancelar</Button>
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
```

- [ ] **Step 2: Syntax check**

```bash
node --check apps/desktop/src/modules/atlas.pos/screens/PosFloorPlannerScreen.jsx
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/modules/atlas.pos/screens/PosFloorPlannerScreen.jsx
git commit -m "feat(pos): implement floor planner screen with canvas state and compose"
```

---

## Self-review

### Spec coverage

| Spec requirement | Covered by |
|---|---|
| Visual floor editor | Task 3 (FloorCanvas) |
| Drag to move elements | Task 3 (pointer events) |
| Resize elements | Task 3 (corner handle) |
| Element types (table sq/round, bar, wall, plant, door) | Task 4 (FloorToolbox) |
| Table name + capacity editable | Task 4 (FloorPropertiesPanel) |
| Save layout (persist positions + create tables) | Task 1 (backend) + Task 2 (hook) + Task 5 (screen) |
| Publish floor as active for outlet | Task 1 (existing route) + Task 2 (hook) + Task 5 (screen) |
| Outlet + floor selector | Task 5 (PosFloorPlannerScreen) |
| Create new floor | Task 5 (dialog + useCreatePosFloor) |
| Delete element from plan | Task 4 (FloorPropertiesPanel ConfirmDialog) |
| Spec §12: floor can be created, edited, published | All tasks combined |
| Spec §13: PosTablesScreen shows active floor tables | Already works via active-map endpoint (Plan B) |

### Placeholder scan

No TBD, TODO, or "implement later" strings found. All code blocks are complete.

### Type consistency

- `canvas.elements` items always have `{ id, kind, x, y, width, height, label, tableId, tableName, capacity }` — consistent across reducer, FloorCanvas, FloorPropertiesPanel, and handleSave serializer.
- `dispatch` action types `LOAD/ADD/MOVE/RESIZE/UPDATE/REMOVE` used consistently in reducer and in screen handlers.
- `elementsFromFloor(floor)` used both in `useEffect` and in `handleSave.onSuccess` — same function, same output shape.
- `onPlace(kind, x, y)` callback signature matches between FloorCanvas and PosFloorPlannerScreen handler.
- `onMove(id, x, y)` and `onResize(id, w, h)` callback signatures match.
