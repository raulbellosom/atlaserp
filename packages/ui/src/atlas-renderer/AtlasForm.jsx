import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "../components/Alert.jsx";
import { Button } from "../components/Button.jsx";
import {
  TextField,
  TextareaField,
  MarkdownField,
  SelectField,
  PhoneField,
  SwitchField,
  RelationSelectField,
} from "../components/FormFields.jsx";
import { normalizeSpanishLabel, normalizeRelationDescriptor } from "./renderer-adapters.js";

const STATUS_LABELS = {
  active: "Activo",
  inactive: "Inactivo",
  maintenance: "En mantenimiento",
  retired: "Retirado",
  pending: "Pendiente",
  disabled: "Desactivado",
};

const PRESET_COLORS = [
  { label: "Azul", value: "#2563eb" },
  { label: "Rojo", value: "#dc2626" },
  { label: "Verde", value: "#16a34a" },
  { label: "Amarillo", value: "#ca8a04" },
  { label: "Gris", value: "#6b7280" },
  { label: "Negro", value: "#111827" },
  { label: "Blanco", value: "#f9fafb" },
];

const TEXT_TYPES = new Set(["text", "email", "phone", "textarea", "markdown"]);

function joinUrl(baseUrl, apiPath) {
  const base = String(baseUrl ?? "").trim().replace(/\/+$/, "");
  const path = String(apiPath ?? "").trim();
  if (!path.startsWith("/")) return `${base}/${path}`;
  return `${base}${path}`;
}

function resolveRelationLabel(row, descriptor) {
  const { labelField, labelSeparator, valueField } = descriptor;
  if (Array.isArray(labelField)) {
    const parts = labelField.map((f) => (row[f] != null ? String(row[f]) : "")).filter(Boolean);
    return parts.length > 0 ? parts.join(labelSeparator) : String(row[valueField] ?? "");
  }
  return row[labelField] != null ? String(row[labelField]) : String(row[valueField] ?? "");
}

function normalizeField(fieldLike) {
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

function normalizeSections(schema, fieldMap) {
  const rawSections = Array.isArray(schema?.sections) ? schema.sections : [];
  return rawSections
    .map((entry, sectionIndex) => {
      if (!entry || typeof entry !== "object") return null;
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
        title: normalizeSpanishLabel(entry.title ?? entry.label ?? `Sección ${sectionIndex + 1}`),
        columns: entry.columns === 1 ? 1 : (Number(entry.columns) === 2 ? 2 : "auto"),
        fields: uniqueFields,
      };
    })
    .filter(Boolean);
}

function resolveOptionLabel(rawLabel) {
  return STATUS_LABELS[String(rawLabel).toLowerCase()] ?? normalizeSpanishLabel(String(rawLabel));
}

