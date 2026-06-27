import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useCallback } from "react";
import { useAuth } from "../../../auth/AuthProvider";
import { atlas } from "../../../lib/atlas";
import { subscribeToMessages } from "../lib/supabaseRealtime";
import { useRealtimeContext } from "../../../providers/RealtimeProvider";

export function useChatMessages(conversationId) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const unsubRef = useRef(null);
  const { on } = useRealtimeContext();

  const query = useQuery({
    queryKey: ["chat-messages", conversationId],
    queryFn: () => atlas.chat.listMessages(conversationId, { limit: 40 }, token),
    enabled: Boolean(token && conversationId),
    staleTime: 5_000,
    refetchInterval: 8_000,
    refetchOnWindowFocus: true,
  });

  const addMessageToCache = useCallback(
    (newMsg) => {
      queryClient.setQueryData(["chat-messages", conversationId], (old) => {
        if (!old) return old;
        // Replace any pending temp message with the same body/type if it matches,
        // then deduplicate by real ID.
        const already = old.data?.some((m) => m.id === newMsg.id);
        if (already) return old;
        // Remove orphaned temp messages that match this real message's content
        const filtered = (old.data ?? []).filter(
          (m) => !(m._pending && m.body === newMsg.body && m.message_type === newMsg.message_type),
        );
        return { ...old, data: [...filtered, newMsg] };
      });
      queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
      // Realtime INSERT rows don't include joined attachment data — refetch so recipients
      // see attachment cards as soon as the message arrives.
      if (Number(newMsg.attachment_count) > 0) {
        queryClient.invalidateQueries({ queryKey: ["chat-messages", conversationId] });
      }
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

  useEffect(() => {
    if (!conversationId) return;
    return on("chat.message.new", ({ conversationId: cid }) => {
      if (cid === conversationId) {
        queryClient.invalidateQueries({ queryKey: ["chat-messages", conversationId] });
      }
    });
  }, [conversationId, on, queryClient]);

  // Mobile fallback: when the user returns to the tab/app after backgrounding,
  // the WebSocket may have dropped broadcasts. Refetch on visibility restore.
  useEffect(() => {
    if (!conversationId) return;
    function handleVisibility() {
      if (document.visibilityState === "visible") {
        queryClient.invalidateQueries({ queryKey: ["chat-messages", conversationId] });
        queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
      }
    }
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [conversationId, queryClient]);

  // Auto-dismiss chat notifications for this conversation when the user opens it.
  useEffect(() => {
    if (!conversationId || !token) return;
    atlas.notifications.markReadBySource(token, "chat_conversation", conversationId).catch(() => {});
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
  }, [conversationId, token, queryClient]);

  return query;
}

export function useSendMessage(conversationId) {
  const { session, userProfile } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data) => atlas.chat.sendMessage(conversationId, data, token),

    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: ["chat-messages", conversationId] });
      const previous = queryClient.getQueryData(["chat-messages", conversationId]);

      const tempId = `temp-${Date.now()}-${Math.random()}`;
      const optimistic = {
        id: tempId,
        conversation_id: conversationId,
        sender_user_id: userProfile?.id,
        sender_type: "user",
        body: data.body ?? null,
        message_type: data.messageType ?? "text",
        attachment_count: data.attachmentIds?.length ?? 0,
        metadata: {},
        created_at: new Date().toISOString(),
        edited_at: null,
        deleted_at: null,
        sender: {
          id: userProfile?.id,
          displayName: userProfile?.displayName ?? null,
          avatarUrl: userProfile?.avatarUrl ?? null,
        },
        attachments: null,
        _pending: true,
      };

      queryClient.setQueryData(["chat-messages", conversationId], (old) => {
        if (!old) return old;
        return { ...old, data: [...(old.data ?? []), optimistic] };
      });

      return { previous, tempId };
    },

    onError: (_err, _data, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["chat-messages", conversationId], context.previous);
      }
    },

    onSuccess: (result, _data, context) => {
      const real = result?.data;
      queryClient.setQueryData(["chat-messages", conversationId], (old) => {
        if (!old) return old;
        // Remove the temp message
        const withoutTemp = (old.data ?? []).filter((m) => m.id !== context.tempId);
        if (!real) return { ...old, data: withoutTemp };
        // Add real if not already present (realtime may have beaten us)
        const already = withoutTemp.some((m) => m.id === real.id);
        if (already) return { ...old, data: withoutTemp };
        return { ...old, data: [...withoutTemp, real] };
      });
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
