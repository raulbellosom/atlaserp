# Atlas POS Core - Design Spec

**Date:** 2026-06-21
**Module:** `atlas.pos`
**Status:** Draft

---

## 1. Context

Atlas ERP necesita un modulo core de punto de venta que conviva con los modulos existentes sin pasar por AME3. `atlas.pos` debe seguir el patron de los modulos oficiales: modelos Prisma, migraciones, rutas Hono dedicadas, manifest oficial en `apps/api/src/manifests/official/core-modules.js`, SDK/cliente API si aplica, pantallas React propias en `apps/desktop/src/modules/atlas.pos`, y mapeo en `ModuleOutlet`.

El objetivo inicial es un POS de restaurante inspirado en flujos como Odoo POS: terminal tactil, seleccion de mesas, disenador visual de plano, comensales, comandas por estacion, cobro y cierre de caja. La arquitectura debe permitir modo tienda en una fase posterior sin crear un segundo modulo.

`atlas.pos` no debe ser AME3 ni vivir en `modules/custom`. Al ser core, puede y debe usar Prisma models normales, relaciones reales, migraciones versionadas y servicios API de primera clase.

---

## 2. Product Direction

### Decision

Construir un solo modulo core `atlas.pos` con modos operativos configurables:

- `RESTAURANT`: mesas, zonas, comensales, comandas y estaciones.
- `RETAIL`: venta rapida sin mesa, busqueda/escaneo, carrito simple y pago inmediato.
- `HYBRID`: ambos flujos activos para cafeterias, panaderias con comedor, food trucks con mesas o negocios mixtos.

### Recommendation

V1 debe entregar restaurante primero. Retail debe quedar soportado por el modelo de datos y por la configuracion, pero no necesita experiencia completa en la primera version.

### Rationale

Restaurante y tienda comparten el mismo nucleo: sesiones de caja, terminales, ordenes, lineas, productos, impuestos, descuentos, pagos, recibos, auditoria y reportes. Restaurante agrega una capa operacional: mesa, plano, comensales, estados de preparacion, estaciones y division de cuenta. Separar ambos en modulos distintos duplicaria el nucleo financiero y complicaria reportes, permisos, integraciones y mantenimiento.

---

## 3. Scope

### Included in V1

- Core module identity `atlas.pos` with `kind: CORE`, `core: true`, `uninstallable: false`
- Dependencies on `atlas.core`, `atlas.company`, `atlas.identity`, `atlas.catalog`
- Optional consumption of `atlas.files`, `atlas.ledger`, `atlas.notifications` for later phases
- POS settings per company/outlet: active mode, tax behavior, service charge, tips, currency, receipt options
- POS outlets and terminals
- Cash sessions: open, close, cash movements, expected vs counted cash
- Restaurant order lifecycle: draft/open, sent to kitchen, partially served, paid, cancelled
- Order lines with product snapshot from `atlas.catalog`
- Manual line notes and order notes
- Comensales/seats for restaurant orders
- Payment methods and payments
- Basic tax, discount and totals snapshots
- Tables, zones and floor plans
- Kitchen stations and kitchen tickets generated from order lines
- Main screens: Terminal, Tables, Floor Planner, Stations, Sessions, Orders, Settings
- Fullscreen/immersive layout for operational screens
- Audit log on state-changing operations
- Spanish UI text

### Excluded from V1

- Direct Uber Eats, Rappi or DiDi Food production integrations
- Menu publishing to third-party delivery platforms
- Delivery courier tracking
- Fiscal invoice generation / CFDI
- Loyalty program
- Reservations
- Advanced inventory depletion recipes/BOM
- Offline-first sync for POS orders
- Multi-currency
- Native printer drivers
- Kitchen display hardware integration beyond browser screens
- Ledger settlement automation
- Advanced retail returns and exchanges

### Future Backlog

- Retail mode UI
- Third-party delivery channels
- Website direct ordering via `atlas.website`
- Reservations and waitlist
- Kitchen display system with per-device station mode
- Printer routing by station
- Recipe-level inventory depletion
- Loyalty and customer accounts
- Ledger reconciliation and deposits
- Offline-capable terminal mode

---

## 4. Architecture

### Module Identity

```js
{
  key: "atlas.pos",
  name: "POS",
  description: "Punto de venta para restaurante, tienda y operaciones hibridas.",
  version: "0.1.0",
  kind: MODULE_KINDS.CORE,
  core: true,
  uninstallable: false,
  icon: "BadgeDollarSign",
  color: "#008C8C",
  pwa: { shortName: "POS", startPath: "/pos/terminal" },
  category: "comercial",
  summary: "Terminal de venta, mesas, comandas, pagos y cierres de caja.",
  dependencies: [
    { key: "atlas.core" },
    { key: "atlas.company" },
    { key: "atlas.identity" },
    { key: "atlas.catalog" },
  ],
  consumes: ["atlas.files", "atlas.ledger", "atlas.notifications"],
  fullscreenPaths: [
    "/pos/terminal",
    "/pos/tables",
    "/pos/floor-planner",
    "/pos/stations",
  ],
}
```

### File Structure

