# Local-time correctness — Plan A: `@atlas/core` helpers + ESLint guardrail + backend sweep

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add isomorphic `toLocalIso` / `toLocalMonth` / `nowLocalParts` helpers to `@atlas/core` (backend → configured `ATLAS_TIME_ZONE`, browser → local zone), bootstrap ESLint with one rule that bans `.toISOString().slice(...)` / `.split(...)` for date extraction, and replace every backend "today / current month" derivation.

**Architecture:** `packages/core/src/time.js` already has `getConfiguredTimeZone()` (`ATLAS_TIME_ZONE || TZ || 'UTC'`). New helpers format via `Intl.DateTimeFormat('en-CA', { timeZone })`. `apps/api` and `apps/worker` already import `@atlas/core`. Spec: `docs/superpowers/specs/2026-08-31-platform-local-time-correctness-design.md`.

**Refinement over the spec:** helper names are `toLocalIso(date?)` / `toLocalMonth(date?)` / `nowLocalParts(date?)` — a single arg-optional helper covers both "now" (no arg) and "format this Date locally" (with arg), which the spec's `todayLocalIso`/`currentMonthLocal` split did not.

**Tech Stack:** Node built-in test runner, ESLint 9 (flat config), Hono API.

**Prerequisite for Plan B:** land this first — Plan B imports the helper.

---

## File Structure

| File | Change | Task |
|---|---|---|
| `packages/core/src/time.js` | add `nowLocalParts`, `toLocalIso`, `toLocalMonth` | 1 |
| `packages/core/src/__tests__/time.test.js` | create | 1 |
| `packages/core/package.json` | add `"test"` script | 1 |
| `eslint.config.js` (root) | create — flat config, one rule | 2 |
| `package.json` (root) | `"lint"` → `eslint .`; add `eslint` devDep | 2 |
| `CLAUDE.md` | update the lint note | 2 |
| `apps/api/src/routes/pfm/summary-routes.js` | `currentMonthKey` → `toLocalMonth()` | 3 |
| `apps/api/src/routes/pfm/wallets-service.js` | 2 sites | 3 |
| `apps/api/src/routes/pfm/movements-service.js` | 1 site | 3 |
| `apps/api/src/routes/pfm/__tests__/wallets-service.test.js` | update assertion | 3 |
| `apps/api/src/index.js` | 6 export-filename sites | 4 |
| `apps/api/src/routes/activity.js` | 1 export-filename site | 4 |
| `apps/api/src/services/files-service.js` | 1 zip-filename site | 4 |
| `apps/api/src/routes/projects/projects-calendar-bridge.js` | 1 site (audit) | 4 |

---

## Task 1: `@atlas/core` time helpers + tests

**Files:**
- Modify: `packages/core/src/time.js`
- Create: `packages/core/src/__tests__/time.test.js`
- Modify: `packages/core/package.json`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/__tests__/time.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { nowLocalParts, toLocalIso, toLocalMonth } from "../time.js";

// 2026-08-31T02:03:00Z is still 2026-08-30 20:03 in America/Mexico_City (UTC-6).
const LATE_NIGHT = new Date("2026-08-31T02:03:00.000Z");

test("toLocalIso uses the configured zone, not UTC", () => {
  const prev = process.env.TZ;
  const prevAtlas = process.env.ATLAS_TIME_ZONE;
  process.env.ATLAS_TIME_ZONE = "America/Mexico_City";
  delete process.env.TZ;
  try {
    assert.equal(toLocalIso(LATE_NIGHT), "2026-08-30");
    assert.equal(toLocalMonth(LATE_NIGHT), "2026-08");
    assert.deepEqual(nowLocalParts(LATE_NIGHT), { year: "2026", month: "08", day: "30" });
  } finally {
    if (prev === undefined) delete process.env.TZ; else process.env.TZ = prev;
    if (prevAtlas === undefined) delete process.env.ATLAS_TIME_ZONE;
    else process.env.ATLAS_TIME_ZONE = prevAtlas;
  }
});

