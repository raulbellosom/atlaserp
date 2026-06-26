import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { MessageSquare, X, Minus, ChevronUp } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@atlas/ui";
import { useChatFloatStore } from "../store/chatFloatStore";
import { useChatMessages, useSendMessage, useMarkRead } from "../hooks/useChatMessages";
import { atlas } from "../../../lib/atlas";
import { MessageComposer } from "./MessageComposer";
import { ChatMessageList } from "./ChatMessageList";
import { ChatAttachmentViewer } from "./ChatAttachmentViewer";
import { getConversationDisplayName } from "../lib/chatUtils";
import { useAuth } from "../../../auth/AuthProvider";

const BS = 56;     // bubble size px
const BM = 16;     // margin from edge px
const WW = 300;    // mini-window width px
const WH = 380;    // mini-window height px
const WH_MIN = 44; // minimized height px
const GAP = 8;     // gap between elements px

function getFirstName(fullName) {
  if (!fullName) return "?";
  return fullName.split(" ")[0];
}

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
      className={`${sizeClass} rounded-full bg-[hsl(var(--primary))] text-white flex items-center justify-center font-bold shrink-0`}
    >
      {name?.[0]?.toUpperCase() ?? "?"}
    </div>
  );
}

// --- Mini chat window (desktop) ---

function MiniChatWindow({ entry, index, edge, onClose, onMinimize }) {
  const { id, conversation, minimized } = entry;
  const { userProfile } = useAuth();
  const { data, isLoading } = useChatMessages(id);
  const { mutateAsync: send } = useSendMessage(id);
  const { mutate: markRead } = useMarkRead(id);
  const markReadRef = useRef(markRead);
  markReadRef.current = markRead;

  const composerRef = useRef(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [viewer, setViewer] = useState({ open: false, attachments: [], activeIndex: 0 });

  useEffect(() => { markReadRef.current(); }, [id]);

  const name = getConversationDisplayName(conversation, userProfile?.id);
  const firstName = getFirstName(name);
  const avatarUrl = getAvatarUrl(conversation, userProfile?.id);
  const offset = BM + BS + GAP + index * (WW + GAP);

  const handleAttachmentClick = useCallback((attachments, activeIndex) => {
    setViewer({ open: true, attachments, activeIndex });
  }, []);

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
          zIndex: 9990,
          height: minimized ? WH_MIN : WH,
          transition: "height 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
        className="rounded-xl shadow-2xl border border-[hsl(var(--border))] bg-white dark:bg-[hsl(222_47%_5%)] flex flex-col overflow-hidden relative"
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
            className="group flex items-center gap-1.5 px-2.5 h-11 bg-[hsl(var(--surface-2))] cursor-pointer select-none"
          >
            <AvatarCircle avatarUrl={avatarUrl} name={name} size="sm" />
            <p className="flex-1 text-xs font-semibold truncate">{firstName}</p>
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
            role="button"
            tabIndex={0}
            onClick={onMinimize}
            onKeyDown={(e) => e.key === "Enter" && onMinimize()}
            className="flex items-center gap-2 px-3 h-11 bg-[hsl(var(--surface-2))] border-b border-[hsl(var(--border))] shrink-0 cursor-pointer select-none"
          >
            <AvatarCircle avatarUrl={avatarUrl} name={name} size="sm" />
            <p className="flex-1 text-xs font-semibold truncate">{name}</p>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onMinimize(); }}
              className="shrink-0 h-6 w-6 flex items-center justify-center rounded text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors touch-manipulation"
              title="Minimizar"
            >
              <Minus className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onClose(); }}
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

// --- Conversation picker panel ---

