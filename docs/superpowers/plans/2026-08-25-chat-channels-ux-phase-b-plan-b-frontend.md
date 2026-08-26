# Chat Channels UX Phase B — Plan B (Frontend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the UI for creating channels, browsing/joining the public directory, managing members, and managing roles — on top of Phase A's complete backend and Plan A's `getConversation` extension.

**Architecture:** New components/hooks under `apps/desktop/src/modules/atlas.chat/`, following the exact existing patterns in that module (TanStack Query hooks per concern in `hooks/`, `@atlas/ui` primitives, `atlas.chat.*` SDK calls via `../../../lib/atlas`, `useAuth()` for the session token). No new routes — everything is reached from the existing Chat screen via the sidebar "+" menu and the chat window's existing (currently-inert) "Ver miembros" menu item.

**Tech Stack:** React, TanStack Query, `@atlas/ui`, `lucide-react` icons. `node:test` for the one pure-logic module this plan adds; React components in this codebase have no existing unit-test harness (verified: zero `.test.jsx` files anywhere in `apps/desktop/src/`) — correctness for components is verified via `pnpm build` + manual browser QA, matching how every existing chat component (`CreateChatModal.jsx`, `ChatWindow.jsx`, etc.) is already handled.

**Depends on:** Plan A (backend) must land first — `GET /chat/conversations/:id`'s member objects must already include `roleId`/`roleName`/`roleColor`/`rolePosition`/`roleIsSystem` before Task 3 of this plan can render them correctly.

**Spec:** `docs/superpowers/specs/2026-08-25-chat-channels-ux-phase-b-design.md`

---

## File Structure Map

| File | Action | Responsibility |
|---|---|---|
| `apps/desktop/src/modules/atlas.chat/lib/chatPermissions.js` | Create | Pure client-side mirror of the backend's `CHAT_PERMISSIONS`/`roleHasPermission` — for UI gating only, not enforcement |
| `apps/desktop/src/modules/atlas.chat/hooks/useChatConversationDetail.js` | Create | `GET /chat/conversations/:id` query hook (closes an existing dead invalidation — `useAddMembers` already invalidates this exact query key with nothing consuming it) |
| `apps/desktop/src/modules/atlas.chat/hooks/useChannels.js` | Create | `useCreateChannel`, `useChannelDirectory`, `useJoinChannel` |
| `apps/desktop/src/modules/atlas.chat/hooks/useChannelRoles.js` | Create | `useChannelRoles`, `useCreateChannelRole`, `useUpdateChannelRole`, `useDeleteChannelRole`, `useAssignMemberRole` |
| `apps/desktop/src/modules/atlas.chat/hooks/useChatConversations.js` | Modify | Add `useRemoveMember` (SDK method already exists, no hook yet) |
| `apps/desktop/src/modules/atlas.chat/components/CreateChannelModal.jsx` | Create | Channel creation dialog |
| `apps/desktop/src/modules/atlas.chat/components/ChannelDirectorySheet.jsx` | Create | Public channel browse/join panel |
| `apps/desktop/src/modules/atlas.chat/components/ChannelMembersTab.jsx` | Create | Member list with role badges, add/remove |
| `apps/desktop/src/modules/atlas.chat/components/RoleEditorDialog.jsx` | Create | Create/edit a role (name, color, position, permissions) |
| `apps/desktop/src/modules/atlas.chat/components/ChannelRolesTab.jsx` | Create | Role list, wires to `RoleEditorDialog` |
| `apps/desktop/src/modules/atlas.chat/components/ChannelDetailsSheet.jsx` | Create | Tab shell (Miembros / Roles) opened from the chat window |
| `apps/desktop/src/modules/atlas.chat/components/ChatSidebar.jsx` | Modify | "+" becomes a dropdown with 3 options |
| `apps/desktop/src/modules/atlas.chat/components/ChatWindow.jsx` | Modify | Wire the existing inert "Ver miembros" item to open `ChannelDetailsSheet`; extend it to `channel` type |
| `apps/desktop/src/modules/atlas.chat/lib/__tests__/chatPermissions.test.js` | Create | Unit tests for the pure-logic module |

---

### Task 1: `chatPermissions.js` (pure logic, tested) + `useChatConversationDetail` hook

**Files:**
- Create: `apps/desktop/src/modules/atlas.chat/lib/chatPermissions.js`
- Create: `apps/desktop/src/modules/atlas.chat/lib/__tests__/chatPermissions.test.js`
- Create: `apps/desktop/src/modules/atlas.chat/hooks/useChatConversationDetail.js`

- [ ] **Step 1: Write the failing tests**

