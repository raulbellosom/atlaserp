import {
  financeAgingQuerySchema,
  financeApplicationApplySchema,
  financeApplicationListQuerySchema,
  financeApplicationPreviewSchema,
  financeDocumentCreateSchema,
  financeDocumentEnabledSchema,
  financeDocumentListQuerySchema,
  financeDocumentUpdateSchema,
} from "@atlas/validators";
import { buildFifoProposal } from "./finance-application-engine.js";
import { createFinancePostingService } from "./finance-posting-service.js";
import { createFinanceAgingService } from "./finance-aging-service.js";
import { FinanceServiceError } from "./finance-service.js";

function normalizeLimit(limit, fallback = 50, max = 200) {
  const parsed = Number.parseInt(String(limit ?? fallback), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

function parseDateLike(value, fallback = null) {
  if (!value) return fallback;
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(String(value))
    ? `${value}T00:00:00.000Z`
    : value;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    throw new FinanceServiceError("Fecha invalida en documento.", 400);
  }
  return date;
}

function parseDateBound(value, { endOfDay = false } = {}) {
  if (!value) return null;
  const source = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(source)) {
    if (endOfDay) return new Date(`${source}T23:59:59.999Z`);
    return new Date(`${source}T00:00:00.000Z`);
  }
  const date = new Date(source);
  if (Number.isNaN(date.getTime())) {
    throw new FinanceServiceError("Rango de fechas invalido.", 400);
  }
  return date;
}

function amountToNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new FinanceServiceError("Monto invalido.", 400);
  }
  return Number(number.toFixed(2));
}

function resolveStatus(totalAmount, openAmount) {
  const total = amountToNumber(totalAmount);
  const open = amountToNumber(openAmount);
  if (open <= 0) return "PAID";
  if (open >= total) return "OPEN";
  return "PARTIAL";
}

function rounded(value) {
  return Number(Number(value).toFixed(2));
}

function roundTaxRate(value) {
  return Number(Number(value).toFixed(6));
}

function cents(value, label = "Monto") {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new FinanceServiceError(`${label} invalido.`, 400);
  }
  return Math.round(parsed * 100);
}

function money(centsValue) {
  return Number((centsValue / 100).toFixed(2));
}

function dateToIsoDay(date) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function documentWhereSearch(query) {
  const text = String(query ?? "").trim();
  if (!text) return {};
  return {
    OR: [
      { reference: { contains: text, mode: "insensitive" } },
      { notesMarkdown: { contains: text, mode: "insensitive" } },
      { contact: { name: { contains: text, mode: "insensitive" } } },
      { contact: { legalName: { contains: text, mode: "insensitive" } } },
    ],
  };
}

function ensureApplicationSourceType(docType) {
  const allowed = new Set(["PAYMENT", "CREDIT_NOTE", "ADVANCE"]);
  if (allowed.has(docType)) return;
  throw new FinanceServiceError(
    "Solo pagos, notas de credito o anticipos pueden aplicarse contra documentos abiertos.",
    409,
  );
}

function summarizeTaxLines(lines = []) {
  const summary = lines.reduce(
    (acc, line) => {
      const amount = amountToNumber(line.taxAmount);
      if (line.kind === "WITHHOLDING") {
        acc.withholdings += amount;
      } else {
        acc.transfers += amount;
      }
      return acc;
    },
    { transfers: 0, withholdings: 0 },
  );
  return {
    transfers: rounded(summary.transfers),
    withholdings: rounded(summary.withholdings),
    net: rounded(summary.transfers - summary.withholdings),
  };
}

