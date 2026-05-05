# Phase 7.1 Files Module Advanced UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a full Files explorer with multi-view browsing, advanced preview, origin navigation, rename, and bulk download (direct + ZIP) without breaking existing Phase 7 flows.

**Architecture:** Extend the existing files service/API and `atlas.files` SDK first, then refactor desktop Files UI into focused explorer components (`toolbar`, `views`, `viewer`, `origin resolver`) driven by one shared state hook. Keep company-scoped security and signed URL delivery as the only file-access strategy.

**Tech Stack:** Hono API, Prisma, Supabase Storage Admin SDK, React + TanStack Query, `@atlas/ui`, `@atlas/sdk`, Zod validators, optional `jszip` for server ZIP generation.

---

## File Structure Map

### API
- Modify: `apps/api/package.json`
  - Add ZIP dependency if needed (`jszip`).
- Modify: `packages/validators/src/index.js`
  - Add `fileRenameSchema` and `fileBulkDownloadSchema`.
- Modify: `apps/api/src/services/files-service.js`
  - Add `rename` and `bulkDownload` service methods.
  - Add helper functions for scoped multi-file resolution and ZIP creation.
- Modify: `apps/api/src/index.js`
  - Add `PATCH /files/:id` and `POST /files/bulk-download` routes with validator checks.

### SDK
- Modify: `packages/sdk/src/index.js`
  - Add `atlas.files.rename(...)`.
  - Add `atlas.files.bulkDownload(...)`.

### Desktop Files module
- Create: `apps/desktop/src/modules/atlas.files/lib/file-kind.js`
  - MIME family detection + icon/preview helpers.
- Create: `apps/desktop/src/modules/atlas.files/lib/file-origin-resolver.js`
  - Map file metadata to detail/origin navigation targets.
- Create: `apps/desktop/src/modules/atlas.files/hooks/useFilesExplorer.js`
  - Shared state for filters/sort/view/selection/active viewer index.
- Create: `apps/desktop/src/modules/atlas.files/components/FilesToolbar.jsx`
- Create: `apps/desktop/src/modules/atlas.files/components/FilesTableView.jsx`
- Create: `apps/desktop/src/modules/atlas.files/components/FilesCardView.jsx`
- Create: `apps/desktop/src/modules/atlas.files/components/FilesGridView.jsx`
- Create: `apps/desktop/src/modules/atlas.files/components/FileDetailPanel.jsx`
- Create: `apps/desktop/src/modules/atlas.files/components/AdvancedFileViewer.jsx`
- Modify: `apps/desktop/src/modules/atlas.files/screens/FilesScreen.jsx`
  - Compose new explorer components and wire mutations/flows.

### Optional shared UI enhancements
- Modify: `packages/ui/src/components/FileCard.jsx` (if needed for thumbnail/icon props)
- Modify: `packages/ui/src/index.js` (only if exporting any new reusable primitives)

### Docs
- Modify: `docs/TASKS.md`
  - Add Phase 7.1 checklist.
- Modify: `docs/00_project_status.md`
  - Add advanced files UX status.
- Modify: `docs/09_next_steps.md`
  - Move next cycle to Phase 8 after 7.1 close.

---

### Task 1: Add API Contracts (Validators + SDK Surface)

**Files:**
- Modify: `packages/validators/src/index.js`
- Modify: `packages/sdk/src/index.js`

- [ ] **Step 1: Add failing validator usage note in API route TODO comments (temporary)**

```js
// TEMP CHECKPOINT: this route must validate payload with fileRenameSchema.
// Remove this comment after validator wiring is complete.
```

- [ ] **Step 2: Add rename and bulk-download schemas**

```js
export const fileRenameSchema = z.object({
  originalName: z
    .string()
    .trim()
    .min(1)
    .max(180)
    .regex(/^[^\\/:*?"<>|]+$/, "Nombre de archivo invalido"),
});

export const fileBulkDownloadSchema = z.object({
  fileIds: z.array(z.string().min(1)).min(1).max(50),
  mode: z.enum(["direct", "zip"]),
});
```

- [ ] **Step 3: Add SDK methods**

```js
rename: (id, data, token) =>
  request(`/files/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: withAuthHeaders(token),
    body: JSON.stringify(data),
  }),
bulkDownload: (payload, token) =>
  request("/files/bulk-download", {
    method: "POST",
    headers: withAuthHeaders(token),
    body: JSON.stringify(payload),
  }),
