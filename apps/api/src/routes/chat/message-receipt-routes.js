// apps/api/src/routes/chat/message-receipt-routes.js
//
// GET /chat/messages/:id/receipt — "Info del mensaje": Enviado + Visto por
// (with per-member timestamps for a group/channel). Split into a sibling
// file to keep index.js under the CLAUDE.md 1000-line limit.
import { Hono } from "hono";
import { ChatServiceError } from "./chat-service-error.js";

function handleError(c, err, fallback) {
  if (err instanceof ChatServiceError) {
    return c.json({ error: err.message }, err.status);
  }
  console.error("[runly.chat]", err?.message ?? err);
  if (err?.stack) console.error(err.stack);
  return c.json({ error: fallback }, 500);
}

export function createMessageReceiptRoutes({ requirePermission, chatService }) {
  const app = new Hono();

  app.get("/messages/:id/receipt", requirePermission("chat.conversations.read"), async (c) => {
    try {
      const authUserId = c.get("authUserId");
      const messageId = c.req.param("id");
      const result = await chatService.getMessageReceipt({ messageId, authUserId });
      return c.json(result);
    } catch (err) {
      return handleError(c, err, "Error obteniendo el estado del mensaje.");
    }
  });

  return app;
}
