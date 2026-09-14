import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../../auth/AuthProvider";
import { atlas } from "../../../lib/atlas";

// GET /chat/conversations/:id — the full member list (with role info, after
// Plan A), unlike the conversation LIST query which only returns a 5-member
// preview. `useAddMembers` (useCreateConversation.js) already invalidates this
// exact query key; before this hook existed, nothing ever fetched it.
export function useChatConversationDetail(conversationId) {
  const { session } = useAuth();
  const token = session?.access_token;

  return useQuery({
    queryKey: ["chat-conversation", conversationId],
    queryFn: () => atlas.chat.getConversation(conversationId, token),
    enabled: Boolean(token && conversationId),
    staleTime: 15_000,
  });
}
