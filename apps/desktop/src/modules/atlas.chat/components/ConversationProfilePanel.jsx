// apps/desktop/src/modules/atlas.chat/components/ConversationProfilePanel.jsx
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Info, FolderOpen, Users, Bell, Settings, Shield, CalendarDays } from "lucide-react";
import { ImageViewer } from "@atlas/ui";
import { ChannelGeneralTab } from "./ChannelGeneralTab";
import { ChannelMembersTab } from "./ChannelMembersTab";
import { ChannelRolesTab } from "./ChannelRolesTab";
import { ConversationInfoTab } from "./ConversationInfoTab";
import { ConversationMediaTab } from "./ConversationMediaTab";
import { ChannelEventsTab } from "./ChannelEventsTab";
import { GroupsInCommonTab } from "./GroupsInCommonTab";
import { NotificationsTab } from "./NotificationsTab";
import { useChatConversationDetail } from "../hooks/useChatConversationDetail";
import { roleHasPermission, findOwnMember, CHAT_PERMISSIONS } from "../lib/chatPermissions";
import { getConversationDisplayName } from "../lib/chatUtils";
import { useGlobalPresence } from "../../../providers/RealtimeProvider";
import { atlas } from "../../../lib/atlas";
import { useAuth } from "../../../auth/AuthProvider";

function SectionHeader({ icon: Icon, label }) {
  return (
    <div className="flex items-center gap-2 px-4 pt-4 pb-2">
      <Icon className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
        {label}
      </p>
    </div>
  );
}

// Replaces ChatMembersPanel — same swap-into-content-slot contract (root
// carries flex-1/min-h-0/flex-col/overflow-hidden so it fills ChatWindow's
// or MiniChatWindow's content area identically to the message list it
// replaces), but now handles every conversation type, not just group/
// channel. Renders a single flat scrollable column of stacked sections
// (no tabs) — section set is type-dependent per spec Section 8.
//
// `initialTab` lets a caller open straight to a specific section (e.g. the
// "Ver miembros" dropdown item and MemberAvatarStack both want "members")
// by scrolling it into view on mount — the CALLER must remount this
// component when initialTab changes (e.g. `<ConversationProfilePanel key={initialTab} .../>`),
// since the scroll-into-view effect only runs once per mount.
//
// `onBack` renders an explicit "back to messages" row above the sections —
// this was the other half of the user's complaint: the only way back used
// to be remembering that the same header icon that opened the panel also
// closes it, which wasn't discoverable.
//
// `messages`/`isLoadingMessages` come from the caller's own already-mounted
// useChatMessages(conversationId) call — never call that hook a second time
// here, it would open a second Supabase Realtime subscription for the same
// conversation and silently kill the caller's own live updates.
export function ConversationProfilePanel({ conversation, currentUserId, initialTab, onBack, messages, isLoadingMessages, onShowAllFiles }) {
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
  const heroAvatarFileId = conversation?.avatar_file_id ?? otherMemberForHero?.avatarFileId ?? null;
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
  const [avatarViewerOpen, setAvatarViewerOpen] = useState(false);

  const { session } = useAuth();
  const { data: fullAvatarUrl } = useQuery({
    queryKey: ["chat-avatar-full-url", heroAvatarFileId],
    queryFn: async () => {
      const res = await atlas.files.getSignedUrl(heroAvatarFileId, session?.access_token, { variant: "full" });
      return res?.data?.signedUrl ?? null;
    },
    enabled: Boolean(avatarViewerOpen && heroAvatarFileId && session?.access_token),
    staleTime: 50 * 60 * 1000,
  });

  const scrollRef = useRef(null);

  useEffect(() => {
    if (!initialTab || !scrollRef.current) return;
    const target = scrollRef.current.querySelector(`[data-section="${initialTab}"]`);
    target?.scrollIntoView({ block: "start" });
  }, [initialTab]);

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
      {heroAvatarUrl && !avatarErr ? (
        <button
          type="button"
          onClick={() => setAvatarViewerOpen(true)}
          title="Ver foto de perfil"
          aria-label="Ver foto de perfil"
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
      <p className="chat-font-display text-lg font-bold truncate max-w-full">{displayName}</p>
      <p className="text-xs text-[hsl(var(--muted-foreground))]">{statusLine}</p>
    </div>
  );

  const avatarViewer = (
    <ImageViewer
      src={fullAvatarUrl ?? heroAvatarUrl}
      alt={displayName}
      open={avatarViewerOpen}
      onClose={() => setAvatarViewerOpen(false)}
    />
  );

  if (type === "direct") {
    return (
      <>
        {backHeader}
        {hero}
        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto">
          <div data-section="media">
            <SectionHeader icon={FolderOpen} label="Multimedia" />
            <ConversationMediaTab messages={messages} isLoading={isLoadingMessages} preview onShowAll={onShowAllFiles} />
          </div>
          <div data-section="common">
            <SectionHeader icon={Users} label="En comun" />
            <GroupsInCommonTab otherUserId={otherMemberForHero?.userId} />
          </div>
          <div data-section="notifications">
            <SectionHeader icon={Bell} label="Notificaciones" />
            <NotificationsTab conversationId={conversationId} isMuted={isMuted} />
          </div>
          <div data-section="info">
            <SectionHeader icon={Info} label="Zona de peligro" />
            <ConversationInfoTab
              conversationId={conversationId}
              otherUserId={otherMemberForHero?.userId}
              otherDisplayName={otherMemberForHero?.displayName}
            />
          </div>
        </div>
        {avatarViewer}
      </>
    );
  }

  // group / channel
  const ownMember = findOwnMember(detail?.members ?? [], currentUserId);
  const canManageRoles = roleHasPermission(ownMember, CHAT_PERMISSIONS.ROLES_MANAGE);

  return (
    <>
      {backHeader}
      {hero}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto">
        <div data-section="general">
          <SectionHeader icon={Settings} label="General" />
          <ChannelGeneralTab conversationId={conversationId} currentUserId={currentUserId} />
        </div>
        <div data-section="members">
          <SectionHeader icon={Users} label="Miembros" />
          <ChannelMembersTab conversationId={conversationId} currentUserId={currentUserId} />
        </div>
        {canManageRoles && (
          <div data-section="roles">
            <SectionHeader icon={Shield} label="Roles" />
            <ChannelRolesTab conversationId={conversationId} currentUserId={currentUserId} />
          </div>
        )}
        <div data-section="media">
          <SectionHeader icon={FolderOpen} label="Multimedia" />
          <ConversationMediaTab messages={messages} isLoading={isLoadingMessages} preview onShowAll={onShowAllFiles} />
        </div>
        <div data-section="events">
          <SectionHeader icon={CalendarDays} label="Eventos" />
          <ChannelEventsTab conversationId={conversationId} />
        </div>
        <div data-section="notifications">
          <SectionHeader icon={Bell} label="Notificaciones" />
          <NotificationsTab conversationId={conversationId} isMuted={isMuted} />
        </div>
      </div>
      {avatarViewer}
    </>
  );
}
