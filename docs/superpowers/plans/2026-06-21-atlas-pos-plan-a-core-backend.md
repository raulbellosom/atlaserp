# Atlas POS Core Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `atlas.pos` Core foundation: Prisma schema/migration, official module manifest, permissions, backend services/routes, SDK methods, and minimal navigable desktop screens.

**Architecture:** `atlas.pos` is a Prisma-backed Core module, not AME3. The backend is split by business area under `apps/api/src/routes/pos/`: settings/outlets/terminals, sessions/cash, orders/payments, floors/tables, and kitchen routing. React screens in `apps/desktop/src/modules/atlas.pos/` start as functional shells that call the API and unblock Plan B for the full operational UI.

**Tech Stack:** Node.js, Hono, Prisma, PostgreSQL/Supabase, Zod, React, TanStack Query, `@atlas/ui`, `@atlas/sdk`, Node built-in `node:test`. JavaScript only.

**Spec:** `docs/superpowers/specs/2026-06-21-atlas-pos-core-design.md`

---

## Scope Split

This plan implements Plan A only: database, backend, SDK, official module registration, and minimal desktop route shells. The POS spec is intentionally larger than one implementation pass.

Plan B should implement the polished operational UI: terminal product grid, order panel, table map, floor planner interactions, station board and payment dialogs.

Plan C should implement external delivery providers after real Uber Eats/Rappi/DiDi credentials and approval paths exist.

## File Map

```text
prisma/
  schema.prisma
  migrations/20260621190000_add_atlas_pos/migration.sql

apps/api/src/
  manifests/official/core-modules.js
  services/module-lifecycle-service.js
  routes/modules.js
  index.js
  routes/pos/
    index.js
    validators.js
    service-helpers.js
    pos-settings-service.js
    pos-session-service.js
    pos-order-service.js
    pos-floor-service.js
    pos-kitchen-service.js
    pos-routes.js
    __tests__/
      pos-settings-service.test.js
      pos-session-service.test.js
      pos-order-service.test.js
      pos-floor-kitchen-service.test.js

packages/sdk/src/index.js

apps/desktop/src/app/ModuleOutlet.jsx
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
    PosScreenShell.jsx
```

---

## Task 1: Prisma Schema

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add POS enums near existing enum blocks**

Append these enum blocks near the other Core module enums:

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

- [ ] **Step 2: Add POS models after the `atlas.catalog` section**

Add the models below after `CatalogStockMovement` and before sync/project/inventory models:

```prisma
model PosSettings {
  id                  String   @id @default(uuid(7)) @db.Uuid
  companyId           String   @db.Uuid @map("company_id")
  mode                PosMode  @default(RESTAURANT)
  currency            String   @default("MXN")
  defaultTaxRate      Decimal  @default(16.00) @db.Decimal(8, 4) @map("default_tax_rate")
  pricesIncludeTax    Boolean  @default(false) @map("prices_include_tax")
  tipsEnabled         Boolean  @default(true) @map("tips_enabled")
  serviceChargeRate   Decimal  @default(0.00) @db.Decimal(8, 4) @map("service_charge_rate")
  receiptFooter       String?  @map("receipt_footer")
  createdAt           DateTime @default(now()) @map("created_at")
  updatedAt           DateTime @updatedAt @map("updated_at")

  @@unique([companyId])
  @@map("pos_settings")
}

model PosOutlet {
  id        String   @id @default(uuid(7)) @db.Uuid
  companyId String   @db.Uuid @map("company_id")
  name      String
  code      String?
  address   String?
  mode      PosMode  @default(RESTAURANT)
  enabled   Boolean  @default(true)
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  terminals PosTerminal[]
  sessions  PosSession[]
  floors    PosFloor[]
  stations  PosKitchenStation[]

  @@unique([companyId, code])
  @@index([companyId, enabled])
  @@map("pos_outlet")
}

model PosTerminal {
  id        String   @id @default(uuid(7)) @db.Uuid
  companyId String   @db.Uuid @map("company_id")
  outletId  String   @db.Uuid @map("outlet_id")
  name      String
  code      String?
  enabled   Boolean  @default(true)
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  outlet   PosOutlet @relation(fields: [outletId], references: [id], onDelete: Restrict)
  sessions PosSession[]

  @@unique([companyId, code])
  @@index([companyId, outletId])
  @@map("pos_terminal")
}

model PosSession {
  id                 String           @id @default(uuid(7)) @db.Uuid
  companyId          String           @db.Uuid @map("company_id")
  outletId           String           @db.Uuid @map("outlet_id")
  terminalId         String           @db.Uuid @map("terminal_id")
  openedById         String           @db.Uuid @map("opened_by_id")
  closedById         String?          @db.Uuid @map("closed_by_id")
  status             PosSessionStatus @default(OPEN)
  openingCashAmount  Decimal          @default(0.00) @db.Decimal(12, 2) @map("opening_cash_amount")
  expectedCashAmount Decimal?         @db.Decimal(12, 2) @map("expected_cash_amount")
  countedCashAmount  Decimal?         @db.Decimal(12, 2) @map("counted_cash_amount")
  differenceAmount   Decimal?         @db.Decimal(12, 2) @map("difference_amount")
  openedAt           DateTime         @default(now()) @map("opened_at")
  closedAt           DateTime?        @map("closed_at")
  notes              String?

  outlet        PosOutlet @relation(fields: [outletId], references: [id], onDelete: Restrict)
  terminal      PosTerminal @relation(fields: [terminalId], references: [id], onDelete: Restrict)
  orders        PosOrder[]
  cashMovements PosCashMovement[]

  @@index([companyId, status])
  @@index([terminalId, status])
  @@map("pos_session")
}

model PosPaymentMethod {
  id                String   @id @default(uuid(7)) @db.Uuid
  companyId         String   @db.Uuid @map("company_id")
  name              String
  code              String
  kind              String
  requiresReference Boolean  @default(false) @map("requires_reference")
  enabled           Boolean  @default(true)
  createdAt         DateTime @default(now()) @map("created_at")
  updatedAt         DateTime @updatedAt @map("updated_at")

  payments PosPayment[]

  @@unique([companyId, code])
  @@index([companyId, enabled])
  @@map("pos_payment_method")
}

model PosOrder {
  id                  String             @id @default(uuid(7)) @db.Uuid
  companyId           String             @db.Uuid @map("company_id")
  outletId            String             @db.Uuid @map("outlet_id")
  sessionId           String?            @db.Uuid @map("session_id")
  tableId             String?            @db.Uuid @map("table_id")
  orderNumber         Int                @map("order_number")
  status              PosOrderStatus     @default(DRAFT)
  fulfillmentType     PosFulfillmentType @default(DINE_IN) @map("fulfillment_type")
  salesChannel        PosSalesChannel    @default(IN_STORE) @map("sales_channel")
  externalProvider    PosExternalProvider? @map("external_provider")
  externalOrderId     String?            @map("external_order_id")
  customerName        String?            @map("customer_name")
  customerPhone       String?            @map("customer_phone")
  guestCount          Int                @default(1) @map("guest_count")
  subtotalAmount      Decimal            @default(0.00) @db.Decimal(12, 2) @map("subtotal_amount")
  discountAmount      Decimal            @default(0.00) @db.Decimal(12, 2) @map("discount_amount")
  taxAmount           Decimal            @default(0.00) @db.Decimal(12, 2) @map("tax_amount")
  tipAmount           Decimal            @default(0.00) @db.Decimal(12, 2) @map("tip_amount")
  serviceChargeAmount Decimal            @default(0.00) @db.Decimal(12, 2) @map("service_charge_amount")
  totalAmount         Decimal            @default(0.00) @db.Decimal(12, 2) @map("total_amount")
  paidAmount          Decimal            @default(0.00) @db.Decimal(12, 2) @map("paid_amount")
  notes               String?
  rawExternalPayload  Json?              @map("raw_external_payload")
  openedAt            DateTime           @default(now()) @map("opened_at")
  paidAt              DateTime?          @map("paid_at")
  cancelledAt         DateTime?          @map("cancelled_at")
  createdById         String             @db.Uuid @map("created_by_id")
  updatedAt           DateTime           @updatedAt @map("updated_at")

  session        PosSession? @relation(fields: [sessionId], references: [id], onDelete: SetNull)
  table          PosTable? @relation(fields: [tableId], references: [id], onDelete: SetNull)
  lines          PosOrderLine[]
  guests         PosGuestSeat[]
  payments       PosPayment[]
  kitchenTickets PosKitchenTicket[]
  receipts       PosReceipt[]

  @@unique([companyId, externalProvider, externalOrderId])
  @@unique([companyId, orderNumber])
  @@index([companyId, status])
  @@index([companyId, salesChannel])
  @@map("pos_order")
}

model PosOrderLine {
  id                   String           @id @default(uuid(7)) @db.Uuid
  orderId              String           @db.Uuid @map("order_id")
  guestSeatId          String?          @db.Uuid @map("guest_seat_id")
  productId            String?          @db.Uuid @map("product_id")
  variantId            String?          @db.Uuid @map("variant_id")
  productName          String           @map("product_name")
  sku                  String?
  quantity             Decimal          @db.Decimal(12, 3)
  unitPrice            Decimal          @db.Decimal(12, 2) @map("unit_price")
  discountAmount       Decimal          @default(0.00) @db.Decimal(12, 2) @map("discount_amount")
  taxRate              Decimal          @default(0.00) @db.Decimal(8, 4) @map("tax_rate")
  taxAmount            Decimal          @default(0.00) @db.Decimal(12, 2) @map("tax_amount")
  totalAmount          Decimal          @db.Decimal(12, 2) @map("total_amount")
  preparationStationId String?          @db.Uuid @map("preparation_station_id")
  kitchenStatus        PosKitchenStatus @default(PENDING) @map("kitchen_status")
  note                 String?
  modifiersSnapshot    Json?            @map("modifiers_snapshot")
  createdAt            DateTime         @default(now()) @map("created_at")
  updatedAt            DateTime         @updatedAt @map("updated_at")

  order     PosOrder @relation(fields: [orderId], references: [id], onDelete: Cascade)
  guestSeat PosGuestSeat? @relation(fields: [guestSeatId], references: [id], onDelete: SetNull)

  @@index([orderId])
  @@index([productId])
  @@map("pos_order_line")
}

model PosGuestSeat {
  id        String   @id @default(uuid(7)) @db.Uuid
  orderId   String   @db.Uuid @map("order_id")
  label     String
  position  Int
  createdAt DateTime @default(now()) @map("created_at")

  order PosOrder @relation(fields: [orderId], references: [id], onDelete: Cascade)
  lines PosOrderLine[]

  @@unique([orderId, position])
  @@map("pos_guest_seat")
}

model PosPayment {
  id              String           @id @default(uuid(7)) @db.Uuid
  companyId       String           @db.Uuid @map("company_id")
  orderId         String           @db.Uuid @map("order_id")
  paymentMethodId String           @db.Uuid @map("payment_method_id")
  amount          Decimal          @db.Decimal(12, 2)
  status          PosPaymentStatus @default(CAPTURED)
  reference       String?
  paidAt          DateTime         @default(now()) @map("paid_at")
  createdById     String           @db.Uuid @map("created_by_id")

  order         PosOrder @relation(fields: [orderId], references: [id], onDelete: Cascade)
  paymentMethod PosPaymentMethod @relation(fields: [paymentMethodId], references: [id], onDelete: Restrict)

  @@index([companyId, paidAt])
  @@map("pos_payment")
}

model PosCashMovement {
  id          String   @id @default(uuid(7)) @db.Uuid
  companyId   String   @db.Uuid @map("company_id")
  sessionId   String   @db.Uuid @map("session_id")
  kind        String
  amount      Decimal  @db.Decimal(12, 2)
  reason      String
  createdById String   @db.Uuid @map("created_by_id")
  createdAt   DateTime @default(now()) @map("created_at")

  session PosSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  @@index([companyId, sessionId])
  @@map("pos_cash_movement")
}

model PosFloor {
  id           String   @id @default(uuid(7)) @db.Uuid
  companyId    String   @db.Uuid @map("company_id")
  outletId     String   @db.Uuid @map("outlet_id")
  name         String
  isActive     Boolean  @default(false) @map("is_active")
  canvasWidth  Int      @default(1200) @map("canvas_width")
  canvasHeight Int      @default(800) @map("canvas_height")
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  outlet   PosOutlet @relation(fields: [outletId], references: [id], onDelete: Restrict)
  zones    PosFloorZone[]
  elements PosFloorElement[]
  tables   PosTable[]

  @@index([companyId, outletId])
  @@map("pos_floor")
}

model PosFloorZone {
  id        String   @id @default(uuid(7)) @db.Uuid
  floorId   String   @db.Uuid @map("floor_id")
  name      String
  color     String?
  position  Int      @default(0)
  createdAt DateTime @default(now()) @map("created_at")

  floor  PosFloor @relation(fields: [floorId], references: [id], onDelete: Cascade)
  tables PosTable[]

  @@index([floorId])
  @@map("pos_floor_zone")
}

model PosTable {
  id        String         @id @default(uuid(7)) @db.Uuid
  companyId String         @db.Uuid @map("company_id")
  floorId   String         @db.Uuid @map("floor_id")
  zoneId    String?        @db.Uuid @map("zone_id")
  name      String
  capacity  Int            @default(2)
  status    PosTableStatus @default(AVAILABLE)
  enabled   Boolean        @default(true)
  createdAt DateTime       @default(now()) @map("created_at")
  updatedAt DateTime       @updatedAt @map("updated_at")

  floor  PosFloor @relation(fields: [floorId], references: [id], onDelete: Cascade)
  zone   PosFloorZone? @relation(fields: [zoneId], references: [id], onDelete: SetNull)
  orders PosOrder[]

  @@unique([floorId, name])
  @@index([companyId, status])
  @@map("pos_table")
}

model PosFloorElement {
  id        String   @id @default(uuid(7)) @db.Uuid
  floorId   String   @db.Uuid @map("floor_id")
  tableId   String?  @db.Uuid @map("table_id")
  kind      String
  label     String?
  x         Decimal  @db.Decimal(12, 2)
  y         Decimal  @db.Decimal(12, 2)
  width     Decimal  @db.Decimal(12, 2)
  height    Decimal  @db.Decimal(12, 2)
  rotation  Decimal  @default(0.00) @db.Decimal(8, 2)
  style     Json?
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  floor PosFloor @relation(fields: [floorId], references: [id], onDelete: Cascade)

  @@index([floorId])
  @@map("pos_floor_element")
}

model PosKitchenStation {
  id        String   @id @default(uuid(7)) @db.Uuid
  companyId String   @db.Uuid @map("company_id")
  outletId  String   @db.Uuid @map("outlet_id")
  name      String
  code      String
  color     String?
  enabled   Boolean  @default(true)
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  outlet  PosOutlet @relation(fields: [outletId], references: [id], onDelete: Restrict)
  tickets PosKitchenTicket[]

  @@unique([outletId, code])
  @@index([companyId, enabled])
  @@map("pos_kitchen_station")
}

model PosKitchenTicket {
  id          String           @id @default(uuid(7)) @db.Uuid
  companyId   String           @db.Uuid @map("company_id")
  orderId     String           @db.Uuid @map("order_id")
  stationId   String           @db.Uuid @map("station_id")
  status      PosKitchenStatus @default(PENDING)
  sentAt      DateTime         @default(now()) @map("sent_at")
  startedAt   DateTime?        @map("started_at")
  readyAt     DateTime?        @map("ready_at")
  deliveredAt DateTime?        @map("delivered_at")

  order   PosOrder @relation(fields: [orderId], references: [id], onDelete: Cascade)
  station PosKitchenStation @relation(fields: [stationId], references: [id], onDelete: Restrict)
  lines   PosKitchenTicketLine[]

  @@index([companyId, stationId, status])
  @@map("pos_kitchen_ticket")
}

model PosKitchenTicketLine {
  id          String           @id @default(uuid(7)) @db.Uuid
  ticketId    String           @db.Uuid @map("ticket_id")
  orderLineId String           @db.Uuid @map("order_line_id")
  quantity    Decimal          @db.Decimal(12, 3)
  status      PosKitchenStatus @default(PENDING)
  note        String?

  ticket PosKitchenTicket @relation(fields: [ticketId], references: [id], onDelete: Cascade)

  @@unique([ticketId, orderLineId])
  @@map("pos_kitchen_ticket_line")
}

model PosProductConfig {
  id                  String   @id @default(uuid(7)) @db.Uuid
  companyId           String   @db.Uuid @map("company_id")
  productId           String   @db.Uuid @map("product_id")
  variantId           String?  @db.Uuid @map("variant_id")
  stationId           String?  @db.Uuid @map("station_id")
  availableInPos      Boolean  @default(true) @map("available_in_pos")
  requiresPreparation Boolean  @default(true) @map("requires_preparation")
  displayOrder        Int      @default(0) @map("display_order")
  createdAt           DateTime @default(now()) @map("created_at")
  updatedAt           DateTime @updatedAt @map("updated_at")

  @@unique([companyId, productId, variantId])
  @@index([companyId, availableInPos])
  @@map("pos_product_config")
}

model PosReceipt {
  id            String   @id @default(uuid(7)) @db.Uuid
  companyId     String   @db.Uuid @map("company_id")
  orderId       String   @db.Uuid @map("order_id")
  receiptNumber Int      @map("receipt_number")
  kind          String
  payload       Json
  printedCount  Int      @default(0) @map("printed_count")
  createdAt     DateTime @default(now()) @map("created_at")

  order PosOrder @relation(fields: [orderId], references: [id], onDelete: Cascade)

  @@unique([companyId, receiptNumber])
  @@map("pos_receipt")
}
```

