# External guest access to calls — Design Spec

**Date:** 2026-09-06
**Module:** `atlas.calls` (a capability of `atlas.chat`) — `apps/api/src/routes/calls/`, `apps/desktop/src/modules/atlas.chat/calls/`, plus a new public SPA route.
**Status:** Approved (user-requested, 2026-09-06). Follow-on to `2026-09-06-chat-in-call-panel-design.md` (in-call chat, shipped).
**Depends on:** the in-call chat panel work (shipped) and the live `atlas.calls` LiveKit stack.

---

## 1. Problem

`atlas.calls` today only lets **Atlas users who are members of the bound
`chat_conversation`** join a call. There is no way to bring in someone without
an account. The user wants:

- A host can share a **public link** or a **short code** for a call; anyone
  with it joins by entering at least a display name.
- A host can **invite people by email**; if the email matches an Atlas user in
  the same company they get the normal in-app invite, otherwise they get an
  emailed join link.
- Guests get the call's real-time chat (the in-call panel), scoped so their
  messages never enter the org's permanent chat history.

## 2. Scope

### Included

- New tables: `call_link`, `call_invite`, `call_guest`, `call_message`,
  `call_guest_join_attempt` (one migration).
- `call-links-service.js` — create / fetch / revoke a per-conversation guest
  link (+ short code), email invites.
- `call-guest-service.js` — guest join (name-only or via invite token), lobby
  admit/deny, guest session tokens, guest LiveKit token minting, kick/mute,
  IP rate-limiting.
- `call-messages-service.js` — the ephemeral call-scoped chat (`call_message`),
  written by both members and guests, **dropped with the call**.
- Routes: `/calls/:id/link` (host), `/calls/:id/guests/*` (host moderation),
  `/calls/guest/*` (unauthenticated, guest-token-scoped), `/calls/:id/messages`
  + `/calls/guest/messages`.
- Host UI: "Compartir" dialog in the call header, "Invitados" roster section
  with admit/deny + mute/kick, and switching the in-call chat panel to
  **call-room mode** (the ephemeral `call_message` stream) whenever the call
  has any guest.
- Guest UI: a new public route `/p/call/:token` (and `/p/call` with a code
  field) — name-entry gate, lobby wait, then a stripped-down call room
  (video grid, mic/cam/screen, the ephemeral chat, leave).

### Excluded (explicit)

- Guest access to anything other than the one call: no `/chat`, `/contacts`,
  `/files`, no conversation history, no other conversations.
- Persisting guest chat into `chat_messages` / the org conversation.
- Guest screen-recording, transcription, dial-in / PSTN, waiting-room chat
  before admit.
- Guests on the Atlas mobile/desktop native app (browser only, like the
  existing external chat widget).
- Federated identity / SSO for guests. A guest is a name + optional email,
  nothing more.
- Changing `call_participant` (stays users-only). Guests are a parallel list.
- Real-time push to the guest page: v1 **polls**. Members' call room also
  polls the guest-room endpoint while guests are present (no new Postgres
  Changes / Supabase Realtime wiring this cycle — logged as a follow-up).

## 3. Data model (one migration `20260906000000_call_guest_access`)

All tables: `id UUID DEFAULT uuidv7() PK`, `created_at TIMESTAMP(3) DEFAULT
CURRENT_TIMESTAMP`. RLS enabled; `service_role` full policy; `authenticated`
`SELECT` only, guarded by `chat_is_member` through the owning `call`
(mirrors the existing `call` / `call_participant` policies).

### `call_link`

| col | type | notes |
|---|---|---|
| `conversation_id` | UUID NOT NULL | no FK (chat_conversations is raw-SQL managed, same as `call.conversation_id`) |
| `token` | TEXT UNIQUE NOT NULL | 32 random bytes hex — the `/p/call/:token` segment |
| `code` | TEXT UNIQUE NOT NULL | 8 chars Crockford base32 (no I/L/O/U), for manual entry |
| `require_lobby` | BOOLEAN NOT NULL DEFAULT true | false = admitted immediately |
| `max_uses` | INT | NULL = unlimited |
| `use_count` | INT NOT NULL DEFAULT 0 | incremented per successful guest join |
| `expires_at` | TIMESTAMP(3) | NULL = no expiry |
| `revoked_at` | TIMESTAMP(3) | set on revoke; all guest ops re-check this |
| `created_by_user_id` | UUID NOT NULL | FK `user_profile` ON DELETE RESTRICT |
| `updated_at` | TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP | |

