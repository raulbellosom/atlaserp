import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../../auth/AuthProvider";
import { atlas } from "../../../lib/atlas";

function useGoogleCalendarQueryContext() {
  const { session } = useAuth();
  return {
    token: session?.access_token ?? null,
    authUserId: session?.user?.id ?? "anonymous",
    sessionScope: session?.session_id ?? session?.expires_at ?? "no-session",
  };
}

function getGoogleCalendarBaseQueryKey({ authUserId, sessionScope }) {
  return ["calendar", "google", authUserId, sessionScope];
}

function getGoogleCalendarStatusQueryKey(queryContext) {
  return [...getGoogleCalendarBaseQueryKey(queryContext), "status"];
}

function getGoogleCalendarCalendarsQueryKey(queryContext) {
  return [...getGoogleCalendarBaseQueryKey(queryContext), "calendars"];
}

function getGoogleCalendarSourcesQueryKey(queryContext) {
  return [...getGoogleCalendarBaseQueryKey(queryContext), "sources"];
}

export function useGoogleCalendarStatus() {
  const queryContext = useGoogleCalendarQueryContext();
  const { token } = queryContext;

  return useQuery({
    queryKey: getGoogleCalendarStatusQueryKey(queryContext),
    queryFn: () => atlas.calendar.getGoogleStatus(token),
    enabled: Boolean(token),
    staleTime: 30 * 1000,
  });
}

export function useStartGoogleCalendarConnect() {
  const queryContext = useGoogleCalendarQueryContext();
  const { token } = queryContext;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => atlas.calendar.startGoogleConnect(token),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: getGoogleCalendarStatusQueryKey(queryContext),
      });
      queryClient.invalidateQueries({
        queryKey: getGoogleCalendarCalendarsQueryKey(queryContext),
      });
      queryClient.invalidateQueries({
        queryKey: getGoogleCalendarSourcesQueryKey(queryContext),
      });
    },
  });
}

export function useFinishGoogleCalendarConnect() {
  const queryContext = useGoogleCalendarQueryContext();
  const { token } = queryContext;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (query) => atlas.calendar.finishGoogleConnect(query, token),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: getGoogleCalendarStatusQueryKey(queryContext),
      });
      queryClient.invalidateQueries({
        queryKey: getGoogleCalendarCalendarsQueryKey(queryContext),
      });
      queryClient.invalidateQueries({
        queryKey: getGoogleCalendarSourcesQueryKey(queryContext),
      });
      queryClient.invalidateQueries({ queryKey: ["calendar", "calendars"] });
    },
  });
}

export function useGoogleCalendarList(enabled = true) {
  const queryContext = useGoogleCalendarQueryContext();
  const { token } = queryContext;

  return useQuery({
    queryKey: getGoogleCalendarCalendarsQueryKey(queryContext),
    queryFn: () => atlas.calendar.listGoogleCalendars(token),
    enabled: Boolean(token && enabled),
    staleTime: 60 * 1000,
  });
}

export function useGoogleCalendarSources(enabled = true) {
  const queryContext = useGoogleCalendarQueryContext();
  const { token } = queryContext;

  return useQuery({
    queryKey: getGoogleCalendarSourcesQueryKey(queryContext),
    queryFn: () => atlas.calendar.listGoogleSources(token),
    enabled: Boolean(token && enabled),
    staleTime: 5 * 1000,
    retry: false,
    refetchInterval: (query) => {
      if (query.state.error) return false;
      const items = query.state.data?.items ?? [];
      return items.some(
        (item) =>
          item.syncStatus === "SYNCING" ||
          item.syncStatus === "PENDING_INITIAL_SYNC",
      )
        ? 3000
        : false;
    },
  });
}

export function useSaveGoogleCalendarSources() {
  const queryContext = useGoogleCalendarQueryContext();
  const { token } = queryContext;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) => atlas.calendar.saveGoogleSources(payload, token),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: getGoogleCalendarStatusQueryKey(queryContext),
      });
      queryClient.invalidateQueries({
        queryKey: getGoogleCalendarCalendarsQueryKey(queryContext),
      });
      queryClient.invalidateQueries({
        queryKey: getGoogleCalendarSourcesQueryKey(queryContext),
      });
      queryClient.invalidateQueries({ queryKey: ["calendar", "calendars"] });
    },
  });
}

export function useDisconnectGoogleCalendar() {
  const queryContext = useGoogleCalendarQueryContext();
  const { token } = queryContext;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ deleteEvents = false } = {}) =>
      atlas.calendar.disconnectGoogleCalendar(token, { deleteEvents }),
    onSuccess: () => {
      // Remove sources + calendars caches immediately so refetchInterval stops polling
      queryClient.removeQueries({
        queryKey: getGoogleCalendarSourcesQueryKey(queryContext),
      });
      queryClient.removeQueries({
        queryKey: getGoogleCalendarCalendarsQueryKey(queryContext),
      });
      // Flip status to disconnected immediately so isConnected becomes false right away
      queryClient.setQueryData(
        getGoogleCalendarStatusQueryKey(queryContext),
        (old) => {
          if (!old) return old;
          return {
            ...old,
            connection: old.connection
              ? { ...old.connection, status: "REVOKED" }
              : null,
          };
        },
      );
      // Then refetch status in background for confirmation
      queryClient.invalidateQueries({
        queryKey: getGoogleCalendarStatusQueryKey(queryContext),
      });
      queryClient.invalidateQueries({ queryKey: ["calendar", "calendars"] });
      queryClient.invalidateQueries({ queryKey: ["calendar", "events"] });
    },
  });
}
