import { definePage } from "@atlas/module-engine";

export default definePage({
  key: "fleet.reports.repair.page",
  path: "/app/m/atlas.fleet/reports/repair",
  title: "Reportes de Reparacion",
  layout: "main",
  view: "fleet.reports.repair.table",
  tabLabel: "Reparacion",
  tabOrder: 3,
});