```text
apps/api/src/routes/pos/
  index.js
  pos-routes.js
  pos-service.js
  pos-session-service.js
  pos-order-service.js
  pos-payment-service.js
  pos-floor-service.js
  pos-kitchen-service.js
  pos-settings-service.js
  pos-external-channel-service.js
  validators.js
  __tests__/
    pos-session-service.test.js
    pos-order-service.test.js
    pos-kitchen-service.test.js

apps/desktop/src/modules/atlas.pos/
  screens/
    PosTerminalScreen.jsx
    PosTablesScreen.jsx
    PosFloorPlannerScreen.jsx
    PosStationsScreen.jsx
    PosSessionsScreen.jsx
    PosOrdersScreen.jsx
    PosSettingsScreen.jsx
  components/
    ProductGrid.jsx
    OrderPanel.jsx
    GuestSeatPanel.jsx
    PaymentDialog.jsx
    SplitBillDialog.jsx
    TableMap.jsx
    FloorCanvas.jsx
    FloorToolbox.jsx
    FloorPropertiesPanel.jsx
    KitchenStationBoard.jsx
    SessionOpenDialog.jsx
    SessionCloseDialog.jsx
  hooks/
    usePosCatalog.js
    usePosOrder.js
    usePosSession.js
    usePosFloor.js
    usePosKitchen.js

apps/api/src/manifests/official/core-modules.js
apps/desktop/src/app/ModuleOutlet.jsx
prisma/schema.prisma
prisma/migrations/YYYYMMDDHHMMSS_add_atlas_pos/
packages/sdk/src/index.js
```

### Integration Boundaries

- `atlas.catalog` owns products, categories, variants, SKU, barcode and commercial stock.
- `atlas.pos` stores order snapshots and operational state.
- `atlas.identity` provides users/cashiers/waiters through `UserProfile` references.
- `atlas.company` scopes outlets and settings by company.
- `atlas.ledger` is optional and should be integrated later for settlement/reconciliation.
- `atlas.files` is optional for receipt assets, logos or attached documents.

---

## 5. Data Model

The Prisma model names below are proposed. Actual implementation should validate naming against the current schema conventions before migration generation.

### Enums

```prisma
enum PosMode {
  RESTAURANT
  RETAIL
  HYBRID
}

enum PosOrderStatus {
  DRAFT
  OPEN
  SENT
  PARTIALLY_SERVED
  SERVED
  PAID
  CANCELLED
  REFUNDED
}

enum PosFulfillmentType {
  DINE_IN
  TAKEAWAY
  DELIVERY
  PICKUP
}

enum PosSalesChannel {
  IN_STORE
  PHONE
  WEBSITE
  UBER_EATS
  RAPPI
  DIDI_FOOD
  OTHER
}

enum PosTableStatus {
  AVAILABLE
  OCCUPIED
  BILL_REQUESTED
  DIRTY
  RESERVED
  DISABLED
}

enum PosKitchenStatus {
  PENDING
  IN_PREPARATION
  READY
  DELIVERED
  CANCELLED
}

enum PosSessionStatus {
  OPEN
  CLOSED
  CANCELLED
}

enum PosPaymentStatus {
  PENDING
  CAPTURED
  VOIDED
  REFUNDED
}

enum PosExternalProvider {
  UBER_EATS
  RAPPI
  DIDI_FOOD
  WEBSITE
  OTHER
}
```

### Core Models

```prisma
model PosSettings {
  id                 String   @id @default(dbgenerated("uuidv7()")) @db.Uuid
  company_id         String   @db.Uuid
  mode               PosMode  @default(RESTAURANT)
  currency           String   @default("MXN")
  default_tax_rate   Decimal  @default(16.00) @db.Decimal(8, 4)
  prices_include_tax Boolean  @default(false)
  tips_enabled       Boolean  @default(true)
  service_charge_rate Decimal @default(0.00) @db.Decimal(8, 4)
  receipt_footer     String?
  created_at         DateTime @default(now())
  updated_at         DateTime @updatedAt

  @@unique([company_id])
  @@map("pos_settings")
}

model PosOutlet {
  id          String   @id @default(dbgenerated("uuidv7()")) @db.Uuid
  company_id  String   @db.Uuid
  name        String
  code        String?
  address     String?
  mode        PosMode  @default(RESTAURANT)
  enabled     Boolean  @default(true)
  created_at  DateTime @default(now())
  updated_at  DateTime @updatedAt

  terminals   PosTerminal[]
  sessions    PosSession[]
  floors      PosFloor[]
  stations    PosKitchenStation[]

  @@unique([company_id, code])
  @@map("pos_outlet")
}

model PosTerminal {
  id          String   @id @default(dbgenerated("uuidv7()")) @db.Uuid
  company_id  String   @db.Uuid
  outlet_id   String   @db.Uuid
  name        String
  code        String?
  enabled     Boolean  @default(true)
  created_at  DateTime @default(now())
  updated_at  DateTime @updatedAt

  outlet      PosOutlet @relation(fields: [outlet_id], references: [id])
  sessions    PosSession[]

  @@unique([company_id, code])
  @@map("pos_terminal")
}

model PosSession {
  id                    String   @id @default(dbgenerated("uuidv7()")) @db.Uuid
  company_id            String   @db.Uuid
  outlet_id             String   @db.Uuid
  terminal_id           String   @db.Uuid
  opened_by_id          String   @db.Uuid
  closed_by_id          String?  @db.Uuid
  status                PosSessionStatus @default(OPEN)
  opening_cash_amount   Decimal  @default(0.00) @db.Decimal(12, 2)
  expected_cash_amount  Decimal? @db.Decimal(12, 2)
  counted_cash_amount   Decimal? @db.Decimal(12, 2)
  difference_amount     Decimal? @db.Decimal(12, 2)
  opened_at             DateTime @default(now())
  closed_at             DateTime?
  notes                 String?

  outlet                PosOutlet @relation(fields: [outlet_id], references: [id])
  terminal              PosTerminal @relation(fields: [terminal_id], references: [id])
  orders                PosOrder[]
  cash_movements        PosCashMovement[]

  @@index([company_id, status])
  @@map("pos_session")
}

model PosPaymentMethod {
  id          String   @id @default(dbgenerated("uuidv7()")) @db.Uuid
  company_id  String   @db.Uuid
  name        String
  code        String
  kind        String
  requires_reference Boolean @default(false)
  enabled     Boolean  @default(true)
  created_at  DateTime @default(now())
  updated_at  DateTime @updatedAt

  payments    PosPayment[]

  @@unique([company_id, code])
  @@map("pos_payment_method")
}
```

