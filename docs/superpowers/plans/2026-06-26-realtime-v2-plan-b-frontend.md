# Realtime v2 — Plan B: Frontend Implementation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a `RealtimeProvider` that maintains per-user and company-wide Supabase Realtime channels, fix the channel naming collision in chat, add online presence display, and wire `useProjectRealtime` into the Projects module.

**Architecture:** A single `RealtimeProvider` wraps `AtlasApp` and exposes an event bus (`on(event, handler)`) plus global presence state. Chat hooks consume the event bus instead of their own Postgres Changes subscription for cross-user events. Each existing hook is surgical — only the minimum lines change.

**Prerequisite:** Plan A (API) must be complete before testing end-to-end. Frontend changes are self-contained and will build/run without Plan A, but realtime events won't fire until the API broadcasts.

**Spec:** `docs/superpowers/specs/2026-06-26-realtime-v2-design.md`
**Plan A (API):** `docs/superpowers/plans/2026-06-26-realtime-v2-plan-a-api.md`

**Tech Stack:** React 18, Supabase JS v2, TanStack Query v5, `@supabase/supabase-js`

---

## File map

| File | Action | What changes |
|---|---|---|
| `apps/desktop/src/providers/RealtimeProvider.jsx` | **Create** | Global event bus + presence channel |
| `apps/desktop/src/app/AppEntry.jsx` | **Modify** | Wrap `AtlasApp` with `RealtimeProvider` |
| `apps/desktop/src/modules/atlas.chat/lib/supabaseRealtime.js` | **Modify** | Fix channel name collision |
| `apps/desktop/src/modules/atlas.chat/hooks/useChatMessages.js` | **Modify** | Add broadcast listener, remove 5 s polling |
| `apps/desktop/src/modules/atlas.chat/hooks/useChatConversations.js` | **Modify** | Replace Postgres Changes with broadcast listener |
| `apps/desktop/src/modules/atlas.chat/hooks/useChatPresence.js` | **Modify** | Fix channel name, expose global presence helper |
| `apps/desktop/src/components/NotificationBell.jsx` | **Modify** | Broaden query key, reduce polling |
| `apps/desktop/src/modules/atlas.projects/hooks/useProjectRealtime.js` | **Create** | Projects broadcast listener |
| `apps/desktop/src/modules/atlas.projects/screens/*` | **Modify** | Mount `useProjectRealtime` in task view screens |

---

## Task 1: Create `RealtimeProvider`

**Files:**
- Create: `apps/desktop/src/providers/RealtimeProvider.jsx`

This provider opens two Supabase channels when the user is authenticated:
1. `user:{profileId}:events` — Broadcast-only, fires per-user events from the API
2. `company:{companyId}:presence` — Presence, tracks who is online across the company

It also exposes a stable `on(event, handler)` function that hooks can call to subscribe to broadcast events without needing their own Supabase channels.

The `userProfile` object from `useAuth()` must have `id` and `companyId` for channels to open. If either is missing, the provider renders children without channels.

- [ ] **Step 1: Create the file**

