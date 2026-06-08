import ExcelJS from "exceljs";

function fmtDate(d) {
  if (!d) return "";
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return String(d);
  return date.toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function applyHeaderStyle(row) {
  row.font = { bold: true, color: { argb: "FF0F172A" }, size: 10 };
  row.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE0E7FF" },
  };
  row.alignment = { vertical: "middle", wrapText: false };
  row.height = 20;
  row.eachCell((cell) => {
    cell.border = {
      bottom: { style: "medium", color: { argb: "FF6366F1" } },
    };
  });
}

function applyAutoFilter(sheet) {
  if (!sheet.lastRow) return;
  const colCount = sheet.columns.length;
  if (colCount === 0) return;
  const lastColLetter = sheet.getColumn(colCount).letter;
  sheet.autoFilter = `A1:${lastColLetter}1`;
}

function addInfoSheet(wb, rows) {
  const info = wb.addWorksheet("Info");
  info.getColumn(1).width = 22;
  info.getColumn(2).width = 36;
  for (const [k, v] of rows) {
    const row = info.addRow([k, v]);
    row.getCell(1).font = { bold: true };
  }
}

const EMPLOYMENT_TYPE_LABELS = {
  full_time: "Tiempo completo",
  part_time: "Medio tiempo",
  contractor: "Contratista",
  intern: "Practicante",
};

const STATUS_LABELS = {
  active: "Activo",
  vacation: "Vacaciones",
  inactive: "Inactivo",
  terminated: "Baja",
};

export async function buildEmployeesExcelBuffer({ rows, companyName = "" }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Atlas ERP";
  wb.created = new Date();

  const sheet = wb.addWorksheet("Colaboradores", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  sheet.columns = [
    { header: "Nombre", key: "first_name", width: 20 },
    { header: "Apellido", key: "last_name", width: 20 },
    { header: "Nombre completo", key: "full_name", width: 30 },
    { header: "Codigo", key: "employee_code", width: 14 },
    { header: "Puesto", key: "job_title", width: 26 },
    { header: "Departamento", key: "department", width: 22 },
    { header: "Estado", key: "status_label", width: 16 },
    { header: "Tipo de empleo", key: "employment_type_label", width: 18 },
    { header: "Email trabajo", key: "work_email", width: 30 },
    { header: "Email personal", key: "personal_email", width: 30 },
    { header: "Telefono", key: "phone", width: 18 },
    { header: "Ubicacion", key: "work_location", width: 22 },
    { header: "Manager", key: "manager_name", width: 26 },
    { header: "Fecha ingreso", key: "hire_date", width: 16 },
    { header: "Fecha baja", key: "termination_date", width: 16 },
    { header: "Contacto emergencia", key: "emergency_contact_name", width: 26 },
    { header: "Tel. emergencia", key: "emergency_contact_phone", width: 18 },
    { header: "Fecha alta", key: "created_at", width: 16 },
  ];

  applyHeaderStyle(sheet.getRow(1));
  applyAutoFilter(sheet);

  for (const r of rows) {
    sheet.addRow({
      first_name: r.firstName ?? "",
      last_name: r.lastName ?? "",
      full_name: `${r.firstName ?? ""} ${r.lastName ?? ""}`.trim(),
      employee_code: r.employeeCode ?? "",
      job_title: r.jobTitle ?? "",
      department: r.department ?? "",
      status_label: STATUS_LABELS[r.status] ?? r.status ?? "",
      employment_type_label:
        EMPLOYMENT_TYPE_LABELS[r.employmentType] ?? r.employmentType ?? "",
      work_email: r.workEmail ?? "",
      personal_email: r.personalEmail ?? "",
      phone: r.phone ?? "",
      work_location: r.workLocation ?? "",
      manager_name: r.managerName ?? "",
      hire_date: fmtDate(r.hireDate),
      termination_date: fmtDate(r.terminationDate),
      emergency_contact_name: r.emergencyContactName ?? "",
      emergency_contact_phone: r.emergencyContactPhone ?? "",
      created_at: fmtDate(r.createdAt),
    });
  }

  addInfoSheet(wb, [
    ["Empresa", companyName],
    ["Total colaboradores", rows.length],
    ["Exportado", new Date().toLocaleString("es-MX")],
  ]);

  return wb.xlsx.writeBuffer();
}
