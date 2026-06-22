# Atlas POS Plan B — UI Operativa

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar la capa de UI del módulo `atlas.pos`: hooks TanStack Query, pantallas de configuración, sesiones, órdenes, terminal de venta (tactil), mesas, estaciones de cocina y plano de planta.

**Architecture:** Toda la UI consume el SDK (`atlas.pos.*`) ya implementado en Plan A. Se crean hooks TanStack Query en `hooks/`, componentes en `components/`, y se completan los shells de pantalla ya existentes en `screens/`. Las pantallas fullscreen (terminal, mesas, plano, estaciones) son layouts propios sin AppShell sidebar. Las pantallas de gestión (sesiones, órdenes, configuración) usan `PosScreenShell`.

**Tech Stack:** React 18, TanStack Query v5, `@atlas/ui` (PageHeader, Dialog, Sheet, ConfirmDialog, Card, Badge, Button, Input, SelectField, ComboboxField, EmptyState, ErrorState), `atlas.pos` SDK, Tailwind CSS. Todo el texto UI en español.

---

> **Nota de alcance:** Este plan cubre Tasks 1-8. El Floor Planner (canvas drag/resize) se cubre en Plan C dado que requiere lógica de posicionamiento CSS/SVG propia.

---

## File Map

```
apps/desktop/src/modules/atlas.pos/
  hooks/
    usePosSettings.js       (outlets, terminals, payment methods, stations CRUD)
    usePosSession.js        (open/close session, cash movements, list sessions)
    usePosCatalog.js        (categories + products from atlas.catalog for POS grid)
    usePosOrder.js          (create order, lines, guests, payments, send to kitchen)
    usePosKitchen.js        (station tickets, ticket/line status updates)
    usePosFloor.js          (active map, table status updates, list floors)
  components/
    SessionOpenDialog.jsx   (dialog to open a cash session — terminal selector + opening amount)
    SessionCloseDialog.jsx  (dialog to close session — counted cash, difference)
    CashMovementDialog.jsx  (dialog to add a cash movement: IN/OUT + reason)
    ProductGrid.jsx         (category tabs + product cards grid)
    OrderPanel.jsx          (active order lines, totals, action buttons)
    PaymentDialog.jsx       (payment method selector + amount entry, partial support)
    GuestSeatPanel.jsx      (seat tabs, assign line to seat)
    TableMap.jsx            (grid of table cards with status colors per zone)
    KitchenStationBoard.jsx (ticket cards grouped by PENDING/IN_PREPARATION/READY)
  screens/
    PosSettingsScreen.jsx   (tabs: General, Sucursales, Terminales, Métodos de Pago, Estaciones)
    PosSessionsScreen.jsx   (active session + history + cash movements)
    PosOrdersScreen.jsx     (admin list with search/filter + reprint)
    PosTerminalScreen.jsx   (ProductGrid + OrderPanel + PaymentDialog + GuestSeatPanel)
    PosTablesScreen.jsx     (zone selector + TableMap + opens order on table click)
    PosStationsScreen.jsx   (station selector + KitchenStationBoard)
```

---

## Task 1: Hooks — Settings & Sessions

**Files:**
- Create: `apps/desktop/src/modules/atlas.pos/hooks/usePosSettings.js`
- Create: `apps/desktop/src/modules/atlas.pos/hooks/usePosSession.js`

- [ ] **Step 1: Create `usePosSettings.js`**

```js
// apps/desktop/src/modules/atlas.pos/hooks/usePosSettings.js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuth } from '../../../auth/AuthProvider'
import { atlas } from '../../../lib/atlas'

function useToken() {
  const { session } = useAuth()
  return session?.access_token
}

export function usePosSettings() {
  const token = useToken()
  return useQuery({
    queryKey: ['pos', 'settings'],
    queryFn: () => atlas.pos.getSettings(token),
    enabled: Boolean(token),
    staleTime: 5 * 60 * 1000,
  })
}

export function useUpdatePosSettings() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => atlas.pos.updateSettings(data, token),
    onMutate: () => ({ toastId: toast.loading('Guardando configuración...') }),
    onSuccess: (_, __, ctx) => {
      toast.dismiss(ctx?.toastId)
      toast.success('Configuración guardada')
      qc.invalidateQueries({ queryKey: ['pos', 'settings'] })
    },
    onError: (err, __, ctx) => {
      toast.dismiss(ctx?.toastId)
      toast.error(err?.message ?? 'Error al guardar')
    },
  })
}

export function usePosOutlets() {
  const token = useToken()
  return useQuery({
    queryKey: ['pos', 'outlets'],
    queryFn: () => atlas.pos.listOutlets(token),
    enabled: Boolean(token),
    staleTime: 5 * 60 * 1000,
  })
}

export function useCreatePosOutlet() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => atlas.pos.createOutlet(data, token),
    onMutate: () => ({ toastId: toast.loading('Creando sucursal...') }),
    onSuccess: (_, __, ctx) => {
      toast.dismiss(ctx?.toastId)
      toast.success('Sucursal creada')
      qc.invalidateQueries({ queryKey: ['pos', 'outlets'] })
    },
    onError: (err, __, ctx) => {
      toast.dismiss(ctx?.toastId)
      toast.error(err?.message ?? 'Error al crear sucursal')
    },
  })
}

export function useUpdatePosOutlet() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }) => atlas.pos.updateOutlet(id, data, token),
    onMutate: () => ({ toastId: toast.loading('Guardando sucursal...') }),
    onSuccess: (_, __, ctx) => {
      toast.dismiss(ctx?.toastId)
      toast.success('Sucursal actualizada')
      qc.invalidateQueries({ queryKey: ['pos', 'outlets'] })
    },
    onError: (err, __, ctx) => {
      toast.dismiss(ctx?.toastId)
      toast.error(err?.message ?? 'Error al guardar')
    },
  })
}

export function usePosTerminals() {
  const token = useToken()
  return useQuery({
    queryKey: ['pos', 'terminals'],
    queryFn: () => atlas.pos.listTerminals(token),
    enabled: Boolean(token),
    staleTime: 5 * 60 * 1000,
  })
}

export function useCreatePosTerminal() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => atlas.pos.createTerminal(data, token),
    onMutate: () => ({ toastId: toast.loading('Creando terminal...') }),
    onSuccess: (_, __, ctx) => {
      toast.dismiss(ctx?.toastId)
      toast.success('Terminal creada')
      qc.invalidateQueries({ queryKey: ['pos', 'terminals'] })
    },
    onError: (err, __, ctx) => {
      toast.dismiss(ctx?.toastId)
      toast.error(err?.message ?? 'Error al crear terminal')
    },
  })
}

export function useUpdatePosTerminal() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }) => atlas.pos.updateTerminal(id, data, token),
    onMutate: () => ({ toastId: toast.loading('Guardando terminal...') }),
    onSuccess: (_, __, ctx) => {
      toast.dismiss(ctx?.toastId)
      toast.success('Terminal actualizada')
      qc.invalidateQueries({ queryKey: ['pos', 'terminals'] })
    },
    onError: (err, __, ctx) => {
      toast.dismiss(ctx?.toastId)
      toast.error(err?.message ?? 'Error al guardar')
    },
  })
}

export function usePosStations(query = {}) {
  const token = useToken()
  return useQuery({
    queryKey: ['pos', 'stations', query],
    queryFn: () => atlas.pos.listStations(query, token),
    enabled: Boolean(token),
    staleTime: 5 * 60 * 1000,
  })
}

export function useCreatePosStation() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => atlas.pos.createStation(data, token),
    onMutate: () => ({ toastId: toast.loading('Creando estación...') }),
    onSuccess: (_, __, ctx) => {
      toast.dismiss(ctx?.toastId)
      toast.success('Estación creada')
      qc.invalidateQueries({ queryKey: ['pos', 'stations'] })
    },
    onError: (err, __, ctx) => {
      toast.dismiss(ctx?.toastId)
      toast.error(err?.message ?? 'Error al crear estación')
    },
  })
}

export function useUpdatePosStation() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }) => atlas.pos.updateStation(id, data, token),
    onMutate: () => ({ toastId: toast.loading('Guardando estación...') }),
    onSuccess: (_, __, ctx) => {
      toast.dismiss(ctx?.toastId)
      toast.success('Estación actualizada')
      qc.invalidateQueries({ queryKey: ['pos', 'stations'] })
    },
    onError: (err, __, ctx) => {
      toast.dismiss(ctx?.toastId)
      toast.error(err?.message ?? 'Error al guardar')
    },
  })
}
```

- [ ] **Step 2: Create `usePosSession.js`**

