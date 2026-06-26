import { useEffect, useRef, useMemo } from "react";
import { Skeleton } from "@atlas/ui";
import { ChatMessageBubble } from "./ChatMessageBubble";
import { TypingIndicator } from "./TypingIndicator";
import { groupMessagesByDate, formatDateSeparator } from "../lib/chatUtils";

function senderKey(msg) {
  return `${msg.sender_user_id ?? "guest"}::${msg.sender_type ?? "user"}`;
}

// Enrich grouped items with isFirst/isLast within a consecutive sender run.
// Date separators reset the grouping.
function enrichWithGroupInfo(items) {
  return items.map((item, idx) => {
    if (item.type === "date_separator") return item;

    // Walk backwards to find prev non-separator
    let prev = null;
    for (let i = idx - 1; i >= 0; i--) {
      if (items[i].type === "date_separator") break; // separator resets group
      prev = items[i];
      break;
    }
    // Walk forwards to find next non-separator
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
}) {
  const bottomRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages?.length, typingUsers?.length]);

  // ID of the last own message that all other members have read
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

  if (isLoading) {
    return (
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
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
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-1">
          <p className="text-[hsl(var(--muted-foreground))] text-sm">No hay mensajes aun.</p>
          <p className="text-[hsl(var(--muted-foreground))] text-xs">
            Envia el primer mensaje para empezar.
          </p>
        </div>
      </div>
    );
  }

  const grouped = enrichWithGroupInfo(groupMessagesByDate(messages));

  return (
    <div ref={listRef} className="flex-1 overflow-y-auto py-3">
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
        return (
          <ChatMessageBubble
            key={item.id}
            message={item}
            isOwn={item.sender_user_id === currentUserId}
            isFirst={item.isFirst}
            isLast={item.isLast}
            onAttachmentClick={onAttachmentClick}
            showReadReceipt={item.id === lastReadMessageId}
          />
        );
      })}

      {typingUsers?.length > 0 && <TypingIndicator names={typingUsers} />}

      <div ref={bottomRef} />
    </div>
  );
}
