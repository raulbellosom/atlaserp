import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { Readable } from "stream";

function fmt(num) {
  return Number(num ?? 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d) {
  if (!d) return "";
  const date = d instanceof Date ? d : new Date(d);
  return date.toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function directionLabel(direction) {
  return direction === "INCOME" ? "Abono" : "Cargo";
}

function statusLabel(status) {
  return status === "ACTIVE" ? "Activo" : "Cancelado";
}

export async function buildExcelBuffer({ account, movements, openingBalance, closingBalance, totalIncome, totalExpense, companyName, dateFrom, dateTo }) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Atlas ERP";
  workbook.created = new Date();

  const sheetName = account ? `Cuenta - ${account.name}`.substring(0, 31) : "Movimientos";
  const sheet = workbook.addWorksheet(sheetName, { views: [{ state: "frozen", ySplit: 1 }] });

  sheet.columns = [
    { header: "No.", key: "seq", width: 8 },
    { header: "Fecha", key: "date", width: 14 },
    { header: "Tipo", key: "direction", width: 10 },
    { header: "Número", key: "number", width: 16 },
    { header: "Nombre", key: "name", width: 22 },
    { header: "Referencia", key: "reference", width: 18 },
    { header: "Concepto", key: "concept", width: 40 },
    { header: "Cargo", key: "expense", width: 16 },
    { header: "Abono", key: "income", width: 16 },
    { header: "Saldo", key: "balance", width: 16 },
    { header: "Estado", key: "status", width: 12 },
    ...(account ? [] : [{ header: "Cuenta", key: "accountName", width: 22 }]),
  ];

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE9E9E9" } };

  const currency = account?.currency ?? "MXN";
  const numFmt = `_("${currency}" * #,##0.00_)`;

  for (const mv of movements) {
    const row = sheet.addRow({
      seq: mv.sequenceNumber,
      date: fmtDate(mv.occurredAt),
      direction: directionLabel(mv.direction),
      number: mv.number ?? "",
      name: mv.name ?? "",
      reference: mv.reference ?? "",
      concept: mv.concept + (mv.status === "CANCELLED" ? " (Cancelado)" : ""),
      expense: mv.direction === "EXPENSE" && mv.status === "ACTIVE" ? Number(mv.amount) : null,
      income: mv.direction === "INCOME" && mv.status === "ACTIVE" ? Number(mv.amount) : null,
      balance: mv.status === "ACTIVE" ? Number(mv.balanceAfter) : null,
      status: statusLabel(mv.status),
      ...(account ? {} : { accountName: mv.account?.name ?? "" }),
    });
    if (mv.status === "CANCELLED") {
      row.font = { italic: true, color: { argb: "FF999999" } };
    }
    ["expense", "income", "balance"].forEach((key) => {
      const cell = row.getCell(key);
      if (cell.value !== null) cell.numFmt = numFmt;
    });
  }

  // Totals row
  sheet.addRow([]);
  const totalsRow = sheet.addRow({
    seq: "",
    date: "",
    direction: "",
    number: "",
    name: "",
    reference: "",
    concept: "TOTALES",
    expense: totalExpense,
    income: totalIncome,
    balance: closingBalance,
    status: "",
  });
  totalsRow.font = { bold: true };
  ["expense", "income", "balance"].forEach((key) => {
    const cell = totalsRow.getCell(key);
    if (cell.value) cell.numFmt = numFmt;
  });

  // Summary sheet
  const summary = workbook.addWorksheet("Resumen");
  summary.addRow(["Empresa", companyName ?? "—"]);
  if (account) {
    summary.addRow(["Cuenta", account.name]);
    summary.addRow(["Moneda", account.currency]);
  }
  summary.addRow(["Período", [dateFrom ? fmtDate(dateFrom) : "Inicio", dateTo ? fmtDate(dateTo) : "Hoy"].join(" - ")]);
  summary.addRow(["Generado el", fmtDate(new Date())]);
  summary.addRow([]);
  summary.addRow(["Saldo apertura", openingBalance]);
  summary.addRow(["Total abonos", totalIncome]);
  summary.addRow(["Total cargos", totalExpense]);
  summary.addRow(["Saldo cierre", closingBalance]);

  summary.getColumn(1).width = 20;
  summary.getColumn(2).width = 25;

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export function buildPdfStream({ account, movements, openingBalance, closingBalance, totalIncome, totalExpense, companyName, dateFrom, dateTo }) {
  const doc = new PDFDocument({ size: "A4", margin: 40, bufferPages: true });

  const pageWidth = doc.page.width - 80;
  const cols = account
    ? [40, 68, 52, 55, 75, 80, 40, 55, 55]
    : [40, 68, 52, 55, 75, 80, 40, 55, 55, 80];
  const headers = account
    ? ["No.", "Fecha", "Tipo", "Número", "Nombre", "Concepto", "Cargo", "Abono", "Saldo"]
    : ["No.", "Fecha", "Tipo", "Número", "Nombre", "Concepto", "Cargo", "Abono", "Saldo", "Cuenta"];

  // Header
  doc.fontSize(14).font("Helvetica-Bold").text(companyName ?? "Atlas ERP", { align: "left" });
  doc.fontSize(11).font("Helvetica").text("Libro Auxiliar de Cuentas");
  if (account) doc.text(`Cuenta: ${account.name} (${account.currency})`);
  const period = [dateFrom ? fmtDate(dateFrom) : "Inicio", dateTo ? fmtDate(dateTo) : "Hoy"].join(" al ");
  doc.text(`Período: ${period}`);
  doc.text(`Generado el: ${fmtDate(new Date())}`);
  doc.moveDown(0.5);
  doc.moveTo(40, doc.y).lineTo(doc.page.width - 40, doc.y).stroke();
  doc.moveDown(0.5);

  doc.fontSize(9).font("Helvetica-Bold").text(`Saldo de apertura: ${fmt(openingBalance)} ${account?.currency ?? ""}`, { align: "right" });
  doc.moveDown(0.3);

  // Table header
  function drawRow(items, isBold, isGray) {
    if (doc.y > doc.page.height - 80) doc.addPage();
    const startY = doc.y;
    if (isGray) {
      doc.rect(40, startY - 2, pageWidth, 14).fill("#eeeeee").fillColor("black");
    }
    doc.font(isBold ? "Helvetica-Bold" : "Helvetica").fontSize(7.5);
    let x = 40;
    items.forEach((text, i) => {
      const w = cols[i] ?? 50;
      const align = i >= headers.length - 3 ? "right" : "left";
      doc.text(String(text ?? ""), x + 1, startY, { width: w - 2, align, lineBreak: false });
      x += w;
    });
    doc.y = startY + 12;
  }

  drawRow(headers, true, true);
  doc.moveTo(40, doc.y).lineTo(doc.page.width - 40, doc.y).stroke();
  doc.moveDown(0.1);

  for (const mv of movements) {
    const isCancelled = mv.status === "CANCELLED";
    const row = [
      mv.sequenceNumber,
      fmtDate(mv.occurredAt),
      directionLabel(mv.direction),
      mv.number ?? "",
      mv.name ?? "",
      mv.concept + (isCancelled ? " *" : ""),
      mv.direction === "EXPENSE" && !isCancelled ? fmt(mv.amount) : "",
      mv.direction === "INCOME" && !isCancelled ? fmt(mv.amount) : "",
      !isCancelled ? fmt(mv.balanceAfter) : "",
      ...(!account ? [mv.account?.name ?? ""] : []),
    ];
    if (isCancelled) doc.fillColor("#999999");
    drawRow(row, false, false);
    if (isCancelled) doc.fillColor("black");
  }

  // Totals
  doc.moveDown(0.3);
  doc.moveTo(40, doc.y).lineTo(doc.page.width - 40, doc.y).stroke();
  doc.moveDown(0.3);
  doc.font("Helvetica-Bold").fontSize(8.5);
  doc.text(`Total abonos: ${fmt(totalIncome)}   |   Total cargos: ${fmt(totalExpense)}   |   Saldo de cierre: ${fmt(closingBalance)}`, { align: "right" });

  // Page numbers
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc.fontSize(7).fillColor("#888888").text(
      `Página ${i - range.start + 1} de ${range.count}`,
      40,
      doc.page.height - 30,
      { align: "right", width: pageWidth }
    );
  }

  doc.end();
  return doc;
}
