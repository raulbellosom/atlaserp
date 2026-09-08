# Plan A — Scope WOPI para adjuntos de chat (backend)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que un adjunto subido directo al chat (`chat_attachments`, bucket `atlas-chat`) se pueda abrir y editar en Collabora vía WOPI, con RBAC por membresía de conversación, sin tocar el flujo `FileAsset` existente.

**Architecture:** Migración que da a `chat_attachments` las columnas WOPI (`content_revision`/`checksum`/`office_lock`/`office_lock_expires_at`) + tabla `chat_attachment_versions`. `office/access.js` gana `authorizeChatAttachment`. `office/service.js` se vuelve agnóstico del origen con un adaptador `{ file_asset, chat_attachment }`. La ruta WOPI acepta `id` con forma `chat:<uuid>`. Nuevo `POST /chat/attachments/:id/office/session`.

**Tech Stack:** Node.js ESM, Prisma 7, Hono, Collabora WOPI, `node --test`.

**Spec:** `docs/superpowers/specs/2026-09-08-chat-open-files-in-office-design.md` §4.2. **Depende de:** el `getOfficeFormat` con `kind` y `validateOfficeDocument` por kind, ya en `main`.

---

## Contexto para quien implementa

- `chat_attachments` (migración `20260625000000_add_chat_tables`): `id, message_id NOT NULL (FK chat_messages ON DELETE CASCADE), conversation_id, bucket DEFAULT 'atlas-chat', object_key, file_name, mime_type, size_bytes, width, height, uploaded_by_user_id, uploaded_by_guest_id, created_at`. **Sin** revisión/checksum/lock.
- `office/service.js` hoy: `createSession/authenticate/checkFileInfo/getFile/download/readFile/lock/putFile`. Todo `access` = `createOfficeAccess({ prisma })`; `readFile` lee `supabaseAdmin.storage.from(file.bucket).download(file.objectKey)`; `putFile` sube key nueva, crea `db.fileAssetVersion`, `contentRevision:{increment:1}`; `withFileLock` hace `SELECT ... FROM file_asset ... FOR UPDATE`.
- `office/access.js` `authorize` valida un allowlist de `entityType` para `FileAsset`. **No se toca.**
- `office/tokens.js` emite/valida un JWT con `{ authUserId, fileId, companyId, profileId, mode, hostOrigin }`.
- `office/discovery.js` `createSession({ file, mode, wopiSrc })` sólo usa `file.originalName`+`file.mimeType` (vía `getOfficeFormat`) y `wopiSrc`. Agnóstico ya.
- Ruta WOPI: `apps/api/src/routes/office.js`, monta `/wopi/files/:id` + acciones.
- Prisma es `^7`; migraciones aplicadas son inmutables — crear **una nueva** migración forward.
- Membresía de conversación: tabla `chat_conversation_members (conversation_id, user_id, guest_session_id, role, left_at)`. Rol activo = `left_at IS NULL`. Roles: `owner|admin|member|guest` (ver `chat-permissions-service.js`).

---

## Task 1: Migración + modelos Prisma

**Files:**
- Create: `prisma/migrations/20260908120000_chat_attachment_office/migration.sql`
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Escribir la migración**

```sql
-- chat_attachments: WOPI/Office editing columns
ALTER TABLE "chat_attachments"
  ADD COLUMN "content_revision"       INTEGER     NOT NULL DEFAULT 1,
  ADD COLUMN "checksum"               TEXT,
  ADD COLUMN "office_lock"            TEXT,
  ADD COLUMN "office_lock_expires_at" TIMESTAMPTZ;

CREATE TABLE "chat_attachment_versions" (
  "id"            UUID        NOT NULL DEFAULT uuidv7(),
  "attachment_id" UUID        NOT NULL,
  "revision"      INTEGER     NOT NULL,
  "bucket"        TEXT        NOT NULL,
  "object_key"    TEXT        NOT NULL,
  "file_name"     TEXT        NOT NULL,
  "mime_type"     TEXT        NOT NULL,
  "size_bytes"    BIGINT      NOT NULL DEFAULT 0,
  "checksum"      TEXT,
  "created_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "chat_attachment_versions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "chat_attachment_versions_att_fkey"
    FOREIGN KEY ("attachment_id") REFERENCES "chat_attachments"("id") ON DELETE CASCADE
);
CREATE INDEX "chat_attachment_versions_att_idx"
  ON "chat_attachment_versions" ("attachment_id", "revision" DESC);
```