```

- [ ] **Step 4: Verify syntax**

Run: `node --check packages/validators/src/index.js`  
Expected: exit code `0`

Run: `node --check packages/sdk/src/index.js`  
Expected: exit code `0`

- [ ] **Step 5: Commit**

```bash
git add packages/validators/src/index.js packages/sdk/src/index.js
git commit -m "feat(files): add rename and bulk-download contracts in validators and sdk"
```

---

### Task 2: Implement API Rename Endpoint

**Files:**
- Modify: `apps/api/src/services/files-service.js`
- Modify: `apps/api/src/index.js`

- [ ] **Step 1: Add service method skeleton and route skeleton that returns 501 (failing behavior checkpoint)**

```js
// files-service.js
async rename() {
  throw new FilesServiceError("Not implemented.", 501);
}

// index.js
app.patch("/files/:id", authMiddleware, adminOnlyMiddleware, async (c) => {
  return c.json({ error: "Not implemented." }, 501);
});
```

- [ ] **Step 2: Implement service rename logic (company-scoped + enabled-safe)**

```js
async rename({ authUserId, id, originalName }) {
  const { companyId } = await getUserCompanyContext(authUserId);
  await ensureFileBelongsToCompany({ fileId: id, companyId });
  return prisma.fileAsset.update({
    where: { id },
    data: { originalName: String(originalName).trim() },
  });
}
```

- [ ] **Step 3: Wire route with validator and Spanish errors**

```js
const parsed = fileRenameSchema.safeParse(await c.req.json());
if (!parsed.success) {
  return c.json({ error: "Nombre de archivo invalido." }, 400);
}
const updated = await filesService.rename({
  authUserId: c.get("authUserId"),
  id: c.req.param("id"),
  originalName: parsed.data.originalName,
});
return c.json({ data: updated });
```

- [ ] **Step 4: Verify syntax**

Run: `node --check apps/api/src/services/files-service.js`  
Expected: exit code `0`

Run: `node --check apps/api/src/index.js`  
Expected: exit code `0`

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/services/files-service.js apps/api/src/index.js
git commit -m "feat(files-api): implement rename endpoint with scoped validation"
```

---

### Task 3: Implement Bulk Download API (Direct + ZIP)

**Files:**
- Modify: `apps/api/package.json`
- Modify: `apps/api/src/services/files-service.js`
- Modify: `apps/api/src/index.js`

- [ ] **Step 1: Add ZIP dependency**

```json
{
  "dependencies": {
    "jszip": "^3.10.1"
  }
}
```

- [ ] **Step 2: Add bulk service logic**

```js
async bulkDownload({ authUserId, fileIds, mode }) {
  const { companyId } = await getUserCompanyContext(authUserId);
  const files = await prisma.fileAsset.findMany({
    where: {
      id: { in: fileIds },
      entityId: companyId,
      enabled: true,
      entityType: { in: ["AtlasFile", "BrandingConfig", "Company"] },
    },
  });
  if (files.length !== fileIds.length) {
    throw new FilesServiceError(
      "Uno o mas archivos no existen, no pertenecen a tu empresa o estan deshabilitados.",
      403,
    );
  }
  if (mode === "direct") {
    // create per-file signed urls
  } else {
    // download bytes, build zip, upload temp object, return signed url
  }
}
```

- [ ] **Step 3: Add route with payload validator**

```js
app.post("/files/bulk-download", authMiddleware, async (c) => {
  const parsed = fileBulkDownloadSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: "Solicitud de descarga masiva invalida." }, 400);
  }
  const data = await filesService.bulkDownload({
    authUserId: c.get("authUserId"),
    fileIds: parsed.data.fileIds,
    mode: parsed.data.mode,
  });
  return c.json({ data });
});
```

- [ ] **Step 4: Install deps and verify syntax**

Run: `pnpm.cmd --filter @atlas/api install`  
Expected: install finishes without error.

Run: `node --check apps/api/src/services/files-service.js`  
Expected: exit code `0`

Run: `node --check apps/api/src/index.js`  
Expected: exit code `0`

- [ ] **Step 5: Commit**

```bash
git add apps/api/package.json pnpm-lock.yaml apps/api/src/services/files-service.js apps/api/src/index.js
git commit -m "feat(files-api): add bulk download direct and zip contracts"
```

---

### Task 4: Build Explorer State + Origin Resolver Utilities

**Files:**
- Create: `apps/desktop/src/modules/atlas.files/lib/file-kind.js`
- Create: `apps/desktop/src/modules/atlas.files/lib/file-origin-resolver.js`
- Create: `apps/desktop/src/modules/atlas.files/hooks/useFilesExplorer.js`

- [ ] **Step 1: Add file-kind helpers**

```js
export function getFileKind(mimeType = "") {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) return "sheet";
  if (mimeType.includes("word")) return "doc";
  if (mimeType.startsWith("text/")) return "text";
  return "generic";
}
```

