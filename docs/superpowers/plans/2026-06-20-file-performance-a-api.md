# File Performance — Plan A: API Changes

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add batch signed URL enrichment to every document-list endpoint and wire the inventory activity bridge.

**Architecture:** `filesService` gains two new methods (`enrichFileAssets` for direct fileAsset rows, `enrichFilesWithSignedUrls` for association rows with nested `file_asset`). Each document-list route handler calls the appropriate method before returning. Fleet, growth, and projects routers receive `enrichFilesWithSignedUrls` or `enrichFileAssets` as a new constructor dependency. Inventory service receives the activityBridge pattern from HR service.

**Tech Stack:** Node.js, Hono, Prisma, Supabase Storage JS client (`supabaseAdmin.storage.createSignedUrls`)

**Spec:** `docs/superpowers/specs/2026-06-20-file-performance-design.md`

---

### Task 1: Add enrichment methods to `files-service.js`

**Files:**
- Modify: `apps/api/src/services/files-service.js` (add before `return { ... }` at line 634)

- [ ] **Step 1: Verify the file's return statement location**

Run: `node --check apps/api/src/services/files-service.js`
Expected: no output (syntax OK)

Find the closing `return {` of `createFilesService`. It's at approximately line 634. The new methods go inside this returned object.

- [ ] **Step 2: Add `enrichFileAssets` and `enrichFilesWithSignedUrls` to the returned object**

Open `apps/api/src/services/files-service.js`. Find the line:
```javascript
    async delete({ authUserId, id }) {
```

Before the final `};` closing brace (line 635), add the two new methods. The full insertion goes between `return { ok: true };` at the end of `delete` and the `};` that closes `createFilesService`. Locate the exact closing:

```javascript
      return { ok: true };
    },
  };
}
```

Replace it with:

```javascript
      return { ok: true };
    },

    async enrichFileAssets(fileAssets) {
      if (!Array.isArray(fileAssets) || fileAssets.length === 0) return fileAssets;
      const previewable = fileAssets.filter(
        (fa) =>
          String(fa.mimeType ?? "").startsWith("image/") ||
          fa.mimeType === "application/pdf",
      );
      if (previewable.length === 0) return fileAssets;

      const byBucket = new Map();
      for (const fa of previewable) {
        const bucket = fa.bucket ?? STORAGE_BUCKET_NAME;
        if (!byBucket.has(bucket)) byBucket.set(bucket, []);
        byBucket.get(bucket).push(fa);
      }

      const urlMap = new Map();
      await Promise.all(
        [...byBucket.entries()].map(async ([bucket, assets]) => {
          if (bucket === WEBSITE_BUCKET_NAME) {
            for (const fa of assets) {
              const { data } = supabaseAdmin.storage.from(bucket).getPublicUrl(fa.objectKey);
              urlMap.set(fa.id, { signedUrl: data?.publicUrl ?? null, expiresAt: null });
            }
            return;
          }
          const paths = assets.map((fa) => fa.objectKey);
          const { data: signedList } = await supabaseAdmin.storage
            .from(bucket)
            .createSignedUrls(paths, SIGNED_URL_SECONDS);
          if (Array.isArray(signedList)) {
            const expiresAt = new Date(Date.now() + SIGNED_URL_SECONDS * 1000).toISOString();
            for (let i = 0; i < assets.length; i++) {
              const url = signedList[i]?.signedUrl ?? null;
              urlMap.set(assets[i].id, { signedUrl: url, expiresAt: url ? expiresAt : null });
            }
          }
        }),
      );

      return fileAssets.map((fa) => {
        const entry = urlMap.get(fa.id);
        return entry
          ? { ...fa, signedUrl: entry.signedUrl, signedUrlExpiresAt: entry.expiresAt }
          : fa;
      });
    },

    async enrichFilesWithSignedUrls(associations) {
      if (!Array.isArray(associations) || associations.length === 0) return associations;
      const fileAssets = associations
        .map((a) => a.file_asset)
        .filter((fa) => fa?.id);
      if (fileAssets.length === 0) return associations;

      const enrichedAssets = await this.enrichFileAssets(fileAssets);
      const enrichedMap = new Map(enrichedAssets.map((fa) => [fa.id, fa]));
      return associations.map((assoc) => ({
        ...assoc,
        file_asset: assoc.file_asset
          ? (enrichedMap.get(assoc.file_asset.id) ?? assoc.file_asset)
          : null,
      }));
    },
  };
}
```

