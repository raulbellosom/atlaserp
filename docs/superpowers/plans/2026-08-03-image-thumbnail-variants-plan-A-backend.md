# Image Thumbnail Variants — Plan A (Backend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Serve resized image variants (instead of full-resolution originals) from every backend signed/public URL generation call site that feeds an avatar, chat image, or catalog product image, using Supabase Storage's existing imgproxy transform pipeline.

**Architecture:** A new pure helper module (`apps/api/src/lib/image-variants.js`) wraps `createSignedUrl`/`createSignedUrls`/`getPublicUrl` with a `{ transform }` option keyed by a named variant (`thumb`/`card`/`product`/`full`). Every existing call site that currently calls those Supabase Storage methods directly is updated to go through the helper, picking the variant appropriate to where that URL is displayed. The one exception (notes cover/inline images, which persist a literal public URL rather than a file reference) is handled entirely in Plan B (frontend), not here.

**Tech Stack:** Node.js, Hono, `@supabase/supabase-js@^2.105.1`, Prisma, `node --test` (Node's built-in test runner — no Vitest/Jest in this repo).

**Depends on spec:** `docs/superpowers/specs/2026-08-03-image-thumbnail-variants-design.md`

---

## Corrections vs. the spec (discovered during planning — apply these, not the spec's literal wording)

1. The spec says "extend `getSignedUrlByFileId` with a `variant` param" for the on-demand full-res endpoint. That function (`apps/api/src/index.js:552`) is an **internal helper**, not an HTTP-exposed endpoint — it's used to embed `avatarUrl` inline in several responses. The actual HTTP endpoint the frontend already calls on demand is `GET /files/:id/signed-url`, backed by `filesService.getSignedUrl()` (`apps/api/src/services/files-service.js:600`). **That** is the one that gains `variant` support (Task 3), not `getSignedUrlByFileId`. `getSignedUrlByFileId` itself also gains a `variant` param (Task 2) so its many internal callers can each pick the right size.
2. Company logo (`company-service.js:getSignedLogoUrl`) is **dropped from scope**. It already has a working full-screen zoom viewer (`CompanyBranding.jsx`) that reuses the same URL for both the small preview and the full view — capping it at a small variant would make that viewer show a blurry upscaled image, a regression the spec didn't account for. Logos are also not the reported performance problem. Out of scope for this plan.
3. `storefront-files-service.js` is **dropped from scope**. Its `getUrl()` method is generic (serves images, PDFs, audio, video for storefront vendors) and has no notion of "this is a product-grid image" — the actual product-grid path is `catalog-product-service.js:resolveImageUrls`, which is in scope (Task 6).
4. Notes cover banners and inline body images are **not touched in this backend plan** — see Plan B. They're `atlas-notes` (public bucket) URLs persisted as literal strings in the note's `cover_url` column / Tiptap document JSON, not resolved fresh from a `FileAsset` id on every read like everything else in this table. Rewriting them is a frontend-only, no-network-round-trip change (see Plan B Task 1-3).

---

### Task 1: Create the shared image-variant helper

**Files:**
- Create: `apps/api/src/lib/image-variants.js`
- Test: `apps/api/src/lib/__tests__/image-variants.test.js`

- [ ] **Step 1: Write the failing test**

```js
// apps/api/src/lib/__tests__/image-variants.test.js
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  IMAGE_VARIANTS,
  signedUrlWithVariant,
  signedUrlsWithVariant,
  publicUrlWithVariant,
} from '../image-variants.js'

function fakeSupabaseAdmin({ signedUrl = 'https://x/signed', signedUrls = null, publicUrl = 'https://x/public' } = {}) {
  const calls = { createSignedUrl: [], createSignedUrls: [], getPublicUrl: [] }
  return {
    calls,
    storage: {
      from(bucket) {
        return {
          async createSignedUrl(objectKey, expiresIn, options) {
            calls.createSignedUrl.push({ bucket, objectKey, expiresIn, options })
            return { data: { signedUrl }, error: null }
          },
          async createSignedUrls(objectKeys, expiresIn, options) {
            calls.createSignedUrls.push({ bucket, objectKeys, expiresIn, options })
            return {
              data: signedUrls ?? objectKeys.map((path) => ({ path, signedUrl: `${signedUrl}/${path}` })),
              error: null,
            }
          },
          getPublicUrl(objectKey, options) {
            calls.getPublicUrl.push({ bucket, objectKey, options })
            return { data: { publicUrl: `${publicUrl}/${objectKey}` } }
          },
        }
      },
    },
  }
}

describe('IMAGE_VARIANTS', () => {
  it('defines thumb, card, banner, product with width/height/resize/quality, and full as null', () => {
    assert.deepEqual(IMAGE_VARIANTS.thumb, { width: 40, height: 40, resize: 'cover', quality: 70 })
    assert.deepEqual(IMAGE_VARIANTS.card, { width: 96, height: 96, resize: 'cover', quality: 75 })
    assert.deepEqual(IMAGE_VARIANTS.banner, { width: 1600, height: 400, resize: 'cover', quality: 80 })
    assert.deepEqual(IMAGE_VARIANTS.product, { width: 480, height: 480, resize: 'contain', quality: 80 })
    assert.equal(IMAGE_VARIANTS.full, null)
  })
})

describe('signedUrlWithVariant', () => {
  it('passes the transform option matching the requested variant', async () => {
    const supabaseAdmin = fakeSupabaseAdmin()
    const url = await signedUrlWithVariant(supabaseAdmin, 'atlas-files', 'a/b.png', 'thumb')
    assert.equal(url, 'https://x/signed')
    assert.deepEqual(supabaseAdmin.calls.createSignedUrl[0], {
      bucket: 'atlas-files',
      objectKey: 'a/b.png',
      expiresIn: 3600,
      options: { transform: IMAGE_VARIANTS.thumb },
    })
  })

  it('omits the transform option for the full variant', async () => {
    const supabaseAdmin = fakeSupabaseAdmin()
    await signedUrlWithVariant(supabaseAdmin, 'atlas-files', 'a/b.png', 'full')
    assert.deepEqual(supabaseAdmin.calls.createSignedUrl[0].options, {})
  })

  it('omits the transform option for an unrecognized variant', async () => {
    const supabaseAdmin = fakeSupabaseAdmin()
    await signedUrlWithVariant(supabaseAdmin, 'atlas-files', 'a/b.png', 'nonsense')
    assert.deepEqual(supabaseAdmin.calls.createSignedUrl[0].options, {})
  })

  it('respects a custom expiresIn', async () => {
    const supabaseAdmin = fakeSupabaseAdmin()
    await signedUrlWithVariant(supabaseAdmin, 'atlas-files', 'a/b.png', 'card', 1800)
    assert.equal(supabaseAdmin.calls.createSignedUrl[0].expiresIn, 1800)
  })

  it('returns null when there is no bucket/objectKey', async () => {
    const supabaseAdmin = fakeSupabaseAdmin()
    assert.equal(await signedUrlWithVariant(supabaseAdmin, null, null, 'thumb'), null)
  })
})

describe('signedUrlsWithVariant', () => {
  it('passes the transform option and returns signed URLs keyed by input order', async () => {
    const supabaseAdmin = fakeSupabaseAdmin()
    const urls = await signedUrlsWithVariant(supabaseAdmin, 'atlas-files', ['a.png', 'b.png'], 'card')
    assert.deepEqual(urls, ['https://x/signed/a.png', 'https://x/signed/b.png'])
    assert.deepEqual(supabaseAdmin.calls.createSignedUrls[0], {
      bucket: 'atlas-files',
      objectKeys: ['a.png', 'b.png'],
      expiresIn: 3600,
      options: { transform: IMAGE_VARIANTS.card },
    })
  })

  it('returns an empty array for an empty input', async () => {
    const supabaseAdmin = fakeSupabaseAdmin()
    assert.deepEqual(await signedUrlsWithVariant(supabaseAdmin, 'atlas-files', [], 'card'), [])
    assert.equal(supabaseAdmin.calls.createSignedUrls.length, 0)
  })
})

describe('publicUrlWithVariant', () => {
  it('passes the transform option matching the requested variant', () => {
    const supabaseAdmin = fakeSupabaseAdmin()
    const url = publicUrlWithVariant(supabaseAdmin, 'atlas-website', 'a/b.png', 'product')
    assert.equal(url, 'https://x/public/a/b.png')
    assert.deepEqual(supabaseAdmin.calls.getPublicUrl[0], {
      bucket: 'atlas-website',
      objectKey: 'a/b.png',
      options: { transform: IMAGE_VARIANTS.product },
    })
  })

  it('omits the transform option for the full variant', () => {
    const supabaseAdmin = fakeSupabaseAdmin()
    publicUrlWithVariant(supabaseAdmin, 'atlas-website', 'a/b.png', 'full')
    assert.deepEqual(supabaseAdmin.calls.getPublicUrl[0].options, {})
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test apps/api/src/lib/__tests__/image-variants.test.js`
Expected: FAIL — `Cannot find module '../image-variants.js'`

- [ ] **Step 3: Write the implementation**

```js
// apps/api/src/lib/image-variants.js

// Named image-transform presets applied to Supabase Storage signed/public URLs
// via the imgproxy sidecar (confirmed active on the self-hosted instance —
// see docs/superpowers/specs/2026-08-03-image-thumbnail-variants-design.md).
// `full` means "no transform, serve the original".
export const IMAGE_VARIANTS = {
  thumb: { width: 40, height: 40, resize: 'cover', quality: 70 },
  card: { width: 96, height: 96, resize: 'cover', quality: 75 },
  banner: { width: 1600, height: 400, resize: 'cover', quality: 80 },
  product: { width: 480, height: 480, resize: 'contain', quality: 80 },
  full: null,
}

function transformOptions(variant) {
  const preset = IMAGE_VARIANTS[variant]
  return preset ? { transform: preset } : {}
}

export async function signedUrlWithVariant(supabaseAdmin, bucket, objectKey, variant, expiresIn = 3600) {
  if (!bucket || !objectKey) return null
  const { data, error } = await supabaseAdmin.storage
    .from(bucket)
    .createSignedUrl(objectKey, expiresIn, transformOptions(variant))
  if (error) return null
  return data?.signedUrl ?? null
}

export async function signedUrlsWithVariant(supabaseAdmin, bucket, objectKeys, variant, expiresIn = 3600) {
  if (!bucket || !objectKeys?.length) return []
  const { data, error } = await supabaseAdmin.storage
    .from(bucket)
    .createSignedUrls(objectKeys, expiresIn, transformOptions(variant))
  if (error || !Array.isArray(data)) return objectKeys.map(() => null)
  return data.map((entry) => entry?.signedUrl ?? null)
}

export function publicUrlWithVariant(supabaseAdmin, bucket, objectKey, variant) {
  if (!bucket || !objectKey) return null
  const { data } = supabaseAdmin.storage.from(bucket).getPublicUrl(objectKey, transformOptions(variant))
  return data?.publicUrl ?? null
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test apps/api/src/lib/__tests__/image-variants.test.js`
Expected: PASS (11 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/lib/image-variants.js apps/api/src/lib/__tests__/image-variants.test.js
git commit -m "feat(api): add image-variant transform helper for signed/public URLs"
```

---

### Task 2: Wire identity/HR avatar URL generation through the helper

**Files:**
- Modify: `apps/api/src/index.js:86-92` (import), `552-562` (`getSignedUrlByFileId`), `660-690` (`buildAvatarUrlMapByFileIds`), `1143`, `1173-1176`, `1176-1198` (add `avatarFileId` to response), `1249`, `1308`, `2906`, `4480-4569` (org chart)

- [ ] **Step 1: Add the import**

In `apps/api/src/index.js`, after the existing `./lib/cache.js` import block (ends at line 92), add:

```js
import {
  signedUrlWithVariant,
  signedUrlsWithVariant,
} from "./lib/image-variants.js";
```

- [ ] **Step 2: Add a `variant` parameter to `getSignedUrlByFileId`**

Replace (`apps/api/src/index.js:552-562`):

```js
async function getSignedUrlByFileId(fileId) {
  if (!fileId) return null;
  const fileAsset = await prisma.fileAsset.findUnique({
    where: { id: fileId },
  });
  if (!fileAsset) return null;
  const { data } = await supabaseAdmin.storage
    .from(fileAsset.bucket)
    .createSignedUrl(fileAsset.objectKey, 3600);
  return data?.signedUrl ?? null;
}
```

with:

```js
async function getSignedUrlByFileId(fileId, variant = "full") {
  if (!fileId) return null;
  const fileAsset = await prisma.fileAsset.findUnique({
    where: { id: fileId },
  });
  if (!fileAsset) return null;
  return signedUrlWithVariant(
    supabaseAdmin,
    fileAsset.bucket,
    fileAsset.objectKey,
    variant,
  );
}
```

- [ ] **Step 3: Add a `variant` parameter to `buildAvatarUrlMapByFileIds`**

Replace (`apps/api/src/index.js:660-690`):

```js
async function buildAvatarUrlMapByFileIds(fileIds) {
  const avatarUrlMap = new Map();
  if (!fileIds.length) return avatarUrlMap;

  const fileAssets = await prisma.fileAsset.findMany({
    where: { id: { in: fileIds } },
    select: { id: true, bucket: true, objectKey: true },
  });
  const byBucket = new Map();
  for (const asset of fileAssets) {
    if (!byBucket.has(asset.bucket)) byBucket.set(asset.bucket, []);
    byBucket.get(asset.bucket).push(asset);
  }
  await Promise.all(
    [...byBucket.entries()].map(async ([bucket, assets]) => {
      const paths = assets.map((asset) => asset.objectKey);
      const { data: signedList } = await supabaseAdmin.storage
        .from(bucket)
        .createSignedUrls(paths, 3600);
      if (!Array.isArray(signedList)) return;
      for (let index = 0; index < assets.length; index += 1) {
        avatarUrlMap.set(
          assets[index].id,
          signedList[index]?.signedUrl ?? null,
        );
      }
    }),
  );

  return avatarUrlMap;
}
```

with:

```js
async function buildAvatarUrlMapByFileIds(fileIds, variant = "thumb") {
  const avatarUrlMap = new Map();
  if (!fileIds.length) return avatarUrlMap;

  const fileAssets = await prisma.fileAsset.findMany({
    where: { id: { in: fileIds } },
    select: { id: true, bucket: true, objectKey: true },
  });
  const byBucket = new Map();
  for (const asset of fileAssets) {
    if (!byBucket.has(asset.bucket)) byBucket.set(asset.bucket, []);
    byBucket.get(asset.bucket).push(asset);
  }
  await Promise.all(
    [...byBucket.entries()].map(async ([bucket, assets]) => {
      const paths = assets.map((asset) => asset.objectKey);
      const signedUrls = await signedUrlsWithVariant(
        supabaseAdmin,
        bucket,
        paths,
        variant,
      );
      assets.forEach((asset, index) => {
        avatarUrlMap.set(asset.id, signedUrls[index] ?? null);
      });
    }),
  );

  return avatarUrlMap;
}
```

This is the function backing `GET /identity/users` (the user list/picker) — defaulting to `thumb` fixes the exact "list of users with avatars" slowness reported.

- [ ] **Step 4: Use `card` variant + expose `avatarFileId` for the current-user profile endpoints**

These four call sites all serve the *current user's own* avatar (topbar, `ProfileScreen`, avatar upload confirmation) — `card` (96px) is a generous size for all of them, and the raw `avatarFileId` needs to be exposed so the frontend can fetch a true `full` variant when the zoom viewer opens (Plan B Task 5).

Replace `apps/api/src/index.js:1143`:
```js
    const avatarUrl = await getSignedUrlByFileId(context.profile.avatarFileId);
```
with:
```js
    const avatarUrl = await getSignedUrlByFileId(context.profile.avatarFileId, "card");
```

Replace `apps/api/src/index.js:1173-1175`:
```js
      const avatarUrl = await getSignedUrlByFileId(
        context.profile.avatarFileId,
      );
```
with:
```js
      const avatarUrl = await getSignedUrlByFileId(
        context.profile.avatarFileId,
        "card",
      );
```

In the same handler's response body (`apps/api/src/index.js:1177-1197`), add `avatarFileId` next to `avatarUrl`:
```js
        data: {
          id: context.profile.id,
          firstName: context.profile.firstName,
          lastName: context.profile.lastName,
          displayName: context.profile.displayName,
          email: context.profile.email,
          avatarUrl,
          avatarFileId: context.profile.avatarFileId,
          birthDate: context.profile.birthDate,
```

Replace `apps/api/src/index.js:1249`:
```js
      const avatarUrl = await getSignedUrlByFileId(updated.avatarFileId);
```
with:
```js
      const avatarUrl = await getSignedUrlByFileId(updated.avatarFileId, "card");
```

Replace that same handler's response body (`apps/api/src/index.js:1251-1273`):
```js
      return c.json({
        data: {
          id: updated.id,
          firstName: updated.firstName,
          lastName: updated.lastName,
          displayName: updated.displayName,
          email: updated.email,
          avatarUrl,
          birthDate: updated.birthDate,
          gender: updated.gender,
          phone: updated.phone,
          country: updated.country,
          state: updated.state,
          city: updated.city,
          colony: updated.colony,
          street: updated.street,
          extNumber: updated.extNumber,
          intNumber: updated.intNumber,
          postalCode: updated.postalCode,
          bio: updated.bio,
          role: context.roleKey,
        },
      });
```
with:
```js
      return c.json({
        data: {
          id: updated.id,
          firstName: updated.firstName,
          lastName: updated.lastName,
          displayName: updated.displayName,
          email: updated.email,
          avatarUrl,
          avatarFileId: updated.avatarFileId,
          birthDate: updated.birthDate,
          gender: updated.gender,
          phone: updated.phone,
          country: updated.country,
          state: updated.state,
          city: updated.city,
          colony: updated.colony,
          street: updated.street,
          extNumber: updated.extNumber,
          intNumber: updated.intNumber,
          postalCode: updated.postalCode,
          bio: updated.bio,
          role: context.roleKey,
        },
      });
```

Replace `apps/api/src/index.js:1308`:
```js
      const avatarUrl = await getSignedUrlByFileId(asset.id);
      return c.json({ data: { avatarUrl } });
```
with:
```js
      const avatarUrl = await getSignedUrlByFileId(asset.id, "card");
      return c.json({ data: { avatarUrl, avatarFileId: asset.id } });
```

- [ ] **Step 5: Use `card` variant for the admin-editing-another-user avatar upload response**

Replace `apps/api/src/index.js:2906-2907`:
```js
      const avatarUrl = await getSignedUrlByFileId(asset.id);
      return c.json({ data: { avatarUrl } });
```
with:
```js
      const avatarUrl = await getSignedUrlByFileId(asset.id, "card");
      return c.json({ data: { avatarUrl, avatarFileId: asset.id } });
```

(`UserEditorScreen.jsx` already receives `avatarFileId` for free today via the identity users list response spreading the raw Prisma row — this makes the upload-confirmation response consistent with that.)

- [ ] **Step 6: Default the identity users list to `thumb`**

`apps/api/src/index.js:2453-2459` already calls `buildAvatarUrlMapByFileIds(avatarFileIds)` with no second argument, which now defaults to `"thumb"` from Step 3 — no code change needed here, just confirm by reading the surrounding lines that nothing else needs updating.

- [ ] **Step 7: Use `card` variant for org chart avatars and employee profile images**

Replace `apps/api/src/index.js:4502-4519`:
```js
        await Promise.all(
          [...byBucket.entries()].map(async ([bucket, assets]) => {
            const { data: signedList } = await supabaseAdmin.storage
              .from(bucket)
              .createSignedUrls(
                assets.map((a) => a.objectKey),
                3600,
              );
            if (Array.isArray(signedList)) {
              for (let i = 0; i < assets.length; i++) {
                orgAvatarUrlMap.set(
                  assets[i].id,
                  signedList[i]?.signedUrl ?? null,
                );
              }
            }
          }),
        );
```
with:
```js
        await Promise.all(
          [...byBucket.entries()].map(async ([bucket, assets]) => {
            const signedUrls = await signedUrlsWithVariant(
              supabaseAdmin,
              bucket,
              assets.map((a) => a.objectKey),
              "card",
            );
            assets.forEach((asset, i) => {
              orgAvatarUrlMap.set(asset.id, signedUrls[i] ?? null);
            });
          }),
        );
```

Replace `apps/api/src/index.js:4544-4561` (the `profileImageFileId` batch, same shape) the same way:
```js
        await Promise.all(
          [...profileByBucket.entries()].map(async ([bucket, assets]) => {
            const { data: signedList } = await supabaseAdmin.storage
              .from(bucket)
              .createSignedUrls(
                assets.map((a) => a.objectKey),
                3600,
              );
            if (Array.isArray(signedList)) {
              for (let i = 0; i < assets.length; i++) {
                orgProfileUrlMap.set(
                  assets[i].id,
                  signedList[i]?.signedUrl ?? null,
                );
              }
            }
          }),
        );
```
with:
```js
        await Promise.all(
          [...profileByBucket.entries()].map(async ([bucket, assets]) => {
            const signedUrls = await signedUrlsWithVariant(
              supabaseAdmin,
              bucket,
              assets.map((a) => a.objectKey),
              "card",
            );
            assets.forEach((asset, i) => {
              orgProfileUrlMap.set(asset.id, signedUrls[i] ?? null);
            });
          }),
        );
```

- [ ] **Step 8: Static-check the file**

Run: `node --check apps/api/src/index.js`
Expected: no output (syntax OK)

- [ ] **Step 9: Manual verification**

With the API running (`pnpm dev:api`), as an authenticated user:
```bash
curl -s http://localhost:4010/identity/users?pageSize=1 -H "Authorization: Bearer $ATLAS_TOKEN" | grep -o 'width=40'
```
Expected: at least one match (confirms the `thumb` transform param made it into the returned `avatarUrl`).

- [ ] **Step 10: Commit**

```bash
git add apps/api/src/index.js
git commit -m "feat(api): serve thumb/card avatar variants for identity, HR org chart"
```

---

### Task 3: Add `variant` support to the generic `/files/:id/signed-url` endpoint

**Files:**
- Modify: `apps/api/src/services/files-service.js:1` (import), `600-626` (`getSignedUrl`)
- Modify: `apps/api/src/index.js:2039-2059` (route handler)

- [ ] **Step 1: Import the helper in `files-service.js`**

At the top of `apps/api/src/services/files-service.js` (line 1), add below the existing `import JSZip from "jszip";`:

```js
import { signedUrlWithVariant, publicUrlWithVariant } from "../lib/image-variants.js";
```

- [ ] **Step 2: Thread `variant` through `getSignedUrl`**

Replace (`apps/api/src/services/files-service.js:600-626`):

```js
    async getSignedUrl({ authUserId, id }) {
      const { companyId } = await getUserCompanyContext(authUserId);
      const file = await ensureFileBelongsToCompany({
        fileId: id,
        companyId,
        includeDisabled: false,
      });

      if (file.visibility === "PUBLIC" || file.bucket === WEBSITE_BUCKET_NAME) {
        const { data } = supabaseAdmin.storage.from(file.bucket).getPublicUrl(file.objectKey)
        return { signedUrl: data.publicUrl, expiresIn: null, permanent: true }
      }

      const { data, error } = await supabaseAdmin.storage
        .from(file.bucket)
        .createSignedUrl(file.objectKey, SIGNED_URL_SECONDS);

      if (error || !data?.signedUrl) {
        throw new FilesServiceError(
          "No se pudo generar el enlace de descarga.",
          500,
        );
      }

      return {
        signedUrl: data.signedUrl,
```

with:

```js
    async getSignedUrl({ authUserId, id, variant = "full" }) {
      const { companyId } = await getUserCompanyContext(authUserId);
      const file = await ensureFileBelongsToCompany({
        fileId: id,
        companyId,
        includeDisabled: false,
      });

      if (file.visibility === "PUBLIC" || file.bucket === WEBSITE_BUCKET_NAME) {
        const publicUrl = publicUrlWithVariant(supabaseAdmin, file.bucket, file.objectKey, variant)
        return { signedUrl: publicUrl, expiresIn: null, permanent: true }
      }

      const signedUrl = await signedUrlWithVariant(
        supabaseAdmin,
        file.bucket,
        file.objectKey,
        variant,
        SIGNED_URL_SECONDS,
      );

      if (!signedUrl) {
        throw new FilesServiceError(
          "No se pudo generar el enlace de descarga.",
          500,
        );
      }

      return {
        signedUrl,
```

(Leave the rest of the return object — the lines after `signedUrl: data.signedUrl,` in the original — unchanged; only the two lines shown above change.)

- [ ] **Step 3: Forward the `variant` query param from the route**

Replace (`apps/api/src/index.js:2039-2059`):

```js
app.get(
  "/files/:id/signed-url",
  authMiddleware,
  requirePermission("files.assets.read"),
  async (c) => {
    try {
      const authUserId = c.get("authUserId");
      const id = c.req.param("id");
      const data = await filesService.getSignedUrl({ authUserId, id });
      return c.json({ data });
    } catch (err) {
      if (err instanceof FilesServiceError) {
        return c.json({ error: err.message }, err.status);
      }
      return c.json(
        { error: "No se pudo generar el enlace del archivo." },
        500,
      );
    }
  },
);
```

with:

```js
app.get(
  "/files/:id/signed-url",
  authMiddleware,
  requirePermission("files.assets.read"),
  async (c) => {
    try {
      const authUserId = c.get("authUserId");
      const id = c.req.param("id");
      const variant = c.req.query("variant") || "full";
      const data = await filesService.getSignedUrl({ authUserId, id, variant });
      return c.json({ data });
    } catch (err) {
      if (err instanceof FilesServiceError) {
        return c.json({ error: err.message }, err.status);
      }
      return c.json(
        { error: "No se pudo generar el enlace del archivo." },
        500,
      );
    }
  },
);
```

- [ ] **Step 4: Static-check both files**

Run: `node --check apps/api/src/services/files-service.js && node --check apps/api/src/index.js`
Expected: no output

- [ ] **Step 5: Manual verification**

```bash
curl -s "http://localhost:4010/files/$SOME_FILE_ID/signed-url?variant=thumb" -H "Authorization: Bearer $ATLAS_TOKEN"
curl -s "http://localhost:4010/files/$SOME_FILE_ID/signed-url" -H "Authorization: Bearer $ATLAS_TOKEN"
```
Expected: first response's `signedUrl` contains `width=40`; second (no `variant`) does not contain any `width=` param (defaults to `full`).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/services/files-service.js apps/api/src/index.js
git commit -m "feat(api): support variant query param on GET /files/:id/signed-url"
```

---

### Task 4: Chat avatar and image-attachment signing

**Files:**
- Modify: `apps/api/src/routes/chat/chat-service.js:1-2` (import), `17-35` (cache key), `91-136` (`batchSignAvatarUrls`), `139-159` (`batchSignAttachmentUrls`), `844-874` (`getAttachmentSignedUrl`)

- [ ] **Step 1: Import the helper and make the signed-URL cache variant-aware**

`chat-service.js` caches signed URLs for 55 minutes keyed by `bucket:objectKey`. Since the same object can now be requested at different variants (`thumb` for an avatar list, `full` for the viewer), the cache key must include the variant or the wrong-size URL will be served from cache.

Replace (`apps/api/src/routes/chat/chat-service.js:1-2`):
```js
import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
```
with:
```js
import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { signedUrlWithVariant } from "../../lib/image-variants.js";
```

Replace (`apps/api/src/routes/chat/chat-service.js:22-35`):
```js
function getCachedSignedUrl(bucket, objectKey) {
  const key = `${bucket}:${objectKey}`;
  const entry = _signedUrlCache.get(key);
  if (entry && entry.expiresAt > Date.now()) return entry.url;
  _signedUrlCache.delete(key);
  return null;
}

function setCachedSignedUrl(bucket, objectKey, url) {
  _signedUrlCache.set(`${bucket}:${objectKey}`, {
    url,
    expiresAt: Date.now() + SIGNED_URL_TTL_MS,
  });
}
```
with:
```js
function getCachedSignedUrl(bucket, objectKey, variant) {
  const key = `${bucket}:${objectKey}:${variant}`;
  const entry = _signedUrlCache.get(key);
  if (entry && entry.expiresAt > Date.now()) return entry.url;
  _signedUrlCache.delete(key);
  return null;
}

function setCachedSignedUrl(bucket, objectKey, variant, url) {
  _signedUrlCache.set(`${bucket}:${objectKey}:${variant}`, {
    url,
    expiresAt: Date.now() + SIGNED_URL_TTL_MS,
  });
}
```

- [ ] **Step 2: `batchSignAvatarUrls` uses the `thumb` variant**

Replace (`apps/api/src/routes/chat/chat-service.js:119-136`):
```js
    const result = {};
    await Promise.all(
      Object.entries(assetMap).map(async ([id, fa]) => {
        try {
          const cached = getCachedSignedUrl(fa.bucket, fa.objectKey);
          if (cached) { result[id] = cached; return; }
          const { data } = await supabaseAdmin.storage
            .from(fa.bucket)
            .createSignedUrl(fa.objectKey, 3600);
          if (data?.signedUrl) {
            setCachedSignedUrl(fa.bucket, fa.objectKey, data.signedUrl);
            result[id] = data.signedUrl;
          }
        } catch {}
      }),
    );
    return result;
  }
```
with:
```js
    const result = {};
    await Promise.all(
      Object.entries(assetMap).map(async ([id, fa]) => {
        try {
          const cached = getCachedSignedUrl(fa.bucket, fa.objectKey, "thumb");
          if (cached) { result[id] = cached; return; }
          const signedUrl = await signedUrlWithVariant(supabaseAdmin, fa.bucket, fa.objectKey, "thumb");
          if (signedUrl) {
            setCachedSignedUrl(fa.bucket, fa.objectKey, "thumb", signedUrl);
            result[id] = signedUrl;
          }
        } catch {}
      }),
    );
    return result;
  }
```

- [ ] **Step 3: `batchSignAttachmentUrls` uses the `card` variant**

Replace (`apps/api/src/routes/chat/chat-service.js:139-159`):
```js
  async function batchSignAttachmentUrls(pairs) {
    if (!pairs.length) return {};
    const result = {};
    await Promise.all(
      pairs.map(async ({ bucket, objectKey }) => {
        const cacheKey = `${bucket}:${objectKey}`;
        try {
          const cached = getCachedSignedUrl(bucket, objectKey);
          if (cached) { result[cacheKey] = cached; return; }
          const { data } = await supabaseAdmin.storage
            .from(bucket)
            .createSignedUrl(objectKey, 3600);
          if (data?.signedUrl) {
            setCachedSignedUrl(bucket, objectKey, data.signedUrl);
            result[cacheKey] = data.signedUrl;
          }
        } catch {}
      }),
    );
    return result;
  }
```
with:
```js
  async function batchSignAttachmentUrls(pairs) {
    if (!pairs.length) return {};
    const result = {};
    await Promise.all(
      pairs.map(async ({ bucket, objectKey }) => {
        const cacheKey = `${bucket}:${objectKey}`;
        try {
          const cached = getCachedSignedUrl(bucket, objectKey, "card");
          if (cached) { result[cacheKey] = cached; return; }
          const signedUrl = await signedUrlWithVariant(supabaseAdmin, bucket, objectKey, "card");
          if (signedUrl) {
            setCachedSignedUrl(bucket, objectKey, "card", signedUrl);
            result[cacheKey] = signedUrl;
          }
        } catch {}
      }),
    );
    return result;
  }
```

- [ ] **Step 4: `getAttachmentSignedUrl` accepts a `variant`, defaulting to `full`**

Replace (`apps/api/src/routes/chat/chat-service.js:844-874`):
```js
  async function getAttachmentSignedUrl({ attachmentId, authUserId }) {
    const profileId = await getUserProfileId(authUserId);

    const rows = await prisma.$queryRaw`
      SELECT a.* FROM chat_attachments a
      INNER JOIN chat_conversation_members ccm
        ON ccm.conversation_id = a.conversation_id AND ccm.user_id = ${profileId} AND ccm.left_at IS NULL
      WHERE a.id = ${attachmentId}
      LIMIT 1
    `;
    if (!rows.length) {
      console.error("[atlas.chat] getAttachmentSignedUrl: attachment not found or user not member", { attachmentId, profileId });
      throw new ChatServiceError("Adjunto no encontrado.", 404);
    }

    const att = rows[0];

    const cached = getCachedSignedUrl(att.bucket, att.object_key);
    if (cached) return { url: cached };

    const { data, error } = await supabaseAdmin.storage
      .from(att.bucket)
      .createSignedUrl(att.object_key, 3600);

    if (error) {
      console.error("[atlas.chat] createSignedUrl failed", { bucket: att.bucket, key: att.object_key, error });
      throw new ChatServiceError("Error generando URL firmada.", 500);
    }
    setCachedSignedUrl(att.bucket, att.object_key, data.signedUrl);
    return { url: data.signedUrl };
  }
```
with:
```js
  async function getAttachmentSignedUrl({ attachmentId, authUserId, variant = "full" }) {
    const profileId = await getUserProfileId(authUserId);

    const rows = await prisma.$queryRaw`
      SELECT a.* FROM chat_attachments a
      INNER JOIN chat_conversation_members ccm
        ON ccm.conversation_id = a.conversation_id AND ccm.user_id = ${profileId} AND ccm.left_at IS NULL
      WHERE a.id = ${attachmentId}
      LIMIT 1
    `;
    if (!rows.length) {
      console.error("[atlas.chat] getAttachmentSignedUrl: attachment not found or user not member", { attachmentId, profileId });
      throw new ChatServiceError("Adjunto no encontrado.", 404);
    }

    const att = rows[0];

    const cached = getCachedSignedUrl(att.bucket, att.object_key, variant);
    if (cached) return { url: cached };

    const signedUrl = await signedUrlWithVariant(supabaseAdmin, att.bucket, att.object_key, variant);

    if (!signedUrl) {
      console.error("[atlas.chat] createSignedUrl failed", { bucket: att.bucket, key: att.object_key });
      throw new ChatServiceError("Error generando URL firmada.", 500);
    }
    setCachedSignedUrl(att.bucket, att.object_key, variant, signedUrl);
    return { url: signedUrl };
  }
```

- [ ] **Step 5: Static-check**

Run: `node --check apps/api/src/routes/chat/chat-service.js`
Expected: no output

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes/chat/chat-service.js
git commit -m "feat(api): serve thumb/card chat avatar and attachment variants, variant-aware URL cache"
```

---

### Task 5: Forward `variant` on the chat attachment signed-url route

**Files:**
- Modify: `apps/api/src/routes/chat/index.js:255-265`

- [ ] **Step 1: Update the route**

Replace:
```js
  // GET /chat/attachments/:id/signed-url
  internal.get("/attachments/:id/signed-url", requirePermission("chat.conversations.read"), async (c) => {
    try {
      const authUserId = c.get("authUserId");
      const attachmentId = c.req.param("id");
      const result = await chatService.getAttachmentSignedUrl({ attachmentId, authUserId });
      return c.json({ data: result });
    } catch (err) {
      return handleError(c, err, "Error obteniendo URL del adjunto.");
    }
  });
```
with:
```js
  // GET /chat/attachments/:id/signed-url
  internal.get("/attachments/:id/signed-url", requirePermission("chat.conversations.read"), async (c) => {
    try {
      const authUserId = c.get("authUserId");
      const attachmentId = c.req.param("id");
      const variant = c.req.query("variant") || "full";
      const result = await chatService.getAttachmentSignedUrl({ attachmentId, authUserId, variant });
      return c.json({ data: result });
    } catch (err) {
      return handleError(c, err, "Error obteniendo URL del adjunto.");
    }
  });
```

- [ ] **Step 2: Static-check**

Run: `node --check apps/api/src/routes/chat/index.js`
Expected: no output

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/routes/chat/index.js
git commit -m "feat(api): forward variant query param on chat attachment signed-url route"
```

---

### Task 6: Catalog product image variant

**Files:**
- Modify: `apps/api/src/routes/catalog/catalog-product-service.js:1-54`

- [ ] **Step 1: Update `resolveImageUrls` to request the `product` variant**

Replace the full file contents of `apps/api/src/routes/catalog/catalog-product-service.js` lines 1-54:

```js
// apps/api/src/routes/catalog/catalog-product-service.js

const PUBLIC_BUCKET  = 'atlas-website'
const SIGNED_URL_TTL = 3600

export function createCatalogProductService({ prisma, supabaseAdmin }) {

  async function resolveImageUrls(rows) {
    if (!supabaseAdmin) return rows
    const ids = [...new Set(rows.map((r) => r.cover_asset_id).filter(Boolean))]
    if (!ids.length) return rows

    const placeholders = ids.map((_, i) => `$${i + 1}::uuid`).join(', ')
    const assets = await prisma.$queryRawUnsafe(
      `SELECT id, object_key, bucket, visibility FROM file_asset WHERE id IN (${placeholders})`,
      ...ids,
    )
    if (!assets.length) return rows

    const urlMap = new Map()

    const publicAssets  = assets.filter((a) => a.bucket === PUBLIC_BUCKET)
    const privateAssets = assets.filter((a) => a.bucket !== PUBLIC_BUCKET)

    for (const a of publicAssets) {
      const { data } = supabaseAdmin.storage.from(a.bucket).getPublicUrl(a.object_key)
      urlMap.set(String(a.id), data?.publicUrl ?? null)
    }

    if (privateAssets.length) {
      const byBucket = new Map()
      for (const a of privateAssets) {
        if (!byBucket.has(a.bucket)) byBucket.set(a.bucket, [])
        byBucket.get(a.bucket).push(a)
      }
      await Promise.all([...byBucket.entries()].map(async ([bucket, batch]) => {
        const paths = batch.map((a) => a.object_key)
        const { data: signed } = await supabaseAdmin.storage
          .from(bucket)
          .createSignedUrls(paths, SIGNED_URL_TTL)
        if (Array.isArray(signed)) {
          for (const item of signed) {
            const asset = batch.find((a) => a.object_key === item.path)
            if (asset) urlMap.set(String(asset.id), item.signedUrl ?? null)
          }
        }
      }))
    }

    return rows.map((r) => ({
      ...r,
      image_url: r.cover_asset_id ? (urlMap.get(String(r.cover_asset_id)) ?? null) : null,
    }))
  }
```

with:

```js
// apps/api/src/routes/catalog/catalog-product-service.js

import { publicUrlWithVariant, signedUrlsWithVariant } from '../../lib/image-variants.js'

const PUBLIC_BUCKET  = 'atlas-website'
const SIGNED_URL_TTL = 3600
const IMAGE_VARIANT  = 'product'

export function createCatalogProductService({ prisma, supabaseAdmin }) {

  async function resolveImageUrls(rows) {
    if (!supabaseAdmin) return rows
    const ids = [...new Set(rows.map((r) => r.cover_asset_id).filter(Boolean))]
    if (!ids.length) return rows

    const placeholders = ids.map((_, i) => `$${i + 1}::uuid`).join(', ')
    const assets = await prisma.$queryRawUnsafe(
      `SELECT id, object_key, bucket, visibility FROM file_asset WHERE id IN (${placeholders})`,
      ...ids,
    )
    if (!assets.length) return rows

    const urlMap = new Map()

    const publicAssets  = assets.filter((a) => a.bucket === PUBLIC_BUCKET)
    const privateAssets = assets.filter((a) => a.bucket !== PUBLIC_BUCKET)

    for (const a of publicAssets) {
      const publicUrl = publicUrlWithVariant(supabaseAdmin, a.bucket, a.object_key, IMAGE_VARIANT)
      urlMap.set(String(a.id), publicUrl)
    }

    if (privateAssets.length) {
      const byBucket = new Map()
      for (const a of privateAssets) {
        if (!byBucket.has(a.bucket)) byBucket.set(a.bucket, [])
        byBucket.get(a.bucket).push(a)
      }
      await Promise.all([...byBucket.entries()].map(async ([bucket, batch]) => {
        const paths = batch.map((a) => a.object_key)
        const signedUrls = await signedUrlsWithVariant(supabaseAdmin, bucket, paths, IMAGE_VARIANT, SIGNED_URL_TTL)
        batch.forEach((asset, index) => {
          urlMap.set(String(asset.id), signedUrls[index] ?? null)
        })
      }))
    }

    return rows.map((r) => ({
      ...r,
      image_url: r.cover_asset_id ? (urlMap.get(String(r.cover_asset_id)) ?? null) : null,
    }))
  }
```

(Note: `signedUrlsWithVariant` returns results in the same order as the input `objectKeys` array, matching `batch`'s order — this replaces the original code's `item.path` lookup, which is no longer needed.)

- [ ] **Step 2: Static-check**

Run: `node --check apps/api/src/routes/catalog/catalog-product-service.js`
Expected: no output

- [ ] **Step 3: Manual verification**

```bash
curl -s "http://localhost:4010/catalog/products?pageSize=5" -H "Authorization: Bearer $ATLAS_TOKEN" | grep -o 'width=480'
```
Expected: at least one match if any listed product has a cover image.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/routes/catalog/catalog-product-service.js
git commit -m "feat(api): serve product-size image variant for catalog product grid"
```

---

## Plan A Self-Review Notes

- **Spec coverage:** identity avatars (Task 2), chat avatars + attachments (Task 4-5), catalog product images (Task 6), generic on-demand full-res endpoint (Task 3) — all covered. Company logo and storefront generic file URLs are explicitly excluded (see "Corrections" section) with rationale. Notes are deferred to Plan B by design (public-bucket, frontend-only rewrite — no backend change needed).
- **No placeholders:** every step shows complete before/after code.
- **Type/shape consistency:** `signedUrlWithVariant`/`signedUrlsWithVariant`/`publicUrlWithVariant` signatures are identical everywhere they're called across Tasks 2-6.
