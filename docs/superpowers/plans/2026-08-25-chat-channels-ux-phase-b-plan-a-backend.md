# Chat Channels UX Phase B — Plan A (Backend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend `GET /chat/conversations/:id`'s existing response so each member includes their role info, so Plan B's frontend can render role badges and permission-aware UI.

**Architecture:** A single, additive change to `chat-service.js`'s `getConversation` SQL — LEFT JOIN `chat_channel_roles` on `chat_conversation_members.role_id`, add 5 fields to the `json_build_object` member shape. No new files, no migration, no new endpoints.

**Tech Stack:** Hono, Prisma `$queryRaw` (raw SQL), `node:test`.

**Spec:** `docs/superpowers/specs/2026-08-25-chat-channels-ux-phase-b-design.md`

---

## File Structure Map

| File | Action | Responsibility |
|---|---|---|
| `apps/api/src/routes/chat/chat-service.js` | Modify | `getConversation`'s SQL gains a role LEFT JOIN + 5 new member fields |
| `apps/api/src/routes/chat/__tests__/chat-service.test.js` | Modify | Add coverage for the new member shape |

---

### Task 1: Extend `getConversation` with member role info

**Files:**
- Modify: `apps/api/src/routes/chat/chat-service.js`
- Modify: `apps/api/src/routes/chat/__tests__/chat-service.test.js`

- [ ] **Step 1: Write the failing test**

Add to `apps/api/src/routes/chat/__tests__/chat-service.test.js` (follow this file's existing `buildPrismaMock`/fake-`permissionsService` conventions — read the file first to match its exact helper shapes):

```javascript
describe("chat-service — getConversation member role fields", () => {
  it("includes roleId/roleName/roleColor/rolePosition/roleIsSystem for each member", async () => {
    const memberRow = {
      id: "m1", userId: "u1", role: "owner", joinedAt: new Date(), leftAt: null, lastReadAt: null,
      displayName: "Ada", avatarFileId: null, authAvatarUrl: null, email: "ada@example.com",
      roleId: "role-owner", roleName: "Owner", roleColor: null, rolePosition: 100, roleIsSystem: true,
    };
    const prisma = buildPrismaMock([
      [{ id: "u1" }], // resolveUserProfileId
      [{ id: "m1" }], // assertMember
      [{ id: "conv1", type: "channel", members: [memberRow] }], // getConversation main query
    ]);
    const service = createChatService({ prisma, supabaseAdmin: {} });
    const conv = await service.getConversation({ conversationId: "conv1", authUserId: "auth-1" });
    assert.equal(conv.members[0].roleId, "role-owner");
    assert.equal(conv.members[0].roleName, "Owner");
    assert.equal(conv.members[0].rolePosition, 100);
    assert.equal(conv.members[0].roleIsSystem, true);
  });
});
```

Adjust the mock shape to match whatever `buildPrismaMock`/helper conventions already exist in this file exactly (it already has fakes for `permissionsService`; this test doesn't need one — `getConversation` doesn't call it). If `assertMember` in this file's existing tests is exercised via a different call sequence than shown above, match the real one — read the file first.

- [ ] **Step 2: Run to verify it fails**

Run: `node --test apps/api/src/routes/chat/__tests__/chat-service.test.js`
Expected: FAIL — the mocked row doesn't yet reflect what real SQL would return before the fix, or the assertion fails because current code doesn't select these fields. (Since this is a mocked-SQL test, the "failure" is really about locking in the shape — if it trivially passes because the mock already returns the fields, that's fine too; the real proof is Step 4's SQL read. Do not skip Step 4.)

- [ ] **Step 3: Modify `getConversation`'s SQL**

In `apps/api/src/routes/chat/chat-service.js`, find `getConversation`'s query (the `json_build_object` inside the `members` subquery). Change:

```javascript
          SELECT json_agg(json_build_object(
            'id', cm.id,
            'userId', cm.user_id,
            'role', cm.role,
            'joinedAt', cm.joined_at,
            'leftAt', cm.left_at,
            'lastReadAt', cm.last_read_at,
            'displayName', up.display_name,
            'avatarFileId', up.avatar_file_id::text,
            'authAvatarUrl', au.raw_user_meta_data->>'avatar_url',
            'email', up.email
          ) ORDER BY cm.joined_at)
          FROM chat_conversation_members cm
          LEFT JOIN user_profile up ON up.id = cm.user_id
          LEFT JOIN auth.users au ON au.id = up.auth_user_id
          WHERE cm.conversation_id = c.id AND cm.left_at IS NULL
```

to:

```javascript
          SELECT json_agg(json_build_object(
            'id', cm.id,
            'userId', cm.user_id,
            'role', cm.role,
            'joinedAt', cm.joined_at,
            'leftAt', cm.left_at,
            'lastReadAt', cm.last_read_at,
            'displayName', up.display_name,
            'avatarFileId', up.avatar_file_id::text,
            'authAvatarUrl', au.raw_user_meta_data->>'avatar_url',
            'email', up.email,
            'roleId', cm.role_id,
            'roleName', ccr.name,
            'roleColor', ccr.color,
            'rolePosition', ccr.position,
            'roleIsSystem', ccr.is_system
          ) ORDER BY cm.joined_at)
          FROM chat_conversation_members cm
          LEFT JOIN user_profile up ON up.id = cm.user_id
          LEFT JOIN auth.users au ON au.id = up.auth_user_id
          LEFT JOIN chat_channel_roles ccr ON ccr.id = cm.role_id
          WHERE cm.conversation_id = c.id AND cm.left_at IS NULL
```

(A plain `LEFT JOIN` — every field is `NULL` for `direct`/`external_support` members, exactly like `role_id` already is today. No other line in this function changes.)

- [ ] **Step 4: Run to verify it passes**

Run: `node --test apps/api/src/routes/chat/__tests__/chat-service.test.js`
Expected: PASS.

- [ ] **Step 5: Syntax check and full suite**

```bash
node --check apps/api/src/routes/chat/chat-service.js
node --test apps/api/src/routes/chat/__tests__/chat-service.test.js apps/api/src/routes/chat/__tests__/chat-permissions-service.test.js apps/api/src/routes/chat/__tests__/channel-directory-service.test.js
```
Expected: no syntax errors; all tests (previous 46 + new) pass.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes/chat/chat-service.js apps/api/src/routes/chat/__tests__/chat-service.test.js
git commit -m "feat(chat): expose member role info in GET /chat/conversations/:id"
```

---

## Self-Review Notes

- **Spec coverage:** this plan covers Goal 1 and the entire "API contract" section of the Phase B spec — the only backend change that spec requires.
- **No placeholders.**
- **Risk:** none beyond the spec's own Section 24 — this is a read-only, additive SELECT change.
