# Platform-wide local-time correctness for "today / current month"

Date: 2026-08-31
Status: Approved (design)
Area: whole platform — `packages/core`, `apps/api`, `apps/worker`, `apps/desktop`

## Problem

"Today" and "current month" are computed with `new Date().toISOString().slice(0, 10 | 7)`
in ~28 places. `toISOString()` is **always UTC**. In Mexico City (UTC-6), after
~18:00 local the UTC day/month has already rolled over, so the platform believes
it is the next day / next month. Observed: at 20:03 on 2026-08-31 the `atlas.pfm`
wallet detail defaulted its month filter to `sep 2026`.

Two timezone configs exist and neither fixes this:
- `ATLAS_TIME_ZONE` / `TZ` env → `getConfiguredTimeZone()` in `packages/core/src/time.js` — used only for log timestamps and `/health`.
- `instance_time_zone` in `InstanceConfig` (default `America/Mexico_City`, editable in Ajustes) — used only by the settings form and calendar setup.

`toISOString()` ignores both anyway.

## Decisions (from brainstorming)

- **Source of truth for "now/today":** the **browser's** timezone on the frontend; the **`ATLAS_TIME_ZONE` / `TZ` env** (via `getConfiguredTimeZone()`) on the backend. No new config plumbing.
- **Scope:** fix every "now/today" usage, including cosmetic export-filename dates.
- **`atlas.calendar` is in scope.** Per-site audit: fix "now/today" defaults; leave serialization of a specific event's date-time to/from the API as an ISO instant.
- **Regression guard:** a single ESLint `no-restricted-syntax` rule (ESLint is bootstrapped for this — none exists today).

## Design

### 1. Isomorphic helpers in `@atlas/core` (`packages/core/src/time.js`)

Add three functions with one implementation via `Intl.DateTimeFormat`:

```js
// Node -> configured zone (ATLAS_TIME_ZONE || TZ || 'UTC'); browser -> the
// runtime's own zone (timeZone: undefined).
function runtimeTimeZone() {
  const isNode =
    typeof process !== 'undefined' && !!process.versions && !!process.versions.node
  return isNode ? getConfiguredTimeZone() : undefined
}

export function nowLocalParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: runtimeTimeZone(),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]))
  return { year: map.year, month: map.month, day: map.day }
}

export function todayLocalIso(date = new Date()) {
  const { year, month, day } = nowLocalParts(date)
  return `${year}-${month}-${day}`
}

export function currentMonthLocal(date = new Date()) {
  const { year, month } = nowLocalParts(date)
  return `${year}-${month}`
}
```

Notes:
- `en-CA` renders `YYYY-MM-DD` with `Intl`, so `formatToParts` is stable across locales.
- `getConfiguredTimeZone()` already exists; with the user's `.env` it returns `America/Mexico_City`.
- Fallback stays `'UTC'` when neither env var is set — documented as "set `ATLAS_TIME_ZONE`".
- Browser-safe: `getConfiguredTimeZone()` is never called in the browser branch, so the `process.env` read never runs there.

### 2. ESLint guardrail (minimal bootstrap)

There is no ESLint in the repo (`pnpm lint` is `echo lint-pending` everywhere). Add just enough for one rule:

- Root devDependency: `eslint` (v9).
- `eslint.config.js` at the repo root (flat config):
  - `languageOptions`: `ecmaVersion: 'latest'`, `sourceType: 'module'`, `parserOptions.ecmaFeatures.jsx: true` (espree default parser handles JSX with this flag — no React plugin needed).
  - `ignores`: `node_modules/**`, `**/dist/**`, `apps/desktop/dist/**`, `prisma/migrations/**`, `**/*.min.js`, `docs/**`.
  - One rule:
    ```js
    'no-restricted-syntax': ['error',
      {
        selector: "CallExpression[callee.property.name='slice'][callee.object.callee.property.name='toISOString']",
        message: "Don't derive a local date from toISOString() (it is UTC). Use todayLocalIso()/currentMonthLocal() from @atlas/core.",
      },
      {
        selector: "CallExpression[callee.property.name='split'][callee.object.callee.property.name='toISOString']",
        message: "Don't derive a local date from toISOString().split(...) (it is UTC). Use todayLocalIso() from @atlas/core.",
      },
    ]
    ```
- Root `package.json` `"lint"` → `eslint .` (keep the per-package `echo lint-pending` stubs; the root script is what CI/devs run). Update `CLAUDE.md`'s lint note.
- Legit UTC uses (e.g. building a timestamp that is genuinely stored/compared as UTC) get a targeted `// eslint-disable-next-line no-restricted-syntax` with a one-line "// UTC on purpose: ..." comment.

### 3. Backend call-site sweep

`apps/api` + `apps/worker` import `@atlas/core` already. Replace:

