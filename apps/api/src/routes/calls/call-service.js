import { AccessToken, RoomServiceClient } from "livekit-server-sdk";

const LIVE_CALL_STATUSES = ["RINGING", "ACTIVE"];
const RING_TIMEOUT_MS = 60_000;

function isLiveCallConflict(error) {
  return error?.code === "P2002"
    || error?.meta?.code === "23505"
    || String(error?.message ?? "").includes("call_one_live_per_conversation_idx");
}

export class CallServiceError extends Error {
  constructor(message, status = 400, details = null) {
    super(message);
    this.name = "CallServiceError";
    this.status = status;
    this.details = details;
  }
}

export function readLiveKitConfig(env = process.env) {
  const requestedMode = String(env.LIVEKIT_MODE ?? "embedded").trim().toLowerCase();
  const mode = ["embedded", "external", "disabled"].includes(requestedMode)
    ? requestedMode
    : "disabled";
  const publicUrl = String(env.LIVEKIT_URL ?? "").trim();
  const internalUrl = String(env.LIVEKIT_INTERNAL_URL ?? publicUrl).trim();
  const apiKey = String(env.LIVEKIT_API_KEY ?? "").trim();
  const apiSecret = String(env.LIVEKIT_API_SECRET ?? "").trim();
  const enabled = mode !== "disabled" && Boolean(publicUrl && internalUrl && apiKey && apiSecret);

  return { mode, enabled, publicUrl, internalUrl, apiKey, apiSecret };
}

