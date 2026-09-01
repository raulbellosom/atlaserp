// apps/api/src/routes/pfm/wallets-service.js
import { toLocalIso, toLocalMonth } from "@atlas/core";
import {
  PfmServiceError,
  isTableNotFoundError,
  firstRow,
  toPlainNumber,
} from "./service-helpers.js";

const NOT_INSTALLED = "El modulo de finanzas personales no esta instalado.";

export function createWalletsService({ prisma, calendarBridge = null }) {
  async function listWallets({ companyId, actorId }) {
    if (!actorId) throw new PfmServiceError("Se requiere un usuario autenticado.", 401);
    try {
      const rows = await prisma.$queryRaw`
        SELECT w.*,
          w.opening_balance + COALESCE(
            SUM(m.amount * CASE WHEN m.direction = 'INCOME' THEN 1 ELSE -1 END)
              FILTER (WHERE m.enabled = true AND m.status = 'POSTED'),
            0
          ) AS current_balance,
          (w.owner_id = ${actorId}::uuid) AS is_owner
        FROM pfm_wallet w
        LEFT JOIN pfm_movement m ON m.wallet_id = w.id
        WHERE w.company_id = ${companyId}::uuid
          AND w.enabled = true
          AND (
            w.owner_id = ${actorId}::uuid
            OR EXISTS (
              SELECT 1 FROM pfm_wallet_member m2
              WHERE m2.wallet_id = w.id AND m2.user_id = ${actorId}::uuid
            )
          )
        GROUP BY w.id
        ORDER BY w.name
      `;
      return { data: rows.map(normalizeWalletRow) };
    } catch (err) {
      if (isTableNotFoundError(err)) throw new PfmServiceError(NOT_INSTALLED, 503);
      throw err;
    }
  }

  async function getWallet({ companyId, walletId, actorId }) {
    if (!actorId) throw new PfmServiceError("Se requiere un usuario autenticado.", 401);
    try {
      const rows = await prisma.$queryRaw`
        SELECT w.*,
          w.opening_balance + COALESCE(
            SUM(m.amount * CASE WHEN m.direction = 'INCOME' THEN 1 ELSE -1 END)
              FILTER (WHERE m.enabled = true AND m.status = 'POSTED'),
            0
          ) AS current_balance,
          (w.owner_id = ${actorId}::uuid) AS is_owner,
          (
            w.owner_id = ${actorId}::uuid
            OR EXISTS (
              SELECT 1 FROM pfm_wallet_member m2
              WHERE m2.wallet_id = w.id AND m2.user_id = ${actorId}::uuid AND m2.role = 'EDITOR'
            )
          ) AS can_write
        FROM pfm_wallet w
        LEFT JOIN pfm_movement m ON m.wallet_id = w.id
        WHERE w.id = ${walletId}::uuid
          AND w.company_id = ${companyId}::uuid
          AND w.enabled = true
          AND (
            w.owner_id = ${actorId}::uuid
            OR EXISTS (
              SELECT 1 FROM pfm_wallet_member m2
              WHERE m2.wallet_id = w.id AND m2.user_id = ${actorId}::uuid
            )
          )
        GROUP BY w.id
      `;
      const row = firstRow(rows);
      if (!row) throw new PfmServiceError("Cartera no encontrada.", 404);
      const wallet = normalizeWalletRow(row);
      if (wallet.kind === "CREDIT" && wallet.statementDay) {
        const movs = await prisma.pfmMovement.findMany({
          where: { walletId, enabled: true, status: "POSTED" },
          select: { direction: true, amount: true, occurredOn: true, status: true },
        });
        wallet.creditCycle = computeCreditCycle(wallet, movs);
      }
      if (wallet.kind === "INVESTMENT") {
        const monthStart = `${toLocalMonth()}-01`;
        const agg = await prisma.pfmMovement.aggregate({
          _sum: { amount: true },
          where: {
            walletId,
            enabled: true,
            status: "POSTED",
            isYield: true,
            occurredOn: { gte: new Date(`${monthStart}T00:00:00.000Z`) },
          },
        });
        wallet.accruedThisMonth = toPlainNumber(agg._sum.amount ?? 0);
      }
      return wallet;
    } catch (err) {
      if (err instanceof PfmServiceError) throw err;
      if (isTableNotFoundError(err)) throw new PfmServiceError(NOT_INSTALLED, 503);
      throw err;
    }
  }

  async function canReadWallet({ companyId, walletId, actorId }) {
    if (!actorId) return false;
    const rows = await prisma.$queryRaw`
      SELECT 1 FROM pfm_wallet w
      WHERE w.id = ${walletId}::uuid AND w.company_id = ${companyId}::uuid AND w.enabled = true
        AND (
          w.owner_id = ${actorId}::uuid
          OR EXISTS (
            SELECT 1 FROM pfm_wallet_member m WHERE m.wallet_id = w.id AND m.user_id = ${actorId}::uuid
          )
        )
      LIMIT 1
    `;
    return rows.length > 0;
  }

  async function canWriteWallet({ companyId, walletId, actorId }) {
    if (!actorId) return false;
    const rows = await prisma.$queryRaw`
      SELECT 1 FROM pfm_wallet w
      WHERE w.id = ${walletId}::uuid AND w.company_id = ${companyId}::uuid AND w.enabled = true
        AND (
          w.owner_id = ${actorId}::uuid
          OR EXISTS (
            SELECT 1 FROM pfm_wallet_member m
            WHERE m.wallet_id = w.id AND m.user_id = ${actorId}::uuid AND m.role = 'EDITOR'
          )
        )
      LIMIT 1
    `;
    return rows.length > 0;
  }

  async function isWalletOwner({ companyId, walletId, actorId }) {
    if (!actorId) return false;
    const wallet = await prisma.pfmWallet.findFirst({
      where: { id: walletId, companyId, ownerId: actorId, enabled: true },
      select: { id: true },
    });
    return Boolean(wallet);
  }

  async function createWallet({ companyId, ownerId, data }) {
    if (!ownerId) throw new PfmServiceError("Se requiere un usuario autenticado.", 401);
    try {
      const isCredit = data.kind === "CREDIT";
      const isInvestment = data.kind === "INVESTMENT";
      const openingBalance = isCredit
        ? -(data.openingUsed ?? 0)
        : (data.openingBalance ?? 0);
      const todayDate = new Date(`${toLocalIso()}T00:00:00.000Z`);
      const wallet = await prisma.pfmWallet.create({
        data: {
          companyId,
          ownerId,
          name: data.name,
          kind: data.kind,
          currency: data.currency ?? "MXN",
          openingBalance,
          color: data.color ?? null,
          icon: data.icon ?? null,
          ledgerAccountId: data.ledgerAccountId ?? null,
          reference: data.reference ?? null,
          creditLimit: isCredit ? (data.creditLimit ?? null) : null,
          statementDay: isCredit ? (data.statementDay ?? null) : null,
          paymentDueDay: isCredit ? (data.paymentDueDay ?? null) : null,
          expectedRate: isInvestment ? (data.expectedRate ?? null) : null,
          lastAccruedOn: isInvestment ? todayDate : null,
        },
      });
      return normalizeWalletRow({
        ...wallet,
        current_balance: Number(wallet.openingBalance),
        is_owner: true,
        can_write: true,
      });
    } catch (err) {
      if (isTableNotFoundError(err)) throw new PfmServiceError(NOT_INSTALLED, 503);
      throw err;
    }
  }

  async function updateWallet({ companyId, walletId, actorId, data }) {
    if (!(await isWalletOwner({ companyId, walletId, actorId }))) {
      throw new PfmServiceError("Solo el propietario puede editar la cartera.", 403);
    }
    const patch = {};
    for (const key of [
      "name",
      "kind",
      "currency",
      "openingBalance",
      "color",
      "icon",
      "ledgerAccountId",
      "reference",
      "creditLimit",
      "statementDay",
      "paymentDueDay",
      "expectedRate",
      "lastAccruedOn",
    ]) {
      if (Object.prototype.hasOwnProperty.call(data, key)) patch[key] = data[key];
    }
    const wallet = await prisma.pfmWallet.update({ where: { id: walletId }, data: patch });
    if (calendarBridge && wallet.kind === "CREDIT") {
      try {
        await calendarBridge.syncCreditReminder(normalizeWalletRow(wallet));
      } catch (err) {
        console.error("[atlas.pfm] credit reminder sync failed", err?.message ?? err);
      }
    }
    return getWallet({ companyId, walletId: wallet.id, actorId });
  }

  async function setWalletEnabled({ companyId, walletId, actorId, enabled }) {
    if (!(await isWalletOwner({ companyId, walletId, actorId }))) {
      throw new PfmServiceError("Solo el propietario puede desactivar la cartera.", 403);
    }
    await prisma.pfmWallet.update({ where: { id: walletId }, data: { enabled } });
    return { id: walletId, enabled };
  }

  // ── Members ────────────────────────────────────────────────────────────────

  async function listMembers({ companyId, walletId, actorId }) {
    if (!(await canReadWallet({ companyId, walletId, actorId }))) {
      throw new PfmServiceError("Cartera no encontrada.", 404);
    }
    const members = await prisma.pfmWalletMember.findMany({
      where: { walletId },
      orderBy: { createdAt: "asc" },
    });
    return { data: members };
  }

  async function upsertMember({ companyId, walletId, actorId, data }) {
    if (!(await isWalletOwner({ companyId, walletId, actorId }))) {
      throw new PfmServiceError("Solo el propietario gestiona colaboradores.", 403);
    }
    if (data.userId === actorId) {
      throw new PfmServiceError("El propietario ya tiene acceso total.", 400);
    }
    const member = await prisma.pfmWalletMember.upsert({
      where: { walletId_userId: { walletId, userId: data.userId } },
      update: { role: data.role },
      create: { walletId, userId: data.userId, role: data.role },
    });
    return member;
  }

  async function removeMember({ companyId, walletId, actorId, userId }) {
    if (!(await isWalletOwner({ companyId, walletId, actorId }))) {
      throw new PfmServiceError("Solo el propietario gestiona colaboradores.", 403);
    }
    await prisma.pfmWalletMember.deleteMany({ where: { walletId, userId } });
    return { walletId, userId, removed: true };
  }

  return {
    listWallets,
    getWallet,
    canReadWallet,
    canWriteWallet,
    isWalletOwner,
    createWallet,
    updateWallet,
    setWalletEnabled,
    listMembers,
    upsertMember,
    removeMember,
  };
}