| File | Current | Fix |
|---|---|---|
| `apps/api/src/routes/pfm/summary-routes.js:13` | `new Date().toISOString().slice(0,7)` | `currentMonthLocal()` |
| `apps/api/src/routes/pfm/wallets-service.js:87` | `` `${...slice(0,7)}-01` `` | `` `${currentMonthLocal()}-01` `` |
| `apps/api/src/routes/pfm/wallets-service.js:158` | `` new Date(`${...slice(0,10)}T00:00:00.000Z`) `` | `` new Date(`${todayLocalIso()}T00:00:00.000Z`) `` |
| `apps/api/src/routes/pfm/movements-service.js:50` | same shape (adjustment `occurredOn` default) | `todayLocalIso()` |
| `apps/api/src/index.js` (×6: users/contacts/employees xlsx+pdf) | `` `...-${...slice(0,10)}.xlsx` `` | `todayLocalIso()` |
| `apps/api/src/routes/activity.js:183` | export filename | `todayLocalIso()` |
| `apps/api/src/services/files-service.js:560` | zip filename | `todayLocalIso()` |

`apps/api/src/routes/pfm/__tests__/wallets-service.test.js` asserts `createWallet` sets `lastAccruedOn` to `new Date().toISOString().slice(0,10)` — update it to `todayLocalIso()` (still deterministic within a test run).

### 4. Frontend call-site sweep

`apps/desktop` gains `@atlas/core` as a dependency (it is a workspace package; add `"@atlas/core": "workspace:*"` to `apps/desktop/package.json`). A thin `apps/desktop/src/lib/localDate.js` re-exports `todayLocalIso`, `currentMonthLocal`, `nowLocalParts` from `@atlas/core` so module code has one local import path.

Per-file audit (each `toISOString()` "now/today" → helper; a `toISOString()` on a **specific** past/selected date stays):

- `apps/desktop/src/modules/atlas.pfm/lib/format.js` — `currentMonthKey` / `todayIso` already patched locally; re-point them at the helper (keep the exported names so call sites don't change).
- `apps/desktop/src/modules/atlas.calendar/**` — `AgendaView`, `DayView`, `WeekView`, `MonthView`, `EventFormModal`, `stores/useCalendarStore.js`, `MiniCalendar`: audit each. "Today marker", "default event date = today", "jump to current month" → helper. Serializing a chosen event start/end to send to the API → leave (that is an instant, not a local-day default).
- `apps/desktop/src/modules/atlas.hr/screens/HrScreen.jsx`, `HrEmployeeForm.jsx` — audit (likely "today" defaults).
- `apps/desktop/src/modules/atlas.identity/screens/UsersScreen.jsx`, `UserEditorScreen.jsx` — audit.
- `apps/desktop/src/modules/atlas.activity/ActivityFeedScreen.jsx` — audit.
- `apps/desktop/src/modules/atlas.contacts/screens/ContactsScreen.jsx` — audit.
- `apps/desktop/src/modules/atlas.ledger/screens/SpreadsheetRegister.jsx` — audit ("new row date = today").
- `apps/desktop/src/modules/atlas.projects/components/TaskDetailPanel.jsx` — audit.
- `apps/desktop/src/app/ProfileScreen.jsx` — audit.
- `apps/desktop/src/modules/atlas.growth/lib/growth-analytics.js` — audit.

Any site where the value is provably a specific selected/known date (not `new Date()` "now") is left as-is and, if flagged by the new ESLint rule, gets a `// eslint-disable-next-line` with a reason.

## Testing

`node --test`:
- `packages/core` (new test file — `packages/core` has no test script today; add `"test": "node --test src/__tests__/"` and `src/__tests__/time.test.js`):
  - `nowLocalParts` with an injected fixed `date` and `TZ=America/Mexico_City` set on `process.env` for the test → `2026-08-31T02:03:00.000Z` yields `{ year:'2026', month:'08', day:'31' }` (not `09`).
  - with `TZ` unset / `ATLAS_TIME_ZONE` unset → `'UTC'` → same instant yields `day:'01'`, `month:'09'` (documents the fallback).
  - `todayLocalIso` / `currentMonthLocal` string shapes.
- `apps/api` pfm tests: `wallets-service.test.js` updated assertion still passes; full pfm suite green.
- `apps/desktop` `atlas.pfm/__tests__/format.test.js`: `currentMonthKey` / `todayIso` still return the right shape.

## Decomposition

- **Plan A** — `@atlas/core` helpers + tests, ESLint bootstrap + rule, backend sweep (13 sites) + backend test update.
- **Plan B** — frontend: add `@atlas/core` dep + `lib/localDate.js`, sweep the ~15 frontend sites (pfm, calendar, hr, identity, activity, contacts, ledger, projects, profile, growth), fix any ESLint findings.

Plan A lands first (Plan B imports the helper).

## Out of scope

- Wiring `instance_time_zone` (DB) into the frontend runtime config — the decision is browser-zone on the FE.
- Per-user timezone preference.
- Reworking how calendar events store/transmit their datetimes (instants stay instants).
- Historical data migration (no stored data is wrong; only runtime "now" derivation was).
- DST-transition edge cases beyond what `Intl.DateTimeFormat` already handles.