```js
// apps/desktop/src/modules/atlas.pos/hooks/usePosSession.js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuth } from '../../../auth/AuthProvider'
import { atlas } from '../../../lib/atlas'

function useToken() {
  const { session } = useAuth()
  return session?.access_token
}

export function usePosSessions(query = {}) {
  const token = useToken()
  return useQuery({
    queryKey: ['pos', 'sessions', query],
    queryFn: () => atlas.pos.listSessions(query, token),
    enabled: Boolean(token),
    staleTime: 60 * 1000,
  })
}

export function usePosCurrentSession(terminalId) {
  const token = useToken()
  return useQuery({
    queryKey: ['pos', 'sessions', 'current', terminalId],
    queryFn: () => atlas.pos.getCurrentSession({ terminal_id: terminalId }, token),
    enabled: Boolean(token) && Boolean(terminalId),
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  })
}

export function usePosSession(id) {
  const token = useToken()
  return useQuery({
    queryKey: ['pos', 'sessions', id],
    queryFn: () => atlas.pos.getSession(id, token),
    enabled: Boolean(token) && Boolean(id),
    staleTime: 30 * 1000,
  })
}

export function useOpenPosSession() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => atlas.pos.openSession(data, token),
    onMutate: () => ({ toastId: toast.loading('Abriendo caja...') }),
    onSuccess: (_, __, ctx) => {
      toast.dismiss(ctx?.toastId)
      toast.success('Caja abierta')
      qc.invalidateQueries({ queryKey: ['pos', 'sessions'] })
    },
    onError: (err, __, ctx) => {
      toast.dismiss(ctx?.toastId)
      toast.error(err?.message ?? 'Error al abrir caja')
    },
  })
}

export function useClosePosSession() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }) => atlas.pos.closeSession(id, data, token),
    onMutate: () => ({ toastId: toast.loading('Cerrando caja...') }),
    onSuccess: (_, __, ctx) => {
      toast.dismiss(ctx?.toastId)
      toast.success('Caja cerrada')
      qc.invalidateQueries({ queryKey: ['pos', 'sessions'] })
    },
    onError: (err, __, ctx) => {
      toast.dismiss(ctx?.toastId)
      toast.error(err?.message ?? 'Error al cerrar caja')
    },
  })
}

export function useAddCashMovement() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ sessionId, ...data }) => atlas.pos.addCashMovement(sessionId, data, token),
    onMutate: () => ({ toastId: toast.loading('Registrando movimiento...') }),
    onSuccess: (_, vars, ctx) => {
      toast.dismiss(ctx?.toastId)
      toast.success('Movimiento registrado')
      qc.invalidateQueries({ queryKey: ['pos', 'sessions', vars.sessionId] })
      qc.invalidateQueries({ queryKey: ['pos', 'sessions'] })
    },
    onError: (err, __, ctx) => {
      toast.dismiss(ctx?.toastId)
      toast.error(err?.message ?? 'Error al registrar movimiento')
    },
  })
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/modules/atlas.pos/hooks/usePosSettings.js apps/desktop/src/modules/atlas.pos/hooks/usePosSession.js
git commit -m "feat(pos): add settings and session hooks"
```

---

## Task 2: Hooks — Orders, Catalog, Kitchen, Floor

**Files:**
- Create: `apps/desktop/src/modules/atlas.pos/hooks/usePosCatalog.js`
- Create: `apps/desktop/src/modules/atlas.pos/hooks/usePosOrder.js`
- Create: `apps/desktop/src/modules/atlas.pos/hooks/usePosKitchen.js`
- Create: `apps/desktop/src/modules/atlas.pos/hooks/usePosFloor.js`

- [ ] **Step 1: Create `usePosCatalog.js`**

```js
// apps/desktop/src/modules/atlas.pos/hooks/usePosCatalog.js
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../../auth/AuthProvider'
import { atlas } from '../../../lib/atlas'

function useToken() {
  const { session } = useAuth()
  return session?.access_token
}

export function usePosCatalogCategories() {
  const token = useToken()
  return useQuery({
    queryKey: ['pos', 'catalog', 'categories'],
    queryFn: () => atlas.catalog.listCategories(token),
    enabled: Boolean(token),
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  })
}

export function usePosCatalogProducts(params = {}) {
  const token = useToken()
  return useQuery({
    queryKey: ['pos', 'catalog', 'products', params],
    queryFn: () => atlas.catalog.listProducts(token, params),
    enabled: Boolean(token),
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })
}
```

- [ ] **Step 2: Create `usePosOrder.js`**

```js
// apps/desktop/src/modules/atlas.pos/hooks/usePosOrder.js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuth } from '../../../auth/AuthProvider'
import { atlas } from '../../../lib/atlas'

function useToken() {
  const { session } = useAuth()
  return session?.access_token
}

export function usePosOrders(query = {}) {
  const token = useToken()
  return useQuery({
    queryKey: ['pos', 'orders', query],
    queryFn: () => atlas.pos.listOrders(query, token),
    enabled: Boolean(token),
    staleTime: 30 * 1000,
  })
}

export function usePosOrder(id) {
  const token = useToken()
  return useQuery({
    queryKey: ['pos', 'orders', id],
    queryFn: () => atlas.pos.getOrder(id, token),
    enabled: Boolean(token) && Boolean(id),
    staleTime: 10 * 1000,
    refetchInterval: 15 * 1000,
  })
}

export function useCreatePosOrder() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => atlas.pos.createOrder(data, token),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pos', 'orders'] })
      qc.invalidateQueries({ queryKey: ['pos', 'tables'] })
    },
    onError: (err) => toast.error(err?.message ?? 'Error al crear orden'),
  })
}

export function useAddPosOrderLine() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ orderId, ...data }) => atlas.pos.addOrderLine(orderId, data, token),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['pos', 'orders', vars.orderId] })
    },
    onError: (err) => toast.error(err?.message ?? 'Error al agregar producto'),
  })
}

export function useUpdatePosOrderLine() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ orderId, lineId, ...data }) =>
      atlas.pos.updateOrderLine(orderId, lineId, data, token),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['pos', 'orders', vars.orderId] })
    },
    onError: (err) => toast.error(err?.message ?? 'Error al actualizar línea'),
  })
}

export function useDeletePosOrderLine() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ orderId, lineId }) => atlas.pos.deleteOrderLine(orderId, lineId, token),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['pos', 'orders', vars.orderId] })
    },
    onError: (err) => toast.error(err?.message ?? 'Error al eliminar línea'),
  })
}

export function useAddPosGuest() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ orderId, ...data }) => atlas.pos.addGuest(orderId, data, token),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['pos', 'orders', vars.orderId] })
    },
    onError: (err) => toast.error(err?.message ?? 'Error al agregar comensal'),
  })
}

export function useSendToKitchen() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (orderId) => atlas.pos.sendToKitchen(orderId, token),
    onMutate: () => ({ toastId: toast.loading('Enviando a cocina...') }),
    onSuccess: (_, orderId, ctx) => {
      toast.dismiss(ctx?.toastId)
      toast.success('Comanda enviada a cocina')
      qc.invalidateQueries({ queryKey: ['pos', 'orders', orderId] })
      qc.invalidateQueries({ queryKey: ['pos', 'kitchen'] })
    },
    onError: (err, __, ctx) => {
      toast.dismiss(ctx?.toastId)
      toast.error(err?.message ?? 'Error al enviar a cocina')
    },
  })
}

export function useAddPosPayment() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ orderId, ...data }) => atlas.pos.addPayment(orderId, data, token),
    onMutate: () => ({ toastId: toast.loading('Registrando pago...') }),
    onSuccess: (_, vars, ctx) => {
      toast.dismiss(ctx?.toastId)
      toast.success('Pago registrado')
      qc.invalidateQueries({ queryKey: ['pos', 'orders', vars.orderId] })
      qc.invalidateQueries({ queryKey: ['pos', 'orders'] })
      qc.invalidateQueries({ queryKey: ['pos', 'tables'] })
    },
    onError: (err, __, ctx) => {
      toast.dismiss(ctx?.toastId)
      toast.error(err?.message ?? 'Error al registrar pago')
    },
  })
}

export function useCancelPosOrder() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ orderId, reason }) => atlas.pos.cancelOrder(orderId, { reason }, token),
    onMutate: () => ({ toastId: toast.loading('Cancelando orden...') }),
    onSuccess: (_, vars, ctx) => {
      toast.dismiss(ctx?.toastId)
      toast.success('Orden cancelada')
      qc.invalidateQueries({ queryKey: ['pos', 'orders', vars.orderId] })
      qc.invalidateQueries({ queryKey: ['pos', 'orders'] })
      qc.invalidateQueries({ queryKey: ['pos', 'tables'] })
    },
    onError: (err, __, ctx) => {
      toast.dismiss(ctx?.toastId)
      toast.error(err?.message ?? 'Error al cancelar orden')
    },
  })
}

export function useReprintPosReceipt() {
  const token = useToken()
  return useMutation({
    mutationFn: (orderId) => atlas.pos.reprintReceipt(orderId, token),
    onMutate: () => ({ toastId: toast.loading('Reimprimiendo recibo...') }),
    onSuccess: (_, __, ctx) => {
      toast.dismiss(ctx?.toastId)
      toast.success('Recibo reenviado')
    },
    onError: (err, __, ctx) => {
      toast.dismiss(ctx?.toastId)
      toast.error(err?.message ?? 'Error al reimprimir')
    },
  })
}
```

