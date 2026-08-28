# Channel/group profile panel redesign

## Problem

`ConversationProfilePanel` for group/channel conversations is a single flat scroll of six stacked sections (General, Members, Roles, Media, Events, Notifications). This causes concrete UX problems:

- Member rows render an initial-letter circle only — `member.avatarUrl` is already resolved and returned by the backend (`chat-conversation-reads-service.js`) but never read by `ChannelMembersTab.jsx`.
- Roles management sits in the middle of the flat scroll, looks like a bare list, and is unavoidable clutter for members who do have `roles.manage`.
- Events is the 5th of 6 sections — effectively hidden below the fold.
- Clicking a member does nothing beyond an overflow menu (remove / assign role) — no path to message them directly.
- The channel `description` column exists (set at creation via `CreateChannelModal`) but is never displayed or editable afterward.

## Design

### 1. Two tabs

Replace the flat scroll with `Tabs`/`TabsList`/`TabsTrigger`/`TabsContent` (`@atlas/ui`, already used elsewhere) directly under the hero header:

- **Información** — channel settings, events, media, notifications.
- **Miembros y roles** — member list + role management.

Both tabs are visible to every group/channel member. Visibility of *role management specifically* (not the tab) stays gated by `roleHasPermission(ownMember, CHAT_PERMISSIONS.ROLES_MANAGE)`, matching the existing gate in `ConversationProfilePanel.jsx`.

### 2. Hero header: description

Under the member-count line, render `conversation.description` (from `detail.description`, already present in `getConversation`'s `SELECT c.*`) clamped to 2 lines (`line-clamp-2`) with a "Ver más / Ver menos" toggle that expands in place — never covers or shifts the tabs below.

### 3. Tab "Información" — content order

1. `ChannelGeneralTab` (existing: avatar/emoji upload, linked project, "Agendar reunión") — **plus a new description field**, editable under the same `canManage` (`CHANNEL_MANAGE`) gate as the image controls.
2. `ChannelEventsTab` — moved here, directly after channel settings (was previously 5th of 6 sections; now 2nd).
3. `ConversationMediaTab` (unchanged).
4. `NotificationsTab` (unchanged).

### 4. Tab "Miembros y roles" — content order

1. Member list (`ChannelMembersTab`, existing "Añadir miembros" button unchanged):
   - Each row shows the real avatar photo, reusing `AvatarCircle` (already exported from `MiniChatWindow.jsx`) instead of the hand-rolled initials circle.
   - Row is clickable (except the current user's own row) to open/create a DM with that member, reusing the same find-existing-or-create pattern `FloatingChatHub`'s `OnlineUserPill` already implements via `useCreateConversation`.
   - The overflow menu (assign role / remove member) is unchanged but its click must not also trigger the row's open-DM handler (`stopPropagation` on the trigger).
2. "Gestión de roles" — collapsed by default, inside a new `Accordion` component (see below). Only rendered when `canManageRoles` is true. Contains the existing `ChannelRolesTab` unchanged.

### 5. New `Accordion` component (`@atlas/ui`)

`@radix-ui/react-accordion` is already a dependency of `packages/ui` but has never been wrapped. Add `packages/ui/src/components/Accordion.jsx` (`Accordion`, `AccordionItem`, `AccordionTrigger`, `AccordionContent`) following the same thin-wrapper pattern as `Tabs.jsx` (glass styling, `cn` utility), export from `packages/ui/src/index.js`, and document it in `docs/ai-context/ame3-runtime-capabilities.md`'s component table.

### 6. Open-DM behavior differs by host

`ConversationProfilePanel` gains a new `onOpenConversation(conversation)` prop, threaded down to `ChannelMembersTab`. Each host supplies the right behavior for its own context:

- `ChatWindow.jsx` (full desktop, URL-routed): `navigate(\`/app/m/atlas.chat/chat/inbox/${conv.id}\`)`.
- `MiniChatWindow.jsx` (floating widget): `useChatFloatStore().openChat(conv)`.

### 7. Backend: description becomes editable

- `packages/validators/src/chat.js`: add `description: z.string().trim().max(2000).nullable().optional()` to `chatUpdateConversationSchema`.
- `apps/api/src/routes/chat/chat-service.js`: `updateConversation` gains a `hasDescription` branch mirroring the existing `hasTitle` one, gated by the same `channel.manage` permission check that already wraps the whole function for channel/group types.

## Out of scope

- Editing the channel title (still no UI path anywhere in this app — not part of this request).
- Any change to the Roles/permissions data model or the direct-conversation profile view (`type === "direct"` branch of `ConversationProfilePanel`).
- Search/filter within the member list.

## Testing

- `node --check` on every touched backend file.
- Existing `apps/api/src/routes/chat/__tests__/chat-service.test.js` pattern extended with a case asserting `description` appears in the `UPDATE` set fragment when provided.
- Manual QA in the running app at 390px and 1440px (light + dark): avatar photos render, member row opens a DM, roles accordion is collapsed by default and absent for a non-privileged member, description clamp/expand doesn't shift the tabs, events visible without scrolling past media/notifications.
