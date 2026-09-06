import crypto from "node:crypto";
import { AccessToken, RoomServiceClient } from "livekit-server-sdk";
import { readLiveKitConfig } from "./call-service.js";

const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 8;
const MAX_GUESTS_PER_CALL = 20;
const GUEST_TOKEN_TTL = "15m";
const ABANDON_MS = 2 * 60 * 1000;
const LIVE = ["RINGING", "ACTIVE"];

export class CallGuestError extends Error {
  constructor(message, status = 400, reason = null) {
    super(message);
    this.name = "CallGuestError";
    this.status = status;
    this.reason = reason;
  }
}

function hashToken(raw) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export function createCallGuestService({
  prisma,
  env = process.env,
  AccessTokenImpl = AccessToken,
  RoomServiceClientImpl = RoomServiceClient,
  linksService,
  callService = null,
  broadcaster = null,
  notificationService = null,
  now = () => new Date(),
}) {
  function config() {
    return readLiveKitConfig(env);
  }
  function assertEnabled() {
    const c = config();
    if (!c.enabled) throw new CallGuestError("Las llamadas no están configuradas.", 501);
    return c;
  }

  async function liveCallForConversation(conversationId) {
    const rows = await prisma.$queryRaw`
      SELECT id, conversation_id AS "conversationId", kind, status,
             livekit_room_name AS "livekitRoomName", initiated_by_user_id AS "initiatedByUserId"
      FROM "call"
      WHERE conversation_id = ${conversationId} AND status IN ('RINGING','ACTIVE')
      ORDER BY created_at DESC LIMIT 1
    `;
    return rows[0] ?? null;
  }

  async function liveCallById(callId) {
    const rows = await prisma.$queryRaw`
      SELECT id, conversation_id AS "conversationId", kind, status,
             livekit_room_name AS "livekitRoomName", initiated_by_user_id AS "initiatedByUserId"
      FROM "call" WHERE id = ${callId} LIMIT 1
    `;
    return rows[0] ?? null;
  }

  async function resolveGuest(guestToken) {
    if (!guestToken) throw new CallGuestError("Sesión de invitado no válida.", 401);
    const guest = await prisma.callGuest.findFirst({ where: { sessionTokenHash: hashToken(guestToken) } });
    if (!guest) throw new CallGuestError("Sesión de invitado no válida o expirada.", 401);
    return guest;
  }

  async function recordAttempt(ip, linkId, outcome) {
    try {
      await prisma.callGuestJoinAttempt.create({ data: { ip: ip ?? "unknown", linkId: linkId ?? null, outcome } });
    } catch { /* non-fatal */ }
  }

  async function notifyMembers(call, event, payload) {
    try {
      const parts = await prisma.callParticipant.findMany({
        where: { callId: call.id, status: { in: ["RINGING", "JOINED"] } },
        select: { userId: true },
      });
      const ids = [...new Set(parts.map((p) => p.userId).filter(Boolean))];
      if (ids.length) await broadcaster?.broadcastToUsers?.(ids, event, payload);
    } catch { /* non-fatal */ }
  }

  async function joinAsGuest({ token = null, code = null, inviteToken = null, displayName, email = null, ip = null, userAgent = null }) {
    assertEnabled();
    const name = String(displayName ?? "").trim();
    if (name.length < 2 || name.length > 40) throw new CallGuestError("El nombre debe tener entre 2 y 40 caracteres.", 422);

    const recent = await prisma.callGuestJoinAttempt.count({
      where: { ip: ip ?? "unknown", createdAt: { gte: new Date(now().getTime() - RATE_WINDOW_MS) } },
    });
    if (recent >= RATE_MAX) {
      await recordAttempt(ip, null, "rate_limited");
      throw new CallGuestError("Demasiados intentos. Espera unos minutos.", 429, "rate_limited");
    }

    let link;
    try {
      link = await linksService.resolveLinkForJoin({ token, code });
    } catch (error) {
      await recordAttempt(ip, null, error.reason ?? "bad_token");
      throw new CallGuestError(error.message, error.status ?? 400, error.reason ?? "bad_token");
    }

    let invite = null;
    if (inviteToken) {
      invite = await linksService.resolveInvite({ inviteToken, linkId: link.id });
      if (invite?.acceptedAt) {
        const activePrev = await prisma.callGuest.findFirst({
          where: { inviteId: invite.id, status: { in: ["LOBBY", "ADMITTED"] } },
        });
        if (activePrev) throw new CallGuestError("Esta invitación ya está en uso.", 409, "invite_in_use");
      }
      if (invite?.email && !email) email = invite.email;
    }

    const call = await liveCallForConversation(link.conversationId);
    if (!call) {
      await recordAttempt(ip, link.id, "no_live_call");
      return { status: "waiting" };
    }

    const activeGuests = await prisma.callGuest.count({
      where: { callId: call.id, status: { in: ["LOBBY", "ADMITTED"] } },
    });
    if (activeGuests >= MAX_GUESTS_PER_CALL) {
      await recordAttempt(ip, link.id, "call_full");
      throw new CallGuestError("La llamada alcanzó el máximo de invitados.", 409, "call_full");
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    const status = link.requireLobby ? "LOBBY" : "ADMITTED";
    const guest = await prisma.callGuest.create({
      data: {
        callId: call.id,
        linkId: link.id,
        inviteId: invite?.id ?? null,
        displayName: name,
        email: email ?? null,
        sessionTokenHash: hashToken(rawToken),
        livekitIdentity: `guest_${crypto.randomUUID()}`,
        status,
        admittedByUserId: null,
        admittedAt: status === "ADMITTED" ? now() : null,
        joinIp: ip ?? null,
        userAgent: userAgent ?? null,
        lastSeenAt: now(),
      },
    });

    await prisma.callLink.update({ where: { id: link.id }, data: { useCount: { increment: 1 } } }).catch(() => {});
    if (invite && !invite.acceptedAt) {
      await prisma.callInvite.update({ where: { id: invite.id }, data: { acceptedAt: now() } }).catch(() => {});
    }
    await recordAttempt(ip, link.id, "ok");

    await notifyMembers(call, status === "LOBBY" ? "chat.call.guest_waiting" : "chat.call.guest_joined", {
      callId: call.id, guestId: guest.id, name,
    });
    if (notificationService?.publish && status === "LOBBY") {
      setImmediate(async () => {
        try {
          const membership = await prisma.membership.findFirst({
            where: { userId: call.initiatedByUserId, enabled: true },
            orderBy: { createdAt: "desc" }, select: { companyId: true },
          });
          if (!membership?.companyId) return;
          await notificationService.publish({
            companyId: membership.companyId,
            input: {
              eventType: "chat.call.guest_waiting",
              title: "Invitado esperando en la llamada",
              body: `${name} quiere unirse.`,
              link: `/app/m/atlas.chat/chat/inbox/${call.conversationId}`,
              recipients: { userIds: [call.initiatedByUserId] },
              channels: ["in_app"],
              priority: "high",
              sourceType: "call",
              sourceId: call.id,
              dedupeKey: `chat.call.guest_waiting:${guest.id}`,
            },
          });
        } catch { /* non-fatal */ }
      });
    }

    return {
      guestToken: rawToken,
      guestId: guest.id,
      status,
      callId: call.id,
      requiresLobby: link.requireLobby,
    };
  }

  async function getGuestState({ guestToken }) {
    assertEnabled();
    const guest = await resolveGuest(guestToken);
    await prisma.callGuest.update({ where: { id: guest.id }, data: { lastSeenAt: now() } }).catch(() => {});
    const call = await liveCallById(guest.callId);
    const live = call && LIVE.includes(call.status);

    let roster = [];
    let messages = [];
    if (live && guest.status === "ADMITTED") {
      const guests = await prisma.callGuest.findMany({
        where: { callId: guest.callId, status: { in: ["ADMITTED"] } },
        select: { id: true, displayName: true },
      });
      roster = guests.map((g) => ({ name: g.displayName, isYou: g.id === guest.id }));
      const rows = await prisma.callMessage.findMany({
        where: { callId: guest.callId },
        orderBy: { createdAt: "asc" }, take: 200,
        select: { id: true, senderKind: true, senderName: true, body: true, createdAt: true },
      });
      messages = rows;
    }

    return {
      status: guest.status,
      callEnded: Boolean(call) && !live,
      call: call ? { id: call.id, kind: call.kind } : null,
      livekitUrl: config().publicUrl,
      guests: roster,
      messages,
    };
  }

  async function getGuestLiveKitToken({ guestToken }) {
    const c = assertEnabled();
    const guest = await resolveGuest(guestToken);
    if (guest.status !== "ADMITTED") throw new CallGuestError("Aún no te han admitido.", 403, guest.status);
    const call = await liveCallById(guest.callId);
    if (!call || !LIVE.includes(call.status)) throw new CallGuestError("La llamada no está activa.", 409, "not_live");

    const at = new AccessTokenImpl(c.apiKey, c.apiSecret, {
      identity: guest.livekitIdentity,
      name: guest.displayName,
      metadata: JSON.stringify({ guest: true }),
      ttl: GUEST_TOKEN_TTL,
    });
    at.addGrant({ room: call.livekitRoomName, roomJoin: true, canPublish: true, canSubscribe: true, canPublishData: true });
    await prisma.callGuest.update({ where: { id: guest.id }, data: { lastSeenAt: now() } }).catch(() => {});
    return { livekitUrl: c.publicUrl, token: await at.toJwt() };
  }

  async function heartbeatGuest({ guestToken }) {
    const guest = await resolveGuest(guestToken);
    await prisma.callGuest.update({ where: { id: guest.id }, data: { lastSeenAt: now() } });
    return { ok: true };
  }

  async function leaveGuest({ guestToken }) {
    const guest = await resolveGuest(guestToken);
    await prisma.callGuest.update({ where: { id: guest.id }, data: { status: "LEFT", leftAt: now() } });
    return { ok: true };
  }

  async function resolveAdmittedGuestForMessage({ guestToken }) {
    const guest = await resolveGuest(guestToken);
    if (guest.status !== "ADMITTED") throw new CallGuestError("Aún no te han admitido.", 403);
    const call = await liveCallById(guest.callId);
    if (!call || !LIVE.includes(call.status)) throw new CallGuestError("La llamada no está activa.", 409);
    return { guestId: guest.id, callId: guest.callId, displayName: guest.displayName };
  }

  // ---- host moderation -------------------------------------------------------

  async function assertManage({ profileId, callId, action }) {
    const call = await liveCallById(callId);
    if (!call) throw new CallGuestError("Llamada no encontrada.", 404);
    if (!callService?.assertCanManageCall) throw new CallGuestError("No disponible.", 500);
    await callService.assertCanManageCall({
      conversationId: call.conversationId,
      initiatedByUserId: call.initiatedByUserId,
      profileId,
      action,
    });
    return call;
  }

  async function listCallGuests({ profileId, callId }) {
    await assertManage({ profileId, callId, action: "ver los invitados" });
    const guests = await prisma.callGuest.findMany({
      where: { callId, status: { in: ["LOBBY", "ADMITTED", "KICKED", "DENIED"] } },
      orderBy: { createdAt: "asc" },
      select: { id: true, displayName: true, email: true, status: true, admittedAt: true, createdAt: true },
    });
    return { guests };
  }

  async function setGuestStatus({ profileId, callId, guestId, status, action, event }) {
    const call = await assertManage({ profileId, callId, action });
    const guest = await prisma.callGuest.findFirst({ where: { id: guestId, callId } });
    if (!guest) throw new CallGuestError("Invitado no encontrado.", 404);
    const data = { status };
    if (status === "ADMITTED") { data.admittedByUserId = profileId; data.admittedAt = now(); }
    if (status === "LEFT" || status === "KICKED" || status === "DENIED") data.leftAt = now();
    await prisma.callGuest.update({ where: { id: guest.id }, data });
    if (status === "KICKED") {
      try {
        const rc = new RoomServiceClientImpl(config().internalUrl, config().apiKey, config().apiSecret);
        await rc.removeParticipant(call.livekitRoomName, guest.livekitIdentity);
      } catch { /* best effort */ }
    }
    await notifyMembers(call, event, { callId, guestId, name: guest.displayName });
    return { ok: true, status };
  }

  const admitGuest = (a) => setGuestStatus({ ...a, status: "ADMITTED", action: "admitir invitados", event: "chat.call.guest_admitted" });
  const denyGuest = (a) => setGuestStatus({ ...a, status: "DENIED", action: "rechazar invitados", event: "chat.call.guest_denied" });
  const kickGuest = (a) => setGuestStatus({ ...a, status: "KICKED", action: "expulsar invitados", event: "chat.call.guest_kicked" });

  async function muteGuest({ profileId, callId, guestId, muted }) {
    const call = await assertManage({ profileId, callId, action: "silenciar invitados" });
    const guest = await prisma.callGuest.findFirst({ where: { id: guestId, callId } });
    if (!guest) throw new CallGuestError("Invitado no encontrado.", 404);
    try {
      const rc = new RoomServiceClientImpl(config().internalUrl, config().apiKey, config().apiSecret);
      const parts = await rc.listParticipants(call.livekitRoomName);
      const p = parts.find((x) => x.identity === guest.livekitIdentity);
      const audio = p?.tracks?.find((t) => t.type === 1 /* AUDIO */ || t.source === 2);
      if (audio) await rc.mutePublishedTrack(call.livekitRoomName, guest.livekitIdentity, audio.sid, muted);
    } catch { /* best effort */ }
    return { ok: true, muted };
  }

  async function kickGuestsForLink({ linkId }) {
    const guests = await prisma.callGuest.findMany({
      where: { linkId, status: { in: ["LOBBY", "ADMITTED"] } },
      select: { id: true, callId: true, livekitIdentity: true },
    });
    for (const g of guests) {
      await prisma.callGuest.update({ where: { id: g.id }, data: { status: "KICKED", leftAt: now() } }).catch(() => {});
      const call = await liveCallById(g.callId);
      if (call && LIVE.includes(call.status)) {
        try {
          const rc = new RoomServiceClientImpl(config().internalUrl, config().apiKey, config().apiSecret);
          await rc.removeParticipant(call.livekitRoomName, g.livekitIdentity);
        } catch { /* best effort */ }
      }
    }
    return { kicked: guests.length };
  }

  async function sweepAbandonedGuests() {
    const cutoff = new Date(now().getTime() - ABANDON_MS);
    const res = await prisma.callGuest.updateMany({
      where: { status: "LOBBY", lastSeenAt: { lt: cutoff } },
      data: { status: "DENIED", leftAt: now() },
    });
    return res?.count ?? 0;
  }

  return {
    joinAsGuest,
    getGuestState,
    getGuestLiveKitToken,
    heartbeatGuest,
    leaveGuest,
    resolveAdmittedGuestForMessage,
    listCallGuests,
    admitGuest,
    denyGuest,
    kickGuest,
    muteGuest,
    kickGuestsForLink,
    sweepAbandonedGuests,
  };
}
