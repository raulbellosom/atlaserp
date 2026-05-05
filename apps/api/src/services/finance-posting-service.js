import { FinanceServiceError } from "./finance-service.js";

function buildEntryNumber(prefix = "DOC") {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hour = String(now.getHours()).padStart(2, "0");
  const minute = String(now.getMinutes()).padStart(2, "0");
  const second = String(now.getSeconds()).padStart(2, "0");
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${year}${month}${day}-${hour}${minute}${second}-${random}`;
}

function parseAmount(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new FinanceServiceError("Monto del documento invalido.", 400);
  }
  return Number(amount.toFixed(2));
}

function selectAccount(accounts, predicate, message) {
  const account = accounts.find(predicate);
  if (!account) {
    throw new FinanceServiceError(message, 400);
  }
  return account;
}

function normalize(text) {
  return String(text ?? "")
    .trim()
    .toLowerCase();
}

function pickAccountByType(accounts, type, keywordRegex = null) {
  const byType = accounts.filter((account) => account.type === type);
  if (!byType.length) return null;
  if (!keywordRegex) return byType[0];
  return (
    byType.find((account) => keywordRegex.test(normalize(account.name))) ??
    byType[0]
  );
}

function isUniqueViolation(error) {
  return error?.code === "P2002";
}

async function createAccountWithNextCode({
  tx,
  companyId,
  type,
  name,
  currency = "MXN",
  preferredCode,
}) {
  const baseCode = Number.parseInt(String(preferredCode), 10);
  if (!Number.isFinite(baseCode)) {
    throw new FinanceServiceError("Codigo base de cuenta invalido.", 500);
  }

  for (let offset = 0; offset < 500; offset += 1) {
    const code = String(baseCode + offset);
    try {
      return await tx.financeAccount.create({
        data: {
          companyId,
          code,
          name,
          type,
          currency,
          initialBalance: "0.00",
          enabled: true,
        },
      });
    } catch (error) {
      if (isUniqueViolation(error)) continue;
      throw error;
    }
  }

  throw new FinanceServiceError(
    `No se pudo asignar un codigo unico para la cuenta ${name}.`,
    500,
  );
}

async function ensureBootstrapPostingAccounts({ tx, companyId, currency }) {
  const current = await tx.financeAccount.findMany({
    where: { companyId, enabled: true },
    select: { id: true, code: true, name: true, type: true, enabled: true },
  });

  const hasActiveCash = current.some(
    (account) =>
      account.type === "ACTIVO" &&
      /caja|banco|bank|cash/.test(normalize(account.name)),
  );
  const hasActiveReceivable = current.some(
    (account) =>
      account.type === "ACTIVO" &&
      /cobrar|cliente|client|receivable/.test(normalize(account.name)),
  );
  const hasPayable = current.some((account) => account.type === "PASIVO");
  const hasIncome = current.some((account) => account.type === "INGRESO");
  const hasExpense = current.some(
    (account) => account.type === "EGRESO" || account.type === "COSTO",
  );

  if (!hasActiveCash) {
    await createAccountWithNextCode({
      tx,
      companyId,
      type: "ACTIVO",
      name: "Caja general",
      currency,
      preferredCode: 1100,
    });
  }
  if (!hasActiveReceivable) {
    await createAccountWithNextCode({
      tx,
      companyId,
      type: "ACTIVO",
      name: "Clientes por cobrar",
      currency,
      preferredCode: 1150,
    });
  }
  if (!hasPayable) {
    await createAccountWithNextCode({
      tx,
      companyId,
      type: "PASIVO",
      name: "Proveedores por pagar",
      currency,
      preferredCode: 2100,
    });
  }
  if (!hasIncome) {
    await createAccountWithNextCode({
      tx,
      companyId,
      type: "INGRESO",
      name: "Ingresos operativos",
      currency,
      preferredCode: 4100,
    });
  }
  if (!hasExpense) {
    await createAccountWithNextCode({
      tx,
      companyId,
      type: "EGRESO",
      name: "Gastos operativos",
      currency,
      preferredCode: 5100,
    });
  }
}

function resolvePostingAccounts({ accounts, direction, docType }) {
  const active = accounts.filter((account) => account.enabled);
  const cashAccount =
    pickAccountByType(active, "ACTIVO", /caja|banco|bank|cash/) ??
    pickAccountByType(active, "ACTIVO");
  const receivableAccount =
    pickAccountByType(active, "ACTIVO", /cobrar|cliente|client|receivable/) ??
    pickAccountByType(active, "ACTIVO");
  const payableAccount =
    pickAccountByType(active, "PASIVO", /pagar|proveedor|supplier|payable/) ??
    pickAccountByType(active, "PASIVO");
  const incomeAccount = pickAccountByType(active, "INGRESO");
  const expenseAccount =
    pickAccountByType(active, "EGRESO") ?? pickAccountByType(active, "COSTO");

  if (!cashAccount) {
    throw new FinanceServiceError(
      "Falta una cuenta ACTIVO para registrar documentos financieros.",
      400,
    );
  }
  if (!receivableAccount) {
    throw new FinanceServiceError(
      "Falta una cuenta ACTIVO para operar CxC (AR).",
      400,
    );
  }
  if (!payableAccount) {
    throw new FinanceServiceError(
      "Falta una cuenta PASIVO para operar CxP (AP).",
      400,
    );
  }
  if (!incomeAccount) {
    throw new FinanceServiceError(
      "Falta una cuenta de tipo INGRESO.",
      400,
    );
  }
  if (!expenseAccount) {
    throw new FinanceServiceError(
      "Falta una cuenta de tipo EGRESO o COSTO.",
      400,
    );
  }

  if (direction === "AR") {
    if (docType === "INVOICE" || docType === "DEBIT_NOTE") {
      return { debit: receivableAccount, credit: incomeAccount };
    }
    if (docType === "CREDIT_NOTE") {
      return { debit: incomeAccount, credit: receivableAccount };
    }
    if (docType === "PAYMENT" || docType === "ADVANCE") {
      return { debit: cashAccount, credit: receivableAccount };
    }
  }

  if (direction === "AP") {
    if (docType === "INVOICE" || docType === "DEBIT_NOTE") {
      return { debit: expenseAccount, credit: payableAccount };
    }
    if (docType === "CREDIT_NOTE") {
      return { debit: payableAccount, credit: expenseAccount };
    }
    if (docType === "PAYMENT" || docType === "ADVANCE") {
      return { debit: payableAccount, credit: cashAccount };
    }
  }

  throw new FinanceServiceError("Tipo de documento no soportado para posteo.", 400);
}

export function createFinancePostingService({ prisma }) {
  async function createIssuePosting({
    tx,
    companyId,
    document,
  }) {
    const amount = parseAmount(document.totalAmount);
    await ensureBootstrapPostingAccounts({
      tx,
      companyId,
      currency: document.currency || "MXN",
    });
    const accounts = await tx.financeAccount.findMany({
      where: { companyId, enabled: true },
      select: { id: true, code: true, name: true, type: true, enabled: true },
      orderBy: [{ code: "asc" }, { name: "asc" }],
    });

    const pair = resolvePostingAccounts({
      accounts,
      direction: document.direction,
      docType: document.docType,
    });

    const concept = `Documento ${document.docType} ${document.reference || document.id}`;
    const journalEntry = await tx.financeJournalEntry.create({
      data: {
        companyId,
        entryNumber: buildEntryNumber("DOC"),
        occurredAt: new Date(document.issueDate),
        concept,
        reference: document.reference ?? null,
        currency: document.currency,
        sourceType: "subledger",
        metadata: {
          source: "finance-document-issue",
          documentId: document.id,
          direction: document.direction,
          docType: document.docType,
        },
        lines: {
          create: [
            {
              accountId: pair.debit.id,
              debit: amount.toFixed(2),
              credit: "0.00",
              currency: document.currency,
              note: concept,
            },
            {
              accountId: pair.credit.id,
              debit: "0.00",
              credit: amount.toFixed(2),
              currency: document.currency,
              note: concept,
            },
          ],
        },
      },
      select: { id: true },
    });

    await tx.financeDocumentAccountingLink.create({
      data: {
        companyId,
        documentId: document.id,
        journalEntryId: journalEntry.id,
        eventType: "ISSUE",
        metadata: { auto: true },
      },
    });
  }

  async function linkApplyEvent({
    tx,
    companyId,
    sourceDocumentId,
    targetDocumentIds,
    metadata = null,
  }) {
    const allDocumentIds = [sourceDocumentId, ...targetDocumentIds];
    const issueLinks = await tx.financeDocumentAccountingLink.findMany({
      where: {
        companyId,
        documentId: { in: allDocumentIds },
        eventType: "ISSUE",
        enabled: true,
      },
      orderBy: { createdAt: "desc" },
      select: { documentId: true, journalEntryId: true },
    });

    const firstByDocument = new Map();
    for (const link of issueLinks) {
      if (!firstByDocument.has(link.documentId)) {
        firstByDocument.set(link.documentId, link.journalEntryId);
      }
    }

    for (const documentId of allDocumentIds) {
      const journalEntryId = firstByDocument.get(documentId);
      if (!journalEntryId) continue;
      await tx.financeDocumentAccountingLink.upsert({
        where: {
          documentId_journalEntryId_eventType: {
            documentId,
            journalEntryId,
            eventType: "APPLY",
          },
        },
        create: {
          companyId,
          documentId,
          journalEntryId,
          eventType: "APPLY",
          metadata: { auto: true, ...(metadata ?? {}) },
        },
        update: {
          enabled: true,
          metadata: { auto: true, ...(metadata ?? {}) },
        },
      });
    }
  }

  async function linkReverseEvent({
    tx,
    companyId,
    sourceDocumentId,
    targetDocumentIds,
    metadata = null,
  }) {
    const allDocumentIds = [sourceDocumentId, ...targetDocumentIds];
    const issueLinks = await tx.financeDocumentAccountingLink.findMany({
      where: {
        companyId,
        documentId: { in: allDocumentIds },
        eventType: "ISSUE",
        enabled: true,
      },
      orderBy: { createdAt: "desc" },
      select: { documentId: true, journalEntryId: true },
    });

    const firstByDocument = new Map();
    for (const link of issueLinks) {
      if (!firstByDocument.has(link.documentId)) {
        firstByDocument.set(link.documentId, link.journalEntryId);
      }
    }

    for (const documentId of allDocumentIds) {
      const journalEntryId = firstByDocument.get(documentId);
      if (!journalEntryId) continue;
      await tx.financeDocumentAccountingLink.upsert({
        where: {
          documentId_journalEntryId_eventType: {
            documentId,
            journalEntryId,
            eventType: "REVERSE",
          },
        },
        create: {
          companyId,
          documentId,
          journalEntryId,
          eventType: "REVERSE",
          metadata: { auto: true, ...(metadata ?? {}) },
        },
        update: {
          enabled: true,
          metadata: { auto: true, ...(metadata ?? {}) },
        },
      });
    }
  }

  return {
    createIssuePosting,
    linkApplyEvent,
    linkReverseEvent,
  };
}
