import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createCallRecordingService, CallRecordingError } from "../call-recording-service.js";

const CALL = "11111111-1111-4111-8111-111111111111";
const CONV = "22222222-2222-4222-8222-222222222222";
const USER = "33333333-3333-4333-8333-333333333333";
const REC = "44444444-4444-4444-8444-444444444444";

function env() {
  return {
    LIVEKIT_MODE: "embedded",
    LIVEKIT_URL: "wss://rtc.example.test",
    LIVEKIT_INTERNAL_URL: "http://livekit:7880",
    LIVEKIT_API_KEY: "api-key",
    LIVEKIT_API_SECRET: "super-secret",
    SUPABASE_S3_ENDPOINT: "https://supabase.example.test/storage/v1/s3",
    SUPABASE_S3_ACCESS_KEY_ID: "s3-key",
    SUPABASE_S3_SECRET_ACCESS_KEY: "s3-secret",
    SUPABASE_S3_REGION: "us-east-1",
  };
}

const liveCall = { id: CALL, conversationId: CONV, kind: "VIDEO", status: "ACTIVE", livekitRoomName: `call_${CALL}` };

class FakeEgress {
  constructor() { this.started = []; this.stopped = []; }
  async startRoomCompositeEgress(roomName, output, opts) {
    this.started.push({ roomName, output, opts });
    return { egressId: "egress_1", status: 0 /* EGRESS_STARTING */ };
  }
  async stopEgress(egressId) {
    this.stopped.push(egressId);
    return { egressId, status: 2 /* EGRESS_ENDING */ };
  }
  async listEgress() { return []; }
}

describe("createCallRecordingService.startRecording", () => {
  it("rejects when a recording is already STARTING/ACTIVE for this call", async () => {
    const prisma = {
      callRecording: { findFirst: async () => ({ id: REC, status: "ACTIVE" }) },
    };
    const svc = createCallRecordingService({
      prisma, env: env(), EgressClientImpl: FakeEgress,
      callService: { getLiveCallOrThrow: async () => liveCall },
    });
    await assert.rejects(
      svc.startRecording({ callId: CALL, startedByUserId: USER }),
      (e) => e instanceof CallRecordingError && e.status === 409,
    );
  });

  it("creates a STARTING row, starts a segmented-HLS egress with S3 output, and stores the egressId", async () => {
    let createData;
    const egress = new FakeEgress();
    const prisma = {
      callRecording: {
        findFirst: async () => null,
        create: async ({ data }) => { createData = data; return { id: REC, ...data }; },
        update: async ({ data }) => ({ id: REC, ...data }),
      },
    };
    const svc = createCallRecordingService({
      prisma, env: env(), EgressClientImpl: egress,
      callService: { getLiveCallOrThrow: async () => liveCall },
    });
    const out = await svc.startRecording({ callId: CALL, startedByUserId: USER });
    assert.equal(out.status, "STARTING");
    assert.equal(createData.callId, CALL);
    assert.equal(createData.conversationId, CONV);
    assert.equal(egress.started.length, 1);
    assert.equal(egress.started[0].roomName, liveCall.livekitRoomName);
    assert.equal(egress.started[0].output.segments.output.case, "s3");
    assert.equal(egress.started[0].output.segments.output.value.bucket, "atlas-chat");
  });
});

describe("createCallRecordingService.stopRecording", () => {
  it("throws 404 when there is no active recording for this call", async () => {
    const prisma = { callRecording: { findFirst: async () => null } };
    const svc = createCallRecordingService({ prisma, env: env(), EgressClientImpl: FakeEgress });
    await assert.rejects(
      svc.stopRecording({ callId: CALL }),
      (e) => e instanceof CallRecordingError && e.status === 404,
    );
  });

  it("calls stopEgress and flips status to PROCESSING", async () => {
    let updateData;
    const egress = new FakeEgress();
    const prisma = {
      callRecording: {
        findFirst: async () => ({ id: REC, callId: CALL, egressId: "egress_1", status: "ACTIVE" }),
        update: async ({ data }) => { updateData = data; return { id: REC, ...data }; },
      },
    };
    const svc = createCallRecordingService({ prisma, env: env(), EgressClientImpl: egress });
    const out = await svc.stopRecording({ callId: CALL });
    assert.equal(out.status, "PROCESSING");
    assert.equal(updateData.status, "PROCESSING");
    assert.deepEqual(egress.stopped, ["egress_1"]);
  });
});

