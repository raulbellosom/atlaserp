import { Hono } from "hono";
import { z } from "zod";
import { callCreateSchema } from "@atlas/validators";
import { createCallService, CallServiceError } from "./call-service.js";

const callIdSchema = z.string().uuid();

function handleError(c, error, fallback) {
  if (error instanceof CallServiceError) {
    return c.json({ error: error.message, ...(error.details ? { details: error.details } : {}) }, error.status);
  }
  if (error?.name === "ZodError") {
    return c.json({ error: (error.errors ?? error.issues)?.[0]?.message ?? "Datos invalidos." }, 422);
  }
  console.error("[atlas.calls]", error?.stack ?? error);
  return c.json({ error: fallback }, 500);
}

export function createCallsRouter({ prisma, authMiddleware, service = null }) {
  const app = new Hono();
  const internal = new Hono();
  const calls = service ?? createCallService({ prisma });
  if (!service) calls.startExpirySweeper();
  internal.use("*", authMiddleware);

  internal.get("/config", async (c) => c.json({ data: await calls.getConfigStatus() }));

  internal.get("/current", async (c) => {
    try {
      const data = await calls.getCurrentCall({ authUserId: c.get("authUserId") });
      return c.json({ data });
    } catch (error) {
      return handleError(c, error, "Error obteniendo la llamada actual.");
    }
  });

  internal.post("/", async (c) => {
    try {
      const payload = callCreateSchema.parse(await c.req.json());
      const data = await calls.createCall({ authUserId: c.get("authUserId"), ...payload });
      return c.json({ data }, 201);
    } catch (error) {
      return handleError(c, error, "Error iniciando la llamada.");
    }
  });

  internal.get("/:id", async (c) => {
    try {
      const callId = callIdSchema.parse(c.req.param("id"));
      return c.json({ data: await calls.getCall({ authUserId: c.get("authUserId"), callId }) });
    } catch (error) {
      return handleError(c, error, "Error obteniendo la llamada.");
    }
  });

  for (const [action, method] of [
    ["join", "joinCall"],
    ["decline", "declineCall"],
    ["leave", "leaveCall"],
    ["end", "endCall"],
  ]) {
    internal.post(`/:id/${action}`, async (c) => {
      try {
        const callId = callIdSchema.parse(c.req.param("id"));
        const data = await calls[method]({ authUserId: c.get("authUserId"), callId });
        return c.json({ data });
      } catch (error) {
        return handleError(c, error, `Error procesando la accion ${action}.`);
      }
    });
  }

  app.route("/calls", internal);
  return app;
}
