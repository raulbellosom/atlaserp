export class PosServiceError extends Error {
  constructor(message, status = 500) {
    super(message);
    this.name = "PosServiceError";
    this.status = status;
  }
}

export function requireCompanyId(companyId) {
  if (!companyId) throw new PosServiceError("Empresa requerida.", 403);
  return companyId;
}

export function toMoney(value) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

export function assertEditableOrder(order) {
  if (!order) throw new PosServiceError("Orden no encontrada.", 404);
  if (["PAID", "CANCELLED", "REFUNDED"].includes(order.status)) {
    throw new PosServiceError("La orden ya no se puede editar.", 409);
  }
}

// Reads the tenant middleware's already-validated active company
// (c.set("companyId", ...) in requirePermission/requireAnyPermission, see
// docs/superpowers/specs/2026-09-10-multi-tenant-architecture-design.md §5).
// The memberships[0]-style fallbacks this used to have were already dead in
// practice (c.get("companyId") is always set by the time a route handler
// runs) and are removed rather than kept as a false safety net.
export function getCompanyId(c) {
  return c.get("companyId") ?? null;
}

export function getActorId(c) {
  return c.get("userId") ?? c.get("userContext")?.profile?.id ?? null;
}

export async function writeAudit(
  prisma,
  { actorId, entityType, entityId, action, before = null, after = null, metadata = null },
) {
  await prisma.auditLog.create({
    data: {
      actorId: actorId ?? null,
      moduleKey: "atlas.pos",
      entityType,
      entityId,
      action,
      before,
      after,
      metadata,
    },
  });
}
