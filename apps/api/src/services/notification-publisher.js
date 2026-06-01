import { createNotificationService } from "./notification-service.js";

function toStringId(value) {
  if (typeof value !== "string") return null;
  const id = value.trim();
  return id.length > 0 ? id : null;
}

function normalizeRecipientsFromContext(c, input) {
  const source = input && typeof input === "object" ? { ...input } : {};
  const userIds = Array.isArray(source?.recipients?.userIds)
    ? source.recipients.userIds
    : [];
  if (userIds.length > 0) return source;

  const actorId = toStringId(c?.get?.("userId"));
  if (!actorId) return source;

  source.recipients = { userIds: [actorId] };
  return source;
}

export async function publishNotificationFromContext(
  prisma,
  c,
  input,
  options = {},
) {
  const {
    logger = console,
    throwOnError = false,
    fallbackToActorRecipient = true,
  } = options ?? {};

  const companyId = toStringId(c?.get?.("companyId"));
  const actorId = toStringId(c?.get?.("userId"));
  if (!companyId) {
    const err = new Error("No hay empresa activa en el contexto.");
    if (throwOnError) throw err;
    logger?.warn?.("[notifications] skip publish, missing company context");
    return { ok: false, reason: "missing_company_context", error: err.message };
  }

  const service = createNotificationService({ prisma });
  const payload = fallbackToActorRecipient
    ? normalizeRecipientsFromContext(c, input)
    : input;

  try {
    const result = await service.publish({
      companyId,
      actorId,
      input: payload,
    });
    return {
      ok: true,
      data: result,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger?.error?.("[notifications] publish failed:", errorMessage);
    if (throwOnError) throw err;
    return { ok: false, reason: "publish_failed", error: errorMessage };
  }
}

