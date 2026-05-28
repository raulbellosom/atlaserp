import ExcelJS from 'exceljs'
import PDFDocument from 'pdfkit'

function fmt(num) {
  return Number(num ?? 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDate(d) {
  if (!d) return ''
  const date = d instanceof Date ? d : new Date(d)
  return date.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/**
 * Build an ExcelJS workbook buffer.
 * @param {{ account: object, rows: object[], companyName?: string, dateFrom?: string, dateTo?: string }} opts
 * @returns {Promise<Buffer>}
 */
export async function buildExcelBuffer({ account, rows, companyName = '', dateFrom, dateTo }) {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Atlas ERP'
  workbook.created = new Date()

  const sheet = workbook.addWorksheet('Movimientos', { views: [{ state: 'frozen', ySplit: 1 }] })
  sheet.columns = [
    { header: '#',          key: 'consecutive', width: 6  },
    { header: 'Fecha',      key: 'fecha',       width: 14 },
    { header: 'Tipo',       key: 'tipo',        width: 12 },
    { header: 'Numero',     key: 'numero',      width: 16 },
    { header: 'Nombre',     key: 'nombre',      width: 28 },
    { header: 'Referencia', key: 'referencia',  width: 20 },
    { header: 'Concepto',   key: 'concepto',    width: 40 },
    { header: 'Deposito',   key: 'deposito',    width: 16 },
    { header: 'Retiro',     key: 'retiro',      width: 16 },
    { header: 'Saldo',      key: 'saldo',       width: 16 },
    { header: 'Categoria',  key: 'categoria',   width: 18 },
  ]

  const headerRow = sheet.getRow(1)
  headerRow.font = { bold: true }
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE9E9E9' } }

  const currency = account?.currency ?? 'MXN'
  const numFmt = `_("${currency}" * #,##0.00_)`

  for (const row of rows) {
    const r = sheet.addRow({
      consecutive: Number(row.consecutive ?? 0),
      fecha:       fmtDate(row.fecha),
      tipo:        row.tipo_code   ?? '',
      numero:      row.numero      ?? '',
      nombre:      row.nombre      ?? '',
      referencia:  row.referencia  ?? '',
      concepto:    row.concepto    ?? '',
      deposito:    row.deposito    != null ? Number(row.deposito)   : null,
      retiro:      row.retiro      != null ? Number(row.retiro)     : null,
      saldo:       row.saldo_actual != null ? Number(row.saldo_actual) : null,
      categoria:   row.category_name ?? '',
    })
    ;['deposito', 'retiro', 'saldo'].forEach((key) => {
      const cell = r.getCell(key)
      if (cell.value !== null) cell.numFmt = numFmt
    })
  }

  const totalDep = rows.reduce((s, r) => s + Number(r.deposito ?? 0), 0)
  const totalRet = rows.reduce((s, r) => s + Number(r.retiro   ?? 0), 0)
  sheet.addRow([])
  const totRow = sheet.addRow({ concepto: 'TOTAL', deposito: totalDep, retiro: totalRet })
  totRow.font = { bold: true }
  ;['deposito', 'retiro'].forEach((key) => { totRow.getCell(key).numFmt = numFmt })

  // Resumen sheet
  const summary = workbook.addWorksheet('Resumen')
  const lastSaldo = rows.length > 0 ? Number(rows[rows.length - 1].saldo_actual ?? 0) : Number(account?.opening_balance ?? 0)
  summary.addRow(['Cuenta',          account?.name ?? ''])
  summary.addRow(['Banco',           account?.bank ?? ''])
  summary.addRow(['Moneda',          currency])
  summary.addRow(['Periodo',         `${dateFrom ?? ''} - ${dateTo ?? ''}`])
  summary.addRow(['Total depositos', totalDep])
  summary.addRow(['Total retiros',   totalRet])
  summary.addRow(['Saldo final',     lastSaldo])

  return workbook.xlsx.writeBuffer()
}

/**
 * Build a CSV string (UTF-8 BOM).
 * @param {{ rows: object[] }} opts
 * @returns {string}
 */
export function buildCsvString({ rows }) {
  const BOM = '﻿'
  const headers = ['#', 'Fecha', 'Tipo', 'Numero', 'Nombre', 'Referencia', 'Concepto', 'Deposito', 'Retiro', 'Saldo', 'Categoria']

  function escapeCsv(v) {
    const s = String(v ?? '')
    if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`
    return s
  }

  const lines = [headers.join(',')]
  for (const row of rows) {
    lines.push([
      row.consecutive   ?? '',
      fmtDate(row.fecha),
      row.tipo_code     ?? '',
      row.numero        ?? '',
      row.nombre        ?? '',
      row.referencia    ?? '',
      row.concepto      ?? '',
      row.deposito      ?? '',
      row.retiro        ?? '',
      row.saldo_actual  ?? '',
      row.category_name ?? '',
    ].map(escapeCsv).join(','))
  }
  return BOM + lines.join('\r\n')
}

/**
 * Build a PDF buffer (A4 landscape).
 * @param {{ account: object, rows: object[], companyName?: string, dateFrom?: string, dateTo?: string }} opts
 * @returns {Promise<Buffer>}
 */
export async function buildPdfBuffer({ account, rows, companyName = '', dateFrom, dateTo }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' })
    const chunks = []
    doc.on('data', (c) => chunks.push(c))
    doc.on('end',  () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const currency = account?.currency ?? 'MXN'
    const totalDep = rows.reduce((s, r) => s + Number(r.deposito ?? 0), 0)
    const totalRet = rows.reduce((s, r) => s + Number(r.retiro   ?? 0), 0)

    doc.fontSize(14).font('Helvetica-Bold').text(companyName || 'Atlas ERP', { align: 'left' })
    doc.fontSize(11).font('Helvetica').text(`Cuenta: ${account?.name ?? ''} — ${currency}`, { align: 'left' })
    if (dateFrom || dateTo) doc.text(`Periodo: ${dateFrom ?? ''} — ${dateTo ?? ''}`, { align: 'left' })
    doc.moveDown(0.5)

    // Landscape A4 usable width ~672pt (752 - 2*40)
    const cols   = [30, 60, 45, 60, 130, 80, 150, 70, 70, 70]
    const headers = ['#', 'Fecha', 'Tipo', 'Numero', 'Nombre', 'Referencia', 'Concepto', 'Deposito', 'Retiro', 'Saldo']
    const startX = doc.page.margins.left
    let y = doc.y

    function drawRow(cells, bold = false) {
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(7)
      let x = startX
      cells.forEach((text, i) => {
        const align = i >= 7 ? 'right' : 'left'
        doc.text(String(text ?? ''), x + 2, y, { width: cols[i] - 4, align, lineBreak: false })
        x += cols[i]
      })
      y += 12
      if (y > doc.page.height - doc.page.margins.bottom - 20) {
        doc.addPage()
        y = doc.page.margins.top
      }
    }

    drawRow(headers, true)
    const totalWidth = cols.reduce((a, b) => a + b, 0)
    doc.moveTo(startX, y).lineTo(startX + totalWidth, y).stroke()
    y += 4

    for (const row of rows) {
      drawRow([
        row.consecutive ?? '',
        fmtDate(row.fecha),
        row.tipo_code   ?? '',
        row.numero      ?? '',
        row.nombre      ?? '',
        row.referencia  ?? '',
        row.concepto    ?? '',
        row.deposito != null ? fmt(row.deposito)    : '',
        row.retiro   != null ? fmt(row.retiro)      : '',
        row.saldo_actual != null ? fmt(row.saldo_actual) : '',
      ])
    }

    doc.moveTo(startX, y).lineTo(startX + totalWidth, y).stroke()
    y += 4
    drawRow(['', '', '', '', '', '', 'TOTAL', fmt(totalDep), fmt(totalRet), ''], true)
    doc.end()
  })
}
