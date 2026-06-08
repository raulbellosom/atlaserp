import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const apiPackageRequire = createRequire(
  new URL("../../../apps/api/package.json", import.meta.url),
);

let pdfDocumentCtorPromise = null;

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function toSafeText(value, fallback = "-") {
  const normalized = String(value ?? "").trim();
  return normalized.length > 0 ? normalized : fallback;
}

export function compact(values = []) {
  return values.map((item) => String(item ?? "").trim()).filter(Boolean);
}

export function normalizeHexColor(color, fallback = "#0F766E") {
  const raw = String(color ?? "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(raw) ? raw.toUpperCase() : fallback;
}

export function lightenHex(hex, t = 0.88) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const lr = Math.round(r + (255 - r) * t).toString(16).padStart(2, "0");
  const lg = Math.round(g + (255 - g) * t).toString(16).padStart(2, "0");
  const lb = Math.round(b + (255 - b) * t).toString(16).padStart(2, "0");
  return `#${lr}${lg}${lb}`.toUpperCase();
}

export function formatDateEs(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("es-MX");
}

// ─── PDFKit loader ─────────────────────────────────────────────────────────────

export async function resolvePdfDocumentCtor() {
  if (!pdfDocumentCtorPromise) {
    pdfDocumentCtorPromise = (async () => {
      try {
        const moduleNs = await import("pdfkit");
        const fn = moduleNs?.default ?? moduleNs?.PDFDocument ?? null;
        if (typeof fn === "function") return fn;
      } catch {}
      try {
        const resolvedPath = apiPackageRequire.resolve("pdfkit");
        const moduleNs = await import(pathToFileURL(resolvedPath).href);
        const fn = moduleNs?.default ?? moduleNs?.PDFDocument ?? null;
        if (typeof fn === "function") return fn;
      } catch {}
      try {
        const required = apiPackageRequire("pdfkit");
        return required?.default ?? required?.PDFDocument ?? required ?? null;
      } catch {}
      return null;
    })();
  }
  return pdfDocumentCtorPromise;
}

// ─── Company branding resolver ─────────────────────────────────────────────────
// Returns: { companyName, taxId, phone, email, website, addressLines, primaryColor, logoBuffer }

export async function resolveCompanyBranding({ prisma, companyId }) {
  const [company, brandingConfig] = await Promise.all([
    prisma.company.findUnique({ where: { id: companyId } }).catch(() => null),
    prisma.brandingConfig.findUnique({ where: { companyId } }).catch(() => null),
  ]);

  const streetLine = compact([
    company?.street,
    company?.extNumber ? `No. ${company.extNumber}` : "",
    company?.intNumber ? `Int. ${company.intNumber}` : "",
  ]).join(", ");
  const cityLine = compact([
    company?.colony ? `Col. ${company.colony}` : "",
    company?.city,
    company?.state,
    company?.country,
  ]).join(", ");
  const postalLine = company?.postalCode ? `CP ${String(company.postalCode).trim()}` : "";
  const addressLines = compact([streetLine, compact([cityLine, postalLine]).join(" ")]);

  return {
    companyName: toSafeText(company?.name, "Atlas ERP"),
    taxId: toSafeText(company?.taxId),
    phone: toSafeText(company?.phone),
    email: toSafeText(company?.email),
    website: toSafeText(company?.website),
    addressLines,
    primaryColor: toSafeText(brandingConfig?.primaryColor ?? company?.primaryColor, "#0F766E"),
    logoBuffer: null,
  };
}

// ─── PDF header renderer ───────────────────────────────────────────────────────
// Draws a standard branded header on an open PDFDocument.
// Returns the Y position where content should start (below the header).

