// apps/api/src/routes/chat/chat-attachments-service.js
//
// Chat attachment upload presigning, signed-URL resolution, and deletion.
// Extracted from chat-service.js on 2026-08-30 to help keep that file
// closer to the CLAUDE.md 1000-line limit (it had reached 1370 lines).
//
// Mirrors the chat-conversation-reads-service.js pattern: a sub-factory
// that receives its dependencies (including the shared signed-URL cache
// helpers) from the parent createChatService() rather than duplicating
// state, since batchSignAvatarUrls/batchSignAttachmentUrls in
// chat-service.js also read/write that same cache.
import crypto from "node:crypto";
import { signedUrlWithVariant } from "../../lib/image-variants.js";
import { ChatServiceError } from "./chat-service-error.js";

export function createChatAttachmentsService({
  prisma,
  supabaseAdmin,
  getUserProfileId,
  assertMember,
  getCachedSignedUrl,
  setCachedSignedUrl,
}) {
  async function presignAttachmentUpload({ authUserId, conversationId, fileName, mimeType, sizeBytes }) {
    const profileId = await getUserProfileId(authUserId);
    await assertMember(conversationId, profileId);

    const ALLOWED_MIME = [
      /^image\//,
      /^audio\//,
      /^video\//,
      /^application\/pdf$/,
      /^text\/plain$/,
      /^application\/msword$/,
      /^application\/vnd\.openxmlformats/,
      /^application\/zip$/,
      /^application\/x-zip/,
    ];
    const allowed = ALLOWED_MIME.some(re => re.test(mimeType));
    if (!allowed) throw new ChatServiceError("Tipo de archivo no permitido.", 422);
    if (sizeBytes > 50 * 1024 * 1024) throw new ChatServiceError("Archivo demasiado grande (max 50 MB).", 422);

    const ext = fileName.split(".").pop()?.toLowerCase() ?? "bin";
    const objectKey = `conversations/${conversationId}/${crypto.randomUUID()}.${ext}`;

    const { data, error } = await supabaseAdmin.storage
      .from("atlas-chat")
      .createSignedUploadUrl(objectKey, { expiresIn: 300 });

    if (error) {
      console.error("[atlas.chat] createSignedUploadUrl failed", { bucket: "atlas-chat", key: objectKey, error });
      throw new ChatServiceError("Error generando URL de subida.", 500);
    }

    // message_id is NULL until sendMessage links it
    const attRows = await prisma.$queryRaw`
      INSERT INTO chat_attachments
        (conversation_id, bucket, object_key, file_name, mime_type, size_bytes, uploaded_by_user_id)
      VALUES (
        ${conversationId},
        'atlas-chat',
        ${objectKey},
        ${fileName},
        ${mimeType},
        ${sizeBytes},
        ${profileId}
      )
      RETURNING id
    `;

    return {
      attachmentId: attRows[0].id,
      uploadUrl: data.signedUrl,
      token: data.token,
      objectKey,
    };
  }

  async function getAttachmentSignedUrl({ attachmentId, authUserId, variant = "full" }) {
    const profileId = await getUserProfileId(authUserId);

    const rows = await prisma.$queryRaw`
      SELECT a.* FROM chat_attachments a
      INNER JOIN chat_conversation_members ccm
        ON ccm.conversation_id = a.conversation_id AND ccm.user_id = ${profileId} AND ccm.left_at IS NULL
      WHERE a.id = ${attachmentId}
      LIMIT 1
    `;
    if (!rows.length) {
      console.error("[atlas.chat] getAttachmentSignedUrl: attachment not found or user not member", { attachmentId, profileId });
      throw new ChatServiceError("Adjunto no encontrado.", 404);
    }

    const att = rows[0];

    const cached = getCachedSignedUrl(att.bucket, att.object_key, variant);
    if (cached) return { url: cached };

    const signedUrl = await signedUrlWithVariant(supabaseAdmin, att.bucket, att.object_key, variant);

    if (!signedUrl) {
      console.error("[atlas.chat] createSignedUrl failed", { bucket: att.bucket, key: att.object_key });
      throw new ChatServiceError("Error generando URL firmada.", 500);
    }
    setCachedSignedUrl(att.bucket, att.object_key, variant, signedUrl);
    return { url: signedUrl };
  }

  async function deleteAttachment({ attachmentId, authUserId }) {
    const profileId = await getUserProfileId(authUserId);

    const rows = await prisma.$queryRaw`
      SELECT a.id, a.message_id, m.body, m.attachment_count, m.metadata
      FROM chat_attachments a
      INNER JOIN chat_messages m ON m.id = a.message_id
      WHERE a.id = ${attachmentId}
        AND m.sender_user_id = ${profileId}
        AND m.deleted_at IS NULL
      LIMIT 1
    `;
    if (!rows.length) throw new ChatServiceError("Archivo no encontrado o sin permiso.", 404);
    const { message_id: messageId, body, attachment_count: attachmentCount, metadata } = rows[0];

    const isLastAttachment = attachmentCount <= 1;
    const hasBody = Boolean(body && body.trim());
    const hasEntityRefs = Boolean(metadata?.entityRefs?.length);

    if (isLastAttachment && !hasBody && !hasEntityRefs) {
      // This UPDATE (not just the DELETE below) is what makes the change
      // reach other open clients — the frontend's realtime sync
      // (subscribeToMessages in supabaseRealtime.js) is a postgres_changes
      // listener on chat_messages only; chat_attachments has no subscription
      // of its own. Same mechanism deleteMessage already relies on.
      await prisma.$executeRaw`
        UPDATE chat_messages SET deleted_at = NOW(), body = '' WHERE id = ${messageId}
      `;
      await prisma.$executeRaw`DELETE FROM chat_attachments WHERE id = ${attachmentId}`;
      return { ok: true, messageDeleted: true };
    }

    await prisma.$executeRaw`DELETE FROM chat_attachments WHERE id = ${attachmentId}`;
    await prisma.$executeRaw`
      UPDATE chat_messages SET attachment_count = GREATEST(attachment_count - 1, 0) WHERE id = ${messageId}
    `;
    return { ok: true, messageDeleted: false };
  }

  return { presignAttachmentUpload, getAttachmentSignedUrl, deleteAttachment };
}