- [ ] **Step 3: Verify syntax**

Run: `node --check apps/api/src/services/files-service.js`
Expected: no output (syntax OK)

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/services/files-service.js
git commit -m "feat(files-service): add enrichFileAssets and enrichFilesWithSignedUrls batch methods"
```

---

### Task 2: Enrich the general `GET /files` list (fixes HR)

**Files:**
- Modify: `apps/api/src/services/files-service.js` — the `list()` method return (~line 356)

The `list()` method returns `{ data: rows, pagination: {...} }`. The `rows` are plain `fileAsset` records. After the Prisma query, enrich the rows before returning.

- [ ] **Step 1: Locate the `list()` return statement**

In `apps/api/src/services/files-service.js`, find (around line 354):
```javascript
      return {
        data: rows,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.max(1, Math.ceil(total / pageSize)),
        },
      };
```

- [ ] **Step 2: Enrich rows with signed URLs before returning**

Replace the return block with:
```javascript
      const enrichedRows = await this.enrichFileAssets(rows);
      return {
        data: enrichedRows,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.max(1, Math.ceil(total / pageSize)),
        },
      };
```

- [ ] **Step 3: Verify syntax**

Run: `node --check apps/api/src/services/files-service.js`
Expected: no output

- [ ] **Step 4: Manual smoke test**

Start the API: `pnpm dev:api`
Run (replace TOKEN with a valid session token):
```bash
curl -s -H "Authorization: Bearer $ATLAS_TOKEN" "http://localhost:4010/files?moduleKey=atlas.hr&limit=3" | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8'); const j=JSON.parse(d); console.log(j.data?.[0]?.signedUrl ?? 'no signedUrl')"
```
Expected: a signed URL string (starts with `https://`) for image/PDF files, or `null` for other types.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/services/files-service.js
git commit -m "feat(files): enrich GET /files list with inline signed URLs for image and PDF assets"
```

---

### Task 3: Enrich `GET /inventory/items/:id/files`

**Files:**
- Modify: `apps/api/src/index.js` (~line 4648)

- [ ] **Step 1: Find the route handler**

In `apps/api/src/index.js`, search for `GET /inventory/items/:id/files`. It looks like:
```javascript
app.get('/inventory/items/:id/files', authMiddleware, requirePermission('inventory.item.read'), async (c) => {
  try {
    const companyId = c.get('companyId');
    const { id } = c.req.param();
    const files = await inventoryService.listItemFiles(id, companyId);
    return c.json({ data: files });
  } catch (err) {
    if (err instanceof InventoryServiceError) return c.json({ error: err.message }, err.status);
    return c.json({ error: 'No se pudieron cargar los archivos.' }, 500);
  }
});
```

- [ ] **Step 2: Enrich the files list before returning**

Replace:
```javascript
    const files = await inventoryService.listItemFiles(id, companyId);
    return c.json({ data: files });
```
With:
```javascript
    const files = await inventoryService.listItemFiles(id, companyId);
    const enriched = await filesService.enrichFilesWithSignedUrls(files);
    return c.json({ data: enriched });
```

- [ ] **Step 3: Verify syntax**

Run: `node --check apps/api/src/index.js`
Expected: no output

- [ ] **Step 4: Manual smoke test**

With the API running:
```bash
curl -s -H "Authorization: Bearer $ATLAS_TOKEN" "http://localhost:4010/inventory/items/{ITEM_ID}/files" | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8'); const j=JSON.parse(d); const f=j.data?.[0]; console.log('signedUrl:', f?.file_asset?.signedUrl ?? f?.signedUrl ?? 'none')"
```
Expected: if the item has image/PDF files, `signedUrl` field appears on `file_asset`.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/index.js
git commit -m "feat(inventory): enrich GET /inventory/items/:id/files with inline signed URLs"
```

