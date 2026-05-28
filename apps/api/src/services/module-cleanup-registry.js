/**
 * Module cleanup registry.
 *
 * Each entry maps a module key to { count, purge } handlers.
 *
 * count({ prisma, companyId }) -> [{ entity, rows }]
 *   Returns row counts for dry-run reporting. Receives the real prisma client (not tx).
 *
 * purge({ tx, companyId }) -> number
 *   Deletes owned operational rows inside a transaction. Returns total rows deleted.
 *   Must respect FK order (children before parents).
 *   Must NEVER delete from shared entities (Company, UserProfile, AuditLog, etc.).
 */

const handlers = new Map()

export function registerModuleHandler(moduleKey, { count, purge }) {
  if (!moduleKey || typeof moduleKey !== 'string' || typeof count !== 'function' || typeof purge !== 'function') {
    throw new Error(`registerModuleHandler: invalid handler for ${moduleKey}`)
  }
  handlers.set(moduleKey, { count, purge })
}

export function getModuleHandler(moduleKey) {
  return handlers.get(moduleKey) ?? null
}

export function listRegisteredHandlers() {
  return [...handlers.keys()]
}

// atlas.contacts cleanup
registerModuleHandler('atlas.contacts', {
  async count({ prisma, companyId }) {
    if (!companyId) throw new Error('atlas.contacts handler: companyId is required')
    const contacts = await prisma.contact.count({ where: { companyId } })
    return [{ entity: 'Contact', rows: contacts, companyScoped: true }]
  },

  async purge({ tx, companyId }) {
    if (!companyId) throw new Error('atlas.contacts handler: companyId is required')
    const { count: contactsDeleted } = await tx.contact.deleteMany({ where: { companyId } })
    return contactsDeleted
  },
})

// atlas.hr cleanup
registerModuleHandler('atlas.hr', {
  async count({ prisma, companyId }) {
    if (!companyId) throw new Error('atlas.hr handler: companyId is required')
    const employees = await prisma.hrEmployee.count({ where: { companyId } })
    const departments = await prisma.hrDepartment.count({ where: { companyId } })
    const jobTitles = await prisma.hrJobTitle.count({ where: { companyId } })
    return [
      { entity: 'HrEmployee', rows: employees, companyScoped: true },
      { entity: 'HrDepartment', rows: departments, companyScoped: true },
      { entity: 'HrJobTitle', rows: jobTitles, companyScoped: true },
    ]
  },

  async purge({ tx, companyId }) {
    if (!companyId) throw new Error('atlas.hr handler: companyId is required')
    const { count: employeesDeleted } = await tx.hrEmployee.deleteMany({ where: { companyId } })
    const { count: departmentsDeleted } = await tx.hrDepartment.deleteMany({ where: { companyId } })
    const { count: jobTitlesDeleted } = await tx.hrJobTitle.deleteMany({ where: { companyId } })
    return employeesDeleted + departmentsDeleted + jobTitlesDeleted
  },
})
