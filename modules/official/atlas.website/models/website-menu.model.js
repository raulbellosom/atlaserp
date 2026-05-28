import { defineModel } from '@atlas/module-engine'

export default defineModel({
  key: 'website.menu',
  name: 'website.menu',
  label: 'Menu',
  tableName: 'website_menu',
  companyScoped: true,
  softDelete: true,
  fields: [
    { name: 'site_id',  type: 'text',   required: true },
    { name: 'name',     type: 'text',   label: 'Nombre',   required: true },
    { name: 'location', type: 'select', label: 'Ubicacion',
      options: ['header', 'footer', 'mobile', 'custom'], default: 'header' },
  ],
})
