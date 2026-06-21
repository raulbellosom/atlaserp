import { PosServiceError, requireCompanyId, writeAudit } from "./service-helpers.js";

function trimString(value) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function cleanData(data = {}) {
  return Object.fromEntries(
    Object.entries(data)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, trimString(value)]),
  );
}

export function createPosSettingsService({ prisma }) {
  async function getSettings({ companyId }) {
    const scopedCompanyId = requireCompanyId(companyId);
    const existing = await prisma.posSettings.findUnique({
      where: { companyId: scopedCompanyId },
    });
    if (existing) return existing;

    return prisma.posSettings.create({
      data: {
        companyId: scopedCompanyId,
        mode: "RESTAURANT",
        currency: "MXN",
        defaultTaxRate: 16,
      },
    });
  }

  async function updateSettings({ companyId, actorId, data }) {
    const scopedCompanyId = requireCompanyId(companyId);
    const before = await getSettings({ companyId: scopedCompanyId });
    const updated = await prisma.posSettings.update({
      where: { companyId: scopedCompanyId },
      data: cleanData(data),
    });
    await writeAudit(prisma, {
      actorId,
      entityType: "PosSettings",
      entityId: updated.id,
      action: "pos.settings.update",
      before,
      after: updated,
    });
    return updated;
  }

  async function listOutlets({ companyId }) {
    const scopedCompanyId = requireCompanyId(companyId);
    return prisma.posOutlet.findMany({
      where: { companyId: scopedCompanyId },
      orderBy: [{ enabled: "desc" }, { name: "asc" }],
    });
  }

  async function createOutlet({ companyId, actorId, data }) {
    const scopedCompanyId = requireCompanyId(companyId);
    const outlet = await prisma.posOutlet.create({
      data: {
        companyId: scopedCompanyId,
        ...cleanData(data),
      },
    });
    await writeAudit(prisma, {
      actorId,
      entityType: "PosOutlet",
      entityId: outlet.id,
      action: "pos.outlet.create",
      after: outlet,
    });
    return outlet;
  }

  async function updateOutlet({ companyId, id, actorId, data }) {
    const scopedCompanyId = requireCompanyId(companyId);
    const before = await prisma.posOutlet.findFirst({
      where: { id, companyId: scopedCompanyId },
    });
    if (!before) throw new PosServiceError("Sucursal POS no encontrada.", 404);

    const updated = await prisma.posOutlet.update({
      where: { id },
      data: cleanData(data),
    });
    await writeAudit(prisma, {
      actorId,
      entityType: "PosOutlet",
      entityId: updated.id,
      action: "pos.outlet.update",
      before,
      after: updated,
    });
    return updated;
  }

  async function listTerminals({ companyId }) {
    const scopedCompanyId = requireCompanyId(companyId);
    return prisma.posTerminal.findMany({
      where: { companyId: scopedCompanyId },
      orderBy: [{ enabled: "desc" }, { name: "asc" }],
    });
  }

  async function assertOutletInCompany({ companyId, outletId }) {
    const outlet = await prisma.posOutlet.findFirst({
      where: { id: outletId, companyId },
    });
    if (!outlet) throw new PosServiceError("Sucursal POS no encontrada.", 404);
    return outlet;
  }

  async function createTerminal({ companyId, actorId, data }) {
    const scopedCompanyId = requireCompanyId(companyId);
    const clean = cleanData(data);
    await assertOutletInCompany({ companyId: scopedCompanyId, outletId: clean.outletId });
    const terminal = await prisma.posTerminal.create({
      data: {
        companyId: scopedCompanyId,
        ...clean,
      },
    });
    await writeAudit(prisma, {
      actorId,
      entityType: "PosTerminal",
      entityId: terminal.id,
      action: "pos.terminal.create",
      after: terminal,
    });
    return terminal;
  }

  async function updateTerminal({ companyId, id, actorId, data }) {
    const scopedCompanyId = requireCompanyId(companyId);
    const before = await prisma.posTerminal.findFirst({
      where: { id, companyId: scopedCompanyId },
    });
    if (!before) throw new PosServiceError("Terminal POS no encontrada.", 404);

    const clean = cleanData(data);
    if (clean.outletId) {
      await assertOutletInCompany({ companyId: scopedCompanyId, outletId: clean.outletId });
    }

    const updated = await prisma.posTerminal.update({
      where: { id },
      data: clean,
    });
    await writeAudit(prisma, {
      actorId,
      entityType: "PosTerminal",
      entityId: updated.id,
      action: "pos.terminal.update",
      before,
      after: updated,
    });
    return updated;
  }

  return {
    getSettings,
    updateSettings,
    listOutlets,
    createOutlet,
    updateOutlet,
    listTerminals,
    createTerminal,
    updateTerminal,
  };
}
