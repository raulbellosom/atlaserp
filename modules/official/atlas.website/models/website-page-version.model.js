import { defineModel } from '@atlas/module-engine'

export default defineModel({
  key: 'website.page_version',
  name: 'website.page_version',
  label: 'Version de pagina',
  tableName: 'website_page_version',
  companyScoped: true,
  softDelete: false,
  fields: [
    { name: 'page_id',        type: 'text',   required: true },
    { name: 'version_number', type: 'number', required: true },
    { name: 'builder_data',   type: 'json' },
    { name: 'seo',            type: 'json' },
    { name: 'status',         type: 'select',
      options: ['snapshot', 'published'], default: 'snapshot' },
    { name: 'created_by_id',  type: 'text' },
  ],
})
