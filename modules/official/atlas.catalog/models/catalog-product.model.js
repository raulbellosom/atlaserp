import { defineModel } from '@atlas/module-engine'

// company_id is auto-injected by the engine (companyScoped: true is the default).
// created_at and updated_at are auto-added by the SQL generator.
// Do not add them to the fields array.
// UUID foreign keys use type: 'relation' (maps to UUID column in SQL).
// Prices use type: 'decimal' (NUMERIC(18,4)). Quantity counts use type: 'number' (INTEGER).
// JSON arrays use type: 'json' (JSONB). String default '[]' becomes DEFAULT '[]'::jsonb-safe.
export const catalogProductModel = defineModel({
  key:       'catalog_product',
  tableName: 'catalog_product',
  companyScoped: true,
  fields: [
    { name: 'category_id',    type: 'relation', required: false },
    { name: 'name',           type: 'text',     required: true },
    { name: 'slug',           type: 'text',     required: true },
    { name: 'description',    type: 'textarea', required: false },
    { name: 'price',          type: 'decimal',  required: true,  default: 0 },
    { name: 'compare_price',  type: 'decimal',  required: false },
    { name: 'currency',       type: 'text',     required: true,  default: 'USD' },
    { name: 'stock',          type: 'number',   required: true,  default: 0 },
    { name: 'track_stock',    type: 'boolean',  required: true,  default: false },
    { name: 'cover_asset_id', type: 'relation', required: false },
    { name: 'images',         type: 'json',     required: false, default: '[]' },
    { name: 'enabled',        type: 'boolean',  required: true,  default: true },
    { name: 'published',      type: 'boolean',  required: true,  default: false },
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
