// Pure derivation of the lightweight "quoted message" preview attached to
// every message read (listMessages / getMessageFull / listThreadReplies).
// The caller supplies a flat row already joined to the original message's
// sender name, first attachment mime, and an entity-ref flag.
const MAX_PREVIEW = 120;

export function buildReplyPreview(row) {
  if (!row) return null;

  const senderName = row.sender_name || "Usuario";
  const isDeleted = Boolean(row.deleted_at);

  if (isDeleted) {
    return {
      id: row.id,
      senderUserId: row.sender_user_id ?? null,
      senderName,
      bodyPreview: null,
      kind: "deleted",
      isDeleted: true,
    };
  }

  const body = typeof row.body === "string" ? row.body.trim() : "";
  let bodyPreview = null;
  if (body) {
    const collapsed = body.replace(/\s+/g, " ");
    bodyPreview = collapsed.length > MAX_PREVIEW ? collapsed.slice(0, MAX_PREVIEW) : collapsed;
  }

  let kind;
  if (body) {
    kind = "text";
  } else if (row.attachment_mime) {
    const m = String(row.attachment_mime).toLowerCase();
    if (m.startsWith("image/")) kind = "image";
    else if (m.startsWith("video/")) kind = "video";
    else if (m.startsWith("audio/")) kind = "audio";
    else kind = "file";
  } else if (row.has_entity_refs) {
    kind = "entity";
  } else {
    kind = "text";
  }

  return {
    id: row.id,
    senderUserId: row.sender_user_id ?? null,
    senderName,
    bodyPreview,
    kind,
    isDeleted: false,
  };
}
