import ExcelJS from "exceljs";

function fmt(num) {
  return Number(num ?? 0).toLocaleString("es-MX", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

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
  row.font = { bold: true, color: { argb: "FF1F2937" } };
  row.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE5E7EB" },
  };
  row.alignment = { vertical: "middle", wrapText: false };
  row.height = 18;
}

function applyNumFmt(sheet, columnKey, numFmt) {
  sheet.getColumn(columnKey).numFmt = numFmt;
}

const COVERAGE_LABELS = {
  basic: "Basica",
  comprehensive: "Integral",
  third_party: "Terceros",
  other: "Otro",
};

const STATUS_VEHICLE = {
  active: "Activo",
  inactive: "Inactivo",
  maintenance: "En mantenimiento",
  retired: "Retirado",
  pending: "Pendiente",
  disabled: "Desactivado",
};

const STATUS_DRIVER = {
  active: "Activo",
  inactive: "Inactivo",
  suspended: "Suspendido",
};

const STATUS_REPORT = {
  draft: "Borrador",
  finalized: "Finalizado",
};

const STATUS_INSURANCE = {
  active: "Activa",
  expired: "Vencida",
  disabled: "Desactivada",
};

// ── Vehicles ───────────────────────────────────────────────────────────────────
export async function buildVehiclesExcelBuffer({ rows, companyName = "" }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Atlas ERP";
  wb.created = new Date();

  const sheet = wb.addWorksheet("Vehiculos", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  sheet.columns = [
    { header: "Matricula", key: "plate", width: 14 },
    { header: "No. Economico", key: "full_economic_number", width: 14 },
    { header: "Marca", key: "vehicle_brand_name", width: 18 },
    { header: "Modelo", key: "vehicle_model_name", width: 18 },
    { header: "Tipo", key: "vehicle_type_name", width: 16 },
    { header: "Año", key: "year", width: 8 },
    { header: "Color", key: "color", width: 12 },
    { header: "Estado", key: "status_label", width: 16 },
    { header: "Chofer", key: "driver_name", width: 22 },
    { header: "Poliza seguro", key: "insurance_status", width: 14 },
    { header: "Financiado", key: "is_financed_label", width: 10 },
    { header: "Institución", key: "financing_institution", width: 24 },
    { header: "Contrato", key: "financing_contract_number", width: 20 },
    { header: "Inicio financ.", key: "financing_start_date", width: 14 },
    { header: "Fin financ.", key: "financing_end_date", width: 14 },
    { header: "Pago mensual", key: "financing_monthly_payment", width: 14 },
    { header: "Notas", key: "notes", width: 40 },
    { header: "Creado", key: "created_at", width: 14 },
  ];

  applyHeaderStyle(sheet.getRow(1));
  applyNumFmt(sheet, "financing_monthly_payment", "#,##0.00");

  for (const r of rows) {
    sheet.addRow({
      plate: r.plate ?? "",
      full_economic_number: r.full_economic_number ?? r.economic_number ?? "",
      vehicle_brand_name: r.vehicle_brand_name ?? r.brand ?? "",
      vehicle_model_name: r.vehicle_model_name ?? r.model_name ?? "",
      vehicle_type_name: r.vehicle_type_name ?? "",
      year: r.year != null ? Number(r.year) : "",
      color: r.color ?? "",
      status_label: STATUS_VEHICLE[r.status] ?? r.status ?? "",
      driver_name: r.driver_name ?? "",
      insurance_status:
        STATUS_INSURANCE[r.insurance_status] ??
        r.insurance_status ??
        "Sin poliza",
      is_financed_label: r.is_financed ? "Si" : "No",
      financing_institution: r.financing_institution ?? "",
      financing_contract_number: r.financing_contract_number ?? "",
      financing_start_date: fmtDate(r.financing_start_date),
      financing_end_date: fmtDate(r.financing_end_date),
      financing_monthly_payment:
        r.financing_monthly_payment != null
          ? Number(r.financing_monthly_payment)
          : null,
      notes: r.notes ?? "",
      created_at: fmtDate(r.created_at),
    });
  }

  const metaSheet = wb.addWorksheet("Info");
  metaSheet.addRow(["Empresa", companyName]);
  metaSheet.addRow(["Total vehiculos", rows.length]);
  metaSheet.addRow(["Exportado", new Date().toLocaleString("es-MX")]);

  return wb.xlsx.writeBuffer();
}

// ── Drivers ────────────────────────────────────────────────────────────────────
export async function buildDriversExcelBuffer({ rows, companyName = "" }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Atlas ERP";
  wb.created = new Date();

  const sheet = wb.addWorksheet("Choferes", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  sheet.columns = [
    { header: "Nombre", key: "full_name", width: 26 },
    { header: "Telefono", key: "phone", width: 16 },
    { header: "Email", key: "email", width: 28 },
    { header: "No. Licencia", key: "license_number", width: 18 },
    { header: "Tipo licencia", key: "license_type", width: 14 },
    { header: "Venc. licencia", key: "license_expiry_date", width: 14 },
    { header: "Estado", key: "status_label", width: 14 },
    { header: "Vehiculo asignado", key: "assigned_plate", width: 14 },
    { header: "Colaborador RH", key: "hr_employee_name", width: 26 },
    { header: "Notas", key: "notes", width: 40 },
    { header: "Creado", key: "created_at", width: 14 },
  ];

  applyHeaderStyle(sheet.getRow(1));

  for (const r of rows) {
    sheet.addRow({
      full_name:
        r.full_name ?? `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim(),
      phone: r.phone ?? "",
      email: r.email ?? "",
      license_number: r.license_number ?? "",
      license_type: r.license_type ?? "",
      license_expiry_date: fmtDate(r.license_expiry_date),
      status_label: STATUS_DRIVER[r.status] ?? r.status ?? "",
      assigned_plate: r.assigned_plate ?? "",
      hr_employee_name: r.hr_employee_name ?? "",
      notes: r.notes ?? "",
      created_at: fmtDate(r.created_at),
    });
  }

  const metaSheet = wb.addWorksheet("Info");
  metaSheet.addRow(["Empresa", companyName]);
  metaSheet.addRow(["Total choferes", rows.length]);
  metaSheet.addRow(["Exportado", new Date().toLocaleString("es-MX")]);

  return wb.xlsx.writeBuffer();
}

// ── Insurance ──────────────────────────────────────────────────────────────────
export async function buildInsuranceExcelBuffer({ rows, companyName = "" }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Atlas ERP";
  wb.created = new Date();

  const sheet = wb.addWorksheet("Seguros", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  sheet.columns = [
    { header: "No. Poliza", key: "policy_number", width: 20 },
    { header: "Aseguradora", key: "insurer_name", width: 26 },
    { header: "Vehiculo", key: "vehicle_plate", width: 14 },
    { header: "Tipo cobertura", key: "coverage_label", width: 16 },
    { header: "Estado", key: "status_label", width: 14 },
    { header: "Inicio vigencia", key: "start_date", width: 14 },
    { header: "Fin vigencia", key: "expiry_date", width: 14 },
    { header: "Prima", key: "premium", width: 14 },
    { header: "Moneda", key: "currency", width: 8 },
    { header: "Notas", key: "notes", width: 40 },
    { header: "Creado", key: "created_at", width: 14 },
  ];

  applyHeaderStyle(sheet.getRow(1));
  applyNumFmt(sheet, "premium", "#,##0.00");

  for (const r of rows) {
    sheet.addRow({
      policy_number: r.policy_number ?? "",
      insurer_name: r.insurer_name ?? "",
      vehicle_plate: r.vehicle_plate ?? "",
      coverage_label:
        r.coverage_type_label ??
        COVERAGE_LABELS[r.coverage_type] ??
        r.coverage_type ??
        "",
      status_label: STATUS_INSURANCE[r.status] ?? r.status ?? "",
      start_date: fmtDate(r.start_date),
      expiry_date: fmtDate(r.expiry_date),
      premium: r.premium != null ? Number(r.premium) : null,
      currency: r.currency ?? "MXN",
      notes: r.notes ?? "",
      created_at: fmtDate(r.created_at),
    });
  }

  const metaSheet = wb.addWorksheet("Info");
  metaSheet.addRow(["Empresa", companyName]);
  metaSheet.addRow(["Total polizas", rows.length]);
  metaSheet.addRow(["Exportado", new Date().toLocaleString("es-MX")]);

  return wb.xlsx.writeBuffer();
}

// ── Reports ────────────────────────────────────────────────────────────────────
export async function buildReportExcelBuffer({
  rows,
  reportType,
  companyName = "",
}) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Atlas ERP";
  wb.created = new Date();

  const typeLabel =
    reportType === "maintenance"
      ? "Mantenimiento"
      : reportType === "service"
        ? "Servicio"
        : reportType === "repair"
          ? "Reparacion"
          : "Reportes";

  const sheet = wb.addWorksheet(typeLabel, {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  sheet.columns = [
    { header: "Folio", key: "folio", width: 16 },
    { header: "Titulo", key: "title", width: 30 },
    { header: "Vehiculo", key: "vehicle_plate", width: 14 },
    { header: "Marca / Modelo", key: "vehicle_model", width: 24 },
    { header: "Estado", key: "status_label", width: 14 },
    { header: "Fecha reporte", key: "report_date", width: 14 },
    { header: "Odometro (km)", key: "odometer_km", width: 14 },
    { header: "Costo mano obra", key: "labor_cost", width: 16 },
    { header: "Costo refacciones", key: "parts_cost", width: 16 },
    { header: "Costo total", key: "total_cost", width: 14 },
    { header: "Moneda", key: "currency", width: 8 },
    { header: "Proveedor", key: "service_provider", width: 24 },
    { header: "Finalizado por", key: "finalized_by", width: 22 },
    { header: "Fecha finalizado", key: "finalized_at", width: 14 },
    { header: "Observaciones", key: "observations", width: 50 },
    { header: "Creado", key: "created_at", width: 14 },
  ];

  applyHeaderStyle(sheet.getRow(1));
  ["labor_cost", "parts_cost", "total_cost"].forEach((key) =>
    applyNumFmt(sheet, key, "#,##0.00"),
  );

  for (const r of rows) {
    sheet.addRow({
      folio: r.folio ?? "",
      title: r.title ?? "",
      vehicle_plate: r.vehicle_plate ?? "",
      vehicle_model: [r.vehicle_brand_name, r.vehicle_model_name]
        .filter(Boolean)
        .join(" "),
      status_label: STATUS_REPORT[r.status] ?? r.status ?? "",
      report_date: fmtDate(r.report_date),
      odometer_km: r.odometer_km != null ? Number(r.odometer_km) : null,
      labor_cost: r.labor_cost != null ? Number(r.labor_cost) : null,
      parts_cost: r.parts_cost != null ? Number(r.parts_cost) : null,
      total_cost: r.total_cost != null ? Number(r.total_cost) : null,
      currency: r.currency ?? "MXN",
      service_provider: r.service_provider ?? "",
      finalized_by: r.finalized_by_name ?? "",
      finalized_at: fmtDate(r.finalized_at),
      observations: r.observations ?? r.notes ?? "",
      created_at: fmtDate(r.created_at),
    });
  }

  const metaSheet = wb.addWorksheet("Info");
  metaSheet.addRow(["Empresa", companyName]);
  metaSheet.addRow(["Tipo reporte", typeLabel]);
  metaSheet.addRow(["Total reportes", rows.length]);
  metaSheet.addRow(["Exportado", new Date().toLocaleString("es-MX")]);

  return wb.xlsx.writeBuffer();
}
