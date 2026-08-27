# File-Reference Metadata + Avatar File Id Exposure (Plan F — Backend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Work directly on the `main` branch — do NOT create a git worktree or feature branch (this project's established convention).

**Goal:** Two small, additive backend changes that unblock Plan G's frontend work: persist `mimeType`/`sizeBytes` when a chat message references a file (so the frontend can render it as a real attachment instead of a generic link), and stop discarding each conversation member's `avatarFileId` (so the frontend can fetch a real full-resolution avatar image instead of only ever having the pre-baked thumbnail URL).

**Architecture:** Both changes touch existing, already-fetched data — no new queries, no new tables, no new signed-URL generation logic. `chat-entity-references-service.js`'s file-ref resolver already has the full `FileAsset` row in hand and simply stops throwing away two of its fields. `chat-service.js`'s `getConversation`/`listConversations` already fetch each member's `avatarFileId` from the database and then explicitly delete it before returning — this plan just stops deleting it.

**Tech Stack:** Node.js, Prisma (`$queryRaw` — chat tables are never Prisma-modeled, per this repo's established AME3/chat convention).

**Spec:** `docs/superpowers/specs/2026-08-26-chat-file-refs-and-bubble-polish-design.md`, Parts A1 and B3 (backend half).

**Verification tooling note:** This repo uses Node's built-in test runner (`node --test`), not Vitest/Jest. Run the existing chat service test suite to confirm nothing regresses, plus a syntax check.

---

### Task 1: Persist mimeType/sizeBytes on file-type entity references

**Files:** `apps/api/src/routes/chat/chat-entity-references-service.js`

- [ ] **Step 1: Read the current file in full**

Confirm the exact current `resolveOne()` function and its `entityType === "file"` branch.

- [ ] **Step 2: Add the two fields**

Change:
```js
if (entityType === "file") {
  const row = await filesService.getById({ authUserId, id: recordId });
  if (!row) return null;
  return { entityType, recordId, title: row.originalName, subtitle: null, url: `/app/m/atlas.files/files/${recordId}` };
}
```
to:
```js
if (entityType === "file") {
  const row = await filesService.getById({ authUserId, id: recordId });
  if (!row) return null;
  return {
    entityType, recordId, title: row.originalName, subtitle: null,
    url: `/app/m/atlas.files/files/${recordId}`,
    mimeType: row.mimeType ?? null,
    sizeBytes: row.sizeBytes ?? null,
  };
}
```
Do not touch the `contact`/`hr_employee`/`ledger_account` branches — they don't gain these fields, they're not previewable files.

- [ ] **Step 3: Check for an existing test file covering this resolver**

Search for a test file (e.g. `apps/api/src/routes/chat/__tests__/chat-entity-references-service.test.js` or similar naming). If one exists, read it to see whether it asserts the exact shape of a resolved `"file"` entity ref (a test asserting `{ entityType, recordId, title, subtitle, url }` with no other keys would now fail since two new keys are added) — if such an assertion exists, update it to include `mimeType`/`sizeBytes` in the expected object, using values consistent with whatever mock `filesService.getById` returns in that test.

- [ ] **Step 4: Run the syntax check and relevant tests**

Run: `node --check apps/api/src/routes/chat/chat-entity-references-service.js`
Expected: no output (syntax OK).

If a test file exists for this service, run it: `node --test apps/api/src/routes/chat/__tests__/chat-entity-references-service.test.js` (adjust path to wherever Step 3 found it). Expected: all tests pass.

Also run the broader chat service test suite to catch any indirect assertion on entity-ref shape elsewhere:
Run: `node --test apps/api/src/routes/chat/__tests__/`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/chat/chat-entity-references-service.js
git commit -m "feat(chat): persist mimeType/sizeBytes when resolving a file entity reference"
```

(add the test file too, in the same commit, if Step 3 required an update — `git add <test file path>` alongside the service file.)

## Process

1. Read the file first.
2. Make exactly the described change — do not touch the other three entity type branches, do not touch `resolveEntityRefs()` or `resolveActorContext()`.
3. Check for and update an existing test if one asserts the old shape.
4. Run the syntax check and tests.
5. Commit.
6. Self-review your diff (`git show HEAD`) before reporting.

## Report back

End with one of: DONE, DONE_WITH_CONCERNS, NEEDS_CONTEXT, or BLOCKED, plus a short summary.

---

### Task 2: Stop discarding conversation members' avatarFileId

**Files:** `apps/api/src/routes/chat/chat-service.js`

- [ ] **Step 1: Read the current file's `getConversation` and `listConversations` functions in full**

Both functions build a `conv.members` array where each member's `avatarUrl` is resolved from `avatarFileId`, and then set `avatarFileId: undefined` on the returned member object, discarding it. There are exactly two such blocks in this file (one per function) — confirm you've found both before editing.

The pattern in `listConversations` currently looks like:
```js
if (conv.members) {
  conv.members = conv.members.map((m) => ({
    ...m,
    avatarUrl: m.avatarFileId ? (avatarUrlMap[m.avatarFileId] ?? m.authAvatarUrl ?? null) : (m.authAvatarUrl ?? null),
    avatarFileId: undefined,
    authAvatarUrl: undefined,
  }));
}
```
and identically (just inside `getConversation` instead) elsewhere in the same file.

- [ ] **Step 2: Stop discarding avatarFileId, in BOTH occurrences**

Change BOTH occurrences from:
```js
    avatarUrl: m.avatarFileId ? (avatarUrlMap[m.avatarFileId] ?? m.authAvatarUrl ?? null) : (m.authAvatarUrl ?? null),
    avatarFileId: undefined,
    authAvatarUrl: undefined,
```
to:
```js
    avatarUrl: m.avatarFileId ? (avatarUrlMap[m.avatarFileId] ?? m.authAvatarUrl ?? null) : (m.authAvatarUrl ?? null),
    authAvatarUrl: undefined,
```
(just delete the `avatarFileId: undefined,` line — `avatarFileId` was already a string on `m` from the underlying SQL/JSON aggregation, camelCase, ready to use as-is; nothing else about the mapping changes. `authAvatarUrl` keeps being discarded — it was only ever an intermediate fallback value used to compute `avatarUrl`, not something the frontend needs directly.)

Do NOT touch the conversation-level `conv.avatarUrl`/`conv.avatar_url` lines right below each block — the conversation's own `avatar_file_id` (snake_case) is already present and returned as-is (never stripped) in both functions; this task is only about the per-member field.

- [ ] **Step 3: Check for existing tests asserting the old (stripped) shape**

Search `apps/api/src/routes/chat/__tests__/chat-service.test.js` (or wherever the test suite for this file lives) for any assertion that a returned member object does NOT have an `avatarFileId` key, or that explicitly checks `avatarFileId === undefined` — if found, update it to expect the field to be present instead (with whatever mock value the test's fixture data supplies).

- [ ] **Step 4: Run the syntax check and tests**

Run: `node --check apps/api/src/routes/chat/chat-service.js`
Expected: no output.

Run: `node --test apps/api/src/routes/chat/__tests__/`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/chat/chat-service.js
git commit -m "feat(chat): stop discarding conversation members' avatarFileId in API responses"
```
(include any updated test file in the same commit if Step 3 required a change.)

## Process

1. Read the file first — confirm there are exactly 2 occurrences of this pattern (`getConversation` and `listConversations`), not more.
2. Make exactly the described 1-line-removal change in both places — do not touch anything else in either function, do not touch the conversation-level avatar resolution.
3. Check for and update any existing test asserting the old shape.
4. Run the syntax check and tests.
5. Commit.
6. Self-review your diff (`git show HEAD`) before reporting — confirm both occurrences were changed identically, confirm `authAvatarUrl: undefined` is still present in both (only `avatarFileId: undefined` was removed).

## Report back

End with one of: DONE, DONE_WITH_CONCERNS, NEEDS_CONTEXT, or BLOCKED, plus a short summary.

---

## Self-Review Notes

- **Spec coverage:** Part A1 → Task 1. Part B3's backend half → Task 2.
- **No new exposure**: Task 2 only stops discarding a value the same endpoint's response already fully contains for `avatarUrl` resolution purposes (`avatarFileId` was read from the database in the same query, just deleted before serialization) — no new query, no new join, no new data becomes reachable that wasn't already being read server-side.
- **Type consistency**: `mimeType`/`sizeBytes` field names in Task 1 match exactly what Plan G's frontend tasks will read (`ref.mimeType`, `ref.sizeBytes`). `avatarFileId` field name in Task 2 matches what Plan G will read as `member.avatarFileId`.
