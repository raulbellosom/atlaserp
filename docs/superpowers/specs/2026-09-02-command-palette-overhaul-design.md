# Command Palette Overhaul — Design (Spec A)

Date: 2026-09-02
Status: Approved (execute-through requested by user)
Scope: `apps/desktop` command palette + a shared icon registry in `@atlas/ui`.
Out of scope: deep entity/record search (its own spec — "Spec B").

## Problem

The command palette (`Ctrl+K`, `apps/desktop/src/components/CommandPalette.jsx`) is
under-powered and visually inconsistent:

1. **Missing icons.** It carries its own local `ICON_MAP` with ~30 lucide names.
   `ModuleCard.jsx` (`MODULE_ICON_REGISTRY`, ~55) and `packages/ui/.../ModuleSidebar.jsx`
   (`ICON_MAP` + `ICON_ALIAS_MAP`, ~90) each carry their own, larger lists. Any module
   whose manifest `icon` is not in the palette's short list (`Gauge`, `Store`,
   `NotebookPen`, `TrendingUp`, `Globe`, `Activity`, `Bell`, `SquareKanban`,
   `ContactRound`, `UsersRound`, `Calendar`, `ShoppingBag`, `Boxes`,
   `UserRoundSearch`, …) renders the generic `Box` fallback. `logoUrl` modules render
   `Box` too — the palette never looks at `logoUrl`.
2. **Missing secondary text.** Row subtitle is `m.summary ?? m.description`. Modules
   with neither render no subtitle. Action rows use a redundant
   `"{module.name} -> {nav.label}"` string.
3. **Shortcuts only for the active module.** `actionItems` is built solely from
   `activeModule.navigation`. From Home there are zero actions, and you can never jump
   straight to e.g. "Contactos -> Empresas" unless you are already inside Contactos.
   The API already returns each module's navigation **permission-filtered**
   (`/runtime/modules`, `filterNavigation: true` in `apps/api/src/index.js`), so the
   data to do better is already on the client.
4. **Weak matching.** Naive `String.includes` on `name` + `summary` only. No match on
   module key or category, no ranking, no ordering by relevance.

## Goals

- One icon source of truth shared by the palette, the module sidebar, and the module
  cards, resolving essentially any valid lucide name plus known legacy aliases and the
  custom `FleetVehicle` glyph, with a sensible fallback.
- Palette lists **every** available module and **every** module's sub-pages
  (navigation) up front (empty query), grouped, with the active module's own actions
  pinned to the top.
- Relevance-ranked results when a query is present.
- Module rows show a real icon / logo / gradient initials; every row has a useful
  subtitle.
- Pure, `node --test`-covered result-building logic.

## Non-goals

- Searching records inside modules (contacts, users, files, finance documents, …).
- Manifest `keywords`, recents / frequency ranking, fuzzy (Levenshtein) matching.
- Refactoring `AtlasDetail.jsx`'s blueprint-field `ICON_MAP` (a deliberately curated
  allow-list for a different renderer; left untouched to keep this change low-risk).

## Approach

### 1. Shared module-icon registry — `packages/ui/src/components/module-icon-registry.jsx`

New file. Owns:

- `FleetVehicleIcon` — **moved here** from `ModuleSidebar.jsx` (which re-exports it for
  back-compat; `packages/ui/src/index.js` re-points its export at the new file).
- `MODULE_ICON_ALIASES` — legacy / lowercase aliases, union of the alias maps that
  exist today in `ModuleSidebar.jsx` (`truck`, `fleetvehicle`, `wrench`,
  `clipboardlist`, `usercheck`, `bookopen`, `library`, `layers`, `menu`, `globe`,
  `forminput -> ClipboardList`).
- `resolveModuleIcon(name, { fallback = Box } = {})` -> always returns a component.
  Resolution order: custom (`FleetVehicle`) -> exact lucide export -> normalized alias
  -> PascalCase-from-normalized lucide export -> `fallback`. Uses
  `import * as LucideIcons from "lucide-react"` so no hand-maintained allow-list can
  drift again.
- `getModuleIconComponent(name)` -> component or `null` (for `ModuleCard`, where a
  missing icon must fall through to gradient initials).
- `MODULE_ICON_REGISTRY` — kept as a named export for any external importer, now
  backed by a `Proxy` over `LucideIcons` + custom map (`in` / property access only).
- `<ModuleNavIcon name size className style fallback />` — thin wrapper around
  `resolveModuleIcon`.

