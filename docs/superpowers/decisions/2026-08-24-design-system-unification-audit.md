# Design Decision: Design System Unification Audit (Glassmorphism / Spatial UI)

**Date:** 2026-08-24
**Status:** Approved
**Type:** Architecture Decision Record (ADR)
**Scope:** `packages/ui/src/**`, `apps/desktop/src/**` — audit + consolidation, no API/schema/contract changes

---

## Why

The user identified that Atlas's intended visual identity — glassmorphism / spatial UI — exists as tokens and as a handful of correctly-built components, but has never been unified: components were added incrementally over many phases (Files, Finance, HR, POS, Notes, Chat, Ledger, Fleet, Projects, Calendar, Website, Identity, Catalog, Inventory) and drifted from each other and from `@atlas/ui`. This ADR documents a full audit (two independent research passes: one over `packages/ui/src/components/*`, one over every module in `apps/desktop/src/modules/*`) and classifies findings by severity. `docs/ai-context/design-system-guide.md` is the resulting canonical reference; this document is the evidence and fix backlog behind it.

Per the precedent set in `docs/superpowers/decisions/2026-05-13-ame3-renderer-ui-reuse-and-glassic-design.md`, **swapping hand-rolled UI for existing `@atlas/ui` components, and fixing drift within `@atlas/ui` itself, does not change any API/blueprint contract** and therefore does not require a new SDD spec — it is classified the same way Phase A/B of that ADR were ("component wiring" / "UX polish", task follow-up).

---

## Audit findings

### A. `packages/ui` core library (source of truth problems)

