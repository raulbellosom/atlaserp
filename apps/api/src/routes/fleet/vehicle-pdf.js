import { FleetServiceError } from "./fleet-service.js";
import {
  resolvePdfDocumentCtor,
  resolveCompanyBranding,
  drawPdfFooter,
  toSafeText,
  compact,
  normalizeHexColor,
  formatDateEs,
} from "../../services/pdf-branding-service.js";

const VEHICLE_STATUS_LABELS = {
  active: "Activo",
  maintenance: "En mantenimiento",
  inactive: "Inactivo",
  retired: "Retirado",
};

async function toPdfBuffer({ vehicle, branding }) {
  const PDFDocument = await resolvePdfDocumentCtor();
  if (typeof PDFDocument !== "function") {
    throw new FleetServiceError(
      "La generacion de PDF no esta disponible. Falta dependencia de pdf en API.",
      503,
    );
  }

  const brandColor = normalizeHexColor(branding.primaryColor ?? "#0F766E", "#0F766E");
  const companyName = toSafeText(branding.companyName, "Atlas ERP");
  const logoBuffer = Buffer.isBuffer(branding.logoBuffer) ? branding.logoBuffer : null;

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
  let logoDrawn = false;
  if (logoBuffer) {
    try {
      doc.image(logoBuffer, LOGO_X + 4, LOGO_Y + 4, {
        fit: [LOGO_SIZE - 8, LOGO_SIZE - 8],
        align: "center",
        valign: "center",
      });
      logoDrawn = true;
    } catch {
      logoDrawn = false;
    }
  }
  if (!logoDrawn) {
    doc
      .font("Helvetica-Bold")
      .fontSize(18)
      .fillColor(brandColor)
      .text(companyName.slice(0, 2).toUpperCase(), LOGO_X, LOGO_Y + 18, {
        width: LOGO_SIZE,
        align: "center",
        lineBreak: false,
      });
  }

  const rBlockW = Math.max(Math.floor(contentWidth * 0.38), 210);
  const rBlockX = right - rBlockW;
  const compX = LOGO_X + LOGO_SIZE + 14;
  const compW = rBlockX - compX - 12;

  doc
    .font("Helvetica-Bold")
    .fontSize(13.5)
    .fillColor(brandColor)
    .text(companyName, compX, 11, { width: compW, lineBreak: false, ellipsis: true });

  const companyMeta = compact([
    branding.rfc && branding.rfc !== "-" ? `RFC: ${branding.rfc}` : null,
    ...(Array.isArray(branding.addressLines) ? branding.addressLines : []),
  ]);
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

  // ─── FOOTER (all pages) ───────────────────────────────────────────────────────
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i += 1) {
    doc.switchToPage(range.start + i);
    drawPdfFooter(doc, {
      branding,
      pageNumber: i + 1,
      totalPages: range.count,
    });
  }

  doc.end();
  return done;
}

export async function buildVehiclePdfBuffer({ prisma, companyId, vehicle }) {
  const branding = await resolveCompanyBranding({ prisma, companyId });
  return toPdfBuffer({ vehicle, branding });
}
