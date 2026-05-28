import { defineModel } from '@atlas/module-engine'

export default defineModel({
  key: 'website.menu_item',
  name: 'website.menu_item',
  label: 'Item de menu',
  tableName: 'website_menu_item',
  companyScoped: true,
  softDelete: true,
  fields: [
    { name: 'menu_id',    type: 'text',   required: true },
    { name: 'parent_id',  type: 'text' },
    { name: 'label',      type: 'text',   label: 'Etiqueta', required: true },
    { name: 'url',        type: 'text',   label: 'URL' },
    { name: 'page_id',    type: 'text',   label: 'Pagina vinculada' },
    { name: 'target',     type: 'select', label: 'Destino',
      options: ['_self', '_blank'], default: '_self' },
    { name: 'icon',       type: 'text',   label: 'Icono' },
    { name: 'sort_order', type: 'number', label: 'Orden', default: 0 },
  ],
})
