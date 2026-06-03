// Atlas Ledger — accounts, categories, transaction types

// ─── Accounts ────────────────────────────────────────────────────────────────

export const accountsPage = {
  key: 'ledger.accounts.page',
  kind: 'PAGE',
  schema: {
    path: '/app/m/atlas.ledger/accounts',
    title: 'Cuentas',
    layout: 'main',
    view: 'ledger.accounts.table',
  },
}

export const accountsTable = {
  key: 'ledger.accounts.table',
  kind: 'TABLE',
  schema: {
    entity: 'account',
    component: 'AtlasTable',
    apiPath: '/ledger/accounts',
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
    actions: [{ label: 'Nueva cuenta', permission: 'ledger.accounts.create', variant: 'primary' }],
    rowActions: [
      { label: 'Abrir cuenta', permission: 'ledger.accounts.read' },
      { label: 'Editar',       permission: 'ledger.accounts.update' },
      { label: 'Desactivar',   permission: 'ledger.accounts.delete' },
    ],
    emptyState: { message: 'No hay cuentas bancarias registradas.' },
  },
}

export const accountsForm = {
  key: 'ledger.accounts.form',
  kind: 'FORM',
  schema: {
    entity: 'account',
    component: 'AtlasForm',
    apiPath: '/ledger/accounts',
    sections: [
      {
        fields: [
          { name: 'name',            label: 'Nombre',        type: 'text',    required: true },
          { name: 'bank',            label: 'Banco',         type: 'text',    required: true },
          { name: 'account_number',  label: 'No. de cuenta', type: 'text' },
          {
            name: 'currency', label: 'Moneda', type: 'select', required: true,
            options: [
              { value: 'MXN', label: 'MXN - Peso mexicano' },
              { value: 'USD', label: 'USD - Dolar americano' },
            ],
          },
          { name: 'opening_balance', label: 'Saldo inicial', type: 'currency', required: true },
        ],
      },
    ],
  },
}

export const accountsDetail = {
  key: 'ledger.accounts.detail',
  kind: 'DETAIL',
  schema: {
    entity: 'account',
    apiPath: '/ledger/accounts',
    sections: [
      {
        title: 'Informacion de la cuenta',
        fields: [
          { name: 'name',            label: 'Nombre',        type: 'text' },
          { name: 'bank',            label: 'Banco',         type: 'text' },
          { name: 'account_number',  label: 'No. de cuenta', type: 'text' },
          { name: 'currency',        label: 'Moneda',        type: 'text' },
          { name: 'opening_balance', label: 'Saldo inicial', type: 'currency' },
          { name: 'current_balance', label: 'Saldo actual',  type: 'currency' },
          { name: 'enabled',         label: 'Estado',        type: 'boolean' },
        ],
      },
    ],
  },
}

// ─── Categories ──────────────────────────────────────────────────────────────

export const categoriesPage = {
  key: 'ledger.categories.page',
  kind: 'PAGE',
  schema: {
    path: '/app/m/atlas.ledger/categories',
    title: 'Categorias',
    layout: 'main',
    view: 'ledger.categories.table',
  },
}

export const categoriesTable = {
  key: 'ledger.categories.table',
  kind: 'TABLE',
  schema: {
    entity: 'category',
    component: 'AtlasTable',
    apiPath: '/ledger/categories',
    description: 'Agrupa movimientos por naturaleza: ingresos, egresos o ambos. Usadas para clasificar transacciones y analizarlas en el resumen de cuenta.',
    primaryField: 'name',
    searchable: false,
    columns: [
      { field: 'color', label: 'Color',  sortable: false, type: 'color' },
      { field: 'name',  label: 'Nombre', sortable: true,  link: true },
      {
        field: 'kind', label: 'Tipo', sortable: true, type: 'select',
        options: [
          { value: 'income',  label: 'Ingreso' },
          { value: 'expense', label: 'Egreso'  },
          { value: 'both',    label: 'Ambos'   },
        ],
      },
    ],
    actions: [{ label: 'Nueva categoria', permission: 'ledger.categories.manage', variant: 'primary' }],
    rowActions: [
      { label: 'Editar',     permission: 'ledger.categories.manage' },
      { label: 'Desactivar', permission: 'ledger.categories.manage' },
    ],
    emptyState: { message: 'No hay categorias registradas.' },
  },
}

export const categoriesForm = {
  key: 'ledger.categories.form',
  kind: 'FORM',
  schema: {
    entity: 'category',
    component: 'AtlasForm',
    apiPath: '/ledger/categories',
    sections: [
      {
        fields: [
          { name: 'name', label: 'Nombre', type: 'text', required: true },
          { name: 'color', label: 'Color', type: 'color' },
          {
            name: 'kind', label: 'Tipo', type: 'select', required: true,
            options: [
              { value: 'income',  label: 'Ingreso' },
              { value: 'expense', label: 'Egreso'  },
              { value: 'both',    label: 'Ambos'   },
            ],
          },
        ],
      },
    ],
  },
}

export const categoriesDetail = {
  key: 'ledger.categories.detail',
  kind: 'DETAIL',
  schema: {
    entity: 'category',
    apiPath: '/ledger/categories',
    sections: [
      {
        title: 'Informacion',
        fields: [
          { name: 'name',  label: 'Nombre', type: 'text' },
          { name: 'kind',  label: 'Tipo',   type: 'text' },
          { name: 'color', label: 'Color',  type: 'color' },
        ],
      },
    ],
  },
}

// ─── Transaction Types ────────────────────────────────────────────────────────

export const typesPage = {
  key: 'ledger.types.page',
  kind: 'PAGE',
  schema: {
    path: '/app/m/atlas.ledger/types',
    title: 'Tipos de movimiento',
    layout: 'main',
    view: 'ledger.types.table',
  },
}

export const typesTable = {
  key: 'ledger.types.table',
  kind: 'TABLE',
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
    actions: [{ label: 'Nuevo tipo', permission: 'ledger.types.manage', variant: 'primary' }],
    rowActions: [
      { label: 'Editar',     permission: 'ledger.types.manage' },
      { label: 'Desactivar', permission: 'ledger.types.manage' },
    ],
    emptyState: { message: 'No hay tipos de movimiento registrados.' },
  },
}

export const typesForm = {
  key: 'ledger.types.form',
  kind: 'FORM',
  schema: {
    entity: 'transaction_type',
    component: 'AtlasForm',
    apiPath: '/ledger/types',
    sections: [
      {
        fields: [
          { name: 'code', label: 'Codigo', type: 'text', required: true },
          { name: 'name', label: 'Nombre', type: 'text', required: true },
        ],
      },
    ],
  },
}

export const typesDetail = {
  key: 'ledger.types.detail',
  kind: 'DETAIL',
  schema: {
    entity: 'transaction_type',
    apiPath: '/ledger/types',
    sections: [
      {
        title: 'Informacion',
        fields: [
          { name: 'code', label: 'Codigo', type: 'text' },
          { name: 'name', label: 'Nombre', type: 'text' },
        ],
      },
    ],
  },
}
