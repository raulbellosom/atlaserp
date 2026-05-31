# Website: Overview Dashboard, Delete Site, Status Toggle & Editor Context Bar

**Date:** 2026-05-30
**Status:** Approved

## Summary

Four improvements to the `atlas.website` module:

1. **Hard delete the website** — wipe all site data and return to the setup wizard
2. **Overview screen redesign** — stats dashboard + editable site config on the same screen
3. **Status toggle** — simple `draft / published` toggle replacing the always-stuck "draft" state
4. **Editor context bar** — peek/pin bar on the public website (`/`) for authenticated editors

---

## 1. API Changes

### 1.1 DELETE /website/site/:id (new)

- Permission required: `website.site.update`
- Hard deletes all website data for the company in a single Prisma `$transaction`, in dependency order:
  1. `WebsiteFormSubmission`
  2. `WebsiteFormField`
  3. `WebsiteForm`
  4. `WebsiteMenuItem`
  5. `WebsiteMenu`
  6. `WebsitePublishedRender`
  7. `WebsitePageVersion`
  8. `WebsitePage`
  9. `WebsiteBlogPost`
  10. `WebsiteBlogCategory`
  11. `WebsiteTheme`
  12. `WebsiteSite`
- Writes an `AuditLog` entry (`action: 'site.delete'`) before the transaction executes
- Returns `204 No Content` on success
- Returns `404` if no site exists for the company

### 1.2 GET /website/pages (existing — add status filter)

`listPages` in `website-service.js` adds one line: `if (status) where.status = status`. The pages route passes `c.req.query().status` to the service. The `listPages` function signature becomes `{ companyId, siteId, page, pageSize, pageType, status }`.

### 1.3 PATCH /website/site/:id (existing — no changes needed)

The service already accepts `data.status`. The frontend sends `{ status: 'published' | 'draft' }`. No backend changes required.

### 1.3 GET /website/site (existing — used for editor permission check)

The public website uses `GET /public/website/resolve` (no auth). The authenticated `GET /website/site` is used exclusively by the editor bar permission check: if the call resolves with `200`, the user has `website.site.read` and is treated as an editor; if it returns `401` or `403`, they are a regular visitor. No changes needed to this endpoint.

---

## 2. Overview Screen Redesign

**File:** `apps/desktop/src/modules/atlas.website/screens/WebsiteOverviewScreen.jsx`

The screen already shows the wizard when no site exists (`!site → <WebsiteSiteWizard />`). The logged-in case is redesigned into three vertical blocks.

### Block 1 — Stats (4 cards in a row)

Each card uses TanStack Query. Two small API additions are required:

**Required API addition — status filter on pages:**
`listPages` in `website-service.js` needs to accept an optional `status` param: `if (status) where.status = status`. The route handler passes `c.req.query().status` through. This is a one-line addition.

**Submissions count — no new endpoint:**
`GET /website/forms?siteId=...` already returns `_count.submissions` per form via the `include` clause in `listForms`. The submissions card sums those counts on the client.

| Card | Query | Value |
|---|---|---|
| Páginas publicadas | `GET /website/pages?siteId=...&status=published` | `.total` |
| Páginas borrador | `GET /website/pages?siteId=...&status=draft` | `.total` |
| Posts de blog | `GET /website/blog?siteId=...` | `.total` |
| Envíos de formularios | `GET /website/forms?siteId=...` | Sum of `form._count.submissions` across all forms |

Cards are read-only; clicking each navigates to the respective section.

### Block 2 — Site Configuration (editable form)

Fields:
- **Nombre** — text input, required
- **Dominio** — text input, optional
- **Tipo de sitio** — dropdown: `informacional`, `ecommerce`, `reservas`
- **Estado** — toggle: `Borrador` (yellow) / `Publicado` (green)

Behavior:
- The **status toggle** calls `PATCH /website/site/:id` immediately on change (`{ status: 'published' | 'draft' }`), no save button needed for it
- **Nombre / Dominio / Tipo** share a "Guardar cambios" button that calls `PATCH /website/site/:id` with the updated fields
- Validation uses the existing `updateSiteSchema` Zod schema

### Block 3 — Danger Zone