- [ ] **Step 3: Run schema validation**

```bash
pnpm exec prisma validate
```

Expected: `The schema at prisma/schema.prisma is valid`.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(pos): add Prisma schema for atlas.pos core"
```

---

## Task 2: Migration SQL

**Files:**
- Create: `prisma/migrations/20260621190000_add_atlas_pos/migration.sql`

- [ ] **Step 1: Generate the migration from the schema change**

```bash
pnpm exec prisma migrate dev --create-only --name add_atlas_pos
```

Expected: Prisma creates a migration folder. Rename the folder to `20260621190000_add_atlas_pos` only if the generated timestamp differs and the repo expects stable migration names.

- [ ] **Step 2: Inspect generated SQL for these required tables**

```bash
rg -n "CREATE TABLE.*pos_|CREATE TYPE.*Pos|pos_order|pos_session|pos_floor|pos_kitchen" prisma/migrations/20260621190000_add_atlas_pos/migration.sql
```

Expected: output includes all POS tables and enum types.

- [ ] **Step 3: Apply migration and regenerate Prisma client**

```bash
pnpm db:migrate
pnpm db:generate
```

Expected: migration applies and Prisma client contains accessors such as `prisma.posOrder`, `prisma.posSession`, `prisma.posFloor`, `prisma.posKitchenTicket`.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260621190000_add_atlas_pos/
git commit -m "feat(pos): add database migration for atlas.pos"
```

---

## Task 3: Official Core Manifest and Protected Module Registration

**Files:**
- Modify: `apps/api/src/manifests/official/core-modules.js`
- Modify: `apps/api/src/services/module-lifecycle-service.js`
- Modify: `apps/api/src/routes/modules.js`

- [ ] **Step 1: Add `atlasPosManifest` in `core-modules.js` before `coreModules`**

```js
export const atlasPosManifest = createModuleManifest({
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
  fullscreenPaths: [
    "/pos/terminal",
    "/pos/tables",
    "/pos/floor-planner",
    "/pos/stations",
  ],
  dependencies: [
    { key: "atlas.core" },
    { key: "atlas.company" },
    { key: "atlas.identity" },
    { key: "atlas.catalog" },
  ],
  lifecycle: {
    installable: true,
    uninstallable: false,
    resettable: false,
    supportsDataPurge: false,
    ownedEntities: [
      "PosSettings",
      "PosOutlet",
      "PosTerminal",
      "PosSession",
      "PosPaymentMethod",
      "PosOrder",
      "PosOrderLine",
      "PosGuestSeat",
      "PosPayment",
      "PosCashMovement",
      "PosFloor",
      "PosFloorZone",
      "PosTable",
      "PosFloorElement",
      "PosKitchenStation",
      "PosKitchenTicket",
      "PosKitchenTicketLine",
      "PosProductConfig",
      "PosReceipt",
    ],
    sharedEntities: ["Company", "UserProfile", "CatalogProduct", "CatalogProductVariant", "AuditLog"],
  },
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
  ],
  acl: {
    module: "pos.access",
    actions: {
      "pos.terminal.use": "pos.terminal.use",
      "pos.orders.read": "pos.orders.read",
      "pos.orders.create": "pos.orders.create",
      "pos.orders.update": "pos.orders.update",
      "pos.orders.cancel": "pos.orders.cancel",
      "pos.payments.create": "pos.payments.create",
      "pos.sessions.read": "pos.sessions.read",
      "pos.sessions.manage": "pos.sessions.manage",
      "pos.cash.manage": "pos.cash.manage",
      "pos.floor.read": "pos.floor.read",
      "pos.floor.manage": "pos.floor.manage",
      "pos.stations.read": "pos.stations.read",
      "pos.stations.manage": "pos.stations.manage",
      "pos.settings.manage": "pos.settings.manage",
      "pos.external.manage": "pos.external.manage",
    },
  },
  navigation: [
    { label: "Terminal", path: "/app/m/atlas.pos/pos/terminal", icon: "BadgeDollarSign", layout: "main", permissionKey: "pos.terminal.use" },
    { label: "Mesas", path: "/app/m/atlas.pos/pos/tables", icon: "Armchair", layout: "main", permissionKey: "pos.terminal.use" },
    { label: "Estaciones", path: "/app/m/atlas.pos/pos/stations", icon: "ChefHat", layout: "main", permissionKey: "pos.stations.read" },
    { label: "Ordenes", path: "/app/m/atlas.pos/pos/orders", icon: "ReceiptText", layout: "main", permissionKey: "pos.orders.read" },
    { label: "Cajas", path: "/app/m/atlas.pos/pos/sessions", icon: "Landmark", layout: "main", permissionKey: "pos.sessions.read" },
    { label: "Configuracion", path: "/app/m/atlas.pos/pos/settings", icon: "Settings", layout: "main", permissionKey: "pos.settings.manage" },
  ],
  blueprints: [],
  consumes: ["atlas.files", "atlas.ledger", "atlas.notifications"],
  exposes: [],
});
```

