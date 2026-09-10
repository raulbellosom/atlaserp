import { signedUrlWithVariant } from "../../lib/image-variants.js";
import { ChatServiceError } from "./chat-service-error.js";
import { resolveUserProfileId } from "./chat-service.js";

// Membership-gated full-resolution avatar signing for chat.
//
// Why this exists instead of reusing an existing endpoint:
//  - `atlas.files.getSignedUrl` (GET /files/:id/signed-url) runs
//    `ensureFileBelongsToCompany`, which requires the FileAsset's entityType to
//    be a company entity and entityId === companyId. Identity avatars are
//    created by uploadIdentityAvatar() with entityType "UserProfile" /
//    entityId <profileId> and no company, so that endpoint always 404s for an
//    avatar file id.
//  - `GET /identity/users/:id/avatar/signed-url` needs `identity.users.read`,
//    which regular chat users don't have.
//
// So the chat panel needs its own path: prove the caller and the target user
// are BOTH active members of the same conversation, then sign the target's
// avatar file at whatever variant the caller asked for.
const ALLOWED_VARIANTS = new Set(["thumb", "card", "content", "full"]);

export function createChatMemberAvatarService({ prisma, supabaseAdmin }) {
  async function getMemberAvatarSignedUrl({ conversationId, authUserId, targetUserId, variant = "full" }) {
    const resolvedVariant = ALLOWED_VARIANTS.has(variant) ? variant : "full";
    const callerProfileId = await resolveUserProfileId(prisma, authUserId);

    // Caller must be an active member of the conversation.
    const callerRows = await prisma.$queryRaw`
      SELECT 1
      FROM chat_conversation_members
      WHERE conversation_id = ${conversationId}::uuid
        AND user_id = ${callerProfileId}::uuid
        AND left_at IS NULL
      LIMIT 1
    `;
    if (!callerRows.length) {
      throw new ChatServiceError("No eres miembro de esta conversacion.", 403);
    }

    // Target must ALSO be an active member of the same conversation — this is
    // the whole authorization story: you can see the avatar of anyone you
    // share a conversation with, and nobody else.
    const targetRows = await prisma.$queryRaw`
      SELECT up.avatar_file_id::text AS avatar_file_id
      FROM chat_conversation_members cm
      JOIN user_profile up ON up.id = cm.user_id
      WHERE cm.conversation_id = ${conversationId}::uuid
        AND cm.user_id = ${targetUserId}::uuid
        AND cm.left_at IS NULL
      LIMIT 1
    `;
    if (!targetRows.length) {
      throw new ChatServiceError("El usuario no pertenece a esta conversacion.", 404);
    }

    const avatarFileId = targetRows[0].avatar_file_id;
    if (!avatarFileId) return { signedUrl: null };

    const fileAsset = await prisma.fileAsset.findUnique({
      where: { id: avatarFileId },
      select: { bucket: true, objectKey: true },
    });
    if (!fileAsset) return { signedUrl: null };

    const signedUrl = await signedUrlWithVariant(
      supabaseAdmin,
      fileAsset.bucket,
      fileAsset.objectKey,
      resolvedVariant,
    );
    return { signedUrl };
  }

  return { getMemberAvatarSignedUrl };
}
