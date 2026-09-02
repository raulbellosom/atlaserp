# Chat Message Search — Plan B (UI) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the `/chat/search/messages` endpoint (Plan A) into the desktop UI: a WhatsApp-style "Mensajes" results section under the sidebar search, jump-to-message on click, and a rewrite of the broken in-conversation search so it hits the server instead of filtering only the loaded page.

**Architecture:** One shared debounced hook (`useChatMessageSearch`) feeds two surfaces. A pure `buildSnippetSegments` helper turns `body` + `matchRanges` into highlightable segments. The sidebar renders a new `MessageSearchResults` component; clicking a hit navigates to `/chat/inbox/<id>?msg=<msgId>`, which `ChatScreen` reads and `ChatWindow` turns into its existing `setJumpTarget` flow. `ChatMessageList`'s jump loader gets a larger retry budget.

**Tech Stack:** React, TanStack Query, react-router-dom, `@atlas/ui`, `@atlas/sdk` (`atlas.chat.searchMessages` from Plan A), `node --test`.

**Spec:** `docs/superpowers/specs/2026-09-02-chat-message-search-design.md`
**Depends on:** Plan A merged (endpoint + `atlas.chat.searchMessages`).

---

## File Structure

- **Create** `apps/desktop/src/modules/atlas.chat/lib/searchSnippet.js` — `buildSnippetSegments(body, matchRanges, radius)`, pure.
- **Create** `apps/desktop/src/modules/atlas.chat/lib/__tests__/searchSnippet.test.js`.
- **Create** `apps/desktop/src/modules/atlas.chat/hooks/useChatMessageSearch.js` — debounced query hook.
- **Create** `apps/desktop/src/modules/atlas.chat/components/MessageSearchResults.jsx` — the sidebar "Mensajes" section.
- **Modify** `apps/desktop/src/modules/atlas.chat/components/ChatSidebar.jsx` — render the section when the query is >= 2 chars.
- **Modify** `apps/desktop/src/modules/atlas.chat/screens/ChatScreen.jsx` — read `?msg=`, thread it to `ChatWindow`, carry it in `handleSelect`.
- **Modify** `apps/desktop/src/modules/atlas.chat/components/ChatWindow.jsx` — `initialJumpMessageId` prop + effect; swap the client-side `searchMatchIds` `useMemo` for the hook; drive jump on match navigation.
- **Modify** `apps/desktop/src/modules/atlas.chat/components/ChatMessageList.jsx` — retry budget 5 -> 12.

---

## Task 1: `buildSnippetSegments` helper + tests

**Files:**
- Create: `apps/desktop/src/modules/atlas.chat/lib/searchSnippet.js`
- Create: `apps/desktop/src/modules/atlas.chat/lib/__tests__/searchSnippet.test.js`

- [ ] **Step 1: Write the failing test**

Create `apps/desktop/src/modules/atlas.chat/lib/__tests__/searchSnippet.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSnippetSegments } from "../searchSnippet.js";

test("no ranges: returns the whole body as one plain segment", () => {
  const out = buildSnippetSegments("hola mundo", [], 80);
  assert.deepEqual(out.segments, [{ text: "hola mundo", mark: false }]);
  assert.equal(out.truncatedStart, false);
  assert.equal(out.truncatedEnd, false);
});

test("marks the matched range", () => {
  // "pagué la factura hoy" — "factura" is chars [9,16) (é is one code point).
  const out = buildSnippetSegments("pagué la factura hoy", [[9, 16]], 80);
  assert.deepEqual(out.segments, [
    { text: "pagué la ", mark: false },
    { text: "factura", mark: true },
    { text: " hoy", mark: false },
  ]);
});

test("windows a long body around the first match with ellipsis flags", () => {
  const body = "x".repeat(200) + "factura" + "y".repeat(200);
  const out = buildSnippetSegments(body, [[200, 207]], 20);
  assert.equal(out.truncatedStart, true);
  assert.equal(out.truncatedEnd, true);
  const marked = out.segments.find((s) => s.mark);
  assert.equal(marked.text, "factura");
  // window is radius chars on each side of the match
  assert.equal(out.segments[0].text.length, 20);
});

test("multiple ranges each become a marked segment", () => {
  const out = buildSnippetSegments("aa bb aa", [[0, 2], [6, 8]], 80);
  assert.deepEqual(out.segments, [
    { text: "aa", mark: true },
    { text: " bb ", mark: false },
    { text: "aa", mark: true },
  ]);
});
```

