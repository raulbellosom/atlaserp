// apps/api/src/routes/chat/message-forward-routes.js
//
// POST /chat/messages/forward — re-send messages (body + a copy of their
// attachments) into one or more target conversations. Split into a sibling
// file to keep index.js under the CLAUDE.md 1000-line limit.
import { Hono } from "hono";
import { chatForwardMessagesSchema } from "@atlas/validators";
import { ChatServiceError } from "./chat-service-error.js";
import { ChatPermissionsError } from "./chat-permissions-service.js";

function handleError(c, err, fallback) {
  if (err instanceof ChatServiceError || err instanceof ChatPermissionsError) {
    return c.json({ error: err.message }, err.status);
  }
  console.error("[atlas.chat]", err?.message ?? err);
  if (err?.stack) console.error(err.stack);
  return c.json({ error: fallback }, 500);
}

export function createMessageForwardRoutes({ requirePermission, chatService }) {
  const app = new Hono();

  app.post("/messages/forward", requirePermission("chat.conversations.read"), async (c) => {
    try {
      const authUserId = c.get("authUserId");
      const body = await c.req.json();
      const data = chatForwardMessagesSchema.parse(body);
      const result = await chatService.forwardMessages({ authUserId, ...data });
      return c.json(result);
    } catch (err) {
      if (err?.name === "ZodError") {
        return c.json({ error: (err.errors ?? err.issues)?.[0]?.message ?? "Datos invalidos." }, 422);
      }
      return handleError(c, err, "Error reenviando mensajes.");
    }
  });

  return app;
}
