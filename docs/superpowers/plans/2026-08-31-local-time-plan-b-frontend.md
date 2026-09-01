# Local-time correctness — Plan B: frontend sweep

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every `apps/desktop` "today / current month / local-day-of-a-Date" derivation that goes through `new Date().toISOString().slice(...)` / `.split(...)` with `toLocalIso()` / `toLocalMonth()` from `@atlas/core` (browser zone), and get `pnpm lint` fully green.

**Architecture:** `apps/desktop` already depends on `@atlas/core` (`workspace:*`). In the browser, the new helpers use `Intl.DateTimeFormat` with the runtime's own zone. A thin `apps/desktop/src/lib/localDate.js` re-exports them so module code has one import path. Spec: `docs/superpowers/specs/2026-08-31-platform-local-time-correctness-design.md`.

**Depends on:** Plan A (the `@atlas/core` helpers and the ESLint rule must exist).

**Tech Stack:** React + Vite, `@atlas/core`, Node built-in test runner, ESLint 9.

---

## The transform (applies everywhere below)

| Pattern | Meaning | Replacement |
|---|---|---|
| `new Date().toISOString().slice(0, 10)` | today (local) | `toLocalIso()` |
| `new Date().toISOString().slice(0, 7)` | current month (local) | `toLocalMonth()` |
| `X.toISOString().slice(0, 10)` where `X` is a `Date` | local day of that Date | `toLocalIso(X)` |
| `new Date(y).toISOString().slice(0, 10)` | local day of `y` | `toLocalIso(new Date(y))` |
| `new Date(Date.UTC(...)).toISOString().slice(0, 7)` | pure YYYY-MM arithmetic (no "now") | **keep**, add `// eslint-disable-next-line no-restricted-syntax -- deliberate UTC: YYYY-MM arithmetic` |
| bare `new Date().toISOString()` (no slice) | a real UTC instant/timestamp | **keep** (not flagged by the rule) |

Import in each touched file: `import { toLocalIso, toLocalMonth } from "../lib/localDate";` (adjust the relative path; from deep module folders it is `../../../lib/localDate`).

---

## File Structure

| File | Change | Task |
|---|---|---|
| `apps/desktop/src/lib/localDate.js` | create — re-export | 1 |
| `apps/desktop/src/modules/atlas.pfm/lib/format.js` | re-point `currentMonthKey` / `todayIso`; disable-comment `shiftMonth` | 1 |
| `apps/desktop/src/modules/atlas.calendar/stores/useCalendarStore.js` | 3 sites | 2 |
| `apps/desktop/src/modules/atlas.calendar/components/{AgendaView,DayView,WeekView,MonthView,EventFormModal}.jsx` | 1–2 sites each | 2 |
| `apps/desktop/src/modules/atlas.hr/screens/{HrScreen,HrEmployeeForm}.jsx` | filenames + input-value | 3 |
| `apps/desktop/src/modules/atlas.identity/screens/{UsersScreen,UserEditorScreen}.jsx` | filenames + input-value | 3 |
| `apps/desktop/src/modules/atlas.activity/ActivityFeedScreen.jsx` | filename | 3 |
| `apps/desktop/src/modules/atlas.contacts/screens/ContactsScreen.jsx` | 2 filenames | 3 |
| `apps/desktop/src/modules/atlas.ledger/screens/SpreadsheetRegister.jsx` | new-row default | 3 |
| `apps/desktop/src/modules/atlas.projects/components/TaskDetailPanel.jsx` | 1 site | 3 |
| `apps/desktop/src/app/ProfileScreen.jsx` | `toDateInputValue` | 3 |
| `apps/desktop/src/modules/atlas.growth/lib/growth-analytics.js` | `dateKey` | 3 |

---

## Task 1: `lib/localDate.js` + `atlas.pfm` re-point

**Files:**
- Create: `apps/desktop/src/lib/localDate.js`
- Modify: `apps/desktop/src/modules/atlas.pfm/lib/format.js`

- [ ] **Step 1: Create the re-export**

Create `apps/desktop/src/lib/localDate.js`:

```js
// Local (browser-zone) calendar helpers. `toISOString()` is UTC and must never
// be used to derive a local date/month — see @atlas/core/time.
export { toLocalIso, toLocalMonth, nowLocalParts } from "@atlas/core";
```

- [ ] **Step 2: Re-point `atlas.pfm/lib/format.js`**

In `apps/desktop/src/modules/atlas.pfm/lib/format.js`:

Add near the top imports:

```js
import { toLocalIso, toLocalMonth } from "../../../lib/localDate";
```

Replace the `localParts` helper + `currentMonthKey` + `todayIso` (the block added earlier) with:

```js
export function currentMonthKey() {
  return toLocalMonth();
}

export function todayIso() {
  return toLocalIso();
}
```

(delete the local `function localParts(...)` — it is no longer used.)

Leave `shiftMonth` as-is but add the disable comment on its return line:

```js
export function shiftMonth(month, delta) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  // eslint-disable-next-line no-restricted-syntax -- deliberate UTC: pure YYYY-MM arithmetic, no "now"
  return d.toISOString().slice(0, 7);
}
```

