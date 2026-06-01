# Atlas Hosted Build — Design Spec

**Date:** 2026-06-01
**Status:** Approved
**Scope:** Sub-project — upload and serve compiled dist/ at the root path of the ERP domain

---

## 1. Context and Purpose

The ERP already ships a web builder (CraftJS) that generates public pages served at `/`. This feature adds a second source option: the tenant developer can upload a compiled frontend app (`dist/`) — built with Vite, Astro, Next.js static export, SvelteKit static, or any static-output bundler — and have it served at `/` instead of (or alongside) the web builder.

The primary motivation is SEO and design freedom: the web builder is constrained by its template system, while a compiled app can do anything. If the developer uses a prerendering framework (Astro, Next static, etc.), the ERP serves per-route HTML that Google can index.

---

## 2. Routing Architecture

Same domain, two paths:

```
/app/*   → ERP admin panel (React SPA, served from Nginx static files)
/*       → Public site (API handles: 'none' | 'builder' | 'dist')
```

The Nginx config in the `web-preview` container splits this:
- `location /app/` → `try_files` against the static ERP SPA files
- `location /` → `proxy_pass http://api:4010/public/site`

Vite must be configured with `base: '/app/'` so the ERP SPA's JS/CSS assets are emitted at `/app/assets/...` — fully under the `/app/` prefix, no conflict with public site assets.

The API container handles all `/*` public site requests. No VPS Nginx changes required — the proxy runs inside the Docker Compose network (`http://api:4010`).

---

## 3. React Router Basename

The ERP admin SPA currently serves from `/`. After this change it lives under `/app/`. The React Router must be configured with:

```js
basename: import.meta.env.PROD ? '/app' : '/'
```

This only affects the production Docker build. Local dev (`pnpm dev:frontend`) is unchanged.

---

## 4. Source Switch

`WebsiteSite` gets a new `source_type` field:

| Value | Behavior |
|---|---|
| `'none'` | Root path returns 404. Only `/app/` exists. |
| `'builder'` | Existing web builder behavior (default for all current sites). |
| `'dist'` | Serves the uploaded compiled app from Supabase Storage. |

The admin changes this from the Website Settings panel in the ERP. The switch takes effect immediately (cache is invalidated on change).

---

## 5. Single-Tenant Public Site

The public site always serves ONE company's website — the primary company of this ERP instance. A new `InstanceConfig` key `primary_company_id` holds the UUID of that company.

Seeded automatically in `prisma/seed.js` with the first company found. The admin can change it from instance settings.

---

## 6. Data Model Changes

### 6.1 New Prisma migration

Four new columns on `website_site`:

```sql
ALTER TABLE website_site
  ADD COLUMN source_type         TEXT        NOT NULL DEFAULT 'builder',
  ADD COLUMN dist_uploaded_at    TIMESTAMPTZ,
  ADD COLUMN dist_file_count     INTEGER,
  ADD COLUMN dist_has_prerender  BOOLEAN;
```

- `source_type`: controls what `/*` serves.
- `dist_uploaded_at`: displayed in the admin panel ("Last deployed: 2 days ago").
- `dist_file_count`: total files in the dist, displayed in the admin panel.
- `dist_has_prerender`: `true` if the zip contains HTML files beyond the root `index.html` (detected at upload time).

### 6.2 New InstanceConfig key

```
key:   "primary_company_id"
value: "<company-uuid>"
```

Seeded in `prisma/seed.js`. Read at runtime by the public site serving layer.

---

## 7. Upload Pipeline

**Endpoint:** `POST /website/sites/:siteId/dist/upload`
**Auth:** Admin JWT required (`requirePermission('website.dist.upload')`)
**Content-Type:** `multipart/form-data`
**Field:** `file` — a `.zip` file, max 100 MB

**Processing steps:**

1. Validate: file is present, is a zip, size ≤ 100 MB.
2. Extract in memory using JSZip (already a dependency in `apps/api`).
3. Detect root: find where `index.html` lives.
   - Flat zip: `index.html` at the zip root → use as-is.
   - Wrapped zip: `dist/index.html` → strip the `dist/` prefix.
   - No `index.html` found → reject with 422: "El zip debe contener un index.html en la raíz".
4. Detect prerender: count `.html` files at paths other than root `index.html`. If ≥ 1, `dist_has_prerender = true`.
5. Upload all extracted files to Supabase Storage:
   - Bucket: `atlas-website`
   - Prefix: `dist/<company-slug>/`
   - Example: `dist/acme/index.html`, `dist/acme/productos/index.html`, `dist/acme/assets/main-abc123.js`
   - Use `upsert: true` — new deploys overwrite old files.
6. Update `WebsiteSite`:
   - `source_type = 'dist'`
   - `dist_uploaded_at = now()`
   - `dist_file_count = N`
   - `dist_has_prerender = true/false`
7. Invalidate the in-memory serve cache for this company.
8. Return: `{ data: { fileCount, hasPrerender, uploadedAt } }`

