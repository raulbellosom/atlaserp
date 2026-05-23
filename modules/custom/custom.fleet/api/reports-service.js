import { createHash } from "node:crypto";
import { FleetServiceError } from "./fleet-service.js";

const MODULE_KEY = "custom.fleet";
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const REPORT_TYPES = ["maintenance", "service", "repair", "other"];
const REPORT_STATUS = ["draft", "finalized"];
const MAINTENANCE_SUBTYPES = [
  "preventive",
  "corrective",
  "inspection",
  "alignment",
  "oil_change",
  "tire_service",
  "other",
];
const SERVICE_SUBTYPES = ["general", "diagnostic", "cleaning", "electrical", "other"];
const REPAIR_PRIORITIES = ["low", "normal", "high", "urgent"];
const REPAIR_DAMAGE_TYPES = ["mechanical", "electrical", "body", "interior", "other"];
const TYPE_PREFIX = {
  maintenance: "MNT",
  service: "SRV",
  repair: "REP",
  other: "OTR",
};

let pdfDocumentCtorPromise = null;

const UPDATABLE_FIELDS = new Set([
  "title",
  "report_date",
  "odometer_km",
  "status",
  "finalized_at",
  "finalized_by_profile_id",
  "workshop_name",
  "workshop_phone",
  "workshop_address",
  "invoice_number",
  "labor_cost",
  "parts_cost",
  "total_cost",
  "notes",
  "maintenance_subtype",
  "next_service_date",
  "next_service_odometer",
  "service_subtype",
  "repair_priority",
  "repair_damage_type",
  "repair_start_date",
  "repair_completion_date",
  "repair_estimated_cost",
  "warranty_days",
  "warranty_notes",
  "other_category_label",
]);

