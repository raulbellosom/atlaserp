import { defineView } from "@atlas/module-engine";

export default defineView({
  key: "fleet.vehicle.table",
  kind: "TABLE",
  version: "0.1.0",
  schema: {
    entity: "vehicle",
    component: "AtlasTable",
    apiPath: "/fleet/vehicles",
    searchable: true,
    searchPlaceholder: "Buscar vehículo...",
    columns: [
      { field: "plate", label: "Matricula", sortable: true },
      { field: "brand", label: "Marca", sortable: true },
      { field: "model_name", label: "Modelo", sortable: true },
      { field: "year", label: "Anio", sortable: true },
      {
        field: "status",
        label: "Estado",
        sortable: false,
        component: "custom.fleet:VehicleStatusBadge",
      },
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
