# atlas.inventory — Spec + Phased Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `atlas.inventory`, a core Atlas module that provides full lifecycle asset/inventory management with HR employee assignment, traceability, comments+mentions+reactions, custom fields, and an innovative grouped-tree main view.

**Architecture:** Core Prisma-managed module (not AME3) with its own tables in `prisma/schema.prisma`, a dedicated service layer in `apps/api/src/services/`, routes registered in `apps/api/src/index.js`, and a custom React UI in `apps/desktop/src/modules/atlas.inventory/`.

**Tech Stack:** Prisma 7 (PostgreSQL), Hono, React 18, TanStack Query, React Hook Form + Zod, Tailwind, lucide-react, `@atlas/ui`.

---

## Context

The user needs a cross-purpose inventory + asset tracking module that:
- Tracks any physical or digital asset (laptops, tools, licenses, vehicles, desks, etc.)
- Assigns assets to HR employees with full traceability
- Supports custom fields per category so a "Laptop" category can have "RAM", "CPU" fields while "Software License" has "License Key", "Expiry Date"
- Has an innovative main view inspired by Ragic and spreadsheet tools — items grouped by category in an expandable tree, not just a flat table
- Includes a comments + @mentions + emoji reactions system (parallel to Projects, not shared)
- Provides icon + color pickers for categories so each group has its own visual identity
- Integrates into the HR employee detail to show that employee's assigned items

---

## Module Identity

| Property | Value |
|----------|-------|
| Key | `atlas.inventory` |
| Name | `Inventario` |
| Icon | `Boxes` (lucide-react) |
| Color | `#7c3aed` (violet — distinct from HR blue, Finance green, Projects teal) |
| Kind | `CORE` |
| `core: true` | yes (always installed) |
| `uninstallable: false` | yes |
| Category | `operaciones` |
| Dependencies | `atlas.core`, `atlas.hr` (hard — HR is also core, always present) |

---

## Navigation Routes

| Label | Path | Icon | Permission |
|-------|------|------|------------|
| Inventario | `/inventory` | `Boxes` | `inventory.item.read` |
| Asignaciones | `/inventory/assignments` | `UserCheck` | `inventory.assignment.read` |
| Catalogos | `/inventory/catalogs` | `FolderOpen` | `inventory.catalog.manage` |

---

## Data Models (Prisma)

All models go in `prisma/schema.prisma`. All use `uuid(7)` IDs. All have `@@map()` snake_case table names.

### InvCategory
Tree-structured grouping for items. Each category has an icon (lucide name), color (hex), optional parent for nesting.

```prisma
model InvCategory {
  id          String   @id @default(uuid(7)) @db.Uuid
  companyId   String   @db.Uuid @map("company_id")
  name        String   @db.VarChar(100)
  description String?  @db.VarChar(500)
  icon        String?  @db.VarChar(50)          // lucide-react icon name
  color       String?  @db.VarChar(7)           // hex e.g. "#7c3aed"
  parentId    String?  @db.Uuid @map("parent_id")
  sortOrder   Int      @default(0) @map("sort_order")
  enabled     Boolean  @default(true)
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  company      Company       @relation("CompanyInvCategories", fields: [companyId], references: [id])
  parent       InvCategory?  @relation("InvCategoryChildren", fields: [parentId], references: [id])
  children     InvCategory[] @relation("InvCategoryChildren")
  items        InvItem[]
  customFields InvCustomField[]

  @@unique([companyId, name])
  @@index([companyId])
  @@map("inv_category")
}
```

### InvBrand
Manufacturer / vendor reference.

```prisma
model InvBrand {
  id          String   @id @default(uuid(7)) @db.Uuid
  companyId   String   @db.Uuid @map("company_id")
  name        String   @db.VarChar(100)
  description String?  @db.VarChar(500)
  website     String?  @db.VarChar(255)
  enabled     Boolean  @default(true)
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  company Company   @relation("CompanyInvBrands", fields: [companyId], references: [id])
  items   InvItem[]

  @@unique([companyId, name])
  @@index([companyId])
  @@map("inv_brand")
}
```

### InvLocation
Physical storage location (office, warehouse, room, etc.).

```prisma
model InvLocation {
  id          String   @id @default(uuid(7)) @db.Uuid
  companyId   String   @db.Uuid @map("company_id")
  name        String   @db.VarChar(100)
  description String?  @db.VarChar(500)
  address     String?  @db.VarChar(500)
  enabled     Boolean  @default(true)
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  company Company   @relation("CompanyInvLocations", fields: [companyId], references: [id])
  items   InvItem[]

  @@unique([companyId, name])
  @@index([companyId])
  @@map("inv_location")
}
```

