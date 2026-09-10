# Call: pin-to-spotlight + raise-hand restyle — Design

Date: 2026-09-10
Status: Approved
Module: `atlas.calls`

## Problem

1. The raise-hand affordance shipped as an amber pill with the word "Mano" on
   the tile plus an amber host chip-list — too loud, reads badly.
2. There is no way to choose who fills the main area of a call. With a screen
   share the screen is main (fine), but with several cameras it's a fixed grid
   and you can't spotlight one person. No Teams-style "pin".

## Goals

- Raise-hand on a tile: a single ✋ glyph in the corner, a bit large, in a soft
  `bg-black/45 backdrop-blur` circle with a light shadow. No text. The host's
  ordered list stays but restyled to dark glass (not amber).
- Any viewer can **pin** a participant locally (per-viewer, not synced): the
  pinned tile fills the main area, everyone else goes to a strip — vertical on
  the right on `lg+`, horizontal on top with `overflow-x` on narrow. The
  screen-share, when present and not the pinned one, appears as a strip tile.
- No pin → today's behavior unchanged (screen-share = big + floating
  `DraggablePip` cameras; otherwise the grid), except each grid/strip tile now
  carries a pin button.

## Non-goals

- No synced/host "spotlight for everyone" — pin is local only, no data channel,
  no permissions.
- No pin in `GuestCallRoom` for now (only the hand restyle there). Follow-up.
- No change to `DraggablePip` during screen-share.
- No API, no SDK, no migration.

---

## `ParticipantTile` (in `CallRoomLayout.jsx`)

- Root gets `group/tile`.
- New props: `pinned = false`, `onPin = null`.
- **Raise-hand badge** — replace the amber pill with:
  ```jsx
  {handRaised && (
    <div className="absolute left-2 top-2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/45 shadow-lg backdrop-blur-sm">
      <Hand className="h-5 w-5 text-amber-300" />
    </div>
  )}
  ```
- **Pin button** (only when `onPin`):
  ```jsx
  {onPin && (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onPin(participant?.identity); }}
      title={pinned ? "Quitar de destacado" : "Destacar"}
      className={[
        "absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/45 text-white/90 shadow-lg backdrop-blur-sm transition hover:bg-black/65",
        pinned || coarse ? "opacity-100" : "opacity-0 group-hover/tile:opacity-100 focus-visible:opacity-100",
      ].join(" ")}
    >
      {pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
    </button>
  )}
  ```
  `coarse` from `useCoarsePointer()` (already an `@atlas/ui` export). `Pin`,
  `PinOff` added to the `lucide-react` import.

## `RaisedHandsBar.jsx` — dark glass

```jsx
<div className="pointer-events-auto absolute left-3 top-3 z-20 flex max-w-[70%] flex-col gap-0.5 rounded-xl bg-black/55 p-1.5 backdrop-blur">
  {hands.map((h, i) => (
    <div key={h.identity} className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-white hover:bg-white/10">
      <Hand className="h-3.5 w-3.5 shrink-0 text-amber-300" />
      <span className="min-w-0 max-w-[9rem] truncate">{i + 1}. {h.name ?? "Participante"}</span>
      <button type="button" onClick={() => onLower?.(h.identity)} title="Bajar la mano"
        className="ml-0.5 shrink-0 rounded p-0.5 text-white/55 hover:bg-white/10 hover:text-white">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  ))}
</div>
```

## `CallRoom.jsx`

- `const [pinnedIdentity, setPinnedIdentity] = useState(null);`
- `const setPinned = useCallback((id) => setPinnedIdentity((cur) => (cur && cur === id ? null : id || null)), []);`
- After `const participants = [localEntry, ...remoteEntries];` (line ~412):
  ```javascript
  useEffect(() => {
    if (pinnedIdentity && !participants.some((p) => p.participant?.identity === pinnedIdentity)) {
      setPinnedIdentity(null);
    }
  }, [pinnedIdentity, participants]);
  ```
- Into `view`: `pinnedIdentity`, `myLocalIdentity: room.localParticipant?.identity`.
- Into `actions`: `setPinned`.

## `CallRoomLayout.jsx`

- Destructure from `view`: `pinnedIdentity = null`, `myLocalIdentity = null`.
  From `actions`: use `actions.setPinned`.