function normalizeWalletRow(row) {
  return {
    id: row.id,
    companyId: row.company_id ?? row.companyId,
    ownerId: row.owner_id ?? row.ownerId,
    name: row.name,
    kind: row.kind,
    currency: row.currency,
    openingBalance: toPlainNumber(row.opening_balance ?? row.openingBalance),
    color: row.color ?? null,
    icon: row.icon ?? null,
    ledgerAccountId: row.ledger_account_id ?? row.ledgerAccountId ?? null,
    reference: row.reference ?? null,
    creditLimit:
      (row.credit_limit ?? row.creditLimit) == null
        ? null
        : toPlainNumber(row.credit_limit ?? row.creditLimit),
    statementDay: row.statement_day ?? row.statementDay ?? null,
    paymentDueDay: row.payment_due_day ?? row.paymentDueDay ?? null,
    expectedRate:
      (row.expected_rate ?? row.expectedRate) == null
        ? null
        : toPlainNumber(row.expected_rate ?? row.expectedRate),
    lastAccruedOn: (() => {
      const v = row.last_accrued_on ?? row.lastAccruedOn ?? null;
      if (!v) return null;
      // eslint-disable-next-line no-restricted-syntax -- deliberate UTC: @db.Date lastAccruedOn
      return v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10);
    })(),
    creditReminderEventId: row.credit_reminder_event_id ?? row.creditReminderEventId ?? null,
    enabled: row.enabled,
    currentBalance: toPlainNumber(
      row.current_balance,
      toPlainNumber(row.opening_balance ?? row.openingBalance),
    ),
    isOwner: Boolean(row.is_owner),
    canWrite: row.can_write === undefined ? undefined : Boolean(row.can_write),
    createdAt: row.created_at ?? row.createdAt,
    updatedAt: row.updated_at ?? row.updatedAt,
  };
}