test("falls back to UTC when no zone is configured", () => {
  const prev = process.env.TZ;
  const prevAtlas = process.env.ATLAS_TIME_ZONE;
  delete process.env.TZ;
  delete process.env.ATLAS_TIME_ZONE;
  try {
    assert.equal(toLocalIso(LATE_NIGHT), "2026-08-31");
    assert.equal(toLocalMonth(LATE_NIGHT), "2026-08");
  } finally {
    if (prev !== undefined) process.env.TZ = prev;
    if (prevAtlas !== undefined) process.env.ATLAS_TIME_ZONE = prevAtlas;
  }
});

test("toLocalIso() with no arg returns a YYYY-MM-DD string", () => {
  assert.match(toLocalIso(), /^\d{4}-\d{2}-\d{2}$/);
  assert.match(toLocalMonth(), /^\d{4}-\d{2}$/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test packages/core/src/__tests__/time.test.js`
Expected: FAIL — `nowLocalParts` / `toLocalIso` / `toLocalMonth` are not exported.

- [ ] **Step 3: Implement**

In `packages/core/src/time.js`, add after `getConfiguredTimeZone`:

```js
// Node -> the configured zone (ATLAS_TIME_ZONE || TZ || 'UTC'); browser -> the
// runtime's own zone. `toISOString()` is always UTC and must never be used to
// derive a local calendar date/month.
function runtimeTimeZone() {
  const isNode =
    typeof process !== 'undefined' && !!process.versions && !!process.versions.node
  return isNode ? getConfiguredTimeZone() : undefined
}

export function nowLocalParts(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date)
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: runtimeTimeZone(),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d)
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]))
  return { year: map.year, month: map.month, day: map.day }
}

export function toLocalIso(date = new Date()) {
  const { year, month, day } = nowLocalParts(date)
  return `${year}-${month}-${day}`
}

export function toLocalMonth(date = new Date()) {
  const { year, month } = nowLocalParts(date)
  return `${year}-${month}`
}
```

- [ ] **Step 4: Add the test script**

In `packages/core/package.json`, add a `scripts` block:

```json
  "scripts": {
    "test": "node --test src/__tests__/"
  },
```

(Insert it after the `"exports"` line, keeping valid JSON.)

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test packages/core/src/__tests__/time.test.js`
Expected: PASS — all 3 tests.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/time.js packages/core/src/__tests__/time.test.js packages/core/package.json
git commit -m "feat(core): toLocalIso/toLocalMonth/nowLocalParts (zone-aware, never UTC)"
```

---

## Task 2: ESLint bootstrap + the anti-regression rule

**Files:**
- Create: `eslint.config.js` (repo root)
- Modify: `package.json` (root)
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add ESLint as a root devDependency**

Run: `pnpm add -D -w eslint@^9`
Expected: `eslint` appears in root `package.json` `devDependencies`.

- [ ] **Step 2: Create the flat config**

Create `eslint.config.js` at the repo root:

```js
// Minimal ESLint config: one guardrail rule, no style linting.
// `toISOString()` is always UTC; deriving a local date/month from it is a bug.
export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/dist-*/**",
      "apps/desktop/src-tauri/**",
      "prisma/migrations/**",
      "docs/**",
      "**/*.min.js",
      "**/.vite/**",
    ],
  },
  {
    files: ["**/*.{js,jsx,mjs,cjs}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression[callee.property.name='slice'][callee.object.callee.property.name='toISOString']",
          message:
            "toISOString() is UTC. Use toLocalIso()/toLocalMonth() from @atlas/core to derive a local date/month.",
        },
        {
          selector:
            "CallExpression[callee.property.name='split'][callee.object.callee.property.name='toISOString']",
          message:
            "toISOString() is UTC. Use toLocalIso() from @atlas/core to derive a local date.",
        },
      ],
    },
  },
];
```

- [ ] **Step 3: Point the root lint script at ESLint**

In root `package.json`, change:

```json
    "lint": "pnpm -r lint",
```
to
```json
    "lint": "eslint .",
    "lint:packages": "pnpm -r lint",
