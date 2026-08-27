# File-Reference Attachments, Bubble Uniformity, Profile Polish — Design

## Context

Continued feedback after using the redesigned chat (profile sidebar, flat sections, media multi-select, entity-ref merge). Five more issues, investigated before writing this spec:

1. Attaching a "file" entity reference (via the paperclip/link picker's "Archivo" type) renders as a generic text-style link card instead of looking like a real attachment (image thumbnail or file card), and doesn't show up in the conversation's Media/Files section at all.
2. The profile panel's Media section should show only a couple of recent files with a "Mostrar más" button, not the full gallery inline — matching the reference mockup's "Recent Files" pattern.
3. The "Zona de peligro" (block/report) section should be the LAST section in the profile panel, not the first, with its buttons centered.
4. Opening a profile picture in the lightbox shows the cropped thumbnail, not the full-resolution photo.
5. In a run of consecutive messages from the same sender, a message that's ONLY an entity reference (no text) doesn't take on the grouped bubble shape/color the way a text message does — it always renders as a small independently-bordered card, which looks visually disconnected from the properly-shaped bubbles around it, especially right after a message with reactions attached.

## Investigation findings (grounding the design below)

- **Entity ref resolution happens once, at send time**, in `apps/api/src/routes/chat/chat-entity-references-service.js` (`resolveOne()` → `resolveEntityRefs()`, called from `chat-service.js`'s `sendMessage()`). The resolved `{title, subtitle, url}` is persisted into `message.metadata.entityRefs` and never re-resolved on read — `listMessages`/`getMessages` return the stored JSON verbatim.
- For `entityType === "file"`, the resolver currently only keeps `title` (`row.originalName`) and a hardcoded `subtitle: null`; `url` is an in-app navigation route (`/app/m/atlas.files/files/{recordId}`), not a signed download URL. The row it already fetches (`filesService.getById`) has the full `FileAsset` record, so `mimeType`/`sizeBytes` are sitting right there, just discarded.
- **Signed URLs must NOT be persisted at send time** — they expire (`SIGNED_URL_SECONDS`), and this metadata is stored forever. `mimeType`/`sizeBytes` are static file properties, safe to persist once; the actual viewable URL must be fetched fresh, client-side, on demand — mirroring the existing pattern for real attachments (`useAttachmentUrl` hook, lazy-fetches a signed URL only when a card is actually rendered/opened).
- A generic, already-existing, already-permission-checked endpoint covers exactly this: `GET /files/:id/signed-url` (`apps/api/src/services/files-service.js`'s `getSignedUrl({ authUserId, id, variant })`, routed behind `files.assets.read`). It checks the file belongs to the caller's company — the same company-level check every other file access in this app already relies on. Using it for a chat-referenced file introduces **no new exposure**: any company member with `files.assets.read` can already fetch a signed URL for any company file by id through this endpoint today, chat entity references or not. No RLS/permission gap is created or worsened.
- **Avatar URLs are always the "thumb" variant** — `chat-service.js`'s `batchSignAvatarUrls()` hardcodes `signedUrlWithVariant(..., "thumb")`. There is no code path anywhere that ever requests a "full" variant for an avatar. The `ImageViewer` lightbox added for avatars (Plan D) has been opening this same thumb-variant URL the whole time — it was never fetching a full-resolution image because none was ever produced.
- **Entity-ref-only messages skip the bubble shape system entirely**: `EntityReferenceCard`'s `attached` prop (added recently) is only ever `true` when `hasText` is true — for a message with NO text (now legitimately possible since a message can consist of a bare entity ref with no other content), `attached` is always `false`, so every entity ref in that message renders with `EntityReferenceCard`'s independent bordered-card look, never inheriting `bubbleRadius()`'s grouped shape or the sender's bubble background. Visually, in a run of consecutive messages, this card looks like a foreign object sandwiched between real bubbles — exactly the "looks cut / separate" complaint, made more visually jarring in the screenshot because it directly follows a message with a reaction pill row below it.

## Part A — File references render and index as real attachments

### A1. Backend: persist mimeType/sizeBytes for file-type entity refs

**File:** `apps/api/src/routes/chat/chat-entity-references-service.js`

The `entityType === "file"` branch of `resolveOne()` changes from:
```js
if (entityType === "file") {
  const row = await filesService.getById({ authUserId, id: recordId });
  if (!row) return null;
  return { entityType, recordId, title: row.originalName, subtitle: null, url: `/app/m/atlas.files/files/${recordId}` };
}
```
to:
```js
if (entityType === "file") {
  const row = await filesService.getById({ authUserId, id: recordId });
  if (!row) return null;
  return {
    entityType, recordId, title: row.originalName, subtitle: null,
    url: `/app/m/atlas.files/files/${recordId}`,
    mimeType: row.mimeType ?? null,
    sizeBytes: row.sizeBytes ?? null,
  };
}
```
No other entity type gains these fields — `contact`/`ledger_account`/`hr_employee` references stay exactly as they are (they're not previewable files). This is additive: existing persisted entity refs (sent before this change) simply won't have `mimeType`/`sizeBytes`, which the frontend must treat as "no preview available, fall back to the generic reference card" — never assume every file-type ref has these fields.

### A2. Frontend: render file-type entity refs as real attachment cards

**Files:** `apps/desktop/src/modules/atlas.chat/components/ChatMessageBubble.jsx`, `apps/desktop/src/modules/atlas.chat/components/EntityReferenceCard.jsx`

`ChatMessageBubble.jsx` already has `ImageCard`/`VideoCard`/`FileCard` sub-components and a `useAttachmentUrl(att)` hook built for real attachments, resolving a signed URL via `atlas.chat.getAttachmentSignedUrl`. File-type entity refs need the equivalent, but through the FILES module's own signed-url endpoint instead (`atlas.files.getSignedUrl`, not a chat endpoint — this file was never a chat attachment).

Where the entity-refs list is rendered (both `ChatMessageBubble` branches), split `message.metadata.entityRefs` into two groups: refs with `entityType === "file" && mimeType` (renderable as a real attachment) and everything else (still `EntityReferenceCard`, unchanged rendering). File-type refs render via a new small component modeled on `ImageCard`/`FileCard` but backed by `atlas.files.getSignedUrl` instead of `atlas.chat.getAttachmentSignedUrl` — image mimeTypes get an inline thumbnail (opens in `ChatAttachmentViewer`... actually not `ChatAttachmentViewer`, since that's chat-attachment-specific gallery machinery expecting `chat_attachments` rows; the simplest correct choice is opening these in the same `ImageViewer` component already used for avatars, single-image, no gallery nav needed, fetching the "full" variant on open), non-image mimeTypes get a `FileCard`-style row with a direct download button (fetching a "full"-variant signed URL from `atlas.files.getSignedUrl` on click, same lazy-fetch-on-demand shape as everywhere else in this app).

File-type refs with no `mimeType` (pre-existing messages sent before Part A1 shipped) keep rendering via the plain `EntityReferenceCard` — same as any non-file entity type — since there's nothing to preview without it.

### A3. Frontend: ChatFilesGallery indexes file-type entity refs too

**File:** `apps/desktop/src/modules/atlas.chat/components/ChatFilesGallery.jsx`

`allAttachments` currently flattens only `msg.attachments`. It also needs to flatten `msg.metadata?.entityRefs?.filter(r => r.entityType === "file" && r.mimeType)` into the same list, normalized to the same shape the rest of the component expects (`id` ← `recordId`, `mimeType`, `fileName` ← `title`, `sizeBytes`, and NO embedded `url` — this list's `url` field doesn't exist for these the way it does for real attachments, so the image grid/file row's URL resolution needs its own lazy-fetch path here too, via the same `atlas.files.getSignedUrl` mechanism from A2, not the embedded-URL shortcut real attachments get). Clicking one of these entries opens the `ImageViewer`/download flow from A2, not `ChatAttachmentViewer` (which is for real chat attachments specifically).

## Part B — Profile panel polish

### B1. Media section: preview then "Mostrar más"

**Files:** `apps/desktop/src/modules/atlas.chat/components/ConversationProfilePanel.jsx`, `apps/desktop/src/modules/atlas.chat/components/ConversationMediaTab.jsx`

Inside the profile panel's Media section specifically (not the standalone files view reached from `ChatWindow`'s folder-icon toggle, which stays a full unlimited gallery), only the first 6 images/files render, followed by a "Mostrar más" button. Clicking it closes the profile panel and opens `ChatWindow`'s existing standalone files view (`onToggleFilesView`) — reusing the feature that already exists rather than building pagination inside the profile panel. `ConversationProfilePanel` needs a new prop, `onShowAllFiles`, threaded from `ChatWindow.jsx` (which already owns `onToggleFilesView`/`closeProfile`) down through to the Media section.

### B2. Danger zone: last section, centered buttons

**Files:** `apps/desktop/src/modules/atlas.chat/components/ConversationProfilePanel.jsx`, `apps/desktop/src/modules/atlas.chat/components/ConversationInfoTab.jsx`

For direct conversations, the section order changes from Info → Media → En común → Notificaciones to **Media → En común → Notificaciones → Info** (Info being the danger-zone-only section today — its `SectionHeader` label changes from "Info" to "Zona de peligro" to match, since that's genuinely all it contains). `ConversationInfoTab.jsx`'s block/report buttons change from `w-full justify-start` to centered (`w-full justify-center`, or a `flex flex-col items-center` wrapper — buttons keep their current width-fitting content, just centered rather than left-aligned block buttons).

### B3. Avatar lightbox: fetch the full-resolution image

**Files:** `apps/api/src/routes/chat/chat-service.js`, `apps/desktop/src/modules/atlas.chat/components/ConversationProfilePanel.jsx`, `apps/desktop/src/modules/atlas.chat/components/ChannelGeneralTab.jsx`

Backend: every place `chat-service.js` resolves `avatarUrl` for a **conversation** or a **member** via `batchSignAvatarUrls()` (the "thumb" variant) also needs the underlying `avatarFileId` exposed alongside it (it's already known server-side — it's the join key — just never returned). Add `avatarFileId` as a plain field next to `avatarUrl` in `getConversation`/`listConversations`'s conversation and member objects. No new signed-URL generation on the backend — the existing `GET /files/:id/signed-url` endpoint (already used in Part A) covers fetching a "full" variant client-side, on demand, exactly like Part A's file previews.

Frontend: `ConversationProfilePanel`'s `heroAvatarUrl`/`ChannelGeneralTab`'s `conversation.avatarUrl` currently feed `ImageViewer`'s `src` directly (the thumb URL). Both now resolve a full-resolution URL lazily when the lightbox actually opens — via `atlas.files.getSignedUrl(avatarFileId, { variant: "full" })`, called only when `avatarViewerOpen`/`emojiOpen`-equivalent state turns true (not eagerly on every render) — and pass that resolved URL to `ImageViewer` instead of the thumb. While the fetch is in flight, `ImageViewer` can keep showing the thumb as a placeholder rather than a blank state (better perceived performance, matches how the existing gallery viewer already progressively resolves URLs).

## Part C — Entity-ref-only messages take on the grouped bubble shape

**Files:** `apps/desktop/src/modules/atlas.chat/components/ChatMessageBubble.jsx`

When a message has NO text (`!hasBody`) but DOES have entity references (`message.metadata?.entityRefs?.length > 0`), wrap its entity-ref block in a bubble-shaped container using the SAME `radius`/background classes a text bubble would use for that message's position in its consecutive-same-sender group — so it reads as a real bubble in the run, not a foreign card. Concretely: introduce a `entityRefsOnlyBubble = !hasBody && message.metadata?.entityRefs?.length > 0` flag; when true, wrap the entity-ref `.map()` output in a `<div className={[radius, isOwn ? "bg-(--brand-primary)" : "bg-[hsl(var(--muted))]", "overflow-hidden"].join(" ")}>` container, and every `EntityReferenceCard` inside it renders with `attached={true}` (since it's now always "continuing" the synthetic bubble around it, regardless of position in a multi-ref list — Part A/D's earlier "only the first ref merges" rule was specifically about a ref following TEXT; here there's no text, the ENTIRE bubble is made of nothing but entity refs, so all of them should look continuous with each other and with the wrapping bubble shape). The existing multi-ref/`i === 0`-only merge logic from the prior round stays scoped to the "text followed by ref(s)" case; this is the separate "text-less message, entity ref(s) forming the whole bubble" case.

## Non-goals

- No change to how `ChatAttachmentViewer` (the real-attachment gallery viewer) works — file-type entity ref previews use `ImageViewer`/direct download instead, a deliberately simpler single-item flow, not a new gallery mode.
- No re-resolution of entity refs on read — `title`/`subtitle`/`mimeType`/`sizeBytes` stay frozen at send time, matching the existing (accepted) architecture. Only the signed URL is ever fetched fresh, and only on demand.
- No backend permission model change — file previews reuse the existing company-scoped `files.assets.read` check unchanged; this spec doesn't add or remove any access control.
- No pagination/infinite-scroll inside the profile panel's Media section — "Mostrar más" is a one-way jump to the existing full files view, not a "load more" button that stays in place.
- No change to the standalone files view (`ChatWindow`'s folder-icon toggle) — it already shows everything; only the profile panel's Media section preview is capped.