### InvItem
The central entity. Every tracked asset is an InvItem.

```prisma
model InvItem {
  id            String    @id @default(uuid(7)) @db.Uuid
  companyId     String    @db.Uuid @map("company_id")
  assetTag      String    @db.VarChar(100) @map("asset_tag")   // e.g. "IT-001"
  name          String    @db.VarChar(255)
  description   String?   @db.VarChar(2000)
  categoryId    String?   @db.Uuid @map("category_id")
  brandId       String?   @db.Uuid @map("brand_id")
  locationId    String?   @db.Uuid @map("location_id")

  // Identity
  serialNumber  String?   @db.VarChar(255) @map("serial_number")
  model         String?   @db.VarChar(255)
  partNumber    String?   @db.VarChar(255) @map("part_number")

  // Lifecycle status: available | assigned | maintenance | retired | lost | stolen | disposed
  status        String    @default("available") @db.VarChar(50)

  // Purchase
  purchaseDate  DateTime? @db.Date @map("purchase_date")
  purchasePrice Decimal?  @db.Decimal(12, 2) @map("purchase_price")
  vendorName    String?   @db.VarChar(255) @map("vendor_name")
  invoiceNumber String?   @db.VarChar(100) @map("invoice_number")

  // Warranty
  warrantyExpiry DateTime? @db.Date @map("warranty_expiry")
  warrantyNotes  String?   @db.VarChar(500) @map("warranty_notes")

  // Software license fields
  licenseKey    String?   @db.VarChar(500) @map("license_key")
  licenseExpiry DateTime? @db.Date @map("license_expiry")
  licenseSeats  Int?      @map("license_seats")

  // Current assignment (denormalized for quick list queries)
  assignedToId  String?   @db.Uuid @map("assigned_to_id")
  assignedAt    DateTime? @map("assigned_at")

  notes         String?   @db.VarChar(2000)
  enabled       Boolean   @default(true)
  createdById   String?   @db.Uuid @map("created_by_id")
  createdAt     DateTime  @default(now()) @map("created_at")
  updatedAt     DateTime  @updatedAt @map("updated_at")

  company       Company        @relation("CompanyInvItems", fields: [companyId], references: [id])
  category      InvCategory?   @relation(fields: [categoryId], references: [id])
  brand         InvBrand?      @relation(fields: [brandId], references: [id])
  location      InvLocation?   @relation(fields: [locationId], references: [id])
  assignedTo    HrEmployee?    @relation("EmployeeAssignedItems", fields: [assignedToId], references: [id])
  createdBy     UserProfile?   @relation("UserCreatedInvItems", fields: [createdById], references: [id])
  assignments   InvAssignment[]
  comments      InvComment[]
  customValues  InvCustomFieldValue[]
  files         InvItemFile[]

  @@unique([companyId, assetTag])
  @@index([companyId])
  @@index([categoryId])
  @@index([assignedToId])
  @@index([status])
  @@map("inv_item")
}
```

### InvAssignment
Full assignment history. Each time an item is assigned or returned, a record is created.

```prisma
model InvAssignment {
  id            String    @id @default(uuid(7)) @db.Uuid
  itemId        String    @db.Uuid @map("item_id")
  employeeId    String    @db.Uuid @map("employee_id")
  assignedById  String    @db.Uuid @map("assigned_by_id")
  assignedAt    DateTime  @default(now()) @map("assigned_at")
  returnedAt    DateTime? @map("returned_at")
  notes         String?   @db.VarChar(500)

  item        InvItem     @relation(fields: [itemId], references: [id], onDelete: Cascade)
  employee    HrEmployee  @relation("EmployeeInvAssignments", fields: [employeeId], references: [id])
  assignedBy  UserProfile @relation("UserInvAssignments", fields: [assignedById], references: [id])

  @@index([itemId])
  @@index([employeeId])
  @@map("inv_assignment")
}
```

### InvCustomField + InvCustomFieldValue
User-defined fields per category (or global). Types: `text | number | date | textarea | select | boolean | url | email`.

