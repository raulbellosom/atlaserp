# Chat Mentions Phase C — Plan A (Backend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Parse, classify, permission-gate, store, and notify chat mentions (@user, @role, @everyone, @here) inside `sendMessage`.

**Architecture:** A new sibling service, `chat-mentions-service.js` (following the same pattern as `chat-permissions-service.js`/`channel-directory-service.js`), exposes a pure-ish `resolveMentions(...)` function reusing the already-existing, already-shared `apps/api/src/lib/mention-utils.js#parseMentionIds`. `chat-service.js`'s `sendMessage` gets a small, surgical extension to call it, store the result in `metadata.mentions`, and fan out a distinct `chat.mention.new` notification.

**Tech Stack:** Hono, Prisma `$queryRaw` (raw SQL), `node:test`.

**Spec:** `docs/superpowers/specs/2026-08-25-chat-mentions-phase-c-design.md`

---

## File Structure Map

| File | Action | Responsibility |
|---|---|---|
| `apps/api/src/routes/chat/chat-mentions-service.js` | Create | `EVERYONE_MENTION_ID`/`HERE_MENTION_ID` sentinels, `resolveMentions(...)` |
| `apps/api/src/routes/chat/__tests__/chat-mentions-service.test.js` | Create | Unit tests |
| `apps/api/src/routes/chat/chat-service.js` | Modify | `sendMessage` calls `resolveMentions`, stores `metadata.mentions`, fires `chat.mention.new` |
| `apps/api/src/routes/chat/index.js` | Modify | Instantiate and inject `mentionsService` into `createChatService` |

---

### Task 1: `chat-mentions-service.js`

**Files:**
- Create: `apps/api/src/routes/chat/chat-mentions-service.js`
- Create: `apps/api/src/routes/chat/__tests__/chat-mentions-service.test.js`

- [ ] **Step 1: Write the failing tests**

```javascript
// apps/api/src/routes/chat/__tests__/chat-mentions-service.test.js
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  createChatMentionsService,
  EVERYONE_MENTION_ID,
  HERE_MENTION_ID,
} from "../chat-mentions-service.js";

const CONV_ID = "01900000-0000-7000-8000-0000000000c1";
const SENDER_ID = "01900000-0000-7000-8000-0000000000p1";
const USER_A = "01900000-0000-7000-8000-0000000000p2";
const USER_B = "01900000-0000-7000-8000-0000000000p3";
const ROLE_ID = "01900000-0000-7000-8000-0000000000r1";

function buildPrismaMock(queryRawResults) {
  let qIdx = 0;
  return {
    $queryRaw: async () => {
      if (qIdx >= queryRawResults.length) throw new Error(`Unexpected $queryRaw call #${qIdx + 1}`);
      return queryRawResults[qIdx++];
    },
  };
}