- [ ] **Step 2: `schema.prisma` — añadir campos a `ChatAttachment`**

Localizar `model ChatAttachment` y añadir (nombres de campo camelCase con `@map`):

```prisma
  contentRevision      Int       @default(1) @map("content_revision")
  checksum             String?
  officeLock           String?   @map("office_lock")
  officeLockExpiresAt  DateTime? @map("office_lock_expires_at")
  officeVersions       ChatAttachmentVersion[]
```

- [ ] **Step 3: `schema.prisma` — nuevo modelo**

```prisma
model ChatAttachmentVersion {
  id           String   @id @default(dbgenerated("uuidv7()")) @db.Uuid
  attachmentId String   @map("attachment_id") @db.Uuid
  revision     Int
  bucket       String
  objectKey    String   @map("object_key")
  fileName     String   @map("file_name")
  mimeType     String   @map("mime_type")
  sizeBytes    BigInt   @default(0) @map("size_bytes")
  checksum     String?
  createdAt    DateTime @default(now()) @map("created_at") @db.Timestamptz(6)

  attachment   ChatAttachment @relation(fields: [attachmentId], references: [id], onDelete: Cascade)

  @@index([attachmentId, revision(sort: Desc)])
  @@map("chat_attachment_versions")
}
```

(Ajustar `@id`/`@db.Uuid` al patrón que use el resto de `schema.prisma` para PKs uuidv7 — copiar de un modelo vecino como `ChatAttachment` mismo.)

- [ ] **Step 4: Generar + migrar (local)**

Run: `pnpm db:generate && pnpm db:migrate`
Expected: cliente regenerado, migración aplicada. Si el entorno no tiene DB, dejar anotado y `pnpm db:generate` igualmente para que el cliente tenga `chatAttachmentVersion`.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260908120000_chat_attachment_office/
git commit -m "feat(chat): chat_attachments gains WOPI columns + versions table"
```

---

## Task 2: `authorizeChatAttachment` en `office/access.js`

**Files:**
- Modify: `apps/api/src/services/office/access.js`
- Create: `apps/api/src/services/__tests__/office-chat-access.test.js`

- [ ] **Step 1: Test primero**

`office-chat-access.test.js` — fixture con `prisma` mock (patrón de `office-fixture.js`): un `chatAttachment.findUnique` que devuelve `{ id, conversationId, bucket:'atlas-chat', objectKey, fileName:'plan.xlsx', mimeType: OFFICE_FORMATS.xlsx.mimeType, sizeBytes: 2048, uploadedByGuestId: null, contentRevision:1, conversation: { companyId } }`; `userProfile.findUnique` → perfil habilitado; un `$queryRaw` para membresía que devuelve `[{ role: 'member', left_at: null }]`. Casos:
- miembro activo, `mode:'view'` y `mode:'edit'` → resuelve con `format.kind==='ooxml'`, `source:'chat_attachment'`.
- membresía vacía → `OfficeError 403`.
- `left_at` no null → 403.
- `role:'guest'` + `mode:'edit'` → 403; `mode:'view'` ok.
- `uploadedByGuestId` no null + `mode:'edit'` → 403.
- `mimeType:'image/png'` → 415.
- `sizeBytes: 11*1024*1024` → 413.
- `chatAttachment.findUnique` → null → 404.

- [ ] **Step 2: Implementar**

En `createOfficeAccess({ prisma })` añadir y exportar `authorizeChatAttachment`:

```js
async function authorizeChatAttachment({ authUserId, attachmentId, mode = 'view' }, db = prisma) {
  if (!OFFICE_FILE_ID.test(attachmentId)) throw new OfficeError('Identificador inválido.', 400, 'invalid_file_id');
  const profile = await db.userProfile.findUnique({ where: { authUserId } });
  if (!profile?.enabled) throw new OfficeError('No tienes acceso.', 403, 'forbidden');
  const att = await db.chatAttachment.findUnique({
    where: { id: attachmentId },
    include: { conversation: true },
  });
  if (!att) throw new OfficeError('Adjunto no encontrado.', 404, 'file_not_found');
  const companyId = att.conversation?.companyId;
  if (!companyId) throw new OfficeError('No tienes acceso.', 403, 'forbidden');
  const rows = await db.$queryRaw`
    SELECT role FROM chat_conversation_members
    WHERE conversation_id = ${att.conversationId}::uuid
      AND user_id = ${profile.id}::uuid
      AND left_at IS NULL
    LIMIT 1
  `;
  const role = rows[0]?.role;
  if (!role) throw new OfficeError('No perteneces a esta conversación.', 403, 'forbidden');
  if (mode === 'edit') {
    if (!['owner', 'admin', 'member'].includes(role)) throw new OfficeError('Solo lectura en esta conversación.', 403, 'read_only');
    if (att.uploadedByGuestId) throw new OfficeError('Este archivo lo subió un invitado; solo lectura.', 403, 'unsupported_scope');
  }
  const format = getOfficeFormat({ originalName: att.fileName, mimeType: att.mimeType });
  if (!format || att.bucket !== 'atlas-chat') throw new OfficeError('Formato o almacenamiento no compatible.', 415, 'unsupported_format');
  if (Number(att.sizeBytes) > 10 * 1024 * 1024) throw new OfficeError('El archivo supera 10 MB.', 413, 'file_too_large');
  return { source: 'chat_attachment', attachment: att, file: att, profile, companyId, format };
}
```

`return` de `createOfficeAccess` pasa a `{ authorize, authorizeChatAttachment }`.

- [ ] **Step 3: Run test**

Run: `node --test apps/api/src/services/__tests__/office-chat-access.test.js`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/services/office/access.js apps/api/src/services/__tests__/office-chat-access.test.js
git commit -m "feat(office): authorizeChatAttachment — conversation-membership RBAC"
```

