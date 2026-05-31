import { defineModel } from '@atlas/module-engine'

export const catalogCategoryModel = defineModel({
  key:           'catalog_category',
  tableName:     'catalog_category',
  companyScoped: true,
  fields: [
    { name: 'parent_id',       type: 'relation',  required: false },
    { name: 'name',            type: 'text',      required: true },
    { name: 'slug',            type: 'text',      required: true },
    { name: 'description',     type: 'textarea',  required: false },
    { name: 'cover_asset_id',  type: 'relation',  required: false },
    { name: 'position',        type: 'number',    required: true, default: 0 },
    { name: 'enabled',         type: 'boolean',   required: true, default: true },
  ],
  indexes: [
    { fields: ['slug'], unique: true },
  ],
  foreignKeys: [
    {
      field:      'parent_id',
      references: { table: 'catalog_category', field: 'id' },
      onDelete:   'SET NULL',
      onUpdate:   'CASCADE',
    },
  ],
})
