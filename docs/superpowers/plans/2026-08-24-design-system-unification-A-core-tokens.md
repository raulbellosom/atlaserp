# Plan A — Design System Unification: Core Library Fixes

**Scope:** `packages/ui/src/**` and `apps/desktop/src/styles.css` only. No module screens touched in this plan.
**Depends on:** `docs/superpowers/decisions/2026-08-24-design-system-unification-audit.md`, `docs/ai-context/design-system-guide.md`
**Blast radius:** Contained to the shared library. Every fix here is either invisible (internal dedupe) or a strict visual correction (drift → canonical). Rebuild the desktop web preview and eyeball each affected component in both themes after this plan.

## Tasks

1. **Brand-token fixes (white-label correctness).** Replace hardcoded `indigo-500`/`indigo-500/40`/`indigo-500/10` with `--brand-primary` (fill/bg cases) or `--ring` (focus ring cases) in:
   - `Checkbox.jsx` (checked bg)
   - `Switch.jsx` (checked bg)
   - `Select.jsx` (checked item bg, check glyph color)
   - `DropdownMenu.jsx` (checkbox/radio indicator fill + text color)
   - `Sheet.jsx` (close button focus ring — align with `Dialog.jsx`'s `focus-visible:ring-[hsl(var(--ring))]/40`)
   - `Input.jsx` (focus ring)

2. **Fix `ActivityDrawer.jsx`.** Rebuild it on `<Sheet side="right">` instead of the hand-rolled backdrop/Escape-handler/transition implementation. This removes the invalid `z-60`/`z-61` classes as a side effect (Sheet already uses a valid z-index). Verify `ActivityBellTrigger.jsx` still renders/opens it correctly.

3. **Extract shared drag-to-dismiss hook.** Pull the duplicated pointer-handler logic out of `Dialog.jsx` and `Sheet.jsx` into a single `useDragToDismiss` hook (co-located in `packages/ui/src/hooks/` or similar), and have both consume it.

4. **Consolidate the text-field style system.**
   - Make `FIELD_BASE`/`fieldCls` in `FormFields.jsx` the one canonical builder; export it (or export a `getFieldClassName()` helper) from the package barrel if `DatePickerField.jsx` needs it externally, or keep it a same-file import if `DatePickerField.jsx` moves inline into `FormFields.jsx`'s module — whichever keeps the file under the 1000-line soft limit (`FormFields.jsx` is already 2153 lines and flagged in `CLAUDE.md` as a known violator to decompose; do not make it larger — if extraction is needed, pull `FIELD_BASE`/`fieldCls`/`FieldWrapper` into a new `packages/ui/src/components/form-field-base.js` module that both `FormFields.jsx` and `DatePickerField.jsx` import from).
   - Have `DatePickerField.jsx` import the shared builder instead of inlining the string a second time.
   - Reconcile `Input.jsx` to the same height/ring convention as the shared builder (pick one: recommend standardizing on `h-10`/`sm:h-9` since that's `Input.jsx`'s existing responsive pattern, applied to the shared builder — confirm visually against existing HR/Finance/Files screens which are the "reference good" pattern per the 2026-05-13 ADR).
   - Update `SearchInput.jsx` to use `.glass-subtle` and the shared radius (`rounded-lg`) instead of its own solid `rounded-xl` styling.
   - Update `IconPickerField.jsx`'s trigger button to use the shared field base class instead of its ad hoc `h-9 rounded-md` variant, and swap its raw `<label>` for the shared `<Label>` component.

5. **Dedupe `MarkdownField.jsx`'s `FieldWrapper`.** Delete its private copy; import `FieldWrapper` from `FormFields.jsx` (or the new `form-field-base.js` if extracted in task 4).

6. **Card composition.** Refactor `StatCard.jsx` and `FileCard.jsx` to render `<Card variant="solid">` (or `bordered`, matching current visual intent) internally instead of duplicating its className string. Resolve the `rounded-2xl` (StatCard) vs `rounded-xl` (FileCard) mismatch in favor of `rounded-2xl` per the radius scale in the design guide.

7. **Barrel export gap.** Add `RelationSelectField` to the `packages/ui/src/index.js` field-exports block alongside its 18 siblings.

8. **Dead CSS cleanup.** Remove `.glass-card-responsive` and `.glow-primary`/`.glow-primary-sm` from `apps/desktop/src/styles.css` (confirmed zero usages) — or, if there's a near-term plan to use them, leave a one-line comment saying what will consume them. Default to removal unless the user says otherwise.

9. **`AdvancedFileViewer.jsx`.** ~~Replace its direct `@radix-ui/react-dialog` import/usage with `@atlas/ui`'s `Dialog` wrapper~~ — **decision on inspection: do not force this into `Dialog`.** It's a fullscreen gesture-driven viewer (pinch/zoom/pan, dynamic `zIndex` prop, `inset-safe` fullscreen layout, inline top-bar close button) that doesn't fit `DialogContent`'s opinionated `SIZE_CLASSES`/mobile-bottom-sheet/drag-handle contract — forcing it in would fight the abstraction and risks regressing gesture handling that needs live browser testing to verify. **Done instead:** fixed its overlay backdrop from `bg-black/50` to the canonical `bg-black/40` (matching `Dialog.jsx`/`Sheet.jsx`) — the one real, low-risk inconsistency. Leave the direct Radix usage in place; this file lives in `apps/desktop/src/modules` anyway, out of this plan's `packages/ui`-only scope.

## Verification

- `pnpm --filter @atlas/desktop build:web` (or the project's equivalent web build command) passes.
- `pnpm lint` passes.
- Manually exercise in the running dev app (light + dark mode): a Dialog, a Sheet, the notifications/activity bell drawer, a Checkbox, a Switch, a Select with a checked item, a DropdownMenu with a checked item, a StatCard, a FileCard, the file viewer modal (AdvancedFileViewer), and one screen using `DatePickerField`/`SearchInput`/`IconPickerField`.
- Confirm no file crossed the 1000-line soft limit / 1500 hard limit as a result of any extraction.
