const MAX_ENTITY_REFS = 5;

// Deliberately duplicates the authUserId -> {profileId, companyId} lookup
// already present, identically, in contacts-service.js/files-service.js/
// hr-service.js — see spec Section 24 Risk 2 for why this is intentional,
// not an oversight to "fix" by extracting a shared helper.
async function resolveActorContext(prisma, authUserId) {
  const profile = await prisma.userProfile.findUnique({ where: { authUserId }, select: { id: true } });
  if (!profile) return null;
  const membership = await prisma.membership.findFirst({
    where: { userId: profile.id, enabled: true },
    orderBy: { createdAt: "desc" },
    select: { companyId: true },
  });
  if (!membership?.companyId) return null;
  return { profileId: profile.id, companyId: membership.companyId };
}

export function createChatEntityReferencesService({ prisma, contactsService, filesService, hrService, ledgerService, projectsService, tasksService, calendarEventService }) {
  // Not a static registry object keyed by entityType — each type's
  // underlying call shape genuinely differs (three take authUserId+id
  // directly, ledger needs companyId/actorId derived separately), so a
  // single if/else per type is clearer here than forcing a uniform shape
  // that doesn't actually hold across all four.
  async function resolveOne(authUserId, { entityType, recordId }) {
    try {
      if (entityType === "contact") {
        const row = await contactsService.getById({ authUserId, id: recordId });
        if (!row) return null;
        // Contact has no photo/avatar column at all (checked the Prisma model —
        // genuinely absent, not just unread here) — phone/email is the richest
        // "at a glance" subtitle available without a schema change.
        return {
          entityType, recordId, title: row.name,
          subtitle: row.phone ?? row.email ?? null,
          url: `/app/m/atlas.contacts/contacts/${recordId}`,
        };
      }
      if (entityType === "file") {
        const row = await filesService.getById({ authUserId, id: recordId });
        if (!row) return null;
        return {
          entityType, recordId, title: row.originalName, subtitle: null,
          url: `/app/m/atlas.files/files/${recordId}`,
          mimeType: row.mimeType ?? null,
          sizeBytes: row.sizeBytes ?? null,
        };
      }
      if (entityType === "hr_employee") {
        const row = await hrService.getEmployee({ authUserId, id: recordId });
        if (!row) return null;
        return {
          entityType, recordId, title: `${row.firstName} ${row.lastName}`.trim(),
          subtitle: row.jobTitleRef?.name ?? row.jobTitle ?? row.departmentRef?.name ?? row.department ?? null,
          url: `/app/m/atlas.hr/hr/employees/${recordId}`,
          // hrService already includes both the employee's own profile photo
          // and their linked user account's avatar — prefer the employee
          // record's own photo, fall back to the account avatar.
          photoFileId: row.profileImageFileId ?? row.userProfile?.avatarFileId ?? null,
        };
      }
      if (entityType === "project") {
        const ctx = await resolveActorContext(prisma, authUserId);
        if (!ctx) return null;
        const row = await projectsService.getProject(recordId, ctx.profileId);
        return {
          entityType, recordId, title: row.name, subtitle: null,
          url: `/app/m/atlas.projects/${recordId}`,
          color: row.color ?? null,
          icon: row.icon ?? null,
        };
      }
      if (entityType === "task") {
        const row = await tasksService.getTask(recordId);
        if (!row) return null;
        return {
          entityType, recordId, title: row.title,
          subtitle: row.status?.name ?? null,
          url: `/app/m/atlas.projects/tasks/${recordId}`,
        };
      }
      if (entityType === "calendar_event") {
        const ctx = await resolveActorContext(prisma, authUserId);
        if (!ctx) return null;
        const row = await calendarEventService.getEvent(ctx.profileId, recordId);
        const startDate = new Date(row.startAt);
        const subtitle = Number.isNaN(startDate.getTime())
          ? null
          : startDate.toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" });
        return {
          entityType, recordId, title: row.title, subtitle,
          url: `/app/m/atlas.calendar/events/${recordId}`,
        };
      }
      if (entityType === "ledger_account") {
        const ctx = await resolveActorContext(prisma, authUserId);
        if (!ctx) return null;
        const row = await ledgerService.getAccount({ companyId: ctx.companyId, accountId: recordId, actorId: ctx.profileId });
        if (!row) return null;
        // getAccount is a raw $queryRaw result, not a Prisma-mapped select —
        // multi-word columns come back snake_case (account_number,
        // current_balance), not camelCase. bank/name/currency happen to be
        // single-word and camelCase-compatible either way.
        const maskedNumber = row.account_number ? `····${String(row.account_number).slice(-4)}` : null;
        const subtitle = [row.bank, maskedNumber].filter(Boolean).join(" · ") || null;
        return {
          entityType, recordId,
          title: row.bank ? `${row.name} · ${row.bank}` : row.name,
          subtitle,
          url: `/app/m/atlas.ledger/accounts/${recordId}`,
          currency: row.currency ?? null,
          balance: row.current_balance != null ? Number(row.current_balance) : null,
        };
      }
      return null; // unknown entityType — drop silently
    } catch {
      return null; // any resolution failure (404/403/etc from the target service) — drop silently, never surface
    }
  }

  async function resolveEntityRefs({ authUserId, entityRefs }) {
    if (!entityRefs?.length) return [];
    const capped = entityRefs.slice(0, MAX_ENTITY_REFS);
    const resolved = await Promise.all(capped.map((ref) => resolveOne(authUserId, ref)));
    return resolved.filter(Boolean);
  }

  return { resolveEntityRefs };
}