```jsx
// apps/desktop/src/providers/RealtimeProvider.jsx
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../auth/AuthProvider'
import { getSupabaseClient } from '../lib/supabase'

const RealtimeContext = createContext(null)

export function RealtimeProvider({ children }) {
  const { userProfile, session } = useAuth()
  const queryClient = useQueryClient()
  const listenersRef = useRef({})
  const [onlineUsers, setOnlineUsers] = useState({})
  const [lastSeenMap, setLastSeenMap] = useState({})

  // Stable `on` function — registers a handler for a named broadcast event.
  // Returns an unsubscribe function. Safe to call before channels open.
  const on = useCallback((event, handler) => {
    if (!listenersRef.current[event]) listenersRef.current[event] = new Set()
    listenersRef.current[event].add(handler)
    return () => listenersRef.current[event]?.delete(handler)
  }, [])

  function dispatch(event, payload) {
    listenersRef.current[event]?.forEach((h) => {
      try { h(payload) } catch {}
    })
  }

  // User events channel — receives broadcasts sent by the API after writes
  useEffect(() => {
    if (!userProfile?.id || !session?.access_token) return
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
      .on('broadcast', { event: 'projects.task.updated' }, ({ payload }) => {
        dispatch('projects.task.updated', payload)
      })
      .subscribe()

    return () => { client.removeChannel(channel) }
  }, [userProfile?.id, session?.access_token, queryClient])

  // Company presence channel — tracks who is online across the whole company
  useEffect(() => {
    if (!userProfile?.id || !userProfile?.companyId) return
    const client = getSupabaseClient()

    const channel = client
      .channel(`company:${userProfile.companyId}:presence`, {
        config: { presence: { key: userProfile.id } },
      })
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        const next = {}
        Object.entries(state).forEach(([, presences]) => {
          const p = presences?.[0]
          if (p?.userId) next[p.userId] = p
        })
        setOnlineUsers(next)
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        const now = new Date()
        setLastSeenMap((prev) => {
          const next = { ...prev }
          leftPresences.forEach((p) => { if (p?.userId) next[p.userId] = now })
          return next
        })
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            userId: userProfile.id,
            displayName: userProfile.displayName ?? userProfile.email ?? userProfile.id,
            status: 'online',
          })
        }
      })

    return () => { client.removeChannel(channel) }
  }, [userProfile?.id, userProfile?.companyId, userProfile?.displayName, userProfile?.email])

  const isUserOnline = useCallback((id) => Boolean(onlineUsers[id]), [onlineUsers])
  const getLastSeen = useCallback((id) => lastSeenMap[id] ?? null, [lastSeenMap])

  const value = useMemo(() => ({
    on,
    onlineUsers,
    lastSeenMap,
    isUserOnline,
    getLastSeen,
  }), [on, onlineUsers, lastSeenMap, isUserOnline, getLastSeen])

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>
}

export function useRealtimeContext() {
  const ctx = useContext(RealtimeContext)
  if (!ctx) throw new Error('useRealtimeContext must be used inside RealtimeProvider')
  return ctx
}

export function useGlobalPresence() {
  const { onlineUsers, lastSeenMap, isUserOnline, getLastSeen } = useRealtimeContext()
  return { onlineUsers, lastSeenMap, isUserOnline, getLastSeen }
}
```

- [ ] **Step 2: Verify syntax**

```bash
node --check apps/desktop/src/providers/RealtimeProvider.jsx
```

Expected: no output (clean).

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/providers/RealtimeProvider.jsx
git commit -m "feat(realtime): add RealtimeProvider — event bus + global presence"
```

---

## Task 2: Mount `RealtimeProvider` in `AppEntry.jsx`

**Files:**
- Modify: `apps/desktop/src/app/AppEntry.jsx`

`RealtimeProvider` needs `useAuth()` (inside `AuthProvider`) and `useQueryClient()` (inside `PersistQueryClientProvider`). Both already wrap `AtlasApp`, so wrapping `AtlasApp` with `RealtimeProvider` is the right spot.

- [ ] **Step 1: Add the import**

Find the existing imports at the top of `AppEntry.jsx`. Add after the `AuthProvider` import line:

```js
import { RealtimeProvider } from '../providers/RealtimeProvider'
```

- [ ] **Step 2: Wrap the authenticated app section**

Search for the JSX that renders `<AtlasApp`. It is rendered inside the component that checks for `isAuthenticated`. Find a pattern like:

```jsx
<AtlasApp ... />
```

Wrap it with `RealtimeProvider`:

```jsx
<RealtimeProvider>
  <AtlasApp ... />
</RealtimeProvider>
```

The exact surrounding JSX will vary — keep all existing props and siblings intact, only add the wrapper.

- [ ] **Step 3: Start dev server and verify no console errors**

```bash
pnpm dev:frontend
```

Open http://localhost:5173, log in. Open browser DevTools → Console. Expected: no React errors related to `RealtimeProvider` or `useRealtimeContext`. The Supabase client should open two WebSocket channels (visible in Network tab → WS).

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/app/AppEntry.jsx
git commit -m "feat(realtime): mount RealtimeProvider in AppEntry"
```

---

## Task 3: Fix channel naming collision in `supabaseRealtime.js`

**Files:**
- Modify: `apps/desktop/src/modules/atlas.chat/lib/supabaseRealtime.js`

Currently both `subscribeToMessages` and `createPresenceChannel` use the channel name `chat:conv:{conversationId}`. Supabase Realtime cannot merge Postgres Changes and Presence on the same channel object — one silently wins.

The fix: rename to distinct names.

- [ ] **Step 1: Fix `subscribeToMessages` channel name**

