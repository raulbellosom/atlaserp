import { defineView } from '@atlas/module-engine'

export default defineView({
  key: 'fleet.driver.form',
  kind: 'FORM',
  version: '0.1.0',
  schema: {
    entity: 'driver',
    component: 'AtlasForm',
    apiPath: '/fleet/drivers',
    sections: [
      {
        label: 'Datos personales',
        fields: [
          { field: 'first_name', label: 'Nombre', type: 'text', required: true },
          { field: 'last_name', label: 'Apellido', type: 'text', required: true },
          { field: 'phone', label: 'Telefono', type: 'phone', required: true },
          { field: 'email', label: 'Correo electronico', type: 'email' },
        ],
      },
      {
        label: 'Licencia',
        fields: [
          { field: 'license_number', label: 'Numero de licencia', type: 'text', required: true },
          { field: 'license_type', label: 'Tipo de licencia', type: 'text', required: true },
          { field: 'license_expiry_date', label: 'Fecha de vencimiento', type: 'date', required: true },
        ],
      },
      {
        label: 'Estado',
        fields: [
          {
            field: 'status',
            label: 'Estado',
            type: 'select',
            default: 'active',
            options: [
              { label: 'Activo', value: 'active' },
              { label: 'Inactivo', value: 'inactive' },
              { label: 'Suspendido', value: 'suspended' },
            ],
          },
        ],
      },
      {
        label: 'Notas',
        fields: [
          { field: 'notes', label: 'Notas adicionales', type: 'textarea' },
        ],
      },
    ],
    submitLabel: 'Guardar chofer',
    cancelLabel: 'Cancelar',
  },
})