function toScopedCompanyUuid(companyId) {
  const normalized =
    typeof companyId === "string" && companyId.trim() ? companyId.trim() : null;
  if (!normalized) throw new FleetServiceError("companyId es requerido.", 400);
  if (UUID_REGEX.test(normalized)) return normalized.toLowerCase();
  const hash = createHash("sha256")
    .update(`${MODULE_KEY}:${normalized}`)
    .digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-5${hash.slice(
    13,
    16,
  )}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

function normalizeRecordId(id, notFoundMessage) {
  const value = String(id ?? "").trim();
  if (!UUID_REGEX.test(value)) throw new FleetServiceError(notFoundMessage, 404);
  return value.toLowerCase();
}

function toNumber(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizePagination({ page, pageSize }) {
  const safePage = Math.max(1, toNumber(page, 1));
  const safePageSize = Math.min(100, Math.max(1, toNumber(pageSize, 20)));
  return { page: safePage, pageSize: safePageSize, offset: (safePage - 1) * safePageSize };
}

function normalizeSearch(search) {
  const value = String(search ?? "").trim();
  return value.length > 0 ? value : null;
}

function normalizeOptionalString(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

function firstRow(rows) {
  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

function toCount(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeType(value) {
  const type = String(value ?? "").trim().toLowerCase();
  if (!REPORT_TYPES.includes(type)) {
    throw new FleetServiceError("Tipo de reporte invalido.", 400);
  }
  return type;
}

function normalizeStatus(value) {
  if (value === undefined) return undefined;
  const status = String(value ?? "").trim().toLowerCase();
  if (!REPORT_STATUS.includes(status)) {
    throw new FleetServiceError("Estado de reporte invalido.", 400);
  }
  return status;
}

function normalizeParts(parts) {
  if (!Array.isArray(parts)) return [];
  return parts
    .map((item) => ({
      name: normalizeOptionalString(item?.name),
      quantity: Number(item?.quantity ?? 0),
      unit_cost: Number(item?.unit_cost ?? 0),
      notes: normalizeOptionalString(item?.notes),
    }))
    .filter((item) => item.name && Number.isFinite(item.quantity) && item.quantity > 0)
    .map((item) => {
      const unitCost = Number.isFinite(item.unit_cost) && item.unit_cost >= 0 ? item.unit_cost : 0;
      const subtotal = Number((item.quantity * unitCost).toFixed(2));
      return { ...item, unit_cost: unitCost, subtotal };
    });
}

function normalizeReportPayload(data = {}, defaultType = null) {
  const reportType = normalizeType(data.report_type ?? defaultType);
  const status = normalizeStatus(data.status);
  const parts = normalizeParts(data.parts);
  const partsCost = Number(parts.reduce((acc, part) => acc + part.subtotal, 0).toFixed(2));
  const laborCost = Number(data.labor_cost ?? 0);

  const normalized = {
    ...data,
    report_type: reportType,
    status: status ?? undefined,
    title: normalizeOptionalString(data.title),
    workshop_name: normalizeOptionalString(data.workshop_name),
    workshop_phone: normalizeOptionalString(data.workshop_phone),
    workshop_address: normalizeOptionalString(data.workshop_address),
    invoice_number: normalizeOptionalString(data.invoice_number),
    notes: normalizeOptionalString(data.notes),
    maintenance_subtype: normalizeOptionalString(data.maintenance_subtype),
    service_subtype: normalizeOptionalString(data.service_subtype),
    repair_priority: normalizeOptionalString(data.repair_priority),
    repair_damage_type: normalizeOptionalString(data.repair_damage_type),
    warranty_notes: normalizeOptionalString(data.warranty_notes),
    other_category_label: normalizeOptionalString(data.other_category_label),
    parts,
    parts_cost: partsCost,
    labor_cost: Number.isFinite(laborCost) && laborCost >= 0 ? laborCost : 0,
  };
  normalized.total_cost = Number((normalized.parts_cost + normalized.labor_cost).toFixed(2));
  return normalized;
}

function validateTypeBusinessRules(payload) {
  const reportDate = payload.report_date ? new Date(payload.report_date) : null;
  const repairStartDate = payload.repair_start_date ? new Date(payload.repair_start_date) : null;
  const repairCompletionDate = payload.repair_completion_date
    ? new Date(payload.repair_completion_date)
    : null;

  if (payload.report_type === "maintenance") {
    if (!payload.maintenance_subtype || !MAINTENANCE_SUBTYPES.includes(payload.maintenance_subtype)) {
      throw new FleetServiceError("Mantenimiento requiere subtipo valido.", 400);
    }
    if (!payload.next_service_date && !payload.next_service_odometer) {
      throw new FleetServiceError(
        "Mantenimiento requiere fecha o kilometraje de proximo servicio.",
        400,
      );
    }
  }
  if (payload.report_type === "service") {
    if (!payload.service_subtype || !SERVICE_SUBTYPES.includes(payload.service_subtype)) {
      throw new FleetServiceError("Servicio requiere subtipo valido.", 400);
    }
    if (!payload.invoice_number) {
      throw new FleetServiceError("Servicio requiere numero de factura o ticket.", 400);
    }
  }
  if (payload.report_type === "repair") {
    if (!payload.repair_priority || !REPAIR_PRIORITIES.includes(payload.repair_priority)) {
      throw new FleetServiceError("Reparacion requiere prioridad valida.", 400);
    }
    if (!payload.repair_damage_type || !REPAIR_DAMAGE_TYPES.includes(payload.repair_damage_type)) {
      throw new FleetServiceError("Reparacion requiere tipo de dano valido.", 400);
    }
    if (!payload.repair_start_date) {
      throw new FleetServiceError("Reparacion requiere fecha de inicio.", 400);
    }
    if (repairStartDate && reportDate && repairStartDate < reportDate) {
      throw new FleetServiceError("La fecha de inicio no puede ser menor a la fecha del reporte.", 400);
    }
    if (repairStartDate && repairCompletionDate && repairCompletionDate < repairStartDate) {
      throw new FleetServiceError("La fecha de fin no puede ser menor a la fecha de inicio.", 400);
    }
  }
  if (payload.report_type === "other" && !payload.other_category_label) {
    throw new FleetServiceError("Tipo otro requiere categoria personalizada.", 400);
  }
}

function isTableNotFoundError(error) {
  const codes = [error?.code, error?.meta?.code, error?.cause?.code, error?.originalError?.code];
  if (codes.includes("42P01")) return true;
  const msg = String(error?.message ?? "").toLowerCase();
  return msg.includes("42p01") || (msg.includes("relation") && msg.includes("does not exist"));
}

async function withDbErrorMapping(fn, onTableMissing = null) {
  try {
    return await fn();
  } catch (error) {
    if (isTableNotFoundError(error)) {
      if (typeof onTableMissing === "function") {
        try {
          await onTableMissing();
          return await fn();
        } catch (retryError) {
          if (isTableNotFoundError(retryError)) {
            throw new FleetServiceError("Las tablas de reportes no estan disponibles aun.", 503);
          }
          throw retryError;
        }
      }
      throw new FleetServiceError("Las tablas de reportes no estan disponibles aun.", 503);
    }
    throw error;
  }
}

function mapRowForUi(row) {
  if (!row) return row;
  return {
    ...row,
    report_type_label:
      row.report_type === "maintenance"
        ? "Mantenimiento"
        : row.report_type === "service"
          ? "Servicio"
          : row.report_type === "repair"
            ? "Reparacion"
            : "Otro",
  };
}

function formatDateEs(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("es-MX");
}

function formatCurrency(value) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(
    Number.isFinite(amount) ? amount : 0,
  );
}

async function toPdfBuffer(report, parts = []) {
  if (!pdfDocumentCtorPromise) {
    pdfDocumentCtorPromise = import("pdfkit")
      .then((moduleNs) => moduleNs?.default ?? moduleNs?.PDFDocument ?? null)
      .catch(() => null);
  }
  const PDFDocument = await pdfDocumentCtorPromise;
  if (typeof PDFDocument !== "function") {
    throw new FleetServiceError(
      "La generacion de PDF no esta disponible. Falta dependencia de pdf en API.",
      503,
    );
  }

  const doc = new PDFDocument({ margin: 36, size: "A4" });
  const chunks = [];
  const done = new Promise((resolve, reject) => {
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  doc.fontSize(20).text("Reporte de Flota", { align: "left" });
  doc.moveDown(0.5);
  doc.fontSize(11).text(`Folio: ${report.folio}`);
  doc.text(`Tipo: ${report.report_type_label ?? report.report_type}`);
  doc.text(`Estado: ${report.status === "finalized" ? "Finalizado" : "Borrador"}`);
  doc.text(`Fecha: ${formatDateEs(report.report_date)}`);
  doc.moveDown();
  doc.fontSize(14).text(report.title ?? "Sin titulo");
  doc.moveDown(0.5);
  doc.fontSize(10).text(`Vehiculo: ${report.vehicle_plate ?? "-"}`);
  doc.text(`Kilometraje: ${report.odometer_km ?? "-"}`);
  doc.text(`Taller: ${report.workshop_name ?? "-"}`);
  doc.text(`Factura/Ticket: ${report.invoice_number ?? "-"}`);
  doc.moveDown();
  doc.fontSize(11).text("Resumen de costos", { underline: true });
  doc.text(`Mano de obra: ${formatCurrency(report.labor_cost)}`);
  doc.text(`Refacciones: ${formatCurrency(report.parts_cost)}`);
  doc.text(`Total: ${formatCurrency(report.total_cost)}`);
  doc.moveDown();
  if (parts.length > 0) {
    doc.fontSize(11).text("Refacciones / Partes", { underline: true });
    parts.forEach((part, index) => {
      doc.text(
        `${index + 1}. ${part.name} - Cant: ${part.quantity} - Unit: ${formatCurrency(
          part.unit_cost,
        )} - Subtotal: ${formatCurrency(part.subtotal)}`,
      );
    });
    doc.moveDown();
  }
  if (report.notes) {
    doc.fontSize(11).text("Observaciones", { underline: true });
    doc.fontSize(10).text(report.notes);
  }
  doc.end();
  return done;
}

export function createReportsService({ prisma }) {
  async function logAudit({
    actorId,
    entityType,
    entityId,
    action,
    before = null,
    after = null,
    metadata = null,
  }) {
    await prisma.auditLog.create({
      data: {
        actorId: actorId ?? null,
        moduleKey: MODULE_KEY,
        entityType,
        entityId: entityId ?? null,
        action,
        before,
        after,
        metadata,
      },
    });
  }

  let reportTablesReady = false;
  let reportTablesBootstrapPromise = null;

  async function ensureReportTables() {
    if (reportTablesReady) return;
    if (reportTablesBootstrapPromise) {
      await reportTablesBootstrapPromise;
      return;
    }

    reportTablesBootstrapPromise = (async () => {
      const ddlStatements = [
        `CREATE TABLE IF NOT EXISTS fleet_report (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id uuid NOT NULL,
          report_type varchar(40) NOT NULL,
          folio varchar(32) NOT NULL,
          status varchar(20) NOT NULL DEFAULT 'draft',
          vehicle_id uuid NOT NULL,
          title varchar(255) NOT NULL,
          report_date date NOT NULL,
          odometer_km integer,
          workshop_name varchar(200),
          workshop_phone varchar(50),
          workshop_address varchar(300),
          invoice_number varchar(80),
          labor_cost numeric(12,2) NOT NULL DEFAULT 0,
          parts_cost numeric(12,2) NOT NULL DEFAULT 0,
          total_cost numeric(12,2) NOT NULL DEFAULT 0,
          notes text,
          finalized_at timestamptz,
          finalized_by_profile_id text,
          maintenance_subtype varchar(50),
          next_service_date date,
          next_service_odometer integer,
          service_subtype varchar(50),
          repair_priority varchar(30),
          repair_damage_type varchar(30),
          repair_start_date date,
          repair_completion_date date,
          repair_estimated_cost numeric(12,2),
          warranty_days integer,
          warranty_notes text,
          other_category_label varchar(120),
          enabled boolean NOT NULL DEFAULT true,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        )`,
        `CREATE TABLE IF NOT EXISTS fleet_report_part (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id uuid NOT NULL,
          report_id uuid NOT NULL,
          name varchar(200) NOT NULL,
          quantity integer NOT NULL,
          unit_cost numeric(12,2) NOT NULL DEFAULT 0,
          subtotal numeric(12,2) NOT NULL DEFAULT 0,
          notes varchar(500),
          enabled boolean NOT NULL DEFAULT true,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        )`,
        `CREATE TABLE IF NOT EXISTS fleet_report_document (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id uuid NOT NULL,
          report_id uuid NOT NULL,
          file_asset_id uuid NOT NULL,
          document_type varchar(50) NOT NULL DEFAULT 'document',
          label varchar(200),
          enabled boolean NOT NULL DEFAULT true,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        )`,
        "CREATE UNIQUE INDEX IF NOT EXISTS fleet_report_company_folio_uidx ON fleet_report(company_id, folio)",
        "CREATE INDEX IF NOT EXISTS fleet_report_company_type_idx ON fleet_report(company_id, report_type)",
        "CREATE INDEX IF NOT EXISTS fleet_report_company_status_idx ON fleet_report(company_id, status)",
        "CREATE INDEX IF NOT EXISTS fleet_report_company_vehicle_idx ON fleet_report(company_id, vehicle_id)",
        "CREATE INDEX IF NOT EXISTS fleet_report_company_date_idx ON fleet_report(company_id, report_date)",
        "CREATE INDEX IF NOT EXISTS fleet_report_part_company_report_idx ON fleet_report_part(company_id, report_id)",
        "CREATE INDEX IF NOT EXISTS fleet_report_document_company_report_idx ON fleet_report_document(company_id, report_id)",
        "CREATE INDEX IF NOT EXISTS fleet_report_document_company_file_idx ON fleet_report_document(company_id, file_asset_id)",
      ];
      for (const statement of ddlStatements) {
        await prisma.$executeRawUnsafe(statement);
      }
      reportTablesReady = true;
    })();

    try {
      await reportTablesBootstrapPromise;
    } finally {
      reportTablesBootstrapPromise = null;
    }
  }

  const withDb = (fn) => withDbErrorMapping(fn, ensureReportTables);

  async function listReports({ companyId, reportType, page, pageSize, search, status }) {
    const safeCompanyId = toScopedCompanyUuid(companyId);
    const safeType = normalizeType(reportType);
    const pagination = normalizePagination({ page, pageSize });
    const normalizedStatus = status ? normalizeStatus(status) : null;
    const normalizedSearch = normalizeSearch(search);
    const likeValue = normalizedSearch ? `%${normalizedSearch}%` : null;

    const [rows, totalRows] = await withDb(async () => {
      const dataRows = await prisma.$queryRawUnsafe(
        `SELECT
            r.*,
            v.plate AS vehicle_plate,
            vm.name AS vehicle_model_name,
            COALESCE(vb_m.name, v.brand) AS vehicle_brand_name,
            COALESCE(vt_m.name, vt.name) AS vehicle_type_name
         FROM fleet_report r
         LEFT JOIN fleet_vehicle v ON v.id = r.vehicle_id AND v.company_id = r.company_id
         LEFT JOIN fleet_vehicle_model vm ON vm.id = v.vehicle_model_id
         LEFT JOIN fleet_vehicle_brand vb_m ON vb_m.id = vm.brand_id
         LEFT JOIN fleet_vehicle_type vt_m ON vt_m.id = vm.type_id
         LEFT JOIN fleet_vehicle_type vt ON vt.id = v.vehicle_type_id
         WHERE r.company_id = $1
           AND r.enabled = true
           AND r.report_type = $2
           AND ($3::text IS NULL OR r.status = $3)
           AND ($4::text IS NULL OR r.title ILIKE $4 OR r.folio ILIKE $4 OR v.plate ILIKE $4 OR r.workshop_name ILIKE $4)
         ORDER BY r.created_at DESC
         LIMIT $5 OFFSET $6`,
        safeCompanyId,
        safeType,
        normalizedStatus,
        likeValue,
        pagination.pageSize,
        pagination.offset,
      );
      const countRows = await prisma.$queryRawUnsafe(
        `SELECT COUNT(*)::bigint AS total
         FROM fleet_report r
         LEFT JOIN fleet_vehicle v ON v.id = r.vehicle_id AND v.company_id = r.company_id
         WHERE r.company_id = $1
           AND r.enabled = true
           AND r.report_type = $2
           AND ($3::text IS NULL OR r.status = $3)
           AND ($4::text IS NULL OR r.title ILIKE $4 OR r.folio ILIKE $4 OR v.plate ILIKE $4 OR r.workshop_name ILIKE $4)`,
        safeCompanyId,
        safeType,
        normalizedStatus,
        likeValue,
      );
      return [dataRows, countRows];
    });

    return {
      data: rows.map(mapRowForUi),
      pagination: {
        page: pagination.page,
        pageSize: pagination.pageSize,
        total: toCount(firstRow(totalRows)?.total),
      },
    };
  }

  async function listReportsAnyType({ companyId, page, pageSize, search, status }) {
    const safeCompanyId = toScopedCompanyUuid(companyId);
    const pagination = normalizePagination({ page, pageSize });
    const normalizedStatus = status ? normalizeStatus(status) : null;
    const normalizedSearch = normalizeSearch(search);
    const likeValue = normalizedSearch ? `%${normalizedSearch}%` : null;

    const [rows, totalRows] = await withDb(async () => {
      const dataRows = await prisma.$queryRawUnsafe(
        `SELECT
            r.*,
            v.plate AS vehicle_plate,
            vm.name AS vehicle_model_name,
            COALESCE(vb_m.name, v.brand) AS vehicle_brand_name,
            COALESCE(vt_m.name, vt.name) AS vehicle_type_name
         FROM fleet_report r
         LEFT JOIN fleet_vehicle v ON v.id = r.vehicle_id AND v.company_id = r.company_id
         LEFT JOIN fleet_vehicle_model vm ON vm.id = v.vehicle_model_id
         LEFT JOIN fleet_vehicle_brand vb_m ON vb_m.id = vm.brand_id
         LEFT JOIN fleet_vehicle_type vt_m ON vt_m.id = vm.type_id
         LEFT JOIN fleet_vehicle_type vt ON vt.id = v.vehicle_type_id
         WHERE r.company_id = $1
           AND r.enabled = true
           AND ($2::text IS NULL OR r.status = $2)
           AND ($3::text IS NULL OR r.title ILIKE $3 OR r.folio ILIKE $3 OR v.plate ILIKE $3 OR r.workshop_name ILIKE $3)
         ORDER BY r.created_at DESC
         LIMIT $4 OFFSET $5`,
        safeCompanyId,
        normalizedStatus,
        likeValue,
        pagination.pageSize,
        pagination.offset,
      );
      const countRows = await prisma.$queryRawUnsafe(
        `SELECT COUNT(*)::bigint AS total
         FROM fleet_report r
         LEFT JOIN fleet_vehicle v ON v.id = r.vehicle_id AND v.company_id = r.company_id
         WHERE r.company_id = $1
           AND r.enabled = true
           AND ($2::text IS NULL OR r.status = $2)
           AND ($3::text IS NULL OR r.title ILIKE $3 OR r.folio ILIKE $3 OR v.plate ILIKE $3 OR r.workshop_name ILIKE $3)`,
        safeCompanyId,
        normalizedStatus,
        likeValue,
      );
      return [dataRows, countRows];
    });

    return {
      data: rows.map(mapRowForUi),
      pagination: {
        page: pagination.page,
        pageSize: pagination.pageSize,
        total: toCount(firstRow(totalRows)?.total),
      },
    };
  }

  async function getReport({ companyId, id, reportType = null }) {
    const safeCompanyId = toScopedCompanyUuid(companyId);
    const safeId = normalizeRecordId(id, "Reporte no encontrado.");
    const safeType = reportType ? normalizeType(reportType) : null;
    const row = await withDb(async () => {
      const rows = await prisma.$queryRawUnsafe(
        `SELECT
            r.*,
            v.plate AS vehicle_plate,
            vm.name AS vehicle_model_name,
            COALESCE(vb_m.name, v.brand) AS vehicle_brand_name,
            COALESCE(vt_m.name, vt.name) AS vehicle_type_name
         FROM fleet_report r
         LEFT JOIN fleet_vehicle v ON v.id = r.vehicle_id AND v.company_id = r.company_id
         LEFT JOIN fleet_vehicle_model vm ON vm.id = v.vehicle_model_id
         LEFT JOIN fleet_vehicle_brand vb_m ON vb_m.id = vm.brand_id
         LEFT JOIN fleet_vehicle_type vt_m ON vt_m.id = vm.type_id
         LEFT JOIN fleet_vehicle_type vt ON vt.id = v.vehicle_type_id
         WHERE r.id = $1
           AND r.company_id = $2
           AND ($3::text IS NULL OR r.report_type = $3)
         LIMIT 1`,
        safeId,
        safeCompanyId,
        safeType,
      );
      return firstRow(rows);
    });
    if (!row) throw new FleetServiceError("Reporte no encontrado.", 404);
    const partsRows = await withDb(() =>
      prisma.$queryRaw`
        SELECT * FROM fleet_report_part
        WHERE report_id = ${safeId} AND company_id = ${safeCompanyId} AND enabled = true
        ORDER BY created_at ASC
      `,
    );
    return mapRowForUi({ ...row, parts: partsRows });
  }

  async function reserveFolio({ companyId, reportType }) {
    const safeType = normalizeType(reportType);
    const prefix = TYPE_PREFIX[safeType];
    const rows = await withDb(() =>
      prisma.$queryRawUnsafe(
        `SELECT folio FROM fleet_report WHERE company_id = $1 AND report_type = $2 AND folio LIKE $3`,
        companyId,
        safeType,
        `${prefix}-%`,
      ),
    );
    let max = 0;
    for (const row of rows) {
      const folio = String(row?.folio ?? "");
      const numberPart = Number.parseInt(folio.split("-")[1] ?? "0", 10);
      if (Number.isFinite(numberPart) && numberPart > max) max = numberPart;
    }
    return `${prefix}-${String(max + 1).padStart(6, "0")}`;
  }

  async function createReport({ companyId, actorId, payload, reportType }) {
    const safeCompanyId = toScopedCompanyUuid(companyId);
    const data = normalizeReportPayload(payload, reportType);
    if (data.status && data.status !== "draft") {
      throw new FleetServiceError("Los reportes nuevos deben crearse en borrador.", 400);
    }
    validateTypeBusinessRules(data);
    const folio = await reserveFolio({ companyId: safeCompanyId, reportType: data.report_type });

    const row = await withDb(async () => {
      const rows = await prisma.$queryRaw`
        INSERT INTO fleet_report (
          company_id, report_type, folio, status, vehicle_id, title, report_date, odometer_km,
          workshop_name, workshop_phone, workshop_address, invoice_number,
          labor_cost, parts_cost, total_cost, notes,
          maintenance_subtype, next_service_date, next_service_odometer, service_subtype,
          repair_priority, repair_damage_type, repair_start_date, repair_completion_date,
          repair_estimated_cost, warranty_days, warranty_notes, other_category_label
        )
        VALUES (
          ${safeCompanyId}, ${data.report_type}, ${folio}, ${data.status ?? "draft"}, ${data.vehicle_id},
          ${data.title}, ${data.report_date}, ${data.odometer_km ?? null},
          ${data.workshop_name ?? null}, ${data.workshop_phone ?? null}, ${data.workshop_address ?? null}, ${data.invoice_number ?? null},
          ${data.labor_cost}, ${data.parts_cost}, ${data.total_cost}, ${data.notes ?? null},
          ${data.maintenance_subtype ?? null}, ${data.next_service_date ?? null}, ${data.next_service_odometer ?? null}, ${data.service_subtype ?? null},
          ${data.repair_priority ?? null}, ${data.repair_damage_type ?? null}, ${data.repair_start_date ?? null}, ${data.repair_completion_date ?? null},
          ${data.repair_estimated_cost ?? null}, ${data.warranty_days ?? null}, ${data.warranty_notes ?? null}, ${data.other_category_label ?? null}
        )
        RETURNING *
      `;
      return firstRow(rows);
    });

    if (!row) throw new FleetServiceError("No se pudo crear el reporte.", 500);

    if (data.parts.length > 0) {
      for (const part of data.parts) {
        await withDb(() =>
          prisma.$queryRaw`
            INSERT INTO fleet_report_part (company_id, report_id, name, quantity, unit_cost, subtotal, notes, enabled)
            VALUES (${safeCompanyId}, ${row.id}, ${part.name}, ${part.quantity}, ${part.unit_cost}, ${part.subtotal}, ${part.notes ?? null}, true)
          `,
        );
      }
    }

    await logAudit({
      actorId,
      entityType: "Report",
      entityId: row.id,
      action: "fleet.report.create",
      before: null,
      after: { ...row, parts: data.parts },
    });
    return getReport({ companyId: safeCompanyId, id: row.id, reportType: data.report_type });
  }

  async function updateReport({ companyId, actorId, id, payload, reportType = null }) {
    const safeCompanyId = toScopedCompanyUuid(companyId);
    const safeId = normalizeRecordId(id, "Reporte no encontrado.");
    const before = await getReport({ companyId: safeCompanyId, id: safeId, reportType });
    if (before.status === "finalized") {
      throw new FleetServiceError("El reporte esta finalizado. Reabrelo para editarlo.", 409);
    }
    if (payload.status && payload.status !== before.status) {
      throw new FleetServiceError("Usa finalizar o reabrir para cambiar estado.", 400);
    }
    const data = normalizeReportPayload({ ...before, ...payload }, before.report_type);
    validateTypeBusinessRules(data);

    const updates = Object.entries({
      ...payload,
      parts_cost: data.parts_cost,
      total_cost: data.total_cost,
      labor_cost: data.labor_cost,
    }).filter(([key, value]) => UPDATABLE_FIELDS.has(key) && value !== undefined);
    if (updates.length === 0 && payload.parts === undefined) {
      throw new FleetServiceError("No hay campos validos para actualizar.", 400);
    }

    let updated = before;
    if (updates.length > 0) {
      const setClauses = updates.map(([key], i) => `"${key}" = $${i + 3}`).join(", ");
      const values = updates.map(([, value]) => value);
      updated = await withDb(async () => {
        const rows = await prisma.$queryRawUnsafe(
          `UPDATE fleet_report
           SET ${setClauses}, updated_at = now()
           WHERE id = $1 AND company_id = $2
           RETURNING *`,
          safeId,
          safeCompanyId,
          ...values,
        );
        return firstRow(rows);
      });
      if (!updated) throw new FleetServiceError("Reporte no encontrado.", 404);
    }

    if (payload.parts !== undefined) {
      await withDb(() =>
        prisma.$queryRaw`
          UPDATE fleet_report_part
          SET enabled = false
          WHERE report_id = ${safeId} AND company_id = ${safeCompanyId}
        `,
      );
      const parts = normalizeParts(payload.parts);
      for (const part of parts) {
        await withDb(() =>
          prisma.$queryRaw`
            INSERT INTO fleet_report_part (company_id, report_id, name, quantity, unit_cost, subtotal, notes, enabled)
            VALUES (${safeCompanyId}, ${safeId}, ${part.name}, ${part.quantity}, ${part.unit_cost}, ${part.subtotal}, ${part.notes ?? null}, true)
          `,
        );
      }
    }

    const result = await getReport({
      companyId: safeCompanyId,
      id: safeId,
      reportType: reportType ?? before.report_type,
    });
    await logAudit({
      actorId,
      entityType: "Report",
      entityId: safeId,
      action: "fleet.report.update",
      before,
      after: result,
    });
    return result;
  }

  async function setReportEnabled({ companyId, actorId, id, enabled, reportType = null }) {
    const safeCompanyId = toScopedCompanyUuid(companyId);
    const safeId = normalizeRecordId(id, "Reporte no encontrado.");
    const before = await getReport({ companyId: safeCompanyId, id: safeId, reportType });
    const updated = await withDb(async () => {
      const rows = await prisma.$queryRaw`
        UPDATE fleet_report
        SET enabled = ${Boolean(enabled)}, updated_at = now()
        WHERE id = ${safeId} AND company_id = ${safeCompanyId}
        RETURNING *
      `;
      return firstRow(rows);
    });
    if (!updated) throw new FleetServiceError("Reporte no encontrado.", 404);
    await logAudit({
      actorId,
      entityType: "Report",
      entityId: safeId,
      action: "fleet.report.disable",
      before,
      after: updated,
      metadata: { enabled: Boolean(enabled) },
    });
    return updated;
  }

  async function finalizeReport({ companyId, actorId, id, reportType = null }) {
    const safeCompanyId = toScopedCompanyUuid(companyId);
    const safeId = normalizeRecordId(id, "Reporte no encontrado.");
    const before = await getReport({ companyId: safeCompanyId, id: safeId, reportType });
    if (before.status === "finalized") return before;
    validateTypeBusinessRules(before);
    const updated = await withDb(async () => {
      const rows = await prisma.$queryRaw`
        UPDATE fleet_report
        SET status = 'finalized',
            finalized_at = now(),
            finalized_by_profile_id = ${actorId ?? null},
            updated_at = now()
        WHERE id = ${safeId} AND company_id = ${safeCompanyId}
        RETURNING *
      `;
      return firstRow(rows);
    });
    if (!updated) throw new FleetServiceError("Reporte no encontrado.", 404);
    const result = await getReport({ companyId: safeCompanyId, id: safeId, reportType });
    await logAudit({
      actorId,
      entityType: "Report",
      entityId: safeId,
      action: "fleet.report.finalize",
      before,
      after: result,
    });
    return result;
  }

  async function reopenReport({ companyId, actorId, id, reportType = null }) {
    const safeCompanyId = toScopedCompanyUuid(companyId);
    const safeId = normalizeRecordId(id, "Reporte no encontrado.");
    const before = await getReport({ companyId: safeCompanyId, id: safeId, reportType });
    const updated = await withDb(async () => {
      const rows = await prisma.$queryRaw`
        UPDATE fleet_report
        SET status = 'draft',
            finalized_at = null,
            finalized_by_profile_id = null,
            updated_at = now()
        WHERE id = ${safeId} AND company_id = ${safeCompanyId}
        RETURNING *
      `;
      return firstRow(rows);
    });
    if (!updated) throw new FleetServiceError("Reporte no encontrado.", 404);
    const result = await getReport({ companyId: safeCompanyId, id: safeId, reportType });
    await logAudit({
      actorId,
      entityType: "Report",
      entityId: safeId,
      action: "fleet.report.reopen",
      before,
      after: result,
    });
    return result;
  }

  async function listReportDocuments({ companyId, reportId }) {
    const safeCompanyId = toScopedCompanyUuid(companyId);
    const safeReportId = normalizeRecordId(reportId, "Reporte no encontrado.");
    const docs = await withDb(() =>
      prisma.$queryRaw`
        SELECT * FROM fleet_report_document
        WHERE report_id = ${safeReportId} AND company_id = ${safeCompanyId} AND enabled = true
        ORDER BY created_at DESC
      `,
    );
    if (!docs.length) return { data: [] };
    const fileAssetIds = docs.map((d) => d.file_asset_id).filter(Boolean);
    const assets =
      fileAssetIds.length > 0
        ? await prisma.fileAsset.findMany({ where: { id: { in: fileAssetIds } } })
        : [];
    const assetMap = Object.fromEntries(assets.map((asset) => [asset.id, asset]));
    return {
      data: docs.map((doc) => ({ ...doc, file_asset: assetMap[doc.file_asset_id] ?? null })),
    };
  }

  async function listReportParts({ companyId, reportId }) {
    const safeCompanyId = toScopedCompanyUuid(companyId);
    const safeReportId = normalizeRecordId(reportId, "Reporte no encontrado.");
    const rows = await withDb(() =>
      prisma.$queryRaw`
        SELECT *
        FROM fleet_report_part
        WHERE report_id = ${safeReportId}
          AND company_id = ${safeCompanyId}
          AND enabled = true
        ORDER BY created_at ASC
      `,
    );
    return { data: rows };
  }

  async function addReportDocument({ companyId, actorId, reportId, payload }) {
    const safeCompanyId = toScopedCompanyUuid(companyId);
    const safeReportId = normalizeRecordId(reportId, "Reporte no encontrado.");
    const doc = await withDb(async () => {
      const rows = await prisma.$queryRaw`
        INSERT INTO fleet_report_document (company_id, report_id, file_asset_id, document_type, label)
        VALUES (${safeCompanyId}, ${safeReportId}, ${payload.file_asset_id}, ${payload.document_type ?? "document"}, ${payload.label ?? null})
        RETURNING *
      `;
      return firstRow(rows);
    });
    await logAudit({
      actorId,
      entityType: "Report",
      entityId: safeReportId,
      action: "fleet.report.document.add",
      before: null,
      after: doc,
    });
    return doc;
  }

  async function removeReportDocument({ companyId, actorId, reportId, docId }) {
    const safeCompanyId = toScopedCompanyUuid(companyId);
    const safeReportId = normalizeRecordId(reportId, "Reporte no encontrado.");
    const safeDocId = normalizeRecordId(docId, "Documento no encontrado.");
    const updated = await withDb(async () => {
      const rows = await prisma.$queryRaw`
        UPDATE fleet_report_document
        SET enabled = false
        WHERE id = ${safeDocId} AND report_id = ${safeReportId} AND company_id = ${safeCompanyId}
        RETURNING *
      `;
      return firstRow(rows);
    });
    if (!updated) throw new FleetServiceError("Documento no encontrado.", 404);
    await logAudit({
      actorId,
      entityType: "Report",
      entityId: safeReportId,
      action: "fleet.report.document.remove",
      before: updated,
      after: { ...updated, enabled: false },
    });
    return updated;
  }

  async function generateReportPdf({ companyId, id, reportType = null }) {
    const report = await getReport({ companyId, id, reportType });
    const pdf = await toPdfBuffer(report, Array.isArray(report.parts) ? report.parts : []);
    return { report, pdf };
  }

  async function purgeLegacyMaintenanceData({ companyId, actorId }) {
    const safeCompanyId = toScopedCompanyUuid(companyId);
    const maintenance = await withDb(() =>
      prisma.$executeRaw`
        UPDATE fleet_maintenance
        SET enabled = false, updated_at = now()
        WHERE company_id = ${safeCompanyId} AND enabled = true
      `,
    );
    const maintenanceDocs = await withDb(() =>
      prisma.$executeRaw`
        UPDATE fleet_maintenance_document
        SET enabled = false
        WHERE company_id = ${safeCompanyId} AND enabled = true
      `,
    );
    await logAudit({
      actorId,
      entityType: "Report",
      entityId: null,
      action: "fleet.report.dev.purge_legacy",
      before: null,
      after: null,
      metadata: { maintenance, maintenanceDocs },
    });
    return { maintenance, maintenanceDocs };
  }

  return {
    listReports,
    listReportsAnyType,
    getReport,
    createReport,
    updateReport,
    setReportEnabled,
    finalizeReport,
    reopenReport,
    listReportDocuments,
    listReportParts,
    addReportDocument,
    removeReportDocument,
    generateReportPdf,
    purgeLegacyMaintenanceData,
  };
}

