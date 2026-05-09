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

// ── atlas.contacts cleanup ────────────────────────────────────────────────────
// Owns: Contact.
// Shared (never purged): Company, AuditLog.
// FK note: FinanceJournalLine.contactId and FinanceDocument.contactId are SetNull,
//          so deleting Contact just nullifies those references.

registerModuleHandler('atlas.contacts', {
  async count({ prisma, companyId }) {
    if (!companyId) throw new Error('atlas.contacts handler: companyId is required')
    const contacts = await prisma.contact.count({ where: { companyId } })
    return [
      { entity: 'Contact', rows: contacts, companyScoped: true },
    ]
  },

  async purge({ tx, companyId }) {
    if (!companyId) throw new Error('atlas.contacts handler: companyId is required')
    const { count: contactsDeleted } = await tx.contact.deleteMany({ where: { companyId } })
    return contactsDeleted
  },
})

// ── atlas.hr cleanup ──────────────────────────────────────────────────────────
// Owns: HrEmployee, HrDepartment, HrJobTitle.
// Shared (never purged): Company, UserProfile, FileAsset, AuditLog.
// FK note: All inter-HR relations (supervisor, departmentRef, jobTitleRef) are SetNull,
//          so employees can be deleted in any order relative to department/jobTitle.

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

// ── atlas.finance cleanup ─────────────────────────────────────────────────────
// Owns: FinanceDocumentApplication, FinanceDocumentTaxLine, FinanceDocumentAccountingLink,
//       FinanceJournalLine, FinanceDocument, FinanceJournalEntry, FinanceFxRate,
//       FinanceTaxRate, FinanceAccount.
// Shared (never purged): Company, Contact, AuditLog.
// FK order (children before parents):
//   1. FinanceDocumentApplication  (→ FinanceDocument x2, Cascade)
//   2. FinanceDocumentTaxLine      (→ FinanceDocument, Cascade; → FinanceTaxRate, SetNull)
//   3. FinanceDocumentAccountingLink (→ FinanceDocument, Cascade; → FinanceJournalEntry, Cascade)
//   4. FinanceJournalLine          (→ FinanceJournalEntry, Cascade; → FinanceAccount, RESTRICT)
//   5. FinanceDocument             (leaf — applications/taxLines/links already deleted)
//   6. FinanceJournalEntry         (leaf — lines/links already deleted)
//   7. FinanceFxRate               (leaf)
//   8. FinanceTaxRate              (leaf)
//   9. FinanceAccount              (self-ref parentAccountId → SetNull, safe to delete all)

registerModuleHandler('atlas.finance', {
  async count({ prisma, companyId }) {
    if (!companyId) throw new Error('atlas.finance handler: companyId is required')
    const [applications, taxLines, accountingLinks, journalLines, documents, entries, fxRates, taxRates, accounts] =
      await Promise.all([
        prisma.financeDocumentApplication.count({ where: { companyId } }),
        prisma.financeDocumentTaxLine.count({ where: { companyId } }),
        prisma.financeDocumentAccountingLink.count({ where: { companyId } }),
        prisma.financeJournalLine.count({ where: { entry: { companyId } } }),
        prisma.financeDocument.count({ where: { companyId } }),
        prisma.financeJournalEntry.count({ where: { companyId } }),
        prisma.financeFxRate.count({ where: { companyId } }),
        prisma.financeTaxRate.count({ where: { companyId } }),
        prisma.financeAccount.count({ where: { companyId } }),
      ])
    return [
      { entity: 'FinanceDocumentApplication', rows: applications, companyScoped: true },
      { entity: 'FinanceDocumentTaxLine', rows: taxLines, companyScoped: true },
      { entity: 'FinanceDocumentAccountingLink', rows: accountingLinks, companyScoped: true },
      { entity: 'FinanceJournalLine', rows: journalLines, companyScoped: true },
      { entity: 'FinanceDocument', rows: documents, companyScoped: true },
      { entity: 'FinanceJournalEntry', rows: entries, companyScoped: true },
      { entity: 'FinanceFxRate', rows: fxRates, companyScoped: true },
      { entity: 'FinanceTaxRate', rows: taxRates, companyScoped: true },
      { entity: 'FinanceAccount', rows: accounts, companyScoped: true },
    ]
  },

  async purge({ tx, companyId }) {
    if (!companyId) throw new Error('atlas.finance handler: companyId is required')
    const { count: applications } = await tx.financeDocumentApplication.deleteMany({ where: { companyId } })
    const { count: taxLines } = await tx.financeDocumentTaxLine.deleteMany({ where: { companyId } })
    const { count: accountingLinks } = await tx.financeDocumentAccountingLink.deleteMany({ where: { companyId } })
    const { count: journalLines } = await tx.financeJournalLine.deleteMany({ where: { entry: { companyId } } })
    const { count: documents } = await tx.financeDocument.deleteMany({ where: { companyId } })
    const { count: entries } = await tx.financeJournalEntry.deleteMany({ where: { companyId } })
    const { count: fxRates } = await tx.financeFxRate.deleteMany({ where: { companyId } })
    const { count: taxRates } = await tx.financeTaxRate.deleteMany({ where: { companyId } })
    const { count: accounts } = await tx.financeAccount.deleteMany({ where: { companyId } })
    return applications + taxLines + accountingLinks + journalLines + documents + entries + fxRates + taxRates + accounts
  },
})

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
