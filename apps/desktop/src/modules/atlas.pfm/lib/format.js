// apps/desktop/src/modules/atlas.pfm/lib/format.js

const MONTHS_ES = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

export function formatMoney(value, currency = "MXN") {
  const n = Number.isFinite(Number(value)) ? Number(value) : 0;
  const abs = Math.abs(n).toLocaleString("es-MX", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const symbol = currency === "USD" ? "US$" : "$";
  return `${n < 0 ? "-" : ""}${symbol}${abs}`;
}

export function formatMonthLabel(month) {
  const [y, m] = String(month ?? "").split("-");
  const idx = Number(m) - 1;
  if (!y || idx < 0 || idx > 11) return String(month ?? "");
  return `${MONTHS_ES[idx]} ${y}`;
}

export function percentDelta(current, base) {
  const b = Number(base);
  if (!Number.isFinite(b) || b === 0) return null;
  return Math.round(((Number(current) - b) / b) * 100);
}

export function currentMonthKey() {
  return new Date().toISOString().slice(0, 7);
}

export function shiftMonth(month, delta) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export const WALLET_KIND_LABEL = { CASH: "Efectivo", DEBIT: "Debito", CREDIT: "Credito" };

// Fixed utilization thresholds for credit cards: green < 50%, amber 50-80%, red > 80%.
export function creditUtilizationTone(ratio) {
  const r = Number(ratio);
  if (!Number.isFinite(r)) return "success";
  if (r > 0.8) return "danger";
  if (r >= 0.5) return "warning";
  return "success";
}

// Derives the credit-card debt view from a wallet DTO.
// `currentBalance` is negative while the card owes money.
export function creditUsage(wallet) {
  const ocupado = Math.max(0, -Number(wallet?.currentBalance ?? 0));
  const limite =
    wallet?.creditLimit == null || !Number.isFinite(Number(wallet.creditLimit))
      ? null
      : Number(wallet.creditLimit);
  const disponible = limite == null ? null : Math.round((limite - ocupado) * 100) / 100;
  const util = limite && limite > 0 ? Math.round((ocupado / limite) * 100) / 100 : null;
  return { ocupado, limite, disponible, util };
}
