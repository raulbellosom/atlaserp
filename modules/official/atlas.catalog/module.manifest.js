import { defineAtlasModule } from '@atlas/module-engine'
import { catalogCategoryModel } from './models/catalog-category.model.js'
import { catalogProductModel } from './models/catalog-product.model.js'

export default defineAtlasModule({
  key: 'atlas.catalog',
  name: 'Catalogo',
  version: '1.0.0',
  kind: 'FEATURE',
  core: false,
  uninstallable: true,
  dependencies: [],
  permissions: [
    { key: 'catalog.access',          name: 'Acceder al catalogo' },
    { key: 'catalog.products.read',   name: 'Ver productos' },
    { key: 'catalog.products.create', name: 'Crear productos' },
    { key: 'catalog.products.update', name: 'Editar productos' },
    { key: 'catalog.products.delete', name: 'Eliminar productos' },
    { key: 'catalog.categories.read',   name: 'Ver categorias' },
    { key: 'catalog.categories.create', name: 'Crear categorias' },
    { key: 'catalog.categories.update', name: 'Editar categorias' },
    { key: 'catalog.categories.delete', name: 'Eliminar categorias' },
  ],
  navigation: [
    { label: 'Productos',   path: '/app/m/atlas.catalog',             icon: 'Package',     layout: 'main', permissionKey: 'catalog.products.read' },
    { label: 'Categorias',  path: '/app/m/atlas.catalog/categories',  icon: 'Tag',         layout: 'main', permissionKey: 'catalog.categories.read' },
  ],
  blueprints: [],
  models: [catalogCategoryModel, catalogProductModel],
})