```prisma
model InvCustomField {
  id          String   @id @default(uuid(7)) @db.Uuid
  companyId   String   @db.Uuid @map("company_id")
  categoryId  String?  @db.Uuid @map("category_id")  // null = applies globally
  label       String   @db.VarChar(100)
  fieldKey    String   @db.VarChar(50) @map("field_key")
  fieldType   String   @db.VarChar(30) @map("field_type")
  options     Json?    // [{ value: string, label: string }] for select type
  required    Boolean  @default(false)
  sortOrder   Int      @default(0) @map("sort_order")
  enabled     Boolean  @default(true)
  createdAt   DateTime @default(now()) @map("created_at")

  company   Company       @relation("CompanyInvCustomFields", fields: [companyId], references: [id])
  category  InvCategory?  @relation(fields: [categoryId], references: [id])
  values    InvCustomFieldValue[]

  @@unique([companyId, fieldKey, categoryId])
  @@index([companyId])
  @@index([categoryId])
  @@map("inv_custom_field")
}

model InvCustomFieldValue {
  id      String  @id @default(uuid(7)) @db.Uuid
  itemId  String  @db.Uuid @map("item_id")
  fieldId String  @db.Uuid @map("field_id")
  value   String? @db.VarChar(2000)

  item  InvItem        @relation(fields: [itemId], references: [id], onDelete: Cascade)
  field InvCustomField @relation(fields: [fieldId], references: [id], onDelete: Cascade)

  @@unique([itemId, fieldId])
  @@index([itemId])
  @@map("inv_custom_field_value")
}
```

### InvComment + InvMention + InvCommentReaction
Comment thread on each item, with @mention parsing (same pattern as TaskComment/TaskMention in Projects) plus emoji reactions (new feature not in Projects).

```prisma
model InvComment {
  id        String    @id @default(uuid(7)) @db.Uuid
  itemId    String    @db.Uuid @map("item_id")
  authorId  String    @db.Uuid @map("author_id")
  body      String    @db.VarChar(5000)
  createdAt DateTime  @default(now()) @map("created_at")
  editedAt  DateTime? @map("edited_at")

  item      InvItem             @relation(fields: [itemId], references: [id], onDelete: Cascade)
  author    UserProfile         @relation("UserInvComments", fields: [authorId], references: [id])
  mentions  InvMention[]
  reactions InvCommentReaction[]

  @@index([itemId])
  @@map("inv_comment")
}

model InvMention {
  id        String   @id @default(uuid(7)) @db.Uuid
  commentId String   @db.Uuid @map("comment_id")
  userId    String   @db.Uuid @map("user_id")
  createdAt DateTime @default(now()) @map("created_at")

  comment InvComment  @relation(fields: [commentId], references: [id], onDelete: Cascade)
  user    UserProfile @relation("UserInvMentions", fields: [userId], references: [id], onDelete: Cascade)

  @@unique([commentId, userId])
  @@index([commentId])
  @@index([userId])
  @@map("inv_mention")
}

model InvCommentReaction {
  id        String   @id @default(uuid(7)) @db.Uuid
  commentId String   @db.Uuid @map("comment_id")
  userId    String   @db.Uuid @map("user_id")
  emoji     String   @db.VarChar(10)
  createdAt DateTime @default(now()) @map("created_at")

  comment InvComment  @relation(fields: [commentId], references: [id], onDelete: Cascade)
  user    UserProfile @relation("UserInvReactions", fields: [userId], references: [id], onDelete: Cascade)

  @@unique([commentId, userId, emoji])
  @@index([commentId])
  @@map("inv_comment_reaction")
}
```

### InvItemFile
Join table linking items to FileAsset (atlas.files integration).

```prisma
model InvItemFile {
  id          String   @id @default(uuid(7)) @db.Uuid
  itemId      String   @db.Uuid @map("item_id")
  fileAssetId String   @db.Uuid @map("file_asset_id")
  label       String?  @db.VarChar(100)
  createdAt   DateTime @default(now()) @map("created_at")

  item      InvItem   @relation(fields: [itemId], references: [id], onDelete: Cascade)
  fileAsset FileAsset @relation("FileAssetInvItems", fields: [fileAssetId], references: [id])

  @@index([itemId])
  @@map("inv_item_file")
}
```

**Also add back-relations to existing models:**
- `Company`: add `invItems`, `invCategories`, `invBrands`, `invLocations`, `invCustomFields`
- `HrEmployee`: add `assignedInvItems` and `invAssignments`
- `UserProfile`: add `invComments`, `invMentions`, `invReactions`, `invAssignedBy`, `createdInvItems`
- `FileAsset`: add `invItemFiles`

---

## Permissions

