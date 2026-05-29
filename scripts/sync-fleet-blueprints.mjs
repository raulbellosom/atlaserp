/**
 * sync-fleet-blueprints.mjs
 *
 * Discovers all atlas.fleet / custom.fleet AtlasView rows in the database and
 * applies targeted schema patches to fix known issues and improvements:
 *
 *  1.  Replace `custom.fleet:*` component keys → `atlas.fleet:*`
 *  2.  Insurance table: is_active → status (InsuranceBadgeCell), add coverage badge
 *  3.  Insurance form: vehicle_id → rich relation, document_asset_id → file,
 *      coverage_type → select (Spanish labels), currency → select, notes → markdown
 *  4.  Vehicle/Driver/Report forms: notes/observations → markdown
 *  5.  Catalog FORM views: formMode → "sheet" (prevents full-page navigation)
 *  6.  Catalog TABLE views: defaultViewMode → "grid"
 *  7.  Vehicle detail: schema.title eyebrow + insurance relation-card/list sections
 *  8.  Insurance detail: schema.title eyebrow
 *  9.  Report detail blueprints: Finalizar + PDF headerActions (visible per status)
 *  10. All table blueprints: comprehensive column definitions with visible:false extras
 *  11. Report tables: all available columns incl. subtype, cost, workshop
 *
 * Run:        node scripts/sync-fleet-blueprints.mjs
 * Dry run:    node scripts/sync-fleet-blueprints.mjs --dry-run
 */
import "dotenv/config";
import pkg from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const { PrismaClient } = pkg;
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL ?? process.env.DIRECT_URL,
});
const prisma = new PrismaClient({ adapter });

const DRY_RUN = process.argv.includes("--dry-run");

// ---------------------------------------------------------------------------
// Select option catalogs
// ---------------------------------------------------------------------------
const COVERAGE_TYPE_OPTIONS = [
  { value: "basic", label: "Básica" },
  { value: "comprehensive", label: "Integral" },
  { value: "third_party", label: "Terceros" },
  { value: "other", label: "Otro" },
];

const CURRENCY_OPTIONS = [
  { value: "MXN", label: "MXN — Peso mexicano" },
  { value: "USD", label: "USD — Dólar americano" },
  { value: "EUR", label: "EUR — Euro" },
  { value: "CAD", label: "CAD — Dólar canadiense" },
  { value: "GBP", label: "GBP — Libra esterlina" },
];

// ---------------------------------------------------------------------------
// Generic helpers
// ---------------------------------------------------------------------------

function fixComponentNamespace(schema) {
  const str = JSON.stringify(schema);
  if (!str.includes("custom.fleet:")) return schema;
  return JSON.parse(str.replaceAll("custom.fleet:", "atlas.fleet:"));
}

function transformFields(sections, transform) {
  if (!Array.isArray(sections)) return sections;
  return sections.map((section) => {
    if (!Array.isArray(section.fields)) return section;
    return { ...section, fields: section.fields.map(transform) };
  });
}

function applyMainEntityFormPatches(schema) {
  const sections = transformFields(schema.sections ?? [], (field) => {
    if (field.field === "notes" || field.field === "observations") {
      return { ...field, type: "markdown" };
    }
    return field;
  });
  const patched = { ...schema, sections };
  if (patched.formMode === "sheet") delete patched.formMode;
  return patched;
}

function applyCatalogFormPatches(schema) {
  const sections = transformFields(schema.sections ?? [], (field) => {
    if (field.field === "notes" || field.field === "observations") {
      return { ...field, type: "markdown" };
    }
    return field;
  });
  return { ...schema, sections, formMode: "sheet" };
}

// ---------------------------------------------------------------------------
// Column helpers — ensure a column exists, upsert (replace if exists)
// ---------------------------------------------------------------------------