function normalizeOptions(rawOptions) {
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

function buildInitialValues(fieldMap, initialData) {
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

function castValueByType(value, type) {
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
  return value;
}

function resolveRecordId(initialData) {
  return initialData?.id ?? initialData?.recordId ?? initialData?.uuid ?? initialData?.ID ?? null;
}

export function AtlasForm({
  blueprint,
  fields,
  initialData,
  mode = "create",
  token,
  apiBaseUrl,
  onSuccess,
  onCancel,
}) {
  const schema = blueprint?.schema ?? {};
  const apiPath = typeof schema.apiPath === "string" ? schema.apiPath.trim() : "";
  const submitLabel = normalizeSpanishLabel(String(schema?.submitLabel ?? "").trim() || "Guardar");

  const fieldMap = useMemo(() => {
    const map = new Map();
    for (const entry of Array.isArray(fields) ? fields : []) {
      const normalized = normalizeField(entry);
      if (!normalized) continue;
      map.set(normalized.name, normalized);
    }
    return map;
  }, [fields]);

  const sections = useMemo(() => normalizeSections(schema, fieldMap), [fieldMap, schema]);

  const [formValues, setFormValues] = useState(() => buildInitialValues(fieldMap, initialData));
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [relationState, setRelationState] = useState({});
  const relationDebounceRef = useRef({});

  const loadRelationOptions = useCallback(
    async (fieldName, descriptor, search) => {
      setRelationState((prev) => ({
        ...prev,
        [fieldName]: { options: prev[fieldName]?.options ?? [], loading: true, error: null },
      }));
      try {
        const url = new URL(joinUrl(apiBaseUrl, descriptor.apiPath));
        url.searchParams.set(descriptor.pageParam, "1");
        url.searchParams.set(descriptor.pageSizeParam, String(descriptor.pageSize));
        if (search) url.searchParams.set(descriptor.searchParam, search);
        const res = await fetch(url.toString(), {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const rows = Array.isArray(json.data) ? json.data : Array.isArray(json) ? json : [];
        const options = rows
          .map((row) => ({
            value: String(row[descriptor.valueField] ?? ""),
            label: resolveRelationLabel(row, descriptor),
            disabled: descriptor.disabledField ? row[descriptor.disabledField] === false : false,
          }))
          .filter((o) => o.value);
        setRelationState((prev) => ({
          ...prev,
          [fieldName]: { options, loading: false, error: null },
        }));
      } catch {
        setRelationState((prev) => ({
          ...prev,
          [fieldName]: { options: prev[fieldName]?.options ?? [], loading: false, error: true },
        }));
      }
    },
    [apiBaseUrl, token],
  );

  useEffect(() => {
    setFormValues(buildInitialValues(fieldMap, initialData));
    setFieldErrors({});
    setSubmitError("");
  }, [fieldMap, initialData]);

  useEffect(() => {
    for (const [, field] of fieldMap.entries()) {
      if (field.type !== "relation") continue;
      const descriptor = normalizeRelationDescriptor(field);
      if (descriptor?.source === "remote" && descriptor.preload) {
        loadRelationOptions(field.name, descriptor, "");
      }
    }
  }, [fieldMap, loadRelationOptions]);

  if (!apiPath) {
    return (
      <Alert variant="warning">
        <AlertTitle>Vista sin configuración</AlertTitle>
        <AlertDescription>
          Esta vista no tiene <code>schema.apiPath</code>. No se puede guardar la información.
        </AlertDescription>
      </Alert>
    );
  }

  const recordId = resolveRecordId(initialData);
  const isEditMode = mode === "edit";

  const handleChange = (name, value) => {
    setFormValues((prev) => ({ ...prev, [name]: value }));
    setFieldErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const handleRelationSearch = (fieldName, descriptor, search) => {
    if (descriptor.source !== "remote") return;
    clearTimeout(relationDebounceRef.current[fieldName]);
    relationDebounceRef.current[fieldName] = setTimeout(() => {
      loadRelationOptions(fieldName, descriptor, search);
    }, 300);
  };

  const validate = () => {
    const nextErrors = {};
    for (const section of sections) {
      for (const fieldName of section.fields) {
        const field = fieldMap.get(fieldName);
        if (!field || !field.required || field.readonly) continue;
        if (field.type === "boolean") continue;
        const value = formValues[fieldName];
        if (value === undefined || value === null || String(value).trim() === "") {
          nextErrors[fieldName] = "Campo requerido";
        }
      }
    }
    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitError("");
    if (!validate()) return;
    if (isEditMode && !recordId) {
      setSubmitError("No se pudo guardar la información.");
      return;
    }
    const payload = {};
    for (const [name, field] of fieldMap.entries()) {
      if (field.readonly) continue;
      const casted = castValueByType(formValues[name], field.type);
      if (field.type === "boolean") {
        payload[name] = Boolean(casted);
        continue;
      }
      if (field.type === "relation") {
        payload[name] = casted === "" ? null : casted;
        continue;
      }
      if (casted === null || casted === "") continue;
      payload[name] = casted;
    }
    setSubmitting(true);
    try {
      const endpoint = isEditMode
        ? `${joinUrl(apiBaseUrl, apiPath)}/${encodeURIComponent(String(recordId))}`
        : joinUrl(apiBaseUrl, apiPath);
      const response = await fetch(endpoint, {
        method: isEditMode ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const text = await response.text();
        let message = "No se pudo guardar la información.";
        try {
          const parsed = text ? JSON.parse(text) : null;
          if (parsed?.error) message = parsed.error;
        } catch {
          if (text) message = text;
        }
        throw new Error(message);
      }
      const result = await response.json();
      onSuccess?.(result);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "No se pudo guardar la información.");
    } finally {
      setSubmitting(false);
    }
  };

  const renderFieldControl = (field) => {
    const value = formValues[field.name];
    const sharedProps = {
      label: field.label,
      required: field.required,
      error: fieldErrors[field.name],
    };

    if (field.readonly) {
      return (
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-[hsl(var(--foreground))]">{field.label}</p>
          <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/40 px-3 py-2 text-sm">
            {value === undefined || value === null || value === "" ? "—" : String(value)}
          </div>
        </div>
      );
    }

    switch (field.type) {
      case "textarea":
        return (
          <TextareaField
            {...sharedProps}
            value={value ?? ""}
            onChange={(e) => handleChange(field.name, e.target.value)}
          />
        );

      case "markdown":
        return (
          <MarkdownField
            {...sharedProps}
            value={value ?? ""}
            onChange={(val) => handleChange(field.name, val)}
          />
        );

      case "select": {
        const options = normalizeOptions(field.options);
        return (
          <SelectField
            {...sharedProps}
            value={value ?? ""}
            options={options}
            onValueChange={(val) => handleChange(field.name, val)}
          />
        );
      }

      case "boolean":
        return (
          <SwitchField
            {...sharedProps}
            checked={Boolean(value)}
            onChange={(checked) => handleChange(field.name, Boolean(checked))}
          />
        );

      case "phone":
        return (
          <PhoneField
            {...sharedProps}
            value={value ?? ""}
            onChange={(e) => handleChange(field.name, e.target.value)}
          />
        );

      case "number":
        return (
          <TextField
            {...sharedProps}
            type="number"
            value={value ?? ""}
            onChange={(e) => handleChange(field.name, e.target.value)}
          />
        );

      case "decimal":
        return (
          <TextField
            {...sharedProps}
            type="number"
            step="0.0001"
            value={value ?? ""}
            onChange={(e) => handleChange(field.name, e.target.value)}
          />
        );

      case "date":
        return (
          <TextField
            {...sharedProps}
            type="date"
            value={value ?? ""}
            onChange={(e) => handleChange(field.name, e.target.value)}
          />
        );

      case "datetime":
        return (
          <TextField
            {...sharedProps}
            type="datetime-local"
            value={value ?? ""}
            onChange={(e) => handleChange(field.name, e.target.value)}
          />
        );

      case "email":
        return (
          <TextField
            {...sharedProps}
            type="email"
            value={value ?? ""}
            onChange={(e) => handleChange(field.name, e.target.value)}
          />
        );

      case "color": {
        const current = (value && String(value).startsWith("#")) ? String(value) : "#111827";
        return (
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-[hsl(var(--foreground))]">
              {field.label}{field.required ? " *" : ""}
            </p>
            <div className="flex flex-wrap gap-2 items-center">
              {PRESET_COLORS.map((preset) => {
                const isActive = current.toLowerCase() === preset.value.toLowerCase();
                return (
                  <button
                    key={preset.value}
                    type="button"
                    title={preset.label}
                    onClick={() => handleChange(field.name, preset.value)}
                    style={{ backgroundColor: preset.value }}
                    className={[
                      "h-8 w-8 rounded-full border-2 transition-all",
                      isActive
                        ? "border-[hsl(var(--primary))] ring-2 ring-[hsl(var(--primary))]/30 scale-110"
                        : "border-[hsl(var(--border))] hover:scale-105",
                    ].join(" ")}
                    aria-label={preset.label}
                  />
                );
              })}
              <label className="relative cursor-pointer" title="Personalizado">
                <div
                  style={{ backgroundColor: current }}
                  className="h-8 w-8 rounded-full border-2 border-dashed border-[hsl(var(--border))] flex items-center justify-center overflow-hidden"
                >
                  <span
                    className="text-[8px] font-bold select-none"
                    style={{ color: current === "#f9fafb" ? "#333" : "#fff" }}
                  >
                    P
                  </span>
                </div>
                <input
                  type="color"
                  value={current}
                  onChange={(e) => handleChange(field.name, e.target.value)}
                  className="sr-only"
                />
              </label>
            </div>
            {fieldErrors[field.name] && (
              <p className="text-xs text-[hsl(var(--destructive))]">{fieldErrors[field.name]}</p>
            )}
          </div>
        );
      }

      case "relation": {
        const descriptor = normalizeRelationDescriptor(field);
        if (!descriptor) {
          return (
            <div className="space-y-1.5">
              <p className="text-sm font-medium text-[hsl(var(--foreground))]">
                {field.label}{field.required ? " *" : ""}
              </p>
              <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/40 px-3 py-2 text-xs text-[hsl(var(--muted-foreground))]">
                Relación no configurada
              </div>
              {fieldErrors[field.name] && (
                <p className="text-xs text-[hsl(var(--destructive))]">{fieldErrors[field.name]}</p>
              )}
            </div>
          );
        }
        const rs = relationState[field.name] ?? { options: [], loading: false, error: null };
        const staticOpts = descriptor.source === "static" ? descriptor.options : rs.options;
        return (
          <RelationSelectField
            {...sharedProps}
            value={value ?? null}
            options={staticOpts}
            loading={descriptor.source === "remote" ? rs.loading : false}
            loadError={descriptor.source === "remote" ? rs.error : null}
            clearable={descriptor.clearable}
            onRetry={() => loadRelationOptions(field.name, descriptor, "")}
            onSearchChange={(search) => handleRelationSearch(field.name, descriptor, search)}
            onChange={(val) => handleChange(field.name, val)}
          />
        );
      }

      default:
        return (
          <TextField
            {...sharedProps}
            type="text"
            value={value ?? ""}
            onChange={(e) => handleChange(field.name, e.target.value)}
          />
        );
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      {sections.length === 0 && (
        <Alert variant="warning">
          <AlertTitle>Formulario sin secciones</AlertTitle>
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
          <div
            className={
              section.columns === 1
                ? "grid gap-4"
                : section.columns === 2
                ? "grid gap-4 md:grid-cols-2"
                : "grid gap-4 lg:grid-cols-2"
            }
          >
            {section.fields.map((fieldName) => {
              const field = fieldMap.get(fieldName);
              if (!field) return null;
              const isFullWidth = ["textarea", "markdown"].includes(field.type);
              return (
                <div key={field.name} className={isFullWidth ? "col-span-full" : ""}>
                  {renderFieldControl(field)}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {submitError && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{submitError}</AlertDescription>
        </Alert>
      )}

      <div className="sticky bottom-0 z-10 -mx-1 flex items-center justify-end gap-2 border-t border-[hsl(var(--border))] bg-[hsl(var(--background))]/95 px-1 pb-1 pt-3 backdrop-blur supports-backdrop-filter:bg-[hsl(var(--background))]/80">
        <Button type="button" variant="outline" onClick={() => onCancel?.()} disabled={submitting}>
          Cancelar
        </Button>
        <Button type="submit" loading={submitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
