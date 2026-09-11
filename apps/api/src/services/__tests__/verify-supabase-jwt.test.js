import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { verifySupabaseJwt, signHs256Jwt } from "../jwt-verification.js";

// Minimal local HS256 JWT signer, deliberately mirroring the exact parsing logic
// in verifySupabaseJwt (header.payload.signature, '.'-joined base64url segments,
// signature = HMAC-SHA256(`${headerB64}.${payloadB64}`, secret) base64url-encoded)
// so this test does not depend on an external JWT library.
function base64url(input) {
  return Buffer.from(input).toString("base64url");
}

function signJwt(payload, secret) {
  const header = { alg: "HS256", typ: "JWT" };
  const headerB64 = base64url(JSON.stringify(header));
  const payloadB64 = base64url(JSON.stringify(payload));
  const signatureB64 = crypto
    .createHmac("sha256", secret)
    .update(`${headerB64}.${payloadB64}`)
    .digest("base64url");
  return `${headerB64}.${payloadB64}.${signatureB64}`;
}

const SECRET = "test-secret-for-verify-supabase-jwt";

test("accepts a token expired by less than the clock-skew leeway", () => {
  const now = Math.floor(Date.now() / 1000);
  const token = signJwt({ sub: "user-1", exp: now - 5 }, SECRET);

  const payload = verifySupabaseJwt(token, SECRET);

  assert.ok(payload, "expected token within leeway to be accepted");
  assert.equal(payload.sub, "user-1");
});

test("rejects a token expired by more than the clock-skew leeway", () => {
  const now = Math.floor(Date.now() / 1000);
  const token = signJwt({ sub: "user-1", exp: now - 30 }, SECRET);

  const payload = verifySupabaseJwt(token, SECRET);

  assert.equal(payload, null);
});

test("rejects a token with an invalid signature", () => {
  const now = Math.floor(Date.now() / 1000);
  const token = signJwt({ sub: "user-1", exp: now + 3600 }, "a-different-secret");

  const payload = verifySupabaseJwt(token, SECRET);

  assert.equal(payload, null);
});

test("accepts a token with no exp field", () => {
  const token = signJwt({ sub: "user-1" }, SECRET);

  const payload = verifySupabaseJwt(token, SECRET);

  assert.ok(payload, "expected token without exp to be accepted");
  assert.equal(payload.sub, "user-1");
});

test("signHs256Jwt round-trips through verifySupabaseJwt with the given claims and a future exp", () => {
  const token = signHs256Jwt({ sub: "guest-session-1", role: "authenticated", guest_session_id: "guest-session-1" }, SECRET, 1800);

  const payload = verifySupabaseJwt(token, SECRET);

  assert.ok(payload, "expected the freshly signed token to verify");
  assert.equal(payload.sub, "guest-session-1");
  assert.equal(payload.role, "authenticated");
  assert.equal(payload.guest_session_id, "guest-session-1");
  const now = Math.floor(Date.now() / 1000);
  assert.ok(payload.exp > now + 1700 && payload.exp <= now + 1800, "expected exp roughly 1800s in the future");
});

test("signHs256Jwt output is rejected by verifySupabaseJwt under a different secret", () => {
  const token = signHs256Jwt({ sub: "guest-session-1" }, SECRET, 1800);

  const payload = verifySupabaseJwt(token, "a-different-secret");

  assert.equal(payload, null);
});