Partial unique index: `(conversation_id) WHERE revoked_at IS NULL` — one live
link per conversation. Re-generating revokes the old one first.

### `call_invite`

| col | type | notes |
|---|---|---|
| `link_id` | UUID NOT NULL | FK `call_link` ON DELETE CASCADE |
| `email` | TEXT NOT NULL | as entered |
| `email_normalized` | TEXT NOT NULL | `lower(trim())` |
| `token` | TEXT UNIQUE NOT NULL | 24 bytes hex — carried as `?i=` on the join URL, prefills email + skips the code |
| `invited_by_user_id` | UUID NOT NULL | FK `user_profile` |
| `sent_at` | TIMESTAMP(3) | set when the email actually sent (NULL = SMTP unconfigured, host copied link) |
| `accepted_at` | TIMESTAMP(3) | first successful guest join with this token |

Index `(link_id, email_normalized)`.

### `call_guest`

| col | type | notes |
|---|---|---|
| `call_id` | UUID NOT NULL | FK `call` ON DELETE CASCADE |
| `link_id` | UUID | FK `call_link` ON DELETE SET NULL |
| `invite_id` | UUID | FK `call_invite` ON DELETE SET NULL |
| `display_name` | TEXT NOT NULL | 2–40 chars after trim |
| `email` | TEXT | optional |
| `session_token_hash` | TEXT NOT NULL | sha256 of the guest session token |
| `livekit_identity` | TEXT NOT NULL | `guest_<id>` |
| `status` | TEXT NOT NULL DEFAULT 'LOBBY' | CHECK IN ('LOBBY','ADMITTED','LEFT','KICKED','DENIED') |
| `admitted_by_user_id` | UUID | FK `user_profile` ON DELETE SET NULL |
| `join_ip` | TEXT | for rate-limit / abuse review |
| `user_agent` | TEXT | |
| `admitted_at` / `left_at` / `last_seen_at` | TIMESTAMP(3) | |

Unique `(call_id, livekit_identity)`. Index `(call_id, status)`,
`(session_token_hash)`.

### `call_message`

| col | type | notes |
|---|---|---|
| `call_id` | UUID NOT NULL | FK `call` ON DELETE CASCADE — **this is the drop mechanism**; a call row is retained as history but its messages go when the call row is deleted (a later retention sweep can hard-delete ended calls) |
| `sender_kind` | TEXT NOT NULL | CHECK IN ('user','guest','system') |
| `sender_user_id` | UUID | FK `user_profile` ON DELETE SET NULL |
| `sender_guest_id` | UUID | FK `call_guest` ON DELETE SET NULL |
| `sender_name` | TEXT NOT NULL | denormalized display name (survives guest-row deletion) |
| `body` | TEXT NOT NULL | 1–4000 chars |

Index `(call_id, created_at)`.

### `call_guest_join_attempt`

| col | type | notes |
|---|---|---|
| `ip` | TEXT NOT NULL | |
| `link_id` | UUID | nullable (bad token → no link) |
| `outcome` | TEXT NOT NULL | 'ok' \| 'rate_limited' \| 'bad_token' \| 'bad_code' \| 'revoked' \| 'expired' \| 'max_uses' \| 'call_full' |

Index `(ip, created_at)`. Rows older than 1 day swept opportunistically.

## 4. Services

### 4.1 `call-links-service.js` — `createCallLinksService({ prisma, smtpService, now })`

