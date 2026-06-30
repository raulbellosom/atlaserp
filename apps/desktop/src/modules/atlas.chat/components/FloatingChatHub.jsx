import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  MessageSquare, X, Minus, ChevronUp,
  ExternalLink, FolderOpen, MoreVertical, Search, Plus,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useRealtimeContext } from "../../../providers/RealtimeProvider";
import { Skeleton, DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@atlas/ui";
import { useChatFloatStore } from "../store/chatFloatStore";
import { useChatMessages, useSendMessage, useMarkRead, useDeleteMessage } from "../hooks/useChatMessages";
import { useCreateConversation } from "../hooks/useCreateConversation";
import { atlas } from "../../../lib/atlas";
import { MessageComposer } from "./MessageComposer";
import { ChatMessageList } from "./ChatMessageList";
import { ChatAttachmentViewer } from "./ChatAttachmentViewer";
import { CreateChatModal } from "./CreateChatModal";
import { getConversationDisplayName } from "../lib/chatUtils";
import { useAuth } from "../../../auth/AuthProvider";
import { useGlobalPresence } from "../../../providers/RealtimeProvider";

const BS = 56;     // bubble size px
const BM = 16;     // margin from edge px
const WW = 300;    // mini-window width px
const WH = 380;    // mini-window height px
const WH_MIN = 44; // minimized height px
const GAP = 8;     // gap between elements px

function getAvatarUrl(conversation, currentUserId) {
  if (conversation.avatar_url) return conversation.avatar_url;
  if (conversation.type === "direct") {
    const other = (conversation.members ?? []).find((m) => m.userId !== currentUserId);
    return other?.avatarUrl ?? null;
  }
  return null;
}

function AvatarCircle({ avatarUrl, name, size = "md" }) {
  const [avatarErr, setAvatarErr] = useState(false);
  const sizeClass = size === "sm" ? "h-7 w-7 text-[10px]" : "h-8 w-8 text-xs";

  useEffect(() => { setAvatarErr(false); }, [avatarUrl]);

  if (avatarUrl && !avatarErr) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className={`${sizeClass} rounded-full object-cover shrink-0`}
        onError={() => setAvatarErr(true)}
      />
    );
  }
  return (
    <div
      className={`${sizeClass} rounded-full flex items-center justify-center font-bold shrink-0`}
      style={{ backgroundColor: "var(--brand-primary)", color: "var(--brand-primary-foreground)" }}
    >
      {name?.[0]?.toUpperCase() ?? "?"}
    </div>
  );
}

function BubbleAvatar({ avatarUrl, name }) {
  const [err, setErr] = useState(false);
  useEffect(() => { setErr(false); }, [avatarUrl]);
  if (avatarUrl && !err) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className="w-full h-full object-cover"
        onError={() => setErr(true)}
      />
    );
  }
  return <MessageSquare className="h-6 w-6" />;
}

// --- Mini chat window (desktop) ---