```
inventory.access           — Access inventory module
inventory.item.read        — List and view items
inventory.item.create      — Create new items
inventory.item.update      — Edit existing items
inventory.item.delete      — Soft-delete items
inventory.assignment.read  — View assignment history
inventory.assignment.manage — Assign/return items
inventory.catalog.read     — View categories, brands, locations
inventory.catalog.manage   — Manage categories, brands, locations
inventory.customfield.manage — Create/edit custom fields
```

---

## API Routes

All under `/inventory` prefix. Service file: `apps/api/src/services/inventory-service.js`.

### Items
```
GET    /inventory/items                       — list with search, filter, pagination, groupBy
POST   /inventory/items                       — create item
GET    /inventory/items/:id                   — get item with full relations
PUT    /inventory/items/:id                   — update item
DELETE /inventory/items/:id                   — soft-delete (enabled: false)
POST   /inventory/items/:id/assign            — assign to employee
POST   /inventory/items/:id/return            — return item
GET    /inventory/items/:id/assignments       — assignment history
GET    /inventory/items/:id/comments          — list comments (with reactions)
POST   /inventory/items/:id/comments          — create comment (parses @mentions)
PATCH  /inventory/items/:id/comments/:cid     — edit comment (author only)
DELETE /inventory/items/:id/comments/:cid     — delete comment (author/admin)
POST   /inventory/items/:id/comments/:cid/reactions — toggle reaction (add or remove)
```

### Catalog (categories, brands, locations)
```
GET    /inventory/categories                  — list categories (tree)
POST   /inventory/categories                  — create category
PUT    /inventory/categories/:id              — update category
DELETE /inventory/categories/:id              — soft-delete

GET    /inventory/brands                      — list brands
POST   /inventory/brands                      — create brand
PUT    /inventory/brands/:id                  — update brand

GET    /inventory/locations                   — list locations
POST   /inventory/locations                   — create location
PUT    /inventory/locations/:id               — update location

GET    /inventory/custom-fields               — list custom fields (optionally ?categoryId=)
POST   /inventory/custom-fields               — create custom field
PUT    /inventory/custom-fields/:id           — update custom field
DELETE /inventory/custom-fields/:id           — soft-delete
```

### Reports / cross-queries
```
GET    /inventory/assignments                 — all assignments (with filters: employeeId, itemId, active)
GET    /inventory/items/by-employee/:empId    — items assigned to a specific HR employee
```

---

## Frontend File Structure

```
apps/desktop/src/modules/atlas.inventory/
├── components/
│   ├── InventoryGroupedView.jsx        — main collapsible tree view (groupBy category/brand/status/location)
│   ├── InventoryItemCard.jsx           — card variant for grid view
│   ├── InventoryStatusBadge.jsx        — color-coded status chip
│   ├── InventoryAssignmentPanel.jsx    — assign/return sheet from item detail
│   ├── InventoryCommentThread.jsx      — comments + reactions (reuses MentionTextarea pattern)
│   ├── InventoryActivityFeed.jsx       — activity timeline merged with comments
│   ├── InventoryCustomFieldsForm.jsx   — renders custom fields section in item form
│   └── InventoryEmployeeWidget.jsx     — widget rendered inside HR employee detail (assigned items list)
├── hooks/
│   ├── useInventoryItems.js            — TanStack Query hooks for items CRUD
│   ├── useInventoryCatalogs.js         — hooks for categories, brands, locations
│   └── useInventoryComments.js         — hooks for comments, reactions
├── lib/
│   ├── inventory-constants.js          — statuses, status colors, default icons
│   ├── inventory-utils.js              — assetTag generator, mention parsing reuse
│   └── __tests__/
│       └── inventory-utils.test.js
└── screens/
    ├── InventoryScreen.jsx             — main view with InventoryGroupedView + toolbar
    ├── InventoryItemDetail.jsx         — full detail: info sections + InventoryCommentThread + InventoryActivityFeed
    ├── InventoryItemForm.jsx           — create/edit form (React Hook Form + Zod)
    ├── InventoryCatalogsScreen.jsx     — manage categories (tree), brands, locations, custom fields
    └── InventoryAssignmentsScreen.jsx  — searchable table of all assignments
```

**New shared component (add to `packages/ui/src/`):**
- `IconPickerField.jsx` — grid picker of curated lucide icons, reusable across modules
- Export from `packages/ui/src/index.js`

---

## Key UI Design Decisions

### Main View: Grouped Collapsible Tree (default) + Flat Table (toggle)
The `InventoryGroupedView` component renders items grouped into expandable sections. Each group header shows:
- Category icon + color (as an accent stripe)
- Category name + item count badge
- Chevron to expand/collapse
- "Agregar item" quick action

