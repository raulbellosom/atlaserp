import { defineModel } from '@atlas/module-engine'

export const catalogProductOptionModel = defineModel({
  key:           'catalog_product_option',
  tableName:     'catalog_product_option',
  companyScoped: true,
  fields: [
    { name: 'product_id', type: 'relation', required: true },
    { name: 'name',       type: 'text',     required: true },
    { name: 'position',   type: 'number',   required: true, default: 0 },
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
