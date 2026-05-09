export const ACCOUNT_TYPE_OPTIONS = [
  { value: "banco", label: "Banco" },
  { value: "caja", label: "Caja" },
  { value: "cliente", label: "Cliente" },
  { value: "proveedor", label: "Proveedor" },
  { value: "otro", label: "Otro" },
];

export const DIRECTION_OPTIONS = [
  { value: "INCOME", label: "Abono" },
  { value: "EXPENSE", label: "Cargo" },
];

export const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Activo" },
  { value: "CANCELLED", label: "Cancelado" },
];

export const CURRENCY_OPTIONS = [
  { value: "MXN", label: "MXN" },
  { value: "USD", label: "USD" },
  { value: "EUR", label: "EUR" },
];

export function formatMoney(amount, currency = "MXN") {
  return Number(amount ?? 0).toLocaleString("es-MX", {
    style: "currency",
    currency: currency || "MXN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function fmtDate(d) {
  if (!d) return "";
  const date = d instanceof Date ? d : new Date(d);
  return date.toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function parseApiError(error, fallback) {
  return error?.message || fallback;
}

export function defaultAccountForm() {
  return { name: "", type: "banco", currency: "MXN", initialBalance: "0", description: "" };
}

export function defaultMovementForm() {
  return {
    occurredAt: new Date().toISOString().slice(0, 10),
    direction: "INCOME",
    movementType: "",
    number: "",
    name: "",
    reference: "",
    concept: "",
    amount: "",
  };
}

export function resolveLedgerSection(path) {
  if (path === "/ledger/accounts") return "accounts";
  if (path.startsWith("/ledger/accounts/")) return "account-detail";
  if (path === "/ledger/movements") return "movements";
  if (path === "/ledger/reports") return "reports";
  return "summary";
}

export function accountTypeLabel(type) {
  return ACCOUNT_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type ?? "-";
}

export function directionLabel(direction) {
  return direction === "INCOME" ? "Abono" : "Cargo";
}

export function statusLabel(status) {
  return status === "ACTIVE" ? "Activo" : "Cancelado";
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}
