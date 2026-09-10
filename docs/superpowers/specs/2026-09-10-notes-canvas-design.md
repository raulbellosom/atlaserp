# Spec: Nota tipo Canvas colaborativo (atlas.notes)

- Fecha: 2026-09-10
- Modulo: `atlas.notes`
- Estado: aprobado (brainstorming), pendiente de plan

## 1. Resumen

Nuevo tipo de nota **lienzo** (canvas) en `atlas.notes`: un lienzo infinito estilo
Excalidraw con formas, texto, dibujo a mano e imagenes, cuadricula conmutable con
snap, panel de capas estilo Illustrator, y edicion colaborativa en tiempo real.
El enlace publico muestra el lienzo **en vivo, solo lectura** (los visitantes
anonimos ven aparecer los cambios pero no pueden editar).

Motor: `@excalidraw/excalidraw` (MIT) embebido, con carga lazy. La sincronizacion
NO usa Yjs: se difunden los elementos cambiados por un canal de Supabase Realtime
(broadcast + presence) y cada cliente los aplica con `reconcileElements` de
Excalidraw (que reconcilia por `version`/`versionNonce`, exactamente como el modo
colaborativo de excalidraw.com). La escena persiste como JSON en una tabla nueva
`note_canvas_scene`.

### Por que sin Yjs

El unico beneficio real de Yjs aqui seria el merge a nivel caracter dentro de un
texto colaborativo. Excalidraw trata cada shape y cada texto como una unidad
atomica con su propio contador `version`; `reconcileElements` ya resuelve el orden
y los conflictos por elemento. Un binding Excalidraw-Yjs anadiria complejidad
fragil (tracking de versiones, bucles de eco, exclusion de `appState`, archivos)
para un beneficio marginal.

## 2. Contexto del modulo actual

- `atlas.notes` es un modulo de feature (no AME3). Tablas creadas con migraciones
  SQL crudas en `prisma/migrations/` (`20260627120000_atlas_notes_tables`,
  `20260627130000_atlas_notes_fixes`). NO estan en `prisma/schema.prisma`. Todo el
  acceso es `prisma.$queryRaw`. PK `uuid DEFAULT uuidv7()`.
- Tablas: `notes`, `note_folders`, `note_tags`, `note_tag_assignments`,
  `note_shares` (`permission IN ('read','edit')`), `note_ydoc_state`.
- Edicion colaborativa de notas documento: `SupabaseYjsProvider`
  (`apps/desktop/src/modules/atlas.notes/lib/SupabaseYjsProvider.js`) sincroniza
  un `Y.Doc` por canal broadcast de Supabase Realtime (topic `note:ydoc:<id>`),
  con full-state al reconectar y awareness para cursores. Estado persistido en
  `note_ydoc_state` (bytea) via `PUT /notes/:id/ydoc`.
- API: `apps/api/src/routes/notes/` -> `index.js` (router Hono con
  `internal.use('*', authMiddleware)`), `notes-service.js`, `folders-service.js`,
  `tags-service.js`, `shares-service.js`, `ydoc-service.js`.
- Ruta publica: `GET /public/notes/:slug` registrada en `apps/api/src/index.js`
  ANTES del auth middleware. Devuelve solo campos de render, nunca ids internos
  salvo `notes.id`. `PublicNoteScreen.jsx` renderiza `<NoteEditor readOnly>` de un
  snapshot estatico (sin realtime).
- Permisos: `notes.notes.{read,create,update,delete}`, `notes.folders.*`,
  `notes.tags.*`, `notes.shares.*`. Definidos en `permission-catalog.js` y
  sembrados.
- Subida de imagenes de notas: `POST /notes/presign-image` -> bucket publico
  `atlas-notes`, con check de edicion.
- Rutas de pantalla: `apps/desktop/src/app/ModuleOutlet.jsx` (SCREEN_MAP
  `atlas.notes:/...`), publico en `apps/desktop/src/app/AppEntry.jsx`
  (`/app/p/notes/:slug`).

## 3. Modelo de datos

### 3.1 `notes` — columna nueva

