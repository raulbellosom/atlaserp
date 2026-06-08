# UI Screen Audit Checklist

Reference for auditing existing screens and building new ones. Every screen in `apps/desktop/src/modules/` must pass all 14 aspects before being considered compliant.

---

## The 14 Aspects

### 1. PageHeader — present on every screen

Every top-level screen must start with `<PageHeader>` from `@atlas/ui`. Required props:

```jsx
<PageHeader
  eyebrow="Atlas ModuleName"   // module display name, e.g. "Atlas HR"
  title="Nombre de pantalla"
  description="Descripcion breve de lo que hace esta pantalla."
  actions={<Button ...>Accion</Button>}   // omit if no actions
/>
```

**Exceptions** (intentional, documented):
- Full-bleed editors: `WebsitePageEditorScreen`, `WebsiteBlogPostEditorScreen`, `TemplatePreviewScreen`
- Full-viewport canvas: `CalendarScreen`, `HrOrgChartScreen`
- Sub-views rendered inside a parent screen: `HrEmployeeDetail`, `HrEmployeeForm`, `AccountScreen`, `CatalogProductDetailScreen`, `AccountSummary`
- Blueprint-driven screens using `AtlasCrudView` (the renderer provides its own header)
- Wizard steps: `WebsiteWizard`, `ImportWizard`

---

### 2. Responsive padding on every container

The outermost `<div>` of a screen (and every early-return branch: loading, error, not-found, empty) must use `p-4 md:p-6`, never bare `p-6` or `p-8`.

```jsx
// Correct
<div className="p-4 md:p-6 space-y-6">

// Wrong
<div className="p-6 ...">
<div className="p-8 ...">
```

This applies to loading skeleton returns, not-found returns, permission-denied returns — every branch.

---

### 3. No native `<select>`

```jsx
// Wrong
<select value={x} onChange={...}>
  <option value="a">A</option>
</select>

// Correct — with label
<SelectField label="Campo" value={x} onValueChange={setX} options={[{ value: 'a', label: 'A' }]} />

// Correct — toolbar/inline context without label
<Select value={x} onValueChange={setX}>
  <SelectTrigger><SelectValue /></SelectTrigger>
  <SelectContent>
    <SelectItem value="a">A</SelectItem>
  </SelectContent>
</Select>
```

Use `CreatableComboboxField` when the user needs to create new options inline.

---

### 4. No native `<input type="text">` in form contexts

```jsx
// Wrong
<input type="text" value={x} onChange={...} />

// Correct
<TextField label="Campo" value={x} onChange={(e) => setX(e.target.value)} />

// Acceptable — raw Input primitive in non-form inline edit contexts (e.g. inline table cell editing)
<Input value={x} onChange={...} className="h-7 text-xs" />
```

---

### 5. No native `<textarea>`

```jsx
// Wrong
<textarea value={x} onChange={...} />

// Correct
<TextareaField label="Notas" value={x} onChange={(e) => setX(e.target.value)} />
// or for rich text
<MarkdownField label="Descripcion" value={x} onChange={setX} />
```

---

### 6. No native `<input type="checkbox">`

```jsx
// Wrong
<input type="checkbox" checked={x} onChange={(e) => setX(e.target.checked)} />

// Correct — inside a clickable card or div
<div className="flex items-center gap-2 cursor-pointer" onClick={() => setX((v) => !v)}>
  <Checkbox
    checked={x}
    onCheckedChange={(v) => setX(Boolean(v))}
    onClick={(e) => e.stopPropagation()}
  />
  <span className="text-sm">Etiqueta</span>
</div>
```

Note: `Checkbox` renders as a `<button>`, so `<label htmlFor>` doesn't work reliably. Always use the `div onClick` + `e.stopPropagation()` pattern.

---

### 7. No native `<input type="date">`

```jsx
// Wrong
<input type="date" value={x} onChange={...} />

// Correct
<DatePickerField label="Fecha" value={x} onChange={setX} />
```

---

### 8. No `Label + Input` pairs

```jsx
// Wrong
<div className="space-y-1.5">
  <Label htmlFor="field-id">Campo</Label>
  <Input id="field-id" value={x} onChange={...} />
</div>

// Correct
<TextField label="Campo" value={x} onChange={(e) => setX(e.target.value)} />
```

---

### 9. No `Label + Select` pairs

```jsx
// Wrong
<div className="space-y-1.5">
  <Label>Estado</Label>
  <Select value={x} onValueChange={setX}>...</Select>
</div>

// Correct
<SelectField label="Estado" value={x} onValueChange={setX} options={[...]} />
```

---

### 10. No `window.confirm` / `window.alert` / `window.prompt`

```jsx
// Wrong
if (window.confirm('¿Eliminar?')) deleteItem()

// Correct
const [confirmItem, setConfirmItem] = useState(null)

<Button onClick={() => setConfirmItem(item)}>Eliminar</Button>

<ConfirmDialog
  open={Boolean(confirmItem)}
  onOpenChange={(open) => { if (!open) setConfirmItem(null) }}
  title="Eliminar elemento"
  description={`Se eliminará "${confirmItem?.name}". Esta acción no se puede deshacer.`}
  confirmLabel="Eliminar"
  loading={deleteMutation.isPending}
  onConfirm={() => deleteMutation.mutate(confirmItem.id)}
/>
```

---

