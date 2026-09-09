# Chat Pending Attachments — Plan B (UI) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user open a still-pending composer attachment in the shared file viewer, and make the composer tell the server to discard uploads it removes or abandons (relies on Plan A's `DELETE /chat/attachments/:id` pending support).

**Architecture:** Pure decision/mapping logic moves into a testable `lib/pendingAttachments.js` (this repo has no React-component test runner — `react-exports.test.js` is a known-red stub — so component behavior is validated through the pure lib). `MessageComposer` creates a blob URL for every pending file, renders each preview card as a click target that opens `ChatAttachmentViewer` (extended with an optional `resolveUrl` override that returns the local blob URL, no network), and calls a new `useChatUpload().deleteUpload(id)` from `removeFile` and from its unmount / conversation-switch cleanup, skipping ids already handed to a successful send.

**Tech Stack:** React 19, `@atlas/ui`, `@atlas/sdk` (`atlas.chat.deleteAttachment` — already exists), `AdvancedFileViewer` (atlas.files), Node built-in test runner for the lib.

Reference spec: `docs/superpowers/specs/2026-09-09-chat-pending-attachments-design.md`

---

### Task 1: Pure lib — `mapPendingToViewerFiles` + `attachmentIdsToDiscard`

**Files:**
- Create: `apps/desktop/src/modules/atlas.chat/lib/pendingAttachments.js`
- Test: `apps/desktop/src/modules/atlas.chat/lib/__tests__/pendingAttachments.test.js`

- [ ] **Step 1: Write the failing test**

Create `apps/desktop/src/modules/atlas.chat/lib/__tests__/pendingAttachments.test.js`:

```javascript
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  mapPendingToViewerFiles,
  attachmentIdsToDiscard,
} from "../pendingAttachments.js";

const img = { localId: "l1", objectUrl: "blob:img", attachmentId: "a1", file: { name: "foto.jpg", type: "image/jpeg", size: 10 } };
const pdf = { localId: "l2", objectUrl: "blob:pdf", attachmentId: "a2", file: { name: "doc.pdf", type: "application/pdf", size: 20 } };
const voice = { localId: "l3", objectUrl: "blob:aud", attachmentId: "a3", file: { name: "nota_de_voz_10-00-00.webm", type: "audio/webm", size: 30 } };

describe("mapPendingToViewerFiles", () => {
  it("keeps non-audio entries in order and maps them to the viewer shape", () => {
    const files = mapPendingToViewerFiles([img, voice, pdf]);
    assert.deepEqual(files, [
      { id: "l1", mimeType: "image/jpeg", fileName: "foto.jpg", originalName: "foto.jpg", sizeBytes: 10, url: "blob:img", thumbnailUrl: "blob:img" },
      { id: "l2", mimeType: "application/pdf", fileName: "doc.pdf", originalName: "doc.pdf", sizeBytes: 20, url: "blob:pdf", thumbnailUrl: "blob:pdf" },
    ]);
  });

  it("drops audio / voice notes", () => {
    assert.deepEqual(mapPendingToViewerFiles([voice]), []);
  });

  it("tolerates a missing file object", () => {
    const files = mapPendingToViewerFiles([{ localId: "x", objectUrl: null }]);
    assert.equal(files.length, 1);
    assert.equal(files[0].id, "x");
    assert.equal(files[0].url, null);
  });
});

describe("attachmentIdsToDiscard", () => {
  it("returns attachmentIds of entries not in the sent set", () => {
    assert.deepEqual(attachmentIdsToDiscard([img, pdf], new Set(["l1"])), ["a2"]);
  });

  it("skips entries with no attachmentId yet", () => {
    const uploading = { localId: "l9", attachmentId: null, file: { name: "x", type: "image/png", size: 1 } };
    assert.deepEqual(attachmentIdsToDiscard([uploading], new Set()), []);
  });

  it("returns everything when nothing was sent", () => {
    assert.deepEqual(attachmentIdsToDiscard([img, pdf], new Set()), ["a1", "a2"]);
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `node --test apps/desktop/src/modules/atlas.chat/lib/__tests__/pendingAttachments.test.js`
Expected: FAIL — `Cannot find module '../pendingAttachments.js'`.

- [ ] **Step 3: Implement the lib**

Create `apps/desktop/src/modules/atlas.chat/lib/pendingAttachments.js`:

```javascript
// apps/desktop/src/modules/atlas.chat/lib/pendingAttachments.js
//
// Pure helpers for the composer's pending-attachment queue. Kept out of
// MessageComposer.jsx so the branching logic is unit-testable (this repo has
// no React-component test runner).

