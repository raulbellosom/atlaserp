// Per-company module enablement. AtlasModule stays the instance-wide "is this
// module installed on this deployment" catalog; CompanyModule adds the
// missing per-tenant dimension: a company only sees a module in
// /runtime/modules and /blueprints when it's both globally INSTALLED and
// (enabled here OR has no CompanyModule row at all -- absence defaults to
// enabled, matching the backfill migration's intent that nothing regresses
// for companies/modules that existed before this feature).
// Spec: docs/superpowers/specs/2026-09-10-multi-tenant-architecture-design.md §9.4

export function createCompanyModuleService({ prisma }) {
  async function listEnabledModuleIds(companyId) {
    const rows = await prisma.companyModule.findMany({
      where: { companyId, enabled: true },
      select: { moduleId: true },
    })
    return new Set(rows.map((r) => r.moduleId))
  }

  async function listDisabledModuleIds(companyId) {
    const rows = await prisma.companyModule.findMany({
      where: { companyId, enabled: false },
      select: { moduleId: true },
    })
    return new Set(rows.map((r) => r.moduleId))
  }

  async function isModuleEnabledForCompany({ companyId, moduleId }) {
    const disabled = await listDisabledModuleIds(companyId)
    return !disabled.has(moduleId)
  }

  async function setEnabled({ companyId, moduleId, enabled }) {
    return prisma.companyModule.upsert({
      where: { companyId_moduleId: { companyId, moduleId } },
      update: { enabled },
      create: { companyId, moduleId, enabled },
    })
  }

  async function listForCompany(companyId) {
    return prisma.companyModule.findMany({ where: { companyId } })
  }

  return { listEnabledModuleIds, listDisabledModuleIds, isModuleEnabledForCompany, setEnabled, listForCompany }
}
