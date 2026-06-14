import {
  growthLeadConvertSchema,
  growthLeadCreateSchema,
  growthLeadEnabledSchema,
  growthLeadNoteSchema,
  growthLeadQuerySchema,
  growthLeadUpdateSchema,
} from "./growth-validators.js";

const ALLOWED_TRANSITIONS = {
  new: new Set(["follow_up", "qualified", "discarded"]),
  follow_up: new Set(["qualified", "discarded"]),
  qualified: new Set(["follow_up", "discarded"]),
  discarded: new Set(["follow_up"]),
  converted: new Set(),
};

export class GrowthLeadServiceError extends Error {
  constructor(message, status = 400, code = "growth_lead_error", details) {
    super(message);
    this.name = "GrowthLeadServiceError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function normalizeText(value, maxLength) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const normalized = String(value).trim().slice(0, maxLength);
  return normalized || null;
}

function normalizeEmail(value) {
  const email = normalizeText(value, 500);
  return {
    email,
    emailNormalized: email?.toLowerCase() ?? null,
  };
}

function normalizePhone(value) {
  const phone = normalizeText(value, 100);
  if (!phone) return { phone, phoneNormalized: null };
  const leadingPlus = phone.startsWith("+") ? "+" : "";
  const digits = phone.replace(/\D/g, "");
  return {
    phone,
    phoneNormalized: digits ? `${leadingPlus}${digits}` : null,
  };
}

function sameInstant(left, right) {
  return new Date(left).getTime() === new Date(right).getTime();
}

export function createGrowthLeadService({
  prisma,
  notificationService,
  now = () => new Date(),
}) {
  async function getLeadRecord({ companyId, id }) {
    const lead = await prisma.growthLead.findFirst({
      where: { id, companyId },
    });
    if (!lead) {
      throw new GrowthLeadServiceError(
        "Lead no encontrado.",
        404,
        "lead_not_found",
      );
    }
    return lead;
  }

  function assertVersion(lead, updatedAt) {
    if (!sameInstant(lead.updatedAt, updatedAt)) {
      throw new GrowthLeadServiceError(
        "El lead fue actualizado por otro usuario.",
        409,
        "lead_update_conflict",
      );
    }
  }

  function assertMutable(lead) {
    if (!lead.enabled) {
      throw new GrowthLeadServiceError(
        "El lead esta deshabilitado.",
        409,
        "lead_disabled",
      );
    }
    if (lead.status === "converted" || lead.convertedAt) {
      throw new GrowthLeadServiceError(
        "El lead ya fue convertido.",
        409,
        "lead_converted",
      );
    }
  }

  async function assertAssignee({ companyId, userId }) {
    if (!userId) return;
    const membership = await prisma.membership.findFirst({
      where: {
        companyId,
        userId,
        enabled: true,
        user: { enabled: true },
      },
      select: { id: true },
    });
    if (!membership) {
      throw new GrowthLeadServiceError(
        "El responsable debe pertenecer a la empresa activa.",
        422,
        "invalid_assignee",
      );
    }
  }

  async function resolveSite({ companyId, siteId }) {
    const site = await prisma.websiteSite.findFirst({
      where: {
        companyId,
        enabled: true,
        ...(siteId ? { id: siteId } : {}),
      },
      orderBy: { createdAt: "asc" },
      select: { id: true, companyId: true },
    });
    if (!site) {
      throw new GrowthLeadServiceError(
        "Sitio web no encontrado.",
        422,
        "site_not_found",
      );
    }
    return site;
  }

  async function publishAssigneeNotification({
    companyId,
    actorId,
    lead,
    eventType,
  }) {
    if (!lead.assigneeUserId || !notificationService?.publish) return;
    try {
      await notificationService.publish({
        companyId,
        actorId: actorId ?? null,
        input: {
          eventType,
          title:
            eventType === "growth.lead.created"
              ? "Nuevo lead asignado"
              : "Lead asignado",
          body: lead.name || lead.email || "Lead web",
          link: `/app/m/atlas.growth/leads/${lead.id}`,
          recipients: { userIds: [lead.assigneeUserId] },
          channels: ["in_app", "email"],
          priority: lead.priority === "high" ? "high" : "medium",
          sourceType: "GrowthLead",
          sourceId: lead.id,
          metadata: { leadId: lead.id },
        },
      });
    } catch (error) {
      console.error("[growth.lead.notification]", error?.message ?? error);
    }
  }

  async function listLeads({ companyId, query = {} }) {
    const parsed = growthLeadQuerySchema.parse(query);
    const where = {
      companyId,
      enabled: parsed.enabled,
      ...(parsed.status ? { status: parsed.status } : {}),
      ...(parsed.priority ? { priority: parsed.priority } : {}),
      ...(parsed.assigneeId ? { assigneeUserId: parsed.assigneeId } : {}),
      ...(parsed.formId ? { formId: parsed.formId } : {}),
      ...(parsed.campaign
        ? {
            attribution: {
              path: ["campaign"],
              equals: parsed.campaign,
            },
          }
        : {}),
    };
    if (parsed.from || parsed.to) {
      where.createdAt = {};
      if (parsed.from) where.createdAt.gte = parsed.from;
      if (parsed.to) where.createdAt.lte = parsed.to;
    }
    if (parsed.search) {
      where.OR = [
        { name: { contains: parsed.search, mode: "insensitive" } },
        { email: { contains: parsed.search, mode: "insensitive" } },
        { phone: { contains: parsed.search, mode: "insensitive" } },
        { companyName: { contains: parsed.search, mode: "insensitive" } },
        { message: { contains: parsed.search, mode: "insensitive" } },
      ];
    }

    const [rows, total] = await Promise.all([
      prisma.growthLead.findMany({
        where,
        orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
        skip: (parsed.page - 1) * parsed.pageSize,
        take: parsed.pageSize,
      }),
      prisma.growthLead.count({ where }),
    ]);
    return {
      rows,
      total,
      page: parsed.page,
      pageSize: parsed.pageSize,
      totalPages: Math.max(1, Math.ceil(total / parsed.pageSize)),
    };
  }

  async function getLeadSummary({ companyId, query = {} }) {
    const parsed = growthLeadQuerySchema.parse(query);
    const where = {
      companyId,
      enabled: parsed.enabled,
      ...(parsed.from || parsed.to
        ? {
            createdAt: {
              ...(parsed.from ? { gte: parsed.from } : {}),
              ...(parsed.to ? { lte: parsed.to } : {}),
            },
          }
        : {}),
    };
    const grouped = await prisma.growthLead.groupBy({
      by: ["status"],
      where,
      _count: { _all: true },
    });
    const byStatus = Object.fromEntries(
      grouped.map((row) => [row.status, row._count._all]),
    );
    const total = grouped.reduce((sum, row) => sum + row._count._all, 0);
    return {
      total,
      new: byStatus.new ?? 0,
      followUp: byStatus.follow_up ?? 0,
      qualified: byStatus.qualified ?? 0,
      converted: byStatus.converted ?? 0,
      discarded: byStatus.discarded ?? 0,
    };
  }

  async function listAssignees({ companyId }) {
    const memberships = await prisma.membership.findMany({
      where: {
        companyId,
        enabled: true,
        user: { enabled: true },
      },
      orderBy: { user: { displayName: "asc" } },
      select: {
        user: {
          select: {
            id: true,
            displayName: true,
            email: true,
          },
        },
      },
    });
    return memberships.map((membership) => membership.user);
  }

  async function getLead({ companyId, id }) {
    const lead = await getLeadRecord({ companyId, id });
    const [activities, submissions] = await Promise.all([
      prisma.growthLeadActivity.findMany({
        where: { companyId, leadId: id },
        orderBy: { occurredAt: "desc" },
      }),
      prisma.websiteFormSubmission.findMany({
        where: { companyId, leadId: id },
        orderBy: { submittedAt: "desc" },
        select: {
          id: true,
          formId: true,
          submittedAt: true,
        },
      }),
    ]);
    return { ...lead, activities, submissions };
  }

  function leadFileWhere({ companyId, id, fileAssetId, enabled }) {
    return {
      ...(fileAssetId ? { id: fileAssetId } : {}),
      entityId: companyId,
      moduleKey: "atlas.growth",
      entityType: "GrowthLead",
      ...(enabled === undefined ? {} : { enabled }),
      metadata: {
        path: ["sourceEntityId"],
        equals: id,
      },
    };
  }

  async function listLeadFiles({ companyId, id }) {
    await getLeadRecord({ companyId, id });
    return prisma.fileAsset.findMany({
      where: leadFileWhere({ companyId, id, enabled: true }),
      orderBy: { createdAt: "desc" },
    });
  }

  async function associateLeadFile({ companyId, id, fileAssetId }) {
    await getLeadRecord({ companyId, id });
    const file = await prisma.fileAsset.findFirst({
      where: leadFileWhere({
        companyId,
        id,
        fileAssetId,
        enabled: true,
      }),
    });
    if (!file) {
      throw new GrowthLeadServiceError(
        "Archivo del lead no encontrado.",
        404,
        "lead_file_not_found",
      );
    }
    return file;
  }

  async function removeLeadFile({
    companyId,
    actorId,
    id,
    fileAssetId,
  }) {
    const lead = await getLeadRecord({ companyId, id });
    const file = await prisma.fileAsset.findFirst({
      where: leadFileWhere({
        companyId,
        id,
        fileAssetId,
        enabled: true,
      }),
    });
    if (!file) {
      throw new GrowthLeadServiceError(
        "Archivo del lead no encontrado.",
        404,
        "lead_file_not_found",
      );
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.fileAsset.update({
        where: { id: file.id },
        data: { enabled: false },
      });
      await tx.growthLeadActivity.create({
        data: {
          companyId,
          siteId: lead.siteId,
          leadId: lead.id,
          activityType: "file_removed",
          actorUserId: actorId ?? null,
          payload: {
            fileAssetId: file.id,
            originalName: file.originalName,
          },
          occurredAt: now(),
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: actorId ?? null,
          moduleKey: "atlas.growth",
          entityType: "growth.lead",
          entityId: lead.id,
          action: "growth.lead.file.remove",
          before: { fileAssetId: file.id, enabled: true },
          after: { fileAssetId: file.id, enabled: false },
          metadata: { companyId, originalName: file.originalName },
        },
      });
      return updated;
    });
  }