- [ ] **Step 2: Add origin resolver helpers**

```js
export function resolveFileOrigin(file) {
  if (file?.moduleKey === "atlas.branding") {
    return {
      label: "Configuracion de marca",
      detailPath: `/app/m/atlas.files/files/${file.id}`,
      originPath: "/app/m/atlas.core/settings/branding",
    };
  }
  return {
    label: "Origen no mapeado",
    detailPath: `/app/m/atlas.files/files/${file?.id ?? ""}`,
    originPath: null,
  };
}
```

- [ ] **Step 3: Add unified explorer state hook**

```js
export function useFilesExplorer() {
  const [viewMode, setViewMode] = useState("table");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({});
  const [sort, setSort] = useState({ by: "createdAt", dir: "desc" });
  const [selectedIds, setSelectedIds] = useState([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  return { viewMode, setViewMode, search, setSearch, filters, setFilters, sort, setSort, selectedIds, setSelectedIds, activeIndex, setActiveIndex };
}
```

- [ ] **Step 4: Verify syntax**

Run: `node --check apps/desktop/src/modules/atlas.files/lib/file-kind.js`  
Expected: exit code `0`

Run: `node --check apps/desktop/src/modules/atlas.files/lib/file-origin-resolver.js`  
Expected: exit code `0`

Run: `node --check apps/desktop/src/modules/atlas.files/hooks/useFilesExplorer.js`  
Expected: exit code `0`

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/modules/atlas.files/lib/file-kind.js apps/desktop/src/modules/atlas.files/lib/file-origin-resolver.js apps/desktop/src/modules/atlas.files/hooks/useFilesExplorer.js
git commit -m "feat(files-ui): add explorer state and file origin resolver utilities"
```

---

### Task 5: Build Multi-View Explorer Components

**Files:**
- Create: `apps/desktop/src/modules/atlas.files/components/FilesToolbar.jsx`
- Create: `apps/desktop/src/modules/atlas.files/components/FilesTableView.jsx`
- Create: `apps/desktop/src/modules/atlas.files/components/FilesCardView.jsx`
- Create: `apps/desktop/src/modules/atlas.files/components/FilesGridView.jsx`

- [ ] **Step 1: Create toolbar with search/filter/sort/view/selection controls**

```jsx
<div className="flex flex-wrap items-center gap-2">
  <SearchInput value={search} onChange={onSearchChange} placeholder="Buscar archivo..." />
  <FilterBar filters={filtersConfig} value={filters} onChange={onFiltersChange} />
  <Select value={viewMode} onValueChange={setViewMode}>...</Select>
  <Badge variant="outline">Seleccionados: {selectedCount}</Badge>
</div>
```

- [ ] **Step 2: Create table view with checkbox selection + type icon + thumbnail cell**

```jsx
{
  id: "select",
  cell: ({ row }) => (
    <Checkbox checked={selectedIds.includes(row.original.id)} onCheckedChange={() => onToggle(row.original.id)} />
  ),
}
```

- [ ] **Step 3: Create card and grid views reusing same action callbacks**

```jsx
<button onClick={() => onPreview(file)}>Ver</button>
<button onClick={() => onRename(file)}>Renombrar</button>
<button onClick={() => onToggleSelect(file.id)}>Seleccionar</button>
```

- [ ] **Step 4: Verify desktop build**

Run: `pnpm.cmd --filter @atlas/desktop build:web`  
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/modules/atlas.files/components/FilesToolbar.jsx apps/desktop/src/modules/atlas.files/components/FilesTableView.jsx apps/desktop/src/modules/atlas.files/components/FilesCardView.jsx apps/desktop/src/modules/atlas.files/components/FilesGridView.jsx
git commit -m "feat(files-ui): add table cards and grid explorer views"
```

---

### Task 6: Implement Advanced Viewer + File Detail Panel

**Files:**
- Create: `apps/desktop/src/modules/atlas.files/components/AdvancedFileViewer.jsx`
- Create: `apps/desktop/src/modules/atlas.files/components/FileDetailPanel.jsx`

- [ ] **Step 1: Build viewer navigation frame**

```jsx
<Button onClick={onPrev} disabled={!canPrev}>Anterior</Button>
<Button onClick={onNext} disabled={!canNext}>Siguiente</Button>
```

- [ ] **Step 2: Add image transform local state (visual only)**

```js
const [rotation, setRotation] = useState(0);
const [flipX, setFlipX] = useState(false);
const [flipY, setFlipY] = useState(false);
const style = { transform: `rotate(${rotation}deg) scaleX(${flipX ? -1 : 1}) scaleY(${flipY ? -1 : 1})` };
```