- [ ] **Step 3: Verify pfm helpers still behave**

Run: `node --test apps/desktop/src/modules/atlas.pfm/__tests__/format.test.js`
Expected: `# fail 0` (`currentMonthKey` / `todayIso` still return `YYYY-MM` / `YYYY-MM-DD` shapes).

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/lib/localDate.js apps/desktop/src/modules/atlas.pfm/lib/format.js
git commit -m "refactor(pfm-ui): pfm date helpers delegate to @atlas/core local-date"
```

---

## Task 2: `atlas.calendar`

**Files:**
- Modify: `apps/desktop/src/modules/atlas.calendar/stores/useCalendarStore.js`
- Modify: `apps/desktop/src/modules/atlas.calendar/components/AgendaView.jsx`
- Modify: `apps/desktop/src/modules/atlas.calendar/components/DayView.jsx`
- Modify: `apps/desktop/src/modules/atlas.calendar/components/WeekView.jsx`
- Modify: `apps/desktop/src/modules/atlas.calendar/components/MonthView.jsx`
- Modify: `apps/desktop/src/modules/atlas.calendar/components/EventFormModal.jsx`

- [ ] **Step 1: `useCalendarStore.js`**

Add: `import { toLocalIso } from "../../../lib/localDate";` at the top.

- Line ~5 (initial `selectedDate`): `return new Date().toISOString().slice(0, 10)` → `return toLocalIso()`.
- Lines ~57 and ~67 (`set({ selectedDate: d.toISOString().slice(0, 10), ... })`): → `set({ selectedDate: toLocalIso(d), ... })`.

- [ ] **Step 2: `AgendaView.jsx`**

Add: `import { toLocalIso } from "../../../lib/localDate";`.

- `addWeeks` (line ~44): `return d.toISOString().slice(0, 10);` → `return toLocalIso(d);`.
- Line ~65: `const base = selectedDate || new Date().toISOString().slice(0, 10);` → `const base = selectedDate || toLocalIso();`.

- [ ] **Step 3: `DayView.jsx`**

Add the import. Line ~29: `const dateStr = selectedDate || new Date().toISOString().slice(0, 10)` → `const dateStr = selectedDate || toLocalIso()`.

- [ ] **Step 4: `WeekView.jsx`**

Add the import. Line ~42: `getWeekDays(selectedDate || new Date().toISOString().slice(0, 10))` → `getWeekDays(selectedDate || toLocalIso())`.

- [ ] **Step 5: `MonthView.jsx`**

Add the import. Line ~314: `const ref = selectedDate || new Date().toISOString().slice(0, 10);` → `const ref = selectedDate || toLocalIso();`.

- [ ] **Step 6: `EventFormModal.jsx`**

Add the import.

- Line ~53: `const base = defaultDate || now.toISOString().slice(0, 10);` → `const base = defaultDate || toLocalIso(now);`.
- Line ~305: `... new Date().toISOString().slice(0, 10);` → `... toLocalIso();`.

- [ ] **Step 7: Verify**

Run: `npx eslint apps/desktop/src/modules/atlas.calendar`
Expected: no `no-restricted-syntax` findings.

Run (repo root): `cd apps/desktop && npx vite build` — expected `✓ built`. Return to repo root.

- [ ] **Step 8: Commit**

```bash
git add apps/desktop/src/modules/atlas.calendar
git commit -m "fix(calendar): today / selected-day defaults use the browser zone, not UTC"
```

---

## Task 3: remaining modules

**Files:** HR, identity, activity, contacts, ledger, projects, profile, growth (listed in File Structure).

Each edit adds `import { toLocalIso } from "<relative>/lib/localDate";` (path depth varies — screens under `modules/<m>/screens/` use `../../../lib/localDate`; `modules/<m>/lib/` uses `../../../lib/localDate`; `modules/<m>/components/` uses `../../../lib/localDate`; `src/app/` uses `../lib/localDate`).

- [ ] **Step 1: HR**

`apps/desktop/src/modules/atlas.hr/screens/HrScreen.jsx` lines ~116, ~130: `` `colaboradores-${new Date().toISOString().slice(0, 10)}.xlsx` `` / `.pdf` → `toLocalIso()`.

`apps/desktop/src/modules/atlas.hr/screens/HrEmployeeForm.jsx` lines ~121, ~124: `new Date(row.hireDate).toISOString().slice(0, 10)` / `terminationDate` → `toLocalIso(new Date(row.hireDate))` / `toLocalIso(new Date(row.terminationDate))`.

- [ ] **Step 2: Identity**

`apps/desktop/src/modules/atlas.identity/screens/UsersScreen.jsx` lines ~183, ~199: `usuarios-...xlsx`/`.pdf` → `toLocalIso()`.

`apps/desktop/src/modules/atlas.identity/screens/UserEditorScreen.jsx` line ~167: `new Date(user.birthDate).toISOString().slice(0, 10)` → `toLocalIso(new Date(user.birthDate))`.

- [ ] **Step 3: Activity + Contacts**

`apps/desktop/src/modules/atlas.activity/ActivityFeedScreen.jsx` line ~102: `actividad-...xlsx` → `toLocalIso()`.

`apps/desktop/src/modules/atlas.contacts/screens/ContactsScreen.jsx` lines ~237, ~252: `contactos-...xlsx`/`.pdf` → `toLocalIso()`.

- [ ] **Step 4: Ledger + Projects**

`apps/desktop/src/modules/atlas.ledger/screens/SpreadsheetRegister.jsx` line ~40: `fecha: new Date().toISOString().slice(0, 10),` → `fecha: toLocalIso(),`.

`apps/desktop/src/modules/atlas.projects/components/TaskDetailPanel.jsx` line ~758: `new Date(d).toISOString().slice(0, 10)` → `toLocalIso(new Date(d))`.

- [ ] **Step 5: Profile + Growth**

`apps/desktop/src/app/ProfileScreen.jsx` — `toDateInputValue` (line ~40): `return date.toISOString().slice(0, 10);` → `return toLocalIso(date);` (import `from "../lib/localDate"`).

`apps/desktop/src/modules/atlas.growth/lib/growth-analytics.js` — `dateKey` (line ~22): `return value.toISOString().slice(0, 10);` → `return toLocalIso(value);` (import `from "../../../lib/localDate"`).

- [ ] **Step 6: Static + lint + build**

Run: `npx eslint apps/desktop/src`
Expected: **no** `no-restricted-syntax` findings anywhere under `apps/desktop/src`.

Run: `cd apps/desktop && npx vite build` — expected `✓ built`. Return to repo root.

Run: `node --test apps/desktop/src/modules/atlas.growth/lib/__tests__/growth-analytics.test.js` (and any other tests over touched dirs)
Expected: `# fail 0`.

