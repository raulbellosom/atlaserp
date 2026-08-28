# Chat Per-Attachment Actions — Plan B (Frontend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user react to or delete one specific photo/video inside a grouped multi-attachment message, without breaking the existing album grid layout.

**Architecture:** One new shared `AttachmentTileActions` component (hover icons + reaction picker + delete confirm, reused by every grid cell type) and one new `AttachmentReactionPills` component (small in-tile reaction badges), both added to `ChatMessageBubble.jsx`. `onToggleReaction` grows an optional 3rd `attachmentId` argument threaded end-to-end; a new `onDeleteAttachment` callback is threaded the same way `onDeleteMessage` already is.

**Tech Stack:** React, `@atlas/ui` (`MessageReactionPicker`, `ConfirmDialog`), TanStack Query.

**Spec:** `docs/superpowers/specs/2026-08-27-chat-per-attachment-actions-design.md`
**Depends on:** Plan A (backend) must be implemented and verified first — this plan calls the SDK methods Plan A adds.

---

## File Structure Map

| File | Action | Responsibility |
|---|---|---|
| `apps/desktop/src/modules/atlas.chat/hooks/useChatMessages.js` | Modify | `useToggleReaction` gains `attachmentId`; new `useDeleteAttachment` |
| `apps/desktop/src/modules/atlas.chat/components/ChatMessageBubble.jsx` | Modify | New `AttachmentTileActions`/`AttachmentReactionPills`; thread props through `AttachmentsBlock`/`ImageGrid`/`ImageCoverCell`/`ImageCard`/`VideoCard` |
| `apps/desktop/src/modules/atlas.chat/components/ChatWindow.jsx` | Modify | Wire `onDeleteAttachment`; extend `onToggleReaction` callback |
| `apps/desktop/src/modules/atlas.chat/components/MiniChatWindow.jsx` | Modify | Same wiring as ChatWindow |
| `apps/desktop/src/modules/atlas.chat/components/ChatMessageList.jsx` | Modify | Pass `onDeleteAttachment` prop through to `ChatMessageBubble` |

Not modified (confirmed during Discovery, see Task 2 note): `ThreadPanel.jsx` — thread replies never got `onDeleteMessage` wired either (pre-existing gap, not introduced by this feature); the new delete icon simply doesn't render there because it's gated behind the same "prop provided" check every other optional action in `ChatMessageBubble.jsx` already uses. Reacting to a thread reply's attachment DOES work there, since `onToggleReaction` is already wired for `ThreadPanel`.

---

### Task 1: Hooks — `useToggleReaction` + `useDeleteAttachment`

**Files:**
- Modify: `apps/desktop/src/modules/atlas.chat/hooks/useChatMessages.js`

- [ ] **Step 1: Extend `useToggleReaction`**

Change:

```javascript
export function useToggleReaction(conversationId) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ messageId, emoji }) => atlas.chat.toggleReaction(messageId, emoji, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-messages", conversationId] });
    },
  });
}
```

to:

```javascript
export function useToggleReaction(conversationId) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  return useMutation({
    // attachmentId omitted/null = message-level reaction (unchanged).
    mutationFn: ({ messageId, emoji, attachmentId = null }) =>
      atlas.chat.toggleReaction(messageId, emoji, token, { attachmentId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-messages", conversationId] });
    },
  });
}
```

- [ ] **Step 2: Add `useDeleteAttachment`**

Add this new export right after `useDeleteMessage` in the same file:

```javascript
export function useDeleteAttachment(conversationId) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (attachmentId) => atlas.chat.deleteAttachment(attachmentId, token),
    onSuccess: () => {
      // No optimistic update here (unlike useDeleteMessage): removing one
      // attachment out of a message's array in the cache correctly, without
      // also touching attachment_count / re-deriving whether the whole
      // message got soft-deleted (messageDeleted in the response), is more
      // bookkeeping than a straight refetch is worth for an action a user
      // takes rarely and expects to see settle in under a second either way.
      queryClient.invalidateQueries({ queryKey: ["chat-messages", conversationId] });
    },
  });
}
```

