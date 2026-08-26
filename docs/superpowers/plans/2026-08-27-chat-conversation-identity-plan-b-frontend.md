# Chat Conversation Identity — Plan B (Frontend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a type badge on every conversation avatar, let a channel/group set an image-or-emoji avatar via a new "General" tab, and replace the header's "N miembro(s)" text with a clickable avatar stack.

**Architecture:** A new small, shared `ConversationTypeBadge.jsx` (icon-only, positioned by its caller) is added into the 3 existing, separately-implemented local `Avatar`/`AvatarCircle` components (`ChatConversationItem.jsx`, `ChatWindow.jsx`, `FloatingChatHub.jsx`) rather than replacing them with one shared component — each already has its own sizing/props convention, and a bigger unification refactor isn't needed to solve the actual problem. A new `ChannelGeneralTab.jsx` (in `ChannelDetailsSheet.jsx`, alongside the existing `ChannelMembersTab`/`ChannelRolesTab`) holds the avatar-editing UI. A new `MemberAvatarStack.jsx` replaces the header's member-count text.

**Tech Stack:** React, `@atlas/ui`, `emoji-picker-react`, TanStack Query.

**Depends on:** Plan A (backend) — must be complete first (`updateConversation` accepts `avatarFileId`/`avatarEmoji`; `getConversation`/`listConversations` return a resolved `avatarUrl` + raw `avatar_emoji`).

**Spec:** `docs/superpowers/specs/2026-08-27-chat-conversation-identity-design.md`

**Critical casing fact this plan fixes, not just works around**: `ChatConversationItem.jsx:48`, `ChatWindow.jsx:192`, and `FloatingChatHub.jsx:33` ALL currently read `conversation.avatar_url` (snake_case) — the pre-existing, permanently-`NULL`, dead raw column. Plan A's backend now returns a computed `conversation.avatarUrl` (camelCase) instead, and explicitly sets `avatar_url` to `undefined` in every response so the old snake_case read silently returns nothing forever if left unfixed. **All three of these lines must change to `conversation.avatarUrl`** — this is not optional cleanup, it's required for the feature to work at all, exactly the kind of casing pitfall (a live camelCase computed field vs. a dead snake_case raw column) that caused real, shipped bugs in Phases D/E of this project's chat work.

---

## File Structure Map

| File | Action | Responsibility |
|---|---|---|
| `apps/desktop/src/modules/atlas.chat/components/ConversationTypeBadge.jsx` | Create | Small `#`/people icon badge |
| `apps/desktop/src/modules/atlas.chat/components/ChatConversationItem.jsx` | Modify | Fix casing, emoji avatar, type badge |
| `apps/desktop/src/modules/atlas.chat/components/ChatWindow.jsx` | Modify | Fix casing, emoji avatar, type badge, member avatar stack |
| `apps/desktop/src/modules/atlas.chat/components/FloatingChatHub.jsx` | Modify | Fix casing, emoji avatar, type badge |
| `apps/desktop/src/modules/atlas.chat/components/ChannelGeneralTab.jsx` | Create | Avatar-editing UI (image upload + emoji picker + remove) |
| `apps/desktop/src/modules/atlas.chat/components/ChannelDetailsSheet.jsx` | Modify | Add "General" tab (first, default) |
| `apps/desktop/src/modules/atlas.chat/components/MemberAvatarStack.jsx` | Create | Overlapping member avatars, replaces header text |

---

### Task 1: `ConversationTypeBadge` + wire into all 3 avatar-rendering surfaces

**Files:**
- Create: `apps/desktop/src/modules/atlas.chat/components/ConversationTypeBadge.jsx`
- Modify: `apps/desktop/src/modules/atlas.chat/components/ChatConversationItem.jsx`
- Modify: `apps/desktop/src/modules/atlas.chat/components/ChatWindow.jsx`
- Modify: `apps/desktop/src/modules/atlas.chat/components/FloatingChatHub.jsx`

