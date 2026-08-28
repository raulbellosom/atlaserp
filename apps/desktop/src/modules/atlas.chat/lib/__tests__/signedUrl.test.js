import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getSignedUrlExpiresAt, isSignedUrlUsable } from "../signedUrl.js";

function tokenWithExpiry(exp) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "HS256" })}.${encode({ exp })}.signature`;
}

describe("chat signed URL freshness", () => {
  it("reads the expiry from Supabase signed URLs", () => {
    const exp = 2_000_000_000;
    const url = `https://storage.example.test/object?token=${tokenWithExpiry(exp)}`;
    assert.equal(getSignedUrlExpiresAt(url), exp * 1000);
  });

  it("rejects expired URLs and URLs inside the refresh margin", () => {
    const now = 2_000_000_000_000;
    const expired = `https://storage.example.test/object?token=${tokenWithExpiry(1_999_999_999)}`;
    const almostExpired = `https://storage.example.test/object?token=${tokenWithExpiry(2_000_000_120)}`;
    assert.equal(isSignedUrlUsable(expired, now), false);
    assert.equal(isSignedUrlUsable(almostExpired, now), false);
  });

  it("accepts URLs with enough lifetime and non-Supabase URLs", () => {
    const now = 2_000_000_000_000;
    const fresh = `https://storage.example.test/object?token=${tokenWithExpiry(2_000_000_600)}`;
    assert.equal(isSignedUrlUsable(fresh, now), true);
    assert.equal(isSignedUrlUsable("https://cdn.example.test/public.png", now), true);
  });
});