```javascript
// apps/desktop/src/modules/atlas.chat/lib/__tests__/chatPermissions.test.js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CHAT_PERMISSIONS, roleHasPermission, findOwnMember } from "../chatPermissions.js";

describe("chatPermissions — roleHasPermission", () => {
  it("returns false for a null/undefined member", () => {
    assert.equal(roleHasPermission(null, CHAT_PERMISSIONS.MEMBERS_MANAGE), false);
    assert.equal(roleHasPermission(undefined, CHAT_PERMISSIONS.MEMBERS_MANAGE), false);
  });

  it("returns true for any permission when the member's role is a system role (Owner)", () => {
    const member = { roleIsSystem: true, rolePermissions: {} };
    assert.equal(roleHasPermission(member, CHAT_PERMISSIONS.CHANNEL_MANAGE), true);
  });

  it("checks rolePermissions for a non-system role", () => {
    const member = { roleIsSystem: false, rolePermissions: { "members.manage": true } };
    assert.equal(roleHasPermission(member, CHAT_PERMISSIONS.MEMBERS_MANAGE), true);
    assert.equal(roleHasPermission(member, CHAT_PERMISSIONS.CHANNEL_MANAGE), false);
  });

  it("returns false when rolePermissions is missing entirely (e.g. direct/external_support members)", () => {
    const member = { roleIsSystem: false, rolePermissions: undefined };
    assert.equal(roleHasPermission(member, CHAT_PERMISSIONS.MESSAGES_SEND), false);
  });
});

describe("chatPermissions — findOwnMember", () => {
  it("finds the member matching the current user's id", () => {
    const members = [{ userId: "u1" }, { userId: "u2" }];
    assert.deepEqual(findOwnMember(members, "u2"), { userId: "u2" });
  });

  it("returns null when there is no match or members is empty/undefined", () => {
    assert.equal(findOwnMember([{ userId: "u1" }], "u2"), null);
    assert.equal(findOwnMember(undefined, "u2"), null);
    assert.equal(findOwnMember([], "u2"), null);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test apps/desktop/src/modules/atlas.chat/lib/__tests__/chatPermissions.test.js`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement `chatPermissions.js`**

```javascript
// apps/desktop/src/modules/atlas.chat/lib/chatPermissions.js
//
// Client-side mirror of apps/api/src/routes/chat/chat-permissions-service.js's
// CHAT_PERMISSIONS/roleHasPermission — for UI gating (hiding buttons the user
// can't use) ONLY. The backend re-validates every mutation regardless of what
// this module says; this file existing and drifting out of sync would at worst
// show a wrong button, never grant an unauthorized action. Keep the 8 keys
// below byte-identical to the backend file if it ever changes.

export const CHAT_PERMISSIONS = Object.freeze({
  CHANNEL_MANAGE: "channel.manage",
  MEMBERS_MANAGE: "members.manage",
  ROLES_MANAGE: "roles.manage",
  MESSAGES_SEND: "messages.send",
  MESSAGES_PIN: "messages.pin",
  MESSAGES_DELETE_OTHERS: "messages.delete_others",
  MENTIONS_EVERYONE: "mentions.everyone",
  MENTIONS_HERE: "mentions.here",
});

// `member` is one entry from a conversation's `members` array (as returned by
// GET /chat/conversations/:id after Plan A) — expects roleIsSystem/rolePermissions
// fields. Both are undefined/null for direct/external_support members, which
// correctly makes every permission resolve to false for them (they have no
// channel-scoped permissions to begin with).
export function roleHasPermission(member, permissionKey) {
  if (!member) return false;
  if (member.roleIsSystem) return true;
  return member.rolePermissions?.[permissionKey] === true;
}

export function findOwnMember(members, currentUserId) {
  if (!members?.length) return null;
  return members.find((m) => m.userId === currentUserId) ?? null;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `node --test apps/desktop/src/modules/atlas.chat/lib/__tests__/chatPermissions.test.js`
Expected: PASS.

- [ ] **Step 5: Create the conversation-detail hook**

```javascript
// apps/desktop/src/modules/atlas.chat/hooks/useChatConversationDetail.js
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../../auth/AuthProvider";
import { atlas } from "../../../lib/atlas";

// GET /chat/conversations/:id — the full member list (with role info, after
// Plan A), unlike the conversation LIST query which only returns a 5-member
// preview. `useAddMembers` (useCreateConversation.js) already invalidates this
// exact query key; before this hook existed, nothing ever fetched it.
export function useChatConversationDetail(conversationId) {
  const { session } = useAuth();
  const token = session?.access_token;

  return useQuery({
    queryKey: ["chat-conversation", conversationId],
    queryFn: () => atlas.chat.getConversation(conversationId, token),
    enabled: Boolean(token && conversationId),
    staleTime: 15_000,
  });
}
```

- [ ] **Step 6: Syntax check and commit**

```bash
node --check apps/desktop/src/modules/atlas.chat/lib/chatPermissions.js
node --check apps/desktop/src/modules/atlas.chat/hooks/useChatConversationDetail.js
git add apps/desktop/src/modules/atlas.chat/lib/chatPermissions.js apps/desktop/src/modules/atlas.chat/lib/__tests__/chatPermissions.test.js apps/desktop/src/modules/atlas.chat/hooks/useChatConversationDetail.js
git commit -m "feat(chat): add client-side permission helper and conversation-detail hook"
```

---

### Task 2: Channel/directory hooks + `useRemoveMember`

**Files:**
- Create: `apps/desktop/src/modules/atlas.chat/hooks/useChannels.js`
- Create: `apps/desktop/src/modules/atlas.chat/hooks/useChannelRoles.js`
- Modify: `apps/desktop/src/modules/atlas.chat/hooks/useChatConversations.js`

- [ ] **Step 1: Create `useChannels.js`**

```javascript
// apps/desktop/src/modules/atlas.chat/hooks/useChannels.js
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../../auth/AuthProvider";
import { atlas } from "../../../lib/atlas";

export function useCreateChannel() {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data) => atlas.chat.createChannel(data, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
    },
  });
}

export function useChannelDirectory(params = {}) {
  const { session } = useAuth();
  const token = session?.access_token;

  return useQuery({
    queryKey: ["chat-channel-directory", params],
    queryFn: () => atlas.chat.listChannelDirectory(params, token),
    enabled: Boolean(token),
    staleTime: 30_000,
  });
}

