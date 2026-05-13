import { useEffect, useMemo, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "../components/Alert.jsx";
import { Button } from "../components/Button.jsx";
import { Checkbox } from "../components/Checkbox.jsx";
import { Input } from "../components/Input.jsx";
import { Textarea } from "../components/Textarea.jsx";

function joinUrl(baseUrl, apiPath) {
  const base = String(baseUrl ?? "").trim().replace(/\/+$/, "");
  const path = String(apiPath ?? "").trim();
  if (!path.startsWith("/")) return `${base}/${path}`;
  return `${base}${path}`;
}

function normalizeField(fieldLike) {
  if (!fieldLike || typeof fieldLike !== "object") return null;
  const name = fieldLike.name ?? fieldLike.key ?? fieldLike.field ?? null;
  if (!name) return null;
  return {
    name: String(name),
    label: fieldLike.label ?? String(name),
    type: fieldLike.type ?? "text",
    required: Boolean(fieldLike.required),
    readonly: Boolean(fieldLike.readonly),
    options: fieldLike.options,
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
        required: false,
        readonly: false,
        options: [],
      },
    };
  }

  const normalized = normalizeField(item);
  if (!normalized) return null;
  return {
    name: normalized.name,
    field: {
      ...normalized,
      options: normalized.options ?? [],
    },
  };
}

function normalizeSections(schema, fieldMap) {
  const rawSections = Array.isArray(schema?.sections) ? schema.sections : [];
  return rawSections
    .map((entry, sectionIndex) => {
      if (!entry || typeof entry !== "object") return null;
      const sectionFieldsRaw = Array.isArray(entry.fields) ? entry.fields : [];
      const sectionFields = sectionFieldsRaw
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
          });
        }
        if (!uniqueFields.includes(name)) uniqueFields.push(name);
      }

      return {
        id: entry.id ?? entry.key ?? `section-${sectionIndex}`,
        title: entry.title ?? entry.label ?? `Sección ${sectionIndex + 1}`,
        columns: Number(entry.columns) === 2 ? 2 : 1,
        fields: uniqueFields,
      };
    })
    .filter(Boolean);
}

