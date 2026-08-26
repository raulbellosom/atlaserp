# Chat Channels & Roles — Phase F: Cross-Module Entity References

Date: 2026-08-27
Status: Draft
Author: Claude (agent)
Spec file: docs/superpowers/specs/2026-08-27-chat-entity-references-phase-f-design.md
Plan files: docs/superpowers/plans/2026-08-27-chat-entity-references-phase-f-plan-a-backend.md, docs/superpowers/plans/2026-08-27-chat-entity-references-phase-f-plan-b-frontend.md

Note on process: per the user's standing instruction ("adelante y no pares hasta terminar") covering this entire roadmap, this spec was authored directly rather than through interactive brainstorming Q&A. One exception: the scope tradeoff in Section 3 below was significant enough (it changes what "generic" means for this phase) that it was put to the user directly via AskUserQuestion before writing this spec — they chose to unblock `Contact` with real routes first (done: `docs/superpowers/specs/2026-08-27-contacts-detail-route-design.md`, shipped) rather than ship a narrower 3-type version. Every other design decision below is a judgment call, stated with its rationale so it can be challenged/revised on review rather than re-litigated from scratch.

---

## 1. Feature title

Chat Channels & Roles — Phase F: Cross-Module Entity References

## 2. Status

Draft

## 3. Context

Phases A–E built channels, roles, mentions, pinning, reactions, and threads. The original roadmap described this final phase as a generic reference card to "any installed module's blueprint ENTITY." Research done while designing this phase found that framing doesn't hold up against the current codebase: `ENTITY`-kind blueprints (`apps/api/src/manifests/official/*.js`) carry no title field, no API path, and no route; most modules — including `Contact`, until the preliminary fix above — don't even have a single-record detail route to link to. There is no generic "fetch any entity by module+id" endpoint, and building one would mean adding real API/routing work to several unrelated modules, not a chat feature.

This phase instead ships a small, explicit, **config-driven** registry of 4 entity types that already have (as of the preliminary Contact fix) a working `GET /:id` endpoint and a working detail-page route: `Contact`, `FileAsset`, `LedgerAccount` (labeled `FinanceAccount` in this codebase's existing activity-log convention), and `HrEmployee`. The registry itself — not per-entity-type bespoke chat code — is the generic mechanism: adding a 5th type later is one new registry entry, not a new feature.

## 4. Problem

A chat message that's about a specific contact, file, ledger account, or employee has no way to link to it — only prose ("revisa el contacto de Ada Lovelace") or, for files, a full re-upload via the existing attachment flow (which duplicates storage rather than linking to what's already there).

## 5. Goals