### 11. `EmptyState` for empty lists

Never render plain text when a list is empty.

```jsx
// Wrong
{items.length === 0 && <p className="text-sm text-muted-foreground">Sin elementos.</p>}

// Correct
{items.length === 0 && (
  <EmptyState
    icon={SomeIcon}
    title="Sin elementos"
    description="Descripcion de por que esta vacio y que puede hacer el usuario."
    actions={<Button onClick={...}>Crear primero</Button>}
  />
)}
```

---

### 12. `ErrorState` for query errors

Never render plain text for an error state.

```jsx
// Wrong
{query.isError && <p>Error al cargar datos.</p>}

// Correct
{query.isError && (
  <ErrorState
    message="No se pudieron cargar los elementos."
    onRetry={() => query.refetch()}
  />
)}
```

---

### 13. No hand-rolled data tables

Use `AtlasTable` (or `AtlasCrudView` for blueprint-driven screens) for list screens.

```jsx
// Wrong
<table>
  <thead>...</thead>
  <tbody>{items.map(...)}</tbody>
</table>

// Correct
<AtlasTable columns={columns} data={items} ... />
```

**Exceptions:**
- `SpreadsheetRegister` — spreadsheet with inline cell editing via `data-row/data-col` keyboard navigation
- `VariantMatrix` — compact editable grid for SKU/stock combinations (inline Input per cell)
- Preview tables in `ImportWizard` — read-only data preview in a wizard step
- `AccountSummary` — compact financial summary table inside AccountScreen

---

### 14. No hand-rolled modal/dialog overlays

Never use `fixed inset-0 z-50` with a backdrop div as a modal.

```jsx
// Wrong
<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
  <div className="bg-card rounded-2xl p-5" onClick={(e) => e.stopPropagation()}>
    ...
  </div>
</div>

// Correct — for general content
<Dialog open={open} onOpenChange={onOpenChange}>
  <DialogContent>
    <DialogHeader><DialogTitle>Titulo</DialogTitle></DialogHeader>
    ...
  </DialogContent>
</Dialog>

// Correct — for destructive confirmations
<ConfirmDialog open={...} onOpenChange={...} title="..." description="..." onConfirm={...} />

// Correct — for large panels
<Sheet open={open} onOpenChange={onOpenChange}>
  <SheetContent>...</SheetContent>
</Sheet>
```

**Known tech debt** (not yet converted — tracked for future refactor):
- `CalendarFormModal`, `EventFormModal`, `EventDetailModal`, `CalendarShareModal` — calendar-specific overlays with complex motion animations; intentional deferral
- `AuditDetailModal` in `HrEmployeeDetail` — motion-animated diff viewer inside the 1704-line known violator; to be addressed when the file is decomposed

---

## Running the audit

```bash
# 1. window.confirm/alert/prompt
grep -rn "window\.confirm\|window\.alert\|window\.prompt" apps/desktop/src/modules/

# 2. Native <select>
grep -rn "<select\b" apps/desktop/src/modules/ | grep -v SpreadsheetRegister

# 3. Native <input type="checkbox">
grep -rn "<input type=\"checkbox\"" apps/desktop/src/modules/ | grep -v SpreadsheetRegister

# 4. Native <input type="date">
grep -rn "<input type=\"date\"" apps/desktop/src/modules/

# 5. Native <textarea>
grep -rn "<textarea\b" apps/desktop/src/modules/ | grep -v SpreadsheetRegister

# 6. Native <input type="text"> in form contexts
grep -rn "<input type=\"text\"" apps/desktop/src/modules/ | grep -v SpreadsheetRegister

# 7. Label+Input or Label+Select pairs
grep -rn "<Label\b" apps/desktop/src/modules/ | grep -v "htmlFor.*Switch\|Switch.*Label"

# 8. Non-responsive padding
grep -rn '"p-6\|"p-8' apps/desktop/src/modules/ | grep -v "px-6\|py-6\|pt-6\|pb-6\|pl-6\|pr-6\|gap-6\|space.*6\|col-span\|rounded\|text-\|w-\|h-\|min-\|max-\|inset\|top-\|bottom-\|left-\|right-"

# 9. Hand-rolled tables
grep -rn "<table\b" apps/desktop/src/modules/ | grep -v "SpreadsheetRegister\|ImportWizard\|VariantMatrix\|AccountSummary"

# 10. Hand-rolled modals
grep -rn "fixed inset-0" apps/desktop/src/modules/ | grep -v "CalendarFormModal\|EventFormModal\|EventDetailModal\|CalendarShareModal\|HrEmployeeDetail\|FilesScreen\|AdvancedFileViewer"
```

Zero results expected for all commands (after accounting for known exceptions).

---

## Audit status

Last full audit: 2026-06-07

| Module | Status |
|---|---|
| atlas.core | Compliant |
| atlas.identity | Compliant |
| atlas.contacts | Compliant |
| atlas.files | Compliant |
| atlas.company | Compliant |
| atlas.hr | Compliant (HrEmployeeDetail AuditDetailModal deferred) |
| atlas.activity | Compliant |
| atlas.catalog | Compliant |
| atlas.ledger | Compliant |
| atlas.fleet | Compliant |
| atlas.calendar | Compliant (4 calendar modals deferred) |
| atlas.website | Compliant |
| atlas.notifications | Compliant |
| platform-settings | Compliant |
