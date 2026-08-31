// apps/api/src/routes/pfm/ledger-link-service.js
import { PfmServiceError, isTableNotFoundError, toPlainNumber } from "./service-helpers.js";

const NOT_INSTALLED = "El modulo de finanzas personales no esta instalado.";

// `ledgerService` is an instance of createLedgerService({ prisma }) from
// apps/api/src/routes/ledger/ledger-service.js — passed in by index.js so this
// module never imports ledger internals at load time.
export function createLedgerLinkService({ prisma, ledgerService }) {
  async function assertLedgerAccess({ companyId, ledgerAccountId, actorId }) {
    if (!actorId) throw new PfmServiceError("Se requiere un usuario autenticado.", 401);
    let allowed = false;
    try {
      allowed = await ledgerService.canReadAccount({
        companyId,
        accountId: ledgerAccountId,
        actorId,
      });
    } catch {
      allowed = false;
    }
    if (!allowed) throw new PfmServiceError("No tienes acceso a la cuenta bancaria enlazada.", 403);
  }

  async function getLinkedMovements({ companyId, actorId, walletId, ledgerAccountId, query }) {
    await assertLedgerAccess({ companyId, ledgerAccountId, actorId });
    const limit = Math.min(200, Math.max(1, Number(query?.limit) || 100));
    const monthStart = query?.month ? `${query.month}-01` : null;
    try {
      const rows = await prisma.$queryRaw`
        SELECT t.id, t.fecha, t.nombre, t.deposito, t.retiro,
               e.category_id AS enr_category_id,
               e.receipt_id  AS enr_receipt_id,
               e.note        AS enr_note
        FROM ledger_transaction t
        LEFT JOIN pfm_ledger_enrichment e ON e.ledger_transaction_id = t.id
        WHERE t.account_id = ${ledgerAccountId}::uuid
          AND t.enabled = true
          AND (${monthStart}::date IS NULL OR (t.fecha >= ${monthStart}::date
               AND t.fecha < (${monthStart}::date + INTERVAL '1 month')))
        ORDER BY t.fecha DESC, t.created_at DESC
        LIMIT ${limit}
      `;
      return { data: rows.map((r) => normalizeLedgerRow(r, walletId)) };
    } catch (err) {
      if (isTableNotFoundError(err)) throw new PfmServiceError(NOT_INSTALLED, 503);
      throw err;
    }
  }

  async function enrichLedgerMovement({
    companyId,
    actorId,
    walletId,
    ledgerAccountId,
    ledgerTransactionId,
    data,
  }) {
    if (ledgerAccountId) await assertLedgerAccess({ companyId, ledgerAccountId, actorId });
    const base = {
      companyId,
      ownerId: actorId,
      walletId,
      ledgerTransactionId,
      categoryId: data.categoryId ?? null,
      receiptId: data.receiptId ?? null,
      note: data.note ?? null,
    };
    const update = {};
    if ("categoryId" in data) update.categoryId = data.categoryId ?? null;
    if ("receiptId" in data) update.receiptId = data.receiptId ?? null;
    if ("note" in data) update.note = data.note ?? null;
    const row = await prisma.pfmLedgerEnrichment.upsert({
      where: { ledgerTransactionId },
      update,
      create: base,
    });
    return row;
  }

  async function removeEnrichmentsForWallet({ walletId }) {
    await prisma.pfmLedgerEnrichment.deleteMany({ where: { walletId } });
    return { walletId, cleared: true };
  }

  return { getLinkedMovements, enrichLedgerMovement, removeEnrichmentsForWallet };
}

function normalizeLedgerRow(r, walletId) {
  const deposito = toPlainNumber(r.deposito, 0);
  const retiro = toPlainNumber(r.retiro, 0);
  const isIncome = deposito >= retiro && deposito > 0;
  const fecha = r.fecha;
  return {
    id: r.id,
    source: "ledger",
    walletId,
    direction: isIncome ? "INCOME" : "EXPENSE",
    amount: isIncome ? deposito : retiro,
    occurredOn:
      fecha instanceof Date ? fecha.toISOString().slice(0, 10) : String(fecha).slice(0, 10),
    merchant: r.nombre ?? null,
    note: r.enr_note ?? null,
    categoryId: r.enr_category_id ?? null,
    receiptId: r.enr_receipt_id ?? null,
    status: "POSTED",
    editableInPfm: false,
  };
}
