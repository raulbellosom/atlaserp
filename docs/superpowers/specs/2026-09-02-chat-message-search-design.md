# Chat message search (global + in-conversation, fuzzy)

- Status: approved
- Date: 2026-09-02
- Module: atlas.chat
- Approach: Postgres `pg_trgm` trigram search

## Problem

The chat module has no working general message search:

- The sidebar `SearchInput` (`ChatSidebar.jsx`) only filters the conversation
  list by **conversation name**. It never looks at message content.
- The only message search is inside an open conversation
  (`ChatWindow.jsx`, the `searchMatchIds` `useMemo`): a client-side
  `body.toLowerCase().includes(query)` over **only the messages already paged
  into the browser**. It misses older history entirely and is an exact
  substring match: no accent folding (`jose` != `José`), no typo tolerance,
  no multi-word / any-order matching.

Users expect a WhatsApp-style experience: one search that finds messages
across every conversation they belong to, tolerant of accents, partial
words, typos, and word order.

## Goals

- **Global search**: from the sidebar search box, find messages across all
  conversations the user is a member of; results grouped by conversation;
  click jumps to the message.
- **In-conversation search**: the existing per-chat search hits the server and
  uses the same engine, so it finds matches anywhere in that conversation's
  history, not just the loaded page.
- Match behavior (all four):
  - accent- and case-insensitive, partial words (`factur` -> "facturación")
  - typo tolerance (`reunino` -> "reunión")
  - multi-word, order-independent (`pago factura` matches "…la factura de ese pago…")
- Out of scope: stemming / synonyms (no Spanish FTS dictionary), guest/external
  conversations, live-updating result sets, pixel-perfect centering on matches
  thousands of messages deep (documented follow-up).

## Approach: `pg_trgm` trigram search

Chat tables are plain Postgres managed by raw SQL migrations in
`prisma/migrations/` (not `schema.prisma`, not AME3). This is a normal forward
migration plus a new service, endpoint, validator, SDK method, and frontend
hook + UI.

Trigram search was chosen over full-text search because stemming/synonyms are
explicitly out of scope, which removes FTS's main advantage, while `pg_trgm`
covers all four wanted behaviors with one mechanism: substring match for
accents/partial words (on a normalized column), `word_similarity` for typos,
and AND-ing per-token predicates for multi-word any-order.

## Section 1 — Data model & migration

New migration `prisma/migrations/<ts>_chat_message_search/migration.sql`:

1. Extensions (same unqualified style as the existing `pgcrypto` line):

   ```sql
   CREATE EXTENSION IF NOT EXISTS pg_trgm;
   CREATE EXTENSION IF NOT EXISTS unaccent;
   ```

2. IMMUTABLE unaccent wrapper (`unaccent()` alone is only STABLE, so it can't
   be used in an index or generated column):

   ```sql
   CREATE OR REPLACE FUNCTION atlas_unaccent(text)
     RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
     AS $$ SELECT unaccent('unaccent'::regdictionary, $1) $$;
   ```

3. `chat_messages` — stored generated column + GIN trigram index. Stored (not
   just an expression index) because the search service reuses it to build the
   highlighted snippet:

   ```sql
   ALTER TABLE chat_messages
     ADD COLUMN body_norm text
       GENERATED ALWAYS AS (atlas_unaccent(lower(body))) STORED;
   CREATE INDEX chat_messages_body_norm_trgm_idx
     ON chat_messages USING gin (body_norm gin_trgm_ops);
   ```

   `ADD COLUMN` on a generated STORED column rewrites the table once — an
   acceptable one-time migration cost.

4. `user_profile` (sender name) and `chat_attachments` (file name) — lighter
   expression GIN indexes, no new columns on shared tables:

   ```sql
   CREATE INDEX user_profile_display_name_trgm_idx
     ON user_profile USING gin (atlas_unaccent(lower(display_name)) gin_trgm_ops);
   CREATE INDEX chat_attachments_file_name_trgm_idx
     ON chat_attachments USING gin (atlas_unaccent(lower(file_name)) gin_trgm_ops);
   ```

No `schema.prisma` change. `pnpm db:migrate` applies it.

## Section 2 — API

### `apps/api/src/routes/chat/chat-search-service.js` (new file)

`chat-service.js` is already ~1300 lines (near the 1500 hard ceiling), so the
search logic goes in its own file: `createChatSearchService({ prisma })`
exposing:

```
searchMessages({ authUserId, q, conversationId = null, limit = 30, offset = 0 })
```

Logic:

1. Resolve `authUserId` -> `user_profile.id` using the same helper the other
   chat services use.
