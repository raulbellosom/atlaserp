# Plan B1 — Acciones Office para archivos del chat (referencias atlas.files, sin backend)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que un archivo referenciado desde `atlas.files` en un mensaje de chat se pueda abrir en el editor de Office (clic derecho / long-press) y que el `AdvancedFileViewer` ofrezca ese CTA en vez de la tarjeta "sin vista previa".

**Architecture:** Helper compartido `lib/officeFileActions.js`; `ContextMenu` de `@atlas/ui` envolviendo los tiles de `FileReferenceGroup`; `AdvancedFileViewer` gana props `onOpenInOffice` + `canOpenInOffice`; los callers (`FilesScreen`, `EntityFileViewer`, `ChatAttachmentViewer`) las cablean con `useOfficeActions().open(id)`. **Cero backend.**

**Tech Stack:** React 18, `@atlas/ui`, `@atlas/core` (`getOfficeFormat`), `lucide-react`. Sin tests de componentes (norma del repo): `node --check` + `pnpm build` + `pnpm lint` + QA.

**Spec:** `docs/superpowers/specs/2026-09-08-chat-open-files-in-office-design.md` §4.1

---

## Contexto para quien implementa

- `useOfficeActions()` (de `@atlas/ui`) devuelve `{ enabled, available, canEdit, open }`. `open(fileAssetId)` navega a `/app/m/atlas.files/files/:id/edit` (editor Collabora). Ya montado globalmente por `apps/desktop/src/providers/OfficeProvider.jsx`.
- Las **referencias** llevan `{ recordId, mimeType, title, sizeBytes }`. `recordId` es un `FileAsset` id real → `office.open(recordId)` funciona hoy.
- `getOfficeFormat(file)` (de `@atlas/core`) necesita `{ originalName || fileName, mimeType }` y ya reconoce docx/xlsx/pptx/csv/xls/doc/ppt (spec de identidad de tipos, ya en `main`).
- `ContextMenu` se usa exactamente como en `apps/desktop/src/modules/atlas.chat/components/ConversationRowActions.jsx`: `<ContextMenu><ContextMenuTrigger asChild>{tile}</ContextMenuTrigger><ContextMenuContent>…<ContextMenuItem onSelect=…>…</ContextMenuContent></ContextMenu>`.
- El visor ancho de conversación para clics en un mensaje es `ChatAttachmentViewer.jsx` (maneja refs `isEntityRef:true` y adjuntos reales). `EntityFileViewer.jsx` lo usan `ChatFilesGallery` y `EntityReferencePicker`. Ambos renderizan `AdvancedFileViewer`.

---

## Task 1: Helper `officeFileActions.js`

**Files:**
- Create: `apps/desktop/src/modules/atlas.chat/lib/officeFileActions.js`

- [ ] **Step 1: Crear el archivo**

```js
import { FilePenLine, ExternalLink } from "lucide-react";
import { getOfficeFormat } from "@atlas/core";

// True if `file` ({ fileName|title|originalName, mimeType }) is an Office format
// the WOPI editor can open.
export function isOfficeOpenable(file) {
  const probe = {
    originalName: file?.originalName ?? file?.fileName ?? file?.title ?? "",
    mimeType: file?.mimeType ?? "",
  };
  return Boolean(getOfficeFormat(probe));
}

// Menu entries for a file that IS a FileAsset (entity reference in chat, or the
// atlas.files viewer). `office` = useOfficeActions() context. `signedUrl` may be
// null (still resolving) — the "open in new tab" entry renders disabled then.
export function buildFileAssetOfficeActions({ office, fileAssetId, file, signedUrl, onResolveUrl }) {
  const items = [];
  if (office?.enabled && fileAssetId && isOfficeOpenable(file)) {
    items.push({
      key: "office-open",
      label: office.canEdit ? "Abrir en editor de Office" : "Abrir en Office (solo lectura)",
      icon: FilePenLine,
      onSelect: () => office.open(fileAssetId),
    });
  }
  items.push({
    key: "office-open-tab",
    label: "Abrir en pestaña nueva",
    icon: ExternalLink,
    disabled: !signedUrl && !onResolveUrl,
    onSelect: async () => {
      const url = signedUrl ?? (onResolveUrl ? await onResolveUrl() : null);
      if (url) window.open(url, "_blank", "noopener,noreferrer");
    },
  });
  return items;
}
```

