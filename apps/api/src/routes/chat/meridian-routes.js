// apps/api/src/routes/chat/meridian-routes.js
import { Hono } from "hono";
import { ChatServiceError } from "./chat-service-error.js";

export function createMeridianRoutes({ requirePermission, meridianService, resolveProfileId }) {
  const r = new Hono();

  r.get("/chat/meridian", requirePermission("chat.meridian.use"), async (c) => {
    try {
      const authUserId = c.get("authUserId");
      const companyId = c.get("companyId") ?? null;
      const actorProfileId = await resolveProfileId(authUserId);
      const { conversationId } = await meridianService.ensureMeridianConversation({ companyId, actorProfileId });
      return c.json({ data: { conversationId } });
    } catch (err) {
      if (err instanceof ChatServiceError) return c.json({ error: err.message }, err.status);
      console.error("[atlas.chat] meridian ensure", err?.message ?? err);
      return c.json({ error: "No se pudo abrir el chat con MeridIAn." }, 500);
    }
  });

  r.get("/chat/meridian/status", requirePermission("chat.meridian.use"), async (c) => {
    return c.json({ data: {
      available: Boolean(meridianService.isConfigured()),
      web: Boolean(meridianService.isWebEnabled?.()),
    } });
  });

  return r;
}
