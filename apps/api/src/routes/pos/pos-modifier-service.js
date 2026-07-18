import { PosServiceError, requireCompanyId, writeAudit } from "./service-helpers.js";

export function createPosModifierService({ prisma }) {
  async function listForProduct({ companyId, productId, includeDisabled = false }) {
    const scopedCompanyId = requireCompanyId(companyId);
    const groups = await prisma.posModifierGroup.findMany({
      where: {
        companyId: scopedCompanyId,
        productId,
        ...(includeDisabled ? {} : { enabled: true }),
      },
      orderBy: { position: "asc" },
    });
    const result = [];
    for (const group of groups) {
      const options = await prisma.posModifierOption.findMany({
        where: { groupId: group.id, ...(includeDisabled ? {} : { enabled: true }) },
        orderBy: { position: "asc" },
      });
      result.push({ ...group, options });
    }
    return result;
  }

  async function listByProducts({ companyId, productIds }) {
    const scopedCompanyId = requireCompanyId(companyId);
    const map = {};
    for (const productId of productIds) {
      const groups = await listForProduct({ companyId: scopedCompanyId, productId });
      if (groups.length > 0) map[productId] = groups;
    }
    return map;
  }

  async function createGroup({ companyId, actorId, productId, data }) {
    const scopedCompanyId = requireCompanyId(companyId);
    const duplicate = await prisma.posModifierGroup.findFirst({
      where: { companyId: scopedCompanyId, productId, name: data.name },
    });
    if (duplicate) throw new PosServiceError("Ya existe un grupo con ese nombre para el producto.", 409);
    const group = await prisma.posModifierGroup.create({
      data: {
        companyId: scopedCompanyId,
        productId,
        name: data.name,
        minSelect: data.minSelect ?? 0,
        maxSelect: data.maxSelect ?? 1,
        required: data.required ?? false,
        position: data.position ?? 0,
      },
    });
    await writeAudit(prisma, {
      actorId, entityType: "PosModifierGroup", entityId: group.id,
      action: "pos.modifierGroup.create", after: group,
    });
    return group;
  }

  async function updateGroup({ companyId, actorId, id, data }) {
    const scopedCompanyId = requireCompanyId(companyId);
    const before = await prisma.posModifierGroup.findFirst({ where: { id, companyId: scopedCompanyId } });
    if (!before) throw new PosServiceError("Grupo de modificadores no encontrado.", 404);
    const group = await prisma.posModifierGroup.update({ where: { id }, data });
    await writeAudit(prisma, {
      actorId, entityType: "PosModifierGroup", entityId: id,
      action: "pos.modifierGroup.update", before, after: group,
    });
    return group;
  }

  async function createOption({ companyId, actorId, groupId, data }) {
    const scopedCompanyId = requireCompanyId(companyId);
    const group = await prisma.posModifierGroup.findFirst({ where: { id: groupId, companyId: scopedCompanyId } });
    if (!group) throw new PosServiceError("Grupo de modificadores no encontrado.", 404);
    const option = await prisma.posModifierOption.create({
      data: {
        companyId: scopedCompanyId,
        groupId,
        name: data.name,
        priceDelta: data.priceDelta ?? 0,
        position: data.position ?? 0,
      },
    });
    await writeAudit(prisma, {
      actorId, entityType: "PosModifierOption", entityId: option.id,
      action: "pos.modifierOption.create", after: option,
    });
    return option;
  }

  async function updateOption({ companyId, actorId, id, data }) {
    const scopedCompanyId = requireCompanyId(companyId);
    const before = await prisma.posModifierOption.findFirst({ where: { id, companyId: scopedCompanyId } });
    if (!before) throw new PosServiceError("Opción de modificador no encontrada.", 404);
    const option = await prisma.posModifierOption.update({ where: { id }, data });
    await writeAudit(prisma, {
      actorId, entityType: "PosModifierOption", entityId: id,
      action: "pos.modifierOption.update", before, after: option,
    });
    return option;
  }

  // Validates a selection for a product; returns price delta + immutable snapshots.
  async function resolveSelection({ companyId, productId, optionIds = [] }) {
    const scopedCompanyId = requireCompanyId(companyId);
    const groups = await listForProduct({ companyId: scopedCompanyId, productId });
    if (groups.length === 0) {
      if (optionIds.length > 0) throw new PosServiceError("Opción de modificador no encontrada.", 404);
      return { totalDelta: 0, snapshots: [] };
    }
    const optionIndex = new Map();
    for (const group of groups) {
      for (const option of group.options) optionIndex.set(option.id, { group, option });
    }
    const perGroupCount = new Map();
    const snapshots = [];
    let totalDelta = 0;
    for (const optionId of optionIds) {
      const hit = optionIndex.get(optionId);
      if (!hit) throw new PosServiceError("Opción de modificador no encontrada.", 404);
      perGroupCount.set(hit.group.id, (perGroupCount.get(hit.group.id) ?? 0) + 1);
      totalDelta += Number(hit.option.priceDelta ?? 0);
      snapshots.push({
        optionId,
        groupName: hit.group.name,
        optionName: hit.option.name,
        priceDelta: Number(hit.option.priceDelta ?? 0),
      });
    }
    for (const group of groups) {
      const count = perGroupCount.get(group.id) ?? 0;
      const hasEnabledOptions = group.options.length > 0;
      const min = group.required ? Math.max(1, group.minSelect) : group.minSelect;
      if (group.required && count < min && hasEnabledOptions) {
        throw new PosServiceError(`Faltan modificadores requeridos: ${group.name}.`, 400);
      }
      if (count > 0 && (count < group.minSelect || count > group.maxSelect)) {
        throw new PosServiceError(
          `Selección inválida en ${group.name} (mín ${group.minSelect}, máx ${group.maxSelect}).`, 400,
        );
      }
    }
    return { totalDelta, snapshots };
  }

  return { listForProduct, listByProducts, createGroup, updateGroup, createOption, updateOption, resolveSelection };
}
