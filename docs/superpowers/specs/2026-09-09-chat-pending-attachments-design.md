# Chat pending attachments: viewer + orphan cleanup — Design

Date: 2026-09-09
Status: Approved
Modules: `atlas.chat`, `apps/worker`

## Problem

The chat message composer (`MessageComposer.jsx`) uploads every attachment to
Supabase Storage **immediately** when it is added to the queue: `useChatUpload`
calls `POST /chat/attachments/presign`, which inserts a `chat_attachments` row
with `message_id = NULL` and returns a signed upload URL that the client PUTs the
file to right away.

Two consequences:

1. **You cannot preview a pending attachment.** `AttachmentPreviewCard` renders a
   thumbnail with only a "remove" button — no click-to-open. A user who wants to
   check what they are about to send has to send it first.

2. **Removing a pending attachment before send leaks storage.** `removeFile()`
   only drops local React state and revokes the blob URL. It never tells the
   server, so the `chat_attachments` row (`message_id NULL`) and the uploaded
   object both become orphans. Same leak on tab close / conversation switch /
   failed send after a partial upload.

   The existing `DELETE /chat/attachments/:id` (`deleteAttachment`) cannot help:
   it does `INNER JOIN chat_messages m ON m.id = a.message_id`, so a pending
   attachment (`message_id NULL`) yields no row → `404`. It also never deletes
   the storage object in **any** case — even a *sent*-then-deleted attachment
   leaves its object in the `atlas-chat` bucket.

## Goals

- Pending composer attachments open in the shared file viewer, instantly, even
  while still uploading.
- No orphaned `chat_attachments` rows or storage objects from removed / abandoned
  pending uploads.
- `deleteAttachment` always removes the storage object (closes the sent-then-
  deleted leak too).

## Non-goals

- No "resume a draft with attachments across reload" — composer drafts are
  in-memory only and die on reload; there is nothing to protect.
- No change to how attachments are uploaded (still presign + PUT on add).
- No "Open in Office" for pending Office documents (see Part A).
- No retroactive sweep of pre-existing orphan rows beyond what the new worker
  tick does on its normal schedule.

---

## Part A — Open pending composer attachments in the viewer

Frontend only.

### A1. Blob URL for every pending file

`MessageComposer.addFilesToQueue` currently sets `objectUrl` only for
`image/*` and `video/*`. Change it to `URL.createObjectURL(file)` for **every**
file (tracked in `objectUrlsRef` exactly as today). This gives the viewer a
local source to render instantly for PDFs, text, and Office docs too, and rides
the existing revoke paths (`removeFile`, send, unmount).

### A2. Clickable preview cards

`AttachmentPreviewCard` gains an `onOpen(entry)` prop. The card body becomes a
`<button type="button">` (cursor pointer, `aria-label="Ver archivo"`) that calls
`onOpen(entry)`. `RemoveBtn` stays absolutely positioned on top and calls
`e.stopPropagation()` before `onRemove`.

Audio / voice-note cards do **not** get click-to-open (they are played inline in
the bubble after send; there is no viewer treatment for audio in the composer).

### A3. Viewer wiring in `MessageComposer`

- New state: `const [attView, setAttView] = useState({ open: false, index: 0 })`.
- `openPendingViewer(entry)` sets `index` to that entry's position among
  **non-audio** pending files and `open: true`.
- Render `<ChatAttachmentViewer>` with:
  - `attachments` = non-audio `pendingFiles` mapped to the viewer shape:
    `{ id: entry.localId, mimeType: entry.file.type, fileName: entry.file.name,
       sizeBytes: entry.file.size, url: entry.objectUrl }`
  - `resolveUrl={(f) => f.__localUrl ?? f.url ?? null}` (new prop — see A4)
  - `canOpenInOffice={() => false}` and `onOpenInOffice={undefined}`
  - `activeIndex` / `onIndexChange` bound to `attView.index`

### A4. `ChatAttachmentViewer` optional `resolveUrl` override

`ChatAttachmentViewer` currently builds an internal `resolveSignedUrl` that hits
`atlas.chat.getAttachmentSignedUrl` / `atlas.files.getSignedUrl`. Add an optional
prop `resolveUrl`. When provided, it replaces `resolveSignedUrl` verbatim (the
composer passes a synchronous blob-URL resolver, no network). When absent,
behavior is unchanged for every existing caller (`ChatWindow`, `MiniChatWindow`,
`ThreadPanel`, `ConversationMediaTab`).

Also thread the existing `canOpenInOffice` / `onOpenInOffice` props through so
the composer can disable Office. Default them to the current behavior.

Map the composer entries so `AdvancedFileViewer` receives `originalName` +
`sizeBytes` + `thumbnailUrl` (its expected keys) — `ChatAttachmentViewer`
already does this mapping; the blob `url` becomes both `thumbnailUrl` and the
value `resolveUrl` returns.

### A5. Behavior while uploading / on failure

The viewer always shows the **local** copy (blob), so it works mid-upload and
even if the upload later fails. A failed upload is already surfaced by the card's
red error overlay and is excluded from send. No extra handling.

