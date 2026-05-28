import { defineModel } from '@atlas/module-engine'

export default defineModel({
  key: 'website.published_render',
  name: 'website.published_render',
  label: 'Render publicado',
  tableName: 'website_published_render',
  companyScoped: true,
  softDelete: false,
  fields: [
    { name: 'site_id',      type: 'text',     required: true },
    { name: 'source_type',  type: 'select',   required: true,
      options: ['page', 'blog_post', 'product', 'collection'] },
    { name: 'source_id',    type: 'text',     required: true },
    { name: 'path',         type: 'text',     required: true },
    { name: 'html',         type: 'text' },
    { name: 'title',        type: 'text' },
    { name: 'description',  type: 'text' },
    { name: 'og_image',     type: 'text' },
    { name: 'status_code',  type: 'number',   default: 200 },
    { name: 'content_hash', type: 'text' },
    { name: 'published_at', type: 'datetime' },
  ],
  indexes: [
    { fields: ['site_id', 'path'], unique: true },
  ],
})
