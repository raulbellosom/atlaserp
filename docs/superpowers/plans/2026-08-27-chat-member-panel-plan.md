# Chat Member Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `ChannelDetailsSheet` modal with an in-place panel that swaps `ChatWindow`'s main content area, exactly the way the existing "Archivos" toggle already swaps it to `ChatFilesGallery`.

**Architecture:** `ChannelDetailsSheet.jsx` is deleted. Its `Tabs` content moves into a new `ChatMembersPanel.jsx` (no `Sheet`/`SheetContent` wrapper). `ChatWindow.jsx` gains a `membersView` boolean state (renamed from `showDetails`, same pattern as the existing `filesView`), a header toggle button, and a 3-way content swap (`filesView` / `membersView` / normal message list) — mutually exclusive, matching how `filesView` already works alone today.

**Tech Stack:** React, `@atlas/ui`.

**Spec:** `docs/superpowers/specs/2026-08-27-chat-member-panel-design.md` — read in full before starting.

**Verified facts this plan relies on** (from reading the actual current `ChatWindow.jsx`):
- `filesView`/`onToggleFilesView` (state at line 457, toggle wired at line 695 as `() => setFilesView((v) => !v)`, button at lines 348-358) is the exact pattern to mirror.
- The reset-on-conversation-change effect (lines 478-490) currently does NOT reset `showDetails` — this is a pre-existing latent bug (switching conversations with the sheet open would show the new conversation's header/messages behind the OLD conversation's member sheet) that this plan's rename incidentally fixes by adding the new state to that same effect.
- `showDetails`/`setShowDetails` is read/written in exactly 3 places: state declaration (line 466), `onOpenDetails={() => setShowDetails(true)}` passed to `ChatHeader` (line 713), and `<ChannelDetailsSheet open={showDetails} onOpenChange={setShowDetails} .../>` (lines 785-790) — all 3 need updating, not just the render.
- `MemberAvatarStack`'s `onClick={onOpenDetails}` (line 334, inside `ChatHeader`) reuses the same `onOpenDetails` prop the dropdown item uses — no separate wiring needed, both go through one prop.
- The main content swap is currently a 2-way ternary at line 723 (`filesView ? <ChatFilesGallery ...> : <ChatMessageList ...>`), and the composer's visibility is gated by `{!filesView && <MessageComposer .../>}` at line 759 — both need to become 3-way-aware.
- `ChannelGeneralTab.jsx` has a comment (not an import) referencing "ChannelDetailsSheet" at line 13 — update it to reference the new panel for accuracy, but this is not a functional dependency.

---

## File Structure Map

| File | Action | Responsibility |
|---|---|---|
| `apps/desktop/src/modules/atlas.chat/components/ChatMembersPanel.jsx` | Create | The moved Tabs content, no Sheet wrapper |
| `apps/desktop/src/modules/atlas.chat/components/ChannelDetailsSheet.jsx` | Delete | Superseded by `ChatMembersPanel` |
| `apps/desktop/src/modules/atlas.chat/components/ChatWindow.jsx` | Modify | `membersView` state, header toggle, 3-way content swap |
| `apps/desktop/src/modules/atlas.chat/components/ChannelGeneralTab.jsx` | Modify | Update stray comment (non-functional) |

---

### Task 1: `ChatMembersPanel.jsx` + delete `ChannelDetailsSheet.jsx`

**Files:**
- Create: `apps/desktop/src/modules/atlas.chat/components/ChatMembersPanel.jsx`
- Delete: `apps/desktop/src/modules/atlas.chat/components/ChannelDetailsSheet.jsx`

- [ ] **Step 1: Read `ChannelDetailsSheet.jsx` in full first (required)**

It's short (~49 lines as of the last sub-project's commits, adding the General tab). Confirm its exact current shape before adapting it.

- [ ] **Step 2: Implement `ChatMembersPanel.jsx`**

Same `Tabs`/`TabsList`/`TabsTrigger`/`TabsContent` structure and the same `canManageRoles` gating logic, minus the `Sheet`/`SheetContent`/`SheetHeader`/`SheetTitle` wrapper — replaced with a plain scrollable container matching `ChatFilesGallery`'s own top-level wrapper styling (`flex-1 min-h-0 overflow-y-auto`, read `ChatFilesGallery`'s actual className in `ChatWindow.jsx` — around line 61-95 — and match it, don't invent new styling):

