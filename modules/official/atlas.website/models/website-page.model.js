import { defineModel } from '@atlas/module-engine'

export default defineModel({
  key: 'website.page',
  name: 'website.page',
  label: 'Pagina',
  tableName: 'website_page',
  companyScoped: true,
  softDelete: true,
  fields: [
    { name: 'site_id',               type: 'text',     label: 'Sitio',     required: true },
    { name: 'title',                 type: 'text',     label: 'Titulo',    required: true },
    { name: 'slug',                  type: 'text',     label: 'Slug',      required: true },
    { name: 'route_path',            type: 'text',     label: 'Ruta',      required: true },
    { name: 'status',                type: 'select',   label: 'Estado',
      options: ['draft', 'published', 'archived'], default: 'draft' },
    { name: 'page_type',             type: 'select',   label: 'Tipo',
      options: ['page', 'landing', 'system'], default: 'page' },
    { name: 'draft_builder_data',    type: 'json',     label: 'Borrador Puck' },
    { name: 'published_builder_data',type: 'json',     label: 'Publicado Puck' },
    { name: 'seo',                   type: 'json',     label: 'SEO' },
    { name: 'visibility',            type: 'select',   label: 'Visibilidad',
      options: ['public', 'authenticated', 'private'], default: 'public' },
    { name: 'published_at',          type: 'datetime', label: 'Publicado en' },
    { name: 'created_by_id',         type: 'text' },
    { name: 'updated_by_id',         type: 'text' },
  ],
  indexes: [
    { fields: ['company_id', 'site_id', 'route_path'], unique: true },
    { fields: ['company_id', 'status'] },
  ],
})
