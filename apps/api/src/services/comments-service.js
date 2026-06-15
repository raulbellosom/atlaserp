import { parseMentionIds } from '../lib/mention-utils.js';

export class CommentsServiceError extends Error {
  constructor(message, status = 500) {
    super(message);
    this.name = 'CommentsServiceError';
    this.status = status;
  }
}

export function createCommentsService({ prisma }) {
  async function resolveProfileId(authUserId) {
    if (!authUserId) return null;
    const profile = await prisma.userProfile.findFirst({
      where: { authUserId },
      select: { id: true },
    });
    return profile?.id ?? null;
  }

  async function listComments(entityType, entityId) {
    return prisma.entityComment.findMany({
      where: { entityType, entityId },
      include: {
        author: { select: { id: true, firstName: true, lastName: true, avatarFileId: true } },
        mentions: { include: { user: { select: { id: true, firstName: true, lastName: true } } } },
        reactions: { include: { user: { select: { id: true, firstName: true, lastName: true } } } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async function createComment(entityType, entityId, authorAuthId, body, companyId) {
    const authorId = await resolveProfileId(authorAuthId);
    if (!authorId) throw new CommentsServiceError('Autor no encontrado.', 404);
    if (!body?.trim()) throw new CommentsServiceError('El comentario no puede estar vacío.', 400);

    const mentionIds = parseMentionIds(body);

    const comment = await prisma.entityComment.create({
      data: {
        companyId,
        entityType,
        entityId,
        authorId,
        body: body.trim(),
        mentions: mentionIds.length
          ? { create: mentionIds.map((userId) => ({ userId })) }
          : undefined,
      },
      include: {
        author: { select: { id: true, firstName: true, lastName: true, avatarFileId: true } },
        mentions: { include: { user: { select: { id: true, firstName: true, lastName: true } } } },
        reactions: { include: { user: { select: { id: true, firstName: true, lastName: true } } } },
      },
    });

    return comment;
  }

  async function updateComment(commentId, authorAuthId, body) {
    const authorId = await resolveProfileId(authorAuthId);
    if (!authorId) throw new CommentsServiceError('Autor no encontrado.', 404);
    if (!body?.trim()) throw new CommentsServiceError('El comentario no puede estar vacío.', 400);

    const existing = await prisma.entityComment.findUnique({ where: { id: commentId } });
    if (!existing) throw new CommentsServiceError('Comentario no encontrado.', 404);
    if (existing.authorId !== authorId) throw new CommentsServiceError('No tienes permiso para editar este comentario.', 403);

    const mentionIds = parseMentionIds(body);

    await prisma.entityCommentMention.deleteMany({ where: { commentId } });

    const comment = await prisma.entityComment.update({
      where: { id: commentId },
      data: {
        body: body.trim(),
        editedAt: new Date(),
        mentions: mentionIds.length
          ? { create: mentionIds.map((userId) => ({ userId })) }
          : undefined,
      },
      include: {
        author: { select: { id: true, firstName: true, lastName: true, avatarFileId: true } },
        mentions: { include: { user: { select: { id: true, firstName: true, lastName: true } } } },
        reactions: { include: { user: { select: { id: true, firstName: true, lastName: true } } } },
      },
    });

    return comment;
  }

  async function deleteComment(commentId, requesterAuthId, companyId) {
    const requesterId = await resolveProfileId(requesterAuthId);
    if (!requesterId) throw new CommentsServiceError('Usuario no encontrado.', 404);

    const existing = await prisma.entityComment.findFirst({
      where: { id: commentId, companyId },
    });
    if (!existing) throw new CommentsServiceError('Comentario no encontrado.', 404);
    if (existing.authorId !== requesterId) throw new CommentsServiceError('No tienes permiso para eliminar este comentario.', 403);

    await prisma.entityComment.delete({ where: { id: commentId } });
  }

  async function toggleReaction(commentId, userAuthId, emoji) {
    const userId = await resolveProfileId(userAuthId);
    if (!userId) throw new CommentsServiceError('Usuario no encontrado.', 404);
    if (!emoji?.trim()) throw new CommentsServiceError('Emoji requerido.', 400);

    const existing = await prisma.entityCommentReaction.findFirst({
      where: { commentId, userId, emoji },
    });

    if (existing) {
      await prisma.entityCommentReaction.delete({ where: { id: existing.id } });
      return { removed: true, emoji };
    }

    const reaction = await prisma.entityCommentReaction.create({
      data: { commentId, userId, emoji },
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
    });
    return { removed: false, reaction };
  }

  return { listComments, createComment, updateComment, deleteComment, toggleReaction };
}
