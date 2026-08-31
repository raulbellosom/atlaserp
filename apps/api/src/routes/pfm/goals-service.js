// apps/api/src/routes/pfm/goals-service.js
import { PfmServiceError, isTableNotFoundError, toPlainNumber } from "./service-helpers.js";

const NOT_INSTALLED = "El modulo de finanzas personales no esta instalado.";

function dayUTC(d) {
  return d ? new Date(`${String(d).slice(0, 10)}T00:00:00.000Z`) : null;
}

export function createGoalsService({ prisma }) {
  async function ownedGoal({ companyId, actorId, goalId }) {
    const g = await prisma.pfmGoal.findFirst({
      where: { id: goalId, companyId, ownerId: actorId, enabled: true },
    });
    if (!g) throw new PfmServiceError("Meta no encontrada.", 404);
    return g;
  }

  async function createGoal({ companyId, actorId, data }) {
    if (!actorId) throw new PfmServiceError("Se requiere un usuario autenticado.", 401);
    try {
      return await prisma.pfmGoal.create({
        data: {
          companyId,
          ownerId: actorId,
          name: data.name,
          targetAmount: data.targetAmount,
          targetDate: dayUTC(data.targetDate),
          walletId: data.walletId ?? null,
          color: data.color ?? null,
          currentAmount: 0,
        },
      });
    } catch (err) {
      if (isTableNotFoundError(err)) throw new PfmServiceError(NOT_INSTALLED, 503);
      throw err;
    }
  }

  async function listGoals({ companyId, actorId }) {
    if (!actorId) throw new PfmServiceError("Se requiere un usuario autenticado.", 401);
    try {
      const rows = await prisma.pfmGoal.findMany({
        where: { companyId, ownerId: actorId, enabled: true },
        orderBy: { createdAt: "asc" },
      });
      return {
        data: rows.map((g) => {
          const target = toPlainNumber(g.targetAmount);
          const current = toPlainNumber(g.currentAmount);
          return {
            id: g.id,
            name: g.name,
            targetAmount: target,
            currentAmount: current,
            targetDate: g.targetDate ? String(g.targetDate.toISOString?.() ?? g.targetDate).slice(0, 10) : null,
            walletId: g.walletId ?? null,
            color: g.color ?? null,
            pct: target > 0 ? Math.max(0, Math.min(1, current / target)) : 0,
          };
        }),
      };
    } catch (err) {
      if (isTableNotFoundError(err)) throw new PfmServiceError(NOT_INSTALLED, 503);
      throw err;
    }
  }

  async function updateGoal({ companyId, actorId, goalId, data }) {
    await ownedGoal({ companyId, actorId, goalId });
    const patch = {};
    if ("name" in data) patch.name = data.name;
    if ("targetAmount" in data) patch.targetAmount = data.targetAmount;
    if ("targetDate" in data) patch.targetDate = dayUTC(data.targetDate);
    if ("walletId" in data) patch.walletId = data.walletId ?? null;
    if ("color" in data) patch.color = data.color ?? null;
    return prisma.pfmGoal.update({ where: { id: goalId }, data: patch });
  }

  async function setGoalEnabled({ companyId, actorId, goalId, enabled }) {
    await ownedGoal({ companyId, actorId, goalId });
    await prisma.pfmGoal.update({ where: { id: goalId }, data: { enabled } });
    return { id: goalId, enabled };
  }

  async function contribute({ companyId, actorId, goalId, amount }) {
    const goal = await ownedGoal({ companyId, actorId, goalId });
    const next = Math.max(0, toPlainNumber(goal.currentAmount) + Number(amount));
    const updated = await prisma.pfmGoal.update({
      where: { id: goalId },
      data: { currentAmount: next },
    });
    return { id: goalId, currentAmount: toPlainNumber(updated.currentAmount) };
  }

  return { createGoal, listGoals, updateGoal, setGoalEnabled, contribute };
}