- [ ] **Step 2: Run it, verify failure**

Run: `node --test apps/desktop/src/modules/atlas.chat/lib/__tests__/searchSnippet.test.js`
Expected: FAIL — `Cannot find module '../searchSnippet.js'`.

- [ ] **Step 3: Implement the helper**

Create `apps/desktop/src/modules/atlas.chat/lib/searchSnippet.js`:

```js
// Turn a message body + [start,end] match ranges (byte-for-byte offsets into
// `body`, as returned by /chat/search/messages) into an ordered list of
// { text, mark } segments, windowed to `radius` chars around the first match so
// long messages don't blow out the results row. Pure — unit-tested.
export function buildSnippetSegments(body, matchRanges, radius = 80) {
  const text = body ?? "";
  const ranges = Array.isArray(matchRanges)
    ? [...matchRanges].filter((r) => Array.isArray(r) && r.length === 2).sort((a, b) => a[0] - b[0])
    : [];

  if (!ranges.length) {
    return { segments: [{ text, mark: false }], truncatedStart: false, truncatedEnd: false };
  }

  const firstStart = ranges[0][0];
  const lastEnd = ranges[ranges.length - 1][1];
  let winStart = Math.max(0, firstStart - radius);
  let winEnd = Math.min(text.length, lastEnd + radius);
  const truncatedStart = winStart > 0;
  const truncatedEnd = winEnd < text.length;

  const segments = [];
  let cursor = winStart;
  for (const [s, e] of ranges) {
    const clampedS = Math.max(s, winStart);
    const clampedE = Math.min(e, winEnd);
    if (clampedE <= winStart || clampedS >= winEnd) continue;
    if (clampedS > cursor) segments.push({ text: text.slice(cursor, clampedS), mark: false });
    segments.push({ text: text.slice(clampedS, clampedE), mark: true });
    cursor = clampedE;
  }
  if (cursor < winEnd) segments.push({ text: text.slice(cursor, winEnd), mark: false });

  return { segments, truncatedStart, truncatedEnd };
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `node --test apps/desktop/src/modules/atlas.chat/lib/__tests__/searchSnippet.test.js`
Expected: PASS (4/4).

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/lib/searchSnippet.js apps/desktop/src/modules/atlas.chat/lib/__tests__/searchSnippet.test.js
git commit -m "feat(chat): buildSnippetSegments helper for search result highlighting"
```

---

## Task 2: `useChatMessageSearch` hook

**Files:**
- Create: `apps/desktop/src/modules/atlas.chat/hooks/useChatMessageSearch.js`

- [ ] **Step 1: Write the hook**

Look at `apps/desktop/src/modules/atlas.chat/hooks/usePinnedMessages.js` first for
the local `useQuery` + `useAuth` token pattern this repo uses.

Create `apps/desktop/src/modules/atlas.chat/hooks/useChatMessageSearch.js`:

```js
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../../auth/AuthProvider";
import { atlas } from "../../../lib/atlas";

const MIN_LEN = 2;
const DEBOUNCE_MS = 250;

// Debounced fuzzy message search. Pass `conversationId` to scope to one
// conversation (in-conversation search), omit it for a global search.
export function useChatMessageSearch({ q, conversationId = null, limit = 30, enabled = true }) {
  const { session } = useAuth();
  const token = session?.access_token;
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const trimmed = (q ?? "").trim();
    const handle = setTimeout(() => setDebounced(trimmed), DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [q]);

  const active = enabled && Boolean(token) && debounced.length >= MIN_LEN;

  const query = useQuery({
    queryKey: ["chat-message-search", conversationId ?? "global", debounced, limit],
    queryFn: () =>
      atlas.chat.searchMessages(
        { q: debounced, conversationId: conversationId ?? undefined, limit },
        token,
      ),
    enabled: active,
    staleTime: 15_000,
    keepPreviousData: true,
  });

  const hits = query.data?.data ?? [];

  // In-conversation navigation is chronological (newest match first), matching
  // WhatsApp's in-chat search; global results keep the server's relevance order.
  const orderedHitIds = useMemo(() => {
    if (!conversationId) return hits.map((h) => h.messageId);
    return [...hits]
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))
      .map((h) => h.messageId);
  }, [hits, conversationId]);

  return {
    hits,
    orderedHitIds,
    truncated: Boolean(query.data?.truncated),
    isSearching: active && query.isFetching,
    isError: query.isError,
    hasQuery: debounced.length >= MIN_LEN,
  };
}
```

- [ ] **Step 2: Static check**

Run: `node --check apps/desktop/src/modules/atlas.chat/hooks/useChatMessageSearch.js`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/hooks/useChatMessageSearch.js
git commit -m "feat(chat): useChatMessageSearch debounced search hook"
```

---

## Task 3: `MessageSearchResults` sidebar section

**Files:**
- Create: `apps/desktop/src/modules/atlas.chat/components/MessageSearchResults.jsx`

- [ ] **Step 1: Check available UI + avatar helpers**

Look at `AvatarCircle.jsx` in the same folder for the conversation-avatar
component signature, and confirm `EmptyState`, `Skeleton`, `ErrorState` are
exported from `@atlas/ui` (`grep -n "ErrorState" packages/ui/src/index.js`).

- [ ] **Step 2: Write the component**

Create `apps/desktop/src/modules/atlas.chat/components/MessageSearchResults.jsx`:

```jsx
import { useMemo } from "react";
import { EmptyState, Skeleton, ErrorState } from "@atlas/ui";
import { AvatarCircle } from "./AvatarCircle";
import { buildSnippetSegments } from "../lib/searchSnippet";

function relativeDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days <= 0) return "hoy";
  if (days === 1) return "ayer";
  if (days < 7) return `hace ${days} d`;
  return d.toLocaleDateString("es", { day: "numeric", month: "short" });
}

