import { CURRENCY_OPTIONS } from "../../../lib/localeCatalogs";

export const ACCOUNT_TYPE_OPTIONS = [
  "ACTIVO",
  "PASIVO",
  "CAPITAL",
  "INGRESO",
  "EGRESO",
  "COSTO",
  "OTRO",
];

export const SOURCE_TYPE_OPTIONS = [
  { value: "manual", label: "Manual" },
  { value: "income", label: "Ingreso" },
  { value: "expense", label: "Egreso" },
  { value: "transfer", label: "Transferencia" },
];

export const APPLY_SOURCE_DOC_TYPES = new Set([
  "PAYMENT",
  "ADVANCE",
  "CREDIT_NOTE",
]);

export const DOCUMENT_TYPE_LABELS = {
  INVOICE: "Factura",
  CREDIT_NOTE: "Nota de crédito",
  DEBIT_NOTE: "Nota de débito",
  ADVANCE: "Anticipo",
  PAYMENT: "Pago",
};

export const APPLICATION_STATUS_LABELS = {
  APPLIED: "Aplicada",
  REVERSED: "Revertida",
};

export const DOCUMENT_STATUS_LABELS = {
  OPEN: "Abierto",
  PARTIAL: "Parcial",
  PAID: "Pagado",
  VOID: "Anulado",
  OVERDUE: "Vencido",
};

export const SECTION_META = {
  summary: {
    title: "Finanzas",
    description: "Resumen operativo y saldos convertidos para tu instancia.",
  },
  ar: {
    title: "Cuentas por cobrar (CxC)",
    description: "Facturas, anticipos y pagos de clientes.",
  },
  ap: {
    title: "Cuentas por pagar (CxP)",
    description: "Facturas, anticipos y pagos a proveedores.",
  },
  aging: {
    title: "Aging",
    description: "Envejecimiento de saldos abiertos por contacto.",
  },
  applications: {
    title: "Aplicaciones",
    description: "Aplicación FIFO de pagos/anticipos/notas de crédito.",
  },
  accounts: {
    title: "Plan de cuentas",
    description: "Gestiona cuentas contables activas y su configuración base.",
  },
  entries: {
    title: "Pólizas",
    description:
      "Registra movimientos contables con captura guiada o avanzada.",
  },
  taxes: {
    title: "Impuestos y retenciones",
    description: "Catálogo fiscal base para AR/AP y cálculo documental.",
  },
  "fx-rates": {
    title: "Tipos de cambio",
    description: "Administra tasas manuales para conversion historica.",
  },
};

export function formatMoney(value, currency = "MXN") {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return "$0.00";
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency,
  }).format(amount);
}

export function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatDateInputValue(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export function toCsvCell(value) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

export function formatDocumentTypeLabel(value) {
  const key = String(value ?? "")
    .trim()
    .toUpperCase();
  return DOCUMENT_TYPE_LABELS[key] || key || "-";
}

export function isOverdueDocument(doc) {
  if (!doc?.dueDate) return false;
  if (!doc?.enabled) return false;
  const open = toNumber(doc.openAmount);
  if (open <= 0) return false;
  const due = new Date(doc.dueDate);
  if (Number.isNaN(due.getTime())) return false;
  const now = new Date();
  return due.getTime() < now.getTime();
}

export function resolveDocumentOperationalStatus(doc) {
  if (isOverdueDocument(doc)) return "OVERDUE";
  return String(doc?.status || "OPEN").toUpperCase();
}

export function matchesDueFilter(doc, dueFilter) {
  if (dueFilter === "all") return true;
  if (!doc?.dueDate) return false;
  const dueDate = new Date(doc.dueDate);
  if (Number.isNaN(dueDate.getTime())) return false;
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    23,
    59,
    59,
    999,
  );
  if (dueFilter === "today") {
    return dueDate >= startToday && dueDate <= endToday;
  }
  if (dueFilter === "week") {
    const endWeek = new Date(startToday);
    endWeek.setDate(endWeek.getDate() + 7);
    endWeek.setHours(23, 59, 59, 999);
    return dueDate >= startToday && dueDate <= endWeek;
  }
  return true;
}

export function parseApiError(error, fallback) {
  const raw = String(error?.message ?? "").trim();
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed?.error === "string" && parsed.error.trim())
      return parsed.error;
  } catch {
    // ignore invalid JSON
  }
  return raw.length > 220 ? fallback : raw;
}

export function toNumber(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function computeLineTotals(lines) {
  return lines.reduce(
    (acc, line) => {
      acc.debit += toNumber(line.debit);
      acc.credit += toNumber(line.credit);
      return acc;
    },
    { debit: 0, credit: 0 },
  );
}

export function computeApplyTotals(lines, sourceOpenAmount) {
  const applied = lines.reduce(
    (sum, line) =>
      sum +
      toNumber(
        line.sourceAmount !== undefined ? line.sourceAmount : line.amount,
      ),
    0,
  );
  const sourceOpen = toNumber(sourceOpenAmount);
  return {
    applied,
    unapplied: Math.max(0, Number((sourceOpen - applied).toFixed(2))),
  };
}

export function defaultAccountForm() {
  return {
    code: "",
    name: "",
    type: ACCOUNT_TYPE_OPTIONS[0],
    currency: "MXN",
    initialBalance: "0",
  };
}

export function defaultEntryForm() {
  return {
    occurredAt: "",
    concept: "",
    reference: "",
    currency: "MXN",
    sourceType: "manual",
    lines: [
      { accountId: "", debit: "", credit: "", note: "" },
      { accountId: "", debit: "", credit: "", note: "" },
    ],
  };
}

export function defaultGuidedForm() {
  return {
    sourceType: "income",
    concept: "",
    reference: "",
    occurredAt: "",
    currency: "MXN",
    amount: "",
    fromAccountId: "",
    toAccountId: "",
    note: "",
  };
}

export function defaultFxForm() {
  return {
    baseCurrency: "USD",
    quoteCurrency: "MXN",
    rateDate: "",
    rate: "",
    source: "manual",
  };
}

export function defaultDocumentForm(direction = "AR") {
  const today = new Date().toISOString().slice(0, 10);
  return {
    direction,
    docType: "INVOICE",
    contactId: "",
    currency: "MXN",
    issueDate: today,
    dueDate: "",
    reference: "",
    notesMarkdown: "",
    subtotalAmount: "",
    totalAmount: "",
    selectedTaxRateIds: [],
  };
}

export function defaultTaxRateForm() {
  return {
    key: "",
    name: "",
    kind: "TRANSFER",
    rate: "",
    direction: "AR",
  };
}

export function formatFxDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" }).format(date);
}

export function normalizeCurrencyCode(value) {
  return String(value ?? "")
    .trim()
    .toUpperCase();
}

export function resolveCurrencyOptions(value) {
  const code = normalizeCurrencyCode(value);
  if (!code) return CURRENCY_OPTIONS;
  if (CURRENCY_OPTIONS.some((option) => option.value === code))
    return CURRENCY_OPTIONS;
  return [
    { value: code, label: `${code} - Moneda personalizada` },
    ...CURRENCY_OPTIONS,
  ];
}

export function resolveFinanceSection(path) {
  if (path === "/finance/ar") return "ar";
  if (path === "/finance/ap") return "ap";
  if (path === "/finance/aging") return "aging";
  if (path === "/finance/applications") return "applications";
  if (path === "/finance/accounts") return "accounts";
  if (path === "/finance/entries") return "entries";
  if (path === "/finance/taxes") return "taxes";
  if (path === "/finance/fx-rates") return "fx-rates";
  return "summary";
}
