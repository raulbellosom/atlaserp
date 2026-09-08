# Plan B2 — Adjuntos de chat en el editor de Office (UI, requiere Plan A)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Abrir/editar un adjunto subido al chat en Collabora desde el tile del mensaje y desde el visor de conversación, usando el endpoint de Plan A.

**Architecture:** `OfficeProvider` gana `openChatAttachment(id)` → nueva `ChatOfficeEditorScreen` (gemela de `OfficeEditorScreen`) que monta `<OfficeDocumentEditor>` con `createSession = atlas.chat.createAttachmentOfficeSession`. `MessageAttachments`/`FileCard` gana `ContextMenu`; `ChatAttachmentViewer` reenvía `onOpenInOffice` también para adjuntos reales.

**Tech Stack:** React 18, `@atlas/ui` (`OfficeDocumentEditor`, `ContextMenu`), `@atlas/sdk`. Verificación: `node --check` + `pnpm build` + `pnpm lint` + QA.

**Spec:** `docs/superpowers/specs/2026-09-08-chat-open-files-in-office-design.md` §4.3. **Depende de:** Plan A (endpoint `POST /chat/attachments/:id/office/session` + SDK).

---

## Contexto

- `OfficeProvider.jsx` provee `{ enabled, available, canEdit, open }`. `open(id)` navega a `/app/m/atlas.files/files/:id/edit`.
- `apps/desktop/src/modules/atlas.files/screens/OfficeEditorScreen.jsx` es el patrón: 42 líneas, monta `<OfficeDocumentEditor key=… fileId=… createSession=… onClose=… onSaved=… onDownload=… />`, `createSession` llama `atlas.files.createOfficeSession(id, mode, token)`.
- `MessageAttachments.jsx`: `buildAttachmentActions({ att, url })` construye el menú (merge en `MessageActionSheet`); `FileCard` NO tiene `ContextMenu` (solo botón descargar). `att` = `{ id, mimeType, fileName, sizeBytes, url, reactions }` (id = id de `chat_attachments`).
- `ChatAttachmentViewer.jsx` pasa a `AdvancedFileViewer` entradas con `isEntityRef` true/false. En B1 ya recibe `onOpenInOffice`/`canOpenInOffice` limitados a `isEntityRef`.
- El router del módulo chat: buscar dónde se registran las rutas de `atlas.chat` (`apps/desktop/src/modules/atlas.chat/**` — un `routes.jsx`/`index.jsx` con `<Route path="chat/...">`).

---

## Task 1: `OfficeProvider.openChatAttachment`

**Files:**
- Modify: `apps/desktop/src/providers/OfficeProvider.jsx`

- [ ] **Step 1: Añadir la acción**

```js
  const openChatAttachment = useCallback(
    (id) => navigate(`/app/m/atlas.chat/chat/attachment/${encodeURIComponent(id)}/edit`, { state: { officeReturnTo: location.pathname } }),
    [navigate, location.pathname],
  );
  const value = useMemo(
    () => ({ enabled: Boolean(canRead && status.data?.data?.enabled), available: Boolean(status.data?.data?.available), canEdit, open, openChatAttachment }),
    [canRead, canEdit, status.data, open, openChatAttachment],
  );
```

- [ ] **Step 2: `node --check` + commit**

```bash
node --check apps/desktop/src/providers/OfficeProvider.jsx
git add apps/desktop/src/providers/OfficeProvider.jsx
git commit -m "feat(office): OfficeProvider.openChatAttachment"
```

---

## Task 2: `ChatOfficeEditorScreen` + ruta

**Files:**
- Create: `apps/desktop/src/modules/atlas.chat/screens/ChatOfficeEditorScreen.jsx`
- Modify: el archivo de rutas del módulo `atlas.chat`

- [ ] **Step 1: Crear la pantalla** (copia de `OfficeEditorScreen.jsx`, cambiando el `createSession` y el regex de la ruta)

