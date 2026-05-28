import { defineModel } from '@atlas/module-engine'

export default defineModel({
  key: 'website.site',
  name: 'website.site',
  label: 'Sitio web',
  tableName: 'website_site',
  companyScoped: true,
  softDelete: true,
  fields: [
    { name: 'name',             type: 'text',     label: 'Nombre',          required: true },
    { name: 'domain',           type: 'text',     label: 'Dominio' },
    { name: 'default_locale',   type: 'text',     label: 'Idioma',          default: 'es' },
    { name: 'status',           type: 'select',   label: 'Estado',
      options: ['draft', 'published', 'maintenance'], default: 'draft' },
    { name: 'homepage_page_id', type: 'text',     label: 'Pagina de inicio' },
    { name: 'theme_id',         type: 'text',     label: 'Tema activo' },
    { name: 'settings',         type: 'json',     label: 'Configuracion' },
    { name: 'seo_defaults',     type: 'json',     label: 'SEO por defecto' },
  ],
})
