import { Alert, AlertDescription, AlertTitle } from "../components/Alert.jsx";
import { Button } from "../components/Button.jsx";
import { DocumentsPanel } from "../components/DocumentsPanel.jsx";
import { normalizeSpanishLabel } from "./renderer-adapters.js";

const STATUS_LABELS = {
  active: "Activo",
  inactive: "Inactivo",
  maintenance: "En mantenimiento",
  retired: "Retirado",
  pending: "Pendiente",
  disabled: "Desactivado",
};

const STATUS_COLORS = {
  active: "bg-green-500/15 text-green-700 dark:text-green-400",
  inactive: "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]",
  maintenance: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
  retired: "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]",
  pending: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  disabled: "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]",
};

function normalizeField(fieldLike) {
  if (!fieldLike || typeof fieldLike !== "object") return null;
  const name = fieldLike.name ?? fieldLike.key ?? fieldLike.field ?? null;
  if (!name) return null;
  return {
    name: String(name),
    label: normalizeSpanishLabel(fieldLike.label ?? String(name)),
    type: fieldLike.type ?? "text",
  };
}

function normalizeSectionField(item) {
  if (typeof item === "string") {
    const key = String(item).trim();
    if (!key) return null;
    return { name: key, field: { name: key, label: key, type: "text" } };
  }
  const normalized = normalizeField(item);
  if (!normalized) return null;
  return { name: normalized.name, field: normalized };
}

function normalizeFieldMap(fields) {
  const map = new Map();
  for (const entry of Array.isArray(fields) ? fields : []) {
    const normalized = normalizeField(entry);
    if (!normalized) continue;
    map.set(normalized.name, normalized);
  }
  return map;
}

function normalizeSections(schema, fieldMap) {
  const rawSections = Array.isArray(schema?.sections) ? schema.sections : [];
  return rawSections
    .map((entry, sectionIndex) => {
      if (!entry || typeof entry !== "object") return null;
      const sectionType =
        typeof entry.type === "string" && entry.type.trim()
          ? entry.type.trim().toLowerCase()
          : "fields";

      if (sectionType === "documents") {
        return {
          id: entry.id ?? entry.key ?? `section-${sectionIndex}`,
          title: normalizeSpanishLabel(
            entry.title ?? entry.label ?? `Sección ${sectionIndex + 1}`,
          ),
          type: "documents",
          documents: entry.documents ?? null,
        };
      }

      const fieldDefs = (Array.isArray(entry.fields) ? entry.fields : [])
        .map((item) => normalizeSectionField(item))
        .filter(Boolean);

      const fieldNames = [];
      for (const fieldDef of fieldDefs) {
        const name = fieldDef.name;
        if (!fieldMap.has(name)) {
          fieldMap.set(name, fieldDef.field);
        } else {
          const existing = fieldMap.get(name);
          fieldMap.set(name, {
            ...existing,
            label: fieldDef.field.label ?? existing?.label ?? name,
            type: fieldDef.field.type ?? existing?.type ?? "text",
          });
        }
        if (!fieldNames.includes(name)) fieldNames.push(name);
      }

      const cols = Number(entry.columns);
      const columns = cols === 1 ? 1 : cols === 2 ? 2 : "auto";

      return {
        id: entry.id ?? entry.key ?? `section-${sectionIndex}`,
        title: normalizeSpanishLabel(
          entry.title ?? entry.label ?? `Sección ${sectionIndex + 1}`,
        ),
        type: "fields",
        columns,
        fields: fieldNames,
      };
    })
    .filter(Boolean);
}

function renderValue(field, value) {
  if (value === undefined || value === null || value === "") return "—";
  if (field?.type === "boolean") return value ? "Sí" : "No";

  if (field?.type === "color") {
    return (
      <span className="inline-flex items-center gap-2">
        <span
          className="inline-block h-4 w-4 rounded border border-[hsl(var(--border))]"
          style={{ backgroundColor: String(value) }}
        />
        <span>{String(value)}</span>
      </span>
    );
  }

  if (typeof value === "object") return JSON.stringify(value);
  const str = String(value);
  const lower = str.toLowerCase();
  const label = STATUS_LABELS[lower];
  if (label) {
    const chipClass =
      STATUS_COLORS[lower] ??
      "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]";
    return (
      <span
        className={`inline-block text-xs font-medium rounded-full px-2.5 py-0.5 ${chipClass}`}
      >
        {label}
      </span>
    );
  }
  return str;
}

function gridClass(columns) {
  if (columns === 1) return "grid gap-4";
  if (columns === 2) return "grid gap-4 md:grid-cols-2";
  return "grid gap-4 lg:grid-cols-2";
}

export function AtlasDetail({
  blueprint,
  fields,
  data,
  onEdit,
  onBack,
  token,
  apiBaseUrl,
}) {
  const schema = blueprint?.schema ?? {};
  const fieldMap = normalizeFieldMap(fields);
  const sections = normalizeSections(schema, fieldMap);

  if (!data || typeof data !== "object") {
    return (
      <Alert variant="warning">
        <AlertTitle>Sin información</AlertTitle>
        <AlertDescription>No hay datos para mostrar en el detalle.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {(onBack || onEdit) && (
        <div className="flex items-center justify-end gap-2">
          {onBack && (
            <Button type="button" variant="outline" onClick={() => onBack?.()}>
              Volver
            </Button>
          )}
          {onEdit && (
            <Button type="button" onClick={() => onEdit?.(data)}>
              Editar
            </Button>
          )}
        </div>
      )}

      {sections.length === 0 && (
        <Alert variant="warning">
          <AlertTitle>Detalle sin secciones</AlertTitle>
          <AlertDescription>
            Esta vista no tiene <code>schema.sections</code> configurado.
          </AlertDescription>
        </Alert>
      )}

      {sections.map((section) => (
        <div
          key={section.id}
          className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 space-y-4"
        >
          <h4 className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
            {section.title}
          </h4>

          {section.type === "documents" ? (
            <DocumentsPanel
              apiBaseUrl={apiBaseUrl}
              token={token}
              recordId={data?.id ?? null}
              config={section.documents ?? {}}
            />
          ) : (
            <dl className={gridClass(section.columns)}>
              {section.fields.map((fieldName) => {
                const field = fieldMap.get(fieldName);
                if (!field) return null;
                const value = data[field.name];
                return (
                  <div key={field.name} className="space-y-1">
                    <dt className="text-xs font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                      {field.label}
                    </dt>
                    <dd className="text-sm text-[hsl(var(--foreground))]">
                      {renderValue(field, value)}
                    </dd>
                  </div>
                );
              })}
            </dl>
          )}
        </div>
      ))}
    </div>
  );
}
