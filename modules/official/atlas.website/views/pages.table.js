import { defineView } from '@atlas/module-engine'

export default defineView({
  key: 'website.pages.table',
  kind: 'TABLE',
  version: '0.1.0',
  schema: {
    entity: 'website.page',
    component: 'AtlasTable',
    apiPath: '/website/pages',
    primaryField: 'title',
    searchable: true,
    columns: [
      { field: 'title',      label: 'Titulo',    sortable: true, link: true },
      { field: 'route_path', label: 'Ruta',      sortable: false },
      { field: 'status',     label: 'Estado',    sortable: true },
      { field: 'page_type',  label: 'Tipo',      sortable: false },
      { field: 'published_at', label: 'Publicado', type: 'datetime' },
    ],
    actions: [
      { label: 'Crear pagina', permission: 'website.pages.create', variant: 'primary' },
    ],
    rowActions: [
      { label: 'Editar',   permission: 'website.pages.update' },
      { label: 'Eliminar', permission: 'website.pages.delete' },
    ],
    emptyState: { message: 'No hay paginas creadas.' },
  },
})