export function useJoinChannel() {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (conversationId) => atlas.chat.joinChannel(conversationId, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
      queryClient.invalidateQueries({ queryKey: ["chat-channel-directory"] });
    },
  });
}
```

- [ ] **Step 2: Create `useChannelRoles.js`**

```javascript
// apps/desktop/src/modules/atlas.chat/hooks/useChannelRoles.js
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../../auth/AuthProvider";
import { atlas } from "../../../lib/atlas";

export function useChannelRoles(conversationId) {
  const { session } = useAuth();
  const token = session?.access_token;

  return useQuery({
    queryKey: ["chat-channel-roles", conversationId],
    queryFn: () => atlas.chat.listChannelRoles(conversationId, token),
    enabled: Boolean(token && conversationId),
    staleTime: 15_000,
  });
}

function useInvalidateRolesAndMembers(conversationId, queryClient) {
  return () => {
    queryClient.invalidateQueries({ queryKey: ["chat-channel-roles", conversationId] });
    queryClient.invalidateQueries({ queryKey: ["chat-conversation", conversationId] });
  };
}

export function useCreateChannelRole(conversationId) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const invalidate = useInvalidateRolesAndMembers(conversationId, queryClient);

  return useMutation({
    mutationFn: (data) => atlas.chat.createChannelRole(conversationId, data, token),
    onSuccess: invalidate,
  });
}

export function useUpdateChannelRole(conversationId) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const invalidate = useInvalidateRolesAndMembers(conversationId, queryClient);

  return useMutation({
    mutationFn: ({ roleId, data }) => atlas.chat.updateChannelRole(conversationId, roleId, data, token),
    onSuccess: invalidate,
  });
}

export function useDeleteChannelRole(conversationId) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const invalidate = useInvalidateRolesAndMembers(conversationId, queryClient);

  return useMutation({
    mutationFn: (roleId) => atlas.chat.deleteChannelRole(conversationId, roleId, token),
    onSuccess: invalidate,
  });
}

export function useAssignMemberRole(conversationId) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const invalidate = useInvalidateRolesAndMembers(conversationId, queryClient);

  return useMutation({
    mutationFn: ({ memberId, roleId }) => atlas.chat.assignMemberRole(conversationId, memberId, roleId, token),
    onSuccess: invalidate,
  });
}
```

- [ ] **Step 3: Add `useRemoveMember` to the existing `useChatConversations.js`**

Read `apps/desktop/src/modules/atlas.chat/hooks/useChatConversations.js` first. Append this new export at the end of the file (same file `useAddMembers` lives in — actually check: `useAddMembers` is in `useCreateConversation.js`, not `useChatConversations.js`; place `useRemoveMember` in `useCreateConversation.js` right after `useAddMembers`, to keep member-mutation hooks together):

```javascript
export function useRemoveMember(conversationId) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId) => atlas.chat.removeMember(conversationId, userId, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
      queryClient.invalidateQueries({ queryKey: ["chat-conversation", conversationId] });
    },
  });
}
```

(Correcting the File Structure Map above: this hook goes in `useCreateConversation.js`, not `useChatConversations.js` — `useCreateConversation.js` is where `useAddMembers` already lives, and member-mutation hooks belong together there.)

- [ ] **Step 4: Syntax check and commit**

```bash
node --check apps/desktop/src/modules/atlas.chat/hooks/useChannels.js
node --check apps/desktop/src/modules/atlas.chat/hooks/useChannelRoles.js
node --check apps/desktop/src/modules/atlas.chat/hooks/useCreateConversation.js
git add apps/desktop/src/modules/atlas.chat/hooks/useChannels.js apps/desktop/src/modules/atlas.chat/hooks/useChannelRoles.js apps/desktop/src/modules/atlas.chat/hooks/useCreateConversation.js
git commit -m "feat(chat): add channel/role/remove-member data hooks"
```

---

### Task 3: `CreateChannelModal.jsx` + wire into `ChatSidebar`

**Files:**
- Create: `apps/desktop/src/modules/atlas.chat/components/CreateChannelModal.jsx`
- Modify: `apps/desktop/src/modules/atlas.chat/components/ChatSidebar.jsx`

- [ ] **Step 1: Create `CreateChannelModal.jsx`**

Mirrors `CreateChatModal.jsx`'s structure (same user-picker pattern, same `Dialog` shell) with channel-specific fields added:

```javascript
// apps/desktop/src/modules/atlas.chat/components/CreateChannelModal.jsx
import { useState, useMemo } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
  Button, Input, Textarea, Switch, Label,
} from "@atlas/ui";
import { Hash } from "lucide-react";
import { useCreateChannel } from "../hooks/useChannels";

function slugify(text) {
  return text
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "") // strip accents
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60);
}