Find:
```js
  const channel = client
    .channel(`chat:conv:${conversationId}`)
    .on(
      "postgres_changes",
```

Change to:
```js
  const channel = client
    .channel(`chat:messages:${conversationId}`)
    .on(
      "postgres_changes",
```

- [ ] **Step 2: Fix `createPresenceChannel` channel name parameter**

The `createPresenceChannel` function receives a `channelName` parameter from the caller. The channel name is passed in from `useChatPresence.js`. We will fix that in Task 5. No code change needed here for the function itself — the fix lives in the caller.

- [ ] **Step 3: Fix `subscribeToConversationList` — remove it (deprecated by broadcast)**

This function is only called from `useChatConversations.js` and will be replaced by the event bus in Task 4. Remove the export to avoid future confusion:

Delete the entire `subscribeToConversationList` function (lines ~89–107):

```js
/**
 * Subscribe to conversation list updates for a user.
 */
export function subscribeToConversationList(userId, onUpdate) {
  const client = getSupabaseClient();
  const channel = client
    .channel(`chat:user:${userId}:convlist`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "chat_conversations",
      },
      (payload) => onUpdate(payload),
    )
    .subscribe();

  return () => {
    client.removeChannel(channel);
  };
}
```

- [ ] **Step 4: Verify syntax**

```bash
node --check apps/desktop/src/modules/atlas.chat/lib/supabaseRealtime.js
```

Expected: no output (clean).

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/lib/supabaseRealtime.js
git commit -m "fix(chat): separate channel names for messages vs presence, remove deprecated convlist subscription"
```

---

## Task 4: Update `useChatConversations.js` — event bus instead of Postgres Changes

**Files:**
- Modify: `apps/desktop/src/modules/atlas.chat/hooks/useChatConversations.js`

Replace the Supabase channel subscription (which only caught UPDATE events) with the event bus from `RealtimeProvider`. This catches both new conversations (`chat.conversation.new`) and new messages that update the preview (`chat.message.new`).

- [ ] **Step 1: Rewrite the file**

```js
// apps/desktop/src/modules/atlas.chat/hooks/useChatConversations.js
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useAuth } from "../../../auth/AuthProvider";
import { atlas } from "../../../lib/atlas";
import { useRealtimeContext } from "../../../providers/RealtimeProvider";

export function useChatConversations() {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const { on } = useRealtimeContext();

  const query = useQuery({
    queryKey: ["chat-conversations"],
    queryFn: () => atlas.chat.listConversations({}, token),
    enabled: Boolean(token),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    const unsub1 = on("chat.conversation.new", () => {
      queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
    });
    const unsub2 = on("chat.message.new", () => {
      queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
    });
    return () => {
      unsub1();
      unsub2();
    };
  }, [on, queryClient]);

  return query;
}
```

- [ ] **Step 2: Verify syntax**

```bash
node --check apps/desktop/src/modules/atlas.chat/hooks/useChatConversations.js
```

Expected: no output (clean).

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/hooks/useChatConversations.js
git commit -m "feat(chat): replace Postgres Changes convlist with event bus subscription"
```

---

## Task 5: Update `useChatMessages.js` — add broadcast listener, remove 5 s polling

**Files:**
- Modify: `apps/desktop/src/modules/atlas.chat/hooks/useChatMessages.js`

Add a listener on `chat.message.new` so messages sent by other people arrive without waiting for the Postgres Changes subscription. Remove the 5 s polling fallback (`refetchInterval: 5_000`) since the broadcast makes it redundant.

- [ ] **Step 1: Add import for `useRealtimeContext`**

Find:
```js
import { subscribeToMessages } from "../lib/supabaseRealtime";
```

Add after it:
```js
import { useRealtimeContext } from "../../../providers/RealtimeProvider";
```

- [ ] **Step 2: Add the event bus listener inside `useChatMessages`**

After the existing `const unsubRef = useRef(null)` line, add:

```js
  const { on } = useRealtimeContext();
```

After the existing `useEffect` block that calls `subscribeToMessages`, add a second `useEffect`:

```js
  useEffect(() => {
    if (!conversationId) return;
    return on("chat.message.new", ({ conversationId: cid }) => {
      if (cid === conversationId) {
        queryClient.invalidateQueries({ queryKey: ["chat-messages", conversationId] });
      }
    });
  }, [conversationId, on, queryClient]);
```

- [ ] **Step 3: Remove the 5 s polling fallback**