```

- [ ] **Step 4: Run ESLint — expect it to flag only the known sites**

Run: `pnpm lint`
Expected: FAIL with `no-restricted-syntax` errors. Confirm the flagged files are **only**:
- `apps/api/src/**` (fixed in Tasks 3–4)
- `apps/desktop/src/**` (fixed in Plan B)
- `apps/desktop/src/modules/atlas.pfm/lib/format.js` `shiftMonth` (deliberate UTC — gets an inline disable in Plan B)

There must be **no** finding inside `packages/core/src/time.js` (the helpers use `Intl`, not `toISOString().slice`). Note the count for later.

- [ ] **Step 5: Update the CLAUDE.md lint note**

In `CLAUDE.md`, under "Build and lint", replace the `pnpm lint` line's description so it reads:

```bash
pnpm lint            # ESLint (root): bans deriving a local date from toISOString(); use @atlas/core toLocalIso/toLocalMonth
```

- [ ] **Step 6: Commit**

```bash
git add eslint.config.js package.json pnpm-lock.yaml CLAUDE.md
git commit -m "build: bootstrap ESLint with a no-toISOString-slice date guardrail"
```

---

## Task 3: Backend PFM date logic

**Files:**
- Modify: `apps/api/src/routes/pfm/summary-routes.js`
- Modify: `apps/api/src/routes/pfm/wallets-service.js`
- Modify: `apps/api/src/routes/pfm/movements-service.js`
- Test: `apps/api/src/routes/pfm/__tests__/wallets-service.test.js`

- [ ] **Step 1: `summary-routes.js`**

At the top of `apps/api/src/routes/pfm/summary-routes.js`, add:

```js
import { toLocalMonth } from "@atlas/core";
```

Replace the body of the month-key helper (line ~13, `return new Date().toISOString().slice(0, 7);`) with:

```js
  return toLocalMonth();
```

- [ ] **Step 2: `wallets-service.js`**

Add to the imports at the top:

```js
import { toLocalIso, toLocalMonth } from "@atlas/core";
```

Replace `getWallet`'s `accruedThisMonth` month start (currently `` const monthStart = `${new Date().toISOString().slice(0, 7)}-01`; ``):

```js
        const monthStart = `${toLocalMonth()}-01`;
```

Replace `createWallet`'s `todayDate` (currently `` const todayDate = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`); ``):

```js
      const todayDate = new Date(`${toLocalIso()}T00:00:00.000Z`);
```

- [ ] **Step 3: `movements-service.js`**

Add to the imports:

```js
import { toLocalIso } from "@atlas/core";
```

Replace the adjustment `occurredOn` default (currently `` : new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`); ``):

```js
      : new Date(`${toLocalIso()}T00:00:00.000Z`);
```

- [ ] **Step 4: Update the wallets-service test**

In `apps/api/src/routes/pfm/__tests__/wallets-service.test.js`, the INVESTMENT create test asserts `lastAccruedOn` equals `new Date().toISOString().slice(0, 10)`. Change that expectation to import and use the helper:

Add to the top imports of the test file:

```js
import { toLocalIso } from "@atlas/core";
```

Change the assertion `const today = new Date().toISOString().slice(0, 10);` to:

```js
    const today = toLocalIso();
```

- [ ] **Step 5: Run the pfm tests**

Run: `node --test $(find apps/api/src/routes/pfm/__tests__ -name "*.test.js" | tr '\n' ' ')`
Expected: `# fail 0`.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes/pfm/summary-routes.js apps/api/src/routes/pfm/wallets-service.js apps/api/src/routes/pfm/movements-service.js apps/api/src/routes/pfm/__tests__/wallets-service.test.js
git commit -m "fix(pfm-api): derive today/current-month from the configured zone, not UTC"
```

---

## Task 4: Backend export filenames + calendar bridge

**Files:**
- Modify: `apps/api/src/index.js` (6 sites)
- Modify: `apps/api/src/routes/activity.js` (1)
- Modify: `apps/api/src/services/files-service.js` (1)
- Modify: `apps/api/src/routes/projects/projects-calendar-bridge.js` (1 — audit)

- [ ] **Step 1: `apps/api/src/index.js`**

Ensure `toLocalIso` is imported (add to the existing `@atlas/core` import, or add a new import line near the top):

```js
import { toLocalIso } from "@atlas/core";
```

(If `@atlas/core` is already imported for `formatLogTimestamp` etc., add `toLocalIso` to that destructure instead of a second import.)

Replace all 6 occurrences of `new Date().toISOString().slice(0, 10)` in export filenames (the `usuarios-...`, `contactos-...`, `colaboradores-...` xlsx/pdf lines) with `toLocalIso()`.

Run to confirm all 6 are handled:
```bash
grep -n "toISOString().slice(0, 10)" apps/api/src/index.js
```
Expected: no matches.

- [ ] **Step 2: `apps/api/src/routes/activity.js`**

Add `import { toLocalIso } from "@atlas/core";` at the top. Replace `` `actividad-${new Date().toISOString().slice(0, 10)}.xlsx` `` with `` `actividad-${toLocalIso()}.xlsx` ``.

- [ ] **Step 3: `apps/api/src/services/files-service.js`**

Add `import { toLocalIso } from "@atlas/core";` at the top. Replace `` `atlas-archivos-${new Date().toISOString().slice(0, 10)}.zip` `` with `` `atlas-archivos-${toLocalIso()}.zip` ``.

- [ ] **Step 4: `projects-calendar-bridge.js` — audit line 94**

Open `apps/api/src/routes/projects/projects-calendar-bridge.js` around line 94:
`const s = new Date(d).toISOString().split("T")[0];`

- If `d` is a task's due/scheduled date being reduced to a calendar day: add `import { toLocalIso } from "@atlas/core";` and change to `const s = toLocalIso(new Date(d));`.
- If `d` is genuinely an instant that must map to a UTC calendar day for the calendar API contract: keep it and add above the line:
  `// eslint-disable-next-line no-restricted-syntax -- calendar API expects the UTC day of this instant`

Pick based on the surrounding code; document the choice in the commit message.

- [ ] **Step 5: Lint the API tree**

Run: `pnpm lint -- apps/api`  (or `npx eslint apps/api`)
Expected: **no** `no-restricted-syntax` findings under `apps/api/`.

- [ ] **Step 6: Full API test sweep**

Run:
```bash
node --test $(find apps/api/src/services/__tests__ apps/api/src/routes -name "*.test.js" | tr '\n' ' ')
```
Expected: `# fail 0`.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/index.js apps/api/src/routes/activity.js apps/api/src/services/files-service.js apps/api/src/routes/projects/projects-calendar-bridge.js
git commit -m "fix(api): export filenames + calendar bridge use local date, not UTC"
```

---

## Self-Review

**Spec coverage:**
- Isomorphic helper in `@atlas/core` (Node → configured zone, browser → local) → Task 1.
- ESLint single-rule bootstrap, `pnpm lint` wired, CLAUDE.md note → Task 2.
- Backend business-logic sites (pfm summary/wallets/movements) → Task 3; test updated → Task 3 Step 4.
- Backend export-filename sites (index.js ×6, activity, files-service) + calendar bridge → Task 4.
- Fallback-to-UTC-when-unconfigured behaviour is tested → Task 1 Step 1.

**Placeholder scan:** none. Task 4 Step 4 is a genuine audit-and-choose with both branches spelled out and a rule for deciding.

**Type consistency:**
- `toLocalIso(date?)` / `toLocalMonth(date?)` / `nowLocalParts(date?)` — same signatures in the impl (Task 1 Step 3), the tests (Task 1 Step 1), and every consumer (Tasks 3–4, and Plan B).
- `nowLocalParts` returns `{ year, month, day }` as zero-padded strings — asserted in Task 1.
- All backend consumers call the zero-arg form (`toLocalIso()` / `toLocalMonth()`) for "now"; `projects-calendar-bridge` may use the one-arg form `toLocalIso(new Date(d))`.
