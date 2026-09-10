# Notes Canvas — Plan A (API & Data) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the backend for a collaborative "canvas" note type in `atlas.notes`: a `note_type` column, a `note_canvas_scene` table, a `canvas-service`, authed + public routes, validators, and the SDK client.

**Architecture:** `atlas.notes` tables are managed by raw SQL migrations under `prisma/migrations/` (not in `schema.prisma`); all DB access is `prisma.$queryRaw`. A canvas is a normal `notes` row with `note_type = 'canvas'`; its Excalidraw scene (elements, appState subset, layers, files manifest) lives 1:1 in `note_canvas_scene` as JSONB with a monotonic `version`. Realtime sync is client-side over Supabase Realtime broadcast (Plan B); the API only does load/save + a public read endpoint.

**Tech Stack:** Node.js, Hono, Prisma 7 (`$queryRaw` only), PostgreSQL (self-hosted Supabase), Zod validators, `node:test`.

**Reference:** `docs/superpowers/specs/2026-09-10-notes-canvas-design.md` (sections 3, 6).

---

## File Structure

- Create: `prisma/migrations/<timestamp>_notes_canvas/migration.sql` — adds `notes.note_type` + `chk_notes_note_type`, creates `note_canvas_scene`.
- Create: `apps/api/src/routes/notes/canvas-service.js` — `createCanvasService({ prisma })` with `getScene`, `saveScene`, `getPublicScene`, plus exported pure helpers `whitelistAppState`, `extractSceneText`, `defaultLayer`.
- Create: `apps/api/src/routes/notes/__tests__/canvas-service.test.js` — `node:test` coverage.
- Modify: `apps/api/src/routes/notes/index.js` — mount `GET/PUT /notes/:id/canvas`; pass `noteType` through `POST /notes`.
- Modify: `apps/api/src/routes/notes/notes-service.js` — `createNote` writes `note_type`; `listNotes` `GROUP BY` gains `a.note_type`.
- Modify: `apps/api/src/index.js` — one new `GET /public/notes/:slug/canvas` immediately after the existing `GET /public/notes/:slug`.
- Modify: `packages/validators/src/notes.js` (or wherever the notes create schema lives — confirm) — add `noteType`; add `canvasSceneSchema`.
- Modify: `packages/validators/src/index.js` — export `canvasSceneSchema`.
- Modify: `packages/sdk/src/*` notes client — add `getCanvas`, `saveCanvas`, `getPublicCanvas`.

---

## Task 1: Migration — `notes.note_type` + `note_canvas_scene`

**Files:**
- Create: `prisma/migrations/<timestamp>_notes_canvas/migration.sql`

- [ ] **Step 1: Create the migration directory + file**

Pick `<timestamp>` as `YYYYMMDDHHMMSS` in UTC, greater than the latest existing migration dir. Run:

```bash
ls prisma/migrations | tail -3
```

Create `prisma/migrations/<timestamp>_notes_canvas/migration.sql` with exactly:

```sql
-- atlas.notes: collaborative canvas note type
-- Adds notes.note_type and the 1:1 note_canvas_scene table.

ALTER TABLE notes
  ADD COLUMN note_type TEXT NOT NULL DEFAULT 'document';

ALTER TABLE notes
  ADD CONSTRAINT chk_notes_note_type CHECK (note_type IN ('document', 'canvas'));

CREATE TABLE note_canvas_scene (
  note_id     UUID PRIMARY KEY REFERENCES notes(id) ON DELETE CASCADE,
  elements    JSONB NOT NULL DEFAULT '[]'::jsonb,
  app_state   JSONB NOT NULL DEFAULT '{}'::jsonb,
  layers      JSONB NOT NULL DEFAULT '[]'::jsonb,
  files       JSONB NOT NULL DEFAULT '{}'::jsonb,
  version     INTEGER NOT NULL DEFAULT 1,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by  UUID REFERENCES user_profile(id) ON DELETE SET NULL
);

CREATE INDEX notes_canvas_type_idx ON notes(note_type) WHERE note_type = 'canvas';
```

- [ ] **Step 2: Apply the migration**

Run: `pnpm db:migrate`
Expected: `Applying migration ... notes_canvas` then `The following migration(s) have been applied`. No errors.

