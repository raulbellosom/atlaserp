# App View Preferences Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add persistent per-user app view preferences (A-Z/groups, cards/list, favorites with pin-to-top, right-click context menu) shared between the App Launcher modal and Home Screen.

**Architecture:** New `UserPreference` Prisma model stores JSON preferences keyed by `(userId, key)`. Two API routes (`GET/PUT /profile/me/preferences/:key`) mirror the existing table-preferences pattern in `index.js`. The frontend uses a TanStack Query hook with optimistic cache updates and debounced background saves (500 ms). Three new components (`AppViewControls`, `AppContextMenu`, `ModIcon`) are shared between `AppLauncher` and `HomeScreen` via a `useAppViewPrefs` hook.

**Tech Stack:** Prisma 7, Hono, TanStack Query v5, Zustand, Tailwind CSS, lucide-react, motion/react (existing), Node.js built-in test runner

---

## File Map

| Action | Path | Responsibility |
|--------|------|---------------|
| Create | `apps/desktop/src/lib/sortModules.js` | `CATEGORY_LABELS` + `getSortedDisplay()` — pure, testable |
| Create | `apps/desktop/src/lib/__tests__/sortModules.test.js` | Unit tests for `getSortedDisplay` |
| Create | `apps/desktop/src/components/ModIcon.jsx` | Shared icon component (extracted from AppLauncher + HomeScreen) |
| Create | `apps/desktop/src/hooks/useAppViewPrefs.js` | TanStack Query hook for loading/saving/optimistic-updating prefs |
| Create | `apps/desktop/src/components/AppViewControls.jsx` | Controls bar: [A-Z\|Grupos] [Cards\|Lista] [★ Favoritos] |
| Create | `apps/desktop/src/components/AppContextMenu.jsx` | Right-click floating menu to add/remove favorites |
| Modify | `prisma/schema.prisma` | Add `UserPreference` model + relation on `UserProfile` |
| Modify | `packages/sdk/src/index.js` | Add `profile.getPreference` + `profile.setPreference` |
| Modify | `apps/api/src/index.js` | Add `GET/PUT /profile/me/preferences/:key` routes (after line 1033) |
| Modify | `apps/desktop/src/lib/runtimeModules.js` | Re-export `CATEGORY_LABELS` + `getSortedDisplay` from `sortModules.js` |
| Modify | `apps/desktop/src/components/AppLauncher.jsx` | Use controls, list view, context menu, remove local ModIcon |
| Modify | `apps/desktop/src/app/HomeScreen.jsx` | Use controls, list view, context menu, remove local ModIcon |

---

## Task 1: Add `UserPreference` Prisma model

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add the model and relation**

Open `prisma/schema.prisma`. After the `UserTablePreference` model (around line 292), add:

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

On the `UserProfile` model, add a relation field after the existing `tablePreferences` line:

```prisma
  preferences  UserPreference[]
```

- [ ] **Step 2: Run migration**

```bash
pnpm db:migrate
```

Prisma will prompt for a migration name — enter: `add_user_preferences`

Expected output: `✓ Generated Prisma Client` and `The following migration(s) have been created and applied from new schema changes: migrations/YYYYMMDD_HHMMSS_add_user_preferences/`

- [ ] **Step 3: Regenerate Prisma client**

```bash
pnpm db:generate
```

Expected: `✓ Generated Prisma Client` with no errors.

- [ ] **Step 4: Syntax check**

```bash
node --check apps/api/src/index.js
```

Expected: no output (clean).

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(db): add UserPreference model for per-user key-value preferences"
```

---

## Task 2: `getSortedDisplay` utility (TDD)

**Files:**
- Create: `apps/desktop/src/lib/sortModules.js`
- Create: `apps/desktop/src/lib/__tests__/sortModules.test.js`
- Modify: `apps/desktop/src/lib/runtimeModules.js`

- [ ] **Step 1: Write the failing tests**

Create `apps/desktop/src/lib/__tests__/sortModules.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getSortedDisplay } from '../sortModules.js';

const modules = [
  { key: 'c', name: 'Contactos', category: 'operaciones' },
  { key: 'f', name: 'Finanzas', category: 'contabilidad' },
  { key: 'a', name: 'Archivos', category: 'sistema' },
  { key: 'e', name: 'Empresa', category: 'sistema' },
  { key: 'fl', name: 'Flota', category: 'general' },
];

test('A-Z mode returns one section sorted alphabetically', () => {
  const result = getSortedDisplay(modules, { sortMode: 'az', favorites: [], favoritesFirst: false });
  assert.equal(result.length, 1);
  assert.equal(result[0].label, null);
  assert.deepEqual(
    result[0].modules.map((m) => m.name),
    ['Archivos', 'Contactos', 'Empresa', 'Finanzas', 'Flota'],
  );
});

