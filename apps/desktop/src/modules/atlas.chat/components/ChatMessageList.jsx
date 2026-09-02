import { useEffect, useLayoutEffect, useRef, useState, useMemo, useCallback } from "react";
import { Skeleton } from "@atlas/ui";
import { Loader2, ChevronDown, AtSign } from "lucide-react";
import { ChatMessageBubble } from "./ChatMessageBubble";
import { PinnedMessagesBar } from "./PinnedMessagesBar";
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
  onDeleteAttachment,
  deletingAttachmentId,
  onHideForMe,
  onForward,
  onPinMessage,
  onToggleReaction,
  onOpenThread,
  onReplyToMessage,
  onJumpToMessage,
  onJumpFailed,
  hiddenMessageIds,
  selectionMode,
  selectedMsgIds,
  onToggleSelect,
  onEnterSelection,
  searchQuery,
  searchMatchIds,
  currentMatchId,
  scrollToMessage,
  // Pinned messages for the anchored strip above the list. Empty/omitted =>
  // the strip renders nothing. onJumpToPinnedMessage(id, threadRootId) and
  // onOpenPinnedList are optional; onUnpinMessage(id) enables the inline
  // unpin affordance.
  pinnedMessages = [],
  onOpenPinnedList,
  onJumpToPinnedMessage,
  onUnpinMessage,
  canUnpinMessages = false,
  // Unread count for this conversation captured the instant it was opened —
  // see ChatWindow.jsx/MiniChatWindow.jsx's unreadSnapshotRef comment. Used
  // to land the initial scroll on the first unread message instead of the
  // bottom, and to scope the mention jump button to unread mentions only.
  unreadCountAtOpen = 0,
}) {
  const { prefs } = useChatPreferences();
  const wallpaperClass = prefs.wallpaper ? "chat-wallpaper" : "";
  const bottomRef = useRef(null);
  const listRef = useRef(null);
  const topSentinelRef = useRef(null);
  const isInitialLoadRef = useRef(true);
  const prevScrollHeightRef = useRef(0);
  const restoreScrollRef = useRef(false);
  // The last jump request we've already acted on — keyed by nonce so an
  // unrelated re-render never re-scrolls you back to the same message.
  const jumpHandledRef = useRef(null);
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

  // First unread message + total unread count, WhatsApp-style — mirrors the
  // backend's unread_count filter (own/system messages don't count) so the
  // boundary lands on the same message the sidebar badge is counting from.
  // Null once everything was already read when the conversation was opened.
  const unreadBoundary = useMemo(() => {
    if (!unreadCountAtOpen || !messages?.length) return null;
    const countable = messages.filter(
      (m) => !m.deleted_at && m.sender_type !== "system" && m.sender_user_id !== currentUserId,
    );
    if (!countable.length) return null;
    const idx = Math.max(0, countable.length - unreadCountAtOpen);
    const firstUnread = countable[idx] ?? countable[0];
    return firstUnread ? { id: firstUnread.id, count: unreadCountAtOpen } : null;
  }, [messages, unreadCountAtOpen, currentUserId]);

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
      if (unreadBoundary?.id) {
        // Land on the first unread message, not the very bottom — the
        // banner effect below re-arms itself against this same id.
        requestAnimationFrame(() => {
          const el = listRef.current?.querySelector(`[data-msg-id="${unreadBoundary.id}"]`);
          if (el) el.scrollIntoView({ block: "start" });
          else if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
        });
      } else if (listRef.current) {
        listRef.current.scrollTop = listRef.current.scrollHeight;
      }
      return;
    }
    // Only auto-scroll if NOT triggered by load-more (scroll restore handles that)
    if (!restoreScrollRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages?.length, unreadBoundary]);

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

  // "N mensajes sin leer" banner — visible for a few seconds after opening a
  // conversation with unread messages, then fades out on its own (WhatsApp
  // shows it persistently; this codebase's ask was specifically time-based).
  const [showUnreadBanner, setShowUnreadBanner] = useState(false);
  useEffect(() => {
    if (!unreadBoundary?.id) return;
    setShowUnreadBanner(true);
    const t = setTimeout(() => setShowUnreadBanner(false), 4000);
    return () => clearTimeout(t);
  }, [unreadBoundary?.id]);

  // Mentions of the current viewer that are still unread — scoped to the
  // unread boundary (a mention in an already-read message doesn't need
  // pointing out) — plus a "visited" set. Each jump-button click goes to the
  // earliest one still pending and marks it visited, so the button's count
  // shrinks and the button itself disappears once every unread mention has
  // been jumped to at least once — it does not just cycle forever.
  const ownRoleId = findOwnMember(members, currentUserId)?.roleId;
  const [visitedMentionIds, setVisitedMentionIds] = useState(() => new Set());

  const unreadMentionIds = useMemo(() => {
    if (!unreadBoundary?.id || !messages?.length) return [];
    const boundaryIdx = messages.findIndex((m) => m.id === unreadBoundary.id);
    const scope = boundaryIdx >= 0 ? messages.slice(boundaryIdx) : messages;
    return scope
      .filter((m) => !m.deleted_at && isMentioned(m, currentUserId, ownRoleId))
      .map((m) => m.id);
  }, [messages, unreadBoundary, currentUserId, ownRoleId]);

  const pendingMentionIds = useMemo(
    () => unreadMentionIds.filter((id) => !visitedMentionIds.has(id)),
    [unreadMentionIds, visitedMentionIds],
  );

  const handleJumpToMention = useCallback(() => {
    const nextId = pendingMentionIds[0];
    if (!nextId || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-msg-id="${nextId}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    setVisitedMentionIds((prev) => new Set(prev).add(nextId));
  }, [pendingMentionIds]);

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

  // Scroll to a message jumped to from outside — "Ver en el chat" in
  // PinnedMessagesSheet, tapping an inline reply quote, or a message-search
  // result. `nonce` lets the same id be re-targeted twice in a row. If the
  // message isn't in the DOM yet, load older pages (up to 12 times) and retry
  // before giving up — a search hit can be deep in history.
  useEffect(() => {
    const target = scrollToMessage;
    if (!target?.id || !listRef.current) return;
    // One scroll per distinct request. Without this the effect re-fires on
    // every unrelated re-render (an inline onJumpFailed, a new handleLoadMore
    // after isLoadingMore toggles, ...) and keeps yanking you back.
    const key = target.nonce ?? target.id;
    if (jumpHandledRef.current === key) return;

    let cancelled = false;
    let attempts = 0;

    function flash(el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.remove("chat-msg-flash");
      void el.offsetWidth; // reflow so the animation restarts on a repeat target
      el.classList.add("chat-msg-flash");
      setTimeout(() => el.classList.remove("chat-msg-flash"), 2100);
    }

    function tryScroll() {
      if (cancelled) return;
      const el = listRef.current?.querySelector(`[data-msg-id="${target.id}"]`);
      if (el) { jumpHandledRef.current = key; flash(el); return; }
      if (attempts >= 12 || !hasMore) { jumpHandledRef.current = key; onJumpFailed?.(); return; }
      attempts += 1;
      handleLoadMore();
      setTimeout(tryScroll, 600);
    }
    tryScroll();
    return () => { cancelled = true; };
  }, [scrollToMessage, hasMore, handleLoadMore, onJumpFailed]);

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
      <PinnedMessagesBar
        pinnedMessages={pinnedMessages}
        onJump={onJumpToPinnedMessage ?? onJumpToMessage}
        onOpenList={onOpenPinnedList}
        onUnpin={onUnpinMessage}
        canUnpin={canUnpinMessages}
      />
      <div
        ref={listRef}
        onScroll={handleScroll}
        className={["chat-scale-target", wallpaperClass, "flex flex-col flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain py-3"].join(" ")}
        data-accent={prefs.accentColorKey}
      >
        {/* Sentinel watched by IntersectionObserver — triggers auto-load when scrolled into view */}
        <div ref={topSentinelRef} className="h-px" />

        {/* Pins the message column to the bottom of the viewport when the
            conversation is too short to fill it — otherwise a tall screen
            leaves a dead band of empty space between the last message and the
            composer. Collapses to 0 once the content overflows and the list
            actually scrolls. */}
        <div className="mt-auto" />

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
          const isUnreadDivider = unreadBoundary?.id === item.id;
          return [
            // Rendered continuously (not just while showUnreadBanner is true)
            // so the opacity/max-height classes below actually transition on
            // the same node instead of the div popping in and out of the DOM.
            isUnreadDivider && (
              <div
                key={`unread-${item.id}`}
                className={[
                  "flex items-center justify-center overflow-hidden transition-all duration-700 ease-out",
                  showUnreadBanner ? "opacity-100 max-h-10 my-2" : "opacity-0 max-h-0 my-0",
                ].join(" ")}
              >
                <span className="text-[11px] font-semibold px-3 py-1 rounded-full bg-[hsl(var(--primary)/0.12)] text-[hsl(var(--primary))] whitespace-nowrap">
                  {unreadBoundary.count} mensaje{unreadBoundary.count === 1 ? "" : "s"} sin leer
                </span>
              </div>
            ),
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
              onDeleteAttachment={!isDeleted && !isPending ? onDeleteAttachment : undefined}
              deletingAttachmentId={deletingAttachmentId}
              onOpenThreadForMessage={onOpenThread}
              onReply={!isDeleted && !isPending && onReplyToMessage ? onReplyToMessage : undefined}
              onJumpToMessage={onJumpToMessage}
              selectionMode={selectionMode}
              isSelected={selectedMsgIds?.has(item.id) ?? false}
              onSelect={onToggleSelect ? () => onToggleSelect(item.id) : undefined}
              onEnterSelection={onEnterSelection ? () => onEnterSelection(item.id) : undefined}
              searchQuery={searchQuery}
              isSearchMatch={searchMatchIds ? searchMatchIds.has(item.id) : false}
              isCurrentMatch={item.id === currentMatchId}
            />,
          ];
        })}

        {typingUsers?.length > 0 && <TypingIndicator names={typingUsers} />}

        <div ref={bottomRef} />
      </div>

      {(pendingMentionIds.length > 0 || showScrollButton) && (
        <div className="absolute bottom-3 right-3 flex flex-col items-end gap-2 z-10">
          {pendingMentionIds.length > 0 && (
            <button
              type="button"
              onClick={handleJumpToMention}
              title="Ir a la siguiente mencion sin leer"
              className="relative h-9 w-9 flex items-center justify-center rounded-full bg-accent text-white shadow-lg hover:brightness-110 active:scale-[0.97] transition"
            >
              <AtSign className="h-4 w-4" />
              {pendingMentionIds.length > 1 && (
                <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-[hsl(var(--card))]">
                  {pendingMentionIds.length}
                </span>
              )}
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
