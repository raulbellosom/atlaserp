// Atlas Ledger core views — accounts, categories, transaction types

export const accountsTable = {
  key: 'atlas.ledger.accounts.table',
  kind: 'TABLE',
  schema: {
    entity: 'LedgerAccount',
    apiPath: '/ledger/accounts',
    title: 'Cuentas bancarias',
    columns: [
      { field: 'name',            label: 'Nombre' },
      { field: 'bank',            label: 'Banco' },
      { field: 'account_number',  label: 'No. de cuenta' },
      { field: 'currency',        label: 'Moneda' },
      { field: 'opening_balance', label: 'Saldo inicial', type: 'currency' },
    ],
    actions: [{ label: 'Agregar cuenta' }],
  },
}

export const accountsForm = {
  key: 'atlas.ledger.accounts.form',
  kind: 'FORM',
  schema: {
    entity: 'LedgerAccount',
    apiPath: '/ledger/accounts',
    sections: [
      {
        title: 'Datos de la cuenta',
        fields: [
          { name: 'name',            label: 'Nombre',         type: 'text',   required: true },
          { name: 'bank',            label: 'Banco',          type: 'text',   required: true },
          { name: 'account_number',  label: 'No. de cuenta',  type: 'text' },
          {
            name: 'currency', label: 'Moneda', type: 'select',
            options: [
              { value: 'MXN', label: 'MXN - Peso mexicano' },
              { value: 'USD', label: 'USD - Dolar americano' },
            ],
          },
          { name: 'opening_balance', label: 'Saldo inicial',  type: 'number' },
        ],
      },
    ],
  },
}

export const categoriesTable = {
  key: 'atlas.ledger.categories.table',
  kind: 'TABLE',
  schema: {
    entity: 'LedgerCategory',
    apiPath: '/ledger/categories',
    title: 'Categorias',
    columns: [
      { field: 'name',  label: 'Nombre' },
      { field: 'kind',  label: 'Tipo' },
      { field: 'color', label: 'Color', type: 'color' },
    ],
    actions: [{ label: 'Agregar categoria' }],
  },
}

export const categoriesForm = {
  key: 'atlas.ledger.categories.form',
  kind: 'FORM',
  schema: {
    entity: 'LedgerCategory',
    apiPath: '/ledger/categories',
    sections: [
      {
        title: 'Categoria',
        fields: [
          { name: 'name',  label: 'Nombre',  type: 'text', required: true },
          { name: 'color', label: 'Color',   type: 'color' },
          {
            name: 'kind', label: 'Aplica a', type: 'select',
            options: [
              { value: 'both',    label: 'Ingresos y egresos' },
              { value: 'income',  label: 'Solo ingresos' },
              { value: 'expense', label: 'Solo egresos' },
            ],
          },
        ],
      },
    ],
  },
}

export const typesTable = {
  key: 'atlas.ledger.types.table',
  kind: 'TABLE',
  schema: {
    entity: 'LedgerTransactionType',
    apiPath: '/ledger/types',
    title: 'Tipos de movimiento',
    columns: [
      { field: 'code', label: 'Codigo' },
      { field: 'name', label: 'Nombre' },
    ],
    actions: [{ label: 'Agregar tipo' }],
  },
}

export const typesForm = {
  key: 'atlas.ledger.types.form',
  kind: 'FORM',
  schema: {
    entity: 'LedgerTransactionType',
    apiPath: '/ledger/types',
    sections: [
      {
        title: 'Tipo de movimiento',
        fields: [
          { name: 'code', label: 'Codigo', type: 'text', required: true },
          { name: 'name', label: 'Nombre', type: 'text', required: true },
        ],
      },
    ],
  },
}