test('Groups mode returns one section per category', () => {
  const result = getSortedDisplay(modules, { sortMode: 'groups', favorites: [], favoritesFirst: false });
  assert.ok(result.length >= 4);
  const labels = result.map((s) => s.label);
  assert.ok(labels.includes('Sistema'));
  assert.ok(labels.includes('Contabilidad'));
});

test('favoritesFirst=true puts Favoritos section first', () => {
  const result = getSortedDisplay(modules, { sortMode: 'az', favorites: ['f'], favoritesFirst: true });
  assert.equal(result[0].label, 'Favoritos');
  assert.equal(result[0].modules.length, 1);
  assert.equal(result[0].modules[0].key, 'f');
});

test('favorites not duplicated in other sections', () => {
  const result = getSortedDisplay(modules, { sortMode: 'az', favorites: ['f'], favoritesFirst: true });
  const nonFavKeys = result
    .filter((s) => s.label !== 'Favoritos')
    .flatMap((s) => s.modules.map((m) => m.key));
  assert.ok(!nonFavKeys.includes('f'));
});

test('empty favorites with favoritesFirst=true does not add Favoritos section', () => {
  const result = getSortedDisplay(modules, { sortMode: 'az', favorites: [], favoritesFirst: true });
  assert.ok(!result.some((s) => s.label === 'Favoritos'));
});

test('Groups + favoritesFirst puts favorites first then remaining in groups', () => {
  const result = getSortedDisplay(modules, { sortMode: 'groups', favorites: ['f'], favoritesFirst: true });
  assert.equal(result[0].label, 'Favoritos');
  const groupLabels = result.slice(1).map((s) => s.label);
  assert.ok(groupLabels.includes('Sistema'));
  const allGroupKeys = result.slice(1).flatMap((s) => s.modules.map((m) => m.key));
  assert.ok(!allGroupKeys.includes('f'));
});

test('modules within a group are sorted alphabetically', () => {
  const result = getSortedDisplay(modules, { sortMode: 'groups', favorites: [], favoritesFirst: false });
  const sistemaSection = result.find((s) => s.label === 'Sistema');
  assert.ok(sistemaSection);
  assert.deepEqual(
    sistemaSection.modules.map((m) => m.name),
    ['Archivos', 'Empresa'],
  );
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
node --test apps/desktop/src/lib/__tests__/sortModules.test.js
```

Expected: `Error: Cannot find module '../sortModules.js'`

- [ ] **Step 3: Create `sortModules.js`**

Create `apps/desktop/src/lib/sortModules.js`:

```js
export const CATEGORY_LABELS = {
  sistema: 'Sistema',
  operaciones: 'Operaciones',
  contabilidad: 'Contabilidad',
  general: 'General',
};

/**
 * Returns an ordered array of { label, modules } sections based on view preferences.
 * @param {Array} modules - available (installed+enabled) modules
 * @param {{ sortMode: 'az'|'groups', favorites: string[], favoritesFirst: boolean }} opts
 * @returns {Array<{ label: string|null, modules: Array }>}
 */
export function getSortedDisplay(modules, { sortMode, favorites, favoritesFirst }) {
  const sorted = [...modules].sort((a, b) =>
    a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }),
  );

  const sections = [];
  const shownKeys = new Set();

  if (favoritesFirst && favorites.length > 0) {
    const favModules = sorted.filter((m) => favorites.includes(m.key));
    if (favModules.length > 0) {
      sections.push({ label: 'Favoritos', modules: favModules });
      favModules.forEach((m) => shownKeys.add(m.key));
    }
  }

  const remaining = sorted.filter((m) => !shownKeys.has(m.key));

  if (sortMode === 'groups') {
    const groups = {};
    for (const m of remaining) {
      const cat = m.category ?? 'general';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(m);
    }
    for (const [cat, mods] of Object.entries(groups)) {
      sections.push({ label: CATEGORY_LABELS[cat] ?? cat, modules: mods });
    }
  } else {
    if (remaining.length > 0) {
      sections.push({ label: null, modules: remaining });
    }
  }

  return sections;
}
```

- [ ] **Step 4: Run tests — expect all to pass**

```bash
node --test apps/desktop/src/lib/__tests__/sortModules.test.js
```

Expected: 7 tests pass, 0 failures.

- [ ] **Step 5: Update `runtimeModules.js` to re-export from `sortModules.js`**

In `apps/desktop/src/lib/runtimeModules.js`:

Replace the existing `CATEGORY_LABELS` constant (lines 12–17):
```js
export const CATEGORY_LABELS = {
  sistema: "Sistema",
  operaciones: "Operaciones",
  contabilidad: "Contabilidad",
  general: "General",
};
```

With a re-export:
```js
export { CATEGORY_LABELS, getSortedDisplay } from './sortModules.js';
```

- [ ] **Step 6: Syntax check**

```bash
node --check apps/desktop/src/lib/runtimeModules.js
```

Expected: no output.

- [ ] **Step 7: Commit**

```bash
git add apps/desktop/src/lib/sortModules.js apps/desktop/src/lib/__tests__/sortModules.test.js apps/desktop/src/lib/runtimeModules.js
git commit -m "feat(ui): add getSortedDisplay utility with tests for app view sorting"
```

---

## Task 3: API routes + SDK

**Files:**
- Modify: `apps/api/src/index.js`
- Modify: `packages/sdk/src/index.js`

- [ ] **Step 1: Add API routes to `index.js`**

In `apps/api/src/index.js`, after line 1033 (the end of the `DELETE /profile/me/table-preferences/:tableKey` handler), add:

```js
app.get("/profile/me/preferences/:key", authMiddleware, async (c) => {
  try {
    const context = await getOrLoadUserContext(c);
    if (!context?.profile) return c.json({ error: "Perfil no encontrado." }, 404);
    const key = c.req.param("key");
    const pref = await prisma.userPreference.findUnique({
      where: { userId_key: { userId: context.profile.id, key } },
    });
    if (!pref) return c.json({ error: "not_found" }, 404);
    return c.json({ value: pref.value });
  } catch {
    return c.json({ error: "No se pudo obtener la preferencia." }, 500);
  }
});