**Delete endpoint:** `DELETE /website/sites/:siteId/dist`
- Removes all files under `dist/<company-slug>/` from Supabase Storage.
- Resets `source_type = 'builder'`, clears dist fields.
- Invalidates cache.

---

## 8. Serving Layer

New API route: `GET /public/site/*` (catch-all, no auth required)

### 8.1 Resolution flow

```
1. Get primary_company_id from InstanceConfig (cached 1 min)
2. Get WebsiteSite for that company (cached 1 min)
3. Evaluate source_type:
   'none'    → 404 JSON { error: "Sitio no disponible" }
   'builder' → delegate to existing public-website handler (no changes)
   'dist'    → dist serving flow (see 8.2)
```

### 8.2 Dist serving flow

```
Request path: /productos/zapatos

Does path have a file extension? (.js .css .png .jpg .webp .svg .ico .woff2 .woff .ttf .map .json)
  YES → 302 redirect to:
        https://<SUPABASE_URL>/storage/v1/object/public/atlas-website/dist/<slug>/<path>
        (browser fetches directly from Supabase CDN — Node.js not involved)

  NO → Try HTML files in order:
       1. dist/<slug>/<path>/index.html     (prerendered route)
       2. dist/<slug>/<path>.html           (flat prerendered page)
       3. dist/<slug>/index.html            (SPA fallback)

       → Download the found HTML from Supabase Storage
       → Inject SEO meta tags (see 8.3)
       → Set headers: Content-Type: text/html, Cache-Control: public, max-age=300
       → Store in in-memory cache (see 8.4)
       → Return HTML
```

If none of the three HTML paths exists in Supabase Storage, return 404.

### 8.3 SEO injection

Before serving any HTML file, the API:
1. Reads `WebsiteSite.seoDefaults` (JSON: `{ title, description, ogTitle, ogDescription, ogImage, robots, canonical }`).
2. Checks which of these tags already exist in the HTML's `<head>`.
3. Injects only the **missing** tags — never overwrites tags the developer put in their own HTML.
4. Inserts the injected tags immediately after `<head>`.

This means:
- A prerendered Astro app with its own `<title>` and `<meta>` tags → ERP adds nothing, serves as-is.
- A plain Vite SPA with empty `<head>` → ERP injects all configured SEO tags.

### 8.4 In-memory HTML cache

```
Structure: Map<"<companyId>:<normalizedPath>", { html: string, cachedAt: number }>
TTL: 5 minutes
Max entries: 500 (LRU eviction beyond this)
Invalidated: on new dist upload, on dist delete, on source_type change
```

Only HTML responses are cached. Asset redirects (302) are not cached in Node.js — the browser and Supabase CDN handle that.

---

## 9. Admin UI

In the Website Settings section of the ERP admin panel, a new "Fuente del sitio" card:

### Source selector
Three radio options: "Sin sitio público" / "Constructor de páginas" / "Build propio (dist/)".
Changing selection immediately calls `PATCH /website/sites/:siteId` with `{ sourceType: '...' }`.

### Dist upload panel (visible when "Build propio" is selected)
- Shows current deploy info: last deployed date, file count, whether prerendered.
- File input accepting `.zip` only, max 100 MB.
- Upload button → calls `POST /website/sites/:siteId/dist/upload`.
- Progress indicator during upload.
- On success: refreshes deploy info.
- On error: shows specific error message (too large, no index.html, etc.).
- "Eliminar build" button → calls `DELETE /website/sites/:siteId/dist`, reverts to builder.

---

## 10. New Permission

`website.dist.upload` — controls who can upload/delete a dist. Seeded alongside other website permissions. Assigned to `atlas.admin` and `system.admin` roles.

---

## 11. File Format

Only `.zip` is accepted. No tar.gz, no raw folder uploads.

Rationale: zip has universal tooling on Windows/Mac/Linux, is trivially created with `zip -r dist.zip dist/` or any CI tool, and JSZip handles it natively in Node.js without shelling out.

---

## 12. Out of Scope

- **Repo URL + build on server**: running user builds server-side is out of scope (security risk, CI/CD complexity). Users build locally or in their own CI and upload the output.
- **Multiple companies serving different public sites**: deferred. One instance, one public site.
- **Custom domain routing**: a tenant pointing `acme.mx` to the ERP VPS is a DNS/Nginx concern handled at the infrastructure level, not in this feature.
- **Versioned deploys / rollback**: only the latest deploy is stored. Previous files are overwritten.
- **Large dist/ files (>100MB)**: rejected at upload. Developers must optimize their build.

---

## 13. Implementation Order

1. Prisma migration + seed `primary_company_id`
2. Upload endpoint + dist service (backend)
3. Serving layer `/public/site/*` + cache + SEO injection (backend)
4. Nginx config change + React Router basename (infrastructure + frontend)
5. Website Settings UI — source selector + upload panel (frontend)
