import { defineView } from '@atlas/module-engine'

export default defineView({
  key: 'financia.categories.table',
  kind: 'TABLE',
  version: '0.1.0',
  schema: {
    entity: 'category',
    component: 'AtlasTable',
    apiPath: '/financia/categories',
    description: 'Agrupa movimientos por naturaleza: ingresos, egresos o ambos. Usadas para clasificar transacciones y analizarlas en el resumen de cuenta.',
    primaryField: 'name',
    searchable: false,
    columns: [
      { field: 'color', label: 'Color',  sortable: false, type: 'color' },
      { field: 'name',  label: 'Nombre', sortable: true,  link: true },
      {
        field: 'kind',
        label: 'Tipo',
        sortable: true,
        type: 'select',
        options: [
          { value: 'income',  label: 'Ingreso' },
          { value: 'expense', label: 'Egreso'  },
          { value: 'both',    label: 'Ambos'   },
        ],
      },
    ],
    actions: [
      { label: 'Nueva categoria', permission: 'financia.categories.manage', variant: 'primary' },
    ],
    rowActions: [
      { label: 'Editar',     permission: 'financia.categories.manage' },
      { label: 'Desactivar', permission: 'financia.categories.manage' },
    ],
    emptyState: { message: 'No hay categorias registradas.' },
  },
})
