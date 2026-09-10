# In-call reactions, raise-hand, and a redesigned guest panel — Design

Date: 2026-09-09
Status: Approved
Module: `atlas.calls` (in `atlas.chat`)

## Problem

Three gaps in the live call / meeting room:

1. **No raise-hand.** In a meeting there is no way to signal "I want to speak".
2. **No live reactions.** No lightweight way to react (❤️ 👍 …) that everyone
   sees at once.
3. **The guest-approval UI is cramped and fragile.** `CallGuestRoster` is
   squeezed into a `max-h-48` scroll strip between the video and the footer, and
   the "X quiere unirse" toast has no action — the user wants a "go approve"
   affordance but is (rightly) worried a naive one could navigate away and drop
   the call.

## Goals

- Raise-hand: a toggle, a ✋ badge on the raiser's tile for everyone, and a
  host-only ordered list with "lower" per row. Ephemeral (nothing persisted).
- Floating reactions: a fixed 6-emoji quick row; reactions float bottom→top
  (TikTok style) on every screen at once, including external guests on
  `/p/call/:token`.
- Guest approval: a proper bottom-sheet panel, and a toast action that opens it
  **in place** without ever unmounting the call.

## Non-goals

- No persistence, no API, no DB. Reactions and raise-hand are LiveKit
  data-channel only.
- No custom-emoji picker for reactions (fixed set of 6).
- `CallInvitePanel` (the centered "nobody else here yet" card) is unchanged —
  different purpose (invite while alone).
- No moderation/rate-limit beyond a simple client-side send throttle.

---

## Shared: `useCallEphemeral({ room, publishData, selfIdentity, selfName, isHost })`

New hook `apps/desktop/src/modules/atlas.chat/calls/hooks/useCallEphemeral.js`.
Adds its **own** `RoomEvent.DataReceived` listener (LiveKit allows several — the
chat's handler stays untouched) and a `RoomEvent.ParticipantDisconnected`
listener. Handles two packet shapes, ignores everything else (incl. `type:"chat"`):

```
{ type: "reaction", emoji, fromName }
{ type: "hand", identity, name, raised: boolean }
{ type: "hand-lower", identity }        // host lowers someone else's hand
```

Returns:

- `reactions`: `Array<{ id, emoji, fromName, at }>` — capped at 24; each entry is
  removed by a per-entry `setTimeout` after `REACTION_TTL_MS` (4000).
- `sendReaction(emoji)`: throttled to 1 / 350 ms; `publishData({type:"reaction",
  emoji, fromName: selfName})` **and** appends locally (sender sees it instantly).
- `raisedHands`: `Map<identity, { name, at }>` in raise order (Map preserves
  insertion order; a re-raise deletes then re-sets so it moves to the end).
- `myHandRaised`: boolean (derived from `raisedHands.has(selfIdentity)`).
- `toggleHand()`: flips local, `publishData({type:"hand", identity: selfIdentity,
  name: selfName, raised: next})`.
- `lowerHand(identity)`: host-only; `publishData({type:"hand-lower", identity})`;
  every client (incl. the owner) drops that identity; the owner's `myHandRaised`
  goes false because it is derived from the map.

Late-joiner note: LiveKit data packets are not replayed, so someone joining
mid-call won't see hands raised before they connected. Accepted for v1 (matches
Meet's behavior for reactions; raise-hand re-sync could be a later
`RoomEvent.ParticipantConnected` → re-broadcast-if-raised).

---

## Plan A — Reactions + raise-hand

### A1. `CallReactionsOverlay.jsx` (new)

`position:absolute inset-0 z-20 pointer-events-none overflow-hidden`. Renders
each `reactions` entry as a `<span>` that runs one CSS animation:
`translateY(0 → -70vh)` + a small `translateX` drift (`--drift`, random −40..40px)
+ opacity `1 → 1 → 0` over `REACTION_TTL_MS`, `ease-out`. Start position: bottom
center with a random horizontal offset (`left: calc(50% + rand(-30%..30%))`).
Font-size ~28px, `will-change: transform, opacity`. Keyframes live in
`chat-theme.css` (or an inline `<style>` in the component). Mounted inside
`<main>` in both `CallRoomLayout` and `GuestCallRoom`.

### A2. Reactions quick row (footer button)

