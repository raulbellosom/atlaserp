# Diseño — Identidad visual de tipos de archivo + más formatos Office (CSV / binarios heredados)

- **Fecha:** 2026-09-08
- **Módulo:** `atlas.files`
- **Estado:** Diseño aprobado (pendiente revisión de spec por el usuario)
- **Autor:** Claude (brainstorming con Raul)

## 1. Problema

En el módulo de archivos rediseñado:

1. **Los tipos de documento no se identifican en la tabla ni en las tarjetas.** El icono
   ([`FileVisual.jsx`](../../../apps/desktop/src/modules/atlas.files/components/FileVisual.jsx))
   se pinta gris para todo y no existe icono propio para `presentation`, `video`, `audio`.
   El subtítulo de algunas vistas muestra el `mimeType` crudo
   (`application/vnd.openxmlformats-officedocument…`). La única parte con color por tipo
   (azul Word `#185abd`, verde Excel `#107c41`, rojo PPT `#b7472a`, con variantes dark) es la
   tira "Nuevo documento" de
   [`FilesWorkspaceHeader.jsx`](../../../apps/desktop/src/modules/atlas.files/components/FilesWorkspaceHeader.jsx)
   vía [`FilesWorkspace.css`](../../../apps/desktop/src/modules/atlas.files/components/FilesWorkspace.css).

2. **CSV no se reconoce de forma fiable.** [`getFileKind()`](../../../apps/desktop/src/modules/atlas.files/lib/file-kind.js)
   solo mira `mimeType`; un CSV subido como `text/plain` o `application/octet-stream` no se
   clasifica. Además CSV se pliega dentro de `sheet`, así que no se puede filtrar por "CSV".

3. **CSV y los binarios heredados de Office no abren en el editor.**
   [`getOfficeFormat()`](../../../packages/core/src/office-formats.js) solo acepta
   `docx` / `xlsx` / `pptx` y solo con coincidencia exacta de `mimeType`. `.csv`, `.xls`,
   `.doc`, `.ppt` caen al visor genérico ("No hay vista previa disponible"). Collabora Online
   (CODE) sí puede abrir y editar esos formatos vía WOPI, pero la validación del backend
   ([`validate-document.js`](../../../apps/api/src/services/office/validate-document.js)) es
   exclusivamente OOXML/ZIP.

## 2. Objetivos

- Identificar el tipo de cada archivo de un vistazo en **las tres vistas** (tabla, tarjetas,
  cuadrícula) con icono + color coherentes con la tira "Nuevo documento", más una columna
  **"Tipo"** con badge coloreado en la tabla.
- Reconocer CSV de forma robusta (por extensión cuando el mime es genérico) y hacerlo
  filtrable como tipo propio.
- Permitir **abrir y editar en Collabora**: `csv`, `xls`, `doc`, `ppt` (además de los
  `docx` / `xlsx` / `pptx` actuales). **OpenDocument (`.ods` / `.odt` / `.odp`) queda fuera
  de alcance.**

## 3. No-objetivos (YAGNI)

- Creación de CSV / binarios en blanco desde el menú "Nuevo" (sigue solo `docx`/`xlsx`/`pptx`).
- Soporte OpenDocument.
- Editor CSV in-app propio: se usa Collabora.
- Cambiar el pipeline de subida más allá de añadir `application/vnd.ms-powerpoint` a la
  allowlist.
- Saneado de fórmulas CSV al guardar (la inyección de fórmulas es un problema de
  consumo/exportación; se documenta como riesgo residual, no se implementa aquí).

## 4. Arquitectura

Tres capas. El spec es un documento; **la implementación se divide en Plan A (core +
backend Office) y Plan B (UI)** por la regla "backend + frontend se separan".

```
@atlas/core  ──────────────►  apps/api (Office backend, query)   [Plan A]
     │                              │
     └──────────────────────────────┴────────►  apps/desktop (UI)  [Plan B]
```

### 4.1 Capa compartida — `@atlas/core`

**Fuente de verdad única de tipos.** Nueva tabla en
[`packages/core/src/file-kinds.js`](../../../packages/core/src/file-kinds.js) (archivo nuevo):

