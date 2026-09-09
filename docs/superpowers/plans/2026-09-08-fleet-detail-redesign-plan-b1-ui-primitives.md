# Fleet detail redesign — Plan B1 (@atlas/ui primitives) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the reusable pieces the redesigned detail presentation is built from — a pure helper module (`detail-presentation.js`, unit-tested), a `DetailHero` component, and a responsive `StatStrip` component — and export the two components from `@atlas/ui`. Nothing wires them into `AtlasDetail` yet (that is Plan B2).

**Architecture:** The helpers turn a detail blueprint `schema` + a record object into plain view-models (hero model, KPI item list, section partition). They live in `packages/ui/src/atlas-renderer/` next to `AtlasDetail.jsx` and reuse `resolveColorHex` from `atlas-form-utils.js`. The two components are presentational only — they take fully-resolved props and render Atlas glass/token styling; no data fetching, no blueprint knowledge.

**Tech Stack:** React 18, Tailwind (Atlas `hsl(var(--*))` tokens + `glass`), lucide-react, `class-variance-authority`, `node:test`.

**Spec:** `docs/superpowers/specs/2026-09-08-fleet-detail-presentation-redesign.md`

---

## File structure

| File | Responsibility |
|---|---|
| `packages/ui/src/atlas-renderer/detail-presentation.js` | pure: `getByPath`, `replacePathTokens`, `buildChipList`, `resolveHeroModel`, `resolveKpis`, `splitSectionsByColumn` |
| `packages/ui/src/atlas-renderer/__tests__/detail-presentation.test.js` | unit tests for all six helpers |
| `packages/ui/src/components/DetailHero.jsx` | presentational hero: image/fallback + title + subtitle + status + chips + actions |
| `packages/ui/src/components/StatStrip.jsx` | presentational KPI strip: grid on `sm+`, snap-scroll carousel on mobile |
| `packages/ui/src/index.js` | add two `export { ... }` lines |

---

### Task 1: `detail-presentation.js` helpers (TDD)

**Files:**
- Create: `packages/ui/src/atlas-renderer/detail-presentation.js`
- Test: `packages/ui/src/atlas-renderer/__tests__/detail-presentation.test.js`

- [ ] **Step 1: Write the failing test**