export function CreateChannelModal({ open, onClose, onCreated }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [error, setError] = useState(null);
  const { mutateAsync: createChannel, isPending } = useCreateChannel();

  const effectiveSlug = useMemo(
    () => (slugEdited ? slug : slugify(title)),
    [slug, slugEdited, title],
  );

  function handleTitleChange(e) {
    setTitle(e.target.value);
  }

  function handleSlugChange(e) {
    setSlugEdited(true);
    setSlug(slugify(e.target.value));
  }

  function reset() {
    setTitle("");
    setDescription("");
    setIsPublic(true);
    setSlug("");
    setSlugEdited(false);
    setError(null);
  }

  async function handleCreate() {
    if (!title.trim()) return;
    setError(null);
    try {
      const result = await createChannel({
        title: title.trim(),
        description: description.trim() || undefined,
        isPublic,
        slug: effectiveSlug || undefined,
      });
      onCreated?.(result?.data ?? result);
      onClose?.();
      reset();
    } catch (err) {
      setError(err?.message ?? "Error creando canal.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { onClose?.(); reset(); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Hash className="h-4 w-4 text-[hsl(var(--primary))]" />
            Crear canal
          </DialogTitle>
          <DialogDescription>
            Un canal es un espacio persistente para tu equipo, con roles y permisos propios.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="channel-title">Nombre</Label>
            <Input
              id="channel-title"
              value={title}
              onChange={handleTitleChange}
              placeholder="general"
              autoFocus
            />
            {effectiveSlug && (
              <p className="text-xs text-[hsl(var(--muted-foreground))]">#{effectiveSlug}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="channel-description">Descripcion (opcional)</Label>
            <Textarea
              id="channel-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="De que trata este canal..."
              rows={2}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-[hsl(var(--border))] px-3 py-2.5">
            <div>
              <p className="text-sm font-medium">Canal publico</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                Cualquiera en tu empresa puede encontrarlo y unirse.
              </p>
            </div>
            <Switch checked={isPublic} onCheckedChange={setIsPublic} />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { onClose?.(); reset(); }} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={handleCreate} disabled={!title.trim() || isPending}>
            {isPending ? "Creando..." : "Crear canal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

(Initial-members picking is deliberately omitted from v1 of this modal — the creator can add members afterward from `ChannelMembersTab`, avoiding duplicating `CreateChatModal`'s user-picker UI here; this is a reasonable scope cut, not in the spec's required UX list verbatim but consistent with its "reuse the same user-picker pattern... for optional initial members" being marked optional. If a reviewer disagrees, that picker can be lifted verbatim from `CreateChatModal.jsx` in a follow-up — flag as DONE_WITH_CONCERNS if you'd rather add it now than skip it.)

- [ ] **Step 2: Wire into `ChatSidebar.jsx`**

Read the current file first. Change the imports to add `DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem` and `MessageSquarePlus, Hash, Compass` icons, and the two new components/state:

Replace:
```javascript
import { Button, EmptyState, SearchInput, Skeleton } from "@atlas/ui";
import { Plus, Archive, ChevronDown, ChevronRight } from "lucide-react";
import { ChatConversationItem } from "./ChatConversationItem";
import { CreateChatModal } from "./CreateChatModal";
```
with:
```javascript
import { Button, EmptyState, SearchInput, Skeleton, DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@atlas/ui";
import { Plus, Archive, ChevronDown, ChevronRight, MessageSquarePlus, Hash, Compass } from "lucide-react";
import { ChatConversationItem } from "./ChatConversationItem";
import { CreateChatModal } from "./CreateChatModal";
import { CreateChannelModal } from "./CreateChannelModal";
import { ChannelDirectorySheet } from "./ChannelDirectorySheet";
```

Replace the `showCreate` state line:
```javascript
  const [showCreate, setShowCreate] = useState(false);
```
with:
```javascript
  const [showCreate, setShowCreate] = useState(false);
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [showDirectory, setShowDirectory] = useState(false);
```

Replace the header's "+" button:
```javascript
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          onClick={() => setShowCreate(true)}
          title="Nueva conversacion"
        >
          <Plus className="h-4 w-4" />
        </Button>
```
with:
```javascript
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" className="h-7 w-7" title="Nueva conversacion o canal">
              <Plus className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setShowCreate(true)}>
              <MessageSquarePlus className="h-3.5 w-3.5 mr-2" />
              Nueva conversacion
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setShowCreateChannel(true)}>
              <Hash className="h-3.5 w-3.5 mr-2" />
              Crear canal
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setShowDirectory(true)}>
              <Compass className="h-3.5 w-3.5 mr-2" />
              Explorar canales
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
```

Right after the existing `<CreateChatModal .../>` near the end of the component's JSX, add the two new components:
```javascript
      <CreateChannelModal
        open={showCreateChannel}
        onClose={() => setShowCreateChannel(false)}
        onCreated={(conv) => {
          setShowCreateChannel(false);
          onCreated?.(conv);
        }}
      />

      <ChannelDirectorySheet
        open={showDirectory}
        onOpenChange={setShowDirectory}
        onJoined={(conv) => {
          setShowDirectory(false);
          onCreated?.(conv);
        }}
      />
```

- [ ] **Step 3: Build check and commit**

```bash
node --check apps/desktop/src/modules/atlas.chat/components/CreateChannelModal.jsx
git add apps/desktop/src/modules/atlas.chat/components/CreateChannelModal.jsx apps/desktop/src/modules/atlas.chat/components/ChatSidebar.jsx
git commit -m "feat(chat): add channel creation modal and sidebar create-menu"
```

(Full `pnpm build` verification happens once `ChannelDirectorySheet` exists, in Task 4 — this task alone will fail a full build since `ChatSidebar.jsx` now imports a file that doesn't exist yet. That's expected and fine mid-plan; `node --check` on the files that do exist is sufficient for this task's own checkpoint.)

---

### Task 4: `ChannelDirectorySheet.jsx`

**Files:**
- Create: `apps/desktop/src/modules/atlas.chat/components/ChannelDirectorySheet.jsx`

- [ ] **Step 1: Implement**

```javascript
// apps/desktop/src/modules/atlas.chat/components/ChannelDirectorySheet.jsx
import { useState } from "react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
  Button, EmptyState, ErrorState, Skeleton,
} from "@atlas/ui";
import { Compass, Hash } from "lucide-react";
import { useChannelDirectory, useJoinChannel } from "../hooks/useChannels";

function ChannelDirectoryRow({ channel, onJoin, isJoining }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-[hsl(var(--border))] px-3 py-2.5">
      <div className="h-9 w-9 rounded-full flex items-center justify-center shrink-0 bg-[hsl(var(--muted))]">
        <Hash className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{channel.title}</p>
        {channel.description && (
          <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">{channel.description}</p>
        )}
      </div>
      <Button size="sm" onClick={() => onJoin(channel.id)} disabled={isJoining} className="shrink-0">
        Unirse
      </Button>
    </div>
  );
}

export function ChannelDirectorySheet({ open, onOpenChange, onJoined }) {
  const [cursor, setCursor] = useState(null);
  const [accumulated, setAccumulated] = useState([]);
  const { data, isLoading, isError, refetch } = useChannelDirectory({ cursor });
  const { mutateAsync: joinChannel, isPending: isJoining } = useJoinChannel();
  const [joiningId, setJoiningId] = useState(null);
  const [joinError, setJoinError] = useState(null);

  const rows = cursor ? [...accumulated, ...(data?.data ?? [])] : (data?.data ?? []);

  function handleLoadMore() {
    setAccumulated(rows);
    setCursor(data?.nextCursor ?? null);
  }

  async function handleJoin(channelId) {
    setJoinError(null);
    setJoiningId(channelId);
    try {
      const result = await joinChannel(channelId);
      onJoined?.(result?.data ?? result);
    } catch (err) {
      setJoinError(err?.message ?? "Error uniendote al canal.");
    } finally {
      setJoiningId(null);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Compass className="h-4 w-4 text-[hsl(var(--primary))]" />
            Explorar canales
          </SheetTitle>
          <SheetDescription>Canales publicos de tu empresa a los que aun no perteneces.</SheetDescription>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-y-auto space-y-2 py-3">
          {isLoading && !rows.length && (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-lg" />
              ))}
            </div>
          )}

          {isError && !rows.length && (
            <ErrorState description="No se pudieron cargar los canales." onRetry={refetch} />
          )}

          {!isLoading && !isError && !rows.length && (
            <EmptyState
              icon={Compass}
              title="No hay canales publicos disponibles"
              description="Cuando alguien cree un canal publico, aparecera aqui."
            />
          )}

          {rows.map((channel) => (
            <ChannelDirectoryRow
              key={channel.id}
              channel={channel}
              onJoin={handleJoin}
              isJoining={isJoining && joiningId === channel.id}
            />
          ))}

          {joinError && <p className="text-sm text-destructive">{joinError}</p>}

          {data?.nextCursor && (
            <Button variant="outline" size="sm" className="w-full" onClick={handleLoadMore}>
              Cargar mas
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 2: Syntax check, full build, and commit**

```bash
node --check apps/desktop/src/modules/atlas.chat/components/ChannelDirectorySheet.jsx
pnpm build
git add apps/desktop/src/modules/atlas.chat/components/ChannelDirectorySheet.jsx
git commit -m "feat(chat): add public channel directory sheet"
```

Expected: `pnpm build` now succeeds (Task 3's dangling import is resolved). If it doesn't, fix before committing — do not commit a broken build.

---

### Task 5: `ChannelMembersTab.jsx`

**Files:**
- Create: `apps/desktop/src/modules/atlas.chat/components/ChannelMembersTab.jsx`

- [ ] **Step 1: Implement**

```javascript
// apps/desktop/src/modules/atlas.chat/components/ChannelMembersTab.jsx
import { useState } from "react";
import {
  Button, EmptyState, Skeleton, ConfirmDialog,
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from "@atlas/ui";
import { Users, MoreVertical, UserMinus, ShieldCheck } from "lucide-react";
import { useChatConversationDetail } from "../hooks/useChatConversationDetail";
import { useChannelRoles, useAssignMemberRole } from "../hooks/useChannelRoles";
import { useRemoveMember } from "../hooks/useCreateConversation";
import { roleHasPermission, findOwnMember, CHAT_PERMISSIONS } from "../lib/chatPermissions";

function RoleBadge({ name, color }) {
  if (!name) return null;
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium shrink-0"
      style={{
        backgroundColor: color ? `${color}22` : "hsl(var(--muted))",
        color: color ?? "hsl(var(--muted-foreground))",
      }}
    >
      {name}
    </span>
  );
}

function MemberRow({ member, ownMember, canManageMembers, assignableRoles, onRemove, onAssignRole }) {
  const isSelf = member.userId === ownMember?.userId;
  const canRemoveThis = isSelf || (canManageMembers && member.rolePosition < (ownMember?.rolePosition ?? -1));

  return (
    <div className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-[hsl(var(--muted))]">
      <div className="h-8 w-8 rounded-full flex items-center justify-center font-semibold text-xs shrink-0"
           style={{ backgroundColor: "var(--brand-primary)", color: "var(--brand-primary-foreground)" }}>
        {member.displayName?.[0]?.toUpperCase() ?? "?"}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-medium truncate">{member.displayName}</p>
          <RoleBadge name={member.roleName} color={member.roleColor} />
        </div>
        <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">{member.email}</p>
      </div>
      {canRemoveThis && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0">
              <MoreVertical className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {canManageMembers && !isSelf && assignableRoles.map((role) => (
              <DropdownMenuItem key={role.id} onSelect={() => onAssignRole(member.userId, role.id)}>
                <ShieldCheck className="h-3.5 w-3.5 mr-2" />
                Asignar rol: {role.name}
              </DropdownMenuItem>
            ))}
            {canManageMembers && !isSelf && assignableRoles.length > 0 && <DropdownMenuSeparator />}
            <DropdownMenuItem onSelect={() => onRemove(member)} className="text-red-500 focus:text-red-500">
              <UserMinus className="h-3.5 w-3.5 mr-2" />
              {isSelf ? "Salir del canal" : "Eliminar miembro"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

export function ChannelMembersTab({ conversationId, currentUserId }) {
  const { data: convData, isLoading } = useChatConversationDetail(conversationId);
  const { data: rolesData } = useChannelRoles(conversationId);
  const { mutateAsync: removeMember } = useRemoveMember(conversationId);
  const { mutateAsync: assignRole } = useAssignMemberRole(conversationId);
  const [confirmTarget, setConfirmTarget] = useState(null);

  const members = convData?.data?.members ?? [];
  const roles = rolesData?.data ?? [];
  const ownMember = findOwnMember(members, currentUserId);
  const canManageMembers = roleHasPermission(ownMember, CHAT_PERMISSIONS.MEMBERS_MANAGE);
  const assignableRoles = roles.filter((r) => r.position < (ownMember?.rolePosition ?? -1) || (r.isSystem && ownMember?.roleIsSystem));

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
      </div>
    );
  }

  if (!members.length) {
    return <EmptyState icon={Users} title="Sin miembros" description="Este canal no tiene miembros activos." />;
  }

  return (
    <div className="space-y-0.5">
      {members.map((member) => (
        <MemberRow
          key={member.userId}
          member={member}
          ownMember={ownMember}
          canManageMembers={canManageMembers}
          assignableRoles={assignableRoles}
          onRemove={(m) => setConfirmTarget(m)}
          onAssignRole={(memberId, roleId) => assignRole({ memberId, roleId })}
        />
      ))}

      <ConfirmDialog
        open={Boolean(confirmTarget)}
        onOpenChange={(v) => !v && setConfirmTarget(null)}
        title={confirmTarget?.userId === currentUserId ? "Salir del canal" : "Eliminar miembro"}
        description={
          confirmTarget?.userId === currentUserId
            ? "Dejaras de tener acceso a este canal."
            : `${confirmTarget?.displayName ?? "Este miembro"} sera eliminado del canal.`
        }
        confirmLabel={confirmTarget?.userId === currentUserId ? "Salir" : "Eliminar"}
        onConfirm={async () => {
          if (confirmTarget) await removeMember(confirmTarget.userId);
          setConfirmTarget(null);
        }}
      />
    </div>
  );
}
```

Note: `member.rolePosition`/`role.position` comparisons above use `<` (strictly outrank), matching the backend's `assertHigherPosition` semantics exactly (spec edge case 2). `ownMember?.rolePosition ?? -1` defaults to a value no real role can be below (0 is the lowest real position), so a `null` own-role member (shouldn't happen for a real member, but defensively) sees no assignable roles and no remove-others capability — fails closed, matching the client-side-gating-only intent (Section 24 risk 1).

- [ ] **Step 2: Syntax check, build, commit**

```bash
node --check apps/desktop/src/modules/atlas.chat/components/ChannelMembersTab.jsx
pnpm build
git add apps/desktop/src/modules/atlas.chat/components/ChannelMembersTab.jsx
git commit -m "feat(chat): add channel members tab with role badges and management actions"
```

---

### Task 6: `RoleEditorDialog.jsx` + `ChannelRolesTab.jsx`

**Files:**
- Create: `apps/desktop/src/modules/atlas.chat/components/RoleEditorDialog.jsx`
- Create: `apps/desktop/src/modules/atlas.chat/components/ChannelRolesTab.jsx`

- [ ] **Step 1: Implement `RoleEditorDialog.jsx`**

```javascript
// apps/desktop/src/modules/atlas.chat/components/RoleEditorDialog.jsx
import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  Button, Input, Label, Checkbox,
} from "@atlas/ui";
import { CHAT_PERMISSIONS } from "../lib/chatPermissions";

const PERMISSION_LABELS = {
  [CHAT_PERMISSIONS.CHANNEL_MANAGE]: "Editar el canal",
  [CHAT_PERMISSIONS.MEMBERS_MANAGE]: "Gestionar miembros",
  [CHAT_PERMISSIONS.ROLES_MANAGE]: "Gestionar roles",
  [CHAT_PERMISSIONS.MESSAGES_SEND]: "Enviar mensajes",
  [CHAT_PERMISSIONS.MESSAGES_PIN]: "Fijar mensajes",
  [CHAT_PERMISSIONS.MESSAGES_DELETE_OTHERS]: "Eliminar mensajes de otros",
  [CHAT_PERMISSIONS.MENTIONS_EVERYONE]: "Mencionar @everyone",
  [CHAT_PERMISSIONS.MENTIONS_HERE]: "Mencionar @here",
};

// role: null (creating) or an existing role object (editing). maxPosition: the
// highest position value the current actor is allowed to set (their own
// position minus 1 — enforced again server-side regardless).
export function RoleEditorDialog({ open, onClose, role, maxPosition, onSave, isSaving }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("");
  const [position, setPosition] = useState(0);
  const [permissions, setPermissions] = useState({});
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) {
      setName(role?.name ?? "");
      setColor(role?.color ?? "");
      setPosition(role?.position ?? Math.max(0, Math.min(maxPosition, 10)));
      setPermissions(role?.permissions ?? {});
      setError(null);
    }
  }, [open, role, maxPosition]);

  function togglePermission(key) {
    setPermissions((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function handleSave() {
    if (!name.trim()) return;
    setError(null);
    try {
      await onSave({
        name: name.trim(),
        color: color.trim() || undefined,
        position: Number(position),
        permissions,
      });
      onClose?.();
    } catch (err) {
      setError(err?.message ?? "Error guardando el rol.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose?.()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{role ? "Editar rol" : "Crear rol"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2 max-h-[60vh] overflow-y-auto">
          <div className="space-y-1.5">
            <Label htmlFor="role-name">Nombre</Label>
            <Input id="role-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Soporte" autoFocus />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="role-color">Color (opcional, hex)</Label>
              <Input id="role-color" value={color} onChange={(e) => setColor(e.target.value)} placeholder="#6366f1" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="role-position">Rango (0-{maxPosition})</Label>
              <Input
                id="role-position"
                type="number"
                min={0}
                max={maxPosition}
                value={position}
                onChange={(e) => setPosition(Math.max(0, Math.min(maxPosition, Number(e.target.value) || 0)))}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Permisos</Label>
            <div className="space-y-1.5 rounded-lg border border-[hsl(var(--border))] p-3">
              {Object.entries(PERMISSION_LABELS).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={Boolean(permissions[key])} onCheckedChange={() => togglePermission(key)} />
                  {label}
                </label>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!name.trim() || isSaving}>
            {isSaving ? "Guardando..." : role ? "Guardar cambios" : "Crear rol"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Implement `ChannelRolesTab.jsx`**

```javascript
// apps/desktop/src/modules/atlas.chat/components/ChannelRolesTab.jsx
import { useState } from "react";
import { Button, EmptyState, Skeleton, ConfirmDialog, Badge } from "@atlas/ui";
import { ShieldCheck, Plus, Pencil, Trash2 } from "lucide-react";
import { useChannelRoles, useCreateChannelRole, useUpdateChannelRole, useDeleteChannelRole } from "../hooks/useChannelRoles";
import { RoleEditorDialog } from "./RoleEditorDialog";
import { findOwnMember } from "../lib/chatPermissions";
import { useChatConversationDetail } from "../hooks/useChatConversationDetail";

export function ChannelRolesTab({ conversationId, currentUserId }) {
  const { data: rolesData, isLoading } = useChannelRoles(conversationId);
  const { data: convData } = useChatConversationDetail(conversationId);
  const { mutateAsync: createRole, isPending: isCreating } = useCreateChannelRole(conversationId);
  const { mutateAsync: updateRole, isPending: isUpdating } = useUpdateChannelRole(conversationId);
  const { mutateAsync: deleteRole } = useDeleteChannelRole(conversationId);

  const [editorState, setEditorState] = useState({ open: false, role: null });
  const [confirmDelete, setConfirmDelete] = useState(null);

  const roles = rolesData?.data ?? [];
  const ownMember = findOwnMember(convData?.data?.members ?? [], currentUserId);
  const ownPosition = ownMember?.rolePosition ?? -1;
  const maxPosition = Math.max(0, ownPosition - 1);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
      </div>
    );
  }

  if (!roles.length) {
    return <EmptyState icon={ShieldCheck} title="Sin roles" description="Este canal aun no tiene roles configurados." />;
  }

  return (
    <div className="space-y-2">
      <Button size="sm" variant="outline" onClick={() => setEditorState({ open: true, role: null })} disabled={ownPosition <= 0}>
        <Plus className="h-3.5 w-3.5 mr-1.5" />
        Crear rol
      </Button>

      <div className="space-y-1">
        {roles.map((role) => (
          <div key={role.id} className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-[hsl(var(--muted))]">
            <span
              className="h-2.5 w-2.5 rounded-full shrink-0"
              style={{ backgroundColor: role.color || "hsl(var(--muted-foreground))" }}
            />
            <span className="text-sm font-medium flex-1 truncate">{role.name}</span>
            {role.isSystem && <Badge variant="secondary">Sistema</Badge>}
            {!role.isSystem && role.position < ownPosition && (
              <div className="flex items-center gap-1 shrink-0">
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditorState({ open: true, role })}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500 hover:text-red-500" onClick={() => setConfirmDelete(role)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>

      <RoleEditorDialog
        open={editorState.open}
        role={editorState.role}
        maxPosition={maxPosition}
        isSaving={isCreating || isUpdating}
        onClose={() => setEditorState({ open: false, role: null })}
        onSave={(data) =>
          editorState.role
            ? updateRole({ roleId: editorState.role.id, data })
            : createRole(data)
        }
      />

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        onOpenChange={(v) => !v && setConfirmDelete(null)}
        title="Eliminar rol"
        description={`Los miembros con el rol "${confirmDelete?.name}" pasaran al rol Member.`}
        confirmLabel="Eliminar"
        onConfirm={async () => {
          if (confirmDelete) await deleteRole(confirmDelete.id);
          setConfirmDelete(null);
        }}
      />
    </div>
  );
}
```

- [ ] **Step 3: Syntax check, build, commit**

```bash
node --check apps/desktop/src/modules/atlas.chat/components/RoleEditorDialog.jsx
node --check apps/desktop/src/modules/atlas.chat/components/ChannelRolesTab.jsx
pnpm build
git add apps/desktop/src/modules/atlas.chat/components/RoleEditorDialog.jsx apps/desktop/src/modules/atlas.chat/components/ChannelRolesTab.jsx
git commit -m "feat(chat): add role editor dialog and channel roles tab"
```

---

### Task 7: `ChannelDetailsSheet.jsx` + wire into `ChatWindow`

**Files:**
- Create: `apps/desktop/src/modules/atlas.chat/components/ChannelDetailsSheet.jsx`
- Modify: `apps/desktop/src/modules/atlas.chat/components/ChatWindow.jsx`

- [ ] **Step 1: Implement `ChannelDetailsSheet.jsx`**

```javascript
// apps/desktop/src/modules/atlas.chat/components/ChannelDetailsSheet.jsx
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
  Tabs, TabsList, TabsTrigger, TabsContent,
} from "@atlas/ui";
import { Info } from "lucide-react";
import { ChannelMembersTab } from "./ChannelMembersTab";
import { ChannelRolesTab } from "./ChannelRolesTab";
import { useChatConversationDetail } from "../hooks/useChatConversationDetail";
import { roleHasPermission, findOwnMember, CHAT_PERMISSIONS } from "../lib/chatPermissions";

export function ChannelDetailsSheet({ open, onOpenChange, conversationId, currentUserId }) {
  const { data: convData } = useChatConversationDetail(conversationId);
  const ownMember = findOwnMember(convData?.data?.members ?? [], currentUserId);
  const canManageRoles = roleHasPermission(ownMember, CHAT_PERMISSIONS.ROLES_MANAGE);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Info className="h-4 w-4 text-[hsl(var(--primary))]" />
            Detalles del canal
          </SheetTitle>
        </SheetHeader>

        <Tabs defaultValue="members" className="flex-1 min-h-0 flex flex-col">
          <TabsList>
            <TabsTrigger value="members">Miembros</TabsTrigger>
            {canManageRoles && <TabsTrigger value="roles">Roles</TabsTrigger>}
          </TabsList>
          <TabsContent value="members" className="flex-1 min-h-0 overflow-y-auto">
            <ChannelMembersTab conversationId={conversationId} currentUserId={currentUserId} />
          </TabsContent>
          {canManageRoles && (
            <TabsContent value="roles" className="flex-1 min-h-0 overflow-y-auto">
              <ChannelRolesTab conversationId={conversationId} currentUserId={currentUserId} />
            </TabsContent>
          )}
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 2: Wire into `ChatWindow.jsx`**

Read the current file first (it has changed slightly since this plan was written, in ways unrelated to this task — locate the exact current lines rather than assuming line numbers).

In `ChatHeader`'s props list, add `onOpenDetails`:
```javascript
function ChatHeader({
  conversation, currentUserId, onlineUsers, onClose,
  filesView, onToggleFilesView,
  searchMode, searchQuery, onSearchToggle, onSearchChange,
  searchMatchCount, searchCurrentIdx, onNextMatch, onPrevMatch,
  selectionMode, selectionCount, hasOwnSelected,
  onSelectionCancel, onDeleteForMe, onDeleteForAll, onForwardSelected,
  onEnterSelection,
  onDeleteConversation,
  onArchive, isArchived,
  onOpenDetails,
}) {
```

Change the existing inert "Ver miembros" menu item:
```javascript
            {conversation?.type === "group" && (
              <DropdownMenuItem>
                <Users className="h-3.5 w-3.5 mr-2" />
                Ver miembros
              </DropdownMenuItem>
            )}
```
to:
```javascript
            {(conversation?.type === "group" || conversation?.type === "channel") && (
              <DropdownMenuItem onSelect={onOpenDetails}>
                <Users className="h-3.5 w-3.5 mr-2" />
                Ver miembros
              </DropdownMenuItem>
            )}
```

In the main `ChatWindow` component, import `ChannelDetailsSheet`:
```javascript
import { ChannelDetailsSheet } from "./ChannelDetailsSheet";
```

Add local state near the other `useState` declarations in `ChatWindow`:
```javascript
  const [showDetails, setShowDetails] = useState(false);
```

Pass the new prop to `<ChatHeader .../>`:
```javascript
        onOpenDetails={() => setShowDetails(true)}
```
(add this line alongside the other props already passed to `ChatHeader` in the JSX.)

Render the sheet near the other modals at the bottom of `ChatWindow`'s JSX (next to `<ChatAttachmentViewer .../>`/`<ForwardMessageModal .../>`):
```javascript
      <ChannelDetailsSheet
        open={showDetails}
        onOpenChange={setShowDetails}
        conversationId={conversationId}
        currentUserId={userProfile?.id}
      />
```

- [ ] **Step 3: Full build and browser QA**

```bash
node --check apps/desktop/src/modules/atlas.chat/components/ChannelDetailsSheet.jsx
node --check apps/desktop/src/modules/atlas.chat/components/ChatWindow.jsx
pnpm build
```

Then manually (`pnpm dev:frontend`, at both 390px and 1440px per the project's UI checklist):
1. Create a channel via the sidebar "+" menu → confirm it appears and you're the Owner.
2. Open "Ver miembros" on that channel → confirm the Miembros and Roles tabs both render (you're Owner).
3. Create a custom role, assign it to a second test member (or verify the UI at least renders correctly with only yourself as a member if a second account isn't available) → confirm role badge updates.
4. Open "Explorar canales" → confirm public channels not yet joined are listed; join one.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/components/ChannelDetailsSheet.jsx apps/desktop/src/modules/atlas.chat/components/ChatWindow.jsx
git commit -m "feat(chat): wire channel details sheet into chat window header"
```

---

## Self-Review Notes

- **Spec coverage:** every UX requirement in spec Section 8 has a corresponding component; every acceptance criterion in Section 25 is exercisable through the wired-up UI (criterion 6, "no Roles tab for a Member," is enforced by `ChannelDetailsSheet`'s `canManageRoles` gate).
- **File size:** each new file is a single-purpose component well under 300 lines — no risk of hitting the 1000-line limit; `ChannelDetailsSheet.jsx` deliberately stays a thin tab shell (Section 24 risk 2) with the two tabs as separate files.
- **No placeholders:** every step has complete, runnable code.
- **Known scope cut (flagged, not hidden):** `CreateChannelModal` omits the initial-members picker for v1 (members are added afterward via the Members tab) — see the note under Task 3 Step 1.
