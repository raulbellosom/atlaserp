# Realtime v2 — Atlas ERP

**Date:** 2026-06-26
**Status:** Approved

## 1. Problem statement

The current realtime infrastructure has multiple critical bugs and gaps:

1. **Channel name collision in chat**: `subscribeToMessages` and `createPresenceChannel` both create a Supabase channel named `chat:conv:{conversationId}`. Supabase Realtime treats Postgres Changes and Presence as incompatible on the same channel — one silently wins, breaking either messages or typing/presence.
2. **Notification bell polling only**: `NotificationBell` polls every 60 seconds (`refetchInterval: 60000`). New notifications are invisible to the user for up to a minute.
3. **Conversation list misses new conversations**: `subscribeToConversationList` only listens to `UPDATE` events. When another user creates a direct chat, the recipient never sees it in realtime.
4. **No global online presence**: `useChatPresence` only tracks who is online in the currently-open conversation. There is no app-wide "user is online" signal.
5. **No reusable realtime pattern**: Projects, Calendar, and any future module each invent their own polling or ad-hoc subscriptions. There is no shared infrastructure.
6. **RLS not set up for Postgres Changes**: Supabase Realtime requires RLS to be enabled on tables for the anon key to receive `postgres_changes` events. The `chat_messages` and `Notification` tables do not have RLS policies configured, so Postgres Changes subscriptions silently receive no rows.

## 2. Goals

- Chat messages reach all conversation members in < 500 ms (no 5 s polling).
- Notification bell badge updates immediately when a new notification is written to the DB.
- New conversations appear in the conversation list without a page refresh.
- Any user with the app open is shown as "online" to coworkers in the same company.
- "Last seen X ago" is available for users who have gone offline.
- Typing indicators and per-conversation presence work correctly (existing behavior, now unbroken).
- Projects task mutations broadcast to other viewers of the same project in realtime.
- Future modules can opt into realtime with ~5 lines of code per event type.

## 3. Non-goals

- Mobile push (APNS/FCM). Web push is already built.
- Realtime collaborative editing / operational transforms.
- Presence for external chat guests (separate guest channel system).
- Changing RLS policies on existing tables (avoided by the broadcast-first approach below).

## 4. Architecture

### 4.1 Broadcast-first over Postgres Changes

Rather than relying on Supabase Postgres Changes (which requires per-table RLS policies and per-user row filters), the API will **broadcast events via HTTP after every relevant write**. The frontend subscribes to these broadcasts and invalidates TanStack Query caches.

Postgres Changes is kept only as a supplementary fallback for in-conversation message streaming (where the filter is already by `conversation_id`, not per-user), and only when the channel naming fix is applied.

This approach:
- Avoids RLS migration risk.
- Makes realtime behavior explicit, auditable, and testable.
- Works regardless of whether the Supabase Realtime server has RLS policies configured.
- Keeps server-side code simple: one HTTP POST per event, no persistent WebSocket on the API.

### 4.2 Server-side broadcast via REST

Supabase Realtime v2 exposes a REST broadcast endpoint:

```
POST {SUPABASE_URL}/realtime/v1/api/broadcast
Authorization: Bearer {SERVICE_ROLE_KEY}
apikey: {SERVICE_ROLE_KEY}
Content-Type: application/json

{
  "messages": [{
    "topic": "realtime:user:{profileId}:events",
    "event": "notification.new",
    "payload": { ... }
  }]
}
```

The API uses this endpoint (plain `fetch`) — no WebSocket, no persistent connection on the server side.

### 4.3 Channel naming convention

| Channel name | Supabase type | Who uses it | Scope |
|---|---|---|---|
| `user:{profileId}:events` | Broadcast | RealtimeProvider | Per logged-in user |
| `company:{companyId}:presence` | Presence | RealtimeProvider | All users in the company |
| `chat:messages:{conversationId}` | Postgres Changes | useChatMessages | Conversation viewers |
| `chat:presence:{conversationId}` | Presence + Broadcast | useChatPresence | Conversation participants |
| `projects:events:{profileId}` | Broadcast | useProjectRealtime | Project members |

### 4.4 Component overview

