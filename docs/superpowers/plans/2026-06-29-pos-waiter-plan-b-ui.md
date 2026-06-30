# Atlas POS Waiter & Split Bill — Plan B (UI) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface waiter assignment ("mis mesas" filter, waiter chips, manual claim) and split-bill payment flow in the `atlas.pos` desktop UI.

**Architecture:** React Query hooks in `usePosFloor.js`/`usePosOrder.js` call the new SDK methods from Plan A. `PosTablesScreen` gains a "Mis mesas" toggle and a claim action; `TableMap`/`FloorOperationalCanvas` render a waiter chip; a new `SplitBillDialog` component consumes `GET /pos/orders/:id/seat-totals` and reuses the existing payment mutation; `PaymentDialog` gains a "Mesa completa" / "Dividir cuenta" toggle.

**Tech Stack:** React, TanStack Query, `@atlas/ui`, Tailwind, `sonner` toasts. JavaScript only — no TypeScript.

**Spec:** `docs/superpowers/specs/2026-06-29-pos-waiter-split-bill.md`
**Depends on:** `docs/superpowers/plans/2026-06-29-pos-waiter-plan-a-backend.md` (must be implemented and merged first — this plan calls SDK methods and routes it adds)

---

## File Map

```text
apps/desktop/src/modules/atlas.pos/
  hooks/
    usePosFloor.js
    usePosOrder.js
  components/
    TableMap.jsx
    FloorOperationalCanvas.jsx
    PaymentDialog.jsx
    SplitBillDialog.jsx          (new)
  screens/
    PosTablesScreen.jsx
```

---

## Task 1: Hooks

**Files:**
- Modify: `apps/desktop/src/modules/atlas.pos/hooks/usePosFloor.js`
- Modify: `apps/desktop/src/modules/atlas.pos/hooks/usePosOrder.js`

- [ ] **Step 1: Update `usePosFloorDetail` to accept `myTablesOnly`**

In `usePosFloor.js`, find:

```js
export function usePosFloorDetail(id, { refetch = false } = {}) {
  const token = useToken()
  return useQuery({
    queryKey: ['pos', 'floors', 'detail', id],
    queryFn: () => atlas.pos.getFloor(id, token),
    select: (res) => res?.data ?? res,
    enabled: Boolean(token) && Boolean(id),
    staleTime: 15 * 1000,
    refetchInterval: refetch ? 60 * 1000 : false,
  })
}
```

Replace with:

```js
export function usePosFloorDetail(id, { refetch = false, myTablesOnly = false } = {}) {
  const token = useToken()
  return useQuery({
    queryKey: ['pos', 'floors', 'detail', id, myTablesOnly],
    queryFn: () => atlas.pos.getFloor(id, myTablesOnly ? { myTablesOnly: true } : {}, token),
    select: (res) => res?.data ?? res,
    enabled: Boolean(token) && Boolean(id),
    staleTime: 15 * 1000,
    refetchInterval: refetch ? 60 * 1000 : false,
  })
}
```

This matches the new 3-arg `atlas.pos.getFloor(id, query, token)` signature from Plan A.

- [ ] **Step 2: Add `useUpdateTableWaiter`**

Add this export to `usePosFloor.js`, near `useUpdateTableStatus`:

```js
export function useUpdateTableWaiter() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ tableId, waiterId }) =>
      atlas.pos.assignTableWaiter(tableId, { waiterId }, token),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pos', 'tables'] })
      qc.invalidateQueries({ queryKey: ['pos', 'floors', 'detail'] })
    },
    onError: (err) => toast.error(err?.message ?? 'Error al asignar mesero'),
  })
}
```

- [ ] **Step 3: Run a syntax check**

```bash
node --check apps/desktop/src/modules/atlas.pos/hooks/usePosFloor.js
```

Expected: no output.

- [ ] **Step 4: Make `useAddPosPayment` also invalidate seat totals**

`SplitBillDialog` (Task 4) reads `useOrderSeatTotals`, keyed `['pos', 'orders', 'seat-totals', orderId]`. The existing `useAddPosPayment` mutation does not invalidate that key, so after charging one seat the dialog's remaining seats/totals would go stale until something else triggers a refetch. Find:

