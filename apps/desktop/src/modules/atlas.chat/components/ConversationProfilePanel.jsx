// apps/desktop/src/modules/atlas.chat/components/ConversationProfilePanel.jsx
import { useState } from "react";
import { ArrowLeft, Info, FolderOpen, Users, Bell, Settings, Shield } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@atlas/ui";
import { ChannelGeneralTab } from "./ChannelGeneralTab";
import { ChannelMembersTab } from "./ChannelMembersTab";
import { ChannelRolesTab } from "./ChannelRolesTab";
import { ConversationInfoTab } from "./ConversationInfoTab";
import { ConversationMediaTab } from "./ConversationMediaTab";
import { GroupsInCommonTab } from "./GroupsInCommonTab";
import { NotificationsTab } from "./NotificationsTab";
import { useChatConversationDetail } from "../hooks/useChatConversationDetail";
import { roleHasPermission, findOwnMember, CHAT_PERMISSIONS } from "../lib/chatPermissions";
import { getConversationDisplayName } from "../lib/chatUtils";
import { useGlobalPresence } from "../../../providers/RealtimeProvider";

// Replaces ChatMembersPanel — same swap-into-content-slot contract (root
// carries flex-1/min-h-0/flex-col/overflow-hidden so it fills ChatWindow's
// or MiniChatWindow's content area identically to the message list it
// replaces), but now handles every conversation type, not just group/
// channel. Tab set is type-dependent per spec Section 8.
//
// `initialTab` lets a caller open straight to a specific tab (e.g. the
// "Ver miembros" dropdown item and MemberAvatarStack both want "members",
// not whatever the default tab is) — the CALLER must remount this component
// when initialTab changes (e.g. `<ConversationProfilePanel key={initialTab} .../>`),
// since a plain uncontrolled `Tabs defaultValue` only reads its initial value
// once and won't react to a prop change after mount otherwise.
//
// `onBack` renders an explicit "back to messages" row above the tabs — this
// was the other half of the user's complaint: the only way back used to be
// remembering that the same header icon that opened the panel also closes
// it, which wasn't discoverable.
//
// `messages`/`isLoadingMessages` come from the caller's own already-mounted
// useChatMessages(conversationId) call — never call that hook a second time
// here, it would open a second Supabase Realtime subscription for the same
// conversation and silently kill the caller's own live updates.
export function ConversationProfilePanel({ conversation, currentUserId, initialTab, onBack, messages, isLoadingMessages }) {
  const conversationId = conversation?.id;
  const type = conversation?.type;
  const { data: convData } = useChatConversationDetail(conversationId);
  const detail = convData?.data ?? conversation;
  // is_muted only ever comes from `conversation` (the listConversations row) —
  // getConversation's own `SELECT c.*` never joins the per-member muted_at the
  // way listConversations does, so `detail.is_muted` is always undefined here.
  const isMuted = Boolean(conversation?.is_muted);

  const { isUserOnline, getLastSeen } = useGlobalPresence();
  const displayName = getConversationDisplayName(conversation, currentUserId);
  const otherMemberForHero = type === "direct"
    ? (detail?.members ?? conversation?.members ?? []).find((m) => m.userId !== currentUserId)
    : null;
  const heroAvatarUrl = conversation?.avatarUrl ?? otherMemberForHero?.avatarUrl ?? null;
  const heroAvatarEmoji = conversation?.avatar_emoji ?? null;
  const memberCount = (detail?.members ?? conversation?.members ?? []).length;
  let statusLine;
  if (type === "direct") {
    const online = otherMemberForHero ? isUserOnline(otherMemberForHero.userId) : false;
    const lastSeen = otherMemberForHero ? getLastSeen(otherMemberForHero.userId) : null;
    statusLine = online
      ? "En linea"
      : lastSeen
        ? `Visto ${lastSeen.toLocaleString("es-MX", { hour: "2-digit", minute: "2-digit" })}`
        : "Desconectado";
  } else {
    statusLine = `${memberCount} ${memberCount === 1 ? "miembro" : "miembros"}`;
  }
  const [avatarErr, setAvatarErr] = useState(false);

  const backHeader = (
    <div className="flex items-center gap-2 px-3 pt-2 pb-1.5 border-b border-[hsl(var(--border))] shrink-0">
      <button
        type="button"
        onClick={onBack}
        title="Volver a mensajes"
        className="h-7 w-7 flex items-center justify-center rounded-lg text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors touch-manipulation"
      >
        <ArrowLeft className="h-4 w-4" />
      </button>
      <p className="text-sm font-semibold">Perfil</p>
    </div>
  );

  const hero = (
    <div className="flex flex-col items-center gap-2 px-4 py-5 text-center">
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
      <p className="chat-font-display text-lg font-bold">{displayName}</p>
      <p className="text-xs text-[hsl(var(--muted-foreground))]">{statusLine}</p>
    </div>
  );

  if (type === "direct") {
    return (
      <Tabs defaultValue={initialTab ?? "info"} className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {backHeader}
        {hero}
        <TabsList className="chat-glass mx-3 mt-1 mb-2 rounded-full p-1 overflow-x-auto">
          <TabsTrigger value="info" className="rounded-full! data-[state=active]:bg-[hsl(var(--primary)/0.15)]! data-[state=active]:text-[hsl(var(--primary))]!"><Info className="h-3.5 w-3.5 mr-1.5" />Info</TabsTrigger>
          <TabsTrigger value="media" className="rounded-full! data-[state=active]:bg-[hsl(var(--primary)/0.15)]! data-[state=active]:text-[hsl(var(--primary))]!"><FolderOpen className="h-3.5 w-3.5 mr-1.5" />Media</TabsTrigger>
          <TabsTrigger value="common" className="rounded-full! data-[state=active]:bg-[hsl(var(--primary)/0.15)]! data-[state=active]:text-[hsl(var(--primary))]!"><Users className="h-3.5 w-3.5 mr-1.5" />En comun</TabsTrigger>
          <TabsTrigger value="notifications" className="rounded-full! data-[state=active]:bg-[hsl(var(--primary)/0.15)]! data-[state=active]:text-[hsl(var(--primary))]!"><Bell className="h-3.5 w-3.5 mr-1.5" />Notificaciones</TabsTrigger>
        </TabsList>
        <TabsContent value="info" className="flex-1 min-h-0 overflow-y-auto">
          <ConversationInfoTab
            conversationId={conversationId}
            otherUserId={otherMemberForHero?.userId}
            otherDisplayName={otherMemberForHero?.displayName}
          />
        </TabsContent>
        <TabsContent value="media" className="flex-1 min-h-0 overflow-y-auto">
          <ConversationMediaTab messages={messages} isLoading={isLoadingMessages} />
        </TabsContent>
        <TabsContent value="common" className="flex-1 min-h-0 overflow-y-auto">
          <GroupsInCommonTab otherUserId={otherMemberForHero?.userId} />
        </TabsContent>
        <TabsContent value="notifications" className="flex-1 min-h-0 overflow-y-auto">
          <NotificationsTab conversationId={conversationId} isMuted={isMuted} />
        </TabsContent>
      </Tabs>
    );
  }

  // group / channel
  const ownMember = findOwnMember(detail?.members ?? [], currentUserId);
  const canManageRoles = roleHasPermission(ownMember, CHAT_PERMISSIONS.ROLES_MANAGE);

  return (
    <Tabs defaultValue={initialTab ?? "general"} className="flex-1 min-h-0 flex flex-col overflow-hidden">
      {backHeader}
      {hero}
      <TabsList className="chat-glass mx-3 mt-1 mb-2 rounded-full p-1 overflow-x-auto">
        <TabsTrigger value="general" className="rounded-full! data-[state=active]:bg-[hsl(var(--primary)/0.15)]! data-[state=active]:text-[hsl(var(--primary))]!"><Settings className="h-3.5 w-3.5 mr-1.5" />General</TabsTrigger>
        <TabsTrigger value="members" className="rounded-full! data-[state=active]:bg-[hsl(var(--primary)/0.15)]! data-[state=active]:text-[hsl(var(--primary))]!"><Users className="h-3.5 w-3.5 mr-1.5" />Miembros</TabsTrigger>
        {canManageRoles && <TabsTrigger value="roles" className="rounded-full! data-[state=active]:bg-[hsl(var(--primary)/0.15)]! data-[state=active]:text-[hsl(var(--primary))]!"><Shield className="h-3.5 w-3.5 mr-1.5" />Roles</TabsTrigger>}
        <TabsTrigger value="media" className="rounded-full! data-[state=active]:bg-[hsl(var(--primary)/0.15)]! data-[state=active]:text-[hsl(var(--primary))]!"><FolderOpen className="h-3.5 w-3.5 mr-1.5" />Media</TabsTrigger>
        <TabsTrigger value="notifications" className="rounded-full! data-[state=active]:bg-[hsl(var(--primary)/0.15)]! data-[state=active]:text-[hsl(var(--primary))]!"><Bell className="h-3.5 w-3.5 mr-1.5" />Notificaciones</TabsTrigger>
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
      <TabsContent value="media" className="flex-1 min-h-0 overflow-y-auto">
        <ConversationMediaTab messages={messages} isLoading={isLoadingMessages} />
      </TabsContent>
      <TabsContent value="notifications" className="flex-1 min-h-0 overflow-y-auto">
        <NotificationsTab conversationId={conversationId} isMuted={isMuted} />
      </TabsContent>
    </Tabs>
  );
}