1. A member composing a message in a `direct`/`group`/`channel` conversation can attach up to 5 entity references (Contact, File, Ledger Account, or HR Employee) via a searchable picker.
2. Each reference renders as a small, clickable card under the message body — icon, title, optional subtitle — that navigates to that entity's real detail page.
3. A reference can only be attached if the sender can actually read that entity (reuses each entity's own existing permission-aware `getById`/`getEmployee`/`getAccount` service function — no new, parallel permission-checking logic).
4. The registry mapping entity type → resolver/route is a single, small, explicit table — extending it to a 5th entity type later should not require touching the composer, the render component, or the message send path.

## 6. Non-goals

1. Not "any blueprint ENTITY, automatically" — see Section 3. Contact/File/LedgerAccount/HrEmployee only, for now (Future enhancement: more types).
2. No live re-resolution of a reference's title on every read. The title/subtitle are resolved once, server-side, at send time, and snapshotted into the message's `metadata` — same tradeoff Slack/Discord message-link previews make. If the target is later renamed, the chat card shows the old name; clicking it still opens the live, current record (the stored `url`/`recordId` are always current, only the display text can go stale). Documented, accepted simplification — re-resolving on every `listMessages` call would mean fanning out to 4 different services' permission-checked queries on every message fetch, which is a materially bigger and riskier change than this phase needs.
3. No entity references in `external_support` conversations. A guest-facing support conversation must never expose a clickable link to an internal ERP record (a ledger account, an employee) to an external visitor — this is a real information-exposure risk, not just a UX mismatch. The composer's reference button doesn't render there; the backend also rejects any `entityRefs` on an `external_support` send (defense in depth, matching the pattern already established for threads' channel/group-only enforcement — Phase E shipped a bug where only the UI enforced a type restriction and review had to add the missing backend check).
4. No new `CHAT_PERMISSIONS` key. Attaching a reference requires the same conversation-membership check every message send already requires — the gate is on the TARGET entity's own read permission (Goal 3), not a new chat-specific rank/permission concept.
5. No editing which references are attached to an already-sent message (consistent with this module's existing convention — message `body` edits are supported via `editMessage`, but attachments/reactions/pins are all add-only or toggle, never "edit the set" after the fact; references follow the same pattern).

## 7. User stories

- As a member, I want to say "revisa este archivo" and have the actual file linked, not just described.
- As a member, I want to click a reference card in chat and land directly on that contact's/file's/account's/employee's page, without navigating there manually.
- As an admin, I don't want a reference to leak the existence or title of a record the sender (or a later reader) can't actually access.

## 8. UX requirements

Spanish labels, `@atlas/ui` primitives only.

- **Composer**: a new icon button (icon: `Link2` from `lucide-react` — confirm it isn't already used elsewhere in `MessageComposer.jsx` before finalizing, same verification discipline as every icon choice in this module's prior phases) next to the existing emoji/file-attach buttons. Opens a `Popover` (the same `@atlas/ui` primitive Phase D added and reused for the reaction picker): a `SelectField` for entity type ("Contacto" / "Archivo" / "Cuenta contable" / "Colaborador"), then a `ComboboxField` (search-as-you-type, not `CreatableComboboxField` — referencing something that doesn't exist yet isn't a valid action here, unlike a mention target) hitting that type's existing list/picker endpoint. Selecting a result adds a small removable chip to a "pending references" row above the composer's text input (visually parallel to the existing pending-attachments row), capped at 5 (the 6th attempt is a no-op with a toast, mirroring how other capped actions in this codebase communicate limits).
- **Not offered in `external_support` conversations** — the reference button doesn't render there at all (Non-goal 3).
- **Message rendering**: each attached reference renders as a small bordered card below the message body (after `MessageReactions`, before/after `AttachmentsBlock` — pick one consistent position and apply it uniformly; recommend after attachments, since a reference is closer to "related context" than "content of this message") — an icon (mapped client-side from the stored `entityType` string, not sent by the backend as an icon component), the stored `title`, and if present the stored `subtitle`, in a `Button`-like clickable row that navigates to the stored `url`. Rendered in **both** own-message and other-message bubble branches (the exact failure mode found by review in every prior phase that touched `ChatMessageBubble.jsx` — Phase C's mentions, Phase D's reactions, Phase E's reply pill — must not recur here).
- **Loading/empty states**: the picker's `ComboboxField` uses its own existing loading/no-results states (already built into that shared component — no new empty-state UI to design).

## 9. Routes/screens

No new top-level routes for chat itself (the Contact detail route from the preliminary fix, plus the 3 already-existing detail routes for File/LedgerAccount/HrEmployee, are what reference cards link to). New component: `EntityReferenceCard.jsx` (`apps/desktop/src/modules/atlas.chat/components/EntityReferenceCard.jsx`) and `EntityReferencePicker.jsx` (the composer's popover content).

## 10. Data model

### Modified models

**`chat_messages`**: no new columns. References are stored inside the existing `metadata` JSONB column, under a new key: `metadata.entityRefs: [{ entityType, recordId, title, subtitle, url }]` — same storage pattern already established for `metadata.mentions` (Phase C). `entityType` is one of `"contact" | "file" | "ledger_account" | "hr_employee"` (fixed, short, internal keys — not full `module.entity` dotted strings, since this is an explicit registry, not a blueprint-key lookup).

No new table, no migration required for this phase.

## 11. Prisma impact

None — `chat_messages.metadata` already exists and is untyped JSONB.

## 12. API contract

### POST /chat/conversations/:id/messages (existing `sendMessage` endpoint — extended further)

New optional body field: `entityRefs: [{ entityType: string, recordId: string }]` (max 5 entries — the client only ever needs to send `entityType`+`recordId`; title/subtitle/url are resolved server-side, never trusted from the client, so a compromised/buggy frontend can't inject an arbitrary display title for a record it doesn't actually have permission to see).

Resolution (happens inside `sendMessage`, before the INSERT):
1. Reject the whole send with 400 if `conversation.type === "external_support"` and `entityRefs.length > 0` (Non-goal 3, enforced server-side — do not rely on the composer button being hidden).
2. For each `{ entityType, recordId }`: look up the registry entry for `entityType` (unknown type → drop silently, same "degrade rather than fail the whole send" precedent as Phase C's malformed-mention handling); call that type's resolver, which instantiates the target module's own service (with the SAME `prisma`/`supabaseAdmin` chat's router already has) and calls its existing `getById`/`getEmployee`/`getAccount` function with the sender's `authUserId` (deriving `companyId`/`actorId` via the identical membership-lookup pattern already duplicated three times across `contacts-service.js`/`files-service.js`/`hr-service.js` — see Section 24 Risk 2 for why a fourth, chat-local instance of this same lookup is the right call here, not a shared extraction).
3. If resolution throws (404/403/etc from the target service, meaning the record doesn't exist or the sender can't read it) or the target service doesn't return a row, drop that specific reference — never surface the underlying entity's existence/absence to the sender via a different-shaped error (the message still sends, just without that one reference; same graceful-degradation precedent as mentions).
4. Successfully-resolved references are stored, snapshotted, in `metadata.entityRefs` on the new message row.

Response: unchanged shape (`{ data: Message }`), with `metadata.entityRefs` populated per the resolved (not requested) set — a client that requested 3 refs and had 1 silently dropped for a permission failure sees only 2 in the response, with no explicit error surfaced (matches the "don't leak record existence" principle — telling the sender "you can't see record X" would itself be an oracle for a record they otherwise couldn't confirm exists).

No other endpoints change — reference cards are read entirely off the existing `metadata` field, already returned by `listMessages`/`getMessageFull` with no SELECT changes needed (JSONB `metadata` is already selected in full).

## 13. SDK contract

`sendMessage(conversationId, { ..., entityRefs }, token)` — extends the existing options object, no new SDK method for sending. Each of the 4 target entity types' EXISTING search/list/picker SDK methods are reused for the composer's picker (`atlas.contacts.picker`, and the equivalent list methods for files/ledger accounts/hr employees — confirm each's exact existing signature during Plan B, don't assume they're uniform).

## 14. Validator contract

`chatSendMessageSchema` (existing) gains one new optional field:
```javascript
entityRefs: z.array(z.object({
  entityType: z.enum(["contact", "file", "ledger_account", "hr_employee"]),
  recordId: z.string().uuid(),
})).max(5).optional(),
```

## 15. Module manifest impact

N/A — `atlas.chat` is a built-in module, not AME3.

## 16. Navigation impact

N/A — reference cards navigate to each target entity's own EXISTING route (`/app/m/atlas.contacts/contacts/:id`, `/app/m/atlas.files/files/:id`, `/app/m/atlas.ledger/accounts/:id`, `/app/m/atlas.hr/hr/employees/:id`); no new nav entries.

## 17. Blueprint impact

N/A — this phase deliberately does NOT read from the `ENTITY` blueprint system (Section 3's central finding). The registry is a plain JS object in the new chat service file, not blueprint-driven.

## 18. RBAC/permissions

No new `CHAT_PERMISSIONS` key (Non-goal 4). The gate is transitive: a reference resolves only if the sender passes the TARGET entity's own existing permission check.

| Permission key | Guards |
|---|---|
| `contacts.contacts.read` (existing, unchanged) | Resolving a `contact` reference |
| `files.assets.read` (existing, unchanged) | Resolving a `file` reference |
| `ledger.accounts.read` (existing, unchanged) | Resolving a `ledger_account` reference |
| `hr.employee.read` (existing, unchanged) | Resolving a `hr_employee` reference |

## 19. Multi-company behavior

Every target service's own `getById`/`getEmployee`/`getAccount` already scopes by the sender's company (Section 12) — this phase adds no new cross-company query path, and inherits the same isolation guarantees already in place for each entity's own detail page. A sender cannot reference (and thus cannot leak the title of) a record from a different company than their own, since the underlying lookup would simply return nothing for it, same as visiting that entity's detail page directly would.

## 20. Files/storage impact

N/A for `file` references specifically — referencing an existing `FileAsset` links to it, it does not re-upload or duplicate storage (distinct from the existing chat attachment flow, which does upload new files).

## 21. Export/import requirements

N/A.

## 22. Audit log requirements

N/A — consistent with every other message-level action in this module (send/edit/delete/pin/react/reply), none of which are audited today.

## 23. Edge cases

1. **Referencing a record the sender can't read**: dropped silently from the send (Section 12, step 3) — the message still sends with the other, valid references.
2. **Referencing a record that's deleted between picking it in the composer and hitting send**: same as edge case 1 — the resolver's underlying `getById`/etc. call fails the same way for "doesn't exist" as for "no permission" (both 404 from the target service), so this is already handled by the same code path, not a separate case to build.
3. **Referencing the same record twice in one message**: allowed, not deduplicated — simplest behavior, matches how nothing else in this module deduplicates (e.g. the same file can be attached... actually attachments are inherently unique by upload; closer precedent: nothing currently stops mentioning the same user twice via two separate `@` tokens, which Phase C also left undeduplicated).
4. **`entityRefs` sent on an `external_support` conversation**: whole send rejected with 400 (Section 12, step 1) — a stricter response than the silent-drop behavior in edge cases 1-2, because this is a caller doing something the UI should never have allowed at all (composer button hidden there), not a legitimately-raced permission/deletion timing issue.
5. **Ledger account resolution needs `companyId`/`actorId`, not just `authUserId`** (Section 12, step 2) — this is an internal implementation detail of the `ledger_account` resolver only; the other three resolvers take `authUserId` directly, matching their own services' existing signatures. Not a caller-visible edge case, listed here so Plan A's implementer doesn't miss the signature mismatch when writing the registry (this exact mismatch was found during this spec's own research, not guessed).

## 24. Risks

1. **Risk (the central risk of this phase, learned from every prior phase's review cycle)**: a new data shape (`metadata.entityRefs`) has to reach every place a message renders, not just the primary chat thread. Mitigation: Plan B must explicitly enumerate every message-rendering surface up front (`ChatMessageBubble.jsx` main thread — both branches — plus `FloatingChatHub.jsx`, which renders real `channel`/`group`/`direct` conversations through the identical `ChatMessageList`/`ChatMessageBubble` pipeline as the main window) and wire the reference-card render into all of them from the start, not just the main thread with the others left as a "documented gap" — Phase D's reactions and Phase E's reply-count pill both left `FloatingChatHub` unwired on the first pass and it was flagged (accepted as a documented gap both times, since neither the pill nor the reactions were destructive if inert) — a reference CARD that's outright missing (not just inertly present) in the mini-widget is worse, and easy to avoid this time by simply wiring it there from Task 1 rather than treating it as a later nice-to-have. `ExternalInboxScreen.jsx` is correctly excluded (Non-goal 3 — `external_support` conversations never have `entityRefs` to render).

2. **Risk**: introducing a 4th independent instance of the `authUserId → companyId` membership-lookup pattern (already duplicated identically in `contacts-service.js`, `files-service.js`, `hr-service.js`). Mitigation: this is a deliberate, consistent choice, not an oversight — this codebase has already established (by not extracting the first three into a shared helper across three separate reviewed phases of work) that this small, stable, rarely-changing lookup is cheap enough to duplicate rather than couple four independent services to a shared dependency. Extracting a shared helper now, only for chat's benefit, would make chat's ledger-account resolver depend on a refactor of three unrelated, already-shipped modules — out of proportion to this phase's actual need. If a future phase needs this in a 5th place, that's the right time to extract it, not now.

3. **Risk**: resolving up to 5 references synchronously inside `sendMessage`, each potentially hitting a different service/table, adds latency to every message send that includes references (not a "well-known" cost the way `listMessages`' `json_agg` subqueries are, since it's cross-service, not a single SQL query). Mitigation: `Promise.all` across the (at most 5) resolutions rather than sequential awaits — parallelizes the added latency instead of stacking it. Accepted as proportional: this only affects sends that actually attach references, not the common case of a plain-text message.

4. **Risk**: `ChatMessageBubble.jsx` is already at 1040 lines (Phase E, spec risk 4, an already-documented, already-accepted tradeoff). Mitigation: `EntityReferenceCard` is a new, separate component from the start (same discipline every prior phase applied to its own new render pieces) — `ChatMessageBubble.jsx` only gains the few lines needed to map `message.metadata.entityRefs` to a `.map()` of that component, not the card's own rendering logic.

## 25. Acceptance criteria

1. Given a member attaches a valid Contact reference and sends, then the message's `metadata.entityRefs` contains that contact's `{entityType: "contact", recordId, title, url}`.
2. Given a member attaches a reference to a record they cannot read (wrong company, or lacking the target permission), when the message sends, then that specific reference is silently absent from the stored message — the send still succeeds for the rest of the message.
3. Given a reference card renders in the main chat thread, when the same conversation is also open in the floating mini-chat widget (`FloatingChatHub`), then the card renders there too, not just in the main window.
4. Given a member attempts to send `entityRefs` in an `external_support` conversation (e.g. a stray direct API call), when the request is processed, then it's rejected with 400, not silently accepted.
5. Given a reference card is clicked, when navigation completes, then the user lands on that entity's real, live detail page (not a stale/cached preview).

## 26. Verification plan

- `pnpm build` — no build errors.
- `node --test apps/api/src/routes/chat/__tests__/` (explicit filenames) — new coverage for: successful multi-type resolution, permission-denied silent drop, external_support rejection, the ledger-account companyId/actorId derivation specifically (Edge case 5).
- Manual browser QA if a session is available: attach a Contact and a File reference to one message, send it, confirm both cards render and both are clickable to the right pages; confirm the composer's reference button is absent in an external support conversation.

## 27. Rollback plan

No migration (JSONB field addition only) — trivially revertable by removing the new validator field, registry file, and render component; no data-destructive risk to existing messages (a message sent before this phase simply has no `entityRefs` key, already the default `undefined`/absent state every existing message has today).

## 28. Future enhancements

1. More registry entries as more modules gain real detail routes (e.g. Finance AR/AP documents, once that model exists — see Phase F's own research notes; it doesn't exist in the schema today).
2. Live re-resolution (or a periodic refresh) if stale titles become a real user complaint.
3. A generic blueprint-driven registry, if the ENTITY blueprint system is ever extended with `titleField`/`apiPath`/route metadata across modules — the original aspiration for this phase, deferred pending that infrastructure actually existing.