**This is the highest-risk task in this plan for the reason spec Section 24 Risk 1 names explicitly**: this exact "one new visual element has to reach every avatar-rendering surface" pattern has bitten every prior phase of this project (mentions only reaching one bubble branch in Phase C; reactions/pin missing from `FloatingChatHub` in Phase D/E). There are 3 real surfaces here, enumerated up front — do not stop after fixing the first one you find.

- [ ] **Step 1: Implement `ConversationTypeBadge.jsx`**

```javascript
// apps/desktop/src/modules/atlas.chat/components/ConversationTypeBadge.jsx
import { Hash, Users } from "lucide-react";

// Small corner badge signaling conversation type — rendered by each of the
// 3 places a conversation avatar shows (ChatConversationItem, ChatWindow,
// FloatingChatHub). Renders nothing for "direct" (a 1:1 chat's identity is
// the other person's own photo, which is signal enough) and for unknown
// types (defensive — a badge for a type we don't recognize would be
// misleading, not helpful).
export function ConversationTypeBadge({ type, className = "" }) {
  if (type === "channel") {
    return (
      <span className={`absolute bottom-0 right-0 flex items-center justify-center h-3.5 w-3.5 rounded-full bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] ring-2 ring-[hsl(var(--background))] ${className}`}>
        <Hash className="h-2 w-2" />
      </span>
    );
  }
  if (type === "group") {
    return (
      <span className={`absolute bottom-0 right-0 flex items-center justify-center h-3.5 w-3.5 rounded-full bg-[hsl(var(--muted-foreground))] text-[hsl(var(--background))] ring-2 ring-[hsl(var(--background))] ${className}`}>
        <Users className="h-2 w-2" />
      </span>
    );
  }
  return null;
}
```

The caller is responsible for wrapping this in a `relative`-positioned parent (the avatar container) — this component only positions itself `absolute` within that.

- [ ] **Step 2: Wire into `ChatConversationItem.jsx`**

Read the file in full first (it's short, ~99 lines). In the local `Avatar` function: fix `conversation.avatar_url` → `conversation.avatarUrl` at the call site (not inside `Avatar` itself — that prop is passed in from the parent, trace where `avatarUrl` is computed, currently `const avatarUrl = conversation.avatar_url ?? otherMember?.avatarUrl ?? null;` around line 48 — change to `conversation.avatarUrl`). Add an `avatarEmoji` param, rendering it large (e.g. `text-lg`) in place of the image when present but no image is set (image takes priority if somehow both are present, matching the mutual-exclusion invariant the backend already enforces — this is defense-in-depth, not expected to matter in practice). Add `<ConversationTypeBadge type={conversation.type} />` inside the existing `relative` avatar wrapper div (confirm it's already `relative` — the existing "online" dot at line ~31 already positions itself `absolute` inside that same wrapper, so it should be).

- [ ] **Step 3: Wire into `ChatWindow.jsx`**

Read the relevant section first (around lines 175-297, the header). Fix `conversation?.avatar_url` → `conversation?.avatarUrl` (line ~192). Add the same emoji-avatar-priority rendering and `<ConversationTypeBadge type={conversation?.type} />` to the header's avatar markup (around lines 292-297).

- [ ] **Step 4: Wire into `FloatingChatHub.jsx`**

Read `getAvatarUrl`/`AvatarCircle` (lines ~32-65) in full first. Fix line 33's `conversation.avatar_url` → `conversation.avatarUrl`. `AvatarCircle` is called from 3 places in this file (mini-window header ×2, conversation-picker list) — add `avatarEmoji`/`type` props to `AvatarCircle` itself so all 3 call sites get the fix by threading the values through (don't fix only one call site — re-verify this is genuinely all 3 real call sites by re-grepping `<AvatarCircle` in the current file rather than trusting this count, since it's exactly the kind of enumeration this task exists to get right).

- [ ] **Step 5: Build check**

Run: `pnpm --filter @atlas/desktop exec vite build`

- [ ] **Step 6: Self-review — the actual check this task exists for**