function normalizeOptions(rawOptions) {
  if (!Array.isArray(rawOptions)) return [];
  return rawOptions
    .map((entry) => {
      if (entry && typeof entry === "object") {
        const value = entry.value ?? entry.key ?? entry.id ?? entry.code;
        if (value === undefined || value === null) return null;
        return {
          value: String(value),
          label: String(entry.label ?? entry.name ?? value),
        };
      }
      return {
        value: String(entry),
        label: String(entry),
      };
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

  if (value === "" || value === null || value === undefined) return null;

  if (type === "number") {
    const parsed = Number.parseInt(String(value), 10);
    return Number.isFinite(parsed) ? parsed : value;
  }

  if (type === "decimal") {
    const parsed = Number.parseFloat(String(value));
    return Number.isFinite(parsed) ? parsed : value;
  }

  return value;
}

function resolveSubmitLabel(schema) {
  const label = String(schema?.submitLabel ?? "").trim();
  if (label) return label;
  return "Guardar";
}

function resolveRecordId(initialData) {
  return (
    initialData?.id ??
    initialData?.recordId ??
    initialData?.uuid ??
    initialData?.ID ??
    null
  );
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

  const fieldMap = useMemo(() => {
    const map = new Map();
    const declaredFields = Array.isArray(fields) ? fields : [];
    for (const entry of declaredFields) {
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
  const submitLabel = resolveSubmitLabel(schema);

  useEffect(() => {
    setFormValues(buildInitialValues(fieldMap, initialData));
    setFieldErrors({});
    setSubmitError("");
  }, [fieldMap, initialData]);

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
    setFormValues((prev) => ({
      ...prev,
      [name]: value,
    }));
    setFieldErrors((prev) => ({
      ...prev,
      [name]: "",
    }));
  };

  const validate = () => {
    const nextErrors = {};
    for (const section of sections) {
      for (const fieldName of section.fields) {
        const field = fieldMap.get(fieldName);
        if (!field || !field.required || field.readonly) continue;
        const value = formValues[fieldName];
        if (field.type === "boolean") continue;
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
      if (casted === null) {
        if (field.type === "select") continue;
        payload[name] = null;
        continue;
      }
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
    const commonProps = {
      id: field.name,
      name: field.name,
      disabled: submitting || field.readonly,
    };

    if (field.readonly) {
      return (
        <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/40 px-3 py-2 text-sm">
          {value === undefined || value === null || value === "" ? "—" : String(value)}
        </div>
      );
    }

    switch (field.type) {
      case "textarea":
      case "markdown":
        return (
          <Textarea
            {...commonProps}
            value={value ?? ""}
            onChange={(event) => handleChange(field.name, event.target.value)}
            rows={4}
            placeholder={field.label}
          />
        );

      case "select": {
        const options = normalizeOptions(field.options);
        return (
          <select
            {...commonProps}
            value={value ?? ""}
            onChange={(event) => handleChange(field.name, event.target.value)}
            className="h-10 w-full rounded-lg border border-[hsl(var(--border))] bg-transparent px-3 text-sm"
          >
            <option value="">Seleccionar...</option>
            {options.map((option) => (
              <option key={`${field.name}-${option.value}`} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );
      }

      case "boolean":
        return (
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={Boolean(value)}
              onCheckedChange={(checked) => handleChange(field.name, Boolean(checked))}
              disabled={submitting}
            />
            <span>{Boolean(value) ? "Sí" : "No"}</span>
          </label>
        );

      case "number":
        return (
          <Input
            {...commonProps}
            type="number"
            value={value ?? ""}
            onChange={(event) => handleChange(field.name, event.target.value)}
            placeholder={field.label}
          />
        );

      case "decimal":
        return (
          <Input
            {...commonProps}
            type="number"
            step="0.0001"
            value={value ?? ""}
            onChange={(event) => handleChange(field.name, event.target.value)}
            placeholder={field.label}
          />
        );

      case "date":
        return (
          <Input
            {...commonProps}
            type="date"
            value={value ?? ""}
            onChange={(event) => handleChange(field.name, event.target.value)}
          />
        );

      case "datetime":
        return (
          <Input
            {...commonProps}
            type="datetime-local"
            value={value ?? ""}
            onChange={(event) => handleChange(field.name, event.target.value)}
          />
        );

      case "email":
        return (
          <Input
            {...commonProps}
            type="email"
            value={value ?? ""}
            onChange={(event) => handleChange(field.name, event.target.value)}
            placeholder={field.label}
          />
        );

      case "phone":
        return (
          <Input
            {...commonProps}
            type="tel"
            value={value ?? ""}
            onChange={(event) => handleChange(field.name, event.target.value)}
            placeholder={field.label}
          />
        );

      case "color":
        return (
          <Input
            {...commonProps}
            type="color"
            value={value || "#000000"}
            onChange={(event) => handleChange(field.name, event.target.value)}
          />
        );

      case "relation":
        return (
          <Input
            {...commonProps}
            type="text"
            value={value ?? ""}
            onChange={(event) => handleChange(field.name, event.target.value)}
            placeholder="ID relacionado"
          />
        );

      default:
        return (
          <Input
            {...commonProps}
            type="text"
            value={value ?? ""}
            onChange={(event) => handleChange(field.name, event.target.value)}
            placeholder={field.label}
          />
        );
    }
  };

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      {sections.length === 0 && (
        <Alert variant="warning">
          <AlertTitle>Formulario sin secciones</AlertTitle>
          <AlertDescription>
            Esta vista no tiene <code>schema.sections</code> configurado.
          </AlertDescription>
        </Alert>
      )}

      {sections.map((section) => (
        <section key={section.id} className="space-y-4 rounded-xl border border-[hsl(var(--border))] p-4">
          <h4 className="text-sm font-semibold text-[hsl(var(--foreground))]">{section.title}</h4>
          <div className={section.columns === 2 ? "grid gap-4 md:grid-cols-2" : "grid gap-4"}>
            {section.fields.map((fieldName) => {
              const field = fieldMap.get(fieldName);
              if (!field) return null;
              return (
                <div key={field.name} className="space-y-1.5">
                  <label htmlFor={field.name} className="text-sm font-medium">
                    {field.label}
                    {field.required && <span className="ml-1 text-red-500">*</span>}
                  </label>
                  {renderFieldControl(field)}
                  {fieldErrors[field.name] && (
                    <p className="text-xs text-red-600">{fieldErrors[field.name]}</p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {submitError && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{submitError || "No se pudo guardar la información."}</AlertDescription>
        </Alert>
      )}

      <div className="sticky bottom-0 z-10 -mx-1 border-t border-[hsl(var(--border))] bg-[hsl(var(--background))]/95 px-1 pb-1 pt-3 backdrop-blur supports-[backdrop-filter]:bg-[hsl(var(--background))]/80">
        <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => onCancel?.()} disabled={submitting}>
          Cancelar
        </Button>
        <Button type="submit" loading={submitting}>
          {submitLabel}
        </Button>
        </div>
      </div>
    </form>
  );
}
