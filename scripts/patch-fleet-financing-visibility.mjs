/**
 * One-time patch: add visibleWhen conditions to fleet vehicle form financing fields.
 *
 * When `is_financed` toggle is OFF, all financing sub-fields are hidden.
 * When `is_financed` is ON, they become visible.
 *
 * Run: node scripts/patch-fleet-financing-visibility.mjs
 */
import "dotenv/config";
import pkg from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const { PrismaClient } = pkg;
const prismaAdapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL ?? process.env.DIRECT_URL,
});
const prisma = new PrismaClient({ adapter: prismaAdapter });

/** Fields that must be hidden unless is_financed === true */
const FINANCING_FIELDS = new Set([
  "financing_institution",
  "financing_contract_number",
  "financing_start_date",
  "financing_end_date",
  "financing_monthly_payment",
  "financing_notes",
]);

function patchSections(sections) {
  if (!Array.isArray(sections)) return sections;
  return sections.map((section) => {
    if (!Array.isArray(section.fields)) return section;
    const patchedFields = section.fields.map((field) => {
      if (!FINANCING_FIELDS.has(field.field)) return field;
      // Already has the correct visibleWhen — skip
      if (
        field.visibleWhen?.field === "is_financed" &&
        field.visibleWhen?.equals === true
      ) {
        return field;
      }
      return {
        ...field,
        visibleWhen: { field: "is_financed", equals: true },
      };
    });
    return { ...section, fields: patchedFields };
  });
}

async function main() {
  const view = await prisma.atlasView.findUnique({
    where: { key: "fleet.vehicle.form" },
  });

  if (!view) {
    console.error("Error: fleet.vehicle.form AtlasView not found in database.");
    process.exit(1);
  }

  const schema = view.schema;
  console.log("Current schema sections:");
  if (Array.isArray(schema.sections)) {
    schema.sections.forEach((s) => {
      console.log(
        `  Section "${s.label}": ${s.fields?.map((f) => f.field).join(", ")}`,
      );
    });
  }

  const patchedSchema = {
    ...schema,
    sections: patchSections(schema.sections),
  };

  // Verify what changed
  let patched = 0;
  if (Array.isArray(patchedSchema.sections)) {
    patchedSchema.sections.forEach((s) => {
      s.fields?.forEach((f) => {
        if (FINANCING_FIELDS.has(f.field)) {
          patched++;
          console.log(`  Patched: ${f.field} → visibleWhen.equals = true`);
        }
      });
    });
  }

  if (patched === 0) {
    console.log("\nNo financing fields found. Nothing to patch.");
    console.log(
      "Make sure the Financiamiento section exists in the form blueprint.",
    );
    process.exit(0);
  }

  await prisma.atlasView.update({
    where: { key: "fleet.vehicle.form" },
    data: { schema: patchedSchema },
  });

  console.log(
    `\nDone. Patched ${patched} financing field(s) with visibleWhen condition.`,
  );
  console.log(
    'The financing fields will now be hidden when "Vehiculo financiado" is OFF.',
  );
}

main()
  .catch((err) => {
    console.error("Script failed:", err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