- [ ] **Step 3: Syntax-check**

Run: `node --check apps/desktop/src/modules/atlas.chat/hooks/useChatMessages.js` — this will fail since the file is `.js` but uses no JSX (hooks only), so plain `node --check` works here (confirm by running it; if it errors on unrelated JSX elsewhere in the file, use the project's esbuild one-liner instead, matching every other `.jsx` check in this session).

Expected: no output (success).

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/hooks/useChatMessages.js
git commit -m "feat(chat): add attachmentId support to useToggleReaction, add useDeleteAttachment"
```

---

### Task 2: `ChatMessageBubble.jsx` — per-tile actions and reaction pills

**Files:**
- Modify: `apps/desktop/src/modules/atlas.chat/components/ChatMessageBubble.jsx`

- [ ] **Step 1: Add imports**

Add `Smile` and `Trash2` to the existing `lucide-react` import list, and `ConfirmDialog` to the existing `@atlas/ui` import list, at the top of the file.

- [ ] **Step 2: Add the two new shared components**

Add these directly above `function ImageCard(...)`:

```javascript
// ── Per-tile action icons (react + delete) ─────────────────────────────────
// Shared by every grid cell type (ImageCard, ImageCoverCell, VideoCard) so
// the hover affordance, the reaction picker anchor, and the delete confirm
// flow are defined exactly once. `messageId` + `att.id` together identify
// which reaction/deletion this targets — never the whole message.
function AttachmentTileActions({ att, messageId, isOwn, onToggleReaction, onDeleteAttachment, deleting }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (!onToggleReaction && !(isOwn && onDeleteAttachment)) return null;

  return (
    <>
      {/* stopPropagation on the wrapper (not each button) so a click on
          either icon never also fires the tile's own onClick={() => onOpen(...)},
          which would open the full-screen viewer underneath the picker/dialog. */}
      <div
        className="absolute top-1 right-1 flex items-center gap-1 opacity-60 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity z-10"
        onClick={(e) => e.stopPropagation()}
      >
        {onToggleReaction && (
          <MessageReactionPicker
            open={pickerOpen}
            onOpenChange={setPickerOpen}
            onPick={(emoji) => onToggleReaction(messageId, emoji, att.id)}
            anchorAlign={isOwn ? "end" : "start"}
          >
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="h-6 w-6 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center transition-colors touch-manipulation"
              aria-label="Reaccionar a este archivo"
              title="Reaccionar"
            >
              <Smile className="h-3.5 w-3.5 text-white" />
            </button>
          </MessageReactionPicker>
        )}
        {isOwn && onDeleteAttachment && (
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            className="h-6 w-6 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center transition-colors touch-manipulation"
            aria-label="Eliminar este archivo"
            title="Eliminar"
          >
            <Trash2 className="h-3.5 w-3.5 text-white" />
          </button>
        )}
      </div>
      {isOwn && onDeleteAttachment && (
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title="Eliminar archivo"
          description="Esta accion no se puede deshacer."
          confirmLabel="Eliminar"
          loading={deleting}
          onConfirm={() => { onDeleteAttachment(att.id); setConfirmOpen(false); }}
        />
      )}
    </>
  );
}

// ── Per-tile reaction pills ──────────────────────────────────────────────────
// Smaller, simpler sibling of MessageReactions.jsx: no "who reacted" modal
// (there isn't room for it inside a ~110px tile) — clicking a pill you
// reacted with removes it directly; clicking one you didn't react with does
// nothing (view-only for other people's reactions on this small surface).
function AttachmentReactionPills({ reactions, currentUserId, onToggleReaction, messageId, attachmentId }) {
  if (!reactions?.length) return null;
  return (
    <div
      className="absolute bottom-1 left-1 flex flex-wrap gap-0.5 z-10"
      onClick={(e) => e.stopPropagation()}
    >
      {reactions.map(({ emoji, userIds }) => {
        const mine = currentUserId && userIds?.includes(currentUserId);
        return (
          <button
            key={emoji}
            type="button"
            onClick={() => mine && onToggleReaction?.(messageId, emoji, attachmentId)}
            className={[
              "inline-flex items-center gap-0.5 px-1 py-0.5 rounded-full text-[10px] bg-black/60 text-white",
              mine ? "ring-1 ring-white cursor-pointer" : "cursor-default",
            ].join(" ")}
          >
            <span>{emoji}</span>
            <span className="tabular-nums">{userIds?.length ?? 0}</span>
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Thread the new props through `ImageCard`**

Change the signature and body of `ImageCard`:

```javascript
function ImageCard({ att, index, allAttachments, onOpen, messageId, isOwn, currentUserId, onToggleReaction, onDeleteAttachment, deletingAttachmentId }) {
  const { data: url, isLoading, isError } = useAttachmentUrl(att);
  const [imgErr, setImgErr] = useState(false);

  return (
    <div className="relative group block rounded-xl overflow-hidden" style={{ minHeight: 80 }}>
      <button
        type="button"
        onClick={() => onOpen?.(allAttachments, index)}
        className="block w-full rounded-xl overflow-hidden hover:opacity-90 transition-opacity bg-black/10"
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-20 w-32">
            <Loader2 className="h-5 w-5 animate-spin opacity-40" />
          </div>
        ) : url && !imgErr ? (
          <img
            src={url}
            alt={att.fileName}
            className="block w-full object-cover"
            style={{ maxHeight: 220 }}
            onError={() => {
              console.warn("[chat] image load failed", { url, id: att.id });
              setImgErr(true);
            }}
          />
        ) : (
          <div className="flex items-center justify-center h-20 w-32 opacity-40">
            <FileText className="h-6 w-6" />
          </div>
        )}
      </button>
      <AttachmentTileActions
        att={att}
        messageId={messageId}
        isOwn={isOwn}
        onToggleReaction={onToggleReaction}
        onDeleteAttachment={onDeleteAttachment}
        deleting={deletingAttachmentId === att.id}
      />
      <AttachmentReactionPills
        reactions={att.reactions}
        currentUserId={currentUserId}
        onToggleReaction={onToggleReaction}
        messageId={messageId}
        attachmentId={att.id}
      />
    </div>
  );
}
```

Note the structural change: the outer element is now a plain `<div className="relative group">` wrapping the original `<button>` (unchanged internals) plus the two new overlays as siblings — not nested inside the button, since a `<button>` cannot contain other interactive elements (buttons-in-buttons) without breaking accessibility/click semantics.

- [ ] **Step 4: Apply the identical wrapper change to `ImageCoverCell`**

Same pattern — `ImageCoverCell`'s current root `<button className="absolute inset-0 ...">` becomes a `<div className="absolute inset-0 group">` wrapping that same button (now `className="block w-full h-full ..."` instead of `absolute inset-0 ...`, since the wrapping div now owns the absolute positioning) plus the two overlays:

```javascript
function ImageCoverCell({ att, index, allAttachments, onOpen, overflowCount = 0, messageId, isOwn, currentUserId, onToggleReaction, onDeleteAttachment, deletingAttachmentId }) {
  const { data: url, isLoading } = useAttachmentUrl(att);
  const [imgErr, setImgErr] = useState(false);

  return (
    <div className="absolute inset-0 w-full h-full group">
      <button
        type="button"
        onClick={() => onOpen?.(allAttachments, index)}
        className="block w-full h-full hover:opacity-90 transition-opacity bg-black/10"
      >
        {isLoading ? (
          <div className="flex items-center justify-center w-full h-full">
            <Loader2 className="h-4 w-4 animate-spin opacity-40" />
          </div>
        ) : url && !imgErr ? (
          <img
            src={url}
            alt={att.fileName}
            className="w-full h-full object-cover"
            onError={() => {
              console.warn("[chat] image load failed", { url, id: att.id });
              setImgErr(true);
            }}
          />
        ) : (
          <div className="flex items-center justify-center w-full h-full opacity-40">
            <FileImage className="h-5 w-5" />
          </div>
        )}
        {overflowCount > 0 && (
          <span className="absolute inset-0 flex items-center justify-center bg-black/60 text-white font-bold text-xl pointer-events-none">
            +{overflowCount}
          </span>
        )}
      </button>
      {overflowCount === 0 && (
        <>
          <AttachmentTileActions
            att={att}
            messageId={messageId}
            isOwn={isOwn}
            onToggleReaction={onToggleReaction}
            onDeleteAttachment={onDeleteAttachment}
            deleting={deletingAttachmentId === att.id}
          />
          <AttachmentReactionPills
            reactions={att.reactions}
            currentUserId={currentUserId}
            onToggleReaction={onToggleReaction}
            messageId={messageId}
            attachmentId={att.id}
          />
        </>
      )}
    </div>
  );
}
```

`overflowCount === 0` guards the last cell in a 4+ grid (the one showing "+N") — that cell already has a different, message-level meaning (open the full grid), not "react to this one photo," so it keeps its plain behavior unchanged.

- [ ] **Step 5: Update `ImageGrid` to pass the new props through**

`ImageGrid`'s signature grows the same six new props (`messageId, isOwn, currentUserId, onToggleReaction, onDeleteAttachment, deletingAttachmentId`) and forwards them to every `<ImageCard .../>` / `<ImageCoverCell .../>` call inside its four branches (count 1/2/3/4+). Each existing call like:

```javascript
<ImageCard att={images[0]} index={startIndex} allAttachments={allAttachments} onOpen={onOpen} />
```

becomes:

```javascript
<ImageCard
  att={images[0]}
  index={startIndex}
  allAttachments={allAttachments}
  onOpen={onOpen}
  messageId={messageId}
  isOwn={isOwn}
  currentUserId={currentUserId}
  onToggleReaction={onToggleReaction}
  onDeleteAttachment={onDeleteAttachment}
  deletingAttachmentId={deletingAttachmentId}
/>
```

(and the same six props added to each of the three `<ImageCoverCell .../>` call sites in the 2/3/4+ branches).

- [ ] **Step 6: Update `VideoCard`**

Apply the same wrapper-div + overlays pattern as `ImageCard` (Step 3) to `VideoCard`: change its root `<button>` into a `<div className="relative group ...">` wrapping the existing button content, add the same six new props to its signature, and render `<AttachmentTileActions .../>` + `<AttachmentReactionPills .../>` as siblings after the button, identical wiring to `ImageCard`.

- [ ] **Step 7: Update `AttachmentsBlock` to pass everything down**

Change:

```javascript
function AttachmentsBlock({ attachments, onOpen, isOwn }) {
```

to:

```javascript
function AttachmentsBlock({ attachments, onOpen, isOwn, messageId, currentUserId, onToggleReaction, onDeleteAttachment, deletingAttachmentId }) {
```

and forward the six new props (`messageId, isOwn, currentUserId, onToggleReaction, onDeleteAttachment, deletingAttachmentId`) into both the `<ImageGrid .../>` call and every `<VideoCard .../>` call inside it. `AudioCard` and `FileCard` are unaffected (spec Non-goal 3 — react/delete are scoped to the visual grid only, per the spec's own framing of "each image/video" — not extended to plain file/audio rows in this phase).

- [ ] **Step 8: Wire it from the top of `ChatMessageBubble`**

Find the `<AttachmentsBlock attachments={attachments} onOpen={onAttachmentClick} isOwn />` call (there are two identical call sites — search for both) and change each to:

```javascript
<AttachmentsBlock
  attachments={attachments}
  onOpen={onAttachmentClick}
  isOwn
  messageId={message.id}
  currentUserId={currentUserId}
  onToggleReaction={onToggleReaction}
  onDeleteAttachment={onDeleteAttachment}
  deletingAttachmentId={deletingAttachmentId}
/>
```

- [ ] **Step 9: Add the two new props to `ChatMessageBubble`'s own signature**

Add `onDeleteAttachment` and `deletingAttachmentId` to the destructured props list at the top of `export function ChatMessageBubble({ ... })`, alongside the existing `onToggleReaction`.

- [ ] **Step 10: Parse-check**

Run:
```bash
node -e "
const esbuild = require('./node_modules/.pnpm/node_modules/esbuild');
esbuild.buildSync({ entryPoints: ['apps/desktop/src/modules/atlas.chat/components/ChatMessageBubble.jsx'], bundle: false, write: false, loader: { '.jsx': 'jsx' }, format: 'esm', logLevel: 'silent' });
console.log('OK');
"
```
Expected: `OK`.

- [ ] **Step 11: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/components/ChatMessageBubble.jsx
git commit -m "feat(chat): add per-tile react/delete actions and reaction pills to attachment grids"
```

---

### Task 3: Wire `onDeleteAttachment` and the extended `onToggleReaction` from ChatWindow/MiniChatWindow

**Files:**
- Modify: `apps/desktop/src/modules/atlas.chat/components/ChatWindow.jsx`
- Modify: `apps/desktop/src/modules/atlas.chat/components/MiniChatWindow.jsx`
- Modify: `apps/desktop/src/modules/atlas.chat/components/ChatMessageList.jsx`

- [ ] **Step 1: `ChatWindow.jsx` — import and instantiate the new hook**

Add `useDeleteAttachment` to the existing `import { useChatMessages, useSendMessage, useMarkRead, useDeleteMessage, usePinMessage, useToggleReaction } from "../hooks/useChatMessages";` line, and add next to the existing `const { mutate: deleteMessageMutate } = useDeleteMessage(conversationId);`:

```javascript
  const { mutate: deleteAttachmentMutate, isPending: isDeletingAttachment, variables: deletingAttachmentId } = useDeleteAttachment(conversationId);
```

- [ ] **Step 2: Add a handler**

Add next to the existing `handleDeleteMessage`:

```javascript
  const handleDeleteAttachment = useCallback((attachmentId) => {
    deleteAttachmentMutate(attachmentId);
  }, [deleteAttachmentMutate]);
```

- [ ] **Step 3: Pass the new props into `ChatMessageList`**

At the `<ChatMessageList ... onDeleteMessage={handleDeleteMessage} ... />` call, add:

```javascript
              onDeleteAttachment={handleDeleteAttachment}
              deletingAttachmentId={isDeletingAttachment ? deletingAttachmentId : null}
```

- [ ] **Step 4: Update the `onToggleReaction` callbacks**

Both existing occurrences:

```javascript
onToggleReaction={(messageId, emoji) => toggleReactionMutate({ messageId, emoji })}
```

become:

```javascript
onToggleReaction={(messageId, emoji, attachmentId) => toggleReactionMutate({ messageId, emoji, attachmentId })}
```

(one feeds `ChatMessageList`, the other feeds `ThreadPanel` — both get the same change; `ThreadPanel`'s own attachments, if any, will now support per-attachment reactions too, with no `ThreadPanel.jsx` change needed since it already forwards `onToggleReaction` straight through to `ChatMessageBubble`).

- [ ] **Step 5: Apply the equivalent changes in `MiniChatWindow.jsx`**

`MiniChatWindow.jsx` wires reactions/delete inline (no separate handler functions, and only one `onToggleReaction` call site — it has no `ThreadPanel`). Add `useDeleteAttachment` to the existing import:

```javascript
import { useChatMessages, useSendMessage, useMarkRead, useDeleteMessage, usePinMessage, useToggleReaction, useDeleteAttachment } from "../hooks/useChatMessages";
```

Add next to the existing `const { mutate: deleteMessageMutate } = useDeleteMessage(id);`:

```javascript
  const { mutate: deleteAttachmentMutate, isPending: isDeletingAttachment, variables: deletingAttachmentId } = useDeleteAttachment(id);
```

Change:

```javascript
              onDeleteMessage={(msgId) => deleteMessageMutate(msgId)}
```

to (adding two new props on the lines right after it, inside the same `<ChatMessageList .../>` call):

```javascript
              onDeleteMessage={(msgId) => deleteMessageMutate(msgId)}
              onDeleteAttachment={(attachmentId) => deleteAttachmentMutate(attachmentId)}
              deletingAttachmentId={isDeletingAttachment ? deletingAttachmentId : null}
```

Change:

```javascript
              onToggleReaction={(messageId, emoji) => toggleReactionMutate({ messageId, emoji })}
```

to:

```javascript
              onToggleReaction={(messageId, emoji, attachmentId) => toggleReactionMutate({ messageId, emoji, attachmentId })}
```

- [ ] **Step 6: `ChatMessageList.jsx` — accept and forward the two new props**

Add `onDeleteAttachment` and `deletingAttachmentId` to `ChatMessageList`'s destructured props, and add them to the `<ChatMessageBubble .../>` call inside its `.map()`:

```javascript
              onDeleteAttachment={onDeleteAttachment}
              deletingAttachmentId={deletingAttachmentId}
```

- [ ] **Step 7: Parse-check all four files**

Run:
```bash
node -e "
const esbuild = require('./node_modules/.pnpm/node_modules/esbuild');
const files = [
  'apps/desktop/src/modules/atlas.chat/components/ChatWindow.jsx',
  'apps/desktop/src/modules/atlas.chat/components/MiniChatWindow.jsx',
  'apps/desktop/src/modules/atlas.chat/components/ChatMessageList.jsx',
];
for (const f of files) {
  esbuild.buildSync({ entryPoints: [f], bundle: false, write: false, loader: { '.jsx': 'jsx' }, format: 'esm', logLevel: 'silent' });
  console.log('OK', f);
}
"
```
Expected: `OK` for all three.

- [ ] **Step 8: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/components/ChatWindow.jsx apps/desktop/src/modules/atlas.chat/components/MiniChatWindow.jsx apps/desktop/src/modules/atlas.chat/components/ChatMessageList.jsx
git commit -m "feat(chat): wire per-attachment delete and reaction actions from ChatWindow/MiniChatWindow"
```

---

### Task 4: Manual verification (browser)

- [ ] **Step 1: Send a 4-image message to yourself or a test conversation.**
- [ ] **Step 2: Hover tile #2 (desktop) — confirm the react + delete icons appear top-right, and clicking either does NOT open the full-screen viewer underneath.**
- [ ] **Step 3: React to tile #2 with 😂. Confirm the pill appears only on tile #2, bottom-left — not on tiles #1/#3/#4, and not in a message-level reaction row.**
- [ ] **Step 4: Delete tile #3. Confirm the confirmation dialog appears (not a native browser confirm), and after confirming, the grid re-lays-out to the 3-tile "1 wide + 2 below" layout with tiles #1/#2/#4 (now #1/#2/#3) intact and #2's 😂 reaction still attached to the same photo.**
- [ ] **Step 5: Send a message with exactly 1 photo and no text. Delete it. Confirm the whole message disappears (not just the photo, leaving an empty bubble behind).**
- [ ] **Step 6: Send a message with 1 photo and body text "prueba". Delete the photo. Confirm the message remains, showing only "prueba".**
- [ ] **Step 7: Open the same conversation from a different account or browser profile as a non-sender. Confirm the delete icon does not appear on any tile, but the react icon does.**
- [ ] **Step 8: Document the actual result of each step above (pass/fail) — do not mark this task complete without having actually clicked through it.**
