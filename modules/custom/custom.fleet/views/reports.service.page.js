import { definePage } from "@atlas/module-engine";

export default definePage({
  key: "fleet.reports.service.page",
  path: "/app/m/custom.fleet/reports/service",
  title: "Reportes de Servicio",
  layout: "main",
  view: "fleet.reports.service.table",
  tabLabel: "Servicio",
  tabOrder: 2,
});

