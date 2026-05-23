import { definePage } from "@atlas/module-engine";

export default definePage({
  key: "fleet.reports.maintenance.page",
  path: "/app/m/custom.fleet/reports/maintenance",
  title: "Reportes de Mantenimiento",
  layout: "main",
  view: "fleet.reports.maintenance.table",
  tabLabel: "Mantenimiento",
  tabOrder: 1,
});