```javascript
// apps/desktop/src/modules/atlas.chat/components/ChatMembersPanel.jsx
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@atlas/ui";
import { ChannelGeneralTab } from "./ChannelGeneralTab";
import { ChannelMembersTab } from "./ChannelMembersTab";
import { ChannelRolesTab } from "./ChannelRolesTab";
import { useChatConversationDetail } from "../hooks/useChatConversationDetail";
import { roleHasPermission, findOwnMember, CHAT_PERMISSIONS } from "../lib/chatPermissions";

export function ChatMembersPanel({ conversationId, currentUserId }) {
  const { data: convData } = useChatConversationDetail(conversationId);
  const ownMember = findOwnMember(convData?.data?.members ?? [], currentUserId);
  const canManageRoles = roleHasPermission(ownMember, CHAT_PERMISSIONS.ROLES_MANAGE);

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      <Tabs defaultValue="general" className="flex-1 min-h-0 flex flex-col">
        <TabsList className="px-3 pt-2">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="members">Miembros</TabsTrigger>
          {canManageRoles && <TabsTrigger value="roles">Roles</TabsTrigger>}
        </TabsList>
        <TabsContent value="general" className="flex-1 min-h-0 overflow-y-auto">
          <ChannelGeneralTab conversationId={conversationId} currentUserId={currentUserId} />
        </TabsContent>
        <TabsContent value="members" className="flex-1 min-h-0 overflow-y-auto">
          <ChannelMembersTab conversationId={conversationId} currentUserId={currentUserId} />
        </TabsContent>
        {canManageRoles && (
          <TabsContent value="roles" className="flex-1 min-h-0 overflow-y-auto">
            <ChannelRolesTab conversationId={conversationId} currentUserId={currentUserId} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
```

**Verify before trusting the exact className above**: read `ChatFilesGallery`'s actual wrapper className in the current `ChatWindow.jsx` (it's a local component defined near the top of that file) and use the SAME top-level layout classes here, so the two swapped views have visually consistent sizing/scroll behavior — don't just copy this plan's guess verbatim if the real one differs.

- [ ] **Step 3: Delete `ChannelDetailsSheet.jsx`**

```bash
git rm apps/desktop/src/modules/atlas.chat/components/ChannelDetailsSheet.jsx
```

- [ ] **Step 4: Build check**

