import { defineModel } from '@atlas/module-engine'

export const catalogProductModel = defineModel({
  name: 'catalog_product',
  fields: [
    { name: 'company_id',      type: 'uuid',    required: true },
    { name: 'category_id',     type: 'uuid',    required: false },
    { name: 'name',            type: 'text',    required: true },
    { name: 'slug',            type: 'text',    required: true },
    { name: 'description',     type: 'text',    required: false },
    { name: 'price',           type: 'numeric', required: true, default: 0 },
    { name: 'compare_price',   type: 'numeric', required: false },
    { name: 'currency',        type: 'text',    required: true, default: 'USD' },
    { name: 'stock',           type: 'integer', required: true, default: 0 },
    { name: 'track_stock',     type: 'boolean', required: true, default: false },
    { name: 'cover_asset_id',  type: 'uuid',    required: false },
    { name: 'images',          type: 'jsonb',   required: false, default: '[]' },
    { name: 'enabled',         type: 'boolean', required: true, default: true },
    { name: 'published',       type: 'boolean', required: true, default: false },
  ],
  timestamps: true,
})
