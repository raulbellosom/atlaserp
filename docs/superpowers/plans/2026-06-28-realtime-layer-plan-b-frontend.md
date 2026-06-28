# Realtime Layer — Plan B: Frontend Implementation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Subscribe to the new `company:{companyId}:events` Supabase channel in `RealtimeProvider`, route incoming POS and Calendar events to cache invalidation, and reduce redundant polling intervals across Chat, POS, and Calendar.

**Architecture:** `RealtimeProvider.jsx` already manages two channels (`user:{id}:events` and `company:{id}:presence`). A third channel — `company:{id}:events` — is added in the same provider following the identical useEffect + cleanup pattern. POS and Calendar hooks then get their `refetchInterval` lowered because the broadcaster now handles instant delivery.

**Tech Stack:** React, TanStack Query (`useQueryClient`), `@supabase/supabase-js` (already installed).

> **Note on Notes:** `SupabaseYjsProvider.js` + `NoteEditor.jsx` already implement full Y.js CRDT collaboration with Supabase Broadcast client-to-client. Zero changes needed for Notes.

> **Note on Projects:** `useProjectRealtime` already listens to `projects.task.updated`. Plan A wires the API side. No frontend changes needed for Projects.

---

## File Map

| File | Action | Lines affected |
|---|---|---|
| `apps/desktop/src/providers/RealtimeProvider.jsx` | Modify | After line 96 (after company presence useEffect) |
| `apps/desktop/src/modules/atlas.chat/hooks/useChatMessages.js` | Modify | Line 20 |
| `apps/desktop/src/modules/atlas.pos/hooks/usePosFloor.js` | Modify | Lines 19, 56 |
| `apps/desktop/src/modules/atlas.pos/hooks/usePosOrder.js` | Modify | Line 30 |
| `apps/desktop/src/modules/atlas.pos/hooks/usePosKitchen.js` | Modify | Line 19 |
| `apps/desktop/src/modules/atlas.calendar/hooks/useCalendarData.js` | Modify | Line 285 |

---

## Task 1: Add company:events channel to RealtimeProvider

**Files:**
- Modify: `apps/desktop/src/providers/RealtimeProvider.jsx`

The file has two useEffect blocks: one for `user:{id}:events` (lines 30-57) and one for `company:{id}:presence` (lines 60-96). Add a third useEffect for `company:{id}:events` after line 96, using the same pattern.

- [ ] **Step 1: Add the third useEffect in RealtimeProvider.jsx**

In `apps/desktop/src/providers/RealtimeProvider.jsx`, after the company presence useEffect closing brace (after line 96, before the `const isUserOnline` line), insert:

```js
  // Company events channel — receives broadcast events for POS, Calendar, and other company-wide modules
  useEffect(() => {
    if (!userProfile?.id || !userProfile?.companyId) return
    const client = getSupabaseClient()
    const channel = client
      .channel(`company:${userProfile.companyId}:events`)
      .on('broadcast', { event: 'pos.order.updated' }, () => {
        queryClient.invalidateQueries({ queryKey: ['pos'] })
      })
      .on('broadcast', { event: 'calendar.event.updated' }, () => {
        queryClient.invalidateQueries({ queryKey: ['calendar'] })
      })
      .subscribe()
    return () => { client.removeChannel(channel) }
  }, [userProfile?.id, userProfile?.companyId, queryClient])
```

- [ ] **Step 2: Verify the file still renders without error**

```bash
node --check apps/desktop/src/providers/RealtimeProvider.jsx
```

Expected: no output (syntax ok).

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/providers/RealtimeProvider.jsx
git commit -m "feat(realtime): subscribe to company:events channel in RealtimeProvider for POS and Calendar"
```

---

## Task 2: Reduce chat message polling from 8s to 30s

**Files:**
- Modify: `apps/desktop/src/modules/atlas.chat/hooks/useChatMessages.js` — line 20

The `postgres_changes` WebSocket subscription in `supabaseRealtime.js` already delivers messages instantly. The 8-second poll is a fallback safety net; 30 seconds is sufficient.

- [ ] **Step 1: Change refetchInterval**

In `apps/desktop/src/modules/atlas.chat/hooks/useChatMessages.js` line 20, change:

```js
    refetchInterval: 8_000,
