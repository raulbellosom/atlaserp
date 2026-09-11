import { test } from "node:test";
import assert from "node:assert/strict";
import { mintGuestRealtimeToken } from "../guest-service.js";
import { verifySupabaseJwt } from "../../../services/jwt-verification.js";

const ORIGINAL_SECRET = process.env.SUPABASE_JWT_SECRET;

test.afterEach(() => {
  if (ORIGINAL_SECRET === undefined) delete process.env.SUPABASE_JWT_SECRET;
  else process.env.SUPABASE_JWT_SECRET = ORIGINAL_SECRET;
});

test("mintGuestRealtimeToken returns null when SUPABASE_JWT_SECRET is not configured", () => {
  delete process.env.SUPABASE_JWT_SECRET;
  assert.equal(mintGuestRealtimeToken("guest-session-1"), null);
});

test("mintGuestRealtimeToken returns null without a guestSessionId", () => {
  process.env.SUPABASE_JWT_SECRET = "test-secret";
  assert.equal(mintGuestRealtimeToken(null), null);
  assert.equal(mintGuestRealtimeToken(undefined), null);
});

test("mintGuestRealtimeToken mints a token whose claims a chat_conv_receive check can use", () => {
  process.env.SUPABASE_JWT_SECRET = "test-secret";
  const token = mintGuestRealtimeToken("guest-session-abc");

  const payload = verifySupabaseJwt(token, "test-secret");
  assert.ok(payload, "expected the minted token to verify against the configured secret");
  assert.equal(payload.role, "authenticated");
  assert.equal(payload.guest_session_id, "guest-session-abc");
  // sub deliberately mirrors guest_session_id, not a real user_profile id —
  // see the comment on mintGuestRealtimeToken for why this is safe.
  assert.equal(payload.sub, "guest-session-abc");

  const now = Math.floor(Date.now() / 1000);
  assert.ok(payload.exp > now, "expected a future expiry");
  assert.ok(payload.exp <= now + 30 * 60, "expected exp within the 30-minute TTL");
});

test("mintGuestRealtimeToken output is rejected under a different secret", () => {
  process.env.SUPABASE_JWT_SECRET = "test-secret";
  const token = mintGuestRealtimeToken("guest-session-abc");
  assert.equal(verifySupabaseJwt(token, "a-different-secret"), null);
});
