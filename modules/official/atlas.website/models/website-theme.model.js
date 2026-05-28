import { defineModel } from '@atlas/module-engine'

export default defineModel({
  key: 'website.theme',
  name: 'website.theme',
  label: 'Tema',
  tableName: 'website_theme',
  companyScoped: true,
  softDelete: true,
  fields: [
    { name: 'site_id',    type: 'text',     required: true },
    { name: 'name',       type: 'text',     label: 'Nombre', required: true },
    { name: 'tokens',     type: 'json',     label: 'Tokens de color' },
    { name: 'typography', type: 'json',     label: 'Tipografia' },
    { name: 'layout',     type: 'json',     label: 'Layout' },
    { name: 'custom_css', type: 'textarea', label: 'CSS personalizado' },
    { name: 'is_default', type: 'boolean',  label: 'Por defecto', default: false },
  ],
})
