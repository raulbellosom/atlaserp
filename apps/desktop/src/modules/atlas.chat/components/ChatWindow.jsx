import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@atlas/ui";
import { ArrowLeft, Users } from "lucide-react";
import { ChatMessageList } from "./ChatMessageList";
import { MessageComposer } from "./MessageComposer";
import { ChatAttachmentViewer } from "./ChatAttachmentViewer";
import { useChatMessages, useSendMessage, useMarkRead } from "../hooks/useChatMessages";
import { useChatPresence } from "../hooks/useChatPresence";
import { getConversationDisplayName } from "../lib/chatUtils";
import { useAuth } from "../../../auth/AuthProvider";

function ChatHeader({ conversation, currentUserId, onlineUsers, onClose }) {
  const [avatarErr, setAvatarErr] = useState(false);
  const displayName = getConversationDisplayName(conversation, currentUserId);
  const members = conversation?.members ?? [];
  const onlineCount = Object.keys(onlineUsers ?? {}).length;
  const otherMember =
    conversation?.type === "direct"
      ? members.find((m) => m.userId !== currentUserId)
      : null;
  const avatarUrl = conversation?.avatar_url ?? otherMember?.avatarUrl ?? null;
  const initial = (displayName?.[0] ?? "?").toUpperCase();

  // Reset error when URL changes (e.g. conversation switch)
  useEffect(() => { setAvatarErr(false); }, [avatarUrl]);

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
      {avatarUrl && !avatarErr ? (
        <img
          src={avatarUrl}
          alt={displayName}
          className="h-9 w-9 rounded-full object-cover shrink-0"
          onError={() => setAvatarErr(true)}
        />
      ) : (
        <div className="h-9 w-9 rounded-full bg-[hsl(var(--muted))] flex items-center justify-center font-semibold text-sm shrink-0">
          {initial}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">{displayName}</p>
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          {onlineCount > 0
            ? `${onlineCount} en linea`
            : `${members.length} miembro${members.length !== 1 ? "s" : ""}`}
        </p>
      </div>
      {conversation?.type === "group" && (
        <button
          type="button"
          className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors touch-manipulation"
        >
          <Users className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export function ChatWindow({ conversation, onClose }) {
  const { userProfile, session } = useAuth();
  const token = session?.access_token;
  const conversationId = conversation?.id;

  const { data: messagesData, isLoading } = useChatMessages(conversationId);
  const { mutateAsync: sendMessage } = useSendMessage(conversationId);
  const { mutate: markReadMutate } = useMarkRead(conversationId);
  const { onlineUsers, typingUsersList, sendTyping } = useChatPresence(conversationId);

  const composerRef = useRef(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [viewer, setViewer] = useState({ open: false, attachments: [], activeIndex: 0 });

  // Stabilize markRead so the effect doesn't re-run on every render
  const markReadRef = useRef(markReadMutate);
  markReadRef.current = markReadMutate;

  // Mark as read when entering a conversation; also re-fires when token becomes available
  useEffect(() => {
    if (conversationId && token) markReadRef.current();
  }, [conversationId, token]);

  const handleSend = useCallback(
    async (data) => { await sendMessage(data); },
    [sendMessage],
  );

  const handleAttachmentClick = useCallback((attachments, activeIndex) => {
    setViewer({ open: true, attachments, activeIndex });
  }, []);

  function handleDragOver(e) {
    e.preventDefault();
    setIsDragOver(true);
  }

  function handleDragLeave(e) {
    if (!e.currentTarget.contains(e.relatedTarget)) setIsDragOver(false);
  }

  function handleDrop(e) {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length) composerRef.current?.addFiles(files);
  }

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

  return (
    <div
      className="flex flex-col flex-1 min-h-0 relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Full-window drag overlay */}
      {isDragOver && (
        <div className="absolute inset-0 z-30 flex items-center justify-center border-2 border-dashed border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.06)] pointer-events-none rounded-none">
          <p className="text-sm font-medium text-[hsl(var(--primary))]">Suelta los archivos aqui</p>
        </div>
      )}

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
        typingUsers={typingUsersList}
        onAttachmentClick={handleAttachmentClick}
        members={conversation.members}
      />

      <MessageComposer
        ref={composerRef}
        onSend={handleSend}
        onTyping={sendTyping}
        placeholder="Escribe un mensaje..."
        conversationId={conversationId}
      />

      <ChatAttachmentViewer
        open={viewer.open}
        onOpenChange={(open) => setViewer((v) => ({ ...v, open }))}
        attachments={viewer.attachments}
        activeIndex={viewer.activeIndex}
        onIndexChange={(i) => setViewer((v) => ({ ...v, activeIndex: i }))}
      />
    </div>
  );
}
