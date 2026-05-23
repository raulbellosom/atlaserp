import { defineView } from "@atlas/module-engine";

export default defineView({
  key: "fleet.reports.maintenance.detail",
  kind: "DETAIL",
  version: "0.1.0",
  schema: {
    entity: "report",
    component: "AtlasDetail",
    apiPath: "/fleet/reports/maintenance",
    sections: [
      {
        label: "Informacion general",
        columns: 2,
        fields: [
          { field: "folio", label: "Folio", icon: "Hash" },
          { field: "title", label: "Titulo", icon: "ClipboardList" },
          { field: "status", label: "Estado", icon: "Activity" },
          { field: "report_type_label", label: "Tipo", icon: "Layers" },
          { field: "report_date", label: "Fecha", type: "date", icon: "CalendarDays" },
          { field: "odometer_km", label: "Kilometraje", icon: "Hash", type: "number" },
          { field: "maintenance_subtype", label: "Subtipo", icon: "Wrench", type: "select", options: [
            { label: "Preventivo", value: "preventive" },
            { label: "Correctivo", value: "corrective" },
            { label: "Inspeccion", value: "inspection" },
            { label: "Alineacion", value: "alignment" },
            { label: "Cambio de aceite", value: "oil_change" },
            { label: "Llantas", value: "tire_service" },
            { label: "Otro", value: "other" },
          ] },
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
        label: "Taller y costos",
        columns: 2,
        fields: [
          { field: "workshop_name", label: "Taller", icon: "Library" },
          { field: "invoice_number", label: "Factura/Ticket", icon: "FileText" },
          { field: "workshop_phone", label: "Telefono", icon: "Phone" },
          { field: "workshop_address", label: "Direccion", icon: "Link2" },
          { field: "labor_cost", label: "Mano de obra", type: "currency", icon: "Tag" },
          { field: "parts_cost", label: "Refacciones", type: "currency", icon: "Tag" },
          { field: "total_cost", label: "Total", type: "currency", icon: "Tag" },
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
          subtitleLabels: ["Cant.", "P.U.", "Subtotal"],
          subtitleTypes: ["integer", "currency", "currency"],
          icon: "Wrench",
          emptyMessage: "No hay refacciones registradas.",
        },
      },
      {
        label: "Proximo servicio",
        columns: 2,
        fields: [
          { field: "next_service_date", label: "Fecha sugerida", type: "date", icon: "CalendarDays" },
          { field: "next_service_odometer", label: "Kilometraje sugerido", icon: "Hash", type: "number" },
        ],
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
      { key: "download_pdf", label: "Descargar PDF", method: "GET", pathTemplate: "/fleet/reports/:id/pdf", download: true, downloadFileName: "reporte-flota.pdf", refreshAfter: false, variant: "outline", visibleWhen: { field: "status", equals: "finalized" } },
      { key: "regenerate_pdf", label: "Regenerar PDF", method: "GET", pathTemplate: "/fleet/reports/:id/pdf", refreshAfter: false, variant: "outline", visibleWhen: { field: "status", equals: "finalized" } },
      { key: "finalize", label: "Finalizar", method: "POST", pathTemplate: "/fleet/reports/:id/finalize", visibleWhen: { field: "status", equals: "draft" }, variant: "default" },
      { key: "reopen", label: "Reabrir", method: "POST", pathTemplate: "/fleet/reports/:id/reopen", visibleWhen: { field: "status", equals: "finalized" }, variant: "outline" },
    ],
    actions: [{ label: "Editar", permission: "fleet.reports.update" }], 
  },
});