2. Normalize + tokenize `q`: unaccent + lowercase in JS, split on whitespace,
   drop tokens shorter than 2 chars (unless it is the only token), cap at 6
   tokens. If no usable tokens -> return `{ data: [], truncated: false }`,
   never an error.
3. Membership scope — join `chat_conversation_members` on
   `user_id = profileId AND left_at IS NULL`, plus `m.deleted_at IS NULL`.
   Add `AND m.conversation_id = $conversationId` in in-conversation mode.
4. Per-token predicate, AND-ed across tokens (the AND is what makes it
   multi-word / order-independent). A token matches if any of:
   - `m.body_norm ILIKE '%' || $tok || '%'` (substring / partial word,
     trigram-index-backed)
   - `word_similarity($tok, m.body_norm) > 0.35` (typo tolerance)
   - sender `display_name` matches by the same ILIKE-or-`word_similarity` pair
   - any attachment `file_name` matches by the same pair
   `%` / `_` are escaped in `$tok` before building the `ILIKE` pattern; all
   tokens are bound params via `Prisma.sql` / `$queryRaw` tagged templates.
5. Rank:
   `score = SUM over tokens of GREATEST(1.0 if substring hit else 0,
   word_similarity(tok, body_norm))`, then
   `ORDER BY score DESC, m.created_at DESC`.
   Pagination is `LIMIT $limit OFFSET $offset` with `offset` hard-capped at
   300. `truncated` is `true` when the row count hits the limit.
6. Response per hit:

   ```
   {
     messageId, conversationId,
     conversation: { id, title, kind, avatarUrl },
     sender: { id, displayName },
     body,
     matchRanges: [[start, end], ...],
     createdAt,
     score
   }
   ```

   `matchRanges` computed in JS from the normalized string. If
   `body_norm.length !== body.length` (e.g. `ß` -> `ss`), return
   `matchRanges: []`; the UI shows the plain snippet. Snippet windowing
   (±80 chars around the first match) is done client-side from `body` +
   `matchRanges`.

### Route

Thin (~12 lines) in `apps/api/src/routes/chat/index.js` — the file is currently
948 lines, so this stays under 1000 and does not trigger the pending
moderation-routes extraction:

```
GET /chat/search/messages?q=&conversationId=&limit=&offset=
  guard: requirePermission("chat.conversations.read")   // no new permission key
```

Wire `chatSearchService` into the service bag alongside the other chat
services.

### Validator

`chatMessageSearchQuerySchema` in `packages/validators` (chat section):
`q` string, `conversationId` uuid optional, `limit` int 1..50 optional,
`offset` int 0..300 optional.

### SDK

`client.chat.searchMessages({ q, conversationId, limit, offset })` in the
`chat` domain of `packages/sdk`, and the mirror method in the desktop
`atlas` client (`apps/desktop/src/lib/atlas.js`).

## Section 3 — Frontend

### `useChatMessageSearch.js` (new hook)

Wraps the client `searchMessages` call. Debounced ~250 ms. `enabled` only when
the trimmed query is >= 2 chars. Shared by both surfaces.

### Global search (sidebar)

`ChatSidebar.jsx` keeps its `SearchInput` and the existing client-side
conversation-name filter (that part works). When the query is >= 2 chars,
render an extra **"Mensajes"** section below the conversation list:

- `useChatMessageSearch({ q })` with no `conversationId` -> searches every
  conversation the user belongs to.
- Rows grouped by conversation (title + avatar subheader); each hit shows
  sender, the snippet with `<mark>`-highlighted `matchRanges`, and a relative
  date.
- Click -> `onSelect` navigates to
  `/app/m/atlas.chat/chat/inbox/<convId>?msg=<messageId>`.
- Loading -> `Skeleton`; zero hits -> `EmptyState` ("Sin mensajes");
  `truncated` -> "Refina tu búsqueda" hint. All `@atlas/ui`.
- Error -> `ErrorState`, never a throw into the list.

### Jump-to-message

`ChatScreen` reads `msg` from `useSearchParams` and passes
`initialJumpMessageId` to `ChatWindow`. On mount / when it changes,
`ChatWindow` calls its existing `setJumpTarget({ id, nonce })` — the same path
reply-quote and pinned-message jumps already use. `ChatMessageList`'s existing
`scrollToMessage` effect loads older pages and flashes the message; its retry
budget goes from 5 to ~12 pages. On `onJumpFailed`, `toast` "Mostrando la
conversación; el mensaje es de <fecha>".

True bidirectional "around" pagination (message centered with context above
and below, for matches thousands deep) is a documented follow-up, not built
now.

### In-conversation search (rewrite)

