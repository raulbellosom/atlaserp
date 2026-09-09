# Chat: media + caption share one bubble — Design

Date: 2026-09-09
Status: Approved
Module: `atlas.chat`

## Problem

When a message has image (or a single video) attachment(s) **and** caption
text, `ChatMessageBubble` renders the caption in its own coloured bubble and the
media as a separate block stacked below it — two disconnected visual units.
WhatsApp/Telegram render this as **one bubble**: media flush to the top with
square bottom corners, caption directly beneath in the same coloured bubble.
This applies equally to an image grid. The `+N` overflow tile on 5+ images
already exists in `ImageGrid`.

## Goal

When a message has a caption plus **mergeable media** — every attachment is an
image, or the message has exactly one video — render the media and the caption
inside a single rounded, coloured bubble (brand colour for own, `--muted` for
received), media on top with no inner rounding, caption below. All other
attachment mixes keep today's stacked layout.

## Non-goals

- No change to the image grid layouts or the `+N` overflow (already correct).
- No merge for: image(s) + a non-image file, 2+ videos, audio, or a message
  that already merges an entity-ref into its text bubble (`firstEntityRefAttached`).
- No change to messages with attachments but no caption.

---

## Mergeability

New pure helper `apps/desktop/src/modules/atlas.chat/lib/messageMedia.js`:

```javascript
import { isImageMime, isVideoMime } from "./chatUtils.js";
import { isAudioAttachment } from "./chatUtils.js";

// True when a caption should share one bubble with the attachments:
// every attachment is an image, OR there is exactly one video (and it is not a
// mis-typed voice note). Everything else keeps the stacked layout.
export function isMergeableMediaMessage(attachments) {
  const atts = attachments ?? [];
  if (atts.length === 0) return false;
  if (atts.every((a) => isImageMime(a.mimeType))) return true;
  if (atts.length === 1 && isVideoMime(atts[0].mimeType) && !isAudioAttachment(atts[0])) return true;
  return false;
}
```

## `ChatMessageBubble`

- Compute once:
  `const mergeMediaCaption = hasBody && !isAssistant && !firstEntityRefAttached && isMergeableMediaMessage(attachments);`
- Both branches (own + received) change in two spots:
  1. The standalone caption block guard `{hasText && (` → `{hasText && !mergeMediaCaption && (`.
  2. The `{!isDeleted && attachments.length > 0 && <AttachmentsBlock .../>}` block
     becomes:
     ```jsx
     {!isDeleted && attachments.length > 0 && (
       mergeMediaCaption ? (
         <MediaCaptionBubble
           radiusClass={radius}
           isOwn={isOwn}
           body={message.body}
           searchQuery={searchQuery}
           replyTo={message.reply_to}
           onJumpToMessage={onJumpToMessage}
           attachmentsBlockProps={{
             attachments, onOpen: onAttachmentClick, isOwn,
             messageId: message.id, currentUserId, onToggleReaction,
             onDeleteAttachment, deletingAttachmentId,
           }}
         />
       ) : (
         <AttachmentsBlock ...unchanged... />
       )
     )}
     ```
