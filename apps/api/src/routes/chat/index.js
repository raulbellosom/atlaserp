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

function handleError(c, err, fallback) {
  if (err instanceof ChatServiceError || err instanceof GuestChatServiceError) {
    return c.json({ error: err.message }, err.status);
  }
  if (process.env.NODE_ENV !== "production") {
    console.error("[atlas.chat]", err?.message, err?.stack);
  }
  return c.json({ error: fallback }, 500);
}

export function createChatRouter({ prisma, supabaseAdmin, authMiddleware, requirePermission }) {
  const app = new Hono();
  const chatService = createChatService({ prisma, supabaseAdmin });
  const guestService = createGuestChatService({ prisma, supabaseAdmin });

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
      if (err?.name === "ZodError") return c.json({ error: err.errors[0]?.message ?? "Datos invalidos." }, 422);
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
      if (err?.name === "ZodError") return c.json({ error: err.errors[0]?.message ?? "Datos invalidos." }, 422);
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
      if (err?.name === "ZodError") return c.json({ error: err.errors[0]?.message ?? "Datos invalidos." }, 422);
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
      if (err?.name === "ZodError") return c.json({ error: err.errors[0]?.message ?? "Datos invalidos." }, 422);
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
      if (err?.name === "ZodError") return c.json({ error: err.errors[0]?.message ?? "Datos invalidos." }, 422);
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

  // POST /chat/attachments/presign
  internal.post("/attachments/presign", requirePermission("chat.conversations.create"), async (c) => {
    try {
      const authUserId = c.get("authUserId");
      const body = await c.req.json();
      const data = chatPresignAttachmentSchema.parse(body);
      const result = await chatService.presignAttachmentUpload({ authUserId, ...data });
      return c.json({ data: result });
    } catch (err) {
      if (err?.name === "ZodError") return c.json({ error: err.errors[0]?.message ?? "Datos invalidos." }, 422);
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
      const { status, limit } = c.req.query();
      const result = await chatService.listExternalInbox({
        authUserId,
        status: status ?? "open",
        limit: limit ? Math.min(parseInt(limit, 10), 100) : 30,
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
        SELECT id FROM "UserProfile" WHERE auth_user_id = ${authUserId} LIMIT 1
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

      // Auto-join as operator
      const profileRows = await prisma.$queryRaw`
        SELECT id FROM "UserProfile" WHERE auth_user_id = ${authUserId} LIMIT 1
      `;
      if (profileRows.length) {
        await prisma.$executeRaw`
          INSERT INTO chat_conversation_members (conversation_id, user_id, role)
          VALUES (${conversationId}, ${profileRows[0].id}, 'operator')
          ON CONFLICT DO NOTHING
        `;
      }

      const result = await chatService.sendMessage({ conversationId, authUserId, ...data });
      return c.json({ data: result }, 201);
    } catch (err) {
      if (err?.name === "ZodError") return c.json({ error: err.errors[0]?.message ?? "Datos invalidos." }, 422);
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
      if (err?.name === "ZodError") return c.json({ error: err.errors[0]?.message ?? "Datos invalidos." }, 422);
      return handleError(c, err, "Error asignando operador.");
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
      const result = await guestService.createGuestSession(data);
      return c.json({ data: result }, 201);
    } catch (err) {
      if (err?.name === "ZodError") return c.json({ error: err.errors[0]?.message ?? "Datos invalidos." }, 422);
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
      if (err?.name === "ZodError") return c.json({ error: err.errors[0]?.message ?? "Datos invalidos." }, 422);
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

  // Mount sub-routers
  app.route("/chat", internal);
  app.route("/public/chat", pub);

  return app;
}