This will fail at this point, since `ChatWindow.jsx` still imports/renders the now-deleted `ChannelDetailsSheet` — that's expected, Task 2 fixes it. Don't try to make the build pass yet; just confirm the failure is specifically about the missing `ChannelDetailsSheet` import (proving Step 3's deletion is the only thing currently broken), not some other unrelated issue.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/components/ChatMembersPanel.jsx
git commit -m "feat(chat): add ChatMembersPanel, delete ChannelDetailsSheet (WIP, ChatWindow wiring in next commit)"
```

(A single "WIP" commit here is acceptable — Task 2 immediately follows and fixes the resulting build break; this isn't left in a broken state across a review checkpoint, both tasks land together before any review happens.)

---

### Task 2: Wire `ChatMembersPanel` into `ChatWindow.jsx`

**Files:**
- Modify: `apps/desktop/src/modules/atlas.chat/components/ChatWindow.jsx`

- [ ] **Step 1: Read the current file's relevant sections in full first (required)**

Specifically: the `filesView` state/toggle (around lines 348-358, 457, 695), `showDetails` (lines 466, 713, 785-790), the reset-on-conversation-change effect (478-490), and the main content swap + composer visibility (723-768). Confirm exact current line numbers before editing — Sub-project 1's own commits already shifted this file's line numbers from what earlier phases recorded, and this task's edits will shift them further.

- [ ] **Step 2: Import `ChatMembersPanel`, remove the `ChannelDetailsSheet` import**

```javascript
import { ChatMembersPanel } from "./ChatMembersPanel";
```
(Remove the now-dead `import { ChannelDetailsSheet } from "./ChannelDetailsSheet";` line.)

- [ ] **Step 3: Rename `showDetails` → `membersView`, mirroring `filesView`'s exact naming convention**

```javascript
  const [membersView, setMembersView] = useState(false);
```
(Replaces `const [showDetails, setShowDetails] = useState(false);`.)

- [ ] **Step 4: Add `membersView` to the reset-on-conversation-change effect**

```javascript
    setMembersView(false);
```
(Added alongside the existing `setFilesView(initialFilesView);`, `setShowPinned(false);`, etc. in that same effect — this is also the fix for the pre-existing gap noted in this plan's header: `showDetails` was never reset there before.)

- [ ] **Step 5: Make the two toggles mutually exclusive**

Change `onToggleFilesView={() => setFilesView((v) => !v)}` (passed to `ChatHeader`) to also close the members panel when opening files:
```javascript
        onToggleFilesView={() => { setFilesView((v) => !v); setMembersView(false); }}
```
Add a new prop, `onToggleMembersView`, passed the symmetric way:
```javascript
        onToggleMembersView={() => { setMembersView((v) => !v); setFilesView(false); }}
```
Change `onOpenDetails={() => setShowDetails(true)}` to `onOpenDetails={() => { setMembersView(true); setFilesView(false); }}` — this prop is reused as-is by both the "Ver miembros" dropdown item AND `MemberAvatarStack`'s `onClick` (confirmed both already route through this single prop, from Sub-project 1's own commits) — no changes needed at either of those two call sites themselves, only here at the source.

- [ ] **Step 6: Add the header toggle button**

In `ChatHeader`'s prop destructuring, add `membersView, onToggleMembersView,` alongside the existing `filesView, onToggleFilesView,`. Add a new button next to the existing files-toggle button (around line 348-358), following the exact same style:

```javascript
        {/* Members toggle */}
        <button
          type="button"
          onClick={onToggleMembersView}
          title={membersView ? "Ver mensajes" : "Ver miembros"}
          className={[
            headerBtnCls,
            membersView ? "text-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.1)]" : "",
          ].join(" ")}
        >
          {membersView ? <MessageSquare className="h-4 w-4" /> : <Users className="h-4 w-4" />}
        </button>
```

Confirm `Users` is already imported from `lucide-react` in this file (it's used by `ConversationTypeBadge`'s consumer context, but check THIS file's own import list directly — `MessageSquare` is confirmed already imported, per the existing files-toggle button using it) — add `Users` to the import line if missing.

- [ ] **Step 7: Make the content swap 3-way**

Change the existing 2-way ternary:
```javascript
      {filesView ? (
        <ChatFilesGallery ... />
      ) : (
        <ChatMessageList ... />
      )}
```
to:
```javascript
      {filesView ? (
        <ChatFilesGallery
          messages={messages}
          isLoading={isLoading}
          onAttachmentClick={handleAttachmentClick}
        />
      ) : membersView ? (
        <ChatMembersPanel conversationId={conversationId} currentUserId={userProfile?.id} />
      ) : (
        <ChatMessageList
          /* ...all existing props, unchanged... */
        />
      )}
```
Read the actual current `<ChatMessageList .../>` call's full prop list before rewriting this block — copy it verbatim into the new ternary structure, don't retype from memory (it has ~20 props).

- [ ] **Step 8: Hide the composer for both special views**

Change `{!filesView && <MessageComposer .../>}` to `{!filesView && !membersView && <MessageComposer .../>}`.

- [ ] **Step 9: Remove the old `<ChannelDetailsSheet .../>` render**

Delete the now-dead:
```javascript
      <ChannelDetailsSheet
        open={showDetails}
        onOpenChange={setShowDetails}
        conversationId={conversationId}
        currentUserId={userProfile?.id}
      />
```

- [ ] **Step 10: Build check**

Run: `NODE_OPTIONS="--max-old-space-size=4096" pnpm --filter @atlas/desktop exec vite build` (this environment has hit OOM on plain `vite build` for other tasks in this exact plan-sequence — use the increased heap flag preemptively).
Expected: clean, no missing-import errors (this proves Task 1's deletion is now fully resolved).

- [ ] **Step 11: Self-review**

Explicitly trace and report: (a) does opening the members panel while the files gallery is open correctly close the gallery, and vice versa (test both toggle orderings mentally against the code, not just one direction)? (b) does switching to a different conversation while the panel is open correctly close it (trace the reset effect)? (c) re-grep this file for any remaining reference to `showDetails`/`ChannelDetailsSheet` to confirm the rename/deletion is complete, not partial.

- [ ] **Step 12: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/components/ChatWindow.jsx
git commit -m "feat(chat): wire ChatMembersPanel into ChatWindow as an in-place view"
```

---

### Task 3: Update the stray comment in `ChannelGeneralTab.jsx`

**Files:**
- Modify: `apps/desktop/src/modules/atlas.chat/components/ChannelGeneralTab.jsx`

- [ ] **Step 1: Fix the comment**

Change the comment at the top of this file (currently something like `// "General" tab of ChannelDetailsSheet — avatar-editing UI for a channel/group`) to reference `ChatMembersPanel` instead — this is documentation only, `ChannelGeneralTab.jsx` never actually imported `ChannelDetailsSheet`, so there's no functional change, just accuracy.

- [ ] **Step 2: Build check and commit**

```bash
NODE_OPTIONS="--max-old-space-size=4096" pnpm --filter @atlas/desktop exec vite build
git add apps/desktop/src/modules/atlas.chat/components/ChannelGeneralTab.jsx
git commit -m "docs(chat): update stray ChannelDetailsSheet reference in ChannelGeneralTab comment"
```

---

## Self-Review Notes

- **Spec coverage**: Task 1 covers Section 9 (new component, old one deleted). Task 2 covers Sections 8 (UX), 23 (edge cases 1-2, mutual exclusion + reset), and Risk 2 (every entry point repointed, not just the new toggle added alongside a dead one). Task 3 is pure documentation accuracy, not spec-mandated but cheap and correct to do while touching this exact area.
- **No placeholders** except the explicitly-flagged "verify ChatFilesGallery's real wrapper className"/"copy ChatMessageList's real prop list verbatim" notes in Task 1 Step 2 and Task 2 Step 7 — read-the-real-code directives, matching this session's established convention.
- **Risk 3 from the spec** (confirming no other file imports `ChannelDetailsSheet` before deleting it) was already checked during this spec's own research (only `ChatWindow.jsx` and a comment-only reference in `ChannelGeneralTab.jsx`) — Task 1's implementer should re-confirm this with a fresh grep immediately before running `git rm`, since time has passed between the spec's research and this plan's execution.