```sql
ALTER TABLE notes
  ADD COLUMN note_type TEXT NOT NULL DEFAULT 'document';
ALTER TABLE notes
  ADD CONSTRAINT chk_notes_note_type CHECK (note_type IN ('document', 'canvas'));
```

Filas existentes -> `'document'` por el DEFAULT. `createNote` escribe el valor;
`getNote` y `listNotes` lo seleccionan (ya hacen `SELECT n.*` / `a.*`, pero
`listNotes` tiene un `GROUP BY` explicito por columna: hay que anadir
`a.note_type` a esa lista).

### 3.2 Tabla nueva `note_canvas_scene`

```sql
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
```

- `elements`: `ExcalidrawElement[]` completo, incluye tombstones `isDeleted:true`
  hasta que una compactacion futura los quite (fuera de alcance v1). Cada elemento
  lleva `customData.layerId: string`.
- `app_state`: subconjunto en **lista blanca** guardado por el server:
  `gridModeEnabled`, `gridSize`, `snapToGrid` (o `objectsSnapModeEnabled` segun la
  version de Excalidraw), `viewBackgroundColor`. Se descartan explicitamente
  `scrollX`, `scrollY`, `zoom`, `collaborators`, `selectedElementIds`, y cualquier
  otra clave. El implementador fija la lista exacta contra la version pineada de
  Excalidraw.
- `layers`: `[{ id: string, name: string, visible: boolean, locked: boolean,
  opacity: number (0..1), order: number }]`. `order` ascendente = de atras hacia
  adelante.
- `files`: manifiesto de imagenes `{ [fileId]: { mimeType, storageKey, url,
  created } }`. **Sin `dataURL`**.
- `version`: +1 en cada guardado (concurrencia optimista y cache-bust del enlace
  publico, mismo patron que `note_ydoc_state.version`).

## 4. Modelo de capas

Excalidraw tiene z-order plano (orden del array `elements`) y no tiene capas. Se
simula asi:

- **Fuente de verdad en cliente:** la lista COMPLETA de elementos vive en un `ref`
  dentro de `CanvasEditor`. A `<Excalidraw>` se le pasa siempre una **escena
  derivada**.
- `customData.layerId` asocia cada elemento a una capa. `customData` es el punto
  de extension oficial de Excalidraw y round-trips por `updateScene`, export e
  import.
- `deriveScene(elements, layers)` produce la escena visible:
  - capa con `visible:false` -> sus elementos se **omiten** de la escena derivada
    (siguen en el ref y se persisten).
  - capa con `locked:true` -> `locked:true` en sus elementos en la escena
    derivada.
  - `opacity` de capa -> se multiplica en `element.opacity` en la escena derivada.
  - orden: elementos ordenados por `layers[].order` de su capa, luego por su orden
    dentro del `ref`. Ese es el z-order global.
- Elementos nuevos (creados en `<Excalidraw>` sin `layerId`) se asignan a la capa
  **activa** en el momento del `onChange`.
- Todo lienzo nace con una capa `"Capa 1"` (`visible:true, locked:false,
  opacity:1, order:0`).
- Operaciones del panel: crear, renombrar, eliminar (con confirmacion si tiene
  elementos -> `ConfirmDialog`), duplicar (clona capa + clona sus elementos con
  nuevos ids), combinar hacia abajo (`mergeDown`: reasigna `layerId` de la capa a
  la de debajo y borra la capa), reordenar (drag), toggle visible, toggle
  bloqueada, slider de opacidad.
- Helpers puros en `lib/canvasLayers.js`: `deriveScene`, `assignLayer`,
  `reorderLayer`, `mergeDown`, `duplicateLayer`, `globalZOrder`,
  `defaultLayer()`. Con tests `node:test`.

## 5. Sincronizacion en tiempo real

### 5.1 `lib/SupabaseCanvasSync.js`

Clase modelada sobre `SupabaseYjsProvider` pero nativa de Excalidraw. Misma
disciplina de ciclo de vida: `_destroyed` flag, teardown que hace
`removeChannel`, dropea canal stale antes de suscribir, no emite hasta
`state === 'joined'`.

