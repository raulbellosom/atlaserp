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
