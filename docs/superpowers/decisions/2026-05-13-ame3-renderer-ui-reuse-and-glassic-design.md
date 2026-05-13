# Design Decision: AME3 Renderer UI Reuse and Glassic Design Alignment

**Date:** 2026-05-13
**Status:** Approved
**Type:** Architecture Decision Record (ADR)
**Scope:** `packages/ui/src/atlas-renderer/` — no runtime changes in this decision

---

## Current Problem

Task 6 of the AME3 plan delivered four blueprint-driven renderer components that are **functionally complete but visually basic**:

- `AtlasTable.jsx` (441 lines) — custom fetch loop, plain `<input>` search, HTML `<select>` filters, no view mode toggle, no glassic container
- `AtlasForm.jsx` (475 lines) — raw HTML `<input>` / native `<select>` for all field types, no glass-subtle styling, no MarkdownField, ComboboxField, CurrencyField, or TagsField
- `AtlasDetail.jsx` (140 lines) — plain muted background sections, no glass morphism
- `AtlasCrudView.jsx` (272 lines) — correct Sheet overlay, but no PageHeader, no ConfirmDialog, no toast feedback
- `BlueprintCrudScreen.jsx` (297 lines) — uses Card for loading/error (good), but minimal visual hierarchy

The `@atlas/ui` package already contains polished, production-grade components used in the Files, Finance, and HR modules. The renderer was deliberately kept minimal to unblock end-to-end pipeline validation (Task 6 goal). A visual alignment pass is now required before AME3 modules can be considered production-ready.

**The Task 6 renderer is a functional MVP, not the final visual UX.**

---

## Existing UI Assets Found

All components listed below exist in `packages/ui/src/components/` and are already re-exported from `packages/ui/src/index.js`.

### For List / Table Views

| Component | File | Purpose |
|---|---|---|
| `ListLayout` | `ListLayout.jsx` | Complete list screen container: search + filters + view switcher + pagination + empty/error/loading. Responsive (desktop inline filters, mobile sheet). |
| `DynamicTable` | `DynamicTable.jsx` | Blueprint-driven table with field renderers, row actions, column width control. Accepts `blueprint`, `data`, `filters`, `isLoading`, `isError`, `onRetry`, `fieldRenderers`, `rowActions`. |
| `ViewModeSwitch` | `ViewModeSwitch.jsx` | Segmented control (table/cards/grid) with localStorage persistence. `getStoredViewMode(key, defaultMode)` helper. |
| `SearchInput` | `SearchInput.jsx` | Controlled search input with clear button. Responsive height (h-10 mobile / h-9 desktop). |
| `FilterBar` | `FilterBar.jsx` | Popover-based filter buttons with active value badge and clear-all. Accepts `filters[{key, label, options}]`. |
| `MobileFiltersSheet` | `MobileFiltersSheet.jsx` | Bottom sheet trigger for mobile filters. Active filter count badge. Hidden on desktop (md:hidden). |
| `EmptyState` | `EmptyState.jsx` | Dashed border container with icon, title, description, optional action button. Variant: `default` / `compact`. |
| `ErrorState` | `ErrorState.jsx` | Destructive color scheme, retry button. |
| `ActionMenu` | `ActionMenu.jsx` | Dropdown menu with automatic separator for destructive items. Accepts `items[{label, icon, onClick, disabled, variant}]`. |

### For Forms

| Component | File | Purpose |
|---|---|---|
| `DynamicForm` | `DynamicForm.jsx` | Blueprint-driven form with React Hook Form. Handles field ordering, hidden fields, custom renderers, validation. |
| `FormFields` | `FormFields.jsx` | 19+ field types with glass-subtle styling and validation: `TextField`, `TextareaField`, `MarkdownField`, `NumberField`, `CurrencyField`, `DateField`, `DateTimeField`, `SelectField`, `PhoneField`, `CheckboxField`, `SwitchField`, `RadioGroupField`, `TagsField`, `DropzoneField`, `ComboboxField`, `CreatableComboboxField`. |

### For Layout and Overlays

| Component | File | Purpose |
|---|---|---|
| `PageHeader` | `PageHeader.jsx` | Eyebrow, title, description, action buttons. Responsive flex. |
| `Card` | `Card.jsx` | Glass morphism card (default/solid/bordered/interactive). Subcomponents: CardHeader, CardTitle, CardContent, CardFooter. |
| `ConfirmDialog` | `ConfirmDialog.jsx` | Destructive confirmation dialog with loading state. |
| `Sheet` | `Sheet.jsx` | Slide-out panel, glass morphism, responsive (becomes bottom sheet on mobile). Already used in `AtlasCrudView`. |
| `Dialog` | `Dialog.jsx` | Modal dialog, responsive (bottom sheet on mobile, centered on desktop). |

