# Form Field Polish v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish Atlas ERP form fields: section header icons, custom date picker, keystroke currency formatter, and rich multi-line relation field options — all in `packages/ui`, automatically applied to every custom module.

**Architecture:** All changes are in `packages/ui/src/`. `AtlasForm.jsx` is the primary orchestrator — it renders section headers and dispatches field types to components. Individual components (`DatePickerField`, `CurrencyField`, `RelationSelectField`) are upgraded independently, then wired in. `renderer-adapters.js` gets a one-line addition to pass `displayFields` through normalization.

**Tech Stack:** React, Tailwind CSS, lucide-react (already installed), date-fns (new dependency), Radix UI Popover (already installed).

---

## File Map

| File | Role | Task(s) |
|------|------|---------|
| `packages/ui/src/atlas-renderer/AtlasForm.jsx` | Renders section headers + dispatches field types | 1, 2, 3, 4 |
| `packages/ui/src/atlas-renderer/AtlasDetail.jsx` | Renders section headers in read-only detail views | 1 |
| `packages/ui/src/components/DatePickerField.jsx` | Custom calendar popover | 2 |
| `packages/ui/src/components/FormFields.jsx` | Contains `CurrencyField` and `RelationSelectField` | 3, 4 |
| `packages/ui/src/atlas-renderer/renderer-adapters.js` | Normalizes relation field descriptors | 4 |
| `packages/ui/package.json` | Package dependencies | 2 |

---

## Task 1: Section Header Icons

**Files:**
- Modify: `packages/ui/src/atlas-renderer/AtlasForm.jsx`
- Modify: `packages/ui/src/atlas-renderer/AtlasDetail.jsx`

The goal is to render an optional Lucide icon left of the section title in both forms and detail views. Icons are specified as strings (e.g. `"Wrench"`) in the view definition's `section.icon` property. We dynamically resolve them from `lucide-react`.

### AtlasForm.jsx

- [ ] **Step 1: Add lucide-react wildcard import**

In `packages/ui/src/atlas-renderer/AtlasForm.jsx`, the current import on line 2 is:
```js
import { ChevronDown, ChevronUp } from "lucide-react";
```

Replace it with:
```js
import { ChevronDown, ChevronUp } from "lucide-react";
import * as LucideIcons from "lucide-react";
```

- [ ] **Step 2: Update `renderSectionHeader` to resolve and render the icon**

The current `renderSectionHeader` function (inside `renderSection`) starts at:
```js
const renderSectionHeader = () => {
  if (!section.title && !isCollapsible) return null;
  return (
    <div className="pb-3 border-b border-[hsl(var(--border))] flex items-start justify-between gap-3">
      <div className="space-y-0.5">
        {section.title ? (
          <h4 className="text-sm font-semibold text-[hsl(var(--foreground))]">
            {section.title}
          </h4>
        ) : null}
        {section.description ? (
          <p className="text-xs text-[hsl(var(--muted-foreground))]">{section.description}</p>
        ) : null}
      </div>
      {isCollapsible ? (
        <Button type="button" variant="ghost" size="sm" onClick={() => toggleSection(section.id)}>
          {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </Button>
      ) : null}
    </div>
  );
};
```

Replace it with:
```js
const renderSectionHeader = () => {
  if (!section.title && !isCollapsible) return null;
  const SectionIcon = section.icon ? LucideIcons[section.icon] : null;
  return (
    <div className="pb-3 border-b border-[hsl(var(--border))] flex items-start justify-between gap-3">
      <div className="flex items-center gap-2">
        {SectionIcon ? (
          <SectionIcon className="h-4 w-4 shrink-0 text-[hsl(var(--muted-foreground))]" />
        ) : null}
        <div className="space-y-0.5">
          {section.title ? (
            <h4 className="text-sm font-semibold text-[hsl(var(--foreground))]">
              {section.title}
            </h4>
          ) : null}
          {section.description ? (
            <p className="text-xs text-[hsl(var(--muted-foreground))]">{section.description}</p>
          ) : null}
        </div>
      </div>
      {isCollapsible ? (
        <Button type="button" variant="ghost" size="sm" onClick={() => toggleSection(section.id)}>
          {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </Button>
      ) : null}
    </div>
  );
};
```

