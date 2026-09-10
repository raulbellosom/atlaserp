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

// Reconstruct the full SQL text of a tagged-template call, recursing into any
// nested Prisma.sql fragments (which arrive as values, not in `strings`).
function renderTaggedSql(strings, values) {
  let out = "";
  strings.forEach((chunk, i) => {
    out += chunk;
    if (i < values.length) {
      const v = values[i];
      out += v && Array.isArray(v.strings) ? renderTaggedSql(v.strings, v.values ?? []) : "?";
    }
  });
  return out;
}

// call #1 is resolveUserProfileId's SELECT; call #2 is the search SELECT.
// `capture.sql` holds the search SELECT's full reconstructed SQL.
function mockPrisma(searchRows = [], capture = {}) {
  let call = 0;
  return {
    $queryRaw: async (strings, ...values) => {
      call += 1;
      if (call === 1) return [{ id: PROFILE_ID }];
      capture.sql = Array.isArray(strings) ? renderTaggedSql(strings, values) : String(strings ?? "");
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
  it("only matches at word starts — 'la' hits the word, not the 'la' inside 'Hola'", () => {
    assert.deepEqual(computeMatchRanges("Hola la mesa", ["la"]), [[5, 7]]);
  });
  it("word-prefix still matches longer words: 'la' inside 'La lampara'", () => {
    assert.deepEqual(computeMatchRanges("La lampara", ["la"]), [[0, 2], [3, 5]]);
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

  it("resolves the other participant's NAME for a direct conversation with no stored title", async () => {
    const svc = createChatSearchService({
      prisma: mockPrisma([
        row({
          conversation_type: "direct",
          conversation_title: null,
          conversation_avatar_url: null,
          dm_name: "Luar Medbe",
        }),
      ]),
    });
    const out = await svc.searchMessages({ authUserId: AUTH_USER_ID, q: "factura" });
    assert.equal(out.data[0].conversation.title, "Luar Medbe");
    // No DM avatar — user_profile has no avatar_url column; result list falls
    // back to initials from the name.
    assert.equal(out.data[0].conversation.avatarUrl, null);
  });

  it("the search SQL never references user_profile.avatar_url (regression: 42703 → 500 on every search)", async () => {
    const capture = {};
    const svc = createChatSearchService({ prisma: mockPrisma([], capture) });
    await svc.searchMessages({ authUserId: AUTH_USER_ID, q: "yo", conversationId: "01a083a9-122d-73b7-822f-bd3048f003d3" });
    assert.ok(capture.sql, "search SELECT was issued");
    assert.doesNotMatch(capture.sql, /\bp\.avatar_url\b/, "user_profile p has no avatar_url column");
    assert.doesNotMatch(capture.sql, /dm_avatar_url/);
    assert.match(capture.sql, /dm\.display_name/, "still resolves the DM peer name");
  });

  it("matches at word starts (regex ~), not 'anywhere inside a word' (ILIKE %tok%)", async () => {
    const capture = {};
    const svc = createChatSearchService({ prisma: mockPrisma([], capture) });
    await svc.searchMessages({ authUserId: AUTH_USER_ID, q: "la", conversationId: "01a083a9-122d-73b7-822f-bd3048f003d3" });
    assert.match(capture.sql, /body_norm ~ \?/, "word-prefix regex predicate");
    assert.doesNotMatch(capture.sql, /body_norm ILIKE/, "no bare substring match on the body");
  });

  it("skips typo-similarity for short tokens (2-3 chars stay exact word-prefix)", async () => {
    const cShort = {};
    await createChatSearchService({ prisma: mockPrisma([], cShort) })
      .searchMessages({ authUserId: AUTH_USER_ID, q: "la" });
    assert.doesNotMatch(cShort.sql, /word_similarity/, "no fuzzy match for a 2-char token");

    _resetProfileIdCacheForTests(); // else the 2nd mock's profile lookup is skipped (cached)
    const cLong = {};
    await createChatSearchService({ prisma: mockPrisma([], cLong) })
      .searchMessages({ authUserId: AUTH_USER_ID, q: "factura" });
    assert.match(cLong.sql, /word_similarity/, "fuzzy match kept for a real word");
  });

  it("flags truncated when the DB returns limit+1 rows", async () => {
    const many = Array.from({ length: 4 }, (_, i) => row({ message_id: `m${i}`, score: 1 }));
    const svc = createChatSearchService({ prisma: mockPrisma(many) });
    const out = await svc.searchMessages({ authUserId: AUTH_USER_ID, q: "factura", limit: 3 });
    assert.equal(out.data.length, 3);
    assert.equal(out.truncated, true);
  });

  it("maps a Postgres statement timeout to a 503 ChatServiceError", async () => {
    let call = 0;
    const prisma = {
      $queryRaw: async () => {
        call += 1;
        if (call === 1) return [{ id: PROFILE_ID }];
        const err = new Error("canceling statement due to statement timeout");
        err.code = "57014";
        throw err;
      },
    };
    const svc = createChatSearchService({ prisma });
    await assert.rejects(
      () => svc.searchMessages({ authUserId: AUTH_USER_ID, q: "factura", conversationId: null }),
      (err) => err.name === "ChatServiceError" && err.status === 503,
    );
  });

  it("rethrows a non-timeout DB error unchanged", async () => {
    let call = 0;
    const prisma = {
      $queryRaw: async () => {
        call += 1;
        if (call === 1) return [{ id: PROFILE_ID }];
        throw new Error("some other failure");
      },
    };
    const svc = createChatSearchService({ prisma });
    await assert.rejects(
      () => svc.searchMessages({ authUserId: AUTH_USER_ID, q: "factura" }),
      (err) => err.message === "some other failure",
    );
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
