# Chat Message Search — Plan A (API) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Postgres `pg_trgm` fuzzy message-search endpoint to atlas.chat — `GET /chat/search/messages` — scoped to the caller's conversation memberships, covering accent/partial/typo/multi-word matching over message body, sender name, and attachment file names.

**Architecture:** New raw-SQL migration adds `pg_trgm` + `unaccent`, an IMMUTABLE `atlas_unaccent()` wrapper, a stored `chat_messages.body_norm` generated column with a GIN trigram index, plus expression trigram indexes on `user_profile.display_name` and `chat_attachments.file_name`. A new `chat-search-service.js` builds the tokenised trigram query; a thin route in `chat/index.js` exposes it; a shared validator and SDK method complete the contract.

**Tech Stack:** Node.js, Hono, Prisma 7 `$queryRaw` tagged templates, Postgres `pg_trgm`/`unaccent`, Zod (`@atlas/validators`), `node --test`.

**Spec:** `docs/superpowers/specs/2026-09-02-chat-message-search-design.md`

---

## File Structure

- **Create** `prisma/migrations/20260902000000_chat_message_search/migration.sql` — extensions, `atlas_unaccent`, `body_norm` column + 3 trigram indexes.
- **Create** `apps/api/src/routes/chat/chat-search-service.js` — `createChatSearchService({ prisma })` → `searchMessages(...)`. Owns tokenisation, the trigram SQL, ranking, and `matchRanges` computation.
- **Create** `apps/api/src/routes/chat/__tests__/chat-search-service.test.js` — mocked-prisma unit tests (matches the existing chat test convention).
- **Modify** `apps/api/src/routes/chat/index.js` — instantiate `chatSearchService`, add `GET /search/messages` (~14 lines).
- **Modify** `packages/validators/src/index.js` (or the chat validator module it re-exports) — add `chatMessageSearchQuerySchema`.
- **Modify** `packages/sdk/src/domains/chat.js` — add `searchMessages(params, token)`.

---

## Task 1: Migration

**Files:**
- Create: `prisma/migrations/20260902000000_chat_message_search/migration.sql`

- [ ] **Step 1: Write the migration SQL**

Create `prisma/migrations/20260902000000_chat_message_search/migration.sql`:

```sql
-- =============================================================================
-- Atlas ERP — Chat message search (pg_trgm fuzzy search)
-- Migration: 20260902000000_chat_message_search
-- Adds trigram infrastructure so /chat/search/messages can match message body,
-- sender display name, and attachment file names accent-insensitively, by
-- partial word, and with typo tolerance (word_similarity).
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- unaccent() is only STABLE (it depends on the text-search config resolved at
-- call time), so it cannot be used in a generated column or an index. Pinning
-- the dictionary with ::regdictionary makes this wrapper genuinely IMMUTABLE.
CREATE OR REPLACE FUNCTION atlas_unaccent(text)
  RETURNS text
  LANGUAGE sql
  IMMUTABLE PARALLEL SAFE STRICT
  AS $$ SELECT unaccent('unaccent'::regdictionary, $1) $$;

-- Normalised body: lower-cased, accent-stripped. STORED (not an expression
-- index) because the search service reads it back to compute match offsets for
-- the highlighted snippet.
ALTER TABLE "chat_messages"
  ADD COLUMN IF NOT EXISTS "body_norm" text
    GENERATED ALWAYS AS (atlas_unaccent(lower("body"))) STORED;

CREATE INDEX IF NOT EXISTS "chat_messages_body_norm_trgm_idx"
  ON "chat_messages" USING gin ("body_norm" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "user_profile_display_name_trgm_idx"
  ON "user_profile" USING gin (atlas_unaccent(lower("display_name")) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "chat_attachments_file_name_trgm_idx"
  ON "chat_attachments" USING gin (atlas_unaccent(lower("file_name")) gin_trgm_ops);
```

- [ ] **Step 2: Apply the migration**

Run: `pnpm db:migrate`
Expected: `prisma migrate deploy` reports `20260902000000_chat_message_search` applied, then `prisma generate` succeeds.