```js
export const FILE_KINDS = {
  image:        { label: "Imagen",           accent: "#0d9488", mimePrefixes: ["image/"], extensions: [] },
  video:        { label: "Video",            accent: "#7c3aed", mimePrefixes: ["video/"], extensions: [] },
  audio:        { label: "Audio",            accent: "#db2777", mimePrefixes: ["audio/"], extensions: [] },
  pdf:          { label: "PDF",              accent: "#dc2626", mimeTypes: ["application/pdf"], extensions: ["pdf"] },
  doc:          { label: "Documento",        accent: "#185abd",
                  mimeTypes: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/msword"],
                  mimePrefixes: [], extensions: ["docx", "doc"] },
  sheet:        { label: "Hoja de cálculo",  accent: "#107c41",
                  mimeTypes: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.ms-excel"],
                  extensions: ["xlsx", "xls"] },
  csv:          { label: "CSV",              accent: "#0f7b6c",
                  mimeTypes: ["text/csv", "application/csv"],
                  extensions: ["csv", "tsv"] },
  presentation: { label: "Presentación",     accent: "#b7472a",
                  mimeTypes: ["application/vnd.openxmlformats-officedocument.presentationml.presentation", "application/vnd.ms-powerpoint"],
                  extensions: ["pptx", "ppt"] },
  archive:      { label: "Comprimido",       accent: "#a16207",
                  mimeTypes: ["application/zip", "application/x-7z-compressed", "application/x-rar-compressed", "application/gzip", "application/x-tar"],
                  extensions: ["zip", "7z", "rar", "gz", "tar"] },
  text:         { label: "Texto",            accent: "#475569",
                  mimeTypes: ["application/json"], mimePrefixes: ["text/"],
                  extensions: ["txt", "md", "log", "json"] },
  generic:      { label: "Archivo",          accent: "#64748b" },
};

export const FILE_KIND_ACCENTS_DARK = {
  doc: "#6aa5f8", sheet: "#57c78e", csv: "#5bbfae", presentation: "#f69d82",
  // resto: derivado por color-mix en el consumidor
};
```

Reglas de precedencia en `fileKindOf` (abajo): `csv` **antes** que `sheet` y que `text`;
`text` **excluye** `csv`/`tsv` (igual que hoy `text` excluye `text/csv`). El orden de
evaluación se fija en el helper, no depende del orden del objeto.

**Helpers nuevos en `file-kinds.js`:**

| Helper | Firma | Uso |
|---|---|---|
| `fileKindOf(file)` | `({ originalName?, fileName?, mimeType? }) → kind` | cliente. Intenta match por `mimeType` exacto → por `mimePrefix` → **fallback por extensión** de `originalName`. `csv`/`tsv` por extensión ganan aunque el mime sea `text/plain`, `application/vnd.ms-excel` o vacío. |
| `fileKindLabel(kind)` | `(kind) → string` | etiqueta ES. |
| `fileKindAccent(kind, { dark })` | `(kind, opts) → hex` | color base. |
| `fileKindWhereClauses()` | `() → { [kind]: PrismaWhere }` | servidor. Construye las cláusulas `where` de Prisma desde `FILE_KINDS` (mimeTypes + mimePrefixes → `startsWith` / igualdad). **No** usa extensión (la BD no guarda extensión aparte; el nombre sí, pero se mantiene el criterio mime-only actual del servidor para no cambiar el conjunto resultante salvo el añadido de `csv`). |

[`packages/core/src/index.js`](../../../packages/core/src/index.js) re-exporta lo nuevo.

**Migración de los consumidores actuales de `@atlas/core`:**

- `getFileKind(mimeType)` en
  [`apps/desktop/src/modules/atlas.files/lib/file-kind.js`](../../../apps/desktop/src/modules/atlas.files/lib/file-kind.js)
  pasa a delegar en `fileKindOf` (recibe el `file` completo, no solo el mime). Se actualizan
  las llamadas (`FileVisual`, `FilesWorkspaceTable`, `FilesCardView`, `FilesGridView`,
  `AdvancedFileViewer`, `useFilesExplorer`) para pasar `file` en vez de `file.mimeType`.
