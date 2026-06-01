import {
  notificationPublishSchema,
  notificationListQuerySchema,
  notificationPreferenceUpsertSchema,
  webPushSubscriptionSchema,
} from "@atlas/validators";

const DEDUPE_WINDOW_MS = 5000;

const PRIORITY_KIND_MAP = {
  low: "info",
  medium: "info",
  high: "warning",
  critical: "error",
};

export class NotificationServiceError extends Error {
  constructor(message, status = 500, code = "notification_error") {
    super(message);
    this.name = "NotificationServiceError";
    this.status = status;
    this.code = code;
  }
}

function toNotificationView(row) {
  return {
    ...row,
    read: Boolean(row.readAt),
  };
}

function buildCompanyScopeClause(companyId) {
  return {
    OR: [{ companyId }, { companyId: null }],
  };
}

function buildListWhere({ userId, companyId, query }) {
  const where = {
    userId,
    ...buildCompanyScopeClause(companyId),
  };

  if (query.unreadOnly === true) {
    where.readAt = null;
  }
  if (query.priority) {
    where.priority = query.priority;
  }
  if (query.eventType) {
    where.eventType = query.eventType;
  }
  if (query.from || query.to) {
    where.createdAt = {};
    if (query.from) where.createdAt.gte = query.from;
    if (query.to) where.createdAt.lte = query.to;
  }
  if (query.q) {
    const term = query.q.trim();
    if (term) {
      where.OR = [
        { title: { contains: term, mode: "insensitive" } },
        { body: { contains: term, mode: "insensitive" } },
        { eventType: { contains: term, mode: "insensitive" } },
      ];
      where.AND = [buildCompanyScopeClause(companyId)];
    }
  }
  return where;
}

