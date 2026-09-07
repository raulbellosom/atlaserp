# atlas.calls — Invite panel close, access mode (PIN vs free), restore-from-minimized fix

Date: 2026-09-07
Status: Approved (design)
Module: atlas.calls (lives under `apps/desktop/src/modules/atlas.chat/calls/` + `apps/api/src/routes/calls/`)

## Problem

Three issues reported against the live atlas.calls feature:

1. The centered "Aún no hay nadie más" invite card (link + code + email invite) that
   shows while the host is alone has no way to be dismissed. It sits over the
   self-view for the whole time the host waits.
2. There is no user-facing choice between "start the meeting behind a PIN / host
   approval" (the previous behaviour) and "free access" (guests land straight in).
   The capability exists in the backend but is only reachable through one checkbox
   buried in the full `CallShareDialog`.
3. On web, a minimized call cannot be restored — clicking the floating
   `MiniCallBubble` does nothing. On mobile the same tap restores correctly.

## Scope

Frontend-only. No Prisma schema change, no new API endpoint, no validator change.
Roughly four files touched. Single implementation plan (no A/B split): it is
frontend-only and well under ten tasks.

Out of scope: redesigning the share dialog, guest lobby UX, per-call expiry/max-uses,
any change to how guest tokens or codes are minted.

---

## Change 1 — Closable invite panel

### Current behaviour

`CallRoom.jsx` renders the panel as:

```
invitePanel: isInitiator && isAlone
  ? <CallInvitePanel conversationId={conversationId} />
  : null,
```

`CallRoomLayout.jsx` (~line 336) places it centered over the stage while
`invitePanel && !mobileChatOpen && !screenShareEntry`.

### Design

- Add a close (X) control to the `CallInvitePanel` header row (next to the
  "Aún no hay nadie más" title). Use a plain icon button (`lucide-react` `X`),
  matching the existing in-panel icon-button styling (the copy buttons).
- `CallInvitePanel` gains an `onClose` prop. Clicking X calls it.
- `CallRoom.jsx` holds `const [inviteDismissed, setInviteDismissed] = useState(false)`.
  The panel gate becomes:

  ```
  invitePanel: isInitiator && isAlone && !inviteDismissed
    ? <CallInvitePanel conversationId={conversationId} onClose={() => setInviteDismissed(true)} />
    : null,
  ```

- Because `inviteDismissed` lives on the `CallRoom` instance (keyed by
  `activeSession.call.id` in `CallsProvider`), the panel stays closed for the rest
  of the call — including if every participant leaves and the host is alone again.
  A new call gets a fresh `CallRoom` and the panel is back. This matches the chosen
  behaviour ("queda cerrado toda la llamada").

### Re-open path

No new affordance. The host re-opens invite tooling through the existing
"Invitar / Compartir" button in the call action bar, which opens `CallShareDialog`
(same link + code + email invite, plus the access-mode control from Change 2).

---

## Change 2 — Access mode: "Con aprobación (PIN)" vs "Libre acceso"

### What already exists

- `callLink.requireLobby` (boolean) on the per-conversation `CallLink` row.
  `getOrCreateLink` seeds it `true`.
- `call-guest-service.js:185`: `const status = link.requireLobby ? "LOBBY" : "ADMITTED";`
  — with `requireLobby: false` a guest joining by link/code lands `ADMITTED`
  immediately, no host action. With `true` they wait in the lobby.
- `callLinkPatchSchema` (`packages/validators/src/calls.js`) already accepts
  `requireLobby`. `atlas.calls.updateLink(conversationId, patch, token)` exists in
  the SDK and is already used by `CallShareDialog`.
- The `CallLink` row is unique per conversation (`findFirst({ conversationId, revokedAt: null })`)
  and persists across calls. Writing `requireLobby` therefore already behaves as a
  durable per-conversation setting.

So this change is purely about surfacing the existing field in two more places and
framing it as the user's "PIN vs libre acceso" mental model.

### Terminology (user-facing, Spanish)

- `requireLobby: true`  → **"Con aprobación (PIN)"** — the host admits each person.
- `requireLobby: false` → **"Libre acceso"** — anyone with the link or code enters
  directly.

The link and code themselves are unchanged in both modes (the "PIN" label refers to
the host-approval gate, not to making the code mandatory — the code already works
the same way regardless).

### 2a — Per-call control, in `CallInvitePanel`

- Below the code row, add a `SelectField` (`@atlas/ui`) labelled
  **"Acceso"** with two options:
  - `"Con aprobación (PIN)"` → value `lobby`
  - `"Libre acceso"` → value `open`
- Value derives from `link.requireLobby` (`lobby` when `true`, `open` when `false`).
  Rendered only once `link` has loaded (same guard as the code row).
- On change: optimistically update local `link` state, then
  `atlas.calls.updateLink(conversationId, { requireLobby: value === "lobby" }, token)`.
  On failure: `toast.error(...)` and revert local state.
- Decision (revised during planning): a **two-button segmented toggle** styled with
  the card's own dark slate/violet palette, not a `SelectField`. The card is a
  bespoke dark surface; a themed `SelectField` follows the app theme and clashes in
  light mode. Plain `<button>`s are not a native `<select>`, so the UI-first policy
  holds. Both modes are still named explicitly. `CallShareDialog`'s existing
  checkbox is left as-is; wording can be unified later.

