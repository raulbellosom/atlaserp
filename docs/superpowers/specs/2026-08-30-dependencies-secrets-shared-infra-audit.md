# Dependencies, secrets, and shared infrastructure — audit

**Date:** 2026-08-30
**Scope:** requested by the user after the module-by-module campaign closed,
to answer "is that really everything?" honestly — this pass covers what the
per-module audits explicitly did NOT: dependency CVEs, committed secrets, and
platform/shared infrastructure that isn't itself a business module
(`module-lifecycle-service.js`, `module-migration-service.js`,
`packages/module-engine`, `packages/validators`, `packages/sdk`,
`apps/worker`).

---

## 1. Secrets scan — clean

- `.gitignore` covers `.env`, `.env.local`, `.env.*.local`, `.env.external`.
  Only `.env.example` is tracked, and every value in it is a placeholder or
  empty (`git grep` confirmed no real key/URL ever committed).
- `git log --all --diff-filter=A --name-only` confirms no `.env`/
  `.env.local`/`.env.production` was ever added in this repo's history.
- Regex sweep for common secret shapes (`sk_live_`, `sk_test_`, AWS access
  keys, PEM private key headers, JWT-shaped tokens) across all tracked files:
  only 2 hits, both UI placeholder text (`placeholder="sk_live_... o
  sk_test_..."`), not real keys.
- No hardcoded `SERVICE_ROLE_KEY`/`JWT_SECRET`/`DATABASE_URL`/
  `POSTGRES_PASSWORD` assignments found in source.
- No accidental `console.log` of a token/password/secret found in
  `packages/sdk`, `packages/storefront-sdk`, or `apps/desktop/src`.

### Env vars added since this audit

- `GROQ_API_KEY` (+ `PFM_VISION_PROVIDER` / `GROQ_BASE_URL` / `PFM_VISION_MODEL`
  / `PFM_VISION_TIMEOUT_MS`) — added 2026-08-31 for `atlas.pfm` receipt OCR
  (`apps/api/src/services/vision-service.js`). Optional: absent → the feature
  degrades to manual entry, the API and worker still boot. Placeholder-only in
  `.env.example`. Never logged (the adapter logs only status codes / messages).

## 2. Dependency CVEs — 51 → 9 advisories fixed

`pnpm audit --prod` started at **51 advisories (21 high, 25 moderate, 5
low)**. Fixed:

- **`hono`** (root + `apps/api`, was pinned `"latest"` → resolved stale
  4.12.18) → bumped to **4.13.5**, clearing 12 hono CVEs including a **high**
  one (CORS middleware reflecting any Origin with credentials when `origin`
  defaults to the wildcard) and moderates (JWT middleware accepting any auth
  scheme, not just Bearer; SSR cross-request data disclosure via `memo()`/jsx
  context; Set-Cookie injection via unsanitized `sameSite`/`priority`).
- **`@hono/node-server`** — `pnpm update` initially jumped this to `2.1.1`
  (a MAJOR bump, since `apps/api/package.json` had it pinned to the literal
  string `"latest"`). Reverted to an explicit **`^1.19.17`** pin instead — the
  CVEs only require `>=1.19.15`, and a major-version jump of the HTTP server
  adapter is unnecessary blast radius for a security patch. `serve({ fetch,
  port })` usage in `index.js` is the standard minimal API, verified stable
  across this range.
- **`react-router-dom`** (`apps/desktop`) → **7.18.3** (was 7.14.2, already
  within its own `^7.14.2` caret range) — clears a **high** DoS (unbounded
  `__manifest` route-matching expansion), a CSRF bypass, an open redirect,
  and an XSS (RSCErrorHandler missing protocol validation).
- **`sharp`** (`apps/api`, used only by `routes/pwa.js` for icon generation)
  → **^0.35.4** (was `^0.34.5`, a 0.x "minor" bump needed explicit repin since
  npm/pnpm treat 0.x minors as breaking under caret) — clears inherited
  libvips CVEs (buffer/memory issues).
- **`ws`** — pulled in transitively via `@supabase/supabase-js` →
  `@supabase/realtime-js` (a **real runtime path** — Supabase Realtime powers
  chat/notifications), pinned at 8.20.0. Added a `pnpm.overrides` entry
  (`^8.21.0`) — clears a **high** memory-exhaustion DoS and a moderate
  uninitialized-memory-disclosure CVE.
- **`dompurify`** — pulled in via `@raulbellosom/atlas-web-builder` (the
  website-builder block editor, real runtime HTML-sanitization surface),
  pinned at 3.4.7. Overridden to **^3.4.14** — clears 5 CVEs across
  high/moderate/low, including two actual **XSS bypasses** (`IN_PLACE` hook
  removal leaving a detached subtree executable; `ALLOWED_ATTR` pollution via
  `setConfig()`).
- **`tmp`, `js-yaml`, `brace-expansion`, `nanoid`** — transitive deps of
  `exceljs` (Excel export, used across many modules) and `@mdxeditor/editor`
  (rich-text editor in `packages/ui`) / `@raulbellosom/atlas-web-builder`.
  Overridden to their patched versions — low individual severity but cheap
  and safe (leaf utility libraries, small/no API surface).

**Deliberately NOT bumped, with reasoning:**