### Restaurant and Order Models

```prisma
model PosOrder {
  id                  String   @id @default(dbgenerated("uuidv7()")) @db.Uuid
  company_id          String   @db.Uuid
  outlet_id           String   @db.Uuid
  session_id          String?  @db.Uuid
  table_id            String?  @db.Uuid
  order_number        Int
  status              PosOrderStatus @default(DRAFT)
  fulfillment_type    PosFulfillmentType @default(DINE_IN)
  sales_channel       PosSalesChannel @default(IN_STORE)
  external_provider   PosExternalProvider?
  external_order_id   String?
  customer_name       String?
  customer_phone      String?
  guest_count         Int      @default(1)
  subtotal_amount     Decimal  @default(0.00) @db.Decimal(12, 2)
  discount_amount     Decimal  @default(0.00) @db.Decimal(12, 2)
  tax_amount          Decimal  @default(0.00) @db.Decimal(12, 2)
  tip_amount          Decimal  @default(0.00) @db.Decimal(12, 2)
  service_charge_amount Decimal @default(0.00) @db.Decimal(12, 2)
  total_amount        Decimal  @default(0.00) @db.Decimal(12, 2)
  paid_amount         Decimal  @default(0.00) @db.Decimal(12, 2)
  notes               String?
  raw_external_payload Json?
  opened_at           DateTime @default(now())
  paid_at             DateTime?
  cancelled_at        DateTime?
  created_by_id       String   @db.Uuid
  updated_at          DateTime @updatedAt

  session             PosSession? @relation(fields: [session_id], references: [id])
  table               PosTable? @relation(fields: [table_id], references: [id])
  lines               PosOrderLine[]
  guests              PosGuestSeat[]
  payments            PosPayment[]
  kitchen_tickets     PosKitchenTicket[]
  receipts            PosReceipt[]

  @@unique([company_id, external_provider, external_order_id])
  @@index([company_id, status])
  @@index([company_id, sales_channel])
  @@map("pos_order")
}

model PosOrderLine {
  id                   String   @id @default(dbgenerated("uuidv7()")) @db.Uuid
  order_id             String   @db.Uuid
  guest_seat_id        String?  @db.Uuid
  product_id           String?  @db.Uuid
  variant_id           String?  @db.Uuid
  product_name         String
  sku                  String?
  quantity             Decimal  @db.Decimal(12, 3)
  unit_price           Decimal  @db.Decimal(12, 2)
  discount_amount      Decimal  @default(0.00) @db.Decimal(12, 2)
  tax_rate             Decimal  @default(0.00) @db.Decimal(8, 4)
  tax_amount           Decimal  @default(0.00) @db.Decimal(12, 2)
  total_amount         Decimal  @db.Decimal(12, 2)
  preparation_station_id String? @db.Uuid
  kitchen_status       PosKitchenStatus @default(PENDING)
  note                 String?
  modifiers_snapshot   Json?
  created_at           DateTime @default(now())
  updated_at           DateTime @updatedAt

  order                PosOrder @relation(fields: [order_id], references: [id], onDelete: Cascade)
  guest_seat           PosGuestSeat? @relation(fields: [guest_seat_id], references: [id])

  @@index([order_id])
  @@map("pos_order_line")
}

model PosGuestSeat {
  id          String   @id @default(dbgenerated("uuidv7()")) @db.Uuid
  order_id    String   @db.Uuid
  label       String
  position    Int
  created_at  DateTime @default(now())

  order       PosOrder @relation(fields: [order_id], references: [id], onDelete: Cascade)
  lines       PosOrderLine[]

  @@unique([order_id, position])
  @@map("pos_guest_seat")
}

model PosPayment {
  id                String   @id @default(dbgenerated("uuidv7()")) @db.Uuid
  company_id        String   @db.Uuid
  order_id          String   @db.Uuid
  payment_method_id String   @db.Uuid
  amount            Decimal  @db.Decimal(12, 2)
  status            PosPaymentStatus @default(CAPTURED)
  reference         String?
  paid_at           DateTime @default(now())
  created_by_id     String   @db.Uuid

  order             PosOrder @relation(fields: [order_id], references: [id], onDelete: Cascade)
  payment_method    PosPaymentMethod @relation(fields: [payment_method_id], references: [id])

  @@index([company_id, paid_at])
  @@map("pos_payment")
}

model PosCashMovement {
  id            String   @id @default(dbgenerated("uuidv7()")) @db.Uuid
  company_id    String   @db.Uuid
  session_id    String   @db.Uuid
  kind          String
  amount        Decimal  @db.Decimal(12, 2)
  reason        String
  created_by_id String   @db.Uuid
  created_at    DateTime @default(now())

  session       PosSession @relation(fields: [session_id], references: [id], onDelete: Cascade)

  @@index([company_id, session_id])
  @@map("pos_cash_movement")
}
```