### Glassic Patterns Used in Existing Modules

**Table container** (from `atlas.files` / `atlas.hr`):
```jsx
<div className="rounded-2xl border border-[hsl(var(--border))] overflow-hidden">
  <Table>
    <TableHeader>
      <TableRow className="bg-[hsl(var(--muted))]/40 hover:bg-[hsl(var(--muted))]/40">
```

**Card grid item** (from `atlas.hr` HrCardView):
```jsx
className="glass group relative flex flex-col gap-3 rounded-2xl border border-[hsl(var(--border))] p-4 text-left transition-all duration-150 hover:border-[hsl(var(--border))]/60 hover:bg-[hsl(var(--muted))]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
```

**Detail section card** (from `atlas.hr` HrEmployeeDetail):
```jsx
<div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 space-y-4">
  <h3 className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">SECTION TITLE</h3>
```

**Toast feedback** (from all modules, via Sonner):
```jsx
toast.promise(mutation.mutateAsync(payload), {
  loading: "Guardando cambios...",
  success: "Cambio guardado",
  error: (error) => parseApiError(error, "No se pudo guardar."),
})
```

---

## Recommended Renderer Architecture

The renderer should remain blueprint-driven but delegate all visual rendering to existing `@atlas/ui` components. The renderer's own code reduces to: **blueprint normalization + @atlas/ui composition**.

```
BlueprintCrudScreen
  └─ PageHeader (title, eyebrow, primary action)
  └─ AtlasCrudView (state machine: list / create / detail / edit)
       ├─ AtlasTable  →  ListLayout
       │    ├─ DynamicTable (table view)
       │    ├─ AtlasCardGrid (card view, new sub-component)
       │    ├─ ViewModeSwitch
       │    ├─ SearchInput + FilterBar + MobileFiltersSheet
       │    └─ EmptyState / ErrorState / ActionMenu
       ├─ Sheet overlay
       │    ├─ AtlasForm  →  DynamicForm + FormFields
       │    └─ AtlasDetail  →  glassic section cards
       └─ ConfirmDialog (delete confirmation)
```

---

## Component Reuse Matrix

| AME3 Location | Currently Uses | Must Reuse | Priority |
|---|---|---|---|
| AtlasTable — page container | None | `ListLayout` | High |
| AtlasTable — search | Custom `<input>` | `SearchInput` | High |
| AtlasTable — desktop filters | HTML `<select>` | `FilterBar` | High |
| AtlasTable — mobile filters | None | `MobileFiltersSheet` | High |
| AtlasTable — table rendering | Custom row loop | `DynamicTable` | High |
| AtlasTable — empty state | Plain `<p>` | `EmptyState` | High |
| AtlasTable — error state | Inline `<Alert>` | `ErrorState` | High |
| AtlasTable — row actions | Inline buttons | `ActionMenu` | High |
| AtlasTable — view modes | Table only | `ViewModeSwitch` + card/grid sub-component | Medium |
| AtlasForm — all inputs | HTML `<input>` / native `<select>` | `FormFields` (all 19+ types) | High |
| AtlasForm — form orchestration | Manual `<form>` | `DynamicForm` | High |
| AtlasDetail — sections | Plain div + muted bg | Glassic section cards (HR/Finance pattern) | Medium |
| AtlasCrudView — page header | None | `PageHeader` | Medium |
| AtlasCrudView — delete confirm | None (no dialog) | `ConfirmDialog` | High |
| AtlasCrudView — CRUD feedback | None | `toast.promise()` (Sonner) | Medium |

---

## What to Keep from the Current Renderer

These parts are correct and must not be changed during the visual refactor:

- **Blueprint consumption contract**: `schema.apiPath`, `schema.columns`, `schema.sections`, `schema.filters`, `schema.searchable`, `schema.pagination` — stable interface between the API and renderer
- **Normalization helpers**: `normalizeColumns`, `normalizeSections`, `normalizeFieldMap`, `renderValue` — clean foundation for field type mapping
- **State machine in AtlasCrudView**: `list / create / detail / edit` modes with `recordId` tracking
- **Route handler in BlueprintCrudScreen**: wildcard parsing, blueprint matching, URL sync via `useNavigate` / `useLocation`
- **Sheet overlay for create/edit/detail**: already using `@atlas/ui Sheet` — keep this pattern

---

## What to Replace or Refactor

