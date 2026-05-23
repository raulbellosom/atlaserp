import { defineView } from "@atlas/module-engine";

export default defineView({
  key: "fleet.vehicle.table",
  kind: "TABLE",
  version: "0.1.0",
  schema: {
    entity: "vehicle",
    component: "AtlasTable",
    apiPath: "/fleet/vehicles",
    primaryField: "plate",
    searchable: true,
    searchPlaceholder: "Buscar vehículo...",
    columns: [
      { field: "plate",              label: "Matricula",     sortable: true,  link: true },
      { field: "vehicle_brand_name", label: "Marca",         sortable: false },
      { field: "vehicle_model_name", label: "Modelo",        sortable: false },
      { field: "year",               label: "Año",           sortable: true,  type: "number" },
      { field: "color",              label: "Color",         sortable: false, type: "color" },
      {
        field: "status",
        label: "Estado",
        sortable: true,
        component: "custom.fleet:VehicleStatusBadge",
      },
      { field: "full_economic_number", label: "No. Economico", sortable: false },
      { field: "vehicle_type_name",  label: "Tipo",          sortable: false },
      { field: "driver_name",        label: "Conductor",     sortable: false },
    ],
    actions: [
      {
        label: "Crear vehiculo",
        permission: "fleet.vehicles.create",
        variant: "primary",
      },
    ],
    rowActions: [
      { label: "Ver detalle", permission: "fleet.vehicles.read" },
      { label: "Editar", permission: "fleet.vehicles.update" },
      { label: "Desactivar", permission: "fleet.vehicles.delete" },
    ],
    emptyState: {
      message: "No hay vehiculos registrados.",
    },
  },
});