- `getOrCreateLink({ authUserId, conversationId })` — asserts caller is the
  live call's initiator **or** holds `channel.manage` on the conversation
  (reuse `call-service`'s role check). Returns the existing non-revoked link
  or creates one (`token`, unique `code`, `require_lobby: true`).
- `updateLink({ authUserId, conversationId, patch })` — `require_lobby`,
  `max_uses`, `expires_at`.
- `revokeLink({ authUserId, conversationId })` — sets `revoked_at`. Kicks
  every `LOBBY`/`ADMITTED` guest whose `link_id` is this link (delegates to
  `call-guest-service.kickGuest`).
- `sendInvites({ authUserId, conversationId, emails })` — for each email:
  - matches an **active membership** in the caller's company whose
    `user_profile.email`/auth email equals it → returned in `matchedUsers`
    (the route then calls the existing chat `addMembers` + the caller can ring
    them normally); **no** `call_invite` row.
  - otherwise → `call_invite` row + `smtpService.sendEmail` with the join URL
    `${PUBLIC_APP_URL}/p/call/${token}?i=${inviteToken}`. If
    `!smtpService.isConfigured()` → row still created, `sent_at` NULL,
    returned in `pendingManual` so the UI shows a copyable link.
- `resolveLinkForJoin({ token, code })` — returns the link (or a typed error:
  `bad_token`, `bad_code`, `revoked`, `expired`, `max_uses`). Never leaks
  whether a token exists vs. is revoked to unauthenticated callers beyond the
  typed reason.

### 4.2 `call-guest-service.js` — `createCallGuestService({ prisma, env, AccessTokenImpl, RoomServiceClientImpl, linksService, broadcaster, notificationService, now })`

Reuses `readLiveKitConfig` from `call-service.js`.

- `joinAsGuest({ token, code, inviteToken, displayName, email, ip, userAgent })`:
  1. Rate-limit: `> 8` attempts from `ip` in the last 10 min → record
     `rate_limited`, throw 429.
  2. `resolveLinkForJoin`. If `inviteToken` given, load the `call_invite`,
     require its `link_id` matches and it is not `accepted_at` by a *different*
     active guest; prefill `email`.
  3. Find the **live call** (`RINGING`/`ACTIVE`) for `link.conversationId`.
     None → typed `no_live_call` (200 with `{ status: "waiting" }`, the page
     polls).
  4. Enforce `max_uses` (`use_count >= max_uses`), and a hard cap of
     **20 concurrent** non-`LEFT`/`KICKED`/`DENIED` guests per call → `call_full`.
  5. Create `call_guest` (`status` = `require_lobby ? 'LOBBY' : 'ADMITTED'`,
     `livekit_identity = 'guest_' || id`), a random session token (return raw,
     store hash), `use_count++`, `call_invite.accepted_at` if via invite.
  6. Broadcast `chat.call.guest_waiting` (lobby) or `chat.call.guest_joined`
     to the call's member `call_participant.user_id`s + a `notificationService`
     in-app notification to the initiator.
  7. Return `{ guestToken, guestId, status, callId, requiresLobby }`.
- `getGuestState({ guestToken })` — resolves the guest, returns
  `{ status, call: { id, kind }, livekitUrl, guests: [{name,status,isYou}],
  messages: [...since?] }`. `status: "KICKED"|"DENIED"` tells the page to stop.
- `getGuestLiveKitToken({ guestToken })` — only when `status = 'ADMITTED'` and
  the call is live. Mints an `AccessToken` identity `livekit_identity`,
  `name = display_name`, `metadata = { guest: true }`, grants
  `{ room, roomJoin: true, canPublish: true, canSubscribe: true,
  canPublishData: true }`, `ttl: "15m"`. `LIVEKIT_API_SECRET` never leaves the
  server.
- `heartbeatGuest({ guestToken })` — bumps `last_seen_at`; used to detect
  abandoned lobby entries (swept after 2 min of no heartbeat while `LOBBY`).
- `leaveGuest({ guestToken })` — `status = 'LEFT'`, `left_at`.
- `listCallGuests({ authUserId, callId })` — member-gated; lobby + admitted +
  recent.
- `admitGuest({ authUserId, callId, guestId })` / `denyGuest(...)` — initiator
  or `channel.manage`. Sets status, `admitted_by_user_id`, broadcasts.
- `kickGuest({ authUserId, callId, guestId })` — status `KICKED`, then
  `RoomServiceClient.removeParticipant(room, livekit_identity)` (best-effort).
- `muteGuest({ authUserId, callId, guestId, muted })` —
  `RoomServiceClient.mutePublishedTrack` on the guest's audio (best-effort;
  guest UI reflects it on next poll).
- `sweepAbandonedGuests()` — `LOBBY` with `last_seen_at < now-2m` → `DENIED`;
  `ADMITTED` with `last_seen_at < now-2m` and call ended → `LEFT`. Runs on the
  existing call expiry sweeper interval.

### 4.3 `call-messages-service.js` — `createCallMessagesService({ prisma, now })`

