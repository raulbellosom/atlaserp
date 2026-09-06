# In-call chat panel — Design Spec

**Date:** 2026-09-06
**Module:** `atlas.chat` — `atlas.calls` UI (`apps/desktop/src/modules/atlas.chat/calls/`) + `call-service.js`
**Status:** Approved (user-requested, 2026-09-06). Execute spec -> plan -> implementation in one cycle.
**Related:** `2026-08-27-atlas-calls-livekit-design.md`, `2026-08-30-atlas-calls-video-upgrade-and-pip-design.md`
**Follow-on (separate spec, not this cycle):** external / guest access to calls (public links, code links, name-only or email-match join, email invitations).

---

## 1. Problem

`atlas.calls` is live (LiveKit transport, `call-service.js`, `CallRoom.jsx`,
`CallRoomLayout.jsx`, `DraggablePip.jsx`). A call is gated purely by
membership of the bound `chat_conversation`. There is **no chat surface inside
the call** today, and **no system message** is written to the conversation when
a call starts or ends — the call is invisible in the chat timeline.

The user wants the call's own conversation present *inside* the call: for a 1:1
call it is literally the same direct conversation; for a group call it is the
same group conversation. This also lays the groundwork for the follow-on
external-guest feature (a guest needs somewhere to type and be seen).

## 2. Scope

### Included

- Dock the **real `ChatWindow`** component inside `CallRoom`, reading/writing
  the same `chat_conversation` bound to `Call.conversationId` — messages are
  permanent and identical to the normal chat history. All existing rich
  features (threads, reactions, pins, mentions, attachments, entity refs) come
  along because it is the same component.
- A new `embedded="call"` variant of `ChatWindow` that trims header chrome for
  the in-call context.
- **Desktop (>= `lg`)**: right-docked, fixed-width, collapsible panel. Open by
  default. Collapse state persists per browser (localStorage).
- **Mobile (< `lg`)**: `CallRoom` becomes a single-view state machine
  `video | screen | chat` with a persistent segmented switcher. Chat closed by
  default. `Pantalla` segment only exists while a live screen-share track
  exists. A tappable banner surfaces a screen-share that starts while the user
  is on `chat`.
- **Call lifecycle system messages** posted to `Call.conversationId` on call
  activate / end (with reason + duration), rendered as a compact **call card**
  in the bubble list with a "Volver a llamar" action.

### Excluded (explicit)

- Any LiveKit / infra / token / signaling change. The chat still flows over
  the existing chat realtime channel, not the LiveKit data channel.
- External / guest participants (separate follow-on spec).
- New RBAC permissions. Conversation membership remains the only gate.
- Persisting a mid-call `Call.kind` upgrade (already tracked as backlog F1-a).
- Any change to call setup / ring / accept / decline / leave / end flows
  beyond adding the system-message side effect.
- New `@atlas/ui` components. `CallChatPanel` is call-overlay-specific and
  stays in the calls folder (same reasoning as `DraggablePip`).

## 3. Architecture

### 3.1 Component reuse

`CallRoom` is mounted app-wide by `CallsProvider`, which sits inside the app's
`QueryClientProvider`, `AuthProvider`, `RealtimeProvider` and `Router`. Every
hook `ChatWindow` depends on (`useChatMessages`, `useSendMessage`,
`useMarkRead`, `useGlobalPresence`, `useAuth`, `useNavigate`, `useCalls`,
`useChatConversationDetail`, ...) therefore already resolves at that mount
point. No new providers.

```
CallsProvider (app-wide)
  CallRoom.jsx  ── LiveKit room (unchanged) ── CallRoomLayout.jsx
        │
        └── CallChatPanel.jsx (new)
                └── ChatWindow  embedded="call"  conversationId={session.call.conversationId}
                        └── (same ChatMessageList / MessageComposer / ThreadPanel / etc.)
```

### 3.2 `ChatWindow` `embedded="call"` variant

