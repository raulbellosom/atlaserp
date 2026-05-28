import { defineView } from '@atlas/module-engine'

export default defineView({
  key: 'ledger.types.table',
  kind: 'TABLE',
  version: '0.1.0',
  schema: {
    entity: 'transaction_type',
    component: 'AtlasTable',
    apiPath: '/ledger/types',
    description: 'Codigos de operacion bancaria (DEP, CHQ, TRANSF, etc.). Identifican el instrumento de cada movimiento y permiten filtrar el registro por tipo.',
    primaryField: 'code',
    searchable: false,
    columns: [
      { field: 'code', label: 'Codigo', sortable: true, link: true },
      { field: 'name', label: 'Nombre', sortable: true },
    ],
    actions: [
      { label: 'Nuevo tipo', permission: 'ledger.types.manage', variant: 'primary' },
    ],
    rowActions: [
      { label: 'Editar',     permission: 'ledger.types.manage' },
      { label: 'Desactivar', permission: 'ledger.types.manage' },
    ],
    emptyState: { message: 'No hay tipos de movimiento registrados.' },
  },
})
