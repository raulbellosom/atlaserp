export class CallMessageError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "CallMessageError";
    this.status = status;
  }
}

const MAX_BODY = 4000;

function cleanBody(body) {
  const b = String(body ?? "").trim();
  if (!b) throw new CallMessageError("El mensaje no puede estar vacío.", 422);
  if (b.length > MAX_BODY) throw new CallMessageError("El mensaje es demasiado largo.", 422);
  return b;
}

export function createCallMessagesService({ prisma, guestService = null, broadcaster = null, now = () => new Date() }) {
  async function loadCall(callId) {
    const rows = await prisma.$queryRaw`
      SELECT id, conversation_id AS "conversationId", status FROM "call" WHERE id = ${callId} LIMIT 1
    `;
    if (!rows.length) throw new CallMessageError("Llamada no encontrada.", 404);
    return rows[0];
  }

  async function assertMember(conversationId, profileId) {
    const rows = await prisma.$queryRaw`
      SELECT m.id FROM chat_conversation_members m
      JOIN chat_conversations c ON c.id = m.conversation_id
      WHERE m.conversation_id = ${conversationId} AND m.user_id = ${profileId}
        AND m.left_at IS NULL AND c.deleted_at IS NULL
      LIMIT 1
    `;
    if (!rows.length) throw new CallMessageError("No formas parte de esta conversación.", 403);
  }

  async function displayName(profileId) {
    const rows = await prisma.$queryRaw`SELECT display_name AS "displayName" FROM user_profile WHERE id = ${profileId} LIMIT 1`;
    return rows[0]?.displayName ?? "Usuario";
  }

  function shape(m) {
    return {
      id: m.id,
      senderKind: m.senderKind,
      senderName: m.senderName,
      senderUserId: m.senderUserId ?? null,
      body: m.body,
      createdAt: m.createdAt,
    };
  }

  async function postMemberMessage({ profileId, callId, body }) {
    const clean = cleanBody(body);
    const call = await loadCall(callId);
    await assertMember(call.conversationId, profileId);
    const name = await displayName(profileId);
    const created = await prisma.callMessage.create({
      data: { callId, senderKind: "user", senderUserId: profileId, senderName: name, body: clean },
    });
    return { message: shape(created) };
  }

  async function postGuestMessage({ guestToken, body }) {
    const clean = cleanBody(body);
    if (!guestService?.resolveAdmittedGuestForMessage) throw new CallMessageError("No disponible.", 500);
    const { guestId, callId, displayName: name } = await guestService.resolveAdmittedGuestForMessage({ guestToken });
    const created = await prisma.callMessage.create({
      data: { callId, senderKind: "guest", senderGuestId: guestId, senderName: name, body: clean },
    });
    return { message: shape(created) };
  }

  async function listMessages({ callId, sinceId = null, limit = 200 }) {
    const where = { callId };
    if (sinceId) where.id = { gt: sinceId };
    const rows = await prisma.callMessage.findMany({
      where, orderBy: { createdAt: "asc" }, take: Math.min(limit, 500),
      select: { id: true, senderKind: true, senderName: true, body: true, createdAt: true, senderUserId: true },
    });
    return { messages: rows.map(shape) };
  }

  async function listMessagesGuarded({ profileId, callId, sinceId = null }) {
    const call = await loadCall(callId);
    await assertMember(call.conversationId, profileId);
    return listMessages({ callId, sinceId });
  }

  return { postMemberMessage, postGuestMessage, listMessages, listMessagesGuarded };
}