1. **Two competing overlay stacks.** `Dialog`/`Sheet`/`Popover`/`DropdownMenu`/`Tooltip` correctly build on Radix + `.glass-strong`/`.glass`. `ActivityDrawer.jsx` is a fully hand-rolled slide-in panel (manual backdrop, manual Escape handler, manual transition classes) that is flat (`bg-[hsl(var(--background))]`, no glass) and duplicates what `<Sheet side="right">` already does. It also uses invalid `z-60`/`z-61` classes (Tailwind's default scale stops at 50; these generate no CSS — an actual, if masked, stacking bug).
2. **Duplicated drag-to-dismiss logic.** `Dialog.jsx` and `Sheet.jsx` each independently implement the same pointer-based drag-to-dismiss handlers.
3. **Hardcoded brand color instead of the brand token.** `Checkbox.jsx`, `Switch.jsx`, `Select.jsx` (checked item + check glyph), `DropdownMenu.jsx` (checkbox/radio indicators), and `Sheet.jsx`'s close-button focus ring all hardcode `indigo-500` instead of `--brand-primary` / `--ring`. This is a concrete white-label theming bug: a tenant that overrides `--brand-primary` gets branded buttons but unbranded checkboxes/switches/selects.
4. **Card is not actually reused by its own siblings.** `StatCard.jsx` and `FileCard.jsx` each hand-roll flat card chrome (`rounded-2xl border bg-card` / `rounded-xl border bg-card` respectively — note the radius mismatch, `2xl` vs `xl`) instead of composing `<Card variant="solid">`. Any future change to `Card`'s solid variant silently stops applying to stat tiles and file tiles.
5. **At least five parallel "text input" style definitions** that should be one: `Input.jsx` (`h-10`/`h-9`, `indigo-500` ring), `FormFields.jsx`'s private `FIELD_BASE`/`fieldCls` (`h-11`, `primary/20` ring, adds `bg-card` on top of `glass-subtle`), `DatePickerField.jsx` (copies the `FIELD_BASE` string inline instead of importing it), `SearchInput.jsx` (`h-10`, `rounded-xl`, fully solid, no glass), and the raw `<input>` inside `UserSearchModal.jsx` (`rounded-md`, solid). `IconPickerField.jsx`'s trigger is a sixth ad hoc variant.
6. **Exact duplicated component code.** `MarkdownField.jsx` defines a private `FieldWrapper` that is character-for-character identical to the exported `FieldWrapper` in `FormFields.jsx` — should import instead of redefine.
7. **Barrel export gap.** `RelationSelectField` is exported from `FormFields.jsx` but not re-exported from `packages/ui/src/index.js` (its 18 sibling `*Field` exports are). It's only reachable via a direct file import today (used by `AtlasForm.jsx`).
8. **Dead CSS utilities.** `.glass-card-responsive` and `.glow-primary`/`.glow-primary-sm` are defined in `styles.css` but have zero usages anywhere in the app.
9. **Two coexisting Tailwind color syntaxes** across the ~70-file library: newer components use the Tailwind v4 semantic utilities (`bg-card`, `text-foreground`, `border-border`); most older components use the pre-v4-migration bracket form (`bg-[hsl(var(--card))]`). Both resolve identically today; this is a style-convergence item, not a bug.
10. **`AdvancedFileViewer.jsx`** (in `atlas.files`, but library-adjacent) imports `@radix-ui/react-dialog` directly instead of `@atlas/ui`'s `Dialog` wrapper, reimplementing overlay classes `Dialog.jsx` already encapsulates.

### B. Module-level consumer drift

1. **`atlas.calendar` is the one module with systemic hand-rolled modals.** `EventFormModal.jsx`, `CalendarFormModal.jsx`, and `CalendarShareModal.jsx` all build their own `fixed inset-0 … bg-black/50` shell instead of `Dialog`/`Sheet`, and import zero `@atlas/ui` overlay primitives. `EventDetailModal.jsx` uses `ConfirmDialog` for a nested confirm but its own outer shell is still hand-rolled. This is the highest-priority module-level fix — every other module's `*Modal.jsx`/`*Dialog.jsx`/`*Sheet.jsx` files (POS, Growth, Files, Notes, Projects, Contacts, Fleet — ~25 files sampled) correctly wrap the shared primitives.
2. **`HrEmployeeDetail.jsx`'s internal `AuditDetailModal`** and **`WebsiteWizard.jsx`'s** full-screen wizard container are both one-off hand-rolled overlay shells outside the calendar module.
3. **Card non-adoption is widespread but not universal**: 55 occurrences of hand-rolled `rounded-2xl border bg-card`/`.glass` divs across 30 files in 12+ modules, versus 33 files that correctly import `Card`. Worst offender: `atlas.identity/RolesScreen.jsx` (6 inline instances, two combining raw `.glass` with a hand-written border div — using the token without the component). Also notable in `atlas.hr/HrEmployeeDetail.jsx`, `atlas.catalog`, `atlas.pos`.
4. **Search input reinvented independently in three modules**: `atlas.chat` (`ChatWindow.jsx`, `ChatSidebar.jsx`, `CreateChatModal.jsx`), `atlas.notes` (`NotesList.jsx`), `atlas.calendar` (`CalendarShareModal.jsx`) — none use the existing `SearchInput` component.
5. **Scattered small native-element violations**: `atlas.ledger/SpreadsheetRegister.jsx` (4 raw `<select>` in a spreadsheet-style grid — likely an intentional density tradeoff, flagged for a decision rather than an automatic fix), `atlas.notes/ImageAnnotationOverlay.jsx` (raw `<select>` for line width), `atlas.inventory/InventoryGroupedView.jsx` (raw `<input type="checkbox">` instead of `Checkbox`), `atlas.projects` (inline rename/quick-add raw `<input>`s).
6. **Clean areas — no action needed**: `window.confirm/alert/prompt` usage is zero across the entire app (fully compliant already). Toasts are 100% centralized on Sonner (567 call sites, 106 files, no competing snackbar/banner implementation found). No filename collisions between module-local components and `@atlas/ui` component names.

---

## External validation

Cross-checked against the `ui-ux-pro-max` design-system database (glassmorphism + dimensional-layering style entries): the existing token values are already within the recommended ranges — `--glass-blur: 20px` sits inside the recommended 10–20px backdrop-blur band, and the three-tier glass system (`subtle`/`glass`/`strong`) maps cleanly onto the general "translucent white 15–30% opacity + subtle 1px border + elevation" pattern recommended for SaaS/financial dashboard glassmorphism. **The tokens are not the problem — inconsistent application is.** No token value changes are recommended by this audit; the fix is consolidation and reuse discipline, not retuning.

---

## Classification

| Change | Classification | Reason |
|---|---|---|
| Section A (packages/ui core fixes) | Task follow-up, no new SDD spec | Internal consolidation of existing components; no exported prop/contract removed, only drift fixed and duplication removed. See plan A. |
| Section B (module consumer migrations) | Task follow-up, no new SDD spec | Swapping hand-rolled markup for existing `@atlas/ui` components; no behavior contract change from the module's perspective. See plan B. |
| `SpreadsheetRegister.jsx` native `<select>`s | Deferred / needs a product decision | May be an intentional density/perf tradeoff for a spreadsheet-style grid; do not auto-convert without checking with whoever owns that screen's UX. |

## Plans

- `docs/superpowers/plans/2026-08-24-design-system-unification-A-core-tokens.md` — `packages/ui` fixes (contained, low blast radius)
- `docs/superpowers/plans/2026-08-24-design-system-unification-B-module-consolidation.md` — module-by-module consumer fixes (large blast radius, ~30 files across 8+ modules)
