import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useEffect, useLayoutEffect, useRef, useCallback, useState, useMemo } from "react";
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

  // Older pages accumulated via "load more" — stored separately from the latest page
  const [olderMessages, setOlderMessages] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const hasInitialized = useRef(false);

  const query = useQuery({
    queryKey: ["chat-messages", conversationId],
    queryFn: () => atlas.chat.listMessages(conversationId, { limit: 40 }, token),
    enabled: Boolean(token && conversationId),
    staleTime: 5_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  // Initialize hasMore from the first successful fetch of this conversation
  useEffect(() => {
    if (query.data && !hasInitialized.current) {
      hasInitialized.current = true;
      setHasMore(query.data.hasMore ?? false);
    }
  }, [query.data]);

  // Reset older pages and hasMore when conversation changes
  useEffect(() => {
    hasInitialized.current = false;
    setOlderMessages([]);
    setHasMore(false);
    setIsLoadingMore(false);
  }, [conversationId]);

  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore || !token || !conversationId) return;

    // The oldest message is the first in the combined list (olderMessages are prepended)
    const latestData = queryClient.getQueryData(["chat-messages", conversationId])?.data ?? [];
    const oldestMsg = olderMessages.length > 0 ? olderMessages[0] : latestData[0];
    if (!oldestMsg?.created_at) return;

    setIsLoadingMore(true);
    try {
      const result = await atlas.chat.listMessages(conversationId, {
        limit: 40,
        before: oldestMsg.created_at,
      }, token);

      const newOlder = result?.data ?? [];
      setOlderMessages((prev) => {
        const existingIds = new Set(prev.map((m) => m.id));
        return [...newOlder.filter((m) => !existingIds.has(m.id)), ...prev];
      });
      setHasMore(result?.hasMore ?? false);
    } catch (err) {
      console.error("[chat] loadMore failed", err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMore, token, conversationId, olderMessages, queryClient]);

  const addMessageToCache = useCallback(
    (newMsg) => {
      queryClient.setQueryData(["chat-messages", conversationId], (old) => {
        if (!old) return old;
        const already = old.data?.some((m) => m.id === newMsg.id);
        if (already) return old;
        const filtered = (old.data ?? []).filter(
          (m) => !(m._pending && m.body === newMsg.body && m.message_type === newMsg.message_type),
        );
        return { ...old, data: [...filtered, newMsg] };
      });
      queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
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

  const messageHandlerRef = useRef(null);
  useLayoutEffect(() => {
    messageHandlerRef.current = (payload) => {
      if (payload.eventType === "INSERT") addMessageToCache(payload.new);
      else if (payload.eventType === "UPDATE") updateMessageInCache(payload.new);
    };
  });

  useEffect(() => {
    if (!conversationId) return;
    unsubRef.current = subscribeToMessages(conversationId, (payload) => {
      messageHandlerRef.current?.(payload);
    });
    return () => { unsubRef.current?.(); };
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId) return;
    return on("chat.message.new", ({ conversationId: cid }) => {
      if (cid === conversationId) {
        queryClient.invalidateQueries({ queryKey: ["chat-messages", conversationId] });
      }
    });
  }, [conversationId, on, queryClient]);

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

  useEffect(() => {
    if (!conversationId || !token) return;
    atlas.notifications.markReadBySource(token, "chat_conversation", conversationId).catch(() => {});
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
  }, [conversationId, token, queryClient]);

  // Combine older pages with the latest page, deduplicating by id
  const latestMessages = query.data?.data ?? [];
  const combinedData = useMemo(() => {
    if (!olderMessages.length) return latestMessages;
    const seen = new Set(olderMessages.map((m) => m.id));
    return [...olderMessages, ...latestMessages.filter((m) => !seen.has(m.id))];
  }, [olderMessages, latestMessages]);

  return {
    ...query,
    data: query.data ? { ...query.data, data: combinedData } : query.data,
    hasMore,
    isLoadingMore,
    loadMore,
  };
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
        const withoutTemp = (old.data ?? []).filter((m) => m.id !== context.tempId);
        if (!real) return { ...old, data: withoutTemp };
        const already = withoutTemp.some((m) => m.id === real.id);
        if (already) {
          return { ...old, data: withoutTemp.map((m) => (m.id === real.id ? { ...m, ...real } : m)) };
        }
        return { ...old, data: [...withoutTemp, real] };
      });
      queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
      queryClient.invalidateQueries({ queryKey: ["chat-messages", conversationId] });
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

export function useDeleteMessage(conversationId) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (messageId) => atlas.chat.deleteMessage(messageId, token),
    onMutate: async (messageId) => {
      await queryClient.cancelQueries({ queryKey: ["chat-messages", conversationId] });
      const previous = queryClient.getQueryData(["chat-messages", conversationId]);
      queryClient.setQueryData(["chat-messages", conversationId], (old) => {
        if (!old) return old;
        return {
          ...old,
          data: (old.data ?? []).map((m) =>
            m.id === messageId
              ? { ...m, deleted_at: new Date().toISOString(), body: "" }
              : m,
          ),
        };
      });
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["chat-messages", conversationId], context.previous);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-messages", conversationId] });
    },
  });
}