### Floor, Tables and Kitchen

```prisma
model PosFloor {
  id          String   @id @default(dbgenerated("uuidv7()")) @db.Uuid
  company_id  String   @db.Uuid
  outlet_id   String   @db.Uuid
  name        String
  is_active   Boolean  @default(false)
  canvas_width Int     @default(1200)
  canvas_height Int    @default(800)
  created_at  DateTime @default(now())
  updated_at  DateTime @updatedAt

  outlet      PosOutlet @relation(fields: [outlet_id], references: [id])
  zones       PosFloorZone[]
  elements    PosFloorElement[]
  tables      PosTable[]

  @@index([company_id, outlet_id])
  @@map("pos_floor")
}

model PosFloorZone {
  id          String   @id @default(dbgenerated("uuidv7()")) @db.Uuid
  floor_id    String   @db.Uuid
  name        String
  color       String?
  position    Int      @default(0)
  created_at  DateTime @default(now())

  floor       PosFloor @relation(fields: [floor_id], references: [id], onDelete: Cascade)
  tables      PosTable[]

  @@map("pos_floor_zone")
}

model PosTable {
  id          String   @id @default(dbgenerated("uuidv7()")) @db.Uuid
  company_id  String   @db.Uuid
  floor_id    String   @db.Uuid
  zone_id     String?  @db.Uuid
  name        String
  capacity    Int      @default(2)
  status      PosTableStatus @default(AVAILABLE)
  enabled     Boolean  @default(true)
  created_at  DateTime @default(now())
  updated_at  DateTime @updatedAt

  floor       PosFloor @relation(fields: [floor_id], references: [id], onDelete: Cascade)
  zone        PosFloorZone? @relation(fields: [zone_id], references: [id])
  orders      PosOrder[]

  @@unique([floor_id, name])
  @@map("pos_table")
}

model PosFloorElement {
  id          String   @id @default(dbgenerated("uuidv7()")) @db.Uuid
  floor_id    String   @db.Uuid
  table_id    String?  @db.Uuid
  kind        String
  label       String?
  x           Decimal  @db.Decimal(12, 2)
  y           Decimal  @db.Decimal(12, 2)
  width       Decimal  @db.Decimal(12, 2)
  height      Decimal  @db.Decimal(12, 2)
  rotation    Decimal  @default(0.00) @db.Decimal(8, 2)
  style       Json?
  created_at  DateTime @default(now())
  updated_at  DateTime @updatedAt

  floor       PosFloor @relation(fields: [floor_id], references: [id], onDelete: Cascade)

  @@index([floor_id])
  @@map("pos_floor_element")
}

model PosKitchenStation {
  id          String   @id @default(dbgenerated("uuidv7()")) @db.Uuid
  company_id  String   @db.Uuid
  outlet_id   String   @db.Uuid
  name        String
  code        String
  color       String?
  enabled     Boolean  @default(true)
  created_at  DateTime @default(now())
  updated_at  DateTime @updatedAt

  outlet      PosOutlet @relation(fields: [outlet_id], references: [id])
  tickets     PosKitchenTicket[]

  @@unique([outlet_id, code])
  @@map("pos_kitchen_station")
}

model PosKitchenTicket {
  id          String   @id @default(dbgenerated("uuidv7()")) @db.Uuid
  company_id  String   @db.Uuid
  order_id    String   @db.Uuid
  station_id  String   @db.Uuid
  status      PosKitchenStatus @default(PENDING)
  sent_at     DateTime @default(now())
  started_at  DateTime?
  ready_at    DateTime?
  delivered_at DateTime?

  order       PosOrder @relation(fields: [order_id], references: [id], onDelete: Cascade)
  station     PosKitchenStation @relation(fields: [station_id], references: [id])
  lines       PosKitchenTicketLine[]

  @@index([company_id, station_id, status])
  @@map("pos_kitchen_ticket")
}

model PosKitchenTicketLine {
  id              String   @id @default(dbgenerated("uuidv7()")) @db.Uuid
  ticket_id       String   @db.Uuid
  order_line_id   String   @db.Uuid
  quantity        Decimal  @db.Decimal(12, 3)
  status          PosKitchenStatus @default(PENDING)
  note            String?

  ticket          PosKitchenTicket @relation(fields: [ticket_id], references: [id], onDelete: Cascade)

  @@unique([ticket_id, order_line_id])
  @@map("pos_kitchen_ticket_line")
}

model PosReceipt {
  id            String   @id @default(dbgenerated("uuidv7()")) @db.Uuid
  company_id    String   @db.Uuid
  order_id      String   @db.Uuid
  receipt_number Int
  kind          String
  payload       Json
  printed_count Int      @default(0)
  created_at    DateTime @default(now())

  order         PosOrder @relation(fields: [order_id], references: [id], onDelete: Cascade)

  @@unique([company_id, receipt_number])
  @@map("pos_receipt")
}
```

