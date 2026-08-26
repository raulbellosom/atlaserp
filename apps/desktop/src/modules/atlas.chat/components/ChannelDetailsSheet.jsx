// apps/desktop/src/modules/atlas.chat/components/ChannelDetailsSheet.jsx
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
  Tabs, TabsList, TabsTrigger, TabsContent,
} from "@atlas/ui";
import { Info } from "lucide-react";
import { ChannelGeneralTab } from "./ChannelGeneralTab";
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
      </SheetContent>
    </Sheet>
  );
}
