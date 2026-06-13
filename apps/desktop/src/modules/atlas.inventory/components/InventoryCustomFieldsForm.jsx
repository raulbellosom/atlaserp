import { Controller } from 'react-hook-form'
import {
  TextField,
  NumberField,
  DateField,
  SelectField,
  CheckboxField,
  MarkdownField,
} from '@atlas/ui'

/**
 * Renders a set of dynamic custom fields inside a parent React Hook Form context.
 *
 * @param {object[]} customFields - Array of InvCustomField objects: { id, label, fieldKey, fieldType, options, required }
 * @param {object}   control      - React Hook Form control from the parent useForm()
 * @param {string}   fieldPrefix  - Dot-path prefix for field names, e.g. "customValues"
 */

function FieldRenderer({ definition, formField, error }) {
  const { label, fieldType, options = [], required } = definition
  const commonProps = {
    label,
    error,
    required: !!required,
  }

  switch (fieldType) {
    case 'number':
      return (
        <NumberField
          {...commonProps}
          value={formField.value ?? ''}
          onChange={formField.onChange}
          onBlur={formField.onBlur}
          name={formField.name}
        />
      )

    case 'date':
      return (
        <DateField
          {...commonProps}
          value={formField.value ?? ''}
          onChange={formField.onChange}
          onBlur={formField.onBlur}
          name={formField.name}
        />
      )

    case 'textarea':
      return (
        <MarkdownField
          {...commonProps}
          value={formField.value ?? ''}
          onChange={formField.onChange}
          onBlur={formField.onBlur}
        />
      )

    case 'select': {
      const selectOptions = options.map((opt) =>
        typeof opt === 'string' ? { label: opt, value: opt } : opt
      )
      return (
        <SelectField
          {...commonProps}
          options={selectOptions}
          value={formField.value ?? ''}
          onChange={formField.onChange}
          onBlur={formField.onBlur}
          name={formField.name}
        />
      )
    }

    case 'boolean':
      return (
        <CheckboxField
          {...commonProps}
          checked={formField.value === true || formField.value === 'true'}
          onChange={(e) => formField.onChange(e.target.checked)}
          onBlur={formField.onBlur}
          name={formField.name}
        />
      )

    case 'url':
      return (
        <TextField
          {...commonProps}
          type="url"
          placeholder="https://"
          value={formField.value ?? ''}
          onChange={formField.onChange}
          onBlur={formField.onBlur}
          name={formField.name}
        />
      )

    case 'email':
      return (
        <TextField
          {...commonProps}
          type="email"
          placeholder="correo@ejemplo.com"
          value={formField.value ?? ''}
          onChange={formField.onChange}
          onBlur={formField.onBlur}
          name={formField.name}
        />
      )

    case 'text':
    default:
      return (
        <TextField
          {...commonProps}
          type="text"
          value={formField.value ?? ''}
          onChange={formField.onChange}
          onBlur={formField.onBlur}
          name={formField.name}
        />
      )
  }
}

export function InventoryCustomFieldsForm({
  customFields,
  control,
  fieldPrefix = 'customValues',
}) {
  if (!customFields?.length) return null

  return (
    <div className="space-y-4">
      {customFields.map((field) => (
        <Controller
          key={field.id}
          name={`${fieldPrefix}.${field.fieldKey}`}
          control={control}
          rules={{
            required: field.required ? `${field.label} es requerido` : false,
          }}
          render={({ field: formField, fieldState }) => (
            <FieldRenderer
              definition={field}
              formField={formField}
              error={fieldState.error?.message}
            />
          )}
        />
      ))}
    </div>
  )
}