- `postMemberMessage({ authUserId, callId, body })` — asserts membership of
  the call's conversation; inserts `call_message` (`sender_kind='user'`,
  `sender_name` from profile).
- `postGuestMessage({ guestToken, body })` — resolves guest, requires
  `status='ADMITTED'` + live call; inserts (`sender_kind='guest'`).
- `listMessages({ callId, sinceId?, limit=100 })` — used by both the member
  route (member-gated) and `getGuestState` (guest-gated). Chronological.
- Body validation: trim, 1–4000 chars, reject empty. No attachments, no
  reactions, no threads — plain text only.
- Live delivery: the sender **also** publishes the message over the LiveKit
  data channel (`room.localParticipant.publishData`) so connected clients get
  it instantly; the DB row + poll is the backfill / catch-up path. (Frontend
  concern — the service just persists.)

## 5. Routes

### Host (authenticated, mounted under the existing calls router)

- `GET  /calls/:id/link` → `{ link: {token, code, url, requireLobby, maxUses, expiresAt, useCount} | null }`
- `POST /calls/:id/link` → get-or-create, returns the same shape
- `PATCH /calls/:id/link` `{ requireLobby?, maxUses?, expiresAt? }`
- `DELETE /calls/:id/link` → revoke
- `POST /calls/:id/link/invites` `{ emails: string[] }` → `{ matchedUsers, invited, pendingManual }`
- `GET  /calls/:id/guests` → `{ guests: [...] }`
- `POST /calls/:id/guests/:guestId/admit` | `/deny` | `/kick`
- `POST /calls/:id/guests/:guestId/mute` `{ muted: boolean }`
- `POST /calls/:id/messages` `{ body }` → `{ message }` (member call-room chat)
- `GET  /calls/:id/messages?sinceId=` → `{ messages }`

`:id` here is the **conversation id** for the link routes (a link outlives any
single call) and the **call id** for guest-moderation + messages. To avoid
overloading `:id`, link routes live at `/calls/conversations/:conversationId/link*`
and the rest at `/calls/:callId/...`. Final paths:

```
GET|POST|PATCH|DELETE  /calls/conversations/:conversationId/link
POST                   /calls/conversations/:conversationId/link/invites
GET                    /calls/:callId/guests
POST                   /calls/:callId/guests/:guestId/(admit|deny|kick|mute)
GET|POST               /calls/:callId/messages
```

### Guest (unauthenticated — new sub-router `/calls/guest`, no `authMiddleware`)

- `POST /calls/guest/join` `{ token?, code?, inviteToken?, displayName, email? }`
  → `{ guestToken, guestId, status, callId, requiresLobby }` or
  `{ status: "waiting" }` (no live call yet) or a typed 4xx.
- `GET  /calls/guest/state` — `Authorization: Bearer <guestToken>` (or
  `?gt=` query as fallback for the polling loop) → full state (§4.2).
- `POST /calls/guest/token` → `{ livekitUrl, token }` (ADMITTED only)
- `POST /calls/guest/heartbeat` → `{ ok: true }`
- `POST /calls/guest/messages` `{ body }` → `{ message }`
- `POST /calls/guest/leave` → `{ ok: true }`

Guest token transport: `Authorization: Bearer` preferred; the SDK also allows
it as a param so the poll can run from a plain `fetch`. It is **not** a
Supabase JWT and is accepted **only** by `/calls/guest/*`.

All guest routes: generic error messages, no stack traces, `outcome` logged to
`call_guest_join_attempt` for join.

## 6. Frontend

### 6.1 Host — `apps/desktop/src/modules/atlas.chat/calls/`

- **`CallShareDialog.jsx`** (new) — opened from a new "Compartir" button in
  `CallRoomLayout`'s header (users only, gated by the same initiator/admin
  check the API enforces; the button is simply hidden otherwise, and the API
  is the real gate). Shows: the link + code with copy buttons, a
  `require_lobby` `CheckboxField`, optional expiry (`DateField`) and max-uses
  (`NumberField`), a "Invitar por correo" `TextareaField` (comma/newline
  separated) → calls `POST .../link/invites`, and a Revocar `ConfirmDialog`.
  Uses `@atlas/ui` throughout.