---

## Task 3: `office/service.js` agnóstico del origen

**Files:**
- Modify: `apps/api/src/services/office/service.js`
- Modify: `apps/api/src/services/office/tokens.js`
- Create/extend: `apps/api/src/services/__tests__/office-chat-wopi.test.js`

- [ ] **Step 1: `tokens.js` — claim `source`**

`issue(...)` acepta y firma `source` (default `'file_asset'`); `validate(token, fileId)` devuelve `claims.source`. Añadir a los tests existentes de tokens un caso `source` round-trip.

- [ ] **Step 2: `service.js` — adaptador por origen**

Definir `const backends = { file_asset: {...}, chat_attachment: {...} }` como en el spec §4.2 (load / bucketOf / keyOf / revisionOf / lockOf / lockExpOf / writeVersion / commit / audit). `version(row, source)` usa `revisionOf`. `activeLock` usa `lockOf`/`lockExpOf`.

- [ ] **Step 3: `createSession` acepta `source`**

```js
async function createSession({ authUserId, fileId, mode = 'auto', origin, source = 'file_asset' }) {
  ...
  const authorize = source === 'chat_attachment' ? access.authorizeChatAttachment : access.authorize;
  const idKey = source === 'chat_attachment' ? 'attachmentId' : 'fileId';
  let context = await authorize({ authUserId, [idKey]: fileId, mode: mode === 'auto' ? 'view' : mode });
  // ... mismo fallback auto view->edit, capturando 403 ...
  const wopiId = source === 'chat_attachment' ? `chat:${fileId}` : fileId;
  const [editor, token] = await Promise.all([
    provider.createSession({ file: context.file, mode, wopiSrc: `${config.wopiUrl}/wopi/files/${wopiId}` }),
    tokens.issue({ authUserId, fileId, companyId: context.companyId, profileId: context.profile.id, mode, hostOrigin, source }),
  ]);
  await backends[source].audit(prisma, context, 'office.document.opened', { mode });
  return { ...editor, ...token, fileId, fileName: context.file.fileName ?? context.file.originalName, mode };
}
```

- [ ] **Step 4: `authenticate` valida `source` y usa el backend**