Create `packages/ui/src/atlas-renderer/__tests__/detail-presentation.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import {
  getByPath,
  replacePathTokens,
  buildChipList,
  resolveHeroModel,
  resolveKpis,
  splitSectionsByColumn,
} from "../detail-presentation.js";

test("getByPath reads dotted paths and tolerates gaps", () => {
  const obj = { a: { b: { c: 3 } }, x: null };
  assert.equal(getByPath(obj, "a.b.c"), 3);
  assert.equal(getByPath(obj, "a.z.c"), undefined);
  assert.equal(getByPath(obj, "x.y"), undefined);
  assert.equal(getByPath(obj, ""), undefined);
});

test("replacePathTokens replaces primitive tokens and skips objects", () => {
  const out = replacePathTokens("/app/drivers/:driver_id/x/:id", {
    driver_id: "d 1",
    id: "v1",
    obj: { nope: true },
  });
  assert.equal(out, "/app/drivers/d%201/x/v1");
});

test("buildChipList drops empty fields and shapes a color chip", () => {
  const chips = buildChipList(
    [
      { field: "vehicle_type_name", label: "Tipo", icon: "Layers" },
      { field: "missing", label: "X" },
      { field: "color", label: "Color", type: "color" },
    ],
    { vehicle_type_name: "Pick Up", color: "Verde Oliva" },
  );
  assert.equal(chips.length, 2);
  assert.deepEqual(
    { key: chips[0].key, label: chips[0].label, value: chips[0].value, icon: chips[0].icon },
    { key: "vehicle_type_name", label: "Tipo", value: "Pick Up", icon: "Layers" },
  );
  assert.equal(chips[1].type, "color");
  assert.ok("colorHex" in chips[1]);
});

test("resolveHeroModel returns null without schema.hero", () => {
  assert.equal(resolveHeroModel({}, { plate: "X" }), null);
});

test("resolveHeroModel builds title, joined subtitle, image + accent", () => {
  const schema = {
    hero: {
      titleField: "plate",
      subtitleFields: ["vehicle_brand_name", "vehicle_model_year"],
      statusField: "status",
      imageField: "cover_image_file_asset_id",
      imageDocsPath: "/fleet/vehicles/:id/documents",
      fallbackIcon: "Truck",
      accentColorField: "color",
      metaChips: [{ field: "vehicle_type_name", label: "Tipo" }],
    },
  };
  const model = resolveHeroModel(schema, {
    plate: "PVR-8109",
    vehicle_brand_name: "Chevrolet",
    vehicle_model_year: 2005,
    status: "active",
    cover_image_file_asset_id: "asset-1",
    color: "Verde Oliva",
    vehicle_type_name: "Pick Up",
  });
  assert.equal(model.title, "PVR-8109");
  assert.equal(model.subtitle, "Chevrolet · 2005");
  assert.equal(model.statusValue, "active");
  assert.equal(model.imageAssetId, "asset-1");
  assert.equal(model.imageDocsPath, "/fleet/vehicles/:id/documents");
  assert.equal(model.fallbackIcon, "Truck");
  assert.equal(model.chips.length, 1);
  assert.equal(model.statusMap, null);
});

test("resolveHeroModel keeps statusMap and defaults fallbackIcon", () => {
  const model = resolveHeroModel(
    { hero: { titleField: "insurer_name", statusField: "is_active", statusMap: { true: "Vigente", false: "Vencida" } } },
    { insurer_name: "AXA", is_active: true },
  );
  assert.equal(model.imageAssetId, null);
  assert.equal(model.fallbackIcon, "FileText");
  assert.deepEqual(model.statusMap, { true: "Vigente", false: "Vencida" });
  assert.equal(model.statusValue, true);
});

test("resolveKpis maps fields, types and href tokens", () => {
  const items = resolveKpis(
    {
      kpis: [
        { label: "Matricula", field: "plate", icon: "Hash" },
        { label: "Operador", field: "driver_name", hrefTemplate: "/app/m/atlas.fleet/drivers/:driver_id" },
        { label: "Poliza", field: "active_insurance_policy.expiry_date", type: "date" },
      ],
    },
    { plate: "PVR-8109", driver_name: "Jesus B.", driver_id: "d1", active_insurance_policy: { expiry_date: "2027-04-10" } },
  );
  assert.equal(items.length, 3);
  assert.equal(items[0].rawValue, "PVR-8109");
  assert.equal(items[0].type, "text");
  assert.equal(items[1].href, "/app/m/atlas.fleet/drivers/d1");
  assert.equal(items[2].rawValue, "2027-04-10");
  assert.equal(items[2].type, "date");
});

test("resolveKpis returns [] without schema.kpis", () => {
  assert.deepEqual(resolveKpis({}, {}), []);
});

test("splitSectionsByColumn: layout off keeps one list", () => {
  const sections = [{ id: "a" }, { id: "b", column: "aside" }];
  const r = splitSectionsByColumn(sections, undefined);
  assert.equal(r.twoColumn, false);
  assert.equal(r.main.length, 2);
  assert.equal(r.aside.length, 0);
});

test("splitSectionsByColumn: two-column partitions by section.column", () => {
  const sections = [
    { id: "spec" },
    { id: "driver", column: "aside" },
    { id: "fin", column: "main" },
    { id: "docs", column: "aside" },
  ];
  const r = splitSectionsByColumn(sections, "two-column");
  assert.equal(r.twoColumn, true);
  assert.deepEqual(r.main.map((s) => s.id), ["spec", "fin"]);
  assert.deepEqual(r.aside.map((s) => s.id), ["driver", "docs"]);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test packages/ui/src/atlas-renderer/__tests__/detail-presentation.test.js`
Expected: FAIL — `Cannot find module '../detail-presentation.js'`.

- [ ] **Step 3: Write the implementation**

Create `packages/ui/src/atlas-renderer/detail-presentation.js`:

```js
// Pure view-model helpers for the opt-in AtlasDetail presentation layer
// (hero + KPI strip + two-column body). No React, no fetching, no side effects.
import { resolveColorHex } from "./atlas-form-utils.js";

export function getByPath(value, path) {
  if (!path || typeof path !== "string") return undefined;
  return path
    .split(".")
    .reduce(
      (cursor, segment) =>
        cursor && typeof cursor === "object" ? cursor[segment] : undefined,
      value,
    );
}

export function replacePathTokens(pathTemplate, tokenMap) {
  let path = String(pathTemplate ?? "");
  for (const [key, rawValue] of Object.entries(tokenMap ?? {})) {
    if (rawValue === null || rawValue === undefined) continue;
    if (typeof rawValue === "object") continue;
    const safeValue = encodeURIComponent(String(rawValue).trim());
    path = path.replace(new RegExp(`:${key}\\b`, "g"), safeValue);
  }
  return path;
}

function isEmpty(value) {
  return value === undefined || value === null || String(value).trim() === "";
}

export function buildChipList(chipDefs, record) {
  return (Array.isArray(chipDefs) ? chipDefs : [])
    .map((def) => {
      if (!def || typeof def !== "object" || !def.field) return null;
      const raw = getByPath(record, def.field);
      if (isEmpty(raw)) return null;
      const chip = {
        key: def.field,
        label: def.label ? String(def.label) : null,
        value: raw,
        type: def.type ?? "text",
        icon:
          typeof def.icon === "string" && def.icon.trim() ? def.icon.trim() : null,
      };
      if (chip.type === "color") chip.colorHex = resolveColorHex(String(raw));
      return chip;
    })
    .filter(Boolean);
}

export function resolveHeroModel(schema, record) {
  const hero = schema?.hero;
  if (!hero || typeof hero !== "object") return null;

  const titleRaw = hero.titleField ? getByPath(record, hero.titleField) : null;
  const subtitle = (Array.isArray(hero.subtitleFields) ? hero.subtitleFields : [])
    .map((field) => getByPath(record, field))
    .filter((value) => !isEmpty(value))
    .map((value) => String(value))
    .join(" · ");

  const statusValue = hero.statusField
    ? (getByPath(record, hero.statusField) ?? null)
    : null;
  const imageRaw = hero.imageField ? getByPath(record, hero.imageField) : null;
  const accentRaw = hero.accentColorField
    ? getByPath(record, hero.accentColorField)
    : null;

  return {
    title: isEmpty(titleRaw) ? "" : String(titleRaw),
    subtitle,
    statusValue,
    statusMap:
      hero.statusMap && typeof hero.statusMap === "object"
        ? hero.statusMap
        : null,
    imageAssetId: isEmpty(imageRaw) ? null : String(imageRaw),
    imageDocsPath:
      typeof hero.imageDocsPath === "string" && hero.imageDocsPath.trim()
        ? hero.imageDocsPath.trim()
        : null,
    fallbackIcon:
      typeof hero.fallbackIcon === "string" && hero.fallbackIcon.trim()
        ? hero.fallbackIcon.trim()
        : "FileText",
    accentHex: isEmpty(accentRaw) ? null : resolveColorHex(String(accentRaw)),
    chips: buildChipList(hero.metaChips, record),
  };
}

function primitiveTokenMap(record) {
  const out = {};
  for (const [key, value] of Object.entries(
    record && typeof record === "object" ? record : {},
  )) {
    if (value === null || value === undefined) continue;
    if (typeof value === "object") continue;
    out[key] = value;
  }
  if (record && record.id !== undefined) out.id = record.id;
  return out;
}

export function resolveKpis(schema, record) {
  const defs = Array.isArray(schema?.kpis) ? schema.kpis : [];
  const tokenMap = primitiveTokenMap(record);
  return defs
    .map((def, index) => {
      if (!def || typeof def !== "object") return null;
      const raw = def.field ? getByPath(record, def.field) : undefined;
      let href = null;
      if (def.hrefTemplate) {
        const candidate = replacePathTokens(def.hrefTemplate, tokenMap);
        href = candidate.includes(":") ? null : candidate;
      }
      return {
        key: def.field ? String(def.field) : `kpi-${index}`,
        label: def.label ? String(def.label) : String(def.field ?? ""),
        rawValue: raw === undefined ? null : raw,
        type: def.type ? String(def.type) : "text",
        icon:
          typeof def.icon === "string" && def.icon.trim() ? def.icon.trim() : null,
        href,
      };
    })
    .filter(Boolean);
}

export function splitSectionsByColumn(sections, layout) {
  const list = Array.isArray(sections) ? sections : [];
  if (String(layout ?? "") !== "two-column") {
    return { twoColumn: false, main: list, aside: [] };
  }
  const main = [];
  const aside = [];
  for (const section of list) {
    if (section?.column === "aside") aside.push(section);
    else main.push(section);
  }
  return { twoColumn: true, main, aside };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test packages/ui/src/atlas-renderer/__tests__/detail-presentation.test.js`