---

### Task 4: Add `enrichFilesWithSignedUrls` to fleet route factories

**Files:**
- Modify: `apps/api/src/index.js` (~line 4478) — `createFleetRouter` call
- Modify: `apps/api/src/routes/fleet/vehicles-routes.js` — `createFleetRouter` signature + vehicle docs handler + sub-router calls
- Modify: `apps/api/src/routes/fleet/drivers-routes.js` — `createDriversRouter` signature + driver docs handler
- Modify: `apps/api/src/routes/fleet/reports-routes.js` — `createReportsRouter` signature + report docs handler

- [ ] **Step 1: Pass `enrichFilesWithSignedUrls` when mounting fleet router in `index.js`**

In `apps/api/src/index.js`, find:
```javascript
mountWithAuth(app, createFleetRouter({ prisma, requirePermission }));
```
Replace with:
```javascript
mountWithAuth(app, createFleetRouter({ prisma, requirePermission, enrichFilesWithSignedUrls: filesService.enrichFilesWithSignedUrls.bind(filesService) }));
```

- [ ] **Step 2: Update `createFleetRouter` signature in `vehicles-routes.js`**

In `apps/api/src/routes/fleet/vehicles-routes.js`, find:
```javascript
export default function createFleetRouter({
  prisma,
  requirePermission,
  moduleContext,
  cache = null,
}) {
```
Replace with:
```javascript
export default function createFleetRouter({
  prisma,
  requirePermission,
  moduleContext,
  cache = null,
  enrichFilesWithSignedUrls = null,
}) {
```

- [ ] **Step 3: Enrich vehicle documents handler in `vehicles-routes.js`**

Find:
```javascript
      const result = await service.listVehicleDocuments({
        companyId,
        vehicleId: c.req.param("id"),
      });
      return c.json(result);
```
Replace with:
```javascript
      const result = await service.listVehicleDocuments({
        companyId,
        vehicleId: c.req.param("id"),
      });
      if (enrichFilesWithSignedUrls && Array.isArray(result?.data)) {
        result.data = await enrichFilesWithSignedUrls(result.data);
      }
      return c.json(result);
```

- [ ] **Step 4: Pass `enrichFilesWithSignedUrls` to sub-routers in `vehicles-routes.js`**

Find:
```javascript
  app.route(
    "",
    createDriversRouter({ prisma, requirePermission, moduleContext }),
  );
```
Replace with:
```javascript
  app.route(
    "",
    createDriversRouter({ prisma, requirePermission, moduleContext, enrichFilesWithSignedUrls }),
  );
```

Find:
```javascript
  app.route(
    "",
    createReportsRouter({ prisma, requirePermission, moduleContext }),
  );
```
Replace with:
```javascript
  app.route(
    "",
    createReportsRouter({ prisma, requirePermission, moduleContext, enrichFilesWithSignedUrls }),
  );
```

- [ ] **Step 5: Update `createDriversRouter` signature and enrich handler in `drivers-routes.js`**

Find:
```javascript
export function createDriversRouter({
  prisma,
  requirePermission,
  moduleContext,
}) {
```
Replace with:
```javascript
export function createDriversRouter({
  prisma,
  requirePermission,
  moduleContext,
  enrichFilesWithSignedUrls = null,
}) {
```

Find the `GET /fleet/drivers/:id/documents` handler body:
```javascript
        const result = await service.listDriverDocuments({
          companyId,
          driverId: c.req.param("id"),
        });
        return c.json(result);
```
Replace with:
```javascript
        const result = await service.listDriverDocuments({
          companyId,
          driverId: c.req.param("id"),
        });
        if (enrichFilesWithSignedUrls && Array.isArray(result?.data)) {
          result.data = await enrichFilesWithSignedUrls(result.data);
        }
        return c.json(result);
```

- [ ] **Step 6: Update `createReportsRouter` signature and enrich handler in `reports-routes.js`**

