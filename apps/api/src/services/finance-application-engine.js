function toCents(value, fieldName) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${fieldName} invalido.`);
  }
  return Math.round(parsed * 100);
}

function fromCents(value) {
  return Number((value / 100).toFixed(2));
}

function normalizeTargets(targets = []) {
  return targets.map((target) => ({
    id: target.id,
    openCents: toCents(target.open, `Saldo abierto de ${target.id}`),
  }));
}

export function buildFifoProposal({ sourceOpen, targets }) {
  let remaining = toCents(sourceOpen, "Saldo origen");
  const normalizedTargets = normalizeTargets(targets);
  const lines = [];

  for (const target of normalizedTargets) {
    if (remaining <= 0) break;
    if (target.openCents <= 0) continue;
    const amountCents = Math.min(remaining, target.openCents);
    lines.push({
      targetId: target.id,
      amount: fromCents(amountCents),
    });
    remaining -= amountCents;
  }

  const appliedCents = lines.reduce(
    (total, line) => total + toCents(line.amount, "Monto aplicado"),
    0,
  );

  return {
    lines,
    applied: fromCents(appliedCents),
    unapplied: fromCents(remaining),
  };
}

export function validateAllocation({ sourceOpen, targets, lines }) {
  const sourceOpenCents = toCents(sourceOpen, "Saldo origen");
  const normalizedTargets = normalizeTargets(targets);
  const openByTarget = new Map(
    normalizedTargets.map((target) => [target.id, target.openCents]),
  );
  const sumByTarget = new Map();
  let totalAppliedCents = 0;

  for (const line of lines ?? []) {
    const amountCents = toCents(line.amount, "Monto aplicado");
    if (amountCents <= 0) {
      throw new Error("Cada aplicacion debe tener un monto mayor a cero.");
    }
    if (!openByTarget.has(line.targetId)) {
      throw new Error("Documento destino invalido.");
    }

    const current = (sumByTarget.get(line.targetId) ?? 0) + amountCents;
    const targetOpenCents = openByTarget.get(line.targetId) ?? 0;
    if (current > targetOpenCents) {
      throw new Error("La aplicacion excede el saldo abierto del destino.");
    }
    sumByTarget.set(line.targetId, current);
    totalAppliedCents += amountCents;
  }

  if (totalAppliedCents > sourceOpenCents) {
    throw new Error("La aplicacion excede el saldo abierto del origen.");
  }

  return {
    totalApplied: fromCents(totalAppliedCents),
    unapplied: fromCents(sourceOpenCents - totalAppliedCents),
  };
}
