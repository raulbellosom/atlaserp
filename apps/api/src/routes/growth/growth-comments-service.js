import { parseMentionIds } from '../../lib/mention-utils.js';

export class GrowthCommentsServiceError extends Error {
  constructor(message, status = 500) {
    super(message);
    this.name = 'GrowthCommentsServiceError';
    this.status = status;
  }
}

export function createGrowthCommentsService({ prisma }) {
  async function resolveProfileId(authUserId) {
    if (!authUserId) return null;
    const profile = await prisma.userProfile.findFirst({
      where: { authUserId },
      select: { id: true },
    });
    return profile?.id ?? null;
  }

  async function listComments(leadId, companyId) {
    const lead = await prisma.growthLead.findFirst({ where: { id: leadId, companyId, enabled: true } });
    if (!lead) throw new GrowthCommentsServiceError('Lead not found', 404);

    return prisma.growthLeadComment.findMany({
      where: { leadId },
      include: {
        author: { select: { id: true, firstName: true, lastName: true, avatarFileId: true } },
        mentions: { include: { user: { select: { id: true, firstName: true, lastName: true } } } },
        reactions: { include: { user: { select: { id: true, firstName: true, lastName: true } } } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async function createComment(leadId, authorAuthId, body, companyId) {
    const authorProfileId = await resolveProfileId(authorAuthId);
    if (!authorProfileId) throw new GrowthCommentsServiceError('Usuario no encontrado.', 400);
    const lead = await prisma.growthLead.findFirst({ where: { id: leadId, companyId, enabled: true } });
    if (!lead) throw new GrowthCommentsServiceError('Lead not found', 404);

    if (!body?.trim()) throw new GrowthCommentsServiceError('El comentario no puede estar vacio.', 400);
    if (body.trim().length > 5000) throw new GrowthCommentsServiceError('El comentario no puede tener mas de 5000 caracteres.', 400);

    const trimmedBody = body.trim();
    const mentionIds = parseMentionIds(trimmedBody);

    return prisma.$transaction(async (tx) => {
      const comment = await tx.growthLeadComment.create({
        data: { leadId, authorId: authorProfileId, body: trimmedBody },
        include: {
          author: { select: { id: true, firstName: true, lastName: true, avatarFileId: true } },
        },
      });

      for (const userId of mentionIds) {
        try {
          await tx.growthLeadMention.create({ data: { commentId: comment.id, userId } });
        } catch (err) {
          if (err.code !== 'P2003' && err.code !== 'P2002') throw err;
        }
      }

      return { comment, mentionIds };
    });
  }

  async function updateComment(commentId, authorAuthId, body) {
    if (!body?.trim()) throw new GrowthCommentsServiceError('El comentario no puede estar vacio.', 400);
    if (body.trim().length > 5000) throw new GrowthCommentsServiceError('El comentario no puede tener mas de 5000 caracteres.', 400);

    const authorProfileId = await resolveProfileId(authorAuthId);
    if (!authorProfileId) throw new GrowthCommentsServiceError('Usuario no encontrado.', 400);

    const comment = await prisma.growthLeadComment.findFirst({ where: { id: commentId } });
    if (!comment) throw new GrowthCommentsServiceError('Comment not found', 404);
    if (comment.authorId !== authorProfileId) throw new GrowthCommentsServiceError('Solo el autor puede editar este comentario.', 403);

    return prisma.growthLeadComment.update({
      where: { id: commentId },
      data: { body: body.trim(), editedAt: new Date() },
      include: {
        author: { select: { id: true, firstName: true, lastName: true, avatarFileId: true } },
      },
    });
  }

  async function deleteComment(commentId, requesterAuthId, companyId) {
    const requesterProfileId = await resolveProfileId(requesterAuthId);
    if (!requesterProfileId) throw new GrowthCommentsServiceError('Usuario no encontrado.', 400);
    const comment = await prisma.growthLeadComment.findFirst({
      where: { id: commentId },
      include: { lead: { select: { id: true, companyId: true } } },
    });
    if (!comment) throw new GrowthCommentsServiceError('Comment not found', 404);
    if (comment.lead?.companyId !== companyId) throw new GrowthCommentsServiceError('Comment not found', 404);
    if (comment.authorId !== requesterProfileId) throw new GrowthCommentsServiceError('No tienes permiso para eliminar este comentario.', 403);

    await prisma.growthLeadComment.delete({ where: { id: commentId } });
  }

  async function toggleReaction(commentId, userAuthId, emoji) {
    const userProfileId = await resolveProfileId(userAuthId);
    if (!userProfileId) throw new GrowthCommentsServiceError('Usuario no encontrado.', 400);
    const existing = await prisma.growthLeadCommentReaction.findUnique({
      where: { commentId_userId_emoji: { commentId, userId: userProfileId, emoji } },
    });

    if (existing) {
      await prisma.growthLeadCommentReaction.delete({
        where: { commentId_userId_emoji: { commentId, userId: userProfileId, emoji } },
      });
      return { action: 'removed' };
    }

    await prisma.growthLeadCommentReaction.create({ data: { commentId, userId: userProfileId, emoji } });
    return { action: 'added' };
  }

  return { listComments, createComment, updateComment, deleteComment, toggleReaction };
}