- [ ] **Step 3: Verify AtlasForm renders**

Run: `node --check packages/ui/src/atlas-renderer/AtlasForm.jsx`
Expected: no output (syntax OK)

### AtlasDetail.jsx

- [ ] **Step 4: Add lucide-react wildcard import to AtlasDetail**

In `packages/ui/src/atlas-renderer/AtlasDetail.jsx`, find the existing lucide-react import (something like `import { ... } from "lucide-react"`) and add the wildcard alongside it:
```js
import * as LucideIcons from "lucide-react";
```

- [ ] **Step 5: Update section header in AtlasDetail to render icon**

Find the section title rendering block inside the `.map((section) => ...)`. Currently it is:
```js
{section.title ? (
  <div className="pb-3 border-b border-[hsl(var(--border))]">
    <h4 className="text-sm font-semibold text-[hsl(var(--foreground))]">
      {section.title}
    </h4>
  </div>
) : null}
```

Replace with:
```js
{section.title ? (
  <div className="pb-3 border-b border-[hsl(var(--border))] flex items-center gap-2">
    {(() => {
      const SectionIcon = section.icon ? LucideIcons[section.icon] : null;
      return SectionIcon ? (
        <SectionIcon className="h-4 w-4 shrink-0 text-[hsl(var(--muted-foreground))]" />
      ) : null;
    })()}
    <h4 className="text-sm font-semibold text-[hsl(var(--foreground))]">
      {section.title}
    </h4>
  </div>
) : null}
```

- [ ] **Step 6: Verify AtlasDetail renders**

Run: `node --check packages/ui/src/atlas-renderer/AtlasDetail.jsx`
Expected: no output (syntax OK)

- [ ] **Step 7: Add icon to a fleet form section and verify visually**

Open `modules/custom/custom.fleet/views/reports.service.form.js` (or any fleet form view). Add `icon: "Wrench"` to the first section's definition:
```js
{
  id: 'vehicle',
  title: 'Vehículo',
  icon: 'Wrench',    // ← add this line
  type: 'fields',
  fields: [...]
}
```

Run `pnpm dev`, open the fleet module, open the service report form. Confirm the wrench icon appears left of "Vehículo". Confirm sections without `icon` are unchanged.

- [ ] **Step 8: Commit**

```bash
git add packages/ui/src/atlas-renderer/AtlasForm.jsx packages/ui/src/atlas-renderer/AtlasDetail.jsx modules/custom/custom.fleet/views/reports.service.form.js
git commit -m "feat(ui): add optional icon to form and detail section headers"
```

---

## Task 2: DatePickerField Upgrade + Wiring

**Files:**
- Modify: `packages/ui/package.json`
- Modify: `packages/ui/src/components/DatePickerField.jsx`
- Modify: `packages/ui/src/atlas-renderer/AtlasForm.jsx`

The goal is to: (1) add `date-fns` for Spanish locale display, (2) change the `formatDisplay` function in `DatePickerField` to output "22 de mayo, 2026", (3) wire `DatePickerField` into `AtlasForm` for `type: "date"` fields.

- [ ] **Step 1: Install date-fns**

```bash
pnpm add date-fns --filter @atlas/ui
```

Expected: `date-fns` appears in `packages/ui/package.json` dependencies.

- [ ] **Step 2: Update `formatDisplay` in DatePickerField.jsx**

In `packages/ui/src/components/DatePickerField.jsx`, find the imports at the top:
```js
import { useState, useId, useCallback } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
```

Add `date-fns` imports after them:
```js
import { format } from "date-fns";
import { es } from "date-fns/locale";
```

Then find the `formatDisplay` function:
```js
function formatDisplay(value) {
  const d = parseDate(value);
  if (!d) return "";
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" });
}
```

Replace it with:
```js
function formatDisplay(value) {
  const d = parseDate(value);
  if (!d) return "";
  return format(d, "d 'de' MMMM, yyyy", { locale: es });
}
```