- [`apps/api/src/services/files/query.js`](../../../apps/api/src/services/files/query.js)
  `fileKindWhere` pasa a leer de `fileKindWhereClauses()` y gana la clave `csv`. `sheet`
  deja de incluir `text/csv`; `text` sigue excluyendo `text/csv`.

### 4.2 `getOfficeFormat` reescrito — `@atlas/core`

[`packages/core/src/office-formats.js`](../../../packages/core/src/office-formats.js).
`OFFICE_FORMATS` gana `xls`, `doc`, `ppt`, `csv`, cada entrada con discriminador `kind`:

```js
export const OFFICE_FORMATS = Object.freeze({
  // OOXML — validación ZIP (sin cambios de criterio)
  docx: { kind: "ooxml", extension: "docx", label: "Documento",
          mimeTypes: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
          part: "word/document.xml",
          contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml" },
  xlsx: { kind: "ooxml", extension: "xlsx", label: "Hoja de cálculo",
          mimeTypes: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
          part: "xl/workbook.xml",
          contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml" },
  pptx: { kind: "ooxml", extension: "pptx", label: "Presentación",
          mimeTypes: ["application/vnd.openxmlformats-officedocument.presentationml.presentation"],
          part: "ppt/presentation.xml",
          contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml" },
  // Binario heredado — validación magic CFBF/OLE2
  doc:  { kind: "binary", extension: "doc", label: "Documento",
          mimeTypes: ["application/msword"] },
  xls:  { kind: "binary", extension: "xls", label: "Hoja de cálculo",
          mimeTypes: ["application/vnd.ms-excel"] },
  ppt:  { kind: "binary", extension: "ppt", label: "Presentación",
          mimeTypes: ["application/vnd.ms-powerpoint"] },
  // Texto — validación UTF-8
  csv:  { kind: "text", extension: "csv", label: "CSV",
          mimeTypes: ["text/csv", "application/csv", "application/vnd.ms-excel", "text/plain"],
          acceptEmptyMime: true },
});
```

`getOfficeFormat(file)`:

1. Deriva `extension` del nombre (`originalName ?? fileName`). Rechaza si el nombre contiene
   `/ \ \x00-\x1f` (igual que hoy).
2. `format = OFFICE_FORMATS[extension]`; si no hay → `null`.
3. **Coincidencia de mime:**
   - `kind === "ooxml"` o `"binary"` → exige `file.mimeType ∈ format.mimeTypes` (el navegador
     reporta estos de forma fiable). Sin coincidencia → `null`.
   - `kind === "text"` (csv) → acepta si `file.mimeType ∈ format.mimeTypes`, o si el mime es
     vacío / `application/octet-stream` y `format.acceptEmptyMime`. **Rechaza explícitamente**
     cualquier otro mime concreto (`application/pdf`, `image/*`, `video/*`, …). Este es el
     único punto donde se relaja el criterio y se hace con allowlist, no con "cualquier cosa".
4. Devuelve `{ extension, kind, label, mimeType: file.mimeType, part?, contentType? }`.

### 4.3 Backend Office — Plan A

**`validateOfficeDocument(bytes, format)`** en
[`validate-document.js`](../../../apps/api/src/services/office/validate-document.js) despacha
por `format.kind`:

| `format.kind` | Ruta | Detalle |
|---|---|---|
| `ooxml` | Actual (yauzl) | Sin cambios. Ya rechaza `vbaProject.bin`, zip-bombs, entradas duplicadas, cifrado (bit 1). |
| `binary` | **Nueva** `validateBinaryOfficeDocument(bytes, format)` | Primeros 8 bytes `== D0 CF 11 E0 A1 B1 1A E1` (magic CFBF/OLE2); `bytes.length` entre 512 B y `config.maxBytes`; opcional: buscar el nombre de stream esperado (`WordDocument` / `Workbook` o `Book` / `PowerPoint Document`) en los primeros 64 KiB como señal de coherencia (best-effort, no bloqueante si no se encuentra en archivos grandes). **Riesgo residual documentado:** un `.doc`/`.xls` con macros VBA pasa la validación; Collabora **no ejecuta macros** por defecto (mitigación operativa, se verifica en QA). |
| `text` | **Nueva** `validateTextDocument(bytes, format)` | `bytes.length` entre 1 B y `config.maxBytes`; UTF-8 válido (`new TextDecoder("utf-8", { fatal: true }).decode` sin lanzar); **sin bytes NUL**; nº de líneas ≤ 1 000 000; longitud de línea máxima ≤ 512 KiB (anti-DoS de parseo). BOM UTF-8 permitido. |

