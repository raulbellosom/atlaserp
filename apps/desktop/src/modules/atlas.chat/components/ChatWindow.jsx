import { useEffect, useCallback } from "react";
import { Button } from "@atlas/ui";
import { ArrowLeft, Users } from "lucide-react";
import { ChatMessageList } from "./ChatMessageList";
import { MessageComposer } from "./MessageComposer";
import { useChatMessages, useSendMessage, useMarkRead } from "../hooks/useChatMessages";
import { useChatPresence } from "../hooks/useChatPresence";
import { getConversationDisplayName } from "../lib/chatUtils";
import { useAuth } from "../../../auth/AuthProvider";

function ChatHeader({ conversation, currentUserId, onlineUsers, onClose }) {
  const displayName = getConversationDisplayName(conversation, currentUserId);
  const members = conversation?.members ?? [];
  const onlineCount = Object.keys(onlineUsers ?? {}).length;

  return (
    <div className="flex items-center gap-3 border-b border-[hsl(var(--border))] px-3 sm:px-4 py-3 shrink-0">
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors md:hidden touch-manipulation shrink-0"
          aria-label="Volver"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
      )}
      <div className="h-9 w-9 rounded-full bg-[hsl(var(--muted))] flex items-center justify-center font-semibold text-sm shrink-0">
        {displayName?.[0]?.toUpperCase() ?? "?"}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">{displayName}</p>
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          {onlineCount > 0
            ? `${onlineCount} en linea`
            : `${members.length} miembro${members.length !== 1 ? "s" : ""}`}
        </p>
      </div>
      {conversation?.type === "group" && (
        <button type="button" className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors touch-manipulation">
          <Users className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export function ChatWindow({ conversation, onClose }) {
  const { userProfile } = useAuth();
  const conversationId = conversation?.id;

  const { data: messagesData, isLoading } = useChatMessages(conversationId);
  const { mutateAsync: sendMessage } = useSendMessage(conversationId);
  const { mutate: markRead } = useMarkRead(conversationId);
  const { onlineUsers, typingUsersList, sendTyping } = useChatPresence(conversationId);

  // Mark as read when window is opened
  useEffect(() => {
    if (conversationId) {
      markRead();
    }
  }, [conversationId, markRead]);

  const handleSend = useCallback(
    async (data) => {
      await sendMessage(data);
    },
    [sendMessage],
  );

  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center text-[hsl(var(--muted-foreground))]">
        <div className="text-center space-y-2">
          <p className="text-4xl">💬</p>
          <p className="text-sm">Selecciona una conversacion para empezar</p>
        </div>
      </div>
    );
  }

  const messages = messagesData?.data ?? [];
  const typingNames = typingUsersList;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <ChatHeader
        conversation={conversation}
        currentUserId={userProfile?.id}
        onlineUsers={onlineUsers}
        onClose={onClose}
      />

      <ChatMessageList
        messages={messages}
        isLoading={isLoading}
        currentUserId={userProfile?.id}
        typingUsers={typingNames}
        onAttachmentClick={null}
      />

      <MessageComposer
        onSend={handleSend}
        onTyping={sendTyping}
        placeholder="Escribe un mensaje..."
      />
    </div>
  );
}
