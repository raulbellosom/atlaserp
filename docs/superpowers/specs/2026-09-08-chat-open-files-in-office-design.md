# Diseño — Abrir archivos del chat en el editor de Office

- **Fecha:** 2026-09-08
- **Módulos:** `atlas.chat`, `atlas.files` (WOPI/Office), `@atlas/ui`
- **Estado:** Diseño aprobado (pendiente revisión de spec por el usuario)
- **Autor:** Claude (brainstorming con Raul)

## 1. Problema

En una conversación de `atlas.chat` conviven dos clases de archivo:

1. **Referencias a `atlas.files`** — adjuntadas con el picker de "referencia a entidad".
   `ref.recordId` es el id de un `FileAsset` real. Se renderizan con
   [`FileReferenceGroup.jsx`](../../../apps/desktop/src/modules/atlas.chat/components/FileReferenceGroup.jsx)
   y se ven con [`EntityFileViewer.jsx`](../../../apps/desktop/src/modules/atlas.chat/components/EntityFileViewer.jsx)
   → [`AdvancedFileViewer`](../../../apps/desktop/src/modules/atlas.files/components/AdvancedFileViewer.jsx).

2. **Adjuntos subidos al chat** — tabla `chat_attachments` (bucket `atlas-chat`,
   `object_key` propio, sin `content_revision`/`checksum`/lock), renderizados por
   [`MessageAttachments.jsx`](../../../apps/desktop/src/modules/atlas.chat/components/MessageAttachments.jsx)
   (`FileCard`) y vistos con
   [`ChatAttachmentViewer.jsx`](../../../apps/desktop/src/modules/atlas.chat/components/ChatAttachmentViewer.jsx).

Hoy, un `.docx`/`.xlsx`/`.csv`/etc. en el chat **no** se puede abrir en el editor de
Office (Collabora/WOPI):

- El menú de acciones de un adjunto (`buildAttachmentActions`) solo ofrece copiar
  enlace / descargar / abrir en pestaña nueva. No hay "abrir en editor".
- `FileReferenceGroup` no expone ninguna acción de tipo Office ni menú contextual.
- El `AdvancedFileViewer`, para `kind` doc/sheet/presentation, muestra la tarjeta
  genérica "No hay vista previa disponible" con solo Descargar / Abrir — aun cuando
  el archivo **sí** podría abrirse en Office.
- El flujo WOPI (`apps/api/src/services/office/*`) está cableado a
  `prisma.fileAsset` y a una allowlist de `entityType` que **no** incluye chat.

## 2. Objetivos

- **Referencias a `atlas.files` en el chat**: menú contextual (clic derecho /
  long-press) y acción visible con "Abrir en editor de Office" (si el formato y los
  permisos lo permiten), "Abrir en pestaña nueva" y "Descargar".
- **`AdvancedFileViewer`**: para archivos Office respaldados por un `FileAsset` y con
  Office habilitado, sustituir la tarjeta "sin vista previa" por un CTA "Abrir en
  editor de Office" (además de Descargar / Abrir en pestaña nueva). Beneficia al
  visor de `atlas.files` y al `EntityFileViewer` del chat.
- **Adjuntos subidos al chat**: poder abrirlos y editarlos en Collabora vía un
  **nuevo scope WOPI para `chat_attachments`**, con RBAC por membresía de
  conversación.
- Menú contextual coherente (mismo componente `@atlas/ui`) en las tres superficies
  (tile de adjunto, tile de referencia, tarjeta del visor).

## 3. No-objetivos (YAGNI)

- Co-edición en tiempo real de un adjunto de chat por varios usuarios más allá de
  lo que Collabora ya da por sí solo (lock WOPI de 30 min).
- Historial de versiones visible en la UI del chat (se guardan filas de versión en
  BD para poder revertir/reconciliar, pero sin pantalla).
- Crear adjuntos de chat "en blanco" desde un botón Nuevo (igual que en `atlas.files`,
  solo se editan existentes).
