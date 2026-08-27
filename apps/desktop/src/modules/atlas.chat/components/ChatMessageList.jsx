import { useEffect, useLayoutEffect, useRef, useState, useMemo, useCallback } from "react";
import { Skeleton } from "@atlas/ui";
import { Loader2, ChevronDown, AtSign } from "lucide-react";
import { ChatMessageBubble } from "./ChatMessageBubble";
import { TypingIndicator } from "./TypingIndicator";
import { groupMessagesByDate, formatDateSeparator } from "../lib/chatUtils";
import { findOwnMember, isMentioned } from "../lib/chatPermissions";
import { useChatPreferences } from "../hooks/useChatPreferences";

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
  conversationType,
  hasMore,
  isLoadingMore,
  onLoadMore,
  onDeleteMessage,
  onHideForMe,
  onForward,
  onPinMessage,
  onToggleReaction,
  onOpenThread,
  hiddenMessageIds,
  selectionMode,
  selectedMsgIds,
  onToggleSelect,
  onEnterSelection,
  searchQuery,
  searchMatchIds,
  currentMatchId,
  scrollToMessage,
}) {
  const { prefs } = useChatPreferences();
  const wallpaperClass = prefs.wallpaper ? "chat-wallpaper" : "";
  const bottomRef = useRef(null);
  const listRef = useRef(null);
  const topSentinelRef = useRef(null);
  const isInitialLoadRef = useRef(true);
  const prevScrollHeightRef = useRef(0);
  const restoreScrollRef = useRef(false);
  const mentionCursorRef = useRef(-1);
  const [showScrollButton, setShowScrollButton] = useState(false);

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

  // Scroll to a message jumped to from outside (e.g. "Ver en el chat" in PinnedMessagesSheet).
  // `nonce` lets the same message be re-targeted twice in a row (id alone wouldn't re-trigger the effect).
  useEffect(() => {
    if (!scrollToMessage?.id || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-msg-id="${scrollToMessage.id}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [scrollToMessage?.id, scrollToMessage?.nonce]);

  // Distance-from-bottom tracking for the "jump to latest" button — recomputed
  // on scroll AND whenever the message count changes (a new message arriving
  // while scrolled up grows scrollHeight without firing a scroll event).
  const handleScroll = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollButton(distanceFromBottom > 240);
  }, []);

  useEffect(() => {
    handleScroll();
  }, [messages?.length, handleScroll]);

  const handleScrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Messages (in any of the loaded pages) that mention the current viewer —
  // backs the "@" jump button below, WhatsApp-style: each click advances to
  // the next one in the conversation, wrapping back to the first.
  const ownRoleId = findOwnMember(members, currentUserId)?.roleId;
  const ownMentionIds = useMemo(() => {
    if (!messages?.length) return [];
    return messages
      .filter((m) => !m.deleted_at && isMentioned(m, currentUserId, ownRoleId))
      .map((m) => m.id);
  }, [messages, currentUserId, ownRoleId]);

  const handleJumpToMention = useCallback(() => {
    if (!ownMentionIds.length || !listRef.current) return;
    mentionCursorRef.current = (mentionCursorRef.current + 1) % ownMentionIds.length;
    const id = ownMentionIds[mentionCursorRef.current];
    const el = listRef.current.querySelector(`[data-msg-id="${id}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [ownMentionIds]);

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
      <div
        className={["chat-scale-target", wallpaperClass, "flex-1 min-h-0 overflow-y-auto p-4 space-y-3"].join(" ")}
        data-accent={prefs.accentColorKey}
      >
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
      <div
        className={["chat-scale-target", wallpaperClass, "flex-1 min-h-0 flex items-center justify-center"].join(" ")}
        data-accent={prefs.accentColorKey}
      >
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
    <div className="relative flex-1 min-h-0 flex flex-col">
      <div
        ref={listRef}
        onScroll={handleScroll}
        className={["chat-scale-target", wallpaperClass, "flex-1 min-h-0 overflow-y-auto overscroll-contain py-3"].join(" ")}
        data-accent={prefs.accentColorKey}
      >
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
              currentUserId={currentUserId}
              members={members}
              conversationType={conversationType}
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
              onForward={!isDeleted && !isPending && onForward
                ? () => onForward(item)
                : undefined}
              isPinned={Boolean(item.pinned_at)}
              onPin={!isDeleted && !isPending && onPinMessage
                ? () => onPinMessage(item.id, !item.pinned_at)
                : undefined}
              onToggleReaction={!isDeleted && !isPending ? onToggleReaction : undefined}
              onOpenThreadForMessage={onOpenThread}
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

      {(ownMentionIds.length > 0 || showScrollButton) && (
        <div className="absolute bottom-3 right-3 flex flex-col items-end gap-2 z-10">
          {ownMentionIds.length > 0 && (
            <button
              type="button"
              onClick={handleJumpToMention}
              title="Ir a la siguiente mencion"
              className="h-9 w-9 flex items-center justify-center rounded-full bg-accent text-white shadow-lg hover:brightness-110 active:scale-[0.97] transition"
            >
              <AtSign className="h-4 w-4" />
            </button>
          )}
          {showScrollButton && (
            <button
              type="button"
              onClick={handleScrollToBottom}
              title="Ir al ultimo mensaje"
              className="h-9 w-9 flex items-center justify-center rounded-full bg-[hsl(var(--card))] border border-[hsl(var(--border))] shadow-lg hover:bg-[hsl(var(--muted))] active:scale-[0.97] transition"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
