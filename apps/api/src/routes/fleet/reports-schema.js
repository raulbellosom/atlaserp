// Schema bootstrap for the atlas.fleet report tables.
//
// These are Atlas ORM (AME3) tables — not managed by prisma/schema.prisma — so
// the service provisions them lazily on first use with idempotent DDL. Extracted
// from reports-service.js to keep that file under the 1000-line limit.

const REPORT_DDL_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS fleet_report (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    company_id uuid NOT NULL,
    report_type varchar(40) NOT NULL,
    folio varchar(32) NOT NULL,
    status varchar(20) NOT NULL DEFAULT 'draft',
    vehicle_id uuid NOT NULL,
    title varchar(255) NOT NULL,
    report_date date NOT NULL,
    odometer_km integer,
    is_inhouse_workshop boolean NOT NULL DEFAULT true,
    workshop_name varchar(200),
    workshop_phone varchar(50),
    workshop_address varchar(300),
    invoice_number varchar(80),
    labor_cost numeric(12,2) NOT NULL DEFAULT 0,
    parts_cost numeric(12,2) NOT NULL DEFAULT 0,
    total_cost numeric(12,2) NOT NULL DEFAULT 0,
    notes text,
    finalized_at timestamptz,
    finalized_by_profile_id uuid,
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
    id uuid PRIMARY KEY DEFAULT uuidv7(),
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
    id uuid PRIMARY KEY DEFAULT uuidv7(),
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

// Returns an idempotent ensureReportTables() bound to this prisma instance.
export function createReportSchemaEnsurer(prisma) {
  let ready = false;
  let bootstrapPromise = null;

  return async function ensureReportTables() {
    if (ready) return;
    if (bootstrapPromise) {
      await bootstrapPromise;
      return;
    }
    bootstrapPromise = (async () => {
      for (const statement of REPORT_DDL_STATEMENTS) {
        await prisma.$executeRawUnsafe(statement);
      }
      ready = true;
    })();
    try {
      await bootstrapPromise;
    } finally {
      bootstrapPromise = null;
    }
  };
}