- [ ] **Step 3: Verify DatePickerField syntax**

Run: `node --check packages/ui/src/components/DatePickerField.jsx`
Expected: no output (syntax OK)

- [ ] **Step 4: Wire DatePickerField into AtlasForm**

In `packages/ui/src/atlas-renderer/AtlasForm.jsx`, find the existing imports block at the top. The imports from `../components/FormFields.jsx` are:
```js
import {
  TextField,
  TextareaField,
  MarkdownField,
  SelectField,
  PhoneField,
  SwitchField,
  RelationSelectField,
} from "../components/FormFields.jsx";
```

Add the `DatePickerField` import after it:
```js
import { DatePickerField } from "../components/DatePickerField.jsx";
```

- [ ] **Step 5: Replace native date input with DatePickerField in renderFieldControl**

In `AtlasForm.jsx`, find the `case "date":` block inside `renderFieldControl`:
```js
case "date":
  return (
    <TextField
      {...sharedProps}
      type="date"
      value={value ?? ""}
      onChange={(e) => handleChange(field.name, e.target.value)}
    />
  );
```

Replace with:
```js
case "date":
  return (
    <DatePickerField
      label={field.label}
      required={field.required}
      error={fieldErrors[field.name]}
      value={value ?? ""}
      onChange={(val) => handleChange(field.name, val ?? "")}
    />
  );
```

- [ ] **Step 6: Verify AtlasForm syntax**

Run: `node --check packages/ui/src/atlas-renderer/AtlasForm.jsx`
Expected: no output

- [ ] **Step 7: Verify date picker visually**

Run `pnpm dev`. Open any fleet form that contains a `type: "date"` field. Confirm:
- A calendar popover opens on click (not the native browser date picker)
- Selected date displays as "22 de mayo, 2026" format
- Clearing the date works
- The saved value sent to the API is still `YYYY-MM-DD` format

- [ ] **Step 8: Commit**

```bash
git add packages/ui/package.json packages/ui/src/components/DatePickerField.jsx packages/ui/src/atlas-renderer/AtlasForm.jsx
git commit -m "feat(ui): upgrade DatePickerField to date-fns locale and wire into AtlasForm"
```

---

## Task 3: CurrencyField Keystroke Rewrite + Wiring

**Files:**
- Modify: `packages/ui/src/components/FormFields.jsx` (lines 1024–1160: `CurrencyField`)
- Modify: `packages/ui/src/atlas-renderer/AtlasForm.jsx`

The existing `CurrencyField` formats on blur and shows raw number while focused. We rewrite it to always show formatted currency, storing cents internally. `onChange` still returns a decimal number (e.g. `52.50`), so callers are unaffected.

After the rewrite the 6 legacy finance/ledger screens that use `CurrencyField` directly will also get the new keystroke behavior — this is a visual improvement, but verify each one manually after this task.

- [ ] **Step 1: Replace CurrencyField implementation**

In `packages/ui/src/components/FormFields.jsx`, find the entire `CurrencyField` component from:
```js
export const CurrencyField = forwardRef(function CurrencyField(
```
to the closing `});` at line 1160.