app.put("/profile/me/preferences/:key", authMiddleware, async (c) => {
  try {
    const context = await getOrLoadUserContext(c);
    if (!context?.profile) return c.json({ error: "Perfil no encontrado." }, 404);
    const key = c.req.param("key");
    const { value } = await c.req.json();
    const pref = await prisma.userPreference.upsert({
      where: { userId_key: { userId: context.profile.id, key } },
      update: { value },
      create: { userId: context.profile.id, key, value },
    });
    return c.json({ value: pref.value });
  } catch {
    return c.json({ error: "No se pudo guardar la preferencia." }, 500);
  }
});
```

- [ ] **Step 2: Syntax check API**

```bash
node --check apps/api/src/index.js
```

Expected: no output.

- [ ] **Step 3: Add SDK methods**

In `packages/sdk/src/index.js`, inside the `profile` object (after the `deleteTablePreference` entry, around line 108), add:

```js
      getPreference: (key, token) =>
        request(`/profile/me/preferences/${encodeURIComponent(key)}`, {
          headers: withAuthHeaders(token),
        }),
      setPreference: (key, value, token) =>
        request(`/profile/me/preferences/${encodeURIComponent(key)}`, {
          method: 'PUT',
          headers: withAuthHeaders(token),
          body: JSON.stringify({ value }),
        }),
```

- [ ] **Step 4: Syntax check SDK**

```bash
node --check packages/sdk/src/index.js
```

Expected: no output.

- [ ] **Step 5: Manual API smoke test**

Start the API (`pnpm dev:api`) and verify the routes work:

```bash
# Replace $TOKEN with a valid Bearer token from the running app session
curl -s -X PUT http://localhost:4010/profile/me/preferences/app.view \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"value":{"sortMode":"az","viewMode":"cards","favoritesFirst":false,"favorites":[]}}' | head -c 200

curl -s http://localhost:4010/profile/me/preferences/app.view \
  -H "Authorization: Bearer $TOKEN" | head -c 200
```

Expected: PUT returns `{"value":{"sortMode":"az",...}}`, GET returns the same.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/index.js packages/sdk/src/index.js
git commit -m "feat(api): add GET/PUT /profile/me/preferences/:key routes and SDK methods"
```

---

## Task 4: Extract `ModIcon` to shared component

**Files:**
- Create: `apps/desktop/src/components/ModIcon.jsx`

- [ ] **Step 1: Create `ModIcon.jsx`**

Create `apps/desktop/src/components/ModIcon.jsx`:

