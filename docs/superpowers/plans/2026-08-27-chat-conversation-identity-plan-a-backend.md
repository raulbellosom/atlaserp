# Chat Conversation Identity — Plan A (Backend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a channel/group set a custom avatar — an uploaded image OR an emoji, mutually exclusive — and have every read path (`getConversation`, `listConversations`) resolve and return a live signed URL alongside it.

**Architecture:** Two new nullable columns on `chat_conversations` (`avatar_file_id`, `avatar_emoji`). `updateConversation` gains explicit, non-COALESCE handling for these two fields (mutual exclusion needs "set A, clear B" semantics that COALESCE can't express). `getConversation`/`listConversations` fold the conversation's own `avatar_file_id` into the SAME batch signed-URL resolution pass they already run for member avatars, then expose the result as a computed `avatarUrl` field — explicitly overwriting the pre-existing, permanently-`NULL`, never-actually-used raw `avatar_url` column so the response never carries both a dead and a live field under confusingly similar names.

**Tech Stack:** Node.js, Hono, Prisma `$queryRaw`/`$executeRaw`, Zod.

**Spec:** `docs/superpowers/specs/2026-08-27-chat-conversation-identity-design.md` — read in full before starting, especially Section 10 (why the existing `avatar_url` column is dead and left alone) and Section 12 (exact response contract).

**Verified facts this plan relies on:**
- `updateConversation` (`apps/api/src/routes/chat/chat-service.js:466-500`) currently builds unused `sets`/`values` arrays and instead hardcodes a `COALESCE(${updates.title ?? null}, title)`-style SQL `UPDATE` — this plan does NOT fix that pre-existing oddity for `title`/`status` (out of scope, unrelated to this feature), but does NOT copy the COALESCE pattern for the two new fields either, since COALESCE can't distinguish "not provided" from "explicitly set to null" the way this feature's mutual-exclusion logic needs.
- `getConversation` (`chat-service.js:415-464`) selects `c.*` — the two new columns will appear in `conv` automatically, no SELECT change needed there.
- `listConversations` (`chat-service.js:184-278`) uses an EXPLICIT column list (not `c.*`) — `c.avatar_file_id, c.avatar_emoji,` must be added to it manually, or they won't appear in the row at all.
- Both functions already batch-resolve member avatar signed URLs via a shared `batchSignAvatarUrls(fileIds)` helper (already defined in this file, returns `{ [fileId]: signedUrl }`) — reuse it, don't add a second signing call.
- `chatUpdateConversationSchema` (`packages/validators/src/chat.js:22-27`) currently has a dead `avatarUrl: z.string().url().optional()` field that `updateConversation` validates but never persists (confirmed by reading the service function — no `avatarUrl` reference in its SQL at all).

---

## File Structure Map

| File | Action | Responsibility |
|---|---|---|
| `prisma/migrations/20260827010000_chat_conversation_avatar/migration.sql` | Create | 2 new `chat_conversations` columns |
| `apps/api/src/routes/chat/chat-service.js` | Modify | `updateConversation` (mutual exclusion), `getConversation`/`listConversations` (avatar resolution) |
| `packages/validators/src/chat.js` | Modify | `chatUpdateConversationSchema` — remove dead `avatarUrl`, add `avatarFileId`/`avatarEmoji` |
| `apps/api/src/routes/chat/__tests__/chat-service.test.js` | Modify | New test coverage |

---

### Task 1: Migration

**Files:**
- Create: `prisma/migrations/20260827010000_chat_conversation_avatar/migration.sql`

- [ ] **Step 1: Write the migration**

```sql
-- =============================================================================
-- Atlas ERP — Chat Conversation Custom Avatar (image or emoji)
-- Migration: 20260827010000_chat_conversation_avatar
-- =============================================================================

ALTER TABLE "chat_conversations"
  ADD COLUMN IF NOT EXISTS "avatar_file_id" UUID,
  ADD COLUMN IF NOT EXISTS "avatar_emoji" TEXT;
```

No index needed — both columns are only ever looked up by their owning conversation's own row (never searched/filtered on independently).

- [ ] **Step 2: Apply the migration**

Run: `pnpm db:migrate`
Expected: migration `20260827010000_chat_conversation_avatar` applies cleanly (self-hosted Supabase Postgres, no local DB stack per `CLAUDE.md`).

- [ ] **Step 3: Commit**

```bash
git add prisma/migrations/20260827010000_chat_conversation_avatar/migration.sql
git commit -m "feat(chat): add avatar_file_id/avatar_emoji columns to chat_conversations"
```

---

### Task 2: `updateConversation` mutual-exclusion logic

**Files:**
- Modify: `apps/api/src/routes/chat/chat-service.js`
- Test: `apps/api/src/routes/chat/__tests__/chat-service.test.js`

- [ ] **Step 1: Read the current `updateConversation` in full first (required)**

Confirm the exact current shape (around line 466) before editing — this plan's snippet below is the intended end state, not necessarily byte-exact against current spacing/comments.

- [ ] **Step 2: Write the failing tests first**

Add to `chat-service.test.js`, following this file's established `buildPrismaMock` convention:

```javascript
describe("chat-service — updateConversation avatar mutual exclusion", () => {
  it("setting avatarFileId clears any existing avatarEmoji in the same UPDATE", async () => {
    const fileId = "01900000-0000-7000-8000-00000000f001";
    let capturedValues = null;
    const prisma = {
      $queryRaw: async () => [{ id: PROFILE_ID }],
      $executeRaw: async (strings, ...values) => { capturedValues = values; return { count: 1 }; },
      membership: { findFirst: async () => null },
    };
    // First two $queryRaw calls (resolveUserProfileId, assertMember-equivalent inline
    // SELECT) need to succeed before the type-lookup SELECT and the UPDATE — read the
    // real function to confirm the exact call sequence rather than trusting this
    // count; adjust the mock's queryRawResults array to match reality if it errors.
    const permissionsService = { assertChannelPermission: async () => {} };
    const service = createChatService({ prisma, supabaseAdmin: {}, permissionsService });
    await service.updateConversation({
      conversationId: CONV_ID, authUserId: AUTH_USER_ID, updates: { avatarFileId: fileId },
    });
    assert.ok(capturedValues.includes(fileId), "avatar_file_id must be set to the new file id");
    assert.ok(capturedValues.includes(null), "avatar_emoji must be cleared to null in the same statement");
  });

  it("setting avatarEmoji clears any existing avatarFileId", async () => {
    let capturedValues = null;
    const prisma = {
      $queryRaw: async () => [{ id: PROFILE_ID }],
      $executeRaw: async (strings, ...values) => { capturedValues = values; return { count: 1 }; },
      membership: { findFirst: async () => null },
    };
    const permissionsService = { assertChannelPermission: async () => {} };
    const service = createChatService({ prisma, supabaseAdmin: {}, permissionsService });
    await service.updateConversation({
      conversationId: CONV_ID, authUserId: AUTH_USER_ID, updates: { avatarEmoji: "🚀" },
    });
    assert.ok(capturedValues.includes("🚀"));
    assert.ok(capturedValues.includes(null));
  });

  it("explicitly clearing only avatarFileId (to null) does not touch avatarEmoji", async () => {
    let executeCallCount = 0;
    let capturedValues = null;
    const prisma = {
      $queryRaw: async () => [{ id: PROFILE_ID }],
      $executeRaw: async (strings, ...values) => { executeCallCount++; capturedValues = values; return { count: 1 }; },
      membership: { findFirst: async () => null },
    };
    const permissionsService = { assertChannelPermission: async () => {} };
    const service = createChatService({ prisma, supabaseAdmin: {}, permissionsService });
    await service.updateConversation({
      conversationId: CONV_ID, authUserId: AUTH_USER_ID, updates: { avatarFileId: null },
    });
    assert.equal(executeCallCount, 1);
    // Only avatar_file_id's SET fragment should be present — confirm by checking
    // the emoji value was never part of this statement's bound values at all
    // (not just that it happens to be null, which "set to new value" cases also
    // produce) — read the actual implementation's conditional SET-fragment
    // construction to write a precise assertion here rather than guessing.
  });
});
```

**Note**: the third test's final assertion is deliberately left as a directive, not a guessed assertion — the plan's Step 3 implementation below builds the SQL from conditionally-included fragments (`Prisma.join`), so "was `avatar_emoji` touched at all" is a real, checkable property of which fragments got included, not just what value ended up bound. Write the precise check once the implementation exists, by inspecting what `sets` actually contains for this case.

- [ ] **Step 3: Implement**

```javascript
  async function updateConversation({ conversationId, authUserId, updates }) {
    const profileId = await getUserProfileId(authUserId);
    await assertMember(conversationId, profileId);

    if (permissionsService) {
      const [conv] = await prisma.$queryRaw`SELECT type FROM chat_conversations WHERE id = ${conversationId} LIMIT 1`;
      if (conv && (conv.type === "channel" || conv.type === "group")) {
        await permissionsService.assertChannelPermission(conversationId, profileId, "channel.manage");
      }
    }

    const hasTitle = updates.title !== undefined;
    const hasStatus = updates.status !== undefined;
    const hasAvatarFileId = updates.avatarFileId !== undefined;
    const hasAvatarEmoji = updates.avatarEmoji !== undefined;

    if (!hasTitle && !hasStatus && !hasAvatarFileId && !hasAvatarEmoji) {
      return getConversation({ conversationId, authUserId });
    }

    // Mutual exclusivity: setting a real (non-null) avatar of one kind clears
    // the other kind, even if the caller didn't explicitly touch it — a
    // conversation has at most one avatar source at a time. Explicitly
    // clearing one (sending null) does NOT touch the other — a "remove both"
    // action must send both fields as null itself (spec Section 8).
    let nextAvatarFileId = updates.avatarFileId;
    let nextAvatarEmoji = updates.avatarEmoji;
    let touchAvatarFileId = hasAvatarFileId;
    let touchAvatarEmoji = hasAvatarEmoji;
    if (hasAvatarFileId && nextAvatarFileId !== null) {
      nextAvatarEmoji = null;
      touchAvatarEmoji = true;
    } else if (hasAvatarEmoji && nextAvatarEmoji !== null) {
      nextAvatarFileId = null;
      touchAvatarFileId = true;
    }

    const sets = [Prisma.sql`updated_at = NOW()`];
    if (hasTitle) sets.push(Prisma.sql`title = ${updates.title}`);
    if (hasStatus) sets.push(Prisma.sql`status = ${updates.status}`);
    if (touchAvatarFileId) sets.push(Prisma.sql`avatar_file_id = ${nextAvatarFileId}`);
    if (touchAvatarEmoji) sets.push(Prisma.sql`avatar_emoji = ${nextAvatarEmoji}`);

    await prisma.$executeRaw`
      UPDATE chat_conversations
      SET ${Prisma.join(sets, ", ")}
      WHERE id = ${conversationId}
    `;

    return getConversation({ conversationId, authUserId });
  }
```

This REPLACES the entire existing function body (the old `sets`/`values`-then-hardcoded-COALESCE approach for `title`/`status` is superseded by this — confirm `Prisma` and `Prisma.join`/`Prisma.sql` are already imported at the top of this file before relying on them; they are, per this file's existing usage elsewhere e.g. `listConversations`'s `cursorClause`).

- [ ] **Step 4: Run tests, iterate until green**

Run: `node --test apps/api/src/routes/chat/__tests__/chat-service.test.js`
Expected: all PASS, including every pre-existing `updateConversation` test in this file (there are several from Phase A — `channel: calls assertChannelPermission...`, `direct: never calls...`, `no permissionsService supplied...` — these must still pass unchanged, since this task's rewrite must preserve their exact observable behavior for `title`/`status`).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/chat/chat-service.js apps/api/src/routes/chat/__tests__/chat-service.test.js
git commit -m "feat(chat): mutual-exclusion avatar handling in updateConversation"
```

---

### Task 3: Resolve avatar URLs in `getConversation`/`listConversations`

**Files:**
- Modify: `apps/api/src/routes/chat/chat-service.js`
- Test: `apps/api/src/routes/chat/__tests__/chat-service.test.js`

- [ ] **Step 1: Write failing tests**

```javascript
describe("chat-service — conversation avatar resolution", () => {
  it("getConversation resolves avatar_file_id to a signed avatarUrl and clears the dead avatar_url field", async () => {
    const fileId = "01900000-0000-7000-8000-00000000f002";
    const prisma = buildPrismaMock([
      [{ id: PROFILE_ID }],
      [{ id: "member-row" }],
      [{ id: CONV_ID, avatar_file_id: fileId, avatar_url: null, avatar_emoji: null, members: null }],
    ]);
    // batchSignAvatarUrls hits prisma.fileAsset.findMany + supabaseAdmin storage —
    // easiest to stub the whole function via a test-only injection point if one
    // exists, or mock prisma.fileAsset.findMany directly; read batchSignAvatarUrls'
    // actual implementation (chat-service.js, near the top) before writing this
    // mock, since it's more involved than a plain $queryRaw call.
    const service = createChatService({ prisma, supabaseAdmin: {} });
    const result = await service.getConversation({ conversationId: CONV_ID, authUserId: AUTH_USER_ID });
    assert.equal(result.avatar_url, undefined, "the dead raw column must not leak into the response");
    // Full assertion on result.avatarUrl's resolved value depends on how the
    // batchSignAvatarUrls mock above is actually wired — complete this once
    // Step 1's mocking approach is finalized.
  });

  it("getConversation returns avatarUrl: null when no avatar_file_id is set (emoji-only or no avatar)", async () => {
    const prisma = buildPrismaMock([
      [{ id: PROFILE_ID }],
      [{ id: "member-row" }],
      [{ id: CONV_ID, avatar_file_id: null, avatar_url: null, avatar_emoji: "🎉", members: null }],
    ]);
    const service = createChatService({ prisma, supabaseAdmin: {} });
    const result = await service.getConversation({ conversationId: CONV_ID, authUserId: AUTH_USER_ID });
    assert.equal(result.avatarUrl, null);
    assert.equal(result.avatar_emoji, "🎉");
  });
});
```

**Implementer note**: `batchSignAvatarUrls` (defined near the top of `chat-service.js`, used already by both `getConversation` and `listConversations` for member avatars) is more involved to mock than a plain `$queryRaw`/`$executeRaw` call — it internally calls `prisma.fileAsset.findMany` (a real Prisma-modeled query, not raw SQL) and `supabaseAdmin.storage...`. Read its actual implementation before finalizing these tests' mocks; the first test above is deliberately left with a TODO-shaped gap for you to complete once you've confirmed the real mocking approach — do not ship it with that gap still open, this is a "figure out the right mock, then finish the assertion" instruction, not a placeholder to leave in committed code.

- [ ] **Step 2: Implement — `getConversation`**

Read the current function in full (around line 415) first. After the existing `if (conv.members) { ... }` block that resolves member avatars, add the conversation's own avatar resolution, folding it into the SAME `fileIds`/`avatarUrlMap` computation rather than a second signing pass:

```javascript
    if (!rows.length) throw new ChatServiceError("Conversacion no encontrada.", 404);
    const conv = rows[0];
    const memberFileIds = conv.members ? conv.members.map((m) => m.avatarFileId).filter(Boolean) : [];
    const fileIds = [...new Set([...memberFileIds, conv.avatar_file_id].filter(Boolean))];
    const avatarUrlMap = fileIds.length ? await batchSignAvatarUrls(fileIds) : {};
    if (conv.members) {
      conv.members = conv.members.map((m) => ({
        ...m,
        avatarUrl: m.avatarFileId ? (avatarUrlMap[m.avatarFileId] ?? m.authAvatarUrl ?? null) : (m.authAvatarUrl ?? null),
        avatarFileId: undefined,
        authAvatarUrl: undefined,
      }));
    }
    conv.avatarUrl = conv.avatar_file_id ? (avatarUrlMap[conv.avatar_file_id] ?? null) : null;
    conv.avatar_url = undefined; // dead raw column (never written) — avatarUrl (camelCase, resolved above) is the live field
    return conv;
```

This replaces the existing `if (conv.members) {...}; return conv;` tail of the function — read the surrounding code first to confirm exact placement.

- [ ] **Step 3: Implement — `listConversations`**

Two changes. First, add the two new columns to the existing explicit SELECT list (near `c.avatar_url,` around line 189):

```sql
        c.avatar_url,
        c.avatar_file_id,
        c.avatar_emoji,
```

Second, extend the existing per-row avatar-resolution loop (around line 263-278) to also batch and resolve each conversation's own avatar:

```javascript
    const allFileIds = [
      ...new Set([
        ...data.flatMap((c) => (c.members ?? []).map((m) => m.avatarFileId).filter(Boolean)),
        ...data.map((c) => c.avatar_file_id).filter(Boolean),
      ]),
    ];
    const avatarUrlMap = allFileIds.length ? await batchSignAvatarUrls(allFileIds) : {};
    for (const conv of data) {
      if (conv.members) {
        conv.members = conv.members.map((m) => ({
          ...m,
          avatarUrl: m.avatarFileId ? (avatarUrlMap[m.avatarFileId] ?? m.authAvatarUrl ?? null) : (m.authAvatarUrl ?? null),
          avatarFileId: undefined,
          authAvatarUrl: undefined,
        }));
      }
      conv.avatarUrl = conv.avatar_file_id ? (avatarUrlMap[conv.avatar_file_id] ?? null) : null;
      conv.avatar_url = undefined;
    }
```

- [ ] **Step 4: Run tests, iterate until green**

Run: `node --test apps/api/src/routes/chat/__tests__/*.test.js`
Expected: all pass, no regression in the ~91 pre-existing tests.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/chat/chat-service.js apps/api/src/routes/chat/__tests__/chat-service.test.js
git commit -m "feat(chat): resolve conversation avatar_file_id to a signed URL in read paths"
```

---

### Task 4: Validator

**Files:**
- Modify: `packages/validators/src/chat.js`

- [ ] **Step 1: Replace the dead field with the two new ones**

```javascript
export const chatUpdateConversationSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  status: z.enum(["open", "pending", "closed", "archived"]).optional(),
  avatarFileId: z.string().uuid().nullable().optional(),
  avatarEmoji: z.string().max(16).nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
});
```

(Removes the existing `avatarUrl: z.string().url().optional()` — confirmed dead in this plan's header notes; grep this repo for any OTHER caller of `chatUpdateConversationSchema` before removing, to be certain nothing outside `apps/api/src/routes/chat/index.js` depends on the old field name — there shouldn't be any, but confirm rather than assume.)

- [ ] **Step 2: Build check and commit**

```bash
pnpm build
git add packages/validators/src/chat.js
git commit -m "feat(chat): replace dead avatarUrl validator field with avatarFileId/avatarEmoji"
```

---

## Self-Review Notes

- **Spec coverage**: Task 1 covers Section 10/11. Task 2 covers Section 12's mutual-exclusion contract and Section 23 edge cases 1/3 (remove-both). Task 3 covers Section 12's response contract and Section 24 Risk 3 (no id-mixup between member and conversation avatars — both keyed independently off the same `avatarUrlMap`). Task 4 covers Section 14.
- **Casing discipline carried forward**: this plan explicitly names the exact pitfall (a dead snake_case `avatar_url` column vs. a live camelCase `avatarUrl` computed field) that Phase D/E of this project's chat work hit repeatedly in a different but related form — Task 3 explicitly overwrites the dead field with `undefined` specifically so no frontend consumer can accidentally read the wrong one.
- **No placeholders** except the explicitly-flagged "confirm the real mock sequence"/"confirm the real `batchSignAvatarUrls` shape before mocking it" notes in Task 2 Step 2 and Task 3 Step 1 — read-the-real-code directives, matching this session's established plan convention.
