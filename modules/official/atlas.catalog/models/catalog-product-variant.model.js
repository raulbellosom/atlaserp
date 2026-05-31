import { defineModel } from '@atlas/module-engine'

export const catalogProductVariantModel = defineModel({
  key:           'catalog_product_variant',
  tableName:     'catalog_product_variant',
  companyScoped: true,
  fields: [
    { name: 'product_id',     type: 'relation', required: true },
    { name: 'option_values',  type: 'json',     required: true, default: '{}' },
    { name: 'sku',            type: 'text',     required: false },
    { name: 'barcode',        type: 'text',     required: false },
    { name: 'price',          type: 'decimal',  required: true,  default: 0 },
    { name: 'compare_price',  type: 'decimal',  required: false },
    { name: 'stock',          type: 'number',   required: true,  default: 0 },
    { name: 'cover_asset_id', type: 'relation', required: false },
    { name: 'enabled',        type: 'boolean',  required: true,  default: true },
  ],
  foreignKeys: [
    {
      field:      'product_id',
      references: { table: 'catalog_product', field: 'id' },
      onDelete:   'CASCADE',
      onUpdate:   'CASCADE',
    },
  ],
})
