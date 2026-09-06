# In-call chat — Plan A (API): call lifecycle system messages

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When an `atlas.calls` call activates or ends, post one system message into the bound `chat_conversation` so the call is visible in the chat timeline (and can be rendered as a call card by Plan B).

**Architecture:** A new pure module `call-system-messages.js` builds the `{ body, metadata }` for each call event. `call-service.js` gets a failure-swallowing `postCallSystemMessage(call, spec)` helper that inserts the row (`sender_type='system'`, `message_type='system'`, discriminator in `metadata.call`), bumps `chat_conversations.last_message_*`, and broadcasts `chat.message.new` to conversation members. It is called from `joinCall` (on the RINGING→ACTIVE flip), `endCallRecord` (all terminal paths routed through it), and `expireStaleCalls` (its own bulk sweep).

**Tech Stack:** Node.js, Hono, Prisma (`$queryRaw`/`$executeRaw` tagged templates — `chat_*` tables are raw-SQL, never `prisma.<model>`), `node:test`.

**Spec:** `docs/superpowers/specs/2026-09-06-chat-in-call-panel-design.md` §3.5.

**No schema change.** `chat_messages.message_type` has a CHECK constraint
`IN ('text','image','file','system')`; call rows use `'system'` and carry
`metadata.call`. Do not add a migration.

---

## File structure

| File | Responsibility |
|---|---|
| `apps/api/src/routes/calls/call-system-messages.js` | **new** — pure: `formatCallDuration(sec)` + `buildCallSystemMessage({event,kind,endReason,startedAt,endedAt})` → `{ body, metadata }` |
| `apps/api/src/routes/calls/__tests__/call-system-messages.test.js` | **new** — unit tests for the pure module |
| `apps/api/src/routes/calls/call-service.js` | **modify** — import the builder, add `postCallSystemMessage`, call it from `joinCall` / `endCallRecord` / `expireStaleCalls`; widen `expireStaleCalls` `findMany` select |
| `apps/api/src/routes/calls/__tests__/call-service.test.js` | **modify** — add `$executeRaw` stubs + `broadcaster` capture to existing join/leave/decline/expiry tests; assert the system message is posted |

---

## Task 1: Pure `call-system-messages.js`

**Files:**
- Create: `apps/api/src/routes/calls/call-system-messages.js`
- Test: `apps/api/src/routes/calls/__tests__/call-system-messages.test.js`

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/routes/calls/__tests__/call-system-messages.test.js`:

```js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatCallDuration, buildCallSystemMessage } from "../call-system-messages.js";

describe("formatCallDuration", () => {
  it("formats sub-hour durations as m:ss", () => {
    assert.equal(formatCallDuration(0), "0:00");
    assert.equal(formatCallDuration(9), "0:09");
    assert.equal(formatCallDuration(60), "1:00");
    assert.equal(formatCallDuration(754), "12:34");
  });
  it("formats hour-plus durations as h:mm:ss", () => {
    assert.equal(formatCallDuration(3600), "1:00:00");
    assert.equal(formatCallDuration(3661), "1:01:01");
  });
  it("clamps negatives and non-finite input to 0:00", () => {
    assert.equal(formatCallDuration(-5), "0:00");
    assert.equal(formatCallDuration(Number.NaN), "0:00");
    assert.equal(formatCallDuration(undefined), "0:00");
  });
});

