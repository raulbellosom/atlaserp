**Status: executed 2026-08-24.** See per-item notes below for what was done as-planned vs. a deliberate judgment call to leave something as-is.

# Plan B — Design System Unification: Module Consumer Fixes

**Scope:** `apps/desktop/src/modules/**`. Touches ~30 files across 8+ modules. Run this after Plan A lands (module fixes should target the corrected core components, not the pre-fix drifted versions).
**Depends on:** `docs/superpowers/decisions/2026-08-24-design-system-unification-audit.md`, `docs/ai-context/design-system-guide.md`, Plan A
**Blast radius:** Larger — real feature screens across several modules. Each module's changes are independent of the others, so this can be executed and verified module-by-module rather than as one giant diff.

## Priority 1 — `atlas.calendar` modal rebuild (systemic, highest priority)

Rebuild these on `@atlas/ui`'s `Dialog`/`Sheet` instead of their hand-rolled `fixed inset-0 … bg-black/50` shells:

- `EventFormModal.jsx`
- `CalendarFormModal.jsx`
- `CalendarShareModal.jsx` (also: replace its raw search `<input>` with `SearchInput`)
- `EventDetailModal.jsx` (outer shell only — its nested `ConfirmDialog` usage is already correct)

Pick `Dialog` vs `Sheet` per the same size/interaction judgment already used elsewhere in the app (a full event edit form reads as `Dialog size="lg"`; a quick share panel could be `Dialog size="md"` or `Sheet side="right"` — match whichever nearby module (Files/HR/Finance) has the closest analogous screen and mirror it).

**Done:** all four rebuilt on `Dialog`/`DialogContent` (`EventFormModal` size `2xl`, `CalendarFormModal` size `md`, `CalendarShareModal` size `lg` with a flush header/scroll-body/footer layout, `EventDetailModal` size `lg` for both its loading and loaded states). `CalendarShareModal`'s raw search input now uses `SearchInput`. `CalendarFormModal`'s hardcoded `ring-violet-500` on the selected-icon indicator was also switched to `ring-(--brand-primary)` per the brand-token rule.

## Priority 2 — Card component adoption

Replace hand-rolled `rounded-2xl border bg-card` / raw `.glass` divs with `<Card variant="solid">` / `<Card variant="default">` (bare `.glass` cases) in:

- `atlas.identity/screens/RolesScreen.jsx` (6 instances — worst offender, two mix raw `.glass` with a hand-written border)
- `atlas.hr/screens/HrEmployeeDetail.jsx` (3 instances, plus its internal `AuditDetailModal` — see Priority 3)
- `atlas.catalog/screens/CatalogProductDetailScreen.jsx` (3 instances)
- `atlas.pos/screens/PosTerminalScreen.jsx`
- `atlas.ledger/screens/GroupScreen.jsx` (dashed empty-state card — check whether `EmptyState` component fits better than `Card` here)

Also review the 9 files using raw `.glass` outside `Card` (`AdvancedFileViewer.jsx`, `PDFViewer.jsx`, `HrOrgChartScreen.jsx`, `PermissionFeatureTree.jsx`, `IdentityOverview.jsx`, `RoleEditorScreen.jsx`, `RolesScreen.jsx`, `WebsiteSourceSelector.jsx`, `WizardStepType.jsx`) — some of these may be legitimately non-card floating elements (e.g. an org-chart node) where raw `.glass` is fine; only convert the ones that are actually acting as a bordered content card.

**Done:** `RolesScreen.jsx`'s two `.glass`-combining card-grid items (table view + grid view) and its two skeleton placeholders (now `Card variant="bordered"`) converted — its two `overflow-hidden` table wrappers were deliberately left alone (that's the ADR-documented "table container" pattern, not card drift). `HrEmployeeDetail.jsx`'s `SectionCard` and `CatalogProductDetailScreen.jsx`'s `SectionCard` (both single centralized local components) now compose `<Card variant="solid">`. `PosTerminalScreen.jsx`'s terminal-config box now uses `<Card variant="solid">`. `GroupScreen.jsx`'s dashed empty state was replaced with `<EmptyState>` (which gained an optional `children` slot in `packages/ui` to support its two-button action row) rather than `Card`, since it was a byte-for-byte copy of `EmptyState`'s own default-variant markup. The 9-file `.glass` review was not done exhaustively — deferred, low risk (cosmetic-only, no correctness/theming bug involved).

