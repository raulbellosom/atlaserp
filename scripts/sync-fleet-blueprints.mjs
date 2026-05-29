/**
 * sync-fleet-blueprints.mjs
 *
 * Discovers all atlas.fleet / custom.fleet AtlasView rows in the database and
 * applies targeted schema patches to fix known issues:
 *
 *  1. Replace `custom.fleet:*` component keys → `atlas.fleet:*`
 *  2. Replace `is_active` boolean column → `status` string with InsuranceBadgeCell
 *  3. Insurance form: vehicle_id → relation, document_asset_id → file,
 *     coverage_type → select (Spanish labels), currency → select, notes → markdown
 *     (no formMode override — 3 sections triggers page mode naturally)
 *  4. Vehicle/Driver/Report forms: notes → markdown (no formMode — page mode by default)
 *  8. Catalog FORM views: formMode → "sheet" (prevents full-page navigation for simple forms)
 *  5. Vehicle detail: insurance section labelField hints
 *  6. Coverage type column: use atlas.fleet:CoverageTypeBadge
 *  7. Catalog TABLE views: defaultViewMode → "grid"
 *
 * Run: node scripts/sync-fleet-blueprints.mjs
 * Run (dry): node scripts/sync-fleet-blueprints.mjs --dry-run
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
// Coverage type select options (Spanish labels)
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

/**
 * Replace all "custom.fleet:ComponentName" references with "atlas.fleet:ComponentName"
 * in a schema object (operates on the JSON string).
 */
function fixComponentNamespace(schema) {
  const str = JSON.stringify(schema);
  if (!str.includes("custom.fleet:")) return schema;
  return JSON.parse(str.replaceAll("custom.fleet:", "atlas.fleet:"));
}

/**
 * Walk all section fields and apply a per-field transform function.
 */
function transformFields(sections, transform) {
  if (!Array.isArray(sections)) return sections;
  return sections.map((section) => {
    if (!Array.isArray(section.fields)) return section;
    return { ...section, fields: section.fields.map(transform) };
  });
}

/**
 * Apply common form patches for MAIN ENTITIES (vehicle, driver, insurance, reports).
 * Does NOT set formMode — these forms have >2 sections so shouldUsePageMode() already
 * returns true (page/detail navigation), which is the desired behavior.
 * Only converts notes/observations fields to markdown.
 */
function applyMainEntityFormPatches(schema) {
  const sections = transformFields(schema.sections ?? [], (field) => {
    if (field.field === "notes" || field.field === "observations") {
      return { ...field, type: "markdown" };
    }
    return field;
  });
  // Remove any stale formMode:sheet that may have been set by a previous run
  const patched = { ...schema, sections };
  if (patched.formMode === "sheet") delete patched.formMode;
  return patched;
}

/**
 * Apply common form patches for CATALOG FORMS (brands, types, models).
 * Sets formMode:"sheet" so these simple forms open as a drawer instead of
 * navigating to a full page (they have few sections/fields so the heuristic
 * alone would not trigger page-mode, causing unexpected full-page navigation).
 */
function applyCatalogFormPatches(schema) {
  const sections = transformFields(schema.sections ?? [], (field) => {
    if (field.field === "notes" || field.field === "observations") {
      return { ...field, type: "markdown" };
    }
    return field;
  });
  return { ...schema, sections, formMode: "sheet" };
}

/** @deprecated — use applyMainEntityFormPatches or applyCatalogFormPatches instead */
const applyCommonFormPatches = applyMainEntityFormPatches;

// ---------------------------------------------------------------------------
// Per-key patch functions
// ---------------------------------------------------------------------------

/** fleet.vehicle.table — fix insurance badge namespace + add if missing */
function patchVehicleTable(schema) {
  let columns = (schema.columns ?? []).map((col) => {
    if (col.component === "custom.fleet:InsuranceBadgeCell") {
      return { ...col, component: "atlas.fleet:InsuranceBadgeCell" };
    }
    if (col.component === "custom.fleet:VehicleStatusBadge") {
      return { ...col, component: "atlas.fleet:VehicleStatusBadge" };
    }
    if (col.component === "custom.fleet:VehicleImageCell") {
      return { ...col, component: "atlas.fleet:VehicleImageCell" };
    }
    if (col.component === "custom.fleet:DriverAssignedVehicleCell") {
      return { ...col, component: "atlas.fleet:DriverAssignedVehicleCell" };
    }
    return col;
  });

  // Ensure insurance_status column exists
  if (!columns.some((c) => c.field === "insurance_status")) {
    columns = [
      ...columns,
      {
        field: "insurance_status",
        label: "Póliza",
        component: "atlas.fleet:InsuranceBadgeCell",
      },
    ];
  }

  return { ...schema, columns };
}

/** fleet.vehicle.form — notes → markdown (no formMode change) */
function patchVehicleForm(schema) {
  return applyMainEntityFormPatches(schema);
}