```js
export function useAddPosPayment() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ orderId, ...data }) => atlas.pos.addPayment(orderId, data, token),
    onMutate: () => ({ toastId: toast.loading('Registrando pago...') }),
    onSuccess: (_, vars, ctx) => {
      toast.dismiss(ctx?.toastId)
      toast.success('Pago registrado')
      qc.invalidateQueries({ queryKey: ['pos', 'orders', 'detail', vars.orderId] })
      qc.invalidateQueries({ queryKey: ['pos', 'orders'] })
      qc.invalidateQueries({ queryKey: ['pos', 'tables'] })
      qc.invalidateQueries({ queryKey: ['pos', 'floors'] })
    },
    onError: (err, __, ctx) => {
      toast.dismiss(ctx?.toastId)
      toast.error(err?.message ?? 'Error al registrar pago')
    },
  })
}
```

Replace with:

```js
export function useAddPosPayment() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ orderId, ...data }) => atlas.pos.addPayment(orderId, data, token),
    onMutate: () => ({ toastId: toast.loading('Registrando pago...') }),
    onSuccess: (_, vars, ctx) => {
      toast.dismiss(ctx?.toastId)
      toast.success('Pago registrado')
      qc.invalidateQueries({ queryKey: ['pos', 'orders', 'detail', vars.orderId] })
      qc.invalidateQueries({ queryKey: ['pos', 'orders', 'seat-totals', vars.orderId] })
      qc.invalidateQueries({ queryKey: ['pos', 'orders'] })
      qc.invalidateQueries({ queryKey: ['pos', 'tables'] })
      qc.invalidateQueries({ queryKey: ['pos', 'floors'] })
    },
    onError: (err, __, ctx) => {
      toast.dismiss(ctx?.toastId)
      toast.error(err?.message ?? 'Error al registrar pago')
    },
  })
}
```

- [ ] **Step 5: Add `useAssignOrderWaiter` and `useOrderSeatTotals`**

Add these exports near `useAddPosPayment`:

```js
export function useAssignOrderWaiter() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ orderId, waiterId }) =>
      atlas.pos.assignOrderWaiter(orderId, { waiterId }, token),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['pos', 'orders', 'detail', vars.orderId] })
      qc.invalidateQueries({ queryKey: ['pos', 'orders'] })
    },
    onError: (err) => toast.error(err?.message ?? 'Error al asignar mesero a la orden'),
  })
}

export function useOrderSeatTotals(orderId) {
  const token = useToken()
  return useQuery({
    queryKey: ['pos', 'orders', 'seat-totals', orderId],
    queryFn: () => atlas.pos.getOrderSeatTotals(orderId, token),
    select: (res) => res?.data ?? null,
    enabled: Boolean(token) && Boolean(orderId),
    staleTime: 5 * 1000,
  })
}
```

- [ ] **Step 6: Run a syntax check**

```bash
node --check apps/desktop/src/modules/atlas.pos/hooks/usePosOrder.js
```

Expected: no output.

- [ ] **Step 7: Commit**

```bash
git add apps/desktop/src/modules/atlas.pos/hooks/usePosFloor.js apps/desktop/src/modules/atlas.pos/hooks/usePosOrder.js
git commit -m "feat(pos): add waiter assignment and seat-totals hooks"
```

---

## Task 2: Waiter Chip on Table Cards

**Files:**
- Modify: `apps/desktop/src/modules/atlas.pos/components/TableMap.jsx`
- Modify: `apps/desktop/src/modules/atlas.pos/components/FloorOperationalCanvas.jsx`

- [ ] **Step 1: Add a waiter initials helper and chip to `TableMap.jsx`**

Find the top of the file:

```jsx
import { EmptyState } from '@atlas/ui'

const STATUS_COLORS = {
```

Add a helper function right after the imports:

```jsx
import { EmptyState } from '@atlas/ui'

function waiterInitials(name) {
  if (!name) return ''
  const parts = name.trim().split(/\s+/)
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('')
}

const STATUS_COLORS = {
```

- [ ] **Step 2: Render the chip on each table button**

Find:

```jsx
            <button
              key={table.id}
              onClick={() => onTableClick(table)}
              disabled={table.status === 'DISABLED'}
              className={`aspect-square flex flex-col items-center justify-center rounded-xl border-2 transition-all hover:scale-105 active:scale-95 min-h-18 ${
                STATUS_COLORS[table.status] ?? STATUS_COLORS.AVAILABLE
              } ${table.status === 'DISABLED' ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
            >
              <span className="text-base font-bold leading-none">{table.name}</span>
              <span className="text-[10px] mt-1 font-medium opacity-80">{STATUS_LABELS[table.status]}</span>
              {table.capacity && (
                <span className="text-[10px] opacity-60">{table.capacity} pers.</span>
              )}
            </button>
```

Replace with:

```jsx
            <button
              key={table.id}
              onClick={() => onTableClick(table)}
              disabled={table.status === 'DISABLED'}
              className={`relative aspect-square flex flex-col items-center justify-center rounded-xl border-2 transition-all hover:scale-105 active:scale-95 min-h-18 ${
                STATUS_COLORS[table.status] ?? STATUS_COLORS.AVAILABLE
              } ${table.status === 'DISABLED' ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
            >
              {table.waiterName && (
                <span
                  title={table.waiterName}
                  className="absolute top-1 right-1 h-5 w-5 rounded-full bg-foreground/80 text-background text-[9px] font-bold flex items-center justify-center"
                >
                  {waiterInitials(table.waiterName)}
                </span>
              )}
              <span className="text-base font-bold leading-none">{table.name}</span>
              <span className="text-[10px] mt-1 font-medium opacity-80">{STATUS_LABELS[table.status]}</span>
              {table.capacity && (
                <span className="text-[10px] opacity-60">{table.capacity} pers.</span>
              )}
            </button>
```

- [ ] **Step 3: Render the chip in `FloorOperationalCanvas.jsx`'s `OperationalTable`**

Find the SVG block inside `OperationalTable`:

```jsx
        <circle cx={ox + el.width - 6} cy={oy + 6} r={4}
          fill={style.dot} stroke="white" strokeWidth={1.2} />
      </svg>
    </div>
  )
}
```

Replace with:

```jsx
        <circle cx={ox + el.width - 6} cy={oy + 6} r={4}
          fill={style.dot} stroke="white" strokeWidth={1.2} />
      </svg>
      {table?.waiterName && (
        <div
          title={table.waiterName}
          className="absolute -top-1.5 -left-1.5 h-5 w-5 rounded-full bg-foreground/80 text-background text-[9px] font-bold flex items-center justify-center z-20"
        >
          {table.waiterName.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('')}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Dim tables not bound to `tableStates` when `myTablesOnly` filtering is active**

`PosTablesScreen` (Task 3) will pass an already-filtered `tableStates` map when "Mis mesas" is on, so `el.tableId ? tableStates[el.tableId] : null` will be `null` for tables that belong to other waiters. Find in `FloorOperationalCanvas.jsx`:

```jsx
            {tableElements.map((el) => (
              <OperationalTable
                key={el.id}
                el={el}
                table={el.tableId ? tableStates[el.tableId] : null}
                onClick={onTableClick}
              />
            ))}
```

Replace with:

```jsx
            {tableElements.map((el) => {
              const boundTable = el.tableId ? tableStates[el.tableId] : null
              const isUnbound = Boolean(el.tableId) && !boundTable
              return (
                <div key={el.id} style={isUnbound ? { opacity: 0.25, pointerEvents: 'none' } : undefined}>
                  <OperationalTable el={el} table={boundTable} onClick={onTableClick} />
                </div>
              )
            })}
```

- [ ] **Step 5: Run syntax checks**

```bash
node --check apps/desktop/src/modules/atlas.pos/components/TableMap.jsx
node --check apps/desktop/src/modules/atlas.pos/components/FloorOperationalCanvas.jsx
```

Note: `node --check` does not parse JSX. If it errors on JSX syntax, skip the check and instead verify via `pnpm dev:frontend` that both files compile (Step 1 of the Verification section below covers this).

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/modules/atlas.pos/components/TableMap.jsx apps/desktop/src/modules/atlas.pos/components/FloorOperationalCanvas.jsx
git commit -m "feat(pos): show waiter chip on table cards and dim unassigned tables in mis-mesas view"
```

---

## Task 3: PosTablesScreen — "Mis mesas" Toggle and Claim Action

**Files:**
- Modify: `apps/desktop/src/modules/atlas.pos/screens/PosTablesScreen.jsx`

- [ ] **Step 1: Import `useAuth`, `useUpdateTableWaiter`, and an icon**

Find:

```jsx
import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { SelectField, EmptyState, Label, Button, Sheet, SheetContent, SheetTitle, Dialog, DialogContent, DialogHeader, DialogTitle } from '@atlas/ui'
import { toast } from 'sonner'
import { LayoutGrid, List, Maximize2, Minimize2, CalendarCheck, CalendarX, Sparkles, UtensilsCrossed } from 'lucide-react'
import { usePosFloors, usePosFloorDetail, useUpdateTableStatus } from '../hooks/usePosFloor'
import { useCreatePosReservation, useUpdatePosReservation, useSeatPosReservation } from '../hooks/usePosReservation'
import { ReservationFormDialog } from '../components/ReservationFormDialog'
import { usePosOutlets } from '../hooks/usePosSettings'
import { useCreatePosOrder, usePosOrders } from '../hooks/usePosOrder'
import { useIsDesktop } from '../../../hooks/useIsDesktop'
import FloorOperationalCanvas from '../components/FloorOperationalCanvas'
import TableMap from '../components/TableMap'
```

Replace with:

```jsx
import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { SelectField, EmptyState, Label, Button, Sheet, SheetContent, SheetTitle, Dialog, DialogContent, DialogHeader, DialogTitle } from '@atlas/ui'
import { toast } from 'sonner'
import { LayoutGrid, List, Maximize2, Minimize2, CalendarCheck, CalendarX, Sparkles, UtensilsCrossed, UserCheck } from 'lucide-react'
import { usePosFloors, usePosFloorDetail, useUpdateTableStatus, useUpdateTableWaiter } from '../hooks/usePosFloor'
import { useCreatePosReservation, useUpdatePosReservation, useSeatPosReservation } from '../hooks/usePosReservation'
import { ReservationFormDialog } from '../components/ReservationFormDialog'
import { usePosOutlets } from '../hooks/usePosSettings'
import { useCreatePosOrder, usePosOrders } from '../hooks/usePosOrder'
import { useIsDesktop } from '../../../hooks/useIsDesktop'
import { useAuth } from '../../../auth/AuthProvider'
import FloorOperationalCanvas from '../components/FloorOperationalCanvas'
import TableMap from '../components/TableMap'
```

- [ ] **Step 2: Add an "Asignar mesa a mí" action to `TableActionPanel`**

`TableActionPanel` currently handles `action === 'dirty'` and `action === 'reserved'`. Add a third case for a plain `AVAILABLE`/`OCCUPIED` table with no waiter, or one assigned to someone else. Find the function signature:

```jsx
function TableActionPanel({ actionTable, onClose, onNavigateToOrder, onMarkClean, onCancelReserve, busy }) {
```

Replace with:

```jsx
function TableActionPanel({ actionTable, onClose, onNavigateToOrder, onMarkClean, onCancelReserve, onClaimTable, busy }) {
```

Find the desktop dialog body:

```jsx
          <div className="space-y-4 pt-1">
            {action === 'dirty' && (
```

Replace with:

```jsx
          <div className="space-y-4 pt-1">
            {action === 'claim' && (
              <>
                <p className="text-sm text-muted-foreground">
                  {actionTable?.waiterName
                    ? `Asignada actualmente a ${actionTable.waiterName}.`
                    : 'Esta mesa no tiene mesero asignado.'}
                </p>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={onNavigateToOrder}>
                    Abrir orden
                  </Button>
                  <Button size="sm" onClick={onClaimTable} disabled={busy} className="gap-1.5">
                    <UserCheck size={14} />
                    {busy ? 'Asignando...' : 'Asignar mesa a mí'}
                  </Button>
                </div>
              </>
            )}

            {action === 'dirty' && (
```

Find the mobile sheet body:

```jsx
        <div className="space-y-3">
          {action === 'dirty' && (
```

Replace with:

```jsx
        <div className="space-y-3">
          {action === 'claim' && (
            <>
              <p className="text-sm text-muted-foreground mb-2">
                {actionTable?.waiterName
                  ? `Asignada actualmente a ${actionTable.waiterName}.`
                  : 'Esta mesa no tiene mesero asignado.'}
              </p>
              <Button className="w-full h-12" onClick={onClaimTable} disabled={busy}>
                <UserCheck size={15} className="mr-2" />
                {busy ? 'Asignando...' : 'Asignar mesa a mí'}
              </Button>
              <Button variant="outline" className="w-full h-12" onClick={onNavigateToOrder}>
                <UtensilsCrossed size={15} className="mr-2" />
                Abrir orden
              </Button>
            </>
          )}

          {action === 'dirty' && (
```

- [ ] **Step 3: Add state, the "Mis mesas" toggle, and the claim mutation in the main screen component**

Find:

```jsx
  const [viewMode, setViewMode] = useState('canvas') // 'canvas' | 'grid'
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [reserveMode, setReserveMode] = useState(false)
  const [actionTable, setActionTable] = useState(null) // { id, name, status, action }

  const updateTableStatus = useUpdateTableStatus()
```

Replace with:

```jsx
  const [viewMode, setViewMode] = useState('canvas') // 'canvas' | 'grid'
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [reserveMode, setReserveMode] = useState(false)
  const [myTablesOnly, setMyTablesOnly] = useState(false)
  const [actionTable, setActionTable] = useState(null) // { id, name, status, action }

  const { userProfile } = useAuth()
  const updateTableStatus = useUpdateTableStatus()
  const updateTableWaiter = useUpdateTableWaiter()
```

- [ ] **Step 4: Pass `myTablesOnly` into `usePosFloorDetail`**

Find:

```jsx
  const { data: floorDetail, isLoading: tablesLoading } = usePosFloorDetail(effectiveFloorId, { refetch: true })
```

Replace with:

```jsx
  const { data: floorDetail, isLoading: tablesLoading } = usePosFloorDetail(effectiveFloorId, {
    refetch: true,
    myTablesOnly,
  })
```

- [ ] **Step 5: Add a "claim" branch to `handleTableClick`**

Find:

```jsx
  function handleTableClick(table) {
    if (!table?.id) return
    // Always use the live DB status from tableStates when available
    const liveTable = tableStates[table.id] ?? table
    const status = liveTable.status ?? 'AVAILABLE'
    const name = liveTable.name || table.name || 'Mesa'

    if (status === 'DIRTY') {
      setActionTable({ id: table.id, name, status, action: 'dirty' })
      return
    }
    if (status === 'RESERVED') {
      setActionTable({ id: table.id, name, status, action: 'reserved', activeReservation: liveTable.activeReservation ?? null })
      return
    }
    if (reserveMode && status === 'AVAILABLE') {
      setReserveFormTable({ id: table.id, name, outletId: effectiveOutletId })
      return
    }
    navigateToOrder(liveTable)
  }
```

Replace with:

```jsx
  function handleTableClick(table) {
    if (!table?.id) return
    // Always use the live DB status from tableStates when available
    const liveTable = tableStates[table.id] ?? table
    const status = liveTable.status ?? 'AVAILABLE'
    const name = liveTable.name || table.name || 'Mesa'

    if (status === 'DIRTY') {
      setActionTable({ id: table.id, name, status, action: 'dirty' })
      return
    }
    if (status === 'RESERVED') {
      setActionTable({ id: table.id, name, status, action: 'reserved', activeReservation: liveTable.activeReservation ?? null })
      return
    }
    if (reserveMode && status === 'AVAILABLE') {
      setReserveFormTable({ id: table.id, name, outletId: effectiveOutletId })
      return
    }
    if (liveTable.waiterId && liveTable.waiterId !== userProfile?.id) {
      setActionTable({ id: table.id, name, status, action: 'claim', waiterName: liveTable.waiterName ?? null })
      return
    }
    navigateToOrder(liveTable)
  }
```

This means: a table assigned to *another* waiter opens the claim panel instead of jumping straight into the order, so a teammate can't accidentally barge into someone else's table. Tables with no waiter, or assigned to the current user, behave exactly as before.

- [ ] **Step 6: Add `handleClaimTable`**

Add this function near `handleMarkClean`:

```jsx
  function handleClaimTable() {
    if (!actionTable || !userProfile?.id) return
    updateTableWaiter.mutate(
      { tableId: actionTable.id, waiterId: userProfile.id },
      { onSuccess: () => setActionTable(null) },
    )
  }
```

- [ ] **Step 7: Wire the new prop and a "Mis mesas" toggle button**

Find the reserve-mode toggle button block:

```jsx
        {/* Reserve mode toggle */}
        <Button
          variant={reserveMode ? 'default' : 'ghost'}
          size="sm"
          className={`shrink-0 px-2.5 gap-1.5 ${reserveMode ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''}`}
          onClick={() => setReserveMode((v) => !v)}
          title="Modo reserva: toca una mesa disponible para reservarla"
        >
          <CalendarCheck size={15} />
          <span className="hidden sm:inline text-xs">Reservar</span>
        </Button>
```

Add a new toggle directly before it:

```jsx
        {/* Mis mesas toggle */}
        <Button
          variant={myTablesOnly ? 'default' : 'ghost'}
          size="sm"
          className={`shrink-0 px-2.5 gap-1.5 ${myTablesOnly ? 'bg-foreground hover:bg-foreground/90 text-background' : ''}`}
          onClick={() => setMyTablesOnly((v) => !v)}
          title="Mostrar solo mis mesas asignadas"
        >
          <UserCheck size={15} />
          <span className="hidden sm:inline text-xs">Mis mesas</span>
        </Button>

        {/* Reserve mode toggle */}
        <Button
          variant={reserveMode ? 'default' : 'ghost'}
          size="sm"
          className={`shrink-0 px-2.5 gap-1.5 ${reserveMode ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''}`}
          onClick={() => setReserveMode((v) => !v)}
          title="Modo reserva: toca una mesa disponible para reservarla"
        >
          <CalendarCheck size={15} />
          <span className="hidden sm:inline text-xs">Reservar</span>
        </Button>
```

Find the `TableActionPanel` usage:

```jsx
      <TableActionPanel
        actionTable={actionTable}
        onClose={() => setActionTable(null)}
        onNavigateToOrder={handleActionNavigate}
        onMarkClean={handleMarkClean}
        onCancelReserve={handleCancelReserve}
        busy={updateTableStatus.isPending || updateReservation.isPending || seatReservation.isPending}
      />
```

Replace with:

```jsx
      <TableActionPanel
        actionTable={actionTable}
        onClose={() => setActionTable(null)}
        onNavigateToOrder={handleActionNavigate}
        onMarkClean={handleMarkClean}
        onCancelReserve={handleCancelReserve}
        onClaimTable={handleClaimTable}
        busy={updateTableStatus.isPending || updateReservation.isPending || seatReservation.isPending || updateTableWaiter.isPending}
      />
```

- [ ] **Step 8: Make `handleActionNavigate` work for the `claim` action too**

`handleActionNavigate` already falls through to `navigateToOrder(table)` for any action without a `reservationId`, which covers `claim` automatically — no change needed here. Verify by reading the existing function body:

```jsx
  function handleActionNavigate() {
    const table = actionTable
    setActionTable(null)
    if (!table) return

    const reservationId = table.activeReservation?.id
    if (reservationId) {
      seatReservation.mutate(
        { id: reservationId },
        {
          onSuccess: (res) => {
            const orderId = (res?.data ?? res)?.id
            if (!orderId) { toast.error('No se pudo obtener la orden'); return }
            navigate(`/app/m/atlas.pos/pos/terminal?order=${orderId}`)
          },
        }
      )
    } else {
      navigateToOrder(table)
    }
  }
```

`claim`-action tables never have `activeReservation`, so this already does the right thing.

- [ ] **Step 9: Run a syntax check**

```bash
node --check apps/desktop/src/modules/atlas.pos/screens/PosTablesScreen.jsx
```

Note: as in Task 2, `node --check` won't fully validate JSX — rely on `pnpm dev:frontend` (Verification section) to confirm no compile errors.

- [ ] **Step 10: Commit**

```bash
git add apps/desktop/src/modules/atlas.pos/screens/PosTablesScreen.jsx
git commit -m "feat(pos): add mis-mesas toggle and table claim action to PosTablesScreen"
```

---

## Task 4: SplitBillDialog Component

**Files:**
- Create: `apps/desktop/src/modules/atlas.pos/components/SplitBillDialog.jsx`

- [ ] **Step 1: Write the component**

```jsx
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
  Button, EmptyState,
} from '@atlas/ui'
import { useOrderSeatTotals } from '../hooks/usePosOrder'
import { useAddPosPayment } from '../hooks/usePosOrder'
import { usePosPaymentMethods } from '../hooks/usePosSettings'

export default function SplitBillDialog({ open, onOpenChange, order, paymentMethodId, onFullyPaid }) {
  const { data: totals, isLoading } = useOrderSeatTotals(open ? order?.id : null)
  const addPayment = useAddPosPayment()
  const { data: methods = [] } = usePosPaymentMethods()
  const enabledMethods = Array.isArray(methods) ? methods.filter((m) => m.enabled) : []
  const effectiveMethodId = paymentMethodId ?? enabledMethods[0]?.id ?? null

  function handleClose() {
    onOpenChange(false)
  }

  function handleChargeSeat(seat) {
    if (!order?.id || !effectiveMethodId) return
    addPayment.mutate(
      { orderId: order.id, paymentMethodId: effectiveMethodId, amount: seat.total },
      {
        onSuccess: () => {
          if (totals && Number(totals.remaining) - Number(seat.total) <= 0) {
            onFullyPaid?.()
            handleClose()
          }
        },
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md">
        <DialogHeader>
          <DialogTitle>Dividir cuenta — orden #{order?.orderNumber}</DialogTitle>
          <DialogDescription>
            {totals && (
              <>
                Restante:{' '}
                <span className="font-semibold text-foreground">${Number(totals.remaining).toFixed(2)}</span>
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 py-1 max-h-[50vh] overflow-y-auto">
          {isLoading && (
            <p className="text-sm text-muted-foreground text-center py-4">Cargando cuentas...</p>
          )}
          {!isLoading && (totals?.seats ?? []).length === 0 && (
            <EmptyState title="Sin líneas" description="Esta orden no tiene productos agregados." />
          )}
          {(totals?.seats ?? []).map((seat) => (
            <div
              key={seat.id ?? 'unassigned'}
              className="flex items-center justify-between rounded-lg border border-border px-3.5 py-3"
            >
              <div className="flex flex-col">
                <span className="text-sm font-medium text-foreground">{seat.label}</span>
                <span className="text-xs text-muted-foreground">
                  {seat.linesCount} {seat.linesCount === 1 ? 'producto' : 'productos'}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold tabular-nums">${Number(seat.total).toFixed(2)}</span>
                <Button size="sm" onClick={() => handleChargeSeat(seat)} disabled={addPayment.isPending}>
                  Cobrar esta cuenta
                </Button>
              </div>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={handleClose}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Run a syntax check**

```bash
node --check apps/desktop/src/modules/atlas.pos/components/SplitBillDialog.jsx
```

Note: as before, full validation happens via `pnpm dev:frontend`.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/modules/atlas.pos/components/SplitBillDialog.jsx
git commit -m "feat(pos): add SplitBillDialog for per-seat split bill payments"
```

---

## Task 5: PaymentDialog — "Mesa completa" / "Dividir cuenta" Toggle

**Files:**
- Modify: `apps/desktop/src/modules/atlas.pos/components/PaymentDialog.jsx`

- [ ] **Step 1: Import `SplitBillDialog` and add a mode toggle**

Find:

```jsx
import { useState } from 'react'
import { CreditCard, Banknote, Smartphone, Check } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
  Button, Label, Separator,
  TextField,
} from '@atlas/ui'
import { usePosPaymentMethods } from '../hooks/usePosSettings'
import { useAddPosPayment } from '../hooks/usePosOrder'

const METHOD_ICONS = { CASH: Banknote, cash: Banknote, CARD: CreditCard, card: CreditCard, TRANSFER: Smartphone, transfer: Smartphone }

export default function PaymentDialog({ open, onOpenChange, order, onSuccess }) {
  const { data: methods = [] } = usePosPaymentMethods()
  const addPayment = useAddPosPayment()
  const [selectedMethod, setSelectedMethod] = useState(null)
  const [amount, setAmount] = useState('')
```

Replace with:

```jsx
import { useState } from 'react'
import { CreditCard, Banknote, Smartphone, Check, Receipt, SplitSquareHorizontal } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
  Button, Label, Separator,
  TextField,
} from '@atlas/ui'
import { usePosPaymentMethods } from '../hooks/usePosSettings'
import { useAddPosPayment } from '../hooks/usePosOrder'
import SplitBillDialog from './SplitBillDialog'

const METHOD_ICONS = { CASH: Banknote, cash: Banknote, CARD: CreditCard, card: CreditCard, TRANSFER: Smartphone, transfer: Smartphone }

export default function PaymentDialog({ open, onOpenChange, order, onSuccess }) {
  const { data: methods = [] } = usePosPaymentMethods()
  const addPayment = useAddPosPayment()
  const [selectedMethod, setSelectedMethod] = useState(null)
  const [amount, setAmount] = useState('')
  const [mode, setMode] = useState('full') // 'full' | 'split'
```

- [ ] **Step 2: Reset `mode` on close and render the split dialog**

Find:

```jsx
  function handleClose() {
    setAmount('')
    setSelectedMethod(null)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-sm">
        <DialogHeader>
          <DialogTitle>Cobrar orden #{order?.orderNumber}</DialogTitle>
          <DialogDescription>
            Total a cobrar:{' '}
            <span className="font-semibold text-foreground">${totalDue.toFixed(2)}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5 py-1">
          {/* Payment method selection */}
          <div className="flex flex-col gap-2">
            <Label>Método de pago</Label>
```

Replace with:

```jsx
  function handleClose() {
    setAmount('')
    setSelectedMethod(null)
    setMode('full')
    onOpenChange(false)
  }

  if (mode === 'split') {
    return (
      <SplitBillDialog
        open={open}
        onOpenChange={(next) => {
          if (!next) setMode('full')
          onOpenChange(next)
        }}
        order={order}
        paymentMethodId={selectedMethod}
        onFullyPaid={() => onSuccess?.()}
      />
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-sm">
        <DialogHeader>
          <DialogTitle>Cobrar orden #{order?.orderNumber}</DialogTitle>
          <DialogDescription>
            Total a cobrar:{' '}
            <span className="font-semibold text-foreground">${totalDue.toFixed(2)}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex rounded-md border border-border overflow-hidden self-start">
          <Button
            variant="ghost" size="sm"
            className={`rounded-none px-3 gap-1.5 ${mode === 'full' ? 'bg-muted' : ''}`}
            onClick={() => setMode('full')}
          >
            <Receipt size={14} />
            <span className="text-xs">Mesa completa</span>
          </Button>
          <Button
            variant="ghost" size="sm"
            className={`rounded-none px-3 gap-1.5 border-l border-border ${mode === 'split' ? 'bg-muted' : ''}`}
            onClick={() => setMode('split')}
          >
            <SplitSquareHorizontal size={14} />
            <span className="text-xs">Dividir cuenta</span>
          </Button>
        </div>

        <div className="flex flex-col gap-5 py-1">
          {/* Payment method selection */}
          <div className="flex flex-col gap-2">
            <Label>Método de pago</Label>
```

Note: switching to "Dividir cuenta" requires a payment method to already be selected in the "Mesa completa" view (`selectedMethod` is passed through as `paymentMethodId` to `SplitBillDialog`, which falls back to the first enabled method if none is selected yet) — this keeps a single source of truth for which method charges the seat instead of duplicating the method picker inside `SplitBillDialog`.

- [ ] **Step 3: Run a syntax check**

```bash
node --check apps/desktop/src/modules/atlas.pos/components/PaymentDialog.jsx
```

Note: as before, full validation happens via `pnpm dev:frontend`.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/modules/atlas.pos/components/PaymentDialog.jsx
git commit -m "feat(pos): add mesa-completa/dividir-cuenta toggle to PaymentDialog"
```

---

## Verification (manual, after all tasks)

- [ ] **Step 1: Start the dev servers**

```bash
pnpm dev
```

- [ ] **Step 2: Confirm the floor screen compiles and loads**

Open `http://localhost:5173`, navigate to atlas.pos → Mesas. Confirm no console errors and the existing canvas/grid views still render.

- [ ] **Step 3: Exercise waiter assignment**

1. Open a dine-in order on an available table as the logged-in user. Confirm the table now shows a waiter chip with your initials.
2. Mark that table `AVAILABLE` again (via the dirty/clean flow or by closing the order) and confirm the chip disappears.
3. Toggle "Mis mesas" on. Confirm only tables you're assigned to remain interactive/full-opacity; others dim.
4. As a second test, manually call `PATCH /pos/tables/:id/waiter` with a different `waiterId` (e.g. via curl with a placeholder token) and confirm clicking that table now opens the "Asignar mesa a mí" panel instead of jumping straight to the order.

- [ ] **Step 4: Exercise split bill**

1. Create an order with at least 2 guests and add lines to different `guestSeatId`s (via the terminal screen's existing guest/seat UI).
2. Open `PaymentDialog`, switch to "Dividir cuenta", and confirm each seat card shows the correct total.
3. Click "Cobrar esta cuenta" on one seat and confirm `remaining` updates without a full reload.
4. Pay off all seats and confirm the dialog closes automatically and the order's status updates (paid/closed) in the floor view.

- [ ] **Step 5: Run the full backend test suite once more for regressions**

```bash
node --test apps/api/src/routes/pos/__tests__/
```

Expected: all PASS.
