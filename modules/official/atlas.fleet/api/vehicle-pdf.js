import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { FleetServiceError } from "./fleet-service.js";

let pdfDocumentCtorPromise = null;
const apiPackageRequire = createRequire(
  new URL("../../../../apps/api/package.json", import.meta.url),
);

function formatDateEs(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("es-MX");
}

function toSafeText(value, fallback = "-") {
  const normalized = String(value ?? "").trim();
  return normalized.length > 0 ? normalized : fallback;
}

function compact(values = []) {
  return values.map((item) => String(item ?? "").trim()).filter(Boolean);
}

function normalizeHexColor(color, fallback = "#0F766E") {
  const raw = String(color ?? "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(raw) ? raw.toUpperCase() : fallback;
}

function lightenHex(hex, t = 0.88) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const lr = Math.round(r + (255 - r) * t).toString(16).padStart(2, "0");
  const lg = Math.round(g + (255 - g) * t).toString(16).padStart(2, "0");
  const lb = Math.round(b + (255 - b) * t).toString(16).padStart(2, "0");
  return `#${lr}${lg}${lb}`.toUpperCase();
}

const VEHICLE_STATUS_LABELS = {
  active: "Activo",
  maintenance: "En mantenimiento",
  inactive: "Inactivo",
  retired: "Retirado",
};

