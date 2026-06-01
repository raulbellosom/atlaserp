import { useEffect, useMemo, useRef } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  TextField,
  TextareaField,
  SelectField,
  PhoneField,
  SwitchField,
  DateField,
  DateTimeField,
} from "./FormFields.jsx";
import { MarkdownField } from "./MarkdownField.jsx";
import { Button } from "./Button.jsx";

function getBlueprintFields(blueprint) {
  return blueprint?.schema?.fields ?? [];
}

function toSelectOptions(field, fieldOptions) {
  const options = fieldOptions?.[field.name];
  if (Array.isArray(options) && options.length > 0) return options;
  if (!Array.isArray(field?.options)) return [];
  return field.options.map((value) => ({ value, label: value }));
}

export function DynamicForm({
  blueprint,
  defaultValues = {},
  onSubmit,
  onCancel,
  isSubmitting = false,
  submitLabel = "Guardar",
  cancelLabel = "Cancelar",
  formId = "dynamic-form",
  fieldOptions = {},
  fieldOrder,
  hiddenFields = [],
  customFieldRenderers = {},
  renderActions = true,
  className = "space-y-4 py-2",
}) {
  const fields = useMemo(() => {
    const baseFields = getBlueprintFields(blueprint).filter(
      (field) => !hiddenFields.includes(field.name),
    );
    if (!Array.isArray(fieldOrder) || fieldOrder.length === 0) return baseFields;
    const byName = new Map(baseFields.map((field) => [field.name, field]));
    const ordered = fieldOrder
      .map((name) => byName.get(name))
      .filter(Boolean);
    const remaining = baseFields.filter((field) => !fieldOrder.includes(field.name));
    return [...ordered, ...remaining];
  }, [blueprint, fieldOrder, hiddenFields]);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({ defaultValues });

  const serializedDefaultsRef = useRef(
    (() => { try { return JSON.stringify(defaultValues); } catch { return ""; } })()
  );

  useEffect(() => {
    let next;
    try { next = JSON.stringify(defaultValues); } catch { next = ""; }
    if (next === serializedDefaultsRef.current) return;
    serializedDefaultsRef.current = next;
    reset(defaultValues);
  }, [defaultValues, reset]);

  function rulesForField(field) {
    const rules = {};
    if (field.required) {
      rules.required = `${field.label ?? field.name} es obligatorio`;
    }
    if (field.type === "email") {
      rules.pattern = {
        value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        message: "Correo inválido",
      };
    }
    return rules;
  }

  function renderField(field) {
    const customRenderer = customFieldRenderers[field.name];
    if (typeof customRenderer === "function") {
      return (
        <Controller
          key={field.name}
          name={field.name}
          control={control}
          rules={rulesForField(field)}
          render={({ field: rhfField, fieldState }) =>
            customRenderer({
              field,
              value: rhfField.value,
              onChange: rhfField.onChange,
              onBlur: rhfField.onBlur,
              error: fieldState.error?.message,
            })
          }
        />
      );
    }

    return (
      <Controller
        key={field.name}
        name={field.name}
        control={control}
        rules={rulesForField(field)}
        render={({ field: rhfField, fieldState }) => {
          const shared = {
            label: field.label ?? field.name,
            required: Boolean(field.required),
            error: fieldState.error?.message ?? errors?.[field.name]?.message,
          };

          if (field.type === "select") {
            return (
              <SelectField
                {...shared}
                value={rhfField.value ?? ""}
                options={toSelectOptions(field, fieldOptions)}
                onValueChange={rhfField.onChange}
              />
            );
          }

          if (field.type === "phone") {
            return (
              <PhoneField
                {...shared}
                value={rhfField.value ?? ""}
                onChange={rhfField.onChange}
                onBlur={rhfField.onBlur}
              />
            );
          }

          if (field.type === "textarea") {
            return (
              <TextareaField
                {...shared}
                value={rhfField.value ?? ""}
                onChange={rhfField.onChange}
                onBlur={rhfField.onBlur}
              />
            );
          }

          if (field.type === "markdown") {
            return (
              <MarkdownField
                {...shared}
                value={rhfField.value ?? ""}
                onChange={rhfField.onChange}
                onBlur={rhfField.onBlur}
                maxLength={field.maxLength}
              />
            );
          }

          if (field.type === "boolean") {
            return (
              <SwitchField
                {...shared}
                checked={Boolean(rhfField.value)}
                onChange={rhfField.onChange}
              />
            );
          }

          if (field.type === "date") {
            return (
              <DateField
                {...shared}
                value={rhfField.value ?? ""}
                onChange={rhfField.onChange}
                onBlur={rhfField.onBlur}
              />
            );
          }

          if (field.type === "datetime") {
            return (
              <DateTimeField
                {...shared}
                value={rhfField.value ?? ""}
                onChange={rhfField.onChange}
                onBlur={rhfField.onBlur}
              />
            );
          }

          const inputType =
            field.type === "email"
              ? "email"
              : field.type === "number" || field.type === "decimal"
                ? "number"
                : "text";

          return (
            <TextField
              {...shared}
              type={inputType}
              value={rhfField.value ?? ""}
              onChange={rhfField.onChange}
              onBlur={rhfField.onBlur}
            />
          );
        }}
      />
    );
  }

  return (
    <form
      id={formId}
      onSubmit={handleSubmit((values) => onSubmit?.(values))}
      className={className}
    >
      {fields.map((field) => renderField(field))}

      {renderActions && (
        <div className="flex justify-end gap-2 pt-4 border-t border-[hsl(var(--border))]">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
              {cancelLabel}
            </Button>
          )}
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Guardando..." : submitLabel}
          </Button>
        </div>
      )}
    </form>
  );
}
