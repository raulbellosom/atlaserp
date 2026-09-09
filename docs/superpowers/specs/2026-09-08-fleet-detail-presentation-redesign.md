# Fleet detail presentation redesign

- **Date:** 2026-09-08
- **Status:** Approved (user pre-authorized spec + plan + execution)
- **Module:** `atlas.fleet` (core, v0.5.1) + `@atlas/ui` blueprint renderer
- **Supersedes:** nothing. Complements `docs/superpowers/specs/2026-08-30-atlas-fleet-current-state.md`.

## Problem

The fleet vehicle detail page (and, by extension, the driver and insurance detail
pages) is rendered by the generic `AtlasDetail` renderer in `@atlas/ui`, driven by
the `VEHICLE_DETAIL` / `DRIVER_DETAIL` / `INSURANCE_DETAIL` schemas declared in the
fleet screen files. It presents every record as a flat vertical stack of
`label / value` grids with a plain compact `PageHeader` on top.

The information is all there but the presentation is weak:

- The header is a single line of text. There is nothing that identifies the unit
  at a glance — no photo, no visual anchor. The user explicitly called this out:
  the header "needs an image or something representative of the vehicle".
- Key figures (plate, economic number, type, financed, operator, policy status)
  are buried in the same visual weight as every other field.
- The assigned driver card is a small text row; on a phone you cannot call the
  driver from it.
- On desktop the content is one narrow column down the middle of a wide screen;
  related records (driver, policy, history, documents) are stacked below the
  spec sheet instead of beside it.
- Mobile and desktop use the exact same single-column layout.

Reference mockups (provided by the user) show a richer treatment: a hero block
with a status pill and quick actions, a horizontal strip of key figures, a
prominent driver card with call buttons, a two-column body on desktop, and a
single scrolling column with a sticky-feeling hero on mobile. We are **not**
copying the mockups; we keep Atlas identity (glass tokens, existing components)
and only improve how the information is organised.

## Goals

1. A redesigned detail **hero**: representative image on the left (vehicle photo
   when one exists, a branded fallback panel otherwise), identity, status pill,
   a row of meta chips, and the page actions (Volver / Exportar PDF / Editar).
2. A responsive **key-figures strip** directly under the hero: a 6-up grid on
   desktop, a horizontal snap-scroll carousel on mobile.
3. A **two-column body** on desktop (`lg+`): primary sections (spec sheet,
   financing, observations) in the main column, related records (driver, active
   policy, policy history, documents) in the aside column. Collapses to a single
   column on mobile with the aside sections after the main ones.
4. An upgraded **relation card** that can show an avatar and tap-to-call buttons,
   so the assigned-driver card matches the reference.
5. All of the above is **opt-in per blueprint**. A detail blueprint with none of
   the new `schema` keys renders exactly as it does today. Other modules are
   untouched until they choose to adopt the keys.
6. Apply the new hero (and a small key-figures strip) to the **driver** and
   **insurance** detail blueprints so the three fleet detail screens share one
   visual language.

## Non-goals

- No dedicated `cover_image` column on `fleet_vehicle`. The hero image reuses the
  "first image among the vehicle's documents" that the list view already uses.
  A dedicated photo field is a possible later pass.
- No redesign of the list / table screens, the catalogs screen, the reports
  screens, or any form.
- No change to `AttachmentsPanel` — it already renders file-type icons and
  separates images from other documents, which covers the "documents with type
  icons" part of the reference.
- No new permissions, no Prisma migration.
- No animation beyond what already ships in `@atlas/ui` (hover/press states on
  buttons and cards). No scroll-triggered motion.

## Design

### Architecture

Extend `AtlasDetail` (`packages/ui/src/atlas-renderer/AtlasDetail.jsx`) with an
opt-in presentation layer, plus two new reusable `@atlas/ui` components and one
pure helper module. `AtlasCrudView` hands `AtlasDetail` the pieces it needs to
own the page header when a hero is configured.

