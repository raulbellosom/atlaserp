# App View Preferences — Design Spec

**Date:** 2026-05-21  
**Status:** Approved

## Overview

Add persistent view preferences to the App Launcher (modal) and Home Screen's application grid. Users can switch between A-Z and grouped display, cards and list view, mark favorite apps, and optionally pin favorites to the top. Preferences are stored per user in the database and shared between both surfaces.

---

## 1. Data Model

### New Prisma model: `UserPreference`

```prisma
model UserPreference {
  id        String      @id @default(uuid(7))
  userId    String
  key       String
  value     Json
  updatedAt DateTime    @updatedAt

  user      UserProfile @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, key])
  @@index([userId])
}
```

Add relation on `UserProfile`:
```prisma
preferences  UserPreference[]
```

### Preference key: `app.view`

Value shape:
```json
{
  "sortMode": "az",
  "viewMode": "cards",
  "favoritesFirst": false,
  "favorites": []
}
```

- `sortMode`: `"az"` | `"groups"` — flat alphabetical or grouped by category
- `viewMode`: `"cards"` | `"list"` — card grid or compact row list
- `favoritesFirst`: `boolean` — show Favoritos section at top
- `favorites`: `string[]` — array of module keys marked as favorite

Defaults (when no record exists): `{ sortMode: "az", viewMode: "cards", favoritesFirst: false, favorites: [] }`

---

## 2. API

### Routes

```
GET  /user/preferences/:key
PUT  /user/preferences/:key
```

Both require a valid JWT. The authenticated user's `userId` is extracted from the token.

**GET /user/preferences/:key**
- Returns `200 { value: {...} }` if a record exists
- Returns `404 { error: "not_found" }` if no record for that user+key

**PUT /user/preferences/:key**
- Body: `{ value: {...} }`
- Upserts `UserPreference` for (userId, key)
- Returns `200 { value: {...} }`

### Service: `user-preferences-service.js`

New file at `apps/api/src/services/user-preferences-service.js`:
- `getPreference(userId, key)` — prisma findUnique
- `upsertPreference(userId, key, value)` — prisma upsert

Routes added to a new router file `apps/api/src/routes/preferences.js`, mounted in `apps/api/src/index.js`.

---

## 3. Frontend

### Hook: `useAppViewPrefs()`

New file: `apps/desktop/src/hooks/useAppViewPrefs.js`

Responsibilities:
- Load preference via `GET /user/preferences/app.view` using TanStack Query
- Return current prefs, loading state, and action functions
- On any action: update optimistically (local state) + debounced save (500ms) via `PUT /user/preferences/app.view`
- Fallback to defaults while loading or on 404

Exported interface:
```js
{
  sortMode,        // "az" | "groups"
  viewMode,        // "cards" | "list"
  favoritesFirst,
  favorites,       // string[]
  isLoading,
  setSortMode(mode),
  setViewMode(mode),
  toggleFavoritesFirst(),
  toggleFavorite(moduleKey),
  isFavorite(moduleKey),
}
```

### Component: `AppViewControls`

New file: `apps/desktop/src/components/AppViewControls.jsx`

Props: none (reads from `useAppViewPrefs`)

Renders a single row with three controls:
1. Segmented toggle: `[A-Z | Grupos]`
2. Segmented toggle: `[⊞ Cards | ≡ Lista]` (icons from lucide: `LayoutGrid`, `List`)
3. Toggle button: `[★ Favoritos primero]` — amber when active, muted when inactive

Sizing: compact (text-xs, py-1.5). Consistent with existing muted/border token usage.

### Component: `AppContextMenu`

New file: `apps/desktop/src/components/AppContextMenu.jsx`

Props: `{ x, y, moduleKey, onClose }`

Reads `isFavorite` and `toggleFavorite` from `useAppViewPrefs`.

Behavior:
- Renders a fixed-position floating panel at `(x, y)`, z-index above launcher
- Single action: "Agregar a favoritos" or "Quitar de favoritos" depending on current state
- Clicking the action calls `toggleFavorite(moduleKey)` then `onClose()`
- Clicking outside or pressing Escape calls `onClose()`
- Closes automatically when a new screen is navigated to

### Modified: `AppLauncher.jsx`

Changes:
1. Add `AppViewControls` row between the search header and the content area (hidden when `query` is non-empty — search overrides sort/group)
2. Add `onContextMenu` handler on each module button → sets context menu state `{ x, y, moduleKey }`
3. Render `AppContextMenu` when context menu state is set
4. Apply sort/group/favorites logic via `useAppViewPrefs` to the displayed module list
5. Render list view when `viewMode === "list"` (compact rows instead of icon grid)

### Modified: `HomeScreen.jsx`

Changes:
1. Add `AppViewControls` row below the "Aplicaciones" heading (between heading and module grid)
2. Add `onContextMenu` handler on each module card
3. Render `AppContextMenu` when context menu state is set
4. Apply same sort/group/favorites logic
5. Render list view when `viewMode === "list"`

---

## 4. Display Logic

### Module ordering function

```
getSortedDisplay(availableModules, { sortMode, favorites, favoritesFirst })
  → Array of { sectionLabel: string | null, modules: Module[] }
```

**A-Z mode, favoritesFirst=false:**
- One section, `sectionLabel: null`, all modules A-Z

**A-Z mode, favoritesFirst=true:**
- Section "Favoritos" — favorite modules A-Z (empty section hidden)
- Section null — remaining modules A-Z

**Groups mode, favoritesFirst=false:**
- Sections by category (CATEGORY_LABELS), modules A-Z within each

**Groups mode, favoritesFirst=true:**
- Section "Favoritos" at top — favorite modules A-Z
- Then sections by category (excluding already-shown favorites), modules A-Z within each

### Search override (AppLauncher only)

When `query` is non-empty:
- `AppViewControls` is hidden (search results are always flat)
- Display all matching modules in a flat list, no sections
- Current filter logic preserved

### Card view (existing)

Grid: `grid-cols-2 md:grid-cols-3 lg:grid-cols-4` in HomeScreen  
Grid: `grid-cols-3 sm:grid-cols-4` in AppLauncher  
Each card: icon + name + description (current layout)

### List view (new)

Rows: flex, single column, full width  
Each row: small icon (20px) + name (font-semibold text-sm) + description (text-xs muted, same line after a separator dot) + ★ if favorite  
Row height: ~40px, py-2, border-b on all but last

---

## 5. Shared Utility

Extract `ModIcon` and `ICON_MAP` — currently duplicated in `AppLauncher.jsx` and `HomeScreen.jsx` — into a shared location: `apps/desktop/src/components/ModIcon.jsx`. Both files import from there. This avoids a third copy.

---

## 6. Migration

New forward migration: `add_user_preferences` — creates `UserPreference` table.  
No destructive changes. Existing data unaffected.  
Run: `pnpm db:migrate`

---

## 7. Error Handling

- Preference load failure: silently use defaults, no error shown to user
- Preference save failure: no error shown (best-effort save, optimistic update stays)
- Context menu: no loading states needed (all actions are local + background save)

---

## 8. Out of Scope

- Drag-and-drop reordering
- Per-category collapse/expand
- Keyboard navigation within the launcher controls
- Admin-controlled default preferences