export function drawPdfHeader(doc, { branding, title, subtitle, folio }) {
  const pageWidth = doc.page.width;
  const MARGIN = 44;
  const left = MARGIN;
  const right = pageWidth - MARGIN;
  const HEADER_H = 86;

  const brandColor = normalizeHexColor(branding.primaryColor, "#0F766E");
  const C_BORDER = "#E2E8F0";
  const C_MUTED = "#64748B";
  const companyName = toSafeText(branding.companyName, "Atlas ERP");

  doc.rect(0, 0, pageWidth, HEADER_H).fill("#FFFFFF");
  doc.rect(0, 0, 6, HEADER_H).fill(brandColor);

  const LOGO_SIZE = 54;
  const LOGO_X = left + 4;
  const LOGO_Y = Math.floor((HEADER_H - LOGO_SIZE) / 2);
  doc.lineWidth(0.75).rect(LOGO_X, LOGO_Y, LOGO_SIZE, LOGO_SIZE).stroke(C_BORDER);
  doc
    .font("Helvetica-Bold")
    .fontSize(18)
    .fillColor(brandColor)
    .text(companyName.slice(0, 2).toUpperCase(), LOGO_X, LOGO_Y + 18, {
      width: LOGO_SIZE,
      align: "center",
      lineBreak: false,
    });

  const rBlockW = Math.max(Math.floor((right - left) * 0.38), 210);
  const rBlockX = right - rBlockW;
  const compX = LOGO_X + LOGO_SIZE + 14;
  const compW = rBlockX - compX - 12;

  doc
    .font("Helvetica-Bold")
    .fontSize(13.5)
    .fillColor(brandColor)
    .text(companyName, compX, 11, { width: compW, lineBreak: false, ellipsis: true });

  const companyMeta = compact([branding.taxId !== "-" ? branding.taxId : null, ...branding.addressLines]);
  if (companyMeta.length > 0) {
    doc
      .font("Helvetica")
      .fontSize(7.5)
      .fillColor(C_MUTED)
      .text(companyMeta.join("\n"), compX, 29, { width: compW, lineBreak: true });
  }

  // Right block: document title + folio/subtitle
  doc
    .font("Helvetica-Bold")
    .fontSize(11)
    .fillColor("#0F172A")
    .text(title, rBlockX, 10, { width: rBlockW, align: "right", lineBreak: false });

  if (subtitle) {
    doc
      .font("Helvetica")
      .fontSize(8.5)
      .fillColor(C_MUTED)
      .text(subtitle, rBlockX, 26, { width: rBlockW, align: "right", lineBreak: false });
  }
  if (folio) {
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(C_MUTED)
      .text(folio, rBlockX, folio && subtitle ? 38 : 26, { width: rBlockW, align: "right", lineBreak: false });
  }

  // Separator line
  doc.lineWidth(0.5).moveTo(0, HEADER_H).lineTo(pageWidth, HEADER_H).stroke("#CBD5E1");

  return HEADER_H + 16;
}

// ─── PDF footer renderer ───────────────────────────────────────────────────────
// Draws a standard footer with page number and generation date.

export function drawPdfFooter(doc, { branding, pageNumber, totalPages }) {
  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const MARGIN = 44;
  const FOOTER_Y = pageHeight - 30;
  const brandColor = normalizeHexColor(branding.primaryColor, "#0F766E");
  const C_MUTED = "#94A3B8";

  doc.lineWidth(0.4).moveTo(MARGIN, FOOTER_Y - 6).lineTo(pageWidth - MARGIN, FOOTER_Y - 6).stroke("#E2E8F0");

  doc
    .font("Helvetica")
    .fontSize(7)
    .fillColor(C_MUTED)
    .text(
      `Generado por ${toSafeText(branding.companyName, "Atlas ERP")} · ${new Date().toLocaleDateString("es-MX")}`,
      MARGIN,
      FOOTER_Y,
      { width: (pageWidth - MARGIN * 2) * 0.7, align: "left" },
    );

  if (totalPages > 1) {
    doc
      .font("Helvetica")
      .fontSize(7)
      .fillColor(brandColor)
      .text(`Pag. ${pageNumber} / ${totalPages}`, MARGIN, FOOTER_Y, {
        width: pageWidth - MARGIN * 2,
        align: "right",
      });
  }
}