```
packages/ui/src/
  components/
    DetailHero.jsx        NEW  — hero: image/photo + identity + status + chips + actions
    StatStrip.jsx         NEW  — responsive key-figures strip (grid desktop / carousel mobile)
  atlas-renderer/
    detail-presentation.js NEW — pure helpers: resolveHeroModel(), resolveKpis(),
                                  splitSectionsByColumn(), buildChipList() (unit-tested)
    AtlasDetail.jsx        EDIT — read schema.hero / schema.kpis / schema.layout;
                                  render DetailHero + StatStrip; 2-column body;
                                  relation-card avatar + contactActions
    AtlasCrudView.jsx      EDIT — when detail schema has `hero`, suppress the built-in
                                  compact PageHeader for detail mode and pass
                                  onBack / onEdit / headerActions node into AtlasDetail
```

### New detail-blueprint `schema` keys

All optional. Unknown-to-old-data = current behaviour.

```js
schema.hero = {
  titleField: "plate",                 // main heading
  subtitleFields: ["name"],            // e.g. "Chevrolet Luv (2005)" — joined with " · "
  statusField: "status",               // rendered as the existing status pill
  imageField: "cover_image_file_asset_id",   // file asset id -> signed URL (client-side)
  imageDocsPath: "/fleet/vehicles/:id/documents", // fallback source: first image doc
  fallbackIcon: "Truck",              // static lucide name when there is no image
  accentColorField: "color",          // tints the fallback panel via resolveColorHex()
  metaChips: [
    { field: "vehicle_type_name", label: "Tipo", icon: "Layers" },
    { field: "full_economic_number", label: "No. Economico", icon: "Hash" },
    { field: "color", label: "Color", type: "color" },
  ],
}

schema.kpis = [
  { label: "Matricula", field: "plate", icon: "Hash" },
  { label: "No. Economico", field: "full_economic_number", icon: "Hash" },
  { label: "Tipo", field: "vehicle_type_name", icon: "Layers" },
  { label: "Financiado", field: "is_financed", type: "boolean", icon: "Landmark" },
  { label: "Operador", field: "driver_name", icon: "UserCheck",
    hrefTemplate: "/app/m/atlas.fleet/drivers/:driver_id" },
  { label: "Poliza", field: "active_insurance_policy.expiry_date", type: "date",
    icon: "ShieldCheck" },
]

schema.layout = "two-column"           // opt-in; default = single column (today)
// each section may then declare:
section.column = "main" | "aside"      // default "main"
```

`relation-card` sections gain two optional keys inside `relationCard`:

```js
relationCard.avatarField = "driver_photo_asset_id"   // file asset id -> signed URL
relationCard.contactActions = [
  { type: "call", field: "driver_phone", label: "Llamar" },
  // future: { type: "email", field: "driver_email" }
]
```

### `DetailHero` component

Props: `{ title, subtitle, statusNode, imageUrl, imageLoading, fallbackIcon,
accentHex, chips: [{label, value, icon, colorHex}], actions }`.

- Layout: `flex` row on `sm+`, stacked on mobile.
- Image box: fixed ratio (`aspect-[4/3]` desktop, `aspect-[16/9]` full-width
  mobile), `rounded-2xl`, `object-cover`. While the signed URL resolves, a
  `Skeleton`. When there is no image: a `bg-[hsl(var(--muted))]` panel with a
  faint radial tint at `accentHex` low-opacity and the `fallbackIcon` lucide
  glyph centred at `~40%` width in `text-[hsl(var(--muted-foreground))]`.
- Identity: `title` in `text-2xl font-bold tracking-tight`, `subtitle` in
  `text-sm text-[hsl(var(--muted-foreground))]`, then `statusNode`, then the chip
  row (`flex flex-wrap gap-2`, each chip a bordered pill; a `type: "color"` chip
  gets the swatch that `AtlasDetail.renderValue` already produces).
- `actions` slot bottom-right on desktop, full-width stacked on mobile.
- Container: `Card` `variant="default"` (glass) so it matches the app; no new
  gradients or hexes beyond the color swatch / accent tint.

### `StatStrip` component

Props: `{ items: [{ label, value, icon, href }] }`.