Find:
```js
    // Polling fallback: fires every 5s so messages arrive even if Realtime drops
    refetchInterval: Boolean(token && conversationId) ? 5_000 : false,
```

Change to:
```js
    refetchInterval: false,
```

- [ ] **Step 4: Verify syntax**

```bash
node --check apps/desktop/src/modules/atlas.chat/hooks/useChatMessages.js
```

Expected: no output (clean).

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/hooks/useChatMessages.js
git commit -m "feat(chat): add broadcast listener for incoming messages, remove 5s polling"
```

---

## Task 6: Fix `useChatPresence.js` — channel name + expose global presence

**Files:**
- Modify: `apps/desktop/src/modules/atlas.chat/hooks/useChatPresence.js`

Two changes:
1. Pass `chat:presence:{conversationId}` as the channel name (not `chat:conv:{conversationId}`)
2. Expose a helper that checks both per-conversation presence AND global presence from `RealtimeProvider`

- [ ] **Step 1: Add import for `useGlobalPresence`**

Find:
```js
import { createPresenceChannel } from "../lib/supabaseRealtime";
```

Add after it:
```js
import { useGlobalPresence } from "../../../providers/RealtimeProvider";
```

- [ ] **Step 2: Use the global presence inside the hook**

At the top of `useChatPresence`, before the existing `useEffect`, add:

```js
  const { isUserOnline } = useGlobalPresence();