If it errors with `text search dictionary "unaccent" does not exist`, the extension landed in a non-default schema — change both `unaccent('unaccent'::regdictionary, $1)` and the two expression indexes to `extensions.unaccent(...)` / schema-qualify the dictionary, and re-run.

- [ ] **Step 3: Verify the objects exist**

Run:
```bash
node -e "const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();(async()=>{const r=await p.\$queryRawUnsafe(\"select indexname from pg_indexes where indexname in ('chat_messages_body_norm_trgm_idx','user_profile_display_name_trgm_idx','chat_attachments_file_name_trgm_idx') order by 1\");console.log(r);const c=await p.\$queryRawUnsafe(\"select column_name from information_schema.columns where table_name='chat_messages' and column_name='body_norm'\");console.log(c);await p.\$disconnect()})()"
```
Expected: all three index names listed, and `body_norm` column present.

- [ ] **Step 4: Commit**

```bash
git add prisma/migrations/20260902000000_chat_message_search/migration.sql
git commit -m "feat(chat): trigram search migration — body_norm + gin indexes"
```

---

## Task 2: `chat-search-service.js`

**Files:**
- Create: `apps/api/src/routes/chat/chat-search-service.js`

- [ ] **Step 1: Write the service**

Create `apps/api/src/routes/chat/chat-search-service.js`:

```js
import { Prisma } from "@prisma/client";
import { ChatServiceError } from "./chat-service-error.js";
import { resolveUserProfileId } from "./chat-service.js";

const MAX_TOKENS = 6;
const MIN_TOKEN_LEN = 2;
const SIMILARITY_THRESHOLD = 0.3; // word_similarity floor for typo tolerance; tunable
const MAX_LIMIT = 50;
const MAX_OFFSET = 300;
const SNIPPET_RADIUS = 80;

// JS-side mirror of the SQL atlas_unaccent(lower(x)): lower-case + strip the
// Latin-1 / Latin Extended-A combining diacritics Postgres unaccent removes.
// Length-preserving for every code point we normalise here (each mapped char is
// a single BMP char), which is what lets match offsets line up with `body_norm`.
export function normalizeForSearch(input) {
  return (input ?? "")
    .toString()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .normalize("NFC")
    .toLowerCase();
}

export function tokenizeQuery(raw) {
  const norm = normalizeForSearch(raw).trim();
  if (!norm) return [];
  const parts = norm.split(/\s+/).filter(Boolean);
  const long = parts.filter((t) => t.length >= MIN_TOKEN_LEN);
  const chosen = (long.length ? long : parts.slice(0, 1)).slice(0, MAX_TOKENS);
  // De-dupe while preserving order.
  return [...new Set(chosen)];
}

function escapeLike(token) {
  return token.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

// Compute [start,end] match ranges on the ORIGINAL body by scanning its
// normalised form for each token. Returns [] if normalisation changed the
// string length (e.g. the German eszett expands to "ss"), so the caller shows
// the plain snippet instead of a mis-aligned highlight.
export function computeMatchRanges(body, tokens) {
  const norm = normalizeForSearch(body);
  if (norm.length !== (body ?? "").length) return [];
  const ranges = [];
  for (const tok of tokens) {
    let from = 0;
    let idx = norm.indexOf(tok, from);
    while (idx !== -1) {
      ranges.push([idx, idx + tok.length]);
      from = idx + tok.length;
      idx = norm.indexOf(tok, from);
    }
  }
  if (!ranges.length) return [];
  // Merge overlapping / adjacent ranges.
  ranges.sort((a, b) => a[0] - b[0]);
  const merged = [ranges[0].slice()];
  for (let i = 1; i < ranges.length; i += 1) {
    const last = merged[merged.length - 1];
    if (ranges[i][0] <= last[1]) last[1] = Math.max(last[1], ranges[i][1]);
    else merged.push(ranges[i].slice());
  }
  return merged;
}

export function createChatSearchService({ prisma }) {
  async function searchMessages({
    authUserId,
    q,
    conversationId = null,
    limit = 30,
    offset = 0,
  }) {
    const tokens = tokenizeQuery(q);
    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 30, 1), MAX_LIMIT);
    const safeOffset = Math.min(Math.max(parseInt(offset, 10) || 0, 0), MAX_OFFSET);

    if (!tokens.length) return { data: [], truncated: false };

    const profileId = await resolveUserProfileId(prisma, authUserId);

    // Per-token predicate: substring OR typo-similarity, against body / sender
    // name / any attachment file name. AND across tokens => order-independent.
    const tokenConds = tokens.map((tok) => {
      const like = `%${escapeLike(tok)}%`;
      return Prisma.sql`(
        m.body_norm ILIKE ${like}
        OR word_similarity(${tok}, m.body_norm) > ${SIMILARITY_THRESHOLD}
        OR up.name_norm ILIKE ${like}
        OR word_similarity(${tok}, up.name_norm) > ${SIMILARITY_THRESHOLD}
        OR EXISTS (
          SELECT 1 FROM chat_attachments a
          WHERE a.message_id = m.id
            AND (
              atlas_unaccent(lower(a.file_name)) ILIKE ${like}
              OR word_similarity(${tok}, atlas_unaccent(lower(a.file_name))) > ${SIMILARITY_THRESHOLD}
            )
        )
      )`;
    });
    const whereTokens = Prisma.join(tokenConds, " AND ");

    // score = sum over tokens of GREATEST(substring hit ? 1 : 0, word_similarity)
    const scoreTerms = tokens.map(
      (tok) => Prisma.sql`GREATEST(
        CASE WHEN m.body_norm ILIKE ${`%${escapeLike(tok)}%`} THEN 1.0 ELSE 0 END,
        word_similarity(${tok}, m.body_norm)
      )`,
    );
    const scoreExpr = Prisma.join(scoreTerms, " + ");

    const convFilter = conversationId
      ? Prisma.sql`AND m.conversation_id = ${conversationId}::uuid`
      : Prisma.empty;

    const rows = await prisma.$queryRaw`
      SELECT
        m.id            AS message_id,
        m.conversation_id,
        m.body,
        m.created_at,
        m.sender_user_id,
        up.display_name AS sender_name,
        conv.title      AS conversation_title,
        conv.kind       AS conversation_kind,
        conv.avatar_object_key AS conversation_avatar_key,
        (${scoreExpr})  AS score
      FROM chat_messages m
      JOIN chat_conversation_members cm
        ON cm.conversation_id = m.conversation_id
       AND cm.user_id = ${profileId}::uuid
       AND cm.left_at IS NULL
      JOIN chat_conversations conv ON conv.id = m.conversation_id
      LEFT JOIN LATERAL (
        SELECT display_name,
               atlas_unaccent(lower(coalesce(display_name, ''))) AS name_norm
        FROM user_profile WHERE id = m.sender_user_id
      ) up ON true
      WHERE m.deleted_at IS NULL
        ${convFilter}
        AND (${whereTokens})
      ORDER BY score DESC, m.created_at DESC
      LIMIT ${safeLimit + 1} OFFSET ${safeOffset}
    `;

    const truncated = rows.length > safeLimit;
    const page = truncated ? rows.slice(0, safeLimit) : rows;

    const data = page.map((r) => ({
      messageId: r.message_id,
      conversationId: r.conversation_id,
      conversation: {
        id: r.conversation_id,
        title: r.conversation_title,
        kind: r.conversation_kind,
        avatarObjectKey: r.conversation_avatar_key ?? null,
      },
      sender: { id: r.sender_user_id, displayName: r.sender_name ?? null },
      body: r.body ?? "",
      matchRanges: computeMatchRanges(r.body ?? "", tokens),
      createdAt: r.created_at,
      score: Number(r.score),
    }));

    return { data, truncated };
  }

  return { searchMessages };
}

export { ChatServiceError };
```

- [ ] **Step 2: Static check**

Run: `node --check apps/api/src/routes/chat/chat-search-service.js`
Expected: no output (exit 0).

- [ ] **Step 3: Verify column/table names used exist**

