import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../../auth/AuthProvider";
import { atlas } from "../../../lib/atlas";

export function usePinnedMessages(conversationId) {
  const { session } = useAuth();
  const token = session?.access_token;

  return useQuery({
    queryKey: ["chat-pinned-messages", conversationId],
    queryFn: () => atlas.chat.listPinnedMessages(conversationId, token),
    enabled: Boolean(token && conversationId),
    staleTime: 15_000,
  });
}