- Constructor: `new SupabaseCanvasSync({ noteId, supabase, atlas, token, readOnly,
  onRemoteScene, onRemotePointer, onStatus, onPresence })`.
- Canal: `supabase.channel('note:canvas:' + noteId, { config: { broadcast: {
  self: false, ack: false }, presence: { key: <userId|anonId> } } })`.
- **Presence** para la lista de participantes (avatares). Cursores remotos van por
  el evento `pointer`, no por presence.

Eventos broadcast:

| evento | payload | quien emite |
|---|---|---|
| `scene.delta` | `{ elements: ChangedEl[], layers?, appState?, senderId }` | editores, con throttle trailing ~200ms, cuando `diffElements` detecta `version` mayor que el ultimo map enviado |
| `scene.full` | `{ elements, layers, appState, files, senderId }` | un peer al recibir `scene.request`; y quien tenga `version` mas alto al `SUBSCRIBED` |
| `scene.request` | `{ senderId }` (inerte) | cualquiera al conectar; **tambien visitantes publicos** |
| `pointer` | `{ x, y, selectedElementIds, senderId }` | editores en `onPointerUpdate`, throttle ~50ms |

- **Modo `readOnly`** (vista publica): jamas emite `scene.delta` ni `pointer`;
  solo `scene.request` (inerte) y aplica lo entrante.
- Aplicar entrante: `reconcileElements(refElements, incoming, localAppState)`
  (import de `@excalidraw/excalidraw`) -> actualiza el `ref` -> callback
  `onRemoteScene` que hace `excalidrawAPI.updateScene({ elements:
  deriveScene(ref, layers) })`. Idempotente: `reconcileElements` ignora entrantes
  con `version` menor o igual.
- Partes puras extraidas a `lib/canvasSync.js`: `diffElements(prevMap,
  nextElements) -> { changed, nextMap }`, `mergeDelta(refElements, deltaElements)
  -> reconciled`, `throttle`. Con tests `node:test` (deteccion de subida de
  `version`, no-op si igual, `mergeDelta` idempotente, `readOnly` nunca emite).

### 5.2 Persistencia

- El cliente que **produce** un cambio local agenda un guardado debounced 1.5s
  (`AUTOSAVE_DELAY`, igual que notas) + flush en unmount.
- `PUT /notes/:id/canvas` con la escena completa reconciliada `{ elements,
  appState (subset), layers, files }`. El server sube `version`, valida y
  responde `{ ok, version }`.
- No todos los clientes escriben: solo quien hizo el cambio. Si dos hacen cambios
  casi a la vez, ambos escriben; `reconcileElements` en la lectura siguiente
  converge y `version` refleja el ultimo.

## 6. API

### 6.1 `apps/api/src/routes/notes/canvas-service.js` (nuevo)

`createCanvasService({ prisma })`, todas las funciones declaradas dentro del
factory. Errores con clase `CanvasServiceError` (patron de los otros servicios).

- `getScene(noteId, userId)`:
  - check de lectura reutilizando el patron de `ydoc-service.getState` (owner o
    fila en `note_shares`).
  - si no hay fila en `note_canvas_scene`: devuelve
    `{ elements: [], appState: {}, layers: [defaultLayer], files: {}, version: 0 }`.
  - si hay: `{ elements, appState, layers, files, version }`.
- `saveScene(noteId, userId, { elements, appState, layers, files })`:
  - check de edicion (owner o `note_shares.permission = 'edit'`).
  - valida que `elements` es array y `JSON.stringify(scene).length` <= 10 MiB;
    si no, `CanvasServiceError(..., 413)`.
  - lista blanca de `appState` (seccion 3.2).
  - `INSERT INTO note_canvas_scene (...) VALUES (...) ON CONFLICT (note_id)
    DO UPDATE SET elements = EXCLUDED.elements, app_state = EXCLUDED.app_state,
    layers = EXCLUDED.layers, files = EXCLUDED.files,
    version = note_canvas_scene.version + 1, updated_at = now(),
    updated_by = ${userId}`.
  - actualiza `notes.content_text` con el texto concatenado de los elementos de
    tipo `text` (`.text`), y `notes.updated_at = now()`, para que el lienzo sea
    buscable en `listNotes`.
  - devuelve `{ ok: true, version }`.
