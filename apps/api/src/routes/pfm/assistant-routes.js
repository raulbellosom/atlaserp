// apps/api/src/routes/pfm/assistant-routes.js
import { Hono } from "hono";
import { z } from "zod";
import {
  PfmServiceError,
  getCompanyId,
  getActorId,
  getValidationErrorMessage,
} from "./service-helpers.js";

const sendSchema = z.object({ content: z.string().trim().min(1).max(2000) });

function handleError(c, err, fallback) {
  if (err instanceof PfmServiceError) return c.json({ error: err.message }, err.status);
  console.error("[atlas.pfm]", err);
  return c.json({ error: fallback }, 500);
}

export function createAssistantRouter({ requirePermission, assistant }) {
  const app = new Hono();
  const guard = requirePermission("pfm.assistant.use");

  app.get("/pfm/assistant/status", guard, async (c) => {
    try {
      return c.json({ data: { available: Boolean(assistant.isConfigured()) } });
    } catch (err) {
      return handleError(c, err, "No se pudo consultar el asistente.");
    }
  });

  app.get("/pfm/assistant/threads", guard, async (c) => {
    try {
      return c.json(
        await assistant.listThreads({ companyId: getCompanyId(c), actorId: getActorId(c) }),
      );
    } catch (err) {
      return handleError(c, err, "No se pudieron listar las conversaciones.");
    }
  });

  app.post("/pfm/assistant/threads", guard, async (c) => {
    try {
      const row = await assistant.createThread({
        companyId: getCompanyId(c),
        actorId: getActorId(c),
      });
      return c.json({ data: row }, 201);
    } catch (err) {
      return handleError(c, err, "No se pudo crear la conversacion.");
    }
  });

  app.get("/pfm/assistant/threads/:id", guard, async (c) => {
    try {
      return c.json({
        data: await assistant.getThread({
          companyId: getCompanyId(c),
          actorId: getActorId(c),
          threadId: c.req.param("id"),
        }),
      });
    } catch (err) {
      return handleError(c, err, "No se pudo obtener la conversacion.");
    }
  });

  app.post("/pfm/assistant/threads/:id/messages", guard, async (c) => {
    try {
      const parsed = sendSchema.safeParse(await c.req.json().catch(() => ({})));
      if (!parsed.success) return c.json({ error: getValidationErrorMessage(parsed.error) }, 400);
      return c.json({
        data: await assistant.sendMessage({
          companyId: getCompanyId(c),
          actorId: getActorId(c),
          threadId: c.req.param("id"),
          content: parsed.data.content,
        }),
      });
    } catch (err) {
      return handleError(c, err, "El asistente no pudo responder.");
    }
  });

  app.delete("/pfm/assistant/threads/:id", guard, async (c) => {
    try {
      return c.json({
        data: await assistant.deleteThread({
          companyId: getCompanyId(c),
          actorId: getActorId(c),
          threadId: c.req.param("id"),
          purge: c.req.query("purge") === "1",
        }),
      });
    } catch (err) {
      return handleError(c, err, "No se pudo borrar la conversacion.");
    }
  });

  return app;
}