async function resolvePdfDocumentCtor() {
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

async function resolveCompanyBranding({ prisma, companyId }) {
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

async function toPdfBuffer({ vehicle, branding }) {
  const PDFDocument = await resolvePdfDocumentCtor();
  if (typeof PDFDocument !== "function") {
    throw new FleetServiceError(
      "La generacion de PDF no esta disponible. Falta dependencia de pdf en API.",
      503,
    );
  }

  const brandColor = normalizeHexColor(branding.primaryColor ?? "#0F766E", "#0F766E");
  const brandColorLight = lightenHex(brandColor, 0.88);
  const companyName = toSafeText(branding.companyName, "Atlas ERP");

  const statusText = VEHICLE_STATUS_LABELS[String(vehicle.status ?? "").toLowerCase()] ?? toSafeText(vehicle.status, "-");

  const C_LABEL_BG = "#F1F5F9";
  const C_BORDER = "#E2E8F0";
  const C_DARK = "#0F172A";
  const C_MID = "#334155";
  const C_MUTED = "#64748B";

  const doc = new PDFDocument({
    margin: 0,
    size: "LETTER",
    layout: "portrait",
    bufferPages: true,
  });
  const chunks = [];
  const done = new Promise((resolve, reject) => {
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const pageWidth = doc.page.width;
  const MARGIN = 44;
  const left = MARGIN;
  const right = pageWidth - MARGIN;
  const contentWidth = right - left;

  doc.lineWidth(0.5);

  // ─── HEADER ───────────────────────────────────────────────────────────────────
  const HEADER_H = 86;
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

  const rBlockW = Math.max(Math.floor(contentWidth * 0.38), 210);
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

  // Right block: title + folio
  const plate = toSafeText(vehicle.plate);
  doc
    .font("Helvetica-Bold")
    .fontSize(11)
    .fillColor(C_DARK)
    .text("TARJETA DE VEHICULO", rBlockX, 10, { width: rBlockW, align: "right", lineBreak: false });
  doc
    .font("Helvetica-Bold")
    .fontSize(16)
    .fillColor(brandColor)
    .text(plate, rBlockX, 26, { width: rBlockW, align: "right", lineBreak: false });
  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor(C_MUTED)
    .text(`Generado: ${formatDateEs(new Date())}`, rBlockX, 50, { width: rBlockW, align: "right", lineBreak: false });

  // Status badge in header
  const statusBgColor = vehicle.status === "active" ? "#DCFCE7" : vehicle.status === "maintenance" ? "#FEF9C3" : "#F1F5F9";
  const statusTxtColor = vehicle.status === "active" ? "#166534" : vehicle.status === "maintenance" ? "#92400E" : "#475569";
  const statusBadgeW = 90;
  const statusBadgeH = 18;
  const statusBadgeX = rBlockX;
  const statusBadgeY = 62;
  doc.roundedRect(statusBadgeX, statusBadgeY, statusBadgeW, statusBadgeH, 4).fill(statusBgColor);
  doc
    .font("Helvetica-Bold")
    .fontSize(8)
    .fillColor(statusTxtColor)
    .text(statusText.toUpperCase(), statusBadgeX, statusBadgeY + 5, { width: statusBadgeW, align: "center", lineBreak: false });

  // Divider
  doc.lineWidth(1).moveTo(0, HEADER_H).lineTo(pageWidth, HEADER_H).stroke(brandColor);

  let y = HEADER_H + 28;

  // ─── SECTION TITLE ────────────────────────────────────────────────────────────
  function drawSectionTitle(title, yPos) {
    doc
      .font("Helvetica-Bold")
      .fontSize(9)
      .fillColor(brandColor)
      .text(title.toUpperCase(), left, yPos, { lineBreak: false });
    doc
      .lineWidth(0.5)
      .moveTo(left, yPos + 13)
      .lineTo(right, yPos + 13)
      .stroke(C_BORDER);
    return yPos + 20;
  }

  // ─── TWO-COLUMN INFO ROW ──────────────────────────────────────────────────────
  const colW = Math.floor((contentWidth - 16) / 2);

  function drawInfoRow(label, value, xPos, yPos, width) {
    const ROW_H = 24;
    doc.rect(xPos, yPos, width, ROW_H).fill(C_LABEL_BG);
    doc
      .lineWidth(0.4)
      .rect(xPos, yPos, width, ROW_H)
      .stroke(C_BORDER);
    doc
      .font("Helvetica")
      .fontSize(7.5)
      .fillColor(C_MUTED)
      .text(label, xPos + 6, yPos + 5, { width: Math.floor(width * 0.38), lineBreak: false });
    doc
      .font("Helvetica-Bold")
      .fontSize(8.5)
      .fillColor(C_DARK)
      .text(toSafeText(value), xPos + Math.floor(width * 0.4), yPos + 5, {
        width: Math.floor(width * 0.56),
        lineBreak: false,
        ellipsis: true,
      });
    return yPos + ROW_H + 2;
  }

  function drawTwoColRow(leftLabel, leftVal, rightLabel, rightVal, yPos) {
    drawInfoRow(leftLabel, leftVal, left, yPos, colW);
    drawInfoRow(rightLabel, rightVal, left + colW + 16, yPos, colW);
    return yPos + 26;
  }

  // ─── IDENTIFICACION DEL VEHICULO ──────────────────────────────────────────────
  y = drawSectionTitle("Identificacion del vehiculo", y);

  y = drawTwoColRow("Matricula", vehicle.plate, "No. Economico", vehicle.full_economic_number ?? vehicle.economic_individual_number, y);
  y = drawTwoColRow("Marca", vehicle.vehicle_brand_name, "Modelo", vehicle.vehicle_model_name, y);
  y = drawTwoColRow("Tipo", vehicle.vehicle_type_name, "Año", vehicle.vehicle_model_year, y);
  y = drawTwoColRow("Color", vehicle.color, "Estado", statusText, y);

  y += 14;

  // ─── CONDUCTOR ASIGNADO ───────────────────────────────────────────────────────
  y = drawSectionTitle("Conductor asignado", y);

  if (vehicle.driver_name) {
    y = drawTwoColRow("Nombre", vehicle.driver_name, "Telefono", vehicle.driver_phone, y);
    y = drawInfoRow("Licencia", vehicle.driver_license_number, left, y, contentWidth);
    y += 2;
  } else {
    doc
      .font("Helvetica")
      .fontSize(8.5)
      .fillColor(C_MUTED)
      .text("Sin conductor asignado", left, y + 4, { lineBreak: false });
    y += 26;
  }

  y += 14;

  // ─── NOTAS ────────────────────────────────────────────────────────────────────
  if (vehicle.notes) {
    y = drawSectionTitle("Observaciones", y);
    const notesText = toSafeText(vehicle.notes);
    const NOTES_PAD = 8;
    const approxLines = Math.ceil(notesText.length / 80) + 1;
    const notesH = Math.max(40, approxLines * 12 + NOTES_PAD * 2);
    doc.rect(left, y, contentWidth, notesH).fill(C_LABEL_BG);
    doc.lineWidth(0.4).rect(left, y, contentWidth, notesH).stroke(C_BORDER);
    doc
      .font("Helvetica")
      .fontSize(8.5)
      .fillColor(C_MID)
      .text(notesText, left + NOTES_PAD, y + NOTES_PAD, {
        width: contentWidth - NOTES_PAD * 2,
        lineBreak: true,
      });
    y += notesH + 14;
  }

  // ─── FOOTER ───────────────────────────────────────────────────────────────────
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    const pageH = doc.page.height;
    const footerY = pageH - 26;
    doc.lineWidth(0.4).moveTo(left, footerY - 4).lineTo(right, footerY - 4).stroke(C_BORDER);
    doc
      .font("Helvetica")
      .fontSize(7.5)
      .fillColor(C_MUTED)
      .text("Atlas ERP — Flota", left, footerY, { width: contentWidth / 3, align: "left", lineBreak: false });
    doc
      .font("Helvetica")
      .fontSize(7.5)
      .fillColor(C_MUTED)
      .text(companyName, left + contentWidth / 3, footerY, { width: contentWidth / 3, align: "center", lineBreak: false });
    doc
      .font("Helvetica")
      .fontSize(7.5)
      .fillColor(C_MUTED)
      .text(`Pagina ${i + 1} de ${range.count}`, right - contentWidth / 3, footerY, { width: contentWidth / 3, align: "right", lineBreak: false });
  }

  doc.end();
  return done;
}

export async function buildVehiclePdfBuffer({ prisma, companyId, vehicle }) {
  const branding = await resolveCompanyBranding({ prisma, companyId });
  return toPdfBuffer({ vehicle, branding });
}
