import { Alert, AlertDescription, AlertTitle } from "../components/Alert.jsx";
import { Button } from "../components/Button.jsx";

function normalizeField(fieldLike) {
  if (!fieldLike || typeof fieldLike !== "object") return null;
  const name = fieldLike.name ?? fieldLike.key ?? fieldLike.field ?? null;
  if (!name) return null;
  return {
    name: String(name),
    label: fieldLike.label ?? String(name),
    type: fieldLike.type ?? "text",
  };
}

function normalizeSectionField(item) {
  if (typeof item === "string") {
    const key = String(item).trim();
    if (!key) return null;
    return {
      name: key,
      field: {
        name: key,
        label: key,
        type: "text",
      },
    };
  }

  const normalized = normalizeField(item);
  if (!normalized) return null;
  return {
    name: normalized.name,
    field: normalized,
  };
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

      return {
        id: entry.id ?? entry.key ?? `section-${sectionIndex}`,
        title: entry.title ?? entry.label ?? `Sección ${sectionIndex + 1}`,
        columns: Number(entry.columns) === 2 ? 2 : 1,
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
  return String(value);
}

export function AtlasDetail({ blueprint, fields, data, onEdit, onBack }) {
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
    <div className="space-y-6">
      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => onBack?.()}>
          Volver
        </Button>
        {onEdit && (
          <Button type="button" onClick={() => onEdit?.(data)}>
            Editar
          </Button>
        )}
      </div>

      {sections.length === 0 && (
        <Alert variant="warning">
          <AlertTitle>Detalle sin secciones</AlertTitle>
          <AlertDescription>
            Esta vista no tiene <code>schema.sections</code> configurado.
          </AlertDescription>
        </Alert>
      )}

      {sections.map((section) => (
        <section key={section.id} className="space-y-4 rounded-xl border border-[hsl(var(--border))] p-4">
          <h4 className="text-sm font-semibold text-[hsl(var(--foreground))]">{section.title}</h4>
          <dl className={section.columns === 2 ? "grid gap-4 md:grid-cols-2" : "grid gap-4"}>
            {section.fields.map((fieldName) => {
              const field = fieldMap.get(fieldName);
              if (!field) return null;
              const value = data[field.name];
              return (
                <div key={field.name} className="space-y-1 rounded-lg bg-[hsl(var(--muted))]/30 p-3">
                  <dt className="text-xs font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                    {field.label}
                  </dt>
                  <dd className="text-sm text-[hsl(var(--foreground))]">{renderValue(field, value)}</dd>
                </div>
              );
            })}
          </dl>
        </section>
      ))}
    </div>
  );
}
