# atlas.website v2 — Plan B: Blog + Formularios + Stripe + Bloques Dinámicos

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Prerequisites:**
> - atlas.website v2 Plan A complete (builder installed, editor and wizard working)
> - Platform Settings SMTP Plan complete (smtp-service.js available)
> - atlas.catalog Plan A complete (if testing ecommerce blocks)

**Goal:** Wire blog posts, real form submissions (with SMTP), reservation booking via atlas.calendar, ecommerce product blocks, cart, and Stripe checkout into the atlas.website module.

**Architecture:** Each dynamic feature is a custom `atlas-web-builder` block defined with `defineBlock`. Universal blocks (contact form, blog index) ship in Plan B. Ecommerce and bookings blocks are only added to the editor if the respective modules are installed. A new `WebsitePaymentsScreen` handles Stripe credentials.

**Tech Stack:** `@raulbellosom/atlas-web-builder` (`defineBlock`), React 18, TanStack Query, Tailwind, `@atlas/ui`, `stripe` npm package (server-side), `nodemailer` (via smtp-service)

---

## File Map

### Create (custom blocks)
- `apps/desktop/src/website/atlasBlocks/contactFormBlock.js`
- `apps/desktop/src/website/atlasBlocks/blogIndexBlock.js`
- `apps/desktop/src/website/atlasBlocks/productsGridBlock.js`
- `apps/desktop/src/website/atlasBlocks/productCardBlock.js`
- `apps/desktop/src/website/atlasBlocks/cartBlock.js`
- `apps/desktop/src/website/atlasBlocks/bookingFormBlock.js`
- `apps/desktop/src/website/atlasBlocks/index.js`

### Create (admin screens)
- `apps/desktop/src/modules/atlas.website/screens/WebsitePaymentsScreen.jsx`

### Create (API)
- `apps/api/src/routes/website/forms-public-routes.js` — `POST /public/website/forms/:id/submit`
- `apps/api/src/routes/website/bookings-routes.js` — `POST /public/website/bookings`
- `apps/api/src/routes/website/checkout-routes.js` — `POST /public/website/checkout` + Stripe webhook

### Modify
- `apps/desktop/src/modules/atlas.website/screens/WebsiteBlogScreen.jsx` — adapt for page_type filter
- `apps/desktop/src/modules/atlas.website/screens/WebsiteFormsScreen.jsx` — add submissions panel
- `apps/desktop/src/modules/atlas.website/screens/WebsitePageEditorScreen.jsx` — add atlasBlocks + resources
- `apps/api/src/routes/website/index.js` — mount new routers
- `apps/api/src/routes/public-website.js` — mount public form + booking + blog endpoints

---

## Task 1 — Atlas blocks: ContactFormBlock + BlogIndexBlock

**Files:**
- Create: `apps/desktop/src/website/atlasBlocks/contactFormBlock.js`
- Create: `apps/desktop/src/website/atlasBlocks/blogIndexBlock.js`
- Create: `apps/desktop/src/website/atlasBlocks/index.js`

- [ ] **Step 1: Create the directory**

  ```bash
  mkdir -p apps/desktop/src/website/atlasBlocks
  ```