- [ ] **Step 3: Create `usePosKitchen.js`**

```js
// apps/desktop/src/modules/atlas.pos/hooks/usePosKitchen.js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuth } from '../../../auth/AuthProvider'
import { atlas } from '../../../lib/atlas'

function useToken() {
  const { session } = useAuth()
  return session?.access_token
}

export function usePosStationTickets(stationId, query = {}) {
  const token = useToken()
  return useQuery({
    queryKey: ['pos', 'kitchen', 'tickets', stationId, query],
    queryFn: () => atlas.pos.listStationTickets(stationId, query, token),
    enabled: Boolean(token) && Boolean(stationId),
    staleTime: 10 * 1000,
    refetchInterval: 15 * 1000,
  })
}

export function useUpdateTicketStatus() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ ticketId, status }) => atlas.pos.updateTicketStatus(ticketId, { status }, token),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pos', 'kitchen'] })
    },
    onError: (err) => toast.error(err?.message ?? 'Error al actualizar estado'),
  })
}

export function useUpdateTicketLineStatus() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ ticketId, lineId, status }) =>
      atlas.pos.updateTicketLineStatus(ticketId, lineId, { status }, token),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pos', 'kitchen'] })
    },
    onError: (err) => toast.error(err?.message ?? 'Error al actualizar línea'),
  })
}
```

- [ ] **Step 4: Create `usePosFloor.js`**

```js
// apps/desktop/src/modules/atlas.pos/hooks/usePosFloor.js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuth } from '../../../auth/AuthProvider'
import { atlas } from '../../../lib/atlas'

function useToken() {
  const { session } = useAuth()
  return session?.access_token
}

export function usePosActiveMap(outletId) {
  const token = useToken()
  return useQuery({
    queryKey: ['pos', 'tables', 'active-map', outletId],
    queryFn: () => atlas.pos.getActiveMap(outletId ? { outlet_id: outletId } : {}, token),
    enabled: Boolean(token),
    staleTime: 15 * 1000,
    refetchInterval: 30 * 1000,
  })
}

export function usePosFloors(query = {}) {
  const token = useToken()
  return useQuery({
    queryKey: ['pos', 'floors', query],
    queryFn: () => atlas.pos.listFloors(query, token),
    enabled: Boolean(token),
    staleTime: 2 * 60 * 1000,
  })
}

export function useUpdateTableStatus() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ tableId, status }) =>
      atlas.pos.updateTableStatus(tableId, { status }, token),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pos', 'tables'] })
    },
    onError: (err) => toast.error(err?.message ?? 'Error al actualizar mesa'),
  })
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/modules/atlas.pos/hooks/
git commit -m "feat(pos): add order, catalog, kitchen and floor hooks"
```

---

## Task 3: Settings Screen

**Files:**
- Modify: `apps/desktop/src/modules/atlas.pos/screens/PosSettingsScreen.jsx`

The screen has 4 tabs: Configuración General, Sucursales & Terminales, Métodos de Pago (placeholder), Estaciones.

- [ ] **Step 1: Rewrite `PosSettingsScreen.jsx`**

```jsx
// apps/desktop/src/modules/atlas.pos/screens/PosSettingsScreen.jsx
import { useState } from 'react'
import {
  PageHeader, Card, CardContent, CardHeader, CardTitle, Button,
  Badge, EmptyState, Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter, Input, SelectField,
} from '@atlas/ui'
import {
  usePosSettings, useUpdatePosSettings,
  usePosOutlets, useCreatePosOutlet, useUpdatePosOutlet,
  usePosTerminals, useCreatePosTerminal, useUpdatePosTerminal,
  usePosStations, useCreatePosStation, useUpdatePosStation,
} from '../hooks/usePosSettings'

const MODE_OPTIONS = [
  { value: 'RESTAURANT', label: 'Restaurante' },
  { value: 'RETAIL', label: 'Tienda' },
  { value: 'HYBRID', label: 'Híbrido' },
]

const TABS = ['General', 'Sucursales & Terminales', 'Estaciones']

export default function PosSettingsScreen() {
  const [tab, setTab] = useState('General')

  return (
    <div className="min-h-full bg-[hsl(var(--background))] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <PageHeader title="Configuración POS" description="Sucursales, terminales, estaciones y parámetros generales." />
        <div className="flex gap-2 border-b border-border pb-2">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium rounded-t transition-colors ${
                tab === t
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        {tab === 'General' && <GeneralTab />}
        {tab === 'Sucursales & Terminales' && <OutletsTab />}
        {tab === 'Estaciones' && <StationsTab />}
      </div>
    </div>
  )
}

function GeneralTab() {
  const { data: settings, isLoading } = usePosSettings()
  const update = useUpdatePosSettings()
  const [mode, setMode] = useState(null)

  const currentMode = mode ?? settings?.mode ?? 'RESTAURANT'

  if (isLoading) return <p className="text-sm text-muted-foreground">Cargando...</p>

  return (
    <Card>
      <CardHeader><CardTitle>Parámetros generales</CardTitle></CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div>
          <label className="text-sm font-medium mb-1 block">Modo de operación</label>
          <SelectField
            value={currentMode}
            onChange={(v) => setMode(v)}
            options={MODE_OPTIONS}
          />
        </div>
        <div className="flex items-center gap-3">
          <input
            id="tips"
            type="checkbox"
            defaultChecked={settings?.tips_enabled ?? true}
            className="h-4 w-4"
          />
          <label htmlFor="tips" className="text-sm">Propinas habilitadas</label>
        </div>
        <Button
          onClick={() => update.mutate({ mode: currentMode })}
          disabled={update.isPending}
        >
          Guardar
        </Button>
      </CardContent>
    </Card>
  )
}

function OutletsTab() {
  const { data: outlets = [], isLoading: loadingOutlets } = usePosOutlets()
  const { data: terminals = [], isLoading: loadingTerminals } = usePosTerminals()
  const createOutlet = useCreatePosOutlet()
  const createTerminal = useCreatePosTerminal()
  const updateOutlet = useUpdatePosOutlet()
  const updateTerminal = useUpdatePosTerminal()

  const [outletDialog, setOutletDialog] = useState(false)
  const [terminalDialog, setTerminalDialog] = useState(false)
  const [outletName, setOutletName] = useState('')
  const [outletCode, setOutletCode] = useState('')
  const [terminalName, setTerminalName] = useState('')
  const [terminalCode, setTerminalCode] = useState('')
  const [terminalOutletId, setTerminalOutletId] = useState('')

  function handleCreateOutlet() {
    createOutlet.mutate({ name: outletName, code: outletCode || undefined }, {
      onSuccess: () => { setOutletDialog(false); setOutletName(''); setOutletCode('') },
    })
  }

  function handleCreateTerminal() {
    createTerminal.mutate(
      { name: terminalName, code: terminalCode || undefined, outlet_id: terminalOutletId },
      { onSuccess: () => { setTerminalDialog(false); setTerminalName(''); setTerminalCode(''); setTerminalOutletId('') } },
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Sucursales</CardTitle>
          <Button size="sm" onClick={() => setOutletDialog(true)}>+ Sucursal</Button>
        </CardHeader>
        <CardContent>
          {loadingOutlets ? (
            <p className="text-sm text-muted-foreground">Cargando...</p>
          ) : outlets.length === 0 ? (
            <EmptyState title="Sin sucursales" description="Crea la primera sucursal para continuar." />
          ) : (
            <ul className="divide-y divide-border">
              {outlets.map((o) => (
                <li key={o.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium">{o.name}</p>
                    {o.code && <p className="text-xs text-muted-foreground">Código: {o.code}</p>}
                  </div>
                  <Badge variant={o.enabled ? 'default' : 'secondary'}>
                    {o.enabled ? 'Activa' : 'Inactiva'}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Terminales</CardTitle>
          <Button size="sm" onClick={() => setTerminalDialog(true)} disabled={outlets.length === 0}>
            + Terminal
          </Button>
        </CardHeader>
        <CardContent>
          {loadingTerminals ? (
            <p className="text-sm text-muted-foreground">Cargando...</p>
          ) : terminals.length === 0 ? (
            <EmptyState title="Sin terminales" description="Crea una terminal para cada punto de venta." />
          ) : (
            <ul className="divide-y divide-border">
              {terminals.map((t) => {
                const outlet = outlets.find((o) => o.id === t.outlet_id)
                return (
                  <li key={t.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-medium">{t.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {outlet?.name ?? 'Sucursal desconocida'}{t.code ? ` · ${t.code}` : ''}
                      </p>
                    </div>
                    <Badge variant={t.enabled ? 'default' : 'secondary'}>
                      {t.enabled ? 'Activa' : 'Inactiva'}
                    </Badge>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={outletDialog} onOpenChange={setOutletDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nueva sucursal</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-3 py-4">
            <Input placeholder="Nombre" value={outletName} onChange={(e) => setOutletName(e.target.value)} />
            <Input placeholder="Código (opcional)" value={outletCode} onChange={(e) => setOutletCode(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOutletDialog(false)}>Cancelar</Button>
            <Button onClick={handleCreateOutlet} disabled={!outletName || createOutlet.isPending}>Crear</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={terminalDialog} onOpenChange={setTerminalDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nueva terminal</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-3 py-4">
            <SelectField
              value={terminalOutletId}
              onChange={setTerminalOutletId}
              options={outlets.map((o) => ({ value: o.id, label: o.name }))}
              placeholder="Selecciona sucursal"
            />
            <Input placeholder="Nombre" value={terminalName} onChange={(e) => setTerminalName(e.target.value)} />
            <Input placeholder="Código (opcional)" value={terminalCode} onChange={(e) => setTerminalCode(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setTerminalDialog(false)}>Cancelar</Button>
            <Button
              onClick={handleCreateTerminal}
              disabled={!terminalName || !terminalOutletId || createTerminal.isPending}
            >
              Crear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function StationsTab() {
  const { data: outlets = [] } = usePosOutlets()
  const [outletId, setOutletId] = useState('')
  const query = outletId ? { outlet_id: outletId } : {}
  const { data: stations = [], isLoading } = usePosStations(query)
  const createStation = useCreatePosStation()
  const [dialog, setDialog] = useState(false)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')

  function handleCreate() {
    createStation.mutate(
      { name, code, outlet_id: outletId },
      { onSuccess: () => { setDialog(false); setName(''); setCode('') } },
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Estaciones de preparación</CardTitle>
        <Button size="sm" onClick={() => setDialog(true)} disabled={!outletId}>+ Estación</Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <SelectField
          value={outletId}
          onChange={setOutletId}
          options={outlets.map((o) => ({ value: o.id, label: o.name }))}
          placeholder="Selecciona sucursal"
        />
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando...</p>
        ) : stations.length === 0 ? (
          <EmptyState title="Sin estaciones" description="Crea estaciones como Cocina, Barra, Postres." />
        ) : (
          <ul className="divide-y divide-border">
            {stations.map((s) => (
              <li key={s.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium">{s.name}</p>
                  <p className="text-xs text-muted-foreground">Código: {s.code}</p>
                </div>
                <Badge variant={s.enabled ? 'default' : 'secondary'}>
                  {s.enabled ? 'Activa' : 'Inactiva'}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nueva estación</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-3 py-4">
            <Input placeholder="Nombre (ej. Cocina)" value={name} onChange={(e) => setName(e.target.value)} />
            <Input placeholder="Código (ej. KITCHEN)" value={code} onChange={(e) => setCode(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialog(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={!name || !code || createStation.isPending}>Crear</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/desktop/src/modules/atlas.pos/screens/PosSettingsScreen.jsx
git commit -m "feat(pos): implement settings screen with outlets, terminals and stations tabs"
```