`authenticate({ fileId, token, source, write })`: `claims = await tokens.validate(token, fileId)`; si `claims.source !== (source ?? 'file_asset')` → `OfficeError 401 'session_expired'`. Luego `authorize`/`authorizeChatAttachment` según `claims.source`. `readFile`/`putFile`/`lock` piden `backends[claims.source]`.

- [ ] **Step 5: `readFile` / `putFile` / `withFileLock` por backend**

`readFile({ file, format, source })` → `supabaseAdmin.storage.from(backend.bucketOf(file)).download(backend.keyOf(file))`. `putFile`: `objectKey = office/${companyId}/${context.file.id}/${rand}.${format.extension}` subido a `backend.bucketOf`; `backend.writeVersion(db, current.file)`; `backend.commit(db, id, { objectKey, checksum, sizeBytes })`. `withFileLock(id, fn, source)` → `SELECT id FROM chat_attachments WHERE id = ${id}::uuid FOR UPDATE` cuando `source==='chat_attachment'`.

- [ ] **Step 6: broadcast tras `putFile` de chat**

`createOfficeService` acepta `broadcaster` opcional. Tras commit exitoso con `source==='chat_attachment'`:
`broadcaster?.broadcastToChannel(\`chat:conv:${context.attachment.conversationId}\`, 'attachment_updated', { attachmentId: context.file.id, revision: saved.contentRevision })`.
(El wiring del `broadcaster` en `apps/api/src/index.js` donde se instancia `createOfficeService` — pasar el mismo broadcaster que usa chat.)

- [ ] **Step 7: Tests**

`office-chat-wopi.test.js`: fixture con `chatAttachment` + `chatAttachmentVersion` mock + storage mock bucket `atlas-chat`.
- `createSession({ source:'chat_attachment' })` → `editorUrl` con `WOPISrc` que contiene `chat:<id>`; `accessToken` no aparece en la URL.
- `checkFileInfo` → `BaseFileName === att.fileName`, `Size === sizeBytes`.
- `getFile` → devuelve bytes del bucket `atlas-chat`.
- `putFile` con lock válido → sube key bajo `office/…` en `atlas-chat`, crea fila en `chatAttachmentVersion`, `contentRevision` 1→2; sin lock → 409.
- token con `source` cruzado (`file_asset` para un `chat:` fileId) → 401.
- **Regresión:** todos los tests de `office-wopi.test.js` siguen verdes (source `file_asset` por defecto).

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/services/office/service.js apps/api/src/services/office/tokens.js apps/api/src/services/__tests__/office-chat-wopi.test.js
git commit -m "feat(office): source-agnostic WOPI service (file_asset | chat_attachment)"
```

---

## Task 4: Ruta WOPI acepta `chat:<uuid>`

**Files:**
- Modify: `apps/api/src/routes/office.js`

- [ ] **Step 1: Desmultiplexar `:id`**

En el handler de `/wopi/files/:id` (y sub-rutas `/contents`), al principio:

```js
const raw = c.req.param('id');
const m = /^chat:([0-9a-f-]{36})$/i.exec(raw);
const source = m ? 'chat_attachment' : 'file_asset';
const fileId = m ? m[1] : raw;
```

Pasar `{ ...req, source }` a `officeService.authenticate` / `checkFileInfo` / `getFile` / `putFile` / `lock`. El `OFFICE_FILE_ID` regex se aplica a `fileId` (ya sin prefijo).

- [ ] **Step 2: Si Collabora rechaza `:` en el path**

Fallback: usar `chat-<uuid>` en `createSession` (`wopiId`) y regex `/^chat-([0-9a-f-]{36})$/i` aquí. Decidir en QA (Task 6). Mantener ambas formas aceptadas en el regex por robustez: `/^chat[:-]([0-9a-f-]{36})$/i`.

- [ ] **Step 3: Tests de ruta**

En `office-wopi.test.js` (o el nuevo): `GET /wopi/files/chat:<uuid>` con token válido de chat → 200 CheckFileInfo; `GET /wopi/files/<uuid>` (sin prefijo) sigue 200 para file_asset.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/routes/office.js
git commit -m "feat(office): WOPI route demultiplexes chat:<uuid> ids"
```

---

## Task 5: Endpoint de sesión + SDK