Explicitly trace and report: for each of the 3 files, does a channel show a `#` badge, a group show a people badge, and a direct chat show no badge? Does an emoji-avatar conversation show the emoji (not a broken image, not the initial-letter fallback) in all 3 files? This is the "reached every surface" verification this task is named for — don't report done without tracing all 3.

- [ ] **Step 7: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/components/ConversationTypeBadge.jsx apps/desktop/src/modules/atlas.chat/components/ChatConversationItem.jsx apps/desktop/src/modules/atlas.chat/components/ChatWindow.jsx apps/desktop/src/modules/atlas.chat/components/FloatingChatHub.jsx
git commit -m "feat(chat): show conversation type badge and custom avatars across all render surfaces"
```

---

### Task 2: `ChannelGeneralTab` (avatar editing)

**Files:**
- Create: `apps/desktop/src/modules/atlas.chat/components/ChannelGeneralTab.jsx`

- [ ] **Step 1: Read `MessageReactionPicker.jsx` and `CompanyBranding.jsx`'s `uploadLogoMutation` first (required)**

This component's emoji picker mirrors `MessageReactionPicker.jsx`'s use of `@atlas/ui`'s `Popover`/`emoji-picker-react` (but with a real `PopoverTrigger`, since here the button IS the trigger — not opened externally like the reaction picker is). Its image upload mirrors `CompanyBranding.jsx`'s `uploadLogoMutation` (`apps/desktop/src/modules/atlas.company/screens/CompanyBranding.jsx:401-415`): `FormData` with `file`/`moduleKey`/`entityType`, `atlas.files.upload(formData, token)`, then use the returned file id.

- [ ] **Step 2: Implement**

```javascript
// apps/desktop/src/modules/atlas.chat/components/ChannelGeneralTab.jsx
import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Popover, PopoverTrigger, PopoverContent, toast } from "@atlas/ui";
import { Image as ImageIcon, Smile, X } from "lucide-react";
import EmojiPicker from "emoji-picker-react";
import { useAuth } from "../../../auth/AuthProvider";
import { atlas } from "../../../lib/atlas";
import { useChatConversationDetail } from "../hooks/useChatConversationDetail";
import { roleHasPermission, findOwnMember, CHAT_PERMISSIONS } from "../lib/chatPermissions";