- **`CallGuestRoster.jsx`** (new) — a section rendered inside the call room
  (desktop: below the participant grid or in a slide-over; mobile: a sheet
  from a roster button). Lobby requests with Admitir / Rechazar; admitted
  guests with a mute toggle and Expulsar (`ConfirmDialog`). Polls
  `GET /calls/:callId/guests` every 3 s while the call has any guest or the
  dialog is open; a `chat.call.guest_waiting` toast (via the existing
  `CallsProvider` realtime `on`) prompts opening it.
- **`CallsProvider`** — subscribe to `chat.call.guest_waiting` /
  `chat.call.guest_joined` / `chat.call.guest_left`; surface a toast +
  increment a `pendingGuestCount` exposed on the context.
- **In-call chat panel** — new prop `roomMode` on `CallChatPanel`: when the
  call has guests, `CallRoom` passes `roomMode="call"`, and the panel renders
  a lightweight `CallRoomChat.jsx` (message list + composer bound to
  `/calls/:callId/messages` + LiveKit data channel) **instead of**
  `ChatWindow`. No guests → unchanged (`ChatWindow`, the conversation). A
  one-line notice at the top of call-room mode: "Chat temporal de la llamada —
  no se guarda en la conversación."
- **`CallRoom`** — connect a `RoomEvent.DataReceived` handler that feeds the
  call-room chat; publish member messages over data on send (in addition to
  the POST). Derive `hasGuests` from the guests poll.

### 6.2 Guest — new public route

- `AppEntry.jsx`: add under the existing public `PublicShell` group:
  `<Route path="/p/call/:token" element={<GuestCallScreen />} />` and
  `<Route path="/p/call" element={<GuestCallScreen />} />` (code-entry form).
- **`apps/desktop/src/modules/atlas.chat/calls/guest/GuestCallScreen.jsx`**
  (new, default export, lazy) — three states:
  1. **Gate**: `TextField` display name (required), optional email
     (prefilled + read-only when `?i=` invite token present), a code
     `TextField` when the route is `/p/call` with no `:token`, terms
     checkbox, "Entrar". Calls `POST /calls/guest/join`.
  2. **Lobby**: "Esperando a que te admitan…" spinner; polls
     `GET /calls/guest/state` every 2.5 s; `heartbeat` every 20 s. `DENIED`
     → "El anfitrión no te admitió." `waiting` (no live call) → "La llamada
     aún no ha comenzado."
  3. **Room**: `POST /calls/guest/token` → connect `livekit-client` and render
     **`GuestCallRoom.jsx`** — a trimmed `CallRoomLayout`: participant grid +
     the mic/cam/screen/leave controls (reuse the primitives, no roster / no
     "colgar para todos" / no share), plus `GuestRoomChat.jsx` (same
     component family as `CallRoomChat`, bound to `/calls/guest/messages`).
     `KICKED` on a poll → disconnect + "El anfitrión te sacó de la llamada."
- Force light theme + no app chrome, same pattern as `PublicNoteScreen`.
- Guest token kept in memory only (React state) — **never** `localStorage`
  (a shared/public machine must not leak a call session).
- The guest page pulls `livekit-client` — it is already a dependency of the
  `CallRoom` chunk; ensure the guest chunk can load it (it can, same package).

### 6.3 Shared

- **`CallRoomChat.jsx`** / **`GuestRoomChat.jsx`** — extract a shared
  `RoomChatView.jsx` (message list + composer, plain text, `sender_name` +
  time, "tú" styling) that both wrap with their own transport
  (`useCallRoomMessages(callId)` vs `useGuestRoomMessages()`).
- SDK: `packages/sdk/src/domains/calls.js` gains `link`, `linkInvites`,
  `guests`, `admitGuest`/`denyGuest`/`kickGuest`/`muteGuest`, `messages`,
  and a `guest` sub-object (`join`, `state`, `token`, `heartbeat`,
  `sendMessage`, `leave`) that does **not** attach the user's bearer token.
- Validators: `packages/validators/src/calls.js` (or extend the existing
  call schema file) — `callLinkPatchSchema`, `callInviteSchema`,
  `callGuestJoinSchema`, `callRoomMessageSchema`.

## 7. Permissions

No new RBAC keys. Host-side link + moderation actions are gated in-service by
"is the call initiator OR holds `channel.manage` on the conversation" — the
exact check `call-service.endCall` already uses. Guest routes are gated by the
guest session token alone.