```jsx
import { useCallback, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { OfficeDocumentEditor } from '@atlas/ui';
import { toast } from 'sonner';
import { atlas } from '../../../lib/atlas';
import { useAuth } from '../../../auth/AuthProvider';

export default function ChatOfficeEditorScreen() {
  const { session } = useAuth();
  const authToken = useRef(session?.access_token);
  const downloadName = useRef('documento');
  useEffect(() => { authToken.current = session?.access_token; }, [session?.access_token]);
  const { pathname, state } = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const attId = pathname.match(/\/chat\/attachment\/([^/]+)\/edit\/?$/)?.[1] ?? '';
  const createSession = useCallback(async (id, mode) => {
    const { data } = await atlas.chat.createAttachmentOfficeSession(id, mode, authToken.current);
    downloadName.current = data.fileName;
    return data;
  }, []);
  const saved = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['chat-attachment-url', attId] });
  }, [queryClient, attId]);
  const close = useCallback(() => {
    saved();
    const returnTo = state?.officeReturnTo;
    navigate(typeof returnTo === 'string' && returnTo.startsWith('/app/') && !returnTo.endsWith('/edit') ? returnTo : '/app/m/atlas.chat');
  }, [navigate, saved, state]);
  const download = useCallback(async () => {
    try {
      const result = await atlas.chat.downloadAttachmentOffice?.(attId, authToken.current);
      if (!result) { toast.message('Descarga la copia desde el editor.'); return; }
      const url = URL.createObjectURL(result);
      const link = document.createElement('a');
      link.href = url; link.download = downloadName.current; link.rel = 'noreferrer'; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch { toast.error('No se pudo descargar. Usa el editor.'); }
  }, [attId]);
  return (
    <div className="fixed inset-0 z-50 h-[100dvh] w-full pb-[env(safe-area-inset-bottom)]">
      <OfficeDocumentEditor key={`${attId}:${session?.user?.id}`} fileId={attId} createSession={createSession} onClose={close} onSaved={saved} onDownload={download} />
    </div>
  );
}
```

(`atlas.chat.downloadAttachmentOffice` es opcional — si Plan A no añadió un endpoint de descarga dedicado, el `onDownload` degrada al mensaje; el `OfficeDocumentEditor` igual permite "Archivo → Descargar" dentro de Collabora.)

- [ ] **Step 2: Registrar la ruta**

En el archivo de rutas de `atlas.chat`, añadir (lazy):

```jsx
{ path: 'chat/attachment/:id/edit', element: <ChatOfficeEditorScreen /> }
```

o `<Route path="chat/attachment/:id/edit" element={<ChatOfficeEditorScreen />} />` según el estilo del módulo. Debe quedar FUERA del layout con sidebar (pantalla completa), igual que se hace con `files/:id/edit` en `atlas.files`.

- [ ] **Step 3: `node --check` + commit**

```bash
node --check apps/desktop/src/modules/atlas.chat/screens/ChatOfficeEditorScreen.jsx
git add apps/desktop/src/modules/atlas.chat/screens/ChatOfficeEditorScreen.jsx <archivo de rutas>
git commit -m "feat(chat): ChatOfficeEditorScreen + route"
```

---

## Task 3: `FileCard` gana `ContextMenu` + acción Office

**Files:**
- Modify: `apps/desktop/src/modules/atlas.chat/components/MessageAttachments.jsx`

- [ ] **Step 1: `buildAttachmentActions` acepta `office`**

Firma → `buildAttachmentActions({ att, url, office })`. Al principio de `items`, si `office?.enabled` y el formato calza:

```js
  if (office?.enabled && isOfficeOpenable({ fileName: att.fileName, mimeType: att.mimeType })) {
    items.push({
      key: "att-office",
      label: office.canEdit ? "Abrir en editor de Office" : "Abrir en Office (solo lectura)",
      icon: FilePenLine,
      onSelect: () => office.openChatAttachment(att.id),
    });
  }
```

Importar `FilePenLine` de `lucide-react` y `isOfficeOpenable` de `../lib/officeFileActions`. Actualizar las llamadas a `buildAttachmentActions` (en `MessageActionSheet` / donde se use) para pasar `office` (de `useOfficeActions()`).

- [ ] **Step 2: `FileCard` — envolver en `ContextMenu`**

