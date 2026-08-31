// apps/api/src/routes/pfm/categories-service.js
import { PfmServiceError, isTableNotFoundError } from "./service-helpers.js";

const NOT_INSTALLED = "El modulo de finanzas personales no esta instalado.";
const MASK_NAME = "Personal";
const MASK_COLOR = "#9ca3af";

export function createCategoriesService({ prisma }) {
  async function listCategories({ companyId, actorId, kind, includeShared = false }) {
    if (!actorId) throw new PfmServiceError("Se requiere un usuario autenticado.", 401);
    try {
      const where = {
        companyId,
        enabled: true,
        ...(kind ? { kind } : {}),
        OR: [
          { ownerId: null },
          { ownerId: actorId },
          ...(includeShared ? [{ NOT: { ownerId: null } }] : []),
        ],
      };
      const rows = await prisma.pfmCategory.findMany({
        where,
        orderBy: [{ ownerId: "asc" }, { name: "asc" }],
      });
      const data = rows.map((row) => {
        const foreignPersonal = row.ownerId && row.ownerId !== actorId;
        return {
          id: row.id,
          name: foreignPersonal ? MASK_NAME : row.name,
          kind: row.kind,
          color: foreignPersonal ? MASK_COLOR : row.color ?? null,
          icon: foreignPersonal ? null : row.icon ?? null,
          parentId: row.parentId ?? null,
          isSystem: row.ownerId === null,
          isMine: row.ownerId === actorId,
        };
      });
      return { data };
    } catch (err) {
      if (isTableNotFoundError(err)) throw new PfmServiceError(NOT_INSTALLED, 503);
      throw err;
    }
  }

  async function createCategory({ companyId, actorId, data }) {
    if (!actorId) throw new PfmServiceError("Se requiere un usuario autenticado.", 401);
    const created = await prisma.pfmCategory.create({
      data: {
        companyId,
        ownerId: actorId,
        name: data.name,
        kind: data.kind,
        color: data.color ?? null,
        icon: data.icon ?? null,
        parentId: data.parentId ?? null,
      },
    });
    return created;
  }

  async function updateCategory({ companyId, actorId, categoryId, data }) {
    const owned = await prisma.pfmCategory.findFirst({
      where: { id: categoryId, companyId, ownerId: actorId },
      select: { id: true },
    });
    if (!owned) throw new PfmServiceError("Solo puedes editar tus categorias personales.", 403);
    const patch = {};
    for (const key of ["name", "kind", "color", "icon", "parentId"]) {
      if (Object.prototype.hasOwnProperty.call(data, key)) patch[key] = data[key];
    }
    return prisma.pfmCategory.update({ where: { id: categoryId }, data: patch });
  }

  async function setCategoryEnabled({ companyId, actorId, categoryId, enabled }) {
    const owned = await prisma.pfmCategory.findFirst({
      where: { id: categoryId, companyId, ownerId: actorId },
      select: { id: true },
    });
    if (!owned) throw new PfmServiceError("Solo puedes desactivar tus categorias personales.", 403);
    await prisma.pfmCategory.update({ where: { id: categoryId }, data: { enabled } });
    return { id: categoryId, enabled };
  }

  return { listCategories, createCategory, updateCategory, setCategoryEnabled };
}
