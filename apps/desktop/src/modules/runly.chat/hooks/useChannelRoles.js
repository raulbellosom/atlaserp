import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../../auth/AuthProvider";
import { runly } from "../../../lib/runly";

export function useChannelRoles(conversationId) {
  const { session } = useAuth();
  const token = session?.access_token;

  return useQuery({
    queryKey: ["chat-channel-roles", conversationId],
    queryFn: () => runly.chat.listChannelRoles(conversationId, token),
    enabled: Boolean(token && conversationId),
    staleTime: 15_000,
  });
}

function useInvalidateRolesAndMembers(conversationId, queryClient) {
  return () => {
    queryClient.invalidateQueries({ queryKey: ["chat-channel-roles", conversationId] });
    queryClient.invalidateQueries({ queryKey: ["chat-conversation", conversationId] });
  };
}

export function useCreateChannelRole(conversationId) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const invalidate = useInvalidateRolesAndMembers(conversationId, queryClient);

  return useMutation({
    mutationFn: (data) => runly.chat.createChannelRole(conversationId, data, token),
    onSuccess: invalidate,
  });
}

export function useUpdateChannelRole(conversationId) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const invalidate = useInvalidateRolesAndMembers(conversationId, queryClient);

  return useMutation({
    mutationFn: ({ roleId, data }) => runly.chat.updateChannelRole(conversationId, roleId, data, token),
    onSuccess: invalidate,
  });
}

export function useDeleteChannelRole(conversationId) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const invalidate = useInvalidateRolesAndMembers(conversationId, queryClient);

  return useMutation({
    mutationFn: (roleId) => runly.chat.deleteChannelRole(conversationId, roleId, token),
    onSuccess: invalidate,
  });
}

export function useAssignMemberRole(conversationId) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const invalidate = useInvalidateRolesAndMembers(conversationId, queryClient);

  return useMutation({
    mutationFn: ({ memberId, roleId }) => runly.chat.assignMemberRole(conversationId, memberId, roleId, token),
    onSuccess: invalidate,
  });
}
