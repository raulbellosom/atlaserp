---
title: Platform-Wide File Loading Performance
date: 2026-06-20
status: draft
---

# Platform-Wide File Loading Performance

## Problem

Every detail screen that shows files (inventory, HR, fleet, contacts, projects, growth) loads
slowly because three independent problems stack on top of each other.

**Waterfall — entity then files.** The page mounts, the entity query runs (3–5 s over the VPS),
and only when that resolves does `AttachmentsPanel` mount and fire its own file-list request. Two
sequential round-trips.

**N+1 signed URLs for thumbnails.** The file-list response contains no signed URLs. For each
image `AttachmentsPanel` calls `GET /files/:id/signed-url` individually (~900 ms each).
Three images = three sequential requests totalling ~2.7 s after the list already loaded.

**Polling noise competing with important requests.** `NotificationBell` polls
`/notifications` every 15 s and `ActivityBellTrigger` polls `/activity/recent` every 15 s.
Each call takes 2–4 s on the VPS, continuously competing with real user-initiated requests.

**Key discovery:** `POST /files/batch-signed-urls` already exists and uses Supabase's
`createSignedUrls` batch API. We will call this logic server-side inside each document-list
route so the signed URLs travel with the file list in a single response.

---

## Scope

This spec covers six change areas. Each is self-contained; they can be implemented and
deployed independently, but together they eliminate all three root causes.

---

## Change 1 — Backend: `enrichFilesWithSignedUrls` in `files-service.js`

### What

New method on the `filesService` instance:

```
enrichFilesWithSignedUrls(fileList) → fileList (mutated copies, not mutation)
```

`fileList` is an array of document-association rows whose shape is:

```json
{ "...", "file_asset": { "id": "…", "bucket": "atlas-files", "objectKey": "…/photo.jpg", "mimeType": "image/jpeg" } }
```

Only previewable MIME types receive signed URLs: `image/*` and `application/pdf`.

### How

1. Filter `fileList` to previewable items.
2. Group by `bucket` (most files are `atlas-files`; website files use `atlas-website` and are
   already public, so use `getPublicUrl` for those — same logic as the existing
   `POST /files/batch-signed-urls` handler).
3. For each bucket, call `supabaseAdmin.storage.from(bucket).createSignedUrls(objectKeys, 3600)`.
   One Supabase call per bucket.
4. Return a new array where each previewable item has:
   ```json
   { "file_asset": { "...", "signedUrl": "https://…", "signedUrlExpiresAt": "ISO-timestamp" } }
   ```
   Non-previewable items pass through unchanged.

`signedUrlExpiresAt` is `new Date(Date.now() + 3600 * 1000).toISOString()` — the client uses
this to decide whether a cached URL is still valid.

### Error handling

If Supabase returns an error for a batch, log the error and return the original list without
`signedUrl` fields. The client falls back to its existing on-demand fetch path. The page still
loads; only the optimisation is lost.

---

## Change 2 — Backend: Wire `enrichFilesWithSignedUrls` into every document-list route

All routes that return a list of associated file documents must call `enrichFilesWithSignedUrls`
before returning.

### Routes to update

| Route | Handler location |
|---|---|
| `GET /inventory/items/:id/files` | `apps/api/src/index.js` ~line 4648 |
| `GET /fleet/vehicles/:id/documents` | `apps/api/src/routes/fleet/vehicles-routes.js` ~line 297 |
| `GET /fleet/drivers/:id/documents` | `apps/api/src/routes/fleet/drivers-routes.js` ~line 314 |
| `GET /fleet/reports/:id/documents` | `apps/api/src/routes/fleet/reports-routes.js` ~line 468 |
| `GET /files` (general list) | `apps/api/src/index.js` ~line 1760 |

The general `GET /files` list is also enriched because `HrEmployeeDetail` and other screens use
`atlas.files.list()` which calls this endpoint.

### Dependency injection for fleet routes

`createFleetRouter`, `createDriversRouter`, and `createReportsRouter` currently receive
`{ prisma, requirePermission, moduleContext }`. They do not have `supabaseAdmin`. Add
`enrichFilesWithSignedUrls` as a new parameter:

```javascript
// apps/api/src/index.js
mountWithAuth(app, createFleetRouter({
  prisma,
  requirePermission,
  enrichFilesWithSignedUrls: filesService.enrichFilesWithSignedUrls,
}));
```

Each factory function signature gets `enrichFilesWithSignedUrls` added, which is then passed
through to sub-routers (`createDriversRouter`, `createReportsRouter`).

### Pattern (same for all routes)

```javascript
// Before
const files = await inventoryService.listItemFiles(id, companyId);
return c.json({ data: files });

// After
const files = await inventoryService.listItemFiles(id, companyId);
const enriched = await filesService.enrichFilesWithSignedUrls(files);
return c.json({ data: enriched });
```