- Desktop: `grid gap-3 sm:grid-cols-3 lg:grid-cols-6`.
- Mobile: `flex gap-3 overflow-x-auto snap-x snap-mandatory` with each cell
  `min-w-[150px] snap-start` and scrollbar hidden.
- Each cell: a compact `Card variant="solid"` — label in
  `text-[11px] uppercase tracking-wide text-[hsl(var(--muted-foreground))]`,
  value in `text-sm font-semibold`. If `href`, the whole cell is an `<a>`.
- Values are formatted with the same `renderValue` rules already in
  `AtlasDetail` (dates, booleans -> "Si/No", status pills, color swatch).

### `AtlasDetail` changes

- `resolveHeroModel(schema, data)` builds the `DetailHero` props from
  `schema.hero`; the component resolves the image signed URL client-side using
  the existing `fetch(joinUrl(apiBaseUrl, "/files/:id/signed-url"))` pattern
  (already used by `RelationListSection` for `fetch` and by `VehicleImageCell`
  for signed URLs). If `imageField` is empty it fetches `imageDocsPath`, picks
  the first `image/*` asset, and resolves that.
- `resolveKpis(schema, data)` -> `StatStrip` items (supports dotted paths and
  `hrefTemplate` token replacement, reusing existing `getByPath` /
  `replacePathTokens`).
- When `schema.layout === "two-column"`, the section list is partitioned by
  `section.column`; render `<div class="grid gap-6 lg:grid-cols-3">` with main
  sections in a `lg:col-span-2` column and aside sections in the last column.
  Without the key, the current single-column stack is used unchanged.
- `RelationCardSection` gains the avatar (with initials fallback derived from the
  title, matching `DriverAvatarCell.toInitials`) and a row of contact buttons
  (`<a href="tel:...">` wrapped in the `@atlas/ui` `Button` `variant="outline"
  size="sm"`). No call button when the phone field is empty.
