---
applyTo: "**/*.{jsx,tsx,js,ts,css}"
---

# Responsive / Mobile-First Rules

These rules apply to every file in the Atlas ERP desktop app and shared packages.
Violations must be fixed before any PR is merged.

---

## Viewport height — `dvh` ALWAYS

- **NEVER use `vh`, `h-screen`, `min-h-screen`, `100vh`, `h-[100vh]`, `min-h-[100vh]`, or `lvh`.**
- Always use `dvh` (dynamic viewport height) which respects the browser's dynamic toolbar on iOS/Android:
  - `h-dvh`, `min-h-dvh`, `max-h-dvh`
  - Arbitrary: `max-h-[85dvh]`
- `svh` (smallest stable vh) is allowed only when the component must not resize when the browser toolbar hides.
- Modals and bottom sheets: `max-h-[85dvh]` on mobile, `max-h-[90dvh]` on `md+`.

---

## Safe-area insets (notch devices)

- Use the utility classes defined in `styles.css`:
  - `.safe-top` — top padding for iOS notch (use on Topbar or fullscreen covers).
  - `.safe-bottom` — bottom padding for iPhone home indicator (use on bottom toolbars, Sheet footers, Dialog footers).
  - `.safe-left` / `.safe-right` — side insets (landscape iPhone).
  - `.h-topbar` — topbar height = `3.5rem + env(safe-area-inset-top)`.
  - `.pt-topbar` — body top padding to clear the topbar.
- Every bottom-anchored UI element (sheets, FABs, toolbars) must use `.safe-bottom`.
- The `<meta viewport>` must include `viewport-fit=cover` for these to take effect.

---

## Inputs — prevent iOS auto-zoom on focus

- Input elements must be **at least `text-base` (16px) on mobile**.
- Pattern: `text-base sm:text-sm` — 16px on mobile, 14px on `sm+` (640px+).
- This applies to: `<Input>`, `<Textarea>`, `<Select>` trigger, `<SearchInput>`, and any raw `<input>` / `<textarea>` in module forms.
- Touch height: `h-10 sm:h-9` — 40px on mobile (≥ 44px is ideal; 40px is acceptable for form fields), 36px on desktop.
- Minimum touch target for **buttons and icon buttons**: `min-h-11 min-w-11` (44×44px). Use the `.touch-target` utility.

---

## Mobile-first layout

- Always code mobile layout first, then override with `sm:` / `md:` / `lg:` / `xl:`.
- Grid columns: `grid-cols-1` default, then `sm:grid-cols-2`, `lg:grid-cols-3`, etc.
- **`min-w-0`** on every `flex` child that contains text — without it, text won't truncate inside flexbox.
- Text overflow: use `truncate` (single-line) or `break-words` (multi-line) on cards, list rows, and table cells with variable-length user content.
- **Never use `whitespace-nowrap` on card titles or names** — use `truncate` instead.

---

## Overflow-X

- The `<body>` and `<html>` have `overflow-x: hidden` globally (defined in `styles.css`).
- Every `<table>` or wide element must be wrapped in a `div` with `overflow-x-auto` — the `Table` component from `@atlas/ui` already does this.
- Do **not** rely on the `<body>` overflow to handle in-component scrolling — each wide section must manage its own horizontal scroll.
- Never use fixed pixel widths on table columns totalling more than the smallest supported viewport (320px) without an overflow-x wrapper.

---

## Tables

- Import `Table` from `@atlas/ui` — it already wraps in `overflow-auto`.
- Column widths: use relative (`%`, `ch`, `flex`, `min-w-*`) instead of fixed `w-[200px]` etc.
- On mobile (`< md`), prefer `<ResponsiveTable>` (stacked card mode) when the table has more than 4 columns.

---

## Modals and Sheets

- Use `Dialog` / `Sheet` from `@atlas/ui` — they automatically become bottom sheets on mobile.
- Bottom sheets support swipe-to-dismiss via the drag handle.
- Always use `<DialogFooter>` / `<SheetFooter>` — they include `.safe-bottom` automatically.
- Never use `window.confirm`, `window.alert`, or `window.prompt` — always use `<ConfirmDialog>` from `@atlas/ui`.

---

## Navigation and Topbar

- The Topbar height uses `.h-topbar` (accounts for iOS notch). Content below uses `.pt-topbar`.
- Mobile hamburger is always `lg:hidden` and wired to `onMobileMenuToggle`.
- `ModuleSidebar` handles the mobile overlay drawer.
- Auto-close the drawer on route change (already done in `AtlasApp`).

---

## Glass / Glassic identity

- The glassic aesthetic is the **primary visual identity** — do not remove glass utilities.
- Use `.glass`, `.glass-strong`, `.glass-tinted`, `.glass-subtle`, `.glass-card-responsive` from `styles.css`.
- `--glass-blur` is reduced to `12px` on screens `< 768px` (defined in the global media query) for performance.
- Never hardcode `backdrop-filter` or `box-shadow` for glass effects — always use the token variables.
- Colors: always use semantic tokens (`bg-background`, `text-foreground`, `border-border`, `hsl(var(--...))`) — no raw hex or Tailwind palette values.

---

## Z-index scale

- Use only: `z-0`, `z-10`, `z-20`, `z-30`, `z-40`, `z-50`.
- Never use arbitrary `z-[100]`, `z-[9999]`, or inline `zIndex: 9999`.

---

## Module list views — standard pattern

Every module with a list of records must follow this pattern:

1. Three view modes: **Tabla** (`table`), **Cards** (`cards`), **Cuadrícula** (`grid`).
2. View preference persisted in `localStorage` per module key.
3. **Filtros** button on mobile that opens a `MobileFiltersSheet`.
4. Search bar full-width on mobile.
5. Server-side pagination via `{ page, pageSize, total }` from the API.
6. Use `ListLayout` from `@atlas/ui` as the container.

---

## Checklist before shipping a responsive change

- [ ] No `h-screen` / `min-h-screen` / `100vh` in the changed files (run grep).
- [ ] Input font-size ≥ 16px on mobile (no `text-xs` / `text-sm` on `<input>`/`<textarea>` without `sm:` prefix).
- [ ] No `overflow-x` bleeding — `document.documentElement.scrollWidth === document.documentElement.clientWidth` at 320px and 375px.
- [ ] Touch targets ≥ 44px for interactive elements on mobile.
- [ ] Glassic tokens used (no raw hex, no inline styles for glass effects).
- [ ] Bottom sheets / modals have drag handle + swipe-to-dismiss.
- [ ] Footer/toolbar uses `.safe-bottom` if positioned at bottom of screen.