function MiniChatWindow({ entry, index, edge, zIndex = 45, onClose, onMinimize }) {
  const { id, conversation, minimized } = entry;
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const { data, isLoading, hasMore, isLoadingMore, loadMore } = useChatMessages(id);
  const { mutateAsync: send } = useSendMessage(id);
  const { mutate: markRead } = useMarkRead(id);
  const { mutate: deleteMessageMutate } = useDeleteMessage(id);
  const markReadRef = useRef(markRead);
  markReadRef.current = markRead;

  const composerRef = useRef(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [viewer, setViewer] = useState({ open: false, attachments: [], activeIndex: 0 });
  const [hiddenMsgIds, setHiddenMsgIds] = useState(() => new Set());

  useEffect(() => { if (!minimized) markReadRef.current(); }, [id, minimized]);

  const name = getConversationDisplayName(conversation, userProfile?.id);
  const avatarUrl = getAvatarUrl(conversation, userProfile?.id);
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
            title={name}
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
            <AvatarCircle avatarUrl={avatarUrl} name={name} size="sm" />
            <p className="flex-1 text-xs font-semibold truncate">{name}</p>
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
              <AvatarCircle avatarUrl={avatarUrl} name={name} size="sm" />
              <p className="flex-1 text-xs font-semibold truncate">{name}</p>
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

        {!minimized && (
          <>
            <ChatMessageList
              messages={data?.data ?? []}
              isLoading={isLoading}
              currentUserId={userProfile?.id}
              typingUsers={[]}
              onAttachmentClick={handleAttachmentClick}
              members={conversation.members}
              hasMore={hasMore}
              isLoadingMore={isLoadingMore}
              onLoadMore={loadMore}
              onDeleteMessage={(msgId) => deleteMessageMutate(msgId)}
              onHideForMe={(msgId) => setHiddenMsgIds((prev) => { const n = new Set(prev); n.add(msgId); return n; })}
              onForward={() => { navigate(`/app/m/atlas.chat/chat/inbox/${id}`); onClose(); }}
              hiddenMessageIds={hiddenMsgIds}
            />
            <MessageComposer
              ref={composerRef}
              onSend={send}
              placeholder="Mensaje..."
              compact
              conversationId={id}
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

// --- Online user pill ---

function OnlineUserPill({ user, currentUserId, conversations, onOpen }) {
  const [avatarErr, setAvatarErr] = useState(false);
  const { mutateAsync: createConversation } = useCreateConversation();
  const { userProfile, session } = useAuth();
  const token = session?.access_token;

  async function handleClick() {
    // Find existing direct conversation with this user
    const existing = conversations.find(
      (c) =>
        c.type === "direct" &&
        (c.members ?? []).some((m) => m.userId === user.userId),
    );
    if (existing) {
      onOpen(existing);
      return;
    }
    // Create new direct conversation
    try {
      const result = await createConversation({
        type: "direct",
        memberIds: [user.userId],
      });
      if (result?.data) onOpen(result.data);
    } catch {}
  }

  const name = user.displayName ?? "Usuario";
  const avatarUrl = user.avatarUrl ?? null;
  const isCurrentUser = user.userId === currentUserId;
  if (isCurrentUser) return null;

  return (
    <button
      type="button"
      onClick={handleClick}
      title={name}
      className="flex flex-col items-center gap-1 shrink-0 w-14"
    >
      <div className="relative">
        {avatarUrl && !avatarErr ? (
          <img
            src={avatarUrl}
            alt={name}
            className="h-9 w-9 rounded-full object-cover"
            onError={() => setAvatarErr(true)}
          />
        ) : (
          <div
            className="h-9 w-9 rounded-full flex items-center justify-center font-bold text-xs"
            style={{ backgroundColor: "var(--brand-primary)", color: "var(--brand-primary-foreground)" }}
          >
            {name[0]?.toUpperCase() ?? "?"}
          </div>
        )}
        <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-[hsl(var(--card))]" />
      </div>
      <p className="text-[9px] font-medium text-[hsl(var(--foreground))] truncate w-full text-center leading-tight">
        {name.split(" ")[0]}
      </p>
    </button>
  );
}

// --- Conversation picker panel ---

function ConversationPanel({ conversations, externalConversations, isLoading, edge, bottomPx, zIndex = 45, currentUserId }) {
  const { openChat, close } = useChatFloatStore();
  const navigate = useNavigate();
  const { onlineUsers } = useGlobalPresence();
  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const searchRef = useRef(null);

  const onlineList = useMemo(
    () => Object.values(onlineUsers ?? {}).filter((u) => u.userId !== currentUserId),
    [onlineUsers, currentUserId],
  );

  const filteredConversations = useMemo(() => {
    if (!search.trim()) return conversations;
    const q = search.toLowerCase();
    return conversations.filter((c) => {
      const name = getConversationDisplayName(c, currentUserId).toLowerCase();
      return name.includes(q) || c.last_message?.body?.toLowerCase().includes(q);
    });
  }, [conversations, search, currentUserId]);

  const filteredExternal = useMemo(() => {
    if (!search.trim()) return externalConversations;
    const q = search.toLowerCase();
    return externalConversations.filter((c) => {
      const name = (c.guest_name ?? c.guest_email ?? "").toLowerCase();
      return name.includes(q) || c.last_message?.body?.toLowerCase().includes(q) || (c.tracking_code ?? "").toLowerCase().includes(q);
    });
  }, [externalConversations, search]);

  function handleSelect(conv) {
    if (isMobile) {
      navigate(`/app/m/atlas.chat/chat/inbox/${conv.id}`);
      close();
    } else {
      openChat(conv);
    }
  }

  function handleSelectExternal() {
    navigate("/app/m/atlas.chat/chat/external");
    close();
  }

  function handleViewAll() {
    navigate("/app/m/atlas.chat/chat/inbox");
    close();
  }

  function handleCreated(conv) {
    if (conv?.id) {
      if (isMobile) {
        navigate(`/app/m/atlas.chat/chat/inbox/${conv.id}`);
      } else {
        openChat(conv);
      }
      close();
    }
  }

  const offset = BM + BS + GAP;
  const clampedBottom = Math.max(BM, bottomPx);
  const hasExternal = filteredExternal.length > 0;

  return (
    <>
      <div
        style={{ position: "fixed", [edge]: offset, bottom: clampedBottom, width: 272, zIndex, maxHeight: "calc(100dvh - 80px)" }}
        className="rounded-xl shadow-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden flex flex-col"
      >
        {/* Search + new conversation header */}
        <div className="flex items-center gap-1.5 px-2.5 py-2 border-b border-[hsl(var(--border))]">
          <div className="flex-1 flex items-center gap-1.5 bg-[hsl(var(--muted))] rounded-lg px-2 py-1.5">
            <Search className="h-3 w-3 text-[hsl(var(--muted-foreground))] shrink-0" />
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar conversacion..."
              className="flex-1 bg-transparent text-[11px] outline-none placeholder:text-[hsl(var(--muted-foreground))] min-w-0"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="shrink-0 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] touch-manipulation"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            title="Nueva conversacion"
            className="shrink-0 h-8 w-8 rounded-lg flex items-center justify-center bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:opacity-90 transition-opacity touch-manipulation"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        {/* Online users — hidden when searching */}
        {onlineList.length > 0 && !search && (
          <div className="px-3 pt-2.5 pb-2 border-b border-[hsl(var(--border))]">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))] mb-2">
              En linea
            </p>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {onlineList.map((user) => (
                <OnlineUserPill
                  key={user.userId}
                  user={user}
                  currentUserId={currentUserId}
                  conversations={conversations}
                  onOpen={(conv) => { handleSelect(conv); }}
                />
              ))}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto overscroll-contain">
          {/* External conversations section */}
          {hasExternal && (
            <>
              <div className="px-3 py-1.5 sticky top-0 bg-[hsl(var(--card))] border-b border-[hsl(var(--border))]">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                    Bandeja externa
                  </p>
                  <button
                    type="button"
                    onClick={handleSelectExternal}
                    className="text-[10px] text-[hsl(var(--primary))] hover:underline touch-manipulation"
                  >
                    Ver todas
                  </button>
                </div>
              </div>
              {filteredExternal.slice(0, 3).map((conv) => {
                const name = conv.guest_name ?? conv.guest_email ?? "Visitante";
                const unread = conv.unread_count ?? 0;
                return (
                  <button
                    key={conv.id}
                    type="button"
                    onClick={handleSelectExternal}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-[hsl(var(--muted))] active:bg-[hsl(var(--muted))] transition-colors text-left touch-manipulation"
                  >
                    <div className="relative shrink-0">
                      <div className="h-8 w-8 rounded-full bg-violet-100 dark:bg-violet-900 flex items-center justify-center text-xs font-semibold text-violet-600 dark:text-violet-300 uppercase">
                        {name[0]}
                      </div>
                      {unread > 0 && (
                        <span className="absolute -top-1 -right-1 h-4 min-w-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center px-1 ring-1 ring-[hsl(var(--card))]">
                          {unread > 99 ? "99+" : unread}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={["text-xs truncate", unread > 0 ? "font-semibold" : "font-medium"].join(" ")}>{name}</p>
                      {conv.last_message?.body ? (
                        <p className={["text-[10px] truncate", unread > 0 ? "text-[hsl(var(--foreground))]" : "text-[hsl(var(--muted-foreground))]"].join(" ")}>
                          {conv.last_message.body}
                        </p>
                      ) : (
                        <p className="text-[10px] text-violet-400">Conversacion activa</p>
                      )}
                    </div>
                  </button>
                );
              })}
              {filteredExternal.length > 3 && (
                <button
                  type="button"
                  onClick={handleSelectExternal}
                  className="w-full px-3 py-2 text-[10px] text-[hsl(var(--primary))] hover:bg-[hsl(var(--muted))] transition-colors text-center touch-manipulation"
                >
                  +{filteredExternal.length - 3} mas en bandeja externa
                </button>
              )}
              <div className="border-b border-[hsl(var(--border))]" />
            </>
          )}

          {/* Recent internal conversations */}
          <div className="px-3 py-1.5 sticky top-0 bg-[hsl(var(--card))]">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
              Mensajes recientes
            </p>
          </div>

          {isLoading && (
            <div className="p-3 space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-2">
                  <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-2.5 w-3/4 rounded" />
                    <Skeleton className="h-2 w-1/2 rounded" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!isLoading && !filteredConversations.length && (
            <p className="text-xs text-[hsl(var(--muted-foreground))] p-4 text-center">
              {search ? "Sin resultados." : "Sin conversaciones"}
            </p>
          )}

          {filteredConversations.map((conv) => {
            const name = getConversationDisplayName(conv, currentUserId);
            const avatarUrl = getAvatarUrl(conv, currentUserId);
            return (
              <button
                key={conv.id}
                type="button"
                onClick={() => handleSelect(conv)}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-[hsl(var(--muted))] active:bg-[hsl(var(--muted))] transition-colors text-left touch-manipulation"
              >
                <AvatarCircle avatarUrl={avatarUrl} name={name} size="md" />
                <div className="flex-1 min-w-0">
                  <p className={["text-xs truncate", conv.unread_count > 0 ? "font-semibold" : "font-medium"].join(" ")}>{name}</p>
                  {conv.last_message?.body && (
                    <p className={["text-[10px] truncate", conv.unread_count > 0 ? "text-[hsl(var(--foreground))]" : "text-[hsl(var(--muted-foreground))]"].join(" ")}>
                      {conv.last_message.body}
                    </p>
                  )}
                </div>
                {conv.unread_count > 0 && (
                  <span className="h-4 min-w-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center px-1 shrink-0">
                    {conv.unread_count > 99 ? "99+" : conv.unread_count}
                  </span>
                )}
              </button>
            );
          })}

          {/* Footer */}
          <div className="border-t border-[hsl(var(--border))] mt-1">
            <button
              type="button"
              onClick={handleViewAll}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-3 text-xs font-medium text-[hsl(var(--primary))] hover:bg-[hsl(var(--muted))] transition-colors touch-manipulation"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Ver todos los chats
            </button>
          </div>
        </div>
      </div>

      <CreateChatModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={handleCreated}
      />
    </>
  );
}

// --- Hub inner ---

function FloatingChatHubInner() {
  const { session, userProfile } = useAuth();
  const { edge, yPx, isOpen, hidden, openChats, setPosition, toggle, close, closeChat, toggleMinimize, hide } =
    useChatFloatStore();
  const queryClient = useQueryClient();
  const { on } = useRealtimeContext();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["chat-conversations"],
    queryFn: () => atlas.chat.listConversations({}, session?.access_token),
    enabled: Boolean(session?.access_token),
    staleTime: 30_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
  const conversations = data?.data ?? [];
  const totalUnread = conversations.reduce((sum, c) => sum + (c.unread_count ?? 0), 0);

  const { data: externalData } = useQuery({
    queryKey: ["chat-external-inbox-bubble"],
    queryFn: () => atlas.chat.listExternalInbox({ status: "open" }, session?.access_token),
    enabled: Boolean(session?.access_token),
    staleTime: 30_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
  const externalConversations = externalData?.data ?? [];

  // Invalidate immediately on new messages so the badge updates in real time
  useEffect(() => {
    const unsub1 = on("chat.message.new", () => {
      queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
    });
    const unsub2 = on("external_message", () => {
      queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
      queryClient.invalidateQueries({ queryKey: ["chat-external-inbox-bubble"] });
    });
    const unsub3 = on("new_external_conversation", () => {
      queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
      queryClient.invalidateQueries({ queryKey: ["chat-external-inbox-bubble"] });
    });
    return () => { unsub1(); unsub2(); unsub3(); };
  }, [on, queryClient]);

  const effectiveY = yPx ?? Math.round(window.innerHeight * 0.75);
  const isMobile = window.innerWidth < 640;
  const maxWins = isMobile ? 0 : 3;

  const isDragRef = useRef(false);
  const dragStartRef = useRef(null);
  const [dragPos, setDragPos] = useState(null);
  const [overDropZone, setOverDropZone] = useState(false);
  const panelRef = useRef(null);

  // Drop zone center — bottom-center of the viewport
  const dropZoneCenterX = window.innerWidth / 2;
  const dropZoneCenterY = window.innerHeight - 52;
  const DROP_RADIUS = 44;

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => { if (e.key === "Escape") toggle(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, toggle]);

  useEffect(() => {
    if (!isOpen) return;
    const onDown = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) toggle();
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [isOpen, toggle]);

  const handlePointerDown = useCallback(
    (e) => {
      e.stopPropagation();
      e.preventDefault();
      isDragRef.current = false;
      dragStartRef.current = { x: e.clientX, y: e.clientY, type: e.pointerType };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [],
  );

  const handlePointerMove = useCallback((e) => {
    if (!dragStartRef.current) return;
    const threshold = dragStartRef.current.type === "touch" ? 12 : 6;
    const dx = Math.abs(e.clientX - dragStartRef.current.x);
    const dy = Math.abs(e.clientY - dragStartRef.current.y);
    if (dx > threshold || dy > threshold) {
      isDragRef.current = true;
      setDragPos({ x: e.clientX, y: e.clientY });
      const dist = Math.hypot(e.clientX - dropZoneCenterX, e.clientY - dropZoneCenterY);
      setOverDropZone(dist < DROP_RADIUS);
    }
  }, [dropZoneCenterX, dropZoneCenterY]);

  const handlePointerUp = useCallback(
    (e) => {
      if (!dragStartRef.current) return;
      if (isDragRef.current) {
        const dist = Math.hypot(e.clientX - dropZoneCenterX, e.clientY - dropZoneCenterY);
        if (dist < DROP_RADIUS) {
          hide();
        } else {
          const newEdge = e.clientX > window.innerWidth / 2 ? "right" : "left";
          const clampedY = Math.max(
            60,
            Math.min(e.clientY - BS / 2, window.innerHeight - BS - BM * 2),
          );
          setPosition(newEdge, clampedY);
        }
        setDragPos(null);
        setOverDropZone(false);
      } else {
        toggle();
      }
      isDragRef.current = false;
      dragStartRef.current = null;
    },
    [setPosition, toggle, hide, dropZoneCenterX, dropZoneCenterY],
  );

  const handlePointerCancel = useCallback(() => {
    isDragRef.current = false;
    dragStartRef.current = null;
    setDragPos(null);
    setOverDropZone(false);
  }, []);

  if (isError || hidden) return null;

  // z-45: above sidebar (z-40) but below Dialog overlay (z-50)
  const Z_BUBBLE = 45;
  const Z_WIN    = 45;
  const Z_PANEL  = 45;

  const bubbleStyle = dragPos
    ? { position: "fixed", left: dragPos.x - BS / 2, top: dragPos.y - BS / 2, zIndex: Z_BUBBLE }
    : { position: "fixed", [edge]: BM, top: effectiveY, zIndex: Z_BUBBLE };

  // Panel anchors its bottom to the bubble's bottom edge so it's always adjacent
  const panelBottomPx = window.innerHeight - effectiveY - BS;

  return createPortal(
    <>
      {openChats.slice(0, maxWins).map((entry, i) => {
        const freshConv = conversations.find((c) => c.id === entry.id);
        const liveEntry = freshConv ? { ...entry, conversation: freshConv } : entry;
        return (
          <MiniChatWindow
            key={entry.id}
            entry={liveEntry}
            index={i}
            edge={edge}
            zIndex={Z_WIN}
            onClose={() => closeChat(entry.id)}
            onMinimize={() => toggleMinimize(entry.id)}
          />
        );
      })}

      {isOpen && (
        <div ref={panelRef} onPointerDown={(e) => e.stopPropagation()}>
          <ConversationPanel
            conversations={conversations}
            externalConversations={externalConversations}
            isLoading={isLoading}
            edge={edge}
            bottomPx={panelBottomPx}
            zIndex={Z_PANEL}
            currentUserId={userProfile?.id}
          />
        </div>
      )}

      {/* Drag-to-close drop zone — appears at bottom-center while dragging */}
      {dragPos && (
        <div
          style={{
            position: "fixed",
            bottom: 16,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: Z_BUBBLE - 1,
            pointerEvents: "none",
          }}
          className="flex flex-col items-center gap-1"
        >
          <div
            className={[
              "flex items-center justify-center rounded-full transition-all duration-150",
              overDropZone
                ? "h-16 w-16 bg-red-500/90 shadow-lg shadow-red-500/40 scale-110"
                : "h-12 w-12 bg-black/50 backdrop-blur-sm",
            ].join(" ")}
          >
            <X className={["text-white transition-all duration-150", overDropZone ? "h-7 w-7" : "h-5 w-5"].join(" ")} />
          </div>
          <span className={["text-white text-[10px] font-medium drop-shadow transition-opacity duration-150", overDropZone ? "opacity-100" : "opacity-60"].join(" ")}>
            Ocultar chat
          </span>
        </div>
      )}

      <div style={bubbleStyle}>
        <button
          type="button"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          style={{ touchAction: "none" }}
          className={[
            "h-14 w-14 rounded-full shadow-xl flex items-center justify-center relative",
            "cursor-grab select-none",
            dragPos ? "scale-110 shadow-2xl" : "transition-transform active:scale-95",
            userProfile?.avatarUrl ? "bg-[hsl(var(--muted))]" : "bg-(--brand-primary) text-white",
            isOpen ? "ring-2 ring-white/30" : "",
          ].join(" ")}
        >
          <div className="h-full w-full rounded-full flex items-center justify-center overflow-hidden">
            <BubbleAvatar avatarUrl={userProfile?.avatarUrl} name={userProfile?.displayName} />
          </div>
          {totalUnread > 0 && (
            <span className="absolute -top-1.5 -right-1.5 h-5 min-w-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1 shadow-md pointer-events-none ring-2 ring-[hsl(var(--background))]">
              {totalUnread > 99 ? "99+" : totalUnread}
            </span>
          )}
        </button>
      </div>
    </>,
    document.body,
  );
}

export function FloatingChatHub() {
  const { session } = useAuth();
  if (!session) return null;
  return <FloatingChatHubInner />;
}
