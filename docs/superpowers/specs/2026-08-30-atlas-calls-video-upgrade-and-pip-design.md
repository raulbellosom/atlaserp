# atlas.calls — mid-call video upgrade, full-scale screen share, draggable/hideable PIP

**Date:** 2026-08-30
**Status:** Approved (user-requested, 2026-08-30). Frontend-only.
**Module:** `atlas.calls` UI — `apps/desktop/src/modules/atlas.chat/calls/`.
**Supersedes:** backlog item **F1** (mid-call audio→video upgrade).

---

## 1. Problem

Three gaps in the in-call UI (`CallRoom.jsx` + `CallRoomLayout.jsx`):

1. **No mid-call video.** The camera and screen-share buttons are hard-gated
   behind `session.call.kind === "VIDEO"` (`CallRoomLayout.jsx:206`), and
   `kind` is frozen at call creation with no endpoint to change it. A call
   started as voice can never turn on video, even though LiveKit supports it
   fine (remote tiles already render whatever tracks arrive, ungated).
2. **Screen share is not shown at full scale.** When a participant shares
   their screen in a 2-person call, the share is squeezed into a 50/50 grid
   cell (or a small tile) instead of filling the viewport. The user wants the
   shared screen to occupy 100% of the available space.
3. **The other participant's camera can't be moved or hidden.** During a
   screen share the remote camera feed should become a small floating tile
   the user can drag anywhere and collapse/restore — the WhatsApp pattern.
   The existing focus-layout self-view PIP is fixed bottom-right and can't be
   hidden either.

## 2. Design

### 2.1 Mid-call video upgrade (frontend-only)

- Drop the `session.call.kind === "VIDEO"` wrapper around the camera /
  switch-camera / torch / screen-share / layout buttons in
  `CallRoomLayout.jsx` — render them always. The camera sub-buttons keep
  their existing `cameraEnabled &&` guards, so switch-camera/torch still only
  appear once the camera is actually on.
- `CallRoom.jsx` gains a derived **`isVideoActive`** flag:
  `session.call.kind === "VIDEO" || cameraEnabled || screenEnabled ||
  anyRemoteHasVideoTrack`. It replaces `session.call.kind === "VIDEO"` in:
  - `isDirectVideo` → `isVideoActive && participants.length === 2`
    (so the focus/PIP layout engages once video starts on an audio call),
  - the header badge text (`isVideoActive ? "Videollamada" : "Llamada de
    voz"`).
- The `connect()` effect still only auto-enables the camera when the call
  was *created* as `VIDEO` — starting a voice call must not surprise-enable
  the camera.
- **Deferred (not in this change):** persisting the upgrade to
  `Call.kind` in the DB + adjusting the incoming-call notification wording.
  Purely cosmetic for call history; needs a `call-service.js` mutation +
  route + broadcast. Re-logged as backlog **F1-a**.

### 2.2 Full-scale screen share

- `CallRoom.jsx` derives **`screenShareParticipant`** — the first participant
  (local or remote) whose `Track.Source.ScreenShare` publication has a live,
  unmuted track.
- When `screenShareParticipant` is set, `CallRoomLayout.jsx` renders a new
  **screen-share layout** branch (ahead of `useFocusLayout` / grid):
  - The screen-share track fills the entire `<main>` area.
  - `TrackRenderer` gains a **`fit`** prop: `"cover"` (default, cameras) vs
    `"contain"` (screen share). `contain` in a full-viewport container shows
    100% of the shared screen scaled as large as it fits, with a black
    ground — no lost content, no distortion. This is the "100% de la
    pantalla" intent (maximise the share), while still never cropping the
    other side's desktop.
  - Every participant with a live camera track (local + remote) renders as a
    `DraggablePip` over the share.

### 2.3 `DraggablePip` (new component, `calls/DraggablePip.jsx`)

A floating, draggable, collapsible wrapper. Not added to `@atlas/ui` yet — it
is call-overlay-specific (clamps to the call `<main>`, sits above a
`z-[10020]` fixed overlay); extract later if a second caller appears.

- Absolutely positioned inside its offset parent; default anchor bottom-right
  with a safe-area-aware inset.
- **Drag:** Pointer Events (`onPointerDown` + `setPointerCapture`,
  `onPointerMove`, `onPointerUp`) so mouse and touch both work. Position held
  in component state as `{ x, y }` px from the parent's top-left, clamped to
  the parent rect on every move and on window resize. A drag that moves < 4px
  is treated as a tap (so the collapse toggle still works).
- **Collapse / restore:** a small button (top-right of the tile, a
  `Minus` / chevron icon) collapses the tile to a compact pill (camera icon +
  the participant initial) that stays draggable; tapping the pill restores
  the full tile. Collapsed/expanded state is per-PIP local state.
- Renders `children` (the `ParticipantTile`) when expanded.
- Multiple PIPs stack from the anchor with a small offset so they don't spawn
  exactly on top of each other.

### 2.4 Focus layout (2-person video, no screen share) — unchanged behaviour, better ergonomics

The existing fixed bottom-right self-view box becomes a `DraggablePip`
(draggable + collapsible). Same component, so the code path is shared with
2.2.

## 3. Non-goals

- No backend changes, no migration, no new route, no new permission.
- No change to call setup / ring / accept / LiveKit token flow.
- `Call.kind` in the DB stays as created (see 2.1 deferred / F1-a).
- No persistence of PIP position/collapse across calls.

## 4. Files

| File | Change |
|---|---|
| `calls/DraggablePip.jsx` | **new** — the floating tile wrapper |
| `calls/CallRoom.jsx` | `isVideoActive`, `screenShareParticipant`, `anyRemoteHasVideo`; pass through `view` |
| `calls/CallRoomLayout.jsx` | drop `kind==="VIDEO"` gate; `TrackRenderer` `fit` prop; screen-share layout branch; `DraggablePip` for PIPs; badge text from `isVideoActive` |

## 5. Verification

- `pnpm --filter @atlas/desktop build:web` — must stay clean (this is the
  compile check; the repo has no React component test harness — call tests
  are backend-only).
- `pnpm --filter @atlas/desktop lint` if it runs.
- Manual smoke (documented, not automated): voice call → camera button now
  present → enable camera → layout switches to focus/PIP; screen share →
  fills viewport, other camera is a draggable + collapsible bubble.
