# atlas.chat Reaction Viewer + Avatar Lightbox (Plan D — Functional) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Work directly on the `main` branch — do NOT create a git worktree or feature branch (this project's established convention).

**Goal:** Let users see who reacted to a message with which emoji (and remove their own reaction from that view), and let them click a profile picture to view it full-size in the existing image lightbox.

**Architecture:** One new component (`MessageReactionsModal`) replaces the reaction pills' instant-toggle click with an open-a-list-then-remove flow. Two existing avatar surfaces (the profile panel hero, the channel-avatar editor) get a click handler wired to `ImageViewer` (from `@atlas/ui`, currently unused anywhere in the app) — no new viewer component, no signed-URL fetch, since `avatarUrl` is already a ready-to-use URL by the time it reaches these components.

**Tech Stack:** React (JSX), `@atlas/ui` (`Dialog`, `ImageViewer`), `lucide-react` icons.

**Spec:** `docs/superpowers/specs/2026-08-26-chat-visual-redesign-and-reaction-viewer-design.md`, Parts B and C.

**Prerequisite:** Task 3 of this plan modifies the profile-panel hero avatar that **Plan C, Task 6** (`docs/superpowers/plans/2026-08-26-chat-visual-redesign-plan-c-styling.md`) introduces in `ConversationProfilePanel.jsx`. Execute Plan C before this plan's Task 3 (Tasks 1-2 and Task 4 have no such dependency and can run in any order relative to Plan C).

**Verification tooling note:** No component-level test runner exists for React/JSX in this repo (per `CLAUDE.md`). Verification is: (1) `pnpm --filter @atlas/desktop exec vite build` must succeed, and (2) a manual visual/interaction check description.

---

### Task 1: Create MessageReactionsModal

**Files:**
- Create: `apps/desktop/src/modules/atlas.chat/components/MessageReactionsModal.jsx`

- [ ] **Step 1: Write the component**

```jsx
// apps/desktop/src/modules/atlas.chat/components/MessageReactionsModal.jsx
// Opened from a reaction pill (MessageReactions.jsx) — shows every reaction
// on a message, grouped by emoji, with each reactor's name/avatar resolved
// from the conversation's `members` list. The current user's own row in any
// group gets a "Quitar" button that calls `onRemoveOwn(emoji)`, which the
// caller wires to the same toggle-reaction mutation that already exists
// (toggling an existing reaction removes it — no new backend call).
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@atlas/ui";
import { X } from "lucide-react";

function ReactorRow({ userId, member, isOwn, onRemove }) {
  const [avatarErr, setAvatarErr] = useState(false);
  const displayName = member?.displayName ?? "Usuario";

  return (
    <div className="flex items-center gap-2.5 py-1.5">
      {member?.avatarUrl && !avatarErr ? (
        <img
          src={member.avatarUrl}
          alt={displayName}
          className="h-7 w-7 rounded-full object-cover shrink-0"
          onError={() => setAvatarErr(true)}
        />
      ) : (
        <div className="h-7 w-7 rounded-full bg-[hsl(var(--muted))] flex items-center justify-center text-[11px] font-semibold text-[hsl(var(--muted-foreground))] shrink-0">
          {displayName[0]?.toUpperCase() ?? "U"}
        </div>
      )}
      <p className="flex-1 min-w-0 text-sm truncate">{isOwn ? "Tu" : displayName}</p>
      {isOwn && (
        <button
          type="button"
          onClick={onRemove}
          title="Quitar mi reaccion"
          className="shrink-0 h-6 w-6 flex items-center justify-center rounded-full text-[hsl(var(--muted-foreground))] hover:text-red-500 hover:bg-[hsl(var(--muted))] transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

export function MessageReactionsModal({ open, onOpenChange, reactions, members, currentUserId, onRemoveOwn }) {
  if (!reactions?.length) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Reacciones</DialogTitle>
        </DialogHeader>
        <div className="max-h-80 overflow-y-auto -mx-1 px-1">
          {reactions.map(({ emoji, userIds }, i) => (
            <div key={emoji} className={i > 0 ? "mt-3 pt-3 border-t border-[hsl(var(--border))]" : ""}>
              <p className="text-xs font-semibold text-[hsl(var(--muted-foreground))] mb-1">
                {emoji} <span className="tabular-nums">{userIds?.length ?? 0}</span>
              </p>
              {(userIds ?? []).map((userId) => (
                <ReactorRow
                  key={userId}
                  userId={userId}
                  member={members?.find((m) => m.userId === userId)}
                  isOwn={userId === currentUserId}
                  onRemove={() => onRemoveOwn(emoji)}
                />
              ))}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Verify the build**

Run: `pnpm --filter @atlas/desktop exec vite build`
Expected: build succeeds with no errors (this component isn't imported anywhere yet, so this only checks the file itself is syntactically valid JSX).

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/components/MessageReactionsModal.jsx
git commit -m "feat(chat): add MessageReactionsModal component"
```