Inside each group, items are shown as compact rows. Clicking a row opens the detail.

**Toolbar controls:**
- Group-by: Categoria | Marca | Estado | Ubicacion | Responsable
- View-as: Arbol (grouped, default) | Tabla (flat table with all items in one DataTable) | Tarjetas (card grid)
- Search input (real-time, server-side)
- Filters button (opens filter sheet: status, category, brand, location, assignedTo, purchaseDateRange)

**Empty state per group:** shows placeholder text, not hidden.

### Item Detail Layout
Split-panel (like HrEmployeeDetail):
- Left column (2/3): sections for core fields, purchase info, warranty/license, custom fields, attached files
- Right column (1/3): assignment panel (current + history) + comment thread + activity feed

### Form Design
Multi-section React Hook Form with collapsible sections:
1. Identificacion (assetTag, name, category, brand, model)
2. Ubicacion y estado (location, status)
3. Compra y garantia (purchaseDate, purchasePrice, vendor, invoice, warrantyExpiry)
4. Licencia (licenseKey, licenseExpiry, licenseSeats) — optional fields, shown to all
5. Campos personalizados (rendered from InvCustomField for the chosen category)
6. Notas
7. Archivos adjuntos (AttachmentsPanel)

### Comments + Reactions
`InventoryCommentThread` reuses the exact `MentionTextarea` component from Projects (not a copy — import from `apps/desktop/src/modules/atlas.projects/components/MentionTextarea.jsx`). The comment rendering adds a reactions bar below each comment:
- Shows current reaction counts grouped by emoji (e.g. 👍 2, ❤️ 1)
- Click to add/toggle your own reaction (POST/DELETE to reactions endpoint)
- Show who reacted on hover (Tooltip from @atlas/ui)
- Emoji palette: a fixed small set of 8 emojis: 👍 ❤️ 😄 😮 🎯 🔧 ✅ ❌

### Icon Picker (packages/ui/src/components/IconPickerField.jsx)
A curated set of ~80 lucide icons organized in categories:
- Tecnologia: Laptop, Monitor, Keyboard, Mouse, Printer, Phone, Tablet, HardDrive, Cpu, Server, Wifi, Camera
- Herramientas: Wrench, Hammer, Drill, Scissors, Ruler, Flashlight, Plug, Battery
- Muebles/Oficina: BookOpen, Archive, Inbox, Clipboard
- Vehiculos: Car, Truck, Bike, Plane
- General: Box, Boxes, Package, Tag, Barcode, ShoppingCart, Warehouse, Building, Home, Globe, Shield, Key, Lock

Renders as a popover grid of icon buttons. Supports search by name. Selected icon shown as preview in the trigger button.

---

## HR Integration

`InventoryEmployeeWidget` is rendered inside the HR employee detail screen. It shows:
- List of items currently assigned to the employee (assetTag, name, category icon, status badge)
- "Ver historial" link to the full assignments screen filtered by this employee
- Imported directly into `HrEmployeeDetail.jsx` (no conditional — both modules are always co-installed)

---

## Mention System: Reuse vs. Generalize

The current `MentionTextarea` in Projects works for any list of `{ id, displayName }` members. We will **reuse it directly** (import from atlas.projects) rather than copy it. In the future, extracting it to `@atlas/ui` is the right move (Phase 3 scope, not this implementation).

For @mention member population in inventory: use all company members (fetched via existing `/identity/members` endpoint).

---

## Files / Assets Integration

Use the existing `AttachmentsPanel` from `@atlas/ui` for file attachments on items. The `InvItemFile` join table links FileAsset rows to InvItem rows.

---

## Auto-generated Asset Tags

When creating a new item, if `assetTag` is left empty, the API auto-generates one:
```
INV-{year}-{padded_sequence}   e.g. INV-2026-0001
```
Sequence = `COUNT(inv_item WHERE company_id = $1)` + 1. User can always override manually.

---

## Phases

Split into 4 plans per CLAUDE.md rule (>10 tasks / backend+frontend separation):

---

## Phase 1A: Foundation — Database + API

### Tasks