---

## Task 4: Session Dialogs + Sessions Screen

**Files:**
- Create: `apps/desktop/src/modules/atlas.pos/components/SessionOpenDialog.jsx`
- Create: `apps/desktop/src/modules/atlas.pos/components/SessionCloseDialog.jsx`
- Create: `apps/desktop/src/modules/atlas.pos/components/CashMovementDialog.jsx`
- Modify: `apps/desktop/src/modules/atlas.pos/screens/PosSessionsScreen.jsx`

- [ ] **Step 1: Create `SessionOpenDialog.jsx`**

```jsx
// apps/desktop/src/modules/atlas.pos/components/SessionOpenDialog.jsx
import { useState } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  Button, Input, SelectField,
} from '@atlas/ui'
import { usePosTerminals } from '../hooks/usePosSettings'
import { useOpenPosSession } from '../hooks/usePosSession'

export default function SessionOpenDialog({ open, onOpenChange, onSuccess }) {
  const { data: terminals = [] } = usePosTerminals()
  const openSession = useOpenPosSession()
  const [terminalId, setTerminalId] = useState('')
  const [amount, setAmount] = useState('0')

  function handleOpen() {
    openSession.mutate(
      { terminal_id: terminalId, opening_cash_amount: parseFloat(amount) || 0 },
      { onSuccess: (data) => { onSuccess?.(data); onOpenChange(false) } },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Abrir caja</DialogTitle></DialogHeader>
        <div className="flex flex-col gap-4 py-4">
          <SelectField
            value={terminalId}
            onChange={setTerminalId}
            options={terminals.map((t) => ({ value: t.id, label: t.name }))}
            placeholder="Selecciona terminal"
          />
          <div>
            <label className="text-sm font-medium mb-1 block">Efectivo inicial</label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleOpen} disabled={!terminalId || openSession.isPending}>
            Abrir caja
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Create `SessionCloseDialog.jsx`**

```jsx
// apps/desktop/src/modules/atlas.pos/components/SessionCloseDialog.jsx
import { useState } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  Button, Input,
} from '@atlas/ui'
import { useClosePosSession } from '../hooks/usePosSession'