**Files:**
- Create: `apps/api/src/routes/chat/chat-office-routes.js`
- Modify: `apps/api/src/routes/chat/index.js` (montar el sub-router)
- Modify: `packages/sdk/src/*` (cliente `chat.createAttachmentOfficeSession`)
- Test: `apps/api/src/routes/chat/__tests__/chat-office-routes.test.js`

- [ ] **Step 1: Router**

`createChatOfficeRoutes({ officeService })` → Hono router con:

```js
router.post('/attachments/:id/office/session', async (c) => {
  const authUserId = c.get('authUserId'); // set by auth middleware; guests have none
  if (!authUserId) return c.json({ error: 'unauthorized' }, 401);
  const mode = (await c.req.json().catch(() => ({})))?.mode ?? 'auto';
  const origin = c.req.header('origin') ?? undefined;
  try {
    const data = await officeService.createSession({
      authUserId, fileId: c.req.param('id'), mode, origin, source: 'chat_attachment',
    });
    return c.json({ data });
  } catch (e) {
    return c.json({ error: e.code ?? 'error', message: e.message }, e.status ?? 500);
  }
});
```

Montarlo bajo el prefijo del router de chat (`/chat`) en `chat/index.js`, junto a los demás sub-routers.

- [ ] **Step 2: SDK**

En el grupo `chat` del cliente `@atlas/sdk`: `createAttachmentOfficeSession(id, mode, token)` → `POST {base}/chat/attachments/{id}/office/session` con `Authorization: Bearer` y body `{ mode }`, devuelve `res.data`. Mirror de `files.createOfficeSession`.

- [ ] **Step 3: Tests**

`chat-office-routes.test.js`: stub `officeService.createSession`; POST sin auth → 401; con auth → 200 y pasa `source:'chat_attachment'`; error `OfficeError(403)` → status 403.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/routes/chat/chat-office-routes.js apps/api/src/routes/chat/index.js packages/sdk apps/api/src/routes/chat/__tests__/chat-office-routes.test.js
git commit -m "feat(chat): POST /chat/attachments/:id/office/session + SDK"
```

---

## Task 6: Verificación + seguridad

**Files:** ninguno.

- [ ] **Step 1: Suites**

Run: `node --test apps/api/src/services/__tests__/*.test.js && node --test apps/api/src/routes/chat/__tests__/*.test.js`
Expected: verde (los DB-gated se saltan). Sin regresiones en `office-wopi.test.js`.

- [ ] **Step 2: Lint**

Run: `pnpm lint`
Expected: limpio.

- [ ] **Step 3: `/security-review`**

Ejecutar y atender hallazgos en: RBAC de membresía, confusión de origen del token, escritura en bucket, adjunto de invitado, adjunto borrado en vuelo.

- [ ] **Step 4: QA con Collabora real (si disponible)**

Verificar que el `WOPISrc` con `chat:<uuid>` es aceptado por CODE self-hosted; si no, aplicar el fallback `chat-<uuid>` (Task 4 Step 2) y re-test. Abrir un `.xlsx` adjunto, editar, guardar (PutFile), reabrir → contenido y `content_revision` correctos; fila en `chat_attachment_versions`.

- [ ] **Step 5: Commit de fixups**

```bash
git add -A && git commit -m "chore(office): security-review + Collabora QA fixes for chat scope"
```

---

## Self-review

- Spec §4.2: migración+modelos (Task 1), `authorizeChatAttachment` (Task 2), servicio agnóstico (Task 3), ruta WOPI `chat:` (Task 4), endpoint+SDK (Task 5), seguridad (Task 6).
- El flujo `FileAsset` no se toca: `source` default `'file_asset'`, `authorize` intacto, tests de regresión exigidos en Task 3 Step 7 y Task 6 Step 1.
- Consistencia: `source` ∈ {`file_asset`,`chat_attachment`} en `createSession`/`authenticate`/`tokens`/ruta; `backends[source]` con la misma forma de adaptador en todos los métodos.
- `broadcaster` es opcional en `createOfficeService` — si `apps/api/src/index.js` no lo inyecta, el broadcast se omite sin romper (documentado en Task 3 Step 6).