describe("buildCallSystemMessage", () => {
  it("started + VIDEO", () => {
    const out = buildCallSystemMessage({ event: "started", kind: "VIDEO" });
    assert.equal(out.body, "Videollamada iniciada");
    assert.deepEqual(out.metadata.call, { kind: "VIDEO", event: "started", endReason: null, durationSec: null });
  });
  it("started + AUDIO", () => {
    const out = buildCallSystemMessage({ event: "started", kind: "AUDIO" });
    assert.equal(out.body, "Llamada de voz iniciada");
    assert.equal(out.metadata.call.kind, "AUDIO");
  });
  it("ended with a real duration", () => {
    const startedAt = new Date("2026-09-06T10:00:00.000Z");
    const endedAt = new Date("2026-09-06T10:12:34.000Z");
    const out = buildCallSystemMessage({ event: "ended", kind: "VIDEO", endReason: "ended", startedAt, endedAt });
    assert.equal(out.body, "Llamada finalizada · 12:34");
    assert.deepEqual(out.metadata.call, { kind: "VIDEO", event: "ended", endReason: "ended", durationSec: 754 });
  });
  it("ended with no startedAt => perdida (even when endReason is 'ended')", () => {
    const out = buildCallSystemMessage({ event: "ended", kind: "AUDIO", endReason: "ended", startedAt: null });
    assert.equal(out.body, "Llamada perdida");
    assert.equal(out.metadata.call.endReason, "missed");
    assert.equal(out.metadata.call.durationSec, null);
  });
  it("ended + missed", () => {
    const out = buildCallSystemMessage({ event: "ended", kind: "AUDIO", endReason: "missed" });
    assert.equal(out.body, "Llamada perdida");
    assert.equal(out.metadata.call.endReason, "missed");
  });
  it("ended + rejected wins over the missing startedAt", () => {
    const out = buildCallSystemMessage({ event: "ended", kind: "VIDEO", endReason: "rejected", startedAt: null });
    assert.equal(out.body, "Llamada rechazada");
    assert.equal(out.metadata.call.endReason, "rejected");
  });
});
```

- [ ] **Step 2: Run the test, confirm it fails**

Run: `node --test apps/api/src/routes/calls/__tests__/call-system-messages.test.js`
Expected: FAIL — `Cannot find module '../call-system-messages.js'`.

- [ ] **Step 3: Implement the module**

Create `apps/api/src/routes/calls/call-system-messages.js`:

```js
// Pure helpers for the system messages atlas.calls posts into the bound
// chat_conversation. No DB, no side effects — see call-service.postCallSystemMessage
// for the insert/broadcast.