- [ ] **1.1** Add all Prisma models (InvCategory, InvBrand, InvLocation, InvItem, InvAssignment, InvCustomField, InvCustomFieldValue, InvComment, InvMention, InvCommentReaction, InvItemFile) + back-relations to Company, HrEmployee, UserProfile, FileAsset in `prisma/schema.prisma`
- [ ] **1.2** Run `pnpm db:generate` and `pnpm db:migrate` to apply migration
- [ ] **1.3** Create `apps/api/src/services/inventory-service.js` with `createInventoryService({ prisma })` containing:
  - `listItems({ companyId, search, categoryId, brandId, locationId, status, assignedToId, groupBy, page, limit })`
  - `getItem(id, companyId)`
  - `createItem(data, companyId, creatorId)`
  - `updateItem(id, data, companyId)`
  - `deleteItem(id, companyId)` — soft-delete (enabled: false)
  - `assignItem(itemId, employeeId, assignedById, notes, companyId)`
  - `returnItem(itemId, assignedById, notes, companyId)`
  - `getAssignmentHistory(itemId, companyId)`
  - `listCategories(companyId)` — returns tree structure
  - `createCategory(data, companyId)` / `updateCategory` / `deleteCategory`
  - `listBrands(companyId)` / `createBrand` / `updateBrand`
  - `listLocations(companyId)` / `createLocation` / `updateLocation`
  - `listCustomFields(companyId, categoryId)` / `createCustomField` / `updateCustomField` / `deleteCustomField`
  - `createComment(itemId, authorId, body, companyId)` — parses `@[uuid:Name]` mentions, creates InvMention rows
  - `listComments(itemId, companyId)` — with reactions aggregated per comment
  - `updateComment(commentId, authorId, body)` / `deleteComment(commentId, requesterId, companyId)`
  - `toggleReaction(commentId, userId, emoji)` — upsert or delete InvCommentReaction
  - `getItemsByEmployee(employeeId, companyId)` — for HR widget
  - `listAllAssignments({ companyId, employeeId, itemId, active, page, limit })`
- [ ] **1.4** Register inventory routes in `apps/api/src/index.js`:
  - Add `"atlas.inventory"` to `CORE_MODULE_KEYS` set
  - Instantiate: `const inventoryService = createInventoryService({ prisma })`
  - Register all endpoints from the API Routes section above
  - Apply `authMiddleware` + `requirePermission()` on every endpoint
- [ ] **1.5** Add `inventoryMap` manifest to `apps/api/src/manifests/official/core-modules.js` with all permissions, navigation routes, and empty blueprints array
- [ ] **1.6** Add `"atlas.inventory"` to `prisma/seed.js` module list
- [ ] **1.7** Add SDK methods to `packages/sdk/src/index.js` under `atlas.inventory`:
  - All item CRUD, assign, return, assignments, comments, reactions
  - All catalog CRUD (categories, brands, locations, customFields)
- [ ] **1.8** Write service unit tests in `apps/api/src/services/__tests__/inventory-service.test.js` for: createItem, assignItem, returnItem, toggleReaction
- [ ] **1.9** Verify: `node --check apps/api/src/services/inventory-service.js` passes. Run test file. `curl http://localhost:4010/inventory/items` returns 200.

---

## Phase 1B: Core UI — Main View + Item CRUD

### Tasks

- [ ] **2.1** Create `packages/ui/src/components/IconPickerField.jsx` — popover grid of ~80 curated lucide icons with text search and selected icon preview. Export from `packages/ui/src/index.js`.
- [ ] **2.2** Create `apps/desktop/src/modules/atlas.inventory/lib/inventory-constants.js`:
  ```js
  export const ITEM_STATUSES = [
    { value: 'available',   label: 'Disponible',    color: '#16a34a' },
    { value: 'assigned',    label: 'Asignado',      color: '#2563eb' },
    { value: 'maintenance', label: 'Mantenimiento', color: '#d97706' },
    { value: 'retired',     label: 'Retirado',      color: '#6b7280' },
    { value: 'lost',        label: 'Perdido',       color: '#dc2626' },
    { value: 'stolen',      label: 'Robado',        color: '#7c2d12' },
    { value: 'disposed',    label: 'Desechado',     color: '#374151' },
  ];
  export const GROUP_BY_OPTIONS = [
    { value: 'category', label: 'Categoria' },
    { value: 'brand',    label: 'Marca' },
    { value: 'status',   label: 'Estado' },
    { value: 'location', label: 'Ubicacion' },
    { value: 'assignee', label: 'Responsable' },
  ];
  ```
