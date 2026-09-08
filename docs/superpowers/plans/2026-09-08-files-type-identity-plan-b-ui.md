# Plan B — UI: identidad visual de tipos de archivo

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Identificar el tipo de cada archivo de un vistazo en las tres vistas de `atlas.files` (tabla, tarjetas, cuadrícula) con icono + color coherentes con la tira "Nuevo documento", una columna "Tipo" con badge coloreado en la tabla, y un filtro "CSV" propio.

**Architecture:** Nuevo `TypeBadge` en `@atlas/ui` (chip coloreado por `accent` hex). `lib/file-kind.js` pasa a ser una fachada delgada sobre los helpers de `@atlas/core` (Plan A). `FileVisual` gana iconos y color por `kind`. Las tres vistas y el toolbar consumen `fileKindOf`/`fileKindLabel`/`getKindAccent`.

**Tech Stack:** React 18, Tailwind, `@atlas/ui`, `lucide-react`, TanStack Query (sin cambios de datos), Vite.

**Spec:** `docs/superpowers/specs/2026-09-08-files-type-identity-and-more-office-formats-design.md`
**Depende de:** Plan A (necesita `fileKindOf`, `fileKindLabel`, `fileKindAccent`, `getOfficeFormat` con `kind`).

---

## Notas de contexto para quien implementa

- No hay TypeScript. Componentes `.jsx`. Texto de UI en español; código y comentarios en inglés.
- **UI-first:** usar `@atlas/ui` antes que HTML nativo. `Badge` ya existe pero su color es por `variant` semántico (cva), no admite un hex arbitrario — por eso se añade `TypeBadge`.
- El tema oscuro se marca con la clase `.dark` en `<html>` y/o `prefers-color-scheme`. Los `accent` de `FILE_KINDS` están elegidos para leerse en ambos temas con `color-mix` de baja opacidad para el fondo; si en QA alguno queda ilegible en oscuro, subir ese `accent` en `packages/core/src/file-kinds.js`.
- No hay infraestructura de test de componentes en este módulo (Node test runner del repo, sin Vitest). La verificación es `pnpm build` + `pnpm lint` + QA manual 390/1440 con el checklist de 14 aspectos.
- La tabla real en pantalla es `FilesWorkspaceTable.jsx`. `FilesTableView.jsx` **no se importa en ningún sitio** (código muerto) y se borra en la Task B7.

---

## Task B1: `TypeBadge` en `@atlas/ui`

**Files:**
- Create: `packages/ui/src/components/TypeBadge.jsx`
- Modify: `packages/ui/src/index.js`
- Modify: `docs/ai-context/ame3-runtime-capabilities.md`

- [ ] **Step 1: Create `packages/ui/src/components/TypeBadge.jsx`**

```jsx
import { cn } from "../lib/utils.js";

// A small pill whose colour is a brand/type accent hex, not a semantic variant.
// Background and border are derived from the accent via color-mix so the same
// accent reads on light and dark surfaces. Use for file-type / asset-type tags.
export function TypeBadge({ accent = "#64748b", className, children, ...props }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        className,
      )}
      style={{
        color: accent,
        backgroundColor: `color-mix(in srgb, ${accent} 14%, transparent)`,
        borderColor: `color-mix(in srgb, ${accent} 35%, transparent)`,
      }}
      {...props}
    >
      {children}
    </span>
  );
}
```

- [ ] **Step 2: Export it from `packages/ui/src/index.js`**

Find the block of component re-exports and add (alphabetical-ish, near `Badge`):

```js
export { TypeBadge } from "./components/TypeBadge.jsx";
```

If `Badge` is exported as `export * from "./components/Badge.jsx"` style, match whatever pattern the file uses for single named components.

- [ ] **Step 3: Document it**

In `docs/ai-context/ame3-runtime-capabilities.md`, find the components table that lists `Badge` and add a row directly under it:

```
| `TypeBadge` | Chip coloreado por `accent` (hex) para etiquetas de tipo (archivo, activo). Fondo/borde derivados con `color-mix`. | `<TypeBadge accent="#107c41">CSV</TypeBadge>` |
```

