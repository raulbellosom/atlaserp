import {
  drawPdfFooter,
  drawPdfHeader,
  normalizeHexColor,
  resolvePdfDocumentCtor,
  toSafeText,
} from "../../services/pdf-branding-service.js";

const FORBIDDEN_PATH_PARTS = new Set(["__proto__", "constructor", "prototype"]);
const PAGE_MARGIN = 44;
const CONTENT_BOTTOM_MARGIN = 52;
const TEXT_COLOR = "#0F172A";
const MUTED_COLOR = "#64748B";
const BORDER_COLOR = "#E2E8F0";

export class DocumentRendererError extends Error {
  constructor(message, status = 500, code = "document_renderer_error") {
    super(message);
    this.name = "DocumentRendererError";
    this.status = status;
    this.code = code;
  }
}

export function resolveDocumentPath(data, path) {
  const parts = String(path ?? "").split(".");
  if (
    !parts.length ||
    parts.some(
      (part) =>
        !/^[a-zA-Z][a-zA-Z0-9_]*$/.test(part) ||
        FORBIDDEN_PATH_PARTS.has(part),
    )
  ) {
    return undefined;
  }

  let value = data;
  for (const part of parts) {
    if (
      value === null ||
      value === undefined ||
      (typeof value !== "object" && typeof value !== "function") ||
      !Object.prototype.hasOwnProperty.call(value, part)
    ) {
      return undefined;
    }
    value = value[part];
  }
  return value;
}

function formatDocumentValue(value) {
  if (value === null || value === undefined || value === "") return "-";
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "-";
    return new Intl.DateTimeFormat("es-MX", {
      dateStyle: "medium",
      timeZone: "UTC",
    }).format(value);
  }
  if (typeof value === "number") {
    return new Intl.NumberFormat("es-MX", {
      maximumFractionDigits: 2,
    }).format(value);
  }
  if (typeof value === "boolean") return value ? "Si" : "No";
  if (Buffer.isBuffer(value)) return "-";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function interpolateDocumentText(template, data) {
  return String(template ?? "").replace(
    /\{\{([a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z][a-zA-Z0-9_]*)*)\}\}/g,
    (_match, path) => formatDocumentValue(resolveDocumentPath(data, path)),
  );
}

function exactBindingPath(value) {
  return String(value ?? "").match(
    /^\{\{([a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z][a-zA-Z0-9_]*)*)\}\}$/,
  )?.[1];
}

export function createDocumentRenderPlan({ blocks = [], data = {} }) {
  return blocks.map((block) => {
    switch (block.type) {
      case "heading":
      case "paragraph":
        return {
          ...block,
          text: interpolateDocumentText(block.text, data),
        };
      case "fields":
        return {
          ...block,
          title: block.title
            ? interpolateDocumentText(block.title, data)
            : undefined,
          fields: block.fields.map((field) => ({
            ...field,
            value: interpolateDocumentText(field.value, data),
          })),
        };
      case "table": {
        const collection = resolveDocumentPath(data, block.collection);
        const rows = Array.isArray(collection)
          ? collection.slice(0, block.maxRows ?? 100)
          : [];
        return {
          ...block,
          title: block.title
            ? interpolateDocumentText(block.title, data)
            : undefined,
          rows: rows.map((row) =>
            block.columns.map((column) =>
              formatDocumentValue(resolveDocumentPath(row, column.value)),
            ),
          ),
        };
      }
      case "totals":
        return {
          ...block,
          rows: block.rows.map((row) => ({
            ...row,
            value: interpolateDocumentText(row.value, data),
          })),
        };
      case "image":
      case "signature": {
        const path = exactBindingPath(block.source);
        return {
          ...block,
          source: path ? resolveDocumentPath(data, path) : undefined,
          ...(block.label
            ? { label: interpolateDocumentText(block.label, data) }
            : {}),
        };
      }
      default:
        return { ...block };
    }
  });
}