- [ ] **2.3** Create `apps/desktop/src/modules/atlas.inventory/components/InventoryStatusBadge.jsx` — Badge that takes `status` and renders with color from ITEM_STATUSES.
- [ ] **2.4** Create `hooks/useInventoryItems.js` and `hooks/useInventoryCatalogs.js` — TanStack Query hooks wrapping all SDK calls.
- [ ] **2.5** Create `components/InventoryGroupedView.jsx`:
  - Props: `{ items, groups, groupBy, onGroupByChange, viewMode, onViewModeChange, onItemClick, onCreateItem, isLoading, search, onSearchChange }`
  - Toolbar: search input + GroupBy select + ViewMode toggle (Arbol/Tabla/Tarjetas) + Filtros button
  - Arbol mode: collapsible sections per group, header has icon+color strip+name+count badge
  - Tabla mode: flat DataTable with all items
  - Tarjetas mode: responsive card grid using InventoryItemCard
- [ ] **2.6** Create `components/InventoryItemCard.jsx` — compact card showing icon, name, assetTag, status badge, assignee.
- [ ] **2.7** Create `screens/InventoryScreen.jsx` — PageHeader + fetches items/categories + renders InventoryGroupedView + navigates to detail/form.
- [ ] **2.8** Create `components/InventoryCustomFieldsForm.jsx`:
  - Props: `{ customFields, control, fieldPrefix }`
  - Renders each field by type: text→TextField, number→NumberField, date→DateField, select→SelectField, boolean→SwitchField, textarea→TextareaField, url/email→TextField
- [ ] **2.9** Create `screens/InventoryItemForm.jsx`:
  - React Hook Form + Zod (schema in `packages/validators/src/inventory.js`)
  - 7 collapsible sections (Identificacion, Ubicacion/Estado, Compra/Garantia, Licencia, Campos personalizados, Notas, Archivos)
  - Category change triggers custom field fetch and re-renders section 5
  - AttachmentsPanel in section 7
  - create and edit modes via `mode` prop
- [ ] **2.10** Create `screens/InventoryItemDetail.jsx`:
  - 2/3 + 1/3 split layout
  - Left: Card sections for all item info + custom field values + AttachmentsPanel
  - Right: placeholder divs for assignment panel and comment thread (wired in Phase 2A)
  - PageHeader: assetTag as eyebrow, item name as title, status badge in actions
  - Edit button + ConfirmDialog delete
- [ ] **2.11** Register routes in `apps/desktop/src/App.jsx`:
  - `/app/m/atlas.inventory` → InventoryScreen
  - `/app/m/atlas.inventory/new` → InventoryItemForm (create)
  - `/app/m/atlas.inventory/:id` → InventoryItemDetail
  - `/app/m/atlas.inventory/:id/edit` → InventoryItemForm (edit)
- [ ] **2.12** Add atlas.inventory navigation to module sidebar (check where other modules like atlas.hr register their nav entries).
- [ ] **2.13** Verify: `pnpm dev` → navigate to `/app/m/atlas.inventory` → grouped view renders → create item → view detail → edit.

---

## Phase 2A: Advanced Features — Comments, Reactions, Assignments, Catalogs

### Tasks

- [ ] **3.1** Create `hooks/useInventoryComments.js` — hooks for listComments, createComment, updateComment, deleteComment, toggleReaction.
- [ ] **3.2** Create `components/InventoryCommentThread.jsx`:
  - Import `MentionTextarea` from `../../atlas.projects/components/MentionTextarea.jsx`
  - Fetch company members via `/identity/members` for mention population
  - Chronological comment list: avatar + name + timestamp + body rendered with mention pills + edit/delete (author only)
  - Reactions bar per comment: emoji+count grouped, click to toggle, Tooltip showing who reacted
  - Emoji palette (8 emojis: 👍 ❤️ 😄 😮 🎯 🔧 ✅ ❌) on "+" button
  - Comment input at bottom using MentionTextarea + Ctrl+Enter or button submit
  - Inline edit: replaces rendered body with MentionTextarea
- [ ] **3.3** Wire `InventoryCommentThread` into `InventoryItemDetail.jsx` right panel.
- [ ] **3.4** Create `components/InventoryAssignmentPanel.jsx`:
  - Shows current assignment: employee avatar + name + assignedAt
  - "Devolver" button → ConfirmDialog → calls return endpoint
  - "Asignar" button → Sheet with ComboboxField of active HR employees + notes TextField
  - Timeline of past assignments: employee, assignedAt, returnedAt, notes
