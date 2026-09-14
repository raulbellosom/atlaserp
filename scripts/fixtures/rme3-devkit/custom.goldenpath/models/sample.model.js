import { defineModel } from '@runly/module-engine'

export default defineModel({
  key: 'sample',
  name: 'goldenpath.sample',
  label: 'Muestra',
  tableName: 'goldenpath_sample',
  companyScoped: true,
  softDelete: true,
  fields: [
    { name: 'name', type: 'text', label: 'Nombre', required: true },
  ],
})