export function createCallService({
  prisma,
  env = process.env,
  AccessTokenImpl = AccessToken,
  RoomServiceClientImpl = RoomServiceClient,
  now = () => new Date(),
}) {
  function getConfig() {
    return readLiveKitConfig(env);
  }

  function assertEnabled() {
    const config = getConfig();
    if (!config.enabled) {
      throw new CallServiceError("Las llamadas no estan configuradas en esta instancia.", 501);
    }
    return config;
  }

  async function resolveProfile(authUserId) {
    const profile = await prisma.userProfile.findUnique({
      where: { authUserId },
      select: { id: true, displayName: true, avatarFileId: true },
    });
    if (!profile) throw new CallServiceError("Perfil de usuario no encontrado.", 404);
    return profile;
  }

  async function listConversationMembers(conversationId) {
    return prisma.$queryRaw`
      SELECT m.user_id AS "userId", up.display_name AS "displayName"
      FROM chat_conversation_members m
      JOIN user_profile up ON up.id = m.user_id
      JOIN chat_conversations c ON c.id = m.conversation_id
      WHERE m.conversation_id = ${conversationId}
        AND m.user_id IS NOT NULL
        AND m.left_at IS NULL
        AND c.deleted_at IS NULL
    `;
  }

  async function assertMembership(conversationId, userProfileId) {
    const rows = await prisma.$queryRaw`
      SELECT m.id
      FROM chat_conversation_members m
      JOIN chat_conversations c ON c.id = m.conversation_id
      WHERE m.conversation_id = ${conversationId}
        AND m.user_id = ${userProfileId}
        AND m.left_at IS NULL
        AND c.deleted_at IS NULL
      LIMIT 1
    `;
    if (!rows.length) throw new CallServiceError("Conversacion no encontrada.", 404);
  }

  async function assertCalendarLink(calendarEventId, conversationId) {
    if (!calendarEventId) return;
    const event = await prisma.calendarEvent.findFirst({
      where: {
        id: calendarEventId,
        enabled: true,
        sourceModule: "atlas.chat",
        sourceEntityId: conversationId,
      },
      select: { id: true },
    });
    if (!event) {
      throw new CallServiceError("La reunion no esta vinculada a esta conversacion.", 422);
    }
  }

  async function getCallRecord(callId) {
    const call = await prisma.call.findUnique({
      where: { id: callId },
      include: {
        initiator: { select: { id: true, displayName: true } },
        calendarEvent: { select: { id: true, title: true } },
        participants: {
          orderBy: { createdAt: "asc" },
          include: {
            user: { select: { id: true, displayName: true, avatarFileId: true } },
          },
        },
      },
    });
    if (!call) throw new CallServiceError("Llamada no encontrada.", 404);
    return call;
  }

  async function assertCallAccess(call, profileId) {
    await assertMembership(call.conversationId, profileId);
    const participant = call.participants.find((entry) => entry.userId === profileId);
    if (!participant) throw new CallServiceError("No formas parte de esta llamada.", 403);
    return participant;
  }

  async function createToken(config, call, profile) {
    const token = new AccessTokenImpl(config.apiKey, config.apiSecret, {
      identity: profile.id,
      name: profile.displayName,
      metadata: JSON.stringify({ callId: call.id }),
      ttl: "10m",
    });
    token.addGrant({
      room: call.livekitRoomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });
    return token.toJwt();
  }

  async function closeLiveKitRoom(call) {
    const config = getConfig();
    if (!config.enabled) return;
    try {
      const client = new RoomServiceClientImpl(
        config.internalUrl,
        config.apiKey,
        config.apiSecret,
      );
      await client.deleteRoom(call.livekitRoomName);
    } catch (error) {
      console.warn("[atlas.calls] No se pudo cerrar la sala LiveKit:", error?.message ?? error);
    }
  }

  async function expireStaleCalls() {
    const cutoff = new Date(now().getTime() - RING_TIMEOUT_MS);
    const stale = await prisma.call.findMany({
      where: { status: "RINGING", createdAt: { lte: cutoff } },
      select: { id: true, livekitRoomName: true },
    });
    if (!stale.length) return 0;
    const ids = stale.map((call) => call.id);
    await prisma.$transaction([
      prisma.callParticipant.updateMany({
        where: { callId: { in: ids }, status: "RINGING" },
        data: { status: "MISSED", leftAt: now() },
      }),
      prisma.callParticipant.updateMany({
        where: { callId: { in: ids }, status: "JOINED" },
        data: { status: "LEFT", leftAt: now() },
      }),
      prisma.call.updateMany({
        where: { id: { in: ids }, status: "RINGING" },
        data: { status: "ENDED", endedAt: now(), endReason: "missed" },
      }),
    ]);
    await Promise.all(stale.map(closeLiveKitRoom));
    return stale.length;
  }

  async function getConfigStatus() {
    const config = getConfig();
    return { enabled: config.enabled, mode: config.mode };
  }

  async function createCall({ authUserId, conversationId, kind, calendarEventId = null }) {
    const config = assertEnabled();
    await expireStaleCalls();
    const profile = await resolveProfile(authUserId);
    const members = await listConversationMembers(conversationId);
    if (!members.some((member) => member.userId === profile.id)) {
      throw new CallServiceError("Conversacion no encontrada.", 404);
    }
    if (members.length < 2) {
      throw new CallServiceError("No hay otra persona disponible en esta conversacion.", 422);
    }
    await assertCalendarLink(calendarEventId, conversationId);

    const existing = await prisma.call.findFirst({
      where: { conversationId, status: { in: LIVE_CALL_STATUSES } },
      select: { id: true },
    });
    if (existing) {
      throw new CallServiceError("Ya hay una llamada en curso en esta conversacion.", 409, {
        callId: existing.id,
      });
    }

    let created;
    try {
      created = await prisma.$transaction(async (tx) => {
        const rows = await tx.$queryRaw`
          WITH generated AS (SELECT uuidv7() AS id)
          INSERT INTO "call" (
            id, conversation_id, calendar_event_id, kind, status,
            initiated_by_user_id, livekit_room_name, created_at
          )
          SELECT id, ${conversationId}, ${calendarEventId}, ${kind}::"CallKind", 'RINGING',
                 ${profile.id}, 'call_' || id::text, NOW()
          FROM generated
          RETURNING id
        `;
        const callId = rows[0].id;
        await tx.callParticipant.createMany({
          data: members.map((member) => ({
            callId,
            userId: member.userId,
            status: member.userId === profile.id ? "JOINED" : "RINGING",
            livekitIdentity: member.userId,
            joinedAt: member.userId === profile.id ? now() : null,
          })),
        });
        return tx.call.findUnique({ where: { id: callId } });
      });
    } catch (error) {
      if (isLiveCallConflict(error)) {
        const active = await prisma.call.findFirst({
          where: { conversationId, status: { in: LIVE_CALL_STATUSES } },
          select: { id: true },
        });
        throw new CallServiceError("Ya hay una llamada en curso en esta conversacion.", 409, {
          callId: active?.id ?? null,
        });
      }
      throw error;
    }

    const call = await getCallRecord(created.id);
    return {
      callId: call.id,
      call,
      livekitUrl: config.publicUrl,
      token: await createToken(config, call, profile),
    };
  }

  async function getCall({ authUserId, callId }) {
    assertEnabled();
    await expireStaleCalls();
    const profile = await resolveProfile(authUserId);
    const call = await getCallRecord(callId);
    await assertCallAccess(call, profile.id);
    return call;
  }

  async function getCurrentCall({ authUserId }) {
    assertEnabled();
    await expireStaleCalls();
    const profile = await resolveProfile(authUserId);
    const participant = await prisma.callParticipant.findFirst({
      where: {
        userId: profile.id,
        status: { in: ["RINGING", "JOINED"] },
        call: { status: { in: LIVE_CALL_STATUSES } },
      },
      orderBy: { createdAt: "desc" },
      select: { callId: true, status: true },
    });
    if (!participant) return null;
    return { participantStatus: participant.status, call: await getCallRecord(participant.callId) };
  }

  async function joinCall({ authUserId, callId }) {
    const config = assertEnabled();
    await expireStaleCalls();
    const profile = await resolveProfile(authUserId);
    const before = await getCallRecord(callId);
    const participant = await assertCallAccess(before, profile.id);
    if (before.status === "ENDED") throw new CallServiceError("Esta llamada ya termino.", 409);
    if (["DECLINED", "MISSED", "LEFT"].includes(participant.status)) {
      throw new CallServiceError("Ya no puedes unirte a esta llamada.", 409);
    }

    const shouldActivate = profile.id !== before.initiatedByUserId || before.status === "ACTIVE";
    const operations = [
      prisma.callParticipant.update({
        where: { callId_userId: { callId, userId: profile.id } },
        data: { status: "JOINED", joinedAt: participant.joinedAt ?? now(), leftAt: null },
      }),
    ];
    if (shouldActivate) {
      operations.push(prisma.call.update({
        where: { id: callId },
        data: { status: "ACTIVE", startedAt: before.startedAt ?? now() },
      }));
    }
    await prisma.$transaction(operations);
    const call = await getCallRecord(callId);
    return {
      callId,
      call,
      livekitUrl: config.publicUrl,
      token: await createToken(config, call, profile),
    };
  }

  async function declineCall({ authUserId, callId }) {
    assertEnabled();
    await expireStaleCalls();
    const profile = await resolveProfile(authUserId);
    const call = await getCallRecord(callId);
    const participant = await assertCallAccess(call, profile.id);
    if (call.status === "ENDED") return call;
    if (participant.userId === call.initiatedByUserId) {
      throw new CallServiceError("El iniciador debe finalizar la llamada.", 409);
    }
    await prisma.callParticipant.update({
      where: { callId_userId: { callId, userId: profile.id } },
      data: { status: "DECLINED", leftAt: now() },
    });
    const remaining = await prisma.callParticipant.count({
      where: { callId, userId: { not: call.initiatedByUserId }, status: { in: ["RINGING", "JOINED"] } },
    });
    if (remaining === 0 && call.status === "RINGING") {
      await endCallRecord(call, "rejected");
    }
    return getCallRecord(callId);
  }

  async function endCallRecord(call, reason = "ended") {
    await prisma.$transaction([
      prisma.callParticipant.updateMany({
        where: { callId: call.id, status: "RINGING" },
        data: { status: reason === "missed" ? "MISSED" : "DECLINED", leftAt: now() },
      }),
      prisma.callParticipant.updateMany({
        where: { callId: call.id, status: "JOINED" },
        data: { status: "LEFT", leftAt: now() },
      }),
      prisma.call.update({
        where: { id: call.id },
        data: { status: "ENDED", endedAt: now(), endReason: reason },
      }),
    ]);
    await closeLiveKitRoom(call);
  }

  async function leaveCall({ authUserId, callId }) {
    assertEnabled();
    const profile = await resolveProfile(authUserId);
    const call = await getCallRecord(callId);
    await assertCallAccess(call, profile.id);
    if (call.status === "ENDED") return call;
    await prisma.callParticipant.update({
      where: { callId_userId: { callId, userId: profile.id } },
      data: { status: "LEFT", leftAt: now() },
    });
    const joinedCount = await prisma.callParticipant.count({
      where: { callId, status: "JOINED" },
    });
    if (profile.id === call.initiatedByUserId || joinedCount === 0) {
      await endCallRecord(call, "ended");
    }
    return getCallRecord(callId);
  }

  async function endCall({ authUserId, callId }) {
    assertEnabled();
    const profile = await resolveProfile(authUserId);
    const call = await getCallRecord(callId);
    await assertCallAccess(call, profile.id);
    if (call.status === "ENDED") return call;
    if (profile.id !== call.initiatedByUserId) {
      const roleRows = await prisma.$queryRaw`
        SELECT r.is_system AS "isSystem", r.permissions
        FROM chat_conversation_members m
        JOIN chat_channel_roles r ON r.id = m.role_id
        WHERE m.conversation_id = ${call.conversationId}
          AND m.user_id = ${profile.id}
          AND m.left_at IS NULL
        LIMIT 1
      `;
      const role = roleRows[0];
      if (!role?.isSystem && role?.permissions?.["channel.manage"] !== true) {
        throw new CallServiceError("No tienes permiso para finalizar esta llamada.", 403);
      }
    }
    await endCallRecord(call, "ended");
    return getCallRecord(callId);
  }

  function startExpirySweeper() {
    if (!getConfig().enabled) return () => {};
    const timer = setInterval(() => {
      expireStaleCalls().catch((error) => {
        console.error("[atlas.calls] Error expirando llamadas:", error?.message ?? error);
      });
    }, 15_000);
    timer.unref?.();
    return () => clearInterval(timer);
  }

  return {
    getConfigStatus,
    createCall,
    getCall,
    getCurrentCall,
    joinCall,
    declineCall,
    leaveCall,
    endCall,
    expireStaleCalls,
    startExpirySweeper,
  };
}