function Snippet({ body, matchRanges }) {
  const { segments, truncatedStart, truncatedEnd } = useMemo(
    () => buildSnippetSegments(body, matchRanges, 80),
    [body, matchRanges],
  );
  return (
    <span className="text-xs text-[hsl(var(--muted-foreground))] line-clamp-2">
      {truncatedStart ? "…" : ""}
      {segments.map((s, i) =>
        s.mark ? (
          <mark key={i} className="rounded bg-[hsl(var(--primary))/0.25] text-[hsl(var(--foreground))] px-0.5">
            {s.text}
          </mark>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
      {truncatedEnd ? "…" : ""}
    </span>
  );
}

// WhatsApp-style "Mensajes" block under the conversation list. `hits` come from
// useChatMessageSearch (global mode). Grouped by conversation.
export function MessageSearchResults({ hits, isSearching, isError, truncated, onOpen }) {
  const groups = useMemo(() => {
    const byConv = new Map();
    for (const h of hits) {
      const key = h.conversationId;
      if (!byConv.has(key)) byConv.set(key, { conversation: h.conversation, items: [] });
      byConv.get(key).items.push(h);
    }
    return [...byConv.values()];
  }, [hits]);

  return (
    <div className="pt-2">
      <p className="px-2 py-1.5 text-xs font-medium text-[hsl(var(--muted-foreground))]">
        Mensajes
      </p>

      {isError && (
        <ErrorState className="py-6" title="No se pudo buscar" description="Intenta de nuevo." />
      )}

      {!isError && isSearching && !hits.length && (
        <div className="space-y-2 p-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 px-2">
              <Skeleton className="h-9 w-9 rounded-full shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-2.5 w-44" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!isError && !isSearching && !hits.length && (
        <EmptyState className="py-6" title="Sin mensajes" description="No se encontraron coincidencias." />
      )}

      {!isError && groups.map(({ conversation, items }) => (
        <div key={conversation.id} className="mb-1">
          <div className="flex items-center gap-2 px-2 py-1">
            <AvatarCircle
              name={conversation.title ?? "Chat"}
              src={null}
              size={20}
            />
            <span className="text-xs font-medium truncate">{conversation.title ?? "Chat"}</span>
          </div>
          {items.map((h) => (
            <button
              key={h.messageId}
              type="button"
              onClick={() => onOpen(h)}
              className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-[hsl(var(--muted))] transition-colors"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs font-medium truncate">{h.sender.displayName ?? "Usuario"}</span>
                <span className="text-[10px] text-[hsl(var(--muted-foreground))] shrink-0">
                  {relativeDate(h.createdAt)}
                </span>
              </div>
              <Snippet body={h.body} matchRanges={h.matchRanges} />
            </button>
          ))}
        </div>
      ))}

      {truncated && (
        <p className="px-2 py-1.5 text-[10px] text-[hsl(var(--muted-foreground))]">
          Muchos resultados — refina tu búsqueda.
        </p>
      )}
    </div>
  );
}
```

If `AvatarCircle` does not accept `name`/`src`/`size` as above, adapt the two
call sites to its real props (check the file).

- [ ] **Step 3: Static check**

Run: `node --check apps/desktop/src/modules/atlas.chat/components/MessageSearchResults.jsx`
Expected: exit 0. (`node --check` parses JSX-free files only — if it errors on
JSX, skip and rely on the `vite build` in Task 7.)

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/components/MessageSearchResults.jsx
git commit -m "feat(chat): MessageSearchResults sidebar section"
```

---

## Task 4: Wire the section into `ChatSidebar`

**Files:**
- Modify: `apps/desktop/src/modules/atlas.chat/components/ChatSidebar.jsx`

- [ ] **Step 1: Imports**

Add near the other component imports:

```js
import { MessageSearchResults } from "./MessageSearchResults";
import { useChatMessageSearch } from "../hooks/useChatMessageSearch";
```

- [ ] **Step 2: Call the hook**

Inside `ChatSidebar`, after `const [search, setSearch] = useState("");`, add:

```js
  const {
    hits: messageHits,
    isSearching: messageSearching,
    isError: messageSearchError,
    truncated: messageSearchTruncated,
    hasQuery: hasMessageQuery,
  } = useChatMessageSearch({ q: search });
```

- [ ] **Step 3: Render the section**

Immediately after the closing `</div>` of the conversation-list scroll
container (the `<div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-0.5">`
block, right before `<CreateChatModal ...>`), insert:

```jsx
      {hasMessageQuery && (
        <div className="border-t border-[hsl(var(--border))] px-2 pb-2 overflow-y-auto max-h-[45%] shrink-0">
          <MessageSearchResults
            hits={messageHits}
            isSearching={messageSearching}
            isError={messageSearchError}
            truncated={messageSearchTruncated}
            onOpen={(hit) => onSelect({ id: hit.conversationId }, hit.messageId)}
          />
        </div>
      )}
```

- [ ] **Step 4: Verify `onSelect` is passed through**

`ChatSidebar` already receives `onSelect` as a prop and calls it with a
conversation object. The `onOpen` above calls `onSelect({ id }, messageId)` —
Task 5 updates `ChatScreen.handleSelect` to accept that optional second arg.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/components/ChatSidebar.jsx
git commit -m "feat(chat): global message search section in the chat sidebar"
```

---

## Task 5: `?msg=` routing in `ChatScreen`

**Files:**
- Modify: `apps/desktop/src/modules/atlas.chat/screens/ChatScreen.jsx`

- [ ] **Step 1: Read the param**

`useSearchParams` is already imported. After
`const initialFilesView = searchParams.get("view") === "files";` add:

```js
  const jumpMessageId = searchParams.get("msg");
```

- [ ] **Step 2: Carry it in `handleSelect`**

Replace `handleSelect`:

```js
  function handleSelect(conv, messageId) {
    const qs = messageId ? `?msg=${encodeURIComponent(messageId)}` : "";
    navigate(`/app/m/atlas.chat/chat/inbox/${conv.id}${qs}`, { replace: true });
    setMobileShowWindow(true);
  }
```

- [ ] **Step 3: Pass it to `ChatWindow`**

In the `<ChatWindow ... />` JSX add the prop:

```jsx
          initialJumpMessageId={jumpMessageId}
```

- [ ] **Step 4: Static check**

Run: `node --check apps/desktop/src/modules/atlas.chat/screens/ChatScreen.jsx`
(skip if it errors on JSX).

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/screens/ChatScreen.jsx
git commit -m "feat(chat): read ?msg= and thread it to ChatWindow"
```

---

## Task 6: `ChatWindow` — jump effect + in-conversation search rewrite

**Files:**
- Modify: `apps/desktop/src/modules/atlas.chat/components/ChatWindow.jsx`

- [ ] **Step 1: Signature + import**

Change the component signature (line ~356):

```js
export function ChatWindow({ conversation, onClose, initialFilesView = false, initialJumpMessageId = null }) {
```

Add to the hooks import block near `useChatMessages`:

```js
import { useChatMessageSearch } from "../hooks/useChatMessageSearch";
```

- [ ] **Step 2: Jump on mount / param change**

After the `handleJumpToMessage` `useCallback` (around line 554), add:

```js
  // A search result (global or from another surface) opened this conversation
  // with ?msg=<id> — reuse the same jump path pinned/reply jumps use.
  useEffect(() => {
    if (!initialJumpMessageId || !conversationId) return;
    setFilesView(false);
    setJumpTarget({ id: initialJumpMessageId, nonce: `msg-${initialJumpMessageId}` });
  }, [initialJumpMessageId, conversationId]);
```

- [ ] **Step 3: Replace the client-side match filter**

Find the `searchMatchIds` `useMemo` (around line 670):

```js
  const searchMatchIds = useMemo(() => {
    if (!searchMode || !searchQuery.trim()) return [];
    const all = messagesData?.data ?? [];
    const q = searchQuery.toLowerCase();
    return all
      .filter((m) => !hiddenMessageIds.has(m.id) && m.body?.toLowerCase().includes(q))
      .map((m) => m.id)
      .reverse();
  }, [messagesData, hiddenMessageIds, searchMode, searchQuery]);
```

Replace it with a server-backed version:

```js
  const {
    orderedHitIds: rawSearchHitIds,
    isSearching: isSearchingServer,
    isError: searchError,
  } = useChatMessageSearch({
    q: searchQuery,
    conversationId,
    enabled: searchMode,
    limit: 50,
  });

  // Keep hidden-for-me messages out of the navigable set, same as before.
  const searchMatchIds = useMemo(
    () => (searchMode ? rawSearchHitIds.filter((id) => !hiddenMessageIds.has(id)) : []),
    [searchMode, rawSearchHitIds, hiddenMessageIds],
  );
```

- [ ] **Step 4: Make match navigation load off-page matches**

Find `const currentMatchId = searchMatchIds[searchCurrentIdx] ?? null;` (around
line 684). Directly after it, add:

```js
  // The current match may live in history that isn't paged in yet — drive the
  // same loader the pinned/reply jump uses. ChatMessageList flashes it on
  // arrival; the highlight set (searchMatchIds) styles it once loaded.
  useEffect(() => {
    if (!searchMode || !currentMatchId) return;
    setJumpTarget({ id: currentMatchId, nonce: `search-${currentMatchId}-${searchCurrentIdx}` });
  }, [searchMode, currentMatchId, searchCurrentIdx]);
```

- [ ] **Step 5: Reflect loading / error in the search header**

Find where `searchMatchCount` is passed to the header (around line 763):
`searchMatchCount={searchMatchIds.length}`. Leave it, and add two props next to
it:

```jsx
        searchBusy={isSearchingServer}
        searchError={searchError}
```

Then in `ChatHeader` (the search-mode branch, around line 127-146 where it
renders `` `${searchCurrentIdx + 1} / ${searchMatchCount}` `` / `"Sin resultados"`),
accept `searchBusy, searchError` in the props list and change the status text:

```jsx
        {searchQuery && (
          <span className="text-xs text-[hsl(var(--muted-foreground))] whitespace-nowrap px-1">
            {searchError
              ? "Error al buscar"
              : searchBusy && !hasMatches
                ? "Buscando…"
                : hasMatches
                  ? `${searchCurrentIdx + 1} / ${searchMatchCount}`
                  : "Sin resultados"}
          </span>
        )}
```

- [ ] **Step 6: Static check + existing chat FE tests**

Run: `node --test apps/desktop/src/modules/atlas.chat/lib/__tests__/ apps/desktop/src/modules/atlas.chat/calls/__tests__/`
Expected: no regressions.

- [ ] **Step 7: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/components/ChatWindow.jsx
git commit -m "feat(chat): server-backed in-conversation search + ?msg= jump"
```

---

## Task 7: `ChatMessageList` retry budget + full verification

**Files:**
- Modify: `apps/desktop/src/modules/atlas.chat/components/ChatMessageList.jsx`

- [ ] **Step 1: Bump the jump retry budget**

Around line 299:

```js
      if (attempts >= 5 || !hasMore) { jumpHandledRef.current = key; onJumpFailed?.(); return; }
```

Change `5` to `12` and update the nearby comment ("load older pages (up to 5
times)" -> "up to 12 times") so a search hit deep in history is still reachable
before the loader gives up.

- [ ] **Step 2: Soften the jump-failed toast for search**

In `ChatWindow.jsx`, the `onJumpFailed` handler passed to `ChatMessageList`
(line ~840) currently always says "No se pudo cargar el mensaje original.".
Change it to be search-aware:

```jsx
              onJumpFailed={() =>
                toast.message(
                  searchMode || initialJumpMessageId
                    ? "Mostrando la conversación; el mensaje puede estar más atrás en el historial."
                    : "No se pudo cargar el mensaje original.",
                )
              }
```

- [ ] **Step 3: Build the web bundle**

Run: `cd apps/desktop && pnpm build:web`
Expected: `vite build` completes with no errors. Fix any import/JSX errors it
reports in the files this plan touched.

- [ ] **Step 4: Lint + full frontend-relevant tests**

Run: `pnpm lint`
Expected: no new errors.

Run: `node --test apps/desktop/src/modules/atlas.chat/lib/__tests__/`
Expected: all pass (includes the new `searchSnippet.test.js`).

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/components/ChatMessageList.jsx apps/desktop/src/modules/atlas.chat/components/ChatWindow.jsx
git commit -m "feat(chat): deeper jump retry budget + search-aware jump-failed toast"
```

- [ ] **Step 6: Manual QA (record in the spec verification note)**

With `pnpm dev` running, at **390 px** and **1440 px**, both light and dark:

1. Sidebar: type a 3-letter fragment of a known message with an accent
   (e.g. `reu` for "reunión"). "Mensajes" section shows grouped hits with the
   fragment highlighted.
2. Type a deliberate typo (`reunino`). The message still appears.
3. Type two words in reversed order (`factura pago`). A message containing both
   in any order appears.
4. Click a hit for a message far up in a long conversation. The window opens,
   loads history, scrolls to the message, and flashes it. If it's extremely
   deep, the softened toast shows instead of an error.
5. Open a conversation, press the in-header search icon, search a word only in
   old (un-paged) messages. The match counter is non-zero; next/prev jumps to
   and flashes each match.
6. Confirm the `<mark>` highlight is readable in dark mode.

Note results in `docs/superpowers/specs/2026-09-02-chat-message-search-design.md`
with `Verified: 2026-09-02 (...)`.
```