function imageBuffer(value) {
  let buffer = null;
  if (Buffer.isBuffer(value)) {
    buffer = value;
  } else if (typeof value === "string") {
    const match = value.match(
      /^data:image\/(?:png|jpeg);base64,([a-z0-9+/=]+)$/i,
    );
    if (match) buffer = Buffer.from(match[1], "base64");
  }
  if (!buffer || buffer.length < 4) return null;
  const png =
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47;
  const jpeg = buffer[0] === 0xff && buffer[1] === 0xd8;
  return png || jpeg ? buffer : null;
}

function splitTextChunk(doc, text, width, maxHeight, options) {
  const normalized = String(text ?? "").trim();
  if (!normalized) return { chunk: "-", rest: "" };
  if (doc.heightOfString(normalized, { ...options, width }) <= maxHeight) {
    return { chunk: normalized, rest: "" };
  }

  let low = 1;
  let high = normalized.length;
  let best = 1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const wordBoundary = normalized.lastIndexOf(" ", middle);
    const candidateEnd = wordBoundary > 0 ? wordBoundary : middle;
    const candidate = normalized.slice(0, candidateEnd).trim();
    const height = doc.heightOfString(candidate, { ...options, width });
    if (height <= maxHeight) {
      best = Math.max(best, candidateEnd);
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return {
    chunk: normalized.slice(0, best).trim(),
    rest: normalized.slice(best).trim(),
  };
}

export async function renderDocumentPdf({
  title,
  subtitle,
  folio,
  branding,
  generatedAt = new Date(),
  blocks,
  data,
}) {
  const PDFDocument = await resolvePdfDocumentCtor();
  if (typeof PDFDocument !== "function") {
    throw new DocumentRendererError(
      "La generacion de PDF no esta disponible.",
      503,
      "pdf_unavailable",
    );
  }

  const safeBranding = {
    ...branding,
    companyName: toSafeText(branding?.companyName, "Atlas ERP"),
    primaryColor: normalizeHexColor(branding?.primaryColor, "#0F766E"),
    addressLines: Array.isArray(branding?.addressLines)
      ? branding.addressLines
      : [],
  };
  const timestamp = new Date(generatedAt);
  const doc = new PDFDocument({
    autoFirstPage: false,
    bufferPages: true,
    margin: 0,
    size: "LETTER",
    info: {
      Title: toSafeText(title, "Documento"),
      Author: safeBranding.companyName,
      Subject: "Documento generado por Atlas ERP",
      CreationDate: timestamp,
      ModDate: timestamp,
    },
  });
  const chunks = [];
  const done = new Promise((resolve, reject) => {
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const plan = createDocumentRenderPlan({ blocks, data });
  const warnings = [];
  let y = 0;

  function contentWidth() {
    return doc.page.width - PAGE_MARGIN * 2;
  }

  function bottom() {
    return doc.page.height - CONTENT_BOTTOM_MARGIN;
  }

  function addPage() {
    doc.addPage({ size: "LETTER", margin: 0 });
    y = drawPdfHeader(doc, {
      branding: safeBranding,
      title: toSafeText(title, "Documento"),
      subtitle,
      folio,
    });
  }

  function ensureSpace(height) {
    if (y + height > bottom()) addPage();
  }

  function renderFlowText(text, style = {}) {
    const font = style.font ?? "Helvetica";
    const fontSize = style.fontSize ?? 10;
    const color = style.color ?? TEXT_COLOR;
    const align = style.align ?? "left";
    const gap = style.gap ?? 8;
    const lineGap = style.lineGap ?? 2;
    let remaining = String(text ?? "-");

    while (remaining) {
      doc.font(font).fontSize(fontSize);
      const available = Math.max(20, bottom() - y);
      const { chunk, rest } = splitTextChunk(
        doc,
        remaining,
        contentWidth(),
        available,
        { align, lineGap },
      );
      const height = doc.heightOfString(chunk, {
        width: contentWidth(),
        align,
        lineGap,
      });
      doc.fillColor(color).text(chunk, PAGE_MARGIN, y, {
        width: contentWidth(),
        align,
        lineGap,
      });
      y += height + gap;
      remaining = rest;
      if (remaining) addPage();
    }
  }

  function renderFields(block) {
    if (block.title) {
      renderFlowText(block.title, {
        font: "Helvetica-Bold",
        fontSize: 11,
        gap: 6,
      });
    }
    const columns = block.columns ?? 2;
    const gap = 10;
    const cellWidth = (contentWidth() - gap * (columns - 1)) / columns;
    for (let index = 0; index < block.fields.length; index += columns) {
      const row = block.fields.slice(index, index + columns);
      const rowHeight =
        Math.max(
          ...row.map((field) => {
            doc.font("Helvetica-Bold").fontSize(7.5);
            const labelHeight = doc.heightOfString(field.label, {
              width: cellWidth - 16,
            });
            doc.font("Helvetica").fontSize(9);
            const valueHeight = doc.heightOfString(field.value, {
              width: cellWidth - 16,
            });
            return labelHeight + valueHeight + 18;
          }),
        ) || 38;
      ensureSpace(rowHeight);
      row.forEach((field, columnIndex) => {
        const x = PAGE_MARGIN + columnIndex * (cellWidth + gap);
        doc
          .roundedRect(x, y, cellWidth, rowHeight, 4)
          .fillAndStroke("#F8FAFC", BORDER_COLOR);
        doc
          .font("Helvetica-Bold")
          .fontSize(7.5)
          .fillColor(MUTED_COLOR)
          .text(field.label, x + 8, y + 7, { width: cellWidth - 16 });
        doc
          .font("Helvetica")
          .fontSize(9)
          .fillColor(TEXT_COLOR)
          .text(field.value, x + 8, y + 20, { width: cellWidth - 16 });
      });
      y += rowHeight + 8;
    }
  }

  function tableWidths(columns) {
    const requested = columns.map((column) => column.width ?? 0);
    const requestedTotal = requested.reduce((sum, value) => sum + value, 0);
    if (!requestedTotal) {
      return columns.map(() => contentWidth() / columns.length);
    }
    const unspecified = requested.filter((value) => !value).length;
    const fallback = unspecified
      ? contentWidth() / columns.length
      : 0;
    const total = requestedTotal + fallback * unspecified;
    return requested.map((value) => ((value || fallback) / total) * contentWidth());
  }

  function drawTableHeader(block, widths) {
    const height = 24;
    ensureSpace(height);
    let x = PAGE_MARGIN;
    block.columns.forEach((column, index) => {
      doc.rect(x, y, widths[index], height).fill(safeBranding.primaryColor);
      doc
        .font("Helvetica-Bold")
        .fontSize(7.5)
        .fillColor("#FFFFFF")
        .text(column.label, x + 6, y + 7, {
          width: widths[index] - 12,
          lineBreak: false,
          ellipsis: true,
        });
      x += widths[index];
    });
    y += height;
  }

  function renderTable(block) {
    if (block.title) {
      renderFlowText(block.title, {
        font: "Helvetica-Bold",
        fontSize: 11,
        gap: 6,
      });
    }
    const widths = tableWidths(block.columns);
    drawTableHeader(block, widths);
    block.rows.forEach((row, rowIndex) => {
      doc.font("Helvetica").fontSize(7.5);
      const rowHeight = Math.max(
        22,
        ...row.map((value, index) =>
          Math.min(
            72,
            doc.heightOfString(String(value).slice(0, 1000), {
              width: widths[index] - 12,
            }) + 12,
          ),
        ),
      );
      if (y + rowHeight > bottom()) {
        addPage();
        drawTableHeader(block, widths);
      }
      let x = PAGE_MARGIN;
      row.forEach((value, index) => {
        const fill = rowIndex % 2 === 0 ? "#FFFFFF" : "#F8FAFC";
        doc.rect(x, y, widths[index], rowHeight).fillAndStroke(fill, BORDER_COLOR);
        doc
          .font("Helvetica")
          .fontSize(7.5)
          .fillColor(TEXT_COLOR)
          .text(String(value).slice(0, 1000), x + 6, y + 6, {
            width: widths[index] - 12,
            height: rowHeight - 12,
            ellipsis: true,
          });
        x += widths[index];
      });
      y += rowHeight;
    });
    y += 10;
  }

  function renderTotals(block) {
    const width = Math.min(280, contentWidth());
    const x = doc.page.width - PAGE_MARGIN - width;
    for (const row of block.rows) {
      ensureSpace(24);
      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor(MUTED_COLOR)
        .text(row.label, x, y + 5, { width: width * 0.55 });
      doc
        .font("Helvetica-Bold")
        .fontSize(9)
        .fillColor(TEXT_COLOR)
        .text(row.value, x + width * 0.55, y + 5, {
          width: width * 0.45,
          align: "right",
        });
      doc
        .moveTo(x, y + 22)
        .lineTo(x + width, y + 22)
        .lineWidth(0.5)
        .stroke(BORDER_COLOR);
      y += 24;
    }
    y += 8;
  }

  function renderImage(block, signature = false) {
    const buffer = imageBuffer(block.source);
    if (!buffer) {
      warnings.push({ blockId: block.id, code: "unsupported_image" });
      return;
    }
    const width = block.width ?? 160;
    const height = block.height ?? (signature ? 90 : width);
    ensureSpace(height + (signature ? 32 : 8));
    const x =
      block.align === "right"
        ? doc.page.width - PAGE_MARGIN - width
        : block.align === "center" || signature
          ? (doc.page.width - width) / 2
          : PAGE_MARGIN;
    try {
      doc.image(buffer, x, y, { fit: [width, height], align: "center" });
    } catch {
      warnings.push({ blockId: block.id, code: "unsupported_image" });
      return;
    }
    y += height + 6;
    if (signature) {
      const lineWidth = Math.max(width, 180);
      const lineX = (doc.page.width - lineWidth) / 2;
      doc
        .moveTo(lineX, y)
        .lineTo(lineX + lineWidth, y)
        .lineWidth(0.6)
        .stroke(BORDER_COLOR);
      if (block.label) {
        doc
          .font("Helvetica")
          .fontSize(8)
          .fillColor(MUTED_COLOR)
          .text(block.label, lineX, y + 5, {
            width: lineWidth,
            align: "center",
          });
      }
      y += 26;
    }
  }

  addPage();
  for (const block of plan) {
    switch (block.type) {
      case "heading": {
        const size = { 1: 20, 2: 16, 3: 13 }[block.level] ?? 16;
        renderFlowText(block.text, {
          font: "Helvetica-Bold",
          fontSize: size,
          align: block.align,
          color: safeBranding.primaryColor,
          gap: 10,
        });
        break;
      }
      case "paragraph":
        renderFlowText(block.text, {
          fontSize: 10,
          align: block.align,
          lineGap: 3,
          gap: 10,
        });
        break;
      case "fields":
        renderFields(block);
        break;
      case "table":
        renderTable(block);
        break;
      case "totals":
        renderTotals(block);
        break;
      case "image":
        renderImage(block, false);
        break;
      case "divider":
        ensureSpace(10);
        doc
          .moveTo(PAGE_MARGIN, y + 4)
          .lineTo(doc.page.width - PAGE_MARGIN, y + 4)
          .lineWidth(block.thickness ?? 1)
          .stroke(normalizeHexColor(block.color, BORDER_COLOR));
        y += 12;
        break;
      case "spacer":
        ensureSpace(block.height);
        y += block.height;
        break;
      case "signature":
        renderImage(block, true);
        break;
      case "pageBreak":
        addPage();
        break;
      default:
        throw new DocumentRendererError(
          `Bloque no soportado: ${block.type}`,
          422,
          "unsupported_document_block",
        );
    }
  }

  const range = doc.bufferedPageRange();
  for (
    let pageIndex = range.start;
    pageIndex < range.start + range.count;
    pageIndex += 1
  ) {
    doc.switchToPage(pageIndex);
    drawPdfFooter(doc, {
      branding: safeBranding,
      pageNumber: pageIndex - range.start + 1,
      totalPages: range.count,
    });
  }
  doc.end();
  const buffer = await done;
  return {
    buffer,
    pageCount: range.count,
    warnings,
  };
}
