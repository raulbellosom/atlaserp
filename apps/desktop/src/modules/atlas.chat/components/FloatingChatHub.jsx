import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { MessageSquare, X, Minus } from "lucide-react";
import { Skeleton } from "@atlas/ui";
import { useChatFloatStore } from "../store/chatFloatStore";
import { useChatConversations } from "../hooks/useChatConversations";
import { useChatMessages, useSendMessage, useMarkRead } from "../hooks/useChatMessages";
import { MessageComposer } from "./MessageComposer";
import { ChatMessageList } from "./ChatMessageList";
import { getConversationDisplayName } from "../lib/chatUtils";
import { useAuth } from "../../../auth/AuthProvider";

const BS = 56;   // bubble size px
const BM = 16;   // margin from edge px
const WW = 300;  // mini-window width px
const WH = 380;  // mini-window height px
const GAP = 8;   // gap between elements px

// --- Mini chat window (desktop) ---

function MiniChatWindow({ entry, index, edge, onClose, onMinimize }) {
  const { id, conversation, minimized } = entry;
  const { userProfile } = useAuth();
  const { data, isLoading } = useChatMessages(id);
  const { mutateAsync: send } = useSendMessage(id);
  const { mutate: markRead } = useMarkRead(id);
  const markReadRef = useRef(markRead);
  markReadRef.current = markRead;

  useEffect(() => { markReadRef.current(); }, [id]);

  const name = getConversationDisplayName(conversation, userProfile?.id);
  const offset = BM + BS + GAP + index * (WW + GAP);

  return (
    <div
      style={{
        position: "fixed",
        bottom: BM,
        width: WW,
        [edge]: offset,
        zIndex: 9990,
        height: minimized ? 44 : WH,
        transition: "height 0.2s ease",
      }}
      className="rounded-xl shadow-2xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div
        role="button"
        tabIndex={0}
        onClick={onMinimize}
        onKeyDown={(e) => e.key === "Enter" && onMinimize()}
        className="flex items-center gap-2 px-3 h-11 bg-[hsl(var(--surface-2))] border-b border-[hsl(var(--border))] shrink-0 cursor-pointer select-none"
      >
        <div className="h-6 w-6 rounded-full bg-[hsl(var(--primary))] text-white flex items-center justify-center text-[10px] font-bold shrink-0">
          {name?.[0]?.toUpperCase() ?? "?"}
        </div>
        <p className="flex-1 text-xs font-semibold truncate">{name}</p>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onMinimize(); }}
          className="shrink-0 h-6 w-6 flex items-center justify-center rounded text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors touch-manipulation"
        >
          <Minus className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          className="shrink-0 h-6 w-6 flex items-center justify-center rounded text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors touch-manipulation"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      {!minimized && (
        <>
          <ChatMessageList
            messages={data?.data ?? []}
            isLoading={isLoading}
            currentUserId={userProfile?.id}
            typingUsers={[]}
          />
          <MessageComposer onSend={send} placeholder="Escribe un mensaje..." />
        </>
      )}
    </div>
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
      className="rounded-xl shadow-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] overflow-hidden"
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
          return (
            <button
              key={conv.id}
              type="button"
              onClick={() => handleSelect(conv)}
              className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-[hsl(var(--muted))] transition-colors text-left"
            >
              <div className="h-8 w-8 rounded-full bg-[hsl(var(--muted))] flex items-center justify-center text-xs font-semibold shrink-0">
                {name?.[0]?.toUpperCase() ?? "?"}
              </div>
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

// --- Hub (inner, only mounts when authenticated) ---

function FloatingChatHubInner() {
  const { userProfile } = useAuth();
  const { edge, yPx, isOpen, openChats, setPosition, toggle, closeChat, toggleMinimize } =
    useChatFloatStore();

  const { data, isLoading, isError } = useChatConversations();
  const conversations = data?.data ?? [];
  const totalUnread = conversations.reduce((sum, c) => sum + (c.unread_count ?? 0), 0);

  const effectiveY = yPx ?? Math.round(window.innerHeight * 0.75);
  const isMobile = window.innerWidth < 640;
  const maxWins = isMobile ? 0 : 3;

  // Drag state
  const isDragRef = useRef(false);
  const dragStartRef = useRef(null);
  const [dragPos, setDragPos] = useState(null);
  const panelRef = useRef(null);

  // Close panel on Escape
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => { if (e.key === "Escape") toggle(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, toggle]);

  // Close panel on outside pointerdown
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
      e.stopPropagation(); // prevent the outside-click listener from firing
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

  // If chat module is not available (403/404), render nothing
  if (isError) return null;

  const bubbleStyle = dragPos
    ? { position: "fixed", left: dragPos.x - BS / 2, top: dragPos.y - BS / 2, zIndex: 9999 }
    : { position: "fixed", [edge]: BM, top: effectiveY, zIndex: 9999 };

  return createPortal(
    <>
      {/* Mini chat windows (desktop only) */}
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

      {/* Conversation picker */}
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

      {/* Main bubble */}
      <div style={bubbleStyle}>
        <button
          type="button"
          onPointerDown={handlePointerDown}
          className={[
            "h-14 w-14 rounded-full shadow-xl flex items-center justify-center relative",
            "cursor-grab active:cursor-grabbing touch-manipulation select-none",
            "transition-transform active:scale-95",
            isOpen
              ? "bg-[hsl(var(--primary))] text-white ring-2 ring-white/30"
              : "bg-[hsl(var(--primary))] text-white",
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

// --- Public export (guards auth) ---

export function FloatingChatHub() {
  const { session } = useAuth();
  if (!session) return null;
  return <FloatingChatHubInner />;
}