- [ ] **Step 2: `node --check`**

Run: `node --check apps/desktop/src/modules/atlas.chat/lib/officeFileActions.js`
Expected: OK.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/lib/officeFileActions.js
git commit -m "feat(chat): officeFileActions helper for FileAsset-backed chat files"
```

---

## Task 2: `AdvancedFileViewer` — CTA "Abrir en editor de Office"

**Files:**
- Modify: `apps/desktop/src/modules/atlas.files/components/AdvancedFileViewer.jsx`

- [ ] **Step 1: Añadir imports**

Tras los imports existentes de `@atlas/ui` / `../lib/file-kind`, añadir:

```js
import { getOfficeFormat } from "@atlas/core";
```

(`useOfficeActions` NO se importa aquí — el caller decide y pasa `onOpenInOffice`.)

- [ ] **Step 2: Añadir props**

En la firma `export function AdvancedFileViewer({ open, onOpenChange, files, activeIndex, onIndexChange, onResolveSignedUrl, zIndex = 50 })` añadir dos props:

```js
export function AdvancedFileViewer({
  open,
  onOpenChange,
  files,
  activeIndex,
  onIndexChange,
  onResolveSignedUrl,
  zIndex = 50,
  onOpenInOffice = null,
  canOpenInOffice = null,
}) {
```

- [ ] **Step 3: Calcular si mostrar el CTA**

Junto a `const kind = useMemo(...)` (línea ~153), añadir:

```js
  const officeOpenable = useMemo(() => {
    if (!onOpenInOffice || !file) return false;
    if (canOpenInOffice && !canOpenInOffice(file)) return false;
    return Boolean(
      getOfficeFormat({
        originalName: file.originalName ?? file.fileName ?? file.name ?? "",
        mimeType: file.mimeType ?? "",
      }),
    );
  }, [onOpenInOffice, canOpenInOffice, file]);
```

- [ ] **Step 4: Insertar el botón en la tarjeta genérica**

En la rama `{!loading && signedUrl && kind !== "image" && kind !== "pdf" && kind !== "video" && kind !== "audio" && (` (línea ~857), dentro del `<div className="w-full max-w-xs glass rounded-2xl p-6">`, ANTES del `<div className="flex gap-2">` con Descargar/Abrir, añadir:

```jsx
                  {officeOpenable && (
                    <button
                      onClick={() => {
                        onOpenChange(false);
                        onOpenInOffice(file);
                      }}
                      className="w-full h-9 mb-2 rounded-lg flex items-center justify-center gap-1.5 text-xs font-medium text-[hsl(var(--primary-foreground))] bg-[hsl(var(--primary))] hover:opacity-90 transition-opacity"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Abrir en editor de Office
                    </button>
                  )}
```

(`ExternalLink` ya está importado en este archivo.)

- [ ] **Step 5: `node --check`**

Run: `node --check apps/desktop/src/modules/atlas.files/components/AdvancedFileViewer.jsx`
Expected: OK.

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/modules/atlas.files/components/AdvancedFileViewer.jsx
git commit -m "feat(files): AdvancedFileViewer optional 'Abrir en editor de Office' CTA"
```

---

## Task 3: Cablear `onOpenInOffice` desde `FilesScreen`

**Files:**
- Modify: `apps/desktop/src/modules/atlas.files/screens/FilesScreen.jsx`

- [ ] **Step 1: Pasar la prop al `AdvancedFileViewer`**

Buscar el `<AdvancedFileViewer` que renderiza `FilesScreen` (cerca del final, usa `onResolveSignedUrl={resolveSignedUrl}`). Añadir:

```jsx
        onOpenInOffice={(f) => office?.enabled && office.open(f.id)}
        canOpenInOffice={(f) => f?.enabled !== false}
```

(`office` ya está en scope: `const office = useOfficeActions();` línea 62.)

- [ ] **Step 2: `node --check`**

Run: `node --check apps/desktop/src/modules/atlas.files/screens/FilesScreen.jsx`
Expected: OK.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/modules/atlas.files/screens/FilesScreen.jsx
git commit -m "feat(files): FilesScreen wires AdvancedFileViewer -> office.open"
```

---

## Task 4: `EntityFileViewer` + `ChatAttachmentViewer` reenvían `onOpenInOffice`

**Files:**
- Modify: `apps/desktop/src/modules/atlas.chat/components/EntityFileViewer.jsx`
- Modify: `apps/desktop/src/modules/atlas.chat/components/ChatAttachmentViewer.jsx`

- [ ] **Step 1: `EntityFileViewer` — aceptar y reenviar**

Firma → `export function EntityFileViewer({ open, onOpenChange, files, activeIndex = 0, onIndexChange, onOpenInOffice = null, canOpenInOffice = null })`.
En el `<AdvancedFileViewer ... />` añadir `onOpenInOffice={onOpenInOffice}` y `canOpenInOffice={canOpenInOffice}`.

- [ ] **Step 2: `EntityFileViewer` — default de Office desde el contexto**

Importar `useOfficeActions` de `@atlas/ui`. Dentro del componente:

```js
  const office = useOfficeActions();
  const resolvedOnOpenInOffice = onOpenInOffice ?? ((f) => office?.enabled && office.open(f.id));
```

y pasar `resolvedOnOpenInOffice` en vez de `onOpenInOffice` al `AdvancedFileViewer`. `canOpenInOffice` se queda como viene (null → el viewer permite todos; aquí todos los `files` de `EntityFileViewer` son FileAssets de `atlas.files`, así que es correcto).

- [ ] **Step 3: `ChatAttachmentViewer` — Office solo para refs de entidad (B1)**

Importar `useOfficeActions` de `@atlas/ui`. Dentro del componente:

```js
  const office = useOfficeActions();
```

En el `<AdvancedFileViewer ... />` añadir:

```jsx
      onOpenInOffice={(f) => {
        // B1: only entity references are FileAsset-backed. Real chat
        // attachments get their own path in Plan B2.
        if (f?.isEntityRef && office?.enabled) office.open(f.id);
      }}
      canOpenInOffice={(f) => Boolean(f?.isEntityRef)}
```

- [ ] **Step 4: `node --check` ambos**

Run: `node --check apps/desktop/src/modules/atlas.chat/components/EntityFileViewer.jsx && node --check apps/desktop/src/modules/atlas.chat/components/ChatAttachmentViewer.jsx`
Expected: OK.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/components/EntityFileViewer.jsx apps/desktop/src/modules/atlas.chat/components/ChatAttachmentViewer.jsx
git commit -m "feat(chat): entity-ref viewers wire 'Abrir en editor de Office'"
```

---

## Task 5: Menú contextual en `FileReferenceGroup`

**Files:**
- Modify: `apps/desktop/src/modules/atlas.chat/components/FileReferenceGroup.jsx`

- [ ] **Step 1: Imports**

```js
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  useOfficeActions,
} from "@atlas/ui";
import { Download, Loader2, FilePenLine } from "lucide-react";
import { buildFileAssetOfficeActions } from "../lib/officeFileActions";
import { useFileRefSignedUrl } from "../hooks/useFileRefSignedUrl";
```

(añadir a los imports que ya existan; `Download`/`Loader2` ya están.)

- [ ] **Step 2: Envolver el tile no-imagen (`FileRow`) en `ContextMenu`**

Sustituir el `return (` de `FileRow` por una versión envuelta. `FileRow` ya tiene `const { refetch } = useFileRefSignedUrl(fileRef.recordId, "full", false);`. Añadir `const office = useOfficeActions();` y:

```jsx
  const items = buildFileAssetOfficeActions({
    office,
    fileAssetId: fileRef.recordId,
    file: { title: fileRef.title, mimeType: fileRef.mimeType },
    signedUrl: null,
    onResolveUrl: async () => (await refetch())?.data ?? null,
  });

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          className={[
            "flex items-center gap-1 mt-1.5 rounded-xl max-w-55",
            isOwn ? "bg-white/15" : "bg-[hsl(var(--border))]",
          ].join(" ")}
        >
          <button type="button" onClick={onOpen} className="flex items-center gap-2.5 flex-1 min-w-0 px-3 py-2 text-left">
            <FileTypeIcon mimeType={fileRef.mimeType} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{fileRef.title}</p>
              <p className="text-xs opacity-50">{fileRef.sizeBytes ? formatFileSize(fileRef.sizeBytes) : ""}</p>
            </div>
          </button>
          <button
            type="button"
            onClick={handleDownloadClick}
            disabled={downloading}
            title="Descargar"
            className="shrink-0 h-8 w-8 mr-1 rounded-full flex items-center justify-center opacity-60 hover:opacity-100 transition-opacity disabled:opacity-30"
          >
            {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          </button>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        {items.map((a) => (
          <ContextMenuItem key={a.key} disabled={a.disabled} onSelect={() => a.onSelect()}>
            {a.icon && <a.icon className="h-4 w-4 mr-2" />}
            {a.label}
          </ContextMenuItem>
        ))}
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={handleDownloadClick}>
          <Download className="h-4 w-4 mr-2" />
          Descargar
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
```

- [ ] **Step 3: (opcional) botón visible "Abrir en Office" en el tile no-imagen**

Si `office?.enabled && isOfficeOpenable({ title: fileRef.title, mimeType: fileRef.mimeType })`, añadir entre el botón de abrir y el de descargar un botón pequeño:

```jsx
          {officeItem && (
            <button
              type="button"
              onClick={() => office.open(fileRef.recordId)}
              title={office.canEdit ? "Abrir en editor de Office" : "Abrir en Office"}
              className="shrink-0 h-8 w-8 rounded-full flex items-center justify-center opacity-60 hover:opacity-100 transition-opacity"
            >
              <FilePenLine className="h-4 w-4" />
            </button>
          )}
```

con `const officeItem = items.find((i) => i.key === "office-open");` arriba. Importar `isOfficeOpenable` desde `../lib/officeFileActions` si se usa aquí.

- [ ] **Step 4: (imagen) `ContextMenu` en `GridImageTile`**

Envolver el `<button>` de `GridImageTile` igual (`ContextMenuTrigger asChild` sobre el botón). Reusar `buildFileAssetOfficeActions` con el `fileRef` del tile. `GridImageTile` ya tiene `useFileRefSignedUrl(fileRef.recordId, "card", true)` — para "abrir en pestaña nueva" conviene la variante `full`; añadir un `refetch` con `useFileRefSignedUrl(fileRef.recordId, "full", false)` y pasarlo como `onResolveUrl`.

- [ ] **Step 5: `node --check` + build**

Run: `node --check apps/desktop/src/modules/atlas.chat/components/FileReferenceGroup.jsx`
Expected: OK.

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/components/FileReferenceGroup.jsx
git commit -m "feat(chat): right-click menu on file references (open in Office / new tab / download)"
```

---

## Task 6: Verificación

**Files:** ninguno.

- [ ] **Step 1: Lint + build**

Run: `pnpm lint && pnpm build`
Expected: limpio / éxito.

- [ ] **Step 2: QA manual (390 y 1440, tema claro y oscuro)**

- Mensaje con una referencia `.docx`/`.xlsx`/`.csv`: clic derecho / long-press → "Abrir en editor de Office" abre Collabora en la ruta `/app/m/atlas.files/files/:id/edit`; "Abrir en pestaña nueva" abre la URL firmada; "Descargar" descarga.
- Referencia de imagen: clic derecho también ofrece el menú; clic normal sigue abriendo el visor de conversación.
- Abrir una referencia `.docx` desde el visor (flechas multi-archivo): la tarjeta genérica muestra el CTA azul "Abrir en editor de Office".
- Usuario sin `files.assets.read`: la entrada Office no aparece (`office.enabled` falso); descargar/abrir siguen.
- En `atlas.files` (no chat): el visor de un `.docx` alcanzado con flechas muestra el mismo CTA.

- [ ] **Step 3: Commit de cierre si QA pidió ajustes**

```bash
git add -A && git commit -m "fix(chat): QA polish for file-ref Office actions"
```

---

## Self-review

- Spec §4.1 helper `officeFileActions` → Task 1. `AdvancedFileViewer` CTA + props → Task 2. Cableado `FilesScreen`/`EntityFileViewer`/`ChatAttachmentViewer` → Tasks 3-4. Menú contextual `FileReferenceGroup` → Task 5.
- Sin backend, sin migración, sin tests nuevos de servicio (correcto para B1).
- `ChatAttachmentViewer` limita Office a `isEntityRef` — los adjuntos reales quedan para B2 (documentado en el código).
- Consistencia de tipos: `onOpenInOffice(file)` + `canOpenInOffice(file)` con la misma firma en `AdvancedFileViewer`, `EntityFileViewer`, `ChatAttachmentViewer`, `FilesScreen`.