- [ ] **Step 3: Regenerate the Prisma client**

Run: `pnpm db:generate`
Expected: `Generated Prisma Client`. (No schema change, but keeps parity.)

- [ ] **Step 4: Verify the column and table exist**

Run:
```bash
node -e "const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.\$queryRawUnsafe(\"select column_name from information_schema.columns where table_name='notes' and column_name='note_type'\").then(r=>console.log(r)).finally(()=>p.\$disconnect())"
```
Expected: `[ { column_name: 'note_type' } ]`

- [ ] **Step 5: Commit**

```bash
git add prisma/migrations
git commit -m "feat(notes): note_type column + note_canvas_scene table"
```

---

## Task 2: `canvas-service` pure helpers + tests

**Files:**
- Create: `apps/api/src/routes/notes/canvas-service.js`
- Test: `apps/api/src/routes/notes/__tests__/canvas-service.test.js`

- [ ] **Step 1: Write the failing test for the pure helpers**

Create `apps/api/src/routes/notes/__tests__/canvas-service.test.js`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  whitelistAppState,
  extractSceneText,
  defaultLayer,
} from '../canvas-service.js'

test('whitelistAppState keeps only allowed keys', () => {
  const out = whitelistAppState({
    gridModeEnabled: true,
    gridSize: 20,
    snapToGrid: true,
    viewBackgroundColor: '#fff',
    scrollX: 999,
    scrollY: 999,
    zoom: { value: 3 },
    collaborators: { a: 1 },
    selectedElementIds: { x: true },
    somethingElse: 'nope',
  })
  assert.deepEqual(out, {
    gridModeEnabled: true,
    gridSize: 20,
    snapToGrid: true,
    viewBackgroundColor: '#fff',
  })
})

test('whitelistAppState on non-object returns {}', () => {
  assert.deepEqual(whitelistAppState(null), {})
  assert.deepEqual(whitelistAppState('x'), {})
})

test('extractSceneText concatenates text elements, ignores deleted and non-text', () => {
  const els = [
    { type: 'text', text: 'hola' },
    { type: 'text', text: 'mundo', isDeleted: true },
    { type: 'rectangle' },
    { type: 'text', text: 'adios' },
  ]
  assert.equal(extractSceneText(els), 'hola adios')
})

test('extractSceneText handles empty / non-array', () => {
  assert.equal(extractSceneText([]), '')
  assert.equal(extractSceneText(null), '')
})

