import { defineView } from '@atlas/module-engine'

export default defineView({
  key: 'fleet.vehicle.form',
  kind: 'FORM',
  version: '0.1.0',
  schema: {
    entity: 'vehicle',
    component: 'AtlasForm',
    apiPath: '/fleet/vehicles',
    sections: [
      {
        label: 'Informacion general',
        fields: [
          { field: 'plate', label: 'Matricula', type: 'text', required: true },
          { field: 'brand', label: 'Marca', type: 'text', required: true },
          { field: 'model_name', label: 'Modelo', type: 'text', required: true },
          { field: 'year', label: 'Anio', type: 'number', required: true },
          { field: 'color', label: 'Color', type: 'color' },
          {
            field: 'status',
            label: 'Estado',
            type: 'select',
            options: ['active', 'maintenance', 'inactive', 'retired'],
          },
          { field: 'economic_group_number', label: 'No. Economico Grupo', type: 'text' },
          { field: 'economic_individual_number', label: 'No. Economico Individual', type: 'text' },
          { field: 'vehicle_type_id', label: 'Tipo de Vehiculo (UUID)', type: 'text' },
          { field: 'vehicle_brand_id', label: 'Marca Catalogo (UUID)', type: 'text' },
        ],
      },
      {
        label: 'Asignacion',
        fields: [
          {
            field: 'driver_id',
            label: 'Conductor',
            type: 'relation',
            relatedModel: 'Employee',
          },
        ],
      },
      {
        label: 'Notas',
        fields: [{ field: 'notes', label: 'Notas adicionales', type: 'textarea' }],
      },
    ],
    submitLabel: 'Guardar vehiculo',
    cancelLabel: 'Cancelar',
  },
})