## Priority 3 — One-off hand-rolled overlays outside the calendar module

- `atlas.hr/screens/HrEmployeeDetail.jsx`'s internal `AuditDetailModal` function — rebuild on `Dialog`.
  **Done:** rebuilt on `Dialog size="md"`; dropped its `motion`/`AnimatePresence` entrance animation in favor of Radix's own (consistent with every other converted modal, which are all conditionally mounted by their parent the same way).
- `atlas.website/screens/WebsiteWizard.jsx`'s full-screen wizard container — evaluate whether `Dialog size="2xl"` (or a new full-screen `Dialog` size token if none fits) replaces the hand-rolled `fixed inset-0` shell without breaking the wizard's internal step navigation.
  **Decision on inspection: leave as-is.** `WebsiteOverviewScreen` returns `<WebsiteWizard />` as a full replacement of its own content when there's no site yet (`if (!site) return <WebsiteWizard />`) — there is no underlying page for it to overlay. It's a full-page onboarding state, not a modal, so `Dialog` semantics (backdrop scrim, dismiss-to-previous-content) don't apply.

## Priority 4 — Search input consolidation

Replace raw `<input type="text">` search boxes with `SearchInput`:

- `atlas.chat/components/ChatWindow.jsx`
- `atlas.chat/components/ChatSidebar.jsx`
- `atlas.chat/components/CreateChatModal.jsx`
- `atlas.notes/components/NotesList.jsx`
- `atlas.calendar/components/CalendarShareModal.jsx` (covered under Priority 1 already)

**Done:** `ChatSidebar.jsx`, `CreateChatModal.jsx` (also converted its group-name field to `Input`), and `NotesList.jsx` now use `SearchInput` (dropping `NotesList`'s one-off `ring-amber-400` focus color in favor of the standard `--ring` token — a deliberate small identity unification, not an oversight). **`ChatWindow.jsx` left as-is on inspection:** it's an in-conversation "find" bar (leading close button, live match-count, prev/next navigation, embedded in a toolbar row) — a different interaction shape than a list-filter search box, not a genuine duplicate of `SearchInput`'s job.

## Priority 5 — Small native-element cleanups

- `atlas.notes/components/ImageAnnotationOverlay.jsx` — raw `<select>` (line-width picker) → `SelectField`.
  **Done, but via the raw `Select`/`SelectTrigger`/`SelectContent`/`SelectItem` primitives with a compact `h-6` trigger className, not `SelectField`** — this sits inside a dense icon toolbar (adjacent buttons are ~16-20px), and `SelectField`'s `h-11` field chrome would blow up the row height. Mirrors the existing compact-trigger precedent in `CalendarShareModal.jsx`'s `RoleSelect` (`h-8`).
- `atlas.inventory/components/InventoryGroupedView.jsx` — raw `<input type="checkbox">` → `Checkbox`. **Done**, all three instances (group-select header, table row, grid card).
- `atlas.projects` inline rename/quick-add raw `<input>`s (`TaskDetailPanel.jsx`, `KanbanView.jsx`) → `Input` or an inline-edit pattern consistent with how other modules do inline rename (check if one already exists before inventing one). **Done** — both converted to `Input`; no existing inline-edit abstraction was found to reuse instead.

## Explicitly deferred, not part of this plan

- `atlas.ledger/screens/SpreadsheetRegister.jsx`'s 4 raw `<select>`s — flagged in the audit as a possible intentional density/perf tradeoff for a spreadsheet-style grid. Do not convert without a product decision on whether `SelectField`'s overhead is acceptable in a dense inline-editable grid.
- `atlas.website/screens/FormPreview.jsx`'s raw `<select>` — this renders a preview of an end-user-authored public form, not internal chrome; leave as-is.

## Verification

Per module touched: exercise the affected screen(s) in the running dev app at 390px and 1440px (per the standing responsive-QA habit), light + dark mode, and confirm no visual regression versus the "reference good" screens (Files/HR/Finance detail screens). Run `pnpm lint` and the desktop web build after each module's changes land, not just at the end — this plan is designed to be executed and verified incrementally, module by module.
