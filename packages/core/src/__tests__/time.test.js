import { test } from "node:test";
import assert from "node:assert/strict";
import { nowLocalParts, toLocalIso, toLocalMonth } from "../time.js";

// 2026-08-31T02:03:00Z is still 2026-08-30 20:03 in America/Mexico_City (UTC-6).
const LATE_NIGHT = new Date("2026-08-31T02:03:00.000Z");

test("toLocalIso uses the configured zone, not UTC", () => {
  const prev = process.env.TZ;
  const prevAtlas = process.env.ATLAS_TIME_ZONE;
  process.env.ATLAS_TIME_ZONE = "America/Mexico_City";
  delete process.env.TZ;
  try {
    assert.equal(toLocalIso(LATE_NIGHT), "2026-08-30");
    assert.equal(toLocalMonth(LATE_NIGHT), "2026-08");
    assert.deepEqual(nowLocalParts(LATE_NIGHT), { year: "2026", month: "08", day: "30" });
  } finally {
    if (prev === undefined) delete process.env.TZ; else process.env.TZ = prev;
    if (prevAtlas === undefined) delete process.env.ATLAS_TIME_ZONE;
    else process.env.ATLAS_TIME_ZONE = prevAtlas;
  }
});

test("falls back to UTC when no zone is configured", () => {
  const prev = process.env.TZ;
  const prevAtlas = process.env.ATLAS_TIME_ZONE;
  delete process.env.TZ;
  delete process.env.ATLAS_TIME_ZONE;
  try {
    assert.equal(toLocalIso(LATE_NIGHT), "2026-08-31");
    assert.equal(toLocalMonth(LATE_NIGHT), "2026-08");
  } finally {
    if (prev !== undefined) process.env.TZ = prev;
    if (prevAtlas !== undefined) process.env.ATLAS_TIME_ZONE = prevAtlas;
  }
});

test("toLocalIso() with no arg returns a YYYY-MM-DD string", () => {
  assert.match(toLocalIso(), /^\d{4}-\d{2}-\d{2}$/);
  assert.match(toLocalMonth(), /^\d{4}-\d{2}$/);
});