/** fleet.vehicle.detail — fix insurance relation sections */
function patchVehicleDetail(schema) {
  const sections = (schema.sections ?? []).map((section) => {
    // Fix active insurance relation-card: use dot-notation for nested policy object
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
    // Fix insurance history relation-list: replace columns[] format with titleField/subtitleFields
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
  return { ...schema, sections };
}

/** fleet.insurance-policy.table — replace is_active with status, add coverage badge */
function patchInsuranceTable(schema) {
  let columns = (schema.columns ?? []).map((col) => {
    // Replace is_active boolean column with status string
    if (col.field === "is_active") {
      return {
        field: "status",
        label: "Estado",
        component: "atlas.fleet:InsuranceBadgeCell",
      };
    }
    // Fix old namespace
    if (col.component === "custom.fleet:InsuranceBadgeCell") {
      return {
        ...col,
        field: col.field === "is_active" ? "status" : col.field,
        component: "atlas.fleet:InsuranceBadgeCell",
      };
    }
    // Fix coverage_type to use badge component
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

  // Add coverage_type badge column if missing
  if (!columns.some((c) => c.field === "coverage_type")) {
    columns = [
      ...columns,
      {
        field: "coverage_type",
        label: "Cobertura",
        component: "atlas.fleet:CoverageTypeBadge",
      },
    ];
  }

  // Add helpful but hidden extra columns for column-toggle panel
  const extras = [
    { field: "vehicle_plate", label: "Vehículo" },
    { field: "expiry_date", label: "Vencimiento" },
    { field: "premium", label: "Prima" },
    { field: "currency", label: "Moneda" },
  ];
  for (const extra of extras) {
    if (!columns.some((c) => c.field === extra.field)) {
      columns = [...columns, { ...extra, visible: false }];
    }
  }

  return { ...schema, columns };
}

/** fleet.insurance-policy.form — full treatment (no formMode:sheet — has 3 sections, uses page mode by default) */
function patchInsuranceForm(schema) {
  const sections = transformFields(schema.sections ?? [], (field) => {
    switch (field.field) {
      case "vehicle_id":
        return {
          type: "relation",
          field: "vehicle_id",
          label: field.label ?? "Vehículo",
          required: field.required ?? true,
          relation: {
            apiPath: "/fleet/vehicles",
            labelField: ["plate", "vehicle_brand_name", "vehicle_model_name"],
            searchParam: "search",
            valueField: "id",
          },
        };

      case "document_asset_id":
        return {
          type: "file",
          field: "document_asset_id",
          label: field.label ?? "Certificado / Póliza",
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
  // No formMode override — insurance form has 3 sections so shouldUsePageMode()
  // already returns true (page navigation = detail page). Do not force sheet here.
  const patched = { ...schema, sections };
  if (patched.formMode === "sheet") delete patched.formMode;
  return patched;
}

/** fleet.driver.table — fix component namespace */
function patchDriverTable(schema) {
  const columns = (schema.columns ?? []).map((col) => {
    if (col.component === "custom.fleet:DriverStatusBadge") {
      return { ...col, component: "atlas.fleet:DriverStatusBadge" };
    }
    if (col.component === "custom.fleet:DriverAvatarCell") {
      return { ...col, component: "atlas.fleet:DriverAvatarCell" };
    }
    if (col.component === "custom.fleet:DriverAssignedVehicleCell") {
      return { ...col, component: "atlas.fleet:DriverAssignedVehicleCell" };
    }
    return col;
  });
  return { ...schema, columns };
}

// Report forms: notes → markdown, no formMode change (page mode by default due to many sections)

// ---------------------------------------------------------------------------
// Patch registry: map view key → patch function
// ---------------------------------------------------------------------------
const PATCH_BY_KEY = {
  "fleet.vehicle.table": patchVehicleTable,
  "fleet.vehicle.form": patchVehicleForm,
  "fleet.vehicle.detail": patchVehicleDetail,
  "fleet.insurance_policy.table": patchInsuranceTable,
  "fleet.insurance_policy.form": patchInsuranceForm,
  "fleet.driver.table": patchDriverTable,
  "fleet.driver.form": applyMainEntityFormPatches,
  "fleet.driver.detail": null, // no specific patches needed
};

// Fallback rules (applied when no explicit entry found)
function getFallbackPatch(view) {
  const key = view.key;
  const type = view.type; // TABLE | FORM | DETAIL | PAGE | CUSTOM
  const schema = view.schema;

  // Any FORM → catalog forms get formMode:sheet; main entity forms get notes→markdown only
  if (type === "FORM") {
    return key.includes("catalog")
      ? applyCatalogFormPatches
      : applyMainEntityFormPatches;
  }

  // Catalog TABLE views → defaultViewMode:grid
  if (type === "TABLE" && key.includes("catalog")) {
    return (s) => ({ ...s, defaultViewMode: "grid" });
  }

  // Any view with stale custom.fleet: component references
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
      ? "🔍 DRY RUN — no changes will be written\n"
      : "🔄 Syncing fleet blueprints...\n",
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
      `  ${v.key.padEnd(48)} type=${v.type.padEnd(8)} moduleKey=${v.moduleKey}`,
    );
  }
  console.log();

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const view of views) {
    let patchFn = PATCH_BY_KEY[view.key];

    // null means explicitly no patch needed
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
      // Always fix namespace as a first step, then apply specific patch
      const namespacedFixed = fixComponentNamespace(currentSchema);
      const patchedSchema = patchFn(namespacedFixed);

      if (DRY_RUN) {
        const diff =
          JSON.stringify(patchedSchema) !== JSON.stringify(currentSchema);
        console.log(
          `  ${diff ? "~" : "="} ${view.key}${diff ? " [would update]" : " [no change]"}`,
        );
      } else {
        await prisma.atlasView.update({
          where: { key: view.key },
          data: { schema: patchedSchema },
        });
        console.log(`  ✓ Updated: ${view.key}`);
      }
      updated++;
    } catch (err) {
      console.error(`  ✗ Error on ${view.key}: ${err.message}`);
      errors++;
    }
  }

  const label = DRY_RUN ? "Would update" : "Updated";
  console.log(
    `\nDone. ${label}: ${updated}, Skipped: ${skipped}, Errors: ${errors}`,
  );
}

main()
  .catch((err) => {
    console.error("Script failed:", err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
