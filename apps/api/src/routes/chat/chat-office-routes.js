import { Hono } from "hono";
import { OfficeError } from "../../services/office/errors.js";
import { readBoundedBody } from "../../services/office/discovery.js";

// Mints a WOPI session for a chat attachment so it opens in the Collabora
// editor. Mounted on the authenticated `internal` chat router — guests (who use
// /public/chat) never reach it. RBAC (conversation membership + role) lives in
// officeService -> access.authorizeChatAttachment.
export function createChatOfficeRoutes({ officeService }) {
  const router = new Hono();

  router.post("/attachments/:id/office/session", async (c) => {
    const authUserId = c.get("authUserId");
    if (!authUserId) return c.json({ error: "unauthorized", code: "unauthorized" }, 401);
    let body = {};
    try {
      const raw = (await readBoundedBody(c.req.raw.body, 2048)).toString("utf8").trim();
      if (raw) body = JSON.parse(raw);
    } catch (error) {
      if (error instanceof OfficeError) throw error;
      return c.json({ error: "Solicitud de sesión inválida.", code: "invalid_request" }, 400);
    }
    try {
      const data = await officeService.createSession({
        authUserId,
        fileId: c.req.param("id"),
        mode: body.mode ?? "auto",
        origin: c.req.header("Origin"),
        source: "chat_attachment",
      });
      return c.json({ data });
    } catch (error) {
      const known = error instanceof OfficeError;
      return c.json(
        { error: known ? error.message : "Error al abrir el documento.", code: known ? error.code : "office_error" },
        known ? error.status : 500,
      );
    }
  });

  return router;
}