- [ ] **Step 2: Add `atlasPosManifest` to `coreModules`**

Add `atlasPosManifest` after `atlasCatalogManifest` in the `coreModules` array:

```js
  atlasCatalogManifest,
  atlasPosManifest,
```

- [ ] **Step 3: Add `atlas.pos` to protected Core key allowlists**

In `apps/api/src/services/module-lifecycle-service.js`, add `"atlas.pos"` to `CORE_KEYS`.

In `apps/api/src/routes/modules.js`, add `"atlas.pos"` to the official/core allowlist near `"atlas.inventory"`.

- [ ] **Step 4: Verify syntax**

```bash
node --check apps/api/src/manifests/official/core-modules.js
node --check apps/api/src/services/module-lifecycle-service.js
node --check apps/api/src/routes/modules.js
```

Expected: all pass with no output.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/manifests/official/core-modules.js apps/api/src/services/module-lifecycle-service.js apps/api/src/routes/modules.js
git commit -m "feat(pos): register atlas.pos as official core module"
```

---

## Task 4: POS Validators and Service Helpers

**Files:**
- Create: `apps/api/src/routes/pos/validators.js`
- Create: `apps/api/src/routes/pos/service-helpers.js`

- [ ] **Step 1: Create `service-helpers.js`**

```js
export class PosServiceError extends Error {
  constructor(message, status = 500) {
    super(message)
    this.name = 'PosServiceError'
    this.status = status
  }
}

export function requireCompanyId(companyId) {
  if (!companyId) throw new PosServiceError('Empresa requerida.', 403)
  return companyId
}

export function toMoney(value) {
  const n = Number(value ?? 0)
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100) / 100
}

export function assertEditableOrder(order) {
  if (!order) throw new PosServiceError('Orden no encontrada.', 404)
  if (['PAID', 'CANCELLED', 'REFUNDED'].includes(order.status)) {
    throw new PosServiceError('La orden ya no se puede editar.', 409)
  }
}

export function getCompanyId(c) {
  return c.get('companyId') ?? c.get('userContext')?.membership?.companyId ?? c.get('userContext')?.memberships?.[0]?.companyId ?? null
}

export function getActorId(c) {
  return c.get('userId') ?? c.get('userContext')?.profile?.id ?? null
}

export async function writeAudit(prisma, { actorId, entityType, entityId, action, before = null, after = null, metadata = null }) {
  await prisma.auditLog.create({
    data: {
      actorId: actorId ?? null,
      moduleKey: 'atlas.pos',
      entityType,
      entityId,
      action,
      before: before ? JSON.stringify(before) : null,
      after: after ? JSON.stringify(after) : null,
      metadata: metadata ? JSON.stringify(metadata) : null,
    },
  })
}
```

- [ ] **Step 2: Create `validators.js`**

```js
import { z } from 'zod'

export const uuidSchema = z.string().uuid()

export const posModeSchema = z.enum(['RESTAURANT', 'RETAIL', 'HYBRID'])
export const orderStatusSchema = z.enum(['DRAFT', 'OPEN', 'SENT', 'PARTIALLY_SERVED', 'SERVED', 'PAID', 'CANCELLED', 'REFUNDED'])
export const fulfillmentTypeSchema = z.enum(['DINE_IN', 'TAKEAWAY', 'DELIVERY', 'PICKUP'])
export const tableStatusSchema = z.enum(['AVAILABLE', 'OCCUPIED', 'BILL_REQUESTED', 'DIRTY', 'RESERVED', 'DISABLED'])
export const kitchenStatusSchema = z.enum(['PENDING', 'IN_PREPARATION', 'READY', 'DELIVERED', 'CANCELLED'])

export const updateSettingsSchema = z.object({
  mode: posModeSchema.optional(),
  currency: z.string().min(3).max(3).optional(),
  defaultTaxRate: z.number().min(0).max(100).optional(),
  pricesIncludeTax: z.boolean().optional(),
  tipsEnabled: z.boolean().optional(),
  serviceChargeRate: z.number().min(0).max(100).optional(),
  receiptFooter: z.string().max(1000).nullable().optional(),
})

export const createOutletSchema = z.object({
  name: z.string().min(1).max(160),
  code: z.string().max(40).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  mode: posModeSchema.optional(),
})

export const updateOutletSchema = createOutletSchema.partial().extend({
  enabled: z.boolean().optional(),
})

export const createTerminalSchema = z.object({
  outletId: uuidSchema,
  name: z.string().min(1).max(160),
  code: z.string().max(40).nullable().optional(),
})

export const openSessionSchema = z.object({
  outletId: uuidSchema,
  terminalId: uuidSchema,
  openingCashAmount: z.number().min(0).default(0),
  notes: z.string().max(1000).nullable().optional(),
})

export const closeSessionSchema = z.object({
  countedCashAmount: z.number().min(0),
  notes: z.string().max(1000).nullable().optional(),
})

export const cashMovementSchema = z.object({
  kind: z.enum(['IN', 'OUT']),
  amount: z.number().positive(),
  reason: z.string().min(1).max(300),
})

export const createOrderSchema = z.object({
  outletId: uuidSchema,
  sessionId: uuidSchema.nullable().optional(),
  tableId: uuidSchema.nullable().optional(),
  fulfillmentType: fulfillmentTypeSchema.default('DINE_IN'),
  salesChannel: z.enum(['IN_STORE', 'PHONE', 'WEBSITE', 'UBER_EATS', 'RAPPI', 'DIDI_FOOD', 'OTHER']).default('IN_STORE'),
  customerName: z.string().max(160).nullable().optional(),
  customerPhone: z.string().max(80).nullable().optional(),
  guestCount: z.number().int().min(1).max(99).default(1),
  notes: z.string().max(1000).nullable().optional(),
})