- [ ] **Step 7: Commit**

```bash
git add apps/desktop/src/modules/atlas.hr apps/desktop/src/modules/atlas.identity apps/desktop/src/modules/atlas.activity apps/desktop/src/modules/atlas.contacts apps/desktop/src/modules/atlas.ledger apps/desktop/src/modules/atlas.projects apps/desktop/src/app/ProfileScreen.jsx apps/desktop/src/modules/atlas.growth/lib/growth-analytics.js
git commit -m "fix(ui): derive local date/today from the browser zone across modules, not UTC"
```

---

## Task 4: full verification

- [ ] **Step 1: `pnpm lint` fully green**

Run (repo root): `pnpm lint`
Expected: **exit 0**, zero `no-restricted-syntax` errors. (Every remaining `toISOString().slice/split` is either replaced or carries an inline `eslint-disable` with a "deliberate UTC" reason.)

- [ ] **Step 2: builds + test suites**

Run: `cd apps/desktop && npx vite build` → `✓ built`. Return to root.

Run:
```bash
node --test $(find apps/desktop/src -name "*.test.js" -o -name "*.test.jsx" | tr '\n' ' ')
```
Expected: `# fail 0`.

Run:
```bash
node --test $(find apps/api/src/services/__tests__ apps/api/src/routes packages/core/src -name "*.test.js" | tr '\n' ' ')
```
Expected: `# fail 0`.

- [ ] **Step 3: Manual smoke (the original symptom)**

With `pnpm dev` running, at a local wall-clock time that is a different UTC day (i.e. after ~18:00 in Mexico), open `atlas.pfm` → a wallet detail. The month filter must default to the **current local month**, not next month. Also check `atlas.calendar` opens on today's local date.

- [ ] **Step 4: Commit any smoke fixups**

```bash
git add -A && git commit -m "test(local-time): plan B verification fixups"
```

---

## Self-Review

**Spec coverage:**
- Frontend consumes `@atlas/core` helpers via `lib/localDate.js` → Task 1.
- `atlas.pfm` re-pointed; `shiftMonth` UTC math kept with an inline disable → Task 1.
- `atlas.calendar` per-site audit (today/selected-day defaults fixed; instant serialization untouched — none of the flagged calendar lines serialize an event instant, they all default a local day) → Task 2.
- HR / identity / activity / contacts / ledger / projects / profile / growth → Task 3.
- Export-filename dates included → Task 3 (HR, identity, activity, contacts).
- Local-day-of-a-given-Date helpers (`toDateInputValue`, `dateKey`, `addWeeks`, HR/identity input values) → `toLocalIso(x)` form → Tasks 1–3.
- `pnpm lint` green → Task 4.

**Placeholder scan:** none. Line numbers are "~N" because edits above them shift them; each entry names the exact source text to match.

**Type consistency:**
- `toLocalIso(date?)` / `toLocalMonth(date?)` — zero-arg for "now", one-arg (`Date`) for "local day of X"; matches Plan A's exported signatures and the `lib/localDate.js` re-export.
- `currentMonthKey()` / `todayIso()` keep their names and return shapes (`YYYY-MM` / `YYYY-MM-DD`), so `atlas.pfm` call sites are untouched.
- `growth-analytics.js` `dateKey(value)` still takes a `Date` and returns `YYYY-MM-DD`.
