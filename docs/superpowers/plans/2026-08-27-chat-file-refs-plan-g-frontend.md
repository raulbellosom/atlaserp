# File-Reference Attachments, Bubble Uniformity, Profile Polish (Plan G — Frontend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Work directly on the `main` branch — do NOT create a git worktree or feature branch (this project's established convention).

**Goal:** File-type entity references render and index like real attachments; entity-ref-only messages take on the grouped bubble shape; the profile panel's Media section previews a few files with a "Mostrar más" jump to the full gallery; the danger zone moves to the last section with centered buttons; the avatar lightbox loads a real full-resolution image instead of the always-thumbnail URL.

**Architecture:** A new shared file (`FileReferenceAttachment.jsx`) holds the file-ref-preview rendering logic and its signed-URL hook, used by both `ChatMessageBubble.jsx` (inline in messages) and `ChatFilesGallery.jsx` (in the media grid) — kept out of `ChatMessageBubble.jsx` itself since that file is already over this project's 1000-line soft limit (1109 lines as of this plan) and must not grow further. Everything else is targeted edits to existing components.

**Tech Stack:** React (JSX), `@atlas/ui`, `lucide-react`.

**Spec:** `docs/superpowers/specs/2026-08-26-chat-file-refs-and-bubble-polish-design.md`.

**Prerequisite:** Plan F (`docs/superpowers/plans/2026-08-27-chat-file-refs-plan-f-backend.md`) must be merged first — this plan's Tasks 1-3 read `reference.mimeType`/`reference.sizeBytes` (Plan F Task 1) and `member.avatarFileId` (Plan F Task 2), neither of which exist in API responses until Plan F ships.

**Verification tooling note:** No component-level test runner exists for React/JSX in this repo. Verification is `pnpm --filter @atlas/desktop exec vite build` plus a manual/visual check description per task.

---

### Task 1: Create the shared file-reference-attachment component

**Files:** Create `apps/desktop/src/modules/atlas.chat/components/FileReferenceAttachment.jsx`

- [ ] **Step 1: Read for context first**

Read `apps/desktop/src/modules/atlas.chat/components/ChatMessageBubble.jsx`'s `useAttachmentUrl`, `ImageCard`, and `FileCard` functions (near the top of the file) — this new file mirrors their pattern but resolves URLs through `atlas.files.getSignedUrl` (the generic files-module endpoint) instead of `atlas.chat.getAttachmentSignedUrl` (chat-attachment-specific), since a file-type entity reference points at an arbitrary company file, not a `chat_attachments` row.

Read `packages/ui/src/components/ImageViewer.jsx` to confirm its props (`src, alt, fileName, open, onClose`).

- [ ] **Step 2: Write the file**

```jsx
// apps/desktop/src/modules/atlas.chat/components/FileReferenceAttachment.jsx
// Renders a "file" entity reference (a link to an existing atlas.files record,
// attached via the composer's entity-ref picker) as a real attachment card —
// an image thumbnail or a downloadable file row — instead of the generic
// EntityReferenceCard link chip. Only usable when the reference carries
// `mimeType` (added when the backend resolves the ref at send time — refs
// sent before that change won't have it, and the caller falls back to
// EntityReferenceCard for those). Kept in its own file rather than added to
// ChatMessageBubble.jsx, which is already over this project's 1000-line
// soft limit.
//
// Unlike real chat attachments (whose `url` is embedded directly in the
// message payload), a file reference's actual signed URL is never persisted
// — it would go stale, since message metadata is stored forever and signed
// URLs expire. Every render here fetches its own signed URL on demand via
// the generic files-module endpoint (GET /files/:id/signed-url), the same
// endpoint any other module already uses to preview/download a company
// file — this introduces no new access exposure over what already exists.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Download } from "lucide-react";
import { ImageViewer } from "@atlas/ui";
import { atlas } from "../../../lib/atlas";
import { useAuth } from "../../../auth/AuthProvider";
import { formatFileSize, isImageMime } from "../lib/chatUtils";
import { FileTypeIcon } from "./ChatFilesGallery";

export function useFileRefSignedUrl(recordId, variant, enabled) {
  const { session } = useAuth();
  const token = session?.access_token;
  return useQuery({
    queryKey: ["chat-file-ref-signed-url", recordId, variant],
    queryFn: async () => {
      const res = await atlas.files.getSignedUrl(recordId, token, { variant });
      return res?.data?.signedUrl ?? null;
    },
    enabled: Boolean(enabled && recordId && token),
    staleTime: 50 * 60 * 1000,
  });
}

function FileRefImage({ reference, isOwn }) {
  const [viewerOpen, setViewerOpen] = useState(false);
  const { data: cardUrl, isLoading } = useFileRefSignedUrl(reference.recordId, "card", true);
  const { data: fullUrl } = useFileRefSignedUrl(reference.recordId, "full", viewerOpen);

  return (
    <>
      <button
        type="button"
        onClick={() => setViewerOpen(true)}
        className="block rounded-xl overflow-hidden relative hover:opacity-90 transition-opacity bg-black/10 mt-1.5"
        style={{ minHeight: 80, maxWidth: 220 }}
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-20 w-32">
            <Loader2 className="h-5 w-5 animate-spin opacity-40" />
          </div>
        ) : cardUrl ? (
          <img src={cardUrl} alt={reference.title} className="block w-full object-cover" style={{ maxHeight: 220 }} />
        ) : (
          <div className="flex items-center justify-center h-20 w-32 opacity-40">
            <FileTypeIcon mimeType={reference.mimeType} />
          </div>
        )}
      </button>
      <ImageViewer
        src={fullUrl ?? cardUrl}
        alt={reference.title}
        fileName={reference.title}
        open={viewerOpen}
        onClose={() => setViewerOpen(false)}
      />
    </>
  );
}

function FileRefDownloadRow({ reference, isOwn }) {
  const [wantsUrl, setWantsUrl] = useState(false);
  const { data: url, isLoading } = useFileRefSignedUrl(reference.recordId, "full", wantsUrl);

  function handleClick() {
    if (url) {
      const a = document.createElement("a");
      a.href = url;
      a.download = reference.title ?? "archivo";
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.click();
      return;
    }
    setWantsUrl(true);
  }

  return (
    <div
      className={[
        "flex items-center gap-2.5 mt-1.5 px-3 py-2 rounded-xl max-w-55",
        isOwn ? "bg-white/15" : "bg-[hsl(var(--border))]",
      ].join(" ")}
    >
      <FileTypeIcon mimeType={reference.mimeType} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{reference.title}</p>
        <p className="text-xs opacity-50">{reference.sizeBytes ? formatFileSize(reference.sizeBytes) : ""}</p>
      </div>
      <button type="button" onClick={handleClick} disabled={isLoading} className="shrink-0 opacity-60 hover:opacity-100 transition-opacity disabled:opacity-20">
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
      </button>
    </div>
  );
}

export function FileReferenceAttachment({ reference, isOwn }) {
  if (isImageMime(reference.mimeType)) return <FileRefImage reference={reference} isOwn={isOwn} />;
  return <FileRefDownloadRow reference={reference} isOwn={isOwn} />;
}
```

