import { useState, useRef, useEffect, useCallback } from "react";
import { CalendarX } from "lucide-react";
import { LoadingState } from "@atlas/ui";
import { useCalendarStore } from "../stores/useCalendarStore";
import { useYearEvents } from "../hooks/useCalendarData";
import EventChip from "./EventChip";

const MONTHS = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];
const WEEKDAYS = [
  "domingo",
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
];

function dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dateKeyUTC(d) {
  const dt = new Date(d);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

function addWeeks(dateStr, n) {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + n * 7);
  return d.toISOString().slice(0, 10);
}

function groupByDate(events) {
  const map = {};
  for (const ev of events) {
    // All-day events are stored as UTC midnight — use UTC date to avoid local-tz shift
    const k = ev.allDay
      ? dateKeyUTC(ev.startAt)
      : dateKey(new Date(ev.startAt));
    if (!map[k]) map[k] = [];
    map[k].push(ev);
  }
  return map;
}

export default function AgendaView({ onEventClick }) {
  const { selectedDate, activeCalendarIds } = useCalendarStore();
  const [weeksLoaded, setWeeksLoaded] = useState(3);
  const bottomRef = useRef(null);

  const base = selectedDate || new Date().toISOString().slice(0, 10);
  const baseYear = new Date(base + "T12:00:00").getFullYear();
  const rangeEnd = addWeeks(base, weeksLoaded);
  const endYear = new Date(rangeEnd + "T12:00:00").getFullYear();

  // Pre-load base year + next two years so scroll never triggers a server fetch
  const { data: yearEvents = [], isFetching: fetchingCur } = useYearEvents(baseYear, activeCalendarIds);
  const { data: nextYearEvents = [], isFetching: fetchingNext } = useYearEvents(baseYear + 1, activeCalendarIds);
  const { data: twoYearEvents = [], isFetching: fetchingTwo } = useYearEvents(baseYear + 2, activeCalendarIds, endYear > baseYear + 1);

  const isFetching = fetchingCur || fetchingNext || fetchingTwo;

  const allEvents = [
    ...yearEvents,
    ...nextYearEvents,
    ...(endYear > baseYear + 1 ? twoYearEvents : []),
  ];

  const byDate = groupByDate(allEvents);
  const today = new Date();

  const days = [];
  const cursor = new Date(base + "T12:00:00");
  const endDate = new Date(rangeEnd + "T12:00:00");
  while (cursor <= endDate) {
    const k = dateKey(cursor);
    if (byDate[k]?.length)
      days.push({ key: k, date: new Date(cursor), events: byDate[k] });
    cursor.setDate(cursor.getDate() + 1);
  }

  const loadMore = useCallback(() => {
    if (!isFetching) setWeeksLoaded((w) => w + 2);
  }, [isFetching]);

  useEffect(() => {
    const el = bottomRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) loadMore();
      },
      { threshold: 0.1 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [loadMore]);

  if (!isFetching && days.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-8">
        <CalendarX
          size={36}
          className="text-[hsl(var(--muted-foreground))] opacity-40"
        />
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Sin eventos proximos
        </p>
        <p className="text-xs text-[hsl(var(--muted-foreground))] opacity-60">
          No hay eventos en las proximas semanas
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-5">
      {days.map(({ key, date, events: dayEvents }) => {
        const isToday = dateKey(today) === key;
        return (
          <div key={key} className="flex gap-4">
            <div className="w-16 shrink-0 pt-1 text-right">
              <div
                className={[
                  "text-xl font-semibold leading-none",
                  isToday ? "text-violet-600" : "text-[hsl(var(--foreground))]",
                ].join(" ")}
              >
                {date.getDate()}
              </div>
              <div className="text-[10px] text-[hsl(var(--muted-foreground))] capitalize mt-0.5">
                {WEEKDAYS[date.getDay()].slice(0, 3)}
              </div>
              <div className="text-[10px] text-[hsl(var(--muted-foreground))]">
                {MONTHS[date.getMonth()].slice(0, 3)}
              </div>
            </div>
            <div className="min-w-0 flex-1 space-y-1.5 border-l border-[hsl(var(--border))] pl-4">
              {dayEvents.map((ev) => (
                <EventChip key={ev.id} event={ev} onClick={onEventClick} />
              ))}
            </div>
          </div>
        );
      })}

      <div ref={bottomRef} className="py-4 text-center">
        {isFetching && (
          <LoadingState
            variant="inline"
            size="sm"
            message="Cargando más eventos..."
          />
        )}
      </div>
    </div>
  );
}
