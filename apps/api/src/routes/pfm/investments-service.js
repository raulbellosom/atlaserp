// apps/api/src/routes/pfm/investments-service.js
import { isTableNotFoundError, PfmServiceError, toPlainNumber } from "./service-helpers.js";

const NOT_INSTALLED = "El modulo de finanzas personales no esta instalado.";

function isoDay(d) {
  // eslint-disable-next-line no-restricted-syntax -- deliberate UTC: yield accrual runs on UTC-anchored ISO days (cursor-guarded)
  return d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10);
}
function dateUTC(iso) {
  return new Date(`${iso}T00:00:00.000Z`);
}
function addDays(iso, n) {
  const d = dateUTC(iso);
  d.setUTCDate(d.getUTCDate() + n);
  // eslint-disable-next-line no-restricted-syntax -- deliberate UTC: addDays operates on UTC-anchored ISO days
  return d.toISOString().slice(0, 10);
}
function round2(n) {
  return Math.round(n * 100) / 100;
}

export function createInvestmentsService({ prisma }) {
  // Books one compounding daily-yield INCOME movement per elapsed un-accrued day
  // for every INVESTMENT wallet with a positive expected rate. Idempotent via
  // pfm_wallet.last_accrued_on.
  async function accrueYieldDue({ now = new Date(), maxBackfillDays = 60 } = {}) {
    const todayIso = isoDay(now);
    const yesterdayIso = addDays(todayIso, -1);

    let wallets;
    try {
      wallets = await prisma.pfmWallet.findMany({
        where: {
          kind: "INVESTMENT",
          enabled: true,
          expectedRate: { gt: 0 },
          OR: [{ lastAccruedOn: null }, { lastAccruedOn: { lt: dateUTC(todayIso) } }],
        },
        select: {
          id: true,
          companyId: true,
          ownerId: true,
          openingBalance: true,
          expectedRate: true,
          lastAccruedOn: true,
        },
      });
    } catch (err) {
      if (isTableNotFoundError(err)) throw new PfmServiceError(NOT_INSTALLED, 503);
      throw err;
    }

    let processed = 0;
    let created = 0;

    for (const w of wallets) {
      processed += 1;
      try {
        const cursorIso = w.lastAccruedOn ? isoDay(w.lastAccruedOn) : addDays(todayIso, -1);
        let startIso = addDays(cursorIso, 1);
        // clamp the backfill window
        const earliestIso = addDays(yesterdayIso, -(maxBackfillDays - 1));
        if (startIso < earliestIso) startIso = earliestIso;
        // cursor already at/past yesterday -> nothing elapsed to accrue
        if (startIso > yesterdayIso) continue;

        const movs = await prisma.pfmMovement.findMany({
          where: { walletId: w.id, enabled: true, status: "POSTED" },
          select: { direction: true, amount: true, occurredOn: true },
        });
        const history = movs.map((m) => ({
          day: isoDay(m.occurredOn),
          signed: Number(m.amount) * (m.direction === "INCOME" ? 1 : -1),
        }));

        const opening = Number(w.openingBalance);
        const dailyRate = Number(w.expectedRate) / 365;
        const toInsert = [];
        for (let day = startIso; day <= yesterdayIso; day = addDays(day, 1)) {
          const balance =
            opening +
            history.filter((h) => h.day <= day).reduce((s, h) => s + h.signed, 0) +
            toInsert.filter((t) => t.day < day).reduce((s, t) => s + t.amount, 0);
          const amount = round2(balance * dailyRate);
          if (amount > 0) toInsert.push({ day, amount });
        }

        await prisma.$transaction(async (tx) => {
          for (const t of toInsert) {
            await tx.pfmMovement.create({
              data: {
                companyId: w.companyId,
                ownerId: w.ownerId,
                walletId: w.id,
                categoryId: null,
                direction: "INCOME",
                amount: t.amount,
                occurredOn: dateUTC(t.day),
                note: "Rendimiento",
                merchant: null,
                status: "POSTED",
                isYield: true,
              },
            });
          }
          await tx.pfmWallet.update({
            where: { id: w.id },
            data: { lastAccruedOn: dateUTC(yesterdayIso) },
          });
        });
        created += toInsert.length;
      } catch (err) {
        console.error("[atlas.pfm] accrueYieldDue failed", w.id, err?.message ?? err);
      }
    }

    return { processed, created };
  }

  return { accrueYieldDue, _toPlainNumber: toPlainNumber };
}