| What | Why |
|---|---|
| Custom `fetch` loop in AtlasTable with raw `<input>` search and `<select>` filters | Duplicates ListLayout + DynamicTable + SearchInput + FilterBar. No glass morphism. No view mode. No mobile UX. |
| `AtlasForm` bare HTML inputs for all field types | Duplicates FormFields. No glass-subtle styling. Missing MarkdownField, ComboboxField, CurrencyField, TagsField, DateField, SwitchField. |
| `AtlasDetail` plain muted-background section divs | No visual hierarchy. Must adopt glassic section card pattern from HR/Finance modules. |
| Inline `<Alert>` for errors in list and form | Replace with `ErrorState` (list) and form-level `<Alert>` remains acceptable for submit errors only. |
| Plain `<p>` for empty states | Replace with `EmptyState` component. |
| Inline "Ver / Editar / Eliminar" buttons in table rows | Replace with `ActionMenu`. |
| No delete confirmation | Add `ConfirmDialog`. |
| No CRUD feedback | Add `toast.promise()` (Sonner, already available in desktop). |

---

## Proposed Phased Plan

### Phase A — Component Wiring (Task 6 follow-up, no new SDD spec required)

Prerequisite: Reconcile `DynamicTable` blueprint shape with AtlasTable's normalized columns (adapter layer in AtlasTable).

1. **AtlasTable**: Wrap with `ListLayout`. Feed `SearchInput`, `FilterBar`, `MobileFiltersSheet`, `ViewModeSwitch`, `EmptyState`, `ErrorState` through ListLayout props. Replace custom table loop with `DynamicTable`. Add `ActionMenu` to row actions column.
2. **AtlasForm**: Replace all bare `<input>` / `<select>` with `FormFields` types mapped by `field.type`. Delegate form orchestration to `DynamicForm`.
3. **AtlasDetail**: Refactor sections to glassic `rounded-2xl border bg-[hsl(var(--card))] p-5` cards with uppercase section eyebrow headers.

File size note: After Phase A, AtlasTable will likely exceed 600 lines. Pre-split into `AtlasTableToolbar.jsx` and `AtlasCardView.jsx` before the line count reaches 800.

### Phase B — UX Polish (Task 6 follow-up, no new SDD spec required)

1. **BlueprintCrudScreen**: Add `PageHeader` with `eyebrow` (module name), `title` (blueprint title), `description` (blueprint description if present), and primary action button ("Nuevo [entity]").
2. **AtlasCrudView**: Add `ConfirmDialog` for delete with destructive styling. Add `toast.promise()` for create, edit, and delete operations.
3. **All renderer components**: Audit every Tailwind class for glass morphism alignment. Ensure container borders use `border-[hsl(var(--border))]`, hover states use `hover:bg-[hsl(var(--muted))]/20`.

### Phase C — Blueprint Schema Expansion (requires new SDD spec)

These features require additions to the blueprint API contract and must go through spec → plan → implementation:

```js
// Proposed new schema fields
{
  viewModes: ['table', 'cards', 'grid'],       // which view modes to enable
  primaryActions: [{ label, icon, action }],   // PageHeader action buttons
  rowActions: [{ label, icon, action }],        // declarative per-row action definitions
  cardLayout: {
    titleField: 'name',
    subtitleField: 'status',
    badgeField: 'type',
    iconField: null,
  },
  density: 'default' | 'compact' | 'spacious',
  emptyState: { icon, title, description, actionLabel },
  header: { eyebrow, description },
}
```

---

## Risks

| Risk | Mitigation |
|---|---|
| **DynamicTable blueprint shape mismatch** — DynamicTable expects `blueprint.fields[]` while AtlasTable normalizes to `columns[]` | Write an adapter in AtlasTable: `normalizeToDynamicTableBlueprint(schema, fields)` |
| **DynamicForm field shape mismatch** — DynamicForm's `blueprint.fields[]` differs from AtlasForm's section-based `fields` | Write adapter: `normalizeToDynamicFormBlueprint(schema, fields)` |
| **File size limit** — AtlasTable will grow past 800 lines after Phase A changes | Pre-split: extract `AtlasTableToolbar.jsx` (search/filter/view controls) + `AtlasCardView.jsx` (card/grid render). Keep AtlasTable as orchestrator. |
| **TanStack Query not available in @atlas/ui** — `@atlas/ui` does not depend on `@tanstack/react-query`; DynamicTable may assume RQ | If DynamicTable internally uses RQ, keep native `fetch` for data loading in AtlasTable; use DynamicTable only for rendering (pass `data` prop). Verify DynamicTable does not call hooks internally. |
| **StorageKey conflicts** — ViewModeSwitch uses `atlas-view-mode-${storageKey}` in localStorage | BlueprintCrudScreen must generate unique storage keys: `${moduleKey}.${entitySegment}` |

---

## Acceptance Criteria for "Visually Production-Ready AME3 Renderer"

A renderer is considered visually production-ready when all of the following pass:

**AtlasTable**
- [ ] Glass morphism container: `rounded-2xl border border-[hsl(var(--border))] overflow-hidden` with `bg-[hsl(var(--muted))]/40` table header
- [ ] ViewModeSwitch present with localStorage persistence (at minimum table + cards)
- [ ] SearchInput rendered (desktop and mobile)
- [ ] FilterBar on desktop + MobileFiltersSheet on mobile (when blueprint has filters)
- [ ] EmptyState component with icon and description from blueprint schema
- [ ] ErrorState component with retry button
- [ ] ActionMenu for row actions (edit, delete, custom)

**AtlasForm**
- [ ] All field types use FormFields: TextField, TextareaField, MarkdownField, NumberField, SelectField, DateField, CheckboxField/SwitchField, PhoneField, ComboboxField
- [ ] All inputs have glass-subtle styling (no raw HTML input elements)
- [ ] Form layout via DynamicForm or equivalent RHF integration with sections support

**AtlasDetail**
- [ ] Sections render as glassic `rounded-2xl border bg-[hsl(var(--card))] p-5 space-y-4` cards
- [ ] Section titles use uppercase eyebrow typography

**AtlasCrudView / BlueprintCrudScreen**
- [ ] PageHeader rendered with eyebrow (module name), title (entity name), and primary action button ("Nuevo [entity]")
- [ ] ConfirmDialog for delete with destructive styling and loading state
- [ ] Toast feedback on create, edit, and delete (Sonner `toast.promise()`)

**Global**
- [ ] All user-facing text in Spanish
- [ ] Desktop build passes: `pnpm --filter @atlas/desktop build:web`
- [ ] No source file exceeds 1000 lines (hard ceiling: 1500)
- [ ] No new Prisma models, API routes, or packages/maps changes introduced

---

## Classification: Task 6 Follow-up vs New SDD Spec

| Change | Classification | Reason |
|---|---|---|
| Phase A — component wiring | Task 6 follow-up (no spec needed) | All @atlas/ui components already exist and are exported. Renderer internals change but the blueprint contract and API are unchanged. |
| Phase B — UX polish | Task 6 follow-up (no spec needed) | PageHeader, ConfirmDialog, and toast notifications are cosmetic and behavioral improvements within the existing renderer boundary. |
| Phase C — blueprint schema expansion | **Requires new SDD spec** | New schema fields change the contract between the blueprint API (GET /blueprints) and the renderer. The API must store and serve the new fields. Prisma Blueprint table may need a schema column addition. The spec must define field semantics, validation, and backward compatibility. |

---

## Files Read During This Audit

**Core UI package:**
- `packages/ui/src/index.js`
- `packages/ui/src/components/DynamicTable.jsx`
- `packages/ui/src/components/DynamicForm.jsx`
- `packages/ui/src/components/ViewModeSwitch.jsx`
- `packages/ui/src/components/ListLayout.jsx`
- `packages/ui/src/components/MobileFiltersSheet.jsx`
- `packages/ui/src/components/SearchInput.jsx`
- `packages/ui/src/components/FilterBar.jsx`
- `packages/ui/src/components/PageHeader.jsx`
- `packages/ui/src/components/EmptyState.jsx`
- `packages/ui/src/components/ErrorState.jsx`
- `packages/ui/src/components/ActionMenu.jsx`
- `packages/ui/src/components/ConfirmDialog.jsx`
- `packages/ui/src/components/Card.jsx`
- `packages/ui/src/components/Sheet.jsx`
- `packages/ui/src/components/Dialog.jsx`
- `packages/ui/src/components/Table.jsx`
- `packages/ui/src/components/FormFields.jsx`
- `packages/ui/src/components/FileCard.jsx`
- `packages/ui/src/components/FileUploader.jsx`
- `packages/ui/src/components/FileViewer.jsx`

**Current AME3 renderer:**
- `packages/ui/src/atlas-renderer/AtlasTable.jsx`
- `packages/ui/src/atlas-renderer/AtlasForm.jsx`
- `packages/ui/src/atlas-renderer/AtlasDetail.jsx`
- `packages/ui/src/atlas-renderer/AtlasCrudView.jsx`
- `apps/desktop/src/shell/BlueprintCrudScreen.jsx`

**Existing module screens (patterns reference):**
- `apps/desktop/src/modules/atlas.files/screens/FilesScreen.jsx`
- `apps/desktop/src/modules/atlas.files/components/FilesToolbar.jsx`
- `apps/desktop/src/modules/atlas.files/components/FilesTableView.jsx`
- `apps/desktop/src/modules/atlas.hr/screens/HrScreen.jsx`
- `apps/desktop/src/modules/atlas.hr/screens/HrEmployeeDetail.jsx`
- `apps/desktop/src/modules/atlas.hr/components/HrCardView.jsx`
- `apps/desktop/src/modules/atlas.finance/components/DocumentSheet.jsx`