function ConversationPanel({ conversations, isLoading, edge, y, currentUserId }) {
  const { openChat } = useChatFloatStore();
  const navigate = useNavigate();
  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;

  function handleSelect(conv) {
    if (isMobile) {
      navigate("/app/m/atlas.chat/chat/inbox");
      useChatFloatStore.getState().close();
    } else {
      openChat(conv);
    }
  }

  const offset = BM + BS + GAP;
  const clampedTop = Math.max(60, Math.min(y, window.innerHeight - 340));

  return (
    <div
      style={{ position: "fixed", [edge]: offset, top: clampedTop, width: 240, zIndex: 9997 }}
      className="rounded-xl shadow-2xl border border-[hsl(var(--border))] bg-white dark:bg-[hsl(222_47%_6%)] overflow-hidden"
    >
      <div className="px-3 py-2.5 border-b border-[hsl(var(--border))]">
        <p className="text-xs font-semibold">Mensajes recientes</p>
      </div>

      <div className="overflow-y-auto" style={{ maxHeight: 280 }}>
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

        {!isLoading && !conversations.length && (
          <p className="text-xs text-[hsl(var(--muted-foreground))] p-4 text-center">
            Sin conversaciones
          </p>
        )}

        {conversations.map((conv) => {
          const name = getConversationDisplayName(conv, currentUserId);
          const avatarUrl = getAvatarUrl(conv, currentUserId);
          return (
            <button
              key={conv.id}
              type="button"
              onClick={() => handleSelect(conv)}
              className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-[hsl(var(--muted))] transition-colors text-left"
            >
              <AvatarCircle avatarUrl={avatarUrl} name={name} size="md" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{name}</p>
                {conv.last_message?.body && (
                  <p className="text-[10px] text-[hsl(var(--muted-foreground))] truncate">
                    {conv.last_message.body}
                  </p>
                )}
              </div>
              {conv.unread_count > 0 && (
                <span className="h-4 min-w-4 rounded-full bg-[hsl(var(--primary))] text-white text-[9px] font-bold flex items-center justify-center px-1 shrink-0">
                  {conv.unread_count > 99 ? "99+" : conv.unread_count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// --- Hub inner ---

function FloatingChatHubInner() {
  const { session, userProfile } = useAuth();
  const { edge, yPx, isOpen, openChats, setPosition, toggle, closeChat, toggleMinimize } =
    useChatFloatStore();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["chat-conversations"],
    queryFn: () => atlas.chat.listConversations({}, session?.access_token),
    enabled: Boolean(session?.access_token),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
  const conversations = data?.data ?? [];
  const totalUnread = conversations.reduce((sum, c) => sum + (c.unread_count ?? 0), 0);

  const effectiveY = yPx ?? Math.round(window.innerHeight * 0.75);
  const isMobile = window.innerWidth < 640;
  const maxWins = isMobile ? 0 : 3;

  const isDragRef = useRef(false);
  const dragStartRef = useRef(null);
  const [dragPos, setDragPos] = useState(null);
  const panelRef = useRef(null);

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
      isDragRef.current = false;
      dragStartRef.current = { x: e.clientX, y: e.clientY };

      const onMove = (me) => {
        if (!dragStartRef.current) return;
        const dx = Math.abs(me.clientX - dragStartRef.current.x);
        const dy = Math.abs(me.clientY - dragStartRef.current.y);
        if (dx > 6 || dy > 6) {
          isDragRef.current = true;
          setDragPos({ x: me.clientX, y: me.clientY });
        }
      };

      const onUp = (ue) => {
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        if (isDragRef.current) {
          const newEdge = ue.clientX > window.innerWidth / 2 ? "right" : "left";
          const clampedY = Math.max(
            60,
            Math.min(ue.clientY - BS / 2, window.innerHeight - BS - BM * 2),
          );
          setPosition(newEdge, clampedY);
          setDragPos(null);
        } else {
          toggle();
        }
        isDragRef.current = false;
        dragStartRef.current = null;
      };

      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
    },
    [setPosition, toggle],
  );

  if (isError) return null;

  const bubbleStyle = dragPos
    ? { position: "fixed", left: dragPos.x - BS / 2, top: dragPos.y - BS / 2, zIndex: 9999 }
    : { position: "fixed", [edge]: BM, top: effectiveY, zIndex: 9999 };

  return createPortal(
    <>
      {openChats.slice(0, maxWins).map((entry, i) => (
        <MiniChatWindow
          key={entry.id}
          entry={entry}
          index={i}
          edge={edge}
          onClose={() => closeChat(entry.id)}
          onMinimize={() => toggleMinimize(entry.id)}
        />
      ))}

      {isOpen && (
        <div ref={panelRef} onPointerDown={(e) => e.stopPropagation()}>
          <ConversationPanel
            conversations={conversations}
            isLoading={isLoading}
            edge={edge}
            y={effectiveY}
            currentUserId={userProfile?.id}
          />
        </div>
      )}

      <div style={bubbleStyle}>
        <button
          type="button"
          onPointerDown={handlePointerDown}
          className={[
            "h-14 w-14 rounded-full shadow-xl flex items-center justify-center relative",
            "cursor-grab active:cursor-grabbing touch-manipulation select-none",
            "transition-transform active:scale-95",
            "bg-[hsl(var(--primary))] text-white",
            isOpen ? "ring-2 ring-white/30" : "",
          ].join(" ")}
        >
          <MessageSquare className="h-6 w-6" />
          {totalUnread > 0 && (
            <span className="absolute -top-1 -right-1 h-5 min-w-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1 shadow-md pointer-events-none">
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