### Future External Channel Models

These models can be added in V1 as dormant infrastructure or deferred to the integration phase. The implementation plan should decide based on scope pressure.

```prisma
model PosExternalChannel {
  id          String   @id @default(dbgenerated("uuidv7()")) @db.Uuid
  company_id  String   @db.Uuid
  provider    PosExternalProvider
  name        String
  enabled     Boolean  @default(false)
  credentials_ref String?
  settings    Json?
  created_at  DateTime @default(now())
  updated_at  DateTime @updatedAt

  @@unique([company_id, provider, name])
  @@map("pos_external_channel")
}

model PosExternalStoreMapping {
  id            String   @id @default(dbgenerated("uuidv7()")) @db.Uuid
  company_id    String   @db.Uuid
  channel_id    String   @db.Uuid
  outlet_id     String   @db.Uuid
  external_store_id String
  enabled       Boolean  @default(true)
  created_at    DateTime @default(now())

  @@unique([channel_id, external_store_id])
  @@map("pos_external_store_mapping")
}

model PosExternalProductMapping {
  id              String   @id @default(dbgenerated("uuidv7()")) @db.Uuid
  company_id      String   @db.Uuid
  channel_id      String   @db.Uuid
  product_id      String   @db.Uuid
  variant_id      String?  @db.Uuid
  external_item_id String?
  external_sku    String?
  station_id      String?  @db.Uuid
  created_at      DateTime @default(now())
  updated_at      DateTime @updatedAt

  @@unique([channel_id, external_item_id])
  @@map("pos_external_product_mapping")
}

model PosExternalOrderInbox {
  id              String   @id @default(dbgenerated("uuidv7()")) @db.Uuid
  company_id      String   @db.Uuid
  provider        PosExternalProvider
  external_order_id String
  status          String
  payload         Json
  pos_order_id    String?  @db.Uuid
  received_at     DateTime @default(now())
  processed_at    DateTime?
  error_message   String?

  @@unique([provider, external_order_id])
  @@index([company_id, provider, status])
  @@map("pos_external_order_inbox")
}
```

---

## 6. API Contract

All routes require authentication. Company scope comes from the authenticated membership context. Routes use normal Prisma accessors because `atlas.pos` is a core Prisma-backed module.

### Settings and Outlets

```text
GET    /pos/settings
PATCH  /pos/settings

GET    /pos/outlets
POST   /pos/outlets
GET    /pos/outlets/:id
PATCH  /pos/outlets/:id
PATCH  /pos/outlets/:id/enabled

GET    /pos/terminals
POST   /pos/terminals
PATCH  /pos/terminals/:id
PATCH  /pos/terminals/:id/enabled
```

### Sessions

```text
GET    /pos/sessions
POST   /pos/sessions/open
GET    /pos/sessions/current?terminal_id=<id>
GET    /pos/sessions/:id
POST   /pos/sessions/:id/cash-movements
POST   /pos/sessions/:id/close
```

Rules:

- A terminal can have only one open session at a time.
- Orders can be paid only inside an open session unless marked as external/prepaid.
- Closing a session calculates expected cash from cash payments and cash movements.

### Orders

```text
GET    /pos/orders
POST   /pos/orders
GET    /pos/orders/:id
PATCH  /pos/orders/:id
POST   /pos/orders/:id/lines
PATCH  /pos/orders/:id/lines/:lineId
DELETE /pos/orders/:id/lines/:lineId
POST   /pos/orders/:id/guests
PATCH  /pos/orders/:id/guests/:guestId
POST   /pos/orders/:id/send-to-kitchen
POST   /pos/orders/:id/payments
POST   /pos/orders/:id/close
POST   /pos/orders/:id/cancel
POST   /pos/orders/:id/receipts/reprint
```

Rules:

- Product name, SKU, unit price, tax rate and modifier data are snapshotted on `PosOrderLine`.
- Total fields are recalculated server-side after every mutation.
- Paid orders are immutable except receipt reprints and refund flows.
- External orders use the same `PosOrder` table, with `sales_channel` and external identifiers set.

### Floors and Tables