Run:
```bash
node -e "const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();(async()=>{const r=await p.\$queryRawUnsafe(\"select table_name, column_name from information_schema.columns where (table_name='chat_conversations' and column_name in ('title','kind','avatar_object_key')) or (table_name='chat_messages' and column_name in ('deleted_at','sender_user_id','body')) order by 1,2\");console.log(r);await p.\$disconnect()})()"
```
Expected: `chat_conversations` has `title`, `kind`, `avatar_object_key`; `chat_messages` has `body`, `deleted_at`, `sender_user_id`.
If `avatar_object_key` / `kind` differ, adjust the SELECT + mapping to the real column names (grep `20260827010000_chat_conversation_avatar` and `20260825000000_chat_channels_roles` migrations).

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/routes/chat/chat-search-service.js
git commit -m "feat(chat): chat-search-service — tokenised pg_trgm message search"
```

---

## Task 3: Service unit tests

**Files:**
- Create: `apps/api/src/routes/chat/__tests__/chat-search-service.test.js`

- [ ] **Step 1: Write the tests**

Create `apps/api/src/routes/chat/__tests__/chat-search-service.test.js`:

```js
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  createChatSearchService,
  tokenizeQuery,
  normalizeForSearch,
  computeMatchRanges,
} from "../chat-search-service.js";
import { _resetProfileIdCacheForTests } from "../chat-service.js";

const AUTH_USER_ID = "auth-user-1";
const PROFILE_ID = "01900000-0000-7000-8000-0000000000p1";

beforeEach(() => _resetProfileIdCacheForTests());

function mockPrisma(searchRows = []) {
  let call = 0;
  return {
    _lastSql: null,
    $queryRaw: async (strings, ...values) => {
      call += 1;
      if (call === 1) return [{ id: PROFILE_ID }]; // resolveUserProfileId
      return searchRows;
    },
  };
}

describe("normalizeForSearch", () => {
  it("lowercases and strips accents", () => {
    assert.equal(normalizeForSearch("José REUNIÓN"), "jose reunion");
  });
});

describe("tokenizeQuery", () => {
  it("splits on whitespace and drops <2 char tokens", () => {
    assert.deepEqual(tokenizeQuery("  pago  a  factura "), ["pago", "factura"]);
  });
  it("keeps a lone 1-char query", () => {
    assert.deepEqual(tokenizeQuery("x"), ["x"]);
  });
  it("caps at 6 tokens and de-dupes", () => {
    assert.deepEqual(tokenizeQuery("a a b c d e f g h"), ["b", "c", "d", "e", "f", "g"]);
  });
  it("returns [] for empty / whitespace", () => {
    assert.deepEqual(tokenizeQuery("   "), []);
    assert.deepEqual(tokenizeQuery(""), []);
  });
});

describe("computeMatchRanges", () => {
  it("finds accent-insensitive offsets on the original body", () => {
    assert.deepEqual(computeMatchRanges("La reunión de hoy", ["reunion"]), [[3, 10]]);
  });
  it("merges overlapping ranges from multiple tokens", () => {
    assert.deepEqual(computeMatchRanges("factura factura", ["factura", "fact"]), [[0, 7], [8, 15]]);
  });
  it("returns [] when the token does not appear literally after JS normalisation", () => {
    // Postgres unaccent expands eszett to "ss"; the JS normaliser does not, so
    // "strasse" is simply not found in "straße" and no (mis-aligned) range is
    // emitted — the caller falls back to the plain snippet.
    assert.deepEqual(computeMatchRanges("straße", ["strasse"]), []);
  });
  it("returns [] when no token matches", () => {
    assert.deepEqual(computeMatchRanges("hello world", ["zzz"]), []);
  });
});