Mensajes de error reusan `OfficeError(..., 415, 'invalid_document')`.

**`readOfficeConfig`** ([`config.js`](../../../apps/api/src/services/office/config.js)):
sin cambios (el `maxBytes` de 10 MB ya aplica a todos los formatos).

**`access.authorize`** ([`access.js`](../../../apps/api/src/services/office/access.js)):
sin cambios de lógica — al usar el nuevo `getOfficeFormat`, `.csv/.xls/.doc/.ppt` obtienen
`format` no nulo y pasan el gate `if (!format || file.bucket !== 'atlas-files' || file.visibility === 'PUBLIC')`.
El tope de 10 MB ya está.

**`service.js`** ([`service.js`](../../../apps/api/src/services/office/service.js)):

- `readFile` / `putFile` ya llaman `validateOfficeDocument(bytes, format)` → heredan el
  despacho.
- `putFile`: `objectKey = office/<company>/<fileId>/<rand>.<format.extension>` — ya usa
  `context.format.extension`, funciona con `csv/xls/doc/ppt`. El `contentType` del `upload`
  se mantiene `context.file.mimeType` (no se reescribe el mime que eligió el usuario; ya está
  validado contra la allowlist en la subida).
- `checkFileInfo`: `BaseFileName = file.originalName` — Collabora keyea el filtro por la
  extensión del `BaseFileName`, que ya termina en `.csv/.xls/.doc/.ppt`. Sin cambios.
- **Formato al guardar:** Collabora, en WOPI `PutFile`, escribe en el **mismo formato** con
  el que abrió (según la extensión del `BaseFileName`) → `.csv` guarda `.csv`, `.doc` guarda
  `.doc`. Sin drift. **Asunción a verificar en QA** con CODE real.

**`discovery.js`** ([`discovery.js`](../../../apps/api/src/services/office/discovery.js)):
sin cambios — `actions.find(a => a.ext === format.extension && a.name === mode)` ya cubre
cualquier `ext` que CODE anuncie (`csv`, `doc`, `xls`, `ppt` vienen en la discovery estándar),
con el fallback a `edit` ya presente.

**`files-service.js`** ([`files-service.js`](../../../apps/api/src/services/files-service.js)):
añadir `"application/vnd.ms-powerpoint"` a `ALLOWED_EXACT_MIME_TYPES` (hoy `.ppt` heredado no
se puede ni subir). El resto ya está permitido (`text/csv`, `application/msword`,
`application/vnd.ms-excel`, prefijo `text/`).

**Menú "Nuevo"** ([`FilesWorkspaceHeader.jsx`](../../../apps/desktop/src/modules/atlas.files/components/FilesWorkspaceHeader.jsx)):
sin cambios. `csv` y binarios heredados son solo "abrir existente".

### 4.4 UI — Plan B

**`@atlas/ui`:** extraer el patrón de chip coloreado por marca. Opción elegida: **prop
`accent` en `Badge`** ([`packages/ui/src/components/Badge.jsx`](../../../packages/ui/src/components/Badge.jsx)) —
`accent="#107c41"` pinta texto/borde/fondo con `color-mix(in srgb, var(--accent) X%, …)`,
auto-adaptado a claro/oscuro (misma técnica que `FilesWorkspace.css`). Si `Badge` no admite
extensión limpia, crear `packages/ui/src/components/TypeBadge.jsx` y exportarlo en
[`packages/ui/src/index.js`](../../../packages/ui/src/index.js). Documentar en
`docs/ai-context/ame3-runtime-capabilities.md`.