In `ChatWindow.jsx`, replace the client-side `searchMatchIds` `useMemo` (the
`body.toLowerCase().includes` over only the loaded page — the actual bug) with
`useChatMessageSearch({ q: searchQuery, conversationId })`. The ordered hit
list feeds the existing `searchCurrentIdx` / next / prev navigation and the
match counter UI unchanged. Navigating to a match that is not loaded reuses the
same `setJumpTarget` loader. `ChatMessageList` highlighting keeps using
`searchMatchIds` (now a `Set` of server hit IDs) plus `searchQuery`.

## Section 4 — Error handling & edge cases

- Short / empty query: `q` blank or all tokens < 2 chars -> `{ data: [] }`,
  HTTP 200. UI shows nothing / "Escribe al menos 2 caracteres".
- Deleted / moderation-hidden messages: `m.deleted_at IS NULL` — never surface.
- Membership revoked: `left_at IS NULL` join -> leaving a conversation drops
  its messages from results immediately.
- Guest / external conversations: scoped out for v1 (join is on `cm.user_id`);
  operators keep using the external-inbox search.
- `unaccent` length drift (`ß` -> `ss`, ligatures): `matchRanges: []`, plain
  snippet, no crash, no mis-highlight.
- Very long bodies: snippet is a ±80-char window around the first match.
- Trigram index unusable (1–2 char token, or `word_similarity` with no
  substring hit): query still runs as a filtered scan; `offset` (<=300) and
  `limit` (<=50) caps bound the cost; in-conversation mode is naturally cheap.
- SQL: tokens are bound params; `%` / `_` escaped before `ILIKE`.
- Network / 500: hooks surface `isError`; global section -> `ErrorState`,
  in-conversation -> "No se pudo buscar" + retry. No throw into the list.
- Realtime: results are a point-in-time snapshot; re-running the query
  (keystroke / refocus) refreshes. Matches WhatsApp.

## Section 5 — Testing

### API (`node --test`, live DB, mirrors `apps/api/src/routes/chat/__tests__/`)

New `chat-search-service.test.js` seeding a conversation with known messages:

- accent-insensitive (`jose` -> "José"), partial word (`factur` -> "facturación")
- typo tolerance (`reunino` -> "reunión", `pyament` -> "payment")
- multi-word order-independent (`pago factura` matches "…la factura de ese pago…")
- sender-name and file-name hits
- membership scoping: non-member gets 0 rows; after `left_at` set, rows vanish
- deleted message excluded
- `conversationId` filter restricts to one conversation
- ranking: exact substring outranks fuzzy-only; ties break by recency
- `limit` / `offset` clamps; `offset > 300` rejected by validator
- empty / 1-char `q` -> `{ data: [] }`, not an error

### Migration

A test asserts the extensions and the three indexes exist after
`pnpm db:migrate`.

### Frontend

- `useChatMessageSearch` unit test: debounce, `enabled` gate at 2 chars.
- Manual QA at 390 px and 1440 px per the standing UI checklist: global
  results, jump-to-message flash, in-conversation prev/next across an off-page
  match, dark mode on the `<mark>` highlight.

## Verification

- **Plan A — Verified: 2026-09-02** (live self-hosted Supabase). Migration
  applied; `atlas_unaccent('JOSÉ Ñoño Reunión')` -> `jose nono reunion`;
  `word_similarity('reunino', '…reunion…')` = 0.625. Direct
  `chat-search-service` smoke against a seeded probe message:
  `factur` (accent+partial), `reunino` (typo), `factura pague` (multi-word any
  order), `jos` (sender/body fragment), and conversation-scoped search all
  return the probe; gibberish and blank return `{ data: [] }`; a non-member
  auth id does **not** see the probe (membership scoping holds). 13 service
  unit tests + full 196-test chat API suite green. Column-name deviations from
  the plan: `chat_conversations` uses `type` (not `kind`) and `avatar_url` /
  `avatar_emoji` (no `avatar_object_key`) — reflected in the service SELECT and
  the `conversation` payload (`type`, `avatarUrl`, `avatarEmoji`).
- **Plan B** — pending.

## Implementation plan split

Per the "split backend + frontend" rule, implementation is two plans:

- **Plan A (API)**: migration, `chat-search-service.js`, route, validator,
  SDK + desktop client method, `chat-search-service.test.js`, migration test.
- **Plan B (UI)**: `useChatMessageSearch.js`, sidebar "Mensajes" section,
  `?msg=` jump wiring in `ChatScreen` / `ChatWindow`, retry-budget bump in
  `ChatMessageList`, in-conversation search rewrite in `ChatWindow`, hook unit
  test.