Replace the entire component with:
```js
export const CurrencyField = forwardRef(function CurrencyField(
  {
    label,
    error,
    hint,
    required,
    id,
    icon,
    value,
    onChange,
    locale = "es-MX",
    currency = "MXN",
    symbol = "$",
    className,
    min,
    max,
    ...props
  },
  ref,
) {
  function toCents(decimalValue) {
    if (decimalValue == null || decimalValue === "") return 0;
    return Math.round(Number(decimalValue) * 100);
  }

  function toDecimal(cents) {
    return cents / 100;
  }

  function formatCents(cents) {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(toDecimal(cents));
  }

  const [cents, setCents] = useState(() => toCents(value));

  useEffect(() => {
    setCents(toCents(value));
  }, [value]);

  function handleKeyDown(e) {
    const allowed = ["Backspace", "Delete", "ArrowLeft", "ArrowRight", "Tab", "Enter"];
    if (allowed.includes(e.key)) return;
    if (!/^\d$/.test(e.key)) e.preventDefault();
  }

  function handleChange(e) {
    const digits = e.target.value.replace(/\D/g, "");
    const newCents = parseInt(digits, 10) || 0;
    const clamped =
      min != null || max != null
        ? Math.min(
            max != null ? toCents(max) : Infinity,
            Math.max(min != null ? toCents(min) : 0, newCents),
          )
        : newCents;
    setCents(clamped);
    onChange?.(toDecimal(clamped));
  }

  function handleFocus(e) {
    e.target.select();
  }

  const displayValue = formatCents(cents);

  return (
    <FieldWrapper label={label} labelFor={id} error={error} hint={hint} required={required}>
      <div className="relative flex items-center">
        {icon ? (
          <InputIcon icon={icon} />
        ) : (
          <span className="absolute left-3.5 text-sm text-muted-foreground/60 select-none pointer-events-none">
            {symbol}
          </span>
        )}
        <input
          ref={ref}
          id={id}
          type="text"
          inputMode="numeric"
          value={displayValue}
          onKeyDown={handleKeyDown}
          onChange={handleChange}
          onFocus={handleFocus}
          className={fieldCls(error, cn("pl-9", className))}
          placeholder={formatCents(0)}
          {...props}
        />
      </div>
    </FieldWrapper>
  );
});
```

- [ ] **Step 2: Verify FormFields syntax**

Run: `node --check packages/ui/src/components/FormFields.jsx`
Expected: no output

- [ ] **Step 3: Add `CurrencyField` import to AtlasForm**

In `packages/ui/src/atlas-renderer/AtlasForm.jsx`, find the existing import from `FormFields.jsx`:
```js
import {
  TextField,
  TextareaField,
  MarkdownField,
  SelectField,
  PhoneField,
  SwitchField,
  RelationSelectField,
} from "../components/FormFields.jsx";
```

Add `CurrencyField` to the list:
```js
import {
  TextField,
  TextareaField,
  MarkdownField,
  SelectField,
  PhoneField,
  SwitchField,
  RelationSelectField,
  CurrencyField,
} from "../components/FormFields.jsx";
```

- [ ] **Step 4: Add `currency` case to renderFieldControl**

In `AtlasForm.jsx`, find the `case "decimal":` block:
```js
case "decimal":
  return (
    <TextField
      {...sharedProps}
      type="number"
      step="0.0001"
      value={value ?? ""}
      onChange={(e) => handleChange(field.name, e.target.value)}
    />
  );
```

Add a new `case "currency":` block immediately after it:
```js
case "currency":
  return (
    <CurrencyField
      label={field.label}
      required={field.required}
      error={fieldErrors[field.name]}
      value={value ?? 0}
      onChange={(val) => handleChange(field.name, val)}
      currency={field.currency ?? "MXN"}
      locale={field.locale ?? "es-MX"}
    />
  );
```

- [ ] **Step 5: Verify AtlasForm syntax**

Run: `node --check packages/ui/src/atlas-renderer/AtlasForm.jsx`
Expected: no output

- [ ] **Step 6: Add a currency field to a fleet form and test**

Open any fleet form view (e.g. `modules/custom/custom.fleet/views/reports.service.form.js`). Add a test currency field in one section:
```js
{ name: 'cost', label: 'Costo del servicio', type: 'currency' }
```

Run `pnpm dev`. Open the service report form:
- Confirm the field shows `$0.00` initially
- Type digits — value formats live as `$X,XXX.XX`
- Submit the form — confirm the value sent to the API is a decimal number (e.g. `125.50`), not cents

- [ ] **Step 7: Verify the 6 legacy finance/ledger screens visually**

Open each of these screens in the running app and interact with any currency input to confirm no visual regression:
- Finance → Cuentas (AccountSheet)
- Finance → Documentos (DocumentSheet)
- Finance → Asientos (EntrySheet)
- Finance → Entrada guiada (GuidedEntrySheet)
- Ledger → Movimientos (MovementSheet)
- Ledger → Cuentas (AccountSheet)

- [ ] **Step 8: Remove the test field and commit**