`FileCard` recibe una nueva prop `office`. Importar `ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem` de `@atlas/ui`. Envolver el `<div data-attachment-id=…>` en `<ContextMenu><ContextMenuTrigger asChild>…</ContextMenuTrigger><ContextMenuContent>` con `buildAttachmentActions({ att, url, office })` + "Descargar" (reusa `handleDownload`). El `onClick` que llama `onOpen` no cambia.

- [ ] **Step 3: `AttachmentsBlock` pasa `office` a `FileCard`**

`AttachmentsBlock` llama `useOfficeActions()` y pasa `office` a cada `<FileCard>`. (`AudioCard`/`VideoCard`/`ImageCard` no lo necesitan.)

- [ ] **Step 4: `node --check` + commit**

```bash
node --check apps/desktop/src/modules/atlas.chat/components/MessageAttachments.jsx
git add apps/desktop/src/modules/atlas.chat/components/MessageAttachments.jsx
git commit -m "feat(chat): FileCard context menu -> open chat attachment in Office"
```

---

## Task 4: `ChatAttachmentViewer` — Office para adjuntos reales

**Files:**
- Modify: `apps/desktop/src/modules/atlas.chat/components/ChatAttachmentViewer.jsx`

- [ ] **Step 1: Ampliar el `onOpenInOffice` de B1**

Sustituir el callback limitado a `isEntityRef` por:

```jsx
      onOpenInOffice={(f) => {
        if (!office?.enabled) return;
        if (f?.isEntityRef) office.open(f.id);
        else office.openChatAttachment(f.id);
      }}
      canOpenInOffice={() => Boolean(office?.enabled)}
```

(el `AdvancedFileViewer` ya filtra además por `getOfficeFormat(file)`.)

- [ ] **Step 2: `node --check` + commit**

```bash
node --check apps/desktop/src/modules/atlas.chat/components/ChatAttachmentViewer.jsx
git add apps/desktop/src/modules/atlas.chat/components/ChatAttachmentViewer.jsx
git commit -m "feat(chat): ChatAttachmentViewer opens real attachments in Office"
```

---

## Task 5: Verificación

**Files:** ninguno.

- [ ] **Step 1: Lint + build**

Run: `pnpm lint && pnpm build`
Expected: limpio / éxito. Si falla resolviendo `atlas.chat.createAttachmentOfficeSession`, confirmar que Plan A añadió el método al SDK y que `@atlas/sdk` está reconstruido/enlazado.

- [ ] **Step 2: QA end-to-end (390 y 1440, claro y oscuro)**

- Subir un `.xlsx` al chat → en el tile, clic derecho / long-press → "Abrir en editor de Office" → abre `ChatOfficeEditorScreen` con Collabora; editar; guardar; cerrar → vuelve al chat y el tile muestra el tamaño/preview nuevos (el broadcast `attachment_updated` invalidó la URL).
- Abrir el mismo adjunto desde el visor de conversación (clic normal → `ChatAttachmentViewer`): la tarjeta genérica muestra el CTA "Abrir en editor de Office".
- Adjunto `.docx` subido por un invitado (chat externo): abre en **solo lectura** (backend degrada; el editor lo indica).
- Usuario con rol `guest`/sin permiso de envío en el canal: solo lectura o mensaje claro.
- Referencia de `atlas.files` (no adjunto real): sigue funcionando por `office.open` (regresión de B1).
- Adjunto que NO es Office (imagen, zip): sin entrada "Abrir en editor".

- [ ] **Step 3: Commit de cierre**

```bash
git add -A && git commit -m "fix(chat): QA polish for chat-attachment Office editing"
```

---

## Self-review

- Spec §4.3: `openChatAttachment` (Task 1), `ChatOfficeEditorScreen`+ruta (Task 2), `FileCard` menú (Task 3), `ChatAttachmentViewer` (Task 4).
- Depende estrictamente de Plan A (endpoint + SDK); Task 5 Step 1 lo verifica.
- Reusa el helper `isOfficeOpenable`/`buildFileAssetOfficeActions` de B1 (`lib/officeFileActions.js`).
- La etiqueta usa `office.canEdit` solo como heurística de texto; el gate real (membresía/rol/invitado) es del backend, que degrada a solo lectura o 403 controlado.