- Red-bordered section at the bottom of the screen
- Single button: "Eliminar sitio web"
- Opens a `Dialog` (using `@atlas/ui` Dialog primitives) with:
  - Warning copy explaining this is irreversible and deletes all pages, blog posts, forms, menus, and themes
  - A text input asking the user to type the exact site name to confirm
  - "Cancelar" and "Eliminar" buttons — "Eliminar" is disabled until the typed name matches
- On confirm: calls `DELETE /website/site/:id`, on `204` invalidates `['website-site']` query — the screen re-renders and shows `<WebsiteSiteWizard />` automatically

---

## 3. Editor Context Bar on Public Website

### 3.1 Permission check

Inside `PublicWebsiteEntry`, after the public resolve query resolves:

1. `useAuth()` provides `session`
2. If `session` exists, a second TanStack Query calls `GET /website/site` with the Bearer token
   - `staleTime: 60_000`, `retry: 0`, `enabled: Boolean(session?.access_token)`
3. If that query resolves with `200` → `isEditor = true`
4. If it rejects/returns `403` → `isEditor = false`

### 3.2 Trigger element

A `div` fixed at `top: 0; left: 0; width: 60px; height: 60px; z-index: 9999` with `pointer-events: auto`.

Visual indicator when bar is hidden: a `2px` colored accent line on the top edge and left edge of the corner (using the module accent color `#6366f1`).

`onMouseEnter` → sets local state `barVisible = true`.

### 3.3 Bar component (`EditorContextBar`)

New file: `apps/desktop/src/website/EditorContextBar.jsx`

Layout: `position: fixed; top: 0; left: 0; width: 100%; height: 40px; z-index: 9998`

Background: `rgba(15, 15, 15, 0.85)` with `backdrop-filter: blur(8px)`.

Transition: `transform: translateY(-100%) → translateY(0)` + `opacity: 0 → 1` at `200ms ease`.

Content (left to right):
- **Pin button** (chincheta icon) — toggles pin state. State persisted in `localStorage` under key `atlas-editor-bar-pinned`
- **Status chip** — `Borrador` (yellow) or `Publicado` (green) from `resolveData` or site data
- **Site name + page title** — `"Nombre del sitio · Título de página"` in small muted text
- **"Editar esta página"** button — navigates to `/app/m/atlas.website/pages/${resolveData.page.id}/editor`
- **"Panel"** button — navigates to `/app/m/atlas.website`

### 3.4 Hide behavior

- **Not pinned (default)**: bar hides when mouse leaves the bar area AND the trigger corner. Uses `onMouseLeave` on the bar + a small debounce (`150ms`) to avoid flickering when crossing the trigger/bar boundary.
- **Pinned**: bar stays always visible regardless of mouse position.

### 3.5 Layout offset

- When bar is **pinned**: `WebsitePageRenderer` receives `style={{ paddingTop: '40px' }}` so content is not obscured.
- When bar is in **peek mode**: no layout offset — bar overlays the page on hover only.

### 3.6 Pin state persistence

```js
const [pinned, setPinned] = useState(() => localStorage.getItem('atlas-editor-bar-pinned') === 'true')

function togglePin() {
  const next = !pinned
  setPinned(next)
  localStorage.setItem('atlas-editor-bar-pinned', String(next))
}
```

---

## 4. Files Affected

| File | Change |
|---|---|
| `apps/api/src/routes/website/website-service.js` | Add `deleteSite({ companyId, siteId, actorId })` function; add `status` param to `listPages` |
| `apps/api/src/routes/website/index.js` | Add `DELETE /website/site/:id` route |
| `apps/api/src/routes/website/pages-routes.js` | Pass `status` query param to `listPages` |
| `apps/desktop/src/modules/atlas.website/screens/WebsiteOverviewScreen.jsx` | Full redesign — stats + config form + danger zone |
| `apps/desktop/src/website/EditorContextBar.jsx` | New component — peek/pin editor bar |
| `apps/desktop/src/shell/PublicWebsiteEntry.jsx` | Add editor permission check + render `EditorContextBar` |

---

## 5. Out of Scope

- Changing which pages are shown as the homepage from this screen (already in Pages screen)
- Bulk-export of site data before deletion
- The editor bar navigating directly into inline editing mode within the public page (it only navigates to the module editor)
- Permission management UI for the website module