**`lib/file-kind.js`**: reduce a una fachada sobre `@atlas/core`:
`getFileKind(file)` → `fileKindOf(file)`; `getKindLabel` → `fileKindLabel`; nuevo
`getKindAccent(kind)` → `fileKindAccent` resolviendo dark por `document.documentElement`
(clase `dark`) o dejando que el consumidor pase `{ dark }`. `formatBytes` / `formatDate`
se quedan.

**`FileVisual.jsx`**:
- `getKindIcon`: añadir `presentation → Presentation`, `video → FileVideo`,
  `audio → FileAudio`, `archive → FileArchive`, `csv → FileSpreadsheet` (o `Table2`),
  `text → FileText`.
- Icono y cuadro coloreados: `style={{ color: accent, background: "color-mix(in srgb, " + accent + " 12%, transparent)" }}`
  en el fallback no-imagen. Las miniaturas de imagen (`previewUrl`) no cambian.

**`FilesWorkspaceTable.jsx`**
([componente](../../../apps/desktop/src/modules/atlas.files/components/FilesWorkspaceTable.jsx)):
- Nueva columna **"Tipo"** entre "Nombre" y "Acceso": `<Badge accent={getKindAccent(kind)}>{getKindLabel(kind)}</Badge>`.
- El subtítulo bajo el nombre ya usa `getKindLabel(getFileKind(...))` → pasa a recibir `f`.
- `enableSorting: false` se mantiene (coherente con el resto).
- CSS: la media query móvil de `FilesWorkspace.css` que oculta columnas 3/4/5 se ajusta al
  nuevo índice (o la columna "Tipo" se marca para ocultarse en móvil, donde el icono
  coloreado ya comunica el tipo).

**`FilesCardView.jsx`**
([componente](../../../apps/desktop/src/modules/atlas.files/components/FilesCardView.jsx)):
sustituir `<p>{file.mimeType}</p>` por `<Badge accent=…>{label}</Badge>`.

**`FilesGridView.jsx`**
([componente](../../../apps/desktop/src/modules/atlas.files/components/FilesGridView.jsx)):
el icono coloreado llega solo vía `FileVisual`; añadir el `<Badge>` junto a la etiqueta
`getKindLabel` existente.

**`FilesToolbar.jsx`**
([componente](../../../apps/desktop/src/modules/atlas.files/components/FilesToolbar.jsx)):
en el filtro `kind` añadir `{ value: "csv", label: "CSV" }` (entre "Hoja" y "Documento").
Reordenar labels a las de `fileKindLabel` para consistencia (`"Hoja de cálculo"` en vez de
`"Hoja"`).

**`useFilesExplorer.js`**
([hook](../../../apps/desktop/src/modules/atlas.files/hooks/useFilesExplorer.js)):
línea ~68 `getFileKind(file.mimeType) !== filters.kind` → `fileKindOf(file) !== filters.kind`
(pasa `file` completo, para que el fallback por extensión aplique también al filtrado
cliente).

**Código muerto:** borrar
[`FilesTableView.jsx`](../../../apps/desktop/src/modules/atlas.files/components/FilesTableView.jsx)
(no se importa en ningún sitio; duplica helpers y confunde).

**`AdvancedFileViewer.jsx`**: sin cambios funcionales. Los archivos Office ahora abren en
Collabora (no en este visor). El icono/etiqueta ya fluyen por `FileVisual` / `getKindLabel`.

## 5. Flujo de datos

### Abrir un `.csv` desde la tabla

```
click en nombre
  → FilesScreen.openViewer(file)
  → getOfficeFormat(file)  [core]  → { kind: "text", extension: "csv", … }   (antes: null)
  → office.open(file.id)
  → POST /files/:id/office/session  → office-service.createSession
       → access.authorize → getOfficeFormat → format.kind "text"
       → provider.createSession → discovery action ext="csv" name="edit"
       → tokens.issue (WOPI)
  → OfficeDocumentEditor monta iframe → Collabora CheckFileInfo → GetFile
       → readFile → validateOfficeDocument(bytes, { kind: "text" }) → validateTextDocument
  → editar → PutFile → validateTextDocument → subir objectKey `.csv` → fileAssetVersion + revision++
```

### Clasificar y pintar un archivo en la lista

