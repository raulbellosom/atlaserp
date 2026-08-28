import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "../../../auth/AuthProvider";
import { atlas } from "../../../lib/atlas";

export function useCreateConversation() {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data) => atlas.chat.createConversation(data, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
    },
  });
}

export function useAddMembers(conversationId) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data) => atlas.chat.addMembers(conversationId, data, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
      queryClient.invalidateQueries({ queryKey: ["chat-conversation", conversationId] });
    },
  });
}

export function useRemoveMember(conversationId) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId) => atlas.chat.removeMember(conversationId, userId, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
      queryClient.invalidateQueries({ queryKey: ["chat-conversation", conversationId] });
    },
    // The backend already blocks removing/leaving as the sole Owner (chat-service.js's
    // removeMember calls isLastOwner unconditionally, self-removal included) — this was
    // previously failing silently on the frontend with no feedback. err.message is the
    // SDK-surfaced backend error text itself (packages/sdk), already the right,
    // actionable copy ("...Asigna otro Owner primero."), so show it directly.
    onError: (err) => toast.error(err?.message ?? "No se pudo completar la accion."),
  });
}

export function useDeleteConversation(conversationId) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => atlas.chat.deleteConversation(conversationId, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
      queryClient.removeQueries({ queryKey: ["chat-conversation", conversationId] });
    },
    onError: (err) => toast.error(err?.message ?? "No se pudo eliminar el canal."),
  });
}
