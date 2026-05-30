const FS = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"

export const templateEcommerce = {
  id: 'ecommerce',
  label: 'Tienda en linea',
  category: 'comercio',
  description: 'Para tiendas y comercio electronico. Productos, categorias y carrito.',
  color: '#0369a1',
  pages: [
    {
      id: 'home',
      label: 'Inicio',
      routePath: '/',
      title: 'Inicio',
      required: true,
      css: '',
      html: `
<!-- NAV -->
<nav style="background:white;border-bottom:1px solid #f1f5f9;padding:0 40px;height:68px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100;${FS}">
  <span style="font-size:22px;font-weight:900;color:#0f172a;letter-spacing:-0.03em">TiendaOnline</span>
  <div style="display:flex;gap:28px;align-items:center">
    <a href="#categorias" style="color:#374151;text-decoration:none;font-size:14px;font-weight:500">Categorias</a>
    <a href="#productos" style="color:#374151;text-decoration:none;font-size:14px;font-weight:500">Productos</a>
    <a href="/nosotros" style="color:#374151;text-decoration:none;font-size:14px;font-weight:500">Nosotros</a>
    <a href="/acceso" style="color:#374151;text-decoration:none;font-size:14px;font-weight:500">Iniciar sesion</a>
    <a href="/productos" style="background:#0369a1;color:white;text-decoration:none;font-size:14px;font-weight:600;padding:9px 22px;border-radius:8px">Ver tienda</a>
  </div>
</nav>

<!-- HERO -->
<section style="background:linear-gradient(135deg,#0c4a6e 0%,#0369a1 50%,#0284c7 100%);padding:80px 24px;overflow:hidden;${FS}">
  <div style="max-width:1100px;margin:0 auto;display:grid;grid-template-columns:1fr 1fr;gap:60px;align-items:center">
    <div>
      <span style="display:inline-block;background:rgba(255,255,255,0.15);color:white;font-size:12px;font-weight:700;padding:5px 16px;border-radius:999px;margin-bottom:20px;letter-spacing:0.1em;text-transform:uppercase">Coleccion 2025</span>
      <h1 style="font-size:clamp(34px,5vw,58px);font-weight:900;color:white;line-height:1.1;margin:0 0 20px;letter-spacing:-0.03em">Los mejores productos al mejor precio</h1>
      <p style="font-size:17px;color:rgba(255,255,255,0.82);line-height:1.7;margin:0 0 36px">Descubre nuestra coleccion con envio gratis en pedidos mayores a $50.</p>
      <div style="display:flex;gap:14px;flex-wrap:wrap">
        <a href="/productos" style="background:white;color:#0369a1;font-size:16px;font-weight:700;padding:14px 36px;border-radius:10px;text-decoration:none">Comprar ahora</a>
        <a href="#categorias" style="background:rgba(255,255,255,0.12);color:white;font-size:16px;font-weight:600;padding:14px 36px;border-radius:10px;text-decoration:none;border:2px solid rgba(255,255,255,0.3)">Ver categorias</a>
      </div>
    </div>
    <div>
      <img src="https://placehold.co/600x500/0c4a6e/7dd3fc?text=Producto+Hero" style="width:100%;border-radius:24px;display:block;box-shadow:0 32px 80px rgba(0,0,0,0.3)">
    </div>
  </div>
</section>

<!-- SELLOS -->
<section style="padding:28px 24px;background:#f8fafc;border-bottom:1px solid #e2e8f0;${FS}">
  <div style="max-width:900px;margin:0 auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:16px">
    <div style="display:flex;gap:10px;align-items:center"><div style="width:36px;height:36px;min-width:36px;background:#dcfce7;border-radius:10px;display:flex;align-items:center;justify-content:center;font-weight:700;color:#166534;font-size:14px">E</div><div><p style="font-weight:700;color:#0f172a;font-size:13px;margin:0">Envio gratis</p><p style="color:#64748b;font-size:12px;margin:0">Pedidos +$50</p></div></div>
    <div style="display:flex;gap:10px;align-items:center"><div style="width:36px;height:36px;min-width:36px;background:#dbeafe;border-radius:10px;display:flex;align-items:center;justify-content:center;font-weight:700;color:#1d4ed8;font-size:14px">D</div><div><p style="font-weight:700;color:#0f172a;font-size:13px;margin:0">Devolucion 30 dias</p><p style="color:#64748b;font-size:12px;margin:0">Sin preguntas</p></div></div>
    <div style="display:flex;gap:10px;align-items:center"><div style="width:36px;height:36px;min-width:36px;background:#fef3c7;border-radius:10px;display:flex;align-items:center;justify-content:center;font-weight:700;color:#d97706;font-size:14px">S</div><div><p style="font-weight:700;color:#0f172a;font-size:13px;margin:0">Pago seguro</p><p style="color:#64748b;font-size:12px;margin:0">Cifrado SSL</p></div></div>
    <div style="display:flex;gap:10px;align-items:center"><div style="width:36px;height:36px;min-width:36px;background:#fce7f3;border-radius:10px;display:flex;align-items:center;justify-content:center;font-weight:700;color:#be185d;font-size:14px">A</div><div><p style="font-weight:700;color:#0f172a;font-size:13px;margin:0">Soporte 24/7</p><p style="color:#64748b;font-size:12px;margin:0">Siempre aqui</p></div></div>
  </div>
</section>

<!-- CATEGORIAS -->
<section id="categorias" style="padding:80px 24px;background:white;${FS}">
  <div style="max-width:1100px;margin:0 auto">
    <h2 style="font-size:clamp(24px,3.5vw,40px);font-weight:800;color:#0f172a;margin:0 0 40px;letter-spacing:-0.025em">Explorar categorias</h2>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px">
      <a href="/productos" style="border-radius:16px;overflow:hidden;text-decoration:none;position:relative;display:block;aspect-ratio:3/4;background:#dbeafe">
        <img src="https://placehold.co/300x400/0c4a6e/7dd3fc?text=Ropa" style="width:100%;height:100%;object-fit:cover;display:block">
        <div style="position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,0.6),transparent);display:flex;align-items:flex-end;padding:16px">
          <span style="color:white;font-size:16px;font-weight:700">Ropa</span>
        </div>
      </a>
      <a href="/productos" style="border-radius:16px;overflow:hidden;text-decoration:none;position:relative;display:block;aspect-ratio:3/4;background:#dcfce7">
        <img src="https://placehold.co/300x400/064e3b/6ee7b7?text=Accesorios" style="width:100%;height:100%;object-fit:cover;display:block">
        <div style="position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,0.6),transparent);display:flex;align-items:flex-end;padding:16px">
          <span style="color:white;font-size:16px;font-weight:700">Accesorios</span>
        </div>
      </a>
      <a href="/productos" style="border-radius:16px;overflow:hidden;text-decoration:none;position:relative;display:block;aspect-ratio:3/4;background:#fef3c7">
        <img src="https://placehold.co/300x400/78350f/fcd34d?text=Hogar" style="width:100%;height:100%;object-fit:cover;display:block">
        <div style="position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,0.6),transparent);display:flex;align-items:flex-end;padding:16px">
          <span style="color:white;font-size:16px;font-weight:700">Hogar</span>
        </div>
      </a>
      <a href="/productos" style="border-radius:16px;overflow:hidden;text-decoration:none;position:relative;display:block;aspect-ratio:3/4;background:#fce7f3">
        <img src="https://placehold.co/300x400/831843/fce7f3?text=Belleza" style="width:100%;height:100%;object-fit:cover;display:block">
        <div style="position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,0.6),transparent);display:flex;align-items:flex-end;padding:16px">
          <span style="color:white;font-size:16px;font-weight:700">Belleza</span>
        </div>
      </a>
    </div>
  </div>
</section>

<!-- PRODUCTOS -->
<section id="productos" style="padding:80px 24px;background:#f8fafc;${FS}">
  <div style="max-width:1100px;margin:0 auto">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:48px;flex-wrap:wrap;gap:16px">
      <h2 style="font-size:clamp(22px,3.5vw,38px);font-weight:800;color:#0f172a;margin:0;letter-spacing:-0.025em">Mas vendidos</h2>
      <a href="/productos" style="color:#0369a1;font-size:15px;font-weight:600;text-decoration:none">Ver todos &rarr;</a>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:20px">
      <div style="background:white;border-radius:18px;overflow:hidden;box-shadow:0 1px 8px rgba(0,0,0,0.06)">
        <div style="aspect-ratio:1;overflow:hidden;background:#f1f5f9">
          <img src="https://placehold.co/360x360/dbeafe/0369a1?text=Producto+1" style="width:100%;height:100%;object-fit:cover;display:block">
        </div>
        <div style="padding:20px">
          <p style="font-size:12px;color:#0369a1;font-weight:600;margin:0 0 4px;text-transform:uppercase;letter-spacing:0.06em">Categoria</p>
          <h3 style="font-size:16px;font-weight:700;color:#0f172a;margin:0 0 10px">Nombre del producto</h3>
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span style="font-size:20px;font-weight:800;color:#0f172a">$49</span>
            <button style="background:#0369a1;color:white;font-size:13px;font-weight:600;padding:8px 18px;border:none;border-radius:8px;cursor:pointer">Agregar</button>
          </div>
        </div>
      </div>
      <div style="background:white;border-radius:18px;overflow:hidden;box-shadow:0 1px 8px rgba(0,0,0,0.06)">
        <div style="aspect-ratio:1;overflow:hidden;background:#f1f5f9;position:relative">
          <img src="https://placehold.co/360x360/dcfce7/059669?text=Producto+2" style="width:100%;height:100%;object-fit:cover;display:block">
          <div style="position:absolute;top:10px;left:10px;background:#ef4444;color:white;font-size:11px;font-weight:700;padding:3px 10px;border-radius:999px">-20%</div>
        </div>
        <div style="padding:20px">
          <p style="font-size:12px;color:#059669;font-weight:600;margin:0 0 4px;text-transform:uppercase;letter-spacing:0.06em">Categoria</p>
          <h3 style="font-size:16px;font-weight:700;color:#0f172a;margin:0 0 10px">Producto en oferta</h3>
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div><span style="font-size:20px;font-weight:800;color:#0f172a">$79</span><span style="font-size:14px;color:#94a3b8;text-decoration:line-through;margin-left:8px">$99</span></div>
            <button style="background:#0369a1;color:white;font-size:13px;font-weight:600;padding:8px 18px;border:none;border-radius:8px;cursor:pointer">Agregar</button>
          </div>
        </div>
      </div>
      <div style="background:white;border-radius:18px;overflow:hidden;box-shadow:0 1px 8px rgba(0,0,0,0.06)">
        <div style="aspect-ratio:1;overflow:hidden;background:#f1f5f9">
          <img src="https://placehold.co/360x360/fef3c7/d97706?text=Producto+3" style="width:100%;height:100%;object-fit:cover;display:block">
        </div>
        <div style="padding:20px">
          <p style="font-size:12px;color:#d97706;font-weight:600;margin:0 0 4px;text-transform:uppercase;letter-spacing:0.06em">Categoria</p>
          <h3 style="font-size:16px;font-weight:700;color:#0f172a;margin:0 0 10px">Producto popular</h3>
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span style="font-size:20px;font-weight:800;color:#0f172a">$129</span>
            <button style="background:#0369a1;color:white;font-size:13px;font-weight:600;padding:8px 18px;border:none;border-radius:8px;cursor:pointer">Agregar</button>
          </div>
        </div>
      </div>
      <div style="background:white;border-radius:18px;overflow:hidden;box-shadow:0 1px 8px rgba(0,0,0,0.06)">
        <div style="aspect-ratio:1;overflow:hidden;background:#f1f5f9">
          <img src="https://placehold.co/360x360/fce7f3/be185d?text=Producto+4" style="width:100%;height:100%;object-fit:cover;display:block">
        </div>
        <div style="padding:20px">
          <p style="font-size:12px;color:#be185d;font-weight:600;margin:0 0 4px;text-transform:uppercase;letter-spacing:0.06em">Novedad</p>
          <h3 style="font-size:16px;font-weight:700;color:#0f172a;margin:0 0 10px">Nuevo producto</h3>
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span style="font-size:20px;font-weight:800;color:#0f172a">$65</span>
            <button style="background:#0369a1;color:white;font-size:13px;font-weight:600;padding:8px 18px;border:none;border-radius:8px;cursor:pointer">Agregar</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- NEWSLETTER -->
<section style="padding:72px 24px;background:#0369a1;text-align:center;${FS}">
  <div style="max-width:500px;margin:0 auto">
    <h2 style="font-size:clamp(22px,3.5vw,34px);font-weight:800;color:white;margin:0 0 12px;letter-spacing:-0.025em">Ofertas exclusivas en tu correo</h2>
    <p style="font-size:15px;color:rgba(255,255,255,0.78);margin:0 0 28px;line-height:1.7">Suscribete y recibe un 10% de descuento en tu primera compra.</p>
    <form style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center">
      <input type="email" placeholder="tu@correo.com" style="flex:1;min-width:220px;border:none;background:rgba(255,255,255,0.15);color:white;border-radius:8px;padding:13px 16px;font-size:15px;outline:none">
      <button type="submit" style="background:white;color:#0369a1;font-size:15px;font-weight:700;padding:13px 28px;border:none;border-radius:8px;cursor:pointer;white-space:nowrap">Suscribirse</button>
    </form>
  </div>
</section>

<!-- FOOTER -->
<footer style="background:#0c4a6e;padding:40px 24px;text-align:center;${FS}">
  <p style="color:rgba(255,255,255,0.4);font-size:14px;margin:0">&#169; 2025 TiendaOnline &middot; Todos los derechos reservados</p>
</footer>
`,
    },
    {
      id: 'productos',
      label: 'Productos',
      routePath: '/productos',
      title: 'Productos',
      required: false,
      css: '',
      html: `
<nav style="background:#14532d;padding:0 40px;height:64px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <a href="/" style="font-size:20px;font-weight:900;color:white;text-decoration:none;letter-spacing:-0.02em">TiendaOnline</a>
  <div style="display:flex;gap:24px;align-items:center">
    <a href="/" style="color:rgba(255,255,255,0.8);text-decoration:none;font-size:14px">Inicio</a>
    <a href="/nosotros" style="color:rgba(255,255,255,0.8);text-decoration:none;font-size:14px">Nosotros</a>
    <a href="/contacto" style="color:rgba(255,255,255,0.8);text-decoration:none;font-size:14px">Contacto</a>
    <a href="/acceso" style="color:rgba(255,255,255,0.8);text-decoration:none;font-size:14px">Iniciar sesion</a>
    <a href="/contacto" style="background:#16a34a;color:white;text-decoration:none;font-size:14px;font-weight:700;padding:9px 22px;border-radius:8px">Contactar</a>
  </div>
</nav>
<section style="padding:80px 24px;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:1100px;margin:0 auto">
    <div style="text-align:center;margin-bottom:60px">
      <p style="color:#16a34a;font-size:12px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;margin:0 0 12px">Catalogo</p>
      <h1 style="font-size:44px;font-weight:800;color:#0f172a;margin:0;letter-spacing:-0.02em">Nuestros productos</h1>
      <p style="font-size:17px;color:#64748b;margin:16px 0 0">Calidad garantizada en cada articulo.</p>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:24px">
      <div style="background:white;border-radius:18px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06)">
        <img src="https://placehold.co/400x300/14532d/bbf7d0?text=Producto+A" style="width:100%;height:200px;object-fit:cover">
        <div style="padding:20px">
          <p style="font-size:12px;color:#16a34a;font-weight:700;margin:0 0 6px;text-transform:uppercase">Ropa</p>
          <h3 style="font-size:17px;font-weight:700;color:#0f172a;margin:0 0 8px">Camisa casual premium</h3>
          <p style="font-size:14px;color:#64748b;margin:0 0 16px;line-height:1.5">Tela de algodón 100% de alta calidad. Disponible en varios colores.</p>
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span style="font-size:22px;font-weight:800;color:#0f172a">$45</span>
            <a href="/contacto" style="background:#16a34a;color:white;font-size:13px;font-weight:700;padding:9px 18px;border-radius:8px;text-decoration:none">Ver producto</a>
          </div>
        </div>
      </div>
      <div style="background:white;border-radius:18px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06)">
        <img src="https://placehold.co/400x300/166534/a7f3d0?text=Producto+B" style="width:100%;height:200px;object-fit:cover">
        <div style="padding:20px">
          <p style="font-size:12px;color:#16a34a;font-weight:700;margin:0 0 6px;text-transform:uppercase">Accesorios</p>
          <h3 style="font-size:17px;font-weight:700;color:#0f172a;margin:0 0 8px">Bolso de mano elegante</h3>
          <p style="font-size:14px;color:#64748b;margin:0 0 16px;line-height:1.5">Cuero genuino, compartimentos multiples. Ideal para uso diario.</p>
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span style="font-size:22px;font-weight:800;color:#0f172a">$89</span>
            <a href="/contacto" style="background:#16a34a;color:white;font-size:13px;font-weight:700;padding:9px 18px;border-radius:8px;text-decoration:none">Ver producto</a>
          </div>
        </div>
      </div>
      <div style="background:white;border-radius:18px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06)">
        <img src="https://placehold.co/400x300/15803d/d1fae5?text=Producto+C" style="width:100%;height:200px;object-fit:cover">
        <div style="padding:20px">
          <p style="font-size:12px;color:#16a34a;font-weight:700;margin:0 0 6px;text-transform:uppercase">Hogar</p>
          <h3 style="font-size:17px;font-weight:700;color:#0f172a;margin:0 0 8px">Set decorativo minimalista</h3>
          <p style="font-size:14px;color:#64748b;margin:0 0 16px;line-height:1.5">Tres piezas coordinadas para transformar cualquier espacio del hogar.</p>
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span style="font-size:22px;font-weight:800;color:#0f172a">$65</span>
            <a href="/contacto" style="background:#16a34a;color:white;font-size:13px;font-weight:700;padding:9px 18px;border-radius:8px;text-decoration:none">Ver producto</a>
          </div>
        </div>
      </div>
      <div style="background:white;border-radius:18px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06)">
        <img src="https://placehold.co/400x300/14532d/6ee7b7?text=Producto+D" style="width:100%;height:200px;object-fit:cover">
        <div style="padding:20px">
          <p style="font-size:12px;color:#16a34a;font-weight:700;margin:0 0 6px;text-transform:uppercase">Belleza</p>
          <h3 style="font-size:17px;font-weight:700;color:#0f172a;margin:0 0 8px">Kit de cuidado facial</h3>
          <p style="font-size:14px;color:#64748b;margin:0 0 16px;line-height:1.5">Formula natural con ingredientes botanicos para todo tipo de piel.</p>
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span style="font-size:22px;font-weight:800;color:#0f172a">$38</span>
            <a href="/contacto" style="background:#16a34a;color:white;font-size:13px;font-weight:700;padding:9px 18px;border-radius:8px;text-decoration:none">Ver producto</a>
          </div>
        </div>
      </div>
      <div style="background:white;border-radius:18px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06)">
        <img src="https://placehold.co/400x300/166534/bbf7d0?text=Producto+E" style="width:100%;height:200px;object-fit:cover">
        <div style="padding:20px">
          <p style="font-size:12px;color:#16a34a;font-weight:700;margin:0 0 6px;text-transform:uppercase">Ropa</p>
          <h3 style="font-size:17px;font-weight:700;color:#0f172a;margin:0 0 8px">Chaqueta denim clasica</h3>
          <p style="font-size:14px;color:#64748b;margin:0 0 16px;line-height:1.5">Corte clasico atemporal. Perfecta para cualquier ocasion.</p>
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span style="font-size:22px;font-weight:800;color:#0f172a">$110</span>
            <a href="/contacto" style="background:#16a34a;color:white;font-size:13px;font-weight:700;padding:9px 18px;border-radius:8px;text-decoration:none">Ver producto</a>
          </div>
        </div>
      </div>
      <div style="background:white;border-radius:18px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06)">
        <img src="https://placehold.co/400x300/15803d/a7f3d0?text=Producto+F" style="width:100%;height:200px;object-fit:cover">
        <div style="padding:20px">
          <p style="font-size:12px;color:#16a34a;font-weight:700;margin:0 0 6px;text-transform:uppercase">Accesorios</p>
          <h3 style="font-size:17px;font-weight:700;color:#0f172a;margin:0 0 8px">Reloj minimalista</h3>
          <p style="font-size:14px;color:#64748b;margin:0 0 16px;line-height:1.5">Diseno elegante con correa de cuero genuino. Movimiento de cuarzo.</p>
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span style="font-size:22px;font-weight:800;color:#0f172a">$149</span>
            <a href="/contacto" style="background:#16a34a;color:white;font-size:13px;font-weight:700;padding:9px 18px;border-radius:8px;text-decoration:none">Ver producto</a>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>
<footer style="background:#14532d;color:rgba(255,255,255,0.6);padding:40px;text-align:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <p style="margin:0 0 8px;font-size:18px;font-weight:900;color:white">TiendaOnline</p>
  <p style="margin:0;font-size:13px">ventas@tiendaonline.com &middot; 55 0000-2222</p>
  <p style="margin:20px 0 0;font-size:12px;color:rgba(255,255,255,0.3)">&copy; 2025 TiendaOnline. Todos los derechos reservados.</p>
</footer>
`,
    },
    {
      id: 'nosotros',
      label: 'Nosotros',
      routePath: '/nosotros',
      title: 'Nosotros',
      required: false,
      css: '',
      html: `
<nav style="background:#14532d;padding:0 40px;height:64px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <a href="/" style="font-size:20px;font-weight:900;color:white;text-decoration:none;letter-spacing:-0.02em">TiendaOnline</a>
  <div style="display:flex;gap:24px;align-items:center">
    <a href="/" style="color:rgba(255,255,255,0.8);text-decoration:none;font-size:14px">Inicio</a>
    <a href="/productos" style="color:rgba(255,255,255,0.8);text-decoration:none;font-size:14px">Productos</a>
    <a href="/contacto" style="color:rgba(255,255,255,0.8);text-decoration:none;font-size:14px">Contacto</a>
    <a href="/acceso" style="color:rgba(255,255,255,0.8);text-decoration:none;font-size:14px">Iniciar sesion</a>
    <a href="/contacto" style="background:#16a34a;color:white;text-decoration:none;font-size:14px;font-weight:700;padding:9px 22px;border-radius:8px">Contactar</a>
  </div>
</nav>
<section style="padding:80px 24px;background:white;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:1100px;margin:0 auto;display:grid;grid-template-columns:1fr 1fr;gap:72px;align-items:center">
    <div>
      <p style="color:#16a34a;font-size:12px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;margin:0 0 16px">Nuestra historia</p>
      <h1 style="font-size:44px;font-weight:800;color:#0f172a;margin:0 0 24px;letter-spacing:-0.02em;line-height:1.15">Una tienda creada con passion</h1>
      <p style="font-size:16px;color:#64748b;line-height:1.8;margin:0 0 20px">Fundada en 2018, TiendaOnline nacio con la mision de acercar productos de calidad a todos. Empezamos como un pequeno proyecto y hoy llegamos a miles de clientes en toda la region.</p>
      <p style="font-size:16px;color:#64748b;line-height:1.8;margin:0 0 36px">Cada producto que ofrecemos pasa por un riguroso proceso de seleccion para garantizar que cumple nuestros estandares de calidad y satisfaccion al cliente.</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        <div style="background:#f0fdf4;border-radius:14px;padding:20px"><p style="font-size:32px;font-weight:900;color:#16a34a;margin:0">+10K</p><p style="font-size:13px;color:#64748b;margin:6px 0 0">Clientes felices</p></div>
        <div style="background:#f0fdf4;border-radius:14px;padding:20px"><p style="font-size:32px;font-weight:900;color:#16a34a;margin:0">+500</p><p style="font-size:13px;color:#64748b;margin:6px 0 0">Productos disponibles</p></div>
      </div>
    </div>
    <div>
      <img src="https://placehold.co/600x500/14532d/bbf7d0?text=Nuestra+tienda" style="width:100%;border-radius:24px;display:block;box-shadow:0 16px 48px rgba(20,83,45,0.15)">
    </div>
  </div>
</section>
<section style="padding:80px 24px;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:900px;margin:0 auto">
    <div style="text-align:center;margin-bottom:52px">
      <h2 style="font-size:36px;font-weight:800;color:#0f172a;margin:0;letter-spacing:-0.02em">Nuestros valores</h2>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:28px">
      <div style="background:white;border-radius:20px;padding:32px;text-align:center;box-shadow:0 2px 12px rgba(0,0,0,0.05)">
        <div style="width:56px;height:56px;background:#dcfce7;border-radius:16px;margin:0 auto 20px;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:800;color:#16a34a">C</div>
        <h3 style="font-size:18px;font-weight:700;color:#0f172a;margin:0 0 10px">Calidad</h3>
        <p style="font-size:14px;color:#64748b;line-height:1.6;margin:0">Seleccionamos cada producto con criterios rigurosos para garantizar lo mejor.</p>
      </div>
      <div style="background:white;border-radius:20px;padding:32px;text-align:center;box-shadow:0 2px 12px rgba(0,0,0,0.05)">
        <div style="width:56px;height:56px;background:#dcfce7;border-radius:16px;margin:0 auto 20px;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:800;color:#16a34a">T</div>
        <h3 style="font-size:18px;font-weight:700;color:#0f172a;margin:0 0 10px">Transparencia</h3>
        <p style="font-size:14px;color:#64748b;line-height:1.6;margin:0">Precios justos, politicas claras y comunicacion honesta en todo momento.</p>
      </div>
      <div style="background:white;border-radius:20px;padding:32px;text-align:center;box-shadow:0 2px 12px rgba(0,0,0,0.05)">
        <div style="width:56px;height:56px;background:#dcfce7;border-radius:16px;margin:0 auto 20px;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:800;color:#16a34a">S</div>
        <h3 style="font-size:18px;font-weight:700;color:#0f172a;margin:0 0 10px">Servicio</h3>
        <p style="font-size:14px;color:#64748b;line-height:1.6;margin:0">Atencion personalizada para que cada compra sea una experiencia excepcional.</p>
      </div>
    </div>
  </div>
</section>
<footer style="background:#14532d;color:rgba(255,255,255,0.6);padding:40px;text-align:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <p style="margin:0 0 8px;font-size:18px;font-weight:900;color:white">TiendaOnline</p>
  <p style="margin:0;font-size:13px">ventas@tiendaonline.com &middot; 55 0000-2222</p>
  <p style="margin:20px 0 0;font-size:12px;color:rgba(255,255,255,0.3)">&copy; 2025 TiendaOnline. Todos los derechos reservados.</p>
</footer>
`,
    },
    {
      id: 'contacto',
      label: 'Contacto',
      routePath: '/contacto',
      title: 'Contacto',
      required: false,
      css: '',
      html: `
<nav style="background:#14532d;padding:0 40px;height:64px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <a href="/" style="font-size:20px;font-weight:900;color:white;text-decoration:none;letter-spacing:-0.02em">TiendaOnline</a>
  <div style="display:flex;gap:24px;align-items:center">
    <a href="/" style="color:rgba(255,255,255,0.8);text-decoration:none;font-size:14px">Inicio</a>
    <a href="/productos" style="color:rgba(255,255,255,0.8);text-decoration:none;font-size:14px">Productos</a>
    <a href="/nosotros" style="color:rgba(255,255,255,0.8);text-decoration:none;font-size:14px">Nosotros</a>
    <a href="/acceso" style="color:rgba(255,255,255,0.8);text-decoration:none;font-size:14px">Iniciar sesion</a>
  </div>
</nav>
<section style="padding:80px 24px;background:white;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:900px;margin:0 auto;display:grid;grid-template-columns:1fr 1fr;gap:64px;align-items:start">
    <div>
      <h1 style="font-size:44px;font-weight:800;color:#0f172a;margin:0 0 20px;letter-spacing:-0.02em">Hablanos</h1>
      <p style="font-size:16px;color:#64748b;line-height:1.7;margin:0 0 36px">Preguntas sobre productos, pedidos o envios. Estamos aqui para ayudarte.</p>
      <div style="display:flex;flex-direction:column;gap:24px">
        <div style="display:flex;gap:14px">
          <div style="width:44px;height:44px;background:#dcfce7;border-radius:12px;display:flex;align-items:center;justify-content:center;font-weight:800;color:#16a34a;flex-shrink:0">@</div>
          <div><p style="margin:0;font-weight:700;color:#0f172a">Email</p><p style="margin:4px 0 0;font-size:14px;color:#64748b">ventas@tiendaonline.com</p></div>
        </div>
        <div style="display:flex;gap:14px">
          <div style="width:44px;height:44px;background:#dcfce7;border-radius:12px;display:flex;align-items:center;justify-content:center;font-weight:800;color:#16a34a;flex-shrink:0">T</div>
          <div><p style="margin:0;font-weight:700;color:#0f172a">Telefono</p><p style="margin:4px 0 0;font-size:14px;color:#64748b">55 0000-2222</p></div>
        </div>
        <div style="display:flex;gap:14px">
          <div style="width:44px;height:44px;background:#dcfce7;border-radius:12px;display:flex;align-items:center;justify-content:center;font-weight:800;color:#16a34a;flex-shrink:0">H</div>
          <div><p style="margin:0;font-weight:700;color:#0f172a">Horario de atencion</p><p style="margin:4px 0 0;font-size:14px;color:#64748b">Lun - Vie: 9:00 - 18:00</p><p style="margin:2px 0 0;font-size:14px;color:#64748b">Sab: 10:00 - 14:00</p></div>
        </div>
        <div style="display:flex;gap:14px">
          <div style="width:44px;height:44px;background:#dcfce7;border-radius:12px;display:flex;align-items:center;justify-content:center;font-weight:800;color:#16a34a;flex-shrink:0">U</div>
          <div><p style="margin:0;font-weight:700;color:#0f172a">Ubicacion</p><p style="margin:4px 0 0;font-size:14px;color:#64748b">Av. Comercio 456, Local 12</p><p style="margin:2px 0 0;font-size:14px;color:#64748b">Ciudad de Mexico</p></div>
        </div>
      </div>
    </div>
    <div style="background:#f8fafc;border-radius:20px;padding:32px">
      <h2 style="font-size:20px;font-weight:700;color:#0f172a;margin:0 0 24px">Enviar mensaje</h2>
      <div style="display:grid;gap:14px">
        <input placeholder="Tu nombre" style="border:1px solid #e2e8f0;border-radius:10px;padding:12px 16px;font-size:15px;outline:none;width:100%;box-sizing:border-box">
        <input type="email" placeholder="Correo electronico" style="border:1px solid #e2e8f0;border-radius:10px;padding:12px 16px;font-size:15px;outline:none;width:100%;box-sizing:border-box">
        <input placeholder="Telefono (opcional)" style="border:1px solid #e2e8f0;border-radius:10px;padding:12px 16px;font-size:15px;outline:none;width:100%;box-sizing:border-box">
        <select style="border:1px solid #e2e8f0;border-radius:10px;padding:12px 16px;font-size:15px;outline:none;width:100%;box-sizing:border-box;color:#374151">
          <option value="">Tipo de consulta</option>
          <option>Informacion de producto</option>
          <option>Estado de pedido</option>
          <option>Devolucion o cambio</option>
          <option>Otro</option>
        </select>
        <textarea placeholder="Tu mensaje..." rows="4" style="border:1px solid #e2e8f0;border-radius:10px;padding:12px 16px;font-size:15px;outline:none;width:100%;box-sizing:border-box;resize:vertical"></textarea>
        <button type="submit" style="background:#16a34a;color:white;border:none;border-radius:10px;padding:13px;font-size:15px;font-weight:700;cursor:pointer">Enviar mensaje</button>
      </div>
    </div>
  </div>
</section>
<footer style="background:#14532d;color:rgba(255,255,255,0.6);padding:40px;text-align:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <p style="margin:0 0 8px;font-size:18px;font-weight:900;color:white">TiendaOnline</p>
  <p style="margin:0;font-size:13px">ventas@tiendaonline.com &middot; 55 0000-2222</p>
  <p style="margin:20px 0 0;font-size:12px;color:rgba(255,255,255,0.3)">&copy; 2025 TiendaOnline. Todos los derechos reservados.</p>
</footer>
`,
    },
  ],
}
