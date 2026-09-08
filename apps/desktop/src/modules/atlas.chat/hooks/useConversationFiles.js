import { loadConversationFiles } from "../lib/conversationFiles";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../../auth/AuthProvider";
import { atlas } from "../../../lib/atlas";

// Independent history query: opening files must not change chat scroll or realtime subscriptions.
export function useConversationFiles(conversationId, enabled = true) {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["chat-messages", conversationId, "files-history"],
    enabled: Boolean(enabled && conversationId && session?.access_token),
    staleTime: 30_000,
    queryFn: ({ signal }) => loadConversationFiles(
      (params) => atlas.chat.listMessages(conversationId, params, session.access_token), signal,
    ),
  });
}