---

## Change 3 — Frontend `useAttachmentsController`: consume inline signed URLs + parallel uploads

### 3a — Map inline signed URLs in `normalizeAssociatedItem`

`normalizeAssociatedItem` currently maps raw API rows to the controller's internal shape. Add:

```javascript
cachedSignedUrl: raw.file_asset?.signedUrl ?? null,
cachedSignedUrlExpiresAt: raw.file_asset?.signedUrlExpiresAt ?? null,
```

### 3b — Short-circuit `resolveSignedUrl` when inline URL is valid

`resolveSignedUrl(fileAssetId)` currently always calls `GET /files/:id/signed-url`. Change it to:

```javascript
// Find the item in associatedItems
const existing = associatedItems.find(i => i.fileAssetId === fileAssetId);
const expiresAt = existing?.cachedSignedUrlExpiresAt;
const isValid = expiresAt && new Date(expiresAt).getTime() - Date.now() > 60_000;

if (existing?.cachedSignedUrl && isValid) {
  return existing.cachedSignedUrl;
}
// ...existing fetch logic
```

The 60 s buffer ensures URLs do not expire mid-display.

### 3c — Parallel uploads in `flushPending` and `queueFiles`

Both functions use `for await` (sequential). Replace with `Promise.all`:

```javascript
// flushPending (around line 508)
const results = await Promise.all(
  candidates.map(pending => uploadAndAssociateOne(pending, effectiveRecordId))
);

// queueFiles (around line 574)
await Promise.all(
  newPending.map(item => uploadAndAssociateOne(item, effectiveRecordId))
);
```

### 3d — `prefetchedData` prop

Accept a new optional prop `prefetchedData`:

```javascript
export function useAttachmentsController({
  // ...existing props,
  prefetchedData,   // array of raw associated items from parent, or undefined
})
```

Behaviour:
- If `prefetchedData` is a defined array (including empty `[]`): seed `associatedItems` via
  `useState(() => prefetchedData.map(r => normalizeAssociatedItem(r, DEFAULT_FIELDS)))` and skip
  the initial `loadAssociated` call.
- If `prefetchedData` is `undefined` (not provided): original behaviour — `loadAssociated` fires
  on mount.

To avoid double-fetch when `prefetchedData` transitions from `undefined` to an array, the
condition in the `useEffect` is:

```javascript
useEffect(() => {
  if (prefetchedData !== undefined) return;
  loadAssociated();
}, [loadAssociated]);
```

---

## Change 4 — Frontend `AttachmentsPanel`: accept and pass `prefetchedData`

`AttachmentsPanel` wraps `useAttachmentsController`. Add `prefetchedData` to its props and pass
it through:

```javascript
export function AttachmentsPanel({
  // ...existing props,
  prefetchedData,
}) {
  const ctrl = useAttachmentsController({
    // ...existing,
    prefetchedData,
  });
```

No other changes to `AttachmentsPanel` are required. The `thumbUrlsByAssetId` map is already
built from `resolveSignedUrl` calls; Change 3b ensures those return immediately from cache when
the inline URL is valid, making the existing `useEffect` in `AttachmentsPanel` zero-cost for
already-resolved thumbnails.

---

## Change 5 — Frontend: parallel query loading in detail screens

### Pattern

The record ID is always available in the URL before the entity loads. Use two `useQuery` calls
from the same component, both starting simultaneously:

```javascript
// Entity query (existing)
const { data: itemData, isLoading } = useInventoryItem(id);

// Files query (new — starts in parallel, same timing as entity)
const { data: filesData } = useQuery({
  queryKey: ['inventory-item-files', id],
  queryFn: () => fetch(`${getApiUrl()}/inventory/items/${id}/files`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then(r => r.json()),
  enabled: Boolean(id && token),
  staleTime: 30_000,
});

// Pass to panel — undefined until loaded, which leaves controller in original fetch mode
<AttachmentsPanel
  recordId={id}
  prefetchedData={filesData?.data}   // undefined while loading → controller fetches; array when ready → controller uses it
  ...
/>
```

Because `prefetchedData` starts as `undefined`, the controller does not trigger a redundant
fetch — it simply waits for the prop to arrive. When `filesData` resolves, `prefetchedData`
becomes an array and the controller hydrates from it. If the panel happened to mount before
`filesData` resolved (e.g., entity was faster), the controller falls back to its own fetch and
the later `prefetchedData` prop is ignored (already has data).

### Screens to update

Only screens that render `<AttachmentsPanel>` directly need this change. Screens that drive
attachments through `AtlasDetail`/`AtlasForm` blueprint renderers (fleet, contacts) are not
included here — those renderers would need a separate change.

