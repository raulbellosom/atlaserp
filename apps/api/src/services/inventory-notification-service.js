import { createNotificationService } from './notification-service.js'

export function createInventoryNotificationService({ prisma, notificationService }) {
  const notifSvc = notificationService ?? createNotificationService({ prisma })

  async function notifyInvComment({ companyId, actorId, itemId, mentionedUserIds = [] }) {
    const recipients = mentionedUserIds.filter((id) => id !== actorId)
    if (recipients.length === 0) return
    try {
      const item = await prisma.invItem.findFirst({
        where: { id: itemId },
        select: { name: true },
      })
      if (!item) return
      await notifSvc.publish({
        companyId,
        actorId: actorId ?? null,
        input: {
          eventType: 'inventory.item.mention',
          title: 'Te mencionaron en inventario',
          body: `En el elemento "${item.name}"`,
          link: `/app/m/atlas.inventory/inventory/${itemId}`,
          recipients: { userIds: recipients },
          channels: ['in_app', 'email', 'web_push'],
          priority: 'medium',
          sourceType: 'InvItem',
          sourceId: itemId,
          metadata: { itemId },
        },
      })
    } catch (err) {
      console.error('[inventory.item.mention]', err?.message ?? err)
    }
  }

  async function notifyInvReaction({ companyId, actorId, commentId }) {
    try {
      const comment = await prisma.invComment.findFirst({
        where: { id: commentId },
        include: { item: { select: { id: true, name: true } } },
      })
      if (!comment) return
      if (comment.authorId === actorId) return
      const item = comment.item
      await notifSvc.publish({
        companyId,
        actorId: actorId ?? null,
        input: {
          eventType: 'inventory.item.reaction',
          title: 'Reaccionaron a tu comentario',
          body: `En el elemento "${item?.name ?? 'Inventario'}"`,
          link: `/app/m/atlas.inventory/inventory/${item?.id ?? ''}`,
          recipients: { userIds: [comment.authorId] },
          channels: ['in_app'],
          priority: 'low',
          sourceType: 'InvComment',
          sourceId: commentId,
          metadata: { commentId, itemId: item?.id },
        },
      })
    } catch (err) {
      console.error('[inventory.item.reaction]', err?.message ?? err)
    }
  }

  return { notifyInvComment, notifyInvReaction }
}
