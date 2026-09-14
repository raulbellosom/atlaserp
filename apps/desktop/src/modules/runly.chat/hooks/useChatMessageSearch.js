import { useEffect, useMemo, useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useAuth } from "../../../auth/AuthProvider";
import { atlas } from "../../../lib/atlas";

// In-conversation search runs from the first non-space char (the server
// tokenizer already handles 1-char queries — a `y`/`de` search should just
// work). Global search across every conversation keeps a 2-char floor so a
// single keystroke doesn't fan out over the whole history.
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

  const minLen = conversationId ? 1 : 2;
  const active = enabled && Boolean(token) && debounced.length >= minLen;

  const query = useQuery({
    queryKey: ["chat-message-search", conversationId ?? "global", debounced, limit],
    queryFn: () =>
      atlas.chat.searchMessages(
        { q: debounced, conversationId: conversationId ?? undefined, limit },
        token,
      ),
    enabled: active,
    staleTime: 15_000,
    // Absorb a transient 401 during token refresh so the header doesn't flash
    // "Error al buscar" on an otherwise-fine query.
    retry: 1,
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
    // `hasQuery` is true only once the (debounced, trimmed) query is long
    // enough for the search to actually run — the caller uses it to tell a
    // real "Sin resultados" apart from "keep typing", and to gate the
    // in-bubble highlight so marks never appear without a match count.
    hasQuery: active,
  };
}