export function formatCallDuration(totalSeconds) {
  const s = Number.isFinite(totalSeconds) && totalSeconds > 0 ? Math.floor(totalSeconds) : 0;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

// spec:
//   event:     "started" | "ended"
//   kind:      "AUDIO" | "VIDEO"
//   endReason: "ended" | "missed" | "rejected" | null   (ignored for "started")
//   startedAt: Date | string | null
//   endedAt:   Date | string | null   (defaults to "now" when omitted)
export function buildCallSystemMessage({ event, kind, endReason = null, startedAt = null, endedAt = null }) {
  const callKind = kind === "VIDEO" ? "VIDEO" : "AUDIO";

  if (event === "started") {
    return {
      body: callKind === "VIDEO" ? "Videollamada iniciada" : "Llamada de voz iniciada",
      metadata: { call: { kind: callKind, event: "started", endReason: null, durationSec: null } },
    };
  }

  if (endReason === "rejected") {
    return {
      body: "Llamada rechazada",
      metadata: { call: { kind: callKind, event: "ended", endReason: "rejected", durationSec: null } },
    };
  }

  if (endReason === "missed" || !startedAt) {
    return {
      body: "Llamada perdida",
      metadata: { call: { kind: callKind, event: "ended", endReason: "missed", durationSec: null } },
    };
  }

  const start = new Date(startedAt).getTime();
  const end = endedAt ? new Date(endedAt).getTime() : Date.now();
  const durationSec = Math.max(0, Math.round((end - start) / 1000));
  return {
    body: `Llamada finalizada · ${formatCallDuration(durationSec)}`,
    metadata: { call: { kind: callKind, event: "ended", endReason: "ended", durationSec } },
  };
}
```

- [ ] **Step 4: Run the test, confirm it passes**

Run: `node --test apps/api/src/routes/calls/__tests__/call-system-messages.test.js`
Expected: PASS — all cases green.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/calls/call-system-messages.js apps/api/src/routes/calls/__tests__/call-system-messages.test.js
git commit -m "$(cat <<'EOF'
feat(calls): pure builder for call lifecycle system messages

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `postCallSystemMessage` helper in `call-service.js`

**Files:**
- Modify: `apps/api/src/routes/calls/call-service.js`

- [ ] **Step 1: Import the builder**

At the top of `apps/api/src/routes/calls/call-service.js`, below the existing
`import { AccessToken, RoomServiceClient } from "livekit-server-sdk";` line, add:

```js
import { buildCallSystemMessage } from "./call-system-messages.js";
```

- [ ] **Step 2: Add the helper inside `createCallService`**

Inside `createCallService({ ... })`, immediately **after** the
`listConversationMembers` function definition (it is reused here), add:

```js
  async function postCallSystemMessage(call, spec) {
    try {
      const { body, metadata } = buildCallSystemMessage(spec);
      const payloadMeta = { call: { ...metadata.call, callId: call.id } };
      const rows = await prisma.$queryRaw`
        INSERT INTO chat_messages (conversation_id, sender_type, body, message_type, metadata)
        VALUES (${call.conversationId}, 'system', ${body}, 'system', ${JSON.stringify(payloadMeta)}::jsonb)
        RETURNING id, created_at
      `;
      const messageId = rows?.[0]?.id ?? null;
      const createdAt = rows?.[0]?.created_at ?? now();
      if (!messageId) return;
      await prisma.$executeRaw`
        UPDATE chat_conversations
        SET last_message_id = ${messageId}, last_message_at = ${createdAt}, updated_at = NOW()
        WHERE id = ${call.conversationId}
      `;
      const members = await listConversationMembers(call.conversationId);
      const memberIds = members.map((member) => member.userId).filter(Boolean);
      if (memberIds.length) {
        await broadcaster?.broadcastToUsers?.(memberIds, "chat.message.new", {
          conversationId: call.conversationId,
          messageId,
          senderId: null,
          senderName: null,
          threadRootId: null,
          replyToMessageId: null,
        });
      }
    } catch (error) {
      console.warn(
        "[atlas.calls] No se pudo publicar el mensaje de sistema de la llamada:",
        error?.message ?? error,
      );
    }
  }
```

- [ ] **Step 3: Syntax check**

Run: `node --check apps/api/src/routes/calls/call-service.js`
Expected: no output (exit 0).

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/routes/calls/call-service.js
git commit -m "$(cat <<'EOF'
feat(calls): postCallSystemMessage helper (insert + last-message + broadcast)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Post "iniciada" on the RINGING -> ACTIVE flip

**Files:**
- Modify: `apps/api/src/routes/calls/call-service.js` — `joinCall`
- Modify: `apps/api/src/routes/calls/__tests__/call-service.test.js` — the
  "activates a ringing call when an invited participant joins" test

- [ ] **Step 1: Update the existing join test to expect the system message**

In `apps/api/src/routes/calls/__tests__/call-service.test.js`, find the test
`it("activates a ringing call when an invited participant joins", ...)`.
Replace its `prisma` object and service construction so `$executeRaw` exists
and the broadcaster is captured, and add assertions. The full updated test:

```js
  it("activates a ringing call when an invited participant joins", async () => {
    const updates = [];
    const broadcasts = [];
    const ringingCall = {
      id: CALL_ID,
      conversationId: CONVERSATION_ID,
      kind: "AUDIO",
      status: "RINGING",
      initiatedByUserId: CALLER_ID,
      livekitRoomName: `call_${CALL_ID}`,
      startedAt: null,
      participants: [
        { userId: CALLER_ID, status: "JOINED", joinedAt: new Date(), user: { displayName: "Caller" } },
        { userId: CALLEE_ID, status: "RINGING", joinedAt: null, user: { displayName: "Callee" } },
      ],
      initiator: { id: CALLER_ID, displayName: "Caller" },
      calendarEvent: null,
    };
    const activeCall = { ...ringingCall, status: "ACTIVE" };
    let reads = 0;
    const prisma = {
      userProfile: { findUnique: async () => ({ id: CALLEE_ID, displayName: "Callee" }) },
      call: {
        findMany: async () => [],
        findUnique: async () => (reads++ === 0 ? ringingCall : activeCall),
        update: (operation) => { updates.push({ model: "call", operation }); return Promise.resolve({}); },
      },
      callParticipant: {
        update: (operation) => { updates.push({ model: "participant", operation }); return Promise.resolve({}); },
      },
      $queryRaw: async (strings) => {
        const sql = Array.isArray(strings) ? strings.join("?") : String(strings);
        if (sql.includes("INSERT INTO chat_messages")) return [{ id: "sysmsg-1", created_at: new Date() }];
        if (sql.includes("chat_conversation_members")) {
          return [{ userId: CALLER_ID, displayName: "Caller" }, { userId: CALLEE_ID, displayName: "Callee" }];
        }
        return [{ id: "membership" }];
      },
      $executeRaw: async () => 1,
      $transaction: async (operations) => Promise.all(operations),
    };
    class FakeToken {
      addGrant() {}
      async toJwt() { return "join-token"; }
    }
    const service = createCallService({
      prisma,
      env: enabledEnv(),
      AccessTokenImpl: FakeToken,
      broadcaster: {
        broadcastToUsers: async (userIds, event, payload) => { broadcasts.push({ userIds, event, payload }); },
      },
    });

    const result = await service.joinCall({ authUserId: "callee-auth", callId: CALL_ID });

    assert.equal(result.token, "join-token");
    assert.equal(updates.find((entry) => entry.model === "participant").operation.data.status, "JOINED");
    assert.equal(updates.find((entry) => entry.model === "call").operation.data.status, "ACTIVE");
    const systemBroadcast = broadcasts.find((b) => b.event === "chat.message.new");
    assert.ok(systemBroadcast, "a chat.message.new broadcast is emitted for the started system message");
    assert.equal(systemBroadcast.payload.conversationId, CONVERSATION_ID);
    assert.equal(systemBroadcast.payload.senderId, null);
  });
```

- [ ] **Step 2: Run the test, confirm it fails**

Run: `node --test apps/api/src/routes/calls/__tests__/call-service.test.js`
Expected: the join test FAILS on `assert.ok(systemBroadcast ...)` (no post yet).

- [ ] **Step 3: Call `postCallSystemMessage` from `joinCall`**

In `call-service.js`, function `joinCall`, locate:

```js
    await prisma.$transaction(operations);
    const call = await getCallRecord(callId);
    return {
```

Insert the post **between** the `getCallRecord` line and the `return`:

```js
    await prisma.$transaction(operations);
    const call = await getCallRecord(callId);
    if (shouldActivate && before.status === "RINGING") {
      await postCallSystemMessage(call, { event: "started", kind: call.kind });
    }
    return {
```

- [ ] **Step 4: Run the test, confirm it passes**

Run: `node --test apps/api/src/routes/calls/__tests__/call-service.test.js`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/calls/call-service.js apps/api/src/routes/calls/__tests__/call-service.test.js
git commit -m "$(cat <<'EOF'
feat(calls): post "Videollamada iniciada" on RINGING->ACTIVE

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Post the terminal message from `endCallRecord`

**Files:**
- Modify: `apps/api/src/routes/calls/call-service.js` — `endCallRecord`
- Modify: `apps/api/src/routes/calls/__tests__/call-service.test.js` — the
  "ends a direct call for everyone when the invited participant hangs up" test
  and the "ends a ringing direct call when the invited participant declines it"
  test

- [ ] **Step 1: Update the "hangs up" test**

In `call-service.test.js`, find
`it("ends a direct call for everyone when the invited participant hangs up", ...)`.
Change the single `broadcastCall` capture to an array and relax the assertion,
and make `$queryRaw` / `$executeRaw` handle the system insert. Apply these
edits to that test:

1. Replace `let broadcastCall;` with `const broadcasts = [];`.
2. In the `prisma` object, replace:
   ```js
   $queryRaw: async () => [{ id: "membership" }],
   ```
   with:
   ```js
   $queryRaw: async (strings) => {
     const sql = Array.isArray(strings) ? strings.join("?") : String(strings);
     if (sql.includes("INSERT INTO chat_messages")) return [{ id: "sysmsg-2", created_at: new Date() }];
     if (sql.includes("chat_conversation_members")) {
       return [{ userId: CALLER_ID, displayName: "Caller" }, { userId: CALLEE_ID, displayName: "Callee" }];
     }
     return [{ id: "membership" }];
   },
   $executeRaw: async () => 1,
   ```
3. Replace the broadcaster stub body:
   ```js
   broadcastToUsers: async (userIds, event, payload) => {
     broadcastCall = { userIds, event, payload };
   },
   ```
   with:
   ```js
   broadcastToUsers: async (userIds, event, payload) => {
     broadcasts.push({ userIds, event, payload });
   },
   ```
4. Replace:
   ```js
   assert.deepEqual(broadcastCall, {
     userIds: [CALLER_ID, CALLEE_ID],
     event: "chat.call.ended",
     payload: { callId: CALL_ID, reason: "ended" },
   });
   ```
   with:
   ```js
   assert.ok(
     broadcasts.some((b) =>
       b.event === "chat.call.ended"
       && b.payload.callId === CALL_ID
       && b.payload.reason === "ended"),
     "still broadcasts chat.call.ended",
   );
   const endedSystem = broadcasts.find((b) => b.event === "chat.message.new");
   assert.ok(endedSystem, "posts a chat.message.new for the terminal system message");
   assert.equal(endedSystem.payload.conversationId, CONVERSATION_ID);
   ```

- [ ] **Step 2: Update the "declines it" test**

In `call-service.test.js`, find
`it("ends a ringing direct call when the invited participant declines it", ...)`.
Give it the same `$queryRaw`/`$executeRaw` treatment so the post does not throw
(it has no broadcaster, which is fine — `broadcaster?.` is optional):

Replace its `prisma` `$queryRaw: async () => [...]` (whatever it currently
returns) so the function is:
```js
      $queryRaw: async (strings) => {
        const sql = Array.isArray(strings) ? strings.join("?") : String(strings);
        if (sql.includes("INSERT INTO chat_messages")) return [{ id: "sysmsg-3", created_at: new Date() }];
        if (sql.includes("chat_conversation_members")) return [{ userId: CALLEE_ID, displayName: "Callee" }];
        return [{ id: "membership" }];
      },
      $executeRaw: async () => 1,
```
(Keep every other key of that test's `prisma` object unchanged.)

- [ ] **Step 3: Run the tests, confirm the "hangs up" test fails on the new assertion**

Run: `node --test apps/api/src/routes/calls/__tests__/call-service.test.js`
Expected: "hangs up" test FAILS on `assert.ok(endedSystem ...)`.

- [ ] **Step 4: Call `postCallSystemMessage` from `endCallRecord`**

In `call-service.js`, function `endCallRecord(call, reason = "ended")`, locate:

```js
    await closeLiveKitRoom(call);
    const participantIds = [];
```

Insert the post **between** those two lines:

```js
    await closeLiveKitRoom(call);
    await postCallSystemMessage(call, {
      event: "ended",
      kind: call.kind,
      endReason: reason === "missed" ? "missed" : reason === "rejected" ? "rejected" : "ended",
      startedAt: call.startedAt ?? null,
      endedAt: now(),
    });
    const participantIds = [];
```

(Placing it before the existing `chat.call.ended` broadcast keeps that the
final broadcast for any caller that still relies on ordering.)

- [ ] **Step 5: Run the tests, confirm they pass**

Run: `node --test apps/api/src/routes/calls/__tests__/call-service.test.js`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes/calls/call-service.js apps/api/src/routes/calls/__tests__/call-service.test.js
git commit -m "$(cat <<'EOF'
feat(calls): post terminal system message from endCallRecord

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: "Llamada perdida" from the ring-timeout sweep

**Files:**
- Modify: `apps/api/src/routes/calls/call-service.js` — `expireStaleCalls`
- Modify: `apps/api/src/routes/calls/__tests__/call-service.test.js` — the
  "marks unanswered calls missed after the ringing window and closes the room"
  test

- [ ] **Step 1: Update the expiry test**

In `call-service.test.js`, find
`it("marks unanswered calls missed after the ringing window and closes the room", ...)`.
Make its stale `findMany` return the widened shape, add `$queryRaw`/`$executeRaw`
stubs and a broadcast capture, and assert one "perdida" post per swept call.
Apply:

1. Whatever the test's `prisma.call.findMany` currently returns for the stale
   set, change each row to include the new fields, e.g.:
   ```js
   findMany: async () => [
     { id: CALL_ID, livekitRoomName: `call_${CALL_ID}`, conversationId: CONVERSATION_ID, kind: "VIDEO", startedAt: null },
   ],
   ```
2. Add to the `prisma` object (or extend an existing `$queryRaw`):
   ```js
   $queryRaw: async (strings) => {
     const sql = Array.isArray(strings) ? strings.join("?") : String(strings);
     if (sql.includes("INSERT INTO chat_messages")) return [{ id: "sysmsg-miss", created_at: new Date() }];
     if (sql.includes("chat_conversation_members")) return [{ userId: CALLER_ID, displayName: "Caller" }];
     return [{ id: "membership" }];
   },
   $executeRaw: async () => 1,
   ```
3. Construct the service with a broadcaster that pushes to a `const broadcasts = []`
   declared at the top of the test.
4. After the call under test (`await service.expireStaleCalls()` — keep the
   existing invocation), add:
   ```js
   const missBroadcast = broadcasts.find((b) => b.event === "chat.message.new");
   assert.ok(missBroadcast, "posts a chat.message.new for the missed call");
   assert.equal(missBroadcast.payload.conversationId, CONVERSATION_ID);
   ```

- [ ] **Step 2: Run the test, confirm it fails**

Run: `node --test apps/api/src/routes/calls/__tests__/call-service.test.js`
Expected: expiry test FAILS on `assert.ok(missBroadcast ...)`.

- [ ] **Step 3: Widen the `findMany` select and post per swept call**

In `call-service.js`, function `expireStaleCalls`, change:

```js
    const stale = await prisma.call.findMany({
      where: { status: "RINGING", createdAt: { lte: cutoff } },
      select: { id: true, livekitRoomName: true },
    });
```

to:

```js
    const stale = await prisma.call.findMany({
      where: { status: "RINGING", createdAt: { lte: cutoff } },
      select: { id: true, livekitRoomName: true, conversationId: true, kind: true, startedAt: true },
    });
```

Then locate the end of the function:

```js
    await Promise.all(stale.map(closeLiveKitRoom));
    return stale.length;
```

and change it to:

```js
    await Promise.all(stale.map(closeLiveKitRoom));
    await Promise.all(stale.map((call) =>
      postCallSystemMessage(call, { event: "ended", kind: call.kind, endReason: "missed" }),
    ));
    return stale.length;
```

- [ ] **Step 4: Run the test, confirm it passes**

Run: `node --test apps/api/src/routes/calls/__tests__/call-service.test.js`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/calls/call-service.js apps/api/src/routes/calls/__tests__/call-service.test.js
git commit -m "$(cat <<'EOF'
feat(calls): post "Llamada perdida" from the ring-timeout sweep

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Idempotency + failure-swallow regression tests

**Files:**
- Modify: `apps/api/src/routes/calls/__tests__/call-service.test.js` — add a new
  `describe` block

- [ ] **Step 1: Write the tests**

Append to `call-service.test.js`, inside the top-level `describe("createCallService", ...)`
block (or as a sibling `describe`):

```js
  it("does not post 'iniciada' when the initiator re-joins an already ACTIVE call", async () => {
    const broadcasts = [];
    const activeCall = {
      id: CALL_ID,
      conversationId: CONVERSATION_ID,
      kind: "VIDEO",
      status: "ACTIVE",
      initiatedByUserId: CALLER_ID,
      livekitRoomName: `call_${CALL_ID}`,
      startedAt: new Date(),
      participants: [
        { userId: CALLER_ID, status: "JOINED", joinedAt: new Date(), user: { displayName: "Caller" } },
        { userId: CALLEE_ID, status: "JOINED", joinedAt: new Date(), user: { displayName: "Callee" } },
      ],
      initiator: { id: CALLER_ID, displayName: "Caller" },
      calendarEvent: null,
    };
    const prisma = {
      userProfile: { findUnique: async () => ({ id: CALLER_ID, displayName: "Caller" }) },
      call: {
        findMany: async () => [],
        findUnique: async () => activeCall,
        update: () => Promise.resolve({}),
      },
      callParticipant: { update: () => Promise.resolve({}) },
      $queryRaw: async () => [{ id: "membership" }],
      $executeRaw: async () => 1,
      $transaction: async (operations) => Promise.all(operations),
    };
    class FakeToken { addGrant() {} async toJwt() { return "t"; } }
    const service = createCallService({
      prisma,
      env: enabledEnv(),
      AccessTokenImpl: FakeToken,
      broadcaster: { broadcastToUsers: async (u, event, p) => { broadcasts.push({ event }); } },
    });

    await service.joinCall({ authUserId: "caller-auth", callId: CALL_ID });

    assert.equal(broadcasts.some((b) => b.event === "chat.message.new"), false);
  });

  it("a failing system-message insert never breaks the call operation", async () => {
    const activeCall = {
      id: CALL_ID,
      conversationId: CONVERSATION_ID,
      kind: "AUDIO",
      status: "ACTIVE",
      initiatedByUserId: CALLER_ID,
      livekitRoomName: `call_${CALL_ID}`,
      startedAt: new Date(Date.now() - 5000),
      participants: [
        { userId: CALLER_ID, status: "JOINED", user: { displayName: "Caller" } },
        { userId: CALLEE_ID, status: "JOINED", user: { displayName: "Callee" } },
      ],
      initiator: { id: CALLER_ID, displayName: "Caller" },
      calendarEvent: null,
    };
    const endedCall = { ...activeCall, status: "ENDED" };
    let reads = 0;
    const prisma = {
      userProfile: { findUnique: async () => ({ id: CALLEE_ID, displayName: "Callee" }) },
      call: {
        findUnique: async () => (reads++ === 0 ? activeCall : endedCall),
        update: () => Promise.resolve({}),
      },
      callParticipant: {
        update: () => Promise.resolve({}),
        updateMany: () => Promise.resolve({ count: 1 }),
        count: async () => 0,
      },
      $queryRaw: async (strings) => {
        const sql = Array.isArray(strings) ? strings.join("?") : String(strings);
        if (sql.includes("INSERT INTO chat_messages")) throw new Error("boom");
        return [{ id: "membership" }];
      },
      $executeRaw: async () => 1,
      $transaction: async (operations) => Promise.all(operations),
    };
    class FakeRoom { async deleteRoom() {} }
    const service = createCallService({
      prisma,
      env: enabledEnv(),
      RoomServiceClientImpl: FakeRoom,
    });

    const result = await service.leaveCall({ authUserId: "callee-auth", callId: CALL_ID });
    assert.equal(result.status, "ENDED");
  });
```

- [ ] **Step 2: Run the tests**

Run: `node --test apps/api/src/routes/calls/__tests__/call-service.test.js`
Expected: all PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/routes/calls/__tests__/call-service.test.js
git commit -m "$(cat <<'EOF'
test(calls): idempotency + failure-swallow for call system messages

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Full verification

- [ ] **Step 1: Run the whole calls test directory**

Run: `node --test apps/api/src/routes/calls/__tests__/`
Expected: every file green, 0 failures.

- [ ] **Step 2: Run the API service test suite for regressions**

Run: `node --test apps/api/src/routes/chat/__tests__/ apps/api/src/services/__tests__/`
Expected: no new failures vs. `main` (pre-existing failures, if any, unchanged).

- [ ] **Step 3: Syntax check the touched service**

Run: `node --check apps/api/src/routes/calls/call-service.js`
Expected: exit 0.

- [ ] **Step 4: Lint**

Run: `pnpm lint`
Expected: clean (no new violations).

- [ ] **Step 5: Final commit (only if lint auto-fixed anything)**

```bash
git add -A
git commit -m "$(cat <<'EOF'
chore(calls): lint pass for call system messages

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Self-review

- **Spec §3.5 coverage:** started message (Task 3), terminal message with
  duration / rejected (Task 4), missed via `endCallRecord` no-`startedAt` and
  via the sweep (Tasks 4 + 5), metadata shape with `callId` (Task 2),
  idempotency (Task 6), failure-swallow (Tasks 2 + 6), broadcast over the chat
  realtime event `chat.message.new` (Task 2), `last_message_*` bump (Task 2).
- **No new `message_type`:** insert uses `'system'` + `metadata.call` — Task 2.
  No migration.
- **Type consistency:** `buildCallSystemMessage` returns `{ body, metadata }`
  with `metadata.call = { kind, event, endReason, durationSec }`; `call-service`
  adds `callId` into that same `call` object before insert. `postCallSystemMessage(call, spec)`
  where `spec` is exactly the `buildCallSystemMessage` argument. `joinCall`
  passes `{ event: "started", kind }`; `endCallRecord` and the sweep pass
  `{ event: "ended", kind, endReason, startedAt?, endedAt? }`.
- **Not touched:** LiveKit token flow, `createCall`, ring/accept/decline
  semantics (only a post-commit side effect added), no `prisma.<model>` on
  `chat_*` tables.
