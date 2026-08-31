// apps/api/src/routes/pfm/service-helpers.js

export class PfmServiceError extends Error {
  constructor(message, status = 500) {
    super(message);
    this.name = "PfmServiceError";
    this.status = status;
  }
}

export function getCompanyId(c) {
  const id = c.get("userContext")?.memberships?.[0]?.companyId;
  return typeof id === "string" && id.trim() ? id.trim() : null;
}

export function getActorId(c) {
  const id = c.get("userContext")?.profile?.id;
  return typeof id === "string" && id.trim() ? id.trim() : null;
}

export function getValidationErrorMessage(error) {
  const issue = error?.issues?.[0];
  if (!issue) return "Datos invalidos.";
  const path =
    Array.isArray(issue.path) && issue.path.length > 0 ? issue.path.join(".") : null;
  return path
    ? `Datos invalidos en ${path}: ${issue.message}`
    : `Datos invalidos: ${issue.message}`;
}

export function isTableNotFoundError(error) {
  const codes = [error?.code, error?.meta?.code, error?.cause?.code, error?.originalError?.code];
  if (codes.includes("42P01")) return true;
  const message = String(error?.message ?? "").toLowerCase();
  return message.includes("42p01") || (message.includes("relation") && message.includes("does not exist"));
}

export function firstRow(rows) {
  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

export function toPlainNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}