(Adjust column count to match that table's header.)

- [ ] **Step 4: Build check**

Run: `pnpm --filter @atlas/ui build` (or `pnpm build` if the UI package has no standalone build)
Expected: no errors. If `@atlas/ui` is consumed as source (no build step), skip and rely on Task B8.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/components/TypeBadge.jsx packages/ui/src/index.js docs/ai-context/ame3-runtime-capabilities.md
git commit -m "feat(ui): TypeBadge — accent-coloured type pill"
```

---

## Task B2: `lib/file-kind.js` como fachada sobre `@atlas/core`

**Files:**
- Modify: `apps/desktop/src/modules/atlas.files/lib/file-kind.js`

- [ ] **Step 1: Rewrite `lib/file-kind.js`**

```js
import { fileKindOf, fileKindLabel, fileKindAccent } from "@atlas/core";

// Facade over @atlas/core so existing imports in this module keep working.
// getFileKind now takes the whole file (name + mime) so the extension
// fallback in fileKindOf applies — pass the file object, not file.mimeType.
export function getFileKind(file) {
  if (typeof file === "string") return fileKindOf({ mimeType: file });
  return fileKindOf(file ?? {});
}

export function getKindLabel(kind) {
  return fileKindLabel(kind);
}

function prefersDark() {
  if (typeof document !== "undefined" && document.documentElement.classList.contains("dark")) return true;
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }
  return false;
}

export function getKindAccent(kind) {
  return fileKindAccent(kind, { dark: prefersDark() });
}

