import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useCallback } from "react";
import { useAuth } from "../../../auth/AuthProvider";
import { atlas } from "../../../lib/atlas";
import { subscribeToMessages } from "../lib/supabaseRealtime";

export function useChatMessages(conversationId) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const unsubRef = useRef(null);

  const query = useQuery({
    queryKey: ["chat-messages", conversationId],
    queryFn: () => atlas.chat.listMessages(conversationId, { limit: 40 }, token),
    enabled: Boolean(token && conversationId),
    staleTime: 10_000,
  });

  const addMessageToCache = useCallback(
    (newMsg) => {
      queryClient.setQueryData(["chat-messages", conversationId], (old) => {
        if (!old) return old;
        const already = old.data?.some((m) => m.id === newMsg.id);
        if (already) return old;
        return { ...old, data: [...(old.data ?? []), newMsg] };
      });
      queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
    },
    [conversationId, queryClient],
  );

  const updateMessageInCache = useCallback(
    (updatedMsg) => {
      queryClient.setQueryData(["chat-messages", conversationId], (old) => {
        if (!old) return old;
        return {
          ...old,
          data: (old.data ?? []).map((m) =>
            m.id === updatedMsg.id ? { ...m, ...updatedMsg } : m,
          ),
        };
      });
    },
    [conversationId, queryClient],
  );

  useEffect(() => {
    if (!conversationId) return;

    unsubRef.current = subscribeToMessages(conversationId, (payload) => {
      if (payload.eventType === "INSERT") {
        addMessageToCache(payload.new);
      } else if (payload.eventType === "UPDATE") {
        updateMessageInCache(payload.new);
      }
    });

    return () => {
      unsubRef.current?.();
    };
  }, [conversationId, addMessageToCache, updateMessageInCache]);

  return query;
}

export function useSendMessage(conversationId) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data) => atlas.chat.sendMessage(conversationId, data, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-messages", conversationId] });
      queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
    },
  });
}

export function useMarkRead(conversationId) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => atlas.chat.markRead(conversationId, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
    },
  });
}
