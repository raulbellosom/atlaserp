import { useEffect, useLayoutEffect, useRef, useMemo, useCallback } from "react";
import { Skeleton } from "@atlas/ui";
import { Loader2 } from "lucide-react";
import { ChatMessageBubble } from "./ChatMessageBubble";
import { TypingIndicator } from "./TypingIndicator";
import { groupMessagesByDate, formatDateSeparator } from "../lib/chatUtils";

function senderKey(msg) {
  return `${msg.sender_user_id ?? "guest"}::${msg.sender_type ?? "user"}`;
}

function enrichWithGroupInfo(items) {
  return items.map((item, idx) => {
    if (item.type === "date_separator") return item;

    let prev = null;
    for (let i = idx - 1; i >= 0; i--) {
      if (items[i].type === "date_separator") break;
      prev = items[i];
      break;
    }
    let next = null;
    for (let i = idx + 1; i < items.length; i++) {
      if (items[i].type === "date_separator") break;
      next = items[i];
      break;
    }

    const key = senderKey(item);
    const isFirst = !prev || senderKey(prev) !== key;
    const isLast  = !next || senderKey(next) !== key;

    return { ...item, isFirst, isLast };
  });
}

export function ChatMessageList({
  messages,
  isLoading,
  currentUserId,
  typingUsers,
  onAttachmentClick,
  members,
  hasMore,
  isLoadingMore,
  onLoadMore,
  onDeleteMessage,
  onHideForMe,
  onForward,
  hiddenMessageIds,
  selectionMode,
  selectedMsgIds,
  onToggleSelect,
  onEnterSelection,
  searchQuery,
  searchMatchIds,
  currentMatchId,
}) {
  const bottomRef = useRef(null);
  const listRef = useRef(null);
  const topSentinelRef = useRef(null);
  const isInitialLoadRef = useRef(true);
  const prevScrollHeightRef = useRef(0);
  const restoreScrollRef = useRef(false);

  // All attachments across all messages — used so clicking any file navigates the full set
  const allConversationAttachments = useMemo(() => {
    if (!messages?.length) return [];
    return messages.flatMap((m) => m.attachments ?? []);
  }, [messages]);

  function handleAttachmentClick(attachments, index) {
    const clicked = attachments[index];
    if (clicked && allConversationAttachments.length > 0) {
      const globalIdx = allConversationAttachments.findIndex((a) => a.id === clicked.id);
      if (globalIdx !== -1) {
        onAttachmentClick(allConversationAttachments, globalIdx);
        return;
      }
    }
    onAttachmentClick(attachments, index);
  }

  // Preserve scroll position when older messages are prepended
  useLayoutEffect(() => {
    if (restoreScrollRef.current && listRef.current) {
      const diff = listRef.current.scrollHeight - prevScrollHeightRef.current;
      listRef.current.scrollTop += diff;
      restoreScrollRef.current = false;
    }
  }, [messages?.length]);

  useEffect(() => {
    if (!messages?.length) return;
    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false;
      if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
      return;
    }
    // Only auto-scroll if NOT triggered by load-more (scroll restore handles that)
    if (!restoreScrollRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages?.length]);

  useEffect(() => {
    if (!typingUsers?.length) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [typingUsers?.length]);

  // Scroll to the current search match
  useEffect(() => {
    if (!currentMatchId || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-msg-id="${currentMatchId}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [currentMatchId]);

  const lastReadMessageId = useMemo(() => {
    if (!members?.length || !messages?.length) return null;
    const otherMembers = members.filter((m) => m.userId !== currentUserId);
    if (!otherMembers.length) return null;

    const minReadTime = otherMembers.reduce((min, m) => {
      const t = m.lastReadAt ? new Date(m.lastReadAt).getTime() : 0;
      return min === null ? t : Math.min(min, t);
    }, null);

    if (!minReadTime) return null;

    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (
        msg.sender_user_id === currentUserId &&
        !String(msg.id ?? "").startsWith("temp-") &&
        msg.created_at &&
        new Date(msg.created_at).getTime() <= minReadTime
      ) {
        return msg.id;
      }
    }
    return null;
  }, [messages, members, currentUserId]);

  const handleLoadMore = useCallback(() => {
    if (!hasMore || isLoadingMore) return;
    if (listRef.current) {
      prevScrollHeightRef.current = listRef.current.scrollHeight;
      restoreScrollRef.current = true;
    }
    onLoadMore?.();
  }, [hasMore, isLoadingMore, onLoadMore]);

  // Auto-load when user scrolls up to the sentinel near the top of the list
  useEffect(() => {
    const sentinel = topSentinelRef.current;
    const container = listRef.current;
    if (!sentinel || !container || !hasMore) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) handleLoadMore(); },
      { root: container, threshold: 0 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, handleLoadMore]);

  if (isLoading) {
    return (
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
        {[40, 60, 50, 70, 45].map((w, i) => (
          <div key={i} className={`flex items-end gap-2 ${i % 2 === 0 ? "" : "flex-row-reverse"}`}>
            <Skeleton className="h-7 w-7 rounded-full shrink-0" />
            <Skeleton className="h-10 rounded-2xl" style={{ width: `${w}%` }} />
          </div>
        ))}
      </div>
    );
  }

  if (!messages?.length) {
    return (
      <div className="flex-1 min-h-0 flex items-center justify-center">
        <div className="text-center space-y-1">
          <p className="text-[hsl(var(--muted-foreground))] text-sm">No hay mensajes aun.</p>
          <p className="text-[hsl(var(--muted-foreground))] text-xs">
            Envia el primer mensaje para empezar.
          </p>
        </div>
      </div>
    );
  }

  const visibleMessages = hiddenMessageIds?.size
    ? messages.filter((m) => !hiddenMessageIds.has(m.id))
    : messages;

  const grouped = enrichWithGroupInfo(groupMessagesByDate(visibleMessages));

  return (
    <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain py-3">
      {/* Sentinel watched by IntersectionObserver — triggers auto-load when scrolled into view */}
      <div ref={topSentinelRef} className="h-px" />

      {/* Visible load-more indicator */}
      {hasMore && (
        <div className="flex justify-center px-4 pt-1 pb-3">
          {isLoadingMore ? (
            <span className="flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))]">
              <Loader2 className="h-3 w-3 animate-spin" />
              Cargando...
            </span>
          ) : (
            <button
              type="button"
              onClick={handleLoadMore}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full bg-[hsl(var(--muted))] hover:bg-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
            >
              Cargar mensajes anteriores
            </button>
          )}
        </div>
      )}

      {grouped.map((item, idx) => {
        if (item.type === "date_separator") {
          return (
            <ChatMessageBubble
              key={`sep-${item.date}-${idx}`}
              message={{ type: "date_separator", label: formatDateSeparator(item.date) }}
              isOwn={false}
            />
          );
        }
        const isOwn = item.sender_user_id === currentUserId;
        const isDeleted = Boolean(item.deleted_at);
        const isPending = String(item.id ?? "").startsWith("temp-");
        return (
          <ChatMessageBubble
            key={item.id}
            message={item}
            isOwn={isOwn}
            isFirst={item.isFirst}
            isLast={item.isLast}
            onAttachmentClick={handleAttachmentClick}
            showReadReceipt={item.id === lastReadMessageId}
            onCopy={!isDeleted && !isPending && item.body
              ? () => navigator.clipboard.writeText(item.body).catch(() => {})
              : undefined}
            onDelete={isOwn && !isDeleted && !isPending && onDeleteMessage
              ? () => onDeleteMessage(item.id)
              : undefined}
            onHideForMe={!isDeleted && !isPending && onHideForMe
              ? () => onHideForMe(item.id)
              : undefined}
            onForward={!isDeleted && !isPending && item.body && onForward
              ? () => onForward(item)
              : undefined}
            selectionMode={selectionMode}
            isSelected={selectedMsgIds?.has(item.id) ?? false}
            onSelect={onToggleSelect ? () => onToggleSelect(item.id) : undefined}
            onEnterSelection={onEnterSelection ? () => onEnterSelection(item.id) : undefined}
            searchQuery={searchQuery}
            isSearchMatch={searchMatchIds ? searchMatchIds.has(item.id) : false}
            isCurrentMatch={item.id === currentMatchId}
          />
        );
      })}

      {typingUsers?.length > 0 && <TypingIndicator names={typingUsers} />}

      <div ref={bottomRef} />
    </div>
  );
}