### 2b — Per-conversation default, in `ChannelGeneralTab`

- New "Libre acceso a las llamadas" `SwitchField` (revised during planning from a
  `SelectField`, to match the `SwitchField` already used in this file for "Solo
  administradores pueden escribir"). Switch on = `requireLobby: false`.
- On mount: load the conversation's link via `atlas.calls.createLink` (get-or-create;
  the endpoint returns the existing link when there is one). If the caller lacks
  `channel.manage` the request 403s and is swallowed — the section is hidden in that
  case (the tab is already manager-gated, so this is defence-in-depth).
- On change: `atlas.calls.updateLink(conversationId, { requireLobby }, token)`.
- Because 2a and 2b write the same `callLink.requireLobby` field, the last write
  wins and the value persists as the conversation default for the next call. This
  is the "Ambos" outcome (conversation default + per-call override) with no new
  storage.
- Edge case — brand-new conversation with no link yet: `createLink` creates one
  (`requireLobby: true` seed), then the toggle patches it. One extra row created
  early; harmless.

### Non-goals for Change 2

- No change to guest token/code generation.
- No migration. `getOrCreateLink`'s `true` seed stays; the UI can flip it.
- No enforcement changes server-side — `call-guest-service.js` already honours the flag.

---

## Change 3 — Restore-from-minimized broken on web

### Root cause (to confirm during implementation)

`MiniCallBubble.jsx` calls `node.setPointerCapture(e.pointerId)` on the **container
div** inside `onPointerDown`, unconditionally. Once the container has pointer
capture, the browser retargets `pointermove` / `pointerup` for that pointer to the
container. The inner restore `<button>`'s `onPointerUp` handler
(`if (!wasDrag()) onRestore?.()`) therefore never fires for a mouse pointer on
desktop — the container's own `onPointerUp={endDrag}` fires instead. Touch works
today because of implicit pointer capture / synthetic-click differences.

### Fix (decided: A + B)

**A — capture only after the drag threshold is crossed.**
Move `node.setPointerCapture(pointerId)` out of `onPointerDown` and into
`onPointerMove`, called once — at the moment `d.moved` flips to `true`
(`Math.hypot(dx, dy) > TAP_THRESHOLD_PX`). A plain click/tap never crosses the
threshold, so the pointer is never captured and the button's own events fire
normally on every platform. `onPointerDown` still records the drag origin
(`startX/startY/originX/originY/moved:false`) and still returns early for
non-primary buttons.

**B — restore on `click`, not `pointerup`.**
The DOM `click` event is hit-tested to the element under the pointer regardless of
pointer capture, so it is a reliable restore trigger. Move the restore call to
`onClick` on the button:

```
onClick={() => { if (!gestureWasDrag.current) onRestore?.(); }}
```

`endDrag` (which runs on the container's `pointerup`, before `click`) sets
`gestureWasDrag.current = d.moved` **before** nulling `dragRef.current`, so the
guard survives. Reset `gestureWasDrag.current = false` at the start of the next
`onPointerDown`.

Keep the `touch-none select-none` classes and the `onPointerDown` stop-propagation
on the mic/hang-up buttons unchanged.

### Verification

- Web, mouse: minimize a call → single click on the bubble video area restores the
  full call. Click again after restore is a no-op (already full).
- Web, mouse: press on the bubble and drag > 4px → bubble moves, release does **not**
  restore.
- Mobile emulation 390px: tap restores; drag moves and does not restore; bubble
  still clamps within the viewport on resize/rotate.
- Mic and hang-up buttons on the bubble still work and still do not trigger a drag
  or a restore.
- Screenshots at 390px and 1440px per the responsive-QA checklist.

### Tests

`MiniCallBubble` is pure DOM with no extractable pure logic beyond the trivial
`fmt()` helper, so this is covered by manual QA rather than a new unit test. If a
`wasTap({ dx, dy, threshold })` helper is extracted during implementation, add a
one-line `node --test` case for it; otherwise no test file is added.

---

## Files expected to change

| File | Change |
|---|---|
| `apps/desktop/src/modules/atlas.chat/calls/CallInvitePanel.jsx` | X close button + `onClose` prop; `SelectField` access-mode control wired to `updateLink` |
| `apps/desktop/src/modules/atlas.chat/calls/CallRoom.jsx` | `inviteDismissed` state; gate the `invitePanel` prop on it; pass `onClose` |
| `apps/desktop/src/modules/atlas.chat/calls/MiniCallBubble.jsx` | Deferred `setPointerCapture`; restore via `onClick` with drag guard |
| `apps/desktop/src/modules/atlas.chat/components/ChannelGeneralTab.jsx` | "Acceso a las llamadas" section with the same `SelectField`, load via `createLink`, save via `updateLink`, hidden on 403 |

No backend, validator, SDK, or Prisma changes.

## Risks / notes

- `ChannelGeneralTab` is 331 lines; adding a small section keeps it well under the
  800-line proactive-split line. If it approaches that, extract the section into a
  `ChannelCallAccessSection.jsx` sibling.
- `createLink` from the settings tab has the side effect of materialising a
  `CallLink` row for conversations that never had a call. Acceptable; the row is
  inert until used.
- The "PIN" label is a UX framing of `requireLobby`; it does not introduce a numeric
  PIN. If a future request wants a literal numeric PIN distinct from the Crockford
  code, that is a separate spec.