function upsertColumns(columns, newCols) {
  let result = [...columns];
  for (const col of newCols) {
    const idx = result.findIndex((c) => c.field === col.field);
    if (idx >= 0) {
      result[idx] = { ...result[idx], ...col };
    } else {
      result = [...result, col];
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Per-key patch functions
// ---------------------------------------------------------------------------

/** fleet.vehicle.table */
function patchVehicleTable(schema) {
  let columns = (schema.columns ?? []).map((col) => {
    if (col.component === "custom.fleet:InsuranceBadgeCell")
      return { ...col, component: "atlas.fleet:InsuranceBadgeCell" };
    if (col.component === "custom.fleet:VehicleStatusBadge")
      return { ...col, component: "atlas.fleet:VehicleStatusBadge" };
    if (col.component === "custom.fleet:VehicleImageCell")
      return { ...col, component: "atlas.fleet:VehicleImageCell" };
    if (col.component === "custom.fleet:DriverAssignedVehicleCell")
      return { ...col, component: "atlas.fleet:DriverAssignedVehicleCell" };
    return col;
  });

  // Always-visible core columns
  columns = upsertColumns(columns, [
    { field: "cover_image_file_asset_id", label: "Foto", component: "atlas.fleet:VehicleImageCell", visible: true },
    { field: "plate", label: "Matricula", visible: true },
    { field: "vehicle_brand_name", label: "Marca", visible: true },
    { field: "vehicle_model_name", label: "Modelo", visible: true },
    { field: "status", label: "Estado", component: "atlas.fleet:VehicleStatusBadge", visible: true },
    { field: "insurance_status", label: "Poliza", component: "atlas.fleet:InsuranceBadgeCell", visible: true },
    { field: "driver_name", label: "Chofer", visible: true },
  ]);

  // Optional / hidden columns for the column-toggle panel
  columns = upsertColumns(columns, [
    { field: "vehicle_type_name", label: "Tipo", visible: false },
    { field: "vehicle_model_year", label: "Ano", visible: false },
    { field: "color", label: "Color", visible: false },
    { field: "full_economic_number", label: "No. Economico", visible: false },
    { field: "economic_group_number", label: "Grupo Economico", visible: false },
    { field: "economic_individual_number", label: "No. Individual", visible: false },
    { field: "is_financed", label: "Financiado", visible: false },
    { field: "financing_institution", label: "Institucion", visible: false },
    { field: "financing_end_date", label: "Fin financiamiento", visible: false },
    { field: "doc_count", label: "Documentos", visible: false },
    { field: "created_at", label: "Registro", visible: false },
  ]);

  return { ...schema, columns };
}

/** fleet.vehicle.form */
function patchVehicleForm(schema) {
  return applyMainEntityFormPatches(schema);
}

/** fleet.vehicle.detail */
function patchVehicleDetail(schema) {
  const patched = {
    ...schema,
    title: schema.title ?? "Vehiculo",
  };

  const sections = (patched.sections ?? []).map((section) => {
    if (section.id === "active_insurance" && section.type === "relation-card") {
      return {
        ...section,
        relationCard: {
          icon: "ShieldCheck",
          idField: "active_insurance_policy.id",
          titleField: "active_insurance_policy.insurer_name",
          hrefTemplate: "/app/m/atlas.fleet/insurance/:id",
          fallbackTitle: "Sin poliza de seguro activa",
          subtitleFields: [
            "active_insurance_policy.policy_number",
            "active_insurance_policy.coverage_type_label",
            "active_insurance_policy.expiry_date",
          ],
        },
      };
    }
    if (section.id === "insurance_history" && section.type === "relation-list") {
      return {
        ...section,
        relationList: {
          apiPath: "/fleet/vehicles/:id/insurance",
          idField: "id",
          titleField: "name",
          subtitleFields: ["coverage_type_label", "start_date", "expiry_date"],
          subtitleLabels: ["Cobertura:", "Inicio:", "Vence:"],
          hrefTemplate: "/app/m/atlas.fleet/insurance/:id",
          emptyMessage: "Este vehiculo no tiene polizas registradas.",
          permission: "fleet.insurance.read",
        },
      };
    }
    return section;
  });

  return { ...patched, sections };
}

/** fleet.insurance_policy.table */
function patchInsuranceTable(schema) {
  let columns = (schema.columns ?? []).map((col) => {
    if (col.field === "is_active") {
      return { field: "status", label: "Estado", component: "atlas.fleet:InsuranceBadgeCell" };
    }
    if (col.component === "custom.fleet:InsuranceBadgeCell") {
      return {
        ...col,
        field: col.field === "is_active" ? "status" : col.field,
        component: "atlas.fleet:InsuranceBadgeCell",
      };
    }
    if (col.field === "coverage_type" || col.field === "coverage_type_label") {
      return {
        ...col,
        field: "coverage_type",
        label: col.label ?? "Cobertura",
        component: "atlas.fleet:CoverageTypeBadge",
      };
    }
    return col;
  });

  // Visible core columns
  columns = upsertColumns(columns, [
    { field: "policy_number", label: "No. Poliza", visible: true },
    { field: "insurer_name", label: "Aseguradora", visible: true },
    { field: "vehicle_plate", label: "Vehiculo", visible: true },
    { field: "coverage_type", label: "Cobertura", component: "atlas.fleet:CoverageTypeBadge", visible: true },
    { field: "status", label: "Estado", component: "atlas.fleet:InsuranceBadgeCell", visible: true },
    { field: "expiry_date", label: "Vencimiento", visible: true },
  ]);

  // Hidden extras for column-toggle
  columns = upsertColumns(columns, [
    { field: "start_date", label: "Inicio vigencia", visible: false },
    { field: "premium", label: "Prima", visible: false },
    { field: "currency", label: "Moneda", visible: false },
    { field: "notes", label: "Notas", visible: false },
    { field: "created_at", label: "Registro", visible: false },
  ]);

  return { ...schema, columns };
}

/** fleet.insurance_policy.form */
function patchInsuranceForm(schema) {
  const sections = transformFields(schema.sections ?? [], (field) => {
    switch (field.field) {
      case "vehicle_id":
        return {
          type: "relation",
          field: "vehicle_id",
          label: field.label ?? "Vehiculo",
          required: field.required ?? true,
          relation: {
            apiPath: "/fleet/vehicles",
            labelField: ["plate", "vehicle_brand_name", "vehicle_model_name"],
            labelSeparator: " · ",
            searchParam: "search",
            valueField: "id",
            pageSize: 50,
            displayFields: {
              badge: "plate",
              title: "vehicle_brand_name",
              subtitle: "vehicle_model_name",
            },
          },
        };

      case "document_asset_id":
        return {
          type: "file",
          field: "document_asset_id",
          label: field.label ?? "Certificado / Poliza",
          accept: ".pdf,.jpg,.jpeg,.png",
          entityType: "FleetInsurancePolicy",
        };

      case "coverage_type":
        return {
          type: "select",
          field: "coverage_type",
          label: field.label ?? "Tipo de cobertura",
          options: COVERAGE_TYPE_OPTIONS,
        };

      case "currency":
        return {
          type: "select",
          field: "currency",
          label: field.label ?? "Moneda",
          options: CURRENCY_OPTIONS,
        };

      case "notes":
        return { ...field, type: "markdown" };

      default:
        return field;
    }
  });
  const patched = { ...schema, sections };
  if (patched.formMode === "sheet") delete patched.formMode;
  return patched;
}

/** fleet.insurance_policy.detail — add eyebrow title */
function patchInsuranceDetail(schema) {
  return { ...schema, title: schema.title ?? "Poliza de seguro" };
}

/** fleet.driver.table */
function patchDriverTable(schema) {
  let columns = (schema.columns ?? []).map((col) => {
    if (col.component === "custom.fleet:DriverStatusBadge")
      return { ...col, component: "atlas.fleet:DriverStatusBadge" };
    if (col.component === "custom.fleet:DriverAvatarCell")
      return { ...col, component: "atlas.fleet:DriverAvatarCell" };
    if (col.component === "custom.fleet:DriverAssignedVehicleCell")
      return { ...col, component: "atlas.fleet:DriverAssignedVehicleCell" };
    return col;
  });

  // Visible core columns
  columns = upsertColumns(columns, [
    { field: "photo_asset_id", label: "Foto", component: "atlas.fleet:DriverAvatarCell", visible: true },
    { field: "first_name", label: "Nombre", visible: true },
    { field: "last_name", label: "Apellido", visible: true },
    { field: "license_number", label: "No. Licencia", visible: true },
    { field: "status", label: "Estado", component: "atlas.fleet:DriverStatusBadge", visible: true },
    { field: "assigned_vehicle", label: "Vehiculo asignado", component: "atlas.fleet:DriverAssignedVehicleCell", visible: true },
  ]);

  // Hidden extras
  columns = upsertColumns(columns, [
    { field: "phone", label: "Telefono", visible: false },
    { field: "email", label: "Email", visible: false },
    { field: "license_type", label: "Tipo licencia", visible: false },
    { field: "license_expiry_date", label: "Vencimiento licencia", visible: false },
    { field: "hr_employee_name", label: "Colaborador RH", visible: false },
    { field: "created_at", label: "Registro", visible: false },
  ]);

  return { ...schema, columns };
}

/** fleet.driver.detail — add eyebrow title */
function patchDriverDetail(schema) {
  return { ...schema, title: schema.title ?? "Chofer" };
}

/** Applied to all report TABLE blueprints */
function patchReportTable(schema) {
  let columns = schema.columns ?? [];

  // Visible core columns
  columns = upsertColumns(columns, [
    { field: "folio", label: "Folio", visible: true },
    { field: "title", label: "Titulo", visible: true },
    { field: "vehicle_plate", label: "Vehiculo", visible: true },
    { field: "report_date", label: "Fecha", visible: true },
    { field: "status", label: "Estado", component: "atlas.fleet:ReportStatusBadge", visible: true },
  ]);

  // Hidden extras
  columns = upsertColumns(columns, [
    { field: "vehicle_brand_name", label: "Marca", visible: false },
    { field: "vehicle_model_name", label: "Modelo", visible: false },
    { field: "odometer_km", label: "Odometro (km)", visible: false },
    { field: "total_cost", label: "Costo total", visible: false },
    { field: "labor_cost", label: "Mano de obra", visible: false },
    { field: "parts_cost", label: "Refacciones", visible: false },
    { field: "currency", label: "Moneda", visible: false },
    { field: "workshop_name", label: "Taller", visible: false },
    { field: "is_inhouse_workshop", label: "Taller interno", visible: false },
    { field: "finalized_at", label: "Finalizado", visible: false },
    { field: "created_at", label: "Registro", visible: false },
  ]);

  return applyMainEntityFormPatches({ ...schema, columns });
}

/** Applied to all report DETAIL blueprints — adds Finalizar + PDF actions */
function patchReportDetail(schema) {
  const patched = {
    ...schema,
    title: schema.title ?? "Reporte",
  };

  const existingActions = Array.isArray(patched.headerActions) ? patched.headerActions : [];
  const hasFinalize = existingActions.some((a) => a.key === "finalize");
  const hasPdf = existingActions.some((a) => a.key === "download_pdf");

  const headerActions = [...existingActions];

  if (!hasFinalize) {
    headerActions.push({
      key: "finalize",
      label: "Finalizar Reporte",
      method: "PATCH",
      pathTemplate: "/fleet/reports/:id/finalize",
      variant: "default",
      visibleWhen: { field: "status", equals: "draft" },
      refreshAfter: true,
    });
  }

  if (!hasPdf) {
    headerActions.push({
      key: "download_pdf",
      label: "Descargar PDF",
      method: "GET",
      pathTemplate: "/fleet/reports/:id/pdf",
      variant: "outline",
      download: true,
      downloadFileName: "reporte.pdf",
    });
  }

  return { ...patched, headerActions };
}

/** Applied to all report FORM blueprints — notes → markdown */
function patchReportForm(schema) {
  return applyMainEntityFormPatches(schema);
}

// ---------------------------------------------------------------------------
// Patch registry: map view key → patch function
// ---------------------------------------------------------------------------
const PATCH_BY_KEY = {
  "fleet.vehicle.table": patchVehicleTable,
  "fleet.vehicle.form": patchVehicleForm,
  "fleet.vehicle.detail": patchVehicleDetail,
  "fleet.insurance_policy.table": patchInsuranceTable,
  "fleet.insurance_policy.form": patchInsuranceForm,
  "fleet.insurance_policy.detail": patchInsuranceDetail,
  "fleet.driver.table": patchDriverTable,
  "fleet.driver.form": applyMainEntityFormPatches,
  "fleet.driver.detail": patchDriverDetail,
};

// ---------------------------------------------------------------------------
// Fallback rules — applied when no explicit entry found
// ---------------------------------------------------------------------------
function getFallbackPatch(view) {
  const key = view.key;
  const type = view.type;
  const schema = view.schema;

  // Report TABLE views
  if (type === "TABLE" && key.includes("report")) {
    return patchReportTable;
  }

  // Report DETAIL views
  if (type === "DETAIL" && key.includes("report")) {
    return patchReportDetail;
  }

  // Report FORM views
  if (type === "FORM" && key.includes("report")) {
    return patchReportForm;
  }

  // Catalog FORM views → sheet mode
  if (type === "FORM" && key.includes("catalog")) {
    return applyCatalogFormPatches;
  }

  // Other FORM views → notes→markdown only
  if (type === "FORM") {
    return applyMainEntityFormPatches;
  }

  // Catalog TABLE views → grid
  if (type === "TABLE" && key.includes("catalog")) {
    return (s) => ({ ...s, defaultViewMode: "grid" });
  }

  // Any stale custom.fleet: namespace references
  const schemaStr = JSON.stringify(schema);
  if (schemaStr.includes("custom.fleet:")) return fixComponentNamespace;

  return null;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log(
    DRY_RUN
      ? "DRY RUN — no changes will be written\n"
      : "Syncing fleet blueprints...\n",
  );

  const views = await prisma.atlasView.findMany({
    where: {
      moduleKey: { in: ["custom.fleet", "atlas.fleet"] },
    },
    orderBy: { key: "asc" },
  });

  console.log(`Found ${views.length} fleet view(s):\n`);
  for (const v of views) {
    console.log(
      `  ${v.key.padEnd(52)} type=${v.type.padEnd(8)} moduleKey=${v.moduleKey}`,
    );
  }
  console.log();

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const view of views) {
    let patchFn = PATCH_BY_KEY[view.key];

    if (patchFn === null) {
      skipped++;
      continue;
    }

    if (patchFn === undefined) {
      patchFn = getFallbackPatch(view);
    }

    if (!patchFn) {
      skipped++;
      continue;
    }

    try {
      const currentSchema = view.schema;
      const namespacedFixed = fixComponentNamespace(currentSchema);
      const patchedSchema = patchFn(namespacedFixed);

      if (DRY_RUN) {
        const diff = JSON.stringify(patchedSchema) !== JSON.stringify(currentSchema);
        console.log(`  ${diff ? "~" : "="} ${view.key}${diff ? " [would update]" : " [no change]"}`);
      } else {
        await prisma.atlasView.update({
          where: { key: view.key },
          data: { schema: patchedSchema },
        });
        console.log(`  Updated: ${view.key}`);
      }
      updated++;
    } catch (err) {
      console.error(`  Error on ${view.key}: ${err.message}`);
      errors++;
    }
  }

  const label = DRY_RUN ? "Would update" : "Updated";
  console.log(`\nDone. ${label}: ${updated}, Skipped: ${skipped}, Errors: ${errors}`);
}

main()
  .catch((err) => {
    console.error("Script failed:", err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
