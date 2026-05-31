import { defineModel } from '@atlas/module-engine'

// company_id is auto-injected by the engine (companyScoped: true is the default).
// created_at and updated_at are auto-added by the SQL generator.
// Do not add them to the fields array.
export const catalogCategoryModel = defineModel({
  key:       'catalog_category',
  tableName: 'catalog_category',
  companyScoped: true,
  fields: [
    { name: 'name',        type: 'text',    required: true },
    { name: 'slug',        type: 'text',    required: true },
    { name: 'description', type: 'textarea', required: false },
    { name: 'enabled',     type: 'boolean', required: true, default: true },
  ],
  indexes: [
    { fields: ['slug'], unique: true },
  ],
})
