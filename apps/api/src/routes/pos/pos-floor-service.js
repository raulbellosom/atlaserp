import { PosServiceError, requireCompanyId, writeAudit } from "./service-helpers.js";

function cleanData(data = {}) {
  return Object.fromEntries(
    Object.entries(data)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [
        key,
        typeof value === "string" ? value.trim() || null : value,
      ]),
  );
}

export function createPosFloorService({ prisma }) {
  async function listFloors({ companyId, outletId }) {
    const scopedCompanyId = requireCompanyId(companyId);
    return prisma.posFloor.findMany({
      where: { companyId: scopedCompanyId, ...(outletId ? { outletId } : {}) },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    });
  }

  async function createFloor({ companyId, actorId, data }) {
    const scopedCompanyId = requireCompanyId(companyId);
    const floor = await prisma.posFloor.create({
      data: {
        companyId: scopedCompanyId,
        ...cleanData(data),
      },
    });
    await writeAudit(prisma, {
      actorId,
      entityType: "PosFloor",
      entityId: floor.id,
      action: "pos.floor.create",
      after: floor,
    });
    return floor;
  }

  async function getFloorById({ companyId, id }) {
    const scopedCompanyId = requireCompanyId(companyId);
    const floor = await prisma.posFloor.findFirst({ where: { id, companyId: scopedCompanyId } });
    if (!floor) throw new PosServiceError("Plano POS no encontrado.", 404);
    return floor;
  }

  async function updateFloor({ companyId, id, actorId, data }) {
    const before = await getFloorById({ companyId, id });
    const updated = await prisma.posFloor.update({
      where: { id },
      data: cleanData(data),
    });
    await writeAudit(prisma, {
      actorId,
      entityType: "PosFloor",
      entityId: id,
      action: "pos.floor.update",
      before,
      after: updated,
    });
    return updated;
  }

  async function publishFloor({ companyId, id, actorId }) {
    const scopedCompanyId = requireCompanyId(companyId);
    const floor = await getFloorById({ companyId: scopedCompanyId, id });
    return prisma.$transaction(async (tx) => {
      await tx.posFloor.updateMany({
        where: {
          companyId: scopedCompanyId,
          outletId: floor.outletId,
          id: { not: id },
        },
        data: { isActive: false },
      });
      const updated = await tx.posFloor.update({
        where: { id },
        data: { isActive: true },
      });
      await writeAudit(tx, {
        actorId,
        entityType: "PosFloor",
        entityId: id,
        action: "pos.floor.publish",
        before: floor,
        after: updated,
      });
      return updated;
    });
  }

  async function createTable({ companyId, actorId, data }) {
    const scopedCompanyId = requireCompanyId(companyId);
    const floor = await getFloorById({ companyId: scopedCompanyId, id: data.floorId });
    const table = await prisma.posTable.create({
      data: {
        companyId: scopedCompanyId,
        floorId: floor.id,
        zoneId: data.zoneId ?? null,
        name: data.name.trim(),
        capacity: Number(data.capacity ?? 2),
      },
    });
    await writeAudit(prisma, {
      actorId,
      entityType: "PosTable",
      entityId: table.id,
      action: "pos.table.create",
      after: table,
    });
    return table;
  }

  async function getTableInCompany({ companyId, tableId }) {
    const table = await prisma.posTable.findFirst({ where: { id: tableId, companyId } });
    if (!table) throw new PosServiceError("Mesa POS no encontrada.", 404);
    return table;
  }

  async function updateTable({ companyId, tableId, actorId, data }) {
    const scopedCompanyId = requireCompanyId(companyId);
    const before = await getTableInCompany({ companyId: scopedCompanyId, tableId });
    if (data.floorId) await getFloorById({ companyId: scopedCompanyId, id: data.floorId });
    const updated = await prisma.posTable.update({
      where: { id: tableId },
      data: cleanData(data),
    });
    await writeAudit(prisma, {
      actorId,
      entityType: "PosTable",
      entityId: tableId,
      action: "pos.table.update",
      before,
      after: updated,
    });
    return updated;
  }

  async function updateTableStatus({ companyId, tableId, actorId, status }) {
    const scopedCompanyId = requireCompanyId(companyId);
    const before = await getTableInCompany({ companyId: scopedCompanyId, tableId });
    const updated = await prisma.posTable.update({
      where: { id: tableId },
      data: { status },
    });
    await writeAudit(prisma, {
      actorId,
      entityType: "PosTable",
      entityId: tableId,
      action: "pos.table.status.update",
      before,
      after: updated,
    });
    return updated;
  }

  async function getActiveMap({ companyId, outletId }) {
    const scopedCompanyId = requireCompanyId(companyId);
    const floor = await prisma.posFloor.findFirst({
      where: { companyId: scopedCompanyId, outletId, isActive: true },
    });
    if (!floor) return null;
    const [zones, elements, tables] = await Promise.all([
      prisma.posFloorZone.findMany({ where: { floorId: floor.id }, orderBy: { position: "asc" } }),
      prisma.posFloorElement.findMany({ where: { floorId: floor.id } }),
      prisma.posTable.findMany({ where: { floorId: floor.id } }),
    ]);
    return { ...floor, zones, elements, tables };
  }

  return {
    listFloors,
    createFloor,
    getFloorById,
    updateFloor,
    publishFloor,
    createTable,
    updateTable,
    updateTableStatus,
    getActiveMap,
  };
}