- Editar adjuntos subidos por **invitados** o de conversaciones a las que el usuario
  ya no pertenece (se puede ver/descargar, no editar).
- Editar imágenes/PDF/media en Office (solo formatos Office: docx/xlsx/pptx/csv +
  binarios heredados, según el catálogo de
  [`office-formats.js`](../../../packages/core/src/office-formats.js)).

## 4. Arquitectura y entrega incremental

Tres entregables. **Plan B1 no depende de backend y puede salir primero.**

```
Plan B1 (UI, sin backend)  ── referencias atlas.files + AdvancedFileViewer CTA
Plan A  (backend)          ── scope WOPI para chat_attachments
Plan B2 (UI, requiere A)   ── adjuntos de chat → editor
```

### 4.1 Plan B1 — Acciones Office para referencias `atlas.files` (sin backend)

**Superficie compartida.** Nuevo helper en el módulo chat,
`lib/officeFileActions.js`:

```js
import { getOfficeFormat } from "@atlas/core";

// Devuelve las entradas de menú Office para un archivo que YA es un FileAsset
// (referencia de entidad o el propio visor de atlas.files). `office` es el
// contexto de useOfficeActions(); `fileAssetId` es el id del FileAsset.
export function buildFileAssetOfficeActions({ office, fileAssetId, file, signedUrl }) {
  const items = [];
  const officeCapable = office?.enabled && fileAssetId && getOfficeFormat(file);
  if (officeCapable) {
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
    disabled: !signedUrl,
    onSelect: () => signedUrl && window.open(signedUrl, "_blank", "noopener,noreferrer"),
  });
  return items;
}
```

`getOfficeFormat(file)` necesita `{ originalName|fileName, mimeType }`. Las
referencias llevan `ref.title` + `ref.mimeType` → se mapea a
`{ fileName: ref.title, mimeType: ref.mimeType }`.

**`FileReferenceGroup.jsx`**: envolver cada tile (imagen y no-imagen) en el
`ContextMenu` de `@atlas/ui` (el mismo que ya usan las filas de conversación —
[[project_atlas_chat]]). El menú incluye `buildFileAssetOfficeActions(...)` +
"Descargar" (ya existe `downloadViaBlob`). Para el tile no-imagen, además, un
botón visible pequeño ("Abrir en Office" / kebab) cuando `officeCapable`.
La firma de clic normal (`onOpen` → visor conversación) no cambia.

**`AdvancedFileViewer.jsx`**: la rama "genérico (sin vista previa)"
(`kind !== image|pdf|video|audio`) pasa a:
- Si `props.onOpenInOffice` está definido **y** `getOfficeFormat(file)` resuelve:
  mostrar botón primario "Abrir en editor de Office" que llama
  `onOpenInOffice(file)` y cierra el visor.
- Mantener "Descargar" y "Abrir en pestaña nueva" como secundarios.
- Nueva prop opcional `onOpenInOffice?: (file) => void`. Cuando no se pasa
  (llamadas actuales), el comportamiento es el de hoy.

**Cableado de `onOpenInOffice`:**
- [`FilesScreen.jsx`](../../../apps/desktop/src/modules/atlas.files/screens/FilesScreen.jsx):
  ya enruta formatos Office a `office.open()` en `openViewer` **antes** de abrir el
  visor, así que además pasa `onOpenInOffice={(f) => office.open(f.id)}` al
  `AdvancedFileViewer` para el caso en que un archivo llegue al visor igualmente
  (multi-archivo, navegación con flechas).
- `EntityFileViewer.jsx`: acepta y reenvía `onOpenInOffice`. El caller del chat
  (`ChatWindow`/`MiniChatWindow`, donde se monta `EntityFileViewer`) lo define como
  `(f) => office.open(f.id)` usando `useOfficeActions()`.

