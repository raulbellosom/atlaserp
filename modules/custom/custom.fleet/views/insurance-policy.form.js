import { defineView } from '@atlas/module-engine'

export default defineView({
  key: 'fleet.insurance_policy.form',
  kind: 'FORM',
  version: '0.1.0',
  schema: {
    entity: 'insurance_policy',
    component: 'AtlasForm',
    apiPath: '/fleet/insurance',
    sections: [
      {
        label: 'Datos de la poliza',
        icon: 'ShieldCheck',
        collapsible: true,
        fields: [
          {
            field: 'vehicle_id',
            label: 'Vehiculo',
            type: 'relation',
            required: true,
            relation: {
              apiPath: '/fleet/vehicles',
              labelField: 'plate',
              pageSize: 50,
              preload: false,
              clearable: false,
              disabledField: 'enabled',
            },
          },
          {
            field: 'insurer_name',
            label: 'Aseguradora',
            type: 'text',
            required: true,
            hint: 'Nombre de la compania aseguradora',
          },
          {
            field: 'policy_number',
            label: 'Numero de poliza',
            type: 'text',
            required: true,
            hint: 'Identificador unico de la poliza',
          },
          {
            field: 'coverage_type',
            label: 'Tipo de cobertura',
            type: 'select',
            options: ['basic', 'comprehensive', 'third_party', 'other'],
          },
        ],
      },
      {
        label: 'Vigencia y costos',
        icon: 'CalendarDays',
        collapsible: true,
        fields: [
          {
            field: 'start_date',
            label: 'Inicio de vigencia',
            type: 'date',
            required: true,
          },
          {
            field: 'expiry_date',
            label: 'Fin de vigencia',
            type: 'date',
            required: true,
          },
          {
            field: 'premium',
            label: 'Prima anual',
            type: 'currency',
          },
          {
            field: 'currency',
            label: 'Moneda',
            type: 'text',
            hint: 'Codigo de 3 letras (ej. MXN, USD)',
          },
        ],
      },
      {
        label: 'Notas y adjunto',
        icon: 'FileText',
        collapsible: true,
        fields: [
          {
            field: 'notes',
            label: 'Notas adicionales',
            type: 'textarea',
          },
          {
            field: 'document_asset_id',
            label: 'Certificado (PDF)',
            type: 'file',
          },
        ],
      },
    ],
    submitLabel: 'Guardar poliza',
    cancelLabel: 'Cancelar',
  },
})