```
lista de FileAsset (API, filtrada por fileKindWhereClauses si hay filters.kind)
  → cada fila: kind = fileKindOf({ originalName, mimeType })   [core, con fallback por extensión]
  → FileVisual: icono + color = getKindAccent(kind)
  → columna Tipo / badge: getKindLabel(kind) con accent
```

## 6. Manejo de errores

| Caso | Comportamiento |
|---|---|
| `.csv` con `mimeType: application/pdf` (spoof) | `getOfficeFormat` → `null` → no abre editor, cae al visor genérico. |
| `.csv` no-UTF-8 / con NUL / >10 MB / >1M líneas | `validateTextDocument` lanza `OfficeError 415`; el editor muestra "El contenido no corresponde a un documento Office compatible" y ofrece descargar. |
| `.doc` que no es CFBF (renombrado) | `validateBinaryOfficeDocument` lanza `OfficeError 415`. |
| CODE no anuncia `csv`/`doc` en discovery | `provider.createSession` lanza `OfficeError 415 unsupported_format` (ya existe). |
| Collabora guarda en formato distinto al abierto | No debería ocurrir (keyea por extensión); si ocurre, el `objectKey` conserva la extensión original y el `checksum`/`revision` se actualizan igual. Se cubre en QA. |
| `.ppt` heredado que hoy no se puede subir | Tras añadir el mime a la allowlist, se sube normal. Sin cambio para archivos ya existentes. |
| Filtro `kind=csv` en cliente vs servidor | Ambos derivan de `FILE_KINDS`; el servidor filtra por mime (sin extensión), el cliente además por extensión. Un CSV con mime `text/plain` puede no venir en la página del servidor pero sí clasificarse bien en cliente — se acepta (el servidor mantiene su criterio mime-only actual). |

## 7. Pruebas

**`packages/core` (`node --test`):**
- `fileKindOf`: mime exacto; prefijo; **fallback por extensión** (`x.csv` con `text/plain`,
  `application/octet-stream`, mime vacío → `csv`); `x.tsv` → `csv`; `text` excluye `csv`;
  `presentation`/`video`/`audio`/`archive`; `generic` por defecto.
- `getOfficeFormat`: `docx/xlsx/pptx` como hoy; `xls/doc/ppt` con su mime → `kind` correcto;
  `csv` con cada mime de la lista + mime vacío → `text`; **`x.csv` con `application/pdf` → `null`**;
  `x.exe` → `null`; nombre con `/` o control chars → `null`.
- `fileKindWhereClauses().csv` existe; `sheet` no incluye `text/csv`.

**`apps/api/src/services/__tests__/` (`node --test`):**
- `validateBinaryOfficeDocument`: acepta fixture con magic CFBF; rechaza un ZIP, un PDF, un
  buffer vacío, uno de 3 bytes.
- `validateTextDocument`: acepta CSV UTF-8 (con y sin BOM); rechaza buffer con NUL, secuencia
  UTF-8 inválida, > `maxBytes`, > 1M líneas.
- `office access`: `authorize` sobre fixture `FileAsset` `.csv` (`text/csv`) y `.doc`
  (`application/msword`) → devuelve `format` con el `kind` correcto; `.csv` con
  `visibility: PUBLIC` → `OfficeError 415`.
- `putFile`: `objectKey` termina en `.csv` para un fixture csv (mock de storage).
- `files-workspace.test.js`: `fileKindWhere('csv')` genera el `where` esperado;
  `isAllowedMimeType('application/vnd.ms-powerpoint') === true`.

**Frontend:** si existe `apps/desktop/src/modules/atlas.files/**/__tests__`, añadir test de
`lib/file-kind.js` (delegación + accent). Si no, no se crea infra de test nueva (norma del
repo: Node test runner, sin Vitest).

**QA manual (checklist de 14 aspectos + responsive 390/1440):**
- Tabla/tarjetas/cuadrícula: icono coloreado + badge por tipo para docx, xlsx, xls, csv,
  doc, ppt, pdf, png, mp4, mp3, zip, txt. Modo claro y oscuro.
- Filtro "CSV" devuelve solo CSV; "Hoja de cálculo" no incluye CSV.
- Abrir `.csv`, `.xls`, `.doc`, `.ppt` reales en Collabora; editar, guardar, reabrir, verificar
  que el formato y el contenido se conservan y que `revision` sube.