New optional prop `embedded` (`undefined` = today's behavior, `"call"` = in-call).
When `"call"`:

- Header: keep conversation name, type badge, member avatar stack, presence.
  **Remove** the Phone / Video buttons, archive / unarchive, delete
  conversation, "back to list" arrow, and the conversation-level close `X`.
- The left affordance becomes the panel collapse/close control, provided by
  `CallChatPanel` via an `onCollapse` prop passed through.
- `useNavigate()` targets from inside the embedded window (entity-reference
  clicks, "open in chat") are allowed but do **not** dismiss the call overlay
  — the overlay is a fixed `z-[10020]` layer and simply stays on top. No
  "leave call?" prompt in this cycle.
- Never renders anything that would start a nested call.

Everything else (`ChatMessageList`, `MessageComposer`, `ThreadPanel`,
`PinnedMessagesSheet`, `ChatAttachmentViewer`, drop-zone upload) renders
unchanged. Thread / pinned overlays clamp to the panel bounds because they are
already positioned relative to the `ChatWindow` root.

### 3.3 `CallChatPanel.jsx` (new, `calls/`)

Thin shell responsible only for placement + collapse. It does **not**
re-implement any chat behavior.

- **Desktop (`lg` and up):** absolutely positioned inside the call `<main>`
  offset parent, right edge, full height, width `380px` (matches
  `MiniChatWindow` `WW`). Renders `ChatWindow embedded="call"` when expanded;
  when collapsed renders a ~44px rail (chat icon + unread badge) that expands
  on click.
- **Mobile:** `CallChatPanel` renders `ChatWindow embedded="call"` full-bleed;
  show/hide is driven entirely by the `CallRoom` view state (`chat`), not by
  its own collapse state.
- Collapse state key: `localStorage["atlas.calls.chatPanel.collapsed"]`,
  read/written in try/catch, default expanded (open by default on desktop).
- Unread count comes from the same `useChatMessages` / conversation-detail data
  `ChatWindow` uses (unread badge for that conversation); when the panel is
  expanded and the window focused, `useMarkRead` fires exactly as it does in
  the normal chat screen.

### 3.4 Mobile view state machine

In `CallRoom` (mobile only, `< lg`):

```
view: "video" | "screen" | "chat"        (useState, default "video")
```

- Segmented switcher pill, fixed near the top of the call overlay, inside the
  safe-area inset: `Video` | `Pantalla` | `Chat`. Built from `@atlas/ui`
  primitives (no native control).
- `Pantalla` segment is rendered only when `screenShareParticipant` (the
  existing derived value in `CallRoom`) is truthy. If the share ends while
  `view === "screen"`, `CallRoom` resets `view` to `"video"`.
- `view === "video"` -> existing grid / focus layout.
  `view === "screen"` -> existing full-scale screen-share layout.
  `view === "chat"` -> `CallChatPanel` full-bleed; call controls bar stays
  visible (mute / camera / hang up) either above or below the chat, decided in
  the plan — chat must never hide the hang-up button.
- Unread while `view !== "chat"` -> dot on the `Chat` segment.
- If `screenShareParticipant` becomes truthy while `view === "chat"`, slide in
  a thin tappable banner at the top: `"{Nombre} está compartiendo pantalla —
  Ver"`. Tapping sets `view = "screen"`. Banner auto-dismisses when the share
  ends or after the user switches views.
- Desktop (`lg`+) does **not** use this state machine — it keeps today's
  layout plus the docked `CallChatPanel`.

### 3.5 Call lifecycle system messages

`call-service.js` writes a system message into `Call.conversationId` using the
same raw-SQL insert path chat already uses for system rows (verify exact
`chat_messages` shape / `message_type` / system-author convention during
implementation — do not invent a new column).

| Transition | Trigger in service | Text |
|---|---|---|
| Call -> `ACTIVE` | first `joinCall` that flips status (`shouldActivate`) | `"Videollamada iniciada"` / `"Llamada de voz iniciada"` (by `Call.kind`) |
| Call -> `ENDED`, `endReason = "ended"` | `endCallRecord(call, "ended")` | `"Llamada finalizada · {mm:ss or h:mm:ss}"` (from `startedAt`→`endedAt`) |
| Call -> `ENDED`, `endReason = "missed"` | `endCallRecord(call, "missed")` / `expireStaleCalls` | `"Llamada perdida"` |
| Call -> `ENDED`, `endReason = "rejected"` | `endCallRecord(call, "rejected")` | `"Llamada rechazada"` |

- Metadata on the message row carries `{ callId, kind, endReason, durationSec }`
  so the client can render the call card without a second fetch.
- The message is broadcast over the **existing chat realtime path** (whatever
  `sendMessage` / chat broadcaster already uses) so it appears live for every
  conversation member, on the call or not.
- Idempotency: exactly one "iniciada" per call and one terminal message per
  call. Guard on the transition actually happening inside the same
  transaction / status flip that already gates `shouldActivate` and
  `endCallRecord`, so a double `join` or double `end` cannot double-post.
- Failure to post a system message must **not** fail the call operation —
  wrap in try/catch + `console.warn`, same defensive posture as the existing
  `notificationService` / `broadcaster` calls in this file.

### 3.6 Call card rendering

Client renders the system message as a compact call-log row (WhatsApp style):
call icon (video/phone by `kind`), label text, duration, and a
`"Volver a llamar"` button that invokes the existing `useCalls().startCall(
conversationId, kind)`. `"Volver a llamar"` is hidden when a call is already
live in that conversation (reuse whatever `useCalls` exposes for
current-call state).

`ChatMessageBubble.jsx` is at 1188 lines and the CLAUDE.md note says the next
change must first extract the attachment sub-components into
`MessageAttachments.jsx`. To respect that without ballooning this spec: the
call-card branch goes in a **new sibling `CallLogCard.jsx`** that
`ChatMessageBubble` imports and renders for `message_type === <system/call>`,
adding only an import + a short branch to the big file rather than a new inline
block. The attachment extraction remains its own separate task (not blocked by
this spec, not done here).

## 4. Data flow

1. User A starts a call -> `POST /calls` (unchanged) -> ring -> User B joins
   -> `joinCall` flips `Call.status = ACTIVE` -> service posts
   `"Videollamada iniciada"` to the conversation -> chat realtime broadcasts
   -> card appears in every member's chat and in the in-call panel.
2. During the call, messages typed in `CallChatPanel` go through the normal
   `useSendMessage` -> `POST` chat message -> realtime -> visible in the panel
   and in `atlas.chat` simultaneously. Attachments, reactions, threads, pins,
   mentions all use their existing endpoints.
3. Call ends (`leave` by last peer / `end` by initiator / `decline` collapses
   a never-answered call / stale-sweep) -> `endCallRecord` posts the terminal
   message with duration/reason -> card updates the timeline.
4. `CallRoom` unmounts with the LiveKit session. The conversation is untouched
   and stays exactly where it was in `atlas.chat`.

## 5. Error handling / edge cases

- **System-message insert fails:** logged, call op unaffected (3.5).
- **Group call, some conversation members not on the call:** they still see
  every message and both call cards in the conversation. Expected — "es el
  mismo chat".
- **Screen-share starts/stops rapidly on mobile:** `Pantalla` segment and the
  banner are pure functions of `screenShareParticipant`; the only stateful
  reaction is "reset `view` to `video` when the share ends while
  `view === "screen"`".
- **Mobile keyboard up in `chat` view:** full-bleed chat already scrolls; the
  call control bar with hang-up must remain reachable — plan pins it outside
  the keyboard-collapsible area.
- **Panel collapsed on desktop, new messages arrive:** rail shows unread
  badge; expanding marks read.
- **localStorage unavailable (private window / thumbnailer):** try/catch,
  default expanded.
- **`embedded` `ChatWindow` triggers navigation** (entity-ref click): allowed,
  call overlay stays on top, no prompt.
- **Two very fast joins racing to activate:** the existing `shouldActivate`
  transaction gate ensures only one path posts "iniciada".

## 6. Testing

### Backend (`node --test apps/api/src/routes/calls/__tests__/`)

- `call-service.test.js`: posts exactly one "iniciada" on the activating join;
  none on a second join.
- Terminal message on `end` carries duration; `missed` -> "Llamada perdida";
  `rejected` -> "Llamada rechazada"; exactly one terminal message even on
  double `end` / `leave` + `end`.
- Duration formatting helper: `< 1h` -> `m:ss`, `>= 1h` -> `h:mm:ss`,
  `0s` guard.
- System-message insert failure is swallowed (inject a throwing prisma stub
  for that insert, assert the call op still resolves).

### Frontend

- `pnpm --filter @atlas/desktop build:web` clean.
- `pnpm --filter @atlas/desktop lint` clean.
- Any pure helper extracted (e.g. `formatCallDuration`, view-state reducer)
  gets a `node --test` file next to it.
- Manual smoke (documented, no React harness): desktop panel open-by-default +
  collapse persists across reloads; mobile switcher; `Pantalla` segment
  appears/disappears with the share; banner while on `chat`; call card renders
  with duration; "Volver a llamar" starts a call and is hidden while one is
  live; 390px and 1440px screenshots per the responsive-QA checklist.

## 7. Files

| File | Change |
|---|---|
| `apps/desktop/src/modules/atlas.chat/components/ChatWindow.jsx` | `embedded="call"` prop: trim header (no call/archive/delete/back/close), `onCollapse` left affordance, never start nested call |
| `apps/desktop/src/modules/atlas.chat/calls/CallChatPanel.jsx` | **new** — desktop docked/collapsible shell + localStorage collapse state; mobile full-bleed host; unread rail badge |
| `apps/desktop/src/modules/atlas.chat/calls/CallRoom.jsx` | mount `CallChatPanel`; desktop dock; mobile `view` state machine + segmented switcher + screen-share banner; reset `view` on share end |
| `apps/desktop/src/modules/atlas.chat/calls/CallRoomLayout.jsx` | reflow `<main>` for docked panel width on desktop; accept/forward `view` for mobile |
| `apps/desktop/src/modules/atlas.chat/calls/lib/callChatView.js` (or similar) | **new** — pure view-state reducer + `formatCallDuration` helper, unit-tested |
| `apps/api/src/routes/calls/call-service.js` | post system message on ACTIVE / ENDED (reason + duration), idempotent, failure-swallowing |
| `apps/desktop/src/modules/atlas.chat/components/CallLogCard.jsx` | **new** — compact call-card row + "Volver a llamar" |
| `apps/desktop/src/modules/atlas.chat/components/ChatMessageBubble.jsx` | import + one branch to render `CallLogCard` for the call system message |
| `apps/api/src/routes/calls/__tests__/call-service.test.js` | system-message + duration + idempotency + failure-swallow cases |

## 8. Acceptance criteria

- [ ] In a desktop call the chat panel is open by default, shows the bound
      conversation's real history, and sends/receives messages that also appear
      in `atlas.chat` immediately.
- [ ] Collapsing the desktop panel and reloading keeps it collapsed; unread
      messages show a badge on the rail.
- [ ] On mobile the `Video / Pantalla / Chat` switcher works; `Pantalla` only
      shows during an active screen-share; a share starting while on `Chat`
      surfaces the "Ver" banner; hang-up is always reachable.
- [ ] Starting a call posts "Videollamada iniciada" / "Llamada de voz
      iniciada" once to the conversation; ending posts one terminal message
      with duration (or "Llamada perdida" / "Llamada rechazada").
- [ ] The call card renders in both the in-call panel and the normal chat
      screen, and "Volver a llamar" starts a call (and is hidden while one is
      live).
- [ ] No LiveKit / token / signaling code changed; `LIVEKIT_API_SECRET` still
      absent from all HTTP responses and the frontend bundle.
- [ ] Backend call tests, `build:web`, and `lint` all pass.

## 9. Follow-on (out of scope here)

External / guest access to calls — public share links, short code links,
name-only join, email-match join with emailed invitations, guest lobby/admit,
host moderation of guests, link expiry/revocation, abuse/rate-limit
protection. Its own spec -> plan -> implementation cycle. This spec's in-call
chat is the surface guests will type into.