```text
GET    /pos/floors
POST   /pos/floors
GET    /pos/floors/:id
PATCH  /pos/floors/:id
POST   /pos/floors/:id/publish
POST   /pos/floors/:id/zones
PATCH  /pos/floors/:id/zones/:zoneId
POST   /pos/floors/:id/tables
PATCH  /pos/floors/:id/tables/:tableId
PATCH  /pos/tables/:tableId/status
GET    /pos/tables/active-map?outlet_id=<id>
```

Rules:

- Only one active floor per outlet.
- Floor planner saves `PosFloorElement` geometry and `PosTable` logical table data.
- Operational table state is stored on `PosTable.status` and may be derived from open orders when possible.

### Kitchen

```text
GET    /pos/stations
POST   /pos/stations
PATCH  /pos/stations/:id
PATCH  /pos/stations/:id/enabled
GET    /pos/stations/:id/tickets
PATCH  /pos/kitchen/tickets/:ticketId/status
PATCH  /pos/kitchen/tickets/:ticketId/lines/:lineId/status
```

Rules:

- `send-to-kitchen` groups order lines by `preparation_station_id`.
- Lines without station use a default station if configured; otherwise they remain unsent and return validation error.
- Station status updates propagate to order line kitchen status.

### Future External Channels

```text
GET    /pos/external/channels
POST   /pos/external/channels
PATCH  /pos/external/channels/:id
POST   /pos/external/:provider/webhook
POST   /pos/external/:provider/poll
POST   /pos/external/orders/:inboxId/accept
POST   /pos/external/orders/:inboxId/reject
POST   /pos/external/orders/:inboxId/ready
```

These routes are future-facing and should not be implemented until provider credentials and commercial access are available.

---

## 7. Permissions

```js
permissions: [
  { key: "pos.access", name: "Acceder a POS" },
  { key: "pos.terminal.use", name: "Usar terminal POS" },
  { key: "pos.orders.read", name: "Ver ordenes POS" },
  { key: "pos.orders.create", name: "Crear ordenes POS" },
  { key: "pos.orders.update", name: "Editar ordenes POS" },
  { key: "pos.orders.cancel", name: "Cancelar ordenes POS" },
  { key: "pos.payments.create", name: "Registrar pagos POS" },
  { key: "pos.sessions.read", name: "Ver sesiones de caja" },
  { key: "pos.sessions.manage", name: "Abrir y cerrar cajas" },
  { key: "pos.cash.manage", name: "Registrar movimientos de efectivo" },
  { key: "pos.floor.read", name: "Ver planos POS" },
  { key: "pos.floor.manage", name: "Gestionar planos POS" },
  { key: "pos.stations.read", name: "Ver estaciones de preparacion" },
  { key: "pos.stations.manage", name: "Gestionar estaciones de preparacion" },
  { key: "pos.settings.manage", name: "Gestionar configuracion POS" },
  { key: "pos.external.manage", name: "Gestionar canales externos POS" },
]
```

ACL module permission: `pos.access`.

Important operation constraints:

- Waiters/cashiers can use terminal and create orders.
- Only users with `pos.payments.create` can charge.
- Only users with `pos.sessions.manage` can open/close cash sessions.
- Only users with `pos.floor.manage` can edit or publish the floor plan.
- Only users with `pos.settings.manage` can configure outlets, terminals, taxes and external channels.

---

## 8. UI Structure

### Navigation

```js
navigation: [
  {
    label: "Terminal",
    path: "/app/m/atlas.pos/pos/terminal",
    icon: "BadgeDollarSign",
    layout: "main",
    permissionKey: "pos.terminal.use",
  },
  {
    label: "Mesas",
    path: "/app/m/atlas.pos/pos/tables",
    icon: "Armchair",
    layout: "main",
    permissionKey: "pos.terminal.use",
  },
  {
    label: "Estaciones",
    path: "/app/m/atlas.pos/pos/stations",
    icon: "ChefHat",
    layout: "main",
    permissionKey: "pos.stations.read",
  },
  {
    label: "Ordenes",
    path: "/app/m/atlas.pos/pos/orders",
    icon: "ReceiptText",
    layout: "main",
    permissionKey: "pos.orders.read",
  },
  {
    label: "Cajas",
    path: "/app/m/atlas.pos/pos/sessions",
    icon: "Landmark",
    layout: "main",
    permissionKey: "pos.sessions.read",
  },
  {
    label: "Configuracion",
    path: "/app/m/atlas.pos/pos/settings",
    icon: "Settings",
    layout: "main",
    permissionKey: "pos.settings.manage",
  },
]
```

### Terminal Screen

Operational selling surface:

- Product category tabs from `atlas.catalog`
- Product grid with images, price, availability and out-of-stock state
- Active order panel
- Restaurant guest seat grouping
- Quantity controls
- Notes and modifiers
- Send to kitchen
- Split bill
- Payment dialog
- Receipt reprint

The screen should support a dense, touch-friendly layout. It may hide the global sidebar/nav through `fullscreenPaths`.

### Tables Screen

Operational restaurant floor:

- Zone selector
- Visual floor map from active `PosFloor`
- Table status colors
- Open table creates or resumes a `PosOrder`
- Move order to another table
- Merge tables
- Mark table as dirty/available

