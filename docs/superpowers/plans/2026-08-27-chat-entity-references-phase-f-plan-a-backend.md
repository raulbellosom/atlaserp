# Chat Entity References Phase F — Plan A (Backend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let `sendMessage` accept up to 5 `{entityType, recordId}` references, resolve each through the target entity's own existing permission-aware service, and store the resolved snapshot in `metadata.entityRefs`.

**Architecture:** A new sibling service, `chat-entity-references-service.js`, holds the registry (4 entries) and the resolver. It instantiates `contactsService`/`filesService`/`hrService`/`ledgerService` directly (their own factories, already used elsewhere in `apps/api/src/index.js`) and calls each one's existing `getById`/`getEmployee`/`getAccount` — inheriting their permission/company-scoping rather than reimplementing it. `chat-service.js`'s `sendMessage` calls the new service before inserting.

**Tech Stack:** Node.js, Hono, Prisma, Zod.

**Spec:** `docs/superpowers/specs/2026-08-27-chat-entity-references-phase-f-design.md` — read in full before starting, especially Section 12 (API contract), Section 23 edge case 5 (the ledger-account signature mismatch), and Section 24 Risk 2 (why this duplicates a lookup pattern instead of extracting a shared helper — deliberate, don't "fix" it).

**Verified facts this plan relies on (from this spec's own research, not guesses):**
- `createContactsService({ prisma })` (`apps/api/src/services/contacts-service.js`) → `.getById({ authUserId, id })` → row or throws `ContactsServiceError` (`.status`). Title: `row.name`.
- `createFilesService({ prisma, supabaseAdmin })` (`apps/api/src/services/files-service.js`) → `.getById({ authUserId, id })` → row or throws `FilesServiceError` (`.status`). Title: `row.originalName`.
- `createHrService({ prisma })` (`apps/api/src/services/hr-service.js`) → `.getEmployee({ authUserId, id })` → row or throws `HrServiceError` (`.status`). Title: `` `${row.firstName} ${row.lastName}`.trim() ``.
- `createLedgerService({ prisma })` (`apps/api/src/routes/ledger/ledger-service.js`) → `.getAccount({ companyId, accountId, actorId })` (**different signature** — no `authUserId` param) → row or throws `LedgerServiceError` (`.status`). Title: `` `${row.name}${row.bank ? " · " + row.bank : ""}` ``. `companyId`/`actorId` must be derived from `authUserId` via the same `userProfile.findUnique({where:{authUserId}})` → `membership.findFirst({userId, enabled:true})` pattern already duplicated in the other three services (`actorId` = the resolved profile's `id`).

---

## File Structure Map

| File | Action | Responsibility |
|---|---|---|
| `apps/api/src/routes/chat/chat-entity-references-service.js` | Create | Registry + `resolveEntityRefs` |
| `apps/api/src/routes/chat/chat-service.js` | Modify | `sendMessage` extended with `entityRefs` resolution |
| `packages/validators/src/chat.js` | Modify | `chatSendMessageSchema` gains `entityRefs` |
| `apps/api/src/routes/chat/index.js` | Modify | Wire the new service into `createChatService`'s dependencies |
| `apps/api/src/routes/chat/__tests__/chat-entity-references-service.test.js` | Create | Registry/resolver tests |
| `apps/api/src/routes/chat/__tests__/chat-service.test.js` | Modify | `sendMessage` integration tests |

---

### Task 1: `chat-entity-references-service.js`

**Files:**
- Create: `apps/api/src/routes/chat/chat-entity-references-service.js`
- Test: `apps/api/src/routes/chat/__tests__/chat-entity-references-service.test.js`

- [ ] **Step 1: Write the failing tests first**

```javascript
// apps/api/src/routes/chat/__tests__/chat-entity-references-service.test.js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createChatEntityReferencesService } from "../chat-entity-references-service.js";

describe("chat-entity-references-service — resolveEntityRefs", () => {
  it("resolves a contact reference via contactsService.getById", async () => {
    const deps = {
      contactsService: { getById: async ({ authUserId, id }) => {
        assert.equal(authUserId, "auth-1");
        assert.equal(id, "contact-1");
        return { id: "contact-1", name: "Ada Lovelace" };
      } },
      filesService: {}, hrService: {}, ledgerService: {}, prisma: {},
    };
    const service = createChatEntityReferencesService(deps);
    const result = await service.resolveEntityRefs({
      authUserId: "auth-1",
      entityRefs: [{ entityType: "contact", recordId: "contact-1" }],
    });
    assert.deepEqual(result, [{
      entityType: "contact", recordId: "contact-1", title: "Ada Lovelace",
      subtitle: null, url: "/app/m/atlas.contacts/contacts/contact-1",
    }]);
  });

  it("resolves a file reference with originalName as title", async () => {
    const deps = {
      filesService: { getById: async () => ({ id: "file-1", originalName: "contrato.pdf" }) },
      contactsService: {}, hrService: {}, ledgerService: {}, prisma: {},
    };
    const service = createChatEntityReferencesService(deps);
    const result = await service.resolveEntityRefs({
      authUserId: "auth-1",
      entityRefs: [{ entityType: "file", recordId: "file-1" }],
    });
    assert.equal(result[0].title, "contrato.pdf");
    assert.equal(result[0].url, "/app/m/atlas.files/files/file-1");
  });

  it("resolves an hr_employee reference joining first/last name", async () => {
    const deps = {
      hrService: { getEmployee: async () => ({ id: "emp-1", firstName: "Grace", lastName: "Hopper" }) },
      contactsService: {}, filesService: {}, ledgerService: {}, prisma: {},
    };
    const service = createChatEntityReferencesService(deps);
    const result = await service.resolveEntityRefs({
      authUserId: "auth-1",
      entityRefs: [{ entityType: "hr_employee", recordId: "emp-1" }],
    });
    assert.equal(result[0].title, "Grace Hopper");
    assert.equal(result[0].url, "/app/m/atlas.hr/hr/employees/emp-1");
  });

  it("resolves a ledger_account reference, deriving companyId/actorId from authUserId (not passing authUserId through)", async () => {
    const prisma = {
      userProfile: { findUnique: async () => ({ id: "profile-1" }) },
      membership: { findFirst: async () => ({ companyId: "company-1" }) },
    };
    let capturedArgs = null;
    const deps = {
      ledgerService: { getAccount: async (args) => {
        capturedArgs = args;
        return { id: "acct-1", name: "Cuenta principal", bank: "BBVA" };
      } },
      contactsService: {}, filesService: {}, hrService: {}, prisma,
    };
    const service = createChatEntityReferencesService(deps);
    const result = await service.resolveEntityRefs({
      authUserId: "auth-1",
      entityRefs: [{ entityType: "ledger_account", recordId: "acct-1" }],
    });
    assert.deepEqual(capturedArgs, { companyId: "company-1", accountId: "acct-1", actorId: "profile-1" });
    assert.equal(result[0].title, "Cuenta principal · BBVA");
    assert.equal(result[0].url, "/app/m/atlas.ledger/accounts/acct-1");
  });

  it("drops (does not throw) a reference the caller can't resolve", async () => {
    const deps = {
      contactsService: { getById: async () => { const e = new Error("no"); e.status = 404; throw e; } },
      filesService: {}, hrService: {}, ledgerService: {}, prisma: {},
    };
    const service = createChatEntityReferencesService(deps);
    const result = await service.resolveEntityRefs({
      authUserId: "auth-1",
      entityRefs: [{ entityType: "contact", recordId: "contact-1" }],
    });
    assert.deepEqual(result, []);
  });

  it("drops an unknown entityType without throwing", async () => {
    const deps = { contactsService: {}, filesService: {}, hrService: {}, ledgerService: {}, prisma: {} };
    const service = createChatEntityReferencesService(deps);
    const result = await service.resolveEntityRefs({
      authUserId: "auth-1",
      entityRefs: [{ entityType: "totally_unknown", recordId: "x" }],
    });
    assert.deepEqual(result, []);
  });

  it("resolves multiple refs in parallel (Promise.all), not sequentially", async () => {
    const order = [];
    const deps = {
      contactsService: { getById: async () => { order.push("contact-start"); await new Promise((r) => setTimeout(r, 10)); order.push("contact-end"); return { id: "c1", name: "C" }; } },
      filesService: { getById: async () => { order.push("file-start"); order.push("file-end"); return { id: "f1", originalName: "F" }; } },
      hrService: {}, ledgerService: {}, prisma: {},
    };
    const service = createChatEntityReferencesService(deps);
    await service.resolveEntityRefs({
      authUserId: "auth-1",
      entityRefs: [{ entityType: "contact", recordId: "c1" }, { entityType: "file", recordId: "f1" }],
    });
    // If sequential, file wouldn't start until contact fully finished — this
    // proves they overlap.
    assert.deepEqual(order, ["contact-start", "file-start", "file-end", "contact-end"]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test apps/api/src/routes/chat/__tests__/chat-entity-references-service.test.js`
Expected: FAIL — module doesn't exist yet.

- [ ] **Step 3: Implement**

```javascript
// apps/api/src/routes/chat/chat-entity-references-service.js

const MAX_ENTITY_REFS = 5;

// Deliberately duplicates the authUserId -> {profileId, companyId} lookup
// already present, identically, in contacts-service.js/files-service.js/
// hr-service.js — see spec Section 24 Risk 2 for why this is intentional,
// not an oversight to "fix" by extracting a shared helper.
async function resolveActorContext(prisma, authUserId) {
  const profile = await prisma.userProfile.findUnique({ where: { authUserId }, select: { id: true } });
  if (!profile) return null;
  const membership = await prisma.membership.findFirst({
    where: { userId: profile.id, enabled: true },
    orderBy: { createdAt: "desc" },
    select: { companyId: true },
  });
  if (!membership?.companyId) return null;
  return { profileId: profile.id, companyId: membership.companyId };
}

export function createChatEntityReferencesService({ prisma, contactsService, filesService, hrService, ledgerService }) {
  // Not a static registry object keyed by entityType — each type's
  // underlying call shape genuinely differs (three take authUserId+id
  // directly, ledger needs companyId/actorId derived separately), so a
  // single if/else per type is clearer here than forcing a uniform shape
  // that doesn't actually hold across all four.
  async function resolveOne(authUserId, { entityType, recordId }) {
    try {
      if (entityType === "contact") {
        const row = await contactsService.getById({ authUserId, id: recordId });
        if (!row) return null;
        return { entityType, recordId, title: row.name, subtitle: null, url: `/app/m/atlas.contacts/contacts/${recordId}` };
      }
      if (entityType === "file") {
        const row = await filesService.getById({ authUserId, id: recordId });
        if (!row) return null;
        return { entityType, recordId, title: row.originalName, subtitle: null, url: `/app/m/atlas.files/files/${recordId}` };
      }
      if (entityType === "hr_employee") {
        const row = await hrService.getEmployee({ authUserId, id: recordId });
        if (!row) return null;
        return { entityType, recordId, title: `${row.firstName} ${row.lastName}`.trim(), subtitle: null, url: `/app/m/atlas.hr/hr/employees/${recordId}` };
      }
      if (entityType === "ledger_account") {
        const ctx = await resolveActorContext(prisma, authUserId);
        if (!ctx) return null;
        const row = await ledgerService.getAccount({ companyId: ctx.companyId, accountId: recordId, actorId: ctx.profileId });
        if (!row) return null;
        const subtitle = row.bank ? row.bank : null;
        return { entityType, recordId, title: subtitle ? `${row.name} · ${row.bank}` : row.name, subtitle, url: `/app/m/atlas.ledger/accounts/${recordId}` };
      }
      return null; // unknown entityType — drop silently
    } catch {
      return null; // any resolution failure (404/403/etc from the target service) — drop silently, never surface
    }
  }

  async function resolveEntityRefs({ authUserId, entityRefs }) {
    if (!entityRefs?.length) return [];
    const capped = entityRefs.slice(0, MAX_ENTITY_REFS);
    const resolved = await Promise.all(capped.map((ref) => resolveOne(authUserId, ref)));
    return resolved.filter(Boolean);
  }

  return { resolveEntityRefs };
}
```

- [ ] **Step 4: Run tests, iterate until green**

Run: `node --test apps/api/src/routes/chat/__tests__/chat-entity-references-service.test.js`
Expected: 7/7 PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/chat/chat-entity-references-service.js apps/api/src/routes/chat/__tests__/chat-entity-references-service.test.js
git commit -m "feat(chat): add entity reference resolver service"
```

---

### Task 2: Wire into `sendMessage`

**Files:**
- Modify: `apps/api/src/routes/chat/chat-service.js`
- Modify: `apps/api/src/routes/chat/index.js`
- Test: `apps/api/src/routes/chat/__tests__/chat-service.test.js`

- [ ] **Step 1: Read the current `sendMessage` and `createChatService`/`createChatRouter` signatures in full first (required)**

`sendMessage` was already extended twice this phase-cycle (Phase C mentions, Phase E threads) — read its current full body before adding a fourth extension point. `createChatService({ prisma, supabaseAdmin, notificationService, broadcaster, permissionsService, mentionsService })` in `chat-service.js` and `createChatRouter({ prisma, supabaseAdmin, authMiddleware, requirePermission, notificationService, broadcaster })` in `index.js` are where new sibling services get instantiated and threaded through — follow the exact same pattern already used for `mentionsService`/`permissionsService`.

- [ ] **Step 2: Wire the new service's instantiation in `index.js`**

In `apps/api/src/routes/chat/index.js`, import the 4 target services and the new entity-references service:

```javascript
import { createContactsService } from "../../services/contacts-service.js";
import { createFilesService } from "../../services/files-service.js";
import { createHrService } from "../../services/hr-service.js";
import { createLedgerService } from "../ledger/ledger-service.js";
import { createChatEntityReferencesService } from "./chat-entity-references-service.js";
```

Verify each import path is correct by checking the real file locations (`apps/api/src/services/contacts-service.js`, `apps/api/src/services/files-service.js`, `apps/api/src/services/hr-service.js`, `apps/api/src/routes/ledger/ledger-service.js`) — confirm each file actually exports the named factory function shown, not a default export, before finalizing these imports.

Inside `createChatRouter`, alongside the existing `const mentionsService = createChatMentionsService({ prisma });`:

```javascript
  const entityReferencesService = createChatEntityReferencesService({
    prisma,
    contactsService: createContactsService({ prisma }),
    filesService: createFilesService({ prisma, supabaseAdmin }),
    hrService: createHrService({ prisma }),
    ledgerService: createLedgerService({ prisma }),
  });
```

Pass it into `createChatService`:

```javascript
  const chatService = createChatService({ prisma, supabaseAdmin, notificationService, broadcaster, permissionsService, mentionsService, entityReferencesService });
```

- [ ] **Step 3: Extend `createChatService`'s destructured params**

In `chat-service.js`, add `entityReferencesService = null` to `createChatService`'s parameter destructuring (matching the existing `mentionsService = null` default pattern).

- [ ] **Step 4: Write failing tests for the `sendMessage` integration**

Add to `chat-service.test.js`:

```javascript
describe("chat-service — sendMessage entity references", () => {
  it("resolves entityRefs and stores them in metadata.entityRefs", async () => {
    const prisma = buildPrismaMock([
      [{ id: PROFILE_ID }],
      [{ id: "member-row" }],
      [{ id: "msg-1", conversation_id: CONV_ID, type: "channel", created_at: new Date(), metadata: {} }],
      [{ id: "msg-1", conversation_id: CONV_ID, sender: null, attachments: null, reactions: null, metadata: {} }],
    ]);
    const entityReferencesService = {
      resolveEntityRefs: async ({ authUserId, entityRefs }) => {
        assert.equal(authUserId, AUTH_USER_ID);
        assert.deepEqual(entityRefs, [{ entityType: "contact", recordId: "contact-1" }]);
        return [{ entityType: "contact", recordId: "contact-1", title: "Ada", subtitle: null, url: "/app/m/atlas.contacts/contacts/contact-1" }];
      },
    };
    const service = createChatService({ prisma, supabaseAdmin: {}, entityReferencesService });
    // conversation type lookup needed to check external_support rejection — this test's
    // conversationId is a channel; confirm chat-service.js actually queries conversation
    // type somewhere reachable here, or adjust the mock sequence to match the real code path.
    await service.sendMessage({
      conversationId: CONV_ID, authUserId: AUTH_USER_ID, body: "mira este contacto",
      entityRefs: [{ entityType: "contact", recordId: "contact-1" }],
    });
  });

  it("rejects entityRefs on an external_support conversation with 400", async () => {
    const prisma = buildPrismaMock([
      [{ id: PROFILE_ID }],
      [{ id: "member-row" }],
    ]);
    const service = createChatService({ prisma, supabaseAdmin: {}, entityReferencesService: { resolveEntityRefs: async () => { throw new Error("should not be called"); } } });
    await assert.rejects(
      () => service.sendMessage({
        conversationId: CONV_ID, authUserId: AUTH_USER_ID, body: "x",
        entityRefs: [{ entityType: "contact", recordId: "c1" }],
      }),
      (err) => err instanceof ChatServiceError && err.status === 400,
    );
  });

  it("omits metadata.entityRefs when no entityRefs are sent (unchanged behavior)", async () => {
    const prisma = buildPrismaMock([
      [{ id: PROFILE_ID }],
      [{ id: "member-row" }],
      [{ id: "msg-1", conversation_id: CONV_ID, created_at: new Date(), metadata: {} }],
      [{ id: "msg-1", conversation_id: CONV_ID, sender: null, attachments: null, reactions: null, metadata: {} }],
    ]);
    const service = createChatService({ prisma, supabaseAdmin: {} }); // no entityReferencesService at all
    const result = await service.sendMessage({ conversationId: CONV_ID, authUserId: AUTH_USER_ID, body: "hola" });
    assert.ok(result);
  });
});
```

**Implementer note**: the first and third tests' exact mock sequences are best-effort based on `sendMessage`'s shape as of Phase E — you MUST read the actual current function (Step 1) and adjust the queued mock rows to match its real, current call order (particularly: does checking `entityRefs.length > 0` require a fresh conversation-type lookup, or can it reuse a type that's already fetched elsewhere in the function for another reason, e.g. thread resolution? Read the code, don't guess) before these tests will pass. This is flagged explicitly rather than asserted as correct because the exact call sequence is exactly the kind of detail that has drifted between phases before.

- [ ] **Step 5: Implement the `sendMessage` extension**

Add `entityRefs = []` to `sendMessage`'s destructured params. Early in the function (after `assertMember`, alongside the existing thread-root-id/mention resolution steps — read the code to decide the cleanest insertion point, likely right before the INSERT since it doesn't depend on/isn't depended on by the mention or thread logic):

```javascript
    if (entityRefs?.length) {
      const [convRow] = await prisma.$queryRaw`SELECT type FROM chat_conversations WHERE id = ${conversationId} LIMIT 1`;
      if (convRow?.type === "external_support") {
        throw new ChatServiceError("No se pueden adjuntar referencias en conversaciones de soporte externo.", 400);
      }
    }

    const resolvedEntityRefs = entityReferencesService && entityRefs?.length
      ? await entityReferencesService.resolveEntityRefs({ authUserId, entityRefs })
      : [];
```

Merge `resolvedEntityRefs` into the message's `metadata` the same way `finalMetadata` already merges `mentions` (read the existing `finalMetadata` construction — likely `{ ...metadata, mentions: {...} }` when mentions exist — and extend it to also conditionally include `entityRefs: resolvedEntityRefs` when non-empty, following the exact same "only add the key when there's something to add" convention already established for `mentions`).

- [ ] **Step 6: Run tests, iterate until green**

Run: `node --test apps/api/src/routes/chat/__tests__/*.test.js`
Expected: all pass, including pre-existing tests (81 before this task).

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/routes/chat/chat-service.js apps/api/src/routes/chat/index.js apps/api/src/routes/chat/__tests__/chat-service.test.js
git commit -m "feat(chat): resolve and store entity references on sendMessage"
```

---

### Task 3: Validator

**Files:**
- Modify: `packages/validators/src/chat.js`

- [ ] **Step 1: Add the field**

```javascript
export const chatSendMessageSchema = z.object({
  body: z.string().max(10000).nullish().transform(v => v ?? ""),
  messageType: z.enum(["text", "image", "file", "system"]).default("text"),
  metadata: z.record(z.unknown()).optional(),
  attachmentIds: z.array(z.string().uuid()).optional(),
  threadRootId: z.string().uuid().optional(),
  entityRefs: z.array(z.object({
    entityType: z.enum(["contact", "file", "ledger_account", "hr_employee"]),
    recordId: z.string().uuid(),
  })).max(5).optional(),
});
```

- [ ] **Step 2: Build check and commit**

```bash
pnpm build
git add packages/validators/src/chat.js
git commit -m "feat(chat): add entityRefs to sendMessage validator"
```

---

## Self-Review Notes

- **Spec coverage**: Task 1 covers Section 12's resolution logic and Section 23 edge cases 1/2/5. Task 2 covers Section 12's external_support rejection (edge case 4) and metadata storage. Task 3 covers Section 14.
- **Casing**: `metadata.entityRefs` is a JSONB value under an existing camelCase-named top-level column (`metadata`) — its internal shape (`entityType`/`recordId`/`title`/`subtitle`/`url`) is entirely this phase's own new convention (not a pre-existing raw SQL column), so no casing pitfall like Phase D/E's applies here; still, keep it camelCase internally for consistency with `metadata.mentions`' existing internal shape.
- **No placeholders** except the explicitly-flagged "verify the real call sequence"/"confirm each export" notes in Task 2 Steps 2/4 — matching this session's established convention for flagging "read the real code" directives rather than guessing.
