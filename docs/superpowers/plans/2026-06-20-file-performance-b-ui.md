# File Performance — Plan B: UI Changes

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the frontend consume inline signed URLs, load file panels in parallel with entities, parallelize uploads, and throttle background polling.

**Architecture:** `useAttachmentsController` maps `file_asset.signedUrl` from list responses and short-circuits signed URL fetches when the inline value is valid. `AttachmentsPanel.loadThumbs` checks inline signed URLs before calling the API. Detail screens start their file query simultaneously with the entity query (from the same URL params) and hand the result to `AttachmentsPanel` via `prefetchedData`. Polling intervals increase from 15 s to 60 s. HR's `FilesPanel` removes its manual `batchSignedUrls` call.

**Prerequisites:** Plan A (API) must be deployed. The inline `signedUrl` field in list responses is what these changes consume.

**Tech Stack:** React 18, TanStack Query v5, `@atlas/ui` (shared packages), Vite (desktop app)

**Spec:** `docs/superpowers/specs/2026-06-20-file-performance-design.md`

---

### Task 1: Map inline `signedUrl` in `normalizeAssociatedItem`

**Files:**
- Modify: `packages/ui/src/hooks/useAttachmentsController.js` (~line 179)

`normalizeAssociatedItem` builds the internal item shape. Add `signedUrl` and `signedUrlExpiresAt` from either the nested `file_asset` (for association rows) or the top-level row (for direct fileAsset rows).

- [ ] **Step 1: Locate `normalizeAssociatedItem` return statement**

In `packages/ui/src/hooks/useAttachmentsController.js`, find (around line 203):
```javascript
  return {
    kind: "associated",
    id: String(associationId ?? fileAssetId ?? fileName),
    associationId,
    fileAssetId,
    fileName,
    mimeType,
    sizeBytes,
    documentType: getByPath(rawItem, fields.documentType) ?? rawItem?.document_type ?? null,
    label: getByPath(rawItem, fields.label) ?? rawItem?.label ?? null,
    createdAt: getByPath(rawItem, fields.createdAt) ?? rawItem?.created_at ?? null,
    enabled: getByPath(rawItem, fields.enabled) ?? rawItem?.enabled ?? true,
    raw: rawItem,
  };
```

- [ ] **Step 2: Add `signedUrl` and `signedUrlExpiresAt` to the return object**

Replace the return block with:
```javascript
  return {
    kind: "associated",
    id: String(associationId ?? fileAssetId ?? fileName),
    associationId,
    fileAssetId,
    fileName,
    mimeType,
    sizeBytes,
    documentType: getByPath(rawItem, fields.documentType) ?? rawItem?.document_type ?? null,
    label: getByPath(rawItem, fields.label) ?? rawItem?.label ?? null,
    createdAt: getByPath(rawItem, fields.createdAt) ?? rawItem?.created_at ?? null,
    enabled: getByPath(rawItem, fields.enabled) ?? rawItem?.enabled ?? true,
    signedUrl: fileAsset?.signedUrl ?? rawItem?.signedUrl ?? null,
    signedUrlExpiresAt: fileAsset?.signedUrlExpiresAt ?? rawItem?.signedUrlExpiresAt ?? null,
    raw: rawItem,
  };
```

- [ ] **Step 3: Verify syntax**

