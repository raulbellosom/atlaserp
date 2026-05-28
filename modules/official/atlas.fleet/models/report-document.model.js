import { defineModel } from "@atlas/module-engine";

export default defineModel({
  key: "report_document",
  name: "fleet.report_document",
  label: "Documento de reporte",
  tableName: "fleet_report_document",
  companyScoped: true,
  softDelete: false,
  fields: [
    { name: "report_id", type: "relation", label: "Reporte (ID)", required: true },
    { name: "file_asset_id", type: "file", label: "Archivo (ID)", required: true },
    { name: "document_type", type: "text", label: "Tipo documento", default: "document", maxLength: 50 },
    { name: "label", type: "text", label: "Etiqueta", maxLength: 200 },
    { name: "enabled", type: "boolean", label: "Activo", default: true },
  ],
  indexes: [
    { fields: ["company_id", "report_id"] },
    { fields: ["company_id", "file_asset_id"] },
  ],
});
