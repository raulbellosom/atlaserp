import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  createChatSearchService,
  tokenizeQuery,
  normalizeForSearch,
  computeMatchRanges,
} from "../chat-search-service.js";
import { _resetProfileIdCacheForTests } from "../chat-service.js";

const AUTH_USER_ID = "auth-user-1";
const PROFILE_ID = "01900000-0000-7000-8000-0000000000p1";

beforeEach(() => _resetProfileIdCacheForTests());

// call #1 is resolveUserProfileId's SELECT; call #2 is the search SELECT.
function mockPrisma(searchRows = []) {
  let call = 0;
  return {
    $queryRaw: async () => {
      call += 1;
      if (call === 1) return [{ id: PROFILE_ID }];
      return searchRows;
    },
  };
}

function row(overrides = {}) {
  return {
    message_id: "m1",
    conversation_id: "c1",
    body: "Pagué la factura",
    created_at: "2026-09-01T10:00:00.000Z",
    sender_user_id: "u1",
    sender_name: "Ana",
    conversation_title: "Finanzas",
    conversation_type: "group",
    conversation_avatar_url: null,
    conversation_avatar_emoji: null,
    score: 1.5,
    ...overrides,
  };
}

describe("normalizeForSearch", () => {
  it("lowercases and strips accents", () => {
    assert.equal(normalizeForSearch("José REUNIÓN Ñoño"), "jose reunion nono");
  });
});

describe("tokenizeQuery", () => {
  it("splits on whitespace and drops <2 char tokens", () => {
    assert.deepEqual(tokenizeQuery("  pago  a  factura "), ["pago", "factura"]);
  });
  it("keeps a lone 1-char query", () => {
    assert.deepEqual(tokenizeQuery("x"), ["x"]);
  });
  it("caps at 6 tokens and de-dupes", () => {
    assert.deepEqual(
      tokenizeQuery("aa aa bb cc dd ee ff gg"),
      ["aa", "bb", "cc", "dd", "ee", "ff"],
    );
  });
  it("returns [] for empty / whitespace", () => {
    assert.deepEqual(tokenizeQuery("   "), []);
    assert.deepEqual(tokenizeQuery(""), []);
  });
});

describe("computeMatchRanges", () => {
  it("finds accent-insensitive offsets on the original body", () => {
    assert.deepEqual(computeMatchRanges("La reunión de hoy", ["reunion"]), [[3, 10]]);
  });
  it("merges overlapping ranges from multiple tokens", () => {
    assert.deepEqual(computeMatchRanges("factura factura", ["factura", "fact"]), [[0, 7], [8, 15]]);
  });
  it("returns [] when the token does not appear literally after JS normalisation", () => {
    // Postgres unaccent expands eszett to "ss"; the JS normaliser does not, so
    // "strasse" is simply not found in "straße" and no mis-aligned range is
    // emitted — the caller falls back to the plain snippet.
    assert.deepEqual(computeMatchRanges("straße", ["strasse"]), []);
  });
  it("returns [] when no token matches", () => {
    assert.deepEqual(computeMatchRanges("hello world", ["zzz"]), []);
  });
});

describe("searchMessages", () => {
  it("returns empty without hitting the DB for a blank query", async () => {
    const svc = createChatSearchService({ prisma: mockPrisma() });
    const out = await svc.searchMessages({ authUserId: AUTH_USER_ID, q: "  " });
    assert.deepEqual(out, { data: [], truncated: false });
  });

  it("shapes rows and computes matchRanges", async () => {
    const svc = createChatSearchService({ prisma: mockPrisma([row()]) });
    const out = await svc.searchMessages({ authUserId: AUTH_USER_ID, q: "factura" });
    assert.equal(out.data.length, 1);
    assert.equal(out.data[0].messageId, "m1");
    assert.equal(out.data[0].conversation.title, "Finanzas");
    assert.equal(out.data[0].conversation.type, "group");
    assert.equal(out.data[0].sender.displayName, "Ana");
    assert.deepEqual(out.data[0].matchRanges, [[9, 16]]);
    assert.equal(out.truncated, false);
  });

  it("flags truncated when the DB returns limit+1 rows", async () => {
    const many = Array.from({ length: 4 }, (_, i) => row({ message_id: `m${i}`, score: 1 }));
    const svc = createChatSearchService({ prisma: mockPrisma(many) });
    const out = await svc.searchMessages({ authUserId: AUTH_USER_ID, q: "factura", limit: 3 });
    assert.equal(out.data.length, 3);
    assert.equal(out.truncated, true);
  });

  it("clamps limit and offset to their maxima", async () => {
    let call = 0;
    let searchValues = null;
    const prisma = {
      $queryRaw: async (_strings, ...values) => {
        call += 1;
        if (call === 1) return [{ id: PROFILE_ID }];
        searchValues = values;
        return [];
      },
    };
    const svc = createChatSearchService({ prisma });
    await svc.searchMessages({ authUserId: AUTH_USER_ID, q: "factura", limit: 9999, offset: 9999 });
    const nums = searchValues.filter((v) => typeof v === "number");
    // LIMIT interpolates safeLimit + 1 (50 + 1); OFFSET is capped at 300.
    assert.ok(nums.includes(51), `expected 51 among ${JSON.stringify(nums)}`);
    assert.ok(nums.includes(300), `expected 300 among ${JSON.stringify(nums)}`);
  });
});