## 8. Security & abuse

- Tokens: `call_link.token` 32 bytes hex; `call_invite.token` 24 bytes;
  guest session token 32 bytes; all compared by hash where stored
  (`call_guest.session_token_hash`) or by unique-indexed random value.
- `code`: 8-char Crockford base32, generated with rejection of a small
  profanity list, unique among non-revoked links.
- Rate-limit: 8 `call/guest/join` attempts per IP / 10 min → 429; every
  attempt writes `call_guest_join_attempt`.
- Concurrency cap: 20 live guests per call.
- Guest LiveKit tokens: 15-min TTL, re-minted only while `ADMITTED` + call
  live; `kick` flips status and calls `removeParticipant`, so a stale token
  cannot rejoin (join checks status).
- Revoke is authoritative: `resolveLinkForJoin` and `getGuestLiveKitToken`
  both re-check `revoked_at` / `expires_at` / `max_uses` every call.
- Guests never receive a Supabase session; guest routes never touch any table
  outside `call_*`.
- `require_lobby` defaults **true**; an open (no-lobby) link is an explicit
  host choice.
- The guest page forces `?i=` invite email to read-only and does not display
  other guests' emails — only display names.
- `call_message` bodies are rendered as plain text (no HTML, no markdown, no
  mention parsing) on both host and guest sides.

## 9. Edge cases

- **Link shared, no call running:** guest reaches Lobby state `waiting`; page
  polls; when a member starts a call the next poll admits them into
  Lobby/Room. No auto-start of a call from a guest hit (v1).
- **Call ends while a guest is in it:** guest poll returns `status` with a
  dead call → `GuestCallRoom` disconnects, "La llamada terminó."
- **Host revokes mid-call:** all that link's guests are kicked on the next
  moderation broadcast / their next poll.
- **Two guests, same invite token:** second one is rejected
  (`accepted_at` already set by a still-active guest); allowed again only if
  the first guest is `LEFT`/`KICKED`.
- **Guest closes tab in Lobby:** `sweepAbandonedGuests` marks `DENIED` after
  2 min without heartbeat.
- **Member with no guests:** in-call panel is exactly today's `ChatWindow` —
  zero behaviour change.
- **`LIVEKIT_MODE=disabled`:** all guest + link routes 501, "Compartir" button
  hidden.
- **SMTP unconfigured:** invites still create rows; UI shows the copyable link
  per email under "pendientes de enviar".
- **Guest name collision:** allowed; `livekit_identity` is `guest_<uuid>` so
  LiveKit never collides; UI shows "(2)" suffix client-side if needed.

## 10. Testing

### Backend (`node --test apps/api/src/routes/calls/__tests__/`)

- `call-links-service.test.js`: get-or-create idempotency; revoke revokes +
  kicks; `sendInvites` splits matched-users vs emailed vs pendingManual;
  `resolveLinkForJoin` typed errors (bad token / code / revoked / expired /
  max_uses).
- `call-guest-service.test.js`: join creates LOBBY vs ADMITTED per
  `require_lobby`; rate-limit at the 9th attempt; concurrency cap at 21st
  guest; `getGuestLiveKitToken` refuses non-ADMITTED and dead calls, and never
  serialises the secret; admit/deny/kick transitions + broadcasts; invite
  token single-active-use; `sweepAbandonedGuests`.
- `call-messages-service.test.js`: member vs guest posting, membership /
  ADMITTED gating, body validation (empty, 4001 chars), `listMessages`
  ordering + `sinceId`.
- Route tests: guest sub-router mounts without `authMiddleware`; host routes
  reject non-initiator/non-admin; 501 when LiveKit disabled.

### Frontend

- Pure helpers unit-tested (`node --test`): code formatter/validator,
  `buildGuestJoinUrl`, guest-state → view reducer (`gate|lobby|room|ended`),
  message list merge (poll + data-channel dedupe by id).
- `pnpm --filter @atlas/desktop build:web` clean; `pnpm lint` clean.
- Manual smoke (documented): host generates link → open `/p/call/:token` in a
  private window → name → lobby → host admits → two-way audio + chat → host
  kicks → guest ejected; code path; invite email path (or copy-link
  fallback); "no guests" path leaves the member panel unchanged; 390 + 1440
  screenshots of the share dialog, roster, and guest room.