test('defaultLayer returns a fresh layer each call with a unique id', () => {
  const a = defaultLayer()
  const b = defaultLayer()
  assert.equal(a.name, 'Capa 1')
  assert.equal(a.visible, true)
  assert.equal(a.locked, false)
  assert.equal(a.opacity, 1)
  assert.equal(a.order, 0)
  assert.notEqual(a.id, b.id)
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test apps/api/src/routes/notes/__tests__/canvas-service.test.js`
Expected: FAIL — `Cannot find module '../canvas-service.js'`.

- [ ] **Step 3: Implement `canvas-service.js` with helpers only**

Create `apps/api/src/routes/notes/canvas-service.js`:

```js
import { randomUUID } from 'node:crypto'

export class CanvasServiceError extends Error {
  constructor(message, status = 400) {
    super(message)
    this.name = 'CanvasServiceError'
    this.status = status
  }
}

// Hard ceiling for a persisted scene. A rich canvas is a few hundred KB;
// past this is abuse or a client bug.
const MAX_SCENE_BYTES = 10 * 1024 * 1024 // 10 MiB

// Only these appState keys are persisted. Everything else (scroll, zoom,
// collaborators, selection, theme...) is per-viewport and must never be
// written to the shared scene.
const ALLOWED_APP_STATE_KEYS = [
  'gridModeEnabled',
  'gridSize',
  'snapToGrid',
  'viewBackgroundColor',
]

export function whitelistAppState(appState) {
  if (!appState || typeof appState !== 'object' || Array.isArray(appState)) return {}
  const out = {}
  for (const key of ALLOWED_APP_STATE_KEYS) {
    if (appState[key] !== undefined) out[key] = appState[key]
  }
  return out
}

export function extractSceneText(elements) {
  if (!Array.isArray(elements)) return ''
  return elements
    .filter((el) => el && el.type === 'text' && !el.isDeleted && typeof el.text === 'string')
    .map((el) => el.text.trim())
    .filter(Boolean)
    .join(' ')
}

export function defaultLayer() {
  return {
    id: randomUUID(),
    name: 'Capa 1',
    visible: true,
    locked: false,
    opacity: 1,
    order: 0,
  }
}

export function createCanvasService({ prisma }) {
  // Filled in Task 3.
  return {}
}
```

- [ ] **Step 4: Run to verify helper tests pass**

Run: `node --test apps/api/src/routes/notes/__tests__/canvas-service.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/notes/canvas-service.js apps/api/src/routes/notes/__tests__/canvas-service.test.js
git commit -m "feat(notes): canvas-service pure helpers"
```

---

## Task 3: `canvas-service` — `getScene` / `saveScene` / `getPublicScene`

**Files:**
- Modify: `apps/api/src/routes/notes/canvas-service.js`
- Test: `apps/api/src/routes/notes/__tests__/canvas-service.test.js`

Read `apps/api/src/routes/notes/__tests__/notes-access.test.js` first to copy its fake-`prisma` style.

- [ ] **Step 1: Add the failing service tests**

Append to `apps/api/src/routes/notes/__tests__/canvas-service.test.js`:

```js
import { createCanvasService, CanvasServiceError } from '../canvas-service.js'

// Minimal tagged-template fake. `handler(strings, values)` returns rows.
function fakePrisma(handler) {
  const tag = (strings, ...values) => Promise.resolve(handler(strings, values))
  return { $queryRaw: tag, $executeRaw: tag }
}

// Join the SQL fragments so tests can match on substrings.
const sqlOf = (strings) => strings.join('?')

test('getScene: owner with no scene row gets an empty scene with one layer', async () => {
  const svc = createCanvasService({
    prisma: fakePrisma((strings) => {
      const sql = sqlOf(strings)
      if (sql.includes('FROM notes')) return [{ id: 'note-1' }] // access check passes
      if (sql.includes('FROM note_canvas_scene')) return [] // no row
      return []
    }),
  })
  const scene = await svc.getScene('note-1', 'user-1')
  assert.deepEqual(scene.elements, [])
  assert.deepEqual(scene.files, {})
  assert.equal(scene.version, 0)
  assert.equal(scene.layers.length, 1)
  assert.equal(scene.layers[0].name, 'Capa 1')
})

test('getScene: no access throws 404', async () => {
  const svc = createCanvasService({
    prisma: fakePrisma((strings) => {
      if (sqlOf(strings).includes('FROM notes')) return [] // access check fails
      return []
    }),
  })
  await assert.rejects(() => svc.getScene('note-1', 'user-x'), (e) => {
    assert.equal(e instanceof CanvasServiceError, true)
    assert.equal(e.status, 404)
    return true
  })
})

test('getScene: returns the stored scene', async () => {
  const svc = createCanvasService({
    prisma: fakePrisma((strings) => {
      const sql = sqlOf(strings)
      if (sql.includes('FROM notes')) return [{ id: 'note-1' }]
      if (sql.includes('FROM note_canvas_scene')) return [{
        elements: [{ type: 'rectangle', id: 'r1' }],
        app_state: { gridModeEnabled: true },
        layers: [{ id: 'L1', name: 'Capa 1', visible: true, locked: false, opacity: 1, order: 0 }],
        files: { f1: { url: 'https://x/f1.png' } },
        version: 7,
      }]
      return []
    }),
  })
  const scene = await svc.getScene('note-1', 'user-1')
  assert.equal(scene.version, 7)
  assert.equal(scene.elements[0].id, 'r1')
  assert.equal(scene.appState.gridModeEnabled, true)
  assert.equal(scene.files.f1.url, 'https://x/f1.png')
})

test('saveScene: read-only share cannot save (403)', async () => {
  const svc = createCanvasService({
    prisma: fakePrisma((strings) => {
      // edit-access check returns no row
      if (sqlOf(strings).includes('permission')) return []
      return []
    }),
  })
  await assert.rejects(
    () => svc.saveScene('note-1', 'user-2', { elements: [], appState: {}, layers: [], files: {} }),
    (e) => { assert.equal(e.status, 403); return true },
  )
})

test('saveScene: rejects an oversized scene with 413', async () => {
  const svc = createCanvasService({
    prisma: fakePrisma((strings) => {
      if (sqlOf(strings).includes('permission')) return [{ id: 'note-1' }] // edit ok
      return []
    }),
  })
  const huge = { elements: [{ type: 'text', text: 'x'.repeat(11 * 1024 * 1024) }], appState: {}, layers: [], files: {} }
  await assert.rejects(() => svc.saveScene('note-1', 'user-1', huge), (e) => {
    assert.equal(e.status, 413); return true
  })
})

test('saveScene: whitelists appState, extracts text, bumps version', async () => {
  const calls = []
  const svc = createCanvasService({
    prisma: fakePrisma((strings, values) => {
      const sql = sqlOf(strings)
      calls.push({ sql, values })
      if (sql.includes('permission')) return [{ id: 'note-1' }] // edit ok
      if (sql.includes('INSERT INTO note_canvas_scene')) return [{ version: 3 }]
      if (sql.includes('UPDATE notes')) return []
      return []
    }),
  })
  const res = await svc.saveScene('note-1', 'user-1', {
    elements: [{ type: 'text', text: 'buscar esto' }, { type: 'rectangle' }],
    appState: { gridModeEnabled: true, scrollX: 500, zoom: { value: 2 } },
    layers: [{ id: 'L1', name: 'Capa 1', visible: true, locked: false, opacity: 1, order: 0 }],
    files: {},
  })
  assert.deepEqual(res, { ok: true, version: 3 })
  const insert = calls.find((c) => c.sql.includes('INSERT INTO note_canvas_scene'))
  const persistedAppState = insert.values.find(
    (v) => v && typeof v === 'object' && 'gridModeEnabled' in v,
  )
  assert.deepEqual(persistedAppState, { gridModeEnabled: true })
  const notesUpdate = calls.find((c) => c.sql.includes('UPDATE notes'))
  assert.equal(notesUpdate.values.includes('buscar esto'), true)
})

test('getPublicScene: 404 when not public / not a canvas', async () => {
  const svc = createCanvasService({
    prisma: fakePrisma(() => []),
  })
  await assert.rejects(() => svc.getPublicScene('nope'), (e) => {
    assert.equal(e.status, 404); return true
  })
})

test('getPublicScene: returns render-safe fields only', async () => {
  const svc = createCanvasService({
    prisma: fakePrisma((strings) => {
      if (sqlOf(strings).includes('public_slug')) return [{
        note_id: 'note-1',
        title: 'Mi lienzo',
        icon: 'shapes',
        elements: [{ id: 'r1', type: 'rectangle' }],
        app_state: { gridModeEnabled: false },
        layers: [{ id: 'L1', name: 'Capa 1', visible: true, locked: false, opacity: 1, order: 0 }],
        files: {},
        version: 4,
      }]
      return []
    }),
  })
  const scene = await svc.getPublicScene('slug-abc')
  assert.deepEqual(Object.keys(scene).sort(), ['appState', 'elements', 'files', 'icon', 'layers', 'noteId', 'title', 'version'])
  assert.equal(scene.noteId, 'note-1')
  assert.equal(scene.company_id, undefined)
  assert.equal(scene.owner_user_id, undefined)
})
```

- [ ] **Step 2: Run to verify the new tests fail**

Run: `node --test apps/api/src/routes/notes/__tests__/canvas-service.test.js`
Expected: FAIL — `svc.getScene is not a function` etc.

- [ ] **Step 3: Implement the three service functions**

Replace the `createCanvasService` stub in `apps/api/src/routes/notes/canvas-service.js`:

```js
export function createCanvasService({ prisma }) {
  async function assertReadAccess(noteId, userId) {
    const [note] = await prisma.$queryRaw`
      SELECT id FROM notes
      WHERE id = ${noteId}::uuid
        AND deleted_at IS NULL
        AND (
          owner_user_id = ${userId}::uuid
          OR id IN (
            SELECT note_id FROM note_shares
            WHERE shared_with_user_id = ${userId}::uuid
          )
        )
    `
    if (!note) throw new CanvasServiceError('Nota no encontrada', 404)
  }

  async function assertEditAccess(noteId, userId) {
    const [note] = await prisma.$queryRaw`
      SELECT id FROM notes
      WHERE id = ${noteId}::uuid
        AND deleted_at IS NULL
        AND (
          owner_user_id = ${userId}::uuid
          OR id IN (
            SELECT note_id FROM note_shares
            WHERE shared_with_user_id = ${userId}::uuid
              AND permission = 'edit'
          )
        )
    `
    if (!note) throw new CanvasServiceError('Sin permisos de edicion', 403)
  }

  async function getScene(noteId, userId) {
    await assertReadAccess(noteId, userId)
    const [row] = await prisma.$queryRaw`
      SELECT elements, app_state, layers, files, version
      FROM note_canvas_scene
      WHERE note_id = ${noteId}::uuid
    `
    if (!row) {
      return { elements: [], appState: {}, layers: [defaultLayer()], files: {}, version: 0 }
    }
    return {
      elements: row.elements ?? [],
      appState: row.app_state ?? {},
      layers: Array.isArray(row.layers) && row.layers.length ? row.layers : [defaultLayer()],
      files: row.files ?? {},
      version: row.version,
    }
  }

  async function saveScene(noteId, userId, scene) {
    await assertEditAccess(noteId, userId)
    const elements = Array.isArray(scene?.elements) ? scene.elements : []
    const layers = Array.isArray(scene?.layers) ? scene.layers : []
    const files = scene?.files && typeof scene.files === 'object' ? scene.files : {}
    const appState = whitelistAppState(scene?.appState)

    const payload = JSON.stringify({ elements, appState, layers, files })
    if (payload.length > MAX_SCENE_BYTES) {
      throw new CanvasServiceError('El lienzo excede el tamano maximo permitido', 413)
    }

    const [row] = await prisma.$queryRaw`
      INSERT INTO note_canvas_scene (note_id, elements, app_state, layers, files, version, updated_at, updated_by)
      VALUES (
        ${noteId}::uuid,
        ${JSON.stringify(elements)}::jsonb,
        ${JSON.stringify(appState)}::jsonb,
        ${JSON.stringify(layers)}::jsonb,
        ${JSON.stringify(files)}::jsonb,
        1,
        NOW(),
        ${userId}::uuid
      )
      ON CONFLICT (note_id) DO UPDATE SET
        elements = EXCLUDED.elements,
        app_state = EXCLUDED.app_state,
        layers = EXCLUDED.layers,
        files = EXCLUDED.files,
        version = note_canvas_scene.version + 1,
        updated_at = NOW(),
        updated_by = EXCLUDED.updated_by
      RETURNING version
    `

    const contentText = extractSceneText(elements)
    await prisma.$executeRaw`
      UPDATE notes
      SET content_text = ${contentText}::text,
          updated_at = NOW()
      WHERE id = ${noteId}::uuid
    `

    return { ok: true, version: row.version }
  }

  async function getPublicScene(slug) {
    const [row] = await prisma.$queryRaw`
      SELECT
        n.id            AS note_id,
        n.title,
        n.icon,
        s.elements,
        s.app_state,
        s.layers,
        s.files,
        s.version
      FROM notes n
      LEFT JOIN note_canvas_scene s ON s.note_id = n.id
      WHERE n.public_slug = ${slug}
        AND n.is_public = true
        AND n.deleted_at IS NULL
        AND n.is_trashed = false
        AND n.note_type = 'canvas'
    `
    if (!row) throw new CanvasServiceError('Nota no encontrada', 404)
    return {
      noteId: row.note_id,
      title: row.title ?? '',
      icon: row.icon ?? '',
      elements: row.elements ?? [],
      appState: row.app_state ?? {},
      layers: Array.isArray(row.layers) && row.layers.length ? row.layers : [defaultLayer()],
      files: row.files ?? {},
      version: row.version ?? 0,
    }
  }

  return { getScene, saveScene, getPublicScene }
}
```

- [ ] **Step 4: Run all canvas-service tests**

Run: `node --test apps/api/src/routes/notes/__tests__/canvas-service.test.js`
Expected: PASS (all tests).

- [ ] **Step 5: Syntax-check the file**

Run: `node --check apps/api/src/routes/notes/canvas-service.js`
Expected: no output (OK).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes/notes/canvas-service.js apps/api/src/routes/notes/__tests__/canvas-service.test.js
git commit -m "feat(notes): canvas scene get/save/public service"
```

---

## Task 4: Wire authed canvas routes + `noteType` on create

**Files:**
- Modify: `apps/api/src/routes/notes/index.js`
- Modify: `apps/api/src/routes/notes/notes-service.js`

- [ ] **Step 1: `createNote` writes `note_type`**

In `apps/api/src/routes/notes/notes-service.js`, change the `createNote` signature and INSERT. Current (lines ~61-84):

```js
  async function createNote({ userId, companyId, folderId, title, content, icon, backgroundColor }) {
    const rows = await prisma.$queryRaw`
      INSERT INTO notes (
        owner_user_id,
        company_id,
        folder_id,
        title,
        content,
        icon,
        background_color
      )
      VALUES (
        ${userId},
        ${companyId ?? null}::uuid,
        ${folderId ?? null}::uuid,
        ${title ?? "Sin titulo"},
        ${JSON.stringify(content ?? '')}::jsonb,
        ${icon ?? ''},
        ${backgroundColor ?? null}
      )
      RETURNING *
    `;
    return rows[0];
  }
```

Replace with:

```js
  async function createNote({ userId, companyId, folderId, title, content, icon, backgroundColor, noteType }) {
    const type = noteType === 'canvas' ? 'canvas' : 'document';
    const rows = await prisma.$queryRaw`
      INSERT INTO notes (
        owner_user_id,
        company_id,
        folder_id,
        title,
        content,
        icon,
        background_color,
        note_type
      )
      VALUES (
        ${userId},
        ${companyId ?? null}::uuid,
        ${folderId ?? null}::uuid,
        ${title ?? "Sin titulo"},
        ${JSON.stringify(content ?? '')}::jsonb,
        ${icon ?? ''},
        ${backgroundColor ?? null},
        ${type}::text
      )
      RETURNING *
    `;
    return rows[0];
  }
```

- [ ] **Step 2: `listNotes` `GROUP BY` includes `a.note_type`**

In `notes-service.js`, in `listNotes`, the `GROUP BY` block (lines ~227-250) lists columns explicitly. Add `a.note_type,` right after `a.owner_user_id,` (or anywhere in the list). The `SELECT a.*` already returns it; this only prevents a "must appear in GROUP BY" error.

- [ ] **Step 3: Mount canvas routes in the notes router**

In `apps/api/src/routes/notes/index.js`:

Add the import near the other service imports (after line 6):

```js
import { createCanvasService } from './canvas-service.js'
```

Instantiate it next to the others (after `const ydoc = ...`, line ~14):

```js
  const canvas = createCanvasService({ prisma })
```

Add `noteType` to the `POST /notes` handler body destructure (line ~206):

```js
      const { title, content, folderId, icon, backgroundColor, noteType } = body
      const note = await notes.createNote({ userId, companyId, title, content, folderId, icon, backgroundColor, noteType })
```

Add the two routes immediately after the `PUT /notes/:id/ydoc` handler (after line ~315), before the `TAGS ON NOTES` section:

```js
  // ==============================================================
  // CANVAS SCENE
  // ==============================================================

  // GET /notes/:id/canvas
  internal.get('/:id/canvas', requirePermission('notes.notes.read'), async (c) => {
    try {
      const { userId } = getAuth(c)
      const noteId = c.req.param('id')
      const scene = await canvas.getScene(noteId, userId)
      return c.json({ scene })
    } catch (e) {
      return c.json({ error: e.message }, e.status ?? 500)
    }
  })

  // PUT /notes/:id/canvas
  internal.put('/:id/canvas', requirePermission('notes.notes.update'), async (c) => {
    try {
      const { userId } = getAuth(c)
      const noteId = c.req.param('id')
      const body = await c.req.json()
      const result = await canvas.saveScene(noteId, userId, body)
      return c.json(result)
    } catch (e) {
      return c.json({ error: e.message }, e.status ?? 500)
    }
  })
```

- [ ] **Step 4: Syntax-check both files**

Run:
```bash
node --check apps/api/src/routes/notes/index.js && node --check apps/api/src/routes/notes/notes-service.js
```
Expected: no output.

- [ ] **Step 5: Run the notes route tests**

Run: `node --test apps/api/src/routes/notes/__tests__/`
Expected: PASS (existing + new).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes/notes/index.js apps/api/src/routes/notes/notes-service.js
git commit -m "feat(notes): authed canvas routes + noteType on create"
```

---

## Task 5: Public canvas route in `apps/api/src/index.js`

**Files:**
- Modify: `apps/api/src/index.js` (near line 83-90 for import/instantiation; near line 884-892 for the route)

**IMPORTANT (memory: "public route ordering is sacred"):** add ONE new `GET` route immediately after the existing `GET /public/notes/:slug`. Do NOT reorder any route. Do NOT change the root `use("*", authMiddleware)`. Flag for manual review by Raul in the commit body.

- [ ] **Step 1: Import + instantiate the canvas service**

Near line 84, after `import { createSharesService as createNotesSharesService } from "./routes/notes/shares-service.js";` add:

```js
import { createCanvasService as createNotesCanvasService } from "./routes/notes/canvas-service.js";
```

Near line 885, after `const _publicNotesShares = createNotesSharesService({ prisma, broadcaster });` add:

```js
const _publicNotesCanvas = createNotesCanvasService({ prisma });
```

- [ ] **Step 2: Add the public route**

Immediately after the existing block (line ~886-892):

```js
app.get("/public/notes/:slug", async (c) => {
  try {
    const slug = c.req.param("slug");
    const note = await _publicNotesShares.getPublicNote(slug);
    return c.json({ note });
  } catch (e) {
    return c.json({ error: e.message }, e.status ?? 500);
  }
});
```

add:

```js
// Public canvas scene — no auth. Sibling of GET /public/notes/:slug above;
// registered here so it is never wrapped by auth middleware.
app.get("/public/notes/:slug/canvas", async (c) => {
  try {
    const slug = c.req.param("slug");
    const scene = await _publicNotesCanvas.getPublicScene(slug);
    return c.json({ scene });
  } catch (e) {
    return c.json({ error: e.message }, e.status ?? 500);
  }
});
```

- [ ] **Step 3: Syntax-check**

Run: `node --check apps/api/src/index.js`
Expected: no output.

- [ ] **Step 4: Start the API and hit both public routes**

Run (in one shell): `pnpm dev:api`
In another: 
```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4010/public/notes/does-not-exist
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4010/public/notes/does-not-exist/canvas
```
Expected: `404` and `404` (not `401` — proves neither is behind auth).

Stop the dev API afterwards.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/index.js
git commit -m "feat(notes): public canvas scene route

Adds one GET /public/notes/:slug/canvas immediately after the existing
public notes route. No route reordering, no auth-guard changes.
Needs a manual eyeball on public-route ordering."
```

---

## Task 6: Validators

**Files:**
- Modify: notes create schema file — find it first
- Modify: `packages/validators/src/index.js`

- [ ] **Step 1: Locate the notes create schema**

Run: `grep -rl "notes" packages/validators/src`
Then open the file that defines the note-create schema (look for `title` + `content` + `folderId`). If none exists, create `packages/validators/src/notes.js`.

- [ ] **Step 2: Add `noteType` to the create schema**

In that schema object add:

```js
  noteType: z.enum(['document', 'canvas']).optional().default('document'),
```

- [ ] **Step 3: Add `canvasSceneSchema`**

In the same file:

```js
export const canvasLayerSchema = z.object({
  id: z.string(),
  name: z.string(),
  visible: z.boolean(),
  locked: z.boolean(),
  opacity: z.number().min(0).max(1),
  order: z.number(),
})

export const canvasSceneSchema = z.object({
  // Element internals are Excalidraw's authority; the API whitelists appState
  // and enforces the size cap. Keep this permissive on purpose.
  elements: z.array(z.any()).default([]),
  appState: z.record(z.any()).default({}),
  layers: z.array(canvasLayerSchema).default([]),
  files: z.record(z.any()).default({}),
})
```

- [ ] **Step 4: Export from the barrel**

In `packages/validators/src/index.js` add (matching the file's existing export style):

```js
export { canvasSceneSchema, canvasLayerSchema } from './notes.js'
```

(Adjust the path if the schema lives elsewhere.)

- [ ] **Step 5: Verify the package builds / lints**

Run: `pnpm --filter @atlas/validators lint` (or `pnpm lint:packages`)
Expected: no errors. Also `node --check` the modified file.

- [ ] **Step 6: Commit**

```bash
git add packages/validators
git commit -m "feat(validators): noteType + canvasSceneSchema"
```

---

## Task 7: SDK client

**Files:**
- Modify: `packages/sdk/src/*` — the notes client group

- [ ] **Step 1: Find the notes client**

Run: `grep -rn "getYDoc\|saveYDoc\|getPublic" packages/sdk/src`
Open the file that defines `notes.getYDoc` / `notes.getPublic`.

- [ ] **Step 2: Add three methods**

Mirror the style of `getYDoc` / `saveYDoc` / `getPublic` exactly. Add to the `notes` group:

```js
    getCanvas: (noteId, token) =>
      request(`/notes/${noteId}/canvas`, { token }),

    saveCanvas: (noteId, scene, token) =>
      request(`/notes/${noteId}/canvas`, {
        method: 'PUT',
        token,
        body: scene,
      }),

    getPublicCanvas: (slug) =>
      request(`/public/notes/${slug}/canvas`, {}),
```

Match the actual helper name/signature used in that file (`request`, `http`, `client.get`, whatever it is) — copy the neighbouring methods.

- [ ] **Step 3: Syntax-check / build**

Run: `pnpm --filter @atlas/sdk build` (or `node --check` the file if there is no build).
Expected: success.

- [ ] **Step 4: Commit**

```bash
git add packages/sdk
git commit -m "feat(sdk): notes canvas scene client methods"
```

---

## Task 8: Full Plan A verification

- [ ] **Step 1: Run all API notes tests**

Run: `node --test apps/api/src/routes/notes/__tests__/`
Expected: PASS.

- [ ] **Step 2: Lint**

Run: `pnpm lint`
Expected: no errors introduced by Plan A files.

- [ ] **Step 3: Manual API smoke (authed)**

With `pnpm dev:api` running and a valid `$ATLAS_TOKEN` in the environment (ask the user to export it — never print it):

```bash
# create a canvas note
curl -s -X POST http://localhost:4010/notes -H "Authorization: Bearer $ATLAS_TOKEN" -H 'content-type: application/json' \
  -d '{"title":"Lienzo de prueba","content":"","noteType":"canvas"}'
# -> note the returned id as $NID

curl -s http://localhost:4010/notes/$NID/canvas -H "Authorization: Bearer $ATLAS_TOKEN"
# -> { "scene": { "elements": [], "layers": [ { "name": "Capa 1", ... } ], "version": 0 } }

curl -s -X PUT http://localhost:4010/notes/$NID/canvas -H "Authorization: Bearer $ATLAS_TOKEN" -H 'content-type: application/json' \
  -d '{"elements":[{"type":"text","text":"hola","id":"t1","version":1}],"appState":{"gridModeEnabled":true,"scrollX":99},"layers":[{"id":"L1","name":"Capa 1","visible":true,"locked":false,"opacity":1,"order":0}],"files":{}}'
# -> { "ok": true, "version": 1 }

curl -s http://localhost:4010/notes/$NID/canvas -H "Authorization: Bearer $ATLAS_TOKEN"
# -> version 1, appState has gridModeEnabled but NOT scrollX
```

- [ ] **Step 4: Mark the spec's Plan A section complete**

In `docs/superpowers/specs/2026-09-10-notes-canvas-design.md` section 14, add `Verified: 2026-09-10 (API smoke + node:test)` to the Plan A bullet.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/specs/2026-09-10-notes-canvas-design.md
git commit -m "docs(notes): mark canvas Plan A verified"
```