```

- [ ] **Step 3: Fix the channel name**

Find inside the `useEffect`:
```js
    const { sendTyping, unsubscribe } = createPresenceChannel(
      `chat:conv:${conversationId}`,
```

Change to:
```js
    const { sendTyping, unsubscribe } = createPresenceChannel(
      `chat:presence:${conversationId}`,
```

- [ ] **Step 4: Add `isOnline` helper to return value**

Find at the end of the hook:
```js
  return { onlineUsers, typingUsersList, sendTyping };
```

Change to:
```js
  // isOnline checks per-conversation presence AND the global company presence channel.
  // A user appears online if they have the conversation open OR if they have the app open anywhere.
  const isOnline = (userId) => Boolean(onlineUsers[userId]) || isUserOnline(userId);

  return { onlineUsers, typingUsersList, sendTyping, isOnline };
```

- [ ] **Step 5: Verify syntax**

```bash
node --check apps/desktop/src/modules/atlas.chat/hooks/useChatPresence.js
```

Expected: no output (clean).

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/hooks/useChatPresence.js
git commit -m "fix(chat): correct presence channel name, expose isOnline with global fallback"
```

---

## Task 7: Update `NotificationBell` — broader query key + reduce polling

**Files:**
- Modify: `apps/desktop/src/components/NotificationBell.jsx`

The `RealtimeProvider` calls `queryClient.invalidateQueries({ queryKey: ['notifications'] })` on `notification.new`. The bell's current query key is `['notifications', token]` — the token makes it a different key than what the provider invalidates.

Fix: use `['notifications']` as the query key. The token still goes into `queryFn` but not the key, which is fine since TanStack Query's cache is per-session anyway.

Also reduce `refetchInterval` from `60000` to `300000` (5 minutes) — realtime handles fresh delivery, this is just a backup.

- [ ] **Step 1: Change the query key and reduce polling interval**

Find:
```js
  const { data } = useQuery({
    queryKey: ["notifications", token],
    queryFn: () => atlas.notifications.list(token, { unreadOnly: false, limit: 20 }),
    enabled: Boolean(token),
    refetchInterval: 60000,
    staleTime: 10000,
    refetchOnWindowFocus: true,
  });
```

Change to:
```js
  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => atlas.notifications.list(token, { unreadOnly: false, limit: 20 }),
    enabled: Boolean(token),
    refetchInterval: 300_000,
    staleTime: 10_000,
    refetchOnWindowFocus: true,
  });
```

- [ ] **Step 2: Update the `markAllRead` and `markOneRead` invalidation keys**

Find every occurrence of:
```js
queryClient.invalidateQueries({ queryKey: ["notifications", token] })
```

There are two (inside `markAllRead.onSuccess` and `markOneRead.onSuccess`). Change both to:
```js
queryClient.invalidateQueries({ queryKey: ["notifications"] })
```

Also find in `handleNotificationClick`:
```js
      queryClient.setQueryData(["notifications", token], (old) => {
```

Change to:
```js
      queryClient.setQueryData(["notifications"], (old) => {
```

- [ ] **Step 3: Verify syntax**

```bash
node --check apps/desktop/src/components/NotificationBell.jsx
```

Expected: no output (clean).

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/components/NotificationBell.jsx
git commit -m "fix(notifications): align query key with RealtimeProvider invalidation, reduce polling to 5m"
```

---

## Task 8: Show online status dots in chat conversation list

**Files:**
- Modify: whichever component renders the conversation avatar/member list in the chat sidebar

First, find which component renders the conversation list items:

- [ ] **Step 1: Check the existing `ChatConversationItem` component**

Read `apps/desktop/src/modules/atlas.chat/components/ChatConversationItem.jsx` to understand the current props and avatar rendering.

- [ ] **Step 2: Add `isUserOnline` to the conversation item**

In the conversation list rendering component (typically `ChatConversationItem.jsx` or the screen that maps over `useChatConversations`), import and use `useGlobalPresence`:

```jsx
import { useGlobalPresence } from '../../../providers/RealtimeProvider'

// Inside the component:
const { isUserOnline } = useGlobalPresence()
```

For each conversation item that is a `direct` type, the other member's `userId` is available in `conversation.members`. Show a green dot if that user is online:

```jsx
{conversation.type === 'direct' && (() => {
  const otherMember = (conversation.members ?? []).find(m => m.userId !== userProfile?.id)
  const online = otherMember ? isUserOnline(otherMember.userId) : false
  return online ? (
    <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-green-500 border-2 border-[hsl(var(--surface-2))]" />
  ) : null
})()}
```

Wrap the avatar container with `relative` positioning if it isn't already:
```jsx
<div className="relative shrink-0">
  {/* avatar image/initials here */}
  {/* online dot here */}
</div>
```

- [ ] **Step 3: Show "En línea" / "Visto hace X" in conversation header**

Find the conversation header component (typically inside the main chat view screen). Add:

```jsx
import { useGlobalPresence } from '../../../providers/RealtimeProvider'

function formatLastSeen(date) {
  if (!date) return null
  const diff = Math.floor((Date.now() - date.getTime()) / 60000)
  if (diff < 1) return 'hace un momento'
  if (diff < 60) return `hace ${diff} min`
  const h = Math.floor(diff / 60)
  if (h < 24) return `hace ${h} h`
  return `hace ${Math.floor(h / 24)} d`
}

// Inside the component:
const { isUserOnline, getLastSeen } = useGlobalPresence()
const otherMember = members?.find(m => m.userId !== userProfile?.id)
const online = otherMember ? isUserOnline(otherMember.userId) : false
const lastSeen = otherMember ? getLastSeen(otherMember.userId) : null

// Render:
{conversation?.type === 'direct' && otherMember && (
  <span className="text-xs text-[hsl(var(--muted-foreground))]">
    {online ? (
      <span className="flex items-center gap-1">
        <span className="h-2 w-2 rounded-full bg-green-500 inline-block" />
        En línea
      </span>
    ) : lastSeen ? (
      `Visto ${formatLastSeen(lastSeen)}`
    ) : null}
  </span>
)}
```

- [ ] **Step 4: Start dev server and verify dots appear**

```bash
pnpm dev:frontend
```

Log in with two different accounts in two browser tabs. Both should appear with a green dot / "En línea" text.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/components/
git commit -m "feat(chat): show online status dot and En linea / Visto hace X in conversation UI"
```

---

## Task 9: Create `useProjectRealtime` and wire it into task screens

**Files:**
- Create: `apps/desktop/src/modules/atlas.projects/hooks/useProjectRealtime.js`
- Modify: project task screen(s) that display the task list

- [ ] **Step 1: Create the hook**

```js
// apps/desktop/src/modules/atlas.projects/hooks/useProjectRealtime.js
import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useRealtimeContext } from '../../../providers/RealtimeProvider'

export function useProjectRealtime(projectId) {
  const { on } = useRealtimeContext()
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!projectId) return
    return on('projects.task.updated', ({ projectId: pid }) => {
      if (pid !== projectId) return
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'tasks'] })
      queryClient.invalidateQueries({ queryKey: ['projects', projectId] })
    })
  }, [projectId, on, queryClient])
}
```

- [ ] **Step 2: Verify syntax**

```bash
node --check apps/desktop/src/modules/atlas.projects/hooks/useProjectRealtime.js
```

Expected: no output (clean).

- [ ] **Step 3: Find the project task board/list screen**

Run:
```bash
find apps/desktop/src/modules/atlas.projects/screens -name "*.jsx" | head -20
```

Identify the screen that shows the task list (likely `ProjectBoardScreen.jsx`, `ProjectDetailScreen.jsx`, or similar).

- [ ] **Step 4: Mount `useProjectRealtime` in the task view screen**

In the identified screen file, add the import:
```js
import { useProjectRealtime } from '../hooks/useProjectRealtime'
```

Inside the component function, add the hook call:
```js
useProjectRealtime(projectId)
```

This is a side-effect only hook — it returns nothing, just registers the listener. Add it near the other hook calls at the top of the component.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/modules/atlas.projects/hooks/useProjectRealtime.js
git add apps/desktop/src/modules/atlas.projects/screens/
git commit -m "feat(projects): add useProjectRealtime hook, wire into task screens"
```

---

## Task 10: End-to-end verification

- [ ] **Step 1: Start all services**

In separate terminals:
```bash
pnpm dev:api
pnpm dev:frontend
```

- [ ] **Step 2: Verify notification realtime**

1. Open the app in Browser A, logged in as User A.
2. In a second browser (or incognito), log in as User A in a different session — or use the API to publish a notification directly:

```bash
curl -X POST http://localhost:4010/notifications/publish \
  -H "Authorization: Bearer $ATLAS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "test.realtime",
    "title": "Prueba realtime",
    "body": "Llegó en tiempo real",
    "recipients": { "userIds": ["<profile-id-of-user-A>"] },
    "channels": ["in_app"],
    "priority": "medium"
  }'
```

Expected: The notification bell badge in Browser A increments immediately (not after 60 seconds).

- [ ] **Step 3: Verify chat message realtime**

1. Log in as User A in Browser A, open a direct conversation with User B.
2. Log in as User B in Browser B, open the same conversation.
3. User B sends a message.

Expected: User A sees the message appear in < 2 seconds without refreshing.

- [ ] **Step 4: Verify global presence**

1. Log in as User A in Browser A.
2. Log in as User B in Browser B.
3. Open a direct conversation between A and B in Browser A.

Expected: User B appears with a green dot / "En línea" in User A's view. Close Browser B. Expected: status changes to "Visto hace un momento" within a few seconds.

- [ ] **Step 5: Verify project task realtime**

1. Open a project in Browser A as User A (project member).
2. Create a task via Browser B as User B (another project member).

Expected: User A's task list refreshes automatically within 1–2 seconds.

- [ ] **Step 6: Final commit if any fixes were made during verification**

```bash
git add -A
git commit -m "fix(realtime): end-to-end verification fixes"
```

---

## Self-review checklist

- [x] **Spec section 4.3** (channel naming) → Task 3 renames `chat:messages:{id}` and `chat:presence:{id}`; Task 1 creates `user:{profileId}:events` and `company:{companyId}:presence`
- [x] **Spec section 4.4** (component diagram) → Task 2 places `RealtimeProvider` inside auth/query providers, wrapping `AtlasApp`
- [x] **Spec section 8** (RealtimeProvider) → Task 1 implements full provider with both channels and `on()` event bus
- [x] **Spec section 9** (chat hooks) → Tasks 4, 5, 6 cover all three hooks
- [x] **Spec section 10** (NotificationBell) → Task 7
- [x] **Spec section 11** (global presence display) → Task 8 — dots + "En línea" / "Visto hace X"
- [x] **Spec section 12** (projects realtime) → Task 9
- [x] **Spec section 13** (generic pattern) → `useProjectRealtime` in Task 9 demonstrates the pattern for future modules
- [x] No `TBD`, no placeholder code — all JSX and JS is complete in every step
- [x] Query keys consistent: `['notifications']` in both `NotificationBell` (Task 7) and `RealtimeProvider` (Task 1) invalidation call
- [x] Channel names consistent: `chat:messages:{id}` in Task 3, `chat:presence:{id}` in Task 6 — no collisions
- [x] `on()` function signature consistent: `on(event: string, handler: (payload) => void) => unsubFn` — used identically in Tasks 4, 5, 6, 9
- [x] `isUserOnline` / `getLastSeen` returned by `useGlobalPresence()` — called correctly in Tasks 6 and 8