export function ChannelGeneralTab({ conversationId, currentUserId }) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);
  const [emojiOpen, setEmojiOpen] = useState(false);

  const { data: convData } = useChatConversationDetail(conversationId);
  const conversation = convData?.data;
  const ownMember = findOwnMember(conversation?.members ?? [], currentUserId);
  const canManage = roleHasPermission(ownMember, CHAT_PERMISSIONS.CHANNEL_MANAGE);

  const updateMutation = useMutation({
    mutationFn: (updates) => atlas.chat.updateConversation(conversationId, updates, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-conversation", conversationId] });
      queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
    },
    onError: () => toast.error("No se pudo actualizar la imagen del canal."),
  });

  const uploadMutation = useMutation({
    mutationFn: async (file) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("moduleKey", "atlas.chat");
      formData.append("entityType", "ChatConversation");
      const uploaded = await atlas.files.upload(formData, token);
      return uploaded?.data?.id ?? null;
    },
    onSuccess: (fileId) => {
      if (fileId) updateMutation.mutate({ avatarFileId: fileId });
    },
    onError: () => toast.error("No se pudo subir la imagen."),
  });

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (file) uploadMutation.mutate(file);
    e.target.value = "";
  }

  const hasAvatar = Boolean(conversation?.avatarUrl || conversation?.avatar_emoji);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-4">
        <div className="h-16 w-16 rounded-full bg-[hsl(var(--muted))] flex items-center justify-center overflow-hidden shrink-0">
          {conversation?.avatarUrl ? (
            <img src={conversation.avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : conversation?.avatar_emoji ? (
            <span className="text-3xl">{conversation.avatar_emoji}</span>
          ) : (
            <span className="text-lg font-semibold text-[hsl(var(--muted-foreground))]">
              {(conversation?.title ?? "?")[0]?.toUpperCase()}
            </span>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
              disabled={!canManage}
            />
            <Button
              size="sm"
              variant="outline"
              disabled={!canManage || uploadMutation.isPending}
              onClick={() => fileInputRef.current?.click()}
            >
              <ImageIcon className="h-3.5 w-3.5 mr-1.5" />
              Cambiar imagen
            </Button>
            <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
              <PopoverTrigger asChild>
                <Button size="sm" variant="outline" disabled={!canManage}>
                  <Smile className="h-3.5 w-3.5 mr-1.5" />
                  Cambiar emoji
                </Button>
              </PopoverTrigger>
              <PopoverContent side="bottom" align="start" className="w-auto p-0 overflow-hidden">
                <EmojiPicker
                  onEmojiClick={(emojiData) => {
                    updateMutation.mutate({ avatarEmoji: emojiData.emoji });
                    setEmojiOpen(false);
                  }}
                  theme="dark"
                  width={260}
                  height={320}
                  searchPlaceholder="Buscar emoji..."
                  lazyLoadEmojis
                  skinTonesDisabled
                  autoFocusSearch={false}
                />
              </PopoverContent>
            </Popover>
          </div>
          {hasAvatar && canManage && (
            <button
              type="button"
              onClick={() => updateMutation.mutate({ avatarFileId: null, avatarEmoji: null })}
              className="flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))] hover:text-red-500 transition-colors self-start"
            >
              <X className="h-3 w-3" />
              Quitar imagen o emoji
            </button>
          )}
        </div>
      </div>
      {!canManage && (
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          Solo un administrador del canal puede cambiar esta imagen.
        </p>
      )}
    </div>
  );
}
```

**Verify before trusting this snippet**: confirm `toast` is genuinely exported from `@atlas/ui` (this module's other files import it from `"sonner"` directly in some places — check `MessageComposer.jsx`'s own import for the actual convention used elsewhere in `atlas.chat` and match it, don't assume `@atlas/ui` re-exports it). Confirm `CHAT_PERMISSIONS.CHANNEL_MANAGE` is the exact key name in `chatPermissions.js` (used elsewhere in this session's Phase A/B work — cross-check spelling). Confirm `useChatConversationDetail`'s response shape genuinely includes `avatarUrl`/`avatar_emoji` per Plan A's backend changes (it should, since it calls `getConversation`, but confirm the hook doesn't do its own response reshaping that would drop them).

- [ ] **Step 3: Build check and commit**

```bash
pnpm --filter @atlas/desktop exec vite build
git add apps/desktop/src/modules/atlas.chat/components/ChannelGeneralTab.jsx
git commit -m "feat(chat): add channel/group avatar editing (General tab)"
```

---

### Task 3: Wire `ChannelGeneralTab` into `ChannelDetailsSheet`

**Files:**
- Modify: `apps/desktop/src/modules/atlas.chat/components/ChannelDetailsSheet.jsx`

- [ ] **Step 1: Read the current file in full (required, it's short — 44 lines)**

- [ ] **Step 2: Add the tab**

Add a `TabsTrigger`/`TabsContent` pair for `"general"`, placed FIRST (before "Miembros"), and make it the `Tabs`' `defaultValue` (spec Section 8 — "General" is the first tab):

```javascript
import { ChannelGeneralTab } from "./ChannelGeneralTab";
```
```javascript
        <Tabs defaultValue="general" className="flex-1 min-h-0 flex flex-col">
          <TabsList>
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
```

- [ ] **Step 3: Build check and commit**

```bash
pnpm --filter @atlas/desktop exec vite build
git add apps/desktop/src/modules/atlas.chat/components/ChannelDetailsSheet.jsx
git commit -m "feat(chat): add General tab to ChannelDetailsSheet"
```

---

### Task 4: Member avatar stack in the header

**Files:**
- Create: `apps/desktop/src/modules/atlas.chat/components/MemberAvatarStack.jsx`
- Modify: `apps/desktop/src/modules/atlas.chat/components/ChatWindow.jsx`

- [ ] **Step 1: Read `ChatWindow.jsx`'s current header member-count rendering first (required)**

Find where "N miembro(s)"-style text currently renders (search for `miembro` in this file) before editing.

- [ ] **Step 2: Implement `MemberAvatarStack.jsx`**

```javascript
// apps/desktop/src/modules/atlas.chat/components/MemberAvatarStack.jsx
const MAX_VISIBLE = 4;

export function MemberAvatarStack({ members = [], onClick }) {
  if (!members.length) return null;
  const visible = members.slice(0, MAX_VISIBLE);
  const extra = members.length - visible.length;

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center -space-x-2 hover:opacity-80 transition-opacity"
      title={`${members.length} ${members.length === 1 ? "miembro" : "miembros"}`}
    >
      {visible.map((m) => (
        <span
          key={m.userId ?? m.id}
          className="h-6 w-6 rounded-full ring-2 ring-[hsl(var(--background))] overflow-hidden bg-[hsl(var(--muted))] flex items-center justify-center shrink-0"
        >
          {m.avatarUrl ? (
            <img src={m.avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))]">
              {(m.displayName ?? "?")[0]?.toUpperCase()}
            </span>
          )}
        </span>
      ))}
      {extra > 0 && (
        <span className="h-6 w-6 rounded-full ring-2 ring-[hsl(var(--background))] bg-[hsl(var(--muted-foreground))] text-[hsl(var(--background))] flex items-center justify-center shrink-0 text-[10px] font-semibold">
          +{extra}
        </span>
      )}
    </button>
  );
}
```

- [ ] **Step 3: Wire into `ChatWindow.jsx`'s header**

Replace the existing "N miembro(s)" text render with `<MemberAvatarStack members={detailMembers ?? conversation.members} onClick={onOpenPinned ? undefined : () => setShowDetails(true)} />` — READ the actual current header code first to find the real existing handler that opens `ChannelDetailsSheet` (likely already a `setShowDetails(true)`-style call reachable from a "Ver miembros" menu item, per this session's Phase A/B work) and wire the SAME handler, not a new one — this component's `onClick` prop is intentionally generic (spec Non-goal 2) so a later sub-project can swap what it opens without touching this file. Use `detailMembers ?? conversation.members` (the existing variable already established in this file from Phase D's `canPin`-bug fix, reused here rather than a new member source) so the stack shows real avatars, not the list-preview shape that lacks them.

- [ ] **Step 4: Build check**

Run: `pnpm --filter @atlas/desktop exec vite build`

- [ ] **Step 5: Self-review**

Confirm: does the stack only render for `channel`/`group` conversations, or does it also try to render for `direct` (where "members" conceptually still exist — 2 people — but the existing UI doesn't show a member list for 1:1 chats today)? Check the current header's conditional rendering around the member-count text (it's likely already gated to `channel`/`group` only, matching `ChatMessageBubble`'s own `canReply`/`canPin` gating pattern from Phase D/E) — if so, apply the same gate to `MemberAvatarStack`'s render, don't introduce a new ungated behavior for direct chats.

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/components/MemberAvatarStack.jsx apps/desktop/src/modules/atlas.chat/components/ChatWindow.jsx
git commit -m "feat(chat): replace member-count text with an avatar stack in the chat header"
```

---

## Self-Review Notes

- **Spec coverage**: Task 1 covers Section 8's type badge requirement and Section 24 Risk 1 (all 3 surfaces). Task 2-3 cover the avatar-editing UX. Task 4 covers the member-stack requirement and Non-goal 2 (decoupled click handler).
- **No placeholders** except the explicitly-flagged "verify `toast`'s real import source"/"verify `CHAT_PERMISSIONS.CHANNEL_MANAGE`'s exact spelling"/"verify the hook's response shape" notes in Task 2 Step 2, and "find the real existing handler, don't invent a new one" in Task 4 Step 3 — read-the-real-code directives, matching this session's established convention.
- **Casing discipline**: this plan's header section states the exact required fix (3 files, `avatar_url` → `avatarUrl`) up front rather than leaving it implicit in Task 1's steps, since it's the single most important correctness fact in this entire plan.
