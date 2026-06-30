import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useAuth } from "../../../auth/AuthProvider";
import { atlas } from "../../../lib/atlas";
import { useRealtimeContext } from "../../../providers/RealtimeProvider";

export function useChatConversations() {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const { on } = useRealtimeContext();

  const query = useQuery({
    queryKey: ["chat-conversations"],
    queryFn: () => atlas.chat.listConversations({}, token),
    enabled: Boolean(token),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    const unsub1 = on("chat.conversation.new", () => {
      queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
    });
    const unsub2 = on("chat.message.new", () => {
      queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
    });
    return () => {
      unsub1();
      unsub2();
    };
  }, [on, queryClient]);

  return query;
}

export function useArchivedConversations() {
  const { session } = useAuth();
  const token = session?.access_token;

  return useQuery({
    queryKey: ["chat-conversations-archived"],
    queryFn: () => atlas.chat.listConversations({ archived: true }, token),
    enabled: Boolean(token),
    staleTime: 60_000,
  });
}

export function useArchiveConversation() {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (conversationId) => atlas.chat.archiveConversation(conversationId, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
      queryClient.invalidateQueries({ queryKey: ["chat-conversations-archived"] });
    },
  });
}

export function useUnarchiveConversation() {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (conversationId) => atlas.chat.unarchiveConversation(conversationId, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
      queryClient.invalidateQueries({ queryKey: ["chat-conversations-archived"] });
    },
  });
}
