import test from "node:test";
import assert from "node:assert/strict";

import {
  splitVisibleEvents,
  filterEventsForHour,
} from "../calendar-overflow.js";

test("splitVisibleEvents limits visible events and reports hidden count", () => {
  const events = [{ id: "1" }, { id: "2" }, { id: "3" }];
  const result = splitVisibleEvents(events, 2);

  assert.equal(result.visible.length, 2);
  assert.equal(result.hiddenCount, 1);
  assert.deepEqual(
    result.visible.map((event) => event.id),
    ["1", "2"],
  );
});

test("filterEventsForHour keeps only timed events for one local hour", () => {
  const currentOffsetMinutes = new Date().getTimezoneOffset();
  const eventHour = currentOffsetMinutes === 0 ? "2026-06-08T12:15:00.000Z" : "2026-06-08T12:15:00";
  const otherHour = currentOffsetMinutes === 0 ? "2026-06-08T13:15:00.000Z" : "2026-06-08T13:15:00";

  const events = [
    { id: "a", allDay: false, startAt: eventHour },
    { id: "b", allDay: true, startAt: "2026-06-08T00:00:00.000Z" },
    { id: "c", allDay: false, startAt: otherHour },
  ];

  const result = filterEventsForHour(events, 12);

  assert.deepEqual(
    result.map((event) => event.id),
    ["a"],
  );
});