**Permisos:** abrir una referencia en Office usa el flujo existente
(`POST /files/:id/office/session` → `office/access.js`), que exige
`files.assets.read` (y `files.assets.update` para editar). Si el usuario del chat
no los tiene, la acción Office no se muestra (`office.enabled`/`office.canEdit` ya
lo reflejan) y, si aún así llega, el backend responde 403 controlado.

**`@atlas/ui`:** si el `ContextMenu` actual no cubre el caso de "envolver un tile
arbitrario", reutilizar el que ya existe (`ContextMenu` + `ContextMenuTrigger`
`asChild`). No se añade componente nuevo salvo que falte; documentar en
`docs/ai-context/ame3-runtime-capabilities.md` si se añade.

### 4.2 Plan A — Scope WOPI para `chat_attachments`

**Migración** `prisma/migrations/<ts>_chat_attachment_office/migration.sql`
(forward-only; AME3/no-AME3: `chat_attachments` es tabla core, va en `schema.prisma`):

```sql
ALTER TABLE "chat_attachments"
  ADD COLUMN "content_revision"        INT         NOT NULL DEFAULT 1,
  ADD COLUMN "checksum"                TEXT,
  ADD COLUMN "office_lock"             TEXT,
  ADD COLUMN "office_lock_expires_at"  TIMESTAMPTZ;

CREATE TABLE "chat_attachment_versions" (
  "id"             UUID        NOT NULL DEFAULT uuidv7(),
  "attachment_id"  UUID        NOT NULL,
  "revision"       INT         NOT NULL,
  "bucket"         TEXT        NOT NULL,
  "object_key"     TEXT        NOT NULL,
  "file_name"      TEXT        NOT NULL,
  "mime_type"      TEXT        NOT NULL,
  "size_bytes"     BIGINT      NOT NULL DEFAULT 0,
  "checksum"       TEXT,
  "created_at"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "chat_attachment_versions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "chat_attachment_versions_att_fkey"
    FOREIGN KEY ("attachment_id") REFERENCES "chat_attachments"("id") ON DELETE CASCADE
);
CREATE INDEX "chat_attachment_versions_att_idx"
  ON "chat_attachment_versions" ("attachment_id", "revision" DESC);
```

`schema.prisma`: añadir los 4 campos a `model ChatAttachment` y el nuevo
`model ChatAttachmentVersion` (Prisma-managed; **no** es tabla AME3).

**`office/access.js` — nueva función `authorizeChatAttachment`:**

```
authorizeChatAttachment({ authUserId, attachmentId, mode }) ->
  { source: 'chat_attachment', attachment, profile, companyId, format }
```

- `attachmentId` valida contra `OFFICE_FILE_ID` (UUID).
- Carga `chat_attachments` + su `chat_conversations` (para `company_id`).
- El perfil debe ser **miembro activo** de la conversación:
  `chat_conversation_members WHERE conversation_id = ? AND user_id = profile.id AND left_at IS NULL`.
- `mode === 'view'` → basta ser miembro. `mode === 'edit'` → miembro **con rol
  distinto de `guest`/viewer** (mismo criterio que "puede enviar mensajes" en la
  conversación; reutilizar `chatPermissionsService.assertChannelPermission` /
  `getMemberRole` si está disponible desde este servicio, o replicar el check
  mínimo: rol ∈ {owner, admin, member}).
- Rechazar si `attachment.uploaded_by_guest_id` no es null **y** `mode === 'edit'`
  (editar sobre un original subido por invitado queda fuera de alcance; ver sí).
- `format = getOfficeFormat({ originalName: attachment.file_name, mimeType: attachment.mime_type })`.
  Si null / `size_bytes > 10 MB` / bucket != 'atlas-chat' → `OfficeError 415/413`.
- El `entityType`-allowlist actual de `authorize` (FileAsset) **no** se toca; esta
  es una ruta paralela.

**`office/service.js` — hacerlo agnóstico del origen.** Hoy asume
`prisma.fileAsset` + `fileAssetVersion` + bucket implícito del `file`. Cambios:

- `createSession({ authUserId, fileId, mode, origin, source = 'file_asset' })`:
  si `source === 'chat_attachment'` → `access.authorizeChatAttachment(...)` y
  `wopiSrc = ${config.wopiUrl}/wopi/files/chat:${attachmentId}` (prefijo que la
  ruta WOPI sabe desmultiplexar), `fileName = attachment.file_name`.
- `authenticate` / `checkFileInfo` / `getFile` / `putFile` / `lock`: extraer el
  acceso a la fila y al storage a un pequeño **adaptador** por origen:

  ```js
  const backends = {
    file_asset: {
      load: (db, id) => db.fileAsset.findUnique(...),
      bucketOf: (row) => row.bucket,
      keyOf: (row) => row.objectKey,
      revisionOf: (row) => row.contentRevision,
      lockOf: (row) => row.officeLock, lockExpOf: (row) => row.officeLockExpiresAt,
      writeVersion: (db, row) => db.fileAssetVersion.create({ ... }),
      commit: (db, id, { objectKey, checksum, sizeBytes }) =>
        db.fileAsset.update({ where: { id }, data: { objectKey, checksum, sizeBytes, contentRevision: { increment: 1 } } }),
      audit: (...) => db.auditLog.create({ ..., moduleKey: 'atlas.files' }),
    },
    chat_attachment: {
      load: (db, id) => db.chatAttachment.findUnique({ where: { id }, include: { conversation: true } }),
      bucketOf: (row) => row.bucket,           // 'atlas-chat'
      keyOf: (row) => row.objectKey,
      revisionOf: (row) => row.contentRevision,
      lockOf: (row) => row.officeLock, lockExpOf: (row) => row.officeLockExpiresAt,
      writeVersion: (db, row) => db.chatAttachmentVersion.create({ ... }),
      commit: (db, id, { objectKey, checksum, sizeBytes }) =>
        db.chatAttachment.update({ where: { id }, data: { objectKey, checksum, sizeBytes, contentRevision: { increment: 1 } } }),
      audit: (...) => db.auditLog.create({ ..., moduleKey: 'atlas.chat', entityType: 'ChatAttachment' }),
    },
  };
  ```

- `putFile` sube el nuevo `objectKey` al **bucket del origen**
  (`office/${companyId}/${attachmentId}/<rand>.<ext>` dentro de `atlas-chat` para
  chat), guarda fila de versión con el `object_key` anterior, `contentRevision++`.
- `validateOfficeDocument(bytes, format)` ya despacha por `format.kind`
  (spec de identidad de tipos) — sin cambios.
- `withFileLock` hace `SELECT ... FOR UPDATE` sobre `file_asset`; añadir variante
  sobre `chat_attachments` por id.
- El lock de 30 min y el compare-and-swap por `contentRevision`/`objectKey` se
  reutilizan tal cual vía el adaptador.
- **Coherencia con el resto del chat:** cuando `putFile` de un `chat_attachment`
  confirma, emitir un broadcast `chat:conv:<id>` `attachment_updated`
  `{ attachmentId, revision }` para que los clientes refresquen la URL firmada
  (invalida `["chat-attachment-url", id]`), y el signed-url cache de
  `chat-attachments-service.js` debe key-ear por `object_key` (ya lo hace) → la
  nueva key entra sola.

**Ruta WOPI.** [`apps/api/src/routes/office.js`](../../../apps/api/src/routes/office.js)
monta `/wopi/files/:id`. Aceptar `:id` con forma `chat:<uuid>` → `source='chat_attachment'`,
id = `<uuid>`; sin prefijo → `source='file_asset'` (comportamiento actual). El
token WOPI (`office/tokens.js`) ya lleva `fileId`; añadir `source` a los claims y
validarlo en `authenticate`.

