import { useQuery, useQueryClient } from "@tanstack/react-query";
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
