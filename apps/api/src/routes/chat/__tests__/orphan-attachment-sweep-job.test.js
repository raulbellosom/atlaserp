import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sweepOrphanChatAttachments } from "../orphan-attachment-sweep-job.js";

function buildPrisma(queryRows) {
  const calls = { query: [], execute: [] };
  return {
    calls,
    $queryRaw: async (strings, ...values) => {
      calls.query.push({ sql: strings.join("?"), values });
      return queryRows;
    },
    $executeRaw: async (strings, ...values) => {
      calls.execute.push({ sql: strings.join("?"), values });
      return queryRows.length;
    },
  };
}

function buildStorage() {
  const removed = [];
  return {
    removed,
    storage: {
      from(bucket) {
        return {
          async remove(keys) {
            removed.push({ bucket, keys });
            return { data: [], error: null };
          },
        };
      },
    },
  };
}

describe("sweepOrphanChatAttachments", () => {
  it("no-ops with no orphan rows", async () => {
    const prisma = buildPrisma([]);
    const supabaseAdmin = buildStorage();
    const result = await sweepOrphanChatAttachments({ prisma, supabaseAdmin });
    assert.deepEqual(result, { swept: 0 });
    assert.equal(prisma.calls.execute.length, 0);
    assert.deepEqual(supabaseAdmin.removed, []);
  });

  it("only selects message_id IS NULL rows past the age threshold", async () => {
    const prisma = buildPrisma([
      { id: "a1", bucket: "atlas-chat", object_key: "k1" },
    ]);
    const supabaseAdmin = buildStorage();
    await sweepOrphanChatAttachments({ prisma, supabaseAdmin, olderThanMinutes: 120 });
    const sql = prisma.calls.query[0].sql;
    assert.match(sql, /message_id IS NULL/i);
    assert.match(sql, /created_at </i);
    assert.deepEqual(prisma.calls.query[0].values, [120, 200]); // olderThanMinutes, limit
  });

  it("groups keys by bucket, removes them, then bulk-deletes the rows", async () => {
    const prisma = buildPrisma([
      { id: "a1", bucket: "atlas-chat", object_key: "k1" },
      { id: "a2", bucket: "atlas-chat", object_key: "k2" },
    ]);
    const supabaseAdmin = buildStorage();
    const result = await sweepOrphanChatAttachments({ prisma, supabaseAdmin });
    assert.deepEqual(supabaseAdmin.removed, [{ bucket: "atlas-chat", keys: ["k1", "k2"] }]);
    assert.equal(prisma.calls.execute.length, 1);
    assert.match(prisma.calls.execute[0].sql, /DELETE FROM chat_attachments WHERE id = ANY/i);
    assert.deepEqual(prisma.calls.execute[0].values, [["a1", "a2"]]);
    assert.deepEqual(result, { swept: 2 });
  });

  it("still deletes the rows when a bucket removal errors", async () => {
    const prisma = buildPrisma([{ id: "a1", bucket: "atlas-chat", object_key: "k1" }]);
    const supabaseAdmin = {
      storage: { from: () => ({ remove: async () => ({ data: null, error: new Error("nope") }) }) },
    };
    const result = await sweepOrphanChatAttachments({ prisma, supabaseAdmin });
    assert.deepEqual(result, { swept: 1 });
    assert.equal(prisma.calls.execute.length, 1);
  });
});
