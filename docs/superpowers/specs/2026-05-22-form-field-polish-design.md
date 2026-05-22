# Form Field Polish v2 — Design Spec

**Date:** 2026-05-22  
**Status:** Approved  
**Scope:** `packages/ui` only — zero changes to API, Prisma, or module manifests  
**Approach:** One spec, phased implementation (icons → date picker → currency → rich combobox)

---

## Context

After the renderer v2 redesign (flat sections, no card-on-card), several form field components need polish:

1. Section headers have no icons — users have no visual anchors to orient within a form
2. `AtlasForm` ignores the existing `DatePickerField` and uses native `<input type="date">` instead
3. `CurrencyField` exists but is not wired into `AtlasForm.renderFieldControl()` — no `type: "currency"` case
4. `RelationSelectField` shows only a flat string per option — no structured multi-line display

All 4 improvements affect only `packages/ui/src/`. Every custom module benefits automatically with zero per-module changes — except module authors who opt into `displayFields` or `icon` in their view definitions.

---

## Phase 1 — Section Header Icons

### Goal
Allow any view definition section to specify a Lucide icon name string. Both `AtlasForm` and `AtlasDetail` render it left of the section title.

### View Definition API
```js
sections: [
  {
    id: 'vehicle',
    title: 'Vehículo',
    icon: 'Wrench',          // optional — any Lucide icon name
    type: 'fields',
    fields: [...]
  },
  {
    id: 'service',
    title: 'Datos del Servicio',
    icon: 'CalendarDays',
    type: 'fields',
    fields: [...]
  }
]
```

### Renderer Behavior
- `AtlasForm` and `AtlasDetail` resolve the icon at render time:
  ```js
  import * as Icons from 'lucide-react'
  const Icon = section.icon ? Icons[section.icon] : null
  ```
- If the name matches no Lucide export, `Icon` is `undefined` — renders nothing, no crash
- Icon renders left of the title in the `pb-3 border-b` section header:
  ```
  [icon]  Section Title
  ────────────────────────
  fields...
  ```
- Icon size: `h-4 w-4`, color: `text-[hsl(var(--muted-foreground))]`

### Schema
`atlas-form-schema.js` `normalizeSection()` already passes through unknown properties — `icon` requires no explicit normalization.

### Backward Compatibility
Sections without `icon` render identically to today.

---

## Phase 2 — DatePickerField Upgrade + Wiring

### Goal
Replace native `<input type="date">` in `AtlasForm` with the custom `DatePickerField`, upgraded to display dates in Spanish locale format using `date-fns`.

### Dependency
Add `date-fns` to `packages/ui`:
```
pnpm add date-fns --filter @atlas/ui
```

### DatePickerField Changes (`packages/ui/src/components/DatePickerField.jsx`)
- Import `format` from `date-fns` and `es` locale from `date-fns/locale`
- Change display string from browser-default to:
  ```js
  format(dateObj, "d 'de' MMMM, yyyy", { locale: es })
  // Result: "22 de mayo, 2026"
  ```
- Internal calendar grid, navigation, today highlight, clear button: unchanged
- Value contract: `YYYY-MM-DD` string in → `YYYY-MM-DD` string out (unchanged)

### AtlasForm Wiring (`packages/ui/src/atlas-renderer/AtlasForm.jsx`)
```js
// Before:
case "date":
  return <TextField type="date" value={value ?? ""} onChange={...} />

// After:
case "date":
  return (
    <DatePickerField
      label={field.label}
      value={value ?? ""}
      onChange={(val) => handleChange(field.name, val)}
      required={field.required}
      error={fieldErrors[field.name]}
    />
  )
```

### Out of Scope
`type: "datetime"` stays as native `<input type="datetime-local">` — the custom picker does not support time selection yet.

### Backward Compatibility
All existing `type: "date"` blueprint fields get the upgraded picker automatically. Stored value format (`YYYY-MM-DD`) is unchanged — no data migration needed.

---

## Phase 3 — CurrencyField Rewrite + Wiring

### Goal
Rewrite `CurrencyField` to format on every keystroke (always displays formatted currency), then wire it into `AtlasForm` as `type: "currency"`.

### Keystroke Formatting Behavior
- Internally stores **cents as an integer**
- Always displays formatted value — never raw number
- Typing sequence: `5` → `$0.05`, `52` → `$0.52`, `5250` → `$52.50`
- On focus: selects all text so user can type fresh
- Only digits pass through — letters and symbols filtered on `keydown`
- Backspace to empty → resets to `$0.00` (or `null` if `clearable: true`)
- `onChange` returns **decimal value** (`52.50`) — not cents — so form state and API submission are unaffected

### Props Contract (backward compatible)
All existing props preserved: `label`, `required`, `error`, `hint`, `currency`, `locale`, `min`, `max`, `className`. No props removed.

Default values: `currency: "MXN"`, `locale: "es-MX"`.

### AtlasForm Wiring
New case in `renderFieldControl()`:
```js
case "currency":
  return (
    <CurrencyField
      label={field.label}
      value={value ?? 0}
      onChange={(val) => handleChange(field.name, val)}
      required={field.required}
      error={fieldErrors[field.name]}
      currency={field.currency ?? "MXN"}
      locale={field.locale ?? "es-MX"}
    />
  )
```

### View Definition Usage
```js
{ name: 'amount', label: 'Monto',  type: 'currency' }
{ name: 'cost',   label: 'Costo',  type: 'currency', currency: 'USD' }
```

### Out of Scope
`type: "number"` and `type: "decimal"` are unchanged — they keep `TextField type="number"`. Only explicitly typed `currency` fields use the new formatter.

