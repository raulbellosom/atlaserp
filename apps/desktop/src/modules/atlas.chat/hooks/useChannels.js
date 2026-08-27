import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../../auth/AuthProvider";
import { atlas } from "../../../lib/atlas";

export function useCreateChannel() {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data) => atlas.chat.createChannel(data, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
    },
  });
}

export function useChannelDirectory(params = {}) {
  const { session } = useAuth();
  const token = session?.access_token;

  return useQuery({
    queryKey: ["chat-channel-directory", params],
    queryFn: () => atlas.chat.listChannelDirectory(params, token),
    enabled: Boolean(token),
    staleTime: 30_000,
  });
}

export function useJoinChannel() {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (conversationId) => atlas.chat.joinChannel(conversationId, token),
    // Await the conversations refetch so the caller can navigate straight to the
    // freshly joined channel without the window flashing its empty state while
    // the list catches up.
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
      queryClient.invalidateQueries({ queryKey: ["chat-channel-directory"] });
    },
  });
}