- `getPublicScene(slug)`:
  - sin auth. Join `note_canvas_scene` con `notes` por `public_slug` +
    `is_public = true` + `deleted_at IS NULL` + `is_trashed = false` +
    `note_type = 'canvas'`.
  - devuelve solo `{ noteId: notes.id, title, icon, elements, appState, layers,
    files, version }`. Nunca `company_id`, `owner_user_id`, `folder_id`.
  - 404 si no existe o no es publico.

### 6.2 Rutas en `apps/api/src/routes/notes/index.js`

Anadir tras el bloque Y.js:

```js
internal.get('/:id/canvas', requirePermission('notes.notes.read'), ...)   // getScene
internal.put('/:id/canvas', requirePermission('notes.notes.update'), ...)  // saveScene
```

`POST /notes` (`internal.post('/')`) acepta `noteType` en el body y lo pasa a
`notes.createNote`.

Imagenes: sin cambios, el cliente del lienzo llama a `POST /notes/presign-image`
tal cual (ya acepta `noteId` real y valida edicion).

### 6.3 Ruta publica en `apps/api/src/index.js`

Anadir **una sola** ruta GET **inmediatamente despues** de la
`app.get("/public/notes/:slug", ...)` existente (linea ~886), sin reordenar ni
tocar ninguna otra ruta ni el guard raiz:

```js
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

con `const _publicNotesCanvas = createCanvasService({ prisma });` junto a
`_publicNotesShares`. **Requiere revision manual de Raul** por la memoria "public
route ordering is sacred".

### 6.4 Realtime publico solo-lectura

El canal `note:canvas:<noteId>` es broadcast puro (no RLS de tabla). La pagina
publica se conecta con el cliente anon de Supabase ya disponible en el front,
usando el `noteId` real que devuelve `getPublicScene`, se suscribe a
`scene.delta` / `scene.full`, emite solo `scene.request` (inerte) y nunca
`scene.delta`/`pointer` (garantizado por `readOnly: true` en `SupabaseCanvasSync`).
Si no hay editores conectados, el visitante ve el snapshot REST; cualquier edicion
posterior re-difunde los elementos cambiados.

### 6.5 `packages/validators`

- Schema de creacion de nota: anadir `noteType: z.enum(['document','canvas'])
  .optional().default('document')`.
- Schema nuevo `canvasSceneSchema`: `elements` array, `appState` record,
  `layers` array de `{ id, name, visible, locked, opacity, order }`, `files`
  record. Validacion laxa en tipos internos de elemento (Excalidraw es la
  autoridad); el server hace la lista blanca de `appState` y el tope de tamano.

### 6.6 Tests API

`apps/api/src/routes/notes/__tests__/canvas-service.test.js` (`node:test`):

- acceso: owner puede get+save; share `edit` puede get+save; share `read` puede
  get, save da 403; sin acceso da 404 en get.
- `saveScene` aplica lista blanca de `appState` (una clave no permitida no se
  persiste).
- `saveScene` rechaza escena > 10 MiB con 413.
- `saveScene` sube `version` en cada llamada.
- `getPublicScene` no incluye `company_id` / `owner_user_id` / `folder_id`; 404
  si `is_public = false`.

Usar dobles de `prisma` con `$queryRaw`/`$executeRaw` fake como en
`notes-access.test.js`.

## 7. Frontend

### 7.1 Dependencia

`@excalidraw/excalidraw` en `apps/desktop/package.json`, **version exacta
pineada**. Import de CSS requerido. Carga **lazy** (`React.lazy` +
`<Suspense>`), solo al montar un lienzo, para no inflar el bundle principal.
Smoke test de que `reconcileElements`, `exportToBlob`, `exportToSvg` se importan
(export semi-interno; si una version los mueve, salta en el test).

### 7.2 Archivos nuevos en `apps/desktop/src/modules/atlas.notes/`

- `components/CanvasEditor.jsx` — raiz cuando `note.note_type === 'canvas'`.
  - `ref` con la lista completa de elementos (fuente de verdad).
  - estado `layers`, `files`, `activeLayerId`, `showLayersPanel`.
  - `excalidrawAPI` ref; `<Excalidraw>` lazy.
  - `SupabaseCanvasSync` creado en `useEffect` keyed por `note.id` + `token`,
    teardown en unmount (patron del `engine` de `NoteEditor`).
  - carga inicial: `GET /notes/:id/canvas` -> siembra ref/layers/files/appState;
    hidrata `files` de Excalidraw bajando cada `url` -> dataURL en memoria.
  - `onChange(elements, appState)`: `diffElements` -> si hay cambios, actualiza
    ref, asigna `layerId` a los nuevos, agenda persist debounced,
    `sync.broadcastDelta(changed)`.
  - `onPointerUpdate`: `sync.broadcastPointer(...)`.
  - `onRemoteScene`: `excalidrawAPI.updateScene({ elements: deriveScene(...) })`.
  - `onRemotePointer`: `excalidrawAPI.updateScene({ collaborators: map })`.
  - toggles grid/snap -> mutan `appState` local + persist.
  - header: botones PNG / SVG (`lib/canvasExport.js`), toggle "Capas".
- `components/CanvasLayersPanel.jsx` — panel estilo Illustrator.
  - escritorio: rail derecho (se muestra segun `showLayersPanel`, toggle en el
    header de `NotesScreen` junto a "Ajustes").
  - movil: `Sheet` inferior de `@atlas/ui`, filas de 44px minimo.
  - fila: handle de arrastre (reordenar, reusa `lib/dragReorder.js`), nombre
    editable (`TextField`), toggle ojo, toggle candado, slider de opacidad,
    `DropdownMenu` (duplicar / combinar hacia abajo / eliminar). Boton
    "Nueva capa". `ConfirmDialog` para eliminar capa con contenido.
  - solo primitivos `@atlas/ui`.
- `PublicCanvasView.jsx` — vista publica en vivo solo lectura.
  - `GET /public/notes/:slug/canvas` -> snapshot.
  - `<Excalidraw viewModeEnabled />` sembrado del snapshot; `files` hidratados.
  - `SupabaseCanvasSync({ readOnly: true, noteId: scene.noteId })` -> aplica
    `scene.delta`/`scene.full`; nunca emite.
  - tema claro forzado (ya lo hace `PublicNoteScreen`), pan/zoom si, sin panel de
    capas, sin toolbar de edicion (viewMode lo oculta).
- `lib/SupabaseCanvasSync.js` (+ `lib/canvasSync.js` puro + tests).
- `lib/canvasLayers.js` (+ tests).
- `lib/canvasExport.js` — `exportPng(scene)`, `exportSvg(scene)`: usan
  `exportToBlob` / `exportToSvg`, descargan por Blob URL + `<a download>` (app
  desktop, las descargas funcionan). Nombre `"<title>.png"`.
- `hooks/useCanvasScene.js` — TanStack Query: `useCanvasScene(noteId)` (GET),
  `useSaveCanvasScene()` (PUT, debounced desde el componente). `usePublicCanvasScene(slug)`.

### 7.3 Ediciones

- `NotesScreen.jsx`:
  - boton "Nueva" -> `DropdownMenu` de `@atlas/ui` con "Documento" y "Lienzo".
    `handleCreateNote(noteType)` -> `createNote.mutate({ title, content: '',
    noteType })`.
  - Panel 2: si `selectedNote.note_type === 'canvas'` renderiza `<CanvasEditor>`
    (en `<Suspense>`), si no `<NoteEditor>`. `NoteSettingsPanel` y
    `NoteShareModal` sin cambios (el lienzo es una nota).
  - header: para canvas, boton "Capas" (toggle) ademas de "Ajustes".
- `PublicNoteScreen.jsx`: branch por `note.note_type`; `'canvas'` ->
  `<PublicCanvasView slug={slug} />` (en `<Suspense>`). Documenta que esta pagina
  ahora tiene dos modos.
- `components/NotesList.jsx` / `components/NoteCard.jsx` / `noteIcons.jsx`: icono
  distinto para lienzos (lucide `Shapes`), y en `NoteCard` un badge "Lienzo".
- `hooks/useNotes.js`: `useCreateNote` pasa `noteType`; `buildQueryParams` sin
  cambios.
- `hooks/useNote.js`: sin cambios (ya trae `note.*`).

### 7.4 `packages/sdk`

Cliente `notes`: anadir `getCanvas(noteId, token)`, `saveCanvas(noteId, scene,
token)`, `getPublicCanvas(slug)`.

## 8. Imagenes

- Al pegar/soltar una imagen, Excalidraw emite `onChange` con una entrada nueva en
  `files` con `dataURL`. `CanvasEditor` detecta las entradas nuevas:
  1. sube los bytes con `POST /notes/presign-image` (`noteId` real) -> `PUT` a la
     signed URL -> `publicUrl`.
  2. guarda `{ storageKey, url, mimeType, created }` en el manifiesto `files`
     local (que se persiste). Mantiene el `dataURL` en memoria de Excalidraw para
     render inmediato.
- Al cargar (editor y publico): por cada `files[id]` con `url` y sin `dataURL`, se
  hace `fetch(url)` -> blob -> dataURL y se pasa a `excalidrawAPI.addFiles(...)`
  antes de `updateScene`. Bucket `atlas-notes` es publico, sin firmar.
- Guardia cliente: rechazar imagenes > 10 MB con toast.
- La escena persistida en `note_canvas_scene.files` nunca lleva `dataURL`.

## 9. Export / cuadricula / snap

- Export: botones PNG y SVG en el header (escritorio) y en overflow (movil).
  `exportToBlob({ elements: visibles, appState, files, mimeType: 'image/png' })`
  y `exportToSvg(...)`. Descarga inmediata.
- Grid/snap: toggles que fijan `appState.gridModeEnabled` y `appState.snapToGrid`
  (o el nombre equivalente de la version pineada). Persistidos en `app_state`
  (lista blanca). Aplicados al cargar via `initialData.appState`.

## 10. Movil

- Barra de herramientas nativa de Excalidraw (formas, texto, dibujo, zoom, undo).
- Anadido propio: boton "Capas" -> `CanvasLayersPanel` en `Sheet` inferior de
  `@atlas/ui`, filas de 44px, drag para reordenar.
- El toggle `mobileView` list/editor de `NotesScreen` ya funciona.
- QA obligatorio a 390px y 1440px + checklist de 14 aspectos
  (`docs/ai-context/ui-screen-audit-checklist.md`).

## 11. Tests

### API (`node:test`)

- `apps/api/src/routes/notes/__tests__/canvas-service.test.js` (seccion 6.6).

### Desktop (`node:test`)

- `apps/desktop/src/modules/atlas.notes/lib/__tests__/canvas-layers.test.js`:
  `deriveScene` (capa oculta omitida, capa bloqueada -> `locked`, opacidad
  multiplicada), `reorderLayer` cambia el z-order global, `assignLayer`,
  `mergeDown` reasigna `layerId` y borra la capa, `duplicateLayer` clona con
  ids nuevos, `defaultLayer`.
- `apps/desktop/src/modules/atlas.notes/lib/__tests__/canvas-sync.test.js`:
  `diffElements` detecta subida de `version` y es no-op si igual; `mergeDelta`
  idempotente; en `readOnly` los metodos de emision no llaman a `channel.send`.
- Smoke: `reconcileElements` / `exportToBlob` / `exportToSvg` importables desde
  `@excalidraw/excalidraw`.

### Manual / live smoke

- Dos navegadores autenticados editando el mismo lienzo: formas, texto, dibujo,
  imagenes, capas, reordenar, ocultar/bloquear convergen.
- Enlace publico abierto en un tercer navegador (sin sesion): ve los cambios en
  vivo, no puede editar, pan/zoom funciona.
- Movil 390px: crear formas, abrir panel de capas en sheet, reordenar.
- Recargar: la escena persiste (elements, capas, grid, imagenes).
- Build Tauri: confirma que el bundle con Excalidraw compila y arranca.

## 12. Fuera de alcance (v1)

- Cache offline en Tauri/SQLite para el lienzo.
- Sub-capas anidadas / arbol de elementos individuales dentro del panel.
- Presencia o cursores de visitantes anonimos en el enlace publico.
- Frames, libraries, embeds, laser pointer de Excalidraw.
- Convertir una nota documento <-> lienzo.
- Comentarios sobre el lienzo.
- Compactacion de tombstones `isDeleted` en `elements`.

## 13. Riesgos y mitigaciones

| riesgo | mitigacion |
|---|---|
| Peso del bundle de `@excalidraw/excalidraw` | carga lazy; confirmar build Tauri en el smoke |
| `reconcileElements` es export semi-interno | version exacta pineada + smoke test de import |
| El sistema de capas pelea con el z-order plano de Excalidraw | escena derivada + `ref` como fuente de verdad; nunca se confia en el array que devuelve Excalidraw como estado canonico |
| Tormentas de persistencia con muchos editores | debounce 1.5s + "solo persiste quien hizo el cambio" |
| Ventana entre snapshot REST y primer delta en un late joiner | `scene.request` al conectar + `scene.full` del peer con `version` mas alto |
| Divergencia si un editor esta offline y vuelve | `reconcileElements` por `version` al recibir `scene.full` en `SUBSCRIBED` |
| Colocacion de la ruta publica nueva | una sola GET tras la existente, sin reordenar; revision manual de Raul |

## 14. Division del plan

Por tamano (backend + frontend, > 10 tareas), se divide en:

- **Plan A — API y datos:** migracion (`notes.note_type` + `note_canvas_scene`),
  `canvas-service.js`, rutas en `routes/notes/index.js`, ruta publica en
  `index.js`, `noteType` en `createNote` / `listNotes` / validators, cliente SDK,
  tests API. Verified: 2026-09-10 (node:test 28/28 + DB smoke: note_type persist,
  version bump, appState whitelist, content_text extraction; both public routes
  return 404 not 401).
- **Plan B — Desktop:** dependencia Excalidraw, `CanvasEditor.jsx`,
  `SupabaseCanvasSync.js` + `canvasSync.js`, `canvasLayers.js`,
  `CanvasLayersPanel.jsx`, `canvasExport.js`, `hooks/useCanvasScene.js`,
  `PublicCanvasView.jsx`, ediciones de `NotesScreen` / `PublicNoteScreen` /
  `NotesList` / `NoteCard` / `noteIcons` / `useNotes`, imagenes, export, grid,
  movil, tests desktop, QA responsive.
  Code-complete: 2026-09-10 (node:test desktop 66/66; `@excalidraw/excalidraw`
  0.18.1 pineado y 100% lazy — sin referencias en los chunks de entrada;
  `pnpm build` completo incluida la compilacion Tauri + instaladores; eslint
  limpio). PENDIENTE de QA interactiva (Task 13 pasos 1-5 del plan): edicion
  entre dos navegadores, capas, grid/export, enlace publico en vivo, tactil a
  390px y 1440px. Realtime broadcast/presence y el binding a Excalidraw
  (`reconcileElements`) no se pueden ejercitar sin navegador.

Plan B depende de Plan A.

## 15. Decisiones de implementacion (2026-09-10)

- Motor de sync: opcion B (broadcast de deltas de Excalidraw + `reconcileElements`,
  sin Yjs), confirmada por el usuario.
- Reorden de capas: `SortableList` de `@atlas/ui` (dnd-kit, pointer sensor -> ok
  tactil) en vez de HTML5 drag hand-rolled.
- El smoke de imports de Excalidraw es estatico (parsea el `.d.ts` publico): el
  bundle prod de Excalidraw usa resolucion solo-bundler (import de `roughjs` sin
  extension) y `await import()` falla bajo Node puro aunque Vite lo resuelve.
- `getPublicNote` (shares-service) ahora tambien devuelve `note_type` para que
  `PublicNoteScreen` pueda ramificar.
- La vista de papelera sigue mostrando `NoteEditor` de solo lectura para notas
  lienzo (no hay modo papelera de `CanvasEditor` en v1).
