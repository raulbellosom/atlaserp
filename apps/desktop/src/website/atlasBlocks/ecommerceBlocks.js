const F = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"

const cardHover = `<style>.atlas-product-card{transition:transform 0.25s ease,box-shadow 0.25s ease}.atlas-product-card:hover{transform:translateY(-4px);box-shadow:0 12px 40px rgba(0,0,0,0.12)}.atlas-product-btn{transition:background 0.2s}.atlas-product-btn:hover{background:#3730a3 !important}</style>`

export const ecommerceBlocks = [
  {
    id: 'product-featured',
    label: 'Producto destacado',
    category: 'Comercio',
    content: `<section style="padding:80px 24px;background:white;${F}">
  <div style="max-width:1000px;margin:0 auto;display:grid;grid-template-columns:1fr 1fr;gap:64px;align-items:center">
    <div style="border-radius:24px;overflow:hidden;background:#f1f5f9;aspect-ratio:1">
      <img src="https://placehold.co/600x600/e2e8f0/94a3b8?text=Producto+destacado" alt="Producto" style="width:100%;height:100%;object-fit:cover;display:block">
    </div>
    <div>
      <span style="display:inline-block;background:#fef3c7;color:#92400e;font-size:12px;font-weight:700;padding:4px 14px;border-radius:999px;margin-bottom:18px;letter-spacing:0.05em">Mas vendido</span>
      <h2 style="font-size:clamp(24px,3.5vw,40px);font-weight:800;color:#0f172a;margin:0 0 12px;line-height:1.15;letter-spacing:-0.025em">Nombre del producto aqui</h2>
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px">
        <span style="color:#f59e0b;font-size:16px;letter-spacing:2px">&#9733;&#9733;&#9733;&#9733;&#9733;</span>
        <span style="font-size:13px;color:#64748b">(128 resenas)</span>
      </div>
      <p style="font-size:16px;color:#64748b;line-height:1.8;margin:0 0 24px">Descripcion detallada del producto. Explica sus caracteristicas principales, materiales, beneficios y por que es la mejor opcion para tu cliente.</p>
      <div style="display:flex;align-items:baseline;gap:12px;margin-bottom:32px">
        <span style="font-size:40px;font-weight:900;color:#0f172a;letter-spacing:-0.04em">$199</span>
        <span style="font-size:18px;color:#94a3b8;text-decoration:line-through">$249</span>
        <span style="background:#dcfce7;color:#166534;font-size:13px;font-weight:700;padding:3px 10px;border-radius:999px">-20%</span>
      </div>
      <div style="display:flex;gap:12px;flex-wrap:wrap">
        <button style="flex:1;min-width:160px;background:#4f46e5;color:white;font-size:15px;font-weight:700;padding:15px 24px;border:none;border-radius:12px;cursor:pointer">Agregar al carrito</button>
        <button style="background:#f1f5f9;color:#0f172a;font-size:15px;font-weight:600;padding:15px 20px;border:none;border-radius:12px;cursor:pointer">Ver detalles</button>
      </div>
    </div>
  </div>
</section>`,
  },
  {
    id: 'product-grid-3',
    label: 'Productos (3 tarjetas)',
    category: 'Comercio',
    content: `${cardHover}
<section style="padding:80px 24px;background:#f8fafc;${F}">
  <div style="max-width:1100px;margin:0 auto">
    <div style="text-align:center;margin-bottom:56px">
      <h2 style="font-size:clamp(26px,4vw,44px);font-weight:800;color:#0f172a;margin:0 0 12px;letter-spacing:-0.025em">Productos destacados</h2>
      <p style="font-size:17px;color:#64748b;margin:0">Una seleccion de nuestros articulos mas populares.</p>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:24px">
      <div class="atlas-product-card" style="background:white;border-radius:20px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.05)">
        <div style="aspect-ratio:4/3;overflow:hidden;background:#f1f5f9">
          <img src="https://placehold.co/400x300/ddd6fe/7c3aed?text=Producto+1" alt="P1" style="width:100%;height:100%;object-fit:cover;display:block;transition:transform 0.4s ease">
        </div>
        <div style="padding:24px">
          <span style="font-size:12px;color:#6366f1;font-weight:600;letter-spacing:0.08em;text-transform:uppercase">Categoria</span>
          <h3 style="font-size:18px;font-weight:700;color:#0f172a;margin:6px 0 8px">Nombre del producto</h3>
          <p style="font-size:14px;color:#64748b;line-height:1.6;margin:0 0 18px">Descripcion breve del producto y sus caracteristicas principales.</p>
          <div style="display:flex;align-items:center;justify-content:space-between">
            <span style="font-size:24px;font-weight:800;color:#0f172a;letter-spacing:-0.03em">$89</span>
            <button class="atlas-product-btn" style="background:#4f46e5;color:white;font-size:14px;font-weight:600;padding:9px 20px;border:none;border-radius:8px;cursor:pointer">Comprar</button>
          </div>
        </div>
      </div>
      <div class="atlas-product-card" style="background:white;border-radius:20px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.05)">
        <div style="aspect-ratio:4/3;overflow:hidden;background:#f1f5f9">
          <img src="https://placehold.co/400x300/bbf7d0/059669?text=Producto+2" alt="P2" style="width:100%;height:100%;object-fit:cover;display:block;transition:transform 0.4s ease">
        </div>
        <div style="padding:24px">
          <span style="font-size:12px;color:#059669;font-weight:600;letter-spacing:0.08em;text-transform:uppercase">Categoria</span>
          <h3 style="font-size:18px;font-weight:700;color:#0f172a;margin:6px 0 8px">Otro producto</h3>
          <p style="font-size:14px;color:#64748b;line-height:1.6;margin:0 0 18px">Descripcion breve del producto y sus caracteristicas principales.</p>
          <div style="display:flex;align-items:center;justify-content:space-between">
            <span style="font-size:24px;font-weight:800;color:#0f172a;letter-spacing:-0.03em">$129</span>
            <button class="atlas-product-btn" style="background:#4f46e5;color:white;font-size:14px;font-weight:600;padding:9px 20px;border:none;border-radius:8px;cursor:pointer">Comprar</button>
          </div>
        </div>
      </div>
      <div class="atlas-product-card" style="background:white;border-radius:20px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.05)">
        <div style="aspect-ratio:4/3;overflow:hidden;background:#f1f5f9;position:relative">
          <img src="https://placehold.co/400x300/fed7aa/ea580c?text=Producto+3" alt="P3" style="width:100%;height:100%;object-fit:cover;display:block;transition:transform 0.4s ease">
          <div style="position:absolute;top:12px;left:12px;background:#ef4444;color:white;font-size:11px;font-weight:700;padding:3px 10px;border-radius:999px">NUEVO</div>
        </div>
        <div style="padding:24px">
          <span style="font-size:12px;color:#ea580c;font-weight:600;letter-spacing:0.08em;text-transform:uppercase">Categoria</span>
          <h3 style="font-size:18px;font-weight:700;color:#0f172a;margin:6px 0 8px">Producto nuevo</h3>
          <p style="font-size:14px;color:#64748b;line-height:1.6;margin:0 0 18px">Descripcion breve del producto y sus caracteristicas principales.</p>
          <div style="display:flex;align-items:center;justify-content:space-between">
            <span style="font-size:24px;font-weight:800;color:#0f172a;letter-spacing:-0.03em">$59</span>
            <button class="atlas-product-btn" style="background:#4f46e5;color:white;font-size:14px;font-weight:600;padding:9px 20px;border:none;border-radius:8px;cursor:pointer">Comprar</button>
          </div>
        </div>
      </div>
    </div>
    <div style="text-align:center;margin-top:40px">
      <a href="#" style="display:inline-block;background:white;color:#0f172a;font-size:15px;font-weight:600;padding:14px 36px;border-radius:12px;text-decoration:none;border:2px solid #e2e8f0">Ver todo el catalogo</a>
    </div>
  </div>
</section>`,
  },
  {
    id: 'category-cards',
    label: 'Categorias de productos',
    category: 'Comercio',
    content: `<style>.atlas-cat-card{position:relative;border-radius:20px;overflow:hidden;cursor:pointer;transition:transform 0.3s ease}.atlas-cat-card:hover{transform:scale(1.02)}.atlas-cat-card img{width:100%;height:100%;object-fit:cover;display:block;transition:transform 0.5s ease}.atlas-cat-card:hover img{transform:scale(1.08)}</style>
<section style="padding:80px 24px;background:white;${F}">
  <div style="max-width:1100px;margin:0 auto">
    <div style="text-align:center;margin-bottom:52px">
      <h2 style="font-size:clamp(26px,4vw,44px);font-weight:800;color:#0f172a;margin:0 0 12px;letter-spacing:-0.025em">Explora por categoria</h2>
      <p style="font-size:17px;color:#64748b;margin:0">Encuentra exactamente lo que buscas.</p>
    </div>
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:16px">
      <div class="atlas-cat-card" style="aspect-ratio:16/9">
        <img src="https://placehold.co/700x400/312e81/a5b4fc?text=Categoria+1" alt="Cat 1">
        <div style="position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,0.65),rgba(0,0,0,0.1));display:flex;align-items:flex-end;padding:24px">
          <div><h3 style="font-size:22px;font-weight:800;color:white;margin:0 0 4px">Categoria uno</h3><span style="font-size:13px;color:rgba(255,255,255,0.75)">48 productos</span></div>
        </div>
      </div>
      <div class="atlas-cat-card" style="aspect-ratio:16/9">
        <img src="https://placehold.co/700x400/064e3b/6ee7b7?text=Categoria+2" alt="Cat 2">
        <div style="position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,0.65),rgba(0,0,0,0.1));display:flex;align-items:flex-end;padding:24px">
          <div><h3 style="font-size:22px;font-weight:800;color:white;margin:0 0 4px">Categoria dos</h3><span style="font-size:13px;color:rgba(255,255,255,0.75)">32 productos</span></div>
        </div>
      </div>
      <div class="atlas-cat-card" style="aspect-ratio:16/9">
        <img src="https://placehold.co/700x400/7c2d12/fca5a5?text=Categoria+3" alt="Cat 3">
        <div style="position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,0.65),rgba(0,0,0,0.1));display:flex;align-items:flex-end;padding:24px">
          <div><h3 style="font-size:22px;font-weight:800;color:white;margin:0 0 4px">Categoria tres</h3><span style="font-size:13px;color:rgba(255,255,255,0.75)">56 productos</span></div>
        </div>
      </div>
      <div class="atlas-cat-card" style="aspect-ratio:16/9">
        <img src="https://placehold.co/700x400/1e3a5f/93c5fd?text=Categoria+4" alt="Cat 4">
        <div style="position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,0.65),rgba(0,0,0,0.1));display:flex;align-items:flex-end;padding:24px">
          <div><h3 style="font-size:22px;font-weight:800;color:white;margin:0 0 4px">Categoria cuatro</h3><span style="font-size:13px;color:rgba(255,255,255,0.75)">21 productos</span></div>
        </div>
      </div>
    </div>
  </div>
</section>`,
  },
  {
    id: 'promo-banner',
    label: 'Banner promocional',
    category: 'Comercio',
    content: `<section style="padding:0 24px;background:white;${F}">
  <div style="max-width:1100px;margin:0 auto">
    <div style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);border-radius:24px;padding:48px 56px;display:flex;align-items:center;justify-content:space-between;gap:32px;flex-wrap:wrap">
      <div>
        <div style="display:inline-block;background:linear-gradient(135deg,#f59e0b,#ef4444);color:white;font-size:12px;font-weight:800;padding:4px 14px;border-radius:999px;margin-bottom:14px;letter-spacing:0.08em;text-transform:uppercase">Oferta especial</div>
        <h2 style="font-size:clamp(24px,3.5vw,40px);font-weight:900;color:white;margin:0 0 8px;line-height:1.15;letter-spacing:-0.03em">30% de descuento<br>en tu primer pedido</h2>
        <p style="font-size:15px;color:#94a3b8;margin:0">Usa el codigo <strong style="color:#fbbf24">BIENVENIDO30</strong> al finalizar tu compra.</p>
      </div>
      <div style="text-align:center">
        <div style="background:rgba(255,255,255,0.05);border:2px solid rgba(255,255,255,0.1);border-radius:16px;padding:20px 28px;margin-bottom:20px">
          <p style="font-size:12px;color:#94a3b8;margin:0 0 4px;text-transform:uppercase;letter-spacing:0.1em">Codigo</p>
          <p style="font-size:28px;font-weight:900;color:#fbbf24;margin:0;letter-spacing:0.1em">BIENVENIDO30</p>
        </div>
        <a href="#" style="display:inline-block;background:linear-gradient(135deg,#f59e0b,#ef4444);color:white;font-size:16px;font-weight:700;padding:14px 36px;border-radius:12px;text-decoration:none">Comprar ahora</a>
      </div>
    </div>
  </div>
</section>`,
  },
  {
    id: 'trust-badges',
    label: 'Sellos de confianza',
    category: 'Comercio',
    content: `<section style="padding:40px 24px;background:white;border-top:1px solid #f1f5f9;${F}">
  <div style="max-width:900px;margin:0 auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:24px">
    <div style="display:flex;flex-direction:column;align-items:center;gap:10px;text-align:center">
      <div style="width:48px;height:48px;background:#dcfce7;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:22px">&#128666;</div>
      <div><p style="font-weight:700;color:#0f172a;font-size:14px;margin:0 0 2px">Envio gratis</p><p style="color:#64748b;font-size:13px;margin:0">En pedidos +$50</p></div>
    </div>
    <div style="display:flex;flex-direction:column;align-items:center;gap:10px;text-align:center">
      <div style="width:48px;height:48px;background:#dbeafe;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:22px">&#128260;</div>
      <div><p style="font-weight:700;color:#0f172a;font-size:14px;margin:0 0 2px">Devolucion facil</p><p style="color:#64748b;font-size:13px;margin:0">30 dias sin preguntas</p></div>
    </div>
    <div style="display:flex;flex-direction:column;align-items:center;gap:10px;text-align:center">
      <div style="width:48px;height:48px;background:#fef3c7;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:22px">&#128274;</div>
      <div><p style="font-weight:700;color:#0f172a;font-size:14px;margin:0 0 2px">Pago seguro</p><p style="color:#64748b;font-size:13px;margin:0">Cifrado SSL</p></div>
    </div>
    <div style="display:flex;flex-direction:column;align-items:center;gap:10px;text-align:center">
      <div style="width:48px;height:48px;background:#fce7f3;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:22px">&#128222;</div>
      <div><p style="font-weight:700;color:#0f172a;font-size:14px;margin:0 0 2px">Soporte 24/7</p><p style="color:#64748b;font-size:13px;margin:0">Siempre disponibles</p></div>
    </div>
  </div>
</section>`,
  },
]
