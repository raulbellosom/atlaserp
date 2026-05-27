import { defineView } from '@atlas/module-engine'

export default defineView({
  key: 'financia.accounts.table',
  kind: 'TABLE',
  version: '0.1.0',
  schema: {
    entity: 'account',
    component: 'AtlasTable',
    apiPath: '/financia/accounts',
    primaryField: 'name',
    searchable: false,
    columns: [
      { field: 'name',            label: 'Nombre',       sortable: true,  link: true },
      { field: 'bank',            label: 'Banco',        sortable: true },
      { field: 'account_number',  label: 'No. cuenta',   sortable: false },
      { field: 'currency',        label: 'Moneda',       sortable: true },
      { field: 'current_balance', label: 'Saldo actual', sortable: false, type: 'currency' },
      { field: 'enabled',         label: 'Estado',       sortable: true,  type: 'boolean' },
    ],
    actions: [
      { label: 'Nueva cuenta', permission: 'financia.accounts.create', variant: 'primary' },
    ],
    rowActions: [
      { label: 'Abrir cuenta', permission: 'financia.accounts.read' },
      { label: 'Editar',       permission: 'financia.accounts.edit' },
      { label: 'Desactivar',   permission: 'financia.accounts.delete' },
    ],
    emptyState: { message: 'No hay cuentas bancarias registradas.' },
  },
})
