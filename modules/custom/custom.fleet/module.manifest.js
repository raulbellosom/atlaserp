import { defineAtlasModule } from "@atlas/module-engine";

export default defineAtlasModule({
  key: "custom.fleet",
  name: "Flota",
  version: "0.1.0",
  kind: "FEATURE",
  description:
    "Gestion de flota vehicular: vehiculos, mantenimiento y asignacion de conductores.",
  icon: "truck",
  color: "#14B8A6",
  accentColor: "#0F766E",
  initials: "FL",
  logoUrl: null,
  cover: null,
  dependencies: [{ key: "atlas.core" }],
  models: ["./models/vehicle.model.js", "./models/maintenance.model.js"],
  views: [
    "./views/vehicle.table.js",
    "./views/vehicle.form.js",
    "./views/vehicle.detail.js",
    "./views/vehicle.page.js",
  ],
  lifecycle: {
    installable: true,
    uninstallable: true,
    resettable: true,
    supportsDataPurge: true,
    defaultUninstallPolicy: "preserve-data",
    ownedModels: ["fleet.vehicle", "fleet.maintenance"],
    ownedTables: ["fleet_vehicle", "fleet_maintenance"],
    // Legacy compatibility for existing lifecycle handlers.
    ownedEntities: ["Vehicle", "Maintenance"],
    sharedEntities: ["Company", "AuditLog"],
  },
  permissions: [
    { key: "fleet.access", name: "Acceso a Flota" },
    { key: "fleet.vehicles.read", name: "Ver vehiculos" },
    { key: "fleet.vehicles.create", name: "Crear vehiculos" },
    { key: "fleet.vehicles.update", name: "Editar vehiculos" },
    { key: "fleet.vehicles.delete", name: "Desactivar vehiculos" },
    { key: "fleet.maintenance.read", name: "Ver mantenimiento" },
    { key: "fleet.maintenance.create", name: "Registrar mantenimiento" },
    { key: "fleet.maintenance.update", name: "Editar mantenimiento" },
    {
      key: "fleet.maintenance.delete",
      name: "Eliminar registros de mantenimiento",
    },
  ],
  acl: {
    module: "fleet.access",
    actions: {
      "fleet.vehicles.read": "fleet.vehicles.read",
      "fleet.vehicles.create": "fleet.vehicles.create",
      "fleet.vehicles.update": "fleet.vehicles.update",
      "fleet.vehicles.delete": "fleet.vehicles.delete",
      "fleet.maintenance.read": "fleet.maintenance.read",
      "fleet.maintenance.create": "fleet.maintenance.create",
      "fleet.maintenance.update": "fleet.maintenance.update",
      "fleet.maintenance.delete": "fleet.maintenance.delete",
    },
    models: {
      Vehicle: {
        read: "fleet.vehicles.read",
        create: "fleet.vehicles.create",
        update: "fleet.vehicles.update",
        delete: "fleet.vehicles.delete",
      },
      Maintenance: {
        read: "fleet.maintenance.read",
        create: "fleet.maintenance.create",
        update: "fleet.maintenance.update",
        delete: "fleet.maintenance.delete",
      },
    },
  },
  navigation: [
    {
      label: "Vehiculos",
      path: "/app/m/custom.fleet/vehicles",
      icon: "Truck",
      layout: "main",
      permissionKey: "fleet.vehicles.read",
    },
    {
      label: "Mantenimiento",
      path: "/app/m/custom.fleet/maintenance",
      icon: "Wrench",
      layout: "main",
      permissionKey: "fleet.maintenance.read",
    },
  ],
});