  async function createLead({ companyId, actorId, data }) {
    const parsed = growthLeadCreateSchema.parse(data);
    const site = await resolveSite({ companyId, siteId: parsed.siteId });
    await assertAssignee({
      companyId,
      userId: parsed.assigneeUserId,
    });
    const email = normalizeEmail(parsed.email);
    const phone = normalizePhone(parsed.phone);

    const lead = await prisma.$transaction(async (tx) => {
      const created = await tx.growthLead.create({
        data: {
          companyId,
          siteId: site.id,
          formId: parsed.formId ?? null,
          status: "new",
          priority: parsed.priority,
          name: normalizeText(parsed.name, 500),
          ...email,
          ...phone,
          companyName: normalizeText(parsed.companyName, 500),
          message: normalizeText(parsed.message, 5000),
          source: "manual",
          attribution: parsed.attribution ?? null,
          assigneeUserId: parsed.assigneeUserId ?? null,
          firstSubmissionAt: now(),
          lastSubmissionAt: now(),
          firstSeenAt: now(),
          lastSeenAt: now(),
        },
      });
      await tx.growthLeadActivity.create({
        data: {
          companyId,
          siteId: site.id,
          leadId: created.id,
          activityType: "status_changed",
          actorUserId: actorId ?? null,
          payload: { from: null, to: "new", source: "manual" },
          occurredAt: now(),
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: actorId ?? null,
          moduleKey: "atlas.growth",
          entityType: "growth.lead",
          entityId: created.id,
          action: "growth.lead.create",
          before: null,
          after: {
            status: created.status,
            priority: created.priority,
            assigneeUserId: created.assigneeUserId,
          },
          metadata: { companyId, siteId: site.id },
        },
      });
      return created;
    });

    await publishAssigneeNotification({
      companyId,
      actorId,
      lead,
      eventType: "growth.lead.created",
    });
    return lead;
  }

