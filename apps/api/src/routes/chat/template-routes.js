// apps/api/src/routes/chat/template-routes.js
//
// Message templates (quick-reply snippets). Extracted from index.js on
// 2026-08-30 to help keep that file under the CLAUDE.md 1000-line limit.
import { Hono } from "hono";
import { ChatServiceError } from "./chat-service-error.js";
import { GuestChatServiceError } from "./guest-service.js";
import { ChatPermissionsError } from "./chat-permissions-service.js";
import { ChatReactionsError } from "./chat-reactions-service.js";
import { ChatModerationServiceError } from "./chat-moderation-service.js";

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

export function createTemplateRoutes({ requirePermission, templateService }) {
  const app = new Hono();

  app.get("/templates", requirePermission("chat.conversations.create"), async (c) => {
    try {
      const companyId = c.get("companyId");
      const { search } = c.req.query();
      const data = await templateService.listTemplates({ companyId, search: search || undefined });
      return c.json({ data });
    } catch (err) {
      return handleError(c, err, "Error listando templates.");
    }
  });

  app.post("/templates", requirePermission("chat.conversations.create"), async (c) => {
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

  app.patch("/templates/:templateId", requirePermission("chat.conversations.create"), async (c) => {
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

  app.delete("/templates/:templateId", requirePermission("chat.conversations.create"), async (c) => {
    try {
      const companyId = c.get("companyId");
      const { templateId } = c.req.param();
      await templateService.deleteTemplate({ companyId, templateId });
      return c.json({ data: { ok: true } });
    } catch (err) {
      return handleError(c, err, "Error eliminando template.");
    }
  });

  app.post("/templates/:templateId/use", requirePermission("chat.conversations.create"), async (c) => {
    try {
      const companyId = c.get("companyId");
      const { templateId } = c.req.param();
      await templateService.recordUsage({ companyId, templateId });
      return c.json({ data: { ok: true } });
    } catch (err) {
      return handleError(c, err, "Error registrando uso de template.");
    }
  });

  return app;
}
