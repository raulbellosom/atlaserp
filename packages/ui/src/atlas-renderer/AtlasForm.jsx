import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "../components/Alert.jsx";
import { Button } from "../components/Button.jsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../components/Dialog.jsx";
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

function extractBlueprintRows(payload) {
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload)) return payload;
  return [];
}

function extractFieldsFromBlueprint(blueprint) {
  if (Array.isArray(blueprint?.fields) && blueprint.fields.length > 0) return blueprint.fields;
  if (Array.isArray(blueprint?.schema?.fields) && blueprint.schema.fields.length > 0) {
    return blueprint.schema.fields;
  }
  return [];
}

function extractCreatedRecord(result) {
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

function buildInlineCreatePrefill({ nestedBlueprint, searchText, descriptor }) {
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

export function AtlasForm({
  blueprint,
  fields,
  initialData,
  mode = "create",
  token,
  apiBaseUrl,
  onSuccess,
  onCancel,
  blueprints = null,
  resolveBlueprintByKey = null,
  allowInlineCreate = true,
  inlineCreateDepth = 0,
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
  const [relationInlineErrors, setRelationInlineErrors] = useState({});
  const [inlineCreateState, setInlineCreateState] = useState({
    open: false,
    fieldName: null,
    descriptor: null,
    blueprint: null,
    prefillData: {},
    searchText: "",
  });
  const [nestedBlueprintRows, setNestedBlueprintRows] = useState(null);
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
        return true;
      } catch {
        setRelationState((prev) => ({
          ...prev,
          [fieldName]: { options: prev[fieldName]?.options ?? [], loading: false, error: true },
        }));
        return false;
      }
    },
    [apiBaseUrl, token],
  );

  useEffect(() => {
    setFormValues(buildInitialValues(fieldMap, initialData));
    setFieldErrors({});
    setRelationInlineErrors({});
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
    setRelationInlineErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const handleRelationSearch = (fieldName, descriptor, search) => {
    if (descriptor.source !== "remote") return;
    clearTimeout(relationDebounceRef.current[fieldName]);
    relationDebounceRef.current[fieldName] = setTimeout(() => {
      loadRelationOptions(fieldName, descriptor, search);
    }, 300);
  };

  const closeInlineCreate = useCallback(() => {
    setInlineCreateState({
      open: false,
      fieldName: null,
      descriptor: null,
      blueprint: null,
      prefillData: {},
      searchText: "",
    });
  }, []);

  const resolveInlineCreateBlueprint = useCallback(
    async (viewKey) => {
      if (typeof resolveBlueprintByKey === "function") {
        const resolved = await resolveBlueprintByKey(viewKey);
        if (resolved) return resolved;
      }

      const localRows = Array.isArray(blueprints) ? blueprints : nestedBlueprintRows;
      if (Array.isArray(localRows) && localRows.length > 0) {
        const found = localRows.find((row) => String(row?.key ?? "").trim() === viewKey);
        if (found) return found;
      }

      const response = await fetch(joinUrl(apiBaseUrl, "/blueprints"), {
        method: "GET",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) throw new Error("No se pudieron cargar las vistas relacionadas.");
      const payload = await response.json();
      const rows = extractBlueprintRows(payload);
      setNestedBlueprintRows(rows);
      const moduleKey = String(blueprint?.moduleKey ?? "").trim();
      const found = rows.find((row) => {
        if (String(row?.key ?? "").trim() !== viewKey) return false;
        if (!moduleKey) return true;
        return String(row?.moduleKey ?? "").trim() === moduleKey;
      });
      return found ?? null;
    },
    [apiBaseUrl, blueprint?.moduleKey, blueprints, nestedBlueprintRows, resolveBlueprintByKey, token],
  );

  const openInlineCreate = useCallback(
    async (fieldName, descriptor, searchText) => {
      if (!allowInlineCreate || inlineCreateDepth > 0) return;
      if (!descriptor?.create?.enabled) return;

      const viewKey = String(descriptor.create.viewKey ?? "").trim();
      if (!viewKey) return;

      setRelationInlineErrors((prev) => ({ ...prev, [fieldName]: "" }));

      try {
        const nestedBlueprint = await resolveInlineCreateBlueprint(viewKey);
        if (!nestedBlueprint) {
          throw new Error("No se encontró la vista de creación relacionada.");
        }
        const nestedApiPath = descriptor.create.apiPath;
        const blueprintForCreate =
          nestedApiPath &&
          nestedBlueprint?.schema &&
          nestedBlueprint.schema.apiPath !== nestedApiPath
            ? {
                ...nestedBlueprint,
                schema: {
                  ...nestedBlueprint.schema,
                  apiPath: nestedApiPath,
                },
              }
            : nestedBlueprint;
        const prefillData = buildInlineCreatePrefill({
          nestedBlueprint: blueprintForCreate,
          searchText,
          descriptor,
        });
        setInlineCreateState({
          open: true,
          fieldName,
          descriptor,
          blueprint: blueprintForCreate,
          prefillData,
          searchText: String(searchText ?? ""),
        });
      } catch (err) {
        setRelationInlineErrors((prev) => ({
          ...prev,
          [fieldName]:
            err instanceof Error && err.message
              ? err.message
              : "No se pudo abrir el formulario relacionado.",
        }));
      }
    },
    [allowInlineCreate, inlineCreateDepth, resolveInlineCreateBlueprint],
  );

  const handleInlineCreateSuccess = useCallback(
    async (result) => {
      const fieldName = inlineCreateState.fieldName;
      const descriptor = inlineCreateState.descriptor;
      if (!fieldName || !descriptor) {
        closeInlineCreate();
        return;
      }

      const createdRecord = extractCreatedRecord(result);
      const createdIdRaw =
        createdRecord && descriptor.valueField in createdRecord
          ? createdRecord[descriptor.valueField]
          : null;
      const createdId =
        createdIdRaw === undefined || createdIdRaw === null || createdIdRaw === ""
          ? null
          : String(createdIdRaw);

      if (createdRecord && createdId) {
        const option = {
          value: createdId,
          label: resolveRelationLabel(createdRecord, descriptor),
          disabled: false,
        };
        setRelationState((prev) => {
          const current = prev[fieldName]?.options ?? [];
          const next = current.filter((item) => String(item.value) !== createdId);
          return {
            ...prev,
            [fieldName]: {
              ...prev[fieldName],
              options: [option, ...next],
              loading: false,
              error: null,
            },
          };
        });
      }

      if (descriptor.create?.selectCreated !== false && createdId) {
        handleChange(fieldName, createdId);
      }

      let refreshOk = true;
      if (descriptor.create?.refreshOptions !== false) {
        refreshOk = await loadRelationOptions(fieldName, descriptor, "");
      }

      if (!createdId) {
        setRelationInlineErrors((prev) => ({
          ...prev,
          [fieldName]: "Se creó el registro, pero no se pudo obtener su identificador.",
        }));
      } else if (!refreshOk) {
        setRelationInlineErrors((prev) => ({
          ...prev,
          [fieldName]: "Se creó el registro, pero no se pudieron actualizar las opciones.",
        }));
      } else {
        setRelationInlineErrors((prev) => ({ ...prev, [fieldName]: "" }));
      }

      closeInlineCreate();
    },
    [closeInlineCreate, inlineCreateState.descriptor, inlineCreateState.fieldName, loadRelationOptions],
  );

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
        const relationError = fieldErrors[field.name] || relationInlineErrors[field.name] || "";
        if (!descriptor) {
          return (
            <div className="space-y-1.5">
              <p className="text-sm font-medium text-[hsl(var(--foreground))]">
                {field.label}{field.required ? " *" : ""}
              </p>
              <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/40 px-3 py-2 text-xs text-[hsl(var(--muted-foreground))]">
                Relación no configurada
              </div>
              {relationError && (
                <p className="text-xs text-[hsl(var(--destructive))]">{relationError}</p>
              )}
            </div>
          );
        }
        const rs = relationState[field.name] ?? { options: [], loading: false, error: null };
        const staticOpts = descriptor.source === "static" ? descriptor.options : rs.options;
        const createActionLabel = descriptor.create?.label ?? normalizeSpanishLabel("Crear nuevo");
        const canInlineCreate =
          Boolean(descriptor.create?.enabled) && allowInlineCreate && inlineCreateDepth === 0;
        return (
          <RelationSelectField
            {...sharedProps}
            error={relationError}
            value={value ?? null}
            options={staticOpts}
            loading={descriptor.source === "remote" ? rs.loading : false}
            loadError={descriptor.source === "remote" ? rs.error : null}
            clearable={descriptor.clearable}
            onRetry={() => loadRelationOptions(field.name, descriptor, "")}
            onSearchChange={(search) => handleRelationSearch(field.name, descriptor, search)}
            onChange={(val) => handleChange(field.name, val)}
            createActionLabel={createActionLabel}
            createActionMode={descriptor.create?.allowedWhen ?? "always"}
            createFromSearch={descriptor.create?.prefillFromSearch === true}
            createDisabled={
              !canInlineCreate ||
              (inlineCreateState.open && inlineCreateState.fieldName === field.name)
            }
            onCreate={
              canInlineCreate
                ? (searchText) => openInlineCreate(field.name, descriptor, searchText)
                : undefined
            }
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

      <Dialog
        open={inlineCreateState.open}
        onOpenChange={(open) => {
          if (!open) closeInlineCreate();
        }}
      >
        <DialogContent className="md:max-w-3xl">
          {inlineCreateState.blueprint ? (
            <>
              <DialogHeader>
                <DialogTitle>
                  {normalizeSpanishLabel(
                    inlineCreateState.descriptor?.create?.title ??
                      inlineCreateState.descriptor?.create?.label ??
                      "Crear nuevo",
                  )}
                </DialogTitle>
                <DialogDescription>
                  Completa la información y guarda para continuar.
                </DialogDescription>
              </DialogHeader>
              <div className="max-h-[70dvh] overflow-y-auto pr-1">
                <AtlasForm
                  blueprint={inlineCreateState.blueprint}
                  fields={extractFieldsFromBlueprint(inlineCreateState.blueprint)}
                  initialData={inlineCreateState.prefillData}
                  mode="create"
                  token={token}
                  apiBaseUrl={apiBaseUrl}
                  onSuccess={handleInlineCreateSuccess}
                  onCancel={closeInlineCreate}
                  blueprints={Array.isArray(blueprints) ? blueprints : nestedBlueprintRows}
                  resolveBlueprintByKey={resolveBlueprintByKey}
                  allowInlineCreate={false}
                  inlineCreateDepth={inlineCreateDepth + 1}
                />
              </div>
            </>
          ) : (
            <Alert variant="warning">
              <AlertTitle>No se pudo cargar el formulario</AlertTitle>
              <AlertDescription>
                No se encontró la vista de creación relacionada.
              </AlertDescription>
            </Alert>
          )}
        </DialogContent>
      </Dialog>

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
