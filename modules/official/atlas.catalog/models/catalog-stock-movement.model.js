import { defineModel } from '@atlas/module-engine'

export const catalogStockMovementModel = defineModel({
  key:           'catalog_stock_movement',
  tableName:     'catalog_stock_movement',
  companyScoped: true,
  fields: [
    { name: 'product_id',      type: 'relation', required: true },
    { name: 'variant_id',      type: 'relation', required: false },
    { name: 'quantity_delta',  type: 'number',   required: true },
    { name: 'reason',          type: 'text',     required: false },
    { name: 'note',            type: 'text',     required: false },
    { name: 'user_id',         type: 'relation', required: false },
  ],
  foreignKeys: [
    {
      field:      'product_id',
      references: { table: 'catalog_product', field: 'id' },
      onDelete:   'CASCADE',
      onUpdate:   'CASCADE',
    },
    {
      field:      'variant_id',
      references: { table: 'catalog_product_variant', field: 'id' },
      onDelete:   'SET NULL',
      onUpdate:   'CASCADE',
    },
  ],
})
