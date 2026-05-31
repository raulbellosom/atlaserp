import { defineModel } from '@atlas/module-engine'

export const catalogProductModel = defineModel({
  key:           'catalog_product',
  tableName:     'catalog_product',
  companyScoped: true,
  fields: [
    { name: 'category_id',       type: 'relation',  required: false },
    { name: 'product_type',      type: 'text',      required: true,  default: 'SIMPLE' },
    { name: 'name',              type: 'text',      required: true },
    { name: 'slug',              type: 'text',      required: true },
    { name: 'description',       type: 'textarea',  required: false },
    { name: 'sku',               type: 'text',      required: false },
    { name: 'barcode',           type: 'text',      required: false },
    { name: 'price',             type: 'decimal',   required: true,  default: 0 },
    { name: 'compare_price',     type: 'decimal',   required: false },
    { name: 'currency',          type: 'text',      required: true,  default: 'USD' },
    { name: 'weight',            type: 'decimal',   required: false },
    { name: 'stock',             type: 'number',    required: true,  default: 0 },
    { name: 'track_stock',       type: 'boolean',   required: true,  default: false },
    { name: 'attributes',        type: 'json',      required: false, default: '[]' },
    { name: 'cover_asset_id',    type: 'relation',  required: false },
    { name: 'images',            type: 'json',      required: false, default: '[]' },
    { name: 'meta_title',        type: 'text',      required: false },
    { name: 'meta_description',  type: 'text',      required: false },
    { name: 'enabled',           type: 'boolean',   required: true,  default: true },
    { name: 'published',         type: 'boolean',   required: true,  default: false },
  ],
  indexes: [
    { fields: ['slug'], unique: true },
  ],
  foreignKeys: [
    {
      field:      'category_id',
      references: { table: 'catalog_category', field: 'id' },
      onDelete:   'SET NULL',
      onUpdate:   'CASCADE',
    },
  ],
})
