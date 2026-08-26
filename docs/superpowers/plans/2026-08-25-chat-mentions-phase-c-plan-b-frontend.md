# Chat Mentions Phase C — Plan B (Frontend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user type `@` in the message composer to mention a member, role, or (if permitted) everyone/here, and render mention chips (with a "you were mentioned" highlight) in the message list.

**Architecture:** Reuses `@atlas/ui`'s existing `MentionTextarea`/`renderMentionText` (already used by `atlas.projects`) — no changes to that package. A new hook builds the chat-specific candidate list (members + roles + permission-gated everyone/here sentinels). `MessageComposer.jsx` swaps its plain `<textarea>` for `MentionTextarea`; `ChatMessageBubble.jsx` swaps plain-text body rendering for `renderMentionText`.

**Tech Stack:** React, `@atlas/ui`'s `MentionTextarea`. No new backend calls — mentions ride inside the existing `sendMessage`/`listMessages` request/response bodies (Plan A already complete).

**Depends on:** Plan A (backend) — already complete (commits `0452f0d`, `b06be3d`, `475b64b`, `c737966`, `e97681a`).

**Spec:** `docs/superpowers/specs/2026-08-25-chat-mentions-phase-c-design.md`

---

## File Structure Map

| File | Action | Responsibility |
|---|---|---|
| `apps/desktop/src/modules/atlas.chat/hooks/useMentionCandidates.js` | Create | Builds the `members`-shaped array (real members + role pseudo-entries + everyone/here sentinels) for `MentionTextarea` |
| `apps/desktop/src/modules/atlas.chat/components/MessageComposer.jsx` | Modify | Swap plain `<textarea>` for `MentionTextarea` |
| `apps/desktop/src/modules/atlas.chat/components/ChatMessageBubble.jsx` | Modify | Swap plain-text body render for `renderMentionText`; add "you were mentioned" highlight |

---

### Task 1: `useMentionCandidates` hook

**Files:**
- Create: `apps/desktop/src/modules/atlas.chat/hooks/useMentionCandidates.js`

- [ ] **Step 1: Implement**

```javascript
// apps/desktop/src/modules/atlas.chat/hooks/useMentionCandidates.js
import { useMemo } from "react";
import { useChatConversationDetail } from "./useChatConversationDetail";
import { useChannelRoles } from "./useChannelRoles";
import { roleHasPermission, findOwnMember, CHAT_PERMISSIONS } from "../lib/chatPermissions";

// Fixed sentinel UUIDs — must stay byte-identical to
// apps/api/src/routes/chat/chat-mentions-service.js's EVERYONE_MENTION_ID /
// HERE_MENTION_ID. Never a real UUIDv7 (version/variant nibbles are both 0
// here; a real generated id can never match), so these safely ride the same
// @[id:name] token format MentionTextarea already uses for real users/roles.
export const EVERYONE_MENTION_ID = "00000000-0000-0000-0000-000000000000";
export const HERE_MENTION_ID = "00000000-0000-0000-0000-000000000001";

// Only meaningful for `channel`/`group` conversations — for `direct`/
// `external_support`, roles/everyone/here don't exist, and this hook simply
// returns the other member(s) as plain mention candidates (still useful:
// mentioning the other party in a direct chat is harmless, just redundant).
export function useMentionCandidates(conversationId, currentUserId) {
  const { data: convData } = useChatConversationDetail(conversationId);
  const { data: rolesData } = useChannelRoles(conversationId);

  return useMemo(() => {
    const members = convData?.data?.members ?? [];
    const roles = rolesData?.data ?? [];
    const ownMember = findOwnMember(members, currentUserId);

    const memberCandidates = members
      .filter((m) => m.userId !== currentUserId)
      .map((m) => ({ id: m.userId, displayName: m.displayName ?? "Usuario", avatarUrl: m.avatarUrl, email: m.email }));

    const roleCandidates = roles.map((r) => ({ id: r.id, displayName: r.name }));

    const sentinelCandidates = [];
    if (roleHasPermission(ownMember, CHAT_PERMISSIONS.MENTIONS_EVERYONE)) {
      sentinelCandidates.push({ id: EVERYONE_MENTION_ID, displayName: "everyone" });
    }
    if (roleHasPermission(ownMember, CHAT_PERMISSIONS.MENTIONS_HERE)) {
      sentinelCandidates.push({ id: HERE_MENTION_ID, displayName: "here" });
    }

    return [...memberCandidates, ...roleCandidates, ...sentinelCandidates];
  }, [convData, rolesData, currentUserId]);
}
```

