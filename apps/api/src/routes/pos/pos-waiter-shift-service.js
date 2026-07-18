import { PosServiceError, requireCompanyId, writeAudit, toMoney } from "./service-helpers.js";

export function createPosWaiterShiftService({ prisma }) {
  async function getCurrentShift({ companyId, outletId, waiterId }) {
    const scopedCompanyId = requireCompanyId(companyId);
    return prisma.posWaiterShift.findFirst({
      where: { companyId: scopedCompanyId, outletId, waiterId, status: "OPEN" },
    });
  }

  async function ensureOpenShift({ companyId, outletId, waiterId }) {
    const scopedCompanyId = requireCompanyId(companyId);
    const outlet = await prisma.posOutlet.findFirst({ where: { id: outletId, companyId: scopedCompanyId } });
    if (!outlet) throw new PosServiceError("Sucursal POS no encontrada.", 404);
    if (!outlet.allowTableCharge) {
      throw new PosServiceError("El cobro en mesa no esta habilitado en esta sucursal.", 409);
    }
    const existing = await getCurrentShift({ companyId: scopedCompanyId, outletId, waiterId });
    if (existing) return existing;
    return prisma.posWaiterShift.create({
      data: { companyId: scopedCompanyId, outletId, waiterId },
    });
  }

  async function registerCharge({ companyId, shiftId, amount, isCash }) {
    const scopedCompanyId = requireCompanyId(companyId);
    const shift = await prisma.posWaiterShift.findFirst({
      where: { id: shiftId, companyId: scopedCompanyId, status: "OPEN" },
    });
    if (!shift) throw new PosServiceError("Corte de mesero no encontrado o cerrado.", 404);
    if (!isCash) return shift;
    return prisma.posWaiterShift.update({
      where: { id: shiftId },
      data: { expectedCashAmount: toMoney(Number(shift.expectedCashAmount ?? 0) + Number(amount)) },
    });
  }

  async function closeShift({ companyId, actorId, id, data }) {
    const scopedCompanyId = requireCompanyId(companyId);
    const shift = await prisma.posWaiterShift.findFirst({ where: { id, companyId: scopedCompanyId } });
    if (!shift) throw new PosServiceError("Corte de mesero no encontrado.", 404);
    if (shift.status === "CLOSED") throw new PosServiceError("El corte ya fue cerrado.", 409);
    const session = await prisma.posSession.findFirst({
      where: { id: data.sessionId, companyId: scopedCompanyId, status: "OPEN" },
    });
    if (!session) throw new PosServiceError("Sesion de caja no encontrada o cerrada.", 404);
    const deliveredAmount = toMoney(data.deliveredAmount);
    const closed = await prisma.posWaiterShift.update({
      where: { id },
      data: {
        status: "CLOSED",
        deliveredAmount,
        deliveredToSessionId: session.id,
        closedAt: new Date(),
        notes: data.notes ?? shift.notes ?? null,
      },
    });
    await prisma.posCashMovement.create({
      data: {
        companyId: scopedCompanyId,
        sessionId: session.id,
        kind: "WAITER_DELIVERY",
        amount: deliveredAmount,
        reason: `Entrega de corte de mesero ${shift.waiterId}`,
        createdById: actorId,
      },
    });
    await writeAudit(prisma, {
      actorId,
      entityType: "PosWaiterShift",
      entityId: id,
      action: "pos.waiterShift.close",
      before: shift,
      after: closed,
    });
    return closed;
  }

  async function listShifts({ companyId, outletId, status }) {
    const scopedCompanyId = requireCompanyId(companyId);
    return prisma.posWaiterShift.findMany({
      where: {
        companyId: scopedCompanyId,
        ...(outletId ? { outletId } : {}),
        ...(status ? { status } : {}),
      },
      orderBy: { openedAt: "desc" },
    });
  }

  return { getCurrentShift, ensureOpenShift, registerCharge, closeShift, listShifts };
}
