// apps/api/src/routes/chat/moderation-routes.js
//
// Chat moderation: mute, block/unblock, groups-in-common, and reports.
// Extracted from index.js on 2026-08-30 to keep that file under the
// CLAUDE.md 1000-line limit (it had crossed it on 2026-08-28).
import { Hono } from "hono";
import { z } from "zod";
import {
  chatMuteConversationSchema,
  chatCreateReportSchema,
  chatResolveReportSchema,
} from "@atlas/validators";
import { ChatServiceError } from "./chat-service-error.js";
import { GuestChatServiceError } from "./guest-service.js";
import { ChatPermissionsError } from "./chat-permissions-service.js";
import { ChatReactionsError } from "./chat-reactions-service.js";
import { ChatModerationServiceError } from "./chat-moderation-service.js";

const uuidParamSchema = z.string().uuid();

function handleError(c, err, fallback) {
  if (
    err instanceof ChatServiceError ||
    err instanceof GuestChatServiceError ||
    err instanceof ChatPermissionsError ||
    err instanceof ChatReactionsError ||
    err instanceof ChatModerationServiceError
  ) {
    return c.json({ error: err.message }, err.status);
  }
  console.error("[atlas.chat]", err?.message ?? err);
  if (err?.stack) console.error(err.stack);
  return c.json({ error: fallback }, 500);
}

export function createModerationRoutes({ requirePermission, moderationService }) {
  const app = new Hono();

  // PATCH /chat/conversations/:id/mute
  app.patch("/conversations/:id/mute", requirePermission("chat.conversations.read"), async (c) => {
    try {
      const authUserId = c.get("authUserId");
      const conversationId = c.req.param("id");
      const body = await c.req.json();
      const { muted } = chatMuteConversationSchema.parse(body);
      const result = await moderationService.muteConversation({ conversationId, authUserId, muted });
      return c.json({ data: result });
    } catch (err) {
      if (err?.name === "ZodError") return c.json({ error: (err.errors ?? err.issues)?.[0]?.message ?? "Datos invalidos." }, 422);
      return handleError(c, err, "Error actualizando notificaciones.");
    }
  });

  // GET /chat/users/:userId/block-status
  app.get("/users/:userId/block-status", requirePermission("chat.access"), async (c) => {
    try {
      const authUserId = c.get("authUserId");
      const targetUserId = c.req.param("userId");
      if (!uuidParamSchema.safeParse(targetUserId).success) {
        return c.json({ error: "Identificador de usuario invalido." }, 422);
      }
      const result = await moderationService.getBlockStatus({ authUserId, targetUserId });
      return c.json({ data: result });
    } catch (err) {
      return handleError(c, err, "Error obteniendo estado de bloqueo.");
    }
  });

  // POST /chat/users/:userId/block
  app.post("/users/:userId/block", requirePermission("chat.access"), async (c) => {
    try {
      const authUserId = c.get("authUserId");
      const targetUserId = c.req.param("userId");
      if (!uuidParamSchema.safeParse(targetUserId).success) {
        return c.json({ error: "Identificador de usuario invalido." }, 422);
      }
      const result = await moderationService.blockUser({ authUserId, targetUserId });
      return c.json({ data: result });
    } catch (err) {
      return handleError(c, err, "Error bloqueando usuario.");
    }
  });

  // DELETE /chat/users/:userId/block
  app.delete("/users/:userId/block", requirePermission("chat.access"), async (c) => {
    try {
      const authUserId = c.get("authUserId");
      const targetUserId = c.req.param("userId");
      if (!uuidParamSchema.safeParse(targetUserId).success) {
        return c.json({ error: "Identificador de usuario invalido." }, 422);
      }
      const result = await moderationService.unblockUser({ authUserId, targetUserId });
      return c.json({ data: result });
    } catch (err) {
      return handleError(c, err, "Error desbloqueando usuario.");
    }
  });

  // GET /chat/users/:userId/groups-in-common
  app.get("/users/:userId/groups-in-common", requirePermission("chat.conversations.read"), async (c) => {
    try {
      const authUserId = c.get("authUserId");
      const targetUserId = c.req.param("userId");
      if (!uuidParamSchema.safeParse(targetUserId).success) {
        return c.json({ error: "Identificador de usuario invalido." }, 422);
      }
      const result = await moderationService.getGroupsInCommon({ authUserId, targetUserId });
      return c.json({ data: result });
    } catch (err) {
      return handleError(c, err, "Error obteniendo grupos en comun.");
    }
  });

  // POST /chat/reports
  app.post("/reports", requirePermission("chat.access"), async (c) => {
    try {
      const authUserId = c.get("authUserId");
      const body = await c.req.json();
      const data = chatCreateReportSchema.parse(body);
      const result = await moderationService.createReport({ authUserId, ...data });
      return c.json({ data: result }, 201);
    } catch (err) {
      if (err?.name === "ZodError") return c.json({ error: (err.errors ?? err.issues)?.[0]?.message ?? "Datos invalidos." }, 422);
      return handleError(c, err, "Error creando reporte.");
    }
  });

  // GET /chat/reports
  app.get("/reports", requirePermission("identity.chat_reports.read"), async (c) => {
    try {
      const { status } = c.req.query();
      const result = await moderationService.listReports({ status: status || null });
      return c.json({ data: result });
    } catch (err) {
      return handleError(c, err, "Error listando reportes.");
    }
  });

  // PATCH /chat/reports/:id/resolve
  app.patch("/reports/:id/resolve", requirePermission("identity.chat_reports.manage"), async (c) => {
    try {
      const authUserId = c.get("authUserId");
      const reportId = c.req.param("id");
      if (!uuidParamSchema.safeParse(reportId).success) {
        return c.json({ error: "Identificador de reporte invalido." }, 422);
      }
      const body = await c.req.json();
      const { action } = chatResolveReportSchema.parse(body);
      const result = await moderationService.resolveReport({ reportId, authUserId, action });
      return c.json({ data: result });
    } catch (err) {
      if (err?.name === "ZodError") return c.json({ error: (err.errors ?? err.issues)?.[0]?.message ?? "Datos invalidos." }, 422);
      return handleError(c, err, "Error resolviendo reporte.");
    }
  });

  return app;
}
