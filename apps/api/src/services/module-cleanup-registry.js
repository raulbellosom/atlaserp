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

// ── atlas.ledger cleanup ──────────────────────────────────────────────────────
// Owns: LedgerMovement (must be deleted first due to FK to LedgerAccount),
//       LedgerAccount.
// Shared (never purged): Company, AuditLog.

registerModuleHandler('atlas.ledger', {
  async count({ prisma, companyId }) {
    if (!companyId) throw new Error('atlas.ledger handler: companyId is required')
    const movements = await prisma.ledgerMovement.count({ where: { companyId } })
    const accounts = await prisma.ledgerAccount.count({ where: { companyId } })
    return [
      { entity: 'LedgerMovement', rows: movements, companyScoped: true },
      { entity: 'LedgerAccount', rows: accounts, companyScoped: true },
    ]
  },

  async purge({ tx, companyId }) {
    if (!companyId) throw new Error('atlas.ledger handler: companyId is required')
    const { count: movementsDeleted } = await tx.ledgerMovement.deleteMany({
      where: { companyId },
    })
    const { count: accountsDeleted } = await tx.ledgerAccount.deleteMany({
      where: { companyId },
    })
    return movementsDeleted + accountsDeleted
  },
})
