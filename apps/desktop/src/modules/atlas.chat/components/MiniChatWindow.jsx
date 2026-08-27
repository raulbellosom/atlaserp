import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  X, Minus, ChevronUp,
  ExternalLink, FolderOpen, MoreVertical, User,
} from "lucide-react";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@atlas/ui";
import { useChatMessages, useSendMessage, useMarkRead, useDeleteMessage, usePinMessage, useToggleReaction } from "../hooks/useChatMessages";
import { useChatConversationDetail } from "../hooks/useChatConversationDetail";
import { MessageComposer } from "./MessageComposer";
import { ChatMessageList } from "./ChatMessageList";
import { ChatAttachmentViewer } from "./ChatAttachmentViewer";
import { ConversationProfilePanel } from "./ConversationProfilePanel";
import { getConversationDisplayName, getConversationTitleLabel } from "../lib/chatUtils";
import { ConversationTypeBadge } from "./ConversationTypeBadge";
import { useAuth } from "../../../auth/AuthProvider";

const BS = 56;     // bubble size px
const BM = 16;     // margin from edge px
const WW = 300;    // mini-window width px
const WH = 380;    // mini-window height px
const WH_MIN = 44; // minimized height px
const GAP = 8;     // gap between elements px

export function getAvatarUrl(conversation, currentUserId) {
  if (conversation.avatarUrl) return conversation.avatarUrl;
  if (conversation.type === "direct") {
    const other = (conversation.members ?? []).find((m) => m.userId !== currentUserId);
    return other?.avatarUrl ?? null;
  }
  return null;
}

export function getAvatarEmoji(conversation) {
  return conversation?.avatar_emoji ?? null;
}

export function AvatarCircle({ avatarUrl, avatarEmoji, type, name, size = "md" }) {
  const [avatarErr, setAvatarErr] = useState(false);
  const sizeClass = size === "sm" ? "h-7 w-7 text-[10px]" : "h-8 w-8 text-xs";

  useEffect(() => { setAvatarErr(false); }, [avatarUrl]);

  return (
    <div className="relative shrink-0">
      {avatarUrl && !avatarErr ? (
        <img
          src={avatarUrl}
          alt={name}
          className={`${sizeClass} rounded-full object-cover`}
          onError={() => setAvatarErr(true)}
        />
      ) : avatarEmoji ? (
        <div className={`${sizeClass} rounded-full flex items-center justify-center bg-[hsl(var(--muted))]`}>
          <span className="text-sm leading-none">{avatarEmoji}</span>
        </div>
      ) : (
        <div
          className={`${sizeClass} rounded-full flex items-center justify-center font-bold`}
          style={{ backgroundColor: "var(--brand-primary)", color: "var(--brand-primary-foreground)" }}
        >
          {name?.[0]?.toUpperCase() ?? "?"}
        </div>
      )}
      <ConversationTypeBadge type={type} />
    </div>
  );
}

// --- Mini chat window (desktop) ---