- `const pinnedEntry = pinnedIdentity ? participants.find((p) => p.participant?.identity === pinnedIdentity) : null;`
- In `<main>`, the non-chat branch becomes (pinned takes priority, but never
  over the mobile chat view — that's already handled by `mobileChatOpen`):
  ```jsx
  {pinnedEntry ? (
    <SpotlightLayout
      mainEntry={pinnedEntry}
      others={participants.filter((p) => p.participant?.identity !== pinnedIdentity)}
      screenShareEntry={screenShareEntry}
      isMobile={isMobile}
      raisedHands={raisedHands}
      myHandRaised={myHandRaised}
      myLocalIdentity={myLocalIdentity}
      mirrorLocalCamera={mirrorLocalCamera}
      onPin={actions.setPinned}
    />
  ) : (!isMobile || mobileView === "screen") && screenShareEntry ? (
    ...existing screen-share branch, add onPin={actions.setPinned} to the PiP tiles...
  ) : useFocusLayout ? (
    ...existing...
  ) : (
    ...existing grid, add onPin={actions.setPinned} + pinned={false} to each tile...
  )}
  ```
- New local component `SpotlightLayout` (same file, ~35 lines):
  ```jsx
  function SpotlightLayout({ mainEntry, others, screenShareEntry, isMobile, raisedHands, myHandRaised, myLocalIdentity, mirrorLocalCamera, onPin }) {
    const mainId = mainEntry.participant?.identity;
    const mainIsSharing = Boolean(screenShareEntry && screenShareEntry.participant?.identity === mainId);
    const showScreenTile = Boolean(screenShareEntry) && !mainIsSharing;
    const tileCls = isMobile ? "relative aspect-video h-full shrink-0" : "relative aspect-video w-full shrink-0";
    return (
      <div className={`flex h-full gap-2 ${isMobile ? "flex-col" : "flex-row"}`}>
        <div className="relative min-h-0 flex-1">
          <ParticipantTile
            participant={mainEntry.participant}
            isLocal={mainEntry.isLocal}
            handRaised={mainId === myLocalIdentity ? myHandRaised : raisedHands.has(mainId)}
            preferSource={mainIsSharing ? "screen" : "auto"}
            pinned
            onPin={onPin}
            mirrorLocalCamera={mirrorLocalCamera}
            className="rounded-[1.5rem]"
            fit="contain"
          />
        </div>
        <div className={`flex shrink-0 gap-2 ${isMobile ? "order-first h-24 flex-row overflow-x-auto" : "w-44 flex-col overflow-y-auto"}`}>
          {showScreenTile && (
            <div className={tileCls}>
              <ParticipantTile participant={screenShareEntry.participant} isLocal={screenShareEntry.isLocal}
                preferSource="screen" onPin={onPin} className="rounded-xl bg-black" fit="contain" />
            </div>
          )}
          {others.map(({ participant, isLocal }) => (
            <div key={participant.sid || participant.identity} className={tileCls}>
              <ParticipantTile participant={participant} isLocal={isLocal}
                handRaised={participant?.identity === myLocalIdentity ? myHandRaised : raisedHands.has(participant?.identity)}
                preferSource="camera" onPin={onPin} mirrorLocalCamera={mirrorLocalCamera} className="rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    );
  }
  ```
- `RaisedHandsBar` stays inside `<main>` for the host (Plan A wiring unchanged).

## `GuestCallRoom.jsx`

Only the raise-hand badge on its `Tile`: swap the amber pill for the same
`h-9 w-9 rounded-full bg-black/45 backdrop-blur` circle with a `Hand` glyph.

## Interaction matrix

| State | Main area | Strip / PiPs |
|---|---|---|
| pin set | pinned participant (their screen if sharing, else camera) | everyone else + a screen-share tile if screen ≠ pinned; right on `lg+`, top scroll-x on narrow |
| no pin, screen share | screen (unchanged) | `DraggablePip` cameras (unchanged) |
| no pin, 2-person focus | `useFocusLayout` (unchanged) | local `DraggablePip` (unchanged) |
| no pin, otherwise | grid (unchanged) | — |
| pinned participant leaves | pin auto-clears → falls to the matching row above | — |
| mobile chat open | chat (unchanged, pin ignored) | — |

## Testing

No component test runner. A pure helper is extracted and unit-tested:

`apps/desktop/src/modules/atlas.chat/calls/lib/callLayout.js` —
`resolvePinnedEntry(participants, pinnedIdentity)` and
`spotlightStrip({ participants, pinnedIdentity, screenShareEntry })` returning
`{ mainEntry, others, showScreenTile }`. Tests: pin resolves to the entry; an
unknown pin → null; strip excludes the main; `showScreenTile` true only when a
screen exists and isn't the pinned one. Plus the Vite build + manual device QA
(2–4 participants: pin/unpin from a grid tile and from the big tile, pin during
a screen share, pinned person leaves, 390 + 1440).

## Files

| File | Change |
|---|---|
| `calls/lib/callLayout.js` | **new** — pure `resolvePinnedEntry` / `spotlightStrip` |
| `calls/lib/__tests__/callLayout.test.js` | **new** |
| `calls/CallRoomLayout.jsx` | `SpotlightLayout` + `ParticipantTile` pin button + hand-badge restyle + wire `pinnedEntry`/`onPin` into every branch |
| `calls/CallRoom.jsx` | `pinnedIdentity` state + `setPinned` + auto-clear effect + pass through |
| `calls/RaisedHandsBar.jsx` | dark-glass restyle |
| `calls/guest/GuestCallRoom.jsx` | hand-badge restyle on `Tile` |