Exports added to `packages/ui/src/index.js`: `resolveModuleIcon`,
`getModuleIconComponent`, `ModuleNavIcon`, `MODULE_ICON_REGISTRY`, `FleetVehicleIcon`
(moved).

Consumer refactors (behavior-preserving — each deletes a local copy):

- `packages/ui/src/components/ModuleSidebar.jsx` — delete local `ICON_MAP` /
  `ICON_ALIAS_MAP`; `NavIcon` becomes `resolveModuleIcon`-backed (keeps its name and
  signature). Re-export `FleetVehicleIcon` from the new file.
- `apps/desktop/src/components/ModuleCard.jsx` — delete the local lucide imports +
  `MODULE_ICON_REGISTRY`; `resolveModuleVisuals` uses `getModuleIconComponent`.
  Re-export `MODULE_ICON_REGISTRY` from `@atlas/ui` (some code imports it from here).
- `apps/desktop/src/components/CommandPalette.jsx` — delete local `ICON_MAP` /
  `CmdIcon`; use `ModuleNavIcon` for action / page rows and `ModuleIcon` (from
  `ModuleCard.jsx`) for module rows.

### 2. Pure result builder — `apps/desktop/src/lib/commandPalette.js`

No JSX. Exported functions:

- `scoreMatch(query, text)` -> number. `0` = no match. Ranked: exact (1000) >
  prefix (100) > word-boundary prefix (60) > substring (30). Case / diacritic
  insensitive (`String.prototype.normalize("NFD")` + strip combining marks +
  `toLowerCase`).
- `scoreItem(query, { title, subtitle, keywords })` -> best weighted score across
  fields: `title` x3, `keywords` (array, e.g. module key + category label) x1.5,
  `subtitle` x1. Empty query -> `0` (kept; ordering falls back to natural order).
- `buildCommandItems({ availableModules, activeModule, query, isOffline, offlineModuleKeys })`
  -> `{ sections: [{ id, title, items }] }` where each item is a plain descriptor:
  `{ key, title, subtitle, icon, logoUrl, color, kind, target, blocked }`.
  - `kind`: `"action"` | `"module"` | `"page"`.
  - `target`: absolute route string (e.g. `/app/m/atlas.contacts/contacts`). The
    component turns `target` into `navigate(target)` + `closeCommand()` + clear query.
  - `blocked`: `!isOffline ? false : !offlineModuleKeys.includes(moduleKey)`.

Sections, in order:

| id | title | contents | when |
| --- | --- | --- | --- |
| `active` | `Acciones — {activeModule.name}` | `activeModule.navigation`, module colour/icon | only inside a module |
| `modules` | `Módulos` | every `availableModules` entry | always |
| `tools` | `Herramientas` | `navigation` of **every other** available module; subtitle = owning module name; icon/colour = owning module | always |
| `pages` | `Páginas` | `STATIC_PAGES` (Inicio, Mi perfil) | always |

- Empty query: all sections rendered in full, natural order (`activeModule.navigation`
  in manifest order; `modules` / `tools` in `availableModules` order which is already
  core-first then alpha; nav items in manifest order).
- Non-empty query: within each section keep items with `scoreItem > 0`, sort by score
  desc then locale `title`. Drop empty sections.
- The active module is **excluded** from the `tools` section (its actions live in
  `active`) but still appears in `modules`.
- Navigation path -> target: `nav.path === "/" ? "/app/m/{key}" : "/app/m/{key}{nav.path}"`
  (paths are already normalized to leading-slash-relative by
  `runtimeModules.normalizeModuleNavigation`).

### 3. `CommandPalette.jsx` rendering

- Replace the `results` `useMemo` body with a call to `buildCommandItems(...)`, then
  flatten `sections` for keyboard nav (`ArrowUp` / `ArrowDown` / `Enter` unchanged).
- `isOffline` / `offlineModuleKeys` from `useOfflineStore` + `OFFLINE_MODULES`
  (unchanged wiring, moved into the builder call).
- Row rendering:
  - `kind === "module"` -> `<ModuleIcon module={moduleRef} size="sm" />` (logo / icon /
    initials, already implemented in `ModuleCard.jsx`). Builder passes enough of the
    module (`{ name, key, color, icon, logoUrl, manifest }`) for `resolveModuleVisuals`.
  - `kind === "action" | "page"` -> colored square + `<ModuleNavIcon name={item.icon}
    size={14} style={{ color: item.color }} />`, matching today's look.
  - `blocked` -> `WifiOff` glyph + `opacity-40 cursor-not-allowed`, unchanged.
- Subtitle: modules -> `summary || description || categoryLabel(category)`; actions ->
  owning module name; pages -> existing `description`.