Remove the temporary `cost` field you added in Step 6, then commit:
```bash
git add packages/ui/src/components/FormFields.jsx packages/ui/src/atlas-renderer/AtlasForm.jsx
git commit -m "feat(ui): rewrite CurrencyField with keystroke formatting and wire into AtlasForm"
```

---

## Task 4: Rich RelationSelectField with displayFields

**Files:**
- Modify: `packages/ui/src/atlas-renderer/renderer-adapters.js`
- Modify: `packages/ui/src/atlas-renderer/AtlasForm.jsx` (loadRelationOptions)
- Modify: `packages/ui/src/components/FormFields.jsx` (RelationSelectField)

The goal is a three-part change: (1) pass `displayFields` through the relation descriptor normalizer, (2) attach `meta` to each option in `loadRelationOptions` when `displayFields` is configured, (3) render a two-line badge + title + subtitle layout in `RelationSelectField` when `opt.meta` is present.

### Part A — normalizeRelationDescriptor

- [ ] **Step 1: Add displayFields to the normalized descriptor return value**

In `packages/ui/src/atlas-renderer/renderer-adapters.js`, find the `return { ... }` at the end of `normalizeRelationDescriptor` (line 171). The closing of the return object looks like:
```js
    create,
  };
}
```

Add `displayFields` before `create`:
```js
    displayFields: raw.displayFields != null && typeof raw.displayFields === 'object'
      ? raw.displayFields
      : null,
    create,
  };
}
```

- [ ] **Step 2: Verify renderer-adapters syntax**

Run: `node --check packages/ui/src/atlas-renderer/renderer-adapters.js`
Expected: no output

### Part B — loadRelationOptions adds meta

- [ ] **Step 3: Add meta to option objects in loadRelationOptions**

In `packages/ui/src/atlas-renderer/AtlasForm.jsx`, find the `options` mapping inside `loadRelationOptions` (around lines 138–144):
```js
const options = rows
  .map((row) => ({
    value: String(row[descriptor.valueField] ?? ""),
    label: resolveRelationLabel(row, descriptor),
    disabled: descriptor.disabledField ? row[descriptor.disabledField] === false : false,
  }))
  .filter((o) => o.value);
```

Replace with:
```js
const options = rows
  .map((row) => {
    const df = descriptor.displayFields;
    return {
      value: String(row[descriptor.valueField] ?? ""),
      label: resolveRelationLabel(row, descriptor),
      disabled: descriptor.disabledField ? row[descriptor.disabledField] === false : false,
      meta: df
        ? {
            badge: df.badge ? String(row[df.badge] ?? "") : null,
            title: df.title ? String(row[df.title] ?? "") : null,
            subtitle: df.subtitle
              ? Array.isArray(df.subtitle)
                ? df.subtitle.map((f) => row[f]).filter(Boolean).join(" • ")
                : String(row[df.subtitle] ?? "")
              : null,
          }
        : null,
    };
  })
  .filter((o) => o.value);
```

- [ ] **Step 4: Verify AtlasForm syntax**

Run: `node --check packages/ui/src/atlas-renderer/AtlasForm.jsx`
Expected: no output

### Part C — RelationSelectField renders meta

- [ ] **Step 5: Add rich option rendering to RelationSelectField**

In `packages/ui/src/components/FormFields.jsx`, find the option rendering inside `RelationSelectField`'s dropdown (the `filtered.map` block around lines 2385–2406):
```js
filtered.map((opt) => (
  <button
    key={opt.value}
    type="button"
    role="option"
    aria-selected={String(opt.value) === String(value)}
    onClick={() => handleSelect(opt)}
    disabled={opt.disabled}
    className={cn(
      "w-full text-left px-3 py-2 text-sm transition-colors duration-100 flex items-center gap-2",
      String(opt.value) === String(value)
        ? "bg-primary/10 text-primary font-medium"
        : "text-foreground hover:bg-muted/50",
      opt.disabled && "opacity-50 cursor-not-allowed pointer-events-none",
    )}
  >
    <span className="flex-1 truncate">{opt.label}</span>
    {String(opt.value) === String(value) && (
      <Check size={13} className="shrink-0 text-primary" />
    )}
  </button>
))
```

