class LedgerServiceError extends Error {
  constructor(message, status = 500) {
    super(message);
    this.name = "LedgerServiceError";
    this.status = status;
  }
}

function nullableString(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const s = String(value).trim();
  return s.length > 0 ? s : null;
}

function buildMovementWhere(companyId, filters = {}) {
  const where = { companyId };
  if (filters.accountId) where.accountId = filters.accountId;
  if (filters.direction) where.direction = filters.direction;
  if (filters.status) where.status = filters.status;
  if (filters.dateFrom || filters.dateTo) {
    where.occurredAt = {};
    if (filters.dateFrom) where.occurredAt.gte = new Date(filters.dateFrom);
    if (filters.dateTo) where.occurredAt.lte = new Date(filters.dateTo);
  }
  if (filters.amountMin !== undefined || filters.amountMax !== undefined) {
    where.amount = {};
    if (filters.amountMin !== undefined) where.amount.gte = filters.amountMin;
    if (filters.amountMax !== undefined) where.amount.lte = filters.amountMax;
  }
  const textFilters = [];
  if (filters.name) textFilters.push({ name: { contains: filters.name, mode: "insensitive" } });
  if (filters.reference) textFilters.push({ reference: { contains: filters.reference, mode: "insensitive" } });
  if (filters.concept) textFilters.push({ concept: { contains: filters.concept, mode: "insensitive" } });
  if (textFilters.length > 0) where.OR = textFilters;
  return where;
}

async function recalcBalancesAfterCancellation(prisma, accountId, cancelledMovement) {
  const account = await prisma.ledgerAccount.findUnique({ where: { id: accountId } });
  if (!account) return;

  const previousActive = await prisma.ledgerMovement.findFirst({
    where: {
      accountId,
      status: "ACTIVE",
      OR: [
        { occurredAt: { lt: cancelledMovement.occurredAt } },
        {
          occurredAt: cancelledMovement.occurredAt,
          sequenceNumber: { lt: cancelledMovement.sequenceNumber },
        },
      ],
    },
    orderBy: [{ occurredAt: "desc" }, { sequenceNumber: "desc" }],
  });

  let runningBalance = previousActive
    ? Number(previousActive.balanceAfter)
    : Number(account.initialBalance);

  const subsequent = await prisma.ledgerMovement.findMany({
    where: {
      accountId,
      status: "ACTIVE",
      OR: [
        { occurredAt: { gt: cancelledMovement.occurredAt } },
        {
          occurredAt: cancelledMovement.occurredAt,
          sequenceNumber: { gt: cancelledMovement.sequenceNumber },
        },
      ],
    },
    orderBy: [{ occurredAt: "asc" }, { sequenceNumber: "asc" }],
  });

  for (const mv of subsequent) {
    const amt = Number(mv.amount);
    runningBalance = mv.direction === "INCOME" ? runningBalance + amt : runningBalance - amt;
    await prisma.ledgerMovement.update({
      where: { id: mv.id },
      data: { balanceAfter: runningBalance },
    });
  }

  const lastActive = subsequent.length > 0
    ? subsequent[subsequent.length - 1]
    : previousActive;
  const newCurrentBalance = lastActive
    ? (subsequent.length > 0 ? runningBalance : Number(lastActive.balanceAfter))
    : Number(account.initialBalance);

  await prisma.ledgerAccount.update({
    where: { id: accountId },
    data: { currentBalance: newCurrentBalance },
  });
}

