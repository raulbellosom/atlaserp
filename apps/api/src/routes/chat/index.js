import crypto from "node:crypto";
import { Hono } from "hono";
import {
  chatCreateConversationSchema,
  chatSendMessageSchema,
  chatEditMessageSchema,
  chatUpdateConversationSchema,
  chatAddMembersSchema,
  chatPresignAttachmentSchema,
  chatGuestSessionSchema,
  chatGuestMessageSchema,
  chatAssignOperatorSchema,
} from "@atlas/validators";
import { createChatService, ChatServiceError } from "./chat-service.js";
import { createGuestChatService, GuestChatServiceError } from "./guest-service.js";
import { createChatTemplateService } from "./template-service.js";
import { expireStaleGuestSessions } from "./session-expiry-job.js";

function handleError(c, err, fallback) {
  if (err instanceof ChatServiceError || err instanceof GuestChatServiceError) {
    return c.json({ error: err.message }, err.status);
  }
  console.error("[atlas.chat]", err?.message ?? err);
  if (err?.stack) console.error(err.stack);
  return c.json({ error: fallback }, 500);
}

export function createChatRouter({ prisma, supabaseAdmin, authMiddleware, requirePermission, notificationService = null, broadcaster = null }) {
  const app = new Hono();
  const chatService = createChatService({ prisma, supabaseAdmin, notificationService, broadcaster });
  const guestService = createGuestChatService({ prisma, supabaseAdmin, notificationService });
  const templateService = createChatTemplateService({ prisma });

  // ================================================================
  // INTERNAL CHAT — all routes require authentication
  // ================================================================
  const internal = new Hono();
  internal.use("*", authMiddleware);

  // GET /chat/conversations
  internal.get("/conversations", requirePermission("chat.conversations.read"), async (c) => {
    try {
      const authUserId = c.get("authUserId");
      const { limit, cursor } = c.req.query();
      const result = await chatService.listConversations({
        authUserId,
        limit: limit ? Math.min(parseInt(limit, 10), 100) : 50,
        cursor: cursor || null,
      });
      return c.json(result);
    } catch (err) {
      return handleError(c, err, "Error listando conversaciones.");
    }
  });

  // POST /chat/conversations
  internal.post("/conversations", requirePermission("chat.conversations.create"), async (c) => {
    try {
      const authUserId = c.get("authUserId");
      const body = await c.req.json();
      const data = chatCreateConversationSchema.parse(body);
      const result = await chatService.createConversation({ authUserId, ...data });
      return c.json({ data: result }, 201);
    } catch (err) {
      if (err?.name === "ZodError") return c.json({ error: (err.errors ?? err.issues)?.[0]?.message ?? "Datos invalidos." }, 422);
      return handleError(c, err, "Error creando conversacion.");
    }
  });

  // GET /chat/conversations/:id
  internal.get("/conversations/:id", requirePermission("chat.conversations.read"), async (c) => {
    try {
      const authUserId = c.get("authUserId");
      const conversationId = c.req.param("id");
      const result = await chatService.getConversation({ conversationId, authUserId });
      return c.json({ data: result });
    } catch (err) {
      return handleError(c, err, "Error obteniendo conversacion.");
    }
  });

  // PATCH /chat/conversations/:id
  internal.patch("/conversations/:id", requirePermission("chat.conversations.create"), async (c) => {
    try {
      const authUserId = c.get("authUserId");
      const conversationId = c.req.param("id");
      const body = await c.req.json();
      const updates = chatUpdateConversationSchema.parse(body);
      const result = await chatService.updateConversation({ conversationId, authUserId, updates });
      return c.json({ data: result });
    } catch (err) {
      if (err?.name === "ZodError") return c.json({ error: (err.errors ?? err.issues)?.[0]?.message ?? "Datos invalidos." }, 422);
      return handleError(c, err, "Error actualizando conversacion.");
    }
  });

  // GET /chat/conversations/:id/messages
  internal.get("/conversations/:id/messages", requirePermission("chat.conversations.read"), async (c) => {
    try {
      const authUserId = c.get("authUserId");
      const conversationId = c.req.param("id");
      const { limit, before } = c.req.query();
      const result = await chatService.listMessages({
        conversationId,
        authUserId,
        limit: limit ? Math.min(parseInt(limit, 10), 100) : 40,
        before: before || null,
      });
      return c.json(result);
    } catch (err) {
      return handleError(c, err, "Error listando mensajes.");
    }
  });

  // POST /chat/conversations/:id/messages
  internal.post("/conversations/:id/messages", requirePermission("chat.conversations.create"), async (c) => {
    try {
      const authUserId = c.get("authUserId");
      const conversationId = c.req.param("id");
      const body = await c.req.json();
      const data = chatSendMessageSchema.parse(body);
      const result = await chatService.sendMessage({ conversationId, authUserId, ...data });
      return c.json({ data: result }, 201);
    } catch (err) {
      if (err?.name === "ZodError") return c.json({ error: (err.errors ?? err.issues)?.[0]?.message ?? "Datos invalidos." }, 422);
      return handleError(c, err, "Error enviando mensaje.");
    }
  });

  // PATCH /chat/messages/:messageId
  internal.patch("/messages/:messageId", requirePermission("chat.conversations.create"), async (c) => {
    try {
      const authUserId = c.get("authUserId");
      const messageId = c.req.param("messageId");
      const body = await c.req.json();
      const data = chatEditMessageSchema.parse(body);
      const result = await chatService.editMessage({ messageId, authUserId, body: data.body });
      return c.json({ data: result });
    } catch (err) {
      if (err?.name === "ZodError") return c.json({ error: (err.errors ?? err.issues)?.[0]?.message ?? "Datos invalidos." }, 422);
      return handleError(c, err, "Error editando mensaje.");
    }
  });

  // DELETE /chat/messages/:messageId
  internal.delete("/messages/:messageId", requirePermission("chat.conversations.create"), async (c) => {
    try {
      const authUserId = c.get("authUserId");
      const messageId = c.req.param("messageId");
      const result = await chatService.deleteMessage({ messageId, authUserId });
      return c.json(result);
    } catch (err) {
      return handleError(c, err, "Error eliminando mensaje.");
    }
  });

  // POST /chat/conversations/:id/members
  internal.post("/conversations/:id/members", requirePermission("chat.conversations.create"), async (c) => {
    try {
      const authUserId = c.get("authUserId");
      const conversationId = c.req.param("id");
      const body = await c.req.json();
      const data = chatAddMembersSchema.parse(body);
      const result = await chatService.addMembers({ conversationId, authUserId, ...data });
      return c.json(result, 201);
    } catch (err) {
      if (err?.name === "ZodError") return c.json({ error: (err.errors ?? err.issues)?.[0]?.message ?? "Datos invalidos." }, 422);
      return handleError(c, err, "Error agregando miembros.");
    }
  });

  // DELETE /chat/conversations/:id/members/:userId
  internal.delete("/conversations/:id/members/:userId", requirePermission("chat.conversations.create"), async (c) => {
    try {
      const authUserId = c.get("authUserId");
      const conversationId = c.req.param("id");
      const targetUserId = c.req.param("userId");
      const result = await chatService.removeMember({ conversationId, authUserId, targetUserId });
      return c.json(result);
    } catch (err) {
      return handleError(c, err, "Error eliminando miembro.");
    }
  });

  // POST /chat/conversations/:id/read
  internal.post("/conversations/:id/read", requirePermission("chat.conversations.read"), async (c) => {
    try {
      const authUserId = c.get("authUserId");
      const conversationId = c.req.param("id");
      const result = await chatService.markConversationRead({ conversationId, authUserId });
      return c.json(result);
    } catch (err) {
      return handleError(c, err, "Error marcando como leido.");
    }
  });

  // PATCH /chat/availability
  internal.patch("/availability", requirePermission("chat.support.manage"), async (c) => {
    try {
      const authUserId = c.get("authUserId");
      const body = await c.req.json();
      if (typeof body?.available !== "boolean") {
        return c.json({ error: "El campo 'available' es requerido y debe ser booleano." }, 422);
      }
      const profile = await prisma.userProfile.update({
        where: { authUserId },
        data: { availableForChat: body.available },
        select: { id: true, availableForChat: true },
      });
      return c.json({ ok: true, available: profile.availableForChat });
    } catch (err) {
      return handleError(c, err, "Error actualizando disponibilidad.");
    }
  });

  // POST /chat/attachments/presign
  internal.post("/attachments/presign", requirePermission("chat.conversations.create"), async (c) => {
    try {
      const authUserId = c.get("authUserId");
      const body = await c.req.json();
      const data = chatPresignAttachmentSchema.parse(body);
      const result = await chatService.presignAttachmentUpload({ authUserId, ...data });
      return c.json({ data: result });
    } catch (err) {
      if (err?.name === "ZodError") return c.json({ error: (err.errors ?? err.issues)?.[0]?.message ?? "Datos invalidos." }, 422);
      return handleError(c, err, "Error generando URL de subida.");
    }
  });

  // GET /chat/attachments/:id/signed-url
  internal.get("/attachments/:id/signed-url", requirePermission("chat.conversations.read"), async (c) => {
    try {
      const authUserId = c.get("authUserId");
      const attachmentId = c.req.param("id");
      const result = await chatService.getAttachmentSignedUrl({ attachmentId, authUserId });
      return c.json({ data: result });
    } catch (err) {
      return handleError(c, err, "Error obteniendo URL del adjunto.");
    }
  });

  // ----------------------------------------------------------------
  // External inbox (operators)
  // ----------------------------------------------------------------

  // GET /chat/external/inbox
  internal.get("/external/inbox", requirePermission("chat.support.manage"), async (c) => {
    try {
      const authUserId = c.get("authUserId");
      const { status, limit, search } = c.req.query();
      const result = await chatService.listExternalInbox({
        authUserId,
        status: status ?? "open",
        limit: limit ? Math.min(parseInt(limit, 10), 100) : 30,
        search: search?.trim() || null,
      });
      return c.json(result);
    } catch (err) {
      return handleError(c, err, "Error listando bandeja externa.");
    }
  });

  // GET /chat/external/:conversationId/messages
  internal.get("/external/:conversationId/messages", requirePermission("chat.support.manage"), async (c) => {
    try {
      const authUserId = c.get("authUserId");
      const conversationId = c.req.param("conversationId");
      const { limit, before } = c.req.query();

      // Add operator as member if not already
      const profileRows = await prisma.$queryRaw`
        SELECT id FROM user_profile WHERE auth_user_id = ${authUserId} LIMIT 1
      `;
      if (profileRows.length) {
        await prisma.$executeRaw`
          INSERT INTO chat_conversation_members (conversation_id, user_id, role)
          VALUES (${conversationId}, ${profileRows[0].id}, 'operator')
          ON CONFLICT DO NOTHING
        `;
      }

      const result = await chatService.listMessages({
        conversationId,
        authUserId,
        limit: limit ? parseInt(limit, 10) : 40,
        before: before || null,
      });
      return c.json(result);
    } catch (err) {
      return handleError(c, err, "Error listando mensajes externos.");
    }
  });

  // POST /chat/external/:conversationId/messages
  internal.post("/external/:conversationId/messages", requirePermission("chat.support.manage"), async (c) => {
    try {
      const authUserId = c.get("authUserId");
      const conversationId = c.req.param("conversationId");
      const body = await c.req.json();
      const data = chatSendMessageSchema.parse(body);

      // Auto-join as operator and fetch profile for broadcast
      const profileRows = await prisma.$queryRaw`
        SELECT id, display_name AS "displayName", avatar_url AS "avatarUrl"
        FROM user_profile WHERE auth_user_id = ${authUserId} LIMIT 1
      `;
      if (profileRows.length) {
        await prisma.$executeRaw`
          INSERT INTO chat_conversation_members (conversation_id, user_id, role)
          VALUES (${conversationId}, ${profileRows[0].id}, 'operator')
          ON CONFLICT DO NOTHING
        `;
      }

      const result = await chatService.sendMessage({ conversationId, authUserId, ...data });

      // Notify the guest widget in real time (includes operator profile for display)
      supabaseAdmin
        .channel(`chat:conv:${conversationId}`)
        .send({
          type: "broadcast",
          event: "new_operator_message",
          payload: {
            conversationId,
            messageId: result.id,
            body: data.body,
            senderType: "user",
            senderName: profileRows[0]?.displayName ?? "Operador",
            senderAvatarUrl: profileRows[0]?.avatarUrl ?? null,
            createdAt: result.created_at,
          },
        })
        .catch(() => {});

      return c.json({ data: result }, 201);
    } catch (err) {
      if (err?.name === "ZodError") return c.json({ error: (err.errors ?? err.issues)?.[0]?.message ?? "Datos invalidos." }, 422);
      return handleError(c, err, "Error enviando mensaje externo.");
    }
  });

  // POST /chat/external/:conversationId/assign
  internal.post("/external/:conversationId/assign", requirePermission("chat.support.manage"), async (c) => {
    try {
      const authUserId = c.get("authUserId");
      const conversationId = c.req.param("conversationId");
      const body = await c.req.json();
      const data = chatAssignOperatorSchema.parse(body);
      const result = await chatService.assignOperator({ conversationId, authUserId, ...data });
      return c.json(result);
    } catch (err) {
      if (err?.name === "ZodError") return c.json({ error: (err.errors ?? err.issues)?.[0]?.message ?? "Datos invalidos." }, 422);
      return handleError(c, err, "Error asignando operador.");
    }
  });

  // GET /chat/operators/available — list operators available for chat in the caller's company
  internal.get("/operators/available", requirePermission("chat.support.manage"), async (c) => {
    try {
      const authUserId = c.get("authUserId");
      const profileRows = await prisma.$queryRaw`
        SELECT company_id FROM user_profile WHERE auth_user_id = ${authUserId} LIMIT 1
      `;
      if (!profileRows[0]) return c.json({ data: [] });
      const companyId = profileRows[0].company_id;
      const operators = await prisma.$queryRaw`
        SELECT id,
               display_name AS "displayName",
               avatar_url AS "avatarUrl",
               email,
               available_for_chat AS "availableForChat"
        FROM user_profile
        WHERE company_id = ${companyId}::uuid
          AND available_for_chat = true
        ORDER BY display_name ASC
      `;
      return c.json({ data: operators });
    } catch (err) {
      return handleError(c, err, "Error obteniendo operadores.");
    }
  });

  // POST /chat/external/:conversationId/close
  internal.post("/external/:conversationId/close", requirePermission("chat.support.manage"), async (c) => {
    try {
      const authUserId = c.get("authUserId");
      const conversationId = c.req.param("conversationId");
      const result = await chatService.closeExternalConversation({ conversationId, authUserId });
      return c.json(result);
    } catch (err) {
      return handleError(c, err, "Error cerrando conversacion.");
    }
  });

  // ================================================================
  // PUBLIC GUEST CHAT — no auth, token-based
  // ================================================================
  const pub = new Hono();

  // POST /public/chat/session
  pub.post("/session", async (c) => {
    try {
      const body = await c.req.json();
      const data = chatGuestSessionSchema.parse(body);

      // Resolve companyId from X-Atlas-Company header for assignment + lead capture
      let companyId = null;
      const companySlug = c.req.header("X-Atlas-Company");
      if (companySlug) {
        const company = await prisma.company.findUnique({ where: { slug: companySlug }, select: { id: true } });
        companyId = company?.id ?? null;
      }

      const result = await guestService.createGuestSession({ ...data, companyId });
      return c.json({ data: result }, 201);
    } catch (err) {
      if (err?.name === "ZodError") return c.json({ error: (err.errors ?? err.issues)?.[0]?.message ?? "Datos invalidos." }, 422);
      return handleError(c, err, "Error creando sesion de invitado.");
    }
  });

  // GET /public/chat/session/:token
  pub.get("/session/:token", async (c) => {
    try {
      const token = c.req.param("token");
      const result = await guestService.getGuestSessionInfo(token);
      return c.json({ data: result });
    } catch (err) {
      return handleError(c, err, "Error obteniendo sesion.");
    }
  });

  // POST /public/chat/session/:token/messages
  pub.post("/session/:token/messages", async (c) => {
    try {
      const rawToken = c.req.param("token");
      const body = await c.req.json();
      const data = chatGuestMessageSchema.parse(body);
      const result = await guestService.sendGuestMessage({ rawToken, ...data });
      return c.json({ data: result }, 201);
    } catch (err) {
      if (err?.name === "ZodError") return c.json({ error: (err.errors ?? err.issues)?.[0]?.message ?? "Datos invalidos." }, 422);
      return handleError(c, err, "Error enviando mensaje.");
    }
  });

  // GET /public/chat/session/:token/messages
  pub.get("/session/:token/messages", async (c) => {
    try {
      const rawToken = c.req.param("token");
      const { limit, before } = c.req.query();
      const result = await guestService.listGuestMessages({
        rawToken,
        limit: limit ? Math.min(parseInt(limit, 10), 60) : 40,
        before: before || null,
      });
      return c.json(result);
    } catch (err) {
      return handleError(c, err, "Error listando mensajes.");
    }
  });

  // POST /public/chat/session/resume-by-code
  // Guest lost their session but has their tracking code + email
  pub.post("/session/resume-by-code", async (c) => {
    try {
      const body = await c.req.json();
      const { trackingCode, email } = body;
      if (!trackingCode || !email) {
        return c.json({ error: "trackingCode y email son requeridos." }, 422);
      }

      // Find the conversation by tracking code
      const convRows = await prisma.$queryRaw`
        SELECT cc.id AS conversation_id, cc.company_id, cc.tracking_code,
               cgs.id AS session_id, cgs.email AS session_email
        FROM chat_conversations cc
        JOIN chat_guest_sessions cgs ON cgs.id = cc.created_by_guest_id
        WHERE LOWER(cc.tracking_code) = LOWER(${trackingCode.trim()})
          AND cc.deleted_at IS NULL
        LIMIT 1
      `;

      if (!convRows.length) {
        return c.json({ error: "Numero de seguimiento no encontrado." }, 404);
      }

      const conv = convRows[0];

      // Verify email matches (case insensitive)
      if (!conv.session_email || conv.session_email.toLowerCase() !== email.trim().toLowerCase()) {
        return c.json({ error: "El correo no coincide con el registrado para este chat." }, 403);
      }

      // Issue a single-use resume token
      const { randomBytes, createHash } = await import("node:crypto");
      const resumeToken = randomBytes(32).toString("hex");
      const resumeHash = createHash("sha256").update(resumeToken).digest("hex");

      await prisma.$executeRaw`
        UPDATE chat_guest_sessions
        SET resume_token_hash = ${resumeHash},
            idle_expires_at = NOW() + INTERVAL '30 minutes',
            absolute_expires_at = GREATEST(absolute_expires_at, NOW() + INTERVAL '30 minutes'),
            last_seen_at = NOW()
        WHERE id = ${conv.session_id}
      `;

      // Reopen conversation if it was closed due to expiry
      await prisma.$executeRaw`
        UPDATE chat_conversations
        SET status = 'open', updated_at = NOW()
        WHERE id = ${conv.conversation_id}
          AND status = 'closed'
          AND type = 'external_support'
      `;

      return c.json({
        data: {
          token: resumeToken,
          conversationId: conv.conversation_id,
          trackingCode: conv.tracking_code,
          resumed: true,
        },
      });
    } catch (err) {
      return handleError(c, err, "Error resumiendo sesion por codigo.");
    }
  });

  // POST /public/chat/session/:token/close
  pub.post("/session/:token/close", async (c) => {
    try {
      const rawToken = c.req.param("token");
      const result = await guestService.closeGuestSession({ rawToken });
      return c.json(result);
    } catch (err) {
      return handleError(c, err, "Error cerrando sesion.");
    }
  });

  // POST /public/chat/session/:token/attachments/presign
  // Guest uploads a file: we create the chat_attachment row + signed upload URL
  pub.post("/session/:token/attachments/presign", async (c) => {
    try {
      const rawToken = c.req.param("token");
      const body = await c.req.json();
      const { fileName, mimeType, sizeBytes } = body;

      if (!fileName || !mimeType || !sizeBytes) {
        return c.json({ error: "fileName, mimeType, sizeBytes son requeridos." }, 422);
      }

      const ALLOWED_MIME = [/^image\//, /^application\/pdf$/, /^text\/plain$/, /^application\/msword$/, /^application\/vnd\.openxmlformats/];
      if (!ALLOWED_MIME.some((re) => re.test(mimeType))) {
        return c.json({ error: "Tipo de archivo no permitido." }, 422);
      }
      if (sizeBytes > 20 * 1024 * 1024) {
        return c.json({ error: "Archivo demasiado grande (max 20 MB)." }, 422);
      }

      const session = await guestService.resolveGuestSession(rawToken);
      const convRows = await prisma.$queryRaw`
        SELECT c.id FROM chat_conversations c
        INNER JOIN chat_conversation_members ccm
          ON ccm.conversation_id = c.id AND ccm.guest_session_id = ${session.id}
        WHERE c.deleted_at IS NULL AND c.status != 'closed'
        ORDER BY c.created_at DESC LIMIT 1
      `;
      if (!convRows.length) return c.json({ error: "No hay conversacion activa." }, 404);
      const conversationId = convRows[0].id;

      const ext = fileName.split(".").pop()?.toLowerCase() ?? "bin";
      const objectKey = `conversations/${conversationId}/guest/${crypto.randomUUID()}.${ext}`;

      const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
        .from("atlas-chat")
        .createSignedUploadUrl(objectKey, { expiresIn: 300 });

      if (uploadError) return c.json({ error: "Error generando URL de subida." }, 500);

      const attRows = await prisma.$queryRaw`
        INSERT INTO chat_attachments
          (conversation_id, bucket, object_key, file_name, mime_type, size_bytes)
        VALUES (
          ${conversationId},
          'atlas-chat',
          ${objectKey},
          ${fileName},
          ${mimeType},
          ${sizeBytes}
        )
        RETURNING id
      `;

      return c.json({ data: { attachmentId: attRows[0].id, uploadUrl: uploadData.signedUrl } }, 201);
    } catch (err) {
      return handleError(c, err, "Error generando URL de subida.");
    }
  });

  // ================================================================
  // MESSAGE TEMPLATES
  // ================================================================

  internal.get("/templates", requirePermission("chat.conversations.create"), async (c) => {
    try {
      const companyId = c.get("companyId");
      const { search } = c.req.query();
      const data = await templateService.listTemplates({ companyId, search: search || undefined });
      return c.json({ data });
    } catch (err) {
      return handleError(c, err, "Error listando templates.");
    }
  });

  internal.post("/templates", requirePermission("chat.conversations.create"), async (c) => {
    try {
      const companyId = c.get("companyId");
      const actorId = c.get("userId");
      const body = await c.req.json();
      const data = await templateService.createTemplate({ companyId, actorId, ...body });
      return c.json({ data }, 201);
    } catch (err) {
      return handleError(c, err, "Error creando template.");
    }
  });

  internal.patch("/templates/:templateId", requirePermission("chat.conversations.create"), async (c) => {
    try {
      const companyId = c.get("companyId");
      const { templateId } = c.req.param();
      const body = await c.req.json();
      const data = await templateService.updateTemplate({ companyId, templateId, ...body });
      return c.json({ data });
    } catch (err) {
      return handleError(c, err, "Error actualizando template.");
    }
  });

  internal.delete("/templates/:templateId", requirePermission("chat.conversations.create"), async (c) => {
    try {
      const companyId = c.get("companyId");
      const { templateId } = c.req.param();
      await templateService.deleteTemplate({ companyId, templateId });
      return c.json({ data: { ok: true } });
    } catch (err) {
      return handleError(c, err, "Error eliminando template.");
    }
  });

  internal.post("/templates/:templateId/use", requirePermission("chat.conversations.create"), async (c) => {
    try {
      const companyId = c.get("companyId");
      const { templateId } = c.req.param();
      await templateService.recordUsage({ companyId, templateId });
      return c.json({ data: { ok: true } });
    } catch (err) {
      return handleError(c, err, "Error registrando uso de template.");
    }
  });

  // ================================================================
  // MANUAL ASSIGNMENT
  // ================================================================

  internal.post("/external/:conversationId/assign", requirePermission("chat.conversations.create"), async (c) => {
    try {
      const companyId = c.get("companyId");
      const { conversationId } = c.req.param();
      const { userId } = await c.req.json();
      if (!userId) return c.json({ error: "userId requerido." }, 422);

      // Verify operator belongs to company
      const profile = await prisma.userProfile.findFirst({
        where: { authUserId: userId, memberships: { some: { companyId, enabled: true } } },
        select: { id: true },
      });
      if (!profile) return c.json({ error: "Operador no encontrado en esta empresa." }, 404);

      await prisma.$executeRaw`
        UPDATE chat_conversations
        SET assigned_user_id = ${profile.id}::uuid, updated_at = NOW()
        WHERE id = ${conversationId}::uuid AND company_id = ${companyId}::uuid AND deleted_at IS NULL
      `;
      await prisma.$executeRaw`
        INSERT INTO chat_conversation_members (conversation_id, user_id, role)
        VALUES (${conversationId}::uuid, ${profile.id}::uuid, 'operator')
        ON CONFLICT DO NOTHING
      `;
      return c.json({ data: { ok: true, assignedUserId: profile.id } });
    } catch (err) {
      return handleError(c, err, "Error asignando operador.");
    }
  });

  // ================================================================
  // SESSION EXPIRY JOB (internal trigger)
  // ================================================================

  internal.post("/internal/expire-sessions", requirePermission("chat.conversations.create"), async (c) => {
    try {
      const result = await expireStaleGuestSessions(prisma);
      return c.json({ data: result });
    } catch (err) {
      return handleError(c, err, "Error expirando sesiones.");
    }
  });

  // Mount sub-routers
  app.route("/chat", internal);
  app.route("/public/chat", pub);

  return app;
}