- New local component (same file, above the two branch renders, to avoid
  duplicating the ~18 lines of JSX in each branch):

  ```jsx
  function MediaCaptionBubble({ radiusClass, isOwn, body, searchQuery, replyTo, onJumpToMessage, attachmentsBlockProps }) {
    return (
      <div className={[radiusClass, "overflow-hidden mt-1", isOwn ? "bg-(--brand-primary)" : "bg-[hsl(var(--muted))]"].join(" ")}>
        <AttachmentsBlock {...attachmentsBlockProps} merged />
        <div className="px-3 py-2 text-sm leading-relaxed">
          {replyTo && (
            <MessageQuote reply={replyTo} variant="inline" context={isOwn ? "onBrand" : "onMuted"} onJump={onJumpToMessage} />
          )}
          <p className={["text-left whitespace-pre-wrap wrap-break-word", isOwn ? "text-(--brand-primary-foreground)" : "text-[hsl(var(--foreground))]"].join(" ")}>
            <HighlightedText text={body} query={searchQuery} />
          </p>
        </div>
      </div>
    );
  }
  ```

  `mt-1` matches the small gap the standalone `AttachmentsBlock` had (`mt-1.5`
  minus the caption's own top padding reads about right; use `mt-1`).

## `AttachmentsBlock` / `ImageGrid` / `ImageCard` / `VideoCard` — `merged` prop

Add an optional `merged = false` prop, threaded down. When `merged` the caller
has already guaranteed the attachments are all-images or a single video, so:

- **`AttachmentsBlock`**: when `merged`, render only the media path
  (`<ImageGrid images={imageAtts} ... merged />` when there are images, else the
  single `<VideoCard ... merged />`) with no surrounding fragment extras. The
  `others.map(...)` branch is unreachable under `merged` by construction, but
  guard it anyway (`{!merged && others.map(...)}`).
- **`ImageGrid`**: `merged` removes the `mt-1.5` top margin and the outer
  `rounded-xl` (the bubble's `overflow-hidden` clips), and sets the wrapper
  width to `100%` / `maxWidth: 100%` instead of the fixed `220`. The 1-image
  case: wrapper `style={{ maxWidth: merged ? "100%" : 220 }}`, no `mt`.
- **`ImageCard`**: `merged` swaps `rounded-xl` → `""` on both the outer `div`
  and the inner `button`; the `<img>` gets `w-full` and, when `merged`, a
  larger `maxHeight` (say 320) so a single captioned photo isn't tiny.
- **`VideoCard`**: `merged` removes `rounded-xl` and `mt-1.5`, sets
  `style={{ width: merged ? "100%" : 220, height: 200, maxWidth: "100%" }}`
  (taller when merged).

Per-tile actions (`AttachmentTileActions`) and reaction pills are unchanged and
still work inside the merged bubble (they're `absolute` within each tile).

## Interaction with existing cases

| Case | Result |
|---|---|
| image(s), no caption | unchanged (loose rounded media) |
| caption, no attachments | unchanged (text bubble) |
| caption + all images | **merged bubble** |
| caption + exactly one video | **merged bubble** |
| caption + image + pdf | stacked (not mergeable) |
| caption + 2 videos | stacked |
| caption + audio | stacked (audio card separate) |
| `firstEntityRefAttached` + media + caption | stacked (entity-ref merge wins) |
| deleted message | unchanged ("Mensaje eliminado" bubble, no media) |
| assistant message | unchanged (never merges) |
| `reply_to` + caption + media | quote renders inside the merged caption area |
| search highlight | `HighlightedText` runs on the caption inside the merged bubble |

## Testing

Repo has no React-component test runner, so:
- `apps/desktop/src/modules/atlas.chat/lib/__tests__/messageMedia.test.js`
  (`node --test`): `isMergeableMediaMessage` — [] → false; 3 images → true;
  1 video → true; 1 image + 1 pdf → false; 2 videos → false; 1 audio
  (`audio/webm`, name `nota_de_voz_…`) → false; image + video → false.
- Vite build green.
- Manual: own & received, 1 image + caption, 4-image grid + caption, 7-image
  grid + caption (shows `+3`), 1 video + caption, image+pdf+caption (still
  stacked), 390 + 1440.

## Files touched

| File | Change |
|---|---|
| `apps/desktop/src/modules/atlas.chat/lib/messageMedia.js` | **new** — `isMergeableMediaMessage` |
| `apps/desktop/src/modules/atlas.chat/lib/__tests__/messageMedia.test.js` | **new** |
| `apps/desktop/src/modules/atlas.chat/components/ChatMessageBubble.jsx` | `mergeMediaCaption`, `MediaCaptionBubble`, skip standalone caption when merged, both branches |
| `apps/desktop/src/modules/atlas.chat/components/MessageAttachments.jsx` | `merged` prop on `AttachmentsBlock` / `ImageGrid` / `ImageCard` / `VideoCard` |

No API, no SDK, no migration.
