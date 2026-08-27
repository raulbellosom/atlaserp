// apps/desktop/src/modules/atlas.chat/components/ChannelEventsTab.jsx
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays } from "lucide-react";
import { EmptyState, ErrorState, Skeleton } from "@atlas/ui";
import { useAuth } from "../../../auth/AuthProvider";
import { atlas } from "../../../lib/atlas";

// Same source-filter idea as EntityReferencePicker's calendar_event case:
// listEvents requires start/end, so this uses a fixed 90-days-back /
// 365-days-ahead window rather than the calendar screen's own navigable range.
function useChannelEventsWindow() {
  const now = Date.now();
  return {
    start: new Date(now - 90 * 86400000).toISOString(),
    end: new Date(now + 365 * 86400000).toISOString(),
  };
}

function EventRow({ event }) {
  const date = new Date(event.startAt);
  const label = Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" });
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-b border-[hsl(var(--border))] last:border-0">
      <CalendarDays className="h-4 w-4 text-[hsl(var(--muted-foreground))] shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{event.title}</p>
        <p className="text-xs text-[hsl(var(--muted-foreground))]">{label}</p>
      </div>
    </div>
  );
}

export function ChannelEventsTab({ conversationId }) {
  const { session } = useAuth();
  const token = session?.access_token;
  const { start, end } = useState(useChannelEventsWindow)[0];

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["channel-events", conversationId],
    queryFn: () => atlas.calendar.listEvents(token, {
      start, end, source_module: "atlas.chat", source_entity_id: conversationId,
    }),
    enabled: Boolean(token && conversationId),
    staleTime: 30_000,
  });

  // atlas.calendar.listEvents returns the events array directly (not wrapped
  // in { data: [...] }) — confirmed against EntityReferencePicker.jsx's
  // calendar_event case (`(res ?? []).map(...)`) and useCalendarData.js's
  // useCalendarEvents/useYearEvents, both of which return the SDK call's
  // result straight through as the query's data.
  const events = data ?? [];

  if (isLoading) {
    return (
      <div className="space-y-2 px-4 py-2">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
      </div>
    );
  }

  if (isError) {
    return <ErrorState description="No se pudieron cargar los eventos." onRetry={refetch} />;
  }

  if (!events.length) {
    return (
      <EmptyState
        icon={CalendarDays}
        title="Sin eventos"
        description="Las reuniones agendadas desde este canal apareceran aqui."
      />
    );
  }

  return (
    <div className="flex flex-col">
      {events.map((event) => <EventRow key={event.id} event={event} />)}
    </div>
  );
}