## 11. Files

### New — API
- `prisma/migrations/20260906000000_call_guest_access/migration.sql`
- `apps/api/src/routes/calls/call-links-service.js`
- `apps/api/src/routes/calls/call-guest-service.js`
- `apps/api/src/routes/calls/call-messages-service.js`
- `apps/api/src/routes/calls/guest-routes.js` (the unauthenticated sub-router)
- `apps/api/src/routes/calls/__tests__/call-links-service.test.js`
- `apps/api/src/routes/calls/__tests__/call-guest-service.test.js`
- `apps/api/src/routes/calls/__tests__/call-messages-service.test.js`

### Modified — API
- `apps/api/src/routes/calls/index.js` — wire the three services + host routes
  + mount `guest-routes.js`; pass `smtpService`.
- `apps/api/src/routes/calls/call-service.js` — export the role-check helper
  (`assertCanManageCall`) for reuse; call `sweepAbandonedGuests` from
  `startExpirySweeper`.
- `apps/api/src/index.js` — pass `smtpService` into `createCallsRouter`.
- `prisma/schema.prisma` — add the 5 models (real Prisma models, like
  `Call`/`CallParticipant`).
- `packages/sdk/src/domains/calls.js` — new methods + `guest` sub-object.
- `packages/validators/src/*` — new schemas.

### New — Frontend
- `apps/desktop/src/modules/atlas.chat/calls/CallShareDialog.jsx`
- `apps/desktop/src/modules/atlas.chat/calls/CallGuestRoster.jsx`
- `apps/desktop/src/modules/atlas.chat/calls/RoomChatView.jsx` (shared)
- `apps/desktop/src/modules/atlas.chat/calls/CallRoomChat.jsx` (member transport)
- `apps/desktop/src/modules/atlas.chat/calls/hooks/useCallRoomMessages.js`
- `apps/desktop/src/modules/atlas.chat/calls/hooks/useCallGuests.js`
- `apps/desktop/src/modules/atlas.chat/calls/guest/GuestCallScreen.jsx`
- `apps/desktop/src/modules/atlas.chat/calls/guest/GuestCallRoom.jsx`
- `apps/desktop/src/modules/atlas.chat/calls/guest/GuestRoomChat.jsx`
- `apps/desktop/src/modules/atlas.chat/calls/guest/useGuestCall.js`
- `apps/desktop/src/modules/atlas.chat/calls/lib/callLink.js` (pure: code
  format/validate, join URL, state reducer, message merge) + `__tests__/`

### Modified — Frontend
- `apps/desktop/src/app/AppEntry.jsx` — the two `/p/call` routes
- `apps/desktop/src/modules/atlas.chat/calls/CallRoom.jsx` — `hasGuests`,
  data-channel chat, pass `roomMode` + roster
- `apps/desktop/src/modules/atlas.chat/calls/CallRoomLayout.jsx` — "Compartir"
  button, roster entry point, `roomMode` wiring
- `apps/desktop/src/modules/atlas.chat/calls/CallChatPanel.jsx` — `roomMode`
  prop: render `CallRoomChat` vs `ChatWindow`
- `apps/desktop/src/modules/atlas.chat/calls/CallsProvider.jsx` — guest
  realtime events + `pendingGuestCount`

## 12. Rollout / plan split

- **Plan A — API:** migration + schema, `call-links-service`,
  `call-guest-service`, `call-messages-service`, `guest-routes`, wiring in
  `index.js` + `call-service` helper export, SDK + validators, all backend
  tests. Ships behind the existing `LIVEKIT_*` config; no UI yet, verifiable
  by curl + unit tests.
- **Plan B — Host UI:** `CallShareDialog`, `CallGuestRoster`, `RoomChatView` +
  `CallRoomChat`, `roomMode` in the panel, `CallsProvider` events,
  `CallRoom`/`CallRoomLayout` wiring.
- **Plan C — Guest UI:** the `/p/call` routes, `GuestCallScreen`,
  `GuestCallRoom`, `GuestRoomChat`, `useGuestCall`, pure `callLink.js`.

Each plan produces working, testable software: A is curl-usable, B lets a host
create links and moderate (even before the guest page exists — an admitted
guest just can't render yet), C completes the loop.
