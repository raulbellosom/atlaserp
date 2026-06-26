import { useEffect, useRef } from "react";
import { Skeleton } from "@atlas/ui";
import { ChatMessageBubble } from "./ChatMessageBubble";
import { TypingIndicator } from "./TypingIndicator";
import { groupMessagesByDate, formatDateSeparator } from "../lib/chatUtils";

export function ChatMessageList({ messages, isLoading, currentUserId, typingUsers, onAttachmentClick }) {
  const bottomRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages?.length, typingUsers?.length]);

  if (isLoading) {
    return (
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className={`flex gap-2 ${i % 2 === 0 ? "" : "flex-row-reverse"}`}>
            <Skeleton className="h-7 w-7 rounded-full shrink-0" />
            <Skeleton className="h-10 rounded-2xl" style={{ width: `${[40, 60, 50, 70, 45][i]}%` }} />
          </div>
        ))}
      </div>
    );
  }

  if (!messages?.length) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-1">
          <p className="text-[hsl(var(--muted-foreground))] text-sm">
            No hay mensajes aún.
          </p>
          <p className="text-[hsl(var(--muted-foreground))] text-xs">
            Envía el primer mensaje para empezar.
          </p>
        </div>
      </div>
    );
  }

  const grouped = groupMessagesByDate(messages);

  return (
    <div ref={listRef} className="flex-1 overflow-y-auto py-2">
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
            onAttachmentClick={onAttachmentClick}
          />
        );
      })}

      {typingUsers?.length > 0 && <TypingIndicator names={typingUsers} />}

      <div ref={bottomRef} />
    </div>
  );
}
