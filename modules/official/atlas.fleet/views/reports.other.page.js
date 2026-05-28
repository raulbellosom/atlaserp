import { definePage } from "@atlas/module-engine";

export default definePage({
  key: "fleet.reports.other.page",
  path: "/app/m/atlas.fleet/reports/other",
  title: "Otros Reportes",
  layout: "main",
  view: "fleet.reports.other.table",
  tabLabel: "Otro",
  tabOrder: 4,
});
