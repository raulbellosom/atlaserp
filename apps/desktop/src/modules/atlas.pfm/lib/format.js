// apps/desktop/src/modules/atlas.pfm/lib/format.js
import { toLocalIso, toLocalMonth } from "../../../lib/localDate.js";

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
  return toLocalMonth();
}

export function shiftMonth(month, delta) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  // eslint-disable-next-line no-restricted-syntax -- deliberate UTC: pure YYYY-MM arithmetic, no "now"
  return d.toISOString().slice(0, 7);
}

export function todayIso() {
  return toLocalIso();
}

export const WALLET_KIND_LABEL = {
  CASH: "Efectivo",
  DEBIT: "Debito",
  CREDIT: "Credito",
  INVESTMENT: "Inversión",
};

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

// A stored rate is a fraction (0.15). Render as a percent, dropping a trailing ".0".
export function formatRatePct(rate) {
  if (rate == null) return "";
  const r = Number(rate);
  if (!Number.isFinite(r)) return "";
  const pct = Math.round(r * 10000) / 100;
  return `${pct}%`;
}

// Collapses maximal runs of consecutive isYield movements that share a YYYY-MM
// into one { type: "yield-group", key, month, total, count, items } entry.
// Every other movement becomes { type: "movement", item }.
export function groupMovements(movements) {
  const out = [];
  let run = null;
  const flush = () => {
    if (run) {
      out.push({
        type: "yield-group",
        key: `yield-${run.month}-${run.items[0].id}`,
        month: run.month,
        total: run.items.reduce((s, m) => s + Number(m.amount ?? 0), 0),
        count: run.items.length,
        items: run.items,
      });
      run = null;
    }
  };
  for (const m of movements ?? []) {
    const month = String(m.occurredOn ?? "").slice(0, 7);
    if (m.isYield && month) {
      if (run && run.month === month) run.items.push(m);
      else {
        flush();
        run = { month, items: [m] };
      }
    } else {
      flush();
      out.push({ type: "movement", item: m });
    }
  }
  flush();
  return out;
}
