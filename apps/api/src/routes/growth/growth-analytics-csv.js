function csvValue(value) {
  if (value == null) return "";
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function csvRows(headers, rows) {
  return [
    headers.map(({ label }) => csvValue(label)).join(","),
    ...rows.map((row) =>
      headers.map(({ key }) => csvValue(row[key])).join(","),
    ),
  ].join("\r\n");
}

const REPORTS = {
  overview: {
    headers: [
      { key: "date", label: "Fecha" },
      { key: "visitors", label: "Visitantes" },
      { key: "sessions", label: "Sesiones" },
      { key: "engagedSessions", label: "Sesiones comprometidas" },
      { key: "pageviews", label: "Vistas de pagina" },
      { key: "converted", label: "Conversiones" },
    ],
    rows: (data) => data.series ?? [],
  },
  acquisition: {
    headers: [
      { key: "source", label: "Fuente" },
      { key: "sessions", label: "Sesiones" },
      { key: "engagedSessions", label: "Comprometidas" },
      { key: "conversions", label: "Conversiones" },
      { key: "conversionRate", label: "Tasa de conversion" },
    ],
    rows: (data) => data.rows ?? [],
  },
  content: {
    headers: [
      { key: "path", label: "Ruta" },
      { key: "pageviews", label: "Vistas de pagina" },
      { key: "visitors", label: "Visitantes" },
    ],
    rows: (data) => data.rows ?? [],
  },
  conversions: {
    headers: [
      { key: "label", label: "Paso" },
      { key: "count", label: "Conteo" },
    ],
    rows: (data) => data.funnel ?? [],
  },
  retention: {
    headers: [
      { key: "cohortDate", label: "Cohorte" },
      { key: "cohortVisitors", label: "Visitantes" },
      { key: "d1Rate", label: "D1" },
      { key: "d7Rate", label: "D7" },
      { key: "d30Rate", label: "D30" },
    ],
    rows: (data) => data.rows ?? [],
  },
};

export function createAnalyticsCsv(report, data) {
  const definition = REPORTS[report];
  if (!definition) {
    throw new Error(`Reporte de analitica no soportado: ${report}`);
  }
  return `\uFEFF${csvRows(definition.headers, definition.rows(data))}`;
}
