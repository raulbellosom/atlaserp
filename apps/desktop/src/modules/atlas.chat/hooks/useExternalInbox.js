import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useAuth } from "../../../auth/AuthProvider";
import { atlas } from "../../../lib/atlas";
import { subscribeToBroadcast, subscribeToMessages } from "../lib/supabaseRealtime";

export function useExternalInbox(status = "open") {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const unsubRef = useRef(null);

  const query = useQuery({
    queryKey: ["chat-external-inbox", status],
    queryFn: () => atlas.chat.listExternalInbox({ status }, token),
    enabled: Boolean(token),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  // Listen for guest messages and refresh inbox
  useEffect(() => {
    unsubRef.current = subscribeToBroadcast(
      "chat:external:inbox",
      "new_guest_message",
      () => {
        queryClient.invalidateQueries({ queryKey: ["chat-external-inbox"] });
      },
    );
    return () => unsubRef.current?.();
  }, [queryClient]);

  return query;
}

export function useExternalMessages(conversationId) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const unsubRef = useRef(null);

  const query = useQuery({
    queryKey: ["chat-external-messages", conversationId],
    queryFn: () => atlas.chat.listExternalMessages(conversationId, { limit: 40 }, token),
    enabled: Boolean(token && conversationId),
    staleTime: 10_000,
  });

  useEffect(() => {
    if (!conversationId) return;

    unsubRef.current = subscribeToMessages(conversationId, () => {
      queryClient.invalidateQueries({ queryKey: ["chat-external-messages", conversationId] });
      queryClient.invalidateQueries({ queryKey: ["chat-external-inbox"] });
    });

    return () => unsubRef.current?.();
  }, [conversationId, queryClient]);

  return query;
}

export function useSendExternalMessage(conversationId) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data) => atlas.chat.sendExternalMessage(conversationId, data, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-external-messages", conversationId] });
      queryClient.invalidateQueries({ queryKey: ["chat-external-inbox"] });
    },
  });
}