Find:
```javascript
export function createReportsRouter({
  prisma,
  requirePermission,
  moduleContext,
}) {
```
Replace with:
```javascript
export function createReportsRouter({
  prisma,
  requirePermission,
  moduleContext,
  enrichFilesWithSignedUrls = null,
}) {
```

Find the `GET /fleet/reports/:id/documents` handler body:
```javascript
        const result = await service.listReportDocuments({
          companyId,
          reportId: c.req.param("id"),
        });
        return c.json(result);
```
Replace with:
```javascript
        const result = await service.listReportDocuments({
          companyId,
          reportId: c.req.param("id"),
        });
        if (enrichFilesWithSignedUrls && Array.isArray(result?.data)) {
          result.data = await enrichFilesWithSignedUrls(result.data);
        }
        return c.json(result);
```

- [ ] **Step 7: Verify syntax on all changed files**

Run:
```bash
node --check apps/api/src/index.js && node --check apps/api/src/routes/fleet/vehicles-routes.js && node --check apps/api/src/routes/fleet/drivers-routes.js && node --check apps/api/src/routes/fleet/reports-routes.js
```
Expected: no output from any file

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/index.js apps/api/src/routes/fleet/vehicles-routes.js apps/api/src/routes/fleet/drivers-routes.js apps/api/src/routes/fleet/reports-routes.js
git commit -m "feat(fleet): enrich vehicle/driver/report document lists with inline signed URLs"
```

---

### Task 5: Add `enrichFileAssets` to growth and projects routers

**Files:**
- Modify: `apps/api/src/index.js` (~lines 4481, 4484) — router factory calls
- Modify: `apps/api/src/routes/growth/growth-router.js` — signature + pass to lead routes
- Modify: `apps/api/src/routes/growth/growth-lead-routes.js` — signature + enrich handler
- Modify: `apps/api/src/routes/projects/projects-routes.js` — signature + enrich task attachments handler

Growth and projects routes return direct `fileAsset` rows (not association rows), so they use `enrichFileAssets`.

- [ ] **Step 1: Pass `enrichFileAssets` when mounting growth and projects routers in `index.js`**

Find:
```javascript
mountWithAuth(app, createGrowthRouter({ prisma, requirePermission, notificationService }));
```
Replace with:
```javascript
mountWithAuth(app, createGrowthRouter({ prisma, requirePermission, notificationService, enrichFileAssets: filesService.enrichFileAssets.bind(filesService) }));
```

Find:
```javascript
mountWithAuth(app, createProjectsRouter({ prisma, requirePermission, notificationService }));
```
Replace with:
```javascript
mountWithAuth(app, createProjectsRouter({ prisma, requirePermission, notificationService, enrichFileAssets: filesService.enrichFileAssets.bind(filesService) }));
```

- [ ] **Step 2: Update `createGrowthRouter` in `growth-router.js`**

Find:
```javascript
export function createGrowthRouter({
  prisma,
  requirePermission,
  notificationService = createNotificationService({ prisma }),
}) {
```
Replace with:
```javascript
export function createGrowthRouter({
  prisma,
  requirePermission,
  notificationService = createNotificationService({ prisma }),
  enrichFileAssets = null,
}) {
```

Find:
```javascript
  app.route("", createGrowthLeadRoutes({ service, requirePermission }));
```
Replace with:
```javascript
  app.route("", createGrowthLeadRoutes({ service, requirePermission, enrichFileAssets }));
```

- [ ] **Step 3: Update `createGrowthLeadRoutes` in `growth-lead-routes.js`**

Find:
```javascript
export function createGrowthLeadRoutes({ service, requirePermission }) {
```
Replace with:
```javascript
export function createGrowthLeadRoutes({ service, requirePermission, enrichFileAssets = null }) {
```

Find the `GET /growth/leads/:id/files` handler body:
```javascript
        const data = await service.listLeadFiles({
          companyId: companyId(c),
          id: c.req.param("id"),
        });
        return c.json({ data });
```
Replace with:
```javascript
        let data = await service.listLeadFiles({
          companyId: companyId(c),
          id: c.req.param("id"),
        });
        if (enrichFileAssets && Array.isArray(data)) {
          data = await enrichFileAssets(data);
        }
        return c.json({ data });
```

- [ ] **Step 4: Update `createProjectsRouter` in `projects-routes.js`**

Find:
```javascript
export function createProjectsRouter({ prisma, requirePermission, notificationService }) {
```
Replace with:
```javascript
export function createProjectsRouter({ prisma, requirePermission, notificationService, enrichFileAssets = null }) {
```

Find the `GET /projects/:id/tasks/:tid/attachments` handler body:
```javascript
      const attachments = await prisma.fileAsset.findMany({
        where: { entityType: 'Task', entityId: taskId, enabled: true },
        orderBy: { createdAt: 'asc' },
      })
      return c.json(attachments)
```
Replace with:
```javascript
      let attachments = await prisma.fileAsset.findMany({
        where: { entityType: 'Task', entityId: taskId, enabled: true },
        orderBy: { createdAt: 'asc' },
      })
      if (enrichFileAssets && Array.isArray(attachments)) {
        attachments = await enrichFileAssets(attachments);
      }
      return c.json(attachments)
```

- [ ] **Step 5: Verify syntax**

Run:
```bash
node --check apps/api/src/index.js && node --check apps/api/src/routes/growth/growth-router.js && node --check apps/api/src/routes/growth/growth-lead-routes.js && node --check apps/api/src/routes/projects/projects-routes.js
```
Expected: no output

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/index.js apps/api/src/routes/growth/growth-router.js apps/api/src/routes/growth/growth-lead-routes.js apps/api/src/routes/projects/projects-routes.js
git commit -m "feat(growth,projects): enrich file/attachment list responses with inline signed URLs"
```

---

### Task 6: Add activity bridge to `inventory-service.js`

**Files:**
- Modify: `apps/api/src/services/inventory-service.js`

`createItem`, `updateItem`, `assignItem`, and `returnItem` need `bridge.logAndPublish(...)` calls. Pattern follows `hr-service.js`.

- [ ] **Step 1: Add imports at the top of `inventory-service.js`**

After the existing import `import { parseMentionIds } from '../lib/mention-utils.js'`, add:
```javascript
import { createActivityService } from './activity-service.js';
import { createActivityBridge } from './activity-bridge.js';
```

- [ ] **Step 2: Update `createInventoryService` signature and create bridge**

Find:
```javascript
export function createInventoryService({ prisma }) {
  // ── Resolve Supabase auth UUID → UserProfile.id ───────────────────────────
  async function resolveProfileId(authUserId) {
```
Replace with:
```javascript
export function createInventoryService({ prisma, activityBridge }) {
  const bridge =
    activityBridge ??
    createActivityBridge({
      prisma,
      activityService: createActivityService({ prisma }),
    });

  // ── Resolve Supabase auth UUID → UserProfile.id ───────────────────────────
  async function resolveProfileId(authUserId) {
```

- [ ] **Step 3: Add `logAndPublish` to `createItem`**

In `createItem`, after `return created;` for the simple (no-customValues) path, and after `return created;` inside the customValues transaction. Because both paths end with `return created`, find the final `return created;` of the function (after the while loop for the simple path) and add the bridge call.

The cleanest approach: wrap the function to add the bridge call at the end. Find the end of `createItem`:

```javascript
    return created;
  }

  async function updateItem(id, data, companyId) {
```

Replace with:
```javascript
    await bridge.logAndPublish({
      auditEntry: {
        actorId: creatorProfileId ?? 'system',
        moduleKey: 'atlas.inventory',
        entityType: 'InvItem',
        entityId: created.id,
        action: 'inventory.item.created',
        after: { name: created.name, assetTag: created.assetTag },
      },
      hint: { verb: 'created', label: created.name },
      companyId,
    }).catch(() => {});
    return created;
  }

  async function updateItem(id, data, companyId) {
```

Note: `.catch(() => {})` — activity bridge errors must never block the main operation.

- [ ] **Step 4: Add `logAndPublish` to `updateItem`**

At the end of `updateItem`, after the `return prisma.invItem.update(...)` line (the non-transaction path):

```javascript
    return prisma.invItem.update({
      where: { id },
      data: updateData,
      include: {
        category: { select: { id: true, name: true, icon: true, color: true } },
        brand: { select: { id: true, name: true } },
        location: { select: { id: true, name: true } },
      },
    });
  }
```

Change to:
```javascript
    const updated = await prisma.invItem.update({
      where: { id },
      data: updateData,
      include: {
        category: { select: { id: true, name: true, icon: true, color: true } },
        brand: { select: { id: true, name: true } },
        location: { select: { id: true, name: true } },
      },
    });
    await bridge.logAndPublish({
      auditEntry: {
        actorId: 'system',
        moduleKey: 'atlas.inventory',
        entityType: 'InvItem',
        entityId: id,
        action: 'inventory.item.updated',
        after: { fields: Object.keys(updateData) },
      },
      hint: { verb: 'updated', label: updated.name ?? id },
      companyId,
    }).catch(() => {});
    return updated;
  }
```

For the transaction path in `updateItem` (the one that returns `tx.invItem.findFirst`), add the bridge call after the `return prisma.$transaction(...)` is awaited. Change:
```javascript
    if (customValues && Array.isArray(customValues) && customValues.length > 0) {
      return prisma.$transaction(async (tx) => {
        await tx.invItem.update({ where: { id }, data: updateData });
        for (const cv of customValues) {
          await tx.invCustomFieldValue.upsert({...});
        }
        return tx.invItem.findFirst({
          where: { id },
          include: {...},
        });
      });
    }
```
Replace with:
```javascript
    if (customValues && Array.isArray(customValues) && customValues.length > 0) {
      const result = await prisma.$transaction(async (tx) => {
        await tx.invItem.update({ where: { id }, data: updateData });
        for (const cv of customValues) {
          await tx.invCustomFieldValue.upsert({
            where: { itemId_fieldId: { itemId: id, fieldId: cv.fieldId } },
            update: { value: cv.value ?? null },
            create: { itemId: id, fieldId: cv.fieldId, value: cv.value ?? null },
          });
        }
        return tx.invItem.findFirst({
          where: { id },
          include: {
            category: { select: { id: true, name: true, icon: true, color: true } },
            brand: { select: { id: true, name: true } },
            location: { select: { id: true, name: true } },
            customValues: { include: { field: { select: { id: true, label: true, fieldKey: true, fieldType: true, options: true } } } },
          },
        });
      });
      await bridge.logAndPublish({
        auditEntry: {
          actorId: 'system',
          moduleKey: 'atlas.inventory',
          entityType: 'InvItem',
          entityId: id,
          action: 'inventory.item.updated',
          after: { fields: Object.keys(updateData) },
        },
        hint: { verb: 'updated', label: result?.name ?? id },
        companyId,
      }).catch(() => {});
      return result;
    }
```

- [ ] **Step 5: Add `logAndPublish` to `assignItem`**

At the end of `assignItem`, after `return { item: updatedItem, assignment };`:
```javascript
      return { item: updatedItem, assignment };
    });
  }
```
Replace with:
```javascript
      await bridge.logAndPublish({
        auditEntry: {
          actorId: actorProfileId ?? 'system',
          moduleKey: 'atlas.inventory',
          entityType: 'InvItem',
          entityId: itemId,
          action: 'inventory.item.assigned',
          after: { employeeId },
        },
        hint: { verb: 'assigned', label: item.name ?? itemId },
        companyId,
      }).catch(() => {});
      return { item: updatedItem, assignment };
    });
  }
```

- [ ] **Step 6: Add `logAndPublish` to `returnItem`**

At the end of `returnItem`, after the `return tx.invItem.update(...)`:
```javascript
      return tx.invItem.update({
        where: { id: itemId },
        data: { status: 'available', assignedToId: null, assignedAt: null },
        include: {
          category: { select: { id: true, name: true, icon: true, color: true } },
          brand: { select: { id: true, name: true } },
          location: { select: { id: true, name: true } },
        },
      });
    });
  }
```
Replace with:
```javascript
      const returned = await tx.invItem.update({
        where: { id: itemId },
        data: { status: 'available', assignedToId: null, assignedAt: null },
        include: {
          category: { select: { id: true, name: true, icon: true, color: true } },
          brand: { select: { id: true, name: true } },
          location: { select: { id: true, name: true } },
        },
      });
      return returned;
    });
    await bridge.logAndPublish({
      auditEntry: {
        actorId: 'system',
        moduleKey: 'atlas.inventory',
        entityType: 'InvItem',
        entityId: itemId,
        action: 'inventory.item.returned',
        after: { status: 'available' },
      },
      hint: { verb: 'returned', label: item.name ?? itemId },
      companyId,
    }).catch(() => {});
    return result;
  }
```

Wait — `result` is the return value of `prisma.$transaction(...)`. Change the whole `returnItem` function:

```javascript
  async function returnItem(itemId, assignedById, notes, companyId) {
    const item = await prisma.invItem.findFirst({ where: { id: itemId, companyId, enabled: true } });
    if (!item) throw new InventoryServiceError('Item not found', 404);
    if (!item.assignedToId && item.status !== 'assigned') throw new InventoryServiceError('Item is not currently assigned', 409);

    const result = await prisma.$transaction(async (tx) => {
      const activeAssignment = await tx.invAssignment.findFirst({
        where: { itemId, returnedAt: null },
        orderBy: { assignedAt: 'desc' },
      });

      if (activeAssignment) {
        await tx.invAssignment.update({
          where: { id: activeAssignment.id },
          data: { returnedAt: new Date(), ...(notes !== undefined ? { notes } : {}) },
        });
      }

      return tx.invItem.update({
        where: { id: itemId },
        data: { status: 'available', assignedToId: null, assignedAt: null },
        include: {
          category: { select: { id: true, name: true, icon: true, color: true } },
          brand: { select: { id: true, name: true } },
          location: { select: { id: true, name: true } },
        },
      });
    });

    await bridge.logAndPublish({
      auditEntry: {
        actorId: 'system',
        moduleKey: 'atlas.inventory',
        entityType: 'InvItem',
        entityId: itemId,
        action: 'inventory.item.returned',
        after: { status: 'available' },
      },
      hint: { verb: 'returned', label: item.name ?? itemId },
      companyId,
    }).catch(() => {});
    return result;
  }
```

- [ ] **Step 7: Verify syntax**

Run: `node --check apps/api/src/services/inventory-service.js`
Expected: no output

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/services/inventory-service.js
git commit -m "feat(inventory): add activity bridge logging for create/update/assign/return operations"
```

---

### Task 7: End-to-end verification

- [ ] **Step 1: Start the API**

Run: `pnpm dev:api`

- [ ] **Step 2: Check inventory files endpoint returns signed URLs**

```bash
curl -s -H "Authorization: Bearer $ATLAS_TOKEN" "http://localhost:4010/inventory/items/{YOUR_ITEM_ID}/files"
```
Expected: response where each item with an image/PDF `file_asset` has `file_asset.signedUrl` set to a `https://` URL.

- [ ] **Step 3: Check fleet driver files endpoint returns signed URLs**

```bash
curl -s -H "Authorization: Bearer $ATLAS_TOKEN" "http://localhost:4010/fleet/drivers/{DRIVER_ID}/documents"
```
Expected: similar `signedUrl` on `file_asset` for image/PDF files.

- [ ] **Step 4: Check general files list returns signed URLs**

```bash
curl -s -H "Authorization: Bearer $ATLAS_TOKEN" "http://localhost:4010/files?moduleKey=atlas.hr&limit=5"
```
Expected: `signedUrl` field on each image/PDF row.

- [ ] **Step 5: Verify no extra Supabase calls**

Check API logs — each document-list request should make exactly ONE `createSignedUrls` call per bucket (or zero if no previewable files). You should NOT see N individual `createSignedUrl` calls.

- [ ] **Step 6: Commit verification complete marker in plan**

No code commit needed — Plan A is complete. Plan B (UI changes) depends on this plan's changes.
