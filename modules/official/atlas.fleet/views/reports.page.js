import { definePage } from "@atlas/module-engine";

export default definePage({
  key: "fleet.reports.page",
  path: "/app/m/atlas.fleet/reports",
  title: "Reportes de Flota",
  layout: "main",
  view: "fleet.reports.maintenance.table",
});