Run: `node --check packages/ui/src/hooks/useAttachmentsController.js`
Expected: no output

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/hooks/useAttachmentsController.js
git commit -m "feat(controller): map inline signedUrl from file list response in normalizeAssociatedItem"
```

---

### Task 2: Short-circuit `resolveSignedUrl` and `openAssociated` using cached URL

**Files:**
- Modify: `packages/ui/src/hooks/useAttachmentsController.js` (~lines 637, 659)

When the item already has a valid `signedUrl` (from the list response), skip the HTTP call.

- [ ] **Step 1: Locate `resolveSignedUrl` and add cache check**

Find (around line 637):
```javascript
  const resolveSignedUrl = useCallback(
    async (fileAssetId) => {
      if (!fileAssetId) throw new Error("Archivo no disponible");
      const endpointTemplate =
        config?.signedUrl?.endpointTemplate ?? "/files/:fileId/signed-url";
      const endpointPath = replacePathTokens(endpointTemplate, { fileId: fileAssetId });
      const response = await fetch(joinUrl(apiBaseUrl, endpointPath), {
        method: "GET",
        headers: toHeaders(token),
      });
```

Replace the `resolveSignedUrl` callback with:
```javascript
  const resolveSignedUrl = useCallback(
    async (fileAssetId, { inlineSignedUrl, inlineSignedUrlExpiresAt } = {}) => {
      if (!fileAssetId) throw new Error("Archivo no disponible");

      if (inlineSignedUrl && inlineSignedUrlExpiresAt) {
        const expiresAt = new Date(inlineSignedUrlExpiresAt).getTime();
        if (expiresAt - Date.now() > 60_000) return inlineSignedUrl;
      }

      const endpointTemplate =
        config?.signedUrl?.endpointTemplate ?? "/files/:fileId/signed-url";
      const endpointPath = replacePathTokens(endpointTemplate, { fileId: fileAssetId });
      const response = await fetch(joinUrl(apiBaseUrl, endpointPath), {
        method: "GET",
        headers: toHeaders(token),
      });
```

- [ ] **Step 2: Locate `openAssociated` and pass inline URL**

Find (around line 659):
```javascript
  const openAssociated = useCallback(
    async (item) => {
      try {
        const signedUrl = await resolveSignedUrl(item.fileAssetId);
        setViewerItem({
          ...item,
          originalName: item.fileName,
          signedUrl,
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "No se pudo abrir el archivo.";
        setGlobalError(message);
      }
    },
    [resolveSignedUrl, setGlobalError],
  );
```

Replace with:
```javascript
  const openAssociated = useCallback(
    async (item) => {
      try {
        const signedUrl = await resolveSignedUrl(item.fileAssetId, {
          inlineSignedUrl: item.signedUrl,
          inlineSignedUrlExpiresAt: item.signedUrlExpiresAt,
        });
        setViewerItem({
          ...item,
          originalName: item.fileName,
          signedUrl,
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "No se pudo abrir el archivo.";
        setGlobalError(message);
      }
    },
    [resolveSignedUrl, setGlobalError],
  );
```

- [ ] **Step 3: Verify syntax**

Run: `node --check packages/ui/src/hooks/useAttachmentsController.js`
Expected: no output

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/hooks/useAttachmentsController.js
git commit -m "feat(controller): skip signed URL fetch when inline cached value is still valid"
```

---

### Task 3: Use inline signed URLs in `AttachmentsPanel.loadThumbs`

**Files:**
- Modify: `packages/ui/src/components/AttachmentsPanel.jsx` (~line 554)

The `loadThumbs` useEffect currently calls `controller.resolveSignedUrl(assetId)` for every image, sequentially. Change it to use the inline `signedUrl` from the item (set in Task 1) without any network call, falling back to `resolveSignedUrl` only when the inline URL is missing or expired.

- [ ] **Step 1: Locate `loadThumbs` useEffect**

In `packages/ui/src/components/AttachmentsPanel.jsx`, find (around line 554):
```javascript
  useEffect(() => {
    let cancelled = false;
    const imageItems = controller.associatedItems.filter((item) =>
      String(item?.mimeType ?? "").startsWith("image/"),
    );
    if (imageItems.length === 0) return () => {};

    async function loadThumbs() {
      for (const item of imageItems) {
        const assetId = item.fileAssetId;
        if (!assetId) continue;
        if (thumbUrlsByAssetId[assetId]) continue;
        try {
          const url = await controller.resolveSignedUrl(assetId);
          if (cancelled || !url) continue;
          setThumbUrlsByAssetId((prev) =>
            prev[assetId] ? prev : { ...prev, [assetId]: url },
          );
        } catch {
          // Ignore thumbnail resolution failures.
        }
      }
    }

    loadThumbs();
    return () => {
      cancelled = true;
    };
  }, [
    controller.associatedItems,
    controller.resolveSignedUrl,
    thumbUrlsByAssetId,
  ]);
```

- [ ] **Step 2: Replace with inline-URL-aware version**

Replace the entire `useEffect` block with:
```javascript
  useEffect(() => {
    let cancelled = false;
    const imageItems = controller.associatedItems.filter((item) =>
      String(item?.mimeType ?? "").startsWith("image/"),
    );
    if (imageItems.length === 0) return () => {};

    async function loadThumbs() {
      for (const item of imageItems) {
        const assetId = item.fileAssetId;
        if (!assetId) continue;
        if (thumbUrlsByAssetId[assetId]) continue;

        // Use inline signed URL if available and not expiring within 60 s
        if (item.signedUrl && item.signedUrlExpiresAt) {
          const expiresAt = new Date(item.signedUrlExpiresAt).getTime();
          if (expiresAt - Date.now() > 60_000) {
            if (!cancelled) {
              setThumbUrlsByAssetId((prev) =>
                prev[assetId] ? prev : { ...prev, [assetId]: item.signedUrl },
              );
            }
            continue;
          }
        }

        // Fallback: fetch signed URL individually (original behavior)
        try {
          const url = await controller.resolveSignedUrl(assetId);
          if (cancelled || !url) continue;
          setThumbUrlsByAssetId((prev) =>
            prev[assetId] ? prev : { ...prev, [assetId]: url },
          );
        } catch {
          // Ignore thumbnail resolution failures.
        }
      }
    }

    loadThumbs();
    return () => {
      cancelled = true;
    };
  }, [
    controller.associatedItems,
    controller.resolveSignedUrl,
    thumbUrlsByAssetId,
  ]);
```

- [ ] **Step 3: Verify syntax**

Run: `node --check packages/ui/src/components/AttachmentsPanel.jsx`
Expected: no output

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/components/AttachmentsPanel.jsx
git commit -m "feat(AttachmentsPanel): use inline signedUrl for thumbnails, skip HTTP calls when valid"
```

---

### Task 4: Parallel uploads in `flushPending` and `queueFiles`

**Files:**
- Modify: `packages/ui/src/hooks/useAttachmentsController.js` (~lines 508, 574)

Sequential `for await` loops → `Promise.all` for concurrent uploads.

- [ ] **Step 1: Locate `flushPending` sequential loop**

Find (around line 508):
```javascript
      for (const pending of candidates) {
        const result = await uploadAndAssociateOne(pending, effectiveRecordId);
        if (result.ok) success.push(pending.id);
        else failed.push({ id: pending.id, message: result.error ?? "Error" });
      }
```

Replace with:
```javascript
      const uploadResults = await Promise.all(
        candidates.map(async (pending) => ({
          pending,
          result: await uploadAndAssociateOne(pending, effectiveRecordId),
        })),
      );
      for (const { pending, result } of uploadResults) {
        if (result.ok) success.push(pending.id);
        else failed.push({ id: pending.id, message: result.error ?? "Error" });
      }
```

- [ ] **Step 2: Locate `queueFiles` sequential loop**

Find (around line 573):
```javascript
      if (shouldImmediateUpload) {
        for (const item of newPending) {
          await uploadAndAssociateOne(item, effectiveRecordId);
        }
```

Replace with:
```javascript
      if (shouldImmediateUpload) {
        await Promise.all(
          newPending.map((item) => uploadAndAssociateOne(item, effectiveRecordId)),
        );
```

- [ ] **Step 3: Verify syntax**

Run: `node --check packages/ui/src/hooks/useAttachmentsController.js`
Expected: no output

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/hooks/useAttachmentsController.js
git commit -m "perf(controller): parallelize file uploads in flushPending and queueFiles with Promise.all"
```

---

### Task 5: Add `prefetchedData` prop to controller and panel

**Files:**
- Modify: `packages/ui/src/hooks/useAttachmentsController.js`
- Modify: `packages/ui/src/components/AttachmentsPanel.jsx`

If a parent component fetches files in parallel with the entity, it passes the result as `prefetchedData`. The controller seeds its initial state from this data and skips the initial `loadAssociated` call.

- [ ] **Step 1: Add `prefetchedData` to `useAttachmentsController` signature and initial state**

Find the function signature and initial state block (around line 257):
```javascript
export function useAttachmentsController({
  apiBaseUrl,
  token,
  recordId,
  config,
  context = "detail",
  disabled = false,
  readOnly = false,
  onChange,
  onError,
}) {
  const [associatedItems, setAssociatedItems] = useState([]);
```

Replace with:
```javascript
export function useAttachmentsController({
  apiBaseUrl,
  token,
  recordId,
  config,
  context = "detail",
  disabled = false,
  readOnly = false,
  onChange,
  onError,
  prefetchedData,
}) {
  const prefetchedDataRef = useRef(prefetchedData);
  const [associatedItems, setAssociatedItems] = useState(() => {
    const initial = prefetchedDataRef.current;
    if (!Array.isArray(initial)) return [];
    return initial.map((r) => normalizeAssociatedItem(r, DEFAULT_FIELDS));
  });
```

- [ ] **Step 2: Skip `loadAssociated` on mount when prefetched data was provided**

Find (around line 356):
```javascript
  useEffect(() => {
    loadAssociated();
  }, [loadAssociated]);
```

Replace with:
```javascript
  useEffect(() => {
    if (Array.isArray(prefetchedDataRef.current)) return;
    loadAssociated();
  }, [loadAssociated]);
```

- [ ] **Step 3: Add `prefetchedData` prop to `AttachmentsPanel` and pass through**

Find the `AttachmentsPanel` function signature and controller instantiation (around line 474):
```javascript
export function AttachmentsPanel({
  apiBaseUrl,
  token,
  recordId,
  config,
  context = "detail",
  disabled = false,
  readOnly = false,
  showHeading = true,
  showViewToggle = false,
  defaultViewMode = "list",
  className = "",
  onError,
  onChange,
  onControllerReady,
  canRemoveItem = () => true,
}) {
  const controller = useAttachmentsController({
    apiBaseUrl,
    token,
    recordId,
    config,
    context,
    disabled,
    readOnly,
    onError,
    onChange,
  });
```

Replace with:
```javascript
export function AttachmentsPanel({
  apiBaseUrl,
  token,
  recordId,
  config,
  context = "detail",
  disabled = false,
  readOnly = false,
  showHeading = true,
  showViewToggle = false,
  defaultViewMode = "list",
  className = "",
  onError,
  onChange,
  onControllerReady,
  canRemoveItem = () => true,
  prefetchedData,
}) {
  const controller = useAttachmentsController({
    apiBaseUrl,
    token,
    recordId,
    config,
    context,
    disabled,
    readOnly,
    onError,
    onChange,
    prefetchedData,
  });
```

- [ ] **Step 4: Verify syntax on both files**

Run:
```bash
node --check packages/ui/src/hooks/useAttachmentsController.js && node --check packages/ui/src/components/AttachmentsPanel.jsx
```
Expected: no output

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/hooks/useAttachmentsController.js packages/ui/src/components/AttachmentsPanel.jsx
git commit -m "feat(AttachmentsPanel): add prefetchedData prop to seed controller state and skip initial fetch"
```

---

### Task 6: Parallel loading in `InventoryItemDetail`

**Files:**
- Modify: `apps/desktop/src/modules/atlas.inventory/screens/InventoryItemDetail.jsx`

Start the files query at the same time as the entity query (both use the `id` from URL params), then hand the files data to `AttachmentsPanel` via `prefetchedData`.

- [ ] **Step 1: Add `useQuery` import**

The file currently imports from `react-router-dom`, `@atlas/ui`, etc. Add `useQuery` from TanStack:

Find the imports section. Add at the top:
```javascript
import { useQuery } from '@tanstack/react-query'
```

- [ ] **Step 2: Add the parallel files query**

In `InventoryItemDetail`, after `const token = session?.access_token` and alongside the existing `useInventoryItem(id)` call, add:

```javascript
  const { data: filesData } = useQuery({
    queryKey: ['inv-item-files', id],
    queryFn: async () => {
      const resp = await fetch(
        `${getApiUrl()}/inventory/items/${encodeURIComponent(id)}/files`,
        { headers: { Authorization: `Bearer ${token}` } },
      )
      return resp.json()
    },
    enabled: Boolean(id && token),
    staleTime: 30_000,
  })
```

- [ ] **Step 3: Pass `prefetchedData` to `AttachmentsPanel`**

Find (around line 249):
```javascript
            <AttachmentsPanel
              apiBaseUrl={getApiUrl()}
              token={token}
              recordId={item.id}
              config={attachmentsConfig}
              context="detail"
              readOnly
              showHeading
              showViewToggle
              defaultViewMode="grid"
            />
```

Replace with:
```javascript
            <AttachmentsPanel
              apiBaseUrl={getApiUrl()}
              token={token}
              recordId={item.id}
              config={attachmentsConfig}
              context="detail"
              readOnly
              showHeading
              showViewToggle
              defaultViewMode="grid"
              prefetchedData={filesData?.data}
            />
```

- [ ] **Step 4: Verify syntax**

Run: `node --check apps/desktop/src/modules/atlas.inventory/screens/InventoryItemDetail.jsx`
Expected: no output

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/modules/atlas.inventory/screens/InventoryItemDetail.jsx
git commit -m "perf(inventory): launch file list query in parallel with entity query in InventoryItemDetail"
```

---

### Task 7: Parallel loading in `GrowthLeadDetailScreen`

**Files:**
- Modify: `apps/desktop/src/modules/atlas.growth/screens/GrowthLeadDetailScreen.jsx`

The file already imports `useQuery`. Add a parallel files query and pass `prefetchedData`.

- [ ] **Step 1: Find where the lead entity query is defined**

In `GrowthLeadDetailScreen.jsx`, find (around line 115):
```javascript
  } = useQuery({
```
Look for the lead entity query. It uses `queryKey: ['growth-lead', id]` or similar. Note the position.

- [ ] **Step 2: Add the parallel files query after the entity query**

After the main lead query block, add:
```javascript
  const { data: filesData } = useQuery({
    queryKey: ['growth-lead-files', id],
    queryFn: async () => {
      const resp = await fetch(
        `${getApiUrl()}/growth/leads/${encodeURIComponent(id)}/files`,
        { headers: { Authorization: `Bearer ${token}` } },
      )
      return resp.json()
    },
    enabled: Boolean(id && token),
    staleTime: 30_000,
  })
```

Where `token = session?.access_token` (already set in the component).

- [ ] **Step 3: Find `AttachmentsPanel` usage and add `prefetchedData`**

Find (around line 405):
```javascript
              <AttachmentsPanel
```

Inspect the full props block. Add `prefetchedData`:
```javascript
              <AttachmentsPanel
                ...existing props...
                prefetchedData={filesData?.data ?? (Array.isArray(filesData) ? filesData : undefined)}
              />
```

Note: `listLeadFiles` returns an array directly (not wrapped in `{ data: [] }`), so the `prefetchedData` selector must handle both shapes:
- `filesData?.data` for if it's `{ data: [...] }`
- `Array.isArray(filesData) ? filesData : undefined` for direct array

The combined expression `filesData?.data ?? (Array.isArray(filesData) ? filesData : undefined)` covers both.

- [ ] **Step 4: Verify syntax**

Run: `node --check apps/desktop/src/modules/atlas.growth/screens/GrowthLeadDetailScreen.jsx`
Expected: no output

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/modules/atlas.growth/screens/GrowthLeadDetailScreen.jsx
git commit -m "perf(growth): launch file list query in parallel with lead entity query"
```

---

### Task 8: Parallel loading in `TaskDetailPanel`

**Files:**
- Modify: `apps/desktop/src/modules/atlas.projects/components/TaskDetailPanel.jsx`

- [ ] **Step 1: Find the existing imports and task query**

The file already uses TanStack Query hooks. Find `useQuery` import and where `taskId` and `projectId` are available.

- [ ] **Step 2: Add parallel files query**

After the existing task entity query in the component, add:
```javascript
  const { data: taskFilesData } = useQuery({
    queryKey: ['task-attachments', projectId, taskId],
    queryFn: async () => {
      const resp = await fetch(
        `${getApiUrl()}/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}/attachments`,
        { headers: { Authorization: `Bearer ${token}` } },
      )
      return resp.json()
    },
    enabled: Boolean(projectId && taskId && token),
    staleTime: 30_000,
  })
```

Add `getApiUrl` import if not present: `import { getApiUrl } from '../../../lib/runtimeConfig.js'`
Add `useAuth` import if not present to get `token = session?.access_token`.

- [ ] **Step 3: Find `AttachmentsPanel` and add `prefetchedData`**

Find (around line 810):
```javascript
                  <AttachmentsPanel
```

Add:
```javascript
                  <AttachmentsPanel
                    ...existing props...
                    prefetchedData={Array.isArray(taskFilesData) ? taskFilesData : taskFilesData?.data}
                  />
```

The task attachments route returns a plain array (not `{ data: [] }`), so:
- `Array.isArray(taskFilesData) ? taskFilesData : taskFilesData?.data`

- [ ] **Step 4: Verify syntax**

Run: `node --check apps/desktop/src/modules/atlas.projects/components/TaskDetailPanel.jsx`
Expected: no output

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/modules/atlas.projects/components/TaskDetailPanel.jsx
git commit -m "perf(projects): launch task attachment query in parallel with task entity query"
```

---

### Task 9: Polling throttle — notifications and activity bell

**Files:**
- Modify: `packages/ui/src/components/ActivityBellTrigger.jsx` (line 6)
- Modify: `apps/desktop/src/components/NotificationBell.jsx` (line 53)

- [ ] **Step 1: Increase `POLL_INTERVAL_MS` in `ActivityBellTrigger.jsx`**

Find (line 6):
```javascript
const POLL_INTERVAL_MS = 15000;
```
Replace with:
```javascript
const POLL_INTERVAL_MS = 60000;
```

- [ ] **Step 2: Increase `refetchInterval` in `NotificationBell.jsx`**

Find (line 53):
```javascript
    refetchInterval: 15000,
```
Replace with:
```javascript
    refetchInterval: 60000,
```

- [ ] **Step 3: Verify syntax**

Run:
```bash
node --check packages/ui/src/components/ActivityBellTrigger.jsx && node --check apps/desktop/src/components/NotificationBell.jsx
```
Expected: no output

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/components/ActivityBellTrigger.jsx apps/desktop/src/components/NotificationBell.jsx
git commit -m "perf(polling): increase notification and activity bell poll interval from 15s to 60s"
```

---

### Task 10: HR `FilesPanel` — remove redundant `batchSignedUrls` call

**Files:**
- Modify: `apps/desktop/src/modules/atlas.hr/screens/HrEmployeeDetail.jsx`

The `FilesPanel` inside `HrEmployeeDetail` currently calls `atlas.files.batchSignedUrls(uncached, token)` in a `useEffect` to fetch thumbnail URLs. After Plan A (Task 2), `GET /files` already returns `signedUrl` inline on each file. The separate batch call is now redundant.

- [ ] **Step 1: Locate the `FilesPanel` component and its signed URL useEffect**

In `apps/desktop/src/modules/atlas.hr/screens/HrEmployeeDetail.jsx`, find the `FilesPanel` function component (around line 465). Find the `useEffect` that calls `atlas.files.batchSignedUrls` (around line 487):

```javascript
  useEffect(() => {
    if (!token) return;
    const files = filesQuery.data?.data ?? [];
    const uncached = files
      .filter(
        (f) =>
          getFileKind(f.mimeType) === "image" &&
          !previewMap.has(f.id) &&
          !signedUrlCache.current.has(f.id),
      )
      .map((f) => f.id);
    if (uncached.length === 0) return;
    atlas.files
      .batchSignedUrls(uncached, token)
      .then((res) => {
        const urlMap = res?.data ?? {};
        uncached.forEach((id) => {
          if (urlMap[id]) signedUrlCache.current.set(id, urlMap[id]);
        });
        setPreviewMap((prev) => {
          const next = new Map(prev);
          uncached.forEach((id) => {
            if (urlMap[id]) next.set(id, urlMap[id]);
          });
          return next;
        });
      })
      .catch(() => {});
  }, [filesQuery.data, token, previewMap]);
```

- [ ] **Step 2: Replace the `batchSignedUrls` useEffect with inline URL population**

Replace the entire useEffect with:
```javascript
  useEffect(() => {
    const files = filesQuery.data?.data ?? [];
    const images = files.filter((f) => getFileKind(f.mimeType) === "image" && f.signedUrl);
    if (images.length === 0) return;
    setPreviewMap((prev) => {
      const next = new Map(prev);
      for (const f of images) {
        if (!next.has(f.id)) next.set(f.id, f.signedUrl);
      }
      return next;
    });
  }, [filesQuery.data]);
```

- [ ] **Step 3: Remove unused state and ref that are no longer needed**

Find and remove:
```javascript
  const signedUrlCache = useRef(new Map());
```
(This ref was only used by the `batchSignedUrls` call. If it's also used elsewhere in `FilesPanel`, keep it — but verify first by checking all usages.)

Search in the file: `grep -n "signedUrlCache" apps/desktop/src/modules/atlas.hr/screens/HrEmployeeDetail.jsx`

If `signedUrlCache` only appears in the lines related to the removed useEffect, delete the `const signedUrlCache = useRef(new Map());` line.

- [ ] **Step 4: Verify syntax**

Run: `node --check apps/desktop/src/modules/atlas.hr/screens/HrEmployeeDetail.jsx`
Expected: no output

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/modules/atlas.hr/screens/HrEmployeeDetail.jsx
git commit -m "perf(hr): use inline signedUrl from file list response, remove redundant batchSignedUrls call"
```

---

### Task 11: End-to-end verification

- [ ] **Step 1: Start both dev servers**

```bash
pnpm dev:api   # terminal 1
pnpm dev:frontend  # terminal 2
```

- [ ] **Step 2: Verify inventory detail page — no extra signed-url calls**

Open browser DevTools → Network tab.
Navigate to an inventory item detail page that has image attachments.
Expected:
- `GET /inventory/items/:id` and `GET /inventory/items/:id/files` start within 50ms of each other (both visible in Network before either completes)
- After files load, NO `GET /files/:id/signed-url` calls appear
- Image thumbnails render immediately when the files list arrives

- [ ] **Step 3: Verify growth lead detail — no extra signed-url calls**

Navigate to a growth lead with attachments.
Expected: same pattern — files load with thumbnails, zero signed-url requests.

- [ ] **Step 4: Verify parallel upload**

Open an inventory item detail. Drag 3 images at once onto the attachment panel.
Expected: all 3 upload requests appear in DevTools simultaneously (not one after another).

- [ ] **Step 5: Verify polling throttle**

In DevTools Network tab, filter by `notifications` and `recent`.
Wait 90 seconds. Expected: at most 2-3 requests (one per minute), not 6+ (one per 15s).

- [ ] **Step 6: Verify HR employee files — no batchSignedUrls call**

Navigate to an HR employee detail with image attachments in the dossier.
Expected: images render from inline `signedUrl`; no `POST /files/batch-signed-urls` call in DevTools.

- [ ] **Step 7: Commit final verification (no code change)**

All tasks complete. Plan B finished.