- [ ] **3.5** Wire `InventoryAssignmentPanel` into `InventoryItemDetail.jsx` right panel above comment thread.
- [ ] **3.6** Create `screens/InventoryCatalogsScreen.jsx`:
  - Tabs: Categorias | Marcas | Ubicaciones | Campos personalizados
  - Categorias: tree view + Sheet form with name, IconPickerField, color input (`<input type="color">`), parent category ComboboxField
  - Marcas + Ubicaciones: simple tables with Sheet forms
  - Campos personalizados: list by category, Sheet form with label, fieldKey, fieldType SelectField, options (shown when type=select)
- [ ] **3.7** Create `screens/InventoryAssignmentsScreen.jsx`:
  - Searchable/filterable DataTable: item name, assetTag, category, employee, assignedAt, returnedAt, notes
  - Filters: employee, item, active-only toggle
- [ ] **3.8** Register `/app/m/atlas.inventory/catalogs` and `/app/m/atlas.inventory/assignments` routes.
- [ ] **3.9** Verify full workflow: create category with icon+color → create item → assign to employee → return → comment with @mention → add reaction.

---

## Phase 2B: HR Integration + Polish

### Tasks

- [ ] **4.1** Create `components/InventoryEmployeeWidget.jsx`:
  - Props: `{ employeeId, token, apiBaseUrl }`
  - Calls `atlas.inventory.getItemsByEmployee(employeeId, token)`
  - Compact list: category icon + assetTag + name + InventoryStatusBadge
  - "Ver todos" link → `/app/m/atlas.inventory/assignments?employee={id}`
  - EmptyState when no items; Card wrapper with "Equipos asignados" title
- [ ] **4.2** Import and render `InventoryEmployeeWidget` directly in `HrEmployeeDetail.jsx` (no conditional guard needed).
- [ ] **4.3** Add activity event publishing to `inventory-service.js`: on assignItem/returnItem emit `InvItem` entity activity events via existing `activityBridge` pattern.
- [ ] **4.4** Create `components/InventoryActivityFeed.jsx`:
  - Queries activity for entity type `InvItem` + itemId
  - Merges with comments (by createdAt timestamp)
  - Renders chronological feed: activity events as timeline entries + comments as comment bubbles
- [ ] **4.5** Replace right-panel placeholder with merged `InventoryActivityFeed` (wrapping both comments and activity) in `InventoryItemDetail.jsx`.
- [ ] **4.6** Polish: warranty/license expiry warning icon on items expiring within 30 days. Show in item cards and detail header.
- [ ] **4.7** Polish: add bulk actions to InventoryGroupedView using `BulkActionBar` from `@atlas/ui` — bulk status change, bulk export.
- [ ] **4.8** Full E2E verification:
  - Create 3 categories (IT, Herramientas, Licencias) with different icons/colors
  - Create 5 items spread across categories
  - Assign 2 items to different HR employees
  - Open HR employee detail → verify widget lists assigned items
  - Return one item → verify assignment history shows returnedAt
  - Add comment with @mention → verify mention pill renders
  - Add emoji reaction → verify count increments

---

## Critical Files to Modify (Existing)

| File | What changes |
|------|-------------|
| `prisma/schema.prisma` | Add 10 new models + back-relations to Company, HrEmployee, UserProfile, FileAsset |
| `prisma/seed.js` | Add atlas.inventory to seeded modules list |
| `apps/api/src/index.js` | Add to CORE_MODULE_KEYS, instantiate service, register ~25 route handlers |
| `apps/api/src/manifests/official/core-modules.js` | Add inventoryMap manifest |
| `packages/sdk/src/index.js` | Add atlas.inventory SDK methods |
| `packages/ui/src/index.js` | Export new IconPickerField |
| `apps/desktop/src/App.jsx` | Add inventory routes |
| `apps/desktop/src/modules/atlas.hr/screens/HrEmployeeDetail.jsx` | Add InventoryEmployeeWidget section |

---

## Verification End-to-End

After Phase 1A:
```bash
pnpm db:generate && pnpm db:migrate
node --check apps/api/src/services/inventory-service.js
node --test apps/api/src/services/__tests__/inventory-service.test.js
curl -H "Authorization: Bearer $ATLAS_TOKEN" http://localhost:4010/inventory/items
```

After Phase 1B:
- `pnpm dev` → `http://localhost:5173/app/m/atlas.inventory`
- Create category in Catalogos → Create item → View detail → Edit

After Phase 2A:
- Full assignment + return workflow
- Comment with @mention + emoji reaction

After Phase 2B:
- HR employee detail shows "Equipos asignados" widget
- Assign from inventory → widget updates in HR