**Endpoint de sesión.** Nuevo:
`POST /chat/attachments/:id/office/session` (en el router de chat), body `{ mode }`,
delega en `officeService.createSession({ authUserId, fileId: id, mode, source: 'chat_attachment', origin })`.
Requiere sesión de usuario (no invitado). Devuelve el mismo shape que
`createOfficeSession` de `atlas.files`.

**SDK.** `@atlas/sdk`: `client.chat.createAttachmentOfficeSession(id, mode, token)`.

**Tests (`node --test`):**
- `office/access.authorizeChatAttachment`: miembro activo (view/edit ok), no-miembro
  (403), miembro que dejó la conversación (403), rol guest en edit (403), original
  de invitado en edit (403), formato no-Office (415), > 10 MB (413).
- `office/service` con `source: 'chat_attachment'`: `createSession` arma `WOPISrc`
  con `chat:<id>`; `checkFileInfo` devuelve `BaseFileName = file_name`;
  `putFile` sube al bucket `atlas-chat`, crea fila `chat_attachment_versions`,
  incrementa `content_revision`, respeta el lock (conflicto 409 sin lock).
- Ruta WOPI: `/wopi/files/chat:<uuid>` resuelve al backend chat; `/wopi/files/<uuid>`
  sigue resolviendo a `file_asset`.
- Token: claims con `source` mal emparejado → 401.

**Seguridad — ejecutar `/security-review` antes del merge de Plan A.**

| Amenaza | Mitigación |
|---|---|
| Usuario no miembro abre/edita un adjunto de otra conversación | `authorizeChatAttachment` exige membresía activa; edit exige rol no-guest. |
| Confusión de origen (token de `file_asset` reусado para `chat:`) | `source` en los claims del token WOPI y verificación cruzada en `authenticate`. |
| Escribir en el bucket equivocado / sobre el original | `putFile` escribe siempre una key nueva bajo `office/<company>/<att>/…` en el bucket del origen; el original queda como fila de versión. |
| Adjunto de invitado manipulado por operador vía Office | edit bloqueado si `uploaded_by_guest_id` no es null. |
| Path traversal en `file_name` | `getOfficeFormat` ya rechaza `/ \\ \x00-\x1f`; el `object_key` se genera server-side. |
| Bytes no-Office colados al editor | `validateOfficeDocument` por `kind` (ZIP OOXML / magic CFBF / UTF-8). |
| Adjunto ya borrado (mensaje eliminado, cascade) | `load` devuelve null → `OfficeError 404`. |

### 4.3 Plan B2 — Adjuntos de chat en el editor (requiere Plan A)

**`OfficeProvider.jsx`**: añadir `openChatAttachment(id)` al value del contexto →
`navigate('/app/m/atlas.chat/chat/attachment/' + encodeURIComponent(id) + '/edit', { state: { officeReturnTo: location.pathname } })`.

**Nueva pantalla** `apps/desktop/src/modules/atlas.chat/screens/ChatOfficeEditorScreen.jsx`
(gemela de [`OfficeEditorScreen.jsx`](../../../apps/desktop/src/modules/atlas.files/screens/OfficeEditorScreen.jsx)):
monta `<OfficeDocumentEditor>` con `createSession` que llama
`atlas.chat.createAttachmentOfficeSession(id, mode, token)` y `onClose` que vuelve a
`officeReturnTo`. Registrar la ruta en el router del módulo chat.

**`MessageAttachments.jsx` — `buildAttachmentActions({ att, url, office })`**:
añadir, cuando `office?.enabled && getOfficeFormat({ fileName: att.fileName, mimeType: att.mimeType })`:

```js
items.unshift({
  key: "att-office",
  label: office.canEdit ? "Abrir en editor de Office" : "Abrir en Office (solo lectura)",
  icon: FilePenLine,
  onSelect: () => office.openChatAttachment(att.id),
});
```

`FileCard` gana un `ContextMenu` (`@atlas/ui`) que envuelve el tile con estas
acciones (hoy `FileCard` no tiene menú, solo botón descargar). El `onClick` normal
(→ `onOpen` → `ChatAttachmentViewer`) no cambia.

