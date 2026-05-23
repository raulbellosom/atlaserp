import { defineModel } from "@atlas/module-engine";

export default defineModel({
  key: "report_part",
  name: "fleet.report_part",
  label: "Refaccion de reporte",
  tableName: "fleet_report_part",
  companyScoped: true,
  softDelete: false,
  fields: [
    { name: "report_id", type: "text", label: "Reporte (ID)", required: true },
    { name: "name", type: "text", label: "Nombre", required: true, maxLength: 200 },
    { name: "quantity", type: "number", label: "Cantidad", required: true },
    { name: "unit_cost", type: "decimal", label: "Costo unitario", required: true },
    { name: "subtotal", type: "decimal", label: "Subtotal", required: true },
    { name: "notes", type: "textarea", label: "Notas", maxLength: 500 },
    { name: "enabled", type: "boolean", label: "Activo", default: true },
  ],
  indexes: [{ fields: ["company_id", "report_id"] }],
});