```
AppEntry.jsx
└── AuthProvider
    └── PersistQueryClientProvider
        └── RealtimeProvider          ← NEW (wraps AtlasApp)
            └── AtlasApp
                ├── Topbar → NotificationBell (reacts to invalidation)
                ├── FloatingChatHub (reacts to invalidation)
                └── module screens
                    ├── useChatMessages  (channel: chat:messages:{id})
                    ├── useChatPresence  (channel: chat:presence:{id})
                    └── useProjectRealtime (listens via on())
```

---

## 5. Backend: RealtimeBroadcaster

**New file:** `apps/api/src/services/realtime-broadcaster.js`

```js
export function createRealtimeBroadcaster({ supabaseUrl, serviceRoleKey }) {
  const endpoint = `${supabaseUrl}/realtime/v1/api/broadcast`

  async function send(messages) { /* fetch POST */ }

  async function broadcastToUser(profileId, event, payload) {
    return send([{ topic: `realtime:user:${profileId}:events`, event, payload }])
  }

  async function broadcastToUsers(profileIds, event, payload) {
    if (!profileIds.length) return
    return send(profileIds.map(id => ({
      topic: `realtime:user:${id}:events`, event, payload
    })))
  }

  return { broadcastToUser, broadcastToUsers }
}
```

Errors from the broadcast endpoint are caught and logged but never thrown — the write already succeeded.

**Wired in `apps/api/src/index.js`:**
```js
const broadcaster = createRealtimeBroadcaster({
  supabaseUrl: process.env.SUPABASE_URL,
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
})
```

---

## 6. Backend: notification-service changes

`createNotificationService({ prisma })` gains an optional `broadcaster` parameter:

```js
export function createNotificationService({ prisma, broadcaster = null }) {
  // ... existing code ...
  async function publish(...) {
    // ... existing create logic ...
    // After successful transaction:
    if (broadcaster) {
      const ids = result.created.map(n => n.userId)
      await broadcaster.broadcastToUsers(ids, 'notification.new', {
        notificationId: result.created[0]?.id,
        eventType: parsed.eventType,
        title: parsed.title,
        body: parsed.body ?? null,
        priority: parsed.priority,
        link: parsed.link ?? null,
      }).catch(() => {})
    }
    return { ... }
  }
}
```

---

## 7. Backend: chat-service changes

`createChatService({ prisma, supabaseAdmin, notificationService, broadcaster })` gains `broadcaster`:

After `sendMessage` succeeds:
```js
if (broadcaster) {
  const memberIds = /* query members' userId list */
  await broadcaster.broadcastToUsers(memberIds, 'chat.message.new', {
    conversationId,
    messageId: msg.id,
    senderName: fullMsg?.sender?.displayName ?? null,
  }).catch(() => {})
}
```

After `createConversation` succeeds:
```js
if (broadcaster) {
  await broadcaster.broadcastToUsers(allMembers, 'chat.conversation.new', {
    conversationId: conv.id,
  }).catch(() => {})
}
```

---

## 8. Frontend: RealtimeProvider

**New file:** `apps/desktop/src/providers/RealtimeProvider.jsx`

Responsibilities:
1. Open channel `user:{profileId}:events` (Broadcast) when user is authenticated.
2. Open channel `company:{companyId}:presence` (Presence) when company is known.
3. On each broadcast event, dispatch to registered listeners (event bus) and/or invalidate queries directly.
4. Track global presence state.
5. Clean up channels on logout.

