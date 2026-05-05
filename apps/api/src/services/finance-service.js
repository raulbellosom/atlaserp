class FinanceServiceError extends Error {
  constructor(message, status = 500) {
    super(message);
    this.name = "FinanceServiceError";
    this.status = status;
  }
}

function normalizeLimit(limit, fallback = 50, max = 200) {
  const parsed = Number.parseInt(String(limit ?? fallback), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

function normalizeCurrency(value, fallback = "MXN") {
  const normalized = String(value ?? fallback)
    .trim()
    .toUpperCase();
  return normalized || fallback;
}

function parseAmountToCents(value) {
  if (value === null || value === undefined || value === "") return 0;
  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    throw new FinanceServiceError("Monto invalido.", 400);
  }
  return Math.round(amount * 100);
}

function centsToDecimalString(cents) {
  return (cents / 100).toFixed(2);
}

function decimalStringFromCents(cents, precision = 2) {
  return (cents / 100).toFixed(precision);
}

function decimalToCents(value) {
  if (value === null || value === undefined || value === "") return null;
  const amount = Number(value);
  if (!Number.isFinite(amount)) return null;
  return Math.round(amount * 100);
}

function parseOccurredAt(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) {
    throw new FinanceServiceError("Fecha de movimiento invalida.", 400);
  }
  return date;
}

function parseFxRateDate(value) {
  const source = String(value ?? "").trim();
  if (!source) {
    throw new FinanceServiceError("Fecha de tipo de cambio invalida.", 400);
  }
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(source)
    ? `${source}T00:00:00.000Z`
    : source;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    throw new FinanceServiceError("Fecha de tipo de cambio invalida.", 400);
  }
  return date;
}

function toStartOfDayUtc(date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function toEndOfDayUtc(date) {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      23,
      59,
      59,
      999,
    ),
  );
}

function formatYmd(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(
    2,
    "0",
  )}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function parseDashboardWindow(from, to) {
  const now = new Date();
  const fallbackTo = toEndOfDayUtc(now);
  const fallbackFrom = toStartOfDayUtc(
    new Date(fallbackTo.getTime() - 29 * 24 * 60 * 60 * 1000),
  );

  const fromDate = from ? toStartOfDayUtc(new Date(from)) : fallbackFrom;
  const toDate = to ? toEndOfDayUtc(new Date(to)) : fallbackTo;

  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
    throw new FinanceServiceError("Rango de fechas invalido para dashboard.", 400);
  }
  if (fromDate > toDate) {
    throw new FinanceServiceError(
      "La fecha inicial no puede ser mayor a la fecha final.",
      400,
    );
  }
  return { fromDate, toDate };
}

function buildEntryNumber() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hour = String(now.getHours()).padStart(2, "0");
  const minute = String(now.getMinutes()).padStart(2, "0");
  const second = String(now.getSeconds()).padStart(2, "0");
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `POL-${year}${month}${day}-${hour}${minute}${second}-${random}`;
}

function buildSearchWhere(search) {
  const query = String(search ?? "").trim();
  if (!query) return {};
  return {
    OR: [
      { code: { contains: query, mode: "insensitive" } },
      { name: { contains: query, mode: "insensitive" } },
      { type: { contains: query, mode: "insensitive" } },
    ],
  };
}

