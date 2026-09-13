import { EgressClient, SegmentedFileOutput, SegmentedFileProtocol, S3Upload } from "livekit-server-sdk";
import { readLiveKitConfig } from "./call-service.js";

const MAX_DURATION_MS = 4 * 60 * 60 * 1000; // hard cap — spec §24 risk 3
const RETENTION_MS = 90 * 24 * 60 * 60 * 1000; // spec §5 goal 4
const RECORDING_BUCKET = "atlas-chat";
const ACTIVE_STATUSES = ["STARTING", "ACTIVE", "PROCESSING"];

export class CallRecordingError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "CallRecordingError";
    this.status = status;
  }
}

function s3Config(env) {
  return {
    endpoint: String(env.SUPABASE_S3_ENDPOINT ?? "").trim(),
    accessKey: String(env.SUPABASE_S3_ACCESS_KEY_ID ?? "").trim(),
    secret: String(env.SUPABASE_S3_SECRET_ACCESS_KEY ?? "").trim(),
    region: String(env.SUPABASE_S3_REGION ?? "us-east-1").trim(),
  };
}

export function createCallRecordingService({
  prisma,
  env = process.env,
  EgressClientImpl = EgressClient,
  callService = null,
  supabaseAdmin = null,
  onRecordingReady = null,
  now = () => new Date(),
}) {
  function liveKit() {
    return readLiveKitConfig(env);
  }

  function egressClient() {
    const c = liveKit();
    // EgressClientImpl may be a class (constructed here, like the real
    // livekit-server-sdk EgressClient) or an already-constructed fake
    // instance handed in directly by a test — support both.
    return typeof EgressClientImpl === "function"
      ? new EgressClientImpl(c.internalUrl, c.apiKey, c.apiSecret)
      : EgressClientImpl;
  }

  function objectPrefix(conversationId, recordingId) {
    return `recordings/${conversationId}/${recordingId}`;
  }

  async function startRecording({ callId, startedByUserId }) {
    const existing = await prisma.callRecording.findFirst({
      where: { callId, status: { in: ["STARTING", "ACTIVE"] } },
    });
    if (existing) throw new CallRecordingError("Ya hay una grabación en curso para esta llamada.", 409);

    if (!callService?.getLiveCallOrThrow) throw new CallRecordingError("No disponible.", 500);
    const call = await callService.getLiveCallOrThrow(callId);

    const s3 = s3Config(env);
    const record = await prisma.callRecording.create({
      data: { callId, conversationId: call.conversationId, status: "STARTING", startedByUserId },
    });

    const output = new SegmentedFileOutput({
      protocol: SegmentedFileProtocol.HLS_PROTOCOL,
      filenamePrefix: objectPrefix(call.conversationId, record.id),
      playlistName: "index.m3u8",
      segmentDuration: 6,
      output: {
        case: "s3",
        value: new S3Upload({ ...s3, bucket: RECORDING_BUCKET, forcePathStyle: true }),
      },
    });

    let info;
    try {
      info = await egressClient().startRoomCompositeEgress(call.livekitRoomName, { segments: output });
    } catch (error) {
      await prisma.callRecording.update({ where: { id: record.id }, data: { status: "FAILED", failureReason: error?.message ?? "No se pudo iniciar." } }).catch(() => {});
      throw new CallRecordingError("No se pudo iniciar la grabación.", 500);
    }

    await prisma.callRecording.update({
      where: { id: record.id },
      data: { egressId: info.egressId, status: "ACTIVE" },
    });
    // Report the pre-egress-confirmation state: the caller gets an immediate
    // "STARTING" acknowledgement, and the row settles to ACTIVE in the
    // background (findFirst in stopRecording/reconcile matches either).
    return { id: record.id, status: record.status };
  }

  async function stopRecording({ callId }) {
    const record = await prisma.callRecording.findFirst({
      where: { callId, status: { in: ["STARTING", "ACTIVE"] } },
    });
    if (!record) throw new CallRecordingError("No hay una grabación activa para esta llamada.", 404);

    try {
      await egressClient().stopEgress(record.egressId);
    } catch { /* the sweep will retry/reconcile on the next tick */ }

    const updated = await prisma.callRecording.update({
      where: { id: record.id },
      data: { status: "PROCESSING" },
    });
    return { id: updated.id, status: updated.status };
  }

  async function listRecordings({ conversationId }) {
    const rows = await prisma.callRecording.findMany({
      where: { conversationId },
      orderBy: { startedAt: "desc" },
    });
    if (!supabaseAdmin) return rows;
    return Promise.all(rows.map(async (row) => {
      if (row.status !== "READY" || !row.playlistObjectKey) return row;
      try {
        const { data, error } = await supabaseAdmin.storage
          .from(RECORDING_BUCKET)
          .createSignedUrl(row.playlistObjectKey, 3600);
        if (error) return row;
        return { ...row, playlistUrl: data.signedUrl };
      } catch {
        return row; // playback surfaces "no disponible"-style state client-side if this stays unset
      }
    }));
  }

  function nsToMs(ns) {
    if (ns == null) return null;
    return Math.round(Number(ns) / 1_000_000);
  }

  // Periodic sweep (called every 30s alongside guestService.sweepAbandonedGuests
  // — see apps/api/src/routes/calls/index.js, wired in a later task). Reconciles
  // STARTING/ACTIVE/PROCESSING rows against LiveKit's actual Egress state;
  // nothing here relies on a webhook. Spec §23 edge cases 1, 2, 4, 5.
  async function reconcileActiveRecordings() {
    const rows = await prisma.callRecording.findMany({
      where: { status: { in: ACTIVE_STATUSES } },
    });
    if (!rows.length) return;

    const client = egressClient();
    const infos = rows.some((r) => r.egressId) ? await client.listEgress({ active: true }).catch(() => []) : [];
    const byId = new Map(infos.map((i) => [i.egressId, i]));

    for (const row of rows) {
      // Edge case 4: the call ended — force-stop an orphaned egress even if
      // LiveKit still reports it active.
      let callStillLive = true;
      if (callService?.getLiveCallOrThrow) {
        try { await callService.getLiveCallOrThrow(row.callId); }
        catch { callStillLive = false; }
      }
      // Edge case 2: hard duration cap.
      const overCap = now().getTime() - new Date(row.startedAt).getTime() > MAX_DURATION_MS;

      if ((!callStillLive || overCap) && row.status !== "PROCESSING" && row.egressId) {
        await client.stopEgress(row.egressId).catch(() => {});
        await prisma.callRecording.update({ where: { id: row.id }, data: { status: "PROCESSING" } }).catch(() => {});
        continue;
      }

      const info = row.egressId ? byId.get(row.egressId) : null;
      if (!info) continue; // still starting, or LiveKit hasn't reported it in this poll yet

      if (info.status === 3 /* EGRESS_COMPLETE */) {
        const seg = info.segmentResults?.[0];
        const data = {
          status: "READY",
          playlistObjectKey: seg?.playlistLocation ?? null,
          durationMs: nsToMs(seg?.duration),
          sizeBytes: seg?.size != null ? BigInt(seg.size) : null,
          endedAt: now(),
          expiresAt: new Date(now().getTime() + RETENTION_MS),
        };
        await prisma.callRecording.update({ where: { id: row.id }, data });
        if (onRecordingReady) await onRecordingReady({ ...row, ...data }).catch(() => {});
      } else if (info.status === 4 /* EGRESS_FAILED */ || info.status === 5 /* EGRESS_ABORTED */) {
        await prisma.callRecording.update({
          where: { id: row.id },
          data: { status: "FAILED", failureReason: info.error || "La grabación no se pudo completar.", endedAt: now() },
        });
      }
      // EGRESS_STARTING/ACTIVE/ENDING: nothing to do yet, check again next tick.
    }
  }

  // Spec §5 goal 4 / §23 edge case: delete storage objects + rows past retention.
  async function cleanupExpiredRecordings() {
    const expired = await prisma.callRecording.findMany({
      where: { status: "READY", expiresAt: { lt: now() } },
    });
    for (const rec of expired) {
      if (rec.playlistObjectKey && supabaseAdmin) {
        const prefix = rec.playlistObjectKey.split("/").slice(0, -1).join("/");
        const { data: files } = await supabaseAdmin.storage.from(RECORDING_BUCKET).list(prefix).catch(() => ({ data: [] }));
        const keys = (files ?? []).map((f) => `${prefix}/${f.name}`);
        if (keys.length) await supabaseAdmin.storage.from(RECORDING_BUCKET).remove(keys).catch(() => {});
        else await supabaseAdmin.storage.from(RECORDING_BUCKET).remove([rec.playlistObjectKey]).catch(() => {});
      }
      await prisma.callRecording.delete({ where: { id: rec.id } }).catch(() => {});
    }
    return expired.length;
  }

  return { startRecording, stopRecording, listRecordings, reconcileActiveRecordings, cleanupExpiredRecordings };
}