**`ChatAttachmentViewer.jsx`**: pasar `onOpenInOffice={(f) => office.openChatAttachment(f.id)}`
al `AdvancedFileViewer` (usa `useOfficeActions()`), pero **solo** para entradas que
NO son `isEntityRef` (las `isEntityRef` van por `office.open`). Es decir el viewer
recibe una función que decide por `file.isEntityRef`.

**Permiso de chat.** `office.canEdit` hoy se deriva de `files.assets.update`. Para
adjuntos de chat el gate real es la membresía + rol (backend). El frontend puede
mostrar "Abrir en editor" siempre que `office.enabled` y el formato calce, y dejar
que el backend degrade a solo-lectura o 403; o exponer desde `OfficeProvider` un
`canEditChat` genérico (true si el usuario tiene sesión). Decisión de Plan B2:
mostrar la acción si `office.enabled` + formato; la etiqueta usa `office.canEdit`
solo como heurística de texto.

## 5. Flujo de datos

### Abrir un `.xlsx` adjunto al chat (Plan A + B2)

```
long-press en FileCard -> ContextMenu -> "Abrir en editor de Office"
  -> office.openChatAttachment(att.id)
  -> navigate /app/m/atlas.chat/chat/attachment/:id/edit
  -> ChatOfficeEditorScreen -> OfficeDocumentEditor.createSession
  -> POST /chat/attachments/:id/office/session { mode:'auto' }
  -> officeService.createSession({ source:'chat_attachment', fileId:id })
       -> access.authorizeChatAttachment -> miembro activo + rol -> format
       -> provider.createSession (WOPISrc = .../wopi/files/chat:<id>)
       -> tokens.issue (claims.source = 'chat_attachment')
  -> iframe Collabora -> CheckFileInfo -> GetFile
       -> authenticate (valida source) -> backend.load -> storage.download('atlas-chat', key)
       -> validateOfficeDocument(bytes, format)  // kind = ooxml
  -> editar -> PutFile -> lock/compare-and-swap -> subir nueva key en atlas-chat
       -> chat_attachment_versions += fila; content_revision++
       -> broadcast chat:conv:<id> attachment_updated
  -> cliente invalida ["chat-attachment-url", id] -> nueva URL firmada
```

## 6. Manejo de errores

| Caso | Comportamiento |
|---|---|
| Adjunto no-Office (imagen, zip) | La acción "Abrir en editor" no se muestra (`getOfficeFormat` null). |
| Usuario perdió la membresía de la conversación | `authorizeChatAttachment` → `OfficeError 403`; la pantalla del editor muestra "Office no disponible / sin acceso" con volver. |
| Adjunto de invitado, modo edit | 403 `unsupported_scope`; el frontend reintenta en `mode:'view'` (solo lectura) automáticamente (igual que `createSession` con `mode:'auto'` ya hace el fallback view). |
| Collabora no disponible | 503 ya manejado por `OfficeDocumentEditor` (retry / descargar). |
| Guardado con lock ajeno / revisión cambiada | 409 `lockConflict` ya manejado (mensaje "vuelve a intentar / descarga copia"). |
| Mensaje (y su adjunto) eliminado mientras se edita | La sesión expira / `load` null → 404; el editor pide cerrar y descargar copia. |
| Referencia `atlas.files` sin `files.assets.read` | La acción Office no aparece; `EntityFileViewer` sigue mostrando descarga/abrir. |

## 7. Pruebas

**Plan B1:** sin infra de test de componentes nueva. `node --check` + `pnpm build`
+ `pnpm lint`. QA: en un mensaje con una referencia `.docx`/`.xlsx`, clic derecho →
"Abrir en editor de Office" abre Collabora; en el visor, la tarjeta genérica de un
`.docx` muestra el CTA; "Abrir en pestaña nueva" y "Descargar" funcionan; 390/1440.