- [ ] **Step 2: Create contactFormBlock.js**

  ```js
  // apps/desktop/src/website/atlasBlocks/contactFormBlock.js
  import { defineBlock } from '@raulbellosom/atlas-web-builder'
  import { getApiUrl } from '../../lib/runtimeConfig.js'

  export const ContactFormBlock = defineBlock({
    type:     'ContactFormBlock',
    label:    'Formulario de contacto',
    category: 'atlas',
    defaultProps: {
      formId:         '',
      successMessage: 'Mensaje enviado correctamente',
      buttonLabel:    'Enviar',
    },
    fields: {
      formId:         { type: 'text',   label: 'ID del formulario' },
      successMessage: { type: 'text',   label: 'Mensaje de exito' },
      buttonLabel:    { type: 'text',   label: 'Texto del boton' },
    },
    render: ({ formId, successMessage, buttonLabel }) => {
      if (!formId) {
        return (
          <div style={{ padding: '24px', background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '8px', textAlign: 'center' }}>
            <p style={{ color: '#94a3b8', fontSize: '14px' }}>Configura el ID del formulario en las propiedades del bloque</p>
          </div>
        )
      }

      const handleSubmit = async (e) => {
        e.preventDefault()
        const form = e.target
        const data = Object.fromEntries(new FormData(form))
        try {
          const res = await fetch(`${getApiUrl()}/public/website/forms/${formId}/submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          })
          if (res.ok) {
            form.reset()
            const msg = form.closest('[data-atlas-block]')?.querySelector('[data-success-msg]')
            if (msg) { msg.style.display = 'block'; setTimeout(() => { msg.style.display = 'none' }, 5000) }
          }
        } catch { /* no-op */ }
      }

      return (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '480px' }}>
          <input name="name"    required placeholder="Nombre"  style={{ padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '14px' }} />
          <input name="email"   required type="email" placeholder="Email" style={{ padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '14px' }} />
          <textarea name="message" required rows={4} placeholder="Mensaje" style={{ padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '14px', resize: 'vertical' }} />
          <button type="submit" style={{ padding: '10px 24px', background: 'var(--atlas-color-primary, #6D28D9)', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }}>
            {buttonLabel}
          </button>
          <p data-success-msg style={{ display: 'none', color: '#16a34a', fontSize: '14px' }}>{successMessage}</p>
        </form>
      )
    },
  })
  ```

- [ ] **Step 3: Create blogIndexBlock.js**

  ```js
  // apps/desktop/src/website/atlasBlocks/blogIndexBlock.js
  import { defineBlock } from '@raulbellosom/atlas-web-builder'
  import { getApiUrl } from '../../lib/runtimeConfig.js'

  export const BlogIndexBlock = defineBlock({
    type:     'BlogIndexBlock',
    label:    'Lista de posts del blog',
    category: 'atlas',
    defaultProps: { limit: 6, columns: 3, showExcerpt: true, siteId: '' },
    fields: {
      limit:       { type: 'number', label: 'Maximo de posts' },
      columns:     { type: 'select', label: 'Columnas', options: [{ value: '1', label: '1' }, { value: '2', label: '2' }, { value: '3', label: '3' }] },
      showExcerpt: { type: 'toggle', label: 'Mostrar extracto' },
      siteId:      { type: 'text',   label: 'ID del sitio (auto)' },
    },
    render: ({ limit, columns, showExcerpt, siteId, ctx }) => {
      const [posts, setPosts] = ctx?.useState?.([]) ?? [[], () => {}]

      if (ctx?.useEffect) {
        ctx.useEffect(() => {
          fetch(`${getApiUrl()}/public/website/blog?siteId=${siteId}&limit=${limit}`)
            .then((r) => r.json())
            .then((d) => setPosts(d.data ?? []))
            .catch(() => {})
        }, [siteId, limit])
      }

      if (!posts.length) {
        return (
          <div style={{ padding: '24px', background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '8px', textAlign: 'center' }}>
            <p style={{ color: '#94a3b8', fontSize: '14px' }}>Lista de posts del blog</p>
          </div>
        )
      }

      const cols = Number(columns) || 3
      return (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: '24px' }}>
          {posts.map((post) => (
            <a key={post.id} href={post.slug} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                <div style={{ padding: '16px' }}>
                  <h3 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 600 }}>{post.title}</h3>
                  {showExcerpt && post.excerpt && <p style={{ margin: 0, fontSize: '14px', color: '#64748b' }}>{post.excerpt}</p>}
                </div>
              </div>
            </a>
          ))}
        </div>
      )
    },
  })
  ```

- [ ] **Step 4: Create atlasBlocks/index.js**

  ```js
  // apps/desktop/src/website/atlasBlocks/index.js
  import { ContactFormBlock } from './contactFormBlock.js'
  import { BlogIndexBlock }   from './blogIndexBlock.js'

  export const universalAtlasBlocks = [ContactFormBlock, BlogIndexBlock]

  // Ecommerce and bookings blocks are imported lazily in the editor based on site_type
  export { ProductsGridBlock } from './productsGridBlock.js'
  export { ProductCardBlock }  from './productCardBlock.js'
  export { CartBlock }         from './cartBlock.js'
  export { BookingFormBlock }  from './bookingFormBlock.js'
  ```

- [ ] **Step 5: Verify syntax**

  ```bash
  node --check apps/desktop/src/website/atlasBlocks/contactFormBlock.js
  node --check apps/desktop/src/website/atlasBlocks/blogIndexBlock.js
  node --check apps/desktop/src/website/atlasBlocks/index.js
  ```

---

## Task 2 — Atlas blocks: ecommerce (ProductsGridBlock + CartBlock)

**Files:**
- Create: `apps/desktop/src/website/atlasBlocks/productsGridBlock.js`
- Create: `apps/desktop/src/website/atlasBlocks/productCardBlock.js`
- Create: `apps/desktop/src/website/atlasBlocks/cartBlock.js`

- [ ] **Step 1: Create productsGridBlock.js**

  ```js
  // apps/desktop/src/website/atlasBlocks/productsGridBlock.js
  import { defineBlock } from '@raulbellosom/atlas-web-builder'

  export const ProductsGridBlock = defineBlock({
    type:     'ProductsGridBlock',
    label:    'Grid de productos',
    category: 'atlas-ecommerce',
    defaultProps: { categoryId: '', limit: 8, columns: 4, showPrice: true, showAddToCart: true },
    fields: {
      categoryId:    { type: 'text',   label: 'ID de categoria (opcional)' },
      limit:         { type: 'number', label: 'Maximo de productos' },
      columns:       { type: 'select', label: 'Columnas', options: [{ value: '2', label: '2' }, { value: '3', label: '3' }, { value: '4', label: '4' }] },
      showPrice:     { type: 'toggle', label: 'Mostrar precio' },
      showAddToCart: { type: 'toggle', label: 'Boton agregar al carrito' },
    },
    render: ({ categoryId, limit, columns, showPrice, showAddToCart, ctx }) => {
      const [products, setProducts] = ctx?.useState?.([]) ?? [[], () => {}]

      if (ctx?.useEffect) {
        ctx.useEffect(() => {
          const url = `/public/catalog/products?limit=${limit}${categoryId ? `&categoryId=${categoryId}` : ''}`
          fetch(url).then((r) => r.json()).then((d) => setProducts(d.data ?? [])).catch(() => {})
        }, [categoryId, limit])
      }

      if (!products.length) {
        return (
          <div style={{ padding: '24px', background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '8px', textAlign: 'center' }}>
            <p style={{ color: '#94a3b8', fontSize: '14px' }}>Grid de productos · {limit} productos · {columns} columnas</p>
          </div>
        )
      }

      const addToCart = (product) => {
        const cart = JSON.parse(localStorage.getItem('atlas-cart') ?? '[]')
        const existing = cart.find((i) => i.productId === product.id)
        if (existing) { existing.qty += 1 } else { cart.push({ productId: product.id, name: product.name, price: Number(product.price), qty: 1 }) }
        localStorage.setItem('atlas-cart', JSON.stringify(cart))
        window.dispatchEvent(new Event('atlas-cart-updated'))
      }

      return (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: '20px' }}>
          {products.map((p) => (
            <div key={p.id} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
              <div style={{ background: '#f1f5f9', aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '32px', color: '#94a3b8' }}>📦</span>
              </div>
              <div style={{ padding: '12px' }}>
                <p style={{ margin: '0 0 4px', fontWeight: 600, fontSize: '14px' }}>{p.name}</p>
                {showPrice && <p style={{ margin: '0 0 8px', fontSize: '14px', color: 'var(--atlas-color-primary, #6D28D9)' }}>{p.currency} {Number(p.price).toFixed(2)}</p>}
                {showAddToCart && <button onClick={() => addToCart(p)} style={{ width: '100%', padding: '8px', background: 'var(--atlas-color-primary, #6D28D9)', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>Agregar al carrito</button>}
              </div>
            </div>
          ))}
        </div>
      )
    },
  })
  ```

- [ ] **Step 2: Create productCardBlock.js**

  ```js
  // apps/desktop/src/website/atlasBlocks/productCardBlock.js
  import { defineBlock } from '@raulbellosom/atlas-web-builder'

  export const ProductCardBlock = defineBlock({
    type:     'ProductCardBlock',
    label:    'Tarjeta de producto',
    category: 'atlas-ecommerce',
    defaultProps: { productId: '', showPrice: true, showDescription: true, showAddToCart: true },
    fields: {
      productId:      { type: 'text',   label: 'ID del producto' },
      showPrice:      { type: 'toggle', label: 'Mostrar precio' },
      showDescription:{ type: 'toggle', label: 'Mostrar descripcion' },
      showAddToCart:  { type: 'toggle', label: 'Boton agregar al carrito' },
    },
    render: ({ productId, showPrice, showDescription, showAddToCart, ctx }) => {
      const [product, setProduct] = ctx?.useState?.(null) ?? [null, () => {}]

      if (ctx?.useEffect && productId) {
        ctx.useEffect(() => {
          fetch(`/public/catalog/products?limit=100`)
            .then((r) => r.json())
            .then((d) => { const p = (d.data ?? []).find((x) => x.id === productId); if (p) setProduct(p) })
            .catch(() => {})
        }, [productId])
      }

      if (!productId || !product) {
        return (
          <div style={{ padding: '24px', background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '8px', textAlign: 'center' }}>
            <p style={{ color: '#94a3b8', fontSize: '14px' }}>Tarjeta de producto · configura el ID en las propiedades</p>
          </div>
        )
      }

      const addToCart = () => {
        const cart = JSON.parse(localStorage.getItem('atlas-cart') ?? '[]')
        const existing = cart.find((i) => i.productId === product.id)
        if (existing) { existing.qty += 1 } else { cart.push({ productId: product.id, name: product.name, price: Number(product.price), qty: 1 }) }
        localStorage.setItem('atlas-cart', JSON.stringify(cart))
        window.dispatchEvent(new Event('atlas-cart-updated'))
      }

      return (
        <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', maxWidth: '320px' }}>
          <div style={{ background: '#f1f5f9', height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '48px', color: '#94a3b8' }}>📦</span>
          </div>
          <div style={{ padding: '16px' }}>
            <p style={{ margin: '0 0 4px', fontWeight: 600, fontSize: '16px' }}>{product.name}</p>
            {showDescription && product.description && <p style={{ margin: '0 0 8px', fontSize: '14px', color: '#64748b' }}>{product.description}</p>}
            {showPrice && <p style={{ margin: '0 0 12px', fontSize: '18px', fontWeight: 700, color: 'var(--atlas-color-primary, #6D28D9)' }}>{product.currency} {Number(product.price).toFixed(2)}</p>}
            {showAddToCart && <button onClick={addToCart} style={{ width: '100%', padding: '10px', background: 'var(--atlas-color-primary, #6D28D9)', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }}>Agregar al carrito</button>}
          </div>
        </div>
      )
    },
  })
  ```

- [ ] **Step 3: Create cartBlock.js**

  ```js
  // apps/desktop/src/website/atlasBlocks/cartBlock.js
  import { defineBlock } from '@raulbellosom/atlas-web-builder'

  export const CartBlock = defineBlock({
    type:     'CartBlock',
    label:    'Carrito de compras',
    category: 'atlas-ecommerce',
    defaultProps: { checkoutEndpoint: '/public/website/checkout', siteId: '' },
    fields: {
      siteId: { type: 'text', label: 'ID del sitio (auto)' },
    },
    render: ({ checkoutEndpoint, siteId, ctx }) => {
      const [items, setItems] = ctx?.useState?.([]) ?? [[], () => {}]
      const [open,  setOpen]  = ctx?.useState?.(false) ?? [false, () => {}]

      if (ctx?.useEffect) {
        const sync = () => setItems(JSON.parse(localStorage.getItem('atlas-cart') ?? '[]'))
        ctx.useEffect(() => {
          sync()
          window.addEventListener('atlas-cart-updated', sync)
          return () => window.removeEventListener('atlas-cart-updated', sync)
        }, [])
      }

      const total = items.reduce((s, i) => s + i.price * i.qty, 0)

      const handleCheckout = async () => {
        try {
          const res = await fetch(checkoutEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Site-Id': siteId },
            body: JSON.stringify({ items }),
          })
          const data = await res.json()
          if (data.url) window.location.href = data.url
        } catch { /* no-op */ }
      }

      return (
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setOpen((v) => !v)}
            style={{ padding: '8px 16px', background: 'var(--atlas-color-primary, #6D28D9)', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            🛒 {items.length > 0 && <span style={{ background: '#fff', color: 'var(--atlas-color-primary, #6D28D9)', borderRadius: '999px', padding: '1px 6px', fontSize: '11px', fontWeight: 700 }}>{items.length}</span>}
          </button>

          {open && (
            <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: '8px', width: '300px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', boxShadow: '0 4px 16px rgba(0,0,0,0.1)', padding: '16px', zIndex: 50 }}>
              {items.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>El carrito esta vacio</p>
              ) : (
                <>
                  {items.map((item) => (
                    <div key={item.productId} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px' }}>
                      <span>{item.name} × {item.qty}</span>
                      <span>${(item.price * item.qty).toFixed(2)}</span>
                    </div>
                  ))}
                  <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '8px', marginTop: '8px', display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '14px' }}>
                    <span>Total</span><span>${total.toFixed(2)}</span>
                  </div>
                  <button onClick={handleCheckout} style={{ width: '100%', marginTop: '12px', padding: '10px', background: 'var(--atlas-color-primary, #6D28D9)', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }}>
                    Pagar
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )
    },
  })
  ```

- [ ] **Step 4: Verify syntax**

  ```bash
  node --check apps/desktop/src/website/atlasBlocks/productsGridBlock.js
  node --check apps/desktop/src/website/atlasBlocks/productCardBlock.js
  node --check apps/desktop/src/website/atlasBlocks/cartBlock.js
  ```

---

## Task 3 — Atlas block: BookingFormBlock

**Files:**
- Create: `apps/desktop/src/website/atlasBlocks/bookingFormBlock.js`

- [ ] **Step 1: Create bookingFormBlock.js**

  ```js
  // apps/desktop/src/website/atlasBlocks/bookingFormBlock.js
  import { defineBlock } from '@raulbellosom/atlas-web-builder'

  export const BookingFormBlock = defineBlock({
    type:     'BookingFormBlock',
    label:    'Formulario de reservacion',
    category: 'atlas-bookings',
    defaultProps: {
      calendarId:      '',
      serviceDuration: 60,
      successMessage:  'Reservacion solicitada. Te contactaremos para confirmar.',
      buttonLabel:     'Solicitar reservacion',
    },
    fields: {
      calendarId:      { type: 'text',   label: 'ID del calendario (atlas.calendar)' },
      serviceDuration: { type: 'number', label: 'Duracion del servicio (minutos)' },
      successMessage:  { type: 'text',   label: 'Mensaje de exito' },
      buttonLabel:     { type: 'text',   label: 'Texto del boton' },
    },
    render: ({ calendarId, serviceDuration, successMessage, buttonLabel }) => {
      if (!calendarId) {
        return (
          <div style={{ padding: '24px', background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '8px', textAlign: 'center' }}>
            <p style={{ color: '#94a3b8', fontSize: '14px' }}>Configura el ID del calendario en las propiedades del bloque</p>
          </div>
        )
      }

      const handleSubmit = async (e) => {
        e.preventDefault()
        const data = Object.fromEntries(new FormData(e.target))
        try {
          const res = await fetch('/public/website/bookings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...data, calendarId, serviceDuration }),
          })
          if (res.ok) {
            e.target.reset()
            alert(successMessage)
          }
        } catch { /* no-op */ }
      }

      return (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '480px' }}>
          <input name="name"  required placeholder="Nombre completo" style={{ padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '14px' }} />
          <input name="email" required type="email" placeholder="Email" style={{ padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '14px' }} />
          <input name="phone" placeholder="Telefono (opcional)" style={{ padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '14px' }} />
          <input name="date"  required type="date" style={{ padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '14px' }} />
          <input name="time"  required type="time" style={{ padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '14px' }} />
          <textarea name="notes" rows={3} placeholder="Notas adicionales" style={{ padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '14px', resize: 'vertical' }} />
          <button type="submit" style={{ padding: '10px 24px', background: 'var(--atlas-color-primary, #6D28D9)', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }}>
            {buttonLabel}
          </button>
        </form>
      )
    },
  })
  ```

- [ ] **Step 2: Verify syntax**

  ```bash
  node --check apps/desktop/src/website/atlasBlocks/bookingFormBlock.js
  ```

---

## Task 4 — Wire atlasBlocks into the editor

**Files:**
- Modify: `apps/desktop/src/modules/atlas.website/screens/WebsitePageEditorScreen.jsx`
- Modify: `apps/desktop/src/website/atlasBlocks/index.js`

- [ ] **Step 1: Update atlasBlocks/index.js to include all blocks**

  ```js
  // apps/desktop/src/website/atlasBlocks/index.js
  import { ContactFormBlock } from './contactFormBlock.js'
  import { BlogIndexBlock }   from './blogIndexBlock.js'
  import { ProductsGridBlock } from './productsGridBlock.js'
  import { ProductCardBlock }  from './productCardBlock.js'
  import { CartBlock }         from './cartBlock.js'
  import { BookingFormBlock }  from './bookingFormBlock.js'

  export const universalAtlasBlocks  = [ContactFormBlock, BlogIndexBlock]
  export const ecommerceAtlasBlocks  = [ProductsGridBlock, ProductCardBlock, CartBlock]
  export const bookingsAtlasBlocks   = [BookingFormBlock]

  export function buildAtlasBlocks(siteType) {
    const blocks = [...universalAtlasBlocks]
    if (siteType === 'ecommerce') blocks.push(...ecommerceAtlasBlocks)
    if (siteType === 'bookings')  blocks.push(...bookingsAtlasBlocks)
    return blocks
  }
  ```

- [ ] **Step 2: Update WebsitePageEditorScreen.jsx to pass atlasBlocks**

  In `WebsitePageEditorScreen.jsx`, add the import:
  ```js
  import { buildAtlasBlocks } from '../../../website/atlasBlocks/index.js'
  ```

  Then fetch the site to know its `site_type` (it's already loaded in `siteQuery`). Replace the `blocks={baseBlocks}` prop with:
  ```jsx
  blocks={[...baseBlocks, ...buildAtlasBlocks(siteQuery.data?.data?.site_type ?? 'informational')]}
  ```

  Also add the `resources` prop for ecommerce:
  ```jsx
  resources={
    siteQuery.data?.data?.site_type === 'ecommerce'
      ? {
          products: async ({ categoryId, limit }) => {
            const url = `${getApiUrl()}/catalog/products?limit=${limit ?? 20}${categoryId ? `&categoryId=${categoryId}` : ''}`
            const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
            const data = await res.json()
            return data.data ?? []
          },
        }
      : undefined
  }
  ```

- [ ] **Step 3: Verify syntax**

  ```bash
  node --check apps/desktop/src/website/atlasBlocks/index.js
  node --check apps/desktop/src/modules/atlas.website/screens/WebsitePageEditorScreen.jsx
  ```

---

## Task 5 — Public API: form submissions + blog posts

**Files:**
- Create: `apps/api/src/routes/website/forms-public-routes.js`
- Modify: `apps/api/src/routes/public-website.js`

- [ ] **Step 1: Create forms-public-routes.js**

  ```js
  // apps/api/src/routes/website/forms-public-routes.js
  import { Hono } from 'hono'
  import { createSmtpService } from '../../services/smtp-service.js'

  export function createPublicFormsRouter({ prisma }) {
    const app = new Hono()

    app.post('/forms/:formId/submit', async (c) => {
      const { formId } = c.req.param()
      const body = await c.req.json().catch(() => ({}))

      try {
        const forms = await prisma.$queryRaw`
          SELECT id, notification_email, fields, site_id, company_id
          FROM website_form
          WHERE id = ${formId}::uuid AND enabled = true
          LIMIT 1
        `
        const form = forms[0]
        if (!form) return c.json({ error: 'Form not found' }, 404)

        await prisma.$queryRaw`
          INSERT INTO website_form_submission (form_id, company_id, data)
          VALUES (${form.id}::uuid, ${form.company_id}::uuid, ${JSON.stringify(body)}::jsonb)
        `

        if (form.notification_email) {
          try {
            const smtpSvc = createSmtpService({ prisma })
            const rows = Object.entries(body).map(([k, v]) => `<tr><td><b>${k}</b></td><td>${v}</td></tr>`).join('')
            await smtpSvc.sendEmail({
              to:      form.notification_email,
              subject: 'Nuevo mensaje del formulario de contacto',
              html:    `<p>Nuevo envio del formulario.</p><table border="1" cellpadding="8">${rows}</table>`,
              text:    Object.entries(body).map(([k, v]) => `${k}: ${v}`).join('\n'),
            })
          } catch { /* SMTP not configured or error — submission saved anyway */ }
        }

        return c.json({ ok: true })
      } catch (err) {
        if (err?.message?.includes('does not exist') || err?.code === '42P01') return c.json({ error: 'Form not found' }, 404)
        console.error('[public/website/forms/submit]', err?.message)
        return c.json({ error: 'Internal error' }, 500)
      }
    })

    return app
  }
  ```

- [ ] **Step 2: Add blog and forms endpoints to public-website.js**

  In `apps/api/src/routes/public-website.js`, in `createPublicWebsiteRouter`, add two new route handlers:

  ```js
  // Blog endpoint
  app.get('/blog', async (c) => {
    try {
      const { siteId, limit = '10', offset = '0' } = c.req.query()
      if (!siteId) return c.json({ data: [] })
      const rows = await prisma.$queryRaw`
        SELECT id, title, slug, excerpt, cover_asset_id, updated_at
        FROM website_page
        WHERE site_id = ${siteId}::uuid
          AND page_type = 'blog_post'
          AND status = 'published'
          AND enabled = true
        ORDER BY updated_at DESC
        LIMIT ${Number(limit)} OFFSET ${Number(offset)}
      `
      return c.json({ data: rows })
    } catch (err) {
      if (err?.message?.includes('does not exist') || err?.code === '42P01') return c.json({ data: [] })
      return c.json({ data: [] }, 500)
    }
  })
  ```

  And mount the public forms router:
  ```js
  import { createPublicFormsRouter } from '../routes/website/forms-public-routes.js'
  // ...
  const publicFormsRouter = createPublicFormsRouter({ prisma })
  app.route('/public/website', publicFormsRouter)
  ```

- [ ] **Step 3: Verify syntax**

  ```bash
  node --check apps/api/src/routes/website/forms-public-routes.js
  node --check apps/api/src/routes/public-website.js
  ```

---

## Task 6 — Public API: bookings (atlas.calendar integration)

**Files:**
- Create: `apps/api/src/routes/website/bookings-routes.js`

- [ ] **Step 1: Create bookings-routes.js**

  ```js
  // apps/api/src/routes/website/bookings-routes.js
  import { Hono } from 'hono'

  export function createPublicBookingsRouter({ prisma }) {
    const app = new Hono()

    app.post('/bookings', async (c) => {
      const body = await c.req.json().catch(() => ({}))
      const { name, email, phone, date, time, notes, calendarId, serviceDuration } = body

      if (!calendarId || !name || !email || !date || !time) {
        return c.json({ error: 'Missing required fields' }, 400)
      }

      try {
        const startAt = new Date(`${date}T${time}:00.000Z`)
        const endAt   = new Date(startAt.getTime() + (Number(serviceDuration) || 60) * 60_000)

        const title = `Reservacion: ${name}`
        const desc  = `Email: ${email}${phone ? ` | Tel: ${phone}` : ''}${notes ? `\n${notes}` : ''}`

        await prisma.$queryRaw`
          INSERT INTO calendar_event
            (calendar_id, title, description, start_at, end_at, status, source)
          VALUES (
            ${calendarId}::uuid,
            ${title},
            ${desc},
            ${startAt},
            ${endAt},
            'pending',
            'website'
          )
        `

        return c.json({ ok: true })
      } catch (err) {
        if (err?.message?.includes('does not exist') || err?.code === '42P01') {
          return c.json({ error: 'Calendar not available' }, 503)
        }
        console.error('[public/website/bookings]', err?.message)
        return c.json({ error: 'Internal error' }, 500)
      }
    })

    return app
  }
  ```

  Note: The `calendar_event` table is from `atlas.calendar`. The column names may differ — check the actual model in the calendar module and adjust accordingly.

- [ ] **Step 2: Mount in public-website.js**

  ```js
  import { createPublicBookingsRouter } from '../routes/website/bookings-routes.js'
  // ...
  const publicBookingsRouter = createPublicBookingsRouter({ prisma })
  app.route('/public/website', publicBookingsRouter)
  ```

- [ ] **Step 3: Verify syntax**

  ```bash
  node --check apps/api/src/routes/website/bookings-routes.js
  ```

---

## Task 7 — Stripe: payments screen + checkout API

**Files:**
- Create: `apps/desktop/src/modules/atlas.website/screens/WebsitePaymentsScreen.jsx`
- Create: `apps/api/src/routes/website/checkout-routes.js`

- [ ] **Step 1: Install Stripe server-side package**

  ```bash
  pnpm --filter @atlas/api add stripe
  ```

- [ ] **Step 2: Create checkout-routes.js**

  ```js
  // apps/api/src/routes/website/checkout-routes.js
  import { Hono } from 'hono'
  import Stripe from 'stripe'
  import { createCryptoHelpers } from '../../services/smtp-service.js'

  // Reuse decryptPassword from smtp-service — it uses the same AES-256-GCM approach
  import { decryptPassword } from '../../services/smtp-service.js'

  export function createPublicCheckoutRouter({ prisma }) {
    const app = new Hono()

    app.post('/checkout', async (c) => {
      const siteId = c.req.header('X-Site-Id')
      const { items } = await c.req.json().catch(() => ({}))

      if (!siteId || !items?.length) return c.json({ error: 'Missing siteId or items' }, 400)

      try {
        const sites = await prisma.$queryRaw`
          SELECT stripe_publishable_key, stripe_secret_key, stripe_currency, stripe_success_message
          FROM website_site
          WHERE id = ${siteId}::uuid AND enabled = true
          LIMIT 1
        `
        const site = sites[0]
        if (!site?.stripe_secret_key) return c.json({ error: 'Stripe not configured' }, 400)

        const secretKey = decryptPassword(site.stripe_secret_key)
        const stripe    = new Stripe(secretKey, { apiVersion: '2024-12-18.acacia' })

        const lineItems = items.map((item) => ({
          price_data: {
            currency:     (site.stripe_currency ?? 'usd').toLowerCase(),
            product_data: { name: item.name },
            unit_amount:  Math.round(item.price * 100),
          },
          quantity: item.qty,
        }))

        const session = await stripe.checkout.sessions.create({
          mode:        'payment',
          line_items:  lineItems,
          success_url: `${c.req.header('Origin') ?? ''}/gracias?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url:  `${c.req.header('Origin') ?? ''}/`,
        })

        return c.json({ url: session.url })
      } catch (err) {
        console.error('[public/website/checkout]', err?.message)
        return c.json({ error: err.message }, 500)
      }
    })

    return app
  }
  ```

- [ ] **Step 3: Mount checkout router in public-website.js**

  ```js
  import { createPublicCheckoutRouter } from '../routes/website/checkout-routes.js'
  // ...
  const publicCheckoutRouter = createPublicCheckoutRouter({ prisma })
  app.route('/public/website', publicCheckoutRouter)
  ```

- [ ] **Step 4: Create WebsitePaymentsScreen.jsx**

  ```jsx
  // apps/desktop/src/modules/atlas.website/screens/WebsitePaymentsScreen.jsx
  import { useState, useEffect } from 'react'
  import { useNavigate } from 'react-router-dom'
  import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
  import { useAuth } from '../../../auth/AuthProvider.jsx'
  import { getApiUrl } from '../../../lib/runtimeConfig.js'
  import { Button, Input, Label } from '@atlas/ui'
  import { toast } from 'sonner'

  async function apiFetch(path, token, options = {}) {
    const res = await fetch(`${getApiUrl()}${path}`, {
      ...options,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...options.headers },
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || `HTTP ${res.status}`)
    }
    return res.json()
  }

  export default function WebsitePaymentsScreen() {
    const navigate  = useNavigate()
    const { session } = useAuth()
    const token = session?.access_token
    const queryClient = useQueryClient()

    const [form, setForm] = useState({ publishable_key: '', secret_key: '', currency: 'usd', success_message: '' })
    const [keyChanged, setKeyChanged] = useState(false)

    const siteQuery = useQuery({
      queryKey: ['website-site', token],
      queryFn: () => apiFetch('/website/site', token),
      enabled: Boolean(token),
      staleTime: 60_000,
    })

    const site = siteQuery.data?.data ?? null

    useEffect(() => {
      if (!site) return
      if (site.site_type !== 'ecommerce') { navigate('/app/m/atlas.website'); return }
      setForm({
        publishable_key: site.stripe_publishable_key ?? '',
        secret_key:      '',
        currency:        site.stripe_currency ?? 'usd',
        success_message: site.stripe_success_message ?? '',
      })
    }, [site, navigate])

    const saveMutation = useMutation({
      mutationFn: (data) => apiFetch(`/website/site/${site.id}`, token, { method: 'PATCH', body: JSON.stringify(data) }),
      onSuccess: () => {
        toast.success('Configuracion de pagos guardada')
        queryClient.invalidateQueries({ queryKey: ['website-site'] })
        setKeyChanged(false)
      },
      onError: (err) => toast.error(err.message),
    })

    function handleSubmit(e) {
      e.preventDefault()
      const payload = {
        stripe_publishable_key: form.publishable_key,
        stripe_currency:        form.currency,
        stripe_success_message: form.success_message,
      }
      if (keyChanged && form.secret_key) payload.stripe_secret_key = form.secret_key
      saveMutation.mutate(payload)
    }

    if (siteQuery.isPending) return <div className="p-8 text-sm text-[hsl(var(--muted-foreground))]">Cargando...</div>

    return (
      <div className="p-8 max-w-lg space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-[hsl(var(--foreground))]">Pagos con Stripe</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">Conecta tu cuenta de Stripe para aceptar pagos en tu tienda.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="pk">Publishable Key</Label>
            <Input id="pk" placeholder="pk_live_..." value={form.publishable_key} onChange={(e) => setForm((f) => ({ ...f, publishable_key: e.target.value }))} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="sk">
              Secret Key {site?.stripe_publishable_key && !keyChanged && <span className="text-[hsl(var(--muted-foreground))] font-normal">(dejar en blanco para mantener)</span>}
            </Label>
            <Input
              id="sk"
              type="password"
              placeholder={site?.stripe_publishable_key ? '••••••••' : 'sk_live_...'}
              value={form.secret_key}
              onChange={(e) => { setForm((f) => ({ ...f, secret_key: e.target.value })); setKeyChanged(true) }}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="currency">Moneda (codigo ISO)</Label>
            <Input id="currency" placeholder="usd" maxLength={3} value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value.toLowerCase() }))} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="success-msg">Mensaje post-pago</Label>
            <Input id="success-msg" placeholder="Gracias por tu compra" value={form.success_message} onChange={(e) => setForm((f) => ({ ...f, success_message: e.target.value }))} />
          </div>
          <Button type="submit" className="w-full" disabled={saveMutation.isPending}>
            {saveMutation.isPending ? 'Guardando...' : 'Guardar configuracion'}
          </Button>
        </form>
      </div>
    )
  }
  ```

- [ ] **Step 5: Register WebsitePaymentsScreen in ModuleOutlet**

  In `apps/desktop/src/app/ModuleOutlet.jsx`, add to the screen map:
  ```js
  'atlas.website/payments': () => import('../modules/atlas.website/screens/WebsitePaymentsScreen.jsx'),
  ```

- [ ] **Step 6: Verify syntax**

  ```bash
  node --check apps/api/src/routes/website/checkout-routes.js
  node --check apps/desktop/src/modules/atlas.website/screens/WebsitePaymentsScreen.jsx
  ```

---

## Task 8 — Blog admin screen: filter by page_type

The existing `WebsiteBlogScreen.jsx` lists blog posts. Verify it filters by `page_type = 'blog_post'`.

- [ ] **Step 1: Read WebsiteBlogScreen.jsx**

  Open `apps/desktop/src/modules/atlas.website/screens/WebsiteBlogScreen.jsx` and check whether `GET /website/pages` accepts a `page_type` query param.

- [ ] **Step 2: Add page_type filter to pages API if missing**

  In `apps/api/src/routes/website/pages-routes.js`, ensure `GET /website/pages` handles a `page_type` query param:

  In the service `listPages` function (in `website-service.js`):
  ```js
  async function listPages({ companyId, siteId, pageType }) {
    return prisma.$queryRaw`
      SELECT id, title, slug, page_type, status, excerpt, created_at, updated_at
      FROM website_page
      WHERE company_id = ${companyId}::uuid
        AND site_id    = ${siteId}::uuid
        AND enabled    = true
        ${pageType ? prisma.$raw`AND page_type = ${pageType}` : prisma.$raw``}
      ORDER BY created_at DESC
    `
  }
  ```

  In the route handler, pass `pageType: c.req.query('page_type')`.

- [ ] **Step 3: Update WebsiteBlogScreen.jsx query to pass page_type=blog_post**

  In `WebsiteBlogScreen.jsx`, update the pages query URL to include `&page_type=blog_post`:
  ```js
  queryFn: () => apiGet(`/website/pages?siteId=${siteId}&page_type=blog_post`, token),
  ```

- [ ] **Step 4: Update "Nuevo post" button to set page_type**

  When creating a new post from `WebsiteBlogScreen`, the `POST /website/pages` call must include `page_type: 'blog_post'`. Ensure `WebsiteNewPageDialog.jsx` passes `page_type` or the blog screen sets it directly.

---

## Task 9 — Forms admin screen: add submissions panel

- [ ] **Step 1: Read WebsiteFormsScreen.jsx current state**

  Open `apps/desktop/src/modules/atlas.website/screens/WebsiteFormsScreen.jsx`. Understand the current structure.

- [ ] **Step 2: Add `website_form` fields to the API if missing**

  In the website service, ensure `createForm` and `listForms` work with `website_form` (the new model from Plan A migration). The form models must be defined in the AME3 module. If the website module was uninstalled + reinstalled, the new models should include `website_form` and `website_form_submission`. If not, add them to the module manifest's `models` array and re-sync.

- [ ] **Step 3: Add submissions view to WebsiteFormsScreen.jsx**

  In `WebsiteFormsScreen.jsx`, add a `selectedFormId` state. When a form row is clicked, show a panel on the right (or a drawer) that:
  1. Fetches `GET /website/forms/:formId/submissions`
  2. Lists submissions in a table with columns: Fecha, Datos (JSON stringified), Leido
  3. Each row has a toggle to mark as read

  Add the endpoint in `forms-routes.js`:
  ```js
  app.get('/website/forms/:formId/submissions', requirePermission('website.pages.read'), async (c) => {
    const companyId = c.get('companyId')
    const { formId } = c.req.param()
    const rows = await prisma.$queryRaw`
      SELECT id, data, read, created_at
      FROM website_form_submission
      WHERE form_id = ${formId}::uuid AND company_id = ${companyId}::uuid
      ORDER BY created_at DESC
      LIMIT 100
    `
    return c.json({ data: rows })
  })

  app.patch('/website/forms/submissions/:id/read', requirePermission('website.pages.read'), async (c) => {
    const companyId = c.get('companyId')
    const { id } = c.req.param()
    await prisma.$queryRaw`
      UPDATE website_form_submission SET read = true
      WHERE id = ${id}::uuid AND company_id = ${companyId}::uuid
    `
    return c.json({ ok: true })
  })
  ```

---

## Task 10 — End-to-end smoke test

- [ ] **Step 1: Start all dev servers**

  ```bash
  pnpm dev
  ```

- [ ] **Step 2: Test ContactFormBlock**

  - Create a form in `/app/m/atlas.website/forms`
  - Open a page in the editor, add a `ContactFormBlock`, set the `formId`
  - Publish the page
  - Visit the public page, fill and submit the form
  - Confirm submission appears in the admin forms screen

- [ ] **Step 3: Test BlogIndexBlock**

  - Create a page with `page_type = blog_post` in `/app/m/atlas.website/blog`
  - Publish it
  - Add a `BlogIndexBlock` to the home page, publish
  - Verify the blog post card appears on the public home

- [ ] **Step 4: Test ecommerce (if atlas.catalog installed and site_type = ecommerce)**

  - Create a product in `/app/m/atlas.catalog`
  - Add `ProductsGridBlock` to a page, publish
  - Verify product appears on the public page
  - Click "Agregar al carrito", verify cart icon updates

- [ ] **Step 5: Commit**

  ```bash
  git add apps/desktop/src/website/atlasBlocks/ \
          apps/desktop/src/modules/atlas.website/screens/WebsitePaymentsScreen.jsx \
          apps/desktop/src/modules/atlas.website/screens/WebsitePageEditorScreen.jsx \
          apps/desktop/src/modules/atlas.website/screens/WebsiteBlogScreen.jsx \
          apps/desktop/src/modules/atlas.website/screens/WebsiteFormsScreen.jsx \
          apps/api/src/routes/website/forms-public-routes.js \
          apps/api/src/routes/website/bookings-routes.js \
          apps/api/src/routes/website/checkout-routes.js \
          apps/api/src/routes/public-website.js \
          apps/desktop/src/app/ModuleOutlet.jsx
  git commit -m "feat(website): add dynamic blocks, blog, forms submissions, bookings, Stripe checkout"
  ```