- [ ] **Step 3: Add PDF and generic render branches + file detail panel with origin block**

```jsx
{isPdf ? <iframe src={signedUrl} title={file.originalName} /> : null}
{origin.originPath ? <Button onClick={() => navigate(origin.originPath)}>Ir al origen</Button> : <p>Origen no navegable</p>}
```

- [ ] **Step 4: Verify syntax and build**

Run: `node --check apps/desktop/src/modules/atlas.files/components/AdvancedFileViewer.jsx`  
Expected: exit code `0`

Run: `pnpm.cmd --filter @atlas/desktop build:web`  
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/modules/atlas.files/components/AdvancedFileViewer.jsx apps/desktop/src/modules/atlas.files/components/FileDetailPanel.jsx
git commit -m "feat(files-viewer): add advanced viewer and file detail origin panel"
```

---

### Task 7: Integrate Everything into FilesScreen

**Files:**
- Modify: `apps/desktop/src/modules/atlas.files/screens/FilesScreen.jsx`
- Optional Modify: `packages/ui/src/components/FileCard.jsx`
- Optional Modify: `packages/ui/src/index.js`

- [ ] **Step 1: Replace single DataTable flow with explorer composition**

```jsx
<FilesToolbar ... />
{viewMode === "table" ? <FilesTableView ... /> : null}
{viewMode === "cards" ? <FilesCardView ... /> : null}
{viewMode === "grid" ? <FilesGridView ... /> : null}
```

- [ ] **Step 2: Wire rename modal and mutation**

```js
const renameMutation = useMutation({
  mutationFn: ({ id, originalName }) => atlas.files.rename(id, { originalName }, token),
  onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["files-list"] }),
});
```

- [ ] **Step 3: Wire bulk download flows**

```js
const bulk = await atlas.files.bulkDownload({ fileIds: selectedIds, mode: "zip" }, token);
window.open(bulk?.data?.signedUrl, "_blank");
```

- [ ] **Step 4: Wire advanced viewer and file detail open actions**

```jsx
<AdvancedFileViewer open={viewerOpen} files={filteredFiles} activeIndex={activeIndex} onIndexChange={setActiveIndex} />
<FileDetailPanel open={detailOpen} file={detailFile} />
```

- [ ] **Step 5: Verify build**

Run: `pnpm.cmd --filter @atlas/desktop build:web`  
Expected: build succeeds with new Files module features.

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/modules/atlas.files/screens/FilesScreen.jsx packages/ui/src/components/FileCard.jsx packages/ui/src/index.js
git commit -m "feat(files-screen): integrate advanced explorer, rename, and bulk download flows"
```

---

### Task 8: Final Verification + Docs Reconciliation

**Files:**
- Modify: `docs/TASKS.md`
- Modify: `docs/00_project_status.md`
- Modify: `docs/09_next_steps.md`

- [ ] **Step 1: Update docs checklists/status for Phase 7.1**

```md
- [x] Multi-view files explorer (table/cards/grid)
- [x] Advanced viewer (image transforms visual-only, PDF preview, prev/next)
- [x] Rename and bulk download (direct + ZIP)
- [x] File detail + origin navigation
```

- [ ] **Step 2: Run API and desktop verification commands**

Run: `node --check apps/api/src/services/files-service.js`  
Expected: exit code `0`

Run: `node --check apps/api/src/index.js`  
Expected: exit code `0`

Run: `node --check packages/sdk/src/index.js`  
Expected: exit code `0`

Run: `pnpm.cmd --filter @atlas/desktop build:web`  
Expected: build succeeds.

- [ ] **Step 3: Manual smoke checklist**

Run manual checks:
1. Upload, preview, rename, and download single file.
2. Select multiple files and download ZIP.
3. Switch between `Tabla/Cards/Cuadricula` without losing filters.
4. Open detail and verify `Ir al origen` behavior.
5. Confirm branding, contacts, shell/module catalog still open correctly.

- [ ] **Step 4: Commit**

```bash
git add docs/TASKS.md docs/00_project_status.md docs/09_next_steps.md
git commit -m "docs(files): close phase 7.1 advanced files module status"
```

---

## Self-Review Checklist

1. Spec coverage check: all approved features map to Tasks 1-8.
2. Placeholder scan: no TODO/TBD placeholders left in actionable steps.
3. Signature consistency:
   - `atlas.files.rename(id, data, token)`
   - `atlas.files.bulkDownload(payload, token)`
   - API `PATCH /files/:id`
   - API `POST /files/bulk-download`

