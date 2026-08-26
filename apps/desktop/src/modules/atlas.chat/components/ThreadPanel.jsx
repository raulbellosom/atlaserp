// apps/desktop/src/modules/atlas.chat/components/ThreadPanel.jsx
import { Sheet, SheetContent, SheetHeader, SheetTitle, Skeleton } from "@atlas/ui";
import { MessageSquare } from "lucide-react";
import { useThreadReplies, useSendThreadReply } from "../hooks/useThreadReplies";
import { ChatMessageBubble } from "./ChatMessageBubble";
import { MessageComposer } from "./MessageComposer";
import { useAuth } from "../../../auth/AuthProvider";

export function ThreadPanel({ open, onOpenChange, rootMessageId, conversationId, conversationType, members, onToggleReaction }) {
  const { userProfile } = useAuth();
  const currentUserId = userProfile?.id;
  const { data, isLoading } = useThreadReplies(open ? rootMessageId : null);
  const { mutateAsync: sendReply } = useSendThreadReply(rootMessageId, conversationId);

  const root = data?.data?.root;
  const replies = data?.data?.replies ?? [];

  const handleSend = async (payload) => {
    await sendReply(payload);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0">
        <SheetHeader className="px-4 pt-4">
          <SheetTitle className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-[hsl(var(--primary))]" />
            Hilo
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-2 py-2">
          {isLoading && (
            <div className="space-y-2 px-2">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
            </div>
          )}

          {!isLoading && root && (
            <>
              <ChatMessageBubble
                message={root}
                isOwn={root.sender_user_id === currentUserId}
                isFirst
                isLast
                currentUserId={currentUserId}
                members={members}
                conversationType={conversationType}
                onToggleReaction={onToggleReaction}
                isThreadReplyView
              />
              <div className="border-b border-[hsl(var(--border))] my-2 mx-2" />

              {!replies.length && (
                <p className="text-center text-xs text-[hsl(var(--muted-foreground))] py-6">
                  Se el primero en responder.
                </p>
              )}

              {replies.map((reply, i) => (
                <ChatMessageBubble
                  key={reply.id}
                  message={reply}
                  isOwn={reply.sender_user_id === currentUserId}
                  isFirst={i === 0 || replies[i - 1]?.sender_user_id !== reply.sender_user_id}
                  isLast={i === replies.length - 1 || replies[i + 1]?.sender_user_id !== reply.sender_user_id}
                  currentUserId={currentUserId}
                  members={members}
                  conversationType={conversationType}
                  onToggleReaction={onToggleReaction}
                  isThreadReplyView
                />
              ))}
            </>
          )}
        </div>

        <div className="shrink-0 border-t border-[hsl(var(--border))]">
          <MessageComposer
            onSend={handleSend}
            placeholder="Responder en el hilo..."
            compact
            conversationId={conversationId}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