Expected: PASS (11 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/atlas-renderer/detail-presentation.js packages/ui/src/atlas-renderer/__tests__/detail-presentation.test.js
git commit -m "feat(ui): detail-presentation helpers for AtlasDetail hero/kpi/layout

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: `DetailHero` component

**Files:**
- Create: `packages/ui/src/components/DetailHero.jsx`

- [ ] **Step 1: Write the component**

Create `packages/ui/src/components/DetailHero.jsx`:

```jsx
import * as LucideIcons from "lucide-react";
import { Card } from "./Card.jsx";
import { Skeleton } from "./Skeleton.jsx";
import { cn } from "../lib/utils.js";

function GlyphIcon({ name, className, fallback = "FileText" }) {
  const Icon =
    (name && LucideIcons[name]) || LucideIcons[fallback] || LucideIcons.FileText;
  return <Icon className={className} aria-hidden="true" />;
}

// Presentational only. All props are fully resolved by the caller.
//   title       string
//   subtitle    string ("" hides it)
//   statusNode  ReactNode | null   (a pill/badge)
//   imageUrl    string | null
//   imageLoading bool
//   fallbackIcon string   (lucide icon name)
//   accentHex   string | null   (tints the fallback panel)
//   chips       [{ key, label, value, icon, type, colorHex }]
//   actions     ReactNode | null
export function DetailHero({
  title,
  subtitle,
  statusNode,
  imageUrl,
  imageLoading,
  fallbackIcon,
  accentHex,
  chips,
  actions,
}) {
  const chipList = Array.isArray(chips) ? chips : [];
  return (
    <Card variant="default" className="overflow-hidden p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:gap-5">
        <div className="w-full shrink-0 sm:w-56">
          <div className="relative aspect-[16/9] overflow-hidden rounded-2xl border border-[hsl(var(--border))] sm:aspect-[4/3]">
            {imageLoading ? (
              <Skeleton className="h-full w-full" />
            ) : imageUrl ? (
              <img
                src={imageUrl}
                alt={title ? `Imagen de ${title}` : "Imagen"}
                className="h-full w-full object-cover"
              />
            ) : (
              <div
                className="flex h-full w-full items-center justify-center bg-[hsl(var(--muted))]"
                style={
                  accentHex
                    ? {
                        backgroundImage: `radial-gradient(circle at 50% 38%, ${accentHex}33, transparent 70%)`,
                      }
                    : undefined
                }
              >
                <GlyphIcon
                  name={fallbackIcon}
                  className="h-14 w-14 text-[hsl(var(--muted-foreground))]"
                />
              </div>
            )}
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <h1 className="text-2xl font-bold tracking-tight text-[hsl(var(--foreground))]">
              {title || "—"}
            </h1>
            {statusNode}
          </div>

          {subtitle ? (
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              {subtitle}
            </p>
          ) : null}

          {chipList.length > 0 ? (
            <div className="mt-1 flex flex-wrap gap-2">
              {chipList.map((chip) => (
                <span
                  key={chip.key}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2.5 py-1 text-xs text-[hsl(var(--foreground))]"
                >
                  {chip.icon ? (
                    <GlyphIcon
                      name={chip.icon}
                      className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]"
                    />
                  ) : null}
                  {chip.label ? (
                    <span className="text-[hsl(var(--muted-foreground))]">
                      {chip.label}:
                    </span>
                  ) : null}
                  {chip.type === "color" && chip.colorHex ? (
                    <span
                      className="inline-block h-3 w-3 rounded-full border border-[hsl(var(--border))]"
                      style={{ backgroundColor: chip.colorHex }}
                    />
                  ) : null}
                  <span className="font-medium">{String(chip.value)}</span>
                </span>
              ))}
            </div>
          ) : null}

          {actions ? (
            <div className="mt-3 flex flex-wrap items-center gap-2 sm:mt-auto sm:justify-end">
              {actions}
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
```

- [ ] **Step 2: Syntax check**

Run: `node --check packages/ui/src/components/DetailHero.jsx`
Expected: `node --check` does not parse JSX — instead rely on Step 3 (Task 4 build). Skip if it errors on JSX; proceed.

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/components/DetailHero.jsx
git commit -m "feat(ui): DetailHero presentational component

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: `StatStrip` component

**Files:**
- Create: `packages/ui/src/components/StatStrip.jsx`

- [ ] **Step 1: Write the component**

Create `packages/ui/src/components/StatStrip.jsx`:

```jsx
import * as LucideIcons from "lucide-react";
import { Card } from "./Card.jsx";
import { cn } from "../lib/utils.js";

function StatIcon({ name, className }) {
  const Icon = name && LucideIcons[name];
  if (!Icon) return null;
  return <Icon className={className} aria-hidden="true" />;
}

// Responsive key-figures strip.
//   items: [{ key, label, value (ReactNode), icon (lucide name), href }]
// Mobile: horizontal snap-scroll carousel. sm+: 3-up grid. lg+: 6-up grid.
export function StatStrip({ items, className }) {
  const list = Array.isArray(items) ? items.filter(Boolean) : [];
  if (list.length === 0) return null;

  return (
    <div
      className={cn(
        "flex gap-3 overflow-x-auto pb-1 snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        "sm:grid sm:grid-cols-3 sm:overflow-visible lg:grid-cols-6",
        className,
      )}
    >
      {list.map((item) => {
        const body = (
          <Card
            variant="solid"
            className="flex h-full min-w-[150px] snap-start flex-col justify-between gap-2 p-3 sm:min-w-0"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                {item.label}
              </span>
              <StatIcon
                name={item.icon}
                className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--muted-foreground))]"
              />
            </div>
            <span className="block truncate text-sm font-semibold text-[hsl(var(--foreground))]">
              {item.value}
            </span>
          </Card>
        );

        if (item.href) {
          return (
            <a
              key={item.key}
              href={item.href}
              className="block shrink-0 snap-start rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] sm:shrink"
            >
              {body}
            </a>
          );
        }
        return (
          <div key={item.key} className="shrink-0 snap-start sm:shrink">
            {body}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/ui/src/components/StatStrip.jsx
git commit -m "feat(ui): StatStrip responsive key-figures strip

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Export from `@atlas/ui` + build

**Files:**
- Modify: `packages/ui/src/index.js`

- [ ] **Step 1: Add the exports**

In `packages/ui/src/index.js`, find:

```js
export { StatCard } from "./components/StatCard.jsx";
```

Replace with:

```js
export { StatCard } from "./components/StatCard.jsx";
export { StatStrip } from "./components/StatStrip.jsx";
export { DetailHero } from "./components/DetailHero.jsx";
```

- [ ] **Step 2: Run the @atlas/ui renderer test suite (no regression)**

Run: `node --test packages/ui/src/atlas-renderer/__tests__/`
Expected: PASS — `renderer-adapters.test.js` + the new `detail-presentation.test.js`.

- [ ] **Step 3: Build the web app (compiles @atlas/ui, catches JSX/import errors)**

Run: `pnpm --filter @atlas/desktop build:web`
Expected: build succeeds. `DetailHero` / `StatStrip` are exported but not yet imported anywhere, so this only proves they compile.

- [ ] **Step 4: Lint**

Run: `pnpm lint`
Expected: no new errors from the three new files. (`pnpm lint` = `eslint .` at repo root.)

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/index.js
git commit -m "feat(ui): export DetailHero + StatStrip

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Self-review

- **Spec coverage:** spec "New `DetailHero` component" = Task 2; "New `StatStrip` component" = Task 3; "detail-presentation.js NEW — pure helpers … (unit-tested)" = Task 1; index export line in the spec's file table = Task 4. Covered.
- **Placeholders:** none — every file is given in full, every command has an expected result. Task 2 Step 2 acknowledges `node --check` cannot parse JSX and defers to the build.
- **Type consistency:** helper names (`resolveHeroModel`, `resolveKpis`, `splitSectionsByColumn`, `buildChipList`, `getByPath`, `replacePathTokens`) and their return-object keys (`imageAssetId`, `imageDocsPath`, `statusValue`, `statusMap`, `accentHex`, `chips`, `twoColumn`, `main`, `aside`; KPI item `{ key, label, rawValue, type, icon, href }`) are exactly what Plan B2 consumes. `DetailHero` prop names (`imageUrl`, `imageLoading`, `fallbackIcon`, `accentHex`, `statusNode`, `chips`, `actions`) and `StatStrip` item shape (`{ key, label, value, icon, href }`) match Plan B2's `HeroContainer`.
