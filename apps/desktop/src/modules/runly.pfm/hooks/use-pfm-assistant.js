// apps/desktop/src/modules/runly.pfm/hooks/use-pfm-assistant.js
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../../auth/AuthProvider";
import { runly } from "../../../lib/atlas";

function useToken() {
  const { session } = useAuth();
  return session?.access_token ?? null;
}

const K = {
  status: ["pfm", "assistant", "status"],
  threads: ["pfm", "assistant", "threads"],
  thread: (id) => ["pfm", "assistant", "thread", id],
};

export function useAssistantStatus() {
  const token = useToken();
  return useQuery({
    queryKey: K.status,
    queryFn: () => runly.pfm.assistant.status(token),
    enabled: Boolean(token),
    retry: false,
    staleTime: 5 * 60 * 1000,
    // 403 (no permission) or 503 (no key) -> unavailable, no error surfaced
    select: (res) => Boolean(res?.data?.available),
  });
}

export function useAssistantThreads(enabled = true) {
  const token = useToken();
  return useQuery({
    queryKey: K.threads,
    queryFn: () => runly.pfm.assistant.listThreads(token),
    enabled: Boolean(token && enabled),
    select: (res) => res?.data ?? [],
  });
}

export function useAssistantThread(threadId) {
  const token = useToken();
  return useQuery({
    queryKey: K.thread(threadId),
    queryFn: () => runly.pfm.assistant.getThread(threadId, token),
    enabled: Boolean(token && threadId),
    select: (res) => res?.data ?? null,
  });
}

export function useSendAssistantMessage(threadId) {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (content) => runly.pfm.assistant.sendMessage(threadId, content, token),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: K.thread(threadId) });
      qc.invalidateQueries({ queryKey: K.threads });
    },
  });
}

export function useCreateAssistantThread() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => runly.pfm.assistant.createThread(token),
    onSuccess: () => qc.invalidateQueries({ queryKey: K.threads }),
  });
}

export function useDeleteAssistantThread() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => runly.pfm.assistant.deleteThread(id, token),
    onSuccess: () => qc.invalidateQueries({ queryKey: K.threads }),
  });
}
