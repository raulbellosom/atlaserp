# Grabación de llamadas — Plan B (UI) — Implementation Plan

Date: 2026-09-13
Spec: docs/superpowers/specs/2026-09-13-atlas-calls-recording-design.md
Status: Draft
Depends on: docs/superpowers/plans/2026-09-13-atlas-calls-recording-a-api.md (Plan A must be merged first — this plan calls `atlas.calls.startRecording/stopRecording/listRecordings`, which don't exist until Plan A Task 7 lands)

> **For agentic workers:** Declare `Mode: IMPLEMENTATION` before starting. Do not begin coding until the spec is approved and this plan is approved. Use checkbox syntax (`- [ ]`) to track progress. Mark each task completed only after its validation commands pass.
>
> REQUIRED SUB-SKILL: use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to execute this plan task-by-task.

## Goal

Add the record button + persistent consent banner to `CallRoom`/`GuestCallRoom`, a "Grabaciones" view in the conversation (list + HLS playback), and a system-message card when a recording becomes playable — spec §8/§9.

## Architecture summary

Reuses established patterns instead of inventing new ones: the record button/banner live in the same prop-driven `actions`/flags shape `CallRoomLayout.jsx` already uses for mic/camera/screen-share; the "Grabaciones" view is a sibling of the existing `filesView` swap in `ChatWindow.jsx`; the finished-recording card mirrors `CallLogCard.jsx`/`getCallMeta` exactly, just keyed off `metadata.recording` instead of `metadata.call`; opening "Grabaciones" from a chat message's "Ver grabación" button goes through a tiny shared signal on `CallsProvider` (the same context `CallLogCard` already reads from for its "Volver a llamar" button) instead of prop-drilling a callback through the whole message list.

**Coordination note:** `ChatMessageBubble.jsx` currently has uncommitted changes from a different, concurrent session in this repo (unrelated work — read receipts/search, per `git status` at plan-writing time). Task 6 below touches that same file. Before starting Task 6, re-run `git status`/`git diff` on it and rebase this plan's small addition onto whatever is there — do not blindly overwrite.

## Tech Stack

- `hls.js` (new dependency — not currently installed; needed because only Safari plays HLS natively, every other browser needs it for the `<video>` element).
- Existing `@atlas/ui` components (`EmptyState`, `Skeleton`, `Button`, `DropdownMenuItem`).

---

## File Structure Map

### Create

- `apps/desktop/src/modules/atlas.chat/calls/RecordingBanner.jsx`
- `apps/desktop/src/modules/atlas.chat/calls/hooks/useCallRecording.js`
- `apps/desktop/src/modules/atlas.chat/hooks/useConversationRecordings.js`
- `apps/desktop/src/modules/atlas.chat/components/ChatRecordingsGallery.jsx`
- `apps/desktop/src/modules/atlas.chat/components/RecordingReadyCard.jsx`

### Modify

- `apps/desktop/package.json` — add `hls.js`.
- `apps/desktop/src/modules/atlas.chat/calls/CallsProvider.jsx` — add the open-recordings-view signal.
- `apps/desktop/src/modules/atlas.chat/calls/CallRoom.jsx` — wire `useCallRecording`, `canRecord`, pass into `actions`/`CallRoomLayout`.
- `apps/desktop/src/modules/atlas.chat/calls/CallRoomLayout.jsx` — record button in the footer + `RecordingBanner` overlay.
- `apps/desktop/src/modules/atlas.chat/calls/guest/useGuestCall.js` — surface `state.recording`.
- `apps/desktop/src/modules/atlas.chat/calls/guest/GuestCallRoom.jsx` — accept `recordingActive`, render `RecordingBanner`.
- `apps/desktop/src/modules/atlas.chat/calls/guest/GuestCallScreen.jsx` — pass `recordingActive` down.
- `apps/desktop/src/modules/atlas.chat/components/ChatHeader.jsx` — "Grabaciones" menu item.
- `apps/desktop/src/modules/atlas.chat/components/ChatWindow.jsx` — `recordingsView` state + render `ChatRecordingsGallery`.
- `apps/desktop/src/modules/atlas.chat/components/callLogMeta.js` — add `getRecordingMeta`.
- `apps/desktop/src/modules/atlas.chat/components/ChatMessageBubble.jsx` — render `RecordingReadyCard`.

---

## Task 1 — `RecordingBanner` (shared) + `hls.js` dependency

**Files:**
- Create: `apps/desktop/src/modules/atlas.chat/calls/RecordingBanner.jsx`
- Modify: `apps/desktop/package.json`

**Changes:**

- [ ] Step 1: Install the dependency:

```bash
pnpm add hls.js --filter @atlas/desktop
```

- [ ] Step 2: Create the banner, used by both `CallRoomLayout.jsx` (members) and `GuestCallRoom.jsx` (guests) — spec §8 says it must be persistent and not dismissible while active:

```jsx
import { Circle } from "lucide-react";

// Persistent, non-dismissible consent notice — shown to every participant
// (member or guest) while a call recording is ACTIVE. Spec §8/§24 risk 6.
export function RecordingBanner({ active }) {
  if (!active) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-center p-2">
      <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-red-600/90 px-3.5 py-1.5 text-xs font-medium text-white shadow-lg backdrop-blur-sm">
        <Circle className="h-2.5 w-2.5 animate-pulse fill-current" />
        Esta llamada se está grabando
      </div>
    </div>
  );
}
```

**Validation:**

```bash
cd apps/desktop && npx eslint src/modules/atlas.chat/calls/RecordingBanner.jsx
git diff --stat package.json apps/desktop/package.json pnpm-lock.yaml
```

Expected: eslint exits 0; `hls.js` appears as a new line in `apps/desktop/package.json`'s dependencies and `pnpm-lock.yaml` updated (do not hand-edit the lockfile — `pnpm add` already did it).

---

## Task 2 — `useCallRecording` hook + wire into `CallRoom`/`CallRoomLayout`

**Files:**
- Create: `apps/desktop/src/modules/atlas.chat/calls/hooks/useCallRecording.js`
- Modify: `apps/desktop/src/modules/atlas.chat/calls/CallRoom.jsx`
- Modify: `apps/desktop/src/modules/atlas.chat/calls/CallRoomLayout.jsx`

**Changes:**

- [ ] Step 1: Create the hook — polls the same `listRecordings` endpoint the "Grabaciones" gallery uses (Task 5), so there is exactly one source of truth for "is this call being recorded right now," not a second bespoke status endpoint:

```js
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "../../../../auth/AuthProvider";
import { atlas } from "../../../../lib/atlas";

function unwrap(r) { return r?.data ?? r; }
const ACTIVE = new Set(["STARTING", "ACTIVE"]);

// Polls for the currently-active recording of this call's conversation (if
// any) every 5s while the call is open, and exposes start/stop actions.
export function useCallRecording({ callId, conversationId }) {
  const { session } = useAuth();
  const token = session?.access_token;
  const [activeRecording, setActiveRecording] = useState(null);
  const [busy, setBusy] = useState(false);
  const timer = useRef(null);

  const refresh = useCallback(async () => {
    if (!conversationId || !token) return;
    try {
      const res = unwrap(await atlas.calls.listRecordings(conversationId, token));
      setActiveRecording((res ?? []).find((r) => ACTIVE.has(r.status)) ?? null);
    } catch { /* transient — next poll retries */ }
  }, [conversationId, token]);

  useEffect(() => {
    if (!conversationId || !token) return undefined;
    refresh();
    timer.current = setInterval(refresh, 5000);
    return () => clearInterval(timer.current);
  }, [conversationId, token, refresh]);

  const start = useCallback(async () => {
    setBusy(true);
    try {
      await atlas.calls.startRecording(callId, token);
      await refresh();
    } catch (e) {
      toast.error(e?.message || "No se pudo iniciar la grabación.");
    } finally {
      setBusy(false);
    }
  }, [callId, token, refresh]);

  const stop = useCallback(async () => {
    setBusy(true);
    try {
      await atlas.calls.stopRecording(callId, token);
      await refresh();
    } catch (e) {
      toast.error(e?.message || "No se pudo detener la grabación.");
    } finally {
      setBusy(false);
    }
  }, [callId, token, refresh]);

  return { active: Boolean(activeRecording), busy, start, stop };
}
```

- [ ] Step 2: In `CallRoom.jsx`, import the hook, the auth profile, and gate on the permission (same inline pattern already used elsewhere in this codebase — see `apps/desktop/src/modules/atlas.contacts/screens/ContactsScreen.jsx:99-100`):

```js
import { useCallRecording } from './hooks/useCallRecording';
```

```js
  const { userProfile } = useAuth(); // add `useAuth` to the existing import if not already destructured here — check the top of the file first, `session` is already pulled from it
  const canRecord = Boolean(userProfile?.isAdmin || userProfile?.permissions?.includes("chat.calls.record"));
  const recording = useCallRecording({ callId: session.call.id, conversationId: session.call.conversationId });
```

Place this next to the other `useState`/hook calls near line 42-50. `session.call.conversationId` must exist on the call object `CallRoom` already receives — confirm by reading how `session.call.id` is used a few lines above; if `conversationId` isn't already on that object, it needs to come from wherever `CallRoom`'s `session` prop is constructed (check `CallsProvider.jsx`'s `activeSession` shape) rather than guessed here.

- [ ] Step 3: Add `toggleRecording` to the `actions` object passed to `CallRoomLayout` (same object already carrying `toggleMicrophone`, `toggleHand`, etc. — found via the `actions={{ ... }}` prop around line 578):

```js
    toggleRecording: recording.active ? recording.stop : recording.start,
```

and pass two more props alongside `actions`: `canRecord={canRecord}` and `recordingActive={recording.active}` and `recordingBusy={recording.busy}`.

- [ ] Step 4: In `CallRoomLayout.jsx`, import the banner and icon:

```js
import { RecordingBanner } from './RecordingBanner';
import { Circle, StopCircle } from 'lucide-react'; // add to the existing lucide-react import line, don't duplicate the import statement
```

Add the banner right after the opening of `<main ...>` (before `{invitePanel && ...}` around line 444):

```jsx
        <RecordingBanner active={recordingActive} />
```

Add the button in the `<footer>`, right before the `Colgar` button (before line 498), only when `canRecord`:

```jsx
        {canRecord && (
          <Button
            type="button"
            variant={recordingActive ? "destructive" : "secondary"}
            size="icon"
            disabled={!engineReady || recordingBusy}
            className="h-11 w-11 rounded-full disabled:opacity-40"
            onClick={actions.toggleRecording}
            title={recordingActive ? "Detener grabación" : "Grabar llamada"}
          >
            {recordingActive ? <StopCircle className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
          </Button>
        )}
```

Thread `canRecord`, `recordingActive`, `recordingBusy` through `CallRoomLayout`'s prop destructuring at its function signature (same list where `micEnabled`, `cameraEnabled`, etc. already are).

**Validation:**

```bash
cd apps/desktop && npx eslint src/modules/atlas.chat/calls/hooks/useCallRecording.js src/modules/atlas.chat/calls/CallRoom.jsx src/modules/atlas.chat/calls/CallRoomLayout.jsx
```

Expected: exits 0. Manual (needs Plan A's API deployed): join a call with a `chat.calls.record` role, confirm the button appears and toggles; join with a role lacking it, confirm the button is absent; confirm the banner appears for every participant while `active`.

---

## Task 3 — Guest banner

**Files:**
- Modify: `apps/desktop/src/modules/atlas.chat/calls/guest/useGuestCall.js`
- Modify: `apps/desktop/src/modules/atlas.chat/calls/guest/GuestCallRoom.jsx`
- Modify: `apps/desktop/src/modules/atlas.chat/calls/guest/GuestCallScreen.jsx`

**Changes:**

- [ ] Step 1: In `useGuestCall.js`'s poll `tick()` function (the one that calls `atlas.calls.guest.state`), add `recording` to the state update:

```js
        setState((s) => ({ ...s, status: res.status, callEnded: !!res.callEnded, recording: res.recording ?? { active: false } }));
```

Also initialize it in the `useState` default at the top of the hook: `{ joined: false, status: null, callEnded: false, error: null, recording: { active: false } }`.

- [ ] Step 2: In `GuestCallRoom.jsx`, add `recordingActive = false` to the function signature (line 64) and render the banner inside `<main>` (line 150), same as Task 2 Step 4:

```jsx
import { RecordingBanner } from '../RecordingBanner';
```

```jsx
      <main className="relative min-h-0 flex-1 p-2 sm:p-4">
        <RecordingBanner active={recordingActive} />
```

- [ ] Step 3: In `GuestCallScreen.jsx`, pass it through where `GuestCallRoom` is rendered (around line 100):

```jsx
      <GuestCallRoom
        fetchLivekitToken={gc.fetchLivekitToken}
        messages={gc.messages}
        onSendMessage={gc.sendMessage}
        onLeave={gc.leave}
        myName={formRef.current.name || name}
        recordingActive={gc.state.recording?.active}
      />
```

**Validation:**

```bash
cd apps/desktop && npx eslint src/modules/atlas.chat/calls/guest/useGuestCall.js src/modules/atlas.chat/calls/guest/GuestCallRoom.jsx src/modules/atlas.chat/calls/guest/GuestCallScreen.jsx
```

Expected: exits 0. Manual: open the public guest join link while a host has a recording active, confirm the banner shows without needing an Atlas account.

---

## Task 4 — "Grabaciones" view toggle

**Files:**
- Modify: `apps/desktop/src/modules/atlas.chat/calls/CallsProvider.jsx`
- Modify: `apps/desktop/src/modules/atlas.chat/components/ChatHeader.jsx`
- Modify: `apps/desktop/src/modules/atlas.chat/components/ChatWindow.jsx`

**Changes:**

- [ ] Step 1: In `CallsProvider.jsx`, add a tiny signal next to the existing `pendingGuestCount`/`guestPanelNonce` state (same file this session already edited for the guest-count-desync fix — re-read its current `useState`/`value` block before editing, since line numbers shifted):

```js
  const [openRecordingsFor, setOpenRecordingsFor] = useState(null); // conversationId or null
  const requestOpenRecordings = useCallback((conversationId) => setOpenRecordingsFor(conversationId), []);
  const clearOpenRecordingsRequest = useCallback(() => setOpenRecordingsFor(null), []);
```

Add `openRecordingsFor, requestOpenRecordings, clearOpenRecordingsRequest` to the memoized `value` object returned by the provider (the same `useMemo(() => ({ ... }), [...])` block that already exposes `pendingGuestCount`/`minimizeCall` — add these three to both the object and its dependency array).

- [ ] Step 2: In `ChatHeader.jsx`, add `onToggleRecordingsView` to the destructured props (next to `filesView, onToggleFilesView` at line 35) and add a menu item in the main overflow `DropdownMenuContent` (after the `onToggleFilesView` item around line 398-402) — not `sm:hidden`, since this feature has no standalone header icon (avoids the icon-row overflow this header has hit before):

```jsx
            <DropdownMenuItem onSelect={onToggleRecordingsView}>
              <Video className="mr-2 h-4 w-4" />
              Grabaciones
            </DropdownMenuItem>
```

`Video` is already imported in this file's lucide-react import (line 11) for the video-call button — reuse it rather than adding a new icon import.

- [ ] Step 3: In `ChatWindow.jsx`, add `recordingsView` state mirroring `filesView` exactly (next to `const [filesView, setFilesView] = useState(initialFilesView);` at line 109):

```js
  const [recordingsView, setRecordingsView] = useState(false);
```

Pass `onToggleRecordingsView={() => { setRecordingsView((v) => !v); setFilesView(false); setMembersView(false); }}` into `<ChatHeader ... />` (next to the existing `onToggleFilesView` prop at line 537), and reset it alongside `filesView` wherever that already resets (lines 166, 245, 273, 281 — mirror each `setFilesView(false)` site with a `setRecordingsView(false)`).

Render the gallery as a sibling swap to the files view (right after the `{filesView ? (...) : (` block around line 578 — insert `recordingsView ?` as another branch in that same ternary/if chain):

```jsx
          {recordingsView ? (
            <div className="flex-1 min-h-0 flex flex-col">
              <ChatRecordingsGallery conversationId={conversationId} />
            </div>
          ) : filesView ? (
            /* ...existing filesView branch unchanged... */
```

(`ChatRecordingsGallery` is created in Task 5 — import it at the top of this file next to `import { ChatFilesGallery } from "./ChatFilesGallery";`.)

- [ ] Step 4: Add the effect that opens "Grabaciones" when a message's "Ver grabación" button fires the `CallsProvider` signal (Task 6 sets `openRecordingsFor` via `requestOpenRecordings`):

```js
  const { openRecordingsFor, clearOpenRecordingsRequest } = useCalls(); // add to the existing useCalls() destructure in this file if one already exists, else import { useCalls } from "../calls/CallsProvider" and add a call
  useEffect(() => {
    if (openRecordingsFor && openRecordingsFor === conversationId) {
      setRecordingsView(true);
      clearOpenRecordingsRequest();
    }
  }, [openRecordingsFor, conversationId, clearOpenRecordingsRequest]);
```

**Validation:**

```bash
cd apps/desktop && npx eslint src/modules/atlas.chat/calls/CallsProvider.jsx src/modules/atlas.chat/components/ChatHeader.jsx src/modules/atlas.chat/components/ChatWindow.jsx
```

Expected: exits 0. Manual: open a conversation, use the "..." menu → "Grabaciones", confirm it swaps the same way "Ver archivos" does and that toggling one closes the other.

---

## Task 5 — `useConversationRecordings` + `ChatRecordingsGallery`

**Files:**
- Create: `apps/desktop/src/modules/atlas.chat/hooks/useConversationRecordings.js`
- Create: `apps/desktop/src/modules/atlas.chat/components/ChatRecordingsGallery.jsx`

**Changes:**

- [ ] Step 1: Hook, mirroring `useConversationFiles.js`:

```js
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../../auth/AuthProvider";
import { atlas } from "../../../lib/atlas";

function unwrap(r) { return r?.data ?? r; }

export function useConversationRecordings(conversationId, enabled = true) {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["chat-recordings", conversationId],
    enabled: Boolean(enabled && conversationId && session?.access_token),
    staleTime: 15_000,
    refetchInterval: (query) => {
      const rows = unwrap(query.state.data) ?? [];
      // Keep polling while anything is still processing so the entry flips
      // from spinner -> playable without the user having to reopen the tab.
      return rows.some((r) => ["STARTING", "ACTIVE", "PROCESSING"].includes(r.status)) ? 8000 : false;
    },
    queryFn: () => atlas.chat.calls?.listRecordings
      ? atlas.chat.calls.listRecordings(conversationId, session.access_token)
      : atlas.calls.listRecordings(conversationId, session.access_token),
  });
}
```

(The `atlas.chat.calls?.listRecordings` fallback line above is defensive scaffolding only if this repo's `atlas` client namespaces calls under `atlas.chat` somewhere — before writing this for real, run `grep -n "calls:" apps/desktop/src/lib/atlas.js` to see the actual top-level shape and delete whichever branch doesn't apply; every other reference in this codebase uses plain `atlas.calls.xxx`, so the simple form is almost certainly correct and this hedge should collapse to one line.)

- [ ] Step 2: Gallery component, mirroring `ChatFilesGallery.jsx`'s empty/loading conventions:

```jsx
import { useState } from "react";
import { EmptyState, Skeleton } from "@atlas/ui";
import { Loader2, AlertCircle, Play } from "lucide-react";
import { useConversationRecordings } from "../hooks/useConversationRecordings";
import { formatMessageTime } from "../lib/chatUtils";

function useHls(videoRef, src) {
  const [ready, setReady] = useState(false);
  useState(() => {
    if (!src || !videoRef.current) return undefined;
    const video = videoRef.current;
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
      setReady(true);
      return undefined;
    }
    let hls;
    import("hls.js").then(({ default: Hls }) => {
      if (!Hls.isSupported()) return;
      hls = new Hls();
      hls.loadSource(src);
      hls.attachMedia(video);
      setReady(true);
    });
    return () => hls?.destroy();
  });
  return ready;
}

function RecordingRow({ recording }) {
  const [expanded, setExpanded] = useState(false);
  const videoRef = useState(() => ({ current: null }))[0];
  useHls(videoRef, expanded ? recording.playlistUrl : null);

  const isReady = recording.status === "READY";
  const isFailed = recording.status === "FAILED";

  return (
    <div className="rounded-xl border border-[hsl(var(--border))] p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{formatMessageTime(recording.startedAt)}</p>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            {isReady && recording.durationMs != null
              ? `${Math.round(recording.durationMs / 1000)}s`
              : isFailed ? "No se pudo procesar" : "Procesando..."}
          </p>
        </div>
        {isReady && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))]"
            aria-label="Reproducir"
          >
            <Play className="h-4 w-4" />
          </button>
        )}
        {isFailed && <AlertCircle className="h-5 w-5 shrink-0 text-red-500" title="No se pudo procesar" />}
        {!isReady && !isFailed && <Loader2 className="h-5 w-5 shrink-0 animate-spin text-[hsl(var(--muted-foreground))]" />}
      </div>
      {expanded && isReady && (
        // react-doctor-disable-next-line media-has-caption -- internal call recording, no captions track produced by Egress.
        <video ref={(el) => { videoRef.current = el; }} controls className="mt-2 w-full rounded-lg bg-black" />
      )}
    </div>
  );
}

export function ChatRecordingsGallery({ conversationId }) {
  const { data, isLoading, isError, refetch } = useConversationRecordings(conversationId);
  const recordings = data?.data ?? data ?? [];

  if (isLoading) {
    return (
      <div className="space-y-2 p-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }
  if (isError) {
    return <EmptyState title="No se pudieron cargar las grabaciones" description="Intenta de nuevo." action={{ label: "Reintentar", onClick: refetch }} />;
  }
  if (!recordings.length) {
    return <EmptyState title="Aún no hay grabaciones" description="Las grabaciones de las llamadas de esta conversación aparecerán aquí." />;
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto space-y-2 p-3">
      {recordings.map((r) => <RecordingRow key={r.id} recording={r} />)}
    </div>
  );
}
```

Before wiring this up, confirm `EmptyState`'s real prop shape for an action button (`action={{ label, onClick }}` above is a guess based on common patterns in this codebase) by reading `packages/ui/src/components/EmptyState.jsx` — correct the prop name if it differs (e.g. some Atlas `EmptyState` usages in this repo pass `onRetry` directly instead of a generic `action` object, per `apps/desktop/src/modules/atlas.chat/components/ChatWindow.jsx:580`'s `<ErrorState title="..." onRetry={filesHistory.refetch} />` — check whether `EmptyState` follows that same `onRetry` convention or the more generic `action` shape before finalizing this step).

**Validation:**

```bash
cd apps/desktop && npx eslint src/modules/atlas.chat/hooks/useConversationRecordings.js src/modules/atlas.chat/components/ChatRecordingsGallery.jsx
```

Expected: exits 0. Manual (needs Plan A deployed + at least one completed recording): open "Grabaciones", confirm the list renders, confirm the inline player starts and plays.

---

## Task 6 — "Grabación lista" system-message card

**Files:**
- Modify: `apps/desktop/src/modules/atlas.chat/components/callLogMeta.js`
- Create: `apps/desktop/src/modules/atlas.chat/components/RecordingReadyCard.jsx`
- Modify: `apps/desktop/src/modules/atlas.chat/components/ChatMessageBubble.jsx`

**Before starting:** re-check `git status apps/desktop/src/modules/atlas.chat/components/ChatMessageBubble.jsx` — this file had uncommitted changes from a different session at plan-writing time. Read its current state fresh and apply Step 3 below as a small, additive insertion near the existing `getCallMeta`/`CallLogCard` branch, not a wholesale rewrite.

**Changes:**

- [ ] Step 1: In `callLogMeta.js`, add a sibling pure helper (same file, same style as `getCallMeta`):

```js
// Sibling of getCallMeta — a "grabación lista" system-message card. See
// call-recording-service.js's onRecordingReady (Plan A Task 5) for the
// producer side.
export function getRecordingMeta(message) {
  if (!message) return null;
  const isSystem = message.sender_type === "system" || message.message_type === "system";
  if (!isSystem) return null;

  let meta = message.metadata;
  if (typeof meta === "string") {
    try { meta = JSON.parse(meta); } catch { return null; }
  }

  const recording = meta && typeof meta === "object" ? meta.recording : null;
  if (!recording?.recordingId) return null;
  return recording;
}
```

This matches Plan A Task 5's `buildRecordingReadyMessage` exactly: `metadata: { recording: { recordingId, durationMs } }` with a body like `"Grabación lista · 12:34"`. If Plan A's implementation ends up shipping a different shape, treat that shipped code as the source of truth and update this helper to match, not the other way around.

- [ ] Step 2: Create the card, mirroring `CallLogCard.jsx` exactly, using the `CallsProvider` signal from Task 4 instead of prop-drilling:

```jsx
import { Video } from "lucide-react";
import { Button } from "@atlas/ui";
import { useCalls } from "../calls/CallsProvider";
import { getRecordingMeta } from "./callLogMeta";

export function RecordingReadyCard({ message }) {
  const meta = getRecordingMeta(message);
  const { requestOpenRecordings } = useCalls();
  if (!meta) return null;

  const conversationId = message.conversation_id ?? null;

  return (
    <div className="flex justify-center my-2 px-4">
      <div className="flex items-center gap-2.5 rounded-2xl bg-[hsl(var(--muted))] px-3.5 py-2 text-xs">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--primary)/0.12)] text-[hsl(var(--primary))]">
          <Video className="h-3.5 w-3.5" />
        </span>
        <span className="font-medium text-[hsl(var(--foreground))]">{message.body}</span>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-6 px-2 text-[11px]"
          onClick={() => conversationId && requestOpenRecordings(conversationId)}
        >
          Ver grabación
        </Button>
      </div>
    </div>
  );
}
```

- [ ] Step 3: In `ChatMessageBubble.jsx`, import it next to `CallLogCard` (line 20) and add a branch right after the `getCallMeta` check (after line 521):

```jsx
import { RecordingReadyCard } from "./RecordingReadyCard";
```

```jsx
  if (getRecordingMeta(message)) {
    return <RecordingReadyCard message={message} />;
  }
```

`getRecordingMeta` also needs importing into this file (it currently only imports `getCallMeta` indirectly via `CallLogCard`) — add `import { getRecordingMeta } from "./callLogMeta";` next to whatever other local imports already exist near the top.

**Validation:**

```bash
cd apps/desktop && npx eslint src/modules/atlas.chat/components/callLogMeta.js src/modules/atlas.chat/components/RecordingReadyCard.jsx src/modules/atlas.chat/components/ChatMessageBubble.jsx
node --test apps/desktop/src/modules/atlas.chat/components/__tests__/ 2>/dev/null || echo "(check whether callLogMeta already has a test file at components/__tests__/callLogMeta.test.js and extend it with a getRecordingMeta case if so)"
```

Expected: eslint exits 0 on all three files. Manual (needs Plan A deployed): after a recording finishes, confirm the card appears in the chat with a working "Ver grabación" button that opens the Grabaciones tab.

---

## Rollback Notes

- Every task here is additive UI — no data model changes. Reverting any task is a plain `git revert`/file restore with no migration or backend impact.
- If Task 1's `hls.js` install causes any bundling issue, remove it and the two files that import it (`useConversationRecordings.js`'s dynamic import is already lazy — the dependency only loads when a recording is actually expanded for playback, so an uninstall just breaks that one interaction, not the rest of the app).
- If the record button/banner cause any in-call regression, they can be feature-flagged off instantly by reverting `chat.calls.record`'s assignment to any role (Plan A's rollback note) — `canRecord` becomes `false` for everyone and the button disappears without a frontend deploy.

---

## Verification Gate

Before marking any task complete in `docs/TASKS.md`:

- [ ] All task validation commands above have been run and their actual output recorded.
- [ ] `pnpm build` passes with no errors introduced by this plan.
- [ ] Manual pass on both viewports (390px and 1440px) per this project's standing UI QA convention — record button, banner, and Grabaciones list all checked at both widths.
- [ ] Verification checklist at `docs/superpowers/templates/verification-checklist-template.md` filled in.
- [ ] `docs/TASKS.md` updated with `Verified: YYYY-MM-DD (commands executed)`.
