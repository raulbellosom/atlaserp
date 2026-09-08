// apps/desktop/src/modules/atlas.chat/hooks/useMeridianPanel.js
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { atlas } from "../../../lib/atlas";
import { useAuth } from "../../../auth/AuthProvider";

// The private per-conversation MeridIAn panel thread (Spec 2).
export function useMeridianPanelThread(conversationId, { enabled = true } = {}) {
  const { session } = useAuth();
  const token = session?.access_token;
  return useQuery({
    queryKey: ["chat-meridian-panel", conversationId],
    enabled: enabled && Boolean(token && conversationId),
    staleTime: 0,
    queryFn: async () => {
      const res = await atlas.chat.meridian.panel(conversationId, token);
      return res?.data ?? { threadId: null, messages: [] };
    },
  });
}

export function useSendMeridianPanel(conversationId) {
  const { session } = useAuth();
  const token = session?.access_token;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ content, focusMessageId }) =>
      atlas.chat.meridian.panelSend(
        conversationId,
        { content, focusMessageId: focusMessageId ?? undefined },
        token,
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chat-meridian-panel", conversationId] }),
  });
}

export function useClearMeridianPanel(conversationId) {
  const { session } = useAuth();
  const token = session?.access_token;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => atlas.chat.meridian.panelClear(conversationId, token),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chat-meridian-panel", conversationId] }),
  });
}