```

to:

```js
    refetchInterval: 30_000,
```

- [ ] **Step 2: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/hooks/useChatMessages.js
git commit -m "perf(chat): reduce message polling fallback from 8s to 30s (realtime handles delivery)"
```

---

## Task 3: Reduce POS polling intervals

**Files:**
- Modify: `apps/desktop/src/modules/atlas.pos/hooks/usePosFloor.js` — lines 19 and 56
- Modify: `apps/desktop/src/modules/atlas.pos/hooks/usePosOrder.js` — line 30
- Modify: `apps/desktop/src/modules/atlas.pos/hooks/usePosKitchen.js` — line 19

After Plan A adds broadcaster calls, the POS frontend will receive instant updates via `company:events`. The existing polling becomes a background safety net — 60 seconds is adequate.

- [ ] **Step 1: Update usePosFloor.js line 19 (usePosActiveMap)**

Change:
```js
    refetchInterval: 30 * 1000,
```
to:
```js
    refetchInterval: 60 * 1000,
```

- [ ] **Step 2: Update usePosFloor.js line 56 (second refetchInterval)**

Change:
```js
    refetchInterval: refetch ? 15 * 1000 : false,
```
to:
```js
    refetchInterval: refetch ? 60 * 1000 : false,
```

- [ ] **Step 3: Update usePosOrder.js line 30**

Change:
```js
    refetchInterval: 15 * 1000,
```
to:
```js
    refetchInterval: 60 * 1000,
```

- [ ] **Step 4: Update usePosKitchen.js line 19**

Change:
```js
    refetchInterval: 15 * 1000,
```
to:
```js
    refetchInterval: 60 * 1000,
```

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/modules/atlas.pos/hooks/usePosFloor.js
git add apps/desktop/src/modules/atlas.pos/hooks/usePosOrder.js
git add apps/desktop/src/modules/atlas.pos/hooks/usePosKitchen.js
git commit -m "perf(pos): reduce polling from 15-30s to 60s now that broadcaster handles instant updates"
```

---

## Task 4: Reduce Calendar notification polling from 60s to 5min

**Files:**
- Modify: `apps/desktop/src/modules/atlas.calendar/hooks/useCalendarData.js` — line 285

- [ ] **Step 1: Update useCalendarData.js line 285**

Change:
```js
    refetchInterval: 60 * 1000,
```
to:
```js
    refetchInterval: 5 * 60 * 1000,
```

- [ ] **Step 2: Commit**

```bash
git add apps/desktop/src/modules/atlas.calendar/hooks/useCalendarData.js
git commit -m "perf(calendar): reduce notification polling from 60s to 5min (broadcaster handles real-time)"
```

---

## Verification

- [ ] **Start the dev servers**

```bash
pnpm dev
```

- [ ] **Verify company:events channel connects**

Open the app in the browser. Open DevTools → Network → WS tab. Find the Supabase WebSocket connection. In the messages, you should see the subscription frame for `company:{companyId}:events` topic alongside the existing `user:{id}:events` and `company:{id}:presence` channels.

- [ ] **Verify POS instant update**

1. Open two browser tabs both logged in.
2. In tab 1, open POS terminal and create an order.
3. In tab 2, observe POS floor/kitchen view — it should refresh within ~1 second (from the broadcast), not wait 60 seconds.

- [ ] **Verify Calendar instant update**

1. In tab 1, create a calendar event.
2. In tab 2 with the calendar open, the event should appear within ~1 second (no page reload).

- [ ] **Verify chat polling is 30s not 8s**

In DevTools → Network, filter by `messages?limit=40`. The requests to `/chat/conversations/{id}/messages` should appear approximately every 30 seconds. New messages sent by the other user should still appear instantly (via the `postgres_changes` WebSocket subscription, visible in the WS tab).

- [ ] **Verify Notes collaboration (already implemented — just test)**

Open the same note in two tabs. Type in one tab — the changes should appear in the other tab within ~1 second. Both tabs should show the other user's cursor name in the TipTap editor (via `SupabaseYjsProvider` awareness).