- New props accepted: `onBack`, `heroActions` (a node), passed through from
  `AtlasCrudView`. When `schema.hero` exists these render inside `DetailHero`;
  otherwise ignored (sheet mode keeps today's inline Volver/Editar).

### `AtlasCrudView` changes

- Compute `heroEnabled = Boolean(currentDetailBlueprint?.schema?.hero)`.
- In page mode + `mode === "detail"`: if `heroEnabled`, do **not** render the
  compact `PageHeader`; instead pass `onBack={goToList}`, `onEdit`, and a
  `heroActions` node (the same Volver + `detailHeaderActions` + Editar buttons it
  builds today) to `<AtlasDetail>`.
- Sheet mode is unchanged (hero still renders inside the sheet body; the sheet
  keeps its own `SheetHeader`).

### Fleet blueprint edits

`apps/desktop/src/modules/atlas.fleet/screens/VehiclesScreen.jsx`:

- `VEHICLE_DETAIL.schema`: add `hero`, `kpis`, `layout: "two-column"`; tag
  sections — `Identificacion del vehiculo`, `Estado y apariencia`,
  `Financiamiento`, `Observaciones` -> `column: "main"`; `assigned_driver`,
  `active_insurance`, `insurance_history`, `documents` -> `column: "aside"`.
- `assigned_driver` relation-card: add
  `avatarField: "driver_photo_asset_id"` and
  `contactActions: [{ type: "call", field: "driver_phone", label: "Llamar" }]`.
  (`driver_phone` is already selected by `getVehicle`; `driver_photo_asset_id`
  is added — see API change.)

`DriversScreen.jsx` `DRIVER_DETAIL.schema`: add `hero`
(`titleField: "full_name"`, `subtitleFields: ["license_type"]`,
`statusField: "status"`, `imageField: "photo_asset_id_resolved"`,
`fallbackIcon: "UserRound"`, chips: phone, license number, license expiry) and a
4-item `kpis` strip (phone, license no., license status, assigned vehicle if
present). Single-column body kept. Plan A verifies `getDriver` returns
`photo_asset_id_resolved`; if only `photo_asset_id` is present, the blueprint
uses that field name instead — no renderer change either way.

`InsuranceScreen.jsx` `INSURANCE_DETAIL.schema`: add `hero`
(`titleField: "insurer_name"`, `subtitleFields: ["policy_number"]`,
`statusField` derived from `is_active`, `fallbackIcon: "ShieldCheck"`, chips:
vehicle plate, coverage, expiry) and a small `kpis` strip (coverage, premium,
start, expiry). Single-column body kept.

### API change

`apps/api/src/routes/fleet/fleet-service.js` — `getVehicle()` SELECT gains:

- `cover_image_file_asset_id` — the same correlated subquery already used in the
  list query (`getVehicles`), lifted verbatim.
- `fd.photo_asset_id AS driver_photo_asset_id` — the `fleet_driver` join `fd`
  already exists in the query.

No other endpoint changes. `getDriver` already returns `photo_asset_id` /
`photo_asset_id_resolved`; `getPolicy` already returns `vehicle_plate`,
`coverage_type_label`, `is_active`.

## Affected files

| File | Change |
|---|---|
| `packages/ui/src/components/DetailHero.jsx` | new |
| `packages/ui/src/components/StatStrip.jsx` | new |
| `packages/ui/src/atlas-renderer/detail-presentation.js` | new (pure helpers) |
| `packages/ui/src/atlas-renderer/__tests__/detail-presentation.test.js` | new |
| `packages/ui/src/index.js` | export `DetailHero`, `StatStrip` |
| `packages/ui/src/atlas-renderer/AtlasDetail.jsx` | hero + kpis + 2-col + relation-card avatar/call |
| `packages/ui/src/atlas-renderer/AtlasCrudView.jsx` | suppress PageHeader + pass hero actions when hero configured |
| `apps/api/src/routes/fleet/fleet-service.js` | `getVehicle` returns 2 more fields |
| `apps/api/src/routes/fleet/__tests__/vehicle-detail-fields.test.js` | new |
| `apps/desktop/src/modules/atlas.fleet/screens/VehiclesScreen.jsx` | `VEHICLE_DETAIL` hero/kpis/two-column/relation-card |
| `apps/desktop/src/modules/atlas.fleet/screens/DriversScreen.jsx` | `DRIVER_DETAIL` hero/kpis |
| `apps/desktop/src/modules/atlas.fleet/screens/InsuranceScreen.jsx` | `INSURANCE_DETAIL` hero/kpis |
| `docs/ai-context/ame3-runtime-capabilities.md` | document new components + schema keys |

## Testing

- **Unit (`node --test`):** `detail-presentation.test.js` covers
  `resolveHeroModel` (image field vs docs fallback vs none; accent color
  resolution), `resolveKpis` (dotted paths, href token replacement, type
  formatting), `splitSectionsByColumn` (default main, explicit aside, layout off
  = everything in one list), `buildChipList` (empty fields dropped, color chip
  shape).
- **API (`node --test apps/api/src/routes/fleet/__tests__/`):**
  `vehicle-detail-fields.test.js` asserts the `getVehicle` result object exposes
  `cover_image_file_asset_id` and `driver_photo_asset_id` keys (stubbed
  `prisma.$queryRaw`). Existing 28 fleet tests must stay green.
- **Build / lint:** `pnpm --filter @atlas/desktop build:web` and `pnpm lint`
  (the guardrail rule bans local dates from `toISOString`; hero date formatting
  reuses `formatDetailDate`, which is already compliant).
- **Manual browser QA (required — top user complaint per project memory):**
  vehicle / driver / insurance detail at **390px and 1440px**. Check: hero image
  and branded fallback, KPI carousel scroll on mobile, two-column body on
  desktop collapsing correctly, call button dials, actions accessible on mobile,
  dark + light theme, keyboard focus visible on hero actions and KPI links.

## Rollback

Every change is additive. Reverting the three fleet screen files removes the new
presentation with no data or schema impact; the `@atlas/ui` additions become
dead code until another blueprint opts in. The `getVehicle` field additions are
harmless if unused.