- **`nodemailer`** (`apps/api`, real dependency — `smtp-service.js`) — the
  flagged CVE requires the message-level `raw` option (bypasses
  `disableFileAccess`/`disableUrlAccess`, enabling SSRF/arbitrary file read);
  confirmed via grep that `smtp-service.js` never uses `raw`. The fix needs a
  **major version bump (8→9)**, which risks breaking email delivery — a
  business-critical, hard-to-verify-without-a-live-SMTP-server path. Left as
  backlog item **G1**: bump to nodemailer 9 with a dedicated verification
  pass (send a real test email against the configured SMTP host), not forced
  through under this session's time budget.
- **`uuid`** (`apps/api`, via `exceljs`, pinned at 8.3.2) — the CVE only
  affects `v3()/v5()/v6()` called with a custom `buf` option; confirmed via
  grep that exceljs's only usage (`cf-rule-ext-xform.js`) calls `v4()` with no
  `buf` argument — the vulnerable code path is unreachable through our usage.
  Bumping this specific dependency 3 major versions (8→11) for a
  non-applicable CVE was judged not worth the compatibility risk to a
  widely-used export library. Left as-is; flagged in the backlog for
  awareness (G2), not for action.
- **`fast-uri`, `deepmerge-ts`, `valibot`, the nested `@hono/node-server`
  copy** — all trace through `@prisma/client`'s own `devDependencies` (Prisma
  CLI/schema-engine internal tooling via `@prisma/dev`), not through any
  HTTP-request-handling path. Not attacker-reachable in a running API server;
  will resolve naturally on the next Prisma upstream bump.

**Final count: 9 advisories remaining (5 high, 4 moderate, 0 low)** — all
either the deliberately-deferred `nodemailer`/`uuid` cases above, or
Prisma's own internal tooling deps.

## 3. Shared infrastructure — clean

- **`module-lifecycle-service.js`** — every `DROP TABLE IF EXISTS "${...}"` /
  `SELECT COUNT(*) FROM "${...}"` raw-SQL interpolation traces back to
  `toModuleTableName()`, which gates the value through
  `TABLE_NAME_PATTERN = /^[a-z][a-z0-9_]*$/` before it can ever reach a query
  string — confirmed by tracing every call site
  (`dropCandidates`/`tableChecks` are built exclusively from
  `getTableRowCount()`'s return value, which always carries the
  already-validated `safeTable`). No injection path.
- **`module-migration-service.js`** — `$executeRawUnsafe(statement)` only
  runs after `assertSafeMigrationSql()` (from `@atlas/module-engine`), which
  allowlists additive DDL only (`CREATE TABLE IF NOT EXISTS`, `CREATE INDEX
  IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`) and rejects any
  destructive pattern unless the migration entry explicitly opts in with
  `unsafe: true` in the module manifest — itself gated behind
  `core.modules.*` permissions. This is by-design "execute admin-authored
  DDL" functionality with real, working guardrails, not an injection bug.
- **`apps/worker/src/index.js`** — CLAUDE.md's "background job handler
  (stub)" description is stale; this is now a real 242-line cron-tick runner
  orchestrating 7 jobs (calendar reminders, notification delivery, sync-log
  cleanup, tasks-due-soon, growth retention/aggregation, recurring tasks,
  chat guest-session expiry). Pure internal scheduler with no HTTP surface —
  no attacker-reachable input. Spot-checked `growth-aggregation-worker.js`
  (466 lines, never individually reviewed during the growth module audit):
  every aggregation query correctly `GROUP BY`/attributes `company_id` per
  row, so per-company metrics stay segregated in a job that necessarily
  processes every company in one pass.
- **`packages/validators`** — the `z.any()`/`z.record(z.unknown())`/
  `.passthrough()` usages found are all on genuinely free-form `metadata`
  JSON fields or module-manifest shapes (deliberately extensible by design,
  matching the pattern already accepted throughout this campaign in
  chat/notes/etc.) — not an authorization-relevant bypass.

## 4. What this pass still does not cover

Being explicit per the user's "are you sure that's everything" pushback:

- No browser/responsive QA (repeated caveat from every module spec this
  campaign).
- `packages/core`, `packages/ui`, `packages/module-engine` got only a
  targeted read (the specific functions the module audits' findings led to),
  not a full independent line-by-line review.
- No fuzzing, no penetration testing, no formal threat-modeling session.
- Dependency audit is `pnpm audit`'s advisory database only — doesn't catch
  unknown/unpublished vulnerabilities, only known CVEs.

## 5. Backlog additions

- **G1** — bump `nodemailer` 8→9 with a dedicated live-SMTP verification
  pass. — _medium, needs its own verification step_
- **G2** — `uuid@8.3.2` (via `exceljs`) has a known CVE in an API surface
  (`v3/v5/v6` + custom `buf`) exceljs doesn't use; no action needed unless
  exceljs itself starts using that surface. — _informational, no action_

## 6. Verification (2026-08-30)

- `pnpm install` — clean (pre-existing `@tiptap/extension-collaboration-cursor`
  peer-dependency warning only, unrelated to this pass).
- `node --test "apps/api/src/**/__tests__/*.test.js"` — 824/824 (unchanged —
  no regressions from the dependency bumps).
- `pnpm --filter @atlas/desktop build:web` — clean build after every install
  round (checked 4 times across this pass).
- `pnpm audit --prod` — 51 → 9 advisories.
