import { defineModel } from '@atlas/module-engine'

export const catalogCategoryModel = defineModel({
  name: 'catalog_category',
  fields: [
    { name: 'company_id', type: 'uuid',    required: true },
    { name: 'name',       type: 'text',    required: true },
    { name: 'slug',       type: 'text',    required: true },
    { name: 'description',type: 'text',    required: false },
    { name: 'enabled',    type: 'boolean', required: true, default: true },
  ],
  timestamps: true,
})
