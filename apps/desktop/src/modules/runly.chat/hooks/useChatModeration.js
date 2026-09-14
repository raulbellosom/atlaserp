import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../../auth/AuthProvider";
import { runly } from "../../../lib/runly";

export function useMuteConversation() {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ conversationId, muted }) => runly.chat.muteConversation(conversationId, muted, token),
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
    queryFn: () => runly.chat.getBlockStatus(targetUserId, token),
    enabled: Boolean(token && targetUserId && enabled),
    staleTime: 30_000,
  });
}

export function useBlockUser() {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (targetUserId) => runly.chat.blockUser(targetUserId, token),
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
    mutationFn: (targetUserId) => runly.chat.unblockUser(targetUserId, token),
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
    queryFn: () => runly.chat.getGroupsInCommon(targetUserId, token),
    enabled: Boolean(token && targetUserId && enabled),
    staleTime: 60_000,
  });
}

export function useCreateReport() {
  const { session } = useAuth();
  const token = session?.access_token;

  return useMutation({
    mutationFn: (payload) => runly.chat.createReport(payload, token),
  });
}

export function useChatReports(status) {
  const { session } = useAuth();
  const token = session?.access_token;

  return useQuery({
    queryKey: ["chat-reports", status ?? "all"],
    queryFn: () => runly.chat.listReports(status ? { status } : {}, token),
    enabled: Boolean(token),
    staleTime: 15_000,
  });
}

export function useResolveReport() {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ reportId, action }) => runly.chat.resolveReport(reportId, action, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-reports"] });
    },
  });
}