describe("searchMessages", () => {
  it("returns empty without hitting the DB for a blank query", async () => {
    const prisma = mockPrisma();
    const svc = createChatSearchService({ prisma });
    const out = await svc.searchMessages({ authUserId: AUTH_USER_ID, q: "  " });
    assert.deepEqual(out, { data: [], truncated: false });
  });

  it("shapes rows and computes matchRanges", async () => {
    const prisma = mockPrisma([
      {
        message_id: "m1",
        conversation_id: "c1",
        body: "Pagué la factura",
        created_at: "2026-09-01T10:00:00.000Z",
        sender_user_id: "u1",
        sender_name: "Ana",
        conversation_title: "Finanzas",
        conversation_kind: "group",
        conversation_avatar_key: null,
        score: 1.5,
      },
    ]);
    const svc = createChatSearchService({ prisma });
    const out = await svc.searchMessages({ authUserId: AUTH_USER_ID, q: "factura" });
    assert.equal(out.data.length, 1);
    assert.equal(out.data[0].messageId, "m1");
    assert.equal(out.data[0].conversation.title, "Finanzas");
    assert.equal(out.data[0].sender.displayName, "Ana");
    assert.deepEqual(out.data[0].matchRanges, [[9, 16]]);
    assert.equal(out.truncated, false);
  });

  it("flags truncated when the DB returns limit+1 rows", async () => {
    const many = Array.from({ length: 4 }, (_, i) => ({
      message_id: `m${i}`, conversation_id: "c1", body: "factura", created_at: "2026-09-01T10:00:00.000Z",
      sender_user_id: "u1", sender_name: "Ana", conversation_title: "F", conversation_kind: "group",
      conversation_avatar_key: null, score: 1,
    }));
    const svc = createChatSearchService({ prisma: mockPrisma(many) });
    const out = await svc.searchMessages({ authUserId: AUTH_USER_ID, q: "factura", limit: 3 });
    assert.equal(out.data.length, 3);
    assert.equal(out.truncated, true);
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `node --test apps/api/src/routes/chat/__tests__/chat-search-service.test.js`
Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/routes/chat/__tests__/chat-search-service.test.js
git commit -m "test(chat): chat-search-service unit tests"
```

---

## Task 4: Route + wiring

**Files:**
- Modify: `apps/api/src/routes/chat/index.js`

- [ ] **Step 1: Import the factory**

In `apps/api/src/routes/chat/index.js`, after the line
`import { createChannelDirectoryService } from "./channel-directory-service.js";`
add:

```js
import { createChatSearchService } from "./chat-search-service.js";
```

- [ ] **Step 2: Instantiate the service**

After `const moderationService = createChatModerationService({ prisma });` add:

```js
  const chatSearchService = createChatSearchService({ prisma });
```

- [ ] **Step 3: Add the route**

Immediately after the `GET /chat/conversations` handler block (the one that
calls `chatService.listConversations`), add:

```js
  // GET /chat/search/messages — fuzzy message search across the caller's
  // conversations (or one, with ?conversationId=).
  internal.get("/search/messages", requirePermission("chat.conversations.read"), async (c) => {
    try {
      const authUserId = c.get("authUserId");
      const { q, conversationId, limit, offset } = c.req.query();
      const result = await chatSearchService.searchMessages({
        authUserId,
        q: q ?? "",
        conversationId: conversationId || null,
        limit,
        offset,
      });
      return c.json(result);
    } catch (err) {
      return handleError(c, err, "Error buscando mensajes.");
    }
  });
```

- [ ] **Step 4: Static check + full chat suite**

Run: `node --check apps/api/src/routes/chat/index.js`
Expected: exit 0.

Run: `node --test apps/api/src/routes/chat/__tests__/`
Expected: all pass (no regressions).

- [ ] **Step 5: Confirm file stays under 1000 lines**

Run: `wc -l apps/api/src/routes/chat/index.js`
Expected: < 1000. (Was 948; this adds ~22.)

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes/chat/index.js
git commit -m "feat(chat): GET /chat/search/messages route"
```

---

## Task 5: Validator

**Files:**
- Modify: the chat section of `packages/validators` (grep for `chatPinMessageSchema` to find the file).

- [ ] **Step 1: Find the file**

Run: `grep -rl "chatPinMessageSchema" packages/validators/src`

- [ ] **Step 2: Add the schema**

In that file, near the other chat schemas, add and export:

```js
export const chatMessageSearchQuerySchema = z.object({
  q: z.string().max(200).optional().default(""),
  conversationId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional().default(30),
  offset: z.coerce.number().int().min(0).max(300).optional().default(0),
});
```

If that file does not re-export from a barrel automatically, add
`chatMessageSearchQuerySchema` to whatever export list `packages/validators/src/index.js` uses (grep `chatPinMessageSchema` there too).

- [ ] **Step 3: Wire it into the route**

Back in `apps/api/src/routes/chat/index.js`, add `chatMessageSearchQuerySchema`
to the existing `@atlas/validators` import block, and replace the raw
`c.req.query()` destructuring in the search handler with:

```js
      const parsed = chatMessageSearchQuerySchema.safeParse(c.req.query());
      if (!parsed.success) {
        return c.json({ error: "Parametros de busqueda invalidos." }, 422);
      }
      const { q, conversationId, limit, offset } = parsed.data;
```

- [ ] **Step 4: Check + test**

Run: `node --check apps/api/src/routes/chat/index.js`
Run: `pnpm --filter @atlas/validators test` (skip if the package has no test script) else `node --check` the modified validator file.
Run: `node --test apps/api/src/routes/chat/__tests__/`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add packages/validators apps/api/src/routes/chat/index.js
git commit -m "feat(chat): chatMessageSearchQuerySchema + route validation"
```

---

## Task 6: SDK method

**Files:**
- Modify: `packages/sdk/src/domains/chat.js`

- [ ] **Step 1: Add the method**

In `packages/sdk/src/domains/chat.js`, right after the `listMessages` method
(around line 116), add:

```js
    // Fuzzy message search. `params`: { q, conversationId?, limit?, offset? }.
    // Omit conversationId for a global search across the caller's conversations.
    searchMessages: (params, token) =>
      request(`/chat/search/messages${toQueryString(params)}`, {
        headers: withAuthHeaders(token),
      }),
```

- [ ] **Step 2: Check**

Run: `node --check packages/sdk/src/domains/chat.js`
Expected: exit 0.

Run: `pnpm --filter @atlas/sdk test` (skip if no test script).

- [ ] **Step 3: Commit**

```bash
git add packages/sdk/src/domains/chat.js
git commit -m "feat(sdk): chat.searchMessages"
```

---

## Task 7: Full verification

- [ ] **Step 1: Lint**

Run: `pnpm lint`
Expected: no new errors. (The `no-restricted-syntax` guardrail only bans
`toISOString().slice`; this plan introduces none.)

- [ ] **Step 2: Full API chat + service tests**

Run: `node --test apps/api/src/routes/chat/__tests__/ apps/api/src/services/__tests__/`
Expected: all pass.

- [ ] **Step 3: Manual live-DB smoke (fuzzy behaviour)**

The matching logic is in Postgres, and the API test suite is mocked-only, so
verify the SQL by hand. Start the API (`pnpm dev:api`), get a bearer token for
a user who is a member of at least one conversation containing a message such
as "Pagué la factura de la reunión". Then:

```bash
# accent + partial word
curl -s "http://localhost:4010/chat/search/messages?q=factur" -H "Authorization: Bearer $ATLAS_TOKEN"
# typo
curl -s "http://localhost:4010/chat/search/messages?q=reunino" -H "Authorization: Bearer $ATLAS_TOKEN"
# multi-word any order
curl -s "http://localhost:4010/chat/search/messages?q=factura%20pague" -H "Authorization: Bearer $ATLAS_TOKEN"
# scoped to one conversation
curl -s "http://localhost:4010/chat/search/messages?q=factura&conversationId=<CONV_ID>" -H "Authorization: Bearer $ATLAS_TOKEN"
```

Expected: the first three each return the message in `data`; `matchRanges` is a
non-empty array for the accent/partial and multi-word cases; a query for a
string in a conversation the user is NOT a member of returns `{ data: [] }`.
Record the results in the spec's verification note with `Verified: 2026-09-02`.

- [ ] **Step 4: Final commit (if any test fixups were needed)**

```bash
git add -A && git commit -m "chore(chat): search API verification fixups" || echo "nothing to commit"
```