export const addOrderLineSchema = z.object({
  guestSeatId: uuidSchema.nullable().optional(),
  productId: uuidSchema.optional(),
  variantId: uuidSchema.nullable().optional(),
  quantity: z.number().positive(),
  unitPrice: z.number().min(0).optional(),
  note: z.string().max(500).nullable().optional(),
})

export const createGuestSchema = z.object({
  label: z.string().min(1).max(80),
})

export const createPaymentSchema = z.object({
  paymentMethodId: uuidSchema,
  amount: z.number().positive(),
  reference: z.string().max(120).nullable().optional(),
})

export const createFloorSchema = z.object({
  outletId: uuidSchema,
  name: z.string().min(1).max(160),
  canvasWidth: z.number().int().min(320).max(10000).default(1200),
  canvasHeight: z.number().int().min(320).max(10000).default(800),
})

export const createTableSchema = z.object({
  floorId: uuidSchema,
  zoneId: uuidSchema.nullable().optional(),
  name: z.string().min(1).max(80),
  capacity: z.number().int().min(1).max(99).default(2),
})

export const tableStatusUpdateSchema = z.object({
  status: tableStatusSchema,
})

export const createStationSchema = z.object({
  outletId: uuidSchema,
  name: z.string().min(1).max(160),
  code: z.string().min(1).max(60),
  color: z.string().max(32).nullable().optional(),
})
```

- [ ] **Step 3: Verify syntax**

```bash
node --check apps/api/src/routes/pos/validators.js
node --check apps/api/src/routes/pos/service-helpers.js
```

Expected: both pass.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/routes/pos/validators.js apps/api/src/routes/pos/service-helpers.js
git commit -m "feat(pos): add validators and service helpers"
```

---

## Task 5: Settings, Outlets and Terminals Service

**Files:**
- Create: `apps/api/src/routes/pos/pos-settings-service.js`
- Create: `apps/api/src/routes/pos/__tests__/pos-settings-service.test.js`

- [ ] **Step 1: Write tests first**

Create tests for these behaviors:

```js
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createPosSettingsService } from '../pos-settings-service.js'
import { PosServiceError } from '../service-helpers.js'

function makePrisma() {
  const settings = new Map()
  const outlets = new Map()
  const terminals = new Map()
  return {
    posSettings: {
      findUnique: async ({ where }) => settings.get(where.companyId) ?? null,
      create: async ({ data }) => { const row = { id: 'settings-1', ...data }; settings.set(data.companyId, row); return row },
      update: async ({ where, data }) => { const row = { ...settings.get(where.companyId), ...data }; settings.set(where.companyId, row); return row },
    },
    posOutlet: {
      findMany: async ({ where }) => [...outlets.values()].filter((row) => row.companyId === where.companyId),
      create: async ({ data }) => { const row = { id: `outlet-${outlets.size + 1}`, enabled: true, ...data }; outlets.set(row.id, row); return row },
      findFirst: async ({ where }) => [...outlets.values()].find((row) => row.id === where.id && row.companyId === where.companyId) ?? null,
      update: async ({ where, data }) => { const row = { ...outlets.get(where.id), ...data }; outlets.set(where.id, row); return row },
    },
    posTerminal: {
      findMany: async ({ where }) => [...terminals.values()].filter((row) => row.companyId === where.companyId),
      create: async ({ data }) => { const row = { id: `terminal-${terminals.size + 1}`, enabled: true, ...data }; terminals.set(row.id, row); return row },
      findFirst: async ({ where }) => [...terminals.values()].find((row) => row.id === where.id && row.companyId === where.companyId) ?? null,
      update: async ({ where, data }) => { const row = { ...terminals.get(where.id), ...data }; terminals.set(where.id, row); return row },
    },
    auditLog: { create: async () => ({}) },
  }
}

describe('createPosSettingsService', () => {
  it('creates default settings on first read', async () => {
    const svc = createPosSettingsService({ prisma: makePrisma() })
    const settings = await svc.getSettings({ companyId: 'company-1' })
    assert.equal(settings.mode, 'RESTAURANT')
    assert.equal(settings.currency, 'MXN')
  })

  it('creates and lists outlets scoped by company', async () => {
    const svc = createPosSettingsService({ prisma: makePrisma() })
    const outlet = await svc.createOutlet({ companyId: 'company-1', actorId: 'user-1', data: { name: 'Sucursal Centro', code: 'CENTRO' } })
    assert.equal(outlet.name, 'Sucursal Centro')
    const rows = await svc.listOutlets({ companyId: 'company-1' })
    assert.equal(rows.length, 1)
  })

  it('throws 404 when updating an outlet outside company scope', async () => {
    const svc = createPosSettingsService({ prisma: makePrisma() })
    await assert.rejects(
      () => svc.updateOutlet({ companyId: 'company-1', id: 'missing', actorId: 'user-1', data: { name: 'X' } }),
      (err) => err instanceof PosServiceError && err.status === 404
    )
  })
})
```

- [ ] **Step 2: Run tests and confirm failure**

```bash
node --test apps/api/src/routes/pos/__tests__/pos-settings-service.test.js
```

Expected: fails because `pos-settings-service.js` does not exist.

- [ ] **Step 3: Implement `createPosSettingsService`**

The service must export:

```js
export function createPosSettingsService({ prisma }) {
  async function getSettings({ companyId }) {}
  async function updateSettings({ companyId, actorId, data }) {}
  async function listOutlets({ companyId }) {}
  async function createOutlet({ companyId, actorId, data }) {}
  async function updateOutlet({ companyId, id, actorId, data }) {}
  async function listTerminals({ companyId }) {}
  async function createTerminal({ companyId, actorId, data }) {}
  async function updateTerminal({ companyId, id, actorId, data }) {}
  return { getSettings, updateSettings, listOutlets, createOutlet, updateOutlet, listTerminals, createTerminal, updateTerminal }
}
```

Implementation requirements:

- `getSettings` creates a default row with `mode: 'RESTAURANT'`, `currency: 'MXN'`, `defaultTaxRate: 16` when no row exists.
- Every lookup filters by `companyId`.
- Every mutation writes audit via `writeAudit`.
- Missing outlet returns `PosServiceError('Sucursal POS no encontrada.', 404)`.
- Missing terminal returns `PosServiceError('Terminal POS no encontrada.', 404)`.
- Strings are trimmed before create/update.

- [ ] **Step 4: Run tests and syntax check**

```bash
node --check apps/api/src/routes/pos/pos-settings-service.js
node --test apps/api/src/routes/pos/__tests__/pos-settings-service.test.js
```