export function createNotificationService({ prisma }) {
  async function resolveCompanyContext(authUserId) {
    const profile = await prisma.userProfile.findUnique({
      where: { authUserId },
      select: { id: true },
    });
    if (!profile) {
      throw new NotificationServiceError(
        "Perfil de usuario no encontrado.",
        404,
        "profile_not_found",
      );
    }

    const membership = await prisma.membership.findFirst({
      where: { userId: profile.id, enabled: true },
      orderBy: { createdAt: "desc" },
      select: { companyId: true },
    });
    if (!membership?.companyId) {
      throw new NotificationServiceError(
        "No tienes una empresa activa.",
        403,
        "no_active_company",
      );
    }

    return {
      profileId: profile.id,
      companyId: membership.companyId,
    };
  }

  async function list({ authUserId, query }) {
    const parsed = notificationListQuerySchema.parse(query ?? {});
    const { profileId, companyId } = await resolveCompanyContext(authUserId);
    const where = buildListWhere({ userId: profileId, companyId, query: parsed });

    const take = parsed.limit + 1;
    const options = {
      where,
      orderBy: [{ id: "desc" }],
      take,
    };
    if (parsed.cursor) {
      options.cursor = { id: parsed.cursor };
      options.skip = 1;
    }

    const rows = await prisma.notification.findMany(options);
    const hasNext = rows.length > parsed.limit;
    const items = hasNext ? rows.slice(0, parsed.limit) : rows;
    const nextCursor = hasNext ? rows[parsed.limit]?.id ?? null : null;

    return {
      data: items.map(toNotificationView),
      pageInfo: { nextCursor },
    };
  }

  async function getOwnedNotification({ authUserId, id }) {
    const { profileId, companyId } = await resolveCompanyContext(authUserId);
    const row = await prisma.notification.findFirst({
      where: {
        id,
        userId: profileId,
        ...buildCompanyScopeClause(companyId),
      },
    });
    if (!row) {
      throw new NotificationServiceError(
        "Notificacion no encontrada.",
        404,
        "notification_not_found",
      );
    }
    return row;
  }

  async function markRead({ authUserId, id }) {
    const row = await getOwnedNotification({ authUserId, id });
    if (row.readAt) return toNotificationView(row);

    const updated = await prisma.notification.update({
      where: { id: row.id },
      data: { readAt: new Date() },
    });
    return toNotificationView(updated);
  }

  async function markAllRead({ authUserId }) {
    const { profileId, companyId } = await resolveCompanyContext(authUserId);
    const result = await prisma.notification.updateMany({
      where: {
        userId: profileId,
        readAt: null,
        ...buildCompanyScopeClause(companyId),
      },
      data: { readAt: new Date() },
    });
    return { updated: result.count };
  }

  async function resolveRecipientUserIds({ companyId, userIds }) {
    const rows = await prisma.membership.findMany({
      where: {
        companyId,
        enabled: true,
        userId: { in: userIds },
      },
      select: { userId: true },
    });
    return [...new Set(rows.map((row) => row.userId))];
  }

  async function isDuplicate({ tx, userId, dedupeKey }) {
    if (!dedupeKey) return false;
    const since = new Date(Date.now() - DEDUPE_WINDOW_MS);
    const row = await tx.notification.findFirst({
      where: {
        userId,
        dedupeKey,
        createdAt: { gte: since },
      },
      select: { id: true },
    });
    return Boolean(row);
  }

  async function publish({ companyId, actorId = null, input }) {
    const parsed = notificationPublishSchema.parse(input ?? {});
    const recipientUserIds = await resolveRecipientUserIds({
      companyId,
      userIds: parsed.recipients.userIds,
    });
    if (!recipientUserIds.length) {
      throw new NotificationServiceError(
        "No se encontraron destinatarios validos para la empresa activa.",
        400,
        "no_valid_recipients",
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const created = [];
      let deduped = 0;

      for (const userId of recipientUserIds) {
        const dedupeKey =
          parsed.dedupeKey ??
          `${parsed.eventType}:${parsed.sourceType ?? ""}:${parsed.sourceId ?? ""}:${userId}`;
        if (await isDuplicate({ tx, userId, dedupeKey })) {
          deduped += 1;
          continue;
        }

        const notification = await tx.notification.create({
          data: {
            userId,
            companyId,
            kind: PRIORITY_KIND_MAP[parsed.priority] ?? "info",
            eventType: parsed.eventType,
            sourceType: parsed.sourceType ?? null,
            sourceId: parsed.sourceId ?? null,
            sourceActivityId: parsed.sourceActivityId ?? null,
            priority: parsed.priority ?? "medium",
            title: parsed.title,
            body: parsed.body ?? null,
            link: parsed.link ?? null,
            metadata: parsed.metadata ?? null,
            dedupeKey,
            expiresAt: parsed.expiresAt ?? null,
          },
        });

        if (parsed.channels.length > 0) {
          await tx.notificationDelivery.createMany({
            data: parsed.channels.map((channel) => ({
              notificationId: notification.id,
              channel,
              status: "queued",
              attempts: 0,
            })),
            skipDuplicates: true,
          });
        }

        created.push(notification);
      }

      return { created, deduped };
    });

    return {
      created: result.created.length,
      deduped: result.deduped,
      data: result.created.map(toNotificationView),
      actorId,
    };
  }

  async function publishFromContext({ authUserId, input }) {
    const { profileId, companyId } = await resolveCompanyContext(authUserId);
    return publish({ companyId, actorId: profileId, input });
  }

  async function listPreferences({ authUserId }) {
    const { profileId } = await resolveCompanyContext(authUserId);
    const rows = await prisma.notificationPreference.findMany({
      where: { userId: profileId },
      orderBy: [{ eventType: "asc" }],
    });
    return { data: rows };
  }

  async function upsertPreference({ authUserId, input }) {
    const parsed = notificationPreferenceUpsertSchema.parse(input ?? {});
    const { profileId } = await resolveCompanyContext(authUserId);
    const row = await prisma.notificationPreference.upsert({
      where: {
        userId_eventType: {
          userId: profileId,
          eventType: parsed.eventType,
        },
      },
      create: {
        userId: profileId,
        eventType: parsed.eventType,
        inAppEnabled: parsed.inAppEnabled,
        emailEnabled: parsed.emailEnabled,
        pushEnabled: parsed.pushEnabled,
        muteUntil: parsed.muteUntil ?? null,
      },
      update: {
        inAppEnabled: parsed.inAppEnabled,
        emailEnabled: parsed.emailEnabled,
        pushEnabled: parsed.pushEnabled,
        muteUntil: parsed.muteUntil ?? null,
      },
    });
    return { data: row };
  }

  async function subscribeWebPush({ authUserId, input, userAgent = null }) {
    const parsed = webPushSubscriptionSchema.parse(input ?? {});
    const { profileId, companyId } = await resolveCompanyContext(authUserId);
    const row = await prisma.pushSubscription.upsert({
      where: { endpoint: parsed.endpoint },
      create: {
        userId: profileId,
        companyId,
        endpoint: parsed.endpoint,
        p256dh: parsed.keys.p256dh,
        auth: parsed.keys.auth,
        deviceLabel: parsed.deviceLabel ?? null,
        userAgent,
        enabled: true,
        lastSeenAt: new Date(),
      },
      update: {
        userId: profileId,
        companyId,
        p256dh: parsed.keys.p256dh,
        auth: parsed.keys.auth,
        deviceLabel: parsed.deviceLabel ?? null,
        userAgent,
        enabled: true,
        lastSeenAt: new Date(),
      },
    });
    return { data: row };
  }

  async function unsubscribeWebPush({ authUserId, id }) {
    const { profileId } = await resolveCompanyContext(authUserId);
    const sub = await prisma.pushSubscription.findFirst({
      where: { id, userId: profileId },
      select: { id: true },
    });
    if (!sub) {
      throw new NotificationServiceError(
        "Suscripcion push no encontrada.",
        404,
        "push_subscription_not_found",
      );
    }

    await prisma.pushSubscription.delete({ where: { id: sub.id } });
    return { data: { deleted: true } };
  }

  return {
    resolveCompanyContext,
    list,
    markRead,
    markAllRead,
    publish,
    publishFromContext,
    listPreferences,
    upsertPreference,
    subscribeWebPush,
    unsubscribeWebPush,
  };
}