export function formatBytes(bytes = 0) {
  const size = Math.max(0, Number(bytes || 0));
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDate(value) {
  try {
    return new Date(value).toLocaleString("es-MX", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return String(value ?? "—");
  }
}
```

Note: `getFileKind` accepts a string too, so any caller not yet migrated still returns a sane value.

- [ ] **Step 2: Static check**

Run: `node --check apps/desktop/src/modules/atlas.files/lib/file-kind.js`
Expected: OK (no output).

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/modules/atlas.files/lib/file-kind.js
git commit -m "refactor(files): lib/file-kind delegates to @atlas/core"
```

---

## Task B3: `FileVisual` — iconos por tipo + color

**Files:**
- Modify: `apps/desktop/src/modules/atlas.files/components/FileVisual.jsx`

- [ ] **Step 1: Rewrite `FileVisual.jsx`**

```jsx
import {
  File,
  FileArchive,
  FileAudio,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileType2,
  FileVideo,
  Presentation,
} from "lucide-react";
import { getFileKind, getKindAccent } from "../lib/file-kind";

function getKindIcon(kind) {
  if (kind === "image") return FileImage;
  if (kind === "video") return FileVideo;
  if (kind === "audio") return FileAudio;
  if (kind === "pdf") return FileType2;
  if (kind === "csv" || kind === "sheet") return FileSpreadsheet;
  if (kind === "presentation") return Presentation;
  if (kind === "archive") return FileArchive;
  if (kind === "doc" || kind === "text") return FileText;
  return File;
}

export function FileVisual({ file, previewUrl, className = "", onClick = null }) {
  const kind = getFileKind(file);
  const Icon = getKindIcon(kind);
  const accent = getKindAccent(kind);

  if (kind === "image" && previewUrl) {
    return (
      <img
        src={previewUrl}
        alt={file?.originalName ?? "Archivo"}
        className={`${className || "h-10 w-10 rounded object-cover"} ${onClick ? "cursor-pointer" : ""}`}
        onClick={onClick}
      />
    );
  }

  return (
    <div
      className={`h-10 w-10 rounded flex items-center justify-center ${className} ${onClick ? "cursor-pointer" : ""}`}
      style={{
        color: accent,
        backgroundColor: `color-mix(in srgb, ${accent} 12%, transparent)`,
      }}
      onClick={onClick}
      onKeyDown={(event) => {
        if (!onClick) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick(event);
        }
      }}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <Icon className="h-5 w-5" />
    </div>
  );
}
```

Notes: the `bg-[hsl(var(--muted))]` default is gone from the fallback box (the accent tint replaces it). Callers that pass `bg-[hsl(var(--muted))]` in `className` will still override — that is fine for image slots that show a preview; harmless for icon slots (the inline `backgroundColor` wins over the class only if the class is not `!important`; Tailwind's is not, but inline style always wins over classes — good).

- [ ] **Step 2: Static check**

Run: `node --check apps/desktop/src/modules/atlas.files/components/FileVisual.jsx`
Expected: OK.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/modules/atlas.files/components/FileVisual.jsx
git commit -m "feat(files): FileVisual — per-kind icon + accent colour"
```

---

## Task B4: Columna "Tipo" en `FilesWorkspaceTable`

**Files:**
- Modify: `apps/desktop/src/modules/atlas.files/components/FilesWorkspaceTable.jsx`
- Modify: `apps/desktop/src/modules/atlas.files/components/FilesWorkspace.css`

- [ ] **Step 1: Update imports in `FilesWorkspaceTable.jsx`**

Change:

```js
import { DataTable, Checkbox, Button, ActionMenu, Badge } from "@atlas/ui";
```

to:

```js
import { DataTable, Checkbox, Button, ActionMenu, Badge, TypeBadge } from "@atlas/ui";
```

and:

```js
import {
  formatBytes,
  formatDate,
  getFileKind,
  getKindLabel,
} from "../lib/file-kind";
```

to:

```js
import {
  formatBytes,
  formatDate,
  getFileKind,
  getKindLabel,
  getKindAccent,
} from "../lib/file-kind";
```

- [ ] **Step 2: Fix the name-cell subtitle to pass the whole file**

In the `originalName` column `cell`, change:

```js
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">
                    {getKindLabel(getFileKind(f.mimeType))} ·{" "}
                    {formatBytes(f.sizeBytes)}
                  </p>
```

to:

```js
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">
                    {formatBytes(f.sizeBytes)}
                  </p>
```

(The kind moves to its own column; the subtitle keeps only the size.)

- [ ] **Step 3: Add the "Tipo" column between `originalName` and `access`**

Insert this column object immediately after the `originalName` column and before the `access` column:

```js
        {
          id: "kind",
          header: "Tipo",
          cell: ({ row }) => {
            const kind = getFileKind(row.original);
            return <TypeBadge accent={getKindAccent(kind)}>{getKindLabel(kind)}</TypeBadge>;
          },
        },
```

- [ ] **Step 4: Add `kind` to the memo dependency array**

The columns are built in a `useMemo`. No new external deps are referenced (`getFileKind`/`getKindLabel`/`getKindAccent` are module imports, stable), so the dependency array does not need changes. Leave it as-is.

- [ ] **Step 5: Adjust the mobile column-hiding CSS**

In `FilesWorkspace.css`, the `@media (max-width: 767px)` block hides `th/td:nth-child(3|4|5)`. With the new column the visible-on-mobile set shifts by one. Replace the nth-child rule so it hides the new "Tipo" (now child 3), "Acceso" (4) and "Origen" (5), keeping checkbox (1), name (2), "Modificado" (6) and actions (last):

```css
  .files-workspace-table th:nth-child(3),
  .files-workspace-table td:nth-child(3),
  .files-workspace-table th:nth-child(4),
  .files-workspace-table td:nth-child(4),
  .files-workspace-table th:nth-child(5),
  .files-workspace-table td:nth-child(5) {
    display: none;
  }
```

This is textually identical to the current rule — it already targets children 3/4/5. Because the new column is inserted at position 3, the columns hidden on mobile become Tipo/Acceso/Origen instead of Acceso/Origen/Modificado. **Decision:** we want "Modificado" hidden on mobile and "Tipo" hidden too (the coloured icon already conveys type on small screens). So change it to hide 3, 4, 5 **and** 6:

```css
  .files-workspace-table th:nth-child(3),
  .files-workspace-table td:nth-child(3),
  .files-workspace-table th:nth-child(4),
  .files-workspace-table td:nth-child(4),
  .files-workspace-table th:nth-child(5),
  .files-workspace-table td:nth-child(5),
  .files-workspace-table th:nth-child(6),
  .files-workspace-table td:nth-child(6) {
    display: none;
  }
```

- [ ] **Step 6: Static check**

Run: `node --check apps/desktop/src/modules/atlas.files/components/FilesWorkspaceTable.jsx`
Expected: OK.

- [ ] **Step 7: Commit**

```bash
git add apps/desktop/src/modules/atlas.files/components/FilesWorkspaceTable.jsx apps/desktop/src/modules/atlas.files/components/FilesWorkspace.css
git commit -m "feat(files): Tipo column with accent TypeBadge in the table"
```

---

## Task B5: Badges en `FilesCardView` y `FilesGridView`

**Files:**
- Modify: `apps/desktop/src/modules/atlas.files/components/FilesCardView.jsx`
- Modify: `apps/desktop/src/modules/atlas.files/components/FilesGridView.jsx`

- [ ] **Step 1: `FilesCardView.jsx` — imports**

Change:

```js
import { Badge, Button, Card } from "@atlas/ui";
```

to:

```js
import { Badge, Button, Card, TypeBadge } from "@atlas/ui";
```

and:

```js
import { formatBytes, formatDate } from "../lib/file-kind";
```

to:

```js
import { formatBytes, formatDate, getFileKind, getKindLabel, getKindAccent } from "../lib/file-kind";
```

- [ ] **Step 2: `FilesCardView.jsx` — replace the raw mimeType line**

Change:

```jsx
              <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">
                {file.mimeType}
              </p>
```

to:

```jsx
              <div className="mt-0.5">
                {(() => {
                  const kind = getFileKind(file);
                  return <TypeBadge accent={getKindAccent(kind)}>{getKindLabel(kind)}</TypeBadge>;
                })()}
              </div>
```

- [ ] **Step 3: `FilesGridView.jsx` — imports**

Change:

```js
import { getFileKind, getKindLabel } from "../lib/file-kind";
```

to:

```js
import { getFileKind, getKindLabel, getKindAccent } from "../lib/file-kind";
```

- [ ] **Step 4: `FilesGridView.jsx` — swap the label `<p>` for a badge**

Change:

```jsx
            <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
              {getKindLabel(getFileKind(file.mimeType))}
            </p>
```

to:

```jsx
            <div className="mt-0.5">
              {(() => {
                const kind = getFileKind(file);
                return <TypeBadge accent={getKindAccent(kind)}>{getKindLabel(kind)}</TypeBadge>;
              })()}
            </div>
```

And add `TypeBadge` to the import:

```js
import { Button, TypeBadge } from "@atlas/ui";
```

(current import is `import { Button } from "@atlas/ui";`)

- [ ] **Step 5: Static checks**

Run: `node --check apps/desktop/src/modules/atlas.files/components/FilesCardView.jsx && node --check apps/desktop/src/modules/atlas.files/components/FilesGridView.jsx`
Expected: OK.

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/modules/atlas.files/components/FilesCardView.jsx apps/desktop/src/modules/atlas.files/components/FilesGridView.jsx
git commit -m "feat(files): type badges in card and grid views"
```

---

## Task B6: Filtro "CSV" en el toolbar + predicado de `useFilesExplorer`

**Files:**
- Modify: `apps/desktop/src/modules/atlas.files/components/FilesToolbar.jsx`
- Modify: `apps/desktop/src/modules/atlas.files/hooks/useFilesExplorer.js`

- [ ] **Step 1: `FilesToolbar.jsx` — update the `kind` filter options**

Replace the `kind` filter's `options` array with (adds `csv`, aligns labels to `fileKindLabel`):

```js
    options: [
      { value: "image", label: "Imagen" },
      { value: "video", label: "Video" },
      { value: "audio", label: "Audio" },
      { value: "pdf", label: "PDF" },
      { value: "sheet", label: "Hoja de cálculo" },
      { value: "csv", label: "CSV" },
      { value: "doc", label: "Documento" },
      { value: "presentation", label: "Presentación" },
      { value: "archive", label: "Comprimido" },
      { value: "text", label: "Texto" },
      { value: "generic", label: "Otro" },
    ],
```

- [ ] **Step 2: `useFilesExplorer.js` — pass the whole file to `getFileKind`**

Change:

```js
      if (filters.kind) {
        if (getFileKind(file.mimeType) !== filters.kind) return false;
      }
```

to:

```js
      if (filters.kind) {
        if (getFileKind(file) !== filters.kind) return false;
      }
```

- [ ] **Step 3: Static checks**

Run: `node --check apps/desktop/src/modules/atlas.files/components/FilesToolbar.jsx && node --check apps/desktop/src/modules/atlas.files/hooks/useFilesExplorer.js`
Expected: OK.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/modules/atlas.files/components/FilesToolbar.jsx apps/desktop/src/modules/atlas.files/hooks/useFilesExplorer.js
git commit -m "feat(files): CSV filter option + extension-aware kind filtering"
```

---

## Task B7: Borrar `FilesTableView.jsx` (código muerto)

**Files:**
- Delete: `apps/desktop/src/modules/atlas.files/components/FilesTableView.jsx`

- [ ] **Step 1: Confirm it is unimported**

Run: `grep -rn "FilesTableView" apps/desktop/src`
Expected: matches only inside `FilesTableView.jsx` itself. If anything else imports it, STOP and reassess — do not delete.

- [ ] **Step 2: Delete the file**

Run: `git rm apps/desktop/src/modules/atlas.files/components/FilesTableView.jsx`

- [ ] **Step 3: Commit**

```bash
git commit -m "chore(files): remove unused FilesTableView"
```

---

## Task B8: Verificación — build, lint, otras vistas del tipo

**Files:**
- Modify (si aplica): `apps/desktop/src/modules/atlas.files/components/AdvancedFileViewer.jsx`

- [ ] **Step 1: `AdvancedFileViewer.jsx` — migrar llamadas a `getFileKind`**

`AdvancedFileViewer` llama `getFileKind(file?.mimeType)` y `getFileKind(f.mimeType)` (en el filmstrip). Con la fachada nueva `getFileKind` acepta string, así que **no rompe**, pero para aprovechar el fallback por extensión, cambiar:

- `const kind = useMemo(() => getFileKind(file?.mimeType), [file?.mimeType]);` → `const kind = useMemo(() => getFileKind(file), [file]);`
- `if (!f || getFileKind(f.mimeType) !== "video") continue;` → `if (!f || getFileKind(f) !== "video") continue;`
- `const fKind = getFileKind(f.mimeType);` → `const fKind = getFileKind(f);`

Run: `node --check apps/desktop/src/modules/atlas.files/components/AdvancedFileViewer.jsx`
Expected: OK.

- [ ] **Step 2: Commit**

```bash
git add apps/desktop/src/modules/atlas.files/components/AdvancedFileViewer.jsx
git commit -m "refactor(files): AdvancedFileViewer uses file-aware getFileKind"
```

- [ ] **Step 3: Lint**

Run: `pnpm lint`
Expected: clean.

- [ ] **Step 4: Build**

Run: `pnpm build`
Expected: success. If `@atlas/core` or `@atlas/ui` fail to resolve `fileKindOf`/`TypeBadge`, ensure Plan A is merged and `packages/core/src/index.js` re-exports `file-kinds.js`.

- [ ] **Step 5: QA manual (checklist de 14 aspectos + 390 y 1440)**

- Tabla / tarjetas / cuadrícula: icono coloreado + `TypeBadge` para `docx`, `xlsx`, `xls`, `csv`, `doc`, `ppt`, `pptx`, `pdf`, `png`, `mp4`, `mp3`, `zip`, `txt`. Tema claro **y** oscuro — verificar contraste del texto del badge en oscuro; si un `accent` queda ilegible, subir su valor en `packages/core/src/file-kinds.js` y re-`pnpm build`.
- Filtro: "CSV" devuelve solo CSV; "Hoja de cálculo" ya no incluye CSV.
- Subir un `.csv` con extensión correcta pero MIME `text/plain` (algunos navegadores) → aparece como "CSV".
- Abrir un `.csv` y un `.doc`/`.xls`/`.ppt` reales desde la tabla → abren en Collabora (esto ejercita Plan A; si Plan A no está desplegado, caerá al visor genérico — anotarlo, no es regresión de Plan B).
- Vista de tabla en 390px: se ocultan Tipo/Acceso/Origen/Modificado; el icono coloreado sigue comunicando el tipo.

- [ ] **Step 6: Commit de cierre (si QA pidió ajustes de accent u otros)**

```bash
git add -A
git commit -m "fix(files): QA polish for type identity (contrast / spacing)"
```

---

## Self-review notes

- **Spec §4.4 `@atlas/ui`** — `TypeBadge`: Task B1 (se eligió componente nuevo en vez de prop `accent` en `Badge` porque `Badge` usa cva con variantes cerradas).
- **Spec §4.4 `lib/file-kind.js`** — fachada: Task B2. `getKindAccent` añadido aquí (el spec lo mencionaba como consumidor de `fileKindAccent`).
- **Spec §4.4 `FileVisual`** — iconos `presentation`/`video`/`audio`/`archive`/`csv` + color: Task B3.
- **Spec §4.4 tabla "Tipo"** — Task B4 (+ ajuste de la media query móvil).
- **Spec §4.4 tarjetas/cuadrícula** — Task B5 (elimina el `mimeType` crudo de `FilesCardView`).
- **Spec §4.4 toolbar "CSV"** — Task B6; `useFilesExplorer` predicado — Task B6 Step 2.
- **Spec §4.4 borrar `FilesTableView.jsx`** — Task B7.
- **Spec §4.4 `AdvancedFileViewer` sin cambios funcionales** — Task B8 Step 1 hace solo la migración de firma (no cambia comportamiento; el visor no maneja Office).
- **Spec §7 frontend** — sin infra de test nueva (norma del repo); verificación por `node --check` + `pnpm build` + `pnpm lint` + QA.
- Type consistency: `getFileKind(file)`, `getKindLabel(kind)`, `getKindAccent(kind)`, `<TypeBadge accent=… />` usados igual en B3/B4/B5/B6.
- **No cubierto por diseño (correcto):** `FileDetailPanel.jsx` no se toca — el spec no lo lista; si en QA se ve el `mimeType` crudo ahí, es follow-up, no parte de este plan.