Expected: tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/pos/pos-settings-service.js apps/api/src/routes/pos/__tests__/pos-settings-service.test.js
git commit -m "feat(pos): add settings outlets and terminals service"
```

---

## Task 6: Session and Cash Service

**Files:**
- Create: `apps/api/src/routes/pos/pos-session-service.js`
- Create: `apps/api/src/routes/pos/__tests__/pos-session-service.test.js`

- [ ] **Step 1: Write tests first**

Test these exact behaviors:

- Opening a session rejects when the same terminal already has an `OPEN` session.
- Closing a session sums captured cash payments plus cash movements.
- Cash movement requires an open session.
- Company scoping rejects sessions from another company.

Use assertions with `PosServiceError` for 404/409 cases.

- [ ] **Step 2: Implement `createPosSessionService`**

The service must export:

```js
export function createPosSessionService({ prisma }) {
  async function listSessions({ companyId, status }) {}
  async function getCurrentSession({ companyId, terminalId }) {}
  async function openSession({ companyId, actorId, data }) {}
  async function getSessionById({ companyId, id }) {}
  async function addCashMovement({ companyId, sessionId, actorId, data }) {}
  async function closeSession({ companyId, sessionId, actorId, data }) {}
  return { listSessions, getCurrentSession, openSession, getSessionById, addCashMovement, closeSession }
}
```

Closing calculation:

```js
expectedCashAmount = openingCashAmount + capturedCashPayments + cashInMovements - cashOutMovements
differenceAmount = countedCashAmount - expectedCashAmount
```

For V1, identify cash payments by `PosPaymentMethod.kind === 'CASH'`.

- [ ] **Step 3: Run tests**

```bash
node --check apps/api/src/routes/pos/pos-session-service.js
node --test apps/api/src/routes/pos/__tests__/pos-session-service.test.js
```

Expected: tests pass.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/routes/pos/pos-session-service.js apps/api/src/routes/pos/__tests__/pos-session-service.test.js
git commit -m "feat(pos): add session and cash service"
```

---

## Task 7: Order, Line and Payment Service

**Files:**
- Create: `apps/api/src/routes/pos/pos-order-service.js`
- Create: `apps/api/src/routes/pos/__tests__/pos-order-service.test.js`

- [ ] **Step 1: Write tests first**

Test these exact behaviors:

- `createOrder` creates `guestCount` guest seats when fulfillment is `DINE_IN`.
- `addOrderLine` loads `CatalogProduct` or `CatalogProductVariant` and snapshots `productName`, `sku`, `unitPrice`, `taxRate`, totals.
- Totals recalculate after line add/update/delete.
- Paid orders cannot be edited.
- `addPayment` increments `paidAmount` and sets order `PAID` when paid amount reaches total.
- Duplicate external provider/order id produces a 409 service error.

- [ ] **Step 2: Implement `createPosOrderService`**

The service must export:

```js
export function createPosOrderService({ prisma }) {
  async function listOrders({ companyId, filters }) {}
  async function createOrder({ companyId, actorId, data }) {}
  async function getOrderById({ companyId, id }) {}
  async function updateOrder({ companyId, id, actorId, data }) {}
  async function addGuest({ companyId, orderId, actorId, data }) {}
  async function addOrderLine({ companyId, orderId, actorId, data }) {}
  async function updateOrderLine({ companyId, orderId, lineId, actorId, data }) {}
  async function deleteOrderLine({ companyId, orderId, lineId, actorId }) {}
  async function addPayment({ companyId, orderId, actorId, data }) {}
  async function cancelOrder({ companyId, orderId, actorId, reason }) {}
  async function reprintReceipt({ companyId, orderId, actorId }) {}
  return { listOrders, createOrder, getOrderById, updateOrder, addGuest, addOrderLine, updateOrderLine, deleteOrderLine, addPayment, cancelOrder, reprintReceipt }
}
```

Implementation requirements:

- `orderNumber` is company-scoped and computed as max existing order number + 1 inside a Prisma transaction.
- `createOrder` status should be `OPEN`.
- `addOrderLine` uses catalog data unless `unitPrice` is provided for allowed manual price override.
- `subtotalAmount`, `taxAmount`, `totalAmount`, `paidAmount` are server-owned.
- `addPayment` rejects overpayment unless the excess can be represented as tip in a future task; for Plan A reject overpayment with 400.
- Every mutation writes audit.

- [ ] **Step 3: Run tests**

```bash
node --check apps/api/src/routes/pos/pos-order-service.js
node --test apps/api/src/routes/pos/__tests__/pos-order-service.test.js
```

Expected: tests pass.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/routes/pos/pos-order-service.js apps/api/src/routes/pos/__tests__/pos-order-service.test.js
git commit -m "feat(pos): add order lines and payment service"
```

---

## Task 8: Floor and Kitchen Services

**Files:**
- Create: `apps/api/src/routes/pos/pos-floor-service.js`
- Create: `apps/api/src/routes/pos/pos-kitchen-service.js`
- Create: `apps/api/src/routes/pos/__tests__/pos-floor-kitchen-service.test.js`

- [ ] **Step 1: Write tests first**

Test these behaviors:

- Publishing a floor sets all other floors for the same outlet to `isActive: false`.
- Creating a table enforces company scope and floor scope.
- Updating table status writes the requested `PosTableStatus`.
- `sendOrderToKitchen` creates one `PosKitchenTicket` per station.
- Lines with `requiresPreparation: false` do not create ticket lines.
- Lines requiring preparation without a station produce a 400 error with line ids.
- Updating a ticket line to `READY` updates linked order line kitchen status.

- [ ] **Step 2: Implement `createPosFloorService`**

The service must export:

```js
export function createPosFloorService({ prisma }) {
  async function listFloors({ companyId, outletId }) {}
  async function createFloor({ companyId, actorId, data }) {}
  async function getFloorById({ companyId, id }) {}
  async function updateFloor({ companyId, id, actorId, data }) {}
  async function publishFloor({ companyId, id, actorId }) {}
  async function createTable({ companyId, actorId, data }) {}
  async function updateTable({ companyId, tableId, actorId, data }) {}
  async function updateTableStatus({ companyId, tableId, actorId, status }) {}
  async function getActiveMap({ companyId, outletId }) {}
  return { listFloors, createFloor, getFloorById, updateFloor, publishFloor, createTable, updateTable, updateTableStatus, getActiveMap }
}
```

- [ ] **Step 3: Implement `createPosKitchenService`**

The service must export:

```js
export function createPosKitchenService({ prisma }) {
  async function listStations({ companyId, outletId }) {}
  async function createStation({ companyId, actorId, data }) {}
  async function updateStation({ companyId, stationId, actorId, data }) {}
  async function sendOrderToKitchen({ companyId, orderId, actorId }) {}
  async function listTickets({ companyId, stationId, status }) {}
  async function updateTicketStatus({ companyId, ticketId, actorId, status }) {}
  async function updateTicketLineStatus({ companyId, ticketId, lineId, actorId, status }) {}
  return { listStations, createStation, updateStation, sendOrderToKitchen, listTickets, updateTicketStatus, updateTicketLineStatus }
}
```

- [ ] **Step 4: Run tests**

```bash
node --check apps/api/src/routes/pos/pos-floor-service.js
node --check apps/api/src/routes/pos/pos-kitchen-service.js
node --test apps/api/src/routes/pos/__tests__/pos-floor-kitchen-service.test.js
```

Expected: tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/pos/pos-floor-service.js apps/api/src/routes/pos/pos-kitchen-service.js apps/api/src/routes/pos/__tests__/pos-floor-kitchen-service.test.js
git commit -m "feat(pos): add floor and kitchen services"
```

---

## Task 9: Hono Routes and API Mount