import { isAudioAttachment } from "./chatUtils.js";

// Map the composer's pending-file entries to the shape ChatAttachmentViewer /
// AdvancedFileViewer expect. Audio / voice notes are excluded — they are
// played inline in the bubble after send and have no viewer treatment.
export function mapPendingToViewerFiles(pendingFiles) {
  return (pendingFiles ?? [])
    .filter((entry) => {
      const name = entry?.file?.name ?? "";
      const mimeType = entry?.file?.type ?? "";
      return !isAudioAttachment({ fileName: name, mimeType });
    })
    .map((entry) => {
      const name = entry?.file?.name ?? "archivo";
      return {
        id: entry.localId,
        mimeType: entry?.file?.type ?? "",
        fileName: name,
        originalName: name,
        sizeBytes: entry?.file?.size ?? 0,
        url: entry.objectUrl ?? null,
        thumbnailUrl: entry.objectUrl ?? null,
      };
    });
}

// attachmentIds of queue entries whose upload finished but which were NOT part
// of a successful send (their localId is absent from sentLocalIds). These are
// the rows the composer must ask the server to discard on remove / unmount.
export function attachmentIdsToDiscard(pendingFiles, sentLocalIds) {
  const sent = sentLocalIds ?? new Set();
  return (pendingFiles ?? [])
    .filter((entry) => entry?.attachmentId && !sent.has(entry.localId))
    .map((entry) => entry.attachmentId);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test apps/desktop/src/modules/atlas.chat/lib/__tests__/pendingAttachments.test.js`
Expected: PASS — all cases green.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/lib/pendingAttachments.js apps/desktop/src/modules/atlas.chat/lib/__tests__/pendingAttachments.test.js
git commit -m "feat(chat): pure helpers for pending-attachment viewer mapping + discard set"
```

---

### Task 2: `useChatUpload().deleteUpload`

**Files:**
- Modify: `apps/desktop/src/modules/atlas.chat/hooks/useChatUpload.js`

- [ ] **Step 1: Add `deleteUpload` and export it**

In `apps/desktop/src/modules/atlas.chat/hooks/useChatUpload.js`, replace the final `return { uploadFile };` (line 60) with:

```javascript
  // Discard an already-presigned/uploaded attachment that never got sent
  // (composer "remove", or the composer unmounting with unsent uploads).
  // Best-effort: the worker's orphan sweep is the backstop.
  async function deleteUpload(attachmentId) {
    if (!attachmentId) return;
    await atlas.chat.deleteAttachment(attachmentId, session?.access_token);
  }

  return { uploadFile, deleteUpload };
```

- [ ] **Step 2: Syntax-check**

Run: `node --check apps/desktop/src/modules/atlas.chat/hooks/useChatUpload.js`
Expected: no output (exit 0).

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/hooks/useChatUpload.js
git commit -m "feat(chat): useChatUpload exposes deleteUpload for discarding unsent attachments"
```

---

### Task 3: `ChatAttachmentViewer` — optional `resolveUrl` override + Office prop pass-through

**Files:**
- Modify: `apps/desktop/src/modules/atlas.chat/components/ChatAttachmentViewer.jsx`

- [ ] **Step 1: Accept the new props**

In `apps/desktop/src/modules/atlas.chat/components/ChatAttachmentViewer.jsx`, change the component signature (line 20) from:

```javascript
export function ChatAttachmentViewer({ open, onOpenChange, attachments, activeIndex, onIndexChange }) {
```

to:

```javascript
export function ChatAttachmentViewer({
  open,
  onOpenChange,
  attachments,
  activeIndex,
  onIndexChange,
  // When provided, replaces the built-in signed-URL resolution wholesale — the
  // composer passes a synchronous blob-URL resolver for still-pending files.
  resolveUrl = null,
  // Default: Office actions enabled when the workspace has Collabora. The
  // composer passes `() => false` because a pending file has no attachment id
  // to open server-side yet.
  canOpenInOffice = null,
  onOpenInOffice = null,
}) {
```

- [ ] **Step 2: Use `resolveUrl` when present**

In the same file, change the `onResolveSignedUrl={resolveSignedUrl}` prop on `<AdvancedFileViewer>` (line 70) to:

```javascript
      onResolveSignedUrl={resolveUrl ?? resolveSignedUrl}
```

- [ ] **Step 3: Let the caller override the Office wiring**

In the same file, replace the current hard-coded Office props on `<AdvancedFileViewer>` (lines 71-78):

```javascript
      onOpenInOffice={(f) => {
        if (!office?.enabled) return;
        // Entity references are atlas.files records; real chat attachments use
        // the dedicated chat WOPI scope.
        if (f?.isEntityRef) office.open(f.id);
        else office.openChatAttachment(f.id);
      }}
      canOpenInOffice={() => Boolean(office?.enabled)}
```

with:

```javascript
      onOpenInOffice={
        onOpenInOffice ??
        ((f) => {
          if (!office?.enabled) return;
          // Entity references are atlas.files records; real chat attachments use
          // the dedicated chat WOPI scope.
          if (f?.isEntityRef) office.open(f.id);
          else office.openChatAttachment(f.id);
        })
      }
      canOpenInOffice={canOpenInOffice ?? (() => Boolean(office?.enabled))}
```

- [ ] **Step 4: Syntax-check**

Run: `node --check apps/desktop/src/modules/atlas.chat/components/ChatAttachmentViewer.jsx`
Expected: no output (exit 0). (`node --check` parses JSX-free files only; if it errors on JSX, skip — Step 6's build is the real check.)

- [ ] **Step 5: Confirm existing callers are unaffected**

Run: `grep -n "ChatAttachmentViewer" apps/desktop/src/modules/atlas.chat/components/ChatWindow.jsx apps/desktop/src/modules/atlas.chat/components/MiniChatWindow.jsx apps/desktop/src/modules/atlas.chat/components/ThreadPanel.jsx apps/desktop/src/modules/atlas.chat/components/ConversationMediaTab.jsx`
Expected: each renders `<ChatAttachmentViewer ...>` without `resolveUrl` / `canOpenInOffice` / `onOpenInOffice` — the new params default to `null`, so behavior is unchanged.

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/components/ChatAttachmentViewer.jsx
git commit -m "feat(chat): ChatAttachmentViewer accepts resolveUrl + Office prop overrides"
```

---

### Task 4: `MessageComposer` — blob URL for every file, clickable cards, pending viewer

**Files:**
- Modify: `apps/desktop/src/modules/atlas.chat/components/MessageComposer.jsx`

- [ ] **Step 1: Import the viewer and helpers**

In `apps/desktop/src/modules/atlas.chat/components/MessageComposer.jsx`, add after the existing `import { MessageQuote } from "./MessageQuote";` (line 26):

```javascript
import { ChatAttachmentViewer } from "./ChatAttachmentViewer";
import { mapPendingToViewerFiles, attachmentIdsToDiscard } from "../lib/pendingAttachments";
```

- [ ] **Step 2: Blob URL for every pending file**

In `addFilesToQueue` (lines 325-340), change:

```javascript
      const objectUrl = (file.type.startsWith("image/") || file.type.startsWith("video/"))
        ? URL.createObjectURL(file)
        : null;
      if (objectUrl) objectUrlsRef.current.add(objectUrl);
```

to:

```javascript
      // Every pending file gets a blob URL now, not just image/video: it lets
      // the composer's viewer render PDFs/text/Office locally and instantly,
      // and it rides the same revoke paths (removeFile / send / unmount).
      const objectUrl = URL.createObjectURL(file);
      objectUrlsRef.current.add(objectUrl);
```

- [ ] **Step 3: Add viewer state + a `sentLocalIdsRef`**

In `MessageComposer`, next to the other `useState` calls (after line 256 `const [showEntityPicker, setShowEntityPicker] = useState(false);`), add:

```javascript
  const [attView, setAttView] = useState({ open: false, index: 0 });
```

And next to the other refs (after line 293 `const prevConversationIdRef = useRef(conversationId);`), add:

```javascript
  // localIds handed to a SUCCESSFUL send — the cleanup paths must not discard
  // the server rows those became.
  const sentLocalIdsRef = useRef(new Set());
  // Latest pendingFiles, readable from unmount/switch cleanup closures.
  const pendingFilesRef = useRef([]);
```

- [ ] **Step 4: Keep `pendingFilesRef` in sync**

Add this effect right after the existing `objectUrlsRef` cleanup effect (after line 375):

```javascript
  useEffect(() => {
    pendingFilesRef.current = pendingFiles;
  }, [pendingFiles]);
```

- [ ] **Step 5: Open the viewer from a card**

Add this callback near `removeFile` (just above it, after line 462 `// ── File queue ──`):

```javascript
  function openPendingViewer(entry) {
    const viewerFiles = mapPendingToViewerFiles(pendingFiles);
    const index = viewerFiles.findIndex((f) => f.id === entry.localId);
    if (index < 0) return; // audio card — no viewer
    setAttView({ open: true, index });
  }
```

- [ ] **Step 6: Pass `onOpen` down to the cards**

Change the preview list render (line 692-694) from:

```javascript
          {pendingFiles.map((entry) => (
            <AttachmentPreviewCard key={entry.localId} entry={entry} onRemove={removeFile} />
          ))}
```

to:

```javascript
          {pendingFiles.map((entry) => (
            <AttachmentPreviewCard
              key={entry.localId}
              entry={entry}
              onRemove={removeFile}
              onOpen={openPendingViewer}
            />
          ))}
```

- [ ] **Step 7: Render the viewer**

Immediately before the final two closing `</div>` tags of the component's return (after the `{!compact && ( <p ...>Intro para enviar... </p> )}` block, ~line 1019), add:

```javascript
      <ChatAttachmentViewer
        open={attView.open}
        onOpenChange={(open) => setAttView((v) => ({ ...v, open }))}
        attachments={mapPendingToViewerFiles(pendingFiles)}
        activeIndex={attView.index}
        onIndexChange={(i) => setAttView((v) => ({ ...v, index: i }))}
        resolveUrl={(f) => f.url ?? null}
        canOpenInOffice={() => false}
        onOpenInOffice={() => {}}
      />
```

- [ ] **Step 8: Make `AttachmentPreviewCard` clickable**

In `apps/desktop/src/modules/atlas.chat/components/MessageComposer.jsx`, update `AttachmentPreviewCard` (lines 132-210):

1. Change the signature:

```javascript
function AttachmentPreviewCard({ entry, onRemove, onOpen }) {
```

2. In `RemoveBtn`, stop the click from also opening the viewer. Change `RemoveBtn` (lines 105-116) `onClick={onClick}` to:

```javascript
      onClick={(e) => { e.stopPropagation(); onClick(); }}
```

3. Wrap the **image**, **video**, and **generic file** card bodies (not audio) so the whole tile opens the viewer. For each of those three `return (<div className="relative ...">...</div>)` blocks, add to the outer div:

```javascript
        role="button"
        tabIndex={0}
        onClick={() => onOpen?.(entry)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen?.(entry); } }}
```

and append `cursor-pointer` to that div's `className` string. Leave the audio/voice-note card (the `if (isAudio)` block, lines 174-191) exactly as it is.

- [ ] **Step 9: Build the web app**

Run: `pnpm --filter @atlas/desktop build` (or `pnpm build` if the filter name differs — check `apps/desktop/package.json` `name`)
Expected: Vite build completes with no errors.

- [ ] **Step 10: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/components/MessageComposer.jsx
git commit -m "feat(chat): open pending composer attachments in the file viewer"
```

---

### Task 5: `MessageComposer` — discard removed / abandoned uploads

**Files:**
- Modify: `apps/desktop/src/modules/atlas.chat/components/MessageComposer.jsx`

- [ ] **Step 1: Pull `deleteUpload` from the hook**

Change line 295 from:

```javascript
  const { uploadFile } = useChatUpload(conversationId);
```

to:

```javascript
  const { uploadFile, deleteUpload } = useChatUpload(conversationId);
```

- [ ] **Step 2: Discard on `removeFile`**

Replace `removeFile` (lines 464-472) with:

```javascript
  function removeFile(localId) {
    const entry = pendingFiles.find((file) => file.localId === localId);
    if (entry?.objectUrl) {
      URL.revokeObjectURL(entry.objectUrl);
      objectUrlsRef.current.delete(entry.objectUrl);
    }
    // Discard the server-side upload too. If it already finished we have the
    // id; if it's still in flight, wait for the id then delete. Fire-and-forget
    // so the card disappears immediately; the worker sweep is the backstop.
    if (entry?.attachmentId) {
      deleteUpload(entry.attachmentId).catch(() => {});
    } else if (uploadingRef.current[localId]) {
      Promise.resolve(uploadingRef.current[localId])
        .then((id) => id && deleteUpload(id))
        .catch(() => {});
    }
    setPendingFiles((prev) => prev.filter((file) => file.localId !== localId));
    delete uploadingRef.current[localId];
  }
```

- [ ] **Step 3: Mark sent ids in `handleSend`**

In `handleSend`, immediately before `setBody("");` (line 562), add:

```javascript
      for (const f of pendingFiles) sentLocalIdsRef.current.add(f.localId);
```

- [ ] **Step 4: Discard abandoned uploads on unmount**

Replace the existing unmount cleanup effect (lines 370-375):

```javascript
  useEffect(() => {
    return () => {
      for (const objectUrl of objectUrlsRef.current) URL.revokeObjectURL(objectUrl);
      objectUrlsRef.current.clear();
    };
  }, []);
```

with:

```javascript
  useEffect(() => {
    return () => {
      for (const objectUrl of objectUrlsRef.current) URL.revokeObjectURL(objectUrl);
      objectUrlsRef.current.clear();
      // Uploads that finished but were never sent (composer closed with files
      // still queued) — discard their server rows + objects.
      for (const id of attachmentIdsToDiscard(pendingFilesRef.current, sentLocalIdsRef.current)) {
        deleteUpload(id).catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
```

- [ ] **Step 5: Discard abandoned uploads when switching conversations**

In the `conversationId`-change effect (lines 313-323), immediately after `const prevId = prevConversationIdRef.current;` and its `if (prevId === conversationId) return;` guard, add — before the draft-stash lines:

```javascript
    // Leaving this conversation with queued-but-unsent uploads: discard them.
    for (const id of attachmentIdsToDiscard(pendingFilesRef.current, sentLocalIdsRef.current)) {
      deleteUpload(id).catch(() => {});
    }
    sentLocalIdsRef.current = new Set();
```

- [ ] **Step 6: Build the web app**

Run: `pnpm --filter @atlas/desktop build`
Expected: Vite build completes with no errors.

- [ ] **Step 7: Run the chat lib tests**

Run: `node --test apps/desktop/src/modules/atlas.chat/lib/__tests__/*.test.js`
Expected: PASS — includes `pendingAttachments.test.js`, no regressions.

- [ ] **Step 8: Lint the touched files**

Run: `npx eslint apps/desktop/src/modules/atlas.chat/components/MessageComposer.jsx apps/desktop/src/modules/atlas.chat/components/ChatAttachmentViewer.jsx apps/desktop/src/modules/atlas.chat/hooks/useChatUpload.js apps/desktop/src/modules/atlas.chat/lib/pendingAttachments.js`
Expected: no errors (npm config warnings are fine).

- [ ] **Step 9: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/components/MessageComposer.jsx
git commit -m "feat(chat): composer discards removed / abandoned pending uploads"
```

---

## Self-Review

**Spec coverage:**
- A1 (blob URL for every pending file) → Task 4 Step 2. ✓
- A2 (clickable preview cards, audio excluded, RemoveBtn stopPropagation) → Task 4 Steps 6, 8. ✓
- A3 (viewer state, non-audio mapping, index among non-audio) → Task 4 Steps 3, 5, 7 + Task 1 `mapPendingToViewerFiles`. ✓
- A4 (`ChatAttachmentViewer` optional `resolveUrl` + Office pass-through, existing callers unaffected) → Task 3. ✓
- A5 (viewer shows local copy mid-upload / on failure — inherent: `resolveUrl` returns the blob unconditionally) → Task 4 Step 7. ✓
- B2 `deleteUpload` on the hook → Task 2. ✓
- B2 `removeFile` discards (finished + in-flight) → Task 5 Step 2. ✓
- B2 unmount + conversation-switch cleanup with `pendingFilesRef` + `sentLocalIdsRef` → Task 5 Steps 4, 5 + Task 4 Steps 3, 4. ✓
- B2 `handleSend` populates `sentLocalIdsRef` before clearing → Task 5 Step 3. ✓
- Testing (pure lib: mapping keeps order/drops audio; discard set respects sent + missing id) → Task 1 Step 1. Component paths validated via lib + Vite build (repo has no component test runner — noted in Architecture). ✓

**Placeholder scan:** none — every code step shows the full replacement; every run step has an exact command + expected result.

**Type consistency:**
- Queue entry shape `{ localId, file: {name,type,size}, objectUrl, uploading, done, error, attachmentId }` — from `addFilesToQueue` (unchanged except `objectUrl` now always set), read identically by `mapPendingToViewerFiles`, `attachmentIdsToDiscard`, `removeFile`, `openPendingViewer`.
- Viewer file shape `{ id, mimeType, fileName, originalName, sizeBytes, url, thumbnailUrl }` — produced by `mapPendingToViewerFiles`, consumed by `ChatAttachmentViewer` (maps `originalName`/`sizeBytes`/`thumbnailUrl` for `AdvancedFileViewer`) and by `resolveUrl={(f) => f.url}`.
- `attView` = `{ open: boolean, index: number }` — set in Steps 3/5/7 consistently.
- `ChatAttachmentViewer` new props `resolveUrl` / `canOpenInOffice` / `onOpenInOffice` all default `null` and are the exact names passed by Task 4 Step 7.
- `useChatUpload()` return `{ uploadFile, deleteUpload }` — Task 2 defines, Task 5 Step 1 consumes.
