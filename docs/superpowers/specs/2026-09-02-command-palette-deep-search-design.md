# Command Palette Deep Search — Design (Spec B)

Date: 2026-09-02
Status: Approved (execute-through requested by user)
Depends on: Spec A (`2026-09-02-command-palette-overhaul-design.md`, shipped).
Scope: a global record-search endpoint + its providers, the SDK method, and the
command-palette integration.

## Problem

The palette (post Spec A) navigates to modules and their sub-pages, but cannot find
a record *inside* a module. The user wants: while anywhere in the app, type a name
and jump straight to that contact / user / employee — but only for modules the user
has permission to read.

## Goals

- `GET /search?q=<term>` returns records the current user is allowed to see, grouped
  by source, company-scoped.
- Providers are permission-gated individually: a user who can read contacts but not
  HR gets contact hits and no employee hits — never a 403 for the whole request.
- The palette shows these hits in their own groups when the query is >= 2 chars,
  without blocking the existing module/action results.

## Non-goals

- Full-text / fuzzy search, ranking tuning, pagination, "see all results" view.
- Files (v1): `FileAsset` has no `companyId` column — tenant-safe file search needs
  its own design. Deferred.
- Searching AME3 custom-module tables.

## v1 providers

| source | permission | model | company scope | match fields | target |
| --- | --- | --- | --- | --- | --- |
| `contacts` | `contacts.contacts.read` | `Contact` | `companyId` | name, legalName, email, phone, taxId | `/app/m/atlas.contacts/contacts/{id}` |
| `users` | `identity.users.read` | `UserProfile` via `Membership` | `Membership.companyId` + `enabled` | displayName, email, firstName, lastName | `/app/m/atlas.identity/identity/users/{id}` |
| `employees` | `hr.employee.read` | `HrEmployee` | `companyId` + `enabled` | firstName, lastName, workEmail, personalEmail, employeeCode, jobTitle | `/app/m/atlas.hr/hr/employees/{id}` |

Each provider returns at most `limit` (default 5, max 10) items shaped
`{ id, title, subtitle, icon }`; the route adds `target` and `source`.

- contacts subtitle: `email || phone || type`
- users subtitle: `email`
- employees subtitle: `jobTitle || workEmail || employeeCode`

## API

### `apps/api/src/services/search-providers.js` (new)

Exports `SEARCH_PROVIDERS` — an array of
`{ source, label, permission, icon, run }`.

`run({ prisma, companyId, actorId, q, limit })` -> `Promise<item[]>`. Pure data
access, no `c`. Uses Prisma model accessors (these are all core Prisma-managed
tables, not AME3). `q` is already trimmed and length-checked by the caller;
providers build a case-insensitive `contains` OR across their fields and `take:
limit`, `orderBy` a sensible name field.

- `users` provider queries `Membership.findMany({ where: { companyId, enabled: true,
  user: { enabled: true, OR: [...] } }, take: limit, select: { user: {...} } })` and
  maps `m.user`.

### `apps/api/src/routes/search-routes.js` (new)

`createSearchRouter({ prisma, getUserContext })` -> Hono app with one route:

```
GET /search?q=&limit=
  ctx = await getUserContext(c)            // { profile, isAdmin, permissionSet, memberships }
  q = (query.q || "").trim()
  if q.length < 2 -> 200 { query: q, groups: [] }
  limit = clamp(query.limit, 1..10, default 5)
  companyId = ctx.memberships?.[0]?.companyId ?? null
  if !companyId -> 200 { query: q, groups: [] }
  allowed = SEARCH_PROVIDERS.filter(p => ctx.isAdmin || ctx.permissionSet.has(p.permission))
  settled = await Promise.allSettled(allowed.map(p =>
      p.run({ prisma, companyId, actorId: ctx.profile.id, q, limit })))
  groups = settled.flatMap((r, i) =>
      r.status === "fulfilled" && r.value.length
        ? [{ source: allowed[i].source, label: allowed[i].label,
             items: r.value.map(it => ({ ...it, source: allowed[i].source,
               target: allowed[i].target(it.id) })) }]
        : [])
  return 200 { query: q, groups }
```

A provider throwing (e.g. missing table on a partially-migrated instance) is logged
(non-prod) and simply omitted — never fails the request.

Mounted in `apps/api/src/index.js` via `mountWithAuth(app, createSearchRouter({
prisma, getUserContext: getOrLoadUserContext }))`, alongside the other
`mountWithAuth` routers.

### `packages/sdk/src/index.js`

Add a `search` group:

```
search: {
  global: (q, { limit } = {}, token) =>
    request(`/search${toQueryString({ q, limit })}`, { token }),
}
```

(Match the existing factory's `request` / `toQueryString` helpers and grouping
style.)

## Frontend

### `apps/desktop/src/lib/commandPalette.js`

Add `mapSearchGroups(groups)` -> palette sections: one section per group
(`id: \`search:${source}\``, `title: label`), items shaped like the existing
descriptors (`kind: "record"`, `title`, `subtitle`, `icon`, `color: null`,
`target`, `blocked: false`, `key: \`record:${source}:${id}\``). Pure, unit-tested.