`CallReactionButton.jsx` (new, shared by both rooms) — a `Button` (😊 /
`SmilePlus`) that opens a Radix `Popover side="top"` with a single row of 6
buttons: `["❤️","👍","😂","🎉","👏","😮"]`. Tap → `onReact(emoji)` and close.
`pointer-events-auto`, `z` above the footer. On a coarse pointer the popover
still works (it's small); no Sheet needed.

Placed in the `<footer>` control cluster of `CallRoomLayout` (between screen-share
and hang-up) and of `GuestCallRoom`.

### A3. Raise-hand button + tile badge + host list

- **Footer button** `Hand` icon, `variant={myHandRaised ? "default" : "secondary"}`,
  `onClick={toggleHand}`, title "Bajar la mano" / "Levantar la mano". In both
  footers.
- **`ParticipantTile`** gains `handRaised` (boolean) → an amber pill
  `absolute left-2 top-2 rounded-full bg-amber-400/90 text-amber-950 px-1.5 py-0.5`
  with a ✋ + (optional) small pulse. `CallRoomLayout` maps each tile's
  `participant.identity` through the `raisedHands` map; `GuestCallRoom` does the
  same for its `Tile`.
- **`RaisedHandsBar.jsx`** (new, host only): `absolute left-3 top-3 z-20` chip
  stack, one row per raised hand in order: `✋ <name>` + an `X` "bajar"
  (`lowerHand(identity)`). Hidden when `raisedHands.size === 0`. Non-host
  participants don't get the bar (they still see the per-tile badges).
  Rendered inside `<main>` of `CallRoomLayout` (host = `view.isInitiator` — pass
  it through) — guests never host, so not in `GuestCallRoom`.

### Wiring in `CallRoom.jsx`

`const ephemeral = useCallEphemeral({ room, publishData, selfIdentity: room.localParticipant.identity, selfName: userProfile?.displayName ?? "Tú", isHost: isInitiator });`

Pass into `CallRoomLayout` `view`: `reactions`, `raisedHands`, `myHandRaised`,
`isHost: isInitiator`; into `actions`: `sendReaction: ephemeral.sendReaction`,
`toggleHand: ephemeral.toggleHand`, `lowerHand: ephemeral.lowerHand`.

### Wiring in `GuestCallRoom.jsx`

Same hook (`isHost: false`), same footer buttons + overlay. Guest identity =
`room.localParticipant.identity` (already `guest_…`), name = `myName`.

---

## Plan B — Guest panel as a bottom sheet + safe toast action

### B1. `CallGuestSheet.jsx` (new) — replaces `CallGuestRoster.jsx`

`Sheet side="bottom"` (`@atlas/ui`), `open` / `onOpenChange` controlled by the
caller. Content:

- `SheetHeader`: title `Invitados` + a count badge when `lobby.length > 0`
  (`{lobby.length} en espera`).
- **Section "Esperando aprobación"** (only if `lobby.length`): each row =
  initial-circle avatar + name + `Admitir` (primary, `Check`) + `Rechazar`
  (ghost red, `X`). Generous `py-2.5`, `rounded-xl` row hover.
- **Section "En la llamada"** (only if `admitted.length`): initial + name +
  mute toggle + kick (→ `ConfirmDialog`, unchanged logic).
- Footer row: `Compartir enlace` button → calls `onShare()` (opens the existing
  `CallShareDialog`).
- `EmptyState` "Sin invitados / Comparte el enlace…" when both empty.

Uses `useCallGuests` exactly as `CallGuestRoster` did (`admit/deny/kick/mute`).
Delete `CallGuestRoster.jsx` and its import.

### B2. `CallRoom.jsx`

- `const [guestSheetOpen, setGuestSheetOpen] = useState(false);`
- Render `{isInitiator && <CallGuestSheet open={guestSheetOpen}
  onOpenChange={setGuestSheetOpen} guestsApi={guestsApi}
  onShare={() => setShareOpen(true)} />}` (sibling of `CallShareDialog`).
- New prop from `CallsProvider`: `guestPanelNonce` (number). `useEffect(() => {
  if (guestPanelNonce) setGuestSheetOpen(true); }, [guestPanelNonce]);`
- `CallRoomLayout` `chat` prop: replace `roster` with
  `onOpenGuests: () => setGuestSheetOpen(true)` and keep `pendingLobby`.

### B3. `CallRoomLayout.jsx`

- Remove the `showRoster` block (the `max-h-48` strip) and the `roster` prop.
- The header guests button (the one already showing the `pendingLobby` badge)
  `onClick` → `chat.onOpenGuests()` instead of `chat.onShare()`. Keep a separate
  small "share" affordance inside the sheet (B1 footer) — the header button is
  now "manage guests". Icon: `Users` with the badge.
- If `canShare` but no guests yet and no lobby, the button still opens the sheet
  (which shows the empty state + "Compartir enlace").

### B4. `CallsProvider.jsx` — safe toast action

- `const [guestPanelNonce, setGuestPanelNonce] = useState(0);`
- Pass `guestPanelNonce={guestPanelNonce}` to `<CallRoom>`.
- Reset to 0 when `activeSession` clears (the existing
  `useEffect(() => { if (!activeSession) {...} }, [activeSession])`).
- The lobby toast (line ~427):
  ```js
  toast.message(`${p?.name ?? "Un invitado"} quiere unirse a la llamada.`, {
    action: {
      label: "Ver solicitudes",
      onClick: () => setGuestPanelNonce((n) => n + 1),
    },
  });
  ```
  `onClick` only bumps state — no navigation, no unmount. The call room stays
  exactly where it is and the sheet slides up over it.

---

## Data / control flow

```
tap 😊 → pick emoji → sendReaction → publishData{reaction} + local append
  → every client's useCallEphemeral appends → CallReactionsOverlay floats it up
tap ✋ → toggleHand → publishData{hand,raised} + local map update
  → every client: raisedHands map → ParticipantTile amber badge; host: RaisedHandsBar
host taps "bajar" → lowerHand(id) → publishData{hand-lower,id} → all drop it
guest waiting → realtime chat.call.guest_waiting → CallsProvider toast
  → "Ver solicitudes" → guestPanelNonce++ → CallRoom opens CallGuestSheet (in place)
host admits in the sheet → useCallGuests.admit → poll refreshes → row moves to "En la llamada"
```

## Testing

Repo has no React-component test runner. Pure logic that can be unit-tested
(`node --test`) is extracted:

- `apps/desktop/src/modules/atlas.chat/calls/lib/callEphemeral.js` — pure
  reducers used by the hook: `applyDataPacket(state, packet, selfIdentity)` →
  next `{ reactions, raisedHands }`; `nextReactions(list, entry)` (cap + id);
  `raiseOrder(map)` → array. Tests: a reaction packet appends & caps at 24; a
  `hand raised` adds to the map, a re-raise moves it to the end, `raised:false`
  removes it, `hand-lower` removes it, an unknown `type` is a no-op.
- The overlay / buttons / sheet are verified by the Vite build + manual device
  QA (2 real participants + 1 external guest: send reactions both ways, raise /
  lower hands, open the guest sheet from the toast without dropping the call;
  390 + 1440).

## Files

**Plan A**

| File | Change |
|---|---|
| `.../calls/lib/callEphemeral.js` | **new** — pure reducers |
| `.../calls/lib/__tests__/callEphemeral.test.js` | **new** |
| `.../calls/hooks/useCallEphemeral.js` | **new** — the hook (listener + state) |
| `.../calls/CallReactionsOverlay.jsx` | **new** |
| `.../calls/CallReactionButton.jsx` | **new** |
| `.../calls/RaisedHandsBar.jsx` | **new** |
| `.../calls/CallRoom.jsx` | wire the hook, pass to layout |
| `.../calls/CallRoomLayout.jsx` | overlay + footer buttons + tile badge + bar + `isHost` |
| `.../calls/guest/GuestCallRoom.jsx` | overlay + footer buttons + tile badge |
| `.../calls/chat-theme.css` (or inline) | float keyframes |

**Plan B**

| File | Change |
|---|---|
| `.../calls/CallGuestSheet.jsx` | **new** — replaces the roster |
| `.../calls/CallGuestRoster.jsx` | **deleted** |
| `.../calls/CallRoom.jsx` | `guestSheetOpen` state + `guestPanelNonce` prop + render sheet |
| `.../calls/CallRoomLayout.jsx` | drop the `roster` strip; header button opens the sheet |
| `.../calls/CallsProvider.jsx` | `guestPanelNonce` + toast `action` |

No API, no SDK, no migration.