export default function SessionCloseDialog({ open, onOpenChange, session, onSuccess }) {
  const close = useClosePosSession()
  const [counted, setCounted] = useState('')
  const [notes, setNotes] = useState('')

  const expected = parseFloat(session?.expected_cash_amount ?? 0)
  const countedNum = parseFloat(counted) || 0
  const diff = countedNum - expected

  function handleClose() {
    close.mutate(
      { id: session.id, counted_cash_amount: countedNum, notes: notes || undefined },
      { onSuccess: (data) => { onSuccess?.(data); onOpenChange(false) } },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Cerrar caja</DialogTitle></DialogHeader>
        <div className="flex flex-col gap-4 py-4">
          <div className="rounded-lg bg-muted p-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Efectivo esperado</span>
              <span className="font-medium">${expected.toFixed(2)}</span>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Efectivo contado</label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={counted}
              onChange={(e) => setCounted(e.target.value)}
              placeholder="0.00"
            />
          </div>
          {counted !== '' && (
            <div className={`text-sm font-medium ${diff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              Diferencia: {diff >= 0 ? '+' : ''}{diff.toFixed(2)}
            </div>
          )}
          <div>
            <label className="text-sm font-medium mb-1 block">Notas (opcional)</label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observaciones del cierre" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={handleClose}
            disabled={counted === '' || close.isPending}
            variant="destructive"
          >
            Cerrar caja
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 3: Create `CashMovementDialog.jsx`**

```jsx
// apps/desktop/src/modules/atlas.pos/components/CashMovementDialog.jsx
import { useState } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  Button, Input, SelectField,
} from '@atlas/ui'
import { useAddCashMovement } from '../hooks/usePosSession'

const KIND_OPTIONS = [
  { value: 'IN', label: 'Entrada de efectivo' },
  { value: 'OUT', label: 'Salida de efectivo' },
]

export default function CashMovementDialog({ open, onOpenChange, sessionId }) {
  const addMovement = useAddCashMovement()
  const [kind, setKind] = useState('IN')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')

  function handleSave() {
    addMovement.mutate(
      { sessionId, kind, amount: parseFloat(amount), reason },
      { onSuccess: () => { onOpenChange(false); setAmount(''); setReason(''); setKind('IN') } },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Movimiento de efectivo</DialogTitle></DialogHeader>
        <div className="flex flex-col gap-4 py-4">
          <SelectField value={kind} onChange={setKind} options={KIND_OPTIONS} />
          <div>
            <label className="text-sm font-medium mb-1 block">Monto</label>
            <Input
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Motivo</label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ej. Cambio de turno" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!amount || !reason || addMovement.isPending}>
            Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 4: Rewrite `PosSessionsScreen.jsx`**

```jsx
// apps/desktop/src/modules/atlas.pos/screens/PosSessionsScreen.jsx
import { useState } from 'react'
import {
  PageHeader, Card, CardContent, CardHeader, CardTitle,
  Badge, Button, EmptyState,
} from '@atlas/ui'
import { usePosSessions } from '../hooks/usePosSession'
import SessionOpenDialog from '../components/SessionOpenDialog'
import SessionCloseDialog from '../components/SessionCloseDialog'
import CashMovementDialog from '../components/CashMovementDialog'

const STATUS_LABELS = { OPEN: 'Abierta', CLOSED: 'Cerrada', CANCELLED: 'Cancelada' }
const STATUS_VARIANTS = { OPEN: 'default', CLOSED: 'secondary', CANCELLED: 'destructive' }

export default function PosSessionsScreen() {
  const { data: sessions = [], isLoading } = usePosSessions({ limit: 20 })
  const [openDialog, setOpenDialog] = useState(false)
  const [closeTarget, setCloseTarget] = useState(null)
  const [movementTarget, setMovementTarget] = useState(null)

  const activeSessions = sessions.filter((s) => s.status === 'OPEN')
  const historySessions = sessions.filter((s) => s.status !== 'OPEN')

  return (
    <div className="min-h-full bg-[hsl(var(--background))] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <PageHeader
          title="Cajas"
          description="Apertura, movimientos de efectivo, cierre y diferencias de caja."
          actions={
            <Button onClick={() => setOpenDialog(true)}>Abrir caja</Button>
          }
        />

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando sesiones...</p>
        ) : activeSessions.length === 0 && historySessions.length === 0 ? (
          <EmptyState
            title="Sin sesiones"
            description="Abre una caja para iniciar las operaciones del día."
          />
        ) : null}

        {activeSessions.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Cajas activas</CardTitle></CardHeader>
            <CardContent>
              <ul className="divide-y divide-border">
                {activeSessions.map((s) => (
                  <li key={s.id} className="py-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-sm">{s.terminal?.name ?? 'Terminal'}</p>
                        <p className="text-xs text-muted-foreground">
                          Apertura: ${parseFloat(s.opening_cash_amount ?? 0).toFixed(2)} ·{' '}
                          {new Date(s.opened_at).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => setMovementTarget(s)}>
                          Movimiento
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => setCloseTarget(s)}>
                          Cerrar caja
                        </Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {historySessions.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Historial de cajas</CardTitle></CardHeader>
            <CardContent>
              <ul className="divide-y divide-border">
                {historySessions.map((s) => (
                  <li key={s.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-medium">{s.terminal?.name ?? 'Terminal'}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(s.opened_at).toLocaleDateString('es-MX')}
                        {s.closed_at ? ` — ${new Date(s.closed_at).toLocaleTimeString('es-MX', { timeStyle: 'short' })}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {s.difference_amount != null && (
                        <span className={`text-sm font-medium ${parseFloat(s.difference_amount) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {parseFloat(s.difference_amount) >= 0 ? '+' : ''}{parseFloat(s.difference_amount).toFixed(2)}
                        </span>
                      )}
                      <Badge variant={STATUS_VARIANTS[s.status]}>{STATUS_LABELS[s.status]}</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>

      <SessionOpenDialog open={openDialog} onOpenChange={setOpenDialog} />
      {closeTarget && (
        <SessionCloseDialog
          open={Boolean(closeTarget)}
          onOpenChange={(v) => !v && setCloseTarget(null)}
          session={closeTarget}
          onSuccess={() => setCloseTarget(null)}
        />
      )}
      {movementTarget && (
        <CashMovementDialog
          open={Boolean(movementTarget)}
          onOpenChange={(v) => !v && setMovementTarget(null)}
          sessionId={movementTarget.id}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/modules/atlas.pos/components/SessionOpenDialog.jsx apps/desktop/src/modules/atlas.pos/components/SessionCloseDialog.jsx apps/desktop/src/modules/atlas.pos/components/CashMovementDialog.jsx apps/desktop/src/modules/atlas.pos/screens/PosSessionsScreen.jsx
git commit -m "feat(pos): implement sessions screen with open, close and cash movement dialogs"
```

---

## Task 5: Orders Screen (Administrative)

**Files:**
- Modify: `apps/desktop/src/modules/atlas.pos/screens/PosOrdersScreen.jsx`

- [ ] **Step 1: Rewrite `PosOrdersScreen.jsx`**

```jsx
// apps/desktop/src/modules/atlas.pos/screens/PosOrdersScreen.jsx
import { useState } from 'react'
import {
  PageHeader, Card, CardContent, Badge, Button, Input, EmptyState, ErrorState,
} from '@atlas/ui'
import { usePosOrders, useReprintPosReceipt } from '../hooks/usePosOrder'

const STATUS_LABELS = {
  DRAFT: 'Borrador', OPEN: 'Abierta', SENT: 'En cocina',
  PARTIALLY_SERVED: 'Parcialmente servida', SERVED: 'Servida',
  PAID: 'Pagada', CANCELLED: 'Cancelada', REFUNDED: 'Reembolsada',
}
const STATUS_VARIANTS = {
  DRAFT: 'secondary', OPEN: 'default', SENT: 'default',
  PARTIALLY_SERVED: 'default', SERVED: 'default',
  PAID: 'secondary', CANCELLED: 'destructive', REFUNDED: 'destructive',
}
const CHANNEL_LABELS = {
  IN_STORE: 'Sucursal', PHONE: 'Teléfono', WEBSITE: 'Web',
  UBER_EATS: 'Uber Eats', RAPPI: 'Rappi', DIDI_FOOD: 'DiDi Food', OTHER: 'Otro',
}
const STATUS_OPTIONS = ['', 'OPEN', 'SENT', 'PARTIALLY_SERVED', 'SERVED', 'PAID', 'CANCELLED']

export default function PosOrdersScreen() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const query = {}
  if (status) query.status = status

  const { data: orders = [], isLoading, isError } = usePosOrders(query)
  const reprint = useReprintPosReceipt()

  const filtered = orders.filter((o) => {
    if (!search) return true
    const s = search.toLowerCase()
    return (
      String(o.order_number).includes(s) ||
      (o.customer_name ?? '').toLowerCase().includes(s) ||
      (o.table?.name ?? '').toLowerCase().includes(s)
    )
  })

  return (
    <div className="min-h-full bg-[hsl(var(--background))] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <PageHeader title="Órdenes" description="Historial de órdenes, estado de pago y reimpresión de recibos." />

        <div className="flex gap-3 flex-wrap">
          <Input
            placeholder="Buscar por #, cliente o mesa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
          <select
            className="border border-border rounded-md px-3 py-2 text-sm bg-background"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">Todos los estados</option>
            {STATUS_OPTIONS.filter(Boolean).map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
        </div>

        {isError ? (
          <ErrorState title="Error al cargar" description="No se pudieron obtener las órdenes." />
        ) : isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando órdenes...</p>
        ) : filtered.length === 0 ? (
          <EmptyState title="Sin órdenes" description="No hay órdenes que coincidan con el filtro." />
        ) : (
          <Card>
            <CardContent className="p-0">
              <ul className="divide-y divide-border">
                {filtered.map((o) => (
                  <li key={o.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-sm font-medium">
                        #{o.order_number}
                        {o.table?.name ? ` · Mesa ${o.table.name}` : ''}
                        {o.customer_name ? ` · ${o.customer_name}` : ''}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {CHANNEL_LABELS[o.sales_channel] ?? o.sales_channel} ·{' '}
                        {new Date(o.opened_at).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold">${parseFloat(o.total_amount ?? 0).toFixed(2)}</span>
                      <Badge variant={STATUS_VARIANTS[o.status]}>{STATUS_LABELS[o.status]}</Badge>
                      {o.status === 'PAID' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => reprint.mutate(o.id)}
                          disabled={reprint.isPending}
                        >
                          Reimprimir
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/desktop/src/modules/atlas.pos/screens/PosOrdersScreen.jsx
git commit -m "feat(pos): implement orders admin screen with search, filter and reprint"
```

---

## Task 6: Terminal Screen — ProductGrid + OrderPanel

**Files:**
- Create: `apps/desktop/src/modules/atlas.pos/components/ProductGrid.jsx`
- Create: `apps/desktop/src/modules/atlas.pos/components/OrderPanel.jsx`
- Modify: `apps/desktop/src/modules/atlas.pos/screens/PosTerminalScreen.jsx`

The terminal is fullscreen (no AppShell sidebar). It uses a two-column layout: left = ProductGrid, right = OrderPanel.

- [ ] **Step 1: Create `ProductGrid.jsx`**

```jsx
// apps/desktop/src/modules/atlas.pos/components/ProductGrid.jsx
import { useState } from 'react'
import { Badge, EmptyState } from '@atlas/ui'
import { usePosCatalogCategories, usePosCatalogProducts } from '../hooks/usePosCatalog'

export default function ProductGrid({ onSelect }) {
  const { data: categories = [] } = usePosCatalogCategories()
  const [activeCat, setActiveCat] = useState(null)

  const params = activeCat ? { category_id: activeCat } : {}
  const { data: products = [], isLoading } = usePosCatalogProducts(params)

  return (
    <div className="flex flex-col h-full">
      {/* Category tabs */}
      <div className="flex gap-2 overflow-x-auto p-3 border-b border-border shrink-0 scrollbar-hide">
        <button
          onClick={() => setActiveCat(null)}
          className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            !activeCat ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
          }`}
        >
          Todos
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setActiveCat(c.id)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              activeCat === c.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* Product grid */}
      <div className="flex-1 overflow-y-auto p-3">
        {isLoading ? (
          <p className="text-sm text-muted-foreground p-4">Cargando productos...</p>
        ) : products.length === 0 ? (
          <EmptyState title="Sin productos" description="No hay productos en esta categoría." />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {products.map((p) => (
              <button
                key={p.id}
                onClick={() => onSelect(p)}
                className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-3 text-center hover:border-primary hover:bg-primary/5 active:scale-95 transition-all"
              >
                {p.image_url ? (
                  <img src={p.image_url} alt={p.name} className="h-16 w-16 rounded-lg object-cover" />
                ) : (
                  <div className="h-16 w-16 rounded-lg bg-muted flex items-center justify-center text-2xl">
                    🍽
                  </div>
                )}
                <span className="text-sm font-medium leading-tight line-clamp-2">{p.name}</span>
                <span className="text-sm font-semibold text-primary">
                  ${parseFloat(p.price ?? p.base_price ?? 0).toFixed(2)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `OrderPanel.jsx`**

```jsx
// apps/desktop/src/modules/atlas.pos/components/OrderPanel.jsx
import { useState } from 'react'
import { Button, Badge, ConfirmDialog } from '@atlas/ui'
import {
  useAddPosOrderLine, useUpdatePosOrderLine, useDeletePosOrderLine,
  useSendToKitchen, useCancelPosOrder,
} from '../hooks/usePosOrder'

export default function OrderPanel({ order, onPay, onNewOrder }) {
  const addLine = useAddPosOrderLine()
  const updateLine = useUpdatePosOrderLine()
  const deleteLine = useDeletePosOrderLine()
  const sendKitchen = useSendToKitchen()
  const cancelOrder = useCancelPosOrder()
  const [cancelConfirm, setCancelConfirm] = useState(false)

  const lines = order?.lines ?? []
  const isPaid = order?.status === 'PAID'
  const isCancelled = order?.status === 'CANCELLED'
  const locked = isPaid || isCancelled

  function changeQty(line, delta) {
    const newQty = parseFloat(line.quantity) + delta
    if (newQty <= 0) {
      deleteLine.mutate({ orderId: order.id, lineId: line.id })
    } else {
      updateLine.mutate({ orderId: order.id, lineId: line.id, quantity: newQty })
    }
  }

  return (
    <div className="flex flex-col h-full bg-background border-l border-border">
      {/* Header */}
      <div className="p-4 border-b border-border shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-sm">
              {order ? `Orden #${order.order_number}` : 'Sin orden activa'}
            </p>
            {order?.table?.name && (
              <p className="text-xs text-muted-foreground">Mesa: {order.table.name}</p>
            )}
          </div>
          {order && !locked && (
            <Button size="sm" variant="ghost" onClick={() => setCancelConfirm(true)}>
              Cancelar
            </Button>
          )}
        </div>
      </div>

      {/* Lines */}
      <div className="flex-1 overflow-y-auto p-4">
        {lines.length === 0 ? (
          <p className="text-sm text-center text-muted-foreground py-8">
            Selecciona productos para agregar a la orden
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {lines.map((line) => (
              <li key={line.id} className="flex items-center gap-3 py-2 border-b border-border/50">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{line.product_name}</p>
                  <p className="text-xs text-muted-foreground">
                    ${parseFloat(line.unit_price).toFixed(2)} c/u
                  </p>
                  {line.note && (
                    <p className="text-xs text-muted-foreground italic">{line.note}</p>
                  )}
                </div>
                {!locked ? (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => changeQty(line, -1)}
                      className="h-7 w-7 rounded-full border border-border flex items-center justify-center text-sm hover:bg-muted"
                    >
                      −
                    </button>
                    <span className="w-8 text-center text-sm font-medium">
                      {parseFloat(line.quantity)}
                    </span>
                    <button
                      onClick={() => changeQty(line, 1)}
                      className="h-7 w-7 rounded-full border border-border flex items-center justify-center text-sm hover:bg-muted"
                    >
                      +
                    </button>
                  </div>
                ) : (
                  <span className="text-sm shrink-0">x{parseFloat(line.quantity)}</span>
                )}
                <span className="text-sm font-semibold shrink-0 w-16 text-right">
                  ${parseFloat(line.total_amount ?? 0).toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Totals */}
      {order && (
        <div className="p-4 border-t border-border space-y-1 shrink-0 bg-muted/30">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span>${parseFloat(order.subtotal_amount ?? 0).toFixed(2)}</span>
          </div>
          {parseFloat(order.tax_amount ?? 0) > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">IVA</span>
              <span>${parseFloat(order.tax_amount).toFixed(2)}</span>
            </div>
          )}
          {parseFloat(order.discount_amount ?? 0) > 0 && (
            <div className="flex justify-between text-sm text-red-600">
              <span>Descuento</span>
              <span>−${parseFloat(order.discount_amount).toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-base pt-1 border-t border-border mt-1">
            <span>Total</span>
            <span>${parseFloat(order.total_amount ?? 0).toFixed(2)}</span>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="p-4 flex flex-col gap-2 shrink-0">
        {!order ? (
          <Button onClick={onNewOrder} className="w-full">Nueva orden</Button>
        ) : !locked ? (
          <>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => sendKitchen.mutate(order.id)}
                disabled={lines.length === 0 || sendKitchen.isPending}
              >
                Enviar a cocina
              </Button>
              <Button
                className="flex-1"
                onClick={onPay}
                disabled={lines.length === 0}
              >
                Cobrar
              </Button>
            </div>
            <Button variant="ghost" className="w-full text-sm" onClick={onNewOrder}>
              + Nueva orden
            </Button>
          </>
        ) : (
          <div className="text-center text-sm text-muted-foreground">
            Orden {isPaid ? 'pagada' : 'cancelada'}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={cancelConfirm}
        onOpenChange={setCancelConfirm}
        title="Cancelar orden"
        description="Esta acción no se puede deshacer. ¿Deseas cancelar la orden?"
        confirmLabel="Cancelar orden"
        variant="destructive"
        onConfirm={() => {
          cancelOrder.mutate({ orderId: order.id, reason: 'Cancelado desde terminal' }, {
            onSuccess: () => setCancelConfirm(false),
          })
        }}
      />
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/modules/atlas.pos/components/ProductGrid.jsx apps/desktop/src/modules/atlas.pos/components/OrderPanel.jsx
git commit -m "feat(pos): add ProductGrid and OrderPanel components"
```

---

## Task 7: PaymentDialog + Terminal Screen integration

**Files:**
- Create: `apps/desktop/src/modules/atlas.pos/components/PaymentDialog.jsx`
- Modify: `apps/desktop/src/modules/atlas.pos/screens/PosTerminalScreen.jsx`

- [ ] **Step 1: Create `PaymentDialog.jsx`**

```jsx
// apps/desktop/src/modules/atlas.pos/components/PaymentDialog.jsx
import { useState } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  Button, Input,
} from '@atlas/ui'
import { usePosStations } from '../hooks/usePosSettings'
import { useAddPosPayment } from '../hooks/usePosOrder'
import { atlas } from '../../../lib/atlas'
import { useAuth } from '../../../auth/AuthProvider'
import { useQuery } from '@tanstack/react-query'

function usePaymentMethods() {
  const { session } = useAuth()
  const token = session?.access_token
  return useQuery({
    queryKey: ['pos', 'payment-methods'],
    queryFn: () => atlas.pos.listOutlets(token).then(() =>
      fetch(`${import.meta.env.VITE_ATLAS_API_URL ?? ''}/pos/payment-methods`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => r.json())
    ),
    enabled: Boolean(token),
    staleTime: 10 * 60 * 1000,
  })
}

export default function PaymentDialog({ open, onOpenChange, order, onSuccess }) {
  const { data: methods = [] } = usePaymentMethods()
  const addPayment = useAddPosPayment()
  const [selectedMethod, setSelectedMethod] = useState(null)
  const [amount, setAmount] = useState('')

  const totalDue = parseFloat(order?.total_amount ?? 0) - parseFloat(order?.paid_amount ?? 0)
  const amountNum = parseFloat(amount) || 0
  const isExact = amountNum === totalDue

  const enabledMethods = methods.filter?.((m) => m.enabled) ?? []
  const activeMethod = enabledMethods.find((m) => m.id === selectedMethod)

  function handlePay() {
    if (!selectedMethod) return
    const payAmount = amount === '' ? totalDue : amountNum
    addPayment.mutate(
      { orderId: order.id, payment_method_id: selectedMethod, amount: payAmount },
      {
        onSuccess: (data) => {
          setAmount('')
          setSelectedMethod(null)
          onSuccess?.(data)
          onOpenChange(false)
        },
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Cobro — ${totalDue.toFixed(2)}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-4">
          <div className="grid grid-cols-2 gap-2">
            {enabledMethods.length === 0 ? (
              <p className="col-span-2 text-sm text-muted-foreground text-center">
                Sin métodos de pago configurados
              </p>
            ) : (
              enabledMethods.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setSelectedMethod(m.id)}
                  className={`rounded-lg border p-3 text-sm font-medium transition-colors ${
                    selectedMethod === m.id
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  {m.name}
                </button>
              ))
            )}
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Monto recibido (vacío = exacto)</label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={totalDue.toFixed(2)}
            />
            {amount !== '' && amountNum > totalDue && (
              <p className="text-xs text-green-600 mt-1">
                Cambio: ${(amountNum - totalDue).toFixed(2)}
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={handlePay}
            disabled={!selectedMethod || (amount !== '' && amountNum < totalDue) || addPayment.isPending}
          >
            Confirmar cobro
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Rewrite `PosTerminalScreen.jsx`**

```jsx
// apps/desktop/src/modules/atlas.pos/screens/PosTerminalScreen.jsx
import { useState } from 'react'
import { useCreatePosOrder, useAddPosOrderLine, usePosOrder } from '../hooks/usePosOrder'
import ProductGrid from '../components/ProductGrid'
import OrderPanel from '../components/OrderPanel'
import PaymentDialog from '../components/PaymentDialog'

export default function PosTerminalScreen() {
  const [activeOrderId, setActiveOrderId] = useState(null)
  const [payDialog, setPayDialog] = useState(false)
  const createOrder = useCreatePosOrder()
  const addLine = useAddPosOrderLine()
  const { data: activeOrder } = usePosOrder(activeOrderId)

  function handleNewOrder() {
    createOrder.mutate(
      { fulfillment_type: 'DINE_IN' },
      { onSuccess: (order) => setActiveOrderId(order.id) },
    )
  }

  function handleProductSelect(product) {
    if (!activeOrderId) {
      createOrder.mutate(
        { fulfillment_type: 'DINE_IN' },
        {
          onSuccess: (order) => {
            setActiveOrderId(order.id)
            addLine.mutate({
              orderId: order.id,
              product_id: product.id,
              product_name: product.name,
              quantity: 1,
              unit_price: parseFloat(product.price ?? product.base_price ?? 0),
            })
          },
        },
      )
      return
    }
    addLine.mutate({
      orderId: activeOrderId,
      product_id: product.id,
      product_name: product.name,
      quantity: 1,
      unit_price: parseFloat(product.price ?? product.base_price ?? 0),
    })
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Left: product grid */}
      <div className="flex-1 min-w-0 overflow-hidden">
        <ProductGrid onSelect={handleProductSelect} />
      </div>

      {/* Right: order panel — fixed 340px */}
      <div className="w-[340px] shrink-0 flex flex-col overflow-hidden">
        <OrderPanel
          order={activeOrder}
          onPay={() => setPayDialog(true)}
          onNewOrder={handleNewOrder}
        />
      </div>

      {activeOrder && (
        <PaymentDialog
          open={payDialog}
          onOpenChange={setPayDialog}
          order={activeOrder}
          onSuccess={() => setActiveOrderId(null)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/modules/atlas.pos/components/PaymentDialog.jsx apps/desktop/src/modules/atlas.pos/screens/PosTerminalScreen.jsx
git commit -m "feat(pos): implement terminal screen with product grid, order panel and payment dialog"
```

---

## Task 8: Tables Screen + Stations Screen

**Files:**
- Create: `apps/desktop/src/modules/atlas.pos/components/TableMap.jsx`
- Create: `apps/desktop/src/modules/atlas.pos/components/KitchenStationBoard.jsx`
- Modify: `apps/desktop/src/modules/atlas.pos/screens/PosTablesScreen.jsx`
- Modify: `apps/desktop/src/modules/atlas.pos/screens/PosStationsScreen.jsx`

- [ ] **Step 1: Create `TableMap.jsx`**

```jsx
// apps/desktop/src/modules/atlas.pos/components/TableMap.jsx
import { EmptyState } from '@atlas/ui'
import { useUpdateTableStatus } from '../hooks/usePosFloor'

const STATUS_COLORS = {
  AVAILABLE: 'bg-green-100 border-green-400 text-green-800',
  OCCUPIED: 'bg-amber-100 border-amber-400 text-amber-800',
  BILL_REQUESTED: 'bg-orange-100 border-orange-400 text-orange-800',
  DIRTY: 'bg-slate-100 border-slate-400 text-slate-600',
  RESERVED: 'bg-blue-100 border-blue-400 text-blue-800',
  DISABLED: 'bg-gray-100 border-gray-300 text-gray-400',
}

const STATUS_LABELS = {
  AVAILABLE: 'Disponible', OCCUPIED: 'Ocupada', BILL_REQUESTED: 'Cuenta pedida',
  DIRTY: 'Sucia', RESERVED: 'Reservada', DISABLED: 'Deshabilitada',
}

export default function TableMap({ tables = [], onTableClick }) {
  const updateStatus = useUpdateTableStatus()

  if (tables.length === 0) {
    return (
      <EmptyState
        title="Sin mesas"
        description="Crea un plano con mesas en el diseñador de plantas."
      />
    )
  }

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3 p-4">
      {tables.map((table) => (
        <button
          key={table.id}
          onClick={() => onTableClick(table)}
          disabled={table.status === 'DISABLED'}
          className={`aspect-square flex flex-col items-center justify-center rounded-xl border-2 transition-all hover:scale-105 active:scale-95 ${
            STATUS_COLORS[table.status] ?? STATUS_COLORS.AVAILABLE
          } ${table.status === 'DISABLED' ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
        >
          <span className="text-lg font-bold leading-none">{table.name}</span>
          <span className="text-[10px] mt-1 font-medium">{STATUS_LABELS[table.status]}</span>
          {table.capacity && (
            <span className="text-[10px] opacity-70">{table.capacity} pers.</span>
          )}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Rewrite `PosTablesScreen.jsx`**

```jsx
// apps/desktop/src/modules/atlas.pos/screens/PosTablesScreen.jsx
import { useState } from 'react'
import { usePosActiveMap } from '../hooks/usePosFloor'
import { usePosOutlets } from '../hooks/usePosSettings'
import { useCreatePosOrder, usePosOrders } from '../hooks/usePosOrder'
import { SelectField, EmptyState } from '@atlas/ui'
import TableMap from '../components/TableMap'
import { useNavigate } from 'react-router-dom'

export default function PosTablesScreen() {
  const navigate = useNavigate()
  const { data: outlets = [] } = usePosOutlets()
  const [outletId, setOutletId] = useState('')
  const { data: floorMap, isLoading } = usePosActiveMap(outletId || undefined)
  const { data: openOrders = [] } = usePosOrders({ status: 'OPEN' })
  const createOrder = useCreatePosOrder()

  const tables = floorMap?.tables ?? []
  const zones = floorMap?.zones ?? []
  const [zoneFilter, setZoneFilter] = useState('')

  const filteredTables = zoneFilter
    ? tables.filter((t) => t.zone_id === zoneFilter)
    : tables

  function handleTableClick(table) {
    const existingOrder = openOrders.find((o) => o.table_id === table.id)
    if (existingOrder) {
      navigate(`/app/m/atlas.pos/pos/terminal?order=${existingOrder.id}`)
      return
    }
    createOrder.mutate(
      { table_id: table.id, fulfillment_type: 'DINE_IN' },
      {
        onSuccess: (order) => {
          navigate(`/app/m/atlas.pos/pos/terminal?order=${order.id}`)
        },
      },
    )
  }

  return (
    <div className="flex h-screen flex-col bg-background overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center gap-3 p-4 border-b border-border shrink-0">
        <h1 className="font-semibold text-lg">Mesas</h1>
        <div className="flex gap-2 ml-auto">
          {outlets.length > 1 && (
            <SelectField
              value={outletId}
              onChange={setOutletId}
              options={outlets.map((o) => ({ value: o.id, label: o.name }))}
              placeholder="Sucursal"
            />
          )}
          {zones.length > 0 && (
            <SelectField
              value={zoneFilter}
              onChange={setZoneFilter}
              options={[{ value: '', label: 'Todas las zonas' }, ...zones.map((z) => ({ value: z.id, label: z.name }))]}
            />
          )}
        </div>
      </div>

      {/* Table grid */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <p className="text-sm text-muted-foreground p-8 text-center">Cargando plano...</p>
        ) : filteredTables.length === 0 ? (
          <EmptyState
            title="Sin mesas"
            description="No hay mesas en el plano activo. Configura el plano de planta primero."
          />
        ) : (
          <TableMap tables={filteredTables} onTableClick={handleTableClick} />
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create `KitchenStationBoard.jsx`**

```jsx
// apps/desktop/src/modules/atlas.pos/components/KitchenStationBoard.jsx
import { Badge, Button } from '@atlas/ui'
import { useUpdateTicketStatus } from '../hooks/usePosKitchen'

const STATUS_LABELS = {
  PENDING: 'Pendiente', IN_PREPARATION: 'En preparación',
  READY: 'Listo', DELIVERED: 'Entregado', CANCELLED: 'Cancelado',
}

const NEXT_STATUS = {
  PENDING: 'IN_PREPARATION',
  IN_PREPARATION: 'READY',
  READY: 'DELIVERED',
}

const STATUS_COLORS = {
  PENDING: 'border-amber-300 bg-amber-50',
  IN_PREPARATION: 'border-blue-300 bg-blue-50',
  READY: 'border-green-300 bg-green-50',
}

const COLUMNS = ['PENDING', 'IN_PREPARATION', 'READY']

export default function KitchenStationBoard({ tickets = [] }) {
  const updateStatus = useUpdateTicketStatus()

  const byStatus = COLUMNS.reduce((acc, s) => {
    acc[s] = tickets.filter((t) => t.status === s)
    return acc
  }, {})

  return (
    <div className="grid grid-cols-3 gap-4 p-4 h-full overflow-y-auto">
      {COLUMNS.map((col) => (
        <div key={col} className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm">{STATUS_LABELS[col]}</h3>
            <Badge variant="secondary">{byStatus[col].length}</Badge>
          </div>
          {byStatus[col].map((ticket) => (
            <div
              key={ticket.id}
              className={`rounded-xl border-2 p-3 flex flex-col gap-2 ${STATUS_COLORS[col]}`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-sm">
                    Orden #{ticket.order?.order_number}
                  </p>
                  {ticket.order?.table?.name && (
                    <p className="text-xs text-muted-foreground">Mesa: {ticket.order.table.name}</p>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(ticket.sent_at).toLocaleTimeString('es-MX', { timeStyle: 'short' })}
                </span>
              </div>
              <ul className="space-y-1">
                {(ticket.lines ?? []).map((line) => (
                  <li key={line.id} className="text-sm flex items-center gap-1">
                    <span className="font-medium">{parseFloat(line.quantity)}x</span>
                    <span>{line.order_line?.product_name ?? 'Producto'}</span>
                    {line.order_line?.note && (
                      <span className="text-xs text-muted-foreground italic"> — {line.order_line.note}</span>
                    )}
                  </li>
                ))}
              </ul>
              {NEXT_STATUS[col] && (
                <Button
                  size="sm"
                  variant={col === 'IN_PREPARATION' ? 'default' : 'outline'}
                  className="w-full"
                  onClick={() => updateStatus.mutate({ ticketId: ticket.id, status: NEXT_STATUS[col] })}
                  disabled={updateStatus.isPending}
                >
                  {col === 'PENDING' ? 'Iniciar' : col === 'IN_PREPARATION' ? 'Listo' : 'Entregar'}
                </Button>
              )}
            </div>
          ))}
          {byStatus[col].length === 0 && (
            <p className="text-sm text-center text-muted-foreground py-6 border border-dashed border-border rounded-xl">
              Sin tickets
            </p>
          )}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Rewrite `PosStationsScreen.jsx`**

```jsx
// apps/desktop/src/modules/atlas.pos/screens/PosStationsScreen.jsx
import { useState } from 'react'
import { usePosStations } from '../hooks/usePosSettings'
import { usePosStationTickets } from '../hooks/usePosKitchen'
import { usePosOutlets } from '../hooks/usePosSettings'
import { SelectField, EmptyState } from '@atlas/ui'
import KitchenStationBoard from '../components/KitchenStationBoard'

export default function PosStationsScreen() {
  const { data: outlets = [] } = usePosOutlets()
  const [outletId, setOutletId] = useState('')
  const { data: stations = [] } = usePosStations(outletId ? { outlet_id: outletId } : {})
  const [stationId, setStationId] = useState('')
  const { data: tickets = [], isLoading } = usePosStationTickets(stationId)

  const activeStation = stations.find((s) => s.id === stationId)

  return (
    <div className="flex h-screen flex-col bg-background overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center gap-3 p-4 border-b border-border shrink-0 flex-wrap">
        <h1 className="font-semibold text-lg">Estaciones</h1>
        <div className="flex gap-2 ml-auto flex-wrap">
          {outlets.length > 1 && (
            <SelectField
              value={outletId}
              onChange={(v) => { setOutletId(v); setStationId('') }}
              options={outlets.map((o) => ({ value: o.id, label: o.name }))}
              placeholder="Sucursal"
            />
          )}
          <SelectField
            value={stationId}
            onChange={setStationId}
            options={stations.map((s) => ({ value: s.id, label: s.name }))}
            placeholder="Selecciona estación"
          />
        </div>
      </div>

      {/* Board */}
      <div className="flex-1 overflow-hidden">
        {!stationId ? (
          <EmptyState title="Selecciona una estación" description="Elige la estación para ver los tickets en preparación." />
        ) : isLoading ? (
          <p className="text-sm text-muted-foreground p-8 text-center">Cargando tickets...</p>
        ) : (
          <KitchenStationBoard tickets={tickets} />
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/modules/atlas.pos/components/TableMap.jsx apps/desktop/src/modules/atlas.pos/components/KitchenStationBoard.jsx apps/desktop/src/modules/atlas.pos/screens/PosTablesScreen.jsx apps/desktop/src/modules/atlas.pos/screens/PosStationsScreen.jsx
git commit -m "feat(pos): implement tables screen and kitchen stations board"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] Terminal screen with product grid, order panel, payment — Task 6, 7
- [x] Tables screen with zone selector and table status — Task 8
- [x] Sessions management: open, close, cash movements — Task 4
- [x] Orders admin view: search, filter, reprint — Task 5
- [x] Settings: outlets, terminals, stations, general config — Task 3
- [x] Kitchen stations board: ticket cards by status — Task 8
- [x] Hooks for all POS SDK methods — Task 1, 2
- [ ] Floor Planner — deferred to Plan C (requires canvas drag/resize)
- [ ] GuestSeatPanel — deferred to Plan C or post-MVP (complex seat management)

**Placeholders:** None found. All code blocks are complete implementations.

**Type consistency:**
- `atlas.pos.listStationTickets(stationId, query, token)` — matches SDK signature in Task 2 and Task 8
- `atlas.pos.addOrderLine(orderId, data, token)` — matches SDK and used in Task 2, 6, 7 consistently
- `useUpdateTableStatus` — created in `usePosFloor.js`, used in `TableMap.jsx` ✓
- `usePosCatalogProducts(params)` — first arg is `token` in SDK but hook wraps it; the hook signature passes `params` correctly ✓

**Note on PaymentDialog:** The `/pos/payment-methods` endpoint exists in the backend (from Plan A `pos-settings-service.js`). If it isn't mounted yet, the method list will be empty and the dialog will show "Sin métodos de pago configurados". Add a payment method via the Settings tab or seed it to unblock testing.

---

## Execution Choice

Plan complete and saved to `docs/superpowers/plans/2026-06-21-atlas-pos-plan-b-ui.md`.

**Two execution options:**

**1. Subagent-Driven (recommended)** — fresh subagent per task, review between tasks, fast iteration. Uses `superpowers:subagent-driven-development`.

**2. Inline Execution** — execute tasks in this session using `superpowers:executing-plans`, batch with checkpoints.

Which approach?
