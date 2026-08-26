// apps/desktop/src/modules/atlas.chat/components/ChatMembersPanel.jsx
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@atlas/ui";
import { ChannelGeneralTab } from "./ChannelGeneralTab";
import { ChannelMembersTab } from "./ChannelMembersTab";
import { ChannelRolesTab } from "./ChannelRolesTab";
import { useChatConversationDetail } from "../hooks/useChatConversationDetail";
import { roleHasPermission, findOwnMember, CHAT_PERMISSIONS } from "../lib/chatPermissions";

// Renders member/role management directly in ChatWindow's main content slot
// (the same slot ChatFilesGallery swaps into), replacing the old
// ChannelDetailsSheet modal. No Sheet/SheetContent wrapper here — the Tabs
// root itself carries the same flex-1/min-h-0 top-level sizing classes
// ChatFilesGallery uses on its own top-level element, so both swapped views
// fill ChatWindow's content area identically. Unlike ChatFilesGallery (a
// single flat scrollable region), this panel has a fixed TabsList header
// with an independently scrolling body per tab, so it also needs
// flex/flex-col/overflow-hidden on the root to make that inner layout work.
export function ChatMembersPanel({ conversationId, currentUserId }) {
  const { data: convData } = useChatConversationDetail(conversationId);
  const ownMember = findOwnMember(convData?.data?.members ?? [], currentUserId);
  const canManageRoles = roleHasPermission(ownMember, CHAT_PERMISSIONS.ROLES_MANAGE);

  return (
    <Tabs defaultValue="general" className="flex-1 min-h-0 flex flex-col overflow-hidden">
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
  );
}