---

### Task 2: Wire the modal into MessageReactions and ChatMessageBubble

**Files:**
- Modify: `apps/desktop/src/modules/atlas.chat/components/MessageReactions.jsx`
- Modify: `apps/desktop/src/modules/atlas.chat/components/ChatMessageBubble.jsx:903-908, 1022-1028`

- [ ] **Step 1: Rewrite MessageReactions.jsx to open the modal instead of toggling directly**

Replace the entire file:
```jsx
// apps/desktop/src/modules/atlas.chat/components/MessageReactions.jsx
// Renders the pill row under a message bubble. `reactions` is the message's
// own `reactions` field from the API — `{ emoji, userIds }[]` or null/undefined
// for a message with none (already aggregated server-side, backend phase).
//
// Clicking a pill no longer toggles the reaction instantly — it opens
// MessageReactionsModal, which shows every reactor (grouped by emoji) and
// lets the current user remove their own reaction from there. This trades
// one click for two on the toggle-off path, deliberately, so "who reacted"
// is discoverable instead of hidden behind a raw count.
import { useState } from "react";
import { MessageReactionsModal } from "./MessageReactionsModal";

export function MessageReactions({ reactions, members, currentUserId, onToggle }) {
  const [modalOpen, setModalOpen] = useState(false);

  if (!reactions?.length) return null;

  return (
    <>
      <div className="flex flex-wrap gap-1 mt-1">
        {reactions.map(({ emoji, userIds }) => {
          const mine = currentUserId && userIds?.includes(currentUserId);
          return (
            <button
              key={emoji}
              type="button"
              onClick={() => setModalOpen(true)}
              className={[
                "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs border transition-colors",
                mine
                  ? "bg-[hsl(var(--primary)/0.15)] border-[hsl(var(--primary))] text-[hsl(var(--primary))]"
                  : "bg-[hsl(var(--muted))] border-transparent hover:border-[hsl(var(--border))]",
              ].join(" ")}
            >
              <span>{emoji}</span>
              <span className="tabular-nums">{userIds?.length ?? 0}</span>
            </button>
          );
        })}
      </div>
      <MessageReactionsModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        reactions={reactions}
        members={members}
        currentUserId={currentUserId}
        onRemoveOwn={onToggle}
      />
    </>
  );
}
```

- [ ] **Step 2: Pass `members` from ChatMessageBubble's two call sites**

`ChatMessageBubble.jsx` already receives `members` as its own prop (used by `findOwnMember(members, currentUserId)`). Find the two `<MessageReactions .../>` calls:

Own-message branch (around line 903-908):
```jsx
<MessageReactions
  reactions={message.reactions}
  currentUserId={currentUserId}
  onToggle={(emoji) => onToggleReaction?.(message.id, emoji)}
/>
```
becomes:
```jsx
<MessageReactions
  reactions={message.reactions}
  members={members}
  currentUserId={currentUserId}
  onToggle={(emoji) => onToggleReaction?.(message.id, emoji)}
/>
```

Other-message branch (around line 1022-1028) — same edit, add `members={members}`.

- [ ] **Step 3: Verify the build**

Run: `pnpm --filter @atlas/desktop exec vite build`
Expected: build succeeds with no errors.

- [ ] **Step 4: Manual visual check**

