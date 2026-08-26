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

export function createChatEntityReferencesService({ prisma, contactsService, filesService, hrService, ledgerService }) {
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
        return { entityType, recordId, title: row.name, subtitle: null, url: `/app/m/atlas.contacts/contacts/${recordId}` };
      }
      if (entityType === "file") {
        const row = await filesService.getById({ authUserId, id: recordId });
        if (!row) return null;
        return { entityType, recordId, title: row.originalName, subtitle: null, url: `/app/m/atlas.files/files/${recordId}` };
      }
      if (entityType === "hr_employee") {
        const row = await hrService.getEmployee({ authUserId, id: recordId });
        if (!row) return null;
        return { entityType, recordId, title: `${row.firstName} ${row.lastName}`.trim(), subtitle: null, url: `/app/m/atlas.hr/hr/employees/${recordId}` };
      }
      if (entityType === "ledger_account") {
        const ctx = await resolveActorContext(prisma, authUserId);
        if (!ctx) return null;
        const row = await ledgerService.getAccount({ companyId: ctx.companyId, accountId: recordId, actorId: ctx.profileId });
        if (!row) return null;
        const subtitle = row.bank ? row.bank : null;
        return { entityType, recordId, title: subtitle ? `${row.name} · ${row.bank}` : row.name, subtitle, url: `/app/m/atlas.ledger/accounts/${recordId}` };
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