```jsx
import {
  Box, Layers, ContactRound, Landmark, LayoutDashboard, Puzzle,
  Settings, Contact, Wallet, Users, Shield, Palette, FolderOpen,
  Building2, CreditCard, BarChart3, FileText, Home, Truck,
} from 'lucide-react';

const ICON_MAP = {
  LayoutDashboard, Puzzle, Settings, Contact, Wallet, Users, Shield,
  Palette, FolderOpen, Building2, Layers, ContactRound, Landmark,
  CreditCard, BarChart3, FileText, Home, Truck, Box,
};

export function ModIcon({ name, size = 22, color, logoUrl }) {
  if (typeof logoUrl === 'string' && logoUrl.trim()) {
    return (
      <img
        src={logoUrl}
        alt=""
        className="object-contain"
        style={{ width: size, height: size }}
      />
    );
  }
  const raw = typeof name === 'string' ? name.trim() : '';
  const pascalName = raw
    .split(/[^a-zA-Z0-9]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('');
  const Icon = ICON_MAP[raw] ?? ICON_MAP[pascalName] ?? Box;
  return <Icon size={size} style={{ color }} />;
}
```

- [ ] **Step 2: Syntax check**

```bash
node --check apps/desktop/src/components/ModIcon.jsx
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/components/ModIcon.jsx
git commit -m "feat(ui): extract ModIcon to shared component"
```

---

## Task 5: `useAppViewPrefs` hook

**Files:**
- Create: `apps/desktop/src/hooks/useAppViewPrefs.js`

- [ ] **Step 1: Create the hook**

Create `apps/desktop/src/hooks/useAppViewPrefs.js`:

```js
import { useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthProvider';
import { atlas } from '../lib/atlas';

const PREF_KEY = 'app.view';

const DEFAULTS = {
  sortMode: 'az',
  viewMode: 'cards',
  favoritesFirst: false,
  favorites: [],
};

export function useAppViewPrefs() {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const debounceRef = useRef(null);

  const queryKey = ['user-preferences', PREF_KEY, token];

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      try {
        return await atlas.profile.getPreference(PREF_KEY, token);
      } catch (e) {
        if (e.status === 404) return { value: DEFAULTS };
        throw e;
      }
    },
    enabled: Boolean(token),
    staleTime: 300_000,
  });

  const mutation = useMutation({
    mutationFn: (value) => atlas.profile.setPreference(PREF_KEY, value, token),
  });

  const prefs = data ? { ...DEFAULTS, ...data.value } : DEFAULTS;

  function saveDebounced(next) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      mutation.mutate(next);
    }, 500);
  }

  function update(changes) {
    const next = { ...prefs, ...changes };
    queryClient.setQueryData(queryKey, { value: next });
    saveDebounced(next);
  }

  return {
    sortMode: prefs.sortMode,
    viewMode: prefs.viewMode,
    favoritesFirst: prefs.favoritesFirst,
    favorites: prefs.favorites,
    isLoading,
    setSortMode: (mode) => update({ sortMode: mode }),
    setViewMode: (mode) => update({ viewMode: mode }),
    toggleFavoritesFirst: () => update({ favoritesFirst: !prefs.favoritesFirst }),
    toggleFavorite: (key) =>
      update({
        favorites: prefs.favorites.includes(key)
          ? prefs.favorites.filter((k) => k !== key)
          : [...prefs.favorites, key],
      }),
    isFavorite: (key) => prefs.favorites.includes(key),
  };
}
```

- [ ] **Step 2: Syntax check**

```bash
node --check apps/desktop/src/hooks/useAppViewPrefs.js
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/hooks/useAppViewPrefs.js
git commit -m "feat(ui): add useAppViewPrefs hook with optimistic updates and debounced save"
```

---

## Task 6: `AppViewControls` component

**Files:**
- Create: `apps/desktop/src/components/AppViewControls.jsx`

- [ ] **Step 1: Create the component**

Create `apps/desktop/src/components/AppViewControls.jsx`:

```jsx
import { LayoutGrid, List, Star } from 'lucide-react';
import { useAppViewPrefs } from '../hooks/useAppViewPrefs';

export function AppViewControls({ className = '' }) {
  const {
    sortMode, viewMode, favoritesFirst,
    setSortMode, setViewMode, toggleFavoritesFirst,
  } = useAppViewPrefs();

  const activeToggle = 'bg-[hsl(var(--card))] text-[hsl(var(--foreground))] shadow-sm';
  const inactiveToggle =
    'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]';

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Sort mode */}
      <div className="flex bg-[hsl(var(--muted))] rounded-md p-0.5 text-xs">
        <button
          onClick={() => setSortMode('az')}
          className={`px-2.5 py-1 rounded font-medium transition-colors cursor-pointer ${
            sortMode === 'az' ? activeToggle : inactiveToggle
          }`}
        >
          A-Z
        </button>
        <button
          onClick={() => setSortMode('groups')}
          className={`px-2.5 py-1 rounded font-medium transition-colors cursor-pointer ${
            sortMode === 'groups' ? activeToggle : inactiveToggle
          }`}
        >
          Grupos
        </button>
      </div>

      {/* View mode */}
      <div className="flex bg-[hsl(var(--muted))] rounded-md p-0.5">
        <button
          onClick={() => setViewMode('cards')}
          className={`p-1 rounded transition-colors cursor-pointer ${
            viewMode === 'cards' ? activeToggle : inactiveToggle
          }`}
          title="Vista tarjetas"
        >
          <LayoutGrid size={13} />
        </button>
        <button
          onClick={() => setViewMode('list')}
          className={`p-1 rounded transition-colors cursor-pointer ${
            viewMode === 'list' ? activeToggle : inactiveToggle
          }`}
          title="Vista lista"
        >
          <List size={13} />
        </button>
      </div>

      {/* Favorites first */}
      <button
        onClick={toggleFavoritesFirst}
        className={`flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors cursor-pointer ${
          favoritesFirst
            ? 'text-amber-400'
            : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
        }`}
        title="Favoritos primero"
      >
        <Star size={12} className={favoritesFirst ? 'fill-amber-400' : ''} />
        Favoritos
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Syntax check**

```bash
node --check apps/desktop/src/components/AppViewControls.jsx
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/components/AppViewControls.jsx
git commit -m "feat(ui): add AppViewControls component with sort, view mode, and favorites toggles"
```

---

## Task 7: `AppContextMenu` component

**Files:**
- Create: `apps/desktop/src/components/AppContextMenu.jsx`

- [ ] **Step 1: Create the component**

Create `apps/desktop/src/components/AppContextMenu.jsx`:

```jsx
import { useEffect, useRef } from 'react';
import { Star, StarOff } from 'lucide-react';
import { useAppViewPrefs } from '../hooks/useAppViewPrefs';

