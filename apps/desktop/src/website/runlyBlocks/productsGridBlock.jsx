import { defineBlock } from '@raulbellosom/atlas-web-builder'

export const ProductsGridBlock = defineBlock({
  type:     'ProductsGridBlock',
  label:    'Grid de productos',
  category: 'atlas-ecommerce',
  defaultProps: { categoryId: '', limit: 8, columns: '4', showPrice: true, showAddToCart: true },
  fields: {
    categoryId:    { type: 'text',   label: 'ID de categoria (opcional)' },
    limit:         { type: 'number', label: 'Maximo de productos' },
    columns:       { type: 'select', label: 'Columnas', options: [{ value: '2', label: '2' }, { value: '3', label: '3' }, { value: '4', label: '4' }] },
    showPrice:     { type: 'toggle', label: 'Mostrar precio' },
    showAddToCart: { type: 'toggle', label: 'Boton agregar al carrito' },
  },
  render({ limit, columns, showPrice, showAddToCart }) {
    return (
      <div style={{ padding: '24px', background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '8px', textAlign: 'center' }}>
        <p style={{ color: '#94a3b8', fontSize: '14px' }}>
          Grid de productos · {limit} items · {columns} columnas
          {showPrice ? ' · con precio' : ''}
          {showAddToCart ? ' · con carrito' : ''}
        </p>
        <p style={{ color: '#cbd5e1', fontSize: '12px', marginTop: '4px' }}>Los productos del catalogo apareceran aqui</p>
      </div>
    )
  },
})
