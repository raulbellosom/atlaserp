import { useEffect } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useAuth } from "../../../auth/AuthProvider";
import { atlas } from "../../../lib/atlas";
import { useRealtimeContext } from "../../../providers/RealtimeProvider";

export function useThreadReplies(rootMessageId) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const { on } = useRealtimeContext();

  const query = useQuery({
    queryKey: ["chat-thread", rootMessageId],
    queryFn: () => atlas.chat.getThread(rootMessageId, token),
    enabled: Boolean(token && rootMessageId),
    staleTime: 5_000,
  });

  // A reply broadcast carries threadRootId in its payload (Plan A, Task 2
  // Step 5b) — only invalidate this specific thread's query when it's the
  // one that changed, not on every chat.message.new in the conversation.
  useEffect(() => {
    if (!rootMessageId) return;
    return on("chat.message.new", (payload) => {
      if (payload.threadRootId === rootMessageId) {
        queryClient.invalidateQueries({ queryKey: ["chat-thread", rootMessageId] });
      }
    });
  }, [rootMessageId, on, queryClient]);

  return query;
}

export function useSendThreadReply(rootMessageId, conversationId) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data) => atlas.chat.sendMessage(conversationId, { ...data, threadRootId: rootMessageId }, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-thread", rootMessageId] });
      // The root's thread_reply_count/thread_last_reply_at (rendered as the
      // main-timeline pill) live inside the main message-list cache — must
      // also invalidate it so the pill updates without waiting for the
      // realtime round-trip.
      queryClient.invalidateQueries({ queryKey: ["chat-messages", conversationId] });
    },
  });
}
