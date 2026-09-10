import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createChatMemberAvatarService } from "../chat-member-avatar-service.js";
import { ChatServiceError } from "../chat-service-error.js";
import { _resetProfileIdCacheForTests } from "../chat-service.js";

// resolveUserProfileId caches auth_user_id -> profileId at module scope; reset
// between tests so a cached id from one test's mock doesn't shift the next
// test's $queryRaw sequence (same pattern as chat-reactions-service.test.js).
beforeEach(() => {
  _resetProfileIdCacheForTests();
});

function buildPrismaMock(queryRawResults, fileAsset = null) {
  let qIdx = 0;
  return {
    $queryRaw: async () => {
      if (qIdx >= queryRawResults.length) throw new Error(`Unexpected $queryRaw call #${qIdx + 1}`);
      return queryRawResults[qIdx++];
    },
    fileAsset: {
      findUnique: async () => fileAsset,
    },
  };
}

// Minimal supabaseAdmin stub for signedUrlWithVariant: records the variant it
// was asked to transform with, returns a deterministic signed URL.
function buildSupabaseStub() {
  const calls = [];
  return {
    calls,
    storage: {
      from: (bucket) => ({
        createSignedUrl: async (objectKey, expiresIn, opts) => {
          calls.push({ bucket, objectKey, opts });
          return { data: { signedUrl: `https://signed.example/${bucket}/${objectKey}` }, error: null };
        },
      }),
    },
  };
}

const CONV = "11111111-1111-1111-1111-111111111111";
const TARGET = "22222222-2222-2222-2222-222222222222";

describe("chat-member-avatar-service — getMemberAvatarSignedUrl", () => {
  it("throws 403 when the caller is not a member of the conversation", async () => {
    const prisma = buildPrismaMock([
      [{ id: "caller-profile" }], // resolveUserProfileId
      [],                         // caller membership: none
    ]);
    const svc = createChatMemberAvatarService({ prisma, supabaseAdmin: buildSupabaseStub() });
    await assert.rejects(
      () => svc.getMemberAvatarSignedUrl({ conversationId: CONV, authUserId: "auth-1", targetUserId: TARGET }),
      (err) => err instanceof ChatServiceError && err.status === 403,
    );
  });

  it("throws 404 when the target user is not a member of that same conversation", async () => {
    const prisma = buildPrismaMock([
      [{ id: "caller-profile" }],
      [{ "?column?": 1 }], // caller membership: ok
      [],                  // target membership: none
    ]);
    const svc = createChatMemberAvatarService({ prisma, supabaseAdmin: buildSupabaseStub() });
    await assert.rejects(
      () => svc.getMemberAvatarSignedUrl({ conversationId: CONV, authUserId: "auth-1", targetUserId: TARGET }),
      (err) => err instanceof ChatServiceError && err.status === 404,
    );
  });

  it("returns { signedUrl: null } when the target member has no avatar file", async () => {
    const prisma = buildPrismaMock([
      [{ id: "caller-profile" }],
      [{ "?column?": 1 }],
      [{ avatar_file_id: null }], // target is a member but has no avatar
    ]);
    const svc = createChatMemberAvatarService({ prisma, supabaseAdmin: buildSupabaseStub() });
    const result = await svc.getMemberAvatarSignedUrl({ conversationId: CONV, authUserId: "auth-1", targetUserId: TARGET });
    assert.deepEqual(result, { signedUrl: null });
  });

  it("signs the target's avatar at the requested variant when both users share the conversation", async () => {
    const prisma = buildPrismaMock(
      [
        [{ id: "caller-profile" }],
        [{ "?column?": 1 }],
        [{ avatar_file_id: "file-9" }],
      ],
      { bucket: "atlas-files", objectKey: "modules/atlas-identity/userprofile/x/a.png" },
    );
    const supabaseAdmin = buildSupabaseStub();
    const svc = createChatMemberAvatarService({ prisma, supabaseAdmin });
    const result = await svc.getMemberAvatarSignedUrl({
      conversationId: CONV, authUserId: "auth-1", targetUserId: TARGET, variant: "full",
    });
    assert.equal(result.signedUrl, "https://signed.example/atlas-files/modules/atlas-identity/userprofile/x/a.png");
    // `full` means "no transform" — createSignedUrl called without a transform option.
    assert.deepEqual(supabaseAdmin.calls[0].opts, {});
  });

  it("coerces an unrecognized variant to full instead of forwarding it", async () => {
    const prisma = buildPrismaMock(
      [
        [{ id: "caller-profile" }],
        [{ "?column?": 1 }],
        [{ avatar_file_id: "file-9" }],
      ],
      { bucket: "atlas-files", objectKey: "a.png" },
    );
    const supabaseAdmin = buildSupabaseStub();
    const svc = createChatMemberAvatarService({ prisma, supabaseAdmin });
    const result = await svc.getMemberAvatarSignedUrl({
      conversationId: CONV, authUserId: "auth-1", targetUserId: TARGET, variant: "../../etc/passwd",
    });
    assert.ok(result.signedUrl);
    assert.deepEqual(supabaseAdmin.calls[0].opts, {});
  });
});