Send a message and react to it with two different emoji from two different accounts (or simulate by checking against test data with multiple reactors, if available). Click a reaction pill — confirm a dialog opens listing each emoji group with reactor names (your own row labeled "Tu"), and that your own row(s) show a small X button. Click it and confirm the reaction is removed (the pill's count decrements or the pill disappears if you were the only reactor, and the dialog list updates). Confirm clicking a pill for a reaction you did NOT make still opens the same dialog (showing all groups, not filtered to that emoji) with no remove button on other people's rows.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/components/MessageReactions.jsx apps/desktop/src/modules/atlas.chat/components/ChatMessageBubble.jsx
git commit -m "feat(chat): open who-reacted modal from reaction pills, wire own-reaction removal"
```

---

### Task 3: Wire avatar click-to-lightbox in ConversationProfilePanel's hero

**Files:**
- Modify: `apps/desktop/src/modules/atlas.chat/components/ConversationProfilePanel.jsx`

**Requires Plan C Task 6 to already be merged** — this task edits the `hero` JSX block that task introduces (avatar `<div>`, `heroAvatarUrl`, `displayName`, `avatarErr`/`setAvatarErr` state).

- [ ] **Step 1: Add viewer state and import ImageViewer**

Add to the existing `@atlas/ui` import line (merge with whatever's already imported from there):
```jsx
import { ImageViewer } from "@atlas/ui";
```

Next to the `const [avatarErr, setAvatarErr] = useState(false);` line Plan C Task 6 added, add:
```jsx
const [avatarViewerOpen, setAvatarViewerOpen] = useState(false);
```

- [ ] **Step 2: Make the hero avatar clickable when a real photo exists**

In the `hero` JSX block, the avatar wrapper currently reads (as left by Plan C Task 6):
```jsx
<div className="h-20 w-20 rounded-full overflow-hidden bg-[hsl(var(--muted))] flex items-center justify-center">
  {heroAvatarUrl && !avatarErr ? (
    <img
      src={heroAvatarUrl}
      alt={displayName}
      className="h-full w-full object-cover"
      onError={() => setAvatarErr(true)}
    />
  ) : heroAvatarEmoji ? (
    <span className="text-4xl">{heroAvatarEmoji}</span>
  ) : (
    <span className="text-2xl font-semibold text-[hsl(var(--muted-foreground))]">
      {(displayName ?? "?")[0]?.toUpperCase()}
    </span>
  )}
</div>
```
Change it to a conditional wrapper — a `<button>` only when there's a real photo to view, a plain `<div>` otherwise (an emoji or initial isn't a "photo," clicking it should do nothing):
```jsx
{heroAvatarUrl && !avatarErr ? (
  <button
    type="button"
    onClick={() => setAvatarViewerOpen(true)}
    title="Ver foto de perfil"
    className="h-20 w-20 rounded-full overflow-hidden bg-[hsl(var(--muted))] flex items-center justify-center hover:opacity-90 transition-opacity"
  >
    <img
      src={heroAvatarUrl}
      alt={displayName}
      className="h-full w-full object-cover"
      onError={() => setAvatarErr(true)}
    />
  </button>
) : (
  <div className="h-20 w-20 rounded-full overflow-hidden bg-[hsl(var(--muted))] flex items-center justify-center">
    {heroAvatarEmoji ? (
      <span className="text-4xl">{heroAvatarEmoji}</span>
    ) : (
      <span className="text-2xl font-semibold text-[hsl(var(--muted-foreground))]">
        {(displayName ?? "?")[0]?.toUpperCase()}
      </span>
    )}
  </div>
)}
```

- [ ] **Step 3: Render the viewer**

Somewhere in the component's returned JSX where a sibling element can be added without disturbing the `<Tabs>` structure — the cleanest spot is wrapping both `<Tabs>` return branches in a fragment with the viewer alongside. Since the component currently has two separate `return (<Tabs>...</Tabs>)` statements (direct branch, group/channel branch), add the viewer to **both**, right after the closing `</Tabs>`:
```jsx
return (
  <>
    <Tabs defaultValue={initialTab ?? "info"} className="flex-1 min-h-0 flex flex-col overflow-hidden">
      {/* ...unchanged... */}
    </Tabs>
    <ImageViewer
      src={heroAvatarUrl}
      alt={displayName}
      open={avatarViewerOpen}
      onClose={() => setAvatarViewerOpen(false)}
    />
  </>
);
```
(and the same `<ImageViewer .../>` addition, wrapped in a fragment, at the end of the group/channel branch's return statement.)

- [ ] **Step 4: Verify the build**

Run: `pnpm --filter @atlas/desktop exec vite build`
Expected: build succeeds with no errors.

- [ ] **Step 5: Manual visual check**

Open the profile panel for a conversation whose avatar is a real uploaded photo (not an emoji/initial). Click the hero avatar — confirm the lightbox opens full-screen with a download button and close (X) button, and Escape/clicking the overlay closes it. Open the profile panel for a conversation using an emoji or initial-only avatar — confirm clicking it does nothing (no button, no cursor-pointer).

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/components/ConversationProfilePanel.jsx
git commit -m "feat(chat): open profile avatar in ImageViewer lightbox"
```

---

### Task 4: Wire the same lightbox onto the channel-avatar editor preview

**Files:**
- Modify: `apps/desktop/src/modules/atlas.chat/components/ChannelGeneralTab.jsx:66-82`

- [ ] **Step 1: Add viewer state and import**

Add to the existing `@atlas/ui` import line:
```jsx
import { Button, Popover, PopoverTrigger, PopoverContent, ImageViewer } from "@atlas/ui";
```

Add a new state next to `const [emojiOpen, setEmojiOpen] = useState(false);`:
```jsx
const [avatarViewerOpen, setAvatarViewerOpen] = useState(false);
```

- [ ] **Step 2: Make the existing avatar preview clickable when it's a real photo**

Change (lines 67-82):
```jsx
<div className="h-16 w-16 rounded-full bg-[hsl(var(--muted))] flex items-center justify-center overflow-hidden shrink-0">
  {conversation?.avatarUrl ? (
    <img src={conversation.avatarUrl} alt="" className="h-full w-full object-cover" />
  ) : conversation?.avatar_emoji ? (
    // snake_case is correct here, not a typo: getConversation/listConversations
    // rename avatar_file_id's resolved URL to camelCase avatarUrl, but pass
    // avatar_emoji straight through unaliased from `SELECT c.*` — the backend's
    // own response shape is genuinely inconsistent between these two fields.
    <span className="text-3xl">{conversation.avatar_emoji}</span>
  ) : (
    <span className="text-lg font-semibold text-[hsl(var(--muted-foreground))]">
      {(conversation?.title ?? "?")[0]?.toUpperCase()}
    </span>
  )}
</div>
```
to:
```jsx
{conversation?.avatarUrl ? (
  <button
    type="button"
    onClick={() => setAvatarViewerOpen(true)}
    title="Ver imagen del canal"
    className="h-16 w-16 rounded-full bg-[hsl(var(--muted))] flex items-center justify-center overflow-hidden shrink-0 hover:opacity-90 transition-opacity"
  >
    <img src={conversation.avatarUrl} alt="" className="h-full w-full object-cover" />
  </button>
) : (
  <div className="h-16 w-16 rounded-full bg-[hsl(var(--muted))] flex items-center justify-center overflow-hidden shrink-0">
    {conversation?.avatar_emoji ? (
      // snake_case is correct here, not a typo: getConversation/listConversations
      // rename avatar_file_id's resolved URL to camelCase avatarUrl, but pass
      // avatar_emoji straight through unaliased from `SELECT c.*` — the backend's
      // own response shape is genuinely inconsistent between these two fields.
      <span className="text-3xl">{conversation.avatar_emoji}</span>
    ) : (
      <span className="text-lg font-semibold text-[hsl(var(--muted-foreground))]">
        {(conversation?.title ?? "?")[0]?.toUpperCase()}
      </span>
    )}
  </div>
)}
```

- [ ] **Step 3: Render the viewer**

Add right before the component's closing `</div>` (the outermost `<div className="p-4 space-y-4">`):
```jsx
<ImageViewer
  src={conversation?.avatarUrl}
  alt={conversation?.title ?? "Canal"}
  open={avatarViewerOpen}
  onClose={() => setAvatarViewerOpen(false)}
/>
```

- [ ] **Step 4: Verify the build**

Run: `pnpm --filter @atlas/desktop exec vite build`
Expected: build succeeds with no errors.

- [ ] **Step 5: Manual visual check**

Open the "General" tab of a group/channel's profile panel that has an uploaded avatar image. Click the 64px avatar preview — confirm the lightbox opens. Confirm the "Cambiar imagen"/"Cambiar emoji" buttons next to it still work unaffected (they're siblings, not touched by this change).

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/components/ChannelGeneralTab.jsx
git commit -m "feat(chat): open channel avatar preview in ImageViewer lightbox"
```

---

## Self-Review Notes

- **Spec coverage:** Part B (who-reacted modal + remove-own) → Tasks 1-2. Part C (avatar lightbox) → Tasks 3-4 (profile hero + channel editor, the two avatar surfaces the spec names).
- **Type/prop consistency:** `MessageReactionsModal`'s props (`open, onOpenChange, reactions, members, currentUserId, onRemoveOwn`) match exactly between its definition (Task 1) and its call site (Task 2). `MessageReactions`'s new `members` prop matches what `ChatMessageBubble.jsx` already holds — no new data fetch introduced.
- **No backend changes anywhere in this plan** — `reactions[].userIds` and `members[].avatarUrl`/`displayName` are already present in every payload these components already receive.
