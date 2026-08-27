import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../../auth/AuthProvider";
import { atlas } from "../../../lib/atlas";

export function useMuteConversation() {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ conversationId, muted }) => atlas.chat.muteConversation(conversationId, muted, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
      queryClient.invalidateQueries({ queryKey: ["chat-conversations-archived"] });
    },
  });
}

export function useBlockStatus(targetUserId, { enabled = true } = {}) {
  const { session } = useAuth();
  const token = session?.access_token;

  return useQuery({
    queryKey: ["chat-block-status", targetUserId],
    queryFn: () => atlas.chat.getBlockStatus(targetUserId, token),
    enabled: Boolean(token && targetUserId && enabled),
    staleTime: 30_000,
  });
}

export function useBlockUser() {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (targetUserId) => atlas.chat.blockUser(targetUserId, token),
    onSuccess: (_data, targetUserId) => {
      queryClient.invalidateQueries({ queryKey: ["chat-block-status", targetUserId] });
    },
  });
}

export function useUnblockUser() {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (targetUserId) => atlas.chat.unblockUser(targetUserId, token),
    onSuccess: (_data, targetUserId) => {
      queryClient.invalidateQueries({ queryKey: ["chat-block-status", targetUserId] });
    },
  });
}

export function useGroupsInCommon(targetUserId, { enabled = true } = {}) {
  const { session } = useAuth();
  const token = session?.access_token;

  return useQuery({
    queryKey: ["chat-groups-in-common", targetUserId],
    queryFn: () => atlas.chat.getGroupsInCommon(targetUserId, token),
    enabled: Boolean(token && targetUserId && enabled),
    staleTime: 60_000,
  });
}

export function useCreateReport() {
  const { session } = useAuth();
  const token = session?.access_token;

  return useMutation({
    mutationFn: (payload) => atlas.chat.createReport(payload, token),
  });
}

export function useChatReports(status) {
  const { session } = useAuth();
  const token = session?.access_token;

  return useQuery({
    queryKey: ["chat-reports", status ?? "all"],
    queryFn: () => atlas.chat.listReports(status ? { status } : {}, token),
    enabled: Boolean(token),
    staleTime: 15_000,
  });
}

export function useResolveReport() {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ reportId, action }) => atlas.chat.resolveReport(reportId, action, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-reports"] });
    },
  });
}
