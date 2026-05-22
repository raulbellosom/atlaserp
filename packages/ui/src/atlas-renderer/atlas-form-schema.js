import { normalizeSpanishLabel } from "./renderer-adapters.js";

export function normalizeField(fieldLike) {
  if (!fieldLike || typeof fieldLike !== "object") return null;
  const name = fieldLike.name ?? fieldLike.key ?? fieldLike.field ?? null;
  if (!name) return null;
  return {
    name: String(name),
    label: normalizeSpanishLabel(fieldLike.label ?? String(name)),
    type: fieldLike.type ?? "text",
    required: Boolean(fieldLike.required),
    readonly: Boolean(fieldLike.readonly),
    options: fieldLike.options,
    relation: fieldLike.relation,
  };
}

function normalizeSectionField(item) {
  if (typeof item === "string") {
    const key = String(item).trim();
    if (!key) return null;
    return {
      name: key,
      field: { name: key, label: key, type: "text", required: false, readonly: false, options: [] },
    };
  }
  const normalized = normalizeField(item);
  if (!normalized) return null;
  return { name: normalized.name, field: { ...normalized, options: normalized.options ?? [] } };
}

function normalizeAttachmentsPlacement(value) {
  const placement = String(value ?? "embedded").trim().toLowerCase();
  return placement === "aside" ? "aside" : "embedded";
}

function toSectionMeta(entry) {
  return {
    description:
      typeof entry?.description === "string" && entry.description.trim().length > 0
        ? entry.description.trim()
        : null,
    collapsible: Boolean(entry?.collapsible),
    defaultCollapsed: Boolean(entry?.defaultCollapsed),
  };
}

function normalizeSectionType(entry) {
  if (typeof entry?.type === "string" && entry.type.trim()) {
    return entry.type.trim().toLowerCase();
  }
  return "fields";
}

export function normalizeSections(schema, fieldMap) {
  const rawSections = Array.isArray(schema?.sections) ? schema.sections : [];
  return rawSections
    .map((entry, sectionIndex) => {
      if (!entry || typeof entry !== "object") return null;
      const sectionType = normalizeSectionType(entry);

      if (sectionType === "attachments" || sectionType === "documents") {
        const attachmentsConfig =
          sectionType === "attachments"
            ? entry.attachments ?? {}
            : { ...(entry.documents ?? {}), placement: entry.placement ?? "embedded" };
        return {
          id: entry.id ?? entry.key ?? `section-${sectionIndex}`,
          title: normalizeSpanishLabel(entry.title ?? entry.label ?? "Documentos"),
          type: "attachments",
          placement: normalizeAttachmentsPlacement(
            entry.placement ?? attachmentsConfig?.placement,
          ),
          ...toSectionMeta(entry),
          attachments: attachmentsConfig,
        };
      }

      if (sectionType === "parts" || sectionType === "parts-editor") {
        return {
          id: entry.id ?? entry.key ?? `section-${sectionIndex}`,
          title: normalizeSpanishLabel(entry.title ?? entry.label ?? "Refacciones / Partes"),
          type: "parts",
          minItems: Number.isFinite(Number(entry.minItems))
            ? Math.max(0, Number(entry.minItems))
            : 0,
          ...toSectionMeta(entry),
        };
      }

      const sectionFields = (Array.isArray(entry.fields) ? entry.fields : [])
        .map((item) => normalizeSectionField(item))
        .filter(Boolean);

      const uniqueFields = [];
      for (const fieldDef of sectionFields) {
        const name = fieldDef.name;
        if (!fieldMap.has(name)) {
          fieldMap.set(name, fieldDef.field);
        } else {
          const existing = fieldMap.get(name);
          fieldMap.set(name, {
            ...existing,
            label: fieldDef.field.label ?? existing?.label ?? name,
            type: fieldDef.field.type ?? existing?.type ?? "text",
            required: fieldDef.field.required ?? existing?.required ?? false,
            readonly: fieldDef.field.readonly ?? existing?.readonly ?? false,
            options:
              Array.isArray(fieldDef.field.options) && fieldDef.field.options.length > 0
                ? fieldDef.field.options
                : existing?.options ?? [],
            relation: fieldDef.field.relation ?? existing?.relation ?? undefined,
          });
        }
        if (!uniqueFields.includes(name)) uniqueFields.push(name);
      }

      return {
        id: entry.id ?? entry.key ?? `section-${sectionIndex}`,
        title: normalizeSpanishLabel(entry.title ?? entry.label ?? `Seccion ${sectionIndex + 1}`),
        type: "fields",
        columns: entry.columns === 1 ? 1 : Number(entry.columns) === 2 ? 2 : "auto",
        icon:
          typeof entry.icon === "string" && entry.icon.trim() ? entry.icon.trim() : null,
        ...toSectionMeta(entry),
        fields: uniqueFields,
      };
    })
    .filter(Boolean);
}
