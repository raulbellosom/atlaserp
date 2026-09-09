# Fleet detail redesign — Plan B2 (wiring + blueprints) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the Plan B1 primitives into `AtlasDetail` behind opt-in blueprint keys, let `AtlasCrudView` hand the hero its page actions, and turn the keys on for the fleet vehicle / driver / insurance detail blueprints.

**Architecture:** `AtlasDetail` reads `schema.hero`, `schema.kpis`, `schema.layout` (all optional — absent = today's behaviour). When `schema.hero` is set it renders `DetailHero` + `StatStrip` at the top (an internal `HeroContainer` resolves the image signed URL by the same `fetch` pattern the file already uses) and `AtlasCrudView` stops rendering its own compact `PageHeader` for that detail, passing the Volver / header-action / Editar buttons into the hero instead. `schema.layout: "two-column"` splits sections by `section.column` into a main + aside grid on `lg`. Relation-card sections gain an optional avatar and tap-to-call buttons.

**Tech Stack:** React 18, `@atlas/ui`, Tailwind Atlas tokens, lucide-react.

**Spec:** `docs/superpowers/specs/2026-09-08-fleet-detail-presentation-redesign.md`
**Depends on:** Plan A (getVehicle fields), Plan B1 (`detail-presentation.js`, `DetailHero`, `StatStrip`).

---

## File structure

| File | Change |
|---|---|
| `packages/ui/src/atlas-renderer/AtlasDetail.jsx` | imports; module helpers; `HeroContainer`; hero + KPI + two-column render; relation-card avatar/call; new `heroActions` prop |
| `packages/ui/src/atlas-renderer/AtlasCrudView.jsx` | suppress `PageHeader` + pass `onBack`/`heroActions` when `schema.hero` set |
| `apps/desktop/src/modules/atlas.fleet/screens/VehiclesScreen.jsx` | `VEHICLE_DETAIL.schema` hero + kpis + `layout` + section `column` + relation-card avatar/contactActions |
| `apps/desktop/src/modules/atlas.fleet/screens/DriversScreen.jsx` | `DRIVER_DETAIL.schema` hero + kpis |
| `apps/desktop/src/modules/atlas.fleet/screens/InsuranceScreen.jsx` | `INSURANCE_DETAIL.schema` hero + kpis |
| `docs/ai-context/ame3-runtime-capabilities.md` | document new components + schema keys |

---

### Task 1: `AtlasDetail` — imports, module helpers, `HeroContainer`

**Files:**
- Modify: `packages/ui/src/atlas-renderer/AtlasDetail.jsx`

- [ ] **Step 1: Extend the imports**

Find (lines ~24-32):

```js
import * as LucideIcons from "lucide-react";
import { LoadingState } from "../components/LoadingState.jsx";
import { Alert, AlertDescription, AlertTitle } from "../components/Alert.jsx";
import { Button } from "../components/Button.jsx";
import { AttachmentsPanel } from "../components/AttachmentsPanel.jsx";
import { MarkdownViewer } from "../components/MarkdownViewer.jsx";
import { normalizeSpanishLabel } from "./renderer-adapters.js";
import { resolveColorHex } from "./atlas-form-utils.js";
import { CostsSummaryPanel } from "./CostsSummaryPanel.jsx";
```

Replace with:

```js
import * as LucideIcons from "lucide-react";
import { LoadingState } from "../components/LoadingState.jsx";
import { Alert, AlertDescription, AlertTitle } from "../components/Alert.jsx";
import { Button } from "../components/Button.jsx";
import { Badge } from "../components/Badge.jsx";
import { Avatar, AvatarImage, AvatarFallback } from "../components/Avatar.jsx";
import { AttachmentsPanel } from "../components/AttachmentsPanel.jsx";
import { MarkdownViewer } from "../components/MarkdownViewer.jsx";
import { DetailHero } from "../components/DetailHero.jsx";
import { StatStrip } from "../components/StatStrip.jsx";
import { normalizeSpanishLabel } from "./renderer-adapters.js";
import { resolveColorHex } from "./atlas-form-utils.js";
import { CostsSummaryPanel } from "./CostsSummaryPanel.jsx";
import {
  resolveHeroModel,
  resolveKpis,
  splitSectionsByColumn,
} from "./detail-presentation.js";
```

- [ ] **Step 2: Add module-scope helpers + `HeroContainer` above `function FieldLabel`**

Find:

```js
function FieldLabel({ field }) {
```

Insert immediately BEFORE it:

```js
async function fetchSignedUrl(apiBaseUrl, token, fileAssetId) {
  if (!fileAssetId) return null;
  try {
    const res = await fetch(
      joinUrl(apiBaseUrl, `/files/${encodeURIComponent(fileAssetId)}/signed-url`),
      { headers: token ? { Authorization: `Bearer ${token}` } : {} },
    );
    if (!res.ok) return null;
    const payload = parseJsonSafe(await res.text());
    return payload?.data?.signedUrl ?? payload?.data?.url ?? null;
  } catch {
    return null;
  }
}

async function fetchFirstImageAssetId(apiBaseUrl, token, docsPath, recordId) {
  if (!docsPath || !recordId) return null;
  try {
    const path = replacePathTokens(docsPath, { id: recordId });
    const res = await fetch(joinUrl(apiBaseUrl, path), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) return null;
    const rows = extractArrayPayload(parseJsonSafe(await res.text()));
    const image = rows.find((row) =>
      String(row?.file_asset?.mimeType ?? row?.mimeType ?? "")
        .toLowerCase()
        .startsWith("image/"),
    );
    return image?.file_asset_id ?? image?.fileAssetId ?? null;
  } catch {
    return null;
  }
}

function initialsFromName(name) {
  const full = String(name ?? "").trim();
  if (!full) return "--";
  const words = full.split(/\s+/).filter(Boolean);
  const a = words[0]?.charAt(0) ?? "";
  const b = words.length > 1 ? (words[1]?.charAt(0) ?? "") : "";
  return `${a}${b}`.toUpperCase() || "--";
}

function HeroStatus({ heroModel, data }) {
  const { statusValue, statusMap } = heroModel;
  if (statusValue === null || statusValue === undefined || statusValue === "") {
    return null;
  }
  if (statusMap) {
    const key = String(statusValue);
    const label = statusMap[key] ?? key;
    const positive = key === "true" || key === "active";
    return (
      <Badge variant={positive ? "success" : "destructive"}>{label}</Badge>
    );
  }
  return renderValue({ type: "text" }, statusValue, data);
}

function HeroContainer({ heroModel, kpiItems, data, apiBaseUrl, token, actions }) {
  const [imageUrl, setImageUrl] = useState(null);
  const [imageLoading, setImageLoading] = useState(
    Boolean(heroModel.imageAssetId || heroModel.imageDocsPath),
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      let assetId = heroModel.imageAssetId;
      if (!assetId && heroModel.imageDocsPath) {
        assetId = await fetchFirstImageAssetId(
          apiBaseUrl,
          token,
          heroModel.imageDocsPath,
          data?.id,
        );
      }
      if (!assetId) {
        if (!cancelled) {
          setImageUrl(null);
          setImageLoading(false);
        }
        return;
      }
      const url = await fetchSignedUrl(apiBaseUrl, token, assetId);
      if (!cancelled) {
        setImageUrl(url);
        setImageLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [
    apiBaseUrl,
    token,
    heroModel.imageAssetId,
    heroModel.imageDocsPath,
    data?.id,
  ]);

  const kpiRenderItems = kpiItems.map((item) => ({
    key: item.key,
    label: item.label,
    icon: item.icon,
    href: item.href,
    value: renderValue({ type: item.type }, item.rawValue, data),
  }));

  return (
    <div className="space-y-4">
      <DetailHero
        title={heroModel.title}
        subtitle={heroModel.subtitle}
        statusNode={<HeroStatus heroModel={heroModel} data={data} />}
        imageUrl={imageUrl}
        imageLoading={imageLoading}
        fallbackIcon={heroModel.fallbackIcon}
        accentHex={heroModel.accentHex}
        chips={heroModel.chips}
        actions={actions}
      />
      {kpiRenderItems.length > 0 ? <StatStrip items={kpiRenderItems} /> : null}
    </div>
  );
}
```

Note: `joinUrl`, `replacePathTokens`, `parseJsonSafe`, `extractArrayPayload`, `renderValue` are all already defined at module scope earlier in this file.

- [ ] **Step 3: Syntax sanity via build (JSX — `node --check` won't parse)**

Run: `pnpm --filter @atlas/desktop build:web`
Expected: build succeeds. `HeroContainer` is defined but not yet used, so this only proves it compiles and the new imports resolve.

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/atlas-renderer/AtlasDetail.jsx
git commit -m "feat(ui): AtlasDetail hero helpers + HeroContainer (not wired yet)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: `AtlasDetail` — render hero, KPI strip, two-column body

**Files:**
- Modify: `packages/ui/src/atlas-renderer/AtlasDetail.jsx` (the `export function AtlasDetail` at the end of the file)

- [ ] **Step 1: Replace the whole `AtlasDetail` function**

Find the current function (from `export function AtlasDetail({` through its closing `}` at end of file):

```js
export function AtlasDetail({
  blueprint,
  fields,
  data,
  onEdit,
  onBack,
  token,
  apiBaseUrl,
}) {
  const schema = blueprint?.schema ?? {};
  const fieldMap = useMemo(() => normalizeFieldMap(fields), [fields]);
  const sections = useMemo(
    () => normalizeSections(schema, fieldMap),
    [schema, fieldMap],
  );

  if (!data || typeof data !== "object") {
    return (
      <Alert variant="warning">
        <AlertTitle>Sin información</AlertTitle>
        <AlertDescription>
          No hay datos para mostrar en el detalle.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {(onBack || onEdit) && (
        <div className="flex items-center justify-end gap-2">
          {onBack && (
            <Button type="button" variant="outline" onClick={() => onBack?.()}>
              Volver
            </Button>
          )}
          {onEdit && (
            <Button type="button" onClick={() => onEdit?.(data)}>
              Editar
            </Button>
          )}
        </div>
      )}

      {sections.length === 0 && (
        <Alert variant="warning">
          <AlertTitle>Detalle sin secciones</AlertTitle>
          <AlertDescription>
            Esta vista no tiene <code>schema.sections</code> configurado.
          </AlertDescription>
        </Alert>
      )}

      {sections.map((section) => (
        <div key={section.id} className="space-y-4">
          {section.title ? (
            <div className="pb-3 border-b border-[hsl(var(--border))] flex items-center gap-2">
              {(() => {
                const SectionIcon = section.icon
                  ? LucideIcons[section.icon]
                  : null;
                return SectionIcon ? (
                  <SectionIcon className="h-4 w-4 shrink-0 text-[hsl(var(--muted-foreground))]" />
                ) : null;
              })()}
              <h4 className="text-sm font-semibold text-[hsl(var(--foreground))]">
                {section.title}
              </h4>
            </div>
          ) : null}

          {section.type === "attachments" ? (
            <AttachmentsPanel
              apiBaseUrl={apiBaseUrl}
              token={token}
              recordId={data?.id ?? null}
              config={section.attachments ?? {}}
              context="detail"
              readOnly
              showHeading={false}
            />
          ) : null}

          {section.type === "relation-card" ? (
            <RelationCardSection section={section} data={data} />
          ) : null}

          {section.type === "relation-list" ? (
            <RelationListSection
              section={section}
              data={data}
              apiBaseUrl={apiBaseUrl}
              token={token}
            />
          ) : null}

          {section.type === "fields" ? (
            <div className="space-y-4">
              <dl className={gridClass(section.columns)}>
                {section.fields.map((fieldName) => {
                  const field = fieldMap.get(fieldName);
                  if (!field) return null;
                  if (
                    field.visibleWhen &&
                    !matchesFieldRule(field.visibleWhen, data)
                  )
                    return null;
                  if (
                    field.hiddenWhen &&
                    matchesFieldRule(field.hiddenWhen, data)
                  )
                    return null;
                  const value = data[field.name];
                  const isMarkdown = field.type === "markdown";
                  const strValue =
                    value != null && value !== "" ? String(value) : null;
                  return (
                    <div
                      key={field.name}
                      className={`space-y-1.5${isMarkdown ? " col-span-full" : ""}`}
                    >
                      <dt className="text-xs font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                        <FieldLabel field={field} />
                      </dt>
                      <dd className="text-sm text-[hsl(var(--foreground))]">
                        {isMarkdown ? (
                          strValue ? (
                            <MarkdownViewer value={strValue} />
                          ) : (
                            <span className="text-[hsl(var(--muted-foreground))]">
                              —
                            </span>
                          )
                        ) : (
                          renderValue(field, value, data)
                        )}
                      </dd>
                    </div>
                  );
                })}
              </dl>
              {section.fields.includes("labor_cost") &&
              section.fields.includes("parts_cost") &&
              section.fields.includes("total_cost") ? (
                <CostsSummaryPanel
                  laborCost={data.labor_cost ?? 0}
                  partsCost={data.parts_cost ?? 0}
                  totalCost={data.total_cost ?? 0}
                />
              ) : null}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
```

Replace it wholesale with:

```js
export function AtlasDetail({
  blueprint,
  fields,
  data,
  onEdit,
  onBack,
  heroActions,
  token,
  apiBaseUrl,
}) {
  const schema = blueprint?.schema ?? {};
  const fieldMap = useMemo(() => normalizeFieldMap(fields), [fields]);
  const sections = useMemo(
    () => normalizeSections(schema, fieldMap),
    [schema, fieldMap],
  );
  const heroModel = useMemo(
    () => (data && typeof data === "object" ? resolveHeroModel(schema, data) : null),
    [schema, data],
  );
  const kpiItems = useMemo(
    () => (data && typeof data === "object" ? resolveKpis(schema, data) : []),
    [schema, data],
  );
  const { twoColumn, main: mainSections, aside: asideSections } = useMemo(
    () => splitSectionsByColumn(sections, schema?.layout),
    [sections, schema?.layout],
  );

  if (!data || typeof data !== "object") {
    return (
      <Alert variant="warning">
        <AlertTitle>Sin información</AlertTitle>
        <AlertDescription>
          No hay datos para mostrar en el detalle.
        </AlertDescription>
      </Alert>
    );
  }

  const fallbackActions =
    onBack || onEdit ? (
      <>
        {onBack && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onBack?.()}
          >
            Volver
          </Button>
        )}
        {onEdit && (
          <Button type="button" size="sm" onClick={() => onEdit?.(data)}>
            Editar
          </Button>
        )}
      </>
    ) : null;

  const renderSection = (section) => (
    <div key={section.id} className="space-y-4">
      {section.title ? (
        <div className="pb-3 border-b border-[hsl(var(--border))] flex items-center gap-2">
          {(() => {
            const SectionIcon = section.icon ? LucideIcons[section.icon] : null;
            return SectionIcon ? (
              <SectionIcon className="h-4 w-4 shrink-0 text-[hsl(var(--muted-foreground))]" />
            ) : null;
          })()}
          <h4 className="text-sm font-semibold text-[hsl(var(--foreground))]">
            {section.title}
          </h4>
        </div>
      ) : null}

      {section.type === "attachments" ? (
        <AttachmentsPanel
          apiBaseUrl={apiBaseUrl}
          token={token}
          recordId={data?.id ?? null}
          config={section.attachments ?? {}}
          context="detail"
          readOnly
          showHeading={false}
        />
      ) : null}

      {section.type === "relation-card" ? (
        <RelationCardSection
          section={section}
          data={data}
          apiBaseUrl={apiBaseUrl}
          token={token}
        />
      ) : null}

      {section.type === "relation-list" ? (
        <RelationListSection
          section={section}
          data={data}
          apiBaseUrl={apiBaseUrl}
          token={token}
        />
      ) : null}

      {section.type === "fields" ? (
        <div className="space-y-4">
          <dl className={gridClass(section.columns)}>
            {section.fields.map((fieldName) => {
              const field = fieldMap.get(fieldName);
              if (!field) return null;
              if (
                field.visibleWhen &&
                !matchesFieldRule(field.visibleWhen, data)
              )
                return null;
              if (field.hiddenWhen && matchesFieldRule(field.hiddenWhen, data))
                return null;
              const value = data[field.name];
              const isMarkdown = field.type === "markdown";
              const strValue =
                value != null && value !== "" ? String(value) : null;
              return (
                <div
                  key={field.name}
                  className={`space-y-1.5${isMarkdown ? " col-span-full" : ""}`}
                >
                  <dt className="text-xs font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                    <FieldLabel field={field} />
                  </dt>
                  <dd className="text-sm text-[hsl(var(--foreground))]">
                    {isMarkdown ? (
                      strValue ? (
                        <MarkdownViewer value={strValue} />
                      ) : (
                        <span className="text-[hsl(var(--muted-foreground))]">
                          —
                        </span>
                      )
                    ) : (
                      renderValue(field, value, data)
                    )}
                  </dd>
                </div>
              );
            })}
          </dl>
          {section.fields.includes("labor_cost") &&
          section.fields.includes("parts_cost") &&
          section.fields.includes("total_cost") ? (
            <CostsSummaryPanel
              laborCost={data.labor_cost ?? 0}
              partsCost={data.parts_cost ?? 0}
              totalCost={data.total_cost ?? 0}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );

  return (
    <div className="space-y-6">
      {heroModel ? (
        <HeroContainer
          heroModel={heroModel}
          kpiItems={kpiItems}
          data={data}
          apiBaseUrl={apiBaseUrl}
          token={token}
          actions={heroActions ?? fallbackActions}
        />
      ) : (
        (onBack || onEdit) && (
          <div className="flex items-center justify-end gap-2">
            {onBack && (
              <Button
                type="button"
                variant="outline"
                onClick={() => onBack?.()}
              >
                Volver
              </Button>
            )}
            {onEdit && (
              <Button type="button" onClick={() => onEdit?.(data)}>
                Editar
              </Button>
            )}
          </div>
        )
      )}

      {sections.length === 0 && (
        <Alert variant="warning">
          <AlertTitle>Detalle sin secciones</AlertTitle>
          <AlertDescription>
            Esta vista no tiene <code>schema.sections</code> configurado.
          </AlertDescription>
        </Alert>
      )}

      {twoColumn ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="min-w-0 space-y-6 lg:col-span-2">
            {mainSections.map(renderSection)}
          </div>
          <div className="min-w-0 space-y-6">
            {asideSections.map(renderSection)}
          </div>
        </div>
      ) : (
        <div className="space-y-6">{sections.map(renderSection)}</div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Build**

Run: `pnpm --filter @atlas/desktop build:web`
Expected: build succeeds.

- [ ] **Step 3: Renderer tests still green**

Run: `node --test packages/ui/src/atlas-renderer/__tests__/`
Expected: PASS (`renderer-adapters` + `detail-presentation`).

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/atlas-renderer/AtlasDetail.jsx
git commit -m "feat(ui): AtlasDetail renders opt-in hero + KPI strip + two-column body

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: `AtlasDetail` — relation-card avatar + tap-to-call

**Files:**
- Modify: `packages/ui/src/atlas-renderer/AtlasDetail.jsx` (`function RelationCardSection`)

- [ ] **Step 1: Replace `RelationCardSection`**

Find:

```js
function RelationCardSection({ section, data }) {
  const relationCard = section.relationCard;
  if (!relationCard?.idField) {
```

...through the end of that function (its final `}` before `function RelationListSection`). Replace the whole function with:

```js
function RelationCardSection({ section, data, apiBaseUrl, token }) {
  const relationCard = section.relationCard;
  const [avatarUrl, setAvatarUrl] = useState(null);

  const rawAvatarId = relationCard?.avatarField
    ? getByPath(data, relationCard.avatarField)
    : null;
  const avatarAssetId = normalizeTextValue(rawAvatarId) || null;

  useEffect(() => {
    let cancelled = false;
    if (!avatarAssetId) {
      setAvatarUrl(null);
      return () => {
        cancelled = true;
      };
    }
    (async () => {
      const url = await fetchSignedUrl(apiBaseUrl, token, avatarAssetId);
      if (!cancelled) setAvatarUrl(url);
    })();
    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, token, avatarAssetId]);

  if (!relationCard?.idField) {
    return (
      <div className="rounded-xl border border-dashed border-[hsl(var(--border))] px-4 py-3 text-sm text-[hsl(var(--muted-foreground))]">
        Configuración de relación no disponible.
      </div>
    );
  }

  const relatedId = getByPath(data, relationCard.idField);
  const hasRelatedId = Boolean(normalizeTextValue(relatedId));
  const rawTitle = relationCard.titleField
    ? getByPath(data, relationCard.titleField)
    : null;
  const cleanTitle = normalizeTextValue(rawTitle);

  const title = hasRelatedId
    ? cleanTitle || "Registro relacionado"
    : relationCard.fallbackTitle;

  const subtitles = (relationCard.subtitleFields ?? [])
    .map((fieldKey, idx) => {
      const raw = getByPath(data, fieldKey);
      const type = relationCard.subtitleTypes?.[idx] ?? null;
      if (raw === undefined || raw === null || raw === "") return null;
      if (type === "date") return formatDetailDate(raw, false);
      if (type === "datetime") return formatDetailDate(raw, true);
      return normalizeTextValue(raw) || null;
    })
    .filter(Boolean);

  const href =
    hasRelatedId && relationCard.hrefTemplate
      ? replacePathTokens(relationCard.hrefTemplate, { id: relatedId })
      : null;

  const contactActions = (
    Array.isArray(relationCard.contactActions) ? relationCard.contactActions : []
  )
    .map((action, idx) => {
      if (!action || action.type !== "call" || !action.field) return null;
      const phone = normalizeTextValue(getByPath(data, action.field));
      if (!phone) return null;
      return { key: `${action.field}-${idx}`, phone, label: action.label || "Llamar" };
    })
    .filter(Boolean);

  const Icon = resolveIcon(relationCard.icon) ?? Link2;
  const showAvatar = Boolean(relationCard.avatarField) && hasRelatedId;

  const media = showAvatar ? (
    <Avatar className="mt-0.5 h-9 w-9 rounded-lg">
      {avatarUrl ? (
        <AvatarImage src={avatarUrl} alt={title} className="rounded-lg" />
      ) : null}
      <AvatarFallback className="rounded-lg bg-[hsl(var(--muted))] text-xs text-[hsl(var(--muted-foreground))]">
        {initialsFromName(cleanTitle)}
      </AvatarFallback>
    </Avatar>
  ) : (
    <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]">
      <Icon size={16} />
    </span>
  );

  const inner = (
    <div className="min-w-0 space-y-1">
      <p className="text-sm font-semibold text-[hsl(var(--foreground))] truncate">
        {title}
      </p>
      {subtitles.length > 0 ? (
        <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">
          {subtitles.join(" · ")}
        </p>
      ) : null}
      {href ? (
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          Ir al detalle relacionado
        </p>
      ) : null}
    </div>
  );

  return (
    <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-3 transition-colors hover:border-[hsl(var(--ring))]">
      <div className="flex items-start gap-3">
        {media}
        {href ? (
          <a href={href} className="block min-w-0 flex-1">
            {inner}
          </a>
        ) : (
          <div className="min-w-0 flex-1">{inner}</div>
        )}
      </div>
      {contactActions.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2 pl-11">
          {contactActions.map((action) => (
            <Button key={action.key} asChild variant="outline" size="sm">
              <a href={`tel:${action.phone}`}>
                <Phone size={14} />
                {action.label}
              </a>
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
```

Note: `Phone` is already imported at the top of the file (lucide). `getByPath`, `normalizeTextValue`, `formatDetailDate`, `replacePathTokens`, `resolveIcon`, `Link2` are all already defined earlier in the file; `fetchSignedUrl` + `initialsFromName` come from Task 1; `useState` + `useEffect` are already imported.

- [ ] **Step 2: Build**

Run: `pnpm --filter @atlas/desktop build:web`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/atlas-renderer/AtlasDetail.jsx
git commit -m "feat(ui): relation-card gains optional avatar + tap-to-call

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: `AtlasCrudView` — let the hero own the page header

**Files:**
- Modify: `packages/ui/src/atlas-renderer/AtlasCrudView.jsx`

- [ ] **Step 1: Replace the detail page-mode block**

Find (the `{mode === "detail" && currentDetailBlueprint && ( ... )}` block inside the page-mode branch — starts at `{mode === "detail" && currentDetailBlueprint && (` and ends at the matching `)}` before `{mode === "edit" && currentFormBlueprint && (`):

```jsx
          {mode === "detail" && currentDetailBlueprint && (
            <>
              <PageHeader
                compact
                eyebrow={
                  currentDetailBlueprint?.schema?.title ??
                  currentDetailBlueprint?.title ??
                  null
                }
                title={
                  recordData
                    ? resolveRowLabel(recordData)
                    : (currentDetailBlueprint?.schema?.title ??
                      currentDetailBlueprint?.title ??
                      "Detalle")
                }
                actions={
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={goToList}>
                      <ArrowLeft className="mr-1.5 h-4 w-4" />
                      Volver
                    </Button>
                    {detailHeaderActions
                      .filter((action) => isActionVisible(action, recordData))
                      .map((action) => {
                        const actionKey = String(action.key ?? action.label ?? "action");
                        const variant = action.variant ?? "outline";
                        return (
                          <Button
                            key={actionKey}
                            type="button"
                            size="sm"
                            variant={variant}
                            loading={headerActionLoadingKey === actionKey}
                            onClick={() => executeHeaderAction(action)}
                          >
                            {action.label ?? "Accion"}
                          </Button>
                        );
                      })}
                    {currentFormBlueprint && (
                      <Button size="sm" onClick={() => setMode("edit")}>
                        Editar
                      </Button>
                    )}
                  </div>
                }
              />
              {renderRecordLoadingOrError() ??
                (recordData && (
                  <AtlasDetail
                    blueprint={currentDetailBlueprint}
                    fields={fields}
                    data={recordData}
                    accentColor={accentColor}
                    token={token}
                    apiBaseUrl={apiBaseUrl}
                  />
                ))}
            </>
          )}
```

Replace with:

```jsx
          {mode === "detail" && currentDetailBlueprint && (() => {
            const heroEnabled = Boolean(currentDetailBlueprint?.schema?.hero);
            const detailActions = (
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={goToList}>
                  <ArrowLeft className="mr-1.5 h-4 w-4" />
                  Volver
                </Button>
                {detailHeaderActions
                  .filter((action) => isActionVisible(action, recordData))
                  .map((action) => {
                    const actionKey = String(action.key ?? action.label ?? "action");
                    const variant = action.variant ?? "outline";
                    return (
                      <Button
                        key={actionKey}
                        type="button"
                        size="sm"
                        variant={variant}
                        loading={headerActionLoadingKey === actionKey}
                        onClick={() => executeHeaderAction(action)}
                      >
                        {action.label ?? "Accion"}
                      </Button>
                    );
                  })}
                {currentFormBlueprint && (
                  <Button size="sm" onClick={() => setMode("edit")}>
                    Editar
                  </Button>
                )}
              </div>
            );
            return (
              <>
                {!heroEnabled && (
                  <PageHeader
                    compact
                    eyebrow={
                      currentDetailBlueprint?.schema?.title ??
                      currentDetailBlueprint?.title ??
                      null
                    }
                    title={
                      recordData
                        ? resolveRowLabel(recordData)
                        : (currentDetailBlueprint?.schema?.title ??
                          currentDetailBlueprint?.title ??
                          "Detalle")
                    }
                    actions={detailActions}
                  />
                )}
                {renderRecordLoadingOrError() ??
                  (recordData && (
                    <AtlasDetail
                      blueprint={currentDetailBlueprint}
                      fields={fields}
                      data={recordData}
                      accentColor={accentColor}
                      token={token}
                      apiBaseUrl={apiBaseUrl}
                      onBack={heroEnabled ? goToList : undefined}
                      heroActions={heroEnabled ? detailActions : undefined}
                    />
                  ))}
              </>
            );
          })()}
```

- [ ] **Step 2: Build**

Run: `pnpm --filter @atlas/desktop build:web`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/atlas-renderer/AtlasCrudView.jsx
git commit -m "feat(ui): AtlasCrudView defers detail page header to the hero when configured

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: `VEHICLE_DETAIL` blueprint — hero, KPIs, two-column, driver card

**Files:**
- Modify: `apps/desktop/src/modules/atlas.fleet/screens/VehiclesScreen.jsx` (`const VEHICLE_DETAIL`)

- [ ] **Step 1: Add `hero`, `kpis`, `layout` to `VEHICLE_DETAIL.schema`**

Find:

```js
const VEHICLE_DETAIL = {
  key: "fleet.vehicle.detail",
  kind: "DETAIL",
  schema: {
    entity: "vehicle",
    component: "AtlasDetail",
    apiPath: "/fleet/vehicles",
    sections: [
      {
        label: "Identificacion del vehiculo",
        columns: 2,
```

Replace with:

```js
const VEHICLE_DETAIL = {
  key: "fleet.vehicle.detail",
  kind: "DETAIL",
  schema: {
    entity: "vehicle",
    component: "AtlasDetail",
    apiPath: "/fleet/vehicles",
    layout: "two-column",
    hero: {
      titleField: "plate",
      subtitleFields: ["vehicle_brand_name", "vehicle_model_name", "vehicle_model_year"],
      statusField: "status",
      imageField: "cover_image_file_asset_id",
      imageDocsPath: "/fleet/vehicles/:id/documents",
      fallbackIcon: "Truck",
      accentColorField: "color",
      metaChips: [
        { field: "vehicle_type_name", label: "Tipo", icon: "Layers" },
        { field: "full_economic_number", label: "No. Economico", icon: "Hash" },
        { field: "color", label: "Color", type: "color" },
      ],
    },
    kpis: [
      { label: "Matricula", field: "plate", icon: "Hash" },
      { label: "No. Economico", field: "full_economic_number", icon: "Hash" },
      { label: "Tipo", field: "vehicle_type_name", icon: "Layers" },
      { label: "Financiado", field: "is_financed", type: "boolean", icon: "Landmark" },
      {
        label: "Operador",
        field: "driver_name",
        icon: "UserCheck",
        hrefTemplate: "/app/m/atlas.fleet/drivers/:driver_id",
      },
      {
        label: "Poliza",
        field: "active_insurance_policy.expiry_date",
        type: "date",
        icon: "ShieldCheck",
      },
    ],
    sections: [
      {
        label: "Identificacion del vehiculo",
        column: "main",
        columns: 2,
```

- [ ] **Step 2: Tag the remaining `fields` sections with `column: "main"`**

Find:

```js
      {
        label: "Estado y apariencia",
        columns: 2,
```

Replace with:

```js
      {
        label: "Estado y apariencia",
        column: "main",
        columns: 2,
```

Find:

```js
      {
        label: "Financiamiento",
        columns: 2,
        fields: [
          {
            field: "is_financed",
            label: "Vehiculo financiado",
```

Replace with:

```js
      {
        label: "Financiamiento",
        column: "main",
        columns: 2,
        fields: [
          {
            field: "is_financed",
            label: "Vehiculo financiado",
```

Find:

```js
      {
        label: "Observaciones",
        fields: [
          {
            field: "notes",
            label: "Notas",
            type: "markdown",
            icon: "FileText",
          },
        ],
      },
```

Replace with:

```js
      {
        label: "Observaciones",
        column: "main",
        fields: [
          {
            field: "notes",
            label: "Notas",
            type: "markdown",
            icon: "FileText",
          },
        ],
      },
```

- [ ] **Step 3: Tag the related-record sections with `column: "aside"` and add the driver avatar + call**

Find:

```js
      {
        id: "assigned_driver",
        type: "relation-card",
        label: "Conductor asignado",
        relationCard: {
          idField: "driver_id",
          titleField: "driver_name",
          subtitleFields: ["driver_license_number", "driver_phone"],
          fallbackTitle: "Sin conductor asignado",
          hrefTemplate: "/app/m/atlas.fleet/drivers/:id",
          icon: "UserCheck",
        },
      },
```

Replace with:

```js
      {
        id: "assigned_driver",
        type: "relation-card",
        label: "Conductor asignado",
        column: "aside",
        relationCard: {
          idField: "driver_id",
          titleField: "driver_name",
          subtitleFields: ["driver_license_number", "driver_phone"],
          fallbackTitle: "Sin conductor asignado",
          hrefTemplate: "/app/m/atlas.fleet/drivers/:id",
          icon: "UserCheck",
          avatarField: "driver_photo_asset_id",
          contactActions: [
            { type: "call", field: "driver_phone", label: "Llamar" },
          ],
        },
      },
```

Find:

```js
      {
        id: "active_insurance",
        type: "relation-card",
        label: "Poliza de seguro activa",
        relationCard: {
```

Replace with:

```js
      {
        id: "active_insurance",
        type: "relation-card",
        label: "Poliza de seguro activa",
        column: "aside",
        relationCard: {
```

Find:

```js
      {
        id: "insurance_history",
        type: "relation-list",
        label: "Historial de polizas",
        relationList: {
```

Replace with:

```js
      {
        id: "insurance_history",
        type: "relation-list",
        label: "Historial de polizas",
        column: "aside",
        relationList: {
```

Find:

```js
      {
        id: "documents",
        type: "documents",
        label: "Documentos del vehiculo",
        documents: {
```

Replace with:

```js
      {
        id: "documents",
        type: "documents",
        label: "Documentos del vehiculo",
        column: "aside",
        documents: {
```

- [ ] **Step 4: Build**

Run: `pnpm --filter @atlas/desktop build:web`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/modules/atlas.fleet/screens/VehiclesScreen.jsx
git commit -m "feat(fleet): redesigned vehicle detail — hero, KPI strip, two-column, driver card

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: `DRIVER_DETAIL` + `INSURANCE_DETAIL` blueprints — hero + KPIs

**Files:**
- Modify: `apps/desktop/src/modules/atlas.fleet/screens/DriversScreen.jsx` (`const DRIVER_DETAIL`)
- Modify: `apps/desktop/src/modules/atlas.fleet/screens/InsuranceScreen.jsx` (`const INSURANCE_DETAIL`)

- [ ] **Step 1: `DRIVER_DETAIL.schema` — add `hero` + `kpis`**

In `DriversScreen.jsx`, find:

```js
const DRIVER_DETAIL = {
  key: 'fleet.driver.detail',
  kind: 'DETAIL',
  schema: {
    entity: 'driver',
    component: 'AtlasDetail',
    apiPath: '/fleet/drivers',
    sections: [
```

Replace with:

```js
const DRIVER_DETAIL = {
  key: 'fleet.driver.detail',
  kind: 'DETAIL',
  schema: {
    entity: 'driver',
    component: 'AtlasDetail',
    apiPath: '/fleet/drivers',
    hero: {
      titleField: 'full_name',
      subtitleFields: ['license_type'],
      statusField: 'status',
      imageField: 'photo_asset_id_resolved',
      fallbackIcon: 'UserRound',
      metaChips: [
        { field: 'phone', label: 'Tel', icon: 'Phone' },
        { field: 'license_number', label: 'Lic.', icon: 'Hash' },
        { field: 'license_expiry_date', label: 'Vence', type: 'date', icon: 'CalendarDays' },
      ],
    },
    kpis: [
      { label: 'Telefono', field: 'phone', icon: 'Phone' },
      { label: 'No. Licencia', field: 'license_number', icon: 'Hash' },
      { label: 'Tipo licencia', field: 'license_type', icon: 'Tag' },
      { label: 'Vencimiento', field: 'license_expiry_date', type: 'date', icon: 'CalendarDays' },
    ],
    sections: [
```

If Plan A Task 2 Step 1 found that `getDriver` does NOT return `photo_asset_id_resolved`, change `imageField: 'photo_asset_id_resolved'` to `imageField: 'photo_asset_id'` in the block above.

- [ ] **Step 2: `INSURANCE_DETAIL.schema` — add `hero` + `kpis`**

In `InsuranceScreen.jsx`, find:

```js
const INSURANCE_DETAIL = {
  key: 'fleet.insurance_policy.detail',
  kind: 'DETAIL',
```

Read the lines immediately after it to locate the `schema: {` object and its `sections: [`. Insert `hero` + `kpis` right after `apiPath: ...,` and before `sections: [`, matching the file's existing indentation and quote style:

```js
    hero: {
      titleField: 'insurer_name',
      subtitleFields: ['policy_number'],
      statusField: 'is_active',
      statusMap: { true: 'Vigente', false: 'Vencida' },
      fallbackIcon: 'ShieldCheck',
      metaChips: [
        { field: 'vehicle_plate', label: 'Vehiculo', icon: 'Truck' },
        { field: 'coverage_type_label', label: 'Cobertura', icon: 'Shield' },
        { field: 'expiry_date', label: 'Vence', type: 'date', icon: 'CalendarDays' },
      ],
    },
    kpis: [
      { label: 'Cobertura', field: 'coverage_type_label', icon: 'Shield' },
      { label: 'Prima anual', field: 'premium', type: 'currency', icon: 'DollarSign' },
      { label: 'Inicio', field: 'start_date', type: 'date', icon: 'CalendarDays' },
      { label: 'Fin vigencia', field: 'expiry_date', type: 'date', icon: 'CalendarDays' },
    ],
```

If Plan A Task 2 Step 2 found `coverage_type_label` is not returned by the single-policy getter, use `field: 'coverage_type'` in both the chip and the KPI instead.

- [ ] **Step 3: Build**

Run: `pnpm --filter @atlas/desktop build:web`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/modules/atlas.fleet/screens/DriversScreen.jsx apps/desktop/src/modules/atlas.fleet/screens/InsuranceScreen.jsx
git commit -m "feat(fleet): driver + insurance detail share the redesigned hero

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: Docs + full verification

**Files:**
- Modify: `docs/ai-context/ame3-runtime-capabilities.md`

- [ ] **Step 1: Document the new components + schema keys**

Open `docs/ai-context/ame3-runtime-capabilities.md`. Find the component-inventory table that lists `StatCard` / `SectionCard` (search for `StatCard`). Add two rows in the same format:

```
| `DetailHero` | Redesigned detail header: representative image (or a branded fallback panel tinted by an accent colour) + title + subtitle + status pill + meta chips + actions slot. Presentational; used by `AtlasDetail` when the detail blueprint declares `schema.hero`. |
| `StatStrip` | Responsive key-figures strip — a 6-up grid on desktop, a horizontal snap-scroll carousel on mobile. Used by `AtlasDetail` when the detail blueprint declares `schema.kpis`. |
```

Then find the section that documents DETAIL blueprint schema (search for `relation-card` or `AtlasDetail`). Add:

```
### Detail presentation layer (opt-in)

A DETAIL blueprint `schema` may declare any of these. Omit them all and the
detail renders as a plain section stack (unchanged).

- `schema.hero` — `{ titleField, subtitleFields[], statusField, statusMap?,
  imageField?, imageDocsPath?, fallbackIcon, accentColorField?, metaChips[] }`.
  Renders `DetailHero`. `imageField` is a file-asset id resolved to a signed URL
  client-side; if empty and `imageDocsPath` is set, the first `image/*` document
  at that path is used; otherwise the branded `fallbackIcon` panel shows.
  `statusMap` maps a raw status value (e.g. a boolean) to a label.
- `schema.kpis` — `[{ label, field, type?, icon?, hrefTemplate? }]`. Renders
  `StatStrip`. `field` supports dotted paths; values use the same formatting as
  detail fields (dates, `boolean` -> Si/No, currency, status pills).
- `schema.layout: "two-column"` + `section.column: "main" | "aside"` — on `lg+`
  the body becomes a main column (2/3) plus an aside column (1/3). Default
  `column` is `main`.
- `relation-card` `relationCard.avatarField` (file-asset id) + `relationCard.contactActions:
  [{ type: "call", field }]` — shows an avatar (initials fallback) and
  `tel:` buttons.
```

(Adjust heading level / wording to match the surrounding document.)

- [ ] **Step 2: Full test sweep**

Run: `node --test packages/ui/src/atlas-renderer/__tests__/`
Expected: PASS.

Run: `node --test apps/api/src/routes/fleet/__tests__/`
Expected: PASS (existing 28 + `vehicle-detail-fields`).

- [ ] **Step 3: Lint + build**

Run: `pnpm lint`
Expected: no new errors. If ESLint flags an unused `cn` import in `DetailHero.jsx` or `StatStrip.jsx`, remove that import line (both files use `cn`; this is only a fallback note).

Run: `pnpm --filter @atlas/desktop build:web`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add docs/ai-context/ame3-runtime-capabilities.md
git commit -m "docs(ui): document DetailHero, StatStrip, and the detail presentation schema keys

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 8: Manual browser QA (required — record results)

**Files:** none (verification). Record findings; open follow-up tasks for any defect rather than silently fixing scope creep.

- [ ] **Step 1: Start the app**

Run: `pnpm dev` (web at `http://localhost:5173`). Log in; open a company with fleet data.

- [ ] **Step 2: Vehicle detail — desktop (1440px)**

Navigate to a vehicle with an uploaded image among its documents. Verify:
- hero shows the photo on the left; title = plate; subtitle = brand + model + year; status pill; three meta chips (type, economic no., colour swatch).
- header actions (Volver / Exportar PDF / Editar) render inside the hero, top-right; no second `PageHeader` above.
- KPI strip shows 6 cells; "Operador" cell links to the driver.
- body is two columns: spec sheet / financing / observations left; driver card / active policy / history / documents right.
- driver card shows avatar (or initials) and a "Llamar" button.

- [ ] **Step 3: Vehicle detail — vehicle with NO image**

Verify the hero shows the branded fallback: muted panel faintly tinted by the vehicle colour with a large `Truck` glyph.

- [ ] **Step 4: Vehicle detail — mobile (390px)**

Verify:
- hero image is a full-width 16:9 banner; identity + chips stack below; actions are full-width and reachable.
- KPI strip is a horizontal snap-scroll carousel (no page horizontal scroll).
- body collapses to one column, aside sections after main.
- "Llamar" opens the dialer.

- [ ] **Step 5: Driver detail + Insurance detail (390 + 1440)**

Verify each shows the hero (photo/fallback, title, status, chips) + KPI strip, and the body renders as a single column (no `layout` set). Insurance status pill reads "Vigente" / "Vencida".

- [ ] **Step 6: Theme + a11y**

Toggle dark / light — hero, chips, KPI cells, fallback panel all legible. Tab through the hero actions and KPI links — focus ring visible.

- [ ] **Step 7: Record**

Note pass/fail per step in the final summary. No commit.

---

## Self-review

- **Spec coverage:**
  - "redesigned detail hero … representative image … branded fallback" → Task 1 (`HeroContainer`), Task 5 Step 1, Task 8 Steps 2-3.
  - "responsive key-figures strip" → Task 2 (`StatStrip` render), Task 5 Step 1.
  - "two-column body on desktop" → Task 2 (`splitSectionsByColumn` render), Task 5 Steps 1-3.
  - "upgraded relation card … avatar and tap-to-call" → Task 3, Task 5 Step 3.
  - "opt-in per blueprint … other modules untouched" → Task 2 (`heroModel` null → old path), Task 4 (`heroEnabled` gate).
  - "apply … to the driver and insurance detail blueprints" → Task 6.
  - "document new components + blueprint keys" → Task 7 Step 1.
  - Testing / QA sections → Task 7 Steps 2-3, Task 8.
- **Placeholders:** none. Every code step shows the full replacement. Task 6 Step 2 says "read the lines after to locate the schema object" because the exact surrounding text in `InsuranceScreen.jsx` was not quoted in the spec — the insertion content and anchor (`apiPath` … before `sections:`) are fully specified.
- **Type consistency:** `heroActions` prop (Task 2 signature ← Task 4 passes it); `onBack` already on `AtlasDetail`. `RelationCardSection` new params `apiBaseUrl, token` (Task 3 signature ← Task 2 `renderSection` call site passes them). Blueprint key names (`hero`, `kpis`, `layout`, `column`, `avatarField`, `contactActions`, `statusMap`, `imageField`, `imageDocsPath`, `fallbackIcon`, `accentColorField`, `metaChips`, `hrefTemplate`) match `detail-presentation.js` (Plan B1) exactly. Field names `cover_image_file_asset_id` / `driver_photo_asset_id` match Plan A.
