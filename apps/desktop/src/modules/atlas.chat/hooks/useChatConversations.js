import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useAuth } from "../../../auth/AuthProvider";
import { atlas } from "../../../lib/atlas";
import { subscribeToConversationList } from "../lib/supabaseRealtime";

export function useChatConversations() {
  const { session, userProfile } = useAuth();
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
    if (!userProfile?.id) return;

    unsubRef.current = subscribeToConversationList(userProfile.id, () => {
      queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
    });

    return () => {
      unsubRef.current?.();
    };
  }, [userProfile?.id, queryClient]);

  return query;
}