### Floor Planner Screen

Editor for floor layout:

- Toolbox for square table, round table, family table, bar, decor and zones
- Canvas with drag, resize, rotate and zoom controls
- Properties panel for selected element
- Publish button to activate the edited floor
- Delete confirmation for destructive actions

This should be a custom React screen, not a generic CRUD screen.

### Stations Screen

Kitchen/bar preparation board:

- Station selector
- Ticket cards grouped by status
- Line-level status updates
- Order/table/customer context
- Ready-for-pickup action for external delivery orders in future phases

### Sessions Screen

Cash session management:

- Open session dialog
- Active session summary
- Cash movements
- Close session with counted cash
- Session history
- Differences and audit trail

### Orders Screen

Administrative view:

- Search by order number, customer, table, channel, status
- Date/session filters
- Payment status
- Receipt reprint
- Cancel/refund entry point for later phases

### Settings Screen

Configuration:

- POS mode: restaurant, retail, hybrid
- Outlets and terminals
- Payment methods
- Taxes, tips and service charge
- Kitchen stations
- Product station mapping
- Receipt options
- External channels placeholder

---

## 9. Kitchen Routing

Each sellable product/variant needs POS-specific preparation metadata. The preferred approach is a POS-owned mapping table that references catalog IDs instead of modifying `atlas.catalog` models in V1.

```prisma
model PosProductConfig {
  id            String   @id @default(dbgenerated("uuidv7()")) @db.Uuid
  company_id    String   @db.Uuid
  product_id    String   @db.Uuid
  variant_id    String?  @db.Uuid
  station_id    String?  @db.Uuid
  available_in_pos Boolean @default(true)
  requires_preparation Boolean @default(true)
  display_order Int      @default(0)
  created_at    DateTime @default(now())
  updated_at    DateTime @updatedAt

  @@unique([company_id, product_id, variant_id])
  @@map("pos_product_config")
}
```

Routing rules:

- If `requires_preparation = false`, the line does not create a kitchen ticket.
- If a station is set, the line is grouped into that station ticket.
- If no station is set and the product requires preparation, `send-to-kitchen` returns validation details.
- External delivery orders use the same routing path as in-store orders.

---

## 10. External Delivery Integrations

### Direction

Uber Eats, Rappi and DiDi Food should be modeled as future sales channels, not as special-case POS order types. The POS core should be able to accept external orders and send them to kitchen stations even before provider connectors exist.

### What is known

- Uber Eats Marketplace APIs support POS integrations, menu synchronization, order workflows and webhooks, but access may require written approval and specific OAuth scopes.
- Rappi publishes APIs for menus, orders, store availability, item availability and webhooks; access requires ally credentials.
- DiDi Food has a developer portal, but production access and country-specific requirements need validation before implementation.

### Future Flow

```text
Provider webhook or polling
  -> PosExternalOrderInbox
  -> Provider normalizer
  -> Product mapping against atlas.catalog / PosExternalProductMapping
  -> PosOrder with sales_channel and raw payload
  -> PosKitchenTicket by station
  -> Status callbacks to provider when accepted, rejected, ready or cancelled
```

### Provider Capabilities to Abstract

- Receive new orders
- Accept/reject orders
- Set cooking time
- Mark ready for pickup
- Receive cancellation events
- Sync item availability
- Sync menu/product data
- Map external store to `PosOutlet`
- Map external item/SKU to `CatalogProduct` or `CatalogProductVariant`

### V1 Preparation Only

V1 should include fields on `PosOrder` for `sales_channel`, `external_provider`, `external_order_id` and `raw_external_payload`. It may include external mapping models if implementation scope allows, but it should not implement provider-specific API clients until real credentials are available.

### Integration Risks

| Risk | Mitigation |
|---|---|
| Provider access requires approval | Keep connectors out of MVP and model orders generically |
| Payloads vary by provider | Store raw payload and normalized order separately |
| Duplicate webhook delivery | Unique provider + external order id idempotency |
| Menu IDs differ from catalog IDs | Use explicit product mapping table |
| External cancellation after kitchen started | Add cancellation state and station notification |
| Provider APIs change | Isolate provider clients under `pos-external-channel-service.js` or provider-specific files |

---

## 11. Manifest and Routing

Implementation must update:

- `apps/api/src/manifests/official/core-modules.js`: add `atlasPosManifest` and include it in `coreModules`.
- `apps/api/src/services/module-lifecycle-service.js`: include `atlas.pos` in the protected core key set if needed by current lifecycle code.
- `apps/api/src/routes/modules.js`: include `atlas.pos` in official/core lists if the route has allowlists.
- `apps/api/src/index.js`: mount `/pos` routes following current core route patterns.
- `apps/desktop/src/app/ModuleOutlet.jsx`: add screen map entries for `atlas.pos`.
- `packages/sdk/src/index.js`: add `atlas.pos` API helper namespace if the app uses SDK wrappers for core modules.

Proposed screen map:

