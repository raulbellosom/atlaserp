export function splitVisibleEvents(events, maxVisible = 2) {
  const safeEvents = Array.isArray(events) ? events : [];
  const limit = Math.max(0, Number(maxVisible) || 0);

  return {
    visible: safeEvents.slice(0, limit),
    hidden: safeEvents.slice(limit),
    hiddenCount: Math.max(0, safeEvents.length - limit),
  };
}

export function filterEventsForHour(events, hour) {
  return (Array.isArray(events) ? events : []).filter((event) => {
    if (event?.allDay) return false;
    return new Date(event.startAt).getHours() === hour;
  });
}

export function formatHourRangeLabel(hour) {
  const safeHour = Math.max(0, Math.min(23, Number(hour) || 0));
  const from = String(safeHour).padStart(2, "0");
  return `${from}:00 - ${from}:59`;
}