**Files:**
- Create: `apps/api/src/routes/pos/pos-routes.js`
- Create: `apps/api/src/routes/pos/index.js`
- Modify: `apps/api/src/index.js`

- [ ] **Step 1: Create `index.js`**

```js
export { createPosRouter } from './pos-routes.js'
```

- [ ] **Step 2: Create `pos-routes.js`**

Implement a Hono router that wires all services and validators. The factory signature must be:

```js
export function createPosRouter({ prisma, requirePermission }) {
  const app = new Hono()
  return app
}
```

Route map:

```text
GET    /pos/settings                         pos.settings.manage
PATCH  /pos/settings                         pos.settings.manage
GET    /pos/outlets                          pos.settings.manage
POST   /pos/outlets                          pos.settings.manage
PATCH  /pos/outlets/:id                      pos.settings.manage
GET    /pos/terminals                        pos.settings.manage
POST   /pos/terminals                        pos.settings.manage
PATCH  /pos/terminals/:id                    pos.settings.manage

GET    /pos/sessions                         pos.sessions.read
POST   /pos/sessions/open                    pos.sessions.manage
GET    /pos/sessions/current                 pos.sessions.read
GET    /pos/sessions/:id                     pos.sessions.read
POST   /pos/sessions/:id/cash-movements      pos.cash.manage
POST   /pos/sessions/:id/close               pos.sessions.manage

GET    /pos/orders                           pos.orders.read
POST   /pos/orders                           pos.orders.create
GET    /pos/orders/:id                       pos.orders.read
PATCH  /pos/orders/:id                       pos.orders.update
POST   /pos/orders/:id/guests                pos.orders.update
POST   /pos/orders/:id/lines                 pos.orders.update
PATCH  /pos/orders/:id/lines/:lineId         pos.orders.update
DELETE /pos/orders/:id/lines/:lineId         pos.orders.update
POST   /pos/orders/:id/send-to-kitchen       pos.orders.update
POST   /pos/orders/:id/payments              pos.payments.create
POST   /pos/orders/:id/cancel                pos.orders.cancel
POST   /pos/orders/:id/receipts/reprint      pos.orders.read

GET    /pos/floors                           pos.floor.read
POST   /pos/floors                           pos.floor.manage
GET    /pos/floors/:id                       pos.floor.read
PATCH  /pos/floors/:id                       pos.floor.manage
POST   /pos/floors/:id/publish               pos.floor.manage
POST   /pos/tables                           pos.floor.manage
PATCH  /pos/tables/:tableId                  pos.floor.manage
PATCH  /pos/tables/:tableId/status           pos.terminal.use
GET    /pos/tables/active-map                pos.terminal.use

GET    /pos/stations                         pos.stations.read
POST   /pos/stations                         pos.stations.manage
PATCH  /pos/stations/:id                     pos.stations.manage
GET    /pos/stations/:id/tickets             pos.stations.read
PATCH  /pos/kitchen/tickets/:ticketId/status pos.stations.manage
PATCH  /pos/kitchen/tickets/:ticketId/lines/:lineId/status pos.stations.manage
```

Error handling:

```js
function handleError(c, err, fallback) {
  if (err instanceof PosServiceError) return c.json({ error: err.message }, err.status)
  if (process.env.NODE_ENV !== 'production') console.error('[atlas.pos]', err)
  return c.json({ error: fallback }, 500)
}
```

- [ ] **Step 3: Wire route in `apps/api/src/index.js`**

Add import:

```js
import { createPosRouter } from "./routes/pos/index.js";
```

Mount near other Core routers:

```js
mountWithAuth(app, createPosRouter({ prisma, requirePermission }));
```

If `API_PREFIX_RE` exists and lists API prefixes, add `pos`.

- [ ] **Step 4: Syntax check**

```bash
node --check apps/api/src/routes/pos/index.js
node --check apps/api/src/routes/pos/pos-routes.js
node --check apps/api/src/index.js
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/pos/ apps/api/src/index.js
git commit -m "feat(pos): add Hono routes and API mount"
```

---

## Task 10: SDK Methods

**Files:**
- Modify: `packages/sdk/src/index.js`

- [ ] **Step 1: Add `pos` namespace before `projects` or near commercial modules**

```js
    pos: {
      getSettings: (token) =>
        request("/pos/settings", { headers: withAuthHeaders(token) }),
      updateSettings: (data, token) =>
        request("/pos/settings", { method: "PATCH", headers: withAuthHeaders(token), body: JSON.stringify(data) }),
      listOutlets: (token) =>
        request("/pos/outlets", { headers: withAuthHeaders(token) }),
      createOutlet: (data, token) =>
        request("/pos/outlets", { method: "POST", headers: withAuthHeaders(token), body: JSON.stringify(data) }),
      updateOutlet: (id, data, token) =>
        request(`/pos/outlets/${encodeURIComponent(id)}`, { method: "PATCH", headers: withAuthHeaders(token), body: JSON.stringify(data) }),
      listTerminals: (token) =>
        request("/pos/terminals", { headers: withAuthHeaders(token) }),
      createTerminal: (data, token) =>
        request("/pos/terminals", { method: "POST", headers: withAuthHeaders(token), body: JSON.stringify(data) }),
      openSession: (data, token) =>
        request("/pos/sessions/open", { method: "POST", headers: withAuthHeaders(token), body: JSON.stringify(data) }),
      getCurrentSession: (query, token) =>
        request(`/pos/sessions/current${toQueryString(query)}`, { headers: withAuthHeaders(token) }),
      listSessions: (query, token) =>
        request(`/pos/sessions${toQueryString(query)}`, { headers: withAuthHeaders(token) }),
      closeSession: (id, data, token) =>
        request(`/pos/sessions/${encodeURIComponent(id)}/close`, { method: "POST", headers: withAuthHeaders(token), body: JSON.stringify(data) }),
      listOrders: (query, token) =>
        request(`/pos/orders${toQueryString(query)}`, { headers: withAuthHeaders(token) }),
      createOrder: (data, token) =>
        request("/pos/orders", { method: "POST", headers: withAuthHeaders(token), body: JSON.stringify(data) }),
      getOrder: (id, token) =>
        request(`/pos/orders/${encodeURIComponent(id)}`, { headers: withAuthHeaders(token) }),
      addOrderLine: (orderId, data, token) =>
        request(`/pos/orders/${encodeURIComponent(orderId)}/lines`, { method: "POST", headers: withAuthHeaders(token), body: JSON.stringify(data) }),
      addPayment: (orderId, data, token) =>
        request(`/pos/orders/${encodeURIComponent(orderId)}/payments`, { method: "POST", headers: withAuthHeaders(token), body: JSON.stringify(data) }),
      sendToKitchen: (orderId, token) =>
        request(`/pos/orders/${encodeURIComponent(orderId)}/send-to-kitchen`, { method: "POST", headers: withAuthHeaders(token) }),
      listFloors: (query, token) =>
        request(`/pos/floors${toQueryString(query)}`, { headers: withAuthHeaders(token) }),
      createFloor: (data, token) =>
        request("/pos/floors", { method: "POST", headers: withAuthHeaders(token), body: JSON.stringify(data) }),
      publishFloor: (id, token) =>
        request(`/pos/floors/${encodeURIComponent(id)}/publish`, { method: "POST", headers: withAuthHeaders(token) }),
      getActiveMap: (query, token) =>
        request(`/pos/tables/active-map${toQueryString(query)}`, { headers: withAuthHeaders(token) }),
      listStations: (query, token) =>
        request(`/pos/stations${toQueryString(query)}`, { headers: withAuthHeaders(token) }),
      createStation: (data, token) =>
        request("/pos/stations", { method: "POST", headers: withAuthHeaders(token), body: JSON.stringify(data) }),
      listStationTickets: (stationId, query, token) =>
        request(`/pos/stations/${encodeURIComponent(stationId)}/tickets${toQueryString(query)}`, { headers: withAuthHeaders(token) }),
      updateTicketStatus: (ticketId, data, token) =>
        request(`/pos/kitchen/tickets/${encodeURIComponent(ticketId)}/status`, { method: "PATCH", headers: withAuthHeaders(token), body: JSON.stringify(data) }),
    },
```

