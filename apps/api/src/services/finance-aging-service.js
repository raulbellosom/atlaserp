function daysBetween(dateA, dateB) {
  const dayMs = 24 * 60 * 60 * 1000;
  const utcA = Date.UTC(
    dateA.getUTCFullYear(),
    dateA.getUTCMonth(),
    dateA.getUTCDate(),
  );
  const utcB = Date.UTC(
    dateB.getUTCFullYear(),
    dateB.getUTCMonth(),
    dateB.getUTCDate(),
  );
  return Math.floor((utcA - utcB) / dayMs);
}

function parseDateLike(value, fallback = new Date()) {
  if (!value) return fallback;
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(String(value))
    ? `${value}T00:00:00.000Z`
    : value;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function parseAmount(value) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}

function zeroBuckets() {
  return {
    b0_30: 0,
    b31_60: 0,
    b61_90: 0,
    b90_plus: 0,
    totalOpen: 0,
    count: 0,
  };
}

export function createFinanceAgingService({ prisma }) {
  async function getAging({
    companyId,
    direction,
    contactId,
    asOf,
    currency,
  }) {
    const asOfDate = parseDateLike(asOf, new Date());
    const rows = await prisma.financeDocument.findMany({
      where: {
        companyId,
        enabled: true,
        status: { in: ["OPEN", "PARTIAL"] },
        direction: direction || undefined,
        contactId: contactId || undefined,
        currency: currency || undefined,
      },
      orderBy: [{ dueDate: "asc" }, { issueDate: "asc" }],
      include: {
        contact: {
          select: { id: true, name: true, legalName: true },
        },
      },
    });

    const buckets = zeroBuckets();
    const groupedByContact = new Map();

    for (const row of rows) {
      const openAmount = parseAmount(row.openAmount);
      if (openAmount <= 0) continue;
      const dueDate = row.dueDate ? new Date(row.dueDate) : new Date(row.issueDate);
      const ageDays = Math.max(0, daysBetween(asOfDate, dueDate));

      buckets.totalOpen += openAmount;
      buckets.count += 1;

      if (ageDays <= 30) buckets.b0_30 += openAmount;
      else if (ageDays <= 60) buckets.b31_60 += openAmount;
      else if (ageDays <= 90) buckets.b61_90 += openAmount;
      else buckets.b90_plus += openAmount;

      const contactKey = row.contactId ?? "sin-contacto";
      const bucket =
        groupedByContact.get(contactKey) ??
        {
          contactId: row.contactId ?? null,
          contactName: row.contact?.name ?? "Sin contacto",
          currency: row.currency,
          b0_30: 0,
          b31_60: 0,
          b61_90: 0,
          b90_plus: 0,
          totalOpen: 0,
          count: 0,
        };
      bucket.totalOpen += openAmount;
      bucket.count += 1;
      if (ageDays <= 30) bucket.b0_30 += openAmount;
      else if (ageDays <= 60) bucket.b31_60 += openAmount;
      else if (ageDays <= 90) bucket.b61_90 += openAmount;
      else bucket.b90_plus += openAmount;
      groupedByContact.set(contactKey, bucket);
    }

    return {
      asOf: asOfDate.toISOString(),
      summary: {
        ...buckets,
        b0_30: Number(buckets.b0_30.toFixed(2)),
        b31_60: Number(buckets.b31_60.toFixed(2)),
        b61_90: Number(buckets.b61_90.toFixed(2)),
        b90_plus: Number(buckets.b90_plus.toFixed(2)),
        totalOpen: Number(buckets.totalOpen.toFixed(2)),
      },
      contacts: [...groupedByContact.values()]
        .sort((a, b) => b.totalOpen - a.totalOpen)
        .map((row) => ({
          ...row,
          b0_30: Number(row.b0_30.toFixed(2)),
          b31_60: Number(row.b31_60.toFixed(2)),
          b61_90: Number(row.b61_90.toFixed(2)),
          b90_plus: Number(row.b90_plus.toFixed(2)),
          totalOpen: Number(row.totalOpen.toFixed(2)),
        })),
    };
  }

  return {
    getAging,
  };
}
