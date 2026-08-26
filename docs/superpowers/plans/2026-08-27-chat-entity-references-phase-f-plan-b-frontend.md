# Chat Entity References Phase F — Plan B (Frontend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a member attach up to 5 entity references to a message via a composer picker, and render them as clickable cards under the message body in every real message-rendering surface.

**Architecture:** The picker lives INSIDE `MessageComposer.jsx` itself (not a separate wrapper) — same pattern as the existing emoji-picker button, since `onSend`'s payload is assembled inside that component. A new `EntityReferenceCard.jsx` renders each resolved reference; wired into `ChatMessageBubble.jsx` (both branches). `MessageComposer.jsx` gains a `conversationType` prop so the reference button can be hidden in `external_support` conversations — **all 4 existing call sites of `MessageComposer` must be updated to pass it**, enumerated in Task 1.

**Tech Stack:** React, `@atlas/ui` (`ComboboxField`, `SelectField`, `Popover`), TanStack Query.

**Depends on:** Plan A (backend) — must be complete first (`sendMessage` accepts `entityRefs`, resolves and stores them in `metadata.entityRefs`).

**Spec:** `docs/superpowers/specs/2026-08-27-chat-entity-references-phase-f-design.md`

**Verified fact this plan relies on**: `@atlas/ui`'s `ComboboxField` (`packages/ui/src/components/FormFields.jsx:1569`) does NOT do server-side search-as-you-type — its `onSearchChange` prop fires exactly once, when the picker is first opened with an empty `options` array (`handleOpen`'s `if (willOpen && options.length === 0) onSearchChange?.("")`). Typing after that only filters the already-loaded `options` array client-side by substring match on `label`. **Design accordingly**: fetch each entity type's list ONCE (a capped page, not full search-as-you-type against the backend) when that type is selected, not on every keystroke. This is simpler than the spec's Section 13 phrasing ("confirm each's exact existing signature... don't assume they're uniform") implied might be needed — the uniformity that matters (how `ComboboxField` consumes them) turned out to already exist in the shared component, not in the 4 backend endpoints.