export function createFinanceDocumentsService({ prisma }) {
  const postingService = createFinancePostingService({ prisma });
  const agingService = createFinanceAgingService({ prisma });

  async function getCompanyContext(authUserId) {
    const profile = await prisma.userProfile.findUnique({
      where: { authUserId },
      select: { id: true },
    });
    if (!profile) {
      throw new FinanceServiceError("Perfil de usuario no encontrado.", 404);
    }

    const membership = await prisma.membership.findFirst({
      where: { userId: profile.id, enabled: true },
      orderBy: { createdAt: "desc" },
      select: { companyId: true },
    });

    if (!membership?.companyId) {
      throw new FinanceServiceError(
        "No tienes una empresa activa para gestionar documentos.",
        403,
      );
    }
    return { profileId: profile.id, companyId: membership.companyId };
  }

  async function assertContactOwnership({ companyId, contactId }) {
    if (!contactId) return;
    const row = await prisma.contact.findFirst({
      where: { id: contactId, companyId, enabled: true },
      select: { id: true },
    });
    if (!row) {
      throw new FinanceServiceError("El contacto no existe en tu empresa.", 400);
    }
  }

  async function getDocumentOwned({ companyId, id, enabledOnly = false }) {
    const row = await prisma.financeDocument.findFirst({
      where: {
        id,
        companyId,
        ...(enabledOnly ? { enabled: true } : {}),
      },
      include: {
        contact: {
          select: { id: true, name: true, legalName: true },
        },
        taxLines: {
          where: { enabled: true },
          orderBy: [{ kind: "asc" }, { taxKey: "asc" }],
        },
      },
    });
    if (!row) {
      throw new FinanceServiceError("Documento financiero no encontrado.", 404);
    }
    return row;
  }

  function buildReminderPayload({ document, customMessage }) {
    const reference = document.reference || document.id;
    const dueDate = document.dueDate
      ? new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" }).format(
          new Date(document.dueDate),
        )
      : "sin vencimiento";
    const status = resolveDocumentOperationalStatusForReminder(document);
    const fallback =
      status === "OVERDUE"
        ? `Documento ${reference} vencido (${dueDate}). Requiere seguimiento.`
        : `Seguimiento de documento ${reference} (vence ${dueDate}).`;
    return {
      title: `Recordatorio ${document.direction} - ${reference}`,
      body: customMessage || fallback,
      link: `/app/m/atlas.finance/finance/${document.direction === "AR" ? "ar" : "ap"}`,
    };
  }

  function resolveDocumentOperationalStatusForReminder(document) {
    const open = amountToNumber(document.openAmount);
    if (open <= 0) return "PAID";
    if (document.dueDate) {
      const due = new Date(document.dueDate);
      if (!Number.isNaN(due.getTime()) && due.getTime() < Date.now()) {
        return "OVERDUE";
      }
    }
    return document.status;
  }

  async function resolveFxRate({
    companyId,
    sourceCurrency,
    targetCurrency,
    applyDate,
  }) {
    if (sourceCurrency === targetCurrency) {
      return {
        rate: 1,
        mode: "same-currency",
        sourceCurrency,
        targetCurrency,
        rateDate: applyDate,
      };
    }

    const fromDate = new Date(applyDate);
    const direct = await prisma.financeFxRate.findFirst({
      where: {
        companyId,
        enabled: true,
        baseCurrency: sourceCurrency,
        quoteCurrency: targetCurrency,
        rateDate: { lte: fromDate },
      },
      orderBy: { rateDate: "desc" },
    });
    if (direct) {
      return {
        rate: amountToNumber(direct.rate),
        mode: "direct",
        sourceCurrency,
        targetCurrency,
        rateDate: direct.rateDate,
        fxRateId: direct.id,
      };
    }

    const inverse = await prisma.financeFxRate.findFirst({
      where: {
        companyId,
        enabled: true,
        baseCurrency: targetCurrency,
        quoteCurrency: sourceCurrency,
        rateDate: { lte: fromDate },
      },
      orderBy: { rateDate: "desc" },
    });
    if (inverse) {
      const inverseRate = amountToNumber(inverse.rate);
      if (inverseRate <= 0) {
        throw new FinanceServiceError("Tasa de tipo de cambio invalida.", 400);
      }
      return {
        rate: rounded(1 / inverseRate),
        mode: "inverse",
        sourceCurrency,
        targetCurrency,
        rateDate: inverse.rateDate,
        fxRateId: inverse.id,
      };
    }

    const applyDay = dateToIsoDay(applyDate) ?? "fecha solicitada";
    throw new FinanceServiceError(
      `No existe tipo de cambio ${sourceCurrency}/${targetCurrency} para ${applyDay}.`,
      400,
    );
  }

  async function buildApplicationRows({
    companyId,
    sourceDocument,
    targets,
    lines,
    applyDate,
  }) {
    const targetById = new Map(targets.map((target) => [target.id, target]));
    const openByTarget = new Map(
      targets.map((target) => [target.id, cents(target.openAmount)]),
    );

    const sourceCurrency = sourceDocument.currency;
    const sourceOpenCents = cents(sourceDocument.openAmount);
    let totalSourceAppliedCents = 0;
    const targetAppliedCents = new Map();
    const detailedLines = [];

    for (const line of lines) {
      const target = targetById.get(line.targetDocumentId);
      if (!target) {
        throw new FinanceServiceError("Documento destino invalido.", 409);
      }

      const targetAmountCents = cents(line.amount, "Monto aplicado");
      if (targetAmountCents <= 0) {
        throw new FinanceServiceError(
          "Cada aplicacion debe tener un monto mayor a cero.",
          400,
        );
      }

      const targetOpenCents = openByTarget.get(target.id) ?? 0;
      const currentAppliedCents = targetAppliedCents.get(target.id) ?? 0;
      if (currentAppliedCents + targetAmountCents > targetOpenCents) {
        throw new FinanceServiceError(
          "La aplicacion excede el saldo abierto del destino.",
          400,
        );
      }

      const fx = await resolveFxRate({
        companyId,
        sourceCurrency,
        targetCurrency: target.currency,
        applyDate,
      });

      const sourceAmountCents = Math.round(targetAmountCents / fx.rate);
      if (sourceAmountCents <= 0) {
        throw new FinanceServiceError(
          "El monto convertido no puede ser menor o igual a cero.",
          400,
        );
      }

      totalSourceAppliedCents += sourceAmountCents;
      if (totalSourceAppliedCents > sourceOpenCents) {
        throw new FinanceServiceError(
          "La aplicacion excede el saldo abierto del origen.",
          400,
        );
      }

      targetAppliedCents.set(target.id, currentAppliedCents + targetAmountCents);
      detailedLines.push({
        targetDocumentId: target.id,
        sourceAmount: money(sourceAmountCents),
        targetAmount: money(targetAmountCents),
        effectiveFxRate: rounded(fx.rate),
        sourceCurrency,
        targetCurrency: target.currency,
        fxRateId: fx.fxRateId ?? null,
        fxRateDate: fx.rateDate ?? applyDate,
      });
    }

    return {
      detailedLines,
      totalSourceApplied: money(totalSourceAppliedCents),
      sourceUnapplied: money(sourceOpenCents - totalSourceAppliedCents),
      targetAppliedById: new Map(
        [...targetAppliedCents.entries()].map(([targetId, value]) => [
          targetId,
          money(value),
        ]),
      ),
    };
  }

  return {
    async listDocuments({ authUserId, query = {} }) {
      const { companyId } = await getCompanyContext(authUserId);
      const parsed = financeDocumentListQuerySchema.safeParse(query);
      if (!parsed.success) {
        throw new FinanceServiceError("Filtros de documentos invalidos.", 400);
      }
      const filters = parsed.data;
      const take = normalizeLimit(filters.limit, 80, 300);
      const rows = await prisma.financeDocument.findMany({
        where: {
          companyId,
          direction: filters.direction,
          docType: filters.docType,
          status: filters.status,
          contactId: filters.contactId,
          ...documentWhereSearch(filters.q),
        },
        include: {
          contact: {
            select: { id: true, name: true, legalName: true, type: true },
          },
          taxLines: {
            where: { enabled: true },
            orderBy: [{ kind: "asc" }, { taxKey: "asc" }],
          },
        },
        orderBy: [{ issueDate: "desc" }, { createdAt: "desc" }],
        take,
      });
      return rows;
    },

    async createDocument({ authUserId, payload }) {
      const { companyId } = await getCompanyContext(authUserId);
      const data = financeDocumentCreateSchema.parse(payload);
      await assertContactOwnership({ companyId, contactId: data.contactId });
      const totalAmount = amountToNumber(data.totalAmount);
      const subtotalAmount =
        data.subtotalAmount !== undefined && data.subtotalAmount !== null
          ? amountToNumber(data.subtotalAmount)
          : null;

      return prisma.$transaction(async (tx) => {
        let taxLinesInput = Array.isArray(data.taxLines) ? data.taxLines : [];
        const uniqueTaxRateIds = [...new Set(taxLinesInput.map((line) => line.taxRateId))];
        const taxRates = uniqueTaxRateIds.length
          ? await tx.financeTaxRate.findMany({
              where: {
                id: { in: uniqueTaxRateIds },
                companyId,
                enabled: true,
                OR: [{ direction: null }, { direction: data.direction }],
              },
            })
          : [];
        const taxRateById = new Map(taxRates.map((rate) => [rate.id, rate]));
        if (uniqueTaxRateIds.length !== taxRates.length) {
          throw new FinanceServiceError(
            "Uno o mas impuestos no estan disponibles para este documento.",
            400,
          );
        }

        const preparedTaxLines = taxLinesInput.map((line) => {
          const taxRate = taxRateById.get(line.taxRateId);
          if (!taxRate) {
            throw new FinanceServiceError("Impuesto invalido en documento.", 400);
          }
          const baseAmount =
            line.baseAmount !== undefined && line.baseAmount !== null
              ? amountToNumber(line.baseAmount)
              : subtotalAmount !== null
                ? subtotalAmount
                : totalAmount;
          const rate = Number(taxRate.rate);
          if (!Number.isFinite(rate) || rate < 0) {
            throw new FinanceServiceError("Tasa de impuesto invalida.", 400);
          }
          const taxAmount = rounded((baseAmount * rate) / 100);
          return {
            taxRateId: taxRate.id,
            taxKey: taxRate.key,
            taxName: taxRate.name,
            kind: taxRate.kind,
            rate: roundTaxRate(rate),
            baseAmount,
            taxAmount,
          };
        });

        const created = await tx.financeDocument.create({
          data: {
            companyId,
            direction: data.direction,
            docType: data.docType,
            status: "OPEN",
            contactId: data.contactId ?? null,
            currency: data.currency,
            issueDate: parseDateLike(data.issueDate, new Date()),
            dueDate: parseDateLike(data.dueDate, null),
            reference: data.reference ?? null,
            notesMarkdown: data.notesMarkdown ?? null,
            totalAmount: totalAmount.toFixed(2),
            openAmount: totalAmount.toFixed(2),
            metadata: {
              ...(data.metadata ?? {}),
              ...(subtotalAmount !== null ? { subtotalAmount } : {}),
              ...(preparedTaxLines.length
                ? {
                    taxSummary: {
                      ...summarizeTaxLines(preparedTaxLines),
                      count: preparedTaxLines.length,
                    },
                  }
                : {}),
            },
            enabled: true,
          },
          include: {
            contact: {
              select: { id: true, name: true, legalName: true },
            },
            taxLines: {
              where: { enabled: true },
              orderBy: [{ kind: "asc" }, { taxKey: "asc" }],
            },
          },
        });

        if (preparedTaxLines.length) {
          await tx.financeDocumentTaxLine.createMany({
            data: preparedTaxLines.map((line) => ({
              companyId,
              documentId: created.id,
              taxRateId: line.taxRateId,
              taxKey: line.taxKey,
              taxName: line.taxName,
              kind: line.kind,
              rate: line.rate.toFixed(6),
              baseAmount: line.baseAmount.toFixed(2),
              taxAmount: line.taxAmount.toFixed(2),
              currency: created.currency,
              metadata: null,
              enabled: true,
            })),
          });
        }

        await postingService.createIssuePosting({
          tx,
          companyId,
          document: {
            ...created,
            taxLines: preparedTaxLines,
            subtotalAmount,
          },
        });
        return tx.financeDocument.findUnique({
          where: { id: created.id },
          include: {
            contact: {
              select: { id: true, name: true, legalName: true },
            },
            taxLines: {
              where: { enabled: true },
              orderBy: [{ kind: "asc" }, { taxKey: "asc" }],
            },
          },
        });
      });
    },

    async getDocumentById({ authUserId, id }) {
      const { companyId } = await getCompanyContext(authUserId);
      return getDocumentOwned({ companyId, id });
    },

    async updateDocument({ authUserId, id, payload }) {
      const { companyId } = await getCompanyContext(authUserId);
      await getDocumentOwned({ companyId, id });
      const data = financeDocumentUpdateSchema.parse(payload);
      const update = {};
      if (data.reference !== undefined) {
        update.reference = data.reference ?? null;
      }
      if (data.notesMarkdown !== undefined) {
        update.notesMarkdown = data.notesMarkdown ?? null;
      }
      if (data.dueDate !== undefined) {
        update.dueDate = parseDateLike(data.dueDate, null);
      }
      if (data.metadata !== undefined) {
        update.metadata = data.metadata ?? null;
      }
      if (data.status !== undefined) {
        update.status = data.status;
      }
      return prisma.financeDocument.update({
        where: { id },
        data: update,
        include: {
          contact: {
            select: { id: true, name: true, legalName: true },
          },
        },
      });
    },

    async setDocumentEnabled({ authUserId, id, payload }) {
      const { companyId } = await getCompanyContext(authUserId);
      await getDocumentOwned({ companyId, id });
      const data = financeDocumentEnabledSchema.parse(payload);
      return prisma.financeDocument.update({
        where: { id },
        data: { enabled: data.enabled },
      });
    },

    async previewApplication({ authUserId, id, payload }) {
      const { companyId } = await getCompanyContext(authUserId);
      const source = await getDocumentOwned({ companyId, id, enabledOnly: true });
      ensureApplicationSourceType(source.docType);
      const parsed = financeApplicationPreviewSchema.parse(payload ?? {});
      const applyDate = parseDateLike(parsed.applyDate, new Date());

      const targetWhere = {
        companyId,
        enabled: true,
        direction: source.direction,
        docType: { in: ["INVOICE", "DEBIT_NOTE"] },
        status: { in: ["OPEN", "PARTIAL"] },
        id: { not: source.id },
        ...(source.contactId ? { contactId: source.contactId } : {}),
      };

      if (parsed.targetDocumentIds?.length) {
        targetWhere.id = { in: parsed.targetDocumentIds };
      }

      const targetRows = await prisma.financeDocument.findMany({
        where: targetWhere,
        orderBy: [{ dueDate: "asc" }, { issueDate: "asc" }, { createdAt: "asc" }],
        include: {
          contact: {
            select: { id: true, name: true, legalName: true },
          },
        },
      });

      if (targetRows.length === 0) {
        return {
          source,
          lines: [],
          applied: 0,
          unapplied: amountToNumber(source.openAmount),
          mode: parsed.allocationMode,
        };
      }

      let proposalLines = [];
      if (parsed.lines?.length) {
        proposalLines = parsed.lines.map((line) => ({
          targetDocumentId: line.targetDocumentId,
          amount: rounded(line.amount),
        }));
      } else {
        const sameCurrencyTargets = targetRows.filter(
          (row) => row.currency === source.currency,
        );
        if (sameCurrencyTargets.length > 0) {
          const proposal = buildFifoProposal({
            sourceOpen: amountToNumber(source.openAmount),
            targets: sameCurrencyTargets.map((row) => ({
              id: row.id,
              open: amountToNumber(row.openAmount),
            })),
          });
          proposalLines = proposal.lines.map((line) => ({
            targetDocumentId: line.targetId,
            amount: rounded(line.amount),
          }));
        }
      }

      const totals = await buildApplicationRows({
        companyId,
        sourceDocument: source,
        targets: targetRows,
        lines: proposalLines,
        applyDate,
      });

      const fxResults = await Promise.all(
        targetRows.map(async (target) => {
          try {
            const fx = await resolveFxRate({
              companyId,
              sourceCurrency: source.currency,
              targetCurrency: target.currency,
              applyDate,
            });
            return {
              id: target.id,
              fx: {
                effectiveFxRate: rounded(fx.rate),
                sourceCurrency: source.currency,
                targetCurrency: target.currency,
                fxRateId: fx.fxRateId ?? null,
                fxRateDate: fx.rateDate ?? applyDate,
              },
            };
          } catch {
            return { id: target.id, fx: null };
          }
        }),
      );
      const fxByTarget = Object.fromEntries(fxResults.map((r) => [r.id, r.fx]));

      return {
        source,
        targets: targetRows,
        lines: totals.detailedLines.map((line) => ({
          targetDocumentId: line.targetDocumentId,
          amount: line.targetAmount,
          sourceAmount: line.sourceAmount,
          targetAmount: line.targetAmount,
          sourceCurrency: line.sourceCurrency,
          targetCurrency: line.targetCurrency,
          effectiveFxRate: line.effectiveFxRate,
        })),
        applied: rounded(totals.totalSourceApplied),
        unapplied: rounded(totals.sourceUnapplied),
        mode: parsed.lines?.length ? "manual" : "fifo",
        applyDate,
        fxByTarget,
      };
    },

    async applyDocument({ authUserId, id, payload }) {
      const { companyId } = await getCompanyContext(authUserId);
      const source = await getDocumentOwned({ companyId, id, enabledOnly: true });
      ensureApplicationSourceType(source.docType);
      const parsed = financeApplicationApplySchema.parse(payload);
      const applyDate = parseDateLike(parsed.applyDate, new Date());

      const targetIds = [...new Set(parsed.lines.map((line) => line.targetDocumentId))];
      const targets = await prisma.financeDocument.findMany({
        where: {
          companyId,
          enabled: true,
          id: { in: targetIds },
          direction: source.direction,
          status: { in: ["OPEN", "PARTIAL"] },
          docType: { in: ["INVOICE", "DEBIT_NOTE"] },
        },
      });

      if (targets.length !== targetIds.length) {
        throw new FinanceServiceError(
          "Uno o mas documentos destino no son aplicables.",
          409,
        );
      }

      const proposal = await buildApplicationRows({
        companyId,
        sourceDocument: source,
        targets,
        lines: parsed.lines,
        applyDate,
      });

      return prisma.$transaction(async (tx) => {
        const sourceCurrent = await tx.financeDocument.findFirst({
          where: { id: source.id, companyId, enabled: true },
        });
        if (!sourceCurrent) {
          throw new FinanceServiceError("Documento origen no disponible.", 409);
        }

        const targetCurrentRows = await tx.financeDocument.findMany({
          where: { id: { in: targetIds }, companyId, enabled: true },
        });
        const currentById = new Map(
          targetCurrentRows.map((row) => [row.id, amountToNumber(row.openAmount)]),
        );
        const targetTotalById = new Map(
          targetCurrentRows.map((row) => [row.id, amountToNumber(row.totalAmount)]),
        );

        const linesToCreate = proposal.detailedLines.map((line) => ({
          companyId,
          sourceDocumentId: source.id,
          targetDocumentId: line.targetDocumentId,
          appliedAmount: rounded(line.sourceAmount).toFixed(2),
          sourceAmount: rounded(line.sourceAmount).toFixed(2),
          targetAmount: rounded(line.targetAmount).toFixed(2),
          effectiveFxRate: rounded(line.effectiveFxRate).toFixed(6),
          appliedAt: applyDate,
          metadata: {
            ...(parsed.note ? { note: parsed.note } : {}),
            sourceCurrency: line.sourceCurrency,
            targetCurrency: line.targetCurrency,
            fxRateId: line.fxRateId,
            fxRateDate: line.fxRateDate,
          },
        }));
        await tx.financeDocumentApplication.createMany({
          data: linesToCreate,
        });

        const appliedAmount = rounded(proposal.totalSourceApplied);
        const sourceTotal = amountToNumber(sourceCurrent.totalAmount);
        const nextSourceOpen = Math.max(
          0,
          rounded(amountToNumber(sourceCurrent.openAmount) - appliedAmount),
        );
        await tx.financeDocument.update({
          where: { id: source.id },
          data: {
            openAmount: nextSourceOpen.toFixed(2),
            status: resolveStatus(sourceTotal, nextSourceOpen),
          },
        });

        for (const targetId of targetIds) {
          const currentOpen = currentById.get(targetId) ?? 0;
          const targetTotal = targetTotalById.get(targetId) ?? currentOpen;
          const applyAmount = proposal.targetAppliedById.get(targetId) ?? 0;
          const nextOpen = Math.max(0, rounded(currentOpen - applyAmount));
          await tx.financeDocument.update({
            where: { id: targetId },
            data: {
              openAmount: nextOpen.toFixed(2),
              status: resolveStatus(targetTotal, nextOpen),
            },
          });
        }

        await postingService.linkApplyEvent({
          tx,
          companyId,
          sourceDocumentId: source.id,
          targetDocumentIds: targetIds,
          metadata: {
            applyDate,
            sourceCurrency: source.currency,
            appliedAmount,
          },
        });

        return {
          sourceDocumentId: source.id,
          appliedAmount,
          targets: targetIds,
          sourceCurrency: source.currency,
          appliedAt: applyDate,
        };
      });
    },

    async getAging({ authUserId, query }) {
      const { companyId } = await getCompanyContext(authUserId);
      const parsed = financeAgingQuerySchema.safeParse(query ?? {});
      if (!parsed.success) {
        throw new FinanceServiceError("Filtros de aging invalidos.", 400);
      }
      return agingService.getAging({
        companyId,
        direction: parsed.data.direction,
        contactId: parsed.data.contactId,
        asOf: parsed.data.asOf,
        currency: parsed.data.currency,
      });
    },

    async listApplications({ authUserId, query = {} }) {
      const { companyId } = await getCompanyContext(authUserId);
      const parsed = financeApplicationListQuerySchema.safeParse(query);
      if (!parsed.success) {
        throw new FinanceServiceError("Filtros de aplicaciones invalidos.", 400);
      }
      const filters = parsed.data;
      const take = normalizeLimit(filters.limit, 120, 300);
      const fromDate = parseDateBound(filters.from);
      const toDate = parseDateBound(filters.to, { endOfDay: true });
      const rows = await prisma.financeDocumentApplication.findMany({
        where: {
          companyId,
          status: filters.status,
          sourceDocumentId: filters.sourceDocumentId,
          targetDocumentId: filters.targetDocumentId,
          appliedAt:
            fromDate || toDate
              ? {
                  ...(fromDate ? { gte: fromDate } : {}),
                  ...(toDate ? { lte: toDate } : {}),
                }
              : undefined,
          ...(filters.direction
            ? {
                sourceDocument: {
                  direction: filters.direction,
                },
              }
            : {}),
          ...(filters.contactId
            ? {
                OR: [
                  { sourceDocument: { contactId: filters.contactId } },
                  { targetDocument: { contactId: filters.contactId } },
                ],
              }
            : {}),
        },
        orderBy: [{ appliedAt: "desc" }, { createdAt: "desc" }],
        take,
        include: {
          reversedBy: {
            select: {
              id: true,
              displayName: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          sourceDocument: {
            select: {
              id: true,
              direction: true,
              docType: true,
              reference: true,
              currency: true,
              contact: {
                select: { id: true, name: true, legalName: true },
              },
            },
          },
          targetDocument: {
            select: {
              id: true,
              direction: true,
              docType: true,
              reference: true,
              currency: true,
              contact: {
                select: { id: true, name: true, legalName: true },
              },
            },
          },
        },
      });
      return rows;
    },

    async reverseApplication({ authUserId, id, payload = {} }) {
      const { companyId, profileId } = await getCompanyContext(authUserId);
      const reason = String(payload.reason ?? "").trim();

      return prisma.$transaction(async (tx) => {
        const application = await tx.financeDocumentApplication.findFirst({
          where: { id, companyId },
        });
        if (!application) {
          throw new FinanceServiceError("Aplicacion no encontrada.", 404);
        }
        if (application.status === "REVERSED") {
          throw new FinanceServiceError("La aplicacion ya fue anulada.", 409);
        }

        const source = await tx.financeDocument.findFirst({
          where: { id: application.sourceDocumentId, companyId },
        });
        const target = await tx.financeDocument.findFirst({
          where: { id: application.targetDocumentId, companyId },
        });
        if (!source || !target) {
          throw new FinanceServiceError(
            "No se pudo resolver el origen/destino de la aplicacion.",
            409,
          );
        }

        const sourceRestore = amountToNumber(
          application.sourceAmount ?? application.appliedAmount,
        );
        const targetRestore = amountToNumber(
          application.targetAmount ?? application.appliedAmount,
        );

        const nextSourceOpen = rounded(amountToNumber(source.openAmount) + sourceRestore);
        const nextTargetOpen = rounded(amountToNumber(target.openAmount) + targetRestore);
        const sourceTotal = amountToNumber(source.totalAmount);
        const targetTotal = amountToNumber(target.totalAmount);

        if (nextSourceOpen - sourceTotal > 0.001 || nextTargetOpen - targetTotal > 0.001) {
          throw new FinanceServiceError(
            "La anulacion excede el saldo total permitido en origen o destino.",
            409,
          );
        }

        await tx.financeDocument.update({
          where: { id: source.id },
          data: {
            openAmount: nextSourceOpen.toFixed(2),
            status: resolveStatus(sourceTotal, nextSourceOpen),
          },
        });
        await tx.financeDocument.update({
          where: { id: target.id },
          data: {
            openAmount: nextTargetOpen.toFixed(2),
            status: resolveStatus(targetTotal, nextTargetOpen),
          },
        });

        const reversedAt = new Date();
        const updated = await tx.financeDocumentApplication.update({
          where: { id: application.id },
          data: {
            status: "REVERSED",
            reversedAt,
            reversedById: profileId,
            reversalReason: reason || null,
            metadata: {
              ...(application.metadata ?? {}),
              reversalReason: reason || null,
            },
          },
        });

        await postingService.linkReverseEvent({
          tx,
          companyId,
          sourceDocumentId: source.id,
          targetDocumentIds: [target.id],
          metadata: {
            applicationId: application.id,
            reason: reason || null,
            reversedAt,
          },
        });

        return updated;
      });
    },

    async getJournalLinks({ authUserId, id }) {
      const { companyId } = await getCompanyContext(authUserId);
      await getDocumentOwned({ companyId, id });
      const rows = await prisma.financeDocumentAccountingLink.findMany({
        where: {
          companyId,
          documentId: id,
          enabled: true,
        },
        orderBy: { createdAt: "desc" },
        include: {
          journalEntry: {
            select: {
              id: true,
              entryNumber: true,
              concept: true,
              occurredAt: true,
              currency: true,
              lines: {
                select: {
                  id: true,
                  accountId: true,
                  debit: true,
                  credit: true,
                },
              },
            },
          },
        },
      });
      return rows;
    },

    async createDocumentReminder({ authUserId, id, payload = {} }) {
      const { companyId, profileId } = await getCompanyContext(authUserId);
      const document = await getDocumentOwned({ companyId, id });
      const customMessage = String(payload.message ?? "").trim() || null;
      const reminder = buildReminderPayload({ document, customMessage });
      return prisma.notification.create({
        data: {
          userId: profileId,
          companyId,
          kind: "warning",
          title: reminder.title,
          body: reminder.body,
          link: reminder.link,
        },
      });
    },

    async createBulkDocumentReminders({ authUserId, documentIds = [], payload = {} }) {
      const { companyId, profileId } = await getCompanyContext(authUserId);
      const uniqueIds = [...new Set(documentIds.filter(Boolean))];
      if (!uniqueIds.length) {
        throw new FinanceServiceError("No se recibieron documentos para recordar.", 400);
      }

      const rows = await prisma.financeDocument.findMany({
        where: {
          companyId,
          id: { in: uniqueIds },
        },
      });
      if (!rows.length) {
        throw new FinanceServiceError("No se encontraron documentos para recordar.", 404);
      }

      const customMessage = String(payload.message ?? "").trim() || null;
      await prisma.notification.createMany({
        data: rows.map((document) => {
          const reminder = buildReminderPayload({ document, customMessage });
          return {
            userId: profileId,
            companyId,
            kind: "warning",
            title: reminder.title,
            body: reminder.body,
            link: reminder.link,
          };
        }),
      });

      return {
        requested: uniqueIds.length,
        created: rows.length,
      };
    },
  };
}
