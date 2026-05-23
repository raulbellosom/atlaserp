import { normalizeSpanishLabel } from "./renderer-adapters.js";

export const STATUS_LABELS = {
  active: "Activo",
  inactive: "Inactivo",
  maintenance: "En mantenimiento",
  retired: "Retirado",
  pending: "Pendiente",
  disabled: "Desactivado",
};

export const PRESET_COLORS = [
  { label: "Azul", value: "#2563eb" },
  { label: "Rojo", value: "#dc2626" },
  { label: "Verde", value: "#16a34a" },
  { label: "Amarillo", value: "#ca8a04" },
  { label: "Gris", value: "#6b7280" },
  { label: "Negro", value: "#111827" },
  { label: "Blanco", value: "#f9fafb" },
];

export const TEXT_TYPES = new Set(["text", "email", "phone", "textarea", "markdown"]);

export function joinUrl(baseUrl, apiPath) {
  const base = String(baseUrl ?? "").trim().replace(/\/+$/, "");
  const path = String(apiPath ?? "").trim();
  if (!path.startsWith("/")) return `${base}/${path}`;
  return `${base}${path}`;
}

export function resolveRelationLabel(row, descriptor) {
  const { labelField, labelSeparator, valueField } = descriptor;
  if (Array.isArray(labelField)) {
    const parts = labelField.map((f) => (row[f] != null ? String(row[f]) : "")).filter(Boolean);
    return parts.length > 0 ? parts.join(labelSeparator) : String(row[valueField] ?? "");
  }
  return row[labelField] != null ? String(row[labelField]) : String(row[valueField] ?? "");
}

function resolveOptionLabel(rawLabel) {
  return STATUS_LABELS[String(rawLabel).toLowerCase()] ?? normalizeSpanishLabel(String(rawLabel));
}

export function normalizeOptions(rawOptions) {
  if (!Array.isArray(rawOptions)) return [];
  return rawOptions
    .map((entry) => {
      if (entry && typeof entry === "object") {
        const value = entry.value ?? entry.key ?? entry.id ?? entry.code;
        if (value === undefined || value === null) return null;
        return { value: String(value), label: resolveOptionLabel(entry.label ?? entry.name ?? value) };
      }
      return { value: String(entry), label: resolveOptionLabel(entry) };
    })
    .filter(Boolean);
}

export function buildInitialValues(fieldMap, initialData) {
  const values = {};
  for (const field of fieldMap.values()) {
    const currentValue = initialData?.[field.name];
    if (currentValue === undefined || currentValue === null) {
      values[field.name] = field.type === "boolean" ? false : "";
    } else {
      values[field.name] = currentValue;
    }
  }
  return values;
}

export function castValueByType(value, type) {
  if (type === "boolean") return Boolean(value);
  if (value === "" || value === null || value === undefined) {
    return TEXT_TYPES.has(type) ? "" : null;
  }
  if (type === "number") {
    const parsed = Number.parseInt(String(value), 10);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (type === "decimal") {
    const parsed = Number.parseFloat(String(value));
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (type === "currency") {
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : null;
  }
  return value;
}

export function resolveRecordId(initialData) {
  return initialData?.id ?? initialData?.recordId ?? initialData?.uuid ?? initialData?.ID ?? null;
}

export function extractBlueprintRows(payload) {
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload)) return payload;
  return [];
}

export function extractFieldsFromBlueprint(blueprint) {
  if (Array.isArray(blueprint?.fields) && blueprint.fields.length > 0) return blueprint.fields;
  if (Array.isArray(blueprint?.schema?.fields) && blueprint.schema.fields.length > 0) {
    return blueprint.schema.fields;
  }
  return [];
}

export function extractCreatedRecord(result) {
  if (result && typeof result === "object" && result.data && typeof result.data === "object") {
    return result.data;
  }
  if (result && typeof result === "object") return result;
  return null;
}

function collectFieldDefinitionsFromSchema(schema) {
  const fields = [];
  const sections = Array.isArray(schema?.sections) ? schema.sections : [];
  for (const section of sections) {
    const sectionFields = Array.isArray(section?.fields) ? section.fields : [];
    for (const entry of sectionFields) {
      if (!entry || typeof entry !== "object") continue;
      const name = entry.name ?? entry.key ?? entry.field ?? null;
      if (!name) continue;
      fields.push({
        name: String(name),
        type: String(entry.type ?? "text").toLowerCase(),
      });
    }
  }
  return fields;
}

export function buildInlineCreatePrefill({ nestedBlueprint, searchText, descriptor }) {
  const trimmed = String(searchText ?? "").trim();
  if (!descriptor?.create?.prefillFromSearch || !trimmed) return {};

  const defs = collectFieldDefinitionsFromSchema(nestedBlueprint?.schema);
  if (defs.length === 0) return {};

  const preferredKeys = ["name", "title", "nombre", "titulo"];
  const preferred = defs.find(
    (field) => preferredKeys.includes(field.name.toLowerCase()) && field.type === "text",
  );
  if (preferred) return { [preferred.name]: trimmed };

  const firstCompatible = defs.find((field) => field.type === "text" || field.type === "textarea");
  if (!firstCompatible) return {};
  return { [firstCompatible.name]: trimmed };
}

export function toMoney(value, fallback = 0) {
  const parsed = Number.parseFloat(String(value ?? ""));
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Number(parsed.toFixed(2));
}

export function toInt(value, fallback = 0) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
}

export function normalizePartItem(item) {
  const quantity = Math.max(1, toInt(item?.quantity, 1));
  const unitCost = Math.max(0, toMoney(item?.unit_cost, 0));
  return {
    name: String(item?.name ?? "").trim(),
    quantity,
    unit_cost: unitCost,
    notes: String(item?.notes ?? "").trim(),
    subtotal: Number((quantity * unitCost).toFixed(2)),
  };
}

export function normalizeReportParts(parts) {
  if (!Array.isArray(parts)) return [];
  return parts.map(normalizePartItem);
}

export function computePartsCost(parts) {
  if (!Array.isArray(parts) || parts.length === 0) return 0;
  return Number(
    parts.reduce((acc, item) => acc + Number(item?.subtotal ?? 0), 0).toFixed(2),
  );
}
