import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useAuth } from "../../../auth/AuthProvider";
import { atlas } from "../../../lib/atlas";
import { subscribeToConversationList } from "../lib/supabaseRealtime";

export function useChatConversations() {
  const { session, user } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const unsubRef = useRef(null);

  const query = useQuery({
    queryKey: ["chat-conversations"],
    queryFn: () => atlas.chat.listConversations({}, token),
    enabled: Boolean(token),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (!user?.id) return;

    unsubRef.current = subscribeToConversationList(user.id, () => {
      queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
    });

    return () => {
      unsubRef.current?.();
    };
  }, [user?.id, queryClient]);

  return query;
}
