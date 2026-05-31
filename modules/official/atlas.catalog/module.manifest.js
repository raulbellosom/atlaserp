import { defineAtlasModule } from '@atlas/module-engine'

export default defineAtlasModule({
  key: 'atlas.catalog',
  name: 'Catalogo',
  description: 'Gestiona productos, categorias, variantes e inventario',
  icon: 'ShoppingBag',
  version: '2.0.0',
  kind: 'FEATURE',
  core: false,
  uninstallable: true,
  dependencies: [],
  permissions: [
    { key: 'catalog.access',            name: 'Acceder al catalogo' },
    { key: 'catalog.products.read',     name: 'Ver productos' },
    { key: 'catalog.products.create',   name: 'Crear productos' },
    { key: 'catalog.products.update',   name: 'Editar productos' },
    { key: 'catalog.products.delete',   name: 'Eliminar productos' },
    { key: 'catalog.categories.read',   name: 'Ver categorias' },
    { key: 'catalog.categories.create', name: 'Crear categorias' },
    { key: 'catalog.categories.update', name: 'Editar categorias' },
    { key: 'catalog.categories.delete', name: 'Eliminar categorias' },
    { key: 'catalog.inventory.adjust',  name: 'Ajustar stock' },
  ],
  navigation: [
    { label: 'Productos',  path: '/app/m/atlas.catalog',            icon: 'ShoppingBag', layout: 'main', permissionKey: 'catalog.products.read' },
    { label: 'Categorias', path: '/app/m/atlas.catalog/categories', icon: 'Tag',         layout: 'main', permissionKey: 'catalog.categories.read' },
    { label: 'Inventario', path: '/app/m/atlas.catalog/inventory',  icon: 'BarChart3',   layout: 'main', permissionKey: 'catalog.products.read' },
  ],
  blueprints: [],
  models: [
    './models/catalog-category.model.js',
    './models/catalog-product.model.js',
    './models/catalog-product-option.model.js',
    './models/catalog-product-option-value.model.js',
    './models/catalog-product-variant.model.js',
    './models/catalog-stock-movement.model.js',
  ],
})