export function createFinanceService({ prisma }) {
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
        "No tienes una empresa activa para gestionar finanzas.",
        403,
      );
    }

    return {
      profileId: profile.id,
      companyId: membership.companyId,
    };
  }

  async function assertAccountOwnership({ id, companyId }) {
    const account = await prisma.financeAccount.findFirst({
      where: { id, companyId },
      select: { id: true },
    });
    if (!account) {
      throw new FinanceServiceError("Cuenta financiera no encontrada.", 404);
    }
  }

  async function assertFxRateOwnership({ id, companyId }) {
    const rate = await prisma.financeFxRate.findFirst({
      where: { id, companyId },
      select: { id: true },
    });
    if (!rate) {
      throw new FinanceServiceError("Tipo de cambio no encontrado.", 404);
    }
  }

  async function getBaseCurrency() {
    const record = await prisma.instanceConfig.findUnique({
      where: { key: "currency" },
      select: { value: true },
    });
    return normalizeCurrency(record?.value ?? "MXN");
  }

  async function resolveFxRateForDate({
    companyId,
    fromCurrency,
    toCurrency,
    occurredAt,
  }) {
    const source = normalizeCurrency(fromCurrency);
    const target = normalizeCurrency(toCurrency);
    if (source === target) {
      return {
        rate: 1,
        fxRateId: null,
        rateDate: toStartOfDayUtc(occurredAt).toISOString(),
        inverted: false,
        sourceCurrency: source,
        targetCurrency: target,
      };
    }

    const direct = await prisma.financeFxRate.findFirst({
      where: {
        companyId,
        enabled: true,
        baseCurrency: source,
        quoteCurrency: target,
        rateDate: { lte: occurredAt },
      },
      orderBy: [{ rateDate: "desc" }, { createdAt: "desc" }],
    });
    if (direct?.rate) {
      return {
        rate: Number(direct.rate),
        fxRateId: direct.id,
        rateDate: direct.rateDate.toISOString(),
        inverted: false,
        sourceCurrency: source,
        targetCurrency: target,
      };
    }

    const inverse = await prisma.financeFxRate.findFirst({
      where: {
        companyId,
        enabled: true,
        baseCurrency: target,
        quoteCurrency: source,
        rateDate: { lte: occurredAt },
      },
      orderBy: [{ rateDate: "desc" }, { createdAt: "desc" }],
    });
    if (inverse?.rate) {
      const inverseRate = Number(inverse.rate);
      if (!Number.isFinite(inverseRate) || inverseRate <= 0) {
        throw new FinanceServiceError("Tipo de cambio invalido en historial.", 400);
      }
      return {
        rate: 1 / inverseRate,
        fxRateId: inverse.id,
        rateDate: inverse.rateDate.toISOString(),
        inverted: true,
        sourceCurrency: source,
        targetCurrency: target,
      };
    }

    const asDate = new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" }).format(
      occurredAt,
    );
    throw new FinanceServiceError(
      `No existe tipo de cambio historico para ${source}/${target} en la fecha ${asDate}.`,
      400,
    );
  }

  function toEntryWithFxSummary(entry, baseCurrency) {
    const lines = entry.lines.map((line) => {
      const debitCents = parseAmountToCents(line.debit);
      const creditCents = parseAmountToCents(line.credit);
      const signedOriginalCents = debitCents - creditCents;

      const storedBaseCents = decimalToCents(line.baseAmount);
      const fxRate = line.fxRate ? Number(line.fxRate) : null;
      const fallbackBaseCents =
        storedBaseCents !== null
          ? storedBaseCents
          : line.currency === baseCurrency
            ? signedOriginalCents
            : fxRate && Number.isFinite(fxRate)
              ? Math.round((signedOriginalCents / 100) * fxRate * 100)
              : null;
      const signedBaseCents = fallbackBaseCents ?? 0;

      return {
        ...line,
        fxRate: fxRate ? fxRate.toFixed(8) : line.currency === baseCurrency ? "1.00000000" : null,
        fxTrace: line.metadata?.fxTrace ?? null,
        original: {
          debit: decimalStringFromCents(debitCents),
          credit: decimalStringFromCents(creditCents),
          currency: line.currency,
        },
        converted: {
          debit: signedBaseCents > 0 ? decimalStringFromCents(signedBaseCents) : "0.00",
          credit: signedBaseCents < 0 ? decimalStringFromCents(Math.abs(signedBaseCents)) : "0.00",
          net: decimalStringFromCents(signedBaseCents),
          currency: baseCurrency,
        },
      };
    });

    const totals = lines.reduce(
      (acc, line) => {
        const originalDebit = parseAmountToCents(line.debit);
        const originalCredit = parseAmountToCents(line.credit);
        acc.originalDebit += originalDebit;
        acc.originalCredit += originalCredit;

        const convertedDebit = parseAmountToCents(line.converted.debit);
        const convertedCredit = parseAmountToCents(line.converted.credit);
        acc.convertedDebit += convertedDebit;
        acc.convertedCredit += convertedCredit;
        return acc;
      },
      {
        originalDebit: 0,
        originalCredit: 0,
        convertedDebit: 0,
        convertedCredit: 0,
      },
    );

    return {
      ...entry,
      baseCurrency,
      lines,
      totalsOriginal: {
        debit: decimalStringFromCents(totals.originalDebit),
        credit: decimalStringFromCents(totals.originalCredit),
        net: decimalStringFromCents(totals.originalDebit - totals.originalCredit),
      },
      totalsBase: {
        debit: decimalStringFromCents(totals.convertedDebit),
        credit: decimalStringFromCents(totals.convertedCredit),
        net: decimalStringFromCents(totals.convertedDebit - totals.convertedCredit),
        currency: baseCurrency,
      },
    };
  }

  async function getAccountIdsByCompany({ companyId, ids }) {
    const rows = await prisma.financeAccount.findMany({
      where: {
        companyId,
        id: { in: ids },
        enabled: true,
      },
      select: { id: true },
    });
    return new Set(rows.map((row) => row.id));
  }

  function normalizeEntryLines(lines) {
    const normalized = lines.map((line) => {
      const debitCents = parseAmountToCents(line.debit);
      const creditCents = parseAmountToCents(line.credit);
      if (debitCents < 0 || creditCents < 0) {
        throw new FinanceServiceError(
          "Debito y credito no pueden ser negativos.",
          400,
        );
      }
      if (debitCents === 0 && creditCents === 0) {
        throw new FinanceServiceError(
          "Cada linea debe tener debito o credito mayor a cero.",
          400,
        );
      }
      if (debitCents > 0 && creditCents > 0) {
        throw new FinanceServiceError(
          "Una linea no puede tener debito y credito al mismo tiempo.",
          400,
        );
      }
      return {
        accountId: line.accountId,
        contactId: line.contactId ?? null,
        debitCents,
        creditCents,
        currency: normalizeCurrency(line.currency, "MXN"),
        note: line.note ? String(line.note).trim() : null,
      };
    });

    const totals = normalized.reduce(
      (acc, line) => {
        acc.debit += line.debitCents;
        acc.credit += line.creditCents;
        return acc;
      },
      { debit: 0, credit: 0 },
    );

    if (totals.debit !== totals.credit) {
      throw new FinanceServiceError(
        "La poliza no esta balanceada: debitos y creditos deben ser iguales.",
        400,
      );
    }

    return normalized;
  }

  async function buildBalances({ companyId }) {
    const baseCurrency = await getBaseCurrency();
    const accounts = await prisma.financeAccount.findMany({
      where: { companyId, enabled: true },
      orderBy: [{ code: "asc" }, { name: "asc" }],
    });

    if (accounts.length === 0) {
      return {
        data: [],
        totals: {
          debit: "0.00",
          credit: "0.00",
          net: "0.00",
        },
        totalsBase: {
          debit: "0.00",
          credit: "0.00",
          net: "0.00",
          currency: baseCurrency,
        },
        baseCurrency,
      };
    }

    const accountIds = accounts.map((account) => account.id);
    const lines = await prisma.financeJournalLine.findMany({
      where: {
        accountId: { in: accountIds },
        enabled: true,
        entry: {
          companyId,
          enabled: true,
        },
      },
      select: {
        accountId: true,
        debit: true,
        credit: true,
        currency: true,
        fxRate: true,
        baseAmount: true,
      },
    });

    const byAccount = new Map(
      accounts.map((account) => [
        account.id,
        { debit: 0, credit: 0, baseDebit: 0, baseCredit: 0 },
      ]),
    );
    let totalDebit = 0;
    let totalCredit = 0;
    let totalBaseDebit = 0;
    let totalBaseCredit = 0;

    for (const line of lines) {
      const debit = parseAmountToCents(line.debit);
      const credit = parseAmountToCents(line.credit);
      const bucket = byAccount.get(line.accountId);
      if (!bucket) continue;
      bucket.debit += debit;
      bucket.credit += credit;
      totalDebit += debit;
      totalCredit += credit;

      const signedOriginal = debit - credit;
      const storedBase = decimalToCents(line.baseAmount);
      const fxRate = line.fxRate ? Number(line.fxRate) : null;
      const signedBase =
        storedBase !== null
          ? storedBase
          : line.currency === baseCurrency
            ? signedOriginal
            : fxRate && Number.isFinite(fxRate)
              ? Math.round((signedOriginal / 100) * fxRate * 100)
              : 0;
      if (signedBase > 0) {
        bucket.baseDebit += signedBase;
        totalBaseDebit += signedBase;
      } else if (signedBase < 0) {
        bucket.baseCredit += Math.abs(signedBase);
        totalBaseCredit += Math.abs(signedBase);
      }
    }

    const data = accounts.map((account) => {
      const bucket = byAccount.get(account.id) ?? { debit: 0, credit: 0 };
      const net = bucket.debit - bucket.credit;
      const baseNet = bucket.baseDebit - bucket.baseCredit;
      return {
        id: account.id,
        code: account.code,
        name: account.name,
        type: account.type,
        currency: account.currency,
        totals: {
          debit: centsToDecimalString(bucket.debit),
          credit: centsToDecimalString(bucket.credit),
          net: centsToDecimalString(net),
        },
        totalsBase: {
          debit: centsToDecimalString(bucket.baseDebit),
          credit: centsToDecimalString(bucket.baseCredit),
          net: centsToDecimalString(baseNet),
          currency: baseCurrency,
        },
      };
    });

    return {
      data,
      baseCurrency,
      totals: {
        debit: centsToDecimalString(totalDebit),
        credit: centsToDecimalString(totalCredit),
        net: centsToDecimalString(totalDebit - totalCredit),
      },
      totalsBase: {
        debit: centsToDecimalString(totalBaseDebit),
        credit: centsToDecimalString(totalBaseCredit),
        net: centsToDecimalString(totalBaseDebit - totalBaseCredit),
        currency: baseCurrency,
      },
    };
  }

  async function aggregatePeriod({ companyId, baseCurrency, fromDate, toDate }) {
    const lines = await prisma.financeJournalLine.findMany({
      where: {
        enabled: true,
        entry: {
          companyId,
          enabled: true,
          occurredAt: { gte: fromDate, lte: toDate },
        },
        account: {
          enabled: true,
        },
      },
      select: {
        debit: true,
        credit: true,
        currency: true,
        fxRate: true,
        baseAmount: true,
        account: {
          select: { type: true },
        },
        entry: {
          select: { occurredAt: true },
        },
      },
    });

    let incomeBase = 0;
    let expenseBase = 0;
    let totalBaseDebit = 0;
    let totalBaseCredit = 0;

    const byDay = new Map();

    for (const line of lines) {
      const debit = parseAmountToCents(line.debit);
      const credit = parseAmountToCents(line.credit);
      const signedOriginal = debit - credit;
      const storedBase = decimalToCents(line.baseAmount);
      const fxRate = line.fxRate ? Number(line.fxRate) : null;
      const signedBase =
        storedBase !== null
          ? storedBase
          : line.currency === baseCurrency
            ? signedOriginal
            : fxRate && Number.isFinite(fxRate)
              ? Math.round((signedOriginal / 100) * fxRate * 100)
              : 0;

      if (signedBase > 0) totalBaseDebit += signedBase;
      if (signedBase < 0) totalBaseCredit += Math.abs(signedBase);

      const type = String(line.account?.type ?? "").toUpperCase();
      if (type === "INGRESO") {
        if (signedBase < 0) incomeBase += Math.abs(signedBase);
      } else if (type === "EGRESO" || type === "COSTO") {
        if (signedBase > 0) expenseBase += signedBase;
      }

      const dayKey = formatYmd(toStartOfDayUtc(line.entry.occurredAt));
      const bucket = byDay.get(dayKey) ?? { income: 0, expense: 0 };
      if (type === "INGRESO" && signedBase < 0) {
        bucket.income += Math.abs(signedBase);
      } else if ((type === "EGRESO" || type === "COSTO") && signedBase > 0) {
        bucket.expense += signedBase;
      }
      byDay.set(dayKey, bucket);
    }

    const netIncomeBase = incomeBase - expenseBase;

    return {
      totalsBase: {
        debit: decimalStringFromCents(totalBaseDebit),
        credit: decimalStringFromCents(totalBaseCredit),
        net: decimalStringFromCents(totalBaseDebit - totalBaseCredit),
        currency: baseCurrency,
      },
      statementBase: {
        income: decimalStringFromCents(incomeBase),
        expense: decimalStringFromCents(expenseBase),
        netIncome: decimalStringFromCents(netIncomeBase),
        currency: baseCurrency,
      },
      trend: [...byDay.entries()]
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([date, data]) => ({
          date,
          income: decimalStringFromCents(data.income),
          expense: decimalStringFromCents(data.expense),
          net: decimalStringFromCents(data.income - data.expense),
          currency: baseCurrency,
        })),
      linesCount: lines.length,
      convertedLinesCount: lines.filter((line) => line.currency !== baseCurrency)
        .length,
    };
  }

  function buildVariance(currentValue, previousValue) {
    const current = Number(currentValue ?? 0);
    const previous = Number(previousValue ?? 0);
    const delta = current - previous;
    const percent =
      previous === 0 ? null : Number(((delta / previous) * 100).toFixed(2));
    return {
      current: current.toFixed(2),
      previous: previous.toFixed(2),
      delta: delta.toFixed(2),
      percent,
    };
  }

  return {
    async listAccounts({ authUserId, search, limit }) {
      const { companyId } = await getCompanyContext(authUserId);
      const take = normalizeLimit(limit, 100, 200);
      const rows = await prisma.financeAccount.findMany({
        where: {
          companyId,
          ...buildSearchWhere(search),
        },
        orderBy: [{ code: "asc" }, { name: "asc" }],
        take,
      });
      return rows;
    },

    async createAccount({ authUserId, payload }) {
      const { companyId } = await getCompanyContext(authUserId);
      return prisma.financeAccount.create({
        data: {
          companyId,
          code: String(payload.code).trim(),
          name: String(payload.name).trim(),
          type: String(payload.type).trim(),
          currency: normalizeCurrency(payload.currency, "MXN"),
          initialBalance: centsToDecimalString(parseAmountToCents(payload.initialBalance)),
        },
      });
    },

    async updateAccount({ authUserId, id, payload }) {
      const { companyId } = await getCompanyContext(authUserId);
      await assertAccountOwnership({ id, companyId });
      const data = {};
      if (payload.code !== undefined) data.code = String(payload.code).trim();
      if (payload.name !== undefined) data.name = String(payload.name).trim();
      if (payload.type !== undefined) data.type = String(payload.type).trim();
      if (payload.currency !== undefined) {
        data.currency = normalizeCurrency(payload.currency, "MXN");
      }
      if (payload.initialBalance !== undefined) {
        data.initialBalance = centsToDecimalString(
          parseAmountToCents(payload.initialBalance),
        );
      }
      return prisma.financeAccount.update({
        where: { id },
        data,
      });
    },

    async setAccountEnabled({ authUserId, id, enabled }) {
      const { companyId } = await getCompanyContext(authUserId);
      await assertAccountOwnership({ id, companyId });
      return prisma.financeAccount.update({
        where: { id },
        data: { enabled: Boolean(enabled) },
      });
    },

    async listEntries({ authUserId, limit }) {
      const { companyId } = await getCompanyContext(authUserId);
      const baseCurrency = await getBaseCurrency();
      const take = normalizeLimit(limit, 50, 200);
      const rows = await prisma.financeJournalEntry.findMany({
        where: { companyId },
        orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
        take,
        include: {
          lines: {
            include: {
              account: {
                select: { id: true, code: true, name: true, type: true },
              },
            },
            orderBy: { createdAt: "asc" },
          },
        },
      });
      return rows.map((entry) => toEntryWithFxSummary(entry, baseCurrency));
    },

    async getEntryById({ authUserId, id }) {
      const { companyId } = await getCompanyContext(authUserId);
      const baseCurrency = await getBaseCurrency();
      const entry = await prisma.financeJournalEntry.findFirst({
        where: { id, companyId },
        include: {
          lines: {
            include: {
              account: {
                select: { id: true, code: true, name: true, type: true },
              },
            },
            orderBy: { createdAt: "asc" },
          },
        },
      });
      if (!entry) {
        throw new FinanceServiceError("Poliza no encontrada.", 404);
      }
      return toEntryWithFxSummary(entry, baseCurrency);
    },

    async createEntry({ authUserId, payload }) {
      const { companyId } = await getCompanyContext(authUserId);
      const baseCurrency = await getBaseCurrency();
      const occurredAt = parseOccurredAt(payload.occurredAt);
      const lines = normalizeEntryLines(payload.lines ?? []);
      const accountIds = [...new Set(lines.map((line) => line.accountId))];
      const companyAccountIds = await getAccountIdsByCompany({
        companyId,
        ids: accountIds,
      });
      if (companyAccountIds.size !== accountIds.length) {
        throw new FinanceServiceError(
          "Una o mas cuentas no existen o no pertenecen a tu empresa.",
          400,
        );
      }

      const convertedLines = [];
      for (const line of lines) {
        const signedOriginalCents = line.debitCents - line.creditCents;
        const fxResolution = await resolveFxRateForDate({
          companyId,
          fromCurrency: line.currency,
          toCurrency: baseCurrency,
          occurredAt,
        });
        const signedBaseCents = Math.round((signedOriginalCents / 100) * fxResolution.rate * 100);
        convertedLines.push({
          ...line,
          fxRate: fxResolution.rate,
          baseAmount: decimalStringFromCents(signedBaseCents),
          fxTrace: {
            fxRateId: fxResolution.fxRateId,
            sourceCurrency: fxResolution.sourceCurrency,
            targetCurrency: fxResolution.targetCurrency,
            inverted: fxResolution.inverted,
            rateDate: fxResolution.rateDate,
            baseCurrency,
          },
        });
      }

      return prisma.financeJournalEntry.create({
        data: {
          companyId,
          entryNumber: buildEntryNumber(),
          occurredAt,
          concept: String(payload.concept).trim(),
          reference: payload.reference
            ? String(payload.reference).trim()
            : null,
          currency: normalizeCurrency(payload.currency, "MXN"),
          sourceType: payload.sourceType
            ? String(payload.sourceType).trim()
            : "manual",
          lines: {
            create: convertedLines.map((line) => ({
              accountId: line.accountId,
              contactId: line.contactId,
              debit: centsToDecimalString(line.debitCents),
              credit: centsToDecimalString(line.creditCents),
              currency: line.currency,
              note: line.note,
              fxRate: line.fxRate.toFixed(8),
              baseAmount: line.baseAmount,
              metadata: {
                fxTrace: line.fxTrace,
              },
            })),
          },
        },
        include: {
          lines: true,
        },
      });
    },

    async setEntryEnabled({ authUserId, id, enabled }) {
      const { companyId } = await getCompanyContext(authUserId);
      const entry = await prisma.financeJournalEntry.findFirst({
        where: { id, companyId },
        select: { id: true },
      });
      if (!entry) {
        throw new FinanceServiceError("Poliza no encontrada.", 404);
      }
      return prisma.financeJournalEntry.update({
        where: { id },
        data: { enabled: Boolean(enabled) },
      });
    },

    async getBalances({ authUserId }) {
      const { companyId } = await getCompanyContext(authUserId);
      return buildBalances({ companyId });
    },

    async listFxRates({ authUserId, baseCurrency, quoteCurrency, limit }) {
      const { companyId } = await getCompanyContext(authUserId);
      const take = normalizeLimit(limit, 100, 300);
      const where = { companyId };
      if (baseCurrency) where.baseCurrency = normalizeCurrency(baseCurrency);
      if (quoteCurrency) where.quoteCurrency = normalizeCurrency(quoteCurrency);
      return prisma.financeFxRate.findMany({
        where,
        orderBy: [{ rateDate: "desc" }, { createdAt: "desc" }],
        take,
      });
    },

    async createFxRate({ authUserId, payload }) {
      const { companyId } = await getCompanyContext(authUserId);
      const baseCurrency = normalizeCurrency(payload.baseCurrency);
      const quoteCurrency = normalizeCurrency(payload.quoteCurrency);
      if (baseCurrency === quoteCurrency) {
        throw new FinanceServiceError(
          "La moneda base y la moneda destino deben ser distintas.",
          400,
        );
      }
      const rateDate = parseFxRateDate(payload.rateDate);
      const rate = Number(payload.rate);
      if (!Number.isFinite(rate) || rate <= 0) {
        throw new FinanceServiceError("La tasa debe ser mayor a cero.", 400);
      }
      return prisma.financeFxRate.upsert({
        where: {
          companyId_baseCurrency_quoteCurrency_rateDate: {
            companyId,
            baseCurrency,
            quoteCurrency,
            rateDate,
          },
        },
        create: {
          companyId,
          baseCurrency,
          quoteCurrency,
          rateDate,
          rate: rate.toFixed(8),
          source: payload.source ? String(payload.source).trim() : "manual",
          enabled: true,
        },
        update: {
          rate: rate.toFixed(8),
          source: payload.source ? String(payload.source).trim() : "manual",
          enabled: true,
        },
      });
    },

    async setFxRateEnabled({ authUserId, id, enabled }) {
      const { companyId } = await getCompanyContext(authUserId);
      await assertFxRateOwnership({ id, companyId });
      return prisma.financeFxRate.update({
        where: { id },
        data: { enabled: Boolean(enabled) },
      });
    },

    async getDashboard({ authUserId, from, to }) {
      const { companyId } = await getCompanyContext(authUserId);
      const baseCurrency = await getBaseCurrency();
      const { fromDate, toDate } = parseDashboardWindow(from, to);

      const rangeMs = toDate.getTime() - fromDate.getTime();
      const previousTo = new Date(fromDate.getTime() - 1);
      const previousFrom = new Date(previousTo.getTime() - rangeMs);

      const current = await aggregatePeriod({
        companyId,
        baseCurrency,
        fromDate,
        toDate,
      });
      const previous = await aggregatePeriod({
        companyId,
        baseCurrency,
        fromDate: previousFrom,
        toDate: previousTo,
      });

      return {
        window: {
          from: fromDate.toISOString(),
          to: toDate.toISOString(),
          previousFrom: previousFrom.toISOString(),
          previousTo: previousTo.toISOString(),
        },
        currency: baseCurrency,
        kpi: {
          ...current.statementBase,
          linesCount: current.linesCount,
          convertedLinesCount: current.convertedLinesCount,
        },
        balances: current.totalsBase,
        trend: current.trend,
        variance: {
          income: buildVariance(
            current.statementBase.income,
            previous.statementBase.income,
          ),
          expense: buildVariance(
            current.statementBase.expense,
            previous.statementBase.expense,
          ),
          netIncome: buildVariance(
            current.statementBase.netIncome,
            previous.statementBase.netIncome,
          ),
        },
      };
    },
  };
}

export { FinanceServiceError };
