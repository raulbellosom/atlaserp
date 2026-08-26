# Decision Log — Selector de fecha/hora universal y unificación del bottom-sheet mobile

Date: 2026-08-25
Feature: Selector de fecha/hora universal y unificación del bottom-sheet mobile
Spec: docs/superpowers/specs/2026-08-25-mobile-datetime-picker-bottomsheet-unification-design.md

---

## Decision

Live browser QA (manual visual verification at 390px/1440px, light/dark theme, and the `Dialog`-vs-`Sheet` bottom-sheet side-by-side comparison) was waived by explicit user decision. Verification was closed on `pnpm build` (full repo build, including the Tauri native compile) and a diff-scope check instead.

## What the spec said

Section 26 (Verification plan) required: manual DevTools-responsive checks at 390px and 1440px in both themes on the "Nuevo evento" modal, a visual comparison of a `Dialog` bottom-sheet against a `Sheet` bottom-sheet, and regression checks on `DatePickerField` and the `icon` prop — in addition to `pnpm build` and `pnpm lint`. The implementation plan's Task 4 and Task 11 encoded these as explicit manual checkpoints.

## What was implemented instead

All 9 code tasks (Tasks 1–9) were completed and committed exactly as planned. Verification actually performed:
- `pnpm --filter @atlas/desktop build:web` after each task (fast iteration check).
- `pnpm build` (full repo, including the Tauri release/NSIS/MSI build) — passed with no errors.
- `pnpm lint` — no-op in this repo (`echo lint-pending` for every workspace), so no findings either way.
- `git diff --stat` confirming zero changes to the 5 files that consume `DateField`/`DateTimeField` (`ProfileScreen.jsx`, `EventFormModal.jsx`, `InventoryItemForm.jsx`, `InventoryCustomFieldsForm.jsx`, `PosOrdersScreen.jsx`) — Acceptance Criterion 5, confirmed empty diff.

Live browser QA (Task 4, Task 11 Steps 1–2) was not performed.

## Reason

The Playwright browser tool's extension bridge was not connected in this session (`Error: Extension connection timeout. Make sure the "Playwright MCP Bridge" extension is installed.`), and a second dev server could not be started on port 5173 because one was already running (left untouched, per the project's standing rule against touching a dev server that may belong to the user's own terminal). Given the choice between reconnecting the extension, doing the check manually themselves, or accepting build+diff verification as sufficient, the user explicitly chose the third option.

This is a reasonable exception given: (a) the native `<input type="date">`/`<input type="datetime-local">` elements that caused the original overflow bug are structurally gone — replaced by a custom component built from the same `@atlas/ui` primitives already used elsewhere (`Popover`, `Sheet`, `fieldCls`) — so the specific failure mode reported by the user cannot recur by construction; (b) the bottom-sheet geometry unification reuses `Sheet.jsx`'s exact pre-existing values verbatim rather than inventing new ones; (c) the full build (including the Tauri bundle step, which does its own asset/type resolution) passed cleanly.

## Impact on spec

Spec update required: No.

This is a one-time verification-scope exception for this implementation pass, not a change to the feature's intended behavior or acceptance criteria. Section 26 of the spec remains the correct verification plan for any future change to these components — Tasks 4/11's manual browser checks should still be run (by the user or by Claude with a working Playwright connection) before this is treated as fully closed. If a visual issue is found later, it should be reported and fixed as a normal follow-up, not retroactively treated as a spec gap.
