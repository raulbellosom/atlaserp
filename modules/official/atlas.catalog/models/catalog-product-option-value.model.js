import { defineModel } from '@atlas/module-engine'

export const catalogProductOptionValueModel = defineModel({
  key:           'catalog_product_option_value',
  tableName:     'catalog_product_option_value',
  companyScoped: true,
  fields: [
    { name: 'option_id', type: 'relation', required: true },
    { name: 'value',     type: 'text',     required: true },
    { name: 'position',  type: 'number',   required: true, default: 0 },
  ],
  foreignKeys: [
    {
      field:      'option_id',
      references: { table: 'catalog_product_option', field: 'id' },
      onDelete:   'CASCADE',
      onUpdate:   'CASCADE',
    },
  ],
})
