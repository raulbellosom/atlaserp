import { defineView } from '@atlas/module-engine'

export default defineView({
  key: 'fleet.insurance_policy.table',
  kind: 'TABLE',
  version: '0.1.0',
  schema: {
    entity: 'insurance_policy',
    component: 'AtlasTable',
    apiPath: '/fleet/insurance',
    primaryField: 'policy_number',
    searchable: false,
    columns: [
      { field: 'vehicle_plate', label: 'Matricula', sortable: false },
      { field: 'insurer_name', label: 'Aseguradora', sortable: true },
      { field: 'policy_number', label: 'No. Poliza', sortable: true, link: true },
      { field: 'coverage_type', label: 'Cobertura', sortable: false },
      { field: 'start_date', label: 'Inicio vigencia', sortable: true, type: 'date' },
      { field: 'expiry_date', label: 'Fin vigencia', sortable: true, type: 'date' },
      { field: 'is_active', label: 'Estado', sortable: false, type: 'boolean' },
    ],
    actions: [
      { label: 'Nueva poliza', permission: 'fleet.insurance.create', variant: 'primary' },
    ],
    rowActions: [
      { label: 'Ver detalle', permission: 'fleet.insurance.read' },
      { label: 'Editar', permission: 'fleet.insurance.update' },
      { label: 'Desactivar', permission: 'fleet.insurance.delete' },
    ],
    emptyState: {
      message: 'No hay polizas de seguro registradas.',
    },
  },
})
