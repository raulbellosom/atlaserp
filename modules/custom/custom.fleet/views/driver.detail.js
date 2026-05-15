import { defineView } from '@atlas/module-engine'

export default defineView({
  key: 'fleet.driver.detail',
  kind: 'DETAIL',
  version: '0.1.0',
  schema: {
    entity: 'driver',
    component: 'AtlasDetail',
    apiPath: '/fleet/drivers',
    sections: [
      {
        label: 'Datos personales',
        columns: 2,
        fields: [
          { field: 'first_name', label: 'Nombre' },
          { field: 'last_name', label: 'Apellido' },
          { field: 'phone', label: 'Telefono' },
          { field: 'email', label: 'Correo electronico' },
        ],
      },
      {
        label: 'Licencia',
        columns: 2,
        fields: [
          { field: 'license_number', label: 'Numero de licencia' },
          { field: 'license_type', label: 'Tipo de licencia' },
          { field: 'license_expiry_date', label: 'Fecha de vencimiento', type: 'date' },
        ],
      },
      {
        label: 'Estado',
        fields: [
          { field: 'status', label: 'Estado' },
        ],
      },
      {
        label: 'Notas',
        fields: [
          { field: 'notes', label: 'Notas' },
        ],
      },
    ],
    actions: [
      { label: 'Editar', permission: 'fleet.drivers.update' },
      { label: 'Desactivar', permission: 'fleet.drivers.delete' },
    ],
  },
})