| Screen | File path | Parallel queries to add |
|---|---|---|
| `InventoryItemDetail` | `apps/desktop/src/modules/atlas.inventory/screens/InventoryItemDetail.jsx` | files |
| `GrowthLeadDetailScreen` | `apps/desktop/src/modules/atlas.growth/screens/GrowthLeadDetailScreen.jsx` | files |
| `TaskDetailPanel` | `apps/desktop/src/modules/atlas.projects/components/TaskDetailPanel.jsx` | files |

`HrEmployeeDetail` has its own `FilesPanel` component that already uses `useQuery`. When
`GET /files` is enriched (Change 2), `FilesPanel` will receive inline signed URLs automatically.
The `batchSignedUrls` `useEffect` inside `FilesPanel` can then be removed as a cleanup step
(since signed URLs are already in the list response and the extra POST is no longer needed).

---

## Change 6 — Polling throttle

Two components poll the API every 15 s; each call takes 2–4 s on the VPS.

| File | Current | New |
|---|---|---|
| `packages/ui/src/components/ActivityBellTrigger.jsx` line 6 | `POLL_INTERVAL_MS = 15000` | `POLL_INTERVAL_MS = 60000` |
| `apps/desktop/src/components/NotificationBell.jsx` line 53 | `refetchInterval: 15000` | `refetchInterval: 60000` |

60 s is still frequent enough that users see new notifications promptly. The current 15 s cadence
provides no meaningful benefit over 60 s given the VPS latency.

---

## Change 7 — `atlas.inventory` activity bridge (deferred item)

`inventory-service.js` has no `activityBridge.logAndPublish` calls. The service already receives
`authUserId` in `createItem`, `updateItem`, `assignItem`, and `returnItem`. Add a bridge call at
the end of each operation:

```javascript
// createItem
await activityBridge.logAndPublish({
  companyId, actorId: authUserId, entityType: 'InvItem', entityId: item.id,
  verb: 'created', payload: { name: item.name },
});

// updateItem
await activityBridge.logAndPublish({
  companyId, actorId: authUserId, entityType: 'InvItem', entityId: id,
  verb: 'updated', payload: { fields: Object.keys(data) },
});

// assignItem
await activityBridge.logAndPublish({
  companyId, actorId: authUserId, entityType: 'InvItem', entityId: id,
  verb: 'assigned', payload: { employeeId },
});

// returnItem
await activityBridge.logAndPublish({
  companyId, actorId: authUserId, entityType: 'InvItem', entityId: id,
  verb: 'returned', payload: {},
});
```

`activityBridge` is already available in `createInventoryService`. Confirm the import path
matches how it is used in other services (e.g., `hr-service.js`).

---

## Data flow after all changes

```
URL params (id known immediately)
  ├─ useQuery: entity          ─┐
  ├─ useQuery: files (enriched) ─┤ all three start at the same time
  └─ useQuery: comments/etc.  ─┘
         │
         ├─ entity arrives first (3–4 s) → page renders skeleton then content
         └─ files arrive (≈ same time)  → passed as prefetchedData to AttachmentsPanel
               └─ signedUrls embedded → thumbnails show immediately, zero extra calls

Background
  ActivityBell: polls every 60 s (was 15 s)
  NotificationBell: polls every 60 s (was 15 s)
```

---

## Expected performance improvement

| Metric | Before | After |
|---|---|---|
| Time to show file thumbnails from page open | ~9–11 s | ~4–5 s |
| Extra signed-URL HTTP calls per page open | N (one per previewable file) | 0 |
| Upload time for 3 files | sequential (3 × T) | parallel (~T) |
| Background API calls per minute | ~8 (polls) | ~2 (polls) |

---

## Out of scope

- Caching signed URLs across page navigations (TanStack Query cache already handles this via
  `staleTime: 30_000` on the files query).
- Converting `useAttachmentsController` to use TanStack Query internally (larger refactor,
  not needed to achieve the performance goal).
- Reducing VPS round-trip latency (infrastructure concern, outside this spec).
- `atlas.notifications` inbox screen refactor (separate concern).

---

## Verification checklist

- [ ] `GET /inventory/items/:id/files` response includes `signedUrl` on image/PDF `file_asset` objects
- [ ] Only one Supabase `createSignedUrls` call per document-list request (verify in server logs)
- [ ] Opening an inventory detail page: DevTools shows entity query + files query starting within
      50 ms of each other (not sequential)
- [ ] Image thumbnails appear without any `GET /files/:id/signed-url` calls in DevTools network tab
- [ ] Uploading 3 files simultaneously: all three upload requests visible in DevTools at the same time
- [ ] `POLL_INTERVAL_MS` in `ActivityBellTrigger` is 60000; `refetchInterval` in `NotificationBell` is 60000
- [ ] Activity feed in inventory item detail shows created/updated/assigned/returned events
- [ ] No regressions: contacts, HR, fleet, projects detail screens all show file panels correctly