  async function updateLead({ companyId, actorId, id, data }) {
    const parsed = growthLeadUpdateSchema.parse(data);
    const lead = await getLeadRecord({ companyId, id });
    assertMutable(lead);
    assertVersion(lead, parsed.updatedAt);
    if (parsed.assigneeUserId !== undefined) {
      await assertAssignee({
        companyId,
        userId: parsed.assigneeUserId,
      });
    }

    const changes = {};
    const activities = [];
    if (parsed.status && parsed.status !== lead.status) {
      if (!ALLOWED_TRANSITIONS[lead.status]?.has(parsed.status)) {
        throw new GrowthLeadServiceError(
          "Cambio de estado no permitido.",
          422,
          "invalid_status_transition",
        );
      }
      changes.status = parsed.status;
      if (parsed.status === "qualified") changes.qualifiedAt = now();
      if (parsed.status === "discarded") {
        changes.discardReason =
          normalizeText(parsed.discardReason, 1000) ?? "Sin motivo";
      }
      if (lead.status === "discarded" && parsed.status === "follow_up") {
        changes.discardReason = null;
        activities.push({
          activityType: "reopened",
          payload: { from: lead.status, to: parsed.status },
        });
      } else {
        activities.push({
          activityType: "status_changed",
          payload: { from: lead.status, to: parsed.status },
        });
      }
    }
    if (parsed.priority && parsed.priority !== lead.priority) {
      changes.priority = parsed.priority;
      activities.push({
        activityType: "priority_changed",
        payload: { from: lead.priority, to: parsed.priority },
      });
    }
    if (
      parsed.assigneeUserId !== undefined &&
      parsed.assigneeUserId !== lead.assigneeUserId
    ) {
      changes.assigneeUserId = parsed.assigneeUserId;
      activities.push({
        activityType: "assigned",
        payload: {
          from: lead.assigneeUserId,
          to: parsed.assigneeUserId,
        },
      });
    }
    for (const field of ["name", "companyName", "message"]) {
      if (parsed[field] !== undefined) {
        changes[field] = normalizeText(
          parsed[field],
          field === "message" ? 5000 : 500,
        );
      }
    }
    if (parsed.email !== undefined) Object.assign(changes, normalizeEmail(parsed.email));
    if (parsed.phone !== undefined) Object.assign(changes, normalizePhone(parsed.phone));

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.growthLead.update({
        where: { id: lead.id },
        data: changes,
      });
      for (const activity of activities) {
        await tx.growthLeadActivity.create({
          data: {
            companyId,
            siteId: lead.siteId,
            leadId: lead.id,
            actorUserId: actorId ?? null,
            occurredAt: now(),
            ...activity,
          },
        });
      }
      const onlyAssignment =
        activities.length === 1 &&
        activities[0].activityType === "assigned";
      const onlyStatus =
        activities.length === 1 &&
        ["status_changed", "reopened"].includes(
          activities[0].activityType,
        );
      await tx.auditLog.create({
        data: {
          actorId: actorId ?? null,
          moduleKey: "atlas.growth",
          entityType: "growth.lead",
          entityId: lead.id,
          action: onlyAssignment
            ? "growth.lead.assign"
            : onlyStatus
              ? "growth.lead.status_change"
              : "growth.lead.update",
          before: {
            status: lead.status,
            priority: lead.priority,
            assigneeUserId: lead.assigneeUserId,
          },
          after: {
            status: row.status,
            priority: row.priority,
            assigneeUserId: row.assigneeUserId,
          },
          metadata: { companyId },
        },
      });
      return row;
    });

    if (
      changes.assigneeUserId &&
      changes.assigneeUserId !== lead.assigneeUserId
    ) {
      await publishAssigneeNotification({
        companyId,
        actorId,
        lead: updated,
        eventType: "growth.lead.assigned",
      });
    }
    return updated;
  }

  async function addLeadNote({ companyId, actorId, id, data }) {
    const parsed = growthLeadNoteSchema.parse(data);
    const lead = await getLeadRecord({ companyId, id });
    assertMutable(lead);
    assertVersion(lead, parsed.updatedAt);

    return prisma.$transaction(async (tx) => {
      const updated = await tx.growthLead.update({
        where: { id: lead.id },
        data: { notesSummary: parsed.note.slice(0, 500) },
      });
      const activity = await tx.growthLeadActivity.create({
        data: {
          companyId,
          siteId: lead.siteId,
          leadId: lead.id,
          activityType: "note",
          actorUserId: actorId ?? null,
          payload: { note: parsed.note },
          occurredAt: now(),
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: actorId ?? null,
          moduleKey: "atlas.growth",
          entityType: "growth.lead",
          entityId: lead.id,
          action: "growth.lead.note",
          before: null,
          after: null,
          metadata: {
            companyId,
            activityId: activity.id,
            noteLength: parsed.note.length,
          },
        },
      });
      return { lead: updated, activity };
    });
  }

  async function setLeadEnabled({
    companyId,
    actorId,
    id,
    enabled,
    updatedAt,
  }) {
    const parsed = growthLeadEnabledSchema.parse({ enabled, updatedAt });
    const lead = await getLeadRecord({ companyId, id });
    assertVersion(lead, parsed.updatedAt);
    if (lead.enabled === parsed.enabled) return lead;

    return prisma.$transaction(async (tx) => {
      const updated = await tx.growthLead.update({
        where: { id: lead.id },
        data: { enabled: parsed.enabled },
      });
      const activityType = parsed.enabled ? "enabled" : "disabled";
      await tx.growthLeadActivity.create({
        data: {
          companyId,
          siteId: lead.siteId,
          leadId: lead.id,
          activityType,
          actorUserId: actorId ?? null,
          payload: null,
          occurredAt: now(),
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: actorId ?? null,
          moduleKey: "atlas.growth",
          entityType: "growth.lead",
          entityId: lead.id,
          action: parsed.enabled
            ? "growth.lead.enable"
            : "growth.lead.disable",
          before: { enabled: lead.enabled },
          after: { enabled: parsed.enabled },
          metadata: { companyId },
        },
      });
      return updated;
    });
  }

  async function convertLead({
    companyId,
    actorId,
    id,
    data,
    permissions = [],
    isAdmin = false,
  }) {
    const parsed = growthLeadConvertSchema.parse(data);
    const requiredPermission =
      parsed.mode === "existing"
        ? "contacts.contacts.read"
        : "contacts.contacts.create";
    if (!isAdmin && !permissions.includes(requiredPermission)) {
      throw new GrowthLeadServiceError(
        "No tienes permiso para usar contactos en esta conversion.",
        403,
        "contacts_permission_required",
      );
    }

    const lead = await getLeadRecord({ companyId, id });
    assertMutable(lead);
    assertVersion(lead, parsed.updatedAt);

    return prisma.$transaction(async (tx) => {
      let contact;
      if (parsed.mode === "existing") {
        contact = await tx.contact.findFirst({
          where: {
            id: parsed.contactId,
            companyId,
            enabled: true,
          },
        });
        if (!contact) {
          throw new GrowthLeadServiceError(
            "Contacto no encontrado.",
            404,
            "contact_not_found",
          );
        }
      } else {
        contact = await tx.contact.create({
          data: {
            companyId,
            type: parsed.contact.type,
            name: parsed.contact.name,
            email: normalizeText(parsed.contact.email, 500),
            phone: normalizeText(parsed.contact.phone, 100),
            enabled: true,
          },
        });
      }

      const convertedAt = now();
      const update = await tx.growthLead.updateMany({
        where: {
          id: lead.id,
          companyId,
          enabled: true,
          status: { not: "converted" },
          convertedAt: null,
          updatedAt: lead.updatedAt,
        },
        data: {
          status: "converted",
          contactId: contact.id,
          convertedAt,
        },
      });
      if (update.count !== 1) {
        throw new GrowthLeadServiceError(
          "El lead ya fue convertido o cambio durante la operacion.",
          409,
          "lead_conversion_conflict",
        );
      }

      await tx.growthLeadActivity.create({
        data: {
          companyId,
          siteId: lead.siteId,
          leadId: lead.id,
          activityType: "converted",
          actorUserId: actorId ?? null,
          payload: {
            mode: parsed.mode,
            contactId: contact.id,
          },
          occurredAt: convertedAt,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: actorId ?? null,
          moduleKey: "atlas.growth",
          entityType: "growth.lead",
          entityId: lead.id,
          action: "growth.lead.convert",
          before: {
            status: lead.status,
            contactId: lead.contactId,
          },
          after: {
            status: "converted",
            contactId: contact.id,
          },
          metadata: {
            companyId,
            contactId: contact.id,
            mode: parsed.mode,
          },
        },
      });

      const convertedLead = await tx.growthLead.findUnique({
        where: { id: lead.id },
      });
      return { lead: convertedLead, contact };
    });
  }

  return {
    listLeads,
    getLeadSummary,
    listAssignees,
    getLead,
    listLeadFiles,
    associateLeadFile,
    removeLeadFile,
    createLead,
    updateLead,
    addLeadNote,
    setLeadEnabled,
    convertLead,
  };
}