- Descargar un `.csv` editado y abrirlo en Excel/Calc sin corrupción.
- `.ppt` heredado: subir desde la propia UI de archivos y abrirlo.

## 8. Seguridad

Ruta de backend elegida → **ejecutar `/security-review` antes del merge de Plan A.**

| Amenaza | Mitigación |
|---|---|
| Spoof de mime para colar bytes arbitrarios al editor | `getOfficeFormat` exige mime en allowlist (exacto para ooxml/binary; set cerrado + solo-vacío para csv). `validate*Document` verifica la forma real de los bytes (ZIP OOXML / magic CFBF / UTF-8). |
| `.doc`/`.xls` con macros VBA | OOXML ya rechaza `vbaProject.bin`. CFBF con macros pasa validación pero **CODE no ejecuta macros por defecto**; se verifica en QA y se deja anotado como riesgo residual operativo. |
| Zip-bomb / entradas infladas (OOXML) | Sin cambios: los topes existentes (128 MiB expandido, 10 000 entradas) siguen. |
| DoS de parseo por CSV gigante o líneas enormes | `validateTextDocument`: tope de bytes (10 MB), de líneas (1M) y de longitud de línea (512 KiB). |
| Inyección de fórmulas CSV (`=`, `+`, `-`, `@`, tab/CR iniciales) | **No se sanea al guardar** (rompería CSVs legítimos). Riesgo trasladado al consumidor; documentado. Fuera de alcance. |
| Relajar la allowlist de subida (`.ppt`) | Solo se añade `application/vnd.ms-powerpoint` (tipo concreto, no prefijo). |
| `getOfficeFormat` con `acceptEmptyMime` abriendo un binario disfrazado de `.csv` | `validateTextDocument` rechaza cualquier cosa con NUL o no-UTF-8 → un binario real no pasa. |
| Path traversal por nombre | `getOfficeFormat` sigue rechazando `/ \ \x00-\x1f` en el nombre. |

## 9. Archivos afectados (resumen)

**Plan A — core + backend Office**
- `packages/core/src/file-kinds.js` (nuevo)
- `packages/core/src/office-formats.js`
- `packages/core/src/index.js`
- `apps/api/src/services/office/validate-document.js`
- `apps/api/src/services/files/query.js`
- `apps/api/src/services/files-service.js` (allowlist `.ppt`)
- Tests: `packages/core/src/__tests__/…`, `apps/api/src/services/__tests__/office-*.test.js`,
  `apps/api/src/services/__tests__/files-workspace.test.js`

**Plan B — UI**
- `apps/desktop/src/modules/atlas.files/lib/file-kind.js`
- `apps/desktop/src/modules/atlas.files/components/FileVisual.jsx`
- `apps/desktop/src/modules/atlas.files/components/FilesWorkspaceTable.jsx`
- `apps/desktop/src/modules/atlas.files/components/FilesCardView.jsx`
- `apps/desktop/src/modules/atlas.files/components/FilesGridView.jsx`
- `apps/desktop/src/modules/atlas.files/components/FilesToolbar.jsx`
- `apps/desktop/src/modules/atlas.files/components/FilesWorkspace.css` (índices de columnas móvil)
- `apps/desktop/src/modules/atlas.files/hooks/useFilesExplorer.js`
- `apps/desktop/src/modules/atlas.files/components/FilesTableView.jsx` (borrar)
- `packages/ui/src/components/Badge.jsx` o `TypeBadge.jsx` (nuevo) + `packages/ui/src/index.js`
- `docs/ai-context/ame3-runtime-capabilities.md` (si se añade componente `@atlas/ui`)

## 10. Preguntas abiertas

- ¿`Badge` admite una prop `accent` de forma limpia o conviene un `TypeBadge` nuevo? — se
  resuelve al abrir `Badge.jsx` en Plan B.
- ¿CODE del entorno self-hosted anuncia acciones para `csv`/`doc`/`xls`/`ppt` en
  `/hosting/discovery`? — verificar en QA; si falta alguna, ese formato simplemente no abrirá
  (error 415 controlado) sin romper el resto.