- [ ] **Step 2: Syntax check**

```bash
node --check packages/sdk/src/index.js
```

Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add packages/sdk/src/index.js
git commit -m "feat(pos): add SDK methods for atlas.pos"
```

---

## Task 11: Desktop Route Shells

**Files:**
- Modify: `apps/desktop/src/app/ModuleOutlet.jsx`
- Create: `apps/desktop/src/modules/atlas.pos/components/PosScreenShell.jsx`
- Create: seven screen files under `apps/desktop/src/modules/atlas.pos/screens/`

- [ ] **Step 1: Create shared screen shell**

```jsx
import { PageHeader, Card, CardContent, EmptyState } from '@atlas/ui'

export default function PosScreenShell({ title, description, children }) {
  return (
    <div className="p-6 space-y-6">
      <PageHeader title={title} description={description} />
      {children ?? (
        <Card>
          <CardContent className="p-6">
            <EmptyState title="Vista en preparacion" description="La base del modulo POS ya esta registrada." />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create screen files**

Each file imports `PosScreenShell` and exports a default screen. Example:

```jsx
import PosScreenShell from '../components/PosScreenShell.jsx'

export default function PosTerminalScreen() {
  return (
    <PosScreenShell
      title="Terminal POS"
      description="Venta tactil, orden activa, comensales y cobro."
    />
  )
}
```

Create matching files and titles:

```text
PosTerminalScreen.jsx      Terminal POS
PosTablesScreen.jsx        Mesas
PosFloorPlannerScreen.jsx  Disenador de plano
PosStationsScreen.jsx      Estaciones
PosSessionsScreen.jsx      Cajas
PosOrdersScreen.jsx        Ordenes
PosSettingsScreen.jsx      Configuracion POS
```

- [ ] **Step 3: Register screens in `ModuleOutlet.jsx`**

Add lazy imports in `SCREEN_MAP`:

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

Add route fallback logic if the module has special-case dispatch blocks:

```js
  if (moduleKey === "atlas.pos") {
    if (subPath === "/" || subPath === "/pos/terminal") return SCREEN_MAP["atlas.pos:/pos/terminal"] ?? null;
    if (subPath === "/pos/tables") return SCREEN_MAP["atlas.pos:/pos/tables"] ?? null;
    if (subPath === "/pos/floor-planner") return SCREEN_MAP["atlas.pos:/pos/floor-planner"] ?? null;
    if (subPath === "/pos/stations") return SCREEN_MAP["atlas.pos:/pos/stations"] ?? null;
    if (subPath === "/pos/orders") return SCREEN_MAP["atlas.pos:/pos/orders"] ?? null;
    if (subPath === "/pos/sessions") return SCREEN_MAP["atlas.pos:/pos/sessions"] ?? null;
    if (subPath === "/pos/settings") return SCREEN_MAP["atlas.pos:/pos/settings"] ?? null;
  }
```

- [ ] **Step 4: Build desktop**

```bash
pnpm --filter @atlas/desktop build:web
```

Expected: Vite build succeeds.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/app/ModuleOutlet.jsx apps/desktop/src/modules/atlas.pos/
git commit -m "feat(pos): add desktop route shells"
```

---

## Task 12: Verification and Seed

**Files:**
- No source files unless verification reveals defects.

- [ ] **Step 1: Run backend tests**

```bash
node --test apps/api/src/routes/pos/__tests__/pos-settings-service.test.js apps/api/src/routes/pos/__tests__/pos-session-service.test.js apps/api/src/routes/pos/__tests__/pos-order-service.test.js apps/api/src/routes/pos/__tests__/pos-floor-kitchen-service.test.js
```

Expected: all tests pass.

- [ ] **Step 2: Run syntax checks**

```bash
node --check apps/api/src/routes/pos/index.js
node --check apps/api/src/routes/pos/pos-routes.js
node --check apps/api/src/routes/pos/validators.js
node --check apps/api/src/routes/pos/service-helpers.js
node --check apps/api/src/routes/pos/pos-settings-service.js
node --check apps/api/src/routes/pos/pos-session-service.js
node --check apps/api/src/routes/pos/pos-order-service.js
node --check apps/api/src/routes/pos/pos-floor-service.js
node --check apps/api/src/routes/pos/pos-kitchen-service.js
node --check apps/api/src/index.js
node --check apps/api/src/manifests/official/core-modules.js
node --check packages/sdk/src/index.js
```

Expected: all pass with no output.

- [ ] **Step 3: Run Prisma and seed checks**

```bash
pnpm exec prisma validate
pnpm db:generate
pnpm db:seed
```

Expected: schema validates, Prisma client regenerates, seed upserts `atlas.pos`.

- [ ] **Step 4: Run desktop build**

```bash
pnpm --filter @atlas/desktop build:web
```

Expected: build succeeds and `atlas.pos` screens compile.

- [ ] **Step 5: Optional API smoke with running dev API**

```bash
pnpm dev:api
```

In another terminal:

```bash
curl -s http://localhost:4010/pos/settings -H "Authorization: Bearer $ATLAS_TOKEN"
curl -s http://localhost:4010/modules -H "Authorization: Bearer $ATLAS_TOKEN" | rg "atlas.pos"
```

Expected: settings endpoint returns JSON and module list includes `atlas.pos`.

- [ ] **Step 6: Final verification commit**

```bash
git status --short
git commit --allow-empty -m "chore(pos): verify atlas.pos core backend foundation"
```

---

## Self-Review Checklist

- [x] Spec coverage for Core identity, manifest and PWA identity: Task 3.
- [x] Spec coverage for Prisma-backed Core data model: Tasks 1 and 2.
- [x] Spec coverage for settings/outlets/terminals: Tasks 5 and 9.
- [x] Spec coverage for sessions/cash movements: Tasks 6 and 9.
- [x] Spec coverage for orders/lines/payments/snapshots: Task 7.
- [x] Spec coverage for floor/tables/kitchen base: Task 8.
- [x] Spec coverage for desktop routes: Task 11.
- [x] Spec coverage for SDK/API consumption: Task 10.
- [x] External delivery integrations intentionally deferred: Plan C after provider access.
- [x] Full operational UI intentionally deferred: Plan B after backend contracts exist.