function createLedgerService({ prisma }) {
  async function getCompanyIdForUser(authUserId) {
    const profile = await prisma.userProfile.findUnique({ where: { authUserId } });
    if (!profile) throw new LedgerServiceError("Perfil de usuario no encontrado.", 401);
    const membership = await prisma.membership.findFirst({
      where: { userId: profile.id, enabled: true },
    });
    if (!membership) throw new LedgerServiceError("Sin empresa activa.", 403);
    return { companyId: membership.companyId, userId: profile.id };
  }

  async function listAccounts({ authUserId, enabled, search }) {
    const { companyId } = await getCompanyIdForUser(authUserId);
    const where = { companyId };
    if (enabled !== undefined) where.enabled = enabled;
    if (search) where.name = { contains: String(search), mode: "insensitive" };
    return prisma.ledgerAccount.findMany({
      where,
      orderBy: [{ name: "asc" }],
    });
  }

  async function createAccount({ authUserId, payload }) {
    const { companyId, userId } = await getCompanyIdForUser(authUserId);
    const existing = await prisma.ledgerAccount.findFirst({
      where: { companyId, name: payload.name },
    });
    if (existing) throw new LedgerServiceError("Ya existe una cuenta con ese nombre.", 409);
    const balance = Number(payload.initialBalance ?? 0);
    return prisma.ledgerAccount.create({
      data: {
        companyId,
        name: payload.name.trim(),
        type: payload.type,
        currency: payload.currency ?? "MXN",
        initialBalance: balance,
        currentBalance: balance,
        description: nullableString(payload.description),
        createdById: userId,
      },
    });
  }

  async function getAccount({ authUserId, id }) {
    const { companyId } = await getCompanyIdForUser(authUserId);
    const account = await prisma.ledgerAccount.findFirst({ where: { id, companyId } });
    if (!account) throw new LedgerServiceError("Cuenta no encontrada.", 404);
    return account;
  }

  async function updateAccount({ authUserId, id, payload }) {
    const { companyId } = await getCompanyIdForUser(authUserId);
    const account = await prisma.ledgerAccount.findFirst({ where: { id, companyId } });
    if (!account) throw new LedgerServiceError("Cuenta no encontrada.", 404);

    if (payload.name && payload.name !== account.name) {
      const conflict = await prisma.ledgerAccount.findFirst({
        where: { companyId, name: payload.name, id: { not: id } },
      });
      if (conflict) throw new LedgerServiceError("Ya existe una cuenta con ese nombre.", 409);
    }

    return prisma.ledgerAccount.update({
      where: { id },
      data: {
        ...(payload.name !== undefined && { name: payload.name.trim() }),
        ...(payload.type !== undefined && { type: payload.type }),
        ...(payload.description !== undefined && { description: nullableString(payload.description) }),
      },
    });
  }

  async function setAccountEnabled({ authUserId, id, enabled }) {
    const { companyId } = await getCompanyIdForUser(authUserId);
    const account = await prisma.ledgerAccount.findFirst({ where: { id, companyId } });
    if (!account) throw new LedgerServiceError("Cuenta no encontrada.", 404);
    return prisma.ledgerAccount.update({ where: { id }, data: { enabled } });
  }

  async function listAccountMovements({ authUserId, accountId, filters }) {
    const { companyId } = await getCompanyIdForUser(authUserId);
    const account = await prisma.ledgerAccount.findFirst({ where: { id: accountId, companyId } });
    if (!account) throw new LedgerServiceError("Cuenta no encontrada.", 404);

    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.min(500, Math.max(1, filters.pageSize ?? 50));
    const skip = (page - 1) * pageSize;
    const orderBy = [
      { [filters.orderBy ?? "occurredAt"]: filters.orderDir ?? "asc" },
      { sequenceNumber: filters.orderDir ?? "asc" },
    ];

    const where = buildMovementWhere(companyId, { ...filters, accountId });
    const [movements, total] = await Promise.all([
      prisma.ledgerMovement.findMany({ where, orderBy, skip, take: pageSize }),
      prisma.ledgerMovement.count({ where }),
    ]);

    const summaryWhere = buildMovementWhere(companyId, { ...filters, accountId, status: "ACTIVE" });
    const activeMovements = await prisma.ledgerMovement.findMany({
      where: summaryWhere,
      select: { direction: true, amount: true, balanceAfter: true, occurredAt: true, sequenceNumber: true },
      orderBy,
    });

    let totalIncome = 0;
    let totalExpense = 0;
    for (const mv of activeMovements) {
      const amt = Number(mv.amount);
      if (mv.direction === "INCOME") totalIncome += amt;
      else totalExpense += amt;
    }

    let openingBalance = Number(account.initialBalance);
    if (filters.dateFrom) {
      const prevActive = await prisma.ledgerMovement.findFirst({
        where: {
          accountId,
          companyId,
          status: "ACTIVE",
          occurredAt: { lt: new Date(filters.dateFrom) },
        },
        orderBy: [{ occurredAt: "desc" }, { sequenceNumber: "desc" }],
      });
      if (prevActive) openingBalance = Number(prevActive.balanceAfter);
    }

    const lastActive = activeMovements[activeMovements.length - 1];
    const closingBalance = lastActive ? Number(lastActive.balanceAfter) : openingBalance;

    return {
      account: { id: account.id, name: account.name, currency: account.currency, currentBalance: Number(account.currentBalance) },
      movements,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
      summary: { totalIncome, totalExpense, openingBalance, closingBalance },
    };
  }

  async function createMovement({ authUserId, accountId, payload }) {
    const { companyId, userId } = await getCompanyIdForUser(authUserId);

    return prisma.$transaction(async (tx) => {
      const account = await tx.ledgerAccount.findFirst({ where: { id: accountId, companyId } });
      if (!account) throw new LedgerServiceError("Cuenta no encontrada.", 404);

      const maxSeq = await tx.ledgerMovement.aggregate({
        where: { accountId },
        _max: { sequenceNumber: true },
      });
      const sequenceNumber = (maxSeq._max.sequenceNumber ?? 0) + 1;

      const currentBalance = Number(account.currentBalance);
      const amount = Number(payload.amount);
      const balanceAfter =
        payload.direction === "INCOME" ? currentBalance + amount : currentBalance - amount;

      const movement = await tx.ledgerMovement.create({
        data: {
          companyId,
          accountId,
          sequenceNumber,
          occurredAt: new Date(payload.occurredAt),
          direction: payload.direction,
          movementType: nullableString(payload.movementType),
          number: nullableString(payload.number),
          name: nullableString(payload.name),
          reference: nullableString(payload.reference),
          concept: payload.concept.trim(),
          amount,
          balanceAfter,
          status: "ACTIVE",
          createdById: userId,
        },
      });

      await tx.ledgerAccount.update({
        where: { id: accountId },
        data: { currentBalance: balanceAfter },
      });

      return movement;
    });
  }

  async function cancelMovement({ authUserId, movementId, reason }) {
    const { companyId, userId } = await getCompanyIdForUser(authUserId);
    const movement = await prisma.ledgerMovement.findFirst({
      where: { id: movementId, companyId },
    });
    if (!movement) throw new LedgerServiceError("Movimiento no encontrado.", 404);
    if (movement.status === "CANCELLED") throw new LedgerServiceError("El movimiento ya fue cancelado.", 409);

    const cancelled = await prisma.ledgerMovement.update({
      where: { id: movementId },
      data: {
        status: "CANCELLED",
        cancellationReason: reason.trim(),
        cancelledAt: new Date(),
        cancelledById: userId,
      },
    });

    await recalcBalancesAfterCancellation(prisma, movement.accountId, movement);
    return cancelled;
  }

  async function listAllMovements({ authUserId, filters }) {
    const { companyId } = await getCompanyIdForUser(authUserId);
    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.min(500, Math.max(1, filters.pageSize ?? 50));
    const skip = (page - 1) * pageSize;
    const orderBy = [
      { [filters.orderBy ?? "occurredAt"]: filters.orderDir ?? "asc" },
      { sequenceNumber: filters.orderDir ?? "asc" },
    ];

    const where = buildMovementWhere(companyId, filters);
    const [movements, total] = await Promise.all([
      prisma.ledgerMovement.findMany({
        where,
        orderBy,
        skip,
        take: pageSize,
        include: { account: { select: { name: true, currency: true } } },
      }),
      prisma.ledgerMovement.count({ where }),
    ]);

    return {
      movements,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  async function getSummary({ authUserId }) {
    const { companyId } = await getCompanyIdForUser(authUserId);
    const [totalAccounts, enabledAccounts, mxnAccounts, movementsThisMonth] =
      await Promise.all([
        prisma.ledgerAccount.count({ where: { companyId } }),
        prisma.ledgerAccount.count({ where: { companyId, enabled: true } }),
        prisma.ledgerAccount.findMany({
          where: { companyId, enabled: true, currency: "MXN" },
          select: { currentBalance: true },
        }),
        prisma.ledgerMovement.count({
          where: {
            companyId,
            createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
          },
        }),
      ]);

    const totalCurrentBalance = mxnAccounts.reduce((sum, a) => sum + Number(a.currentBalance), 0);
    return { totalAccounts, enabledAccounts, totalCurrentBalance, balanceCurrency: "MXN", movementsThisMonth };
  }

  async function getReportSummary({ authUserId, filters }) {
    const { companyId } = await getCompanyIdForUser(authUserId);
    const where = buildMovementWhere(companyId, filters);
    const activeWhere = { ...where, status: "ACTIVE" };
    const [activeMovements, cancelledCount] = await Promise.all([
      prisma.ledgerMovement.findMany({
        where: activeWhere,
        select: { direction: true, amount: true, balanceAfter: true, occurredAt: true, sequenceNumber: true },
        orderBy: [{ occurredAt: "asc" }, { sequenceNumber: "asc" }],
      }),
      prisma.ledgerMovement.count({ where: { ...where, status: "CANCELLED" } }),
    ]);

    let totalIncome = 0;
    let totalExpense = 0;
    for (const mv of activeMovements) {
      const amt = Number(mv.amount);
      if (mv.direction === "INCOME") totalIncome += amt;
      else totalExpense += amt;
    }

    let openingBalance = 0;
    if (filters.accountId && filters.dateFrom) {
      const prevActive = await prisma.ledgerMovement.findFirst({
        where: {
          accountId: filters.accountId,
          companyId,
          status: "ACTIVE",
          occurredAt: { lt: new Date(filters.dateFrom) },
        },
        orderBy: [{ occurredAt: "desc" }, { sequenceNumber: "desc" }],
      });
      if (prevActive) {
        openingBalance = Number(prevActive.balanceAfter);
      } else {
        const acct = await prisma.ledgerAccount.findFirst({ where: { id: filters.accountId, companyId } });
        if (acct) openingBalance = Number(acct.initialBalance);
      }
    }

    const lastActive = activeMovements[activeMovements.length - 1];
    const closingBalance = lastActive ? Number(lastActive.balanceAfter) : openingBalance;

    return {
      totalIncome,
      totalExpense,
      openingBalance,
      closingBalance,
      activeMovements: activeMovements.length,
      cancelledMovements: cancelledCount,
    };
  }

  async function getMovementsForExport({ authUserId, accountId, filters }) {
    const { companyId } = await getCompanyIdForUser(authUserId);
    const where = buildMovementWhere(companyId, { ...filters, ...(accountId ? { accountId } : {}) });

    let account = null;
    if (accountId) {
      account = await prisma.ledgerAccount.findFirst({ where: { id: accountId, companyId } });
      if (!account) throw new LedgerServiceError("Cuenta no encontrada.", 404);
    }

    const movements = await prisma.ledgerMovement.findMany({
      where,
      orderBy: [{ occurredAt: "asc" }, { sequenceNumber: "asc" }],
      include: accountId ? undefined : { account: { select: { name: true, currency: true } } },
    });

    let openingBalance = account ? Number(account.initialBalance) : 0;
    if (account && filters.dateFrom) {
      const prev = await prisma.ledgerMovement.findFirst({
        where: { accountId, companyId, status: "ACTIVE", occurredAt: { lt: new Date(filters.dateFrom) } },
        orderBy: [{ occurredAt: "desc" }, { sequenceNumber: "desc" }],
      });
      if (prev) openingBalance = Number(prev.balanceAfter);
    }

    let totalIncome = 0;
    let totalExpense = 0;
    for (const mv of movements) {
      if (mv.status === "ACTIVE") {
        const amt = Number(mv.amount);
        if (mv.direction === "INCOME") totalIncome += amt;
        else totalExpense += amt;
      }
    }

    const lastActive = [...movements].reverse().find((m) => m.status === "ACTIVE");
    const closingBalance = lastActive ? Number(lastActive.balanceAfter) : openingBalance;

    return { account, movements, openingBalance, closingBalance, totalIncome, totalExpense };
  }

  return {
    listAccounts,
    createAccount,
    getAccount,
    updateAccount,
    setAccountEnabled,
    listAccountMovements,
    createMovement,
    cancelMovement,
    listAllMovements,
    getSummary,
    getReportSummary,
    getMovementsForExport,
  };
}

export { createLedgerService, LedgerServiceError };