export function AppContextMenu({ x, y, moduleKey, onClose }) {
  const { isFavorite, toggleFavorite } = useAppViewPrefs();
  const ref = useRef(null);
  const fav = isFavorite(moduleKey);

  useEffect(() => {
    function handleDown(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    }
    function handleKey(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', handleDown);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleDown);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="fixed z-[300] bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-lg shadow-lg py-1 min-w-[190px]"
      style={{ top: y, left: x }}
    >
      <button
        onClick={() => {
          toggleFavorite(moduleKey);
          onClose();
        }}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors cursor-pointer text-left"
      >
        {fav ? (
          <StarOff size={14} className="text-amber-400 shrink-0" />
        ) : (
          <Star size={14} className="shrink-0" />
        )}
        {fav ? 'Quitar de favoritos' : 'Agregar a favoritos'}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Syntax check**

```bash
node --check apps/desktop/src/components/AppContextMenu.jsx
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/components/AppContextMenu.jsx
git commit -m "feat(ui): add AppContextMenu for right-click favorite toggle"
```

---

## Task 8: Update `AppLauncher.jsx`

**Files:**
- Modify: `apps/desktop/src/components/AppLauncher.jsx`

- [ ] **Step 1: Replace file contents**

Replace `apps/desktop/src/components/AppLauncher.jsx` entirely with:

```jsx
import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Search, X, Home, Star } from 'lucide-react';
import { useLauncherStore } from '../stores/launcher';
import { getModuleLaunchPath, getSortedDisplay } from '../lib/runtimeModules';
import { useRuntimeModules } from '../app/useRuntimeModules';
import { useAppViewPrefs } from '../hooks/useAppViewPrefs';
import { AppViewControls } from './AppViewControls';
import { AppContextMenu } from './AppContextMenu';
import { ModIcon } from './ModIcon';

export function AppLauncher() {
  const { isOpen, closeLauncher, toggleLauncher } = useLauncherStore();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [contextMenu, setContextMenu] = useState(null);
  const { availableModules } = useRuntimeModules();
  const { sortMode, viewMode, favorites, favoritesFirst, isFavorite } = useAppViewPrefs();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return availableModules;
    return availableModules.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        (m.summary ?? '').toLowerCase().includes(q) ||
        m.key.toLowerCase().includes(q),
    );
  }, [query, availableModules]);

  const sections = useMemo(() => {
    if (query.trim()) return [{ label: null, modules: filtered }];
    return getSortedDisplay(filtered, { sortMode, favorites, favoritesFirst });
  }, [filtered, query, sortMode, favorites, favoritesFirst]);

  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') {
        if (contextMenu) { setContextMenu(null); return; }
        closeLauncher();
        setQuery('');
      }
      if (e.ctrlKey && e.key === '.') {
        e.preventDefault();
        toggleLauncher();
      }
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [closeLauncher, toggleLauncher, contextMenu]);

  function handleModuleClick(module) {
    navigate(getModuleLaunchPath(module));
    closeLauncher();
    setQuery('');
  }

  function handleGoHome() {
    navigate('/app/home');
    closeLauncher();
    setQuery('');
  }

  function handleContextMenu(e, moduleKey) {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, moduleKey });
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-100 flex items-start justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => { closeLauncher(); setQuery(''); }}
          />

          <motion.div
            className="relative glass-strong rounded-2xl w-full max-w-2xl mx-4 mt-[10dvh] max-h-[80dvh] flex flex-col overflow-hidden"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Search header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-[hsl(var(--border))] shrink-0">
              <Search size={15} className="text-[hsl(var(--muted-foreground))] shrink-0" />
              <input
                autoFocus
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar aplicación..."
                className="flex-1 bg-transparent text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] outline-none"
              />
              <button
                onClick={handleGoHome}
                className="h-7 px-2.5 flex items-center gap-1.5 rounded-lg text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors cursor-pointer text-xs font-medium"
              >
                <Home size={13} />
                Inicio
              </button>
              <button
                onClick={() => { closeLauncher(); setQuery(''); }}
                className="h-7 w-7 flex items-center justify-center rounded-lg text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>

            {/* Controls bar (hidden during search) */}
            {!query.trim() && (
              <AppViewControls className="px-4 py-2 border-b border-[hsl(var(--border))] shrink-0" />
            )}

            {/* Module list */}
            <div className="overflow-y-auto flex-1 px-4 py-4 space-y-5">
              {sections.length === 0 ? (
                <p className="text-sm text-center text-[hsl(var(--muted-foreground))] py-8">
                  Sin resultados para "{query}"
                </p>
              ) : (
                sections.map((section, si) => (
                  <div key={section.label ?? `section-${si}`}>
                    {section.label && (
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-3">
                        {section.label}
                      </p>
                    )}
                    {viewMode === 'list' ? (
                      <div className="flex flex-col gap-0.5">
                        {section.modules.map((module) => (
                          <button
                            key={module.key}
                            onClick={() => handleModuleClick(module)}
                            onContextMenu={(e) => handleContextMenu(e, module.key)}
                            className="flex items-center gap-3 w-full rounded-lg px-3 py-2 hover:bg-[hsl(var(--muted))] transition-colors duration-150 cursor-pointer text-left"
                          >
                            <div
                              className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
                              style={{ backgroundColor: `${module.color}26` }}
                            >
                              <ModIcon name={module.icon} size={16} color={module.color} logoUrl={module.logoUrl} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-[hsl(var(--foreground))] leading-tight truncate">
                                {module.name}
                              </p>
                              <p className="text-[10px] text-[hsl(var(--muted-foreground))] truncate">
                                {module.summary || module.description}
                              </p>
                            </div>
                            {isFavorite(module.key) && (
                              <Star size={11} className="text-amber-400 fill-amber-400 shrink-0" />
                            )}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {section.modules.map((module) => (
                          <button
                            key={module.key}
                            onClick={() => handleModuleClick(module)}
                            onContextMenu={(e) => handleContextMenu(e, module.key)}
                            className="flex flex-col items-center gap-2 rounded-xl p-4 hover:bg-[hsl(var(--muted))] transition-colors duration-150 cursor-pointer text-center relative"
                          >
                            {isFavorite(module.key) && (
                              <Star size={9} className="absolute top-2 right-2 text-amber-400 fill-amber-400" />
                            )}
                            <div
                              className="h-12 w-12 rounded-xl flex items-center justify-center"
                              style={{ backgroundColor: `${module.color}26` }}
                            >
                              <ModIcon name={module.icon} size={22} color={module.color} logoUrl={module.logoUrl} />
                            </div>
                            <p className="text-xs font-semibold text-[hsl(var(--foreground))] leading-tight">
                              {module.name}
                            </p>
                            <p className="text-[10px] text-[hsl(var(--muted-foreground))] line-clamp-2 leading-snug w-full">
                              {module.summary || module.description}
                            </p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </motion.div>

          {contextMenu && (
            <AppContextMenu
              x={contextMenu.x}
              y={contextMenu.y}
              moduleKey={contextMenu.moduleKey}
              onClose={() => setContextMenu(null)}
            />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 2: Syntax check**

```bash
node --check apps/desktop/src/components/AppLauncher.jsx
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/components/AppLauncher.jsx
git commit -m "feat(ui): update AppLauncher with view controls, list mode, and right-click favorites"
```

---

## Task 9: Update `HomeScreen.jsx`

**Files:**
- Modify: `apps/desktop/src/app/HomeScreen.jsx`

- [ ] **Step 1: Replace file contents**

Replace `apps/desktop/src/app/HomeScreen.jsx` entirely with:

```jsx
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Box, Layers, Puzzle, Wifi, WifiOff, Star,
} from 'lucide-react';
import { Skeleton, StatCard, Separator } from '@atlas/ui';
import { useAuth } from '../auth/AuthProvider';
import { atlas } from '../lib/atlas';
import { getModuleLaunchPath, getSortedDisplay } from '../lib/runtimeModules';
import { useRuntimeModules } from './useRuntimeModules';
import { useAppViewPrefs } from '../hooks/useAppViewPrefs';
import { AppViewControls } from '../components/AppViewControls';
import { AppContextMenu } from '../components/AppContextMenu';
import { ModIcon } from '../components/ModIcon';

function trackModuleVisit(moduleKey) {
  try {
    const visits = JSON.parse(localStorage.getItem('atlas-module-visits') || '{}');
    visits[moduleKey] = Date.now();
    localStorage.setItem('atlas-module-visits', JSON.stringify(visits));
  } catch {}
}

function getSpanishDate() {
  try {
    const str = new Date().toLocaleDateString('es-MX', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
    return str.charAt(0).toUpperCase() + str.slice(1);
  } catch {
    return new Date().toLocaleDateString();
  }
}

export function HomeScreen() {
  const { userProfile, session } = useAuth();
  const token = session?.access_token;
  const navigate = useNavigate();
  const [contextMenu, setContextMenu] = useState(null);
  const { runtimeModules, availableModules, isLoading: modulesLoading, isError: modulesError } =
    useRuntimeModules();
  const { sortMode, viewMode, favorites, favoritesFirst, isFavorite } = useAppViewPrefs();

  const blueprintsQuery = useQuery({
    queryKey: ['blueprints', token],
    queryFn: () => atlas.blueprints.list(token),
    enabled: Boolean(token),
    staleTime: 60000,
  });

  const recentModules = useMemo(() => {
    try {
      const visits = JSON.parse(localStorage.getItem('atlas-module-visits') || '{}');
      return availableModules
        .filter((m) => visits[m.key])
        .sort((a, b) => visits[b.key] - visits[a.key])
        .slice(0, 4);
    } catch {
      return [];
    }
  }, [availableModules]);

  const sections = useMemo(
    () => getSortedDisplay(availableModules, { sortMode, favorites, favoritesFirst }),
    [availableModules, sortMode, favorites, favoritesFirst],
  );

  function handleModuleClick(module) {
    trackModuleVisit(module.key);
    navigate(getModuleLaunchPath(module));
  }

  function handleContextMenu(e, moduleKey) {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, moduleKey });
  }

  const firstName = userProfile?.firstName ?? userProfile?.displayName ?? 'Usuario';
  const installedCount = runtimeModules.filter((m) => m.status === 'INSTALLED' && m.enabled).length;
  const blueprintCount = blueprintsQuery.data?.data?.length ?? blueprintsQuery.data?.length;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-10 md:px-6">
      {/* Welcome header */}
      <div className="space-y-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[hsl(var(--foreground))]">
            Bienvenido, {firstName}.
          </h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">{getSpanishDate()}</p>
        </div>

        {recentModules.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Recientes:</span>
            {recentModules.map((m) => (
              <button
                key={m.key}
                onClick={() => handleModuleClick(m)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:bg-(--brand-soft) hover:border-(--brand-primary) text-xs font-medium text-[hsl(var(--foreground))] transition-all duration-150 cursor-pointer"
              >
                <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: m.color }} />
                {m.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* KPI stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Módulos instalados" value={installedCount} icon={Puzzle} loading={modulesLoading} />
        <StatCard label="Blueprints activos" value={blueprintCount ?? '—'} icon={Layers} loading={blueprintsQuery.isLoading} />
        <StatCard
          label="Estado API"
          value={modulesError ? 'Sin conexión' : 'Conectada'}
          icon={modulesError ? WifiOff : Wifi}
          loading={modulesLoading}
        />
      </div>

      {/* Module grid */}
      <div className="space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-lg font-semibold text-[hsl(var(--foreground))] shrink-0">Aplicaciones</h2>
          <Separator className="flex-1 min-w-8" />
          <AppViewControls />
        </div>

        <div className="space-y-8">
          {modulesLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-32 w-full rounded-2xl" />
              ))}
            </div>
          ) : (
            sections.map((section, si) => (
              <div key={section.label ?? `section-${si}`}>
                {section.label && (
                  <p className="text-xs font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-3">
                    {section.label}
                  </p>
                )}
                {viewMode === 'list' ? (
                  <div className="flex flex-col gap-1.5">
                    {section.modules.map((module) => (
                      <button
                        key={module.key}
                        onClick={() => handleModuleClick(module)}
                        onContextMenu={(e) => handleContextMenu(e, module.key)}
                        className="flex items-center gap-4 w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:shadow-sm hover:border-[hsl(var(--muted-foreground))]/30 transition-all duration-200 cursor-pointer px-4 py-3 text-left active:scale-[0.99]"
                      >
                        <div
                          className="rounded-lg flex items-center justify-center shrink-0"
                          style={{ height: 36, width: 36, backgroundColor: `${module.color}22` }}
                        >
                          <ModIcon name={module.icon} size={18} color={module.color} logoUrl={module.logoUrl} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-[hsl(var(--foreground))] leading-tight">{module.name}</p>
                          <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">
                            {module.summary || module.description}
                          </p>
                        </div>
                        {isFavorite(module.key) && (
                          <Star size={13} className="text-amber-400 fill-amber-400 shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {section.modules.map((module) => (
                      <button
                        key={module.key}
                        onClick={() => handleModuleClick(module)}
                        onContextMenu={(e) => handleContextMenu(e, module.key)}
                        className="flex flex-col gap-3 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:shadow-md hover:border-[hsl(var(--muted-foreground))]/30 transition-all duration-200 cursor-pointer p-5 text-left active:scale-[0.98] relative"
                      >
                        {isFavorite(module.key) && (
                          <Star size={11} className="absolute top-3 right-3 text-amber-400 fill-amber-400" />
                        )}
                        <div
                          className="rounded-xl flex items-center justify-center"
                          style={{ height: 48, width: 48, backgroundColor: `${module.color}22` }}
                        >
                          <ModIcon name={module.icon} size={22} color={module.color} logoUrl={module.logoUrl} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[hsl(var(--foreground))] leading-tight">{module.name}</p>
                          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1 line-clamp-2 leading-snug">
                            {module.summary || module.description}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}

          {!modulesLoading && availableModules.length === 0 && (
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              No hay módulos habilitados para mostrar.
            </p>
          )}
        </div>
      </div>

      {contextMenu && (
        <AppContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          moduleKey={contextMenu.moduleKey}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Syntax check**

```bash
node --check apps/desktop/src/app/HomeScreen.jsx
```

Expected: no output.

- [ ] **Step 3: Verify in browser**

Start dev servers: `pnpm dev`

Open http://localhost:5173/app/home and verify:
- Controls bar appears to the right of "Aplicaciones" heading
- Default: A-Z, cards — all apps in one flat alphabetical list
- Toggle to "Grupos" — apps grouped by category
- Toggle to list view — compact rows appear
- Right-click any app → context menu with "Agregar a favoritos"
- Mark a favorite, toggle "Favoritos" button → favorites section appears at top
- Open App Launcher (grid icon or Ctrl+.) — same controls appear below search bar
- Controls hidden when typing in search box
- Refresh page — preferences persisted from DB

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/app/HomeScreen.jsx
git commit -m "feat(ui): update HomeScreen with view controls, list mode, and right-click favorites"
```

---

## Self-Review Checklist

- [x] **Spec §1 (Data Model):** Task 1 adds `UserPreference` + relation
- [x] **Spec §2 (API routes):** Task 3 adds GET + PUT `/profile/me/preferences/:key`
- [x] **Spec §3 (Hook):** Task 5 creates `useAppViewPrefs` with optimistic update + 500ms debounce
- [x] **Spec §3 (AppViewControls):** Task 6 — [A-Z|Grupos] [Cards|Lista] [★ Favoritos]
- [x] **Spec §3 (AppContextMenu):** Task 7 — right-click "Agregar/Quitar de favoritos"
- [x] **Spec §3 (AppLauncher):** Task 8 — controls hidden during search, list view, context menu
- [x] **Spec §3 (HomeScreen):** Task 9 — controls inline with heading, list view, context menu
- [x] **Spec §4 (Display logic):** Task 2 tests all four combinations (az/groups × favFirst true/false)
- [x] **Spec §5 (ModIcon extraction):** Task 4
- [x] **Spec §6 (Migration):** Task 1 runs `pnpm db:migrate`
- [x] **Spec §7 (Error handling):** Hook silently returns defaults on 404/error; mutation errors swallowed
- [x] **Type consistency:** `getSortedDisplay` returns `{ label, modules }[]` — used identically in Tasks 8 and 9
- [x] **No placeholders:** All steps contain complete code