### Impact on Existing Legacy Screens
`CurrencyField` is currently used directly (outside of AtlasForm) in 6 legacy Finance and Ledger components:
- `apps/desktop/src/modules/atlas.finance/components/AccountSheet.jsx`
- `apps/desktop/src/modules/atlas.finance/components/DocumentSheet.jsx`
- `apps/desktop/src/modules/atlas.finance/components/EntrySheet.jsx`
- `apps/desktop/src/modules/atlas.finance/components/GuidedEntrySheet.jsx`
- `apps/desktop/src/modules/atlas.ledger/components/AccountSheet.jsx`
- `apps/desktop/src/modules/atlas.ledger/components/MovementSheet.jsx`

The rewrite changes their behavior too (keystroke formatting instead of blur). This is an improvement, but each screen must be visually verified after the rewrite to confirm no regression.

---

## Phase 4 — Rich RelationSelectField

### Goal
Allow relation fields to render structured multi-line option rows in the dropdown (badge + title + subtitle), configured via `displayFields` in the view definition. Zero regression for fields that don't use `displayFields`.

### View Definition API
```js
{
  name: 'vehicle_id',
  label: 'Seleccionar vehículo',
  type: 'relation',
  relation: {
    apiPath: '/fleet/vehicles',
    valueField: 'id',
    labelField: 'display_name',        // used for selected-value display (unchanged)
    displayFields: {                   // optional — enables rich dropdown
      badge:    'eco_number',          // colored pill, top-left
      title:    'vehicle_name',        // bold primary line
      subtitle: ['plate', 'type_name', 'color']  // muted second line, joined with " • "
    },
    searchParam: 'search',
  }
}
```

### Data Flow

`loadRelationOptions()` in `AtlasForm` adds a `meta` field when `displayFields` is configured:

```js
options = rows.map(row => ({
  value: String(row[valueField]),
  label: resolveRelationLabel(row, descriptor),  // unchanged — selected-value display
  meta: descriptor.displayFields ? {
    badge:    row[descriptor.displayFields.badge],
    title:    row[descriptor.displayFields.title],
    subtitle: Array.isArray(descriptor.displayFields.subtitle)
      ? descriptor.displayFields.subtitle
          .map(f => row[f])
          .filter(Boolean)
          .join(' • ')
      : row[descriptor.displayFields.subtitle]
  } : null
}))
```

### RelationSelectField Rendering

When `opt.meta` is present, renders a two-line layout per option:

```
┌────────────────────────────────────────────┐
│  [04-1002]  Nissan Aveo 2022          ✓   │
│             MRL-1234 • Sedan • Azul marino │
└────────────────────────────────────────────┘
```

- **Badge** (`meta.badge`): `rounded bg-[hsl(var(--primary))]/10 px-1.5 py-0.5 text-xs font-semibold text-[hsl(var(--primary))]`
- **Title** (`meta.title`): `text-sm font-medium text-[hsl(var(--foreground))]`
- **Subtitle** (`meta.subtitle`): `text-xs text-[hsl(var(--muted-foreground))]`

When `opt.meta` is `null`: renders `opt.label` as a flat string, identical to current behavior.

### Selected Value Display
Unchanged — the trigger button shows `opt.label` (the `labelField` string) when a value is selected.

### Search Behavior
Unchanged — `onSearchChange` → `searchParam` on the API. Filtering is server-side; `displayFields` is purely visual.

### normalizeRelationDescriptor()
`renderer-adapters.js` currently does not pass `displayFields` through — it must be explicitly added:
```js
displayFields: raw.relation?.displayFields ?? null,
```
This is a one-line addition in the normalized descriptor object. `displayFields` is then available on `descriptor` inside `loadRelationOptions()` in `AtlasForm`.

### Backward Compatibility
All existing relation fields with no `displayFields` render exactly as today. The `meta: null` path is the default.

---

## Files Modified

| File | Phase | Change |
|------|-------|--------|
| `packages/ui/src/atlas-renderer/AtlasForm.jsx` | 1, 2, 3, 4 | Icon rendering, date/currency/relation wiring |
| `packages/ui/src/atlas-renderer/AtlasDetail.jsx` | 1 | Icon rendering in section headers |
| `packages/ui/src/components/DatePickerField.jsx` | 2 | date-fns display format |
| `packages/ui/src/components/FormFields.jsx` | 3 | CurrencyField keystroke rewrite |
| `packages/ui/src/atlas-renderer/renderer-adapters.js` | 4 | displayFields passthrough (minor) |
| `packages/ui/package.json` | 2 | Add date-fns dependency |

**Not modified:** API, Prisma schema, module manifests, `packages/maps/`, `apps/api/`, `BlueprintCrudScreen.jsx`, `AtlasTable.jsx`.

---

## Verification

1. **Icons:** Add `icon: "Wrench"` to a fleet form section → icon appears left of title in both form and detail view. Section without icon is unchanged.
2. **Date picker:** Open any fleet form with a date field → custom calendar popover appears instead of native browser picker. Selected date shows as "22 de mayo, 2026". Saved value is still `YYYY-MM-DD`.
3. **Currency:** Add `type: "currency"` to a fleet form field → typing digits always shows formatted `$X,XXX.XX`. Submit saves the decimal value correctly.
4. **Rich combobox:** Add `displayFields` to a vehicle relation field → dropdown shows badge + two-line layout. A relation field without `displayFields` shows flat label string unchanged.
5. **No regression:** All existing fleet forms, table views, and detail views render correctly.
