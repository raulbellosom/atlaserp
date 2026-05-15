import { defineView } from '@atlas/module-engine'

export default defineView({
  key: 'fleet.vehicle.detail',
  kind: 'DETAIL',
  version: '0.1.0',
  schema: {
    entity: 'vehicle',
    component: 'AtlasDetail',
    apiPath: '/fleet/vehicles',
    sections: [
      {
        label: 'Informacion general',
        columns: 2,
        fields: [
          { field: 'plate', label: 'Matricula' },
          { field: 'brand', label: 'Marca' },
          { field: 'model_name', label: 'Modelo' },
          { field: 'year', label: 'Anio' },
          { field: 'color', label: 'Color', type: 'color' },
          { field: 'status', label: 'Estado' },
          { field: 'vehicle_type_name', label: 'Tipo de Vehiculo' },
          { field: 'vehicle_brand_name', label: 'Marca Catalogo' },
          { field: 'economic_number', label: 'No. Economico' },
        ],
      },
      {
        label: 'Conductor asignado',
        fields: [{ field: 'driver_id', label: 'Conductor', type: 'relation' }],
      },
    ],
    actions: [
      { label: 'Editar', permission: 'fleet.vehicles.update' },
      { label: 'Desactivar', permission: 'fleet.vehicles.delete' },
    ],
  },
})
