import { test } from "node:test";
import assert from "node:assert/strict";
import { isSessionFresh, SESSION_FRESHNESS_LEEWAY_SECS } from "../sessionFreshness.js";

test("returns true for a session expiring well in the future", () => {
  const nowMs = 1_000_000_000_000;
  const session = { expires_at: Math.floor(nowMs / 1000) + 3600 };
  assert.equal(isSessionFresh(session, nowMs), true);
});

test("returns false for a session that already expired", () => {
  const nowMs = 1_000_000_000_000;
  const session = { expires_at: Math.floor(nowMs / 1000) - 60 };
  assert.equal(isSessionFresh(session, nowMs), false);
});

test("returns false for a session expiring within the leeway window", () => {
  const nowMs = 1_000_000_000_000;
  const session = {
    expires_at: Math.floor(nowMs / 1000) + Math.floor(SESSION_FRESHNESS_LEEWAY_SECS / 2),
  };
  assert.equal(isSessionFresh(session, nowMs), false);
});

test("returns false for null/undefined session", () => {
  assert.equal(isSessionFresh(null), false);
  assert.equal(isSessionFresh(undefined), false);
});

test("returns false for a session with no expires_at", () => {
  assert.equal(isSessionFresh({}), false);
});