describe("createCallRecordingService.reconcileActiveRecordings (sweep)", () => {
  it("promotes a COMPLETE egress to READY with playlist key and duration", async () => {
    let updateData;
    class DoneEgress extends FakeEgress {
      async listEgress() {
        return [{
          egressId: "egress_1",
          status: 3 /* EGRESS_COMPLETE */,
          segmentResults: [{ playlistName: "index.m3u8", playlistLocation: "recordings/conv/rec/index.m3u8", duration: 60_000_000_000n, size: 12_345n }],
        }];
      }
    }
    const prisma = {
      callRecording: {
        findMany: async () => [{ id: REC, callId: CALL, conversationId: CONV, egressId: "egress_1", status: "PROCESSING", startedAt: new Date() }],
        update: async ({ data }) => { updateData = data; return {}; },
      },
    };
    const posted = [];
    const svc = createCallRecordingService({
      prisma, env: env(), EgressClientImpl: DoneEgress,
      onRecordingReady: async (rec) => posted.push(rec),
    });
    await svc.reconcileActiveRecordings();
    assert.equal(updateData.status, "READY");
    assert.equal(updateData.playlistObjectKey, "recordings/conv/rec/index.m3u8");
    assert.equal(updateData.durationMs, 60_000);
    assert.ok(updateData.expiresAt instanceof Date);
    assert.equal(posted.length, 1);
  });

  it("marks a FAILED egress as FAILED with the reported error", async () => {
    let updateData;
    class FailedEgress extends FakeEgress {
      async listEgress() {
        return [{ egressId: "egress_1", status: 4 /* EGRESS_FAILED */, error: "room not found" }];
      }
    }
    const prisma = {
      callRecording: {
        findMany: async () => [{ id: REC, callId: CALL, conversationId: CONV, egressId: "egress_1", status: "PROCESSING", startedAt: new Date() }],
        update: async ({ data }) => { updateData = data; return {}; },
      },
    };
    const svc = createCallRecordingService({ prisma, env: env(), EgressClientImpl: FailedEgress });
    await svc.reconcileActiveRecordings();
    assert.equal(updateData.status, "FAILED");
    assert.equal(updateData.failureReason, "room not found");
  });

  it("force-stops a recording that has been running past the 4-hour cap", async () => {
    const egress = new FakeEgress();
    const fourHoursAgo = new Date(Date.now() - (4 * 60 * 60 * 1000 + 1000));
    const prisma = {
      callRecording: {
        findMany: async () => [{ id: REC, callId: CALL, conversationId: CONV, egressId: "egress_1", status: "ACTIVE", startedAt: fourHoursAgo }],
        update: async () => ({}),
      },
    };
    const svc = createCallRecordingService({ prisma, env: env(), EgressClientImpl: egress });
    await svc.reconcileActiveRecordings();
    assert.deepEqual(egress.stopped, ["egress_1"]);
  });

  it("force-stops a recording whose call is no longer live", async () => {
    const egress = new FakeEgress();
    const prisma = {
      callRecording: {
        findMany: async () => [{ id: REC, callId: CALL, conversationId: CONV, egressId: "egress_1", status: "ACTIVE", startedAt: new Date() }],
        update: async () => ({}),
      },
    };
    const svc = createCallRecordingService({
      prisma, env: env(), EgressClientImpl: egress,
      callService: { getLiveCallOrThrow: async () => { throw new Error("not live"); } },
    });
    await svc.reconcileActiveRecordings();
    assert.deepEqual(egress.stopped, ["egress_1"]);
  });
});

describe("createCallRecordingService.listRecordings", () => {
  it("attaches a signed playlistUrl only to READY rows with a playlistObjectKey", async () => {
    const prisma = {
      callRecording: {
        findMany: async () => [
          { id: REC, status: "READY", playlistObjectKey: "recordings/conv/rec/index.m3u8" },
          { id: "other", status: "PROCESSING", playlistObjectKey: null },
        ],
      },
    };
    const supabaseAdmin = {
      storage: { from: () => ({ createSignedUrl: async (key) => ({ data: { signedUrl: `https://signed.example/${key}` }, error: null }) }) },
    };
    const svc = createCallRecordingService({ prisma, env: env(), EgressClientImpl: FakeEgress, supabaseAdmin });
    const rows = await svc.listRecordings({ conversationId: CONV });
    assert.equal(rows[0].playlistUrl, "https://signed.example/recordings/conv/rec/index.m3u8");
    assert.equal(rows[1].playlistUrl, undefined);
  });
});

describe("createCallRecordingService.cleanupExpiredRecordings", () => {
  it("deletes expired rows and their storage objects", async () => {
    const removedKeys = [];
    const prisma = {
      callRecording: {
        findMany: async () => [{ id: REC, playlistObjectKey: "recordings/conv/rec/index.m3u8" }],
        delete: async () => ({}),
      },
    };
    const supabaseAdmin = {
      storage: { from: () => ({ remove: async (keys) => { removedKeys.push(...keys); return { error: null }; }, list: async () => ({ data: [], error: null }) } ) },
    };
    const svc = createCallRecordingService({ prisma, env: env(), EgressClientImpl: FakeEgress, supabaseAdmin });
    const count = await svc.cleanupExpiredRecordings();
    assert.equal(count, 1);
    assert.deepEqual(removedKeys, ["recordings/conv/rec/index.m3u8"]);
  });
});
