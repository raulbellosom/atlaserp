import { defineView } from "@atlas/module-engine";

export default defineView({
  key: "fleet.reports.repair.table",
  kind: "TABLE",
  version: "0.2.0",
  schema: {
    entity: "report",
    component: "AtlasTable",
    apiPath: "/fleet/reports/repair",
    primaryField: "title",
    searchable: true,
    searchPlaceholder: "Buscar reportes de reparacion...",
    columns: [
      { field: "folio", label: "Folio", sortable: true },
      { field: "title", label: "Titulo", sortable: true, link: true },
      { field: "vehicle_plate", label: "Vehiculo" },
      { field: "repair_priority", label: "Prioridad" },
      { field: "status", label: "Estado", sortable: true },
      { field: "report_date", label: "Fecha", type: "date", sortable: true },
      { field: "total_cost", label: "Total", type: "number", sortable: true },
    ],
    actions: [{ label: "Nuevo reporte de reparacion", permission: "fleet.reports.create", variant: "primary" }],
    rowActions: [
      { label: "Ver detalle", permission: "fleet.reports.read" },
      { label: "Editar", permission: "fleet.reports.update" },
      { label: "Desactivar", permission: "fleet.reports.delete" },
    ],
  },
});

