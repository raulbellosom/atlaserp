import { defineBlock } from '@raulbellosom/atlas-web-builder'

export const ProductCardBlock = defineBlock({
  type:     'ProductCardBlock',
  label:    'Tarjeta de producto',
  category: 'atlas-ecommerce',
  defaultProps: { productId: '', showPrice: true, showDescription: true, showAddToCart: true },
  fields: {
    productId:       { type: 'text',   label: 'ID del producto' },
    showPrice:       { type: 'toggle', label: 'Mostrar precio' },
    showDescription: { type: 'toggle', label: 'Mostrar descripcion' },
    showAddToCart:   { type: 'toggle', label: 'Boton agregar al carrito' },
  },
  render({ productId, showPrice, showDescription, showAddToCart }) {
    return (
      <div style={{ padding: '16px', border: '1px dashed #cbd5e1', borderRadius: '8px', textAlign: 'center' }}>
        <p style={{ color: '#94a3b8', fontSize: '14px' }}>
          Tarjeta de producto{productId ? `: ${productId}` : ' (configura el ID)'}
        </p>
        <p style={{ color: '#cbd5e1', fontSize: '12px', marginTop: '4px' }}>
          {[showPrice && 'precio', showDescription && 'descripcion', showAddToCart && 'carrito'].filter(Boolean).join(' · ')}
        </p>
      </div>
    )
  },
})
