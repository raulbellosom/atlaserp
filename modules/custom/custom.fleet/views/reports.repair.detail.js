import { defineView } from "@atlas/module-engine";

export default defineView({
  key: "fleet.reports.repair.detail",
  kind: "DETAIL",
  version: "0.1.0",
  schema: {
    entity: "report",
    component: "AtlasDetail",
    apiPath: "/fleet/reports/repair",
    sections: [
      {
        label: "Informacion general",
        columns: 2,
        fields: [
          { field: "folio", label: "Folio", icon: "Hash" },
          { field: "title", label: "Titulo", icon: "ClipboardList" },
          { field: "status", label: "Estado", icon: "Activity" },
          { field: "report_date", label: "Fecha", type: "date", icon: "CalendarDays" },
          { field: "odometer_km", label: "Kilometraje", icon: "Hash" },
          { field: "repair_priority", label: "Prioridad", icon: "Tag", type: "select", options: [
            { label: "Baja", value: "low" },
            { label: "Normal", value: "normal" },
            { label: "Alta", value: "high" },
            { label: "Urgente", value: "urgent" },
          ] },
          { field: "repair_damage_type", label: "Tipo de dano", icon: "Wrench", type: "select", options: [
            { label: "Mecanico", value: "mechanical" },
            { label: "Electrico", value: "electrical" },
            { label: "Carroceria", value: "body" },
            { label: "Interior", value: "interior" },
            { label: "Otro", value: "other" },
          ] },
          { field: "repair_start_date", label: "Inicio", type: "date", icon: "CalendarDays" },
          { field: "repair_completion_date", label: "Fin", type: "date", icon: "CalendarDays" },
        ],
      },
      {
        id: "related_vehicle",
        type: "relation-card",
        label: "Vehiculo",
        relationCard: {
          idField: "vehicle_id",
          titleField: "vehicle_plate",
          subtitleFields: ["vehicle_brand_name", "vehicle_model_name"],
          fallbackTitle: "Vehiculo no disponible",
          hrefTemplate: "/app/m/custom.fleet/vehicles/:id",
          icon: "Truck",
        },
      },
      {
        label: "Costos y garantia",
        columns: 2,
        fields: [
          { field: "repair_estimated_cost", label: "Estimado", type: "currency", icon: "Tag" },
          { field: "labor_cost", label: "Mano de obra", type: "currency", icon: "Tag" },
          { field: "parts_cost", label: "Refacciones", type: "currency", icon: "Tag" },
          { field: "total_cost", label: "Total", type: "currency", icon: "Tag" },
          { field: "warranty_days", label: "Dias garantia", icon: "Hash" },
          { field: "warranty_notes", label: "Notas garantia", icon: "FileText" },
        ],
      },
      {
        id: "parts",
        type: "relation-list",
        label: "Refacciones / Partes",
        relationList: {
          apiPath: "/fleet/reports/:id/parts",
          idField: "id",
          titleField: "name",
          subtitleFields: ["quantity", "unit_cost", "subtotal"],
          icon: "Wrench",
          emptyMessage: "No hay refacciones registradas.",
        },
      },
      {
        label: "Observaciones",
        fields: [{ field: "notes", label: "Notas", icon: "FileText" }],
      },
      {
        id: "documents",
        type: "documents",
        label: "Archivos adjuntos",
        documents: {
          listPath: "/fleet/reports/:id/documents",
          addPath: "/fleet/reports/:id/documents",
          removePath: "/fleet/reports/:id/documents/:docId",
          upload: {
            endpoint: "/files/upload",
            moduleKey: "custom.fleet",
            entityType: "FleetReport",
          },
          fields: {
            associationId: "id",
            fileAssetId: "file_asset_id",
            documentType: "document_type",
            label: "label",
            createdAt: "created_at",
            enabled: "enabled",
            fileAsset: "file_asset",
            fileName: "originalName",
            mimeType: "mimeType",
            sizeBytes: "sizeBytes",
          },
          signedUrl: {
            endpointTemplate: "/files/:fileId/signed-url",
          },
          permissions: {
            read: "fleet.reports.read",
            create: "fleet.reports.update",
            remove: "fleet.reports.update",
            fileUpload: "files.assets.create",
            fileRead: "files.assets.read",
          },
        },
      },
    ],
    headerActions: [
      { key: "download_pdf", label: "Descargar PDF", method: "GET", pathTemplate: "/fleet/reports/:id/pdf", download: true, downloadFileName: "reporte-flota.pdf", refreshAfter: false, variant: "outline" },
      { key: "regenerate_pdf", label: "Regenerar PDF", method: "GET", pathTemplate: "/fleet/reports/:id/pdf", refreshAfter: false, variant: "outline" },
      { key: "finalize", label: "Finalizar", method: "POST", pathTemplate: "/fleet/reports/:id/finalize", visibleWhen: { field: "status", equals: "draft" }, variant: "default" },
      { key: "reopen", label: "Reabrir", method: "POST", pathTemplate: "/fleet/reports/:id/reopen", visibleWhen: { field: "status", equals: "finalized" }, variant: "outline" },
    ],
    actions: [{ label: "Editar", permission: "fleet.reports.update" }], 
  },
});