- [ ] **Step 3: Export `FileTypeIcon` from ChatFilesGallery.jsx if it isn't already**

Read `apps/desktop/src/modules/atlas.chat/components/ChatFilesGallery.jsx` — it already has `export function FileTypeIcon({ mimeType })` (exported, confirmed by an earlier task in this same module's history). No change needed there; this step is just confirming the import in Step 2 resolves correctly.

- [ ] **Step 4: Confirm `atlas.files.getSignedUrl` and `useAuth`/`atlas` import paths**

Confirm `packages/sdk/src/index.js` exports `files.getSignedUrl(id, token, options)` returning `{ data: { signedUrl, expiresIn } }` shape (check how other callers in this codebase destructure its response, e.g. `res?.data?.url` vs `res?.data?.signedUrl` — use whichever key the real SDK method actually returns, adjust Step 2's code if it differs from `signedUrl`).

- [ ] **Step 5: Verify the build**

Run: `pnpm --filter @atlas/desktop exec vite build`
Expected: build succeeds with no errors (this file isn't imported anywhere yet, so this only confirms it's syntactically valid and its imports resolve).

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/components/FileReferenceAttachment.jsx
git commit -m "feat(chat): add FileReferenceAttachment for previewing file-type entity references"
```

## Process

1. Read the referenced files first to confirm exact patterns and the real SDK response shape — adjust the code above if `atlas.files.getSignedUrl`'s actual response key differs from what's assumed.
2. Implement carefully — this is a new, currently-unwired file; get its internals right since two later tasks depend on it.
3. Run the build and confirm it passes.
4. Commit with the exact message given.
5. Self-review before reporting.

## Report back

End with one of: DONE, DONE_WITH_CONCERNS, NEEDS_CONTEXT, or BLOCKED, plus a short summary.

---

### Task 2: Wire file-ref attachments and entity-ref-only bubble shape into ChatMessageBubble

**Files:** `apps/desktop/src/modules/atlas.chat/components/ChatMessageBubble.jsx`

- [ ] **Step 1: Read the current file in full**

Confirm the current state of the two `{!isDeleted && message.metadata?.entityRefs?.length > 0 && (...)}` blocks (own-message and other-message branches), the `hasBody`/`hasText`/`radius` variables computed near the top, and the `firstEntityRefAttached` flag added in a prior round.

- [ ] **Step 2: Import FileReferenceAttachment**

Add:
```jsx
import { FileReferenceAttachment } from "./FileReferenceAttachment";
```

- [ ] **Step 3: Split entity refs into file-previewable vs generic, in BOTH branches**

Each of the two entity-ref blocks currently maps over `message.metadata.entityRefs` uniformly with `EntityReferenceCard`. Change each to split first — file-type refs WITH `mimeType` render via `FileReferenceAttachment`; everything else (including file-type refs from before Plan F shipped, which won't have `mimeType`) keeps using `EntityReferenceCard` exactly as before. The own-message branch's block currently looks like (after prior rounds' fixes):
```jsx
{!isDeleted && message.metadata?.entityRefs?.length > 0 && (
  <div className={["flex flex-col gap-1", hasText ? "mt-0" : "mt-1"].join(" ")}>
    {message.metadata.entityRefs.map((ref, i) => (
      <EntityReferenceCard
        key={`${ref.entityType}:${ref.recordId}:${i}`}
        reference={ref}
        attached={hasText && i === 0}
        isOwn={true}
      />
    ))}
  </div>
)}
```
Change it to:
```jsx
{!isDeleted && message.metadata?.entityRefs?.length > 0 && (
  <div className={["flex flex-col gap-1", hasText ? "mt-0" : "mt-1"].join(" ")}>
    {message.metadata.entityRefs.map((ref, i) => (
      ref.entityType === "file" && ref.mimeType ? (
        <FileReferenceAttachment key={`${ref.entityType}:${ref.recordId}:${i}`} reference={ref} isOwn={true} />
      ) : (
        <EntityReferenceCard
          key={`${ref.entityType}:${ref.recordId}:${i}`}
          reference={ref}
          attached={hasText && i === 0}
          isOwn={true}
        />
      )
    ))}
  </div>
)}
```
Apply the identical transformation to the other-message branch's copy of this block (same structure, `isOwn={false}` throughout, `attached={hasText && i === 0}` unchanged).

Note: `FileReferenceAttachment` intentionally does NOT receive an `attached` prop — it always renders its own self-contained card look (an image thumbnail or a download row), regardless of whether text precedes it. Merging a real attachment-style preview into the text bubble's shape isn't part of this task's scope (only `EntityReferenceCard`'s generic-link chip merges — the spec's Part A is about making file refs look like real attachments, not about extending the text-bubble-merge treatment to them).

- [ ] **Step 4: Entity-ref-only messages take on the grouped bubble shape**

Find where `firstEntityRefAttached` is computed (added in a prior round, right after `hasBody`). Add a new flag right after it:
```jsx
const entityRefsOnlyBubble = !hasBody && message.metadata?.entityRefs?.length > 0;
```

In BOTH branches, the entity-refs block from Step 3 needs to be wrapped in a bubble-shaped container when `entityRefsOnlyBubble` is true. Change the wrapping structure from:
```jsx
{!isDeleted && message.metadata?.entityRefs?.length > 0 && (
  <div className={["flex flex-col gap-1", hasText ? "mt-0" : "mt-1"].join(" ")}>
    {/* ...map from Step 3... */}
  </div>
)}
```
to:
```jsx
{!isDeleted && message.metadata?.entityRefs?.length > 0 && (
  <div
    className={[
      "flex flex-col gap-1",
      hasText ? "mt-0" : "mt-1",
      entityRefsOnlyBubble ? [radius, "overflow-hidden", "bg-(--brand-primary)"].join(" ") : "",
    ].join(" ")}
  >
    {/* ...map from Step 3, but with one change: ... */}
  </div>
)}
```
For the OTHER-message branch, the background class is `"bg-[hsl(var(--muted))]"` instead of `"bg-(--brand-primary)"` — same pattern as the text bubble's own own/other background split elsewhere in this file.

Inside the map (from Step 3), when `entityRefsOnlyBubble` is true, EVERY entity ref (not just `i === 0`) should render as `attached={true}` on `EntityReferenceCard` calls (not `FileReferenceAttachment` calls — those are unaffected per Step 3's note) — because when the whole message IS the bubble (no text), every ref inside it is "continuing" the synthetic bubble shape around it, not just the first one. Change the `attached` prop on the `EntityReferenceCard` branch of the Step 3 ternary from `attached={hasText && i === 0}` to `attached={hasText ? i === 0 : entityRefsOnlyBubble}` in both message branches — this preserves the existing "only first ref merges with preceding TEXT" rule when there IS text, while making ALL refs merge with each other (and the wrapping bubble container) when there's no text and the whole message is composed of references.

Since `EntityReferenceCard` rendered inside an `entityRefsOnlyBubble` wrapper already sits inside a `bg-(--brand-primary)`/`bg-[hsl(var(--muted))]` container with the bubble's own radius, its own `rounded-xl`/border/background become redundant there — but leaving them as-is is harmless (the outer wrapper's `overflow-hidden` + matching radius/background makes the inner card's own now-`attached` styling — border-transparent, matching bg, `rounded-t-none` — blend in correctly without needing further changes to `EntityReferenceCard.jsx` itself).

- [ ] **Step 5: Verify the build**

Run: `pnpm --filter @atlas/desktop exec vite build`
Expected: build succeeds with no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/components/ChatMessageBubble.jsx
git commit -m "feat(chat): render file-type entity refs as attachments, group text-less entity-ref messages into a bubble"
```

## Process

1. Read the full current file first.
2. Implement Steps 3-4 in BOTH branches (own-message, other-message) — this is easy to half-do by only updating one branch. Double-check both got identical treatment (mirrored for `isOwn`).
3. Run the build and confirm it passes.
4. Commit with the exact message given.
5. Self-review your diff before reporting — confirm no hooks-rule violations were introduced (the new conditional rendering doesn't call any hook conditionally — `FileReferenceAttachment`/`EntityReferenceCard` are separate components, each free to call their own hooks internally regardless of which one a given ref renders through).

## Report back

End with one of: DONE, DONE_WITH_CONCERNS, NEEDS_CONTEXT, or BLOCKED, plus a short summary.

---

### Task 3: ChatFilesGallery indexes file-type entity references

**Files:** `apps/desktop/src/modules/atlas.chat/components/ChatFilesGallery.jsx`

- [ ] **Step 1: Read the current file in full**

Confirm the current `allAttachments` memo, `images`/`otherFiles` derived memos, and the image-grid/file-list render blocks (including the selection-mode wiring from a prior round).

- [ ] **Step 2: Import what's needed**

Add:
```jsx
import { useFileRefSignedUrl } from "./FileReferenceAttachment";
```

- [ ] **Step 3: Extend allAttachments to include file-type entity refs**

Change the `allAttachments` memo from:
```jsx
const allAttachments = useMemo(() => {
  if (!messages?.length) return [];
  const result = [];
  for (const msg of [...messages].reverse()) {
    for (const att of (msg.attachments ?? [])) {
      result.push({ ...att, createdAt: msg.created_at, msgAttachments: msg.attachments });
    }
  }
  return result;
}, [messages]);
```
to:
```jsx
const allAttachments = useMemo(() => {
  if (!messages?.length) return [];
  const result = [];
  for (const msg of [...messages].reverse()) {
    for (const att of (msg.attachments ?? [])) {
      result.push({ ...att, createdAt: msg.created_at, msgAttachments: msg.attachments, isEntityRef: false });
    }
    for (const ref of (msg.metadata?.entityRefs ?? [])) {
      if (ref.entityType !== "file" || !ref.mimeType) continue;
      result.push({
        id: ref.recordId,
        mimeType: ref.mimeType,
        fileName: ref.title,
        sizeBytes: ref.sizeBytes,
        createdAt: msg.created_at,
        url: null,
        isEntityRef: true,
      });
    }
  }
  return result;
}, [messages]);
```
(`isEntityRef` distinguishes the two kinds downstream — real attachments already have an embedded `url`; entity-ref-file items never do, and need a lazy fetch instead, per Step 4/5.)

- [ ] **Step 4: Add a lazy-loading image tile for entity-ref images**

The image grid currently renders each `att` directly with `<img src={att.url} .../>`. Add a small wrapper component right after `MediaSelectionCircle`:
```jsx
function MediaImageThumb({ att }) {
  const { data: lazyUrl, isLoading } = useFileRefSignedUrl(att.id, "card", att.isEntityRef);
  const url = att.isEntityRef ? lazyUrl : att.url;

  if (att.isEntityRef && isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin opacity-40" />
      </div>
    );
  }
  if (url) return <img src={url} alt={att.fileName ?? ""} className="w-full h-full object-cover" />;
  return (
    <div className="w-full h-full flex items-center justify-center">
      <FileImage className="h-6 w-6 text-[hsl(var(--muted-foreground))]" />
    </div>
  );
}
```
Add `Loader2` to the existing `lucide-react` import list at the top of the file.

- [ ] **Step 5: Use MediaImageThumb in the image grid, and handle entity-ref clicks separately from real-attachment clicks**

The image grid button's contents currently branch on `att.url` directly:
```jsx
{att.url ? (
  <img src={att.url} alt={att.fileName ?? ""} className="w-full h-full object-cover" />
) : (
  <div className="w-full h-full flex items-center justify-center">
    <FileImage className="h-6 w-6 text-[hsl(var(--muted-foreground))]" />
  </div>
)}
```
Replace that with `<MediaImageThumb att={att} />`.

Clicking a real attachment opens `ChatAttachmentViewer` via `onAttachmentClick(att.msgAttachments, idx)` (gallery navigation across that message's attachments) — this doesn't make sense for an entity-ref item (it has no `msgAttachments` sibling list, and isn't a `chat_attachments` row `ChatAttachmentViewer`'s signed-URL resolution can handle). Change the image button's `onClick` from:
```jsx
onClick={() => {
  if (selectionMode) {
    onToggleSelect(att.id);
    return;
  }
  const idx = att.msgAttachments.findIndex((a) => a.id === att.id);
  onAttachmentClick(att.msgAttachments, idx >= 0 ? idx : 0);
}}
```
to:
```jsx
onClick={() => {
  if (selectionMode) {
    onToggleSelect(att.id);
    return;
  }
  if (att.isEntityRef) {
    setEntityRefViewer({ open: true, recordId: att.id, title: att.fileName });
    return;
  }
  const idx = att.msgAttachments.findIndex((a) => a.id === att.id);
  onAttachmentClick(att.msgAttachments, idx >= 0 ? idx : 0);
}}
```
This introduces new local state — add near the top of `ChatFilesGallery`'s function body (it's currently a function with no local state at all besides props; this is the first):
```jsx
const [entityRefViewer, setEntityRefViewer] = useState({ open: false, recordId: null, title: null });
```
Add `useState` to the React import at the top of the file (currently only `useMemo` is imported).

Render the viewer for it — add near the end of the component's returned JSX (as a sibling to the outermost `<div>`, i.e. wrap the existing return value in a fragment):
```jsx
function ChatFilesGalleryImageViewer({ recordId, title, open, onClose }) {
  const { data: fullUrl } = useFileRefSignedUrl(recordId, "full", open);
  return <ImageViewer src={fullUrl} alt={title} fileName={title} open={open} onClose={onClose} />;
}
```
(add this small component definition alongside `MediaImageThumb`), then in the main return, wrap the existing root `<div className={...}>...</div>` in a fragment with this viewer as a sibling:
```jsx
return (
  <>
    <div className={[scrollableClass, "p-3 space-y-4"].join(" ")}>
      {/* ...unchanged existing content... */}
    </div>
    <ChatFilesGalleryImageViewer
      recordId={entityRefViewer.recordId}
      title={entityRefViewer.title}
      open={entityRefViewer.open}
      onClose={() => setEntityRefViewer((v) => ({ ...v, open: false }))}
    />
  </>
);
```
Import `ImageViewer` from `@atlas/ui` at the top of the file.

- [ ] **Step 6: Handle entity-ref items in the "Archivos" (non-image) list**

The non-image file row's `onClick` currently does the same `msgAttachments`-based gallery-open logic — for `otherFiles` entries that are entity refs, clicking should instead directly download (fetch a "full" variant signed URL, then trigger a browser download), matching `FileReferenceAttachment`'s `FileRefDownloadRow` behavior. Change the file row `<button>`'s `onClick` from:
```jsx
onClick={() => {
  const idx = att.msgAttachments.findIndex((a) => a.id === att.id);
  onAttachmentClick(att.msgAttachments, idx >= 0 ? idx : 0);
}}
```
to:
```jsx
onClick={async () => {
  if (att.isEntityRef) {
    const { atlas } = await import("../../../lib/atlas");
    // Token isn't available in this component today (no useAuth call
    // exists here) — read it the same way FileReferenceAttachment.jsx
    // does, via useAuth, rather than a dynamic import trick. See note below.
    return;
  }
  const idx = att.msgAttachments.findIndex((a) => a.id === att.id);
  onAttachmentClick(att.msgAttachments, idx >= 0 ? idx : 0);
}}
```
The dynamic-import approach above is a placeholder shown only to illustrate the branch — do NOT actually use a dynamic import. Instead: add `import { useAuth } from "../../../auth/AuthProvider";` and `import { atlas } from "../../../lib/atlas";` to the top of the file, call `const { session } = useAuth(); const token = session?.access_token;` near the top of `ChatFilesGallery`'s function body (alongside the new `entityRefViewer` state), and implement the click handler as:
```jsx
onClick={async () => {
  if (att.isEntityRef) {
    const res = await atlas.files.getSignedUrl(att.id, token, { variant: "full" });
    const url = res?.data?.signedUrl;
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = att.fileName ?? "archivo";
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.click();
    return;
  }
  const idx = att.msgAttachments.findIndex((a) => a.id === att.id);
  onAttachmentClick(att.msgAttachments, idx >= 0 ? idx : 0);
}}
```
(adjust `res?.data?.signedUrl` to whatever key Task 1 Step 4 confirmed the real SDK response actually uses, if different.)

- [ ] **Step 7: Verify the build**

Run: `pnpm --filter @atlas/desktop exec vite build`
Expected: build succeeds with no errors.

- [ ] **Step 8: Manual visual check**

Attach a "file" entity reference (paperclip/link picker → "Archivo" → pick an existing image file) to a new message and send it. Confirm: it renders inline as an image thumbnail (not a generic link card), clicking it opens the lightbox with a real image. Open the conversation's Media section (or the standalone files view) — confirm the same image now appears in the "Fotos y videos" grid, and clicking it there also opens correctly. Attach a non-image file (e.g. a PDF) as an entity reference — confirm it renders as a download row inline, and appears in the "Archivos" list in the Media section, downloading correctly when clicked there.

- [ ] **Step 9: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/components/ChatFilesGallery.jsx
git commit -m "feat(chat): index file-type entity references into the media/files gallery"
```

## Process

1. Read the full current file first.
2. Implement each step carefully — this task adds real local state and async logic to a component that previously had neither; be precise about hook placement (top-level, unconditional).
3. Run the build and confirm it passes.
4. Commit with the exact message given.
5. Self-review before reporting — confirm real attachments' existing behavior (grid display, gallery-open-on-click, selection mode) is completely unchanged for `att.isEntityRef === false` items.

## Report back

End with one of: DONE, DONE_WITH_CONCERNS, NEEDS_CONTEXT, or BLOCKED, plus a short summary.

---

### Task 4: Media section preview limit + "Mostrar más"

**Files:**
- Modify: `apps/desktop/src/modules/atlas.chat/components/ConversationMediaTab.jsx`
- Modify: `apps/desktop/src/modules/atlas.chat/components/ConversationProfilePanel.jsx`
- Modify: `apps/desktop/src/modules/atlas.chat/components/ChatWindow.jsx`
- Modify: `apps/desktop/src/modules/atlas.chat/components/MiniChatWindow.jsx`

- [ ] **Step 1: Add a `preview`/`onShowAll` mode to ConversationMediaTab**

Read the current `ConversationMediaTab.jsx` in full. Add two new optional props: `preview = false` and `onShowAll` (a callback). When `preview` is true, only the first 6 items of `allAttachments` should be passed to `ChatFilesGallery` for rendering (NOT the full list — but `handleBulkDownload`'s own `allAttachments` computation, used for the selection/download feature, keeps seeing the FULL list; the cap only applies to what's visually rendered), and a "Mostrar más" button renders below the gallery when `allAttachments.length > 6`.

The cleanest way to cap what `ChatFilesGallery` renders without duplicating its internal image/file-splitting logic: `ChatFilesGallery` needs its OWN new `previewLimit` prop (optional, `undefined` = show everything, matching today's behavior for the standalone files view and the non-preview mode). Add this prop to `ChatFilesGallery.jsx`'s signature and apply it inside its `images`/`otherFiles` memos:

In `ChatFilesGallery.jsx`, change:
```jsx
export function ChatFilesGallery({
  messages, isLoading, onAttachmentClick,
  selectionMode = false, selectedIds = EMPTY_SELECTION, onToggleSelect, onEnterSelection, onCancelSelection,
  scrollable = true,
}) {
```
to:
```jsx
export function ChatFilesGallery({
  messages, isLoading, onAttachmentClick,
  selectionMode = false, selectedIds = EMPTY_SELECTION, onToggleSelect, onEnterSelection, onCancelSelection,
  scrollable = true, previewLimit,
}) {
```
And change:
```jsx
  const images = useMemo(() => allAttachments.filter((a) => isImageMime(a.mimeType)), [allAttachments]);
  const otherFiles = useMemo(() => allAttachments.filter((a) => !isImageMime(a.mimeType)), [allAttachments]);
```
to:
```jsx
  const images = useMemo(() => {
    const all = allAttachments.filter((a) => isImageMime(a.mimeType));
    return previewLimit ? all.slice(0, previewLimit) : all;
  }, [allAttachments, previewLimit]);
  const otherFiles = useMemo(() => {
    const all = allAttachments.filter((a) => !isImageMime(a.mimeType));
    return previewLimit ? all.slice(0, previewLimit) : all;
  }, [allAttachments, previewLimit]);
```
(when `previewLimit` is set, the "Fotos y videos"/"Archivos" headers and selection toolbar still render normally above whatever subset is shown — this task doesn't touch that, only which items end up in each list.)

In `ConversationMediaTab.jsx`, update the export signature and the `<ChatFilesGallery>` call:
```jsx
export function ConversationMediaTab({ messages, isLoading, preview = false, onShowAll }) {
```
and pass `previewLimit={preview ? 6 : undefined}` to `<ChatFilesGallery .../>`. Then, right after the `<ChatFilesGallery .../>` element (before the sticky selection bar), add:
```jsx
{preview && !selectionMode && allAttachments.length > 6 && (
  <button
    type="button"
    onClick={onShowAll}
    className="mx-3 mb-3 text-xs font-medium text-[hsl(var(--primary))] hover:underline text-center"
  >
    Mostrar mas
  </button>
)}
```

- [ ] **Step 2: Thread `onShowAllFiles` through ConversationProfilePanel**

`ConversationProfilePanel` gains a new prop, `onShowAllFiles`. Both `<ConversationMediaTab .../>` call sites (direct branch, group/channel branch) change from:
```jsx
<ConversationMediaTab messages={messages} isLoading={isLoadingMessages} />
```
to:
```jsx
<ConversationMediaTab messages={messages} isLoading={isLoadingMessages} preview onShowAll={onShowAllFiles} />
```
Update the function signature:
```jsx
export function ConversationProfilePanel({ conversation, currentUserId, initialTab, onBack, messages, isLoadingMessages, onShowAllFiles }) {
```

- [ ] **Step 3: Wire `onShowAllFiles` from ChatWindow.jsx**

Read `ChatWindow.jsx`'s existing `openProfile`/`closeProfile` callbacks and the `<ConversationProfilePanel .../>` call site. Add a new handler near `closeProfile`:
```jsx
const showAllFiles = useCallback(() => {
  setMembersView(false);
  setProfileInitialTab(null);
  setFilesView(true);
}, []);
```
Pass it to the profile panel: add `onShowAllFiles={showAllFiles}` to the existing `<ConversationProfilePanel .../>` props (keep every other existing prop unchanged).

- [ ] **Step 4: Wire `onShowAllFiles` from MiniChatWindow.jsx**

`MiniChatWindow.jsx` has no `filesView` concept of its own — its dropdown menu's "Ver todos los archivos" item already navigates to the full `ChatWindow` with a `?view=files` query param and closes the mini window (`handleViewFiles`, confirm the exact current implementation by reading the file). Reuse that same function: pass `onShowAllFiles={handleViewFiles}` to the existing `<ConversationProfilePanel .../>` call site inside `MiniChatWindow.jsx` (keep every other existing prop unchanged).

- [ ] **Step 5: Verify the build**

Run: `pnpm --filter @atlas/desktop exec vite build`
Expected: build succeeds with no errors.

- [ ] **Step 6: Manual visual check**

Open a conversation's profile panel where the conversation has more than 6 shared images/files. Confirm the Media section shows only 6 previews plus a "Mostrar mas" link. Click it — confirm the profile panel closes and the full standalone files view opens showing everything. Do the same from a floating mini-chat window — confirm it navigates to the full chat view with the files view open.

- [ ] **Step 7: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/components/ConversationMediaTab.jsx apps/desktop/src/modules/atlas.chat/components/ConversationProfilePanel.jsx apps/desktop/src/modules/atlas.chat/components/ChatFilesGallery.jsx apps/desktop/src/modules/atlas.chat/components/ChatWindow.jsx apps/desktop/src/modules/atlas.chat/components/MiniChatWindow.jsx
git commit -m "feat(chat): cap the profile panel's media preview with a Mostrar mas link to the full gallery"
```

## Process

1. Read every file involved first — confirm `handleViewFiles`'s exact current implementation in `MiniChatWindow.jsx` before wiring it, and confirm `openProfile`/`closeProfile`'s exact current implementation in `ChatWindow.jsx`.
2. Implement each step in order — this task touches 5 files, all needing to agree on the same prop name (`onShowAllFiles`) and behavior.
3. Run the build and confirm it passes.
4. Commit with the exact message given.
5. Self-review before reporting — confirm the standalone files view (opened directly via the folder icon, NOT through the profile panel) is completely unaffected (it never passes `previewLimit`, so `ChatFilesGallery` behaves exactly as before there).

## Report back

End with one of: DONE, DONE_WITH_CONCERNS, NEEDS_CONTEXT, or BLOCKED, plus a short summary.

---

### Task 5: Danger zone as the last section, centered buttons

**Files:**
- Modify: `apps/desktop/src/modules/atlas.chat/components/ConversationProfilePanel.jsx`
- Modify: `apps/desktop/src/modules/atlas.chat/components/ConversationInfoTab.jsx`

- [ ] **Step 1: Reorder the direct-conversation branch's sections**

In `ConversationProfilePanel.jsx`'s `type === "direct"` return branch, the four `data-section` divs currently appear in this order: `info`, `media`, `common`, `notifications`. Reorder them to: `media`, `common`, `notifications`, `info` — moving the entire `<div data-section="info">...</div>` block (unchanged internally) to the END of the sections list, after `notifications`. Do not change the group/channel branch — it has no equivalent standalone danger-zone section (block/report doesn't apply to groups/channels per this module's existing design).

- [ ] **Step 2: Rename the section's label**

Change the `info` section's `SectionHeader` from:
```jsx
<SectionHeader icon={Info} label="Info" />
```
to:
```jsx
<SectionHeader icon={Info} label="Zona de peligro" />
```
(this section only ever contains the block/report danger-zone content — `ConversationInfoTab` — so its header should say what it actually is, per the user's own framing of it as "la zona de peligro".)

- [ ] **Step 3: Center the danger-zone buttons**

Read `ConversationInfoTab.jsx`. Its root currently reads `className="p-4 space-y-6"` wrapping a `<div className="pt-4 border-t border-[hsl(var(--border))] space-y-2">` containing the section label and the block/report `<Button>`s (each currently `className="w-full justify-start ..."`). Since this section no longer sits above other content (it's now standalone, the section header from Step 2 already labels it), the redundant inner "Zona de peligro" label paragraph inside `ConversationInfoTab.jsx` itself should be removed (the outer `SectionHeader` from Step 2 already says this) — change the root to:
```jsx
<div className="p-4 flex flex-col items-center gap-2">
```
Remove the `<p className="text-[10px] font-semibold uppercase tracking-wide ...">Zona de peligro</p>` line entirely (its text is now redundant with the `SectionHeader` added in Step 2). Change each `<Button className="w-full justify-start ...">` (there are two — block/unblock, and report) to `<Button className="w-full max-w-xs justify-center ...">` — keep every other class on those buttons (icon, color, disabled state) exactly as they are, only change `justify-start` to `justify-center` and add `max-w-xs` so the centered buttons don't stretch edge-to-edge in a wide sidebar.

- [ ] **Step 4: Verify the build**

Run: `pnpm --filter @atlas/desktop exec vite build`
Expected: build succeeds with no errors.

- [ ] **Step 5: Manual visual check**

Open a direct conversation's profile panel. Confirm the section order is Media → En comun → Notificaciones → Zona de peligro, and the "Zona de peligro" section's block/report buttons are horizontally centered rather than stretching full-width from the left.

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/components/ConversationProfilePanel.jsx apps/desktop/src/modules/atlas.chat/components/ConversationInfoTab.jsx
git commit -m "feat(chat): move the danger zone to the last profile section and center its buttons"
```

## Process

1. Read both files first.
2. Reorder only the direct branch's sections — the group/channel branch stays untouched.
3. Run the build and confirm it passes.
4. Commit with the exact message given.
5. Self-review before reporting — confirm `ConversationInfoTab`'s two Dialog/ConfirmDialog instances (block confirmation, report form) still render correctly outside the centered-button flow (they're separate `<Dialog>`/`<ConfirmDialog>` elements after the buttons, not part of the centered layout, and shouldn't need any change).

## Report back

End with one of: DONE, DONE_WITH_CONCERNS, NEEDS_CONTEXT, or BLOCKED, plus a short summary.

---

### Task 6: Avatar lightbox fetches the full-resolution image

**Files:**
- Modify: `apps/desktop/src/modules/atlas.chat/components/ConversationProfilePanel.jsx`
- Modify: `apps/desktop/src/modules/atlas.chat/components/ChannelGeneralTab.jsx`

**Requires Plan F Task 2** (member `avatarFileId` must be present in API responses) to have any effect — without it, `otherMemberForHero.avatarFileId` is `undefined` and this task's new code simply has nothing to fetch, falling back to the thumb URL exactly as before (safe either way, but pointless until Plan F ships).

- [ ] **Step 1: Add a lazy full-avatar fetch to ConversationProfilePanel**

Read the current file. It already has `heroAvatarUrl` (the thumb URL) and `avatarViewerOpen` state. Add, right after the `useFileRefSignedUrl` import isn't needed here since avatars aren't entity refs — instead add a plain `useQuery` inline (or reuse the pattern): import `useQuery` from `@tanstack/react-query` and `atlas` from `../../../lib/atlas` and `useAuth` from `../../../auth/AuthProvider` if not already imported (check first — `useChatConversationDetail` etc. suggest React Query is already in play here; confirm the exact existing imports before adding duplicates).

Compute the avatar's underlying file id:
```jsx
const heroAvatarFileId = conversation?.avatar_file_id ?? otherMemberForHero?.avatarFileId ?? null;
```
(`conversation.avatar_file_id` — snake_case — is already present in every conversation payload this component receives, per this codebase's existing inconsistent-casing convention already noted elsewhere in this same file for `avatar_emoji`. `otherMemberForHero.avatarFileId` — camelCase — becomes available once Plan F Task 2 ships.)

Add a query that only runs once the viewer is actually open:
```jsx
const { session } = useAuth();
const { data: fullAvatarUrl } = useQuery({
  queryKey: ["chat-avatar-full-url", heroAvatarFileId],
  queryFn: async () => {
    const res = await atlas.files.getSignedUrl(heroAvatarFileId, session?.access_token, { variant: "full" });
    return res?.data?.signedUrl ?? null;
  },
  enabled: Boolean(avatarViewerOpen && heroAvatarFileId && session?.access_token),
  staleTime: 50 * 60 * 1000,
});
```

- [ ] **Step 2: Use the full URL in the ImageViewer, falling back to the thumb while loading**

Find the `avatarViewer` const (`<ImageViewer src={heroAvatarUrl} .../>`) and change `src={heroAvatarUrl}` to `src={fullAvatarUrl ?? heroAvatarUrl}` — so the lightbox shows the (already-loaded, instant) thumbnail immediately, then swaps to the full-resolution image the moment the query resolves, rather than showing nothing while loading.

- [ ] **Step 3: Apply the identical treatment to ChannelGeneralTab.jsx**

Read the current file. It already imports `useAuth`, `atlas`, and has `session`/`token` in scope. Add the same lazy full-avatar query:
```jsx
const { data: fullAvatarUrl } = useQuery({
  queryKey: ["chat-avatar-full-url", conversation?.avatar_file_id],
  queryFn: async () => {
    const res = await atlas.files.getSignedUrl(conversation.avatar_file_id, token, { variant: "full" });
    return res?.data?.signedUrl ?? null;
  },
  enabled: Boolean(avatarViewerOpen && conversation?.avatar_file_id && token),
  staleTime: 50 * 60 * 1000,
});
```
(`useQuery` is already imported in this file, from `@tanstack/react-query`, for `updateMutation`/`uploadMutation`'s sibling `useMutation` calls — confirm, and add the `useQuery` import if it's genuinely missing.)

Change the existing `<ImageViewer src={conversation?.avatarUrl} .../>` to `<ImageViewer src={fullAvatarUrl ?? conversation?.avatarUrl} .../>`.

- [ ] **Step 4: Verify the build**

Run: `pnpm --filter @atlas/desktop exec vite build`
Expected: build succeeds with no errors.

- [ ] **Step 5: Manual visual check**

Open a direct conversation's profile with a contact who has a real uploaded photo. Click the hero avatar — confirm the lightbox opens instantly with the thumbnail, then (briefly after) sharpens to a visibly higher-resolution image once the full variant loads. Repeat for a group/channel's avatar in its General section.

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/components/ConversationProfilePanel.jsx apps/desktop/src/modules/atlas.chat/components/ChannelGeneralTab.jsx
git commit -m "feat(chat): fetch the full-resolution avatar image for the lightbox instead of the thumbnail"
```

## Process

1. Read both files first, and confirm exactly which React Query/auth imports already exist in each before adding new ones (avoid duplicate imports).
2. Implement the lazy-fetch-on-open pattern carefully — the query must be gated on the viewer actually being open (`enabled: ...`), not fetched eagerly on every render.
3. Run the build and confirm it passes.
4. Commit with the exact message given.
5. Self-review before reporting — confirm this doesn't fire a network request every time the profile panel itself opens (only when the AVATAR is clicked, i.e. `avatarViewerOpen` becomes true).

## Report back

End with one of: DONE, DONE_WITH_CONCERNS, NEEDS_CONTEXT, or BLOCKED, plus a short summary.

---

### Task 7: Document ChatMessageBubble.jsx's file size in CLAUDE.md

**Files:** `CLAUDE.md`

- [ ] **Step 1: Check the current line count**

Run: `wc -l apps/desktop/src/modules/atlas.chat/components/ChatMessageBubble.jsx`
This file was already at 1109 lines before this plan's Task 2 added more to it (over this project's 1000-line soft limit) — Task 2 doesn't reduce it.

- [ ] **Step 2: Add it to CLAUDE.md's "Known violators" list**

Find the sentence in `CLAUDE.md` listing known file-size violators (search for "Known violators that must be decomposed"). Add `ChatMessageBubble.jsx` to that list, following the exact same format as the existing entries (line count, one-sentence extraction recommendation). Suggested wording, adjusted to the real current line count from Step 1:
```
`ChatMessageBubble.jsx` (<N> lines, apps/desktop/src/modules/atlas.chat/components/) — the ImageCard/VideoCard/AudioCard/FileCard/AttachmentsBlock sub-components (message-attachment rendering) are natural extraction candidates into a sibling `MessageAttachments.jsx`, mirroring how FileReferenceAttachment.jsx was already split out for entity-reference-file previews.
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: flag ChatMessageBubble.jsx as a known file-size violator"
```

## Process

1. Run the line-count command first — do not guess the number.
2. Add exactly one new bullet/sentence to the existing violators list, matching its established format and tone.
3. Commit with the exact message given.

## Report back

End with one of: DONE, DONE_WITH_CONCERNS, NEEDS_CONTEXT, or BLOCKED, plus a short summary.

---

## Self-Review Notes

- **Spec coverage:** Part A1 (backend) → Plan F. Part A2/A3 → Tasks 1-3. Part B1 → Task 4. Part B2 → Task 5. Part B3 (frontend half) → Task 6. Part C → Task 2 Step 4. File-size discipline → Task 7.
- **Type/prop consistency:** `FileReferenceAttachment({ reference, isOwn })` and `useFileRefSignedUrl(recordId, variant, enabled)` (Task 1) are consumed with matching signatures in Task 2 (`ChatMessageBubble.jsx`) and Task 3 (`ChatFilesGallery.jsx`). `ConversationMediaTab`'s new `preview`/`onShowAll` props (Task 4) match what `ConversationProfilePanel` passes. `onShowAllFiles` is the single prop name used consistently from `ChatWindow.jsx`/`MiniChatWindow.jsx` down through `ConversationProfilePanel` to `ConversationMediaTab`.
- **No new access-control exposure**: every signed-URL fetch introduced in Tasks 1, 3, and 6 goes through the exact same pre-existing `GET /files/:id/signed-url` endpoint (company-scoped `files.assets.read` check), already reachable by any authenticated company member for any company file id — nothing here makes any file more reachable than it already was.