// Credit-card statement-cycle math. `movements` are the wallet's POSTED rows
// ({ direction, amount, occurredOn }). Returns null for non-credit wallets or
// wallets without a statement day.
export function computeCreditCycle(wallet, movements, now = new Date()) {
  if (wallet.kind !== "CREDIT" || !wallet.statementDay) return null;
  const ref = new Date(now);
  const y = ref.getUTCFullYear();
  const mo = ref.getUTCMonth();
  const day = ref.getUTCDate();
  // Last statement cut: statementDay of this month if already passed, else last month.
  const cutMonth = day >= wallet.statementDay ? mo : mo - 1;
  const lastCut = new Date(Date.UTC(y, cutMonth, Math.min(wallet.statementDay, 28)));
  const signed = (m) => Number(m.amount) * (m.direction === "INCOME" ? -1 : 1);
  const posted = (movements ?? []).filter((m) => m.status === undefined || m.status === "POSTED");
  const dayOf = (m) => {
    const v = m.occurredOn ?? m.occurred_on;
    // eslint-disable-next-line no-restricted-syntax -- deliberate UTC: @db.Date movement date, compared against a UTC statement cut
    const iso = v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10);
    return new Date(`${iso}T00:00:00.000Z`);
  };
  // Credit-card opening balance is stored negative (debt); fold it in so
  // totalOwed reflects the whole "saldo ocupado", not just this-period movements.
  const openingDebt = -Number(wallet.openingBalance ?? 0);
  const totalOwed = openingDebt + posted.reduce((s, m) => s + signed(m), 0);
  const periodSpend = posted
    .filter((m) => dayOf(m) >= lastCut)
    .reduce((s, m) => s + signed(m), 0);
  const creditLimit = wallet.creditLimit != null ? Number(wallet.creditLimit) : null;
  return {
    statementDay: wallet.statementDay,
    paymentDueDay: wallet.paymentDueDay ?? null,
    creditLimit,
    // eslint-disable-next-line no-restricted-syntax -- deliberate UTC: statement-cut date is UTC-constructed from statementDay
    lastStatementDate: lastCut.toISOString().slice(0, 10),
    totalOwed,
    periodSpend,
    availableCredit: creditLimit != null ? creditLimit - totalOwed : null,
    utilization: creditLimit != null && creditLimit > 0 ? totalOwed / creditLimit : null,
  };
}