**Verified per-type list-fetch calls** (exact SDK signatures — note the inconsistent argument ORDER across domains, don't assume uniformity):
- Contact: `atlas.contacts.picker(token, { q, limit })` — a dedicated lightweight picker endpoint already exists, prefer it over `.list`.
- File: `atlas.files.list({ q, pageSize }, token)` — **params first, token second** (different order than the other three).
- HR Employee: `atlas.hr.listEmployees(token, { search, pageSize })` — token first.
- Ledger Account: `atlas.ledger.listAccounts(token, {})` — token first; **no server-side search param exists on this endpoint** (confirmed: `GET /ledger/accounts` takes no query filter) — fetch the full list once (typically small per company) and let `ComboboxField`'s own client-side filter do the narrowing; do not attempt to add server-side search support to this endpoint, out of scope.

---

## File Structure Map

| File | Action | Responsibility |
|---|---|---|
| `apps/desktop/src/modules/atlas.chat/components/EntityReferencePicker.jsx` | Create | Popover content: type select + combobox, used inside `MessageComposer` |
| `apps/desktop/src/modules/atlas.chat/components/EntityReferenceCard.jsx` | Create | Read-only rendered card for a resolved reference |
| `apps/desktop/src/modules/atlas.chat/components/MessageComposer.jsx` | Modify | New button/popover, `pendingEntityRefs` state, `conversationType` prop, include `entityRefs` in `onSend` payload |
| `apps/desktop/src/modules/atlas.chat/components/ChatMessageBubble.jsx` | Modify | Render `EntityReferenceCard` list in both branches |
| `apps/desktop/src/modules/atlas.chat/components/ChatWindow.jsx` | Modify | Pass `conversationType` to its `MessageComposer` (currently doesn't) |
| `apps/desktop/src/modules/atlas.chat/components/FloatingChatHub.jsx` | Modify | Pass `conversationType` to its `MessageComposer` |
| `apps/desktop/src/modules/atlas.chat/components/ThreadPanel.jsx` | Modify | Pass `conversationType` to its `MessageComposer` (already has this prop available, just not threaded through yet) |
| `apps/desktop/src/modules/atlas.chat/screens/ExternalInboxScreen.jsx` | Modify | Pass `conversationType="external_support"` explicitly (the one call site where the reference button must NEVER appear) |

---

### Task 1: `EntityReferencePicker` + wire into `MessageComposer`

**Files:**
- Create: `apps/desktop/src/modules/atlas.chat/components/EntityReferencePicker.jsx`
- Modify: `apps/desktop/src/modules/atlas.chat/components/MessageComposer.jsx`

- [ ] **Step 1: Read `MessageComposer.jsx` in full first (required)**

Confirm the exact current prop list, `pendingFiles` state shape (`AttachmentPreviewCard`, the pending-files row rendered above the input, lines ~484-493 in this plan's research pass — re-verify), and `handleSend`'s exact `onSend({...})` call (lines ~387-391 in this plan's research pass — re-verify) before editing, since line numbers may have shifted.

- [ ] **Step 2: Implement `EntityReferencePicker.jsx`**

A `Popover` (same primitive Phase D's `MessageReactionPicker` already uses) whose content is: a `SelectField` for entity type (4 fixed options, Spanish labels: "Contacto"/"Archivo"/"Cuenta contable"/"Colaborador", values `contact`/`file`/`hr_employee`/`ledger_account` — matching the backend's exact `entityType` enum from `chatSendMessageSchema`, byte-for-byte, since these strings round-trip to the API unchanged), then, once a type is picked, a `ComboboxField` populated by fetching that type's list (per the verified per-type calls above) via a `useQuery` keyed on `["chat-entity-ref-options", entityType, token]`. Map each fetched row to `{ label, value: row.id }` using the correct display field per type (Contact: `row.name`; File: `row.originalName`; HR Employee: `` `${row.firstName} ${row.lastName}` ``; Ledger Account: `` row.bank ? `${row.name} · ${row.bank}` : row.name ``). On selection, call the `onPick({ entityType, recordId, label })` prop (the `label` is passed back so the composer can render a friendly pending-chip without waiting for the server round-trip that resolves the real title later — this is a client-side echo for UX only, NOT trusted as the stored title; Plan A's resolver always re-derives the real title server-side regardless of what the client displayed while composing).

```javascript
// apps/desktop/src/modules/atlas.chat/components/EntityReferencePicker.jsx
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Popover, PopoverAnchor, PopoverContent, SelectField, ComboboxField } from "@atlas/ui";
import { useAuth } from "../../../auth/AuthProvider";
import { atlas } from "../../../lib/atlas";

const ENTITY_TYPES = [
  { value: "contact", label: "Contacto" },
  { value: "file", label: "Archivo" },
  { value: "ledger_account", label: "Cuenta contable" },
  { value: "hr_employee", label: "Colaborador" },
];

async function fetchOptions(entityType, token) {
  if (entityType === "contact") {
    const res = await atlas.contacts.picker(token, { limit: 100 });
    return (res?.data ?? []).map((c) => ({ label: c.name, value: c.id }));
  }
  if (entityType === "file") {
    const res = await atlas.files.list({ pageSize: 100 }, token);
    return (res?.data ?? []).map((f) => ({ label: f.originalName, value: f.id }));
  }
  if (entityType === "hr_employee") {
    const res = await atlas.hr.listEmployees(token, { pageSize: 100 });
    return (res?.data ?? []).map((e) => ({ label: `${e.firstName} ${e.lastName}`.trim(), value: e.id }));
  }
  if (entityType === "ledger_account") {
    const res = await atlas.ledger.listAccounts(token, {});
    return (res?.data ?? []).map((a) => ({ label: a.bank ? `${a.name} · ${a.bank}` : a.name, value: a.id }));
  }
  return [];
}

export function EntityReferencePicker({ open, onOpenChange, onPick, children }) {
  const { session } = useAuth();
  const token = session?.access_token;
  const [entityType, setEntityType] = useState(null);

  const optionsQuery = useQuery({
    queryKey: ["chat-entity-ref-options", entityType, token],
    queryFn: () => fetchOptions(entityType, token),
    enabled: Boolean(entityType && token),
    staleTime: 30_000,
  });

  return (
    <Popover open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setEntityType(null); }}>
      <PopoverAnchor asChild>{children}</PopoverAnchor>
      <PopoverContent side="top" align="start" className="w-72 p-3 space-y-2">
        <SelectField
          label="Tipo"
          value={entityType ?? ""}
          onChange={(v) => setEntityType(v || null)}
          options={ENTITY_TYPES}
          placeholder="Selecciona un tipo..."
        />
        {entityType && (
          <ComboboxField
            label="Registro"
            options={optionsQuery.data ?? []}
            value={null}
            onChange={(recordId) => {
              const opt = (optionsQuery.data ?? []).find((o) => o.value === recordId);
              if (!opt) return;
              onPick({ entityType, recordId, label: opt.label });
              onOpenChange(false);
              setEntityType(null);
            }}
            placeholder="Buscar..."
            emptyText={optionsQuery.isLoading ? "Cargando..." : "Sin resultados"}
          />
        )}
      </PopoverContent>
    </Popover>
  );
}
```

**Verify before trusting this snippet**: confirm `SelectField`'s real prop names (`value`/`onChange`/`options`/`placeholder` — check `packages/ui/src/components/FormFields.jsx`'s actual `SelectField` export, this plan did not verify its exact signature the way it verified `ComboboxField`'s) before finalizing — adjust prop names if they differ.

- [ ] **Step 3: Wire into `MessageComposer.jsx`**

Add a `conversationType` prop (new, alongside the existing `onSend`/`onTyping`/`disabled`/`placeholder`/`compact`/`conversationId`). Add `pendingEntityRefs` state (`useState([])`, array of `{ entityType, recordId, label }`, capped at 5 client-side — same cap as the backend's Zod `.max(5)`, matched here to give immediate feedback rather than a round-trip rejection). Add a new button (icon: `Link2` from `lucide-react` — confirm it's not already imported/used in this file first) in the same icon-button row as the existing Paperclip/Smile buttons, rendered ONLY when `conversationType && conversationType !== "external_support"` (spec Non-goal 3 — the composer-level enforcement; Plan A's backend enforcement is the actual safety net, this is just not offering an action that would be rejected anyway). Clicking it opens `EntityReferencePicker`, wrapped around the button itself (`PopoverAnchor`-style, same pattern `MessageReactionPicker` already established in Phase D).

Render pending reference chips above the input (same row/position pattern as the existing `pendingFiles` preview row) — a small removable pill per entry showing `label` and an entity-type icon (map `entityType` string → a `lucide-react` icon client-side: `contact` → `User`, `file` → `Paperclip`, `ledger_account` → `Landmark`, `hr_employee` → `IdCard`).

In `handleSend` (the function that calls `onSend({...})`), add `entityRefs: pendingEntityRefs.map(({ entityType, recordId }) => ({ entityType, recordId }))` to the payload (only `entityType`/`recordId` — never send the client-side `label`, which Plan A's backend never reads and always re-derives). Clear `pendingEntityRefs` on successful send, same as `pendingFiles`/`body` are already cleared.

- [ ] **Step 4: Build check**

Run: `pnpm --filter @atlas/desktop exec vite build`

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/components/EntityReferencePicker.jsx apps/desktop/src/modules/atlas.chat/components/MessageComposer.jsx
git commit -m "feat(chat): add entity reference picker to the composer"
```

---

### Task 2: `EntityReferenceCard`

**Files:**
- Create: `apps/desktop/src/modules/atlas.chat/components/EntityReferenceCard.jsx`

- [ ] **Step 1: Implement**

A small, read-only, clickable card — icon (mapped from `entityType`, same 4-way mapping as Task 1's pending chips), `title`, `subtitle` if present, navigates to `url` on click (`useNavigate` from `react-router-dom`, prefixed with `/app` — confirm this matches how every other in-chat navigation in this module already prefixes its `navigate()` calls, e.g. `ChatWindow.jsx`'s existing `navigate(...)` calls, before finalizing the exact URL construction — the stored `url` from Plan A's resolver is a bare `/app/m/...` path already, so this is likely a direct `navigate(ref.url)` with no further prefixing needed, but confirm rather than assume).

```javascript
// apps/desktop/src/modules/atlas.chat/components/EntityReferenceCard.jsx
import { useNavigate } from "react-router-dom";
import { User, Paperclip, Landmark, IdCard, ExternalLink } from "lucide-react";

const ICON_BY_TYPE = { contact: User, file: Paperclip, ledger_account: Landmark, hr_employee: IdCard };

export function EntityReferenceCard({ reference }) {
  const navigate = useNavigate();
  const Icon = ICON_BY_TYPE[reference.entityType] ?? ExternalLink;

  return (
    <button
      type="button"
      onClick={() => navigate(reference.url)}
      className="mt-1 flex items-center gap-2 rounded-lg border border-[hsl(var(--border))] px-2.5 py-1.5 text-left hover:bg-[hsl(var(--muted))] transition-colors max-w-full"
    >
      <Icon className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--muted-foreground))]" />
      <div className="min-w-0">
        <p className="text-xs font-medium truncate">{reference.title}</p>
        {reference.subtitle && (
          <p className="text-[10px] text-[hsl(var(--muted-foreground))] truncate">{reference.subtitle}</p>
        )}
      </div>
    </button>
  );
}
```

- [ ] **Step 2: Build check and commit**

```bash
pnpm --filter @atlas/desktop exec vite build
git add apps/desktop/src/modules/atlas.chat/components/EntityReferenceCard.jsx
git commit -m "feat(chat): add EntityReferenceCard component"
```

---

### Task 3: Wire into `ChatMessageBubble`

**Files:**
- Modify: `apps/desktop/src/modules/atlas.chat/components/ChatMessageBubble.jsx`

This file is at 1040 lines (spec Section 24 Risk 4) — this task's addition must stay small (a `.map()` over `message.metadata?.entityRefs`, not new rendering logic inline).

- [ ] **Step 1: Read the current file's own/other-message render branches in full first (required)**

Same discipline as every prior phase's equivalent task — this is the exact structure (`ChatMessageBubble.jsx`'s two message-layout branches) that has caused a real, reviewer-caught "reached one branch, not the other" bug in Phase C and a gating-mismatch bug in Phase D.

- [ ] **Step 2: Add the render**

In BOTH the own-message and other-message branches, immediately AFTER the existing `AttachmentsBlock` render (spec Section 8: reference cards render below attachments, as "related context" rather than message content):

```javascript
          {!isDeleted && message.metadata?.entityRefs?.length > 0 && (
            <div className="flex flex-col gap-1 mt-1">
              {message.metadata.entityRefs.map((ref) => (
                <EntityReferenceCard key={`${ref.entityType}:${ref.recordId}`} reference={ref} />
              ))}
            </div>
          )}
```

Import `EntityReferenceCard` at the top of the file alongside the existing `MessageReactions`/`MessageReactionPicker` imports.

- [ ] **Step 3: Self-review**

Explicitly confirm (state the answer in your report, don't just claim "done"): does this render block appear in BOTH branches, with identical gating and identical data access (`message.metadata?.entityRefs`, not `message.entityRefs` — this data lives inside the existing `metadata` JSONB field, unlike `thread_reply_count`/`pinned_at`, which are their own top-level columns; do not confuse this with the top-level-column casing pitfall from Phases D/E, this is a genuinely different, correct access path)?

- [ ] **Step 4: Build check and commit**

```bash
pnpm --filter @atlas/desktop exec vite build
git add apps/desktop/src/modules/atlas.chat/components/ChatMessageBubble.jsx
git commit -m "feat(chat): render entity reference cards in the message bubble"
```

---

### Task 4: Thread `conversationType` through every `MessageComposer` call site

**Files:**
- Modify: `apps/desktop/src/modules/atlas.chat/components/ChatWindow.jsx`
- Modify: `apps/desktop/src/modules/atlas.chat/components/FloatingChatHub.jsx`
- Modify: `apps/desktop/src/modules/atlas.chat/components/ThreadPanel.jsx`
- Modify: `apps/desktop/src/modules/atlas.chat/screens/ExternalInboxScreen.jsx`

**This task exists specifically to close the exact gap spec Section 24 Risk 1 calls out by name**: Phase D's reactions and Phase E's reply-count pill both shipped with `FloatingChatHub.jsx` left unwired on the first pass (accepted both times because the consequence was merely inert, not incorrect). A missing entity-reference button is not just inert — combined with `ExternalInboxScreen.jsx` needing the OPPOSITE treatment (must actively suppress the button, not just lack it), this is worth getting right in one pass across all 4 call sites rather than finding 2 of them via a second review round, as happened twice before.

- [ ] **Step 1: `ChatWindow.jsx`**

Find its `<MessageComposer ... />` call (already has `conversationId` — add `conversationType={conversation?.type}` alongside it, same value already used elsewhere in this exact file for `<ChatMessageList conversationType={conversation?.type} .../>`).

- [ ] **Step 2: `FloatingChatHub.jsx`**

Find its `<MessageComposer ... />` call inside `MiniChatWindow`. Add `conversationType={conversation?.type}` — the same `conversation` variable already in scope and already used for `<ChatMessageList conversationType={conversation?.type} .../>` (added in Phase D/E's own fixes to this file).

- [ ] **Step 3: `ThreadPanel.jsx`**

Find its `<MessageComposer ... />` call. `ThreadPanel` already receives a `conversationType` prop from `ChatWindow` (Phase E) — thread it straight through: `conversationType={conversationType}`. (Threads are already channel/group-only per Phase E's own scoping, so this will always resolve to a non-`external_support` value here — passing it through is still correct and future-proof rather than hardcoding `"channel"`.)

- [ ] **Step 4: `ExternalInboxScreen.jsx`**

Find its `<MessageComposer ... />` call. This is the ONE call site that must actively suppress the reference button — pass `conversationType="external_support"` explicitly (a literal string, not derived from a `conversation.type` field, since this screen's `conversation` object is a guest-session-backed shape that may not carry a `type` field the same way internal conversations do — confirm this by reading the actual `conversation` prop's shape in this file before deciding between the literal and a derived value; use the literal if there's any doubt, since a hardcoded `"external_support"` can never accidentally under-restrict, while a wrongly-derived value could).

- [ ] **Step 5: Build check**

Run: `pnpm --filter @atlas/desktop exec vite build`

- [ ] **Step 6: Self-review — the actual check this task exists for**

Explicitly confirm and state in your report: (a) does the reference button render in `ChatWindow` for a `channel`/`group`/`direct` conversation? (b) does it render in `FloatingChatHub`'s mini window for the same conversation types? (c) does it NOT render in `ExternalInboxScreen`? (d) does it render in `ThreadPanel` (channel/group only, consistent with threads' own scope)? Trace each from the actual prop value reaching `MessageComposer`, not from assuming the wiring is correct because the code compiles.

- [ ] **Step 7: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/components/ChatWindow.jsx apps/desktop/src/modules/atlas.chat/components/FloatingChatHub.jsx apps/desktop/src/modules/atlas.chat/components/ThreadPanel.jsx apps/desktop/src/modules/atlas.chat/screens/ExternalInboxScreen.jsx
git commit -m "feat(chat): gate the entity reference button by conversation type across every composer call site"
```

---

## Self-Review Notes

- **Spec coverage**: Task 1 covers Section 8's composer UX. Task 2 covers the card rendering shape. Task 3 covers Section 8's render requirement (both branches). Task 4 covers Non-goal 3 and Section 24 Risk 1 directly — this is the task added specifically because two prior phases left `FloatingChatHub` as a "documented gap" and this phase's spec explicitly said not to repeat that.
- **No placeholders** except the explicitly-flagged "verify `SelectField`'s real prop names" (Task 1 Step 2) and "confirm the `conversation` shape in `ExternalInboxScreen`" (Task 4 Step 4) notes — read-the-real-code directives, matching this session's established convention.
- **Casing note carried forward correctly**: Task 3 Step 2 explicitly distinguishes `message.metadata?.entityRefs` (correct, nested JSONB access) from the top-level-column casing pitfall that caused real bugs in Phases D/E — this phase's data lives in a genuinely different place in the row shape, not a re-run of the same mistake under a different name.