Replace with:
```js
filtered.map((opt) => {
  const isSelected = String(opt.value) === String(value);
  return (
    <button
      key={opt.value}
      type="button"
      role="option"
      aria-selected={isSelected}
      onClick={() => handleSelect(opt)}
      disabled={opt.disabled}
      className={cn(
        "w-full text-left px-3 transition-colors duration-100 flex items-center gap-2",
        opt.meta ? "py-2.5" : "py-2",
        isSelected
          ? "bg-primary/10 text-primary"
          : "text-foreground hover:bg-muted/50",
        opt.disabled && "opacity-50 cursor-not-allowed pointer-events-none",
      )}
    >
      {opt.meta ? (
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            {opt.meta.badge ? (
              <span className="inline-flex items-center rounded bg-[hsl(var(--primary))]/10 px-1.5 py-0.5 text-xs font-semibold text-[hsl(var(--primary))] shrink-0">
                {opt.meta.badge}
              </span>
            ) : null}
            {opt.meta.title ? (
              <span className={cn("text-sm font-medium truncate", isSelected ? "text-primary" : "text-foreground")}>
                {opt.meta.title}
              </span>
            ) : null}
          </div>
          {opt.meta.subtitle ? (
            <p className="text-xs text-[hsl(var(--muted-foreground))] truncate mt-0.5">
              {opt.meta.subtitle}
            </p>
          ) : null}
        </div>
      ) : (
        <span className="flex-1 truncate text-sm">{opt.label}</span>
      )}
      {isSelected && (
        <Check size={13} className="shrink-0 text-primary" />
      )}
    </button>
  );
})
```

- [ ] **Step 6: Verify FormFields syntax**

Run: `node --check packages/ui/src/components/FormFields.jsx`
Expected: no output

- [ ] **Step 7: Add displayFields to a fleet vehicle relation and test**

Open a fleet form view that has a `vehicle_id` relation field (e.g. `modules/custom/custom.fleet/views/reports.service.form.js`). Add `displayFields` to that field's relation config:
```js
{
  name: 'vehicle_id',
  label: 'Seleccionar vehículo',
  type: 'relation',
  relation: {
    apiPath: '/fleet/vehicles',
    valueField: 'id',
    labelField: 'display_name',
    displayFields: {
      badge:    'eco_number',
      title:    'vehicle_name',
      subtitle: ['plate', 'type_name', 'color'],
    },
    searchParam: 'search',
    clearable: true,
  },
}
```

Run `pnpm dev`. Open the service report form and click the vehicle selector:
- Confirm each option shows a colored badge (`eco_number`), a bold title (`vehicle_name`), and a muted subtitle (`plate • type_name • color`)
- Confirm the selected-value display in the trigger button still shows the flat `labelField` label
- Confirm relation fields WITHOUT `displayFields` elsewhere still render as flat labels

- [ ] **Step 8: Commit**

```bash
git add \
  packages/ui/src/atlas-renderer/renderer-adapters.js \
  packages/ui/src/atlas-renderer/AtlasForm.jsx \
  packages/ui/src/components/FormFields.jsx \
  modules/custom/custom.fleet/views/reports.service.form.js
git commit -m "feat(ui): add rich multi-line displayFields support to RelationSelectField"
```

---

## Self-Check Before Running

- Task 1: `import * as LucideIcons` added to both `AtlasForm` and `AtlasDetail` ✓
- Task 2: `date-fns` installed, `formatDisplay` uses `format(d, "d 'de' MMMM, yyyy", { locale: es })`, `case "date"` uses `DatePickerField` ✓
- Task 3: New `CurrencyField` stores cents, `onChange` returns decimal, `case "currency"` wired in `AtlasForm` ✓
- Task 4: `displayFields` passthrough in `normalizeRelationDescriptor`, `meta` built in `loadRelationOptions`, rich rendering in `RelationSelectField` option buttons ✓
- All 4 tasks are independently testable and committable ✓
- No regressions: flat-label relations, sections without icons, date fields in legacy forms all fall through to the existing code paths ✓