---

## Part B — Orphaned upload cleanup

Three layers. B1 + B3 = Plan A (API + worker). B2 = folded into Plan B (UI).

### B1. `deleteAttachment` handles pending rows and always deletes the object

`apps/api/src/routes/chat/chat-attachments-service.js`.

Rewrite the opening `SELECT` so it does not depend on a linked message:

```sql
SELECT a.id, a.message_id, a.bucket, a.object_key, a.uploaded_by_user_id
FROM chat_attachments a
WHERE a.id = ${attachmentId}
LIMIT 1
```

Then branch:

**Pending branch — `message_id IS NULL`:**
- Authorize: `uploaded_by_user_id === profileId` (the uploader can always discard
  their own un-sent upload). Otherwise `404` ("Archivo no encontrado o sin
  permiso.").
- `supabaseAdmin.storage.from(bucket).remove([object_key])` — log-and-continue
  on `storageError` (mirror `files-service.js`).
- `DELETE FROM chat_attachments WHERE id = ${attachmentId}`.
- Return `{ ok: true, pending: true }`.

**Sent branch — `message_id` present:**
- Re-run the current authorization + message-context query (needs `m.body`,
  `m.attachment_count`, `m.metadata`, `m.sender_user_id = profileId`,
  `m.deleted_at IS NULL`). If no row → `404` (unchanged).
- Keep the existing "last attachment && no body && no entityRefs → soft-delete
  the message (`deleted_at = NOW()`, `body = ''`)" logic.
- Keep the `attachment_count = GREATEST(count - 1, 0)` decrement for the
  non-last case.
- **New in both cases:** after the DB writes,
  `supabaseAdmin.storage.from(bucket).remove([object_key])`, log-and-continue on
  error.
- Return shape unchanged (`{ ok: true, messageDeleted: boolean }`).

`supabaseAdmin` is already injected into `createChatAttachmentsService`.

### B2. Client calls the delete (composer)

`apps/desktop/src/modules/atlas.chat/hooks/useChatUpload.js`: add
`deleteUpload(attachmentId)` → `atlas.chat.deleteAttachment(attachmentId,
session?.access_token)`. (`atlas.chat.deleteAttachment` already exists in the
SDK; no SDK change.)

`MessageComposer`:

- **`removeFile(localId)`** — after removing local state, if the entry has an
  `attachmentId`, fire `deleteUpload(attachmentId).catch(() => {})`
  (fire-and-forget; UI removal stays instant). If the upload promise is still
  in flight (`uploadingRef.current[localId]` exists, no `attachmentId` yet),
  `Promise.resolve(uploadingRef.current[localId]).then(id => id &&
  deleteUpload(id)).catch(() => {})` so a mid-flight upload is cleaned up once
  its id resolves.

- **Unmount / conversation switch** — snapshot `pendingFiles` in a ref
  (`pendingFilesRef`, kept in sync via effect). In the existing unmount cleanup
  effect and in the `conversationId`-change effect, for every snapshot entry
  with an `attachmentId` whose `localId` is **not** in `sentLocalIdsRef`, fire
  `deleteUpload`.

- **`handleSend`** — before `setPendingFiles([])`, add every sent entry's
  `localId` to a `sentLocalIdsRef` (`Set`). The cleanup paths skip these so a
  normal send never deletes the attachment it just linked. A *failed* send
  (onSend throws) leaves `pendingFiles` intact and those ids out of the set, so
  the user can retry or remove.

### B3. Worker sweeper (safety net)

New `apps/api/src/routes/chat/orphan-attachment-sweep-job.js`:

```js
export async function sweepOrphanChatAttachments({
  prisma, supabaseAdmin, olderThanMinutes = 120, limit = 200,
}) {
  const rows = await prisma.$queryRaw`
    SELECT id, bucket, object_key
    FROM chat_attachments
    WHERE message_id IS NULL
      AND created_at < NOW() - (${olderThanMinutes} * INTERVAL '1 minute')
    ORDER BY created_at ASC
    LIMIT ${limit}
  `;
  if (rows.length === 0) return { swept: 0 };

  // Group keys by bucket (all 'atlas-chat' in practice) and remove.
  const byBucket = new Map();
  for (const r of rows) {
    if (!byBucket.has(r.bucket)) byBucket.set(r.bucket, []);
    byBucket.get(r.bucket).push(r.object_key);
  }
  for (const [bucket, keys] of byBucket) {
    const { error } = await supabaseAdmin.storage.from(bucket).remove(keys);
    if (error) console.error('[chat.orphan-sweep] storage remove failed', bucket, error.message);
  }

  const ids = rows.map((r) => r.id);
  const deleted = await prisma.$executeRaw`
    DELETE FROM chat_attachments WHERE id = ANY(${ids}::uuid[])
  `;
  return { swept: deleted };
}
```

`apps/worker/src/index.js`: add, mirroring `runChatSessionExpiryTick`:

```js
const CHAT_ORPHAN_SWEEP_INTERVAL_MS = 30 * 60 * 1000;
async function runChatOrphanAttachmentSweepTick() {
  try {
    const result = await sweepOrphanChatAttachments({ prisma, supabaseAdmin: workerSupabaseAdmin });
    if ((result.swept ?? 0) > 0) {
      console.log(`[worker] chat orphan attachment sweep ${formatLogTimestamp()} swept=${result.swept}`);
    }
  } catch (err) {
    console.error('[worker] chat orphan attachment sweep tick failed:', err?.message ?? err);
    if (isConnectionError(err)) await reconnect();
  }
}
runChatOrphanAttachmentSweepTick();
setInterval(() => { runChatOrphanAttachmentSweepTick(); }, CHAT_ORPHAN_SWEEP_INTERVAL_MS);
```

**Threshold 120 min:** the presigned upload URL expires in 300 s; any row with
`message_id NULL` older than two hours is certainly abandoned. Never yank an
in-progress compose (long voice note, slow upload, user stepped away).

---

## Data flow

```
Add file  → presign (row message_id=NULL) → PUT to bucket → card shows, blob URL
Click card → ChatAttachmentViewer(resolveUrl=blob) → AdvancedFileViewer renders local copy
Remove card → local state drop + deleteUpload(attachmentId) → row + object gone
Send → onSend(attachmentIds) links rows → sentLocalIdsRef marks them → cleanup skips
Tab close / switch convo (unsent) → unmount cleanup → deleteUpload for each uploaded, unsent
Never cleaned (crash, offline delete) → worker tick (30 min) sweeps rows message_id NULL & >120 min
```

## Error handling

- All client-side deletes are fire-and-forget with `.catch(() => {})`; a failed
  cleanup just falls through to the worker sweep.
- `deleteAttachment` storage removal is log-and-continue: a missing object never
  blocks the row delete.
- Worker tick wraps everything in try/catch + `isConnectionError` reconnect,
  exactly like the sibling ticks. `LIMIT 200` per pass bounds the work.

## Testing

`apps/api/src/routes/chat/__tests__/chat-attachments-service.test.js` (extend or new):
- pending branch: uploader deletes → row deleted + `storage.remove([object_key])` called.
- pending branch: non-uploader → `404`, no delete, no storage call.
- sent branch, not last attachment: row deleted, `attachment_count` decremented,
  `storage.remove` called, `messageDeleted: false`.
- sent branch, last attachment, no body/refs: message soft-deleted,
  `storage.remove` called, `messageDeleted: true`.
- storage error is swallowed (row still deleted).

`apps/api/src/routes/chat/__tests__/orphan-attachment-sweep-job.test.js` (new):
- selects only `message_id IS NULL` rows older than the threshold.
- groups keys by bucket, calls `storage.remove` with them, then deletes rows.
- empty result → `{ swept: 0 }`, no storage call.

`apps/desktop/src/modules/atlas.chat/components/__tests__/` (composer — extend
existing or add):
- `removeFile` on an entry with `attachmentId` calls `deleteUpload(id)`.
- `removeFile` on an in-flight entry calls `deleteUpload` once the promise resolves.
- unmount with an uploaded, unsent entry fires `deleteUpload`.
- a successful `handleSend` does **not** fire `deleteUpload` for the sent ids.

All mocked (Node built-in test runner; existing chat test patterns).

## Files touched

| File | Change |
|---|---|
| `apps/api/src/routes/chat/chat-attachments-service.js` | `deleteAttachment` rewrite (pending branch + always `storage.remove`) |
| `apps/api/src/routes/chat/orphan-attachment-sweep-job.js` | **new** — `sweepOrphanChatAttachments` |
| `apps/api/src/routes/chat/__tests__/chat-attachments-service.test.js` | delete-branch tests |
| `apps/api/src/routes/chat/__tests__/orphan-attachment-sweep-job.test.js` | **new** |
| `apps/worker/src/index.js` | +1 tick (`runChatOrphanAttachmentSweepTick` + interval) |
| `apps/desktop/src/modules/atlas.chat/hooks/useChatUpload.js` | `+ deleteUpload` |
| `apps/desktop/src/modules/atlas.chat/components/MessageComposer.jsx` | blob URL for all types, clickable cards, viewer state, `removeFile` + unmount cleanup, `sentLocalIdsRef` |
| `apps/desktop/src/modules/atlas.chat/components/ChatAttachmentViewer.jsx` | optional `resolveUrl` override + Office props pass-through |
| `apps/desktop/src/modules/atlas.chat/components/__tests__/…` | composer cleanup tests |

No Prisma schema change, no migration. `packages/sdk` unchanged
(`deleteAttachment` already present).

## Plan split (per `feedback_split_large_plans`)

- **Plan A — API + worker:** B1 (`deleteAttachment`) + B3 (`sweepOrphanChatAttachments`
  + worker tick) + their tests.
- **Plan B — UI:** Part A (A1–A5) + B2 (`deleteUpload`, `removeFile` / unmount
  cleanup, `sentLocalIdsRef`) + composer tests.