```jsx
const RealtimeContext = createContext(null)

export function RealtimeProvider({ children }) {
  const { userProfile, session } = useAuth()
  const queryClient = useQueryClient()
  const listenersRef = useRef({})   // { [event]: Set<handler> }

  // on(event, handler) — returns unsub function
  function on(event, handler) {
    if (!listenersRef.current[event]) listenersRef.current[event] = new Set()
    listenersRef.current[event].add(handler)
    return () => listenersRef.current[event]?.delete(handler)
  }

  function dispatch(event, payload) {
    listenersRef.current[event]?.forEach(h => h(payload))
  }

  // User events channel
  useEffect(() => {
    if (!userProfile?.id || !session) return
    const client = getSupabaseClient()
    const channel = client
      .channel(`user:${userProfile.id}:events`)
      .on('broadcast', { event: 'notification.new' }, ({ payload }) => {
        queryClient.invalidateQueries({ queryKey: ['notifications'] })
        dispatch('notification.new', payload)
      })
      .on('broadcast', { event: 'chat.message.new' }, ({ payload }) => {
        queryClient.invalidateQueries({ queryKey: ['chat-conversations'] })
        dispatch('chat.message.new', payload)
      })
      .on('broadcast', { event: 'chat.conversation.new' }, ({ payload }) => {
        queryClient.invalidateQueries({ queryKey: ['chat-conversations'] })
        dispatch('chat.conversation.new', payload)
      })
      .subscribe()
    return () => { client.removeChannel(channel) }
  }, [userProfile?.id, session, queryClient])

  // Company presence channel
  const [onlineUsers, setOnlineUsers] = useState({})
  const [lastSeenMap, setLastSeenMap] = useState({})

  useEffect(() => {
    if (!userProfile?.id || !userProfile?.companyId) return
    const client = getSupabaseClient()
    const channel = client
      .channel(`company:${userProfile.companyId}:presence`, {
        config: { presence: { key: userProfile.id } },
      })
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        const online = {}
        Object.entries(state).forEach(([key, presences]) => {
          const p = presences[0]
          if (p?.userId) online[p.userId] = p
        })
        setOnlineUsers(online)
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        leftPresences.forEach(p => {
          if (p?.userId) {
            setLastSeenMap(prev => ({ ...prev, [p.userId]: new Date() }))
          }
        })
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            userId: userProfile.id,
            displayName: userProfile.displayName ?? userProfile.email,
            status: 'online',
          })
        }
      })
    return () => { client.removeChannel(channel) }
  }, [userProfile?.id, userProfile?.companyId, userProfile?.displayName])

  const value = useMemo(() => ({
    on,
    onlineUsers,
    lastSeenMap,
    isUserOnline: (id) => Boolean(onlineUsers[id]),
    getLastSeen: (id) => lastSeenMap[id] ?? null,
  }), [onlineUsers, lastSeenMap])

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>
}

export function useRealtimeContext() {
  return useContext(RealtimeContext)
}
```

`RealtimeProvider` is inserted in `AppEntry.jsx` **inside** `AuthProvider` and `PersistQueryClientProvider`, wrapping `AtlasApp`.

---

## 9. Frontend: chat hooks fixes

### supabaseRealtime.js — channel naming

```js
// BEFORE (collision):
client.channel(`chat:conv:${conversationId}`)   // used by both

// AFTER:
client.channel(`chat:messages:${conversationId}`) // postgres changes only
client.channel(`chat:presence:${conversationId}`) // presence + typing only
```

### useChatMessages.js

Add a listener to broadcast events for messages the current user does NOT send (broadcast reaches all members):

```js
const { on } = useRealtimeContext()
useEffect(() => {
  return on('chat.message.new', ({ conversationId: cid }) => {
    if (cid === conversationId) {
      queryClient.invalidateQueries({ queryKey: ['chat-messages', conversationId] })
    }
  })
}, [conversationId])
```

Keep the existing Postgres Changes subscription as a secondary fallback. Remove the 5 s polling fallback (`refetchInterval: false`) since broadcast now handles updates.

### useChatConversations.js

Replace `subscribeToConversationList` (UPDATE-only) with broadcast listener:

```js
const { on } = useRealtimeContext()
useEffect(() => {
  const unsub1 = on('chat.conversation.new', () => {
    queryClient.invalidateQueries({ queryKey: ['chat-conversations'] })
  })
  const unsub2 = on('chat.message.new', () => {
    queryClient.invalidateQueries({ queryKey: ['chat-conversations'] })
  })
  return () => { unsub1(); unsub2() }
}, [queryClient])
```

Remove the Supabase Postgres Changes subscription for conversations entirely.

### useChatPresence.js

- Change channel name to `chat:presence:{conversationId}`.
- Expose `onlineUsers` from both the per-conversation presence AND the global `useRealtimeContext().onlineUsers` — merge them so a member is shown online if they're anywhere in the app (not only if they're viewing the same conversation).

```js
const { isUserOnline } = useRealtimeContext()

// In component: a member is online if present in conversation OR globally online
const isOnline = (userId) => conversationOnlineUsers[userId] || isUserOnline(userId)
```

---

## 10. Frontend: NotificationBell changes

- Change `refetchInterval` from `60000` to `300000` (5 min — true backup only).
- The query key changes from `['notifications', token]` to `['notifications']` so `RealtimeProvider` can invalidate it without holding a reference to the token.