```js
"atlas.pos:/": lazy(() => import("../modules/atlas.pos/screens/PosTerminalScreen.jsx")),
"atlas.pos:/pos/terminal": lazy(() => import("../modules/atlas.pos/screens/PosTerminalScreen.jsx")),
"atlas.pos:/pos/tables": lazy(() => import("../modules/atlas.pos/screens/PosTablesScreen.jsx")),
"atlas.pos:/pos/floor-planner": lazy(() => import("../modules/atlas.pos/screens/PosFloorPlannerScreen.jsx")),
"atlas.pos:/pos/stations": lazy(() => import("../modules/atlas.pos/screens/PosStationsScreen.jsx")),
"atlas.pos:/pos/orders": lazy(() => import("../modules/atlas.pos/screens/PosOrdersScreen.jsx")),
"atlas.pos:/pos/sessions": lazy(() => import("../modules/atlas.pos/screens/PosSessionsScreen.jsx")),
"atlas.pos:/pos/settings": lazy(() => import("../modules/atlas.pos/screens/PosSettingsScreen.jsx")),
```

---

## 12. State and Business Rules

### Order State

```text
DRAFT -> OPEN -> SENT -> PARTIALLY_SERVED -> SERVED -> PAID
                         |
                         -> CANCELLED
```

Rules:

- `DRAFT`: order created but not sent or paid.
- `OPEN`: active editable order.
- `SENT`: at least one line sent to kitchen.
- `PARTIALLY_SERVED`: some but not all kitchen lines delivered.
- `SERVED`: all preparation lines delivered.
- `PAID`: fully paid, order is locked.
- `CANCELLED`: no further changes except audit/read operations.

### Table State

- Available tables have no active order.
- Occupied tables have at least one active order.
- Bill requested can be set manually.
- Dirty can be set after payment when table needs cleanup.
- Reserved is future-facing for reservations.

### Payment Rules

- Payment totals must not exceed total due unless overpayment/tip handling is explicitly enabled.
- Captured payments are append-only in V1.
- Refunds are future scope and should use separate records, not destructive updates.

### Audit

Audit log entries must be written for:

- Opening/closing sessions
- Cash movements
- Creating/cancelling orders
- Adding/removing/updating lines
- Sending to kitchen
- Payment creation
- Floor publish
- Settings changes
- External order import in future phases

---

## 13. Testing Strategy

### Backend Unit Tests

- Session open rejects second open session for same terminal.
- Session close calculates expected cash correctly.
- Order line creation snapshots catalog product data.
- Order totals recalculate after add/update/delete line.
- Paid order cannot be edited.
- `send-to-kitchen` creates one ticket per station.
- Kitchen line status updates propagate to order line.
- External order idempotency rejects duplicate provider/order id.
- Company scoping prevents cross-company access.

### Route Tests

- Permissions fail closed for each route group.
- Authenticated user without company membership gets 403.
- CRUD endpoints return expected shapes.
- Validation errors return 400 with useful messages.

### Frontend Tests / QA

- Terminal loads catalog categories and products.
- Product selection updates active order.
- Payment dialog handles partial/full payment states.
- Tables screen opens existing table order.
- Floor planner drag/resize/publish persists geometry.
- Stations screen moves ticket status without page refresh.
- Responsive checks for terminal, floor planner and station board.

---

## 14. Acceptance Criteria

1. `atlas.pos` appears as an official core module with PWA identity and navigation.
2. Authorized users can open a POS terminal screen from `/app/m/atlas.pos/pos/terminal`.
3. A user can open a cash session for a terminal.
4. The system prevents two open sessions on the same terminal.
5. Products from `atlas.catalog` can be added to a POS order.
6. POS order lines store product/price/tax snapshots.
7. A restaurant order can be associated with a table and guest seats.
8. The order can be sent to kitchen and creates tickets grouped by station.
9. Station users can mark tickets and lines as in preparation, ready and delivered.
10. A payment can close the order and lock further edits.
11. Cash session close calculates expected cash and difference.
12. A floor plan can be created, edited and published as active for an outlet.
13. The table selector displays active floor tables with state colors.
14. POS settings can switch configured mode between restaurant, retail and hybrid.
15. `PosOrder` supports future external channels through `sales_channel`, `external_provider`, `external_order_id` and raw payload fields.
16. Company scoping is enforced across every route.
17. Mutations write audit log entries.

---

## 15. Open Decisions

1. Whether external channel infrastructure tables should ship in V1 or wait until the first real provider integration.
2. Whether `PosProductConfig` should be POS-owned in V1 or whether product preparation metadata belongs in `atlas.catalog` long-term.
3. Whether receipt printing should start as browser print/PDF only or include a local print bridge later.
4. Whether tables support multiple simultaneous orders or only one active order per table in V1.
5. Whether `atlas.ledger` settlement should be planned immediately after V1 or after retail mode.

---

## 16. References

- Uber Eats Marketplace APIs: https://developer.uber.com/docs/eats/introduction
- Uber Eats accept order endpoint: https://developer.uber.com/docs/eats/references/api/v1/post-eats-order-orderid-acceptposorder
- Rappi API reference: https://dev-portal.rappi.com/api/
- Rappi Orders API: https://dev-portal.rappi.com/en/api-reference/orders-rests-api/
- DiDi Food developer portal: https://developer.didi-food.com/
