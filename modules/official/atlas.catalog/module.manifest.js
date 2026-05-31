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
    { key: 'catalog.access',          label: 'Acceder al catalogo' },
    { key: 'catalog.products.read',   label: 'Ver productos' },
    { key: 'catalog.products.create', label: 'Crear productos' },
    { key: 'catalog.products.update', label: 'Editar productos' },
    { key: 'catalog.products.delete', label: 'Eliminar productos' },
    { key: 'catalog.categories.read',   label: 'Ver categorias' },
    { key: 'catalog.categories.create', label: 'Crear categorias' },
    { key: 'catalog.categories.update', label: 'Editar categorias' },
    { key: 'catalog.categories.delete', label: 'Eliminar categorias' },
  ],
  navigation: [
    { label: 'Catalogo',    path: '/app/m/atlas.catalog',             icon: 'ShoppingBag', layout: 'main', permissionKey: 'catalog.access' },
    { label: 'Productos',   path: '/app/m/atlas.catalog',             icon: 'Package',     layout: 'main', permissionKey: 'catalog.products.read' },
    { label: 'Categorias',  path: '/app/m/atlas.catalog/categories',  icon: 'Tag',         layout: 'main', permissionKey: 'catalog.categories.read' },
  ],
  blueprints: [],
  models: [catalogCategoryModel, catalogProductModel],
})