- Section header styling unchanged. Footer hints unchanged.
- Empty-results copy unchanged (`Sin resultados`).

### 4. Category label helper

`buildCommandItems` needs a human category label for the module-keyword field and the
subtitle fallback. Reuse `CATEGORY_LABELS` already re-exported from
`apps/desktop/src/lib/runtimeModules.js` (`getSortedDisplay` sibling). If a category is
missing from the map, fall back to the raw category string.

## Data flow

```
useRuntimeModules() ──▶ availableModules (perm-filtered nav, icon, logoUrl, color)
AtlasApp ──▶ activeModule (same shape)                     useOfflineStore ──▶ isOnline
        │                                                          │
        ▼                                                          ▼
CommandPalette ──▶ buildCommandItems({ availableModules, activeModule, query,
                       isOffline, offlineModuleKeys })  ──▶ { sections:[{id,title,items}] }
        │                                                          │
        ▼ flatten                                                  ▼
   keyboard index  ─────────────────────────────────────▶  render rows
        │
        ▼ Enter / click
   navigate(item.target); closeCommand(); setQuery("")
```

## Error / edge handling

- No `activeModule` (Home, profile) -> no `active` section; `tools` still lists all
  modules' navigation.
- Module with empty `navigation` -> contributes nothing to `active` / `tools`, still
  listed in `modules`.
- Unknown / empty `icon` name -> `resolveModuleIcon` returns `Box`;
  `getModuleIconComponent` returns `null` so `ModuleIcon` shows gradient initials.
- Offline -> non-offline modules and their actions render `blocked` (grey, `WifiOff`,
  not navigable), matching current module-row behavior; now also applied to action
  rows.
- Very long list (empty query, ~15 modules x ~4 nav) -> existing
  `max-h-[50dvh] overflow-y-auto` container; selected row auto-scrolls
  (`scrollIntoView`, already present).

## Testing — `apps/desktop/src/lib/__tests__/commandPalette.test.js` (`node --test`)

- `scoreMatch`: exact > prefix > word-boundary > substring > 0; diacritic + case
  insensitive (`"empresa"` matches `"Empresás"`).
- `scoreItem`: title hit outranks subtitle hit; keyword (module key) hit contributes;
  empty query -> 0.
- `buildCommandItems`:
  - empty query -> `active` (when `activeModule` given) then `modules` then `tools`
    then `pages`; every available module present in `modules`; active module absent
    from `tools`, present in `modules`.
  - no `activeModule` -> no `active` section.
  - query `"empres"` -> Empresa module ranks in `modules`; unrelated modules dropped.
  - `target` correctness: root nav -> `/app/m/{key}`; sub nav -> `/app/m/{key}{path}`.
  - offline: `isOffline` + `offlineModuleKeys` -> non-offline module/action items
    `blocked: true`, offline-allowed ones `blocked: false`.
  - module with no navigation -> still in `modules`, contributes no `tools` rows.
- Icon registry (`resolveModuleIcon`) is not unit-tested (JSX file, no JSX-capable
  runner in the repo); it is a thin merge of three existing implementations and is
  covered by `pnpm build` + in-app use.

## Verification

- `pnpm --filter @atlas/ui build` (or root `pnpm build`) green.
- `pnpm lint` green.
- `node --test apps/desktop/src/lib/__tests__/commandPalette.test.js` green.
- Manual: `Ctrl+K` from Home shows all modules with correct icons + subtitles and a
  `Herramientas` section; from inside a module the `Acciones — {module}` section is on
  top; typing a module / page name ranks the expected row first; offline greys the
  right rows.

## Files touched

- `packages/ui/src/components/module-icon-registry.jsx` — new.
- `packages/ui/src/components/ModuleSidebar.jsx` — use shared registry; re-export
  `FleetVehicleIcon`.
- `packages/ui/src/index.js` — new exports; move `FleetVehicleIcon` origin.
- `apps/desktop/src/components/ModuleCard.jsx` — use `getModuleIconComponent`;
  re-export `MODULE_ICON_REGISTRY` from `@atlas/ui`.
- `apps/desktop/src/components/CommandPalette.jsx` — rewrite result building +
  rendering against `buildCommandItems` and the shared icons.
- `apps/desktop/src/lib/commandPalette.js` — new.
- `apps/desktop/src/lib/__tests__/commandPalette.test.js` — new.
- `docs/ai-context/ame3-runtime-capabilities.md` — note the shared `ModuleNavIcon` /
  `resolveModuleIcon` under the components table.