describe("chat-mentions-service — resolveMentions", () => {
  it("returns an empty result when the body has no mention tokens", async () => {
    const prisma = buildPrismaMock([]);
    const svc = createChatMentionsService({ prisma });
    const result = await svc.resolveMentions({
      conversationId: CONV_ID, senderProfileId: SENDER_ID, body: "hola equipo", senderRole: null,
    });
    assert.deepEqual(result, { userIds: [], roleIds: [], everyone: false, here: false, notifyUserIds: [] });
  });

  it("resolves a direct @user mention to an active member, excluding the sender", async () => {
    const prisma = buildPrismaMock([
      [{ user_id: USER_A }], // active-member check for candidateIds
      [], // role check for candidateIds (none match)
    ]);
    const svc = createChatMentionsService({ prisma });
    const result = await svc.resolveMentions({
      conversationId: CONV_ID, senderProfileId: SENDER_ID,
      body: `hola @[${USER_A}:Ada]`, senderRole: null,
    });
    assert.deepEqual(result.userIds, [USER_A]);
    assert.deepEqual(result.notifyUserIds, [USER_A]);
  });

  it("does not resolve a mention of the sender's own id (composer already excludes self, but defend anyway)", async () => {
    const prisma = buildPrismaMock([
      [{ user_id: SENDER_ID }],
      [],
    ]);
    const svc = createChatMentionsService({ prisma });
    const result = await svc.resolveMentions({
      conversationId: CONV_ID, senderProfileId: SENDER_ID,
      body: `@[${SENDER_ID}:Me]`, senderRole: null,
    });
    assert.deepEqual(result.userIds, []);
    assert.deepEqual(result.notifyUserIds, []);
  });

  it("resolves a @role mention to all active holders of that role, excluding the sender", async () => {
    const prisma = buildPrismaMock([
      [], // no candidateIds match as active members
      [{ id: ROLE_ID }], // candidateIds match a role
      [{ user_id: USER_A }, { user_id: USER_B }], // role holders
    ]);
    const svc = createChatMentionsService({ prisma });
    const result = await svc.resolveMentions({
      conversationId: CONV_ID, senderProfileId: SENDER_ID,
      body: `@[${ROLE_ID}:Moderators]`, senderRole: null,
    });
    assert.deepEqual(result.roleIds, [ROLE_ID]);
    assert.deepEqual(new Set(result.notifyUserIds), new Set([USER_A, USER_B]));
  });

  it("drops @everyone from the resolved/notify set when the sender lacks mentions.everyone", async () => {
    const prisma = buildPrismaMock([]); // no candidateIds at all — pure @everyone token
    const svc = createChatMentionsService({ prisma });
    const result = await svc.resolveMentions({
      conversationId: CONV_ID, senderProfileId: SENDER_ID,
      body: `@[${EVERYONE_MENTION_ID}:everyone]`,
      senderRole: { isSystem: false, permissions: {} },
    });
    assert.equal(result.everyone, false);
    assert.deepEqual(result.notifyUserIds, []);
  });

  it("expands @everyone to all other active members when the sender has mentions.everyone", async () => {
    const prisma = buildPrismaMock([
      [{ user_id: USER_A }, { user_id: USER_B }], // all-active-members query
    ]);
    const svc = createChatMentionsService({ prisma });
    const result = await svc.resolveMentions({
      conversationId: CONV_ID, senderProfileId: SENDER_ID,
      body: `@[${EVERYONE_MENTION_ID}:everyone]`,
      senderRole: { isSystem: false, permissions: { "mentions.everyone": true } },
    });
    assert.equal(result.everyone, true);
    assert.deepEqual(new Set(result.notifyUserIds), new Set([USER_A, USER_B]));
  });

  it("grants everyone/here to a system (Owner) role regardless of its permissions object", async () => {
    const prisma = buildPrismaMock([
      [{ user_id: USER_A }],
    ]);
    const svc = createChatMentionsService({ prisma });
    const result = await svc.resolveMentions({
      conversationId: CONV_ID, senderProfileId: SENDER_ID,
      body: `@[${HERE_MENTION_ID}:here]`,
      senderRole: { isSystem: true, permissions: {} },
    });
    assert.equal(result.here, true);
    assert.deepEqual(result.notifyUserIds, [USER_A]);
  });

  it("deduplicates a recipient mentioned both directly and via @everyone", async () => {
    const prisma = buildPrismaMock([
      [{ user_id: USER_A }], // direct @user match
      [], // no role match
      [{ user_id: USER_A }, { user_id: USER_B }], // everyone expansion (includes USER_A again)
    ]);
    const svc = createChatMentionsService({ prisma });
    const result = await svc.resolveMentions({
      conversationId: CONV_ID, senderProfileId: SENDER_ID,
      body: `@[${USER_A}:Ada] @[${EVERYONE_MENTION_ID}:everyone]`,
      senderRole: { isSystem: false, permissions: { "mentions.everyone": true } },
    });
    assert.equal(result.notifyUserIds.length, 2);
    assert.deepEqual(new Set(result.notifyUserIds), new Set([USER_A, USER_B]));
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test apps/api/src/routes/chat/__tests__/chat-mentions-service.test.js`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement `chat-mentions-service.js`**

```javascript
// apps/api/src/routes/chat/chat-mentions-service.js
import { parseMentionIds } from "../../lib/mention-utils.js";

// Fixed, never-real-UUID sentinels so @everyone/@here can ride the exact same
// @[id:name] token format packages/ui/src/components/MentionTextarea.jsx
// already uses for real user/role UUIDs — no component change needed.
export const EVERYONE_MENTION_ID = "00000000-0000-0000-0000-000000000000";
export const HERE_MENTION_ID = "00000000-0000-0000-0000-000000000001";

function hasPermission(role, key) {
  if (!role) return false;
  if (role.isSystem) return true;
  return role.permissions?.[key] === true;
}

export function createChatMentionsService({ prisma }) {
  async function resolveMentions({ conversationId, senderProfileId, body, senderRole }) {
    const rawIds = parseMentionIds(body);
    if (!rawIds.length) {
      return { userIds: [], roleIds: [], everyone: false, here: false, notifyUserIds: [] };
    }

    const candidateIds = rawIds.filter((id) => id !== EVERYONE_MENTION_ID && id !== HERE_MENTION_ID);
    const wantsEveryone = rawIds.includes(EVERYONE_MENTION_ID);
    const wantsHere = rawIds.includes(HERE_MENTION_ID);

    let userIds = [];
    let roleIds = [];

    if (candidateIds.length) {
      const memberRows = await prisma.$queryRaw`
        SELECT user_id FROM chat_conversation_members
        WHERE conversation_id = ${conversationId} AND left_at IS NULL AND user_id = ANY(${candidateIds}::uuid[])
      `;
      userIds = memberRows
        .map((r) => r.user_id.toString())
        .filter((id) => id !== senderProfileId);

      const roleRows = await prisma.$queryRaw`
        SELECT id FROM chat_channel_roles WHERE conversation_id = ${conversationId} AND id = ANY(${candidateIds}::uuid[])
      `;
      roleIds = roleRows.map((r) => r.id);
    }

    const everyone = wantsEveryone && hasPermission(senderRole, "mentions.everyone");
    const here = wantsHere && hasPermission(senderRole, "mentions.here");

    const notifySet = new Set(userIds);

    if (roleIds.length) {
      const roleHolderRows = await prisma.$queryRaw`
        SELECT user_id FROM chat_conversation_members
        WHERE conversation_id = ${conversationId} AND left_at IS NULL
          AND role_id = ANY(${roleIds}::uuid[]) AND user_id != ${senderProfileId}
      `;
      for (const r of roleHolderRows) notifySet.add(r.user_id.toString());
    }

    if (everyone || here) {
      const allRows = await prisma.$queryRaw`
        SELECT user_id FROM chat_conversation_members
        WHERE conversation_id = ${conversationId} AND left_at IS NULL
          AND user_id IS NOT NULL AND user_id != ${senderProfileId}
      `;
      for (const r of allRows) notifySet.add(r.user_id.toString());
    }

    return { userIds, roleIds, everyone, here, notifyUserIds: [...notifySet] };
  }

  return { resolveMentions };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `node --test apps/api/src/routes/chat/__tests__/chat-mentions-service.test.js`
Expected: PASS — all 8 tests green.

- [ ] **Step 5: Syntax check and commit**

```bash
node --check apps/api/src/routes/chat/chat-mentions-service.js
git add apps/api/src/routes/chat/chat-mentions-service.js apps/api/src/routes/chat/__tests__/chat-mentions-service.test.js
git commit -m "feat(chat): add mention parsing/classification/resolution service"
```

---

### Task 2: Wire mentions into `sendMessage`

**Files:**
- Modify: `apps/api/src/routes/chat/chat-service.js`
- Modify: `apps/api/src/routes/chat/index.js`

- [ ] **Step 1: Add `mentionsService` to `createChatService`'s signature**

Change:
```javascript
export function createChatService({ prisma, supabaseAdmin, notificationService = null, broadcaster = null, permissionsService = null }) {
```
to:
```javascript
export function createChatService({ prisma, supabaseAdmin, notificationService = null, broadcaster = null, permissionsService = null, mentionsService = null }) {
```

- [ ] **Step 2: Resolve mentions and store them before the INSERT**

In `sendMessage`, read the current file first to get exact surrounding lines (they may have shifted). Immediately after:
```javascript
  async function sendMessage({ conversationId, authUserId, body, messageType = "text", metadata = {}, attachmentIds = [] }) {
    const profileId = await getUserProfileId(authUserId);
    await assertMember(conversationId, profileId);
```
insert:
```javascript

    let mentionResult = { userIds: [], roleIds: [], everyone: false, here: false, notifyUserIds: [] };
    if (mentionsService) {
      const senderRole = permissionsService ? await permissionsService.getMemberRole(conversationId, profileId) : null;
      mentionResult = await mentionsService.resolveMentions({ conversationId, senderProfileId: profileId, body, senderRole });
    }
    const hasMentions = mentionResult.userIds.length || mentionResult.roleIds.length || mentionResult.everyone || mentionResult.here;
    const finalMetadata = hasMentions
      ? { ...metadata, mentions: { userIds: mentionResult.userIds, roleIds: mentionResult.roleIds, everyone: mentionResult.everyone, here: mentionResult.here } }
      : metadata;
```

Then change the INSERT's metadata value from `${JSON.stringify(metadata)}::jsonb` to `${JSON.stringify(finalMetadata)}::jsonb` (only this one occurrence, inside `sendMessage`'s own INSERT — do not touch any other function's use of `metadata`).

- [ ] **Step 3: Fan out `chat.mention.new`, exclude mentioned users from the generic notification**

In the existing notification `setImmediate` block, find:
```javascript
          const recipientIds = otherMembers.map((m) => m.user_id.toString());
          const preview = body.length > 80 ? `${body.slice(0, 80)}...` : body;
          await notificationService.publish({
            companyId,
            actorId: profileId,
            input: {
              eventType: "chat.message.new",
              title: "Nuevo mensaje de chat",
              body: preview,
              link: `/app/m/atlas.chat/chat/inbox`,
              recipients: { userIds: recipientIds },
              channels: ["in_app", "web_push"],
              priority: "medium",
              sourceType: "chat_conversation",
              sourceId: conversationId,
              dedupeKey: `chat.message.new:${msg.id}`,
            },
          });
```
Replace with:
```javascript
          const mentionedSet = new Set(mentionResult.notifyUserIds);
          const recipientIds = otherMembers
            .map((m) => m.user_id.toString())
            .filter((id) => !mentionedSet.has(id));
          const preview = body.length > 80 ? `${body.slice(0, 80)}...` : body;

          if (recipientIds.length) {
            await notificationService.publish({
              companyId,
              actorId: profileId,
              input: {
                eventType: "chat.message.new",
                title: "Nuevo mensaje de chat",
                body: preview,
                link: `/app/m/atlas.chat/chat/inbox`,
                recipients: { userIds: recipientIds },
                channels: ["in_app", "web_push"],
                priority: "medium",
                sourceType: "chat_conversation",
                sourceId: conversationId,
                dedupeKey: `chat.message.new:${msg.id}`,
              },
            });
          }

          if (mentionResult.notifyUserIds.length) {
            await notificationService.publish({
              companyId,
              actorId: profileId,
              input: {
                eventType: "chat.mention.new",
                title: "Te mencionaron en un chat",
                body: preview,
                link: `/app/m/atlas.chat/chat/inbox`,
                recipients: { userIds: mentionResult.notifyUserIds },
                channels: ["in_app", "web_push"],
                priority: "high",
                sourceType: "chat_conversation",
                sourceId: conversationId,
                dedupeKey: `chat.mention.new:${msg.id}`,
              },
            });
          }
```

Note: the existing code guards this whole block with `if (!otherMembers.length) return;` before reaching this point — if there ARE mentions but `otherMembers` is empty (shouldn't happen in practice since a mentioned user must be an active member, hence must be in `otherMembers`, but double-check this isn't a real gap: if `otherMembers` is empty the function returns early and mention notifications never fire. Since `mentionResult.userIds`/role-holder-derived notify targets are only ever active members, and `otherMembers` is "all active members except sender", any real mention target is necessarily in `otherMembers` — so this early return is safe and doesn't silently drop a legitimate mention notification.

- [ ] **Step 4: Wire `mentionsService` into `index.js`**

In `apps/api/src/routes/chat/index.js`, add the import:
```javascript
import { createChatMentionsService } from "./chat-mentions-service.js";
```
and instantiate + inject it alongside `permissionsService`:
```javascript
  const permissionsService = createChatPermissionsService({ prisma });
  const mentionsService = createChatMentionsService({ prisma });
  const chatService = createChatService({ prisma, supabaseAdmin, notificationService, broadcaster, permissionsService, mentionsService });
```
(Read the current file first — the exact surrounding lines may have shifted slightly since Phase A; adapt precisely.)

- [ ] **Step 5: Add a `sendMessage` regression test**

Add to `apps/api/src/routes/chat/__tests__/chat-service.test.js` (uses this file's existing `buildPrismaMock` — note its default `membership.findFirst` returns `null`, which must be overridden per-test or the notification block's `if (!companyId) return;` guard silently skips everything):

```javascript
describe("chat-service — sendMessage mentions", () => {
  it("stores metadata.mentions and fans out a chat.mention.new notification separate from chat.message.new", async () => {
    const publishedEvents = [];
    const notificationService = { publish: async (args) => { publishedEvents.push(args); } };
    const mentionsService = {
      resolveMentions: async () => ({ userIds: ["u-mentioned"], roleIds: [], everyone: false, here: false, notifyUserIds: ["u-mentioned"] }),
    };
    const permissionsService = { getMemberRole: async () => null };

    const prisma = buildPrismaMock([
      [{ id: "sender-profile" }], // resolveUserProfileId
      [{ id: "m1" }],             // assertMember
      [{ id: "msg1", conversation_id: "conv1", sender_user_id: "sender-profile", created_at: new Date(), metadata: {} }], // INSERT ... RETURNING *
      [{                          // getMessageFull's internal query
        id: "msg1", conversation_id: "conv1", sender_user_id: "sender-profile", sender_guest_id: null,
        sender_type: "user", body: "hola @[u-mentioned:X]", message_type: "text", attachment_count: 0,
        metadata: {}, created_at: new Date(), edited_at: null, deleted_at: null,
        sender: { id: null, displayName: null, avatarFileId: null }, attachments: null,
      }],
      [{ user_id: "u-mentioned" }, { user_id: "other-user" }], // otherMembers query inside the notification setImmediate block
    ]);
    prisma.membership.findFirst = async () => ({ companyId: "company-1" });

    const service = createChatService({ prisma, supabaseAdmin: {}, notificationService, mentionsService, permissionsService, broadcaster: null });
    await service.sendMessage({ conversationId: "conv1", authUserId: "auth-1", body: "hola @[u-mentioned:X]" });

    // The notification dispatch runs inside a fire-and-forget setImmediate — flush it.
    await new Promise((resolve) => setImmediate(resolve));

    const mentionEvent = publishedEvents.find((e) => e.input.eventType === "chat.mention.new");
    const messageEvent = publishedEvents.find((e) => e.input.eventType === "chat.message.new");
    assert.ok(mentionEvent, "expected a chat.mention.new notification to be published");
    assert.deepEqual(mentionEvent.input.recipients.userIds, ["u-mentioned"]);
    assert.ok(messageEvent, "expected the generic chat.message.new notification to still fire for non-mentioned members");
    assert.deepEqual(messageEvent.input.recipients.userIds, ["other-user"]);
  });

  it("does not fan out chat.mention.new when resolveMentions finds nothing to notify", async () => {
    const publishedEvents = [];
    const notificationService = { publish: async (args) => { publishedEvents.push(args); } };
    const mentionsService = {
      resolveMentions: async () => ({ userIds: [], roleIds: [], everyone: false, here: false, notifyUserIds: [] }),
    };
    const permissionsService = { getMemberRole: async () => null };

    const prisma = buildPrismaMock([
      [{ id: "sender-profile" }],
      [{ id: "m1" }],
      [{ id: "msg1", conversation_id: "conv1", sender_user_id: "sender-profile", created_at: new Date(), metadata: {} }],
      [{
        id: "msg1", conversation_id: "conv1", sender_user_id: "sender-profile", sender_guest_id: null,
        sender_type: "user", body: "hola equipo", message_type: "text", attachment_count: 0,
        metadata: {}, created_at: new Date(), edited_at: null, deleted_at: null,
        sender: { id: null, displayName: null, avatarFileId: null }, attachments: null,
      }],
      [{ user_id: "other-user" }],
    ]);
    prisma.membership.findFirst = async () => ({ companyId: "company-1" });

    const service = createChatService({ prisma, supabaseAdmin: {}, notificationService, mentionsService, permissionsService, broadcaster: null });
    await service.sendMessage({ conversationId: "conv1", authUserId: "auth-1", body: "hola equipo" });
    await new Promise((resolve) => setImmediate(resolve));

    assert.equal(publishedEvents.some((e) => e.input.eventType === "chat.mention.new"), false);
    assert.equal(publishedEvents.filter((e) => e.input.eventType === "chat.message.new").length, 1);
  });
});
```

- [ ] **Step 6: Run full suite, syntax check, commit**

```bash
node --check apps/api/src/routes/chat/chat-service.js
node --check apps/api/src/routes/chat/index.js
node --test apps/api/src/routes/chat/__tests__/chat-service.test.js apps/api/src/routes/chat/__tests__/chat-mentions-service.test.js apps/api/src/routes/chat/__tests__/chat-permissions-service.test.js apps/api/src/routes/chat/__tests__/channel-directory-service.test.js
git add apps/api/src/routes/chat/chat-service.js apps/api/src/routes/chat/index.js apps/api/src/routes/chat/__tests__/chat-service.test.js
git commit -m "feat(chat): resolve and notify mentions in sendMessage"
```

---

## Self-Review Notes

- **Spec coverage:** Task 1 covers spec Section 12's classification/resolution logic and Section 18's permission gating (unit-tested exhaustively, including the everyone/here system-role bypass and deduplication edge case from Section 23.5). Task 2 covers the storage (Section 10) and notification fan-out (Section 12's "fires a chat.mention.new" requirement, Section 25 acceptance criteria 2-5).
- **File size:** `chat-service.js` grows further past its already-accepted-as-over-budget size (Phase A's plan already flagged and accepted this) — the addition here is small (~25 lines) and delegates the real logic to the new sibling file, consistent with the established pattern.
- **No placeholders** except the explicitly-flagged, intentionally-incomplete mock sequence in Task 2 Step 5, which instructs the implementer to derive it from the real code rather than guess — this is a deliberate "don't let me hand you a wrong answer" instruction, not a gap in the plan's own logic.