---

## 11. Frontend: Global presence display

New export `useGlobalPresence()` in `RealtimeProvider.jsx`:

```js
export function useGlobalPresence() {
  const { onlineUsers, lastSeenMap, isUserOnline, getLastSeen } = useRealtimeContext()
  return { onlineUsers, lastSeenMap, isUserOnline, getLastSeen }
}
```

Display in chat:
- Conversation list: green dot on avatar if `isUserOnline(memberId)`.
- Conversation header: "En línea" / "Visto hace X".
- User picker / member list: same dot pattern.

---

## 12. Frontend: Projects realtime

**New file:** `apps/desktop/src/modules/atlas.projects/hooks/useProjectRealtime.js`

```js
export function useProjectRealtime(projectId) {
  const { on } = useRealtimeContext()
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!projectId) return
    return on('projects.task.updated', ({ projectId: pid }) => {
      if (pid === projectId) {
        queryClient.invalidateQueries({ queryKey: ['project-tasks', projectId] })
        queryClient.invalidateQueries({ queryKey: ['project-detail', projectId] })
      }
    })
  }, [projectId, queryClient])
}
```

**API changes** in task create/update/delete routes: after the DB write, call:
```js
await broadcaster.broadcastToUsers(memberIds, 'projects.task.updated', { projectId, taskId, action })
```

---

## 13. Generic module pattern (documentation)

Any future module that needs realtime:

**API side** — add to the route handler after the DB write:
```js
await broadcaster.broadcastToUsers(recipientIds, 'mymodule.entity.updated', { entityId })
```

**Frontend side** — in a hook:
```js
const { on } = useRealtimeContext()
useEffect(() => {
  return on('mymodule.entity.updated', ({ entityId: eid }) => {
    if (eid === entityId) {
      queryClient.invalidateQueries({ queryKey: ['mymodule', entityId] })
    }
  })
}, [entityId])
```

No new Supabase channels, no new WebSocket connections. The `user:{profileId}:events` channel handles all per-user events.

---

## 14. Files changed

### New files
| File | Purpose |
|---|---|
| `apps/api/src/services/realtime-broadcaster.js` | REST broadcast wrapper |
| `apps/desktop/src/providers/RealtimeProvider.jsx` | Global realtime context |
| `apps/desktop/src/modules/atlas.projects/hooks/useProjectRealtime.js` | Projects realtime hook |

### Modified files
| File | Change |
|---|---|
| `apps/api/src/index.js` | Create broadcaster, pass to notification-service and chat-service |
| `apps/api/src/services/notification-service.js` | Accept broadcaster, broadcast after publish |
| `apps/api/src/routes/chat/chat-service.js` | Accept broadcaster, broadcast after sendMessage / createConversation |
| `apps/desktop/src/app/AppEntry.jsx` | Wrap AtlasApp with RealtimeProvider |
| `apps/desktop/src/modules/atlas.chat/lib/supabaseRealtime.js` | Fix channel names (messages vs presence) |
| `apps/desktop/src/modules/atlas.chat/hooks/useChatMessages.js` | Add broadcast listener, remove 5 s polling |
| `apps/desktop/src/modules/atlas.chat/hooks/useChatConversations.js` | Replace Postgres Changes with broadcast listener |
| `apps/desktop/src/modules/atlas.chat/hooks/useChatPresence.js` | Fix channel name, integrate global presence |
| `apps/desktop/src/components/NotificationBell.jsx` | Change query key, reduce polling to 5 min |
| `apps/desktop/src/modules/atlas.projects/*` | Wire useProjectRealtime into task screens |

---

## 15. Environment variables required

No new env vars. The broadcaster uses existing `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from `process.env`.

Supabase self-hosted requirement: the Realtime service must be running (it is — Supabase is already in use) and the broadcast endpoint at `{SUPABASE_URL}/realtime/v1/api/broadcast` must be reachable from the API server.

---

## 16. Rollout notes

- No DB migrations required.
- No RLS changes required.
- The `user:{profileId}:events` channel is private to each browser session — the service role key authorizes the server-side broadcast; the anon key is sufficient to subscribe on the client side.
- Existing polling (`refetchOnWindowFocus`, `staleTime`) is preserved as a backstop. Broadcast failures degrade gracefully to the existing polling behavior.