Note: `roleHasPermission(ownMember, ...)` returning `false` for a `direct`/`external_support` `ownMember` (whose `roleIsSystem`/`rolePermissions` are `null`, per Phase B's `chatPermissions.js`) correctly means the everyone/here sentinels are never offered there — no special-casing by conversation type needed, the permission check already handles it.

- [ ] **Step 2: Build check and commit**

```bash
pnpm --filter @atlas/desktop exec vite build
git add apps/desktop/src/modules/atlas.chat/hooks/useMentionCandidates.js
git commit -m "feat(chat): add mention candidate list hook (members + roles + everyone/here)"
```

---

### Task 2: Wire `MentionTextarea` into `MessageComposer`

**Files:**
- Modify: `apps/desktop/src/modules/atlas.chat/components/MessageComposer.jsx`

- [ ] **Step 1: Read the current file in full first (required)**

This is an existing, feature-rich component (attachments, emoji picker, templates, auto-resize, compact mode) — read it completely before editing so the swap doesn't silently break an unrelated feature. Locate:
- The `body`/`setBody` state and the plain `<textarea ref={textareaRef} value={body} onChange={...} .../>` element.
- Every other place `textareaRef.current` is read (emoji insertion, auto-resize `useEffect`, focus-on-mount, etc.) — `MentionTextarea` does not expose its internal textarea ref to the parent, so any of these that assume direct DOM access to the textarea need to degrade gracefully (see Step 3).
- How `conversationId` and the conversation's `members` (or lack thereof) currently reach this component — it may need a new prop if it doesn't already receive `conversationId`.

- [ ] **Step 2: Import and call the new hook**

Add:
```javascript
import { MentionTextarea } from "@atlas/ui";
import { useMentionCandidates } from "../hooks/useMentionCandidates";
```
and, inside the component (needs `conversationId` and `currentUserId` — read the file to confirm these are already available as props/context; if `MessageComposer` doesn't currently receive `conversationId` as a prop, check `ChatWindow.jsx`'s usage of `<MessageComposer .../>` — it's rendered with `conversationId={conversationId}` already per the codebase state at the start of this phase, so the prop should already be there):
```javascript
  const mentionCandidates = useMentionCandidates(conversationId, currentUserId);
```
(`currentUserId` — if not already a prop, import `useAuth` the same way other components in this module do, e.g. `const { userProfile } = useAuth(); const currentUserId = userProfile?.id;` — check whether `MessageComposer` already has access to this before adding a new import.)

- [ ] **Step 3: Replace the textarea element**

Replace the plain `<textarea ref={textareaRef} value={body} onChange={(e) => setBody(e.target.value)} ... />` (exact current props will include more than this — preserve every existing behavior you can, e.g. `placeholder`, `disabled`, `onKeyDown` for send-on-Enter) with:
```javascript
          <MentionTextarea
            value={body}
            onChange={setBody}
            onKeyDown={handleComposerKeyDown}
            members={mentionCandidates}
            placeholder="Escribe un mensaje..."
            rows={compact ? 1 : 3}
            disabled={isSending}
          />
```
(Adapt prop names to whatever the existing textarea actually used — e.g. if the existing `onKeyDown` handler is named differently, keep that name; the point is preserving send-on-Enter/Shift+Enter-for-newline behavior, which `MentionTextarea` forwards via its own `onKeyDown` prop when its autocomplete dropdown isn't open, per that component's existing implementation.)

- [ ] **Step 4: Adapt textarea-ref-dependent features**

For each place identified in Step 1 that reads `textareaRef.current` for something other than the removed plain `<textarea>` itself:
- **Emoji insertion**: since `MentionTextarea` doesn't expose its internal ref, change emoji insertion to append at the end of `body` instead of at the cursor: `setBody((prev) => prev + emoji)`. This is the documented, accepted simplification from spec Section 8/24 — do not attempt to work around it by reaching into `MentionTextarea`'s internals or forking the component.
- **Auto-resize**: `MentionTextarea` manages its own textarea sizing internally (it's a plain `<textarea>` under the hood with `rows` prop) — if the existing auto-resize `useEffect` was doing something `MentionTextarea` doesn't already handle (e.g., growing beyond a fixed `rows` count as the user types), this behavior is acceptably dropped for v1 (rows stays fixed per the `rows={compact ? 1 : 3}` prop above) — note this as a scope cut in your report if the original component had non-trivial auto-grow behavor beyond what `rows` alone provides.
- **Focus-on-mount / focus-after-send**: if the code calls `textareaRef.current?.focus()` after sending a message, this can't be preserved without a ref from `MentionTextarea`. Accept the loss of auto-refocus-after-send as a minor, documented UX regression for this phase, OR (if you judge it more correct) wrap `MentionTextarea` in a container `<div>` you already control and use `document.querySelector` scoped to that container to find the inner `<textarea>` DOM node as a pragmatic workaround — your call, but state which approach you took and why in your report.

- [ ] **Step 5: Build and manual sanity check**

```bash
pnpm --filter @atlas/desktop exec vite build
```
If a dev server is available (`pnpm dev:frontend`), manually confirm: typing `@` opens the mention dropdown, selecting a candidate inserts a chip-like token, sending the message works, Enter-to-send/Shift+Enter-for-newline still works.

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/components/MessageComposer.jsx
git commit -m "feat(chat): wire mention autocomplete into the message composer"
```

---

### Task 3: Render mention chips + "you were mentioned" highlight

**Files:**
- Modify: `apps/desktop/src/modules/atlas.chat/components/ChatMessageBubble.jsx`

- [ ] **Step 1: Read the current file in full first (required)**

`ChatMessageBubble.jsx` is already ~886 lines (close to the 1000-line soft limit) — this change must be small and localized, not an excuse to restructure the file. Locate every site that renders `message.body` as plain text (the plan's earlier discovery found at least 3: a plain `{message.body}` render and two `<HighlightedText text={message.body} searchQuery={...} />` usages for the search-highlight feature) and the component's props (to find where `currentUserId` and the conversation's own membership/role data would need to come from for the highlight — check what's already passed in from `ChatWindow.jsx`/`ChatMessageList.jsx`, which already receive `currentUserId` and `members`).

- [ ] **Step 2: Add the mention-chip render**

Import:
```javascript
import { renderMentionText } from "@atlas/ui";
```
For the plain `{message.body}` render site (not inside search-highlight mode), replace with:
```javascript
{renderMentionText(message.body)}
```
For the two `<HighlightedText text={message.body} .../>` sites (used when a search query is active): leave these as-is for this phase — combining search-term highlighting with mention-chip rendering in the same pass is a real UX nicety but not required by the spec (Section 6 non-goals don't explicitly cover it, but it's also not in Section 8's requirements) — note this as an accepted scope cut rather than attempting to merge two text-transformation passes into one render, which risks a larger, riskier change to an already-large file. Only the non-search render path needs `renderMentionText`.

- [ ] **Step 3: Add the "you were mentioned" highlight**

Add a small pure helper near the top of the file (or in a shared location if one already exists for message-level computed flags):
```javascript
function isMentioned(message, currentUserId, ownRoleId) {
  const mentions = message?.metadata?.mentions;
  if (!mentions) return false;
  if (mentions.everyone || mentions.here) return true;
  if (currentUserId && mentions.userIds?.includes(currentUserId)) return true;
  if (ownRoleId && mentions.roleIds?.includes(ownRoleId)) return true;
  return false;
}
```
Where the bubble's outer container class list is built, conditionally add a highlight (adapt to the file's actual class-composition pattern — likely a `[...]join(" ")` array like other components in this module):
```javascript
mentioned ? "bg-[hsl(var(--primary)/0.05)] border-l-2 border-[hsl(var(--primary))] pl-2" : ""
```
`ownRoleId` needs to come from the current user's own membership entry in the conversation's `members` array (already available wherever this component receives `members`/`currentUserId` — read the file to find the exact prop path; it's the same `roleId` field Plan A/B of the Channels UX phase already added to `GET /chat/conversations/:id`'s member shape).

- [ ] **Step 4: Build and commit**

```bash
pnpm --filter @atlas/desktop exec vite build
git add apps/desktop/src/modules/atlas.chat/components/ChatMessageBubble.jsx
git commit -m "feat(chat): render mention chips and highlight messages that mention the viewer"
```

---

### Task 4: Full verification

- [ ] **Step 1: Full build**

```bash
pnpm build
```

- [ ] **Step 2: Backend test suite still green**

```bash
node --test apps/api/src/routes/chat/__tests__/chat-service.test.js apps/api/src/routes/chat/__tests__/chat-mentions-service.test.js apps/api/src/routes/chat/__tests__/chat-permissions-service.test.js apps/api/src/routes/chat/__tests__/channel-directory-service.test.js
```

- [ ] **Step 3: Manual browser QA** (if a dev server/session is available) at 390px and 1440px: type `@`, confirm the dropdown lists members + roles + (conditionally) everyone/here; send a mention; confirm the chip renders and the recipient's own view shows the highlight (requires a second test account, or can be verified by reading `metadata.mentions` in the network response if a second account isn't available).

---

## Self-Review Notes

- **Spec coverage:** Task 1 covers Section 8's candidate-list requirement exactly (three sources, permission-gated sentinels). Task 2 covers the composer swap and explicitly documents the accepted emoji/auto-resize/refocus degradations from Section 8/24 rather than silently dropping them. Task 3 covers the chip rendering and viewer-mention highlight from Section 8/25 acceptance criterion 6.
- **File size discipline:** `ChatMessageBubble.jsx` is already near the 1000-line limit — Task 3 is deliberately scoped to the smallest possible diff (one new ~8-line pure function, one import, one render-site swap, one conditional class) rather than a broader refactor.
- **No placeholders**, except the explicit, reasoned judgment calls flagged in Task 2 Step 4 (emoji/refocus behavior) — these are genuine "implementer must read the real file and decide" points, not gaps in the plan's own logic, consistent with how Phase A/B's plans handled similarly filesystem-dependent adaptations.