**Plan A:** tests `node --test` enumerados en §4.2. Suite completa de
`apps/api/src/routes/chat/**` y `apps/api/src/services/__tests__/office-*` verde.
`pnpm db:migrate` en local; `pnpm lint`. `/security-review`.

**Plan B2:** `node --check` + `pnpm build` + `pnpm lint`. QA end-to-end: subir un
`.xlsx` al chat, abrirlo en el editor desde el tile y desde el visor, editar,
guardar, cerrar, ver el tile refrescado; repetir en 390/1440; probar con un
usuario sin permiso (degrada a solo lectura o mensaje claro); probar un adjunto de
invitado (solo lectura).

## 8. Archivos afectados (resumen)

**Plan B1 — UI, sin backend**
- `apps/desktop/src/modules/atlas.chat/lib/officeFileActions.js` (nuevo)
- `apps/desktop/src/modules/atlas.chat/components/FileReferenceGroup.jsx`
- `apps/desktop/src/modules/atlas.chat/components/EntityFileViewer.jsx`
- `apps/desktop/src/modules/atlas.files/components/AdvancedFileViewer.jsx` (prop `onOpenInOffice`)
- `apps/desktop/src/modules/atlas.files/screens/FilesScreen.jsx` (pasar `onOpenInOffice`)
- caller de `EntityFileViewer` en `ChatWindow`/`MiniChatWindow` (pasar `onOpenInOffice`)
- `docs/ai-context/ame3-runtime-capabilities.md` (si se añade algo a `@atlas/ui`)

**Plan A — backend**
- `prisma/schema.prisma` (+ `ChatAttachmentVersion`, 4 campos en `ChatAttachment`)
- `prisma/migrations/<ts>_chat_attachment_office/migration.sql` (nuevo)
- `apps/api/src/services/office/access.js` (`authorizeChatAttachment`)
- `apps/api/src/services/office/service.js` (adaptador por origen)
- `apps/api/src/services/office/tokens.js` (claim `source`)
- `apps/api/src/routes/office.js` (WOPI id `chat:<uuid>`)
- `apps/api/src/routes/chat/index.js` + un `chat-office-routes.js` (endpoint sesión)
- `packages/sdk/src/*` (`chat.createAttachmentOfficeSession`)
- Tests: `apps/api/src/services/__tests__/office-*.test.js`, `apps/api/src/routes/chat/__tests__/*`

**Plan B2 — UI, requiere Plan A**
- `apps/desktop/src/providers/OfficeProvider.jsx` (`openChatAttachment`)
- `apps/desktop/src/modules/atlas.chat/screens/ChatOfficeEditorScreen.jsx` (nuevo) + router del módulo
- `apps/desktop/src/modules/atlas.chat/components/MessageAttachments.jsx` (`buildAttachmentActions` + `ContextMenu` en `FileCard`)
- `apps/desktop/src/modules/atlas.chat/components/ChatAttachmentViewer.jsx` (`onOpenInOffice` selectivo)

## 9. Preguntas abiertas

- ¿El `chatPermissionsService` es accesible desde `office/access.js` sin crear un
  ciclo de dependencias? Si no, replicar el check mínimo de rol (miembro con rol ∈
  {owner, admin, member}) con una query directa. — se resuelve al abrir el archivo
  en Plan A.
- ¿Collabora del entorno self-hosted permite `WOPISrc` con `:` en el path
  (`/wopi/files/chat:<uuid>`)? Alternativa segura: `/wopi/files/chat-<uuid>` o un
  query param. Verificar en QA de Plan A; si falla, usar separador `-` y ajustar el
  regex de la ruta.
- ¿Merece la pena que Plan B1 y B2 compartan un único `ContextMenu` wrapper nuevo en
  `@atlas/ui` (`<FileTileContextMenu items=…>`)? Decidir al implementar B1; si tres
  o más superficies lo repiten, extraerlo.
