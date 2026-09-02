import { useEffect, useMemo, useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useAuth } from "../../../auth/AuthProvider";
import { atlas } from "../../../lib/atlas";

const MIN_LEN = 2;
const DEBOUNCE_MS = 250;

// Debounced fuzzy message search backed by GET /chat/search/messages. Pass
// `conversationId` to scope to one conversation (in-conversation search), omit
// it for a global search across every conversation the caller belongs to.
export function useChatMessageSearch({ q, conversationId = null, limit = 30, enabled = true }) {
  const { session } = useAuth();
  const token = session?.access_token;
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const trimmed = (q ?? "").trim();
    const handle = setTimeout(() => setDebounced(trimmed), DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [q]);

  const active = enabled && Boolean(token) && debounced.length >= MIN_LEN;

  const query = useQuery({
    queryKey: ["chat-message-search", conversationId ?? "global", debounced, limit],
    queryFn: () =>
      atlas.chat.searchMessages(
        { q: debounced, conversationId: conversationId ?? undefined, limit },
        token,
      ),
    enabled: active,
    staleTime: 15_000,
    placeholderData: keepPreviousData,
  });

  const hits = query.data?.data ?? [];

  // In-conversation navigation is chronological (newest match first), matching
  // WhatsApp's in-chat search; global results keep the server's relevance order.
  const orderedHitIds = useMemo(() => {
    if (!conversationId) return hits.map((h) => h.messageId);
    return [...hits]
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))
      .map((h) => h.messageId);
  }, [hits, conversationId]);

  return {
    hits,
    orderedHitIds,
    truncated: Boolean(query.data?.truncated),
    isSearching: active && query.isFetching,
    isError: query.isError,
    hasQuery: debounced.length >= MIN_LEN,
  };
}