`buildCommandItems` gains an optional `searchGroups` param; when present its mapped
sections are spliced in **after `active`, before `modules`** (records the user
explicitly searched for outrank generic module rows). Local sections are still
filtered by the same query.

### `apps/desktop/src/components/CommandPalette.jsx`

- New hook usage: TanStack Query `useQuery({ queryKey: ["command-search", debouncedQuery], queryFn: () => atlas.search.global(debouncedQuery, { limit: 5 }, token), enabled: debouncedQuery.length >= 2, staleTime: 15_000 })`.
- Debounce `query` -> `debouncedQuery` with a 200 ms `useEffect` + timeout.
- Pass `searchGroups: data?.groups ?? []` into `buildCommandItems`.
- While `isFetching` and `debouncedQuery.length >= 2`, render a thin
  `Buscando...` line under the input (muted, no spinner dependency).
- `record` rows render with a `ModuleNavIcon` in a neutral square (same as
  `action` rows) using the group's `icon`.
- Keyboard nav, offline behavior, close-on-select unchanged (records are never
  `blocked`; offline the query is simply `enabled: false` so no stale hits).
- `atlas` client + `token`: reuse `useRuntimeModules`'s auth or the existing
  `atlas` singleton (`apps/desktop/src/lib/atlas.js`) + `useAuth()` token, matching
  how other screens call the SDK.

## Data flow

```
CommandPalette
  query ──debounce200──▶ debouncedQuery
                          │ (>=2 chars, online)
                          ▼
             useQuery ──▶ GET /search?q=&limit=5
                          │
   getUserContext ──▶ permissionSet ─┐
                                     ▼
              SEARCH_PROVIDERS.filter(perm) ──▶ Promise.allSettled(run)
                                     ▼
                          { groups:[{source,label,items:[{id,title,subtitle,icon,target}]}] }
                          │
   buildCommandItems({ availableModules, activeModule, query,
     isOnline, offlineModuleKeys, searchGroups }) ──▶ sections
     order: active, search:*, modules, tools, pages
```

## Error handling

- `q.length < 2`, no company, offline -> empty groups / query disabled; palette
  shows only local sections.
- Provider throws -> that group omitted, request still 200.
- Network error on `/search` -> `useQuery` error swallowed in UI (local sections
  still work); no error toast from the palette.
- Admin -> every provider runs (permissionSet already contains all keys, and the
  explicit `isAdmin` check covers seed states where it might not).

## Testing

### `apps/api/src/services/__tests__/search-providers.test.js` (`node --test`)

Fake `prisma` with stubbed model methods. Assert each provider:
- builds a company-scoped, `enabled`-aware where clause,
- maps rows to `{ id, title, subtitle, icon }` with the documented subtitle
  precedence,
- respects `limit`.

### `apps/api/src/routes/__tests__/search-routes.test.js` (`node --test`)

Fake `getUserContext` + `prisma`. Assert:
- `q` shorter than 2 -> `{ groups: [] }`, no provider called;
- a user missing `hr.employee.read` -> no `employees` group, contacts/users still
  returned;
- admin -> all groups;
- a provider that throws -> its group omitted, response still 200 with the others;
- no active company -> `{ groups: [] }`.

### `apps/desktop/src/lib/__tests__/commandPalette.test.js` (extend)

- `mapSearchGroups` shapes sections/items correctly, empty in -> empty out.
- `buildCommandItems` with `searchGroups` -> `search:*` sections sit between
  `active` and `modules`; record items are never `blocked`; still present when the
  local query matches nothing.

### Live check

`curl -s "$API/search?q=<known contact>" -H "Authorization: Bearer $ATLAS_TOKEN"`
returns the expected group (run locally by the user; no token echoed).

## Verification

- `node --test apps/api/src/services/__tests__/search-providers.test.js`
- `node --test apps/api/src/routes/__tests__/search-routes.test.js`
- `node --test apps/desktop/src/lib/__tests__/commandPalette.test.js`
- `pnpm lint`
- `pnpm --filter @atlas/desktop build:web`
- Full API suite: `node --test apps/api/src/**/__tests__/` stays green.
- Manual: from Home, type a contact/user/employee name -> a grouped hit appears and
  navigates to the detail screen; a role without HR read sees no employee group.

## Files touched

- `apps/api/src/services/search-providers.js` — new.
- `apps/api/src/routes/search-routes.js` — new.
- `apps/api/src/index.js` — one `mountWithAuth` line + import.
- `apps/api/src/services/__tests__/search-providers.test.js` — new.
- `apps/api/src/routes/__tests__/search-routes.test.js` — new.
- `packages/sdk/src/index.js` — `search.global`.
- `apps/desktop/src/lib/commandPalette.js` — `mapSearchGroups`, `searchGroups` arg.
- `apps/desktop/src/lib/__tests__/commandPalette.test.js` — extended.
- `apps/desktop/src/components/CommandPalette.jsx` — debounced query + `useQuery`.
- `docs/ai-context/ame3-runtime-capabilities.md` — note `GET /search`.