export function MiniChatWindow({ entry, index, edge, zIndex = 45, onClose, onMinimize }) {
  const { id, conversation, minimized } = entry;
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const { data, isLoading, hasMore, isLoadingMore, loadMore } = useChatMessages(id);
  const { mutateAsync: send } = useSendMessage(id);
  const { mutate: markRead } = useMarkRead(id);
  const { mutate: deleteMessageMutate } = useDeleteMessage(id);
  const { mutate: pinMutate } = usePinMessage(id);
  const { mutate: toggleReactionMutate } = useToggleReaction(id);
  // `conversation` here is whatever was passed to openChat() — usually the
  // list-preview shape (5-member slice, no role/permission fields). The
  // detail query is needed for messages.pin gating, same as ChatWindow.
  const { data: conversationDetail } = useChatConversationDetail(id);
  const detailMembers = conversationDetail?.data?.members ?? null;
  const markReadRef = useRef(markRead);
  markReadRef.current = markRead;

  const composerRef = useRef(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [viewer, setViewer] = useState({ open: false, attachments: [], activeIndex: 0 });
  const [hiddenMsgIds, setHiddenMsgIds] = useState(() => new Set());
  const [profileView, setProfileView] = useState(false);

  useEffect(() => { if (!minimized) markReadRef.current(); }, [id, minimized]);

  const name = getConversationDisplayName(conversation, userProfile?.id);
  const titleLabel = getConversationTitleLabel(conversation, userProfile?.id);
  const avatarUrl = getAvatarUrl(conversation, userProfile?.id);
  const avatarEmoji = getAvatarEmoji(conversation);
  const offset = BM + BS + GAP + index * (WW + GAP);

  const handleAttachmentClick = useCallback((attachments, activeIndex) => {
    setViewer({ open: true, attachments, activeIndex });
  }, []);

  function handleViewInChat() {
    navigate(`/app/m/atlas.chat/chat/inbox/${id}`);
    onClose();
  }

  function handleViewFiles() {
    navigate(`/app/m/atlas.chat/chat/inbox/${id}?view=files`);
    onClose();
  }

  function handleDragOver(e) {
    e.preventDefault();
    if (!minimized) setIsDragOver(true);
  }

  function handleDragLeave(e) {
    if (!e.currentTarget.contains(e.relatedTarget)) setIsDragOver(false);
  }

  function handleDrop(e) {
    e.preventDefault();
    setIsDragOver(false);
    if (minimized) return;
    const files = Array.from(e.dataTransfer.files);
    if (files.length) composerRef.current?.addFiles(files);
  }

  return (
    <>
      <div
        style={{
          position: "fixed",
          bottom: BM,
          width: WW,
          [edge]: offset,
          zIndex,
          height: minimized ? WH_MIN : WH,
          transition: "height 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
        className="rounded-xl shadow-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] flex flex-col overflow-hidden relative"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Drop overlay */}
        {isDragOver && !minimized && (
          <div className="absolute inset-0 z-20 flex items-center justify-center border-2 border-dashed border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.08)] pointer-events-none rounded-xl">
            <p className="text-xs font-medium text-[hsl(var(--primary))]">Suelta aqui</p>
          </div>
        )}

        {/* Header — two modes */}
        {minimized ? (
          <div
            role="button"
            tabIndex={0}
            title={titleLabel}
            onClick={onMinimize}
            onKeyDown={(e) => e.key === "Enter" && onMinimize()}
            className="group flex items-center gap-1.5 px-2.5 h-11 cursor-pointer select-none"
            style={conversation?.unread_count > 0 ? {
              borderLeft: "4px solid #ef4444",
              background: "rgba(239,68,68,0.10)",
            } : {
              borderLeft: "4px solid transparent",
            }}
          >
            <AvatarCircle avatarUrl={avatarUrl} avatarEmoji={avatarEmoji} type={conversation?.type} name={name} size="sm" />
            <p className="flex-1 text-xs font-semibold truncate">{titleLabel}</p>
            {conversation?.unread_count > 0 && (
              <span
                className="flex items-center justify-center font-bold shrink-0 group-hover:hidden"
                style={{
                  minWidth: "1rem", height: "1rem",
                  borderRadius: "9999px",
                  background: "#ef4444", color: "#fff",
                  fontSize: "9px", padding: "0 3px",
                }}
              >
                {conversation.unread_count > 99 ? "99+" : conversation.unread_count}
              </span>
            )}
            <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onMinimize(); }}
                className="h-6 w-6 flex items-center justify-center rounded text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors"
                title="Expandir"
              >
                <ChevronUp className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onClose(); }}
                className="h-6 w-6 flex items-center justify-center rounded text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors"
                title="Cerrar"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <div
            className="flex items-center gap-2 px-3 h-11 bg-[hsl(var(--surface-2))] border-b border-[hsl(var(--border))] shrink-0"
          >
            <button
              type="button"
              onClick={onMinimize}
              className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer select-none text-left"
            >
              <AvatarCircle avatarUrl={avatarUrl} avatarEmoji={avatarEmoji} type={conversation?.type} name={name} size="sm" />
              <p className="flex-1 text-xs font-semibold truncate">{titleLabel}</p>
            </button>
            <button
              type="button"
              onClick={() => setProfileView((v) => !v)}
              title={profileView ? "Ver mensajes" : "Ver perfil"}
              className={[
                "shrink-0 h-6 w-6 flex items-center justify-center rounded transition-colors touch-manipulation",
                profileView
                  ? "text-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.1)]"
                  : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]",
              ].join(" ")}
            >
              <User className="h-3 w-3" />
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => e.stopPropagation()}
                  className="shrink-0 h-6 w-6 flex items-center justify-center rounded text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors touch-manipulation"
                  title="Opciones"
                >
                  <MoreVertical className="h-3 w-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" style={{ zIndex: 10000 }}>
                <DropdownMenuItem onSelect={handleViewInChat}>
                  <ExternalLink className="h-3.5 w-3.5 mr-2" />
                  Ver conversacion en el chat
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={handleViewFiles}>
                  <FolderOpen className="h-3.5 w-3.5 mr-2" />
                  Ver todos los archivos
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <button
              type="button"
              onClick={onMinimize}
              className="shrink-0 h-6 w-6 flex items-center justify-center rounded text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors touch-manipulation"
              title="Minimizar"
            >
              <Minus className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 h-6 w-6 flex items-center justify-center rounded text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors touch-manipulation"
              title="Cerrar"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}

        {!minimized && profileView && (
          <ConversationProfilePanel
            conversation={conversation}
            currentUserId={userProfile?.id}
            initialTab={null}
            onBack={() => setProfileView(false)}
            messages={data?.data ?? []}
            isLoadingMessages={isLoading}
          />
        )}
        {!minimized && !profileView && (
          <>
            <ChatMessageList
              messages={data?.data ?? []}
              isLoading={isLoading}
              currentUserId={userProfile?.id}
              typingUsers={[]}
              onAttachmentClick={handleAttachmentClick}
              members={detailMembers ?? conversation.members}
              conversationType={conversation?.type}
              hasMore={hasMore}
              isLoadingMore={isLoadingMore}
              onLoadMore={loadMore}
              onDeleteMessage={(msgId) => deleteMessageMutate(msgId)}
              onHideForMe={(msgId) => setHiddenMsgIds((prev) => { const n = new Set(prev); n.add(msgId); return n; })}
              onForward={() => { navigate(`/app/m/atlas.chat/chat/inbox/${id}`); onClose(); }}
              hiddenMessageIds={hiddenMsgIds}
              onPinMessage={(messageId, pinned) => pinMutate({ messageId, pinned })}
              onToggleReaction={(messageId, emoji) => toggleReactionMutate({ messageId, emoji })}
            />
            <MessageComposer
              ref={composerRef}
              onSend={send}
              placeholder="Mensaje..."
              compact
              conversationId={id}
              conversationType={conversation?.type}
            />
          </>
        )}
      </div>

      <ChatAttachmentViewer
        open={viewer.open}
        onOpenChange={(open) => setViewer((v) => ({ ...v, open }))}
        attachments={viewer.attachments}
        activeIndex={viewer.activeIndex}
        onIndexChange={(i) => setViewer((v) => ({ ...v, activeIndex: i }))}
      />
    </>
  );
}
