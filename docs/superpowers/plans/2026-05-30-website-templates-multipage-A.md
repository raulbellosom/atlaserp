# Website Templates Multi-página — Plan A: Datos de Templates

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrar los 6 templates existentes al formato multi-página y crear 6 templates nuevos, todos con el link de login `/acceso` en el navbar.

**Architecture:** Cada template adopta `pages[]` en lugar de `html`/`css` raíz. La página `home` (`required: true`) contiene el HTML existente con el login link añadido al nav. Las páginas extra son HTML nuevo en el mismo estilo visual. Sin cambios a lógica ni API — solo datos de templates.

**Tech Stack:** JavaScript (ES modules), HTML inline-styles, sin dependencias nuevas.

---

## File Map

### Modificar
- `apps/desktop/src/website/atlasTemplates/templateRestaurante.js`
- `apps/desktop/src/website/atlasTemplates/templateSpa.js`
- `apps/desktop/src/website/atlasTemplates/templateAgencia.js`
- `apps/desktop/src/website/atlasTemplates/templateEcommerce.js`
- `apps/desktop/src/website/atlasTemplates/templateServicios.js`
- `apps/desktop/src/website/atlasTemplates/templateNegocio.js`
- `apps/desktop/src/website/atlasTemplates/index.js`

### Crear
- `apps/desktop/src/website/atlasTemplates/templateClinica.js`
- `apps/desktop/src/website/atlasTemplates/templatePortfolio.js`
- `apps/desktop/src/website/atlasTemplates/templateInmobiliaria.js`
- `apps/desktop/src/website/atlasTemplates/templateBlog.js`
- `apps/desktop/src/website/atlasTemplates/templateOng.js`
- `apps/desktop/src/website/atlasTemplates/templateEducacion.js`

---

## Patrón de migración (leer antes de tasks 1–6)

El formato nuevo envuelve el HTML existente en `pages[0]` y añade páginas extra:

```js
export const templateXxx = {
  id: 'xxx',
  label: 'Nombre',
  category: 'categoria',   // hosteleria | negocios | salud | creativo | comercio | educacion | social | medios
  color: '#hexcolor',
  description: 'Descripción.',
  pages: [
    {
      id: 'home',
      label: 'Inicio',
      routePath: '/',
      title: 'Inicio',
      required: true,
      html: `...HTML existente con login link añadido en el nav...`,
      css: ``,
    },
    {
      id: 'pagina-id',
      label: 'Nombre de página',
      routePath: '/ruta',
      title: 'Titulo de Pagina',
      required: false,
      html: `...HTML nueva página...`,
      css: ``,
    },
  ],
}
```

**Login link a añadir en el nav de cada template**: justo antes del botón CTA principal del nav, insertar:
```html
<a href="/acceso" style="color:rgba(255,255,255,0.75);text-decoration:none;font-size:14px;font-weight:500">Iniciar sesion</a>
```
Para navs claros (fondo blanco) usar `color:#374151` en lugar de `rgba(255,255,255,0.75)`.

---

## Task 1 — Migrar templateRestaurante.js

**Files:**
- Modify: `apps/desktop/src/website/atlasTemplates/templateRestaurante.js`

- [ ] **Step 1: Reemplazar el archivo completo**

  Lee el archivo actual. Conserva el HTML existente tal como está — solo:
  1. Añade `category: 'hosteleria'`
  2. Envuelve el HTML existente en `pages[0]` con `id:'home', required:true, routePath:'/'`
  3. En el nav del HTML existente (busca el `<div style="display:flex;gap:28px`), añade antes del `<a href="#reservar"...>Reservar</a>`:
     ```html
     <a href="/acceso" style="color:rgba(255,255,255,0.8);text-decoration:none;font-size:14px;font-weight:500">Iniciar sesion</a>
     ```
  4. Añade las páginas extra abajo.

  Estructura final del archivo:

  ```js
  const F = "font-family:Georgia,'Playfair Display',serif"
  const FS = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"

  export const templateRestaurante = {
    id: 'restaurante',
    label: 'Restaurante',
    category: 'hosteleria',
    description: 'Ideal para restaurantes, cafes y bares. Incluye menu, galeria y reservas.',
    color: '#92400e',
    pages: [
      {
        id: 'home',
        label: 'Inicio',
        routePath: '/',
        title: 'Inicio',
        required: true,
        html: `<!-- contenido del archivo actual con el login link añadido en el nav -->`,
        css: ``,
      },
      {
        id: 'menu',
        label: 'Menu',
        routePath: '/menu',
        title: 'Nuestro Menu',
        required: false,
        html: `
  <nav style="position:fixed;top:0;left:0;right:0;z-index:100;background:rgba(15,10,5,0.9);backdrop-filter:blur(12px);padding:0 40px;height:64px;display:flex;align-items:center;justify-content:space-between;${FS}">
    <a href="/" style="font-size:22px;font-weight:800;color:white;text-decoration:none;letter-spacing:-0.02em">RestauranteName</a>
    <div style="display:flex;gap:28px;align-items:center">
      <a href="/" style="color:rgba(255,255,255,0.8);text-decoration:none;font-size:14px;font-weight:500">Inicio</a>
      <a href="/galeria" style="color:rgba(255,255,255,0.8);text-decoration:none;font-size:14px;font-weight:500">Galeria</a>
      <a href="/reservas" style="color:rgba(255,255,255,0.8);text-decoration:none;font-size:14px;font-weight:500">Reservas</a>
      <a href="/acceso" style="color:rgba(255,255,255,0.8);text-decoration:none;font-size:14px;font-weight:500">Iniciar sesion</a>
      <a href="/reservas" style="background:#c2410c;color:white;text-decoration:none;font-size:14px;font-weight:700;padding:9px 22px;border-radius:8px">Reservar</a>
    </div>
  </nav>
  <div style="height:64px"></div>
  <section style="padding:80px 24px;background:#faf7f0;${FS}">
    <div style="max-width:1000px;margin:0 auto">
      <div style="text-align:center;margin-bottom:60px">
        <p style="color:#c2410c;font-size:13px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;margin:0 0 12px">Nuestro menu</p>
        <h1 style="font-size:42px;font-weight:400;color:#1a0a00;margin:0;${F}">Una experiencia culinaria</h1>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:48px">
        <div>
          <h2 style="font-size:20px;font-weight:700;color:#92400e;margin:0 0 24px;border-bottom:2px solid #fde68a;padding-bottom:12px">Entradas</h2>
          <div style="space-y:16px">
            <div style="display:flex;justify-content:space-between;padding:14px 0;border-bottom:1px solid #e7e0d0"><div><p style="margin:0;font-weight:600;color:#1a0a00">Carpaccio de res</p><p style="margin:4px 0 0;font-size:13px;color:#78716c">Con alcaparras y parmesano</p></div><span style="font-weight:700;color:#c2410c">$185</span></div>
            <div style="display:flex;justify-content:space-between;padding:14px 0;border-bottom:1px solid #e7e0d0"><div><p style="margin:0;font-weight:600;color:#1a0a00">Sopa de fideo seco</p><p style="margin:4px 0 0;font-size:13px;color:#78716c">Estilo tradicional con crema</p></div><span style="font-weight:700;color:#c2410c">$120</span></div>
            <div style="display:flex;justify-content:space-between;padding:14px 0"><div><p style="margin:0;font-weight:600;color:#1a0a00">Tostadas de tinga</p><p style="margin:4px 0 0;font-size:13px;color:#78716c">Con aguacate y queso fresco</p></div><span style="font-weight:700;color:#c2410c">$95</span></div>
          </div>
        </div>
        <div>
          <h2 style="font-size:20px;font-weight:700;color:#92400e;margin:0 0 24px;border-bottom:2px solid #fde68a;padding-bottom:12px">Platos fuertes</h2>
          <div>
            <div style="display:flex;justify-content:space-between;padding:14px 0;border-bottom:1px solid #e7e0d0"><div><p style="margin:0;font-weight:600;color:#1a0a00">Arrachera a la plancha</p><p style="margin:4px 0 0;font-size:13px;color:#78716c">Con papas y ensalada</p></div><span style="font-weight:700;color:#c2410c">$320</span></div>
            <div style="display:flex;justify-content:space-between;padding:14px 0;border-bottom:1px solid #e7e0d0"><div><p style="margin:0;font-weight:600;color:#1a0a00">Mole negro con pollo</p><p style="margin:4px 0 0;font-size:13px;color:#78716c">Receta de la abuela, arroz y frijoles</p></div><span style="font-weight:700;color:#c2410c">$245</span></div>
            <div style="display:flex;justify-content:space-between;padding:14px 0"><div><p style="margin:0;font-weight:600;color:#1a0a00">Filete al chipotle</p><p style="margin:4px 0 0;font-size:13px;color:#78716c">Puré de papa y verduras</p></div><span style="font-weight:700;color:#c2410c">$380</span></div>
          </div>
        </div>
      </div>
    </div>
  </section>
  <footer style="background:#1a0a00;color:rgba(255,255,255,0.7);padding:48px 40px;text-align:center;${FS}">
    <p style="margin:0 0 8px;font-size:20px;font-weight:700;color:white">RestauranteName</p>
    <p style="margin:0;font-size:14px">Av. Principal 123 · Tel: 55 1234-5678 · reservas@restaurante.com</p>
    <p style="margin:24px 0 0;font-size:12px;color:rgba(255,255,255,0.4)">&copy; 2025 RestauranteName. Todos los derechos reservados.</p>
  </footer>`,
        css: ``,
      },
      {
        id: 'galeria',
        label: 'Galeria',
        routePath: '/galeria',
        title: 'Galeria',
        required: false,
        html: `
  <nav style="position:fixed;top:0;left:0;right:0;z-index:100;background:rgba(15,10,5,0.9);backdrop-filter:blur(12px);padding:0 40px;height:64px;display:flex;align-items:center;justify-content:space-between;${FS}">
    <a href="/" style="font-size:22px;font-weight:800;color:white;text-decoration:none">RestauranteName</a>
    <div style="display:flex;gap:28px;align-items:center">
      <a href="/menu" style="color:rgba(255,255,255,0.8);text-decoration:none;font-size:14px">Menu</a>
      <a href="/reservas" style="color:rgba(255,255,255,0.8);text-decoration:none;font-size:14px">Reservas</a>
      <a href="/acceso" style="color:rgba(255,255,255,0.8);text-decoration:none;font-size:14px">Iniciar sesion</a>
      <a href="/reservas" style="background:#c2410c;color:white;text-decoration:none;font-size:14px;font-weight:700;padding:9px 22px;border-radius:8px">Reservar</a>
    </div>
  </nav>
  <div style="height:64px"></div>
  <section style="padding:80px 24px;background:#faf7f0;${FS}">
    <div style="max-width:1100px;margin:0 auto">
      <div style="text-align:center;margin-bottom:60px">
        <p style="color:#c2410c;font-size:13px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;margin:0 0 12px">Nuestra galeria</p>
        <h1 style="font-size:42px;font-weight:400;color:#1a0a00;margin:0;${F}">Momentos que inspiran</h1>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px">
        <img src="https://placehold.co/600x400/3d1a00/fde68a?text=Platillo+1" style="width:100%;border-radius:12px;aspect-ratio:4/3;object-fit:cover">
        <img src="https://placehold.co/600x400/92400e/fde68a?text=Ambiente" style="width:100%;border-radius:12px;aspect-ratio:4/3;object-fit:cover">
        <img src="https://placehold.co/600x400/1a0a00/fde68a?text=Chef" style="width:100%;border-radius:12px;aspect-ratio:4/3;object-fit:cover">
        <img src="https://placehold.co/600x400/78350f/fde68a?text=Bebidas" style="width:100%;border-radius:12px;aspect-ratio:4/3;object-fit:cover;grid-column:span 2">
        <img src="https://placehold.co/600x400/451a03/fde68a?text=Postres" style="width:100%;border-radius:12px;aspect-ratio:4/3;object-fit:cover">
      </div>
    </div>
  </section>
  <footer style="background:#1a0a00;color:rgba(255,255,255,0.7);padding:48px 40px;text-align:center;${FS}">
    <p style="margin:0 0 8px;font-size:20px;font-weight:700;color:white">RestauranteName</p>
    <p style="margin:0;font-size:14px">Av. Principal 123 · Tel: 55 1234-5678</p>
    <p style="margin:24px 0 0;font-size:12px;color:rgba(255,255,255,0.4)">&copy; 2025 RestauranteName.</p>
  </footer>`,
        css: ``,
      },
      {
        id: 'reservas',
        label: 'Reservas',
        routePath: '/reservas',
        title: 'Reservaciones',
        required: false,
        html: `
  <nav style="position:fixed;top:0;left:0;right:0;z-index:100;background:rgba(15,10,5,0.9);backdrop-filter:blur(12px);padding:0 40px;height:64px;display:flex;align-items:center;justify-content:space-between;${FS}">
    <a href="/" style="font-size:22px;font-weight:800;color:white;text-decoration:none">RestauranteName</a>
    <div style="display:flex;gap:28px;align-items:center">
      <a href="/menu" style="color:rgba(255,255,255,0.8);text-decoration:none;font-size:14px">Menu</a>
      <a href="/galeria" style="color:rgba(255,255,255,0.8);text-decoration:none;font-size:14px">Galeria</a>
      <a href="/acceso" style="color:rgba(255,255,255,0.8);text-decoration:none;font-size:14px">Iniciar sesion</a>
    </div>
  </nav>
  <div style="height:64px"></div>
  <section style="min-height:calc(100vh - 64px);padding:80px 24px;background:linear-gradient(135deg,#1a0a00,#3d1a00);display:flex;align-items:center;justify-content:center;${FS}">
    <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:20px;padding:48px;max-width:560px;width:100%">
      <h1 style="font-size:36px;font-weight:400;color:white;margin:0 0 8px;${F}">Haz tu reservacion</h1>
      <p style="color:rgba(255,255,255,0.6);margin:0 0 36px;font-size:15px">Reserva tu mesa en minutos. Te confirmamos por correo.</p>
      <div style="display:grid;gap:16px">
        <div><label style="display:block;color:rgba(255,255,255,0.7);font-size:13px;margin-bottom:6px">Nombre completo</label><input placeholder="Tu nombre" style="width:100%;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);color:white;border-radius:10px;padding:12px 16px;font-size:15px;box-sizing:border-box;outline:none"></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
          <div><label style="display:block;color:rgba(255,255,255,0.7);font-size:13px;margin-bottom:6px">Fecha</label><input type="date" style="width:100%;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);color:white;border-radius:10px;padding:12px 16px;font-size:15px;box-sizing:border-box;outline:none"></div>
          <div><label style="display:block;color:rgba(255,255,255,0.7);font-size:13px;margin-bottom:6px">Personas</label><input placeholder="2" type="number" style="width:100%;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);color:white;border-radius:10px;padding:12px 16px;font-size:15px;box-sizing:border-box;outline:none"></div>
        </div>
        <div><label style="display:block;color:rgba(255,255,255,0.7);font-size:13px;margin-bottom:6px">Correo electronico</label><input type="email" placeholder="tu@correo.com" style="width:100%;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);color:white;border-radius:10px;padding:12px 16px;font-size:15px;box-sizing:border-box;outline:none"></div>
        <button style="background:#c2410c;color:white;border:none;border-radius:10px;padding:14px;font-size:16px;font-weight:700;cursor:pointer">Confirmar reservacion</button>
      </div>
    </div>
  </section>`,
        css: ``,
      },
      {
        id: 'contacto',
        label: 'Contacto',
        routePath: '/contacto',
        title: 'Contacto',
        required: false,
        html: `
  <nav style="position:fixed;top:0;left:0;right:0;z-index:100;background:rgba(15,10,5,0.9);backdrop-filter:blur(12px);padding:0 40px;height:64px;display:flex;align-items:center;justify-content:space-between;${FS}">
    <a href="/" style="font-size:22px;font-weight:800;color:white;text-decoration:none">RestauranteName</a>
    <div style="display:flex;gap:28px;align-items:center">
      <a href="/menu" style="color:rgba(255,255,255,0.8);text-decoration:none;font-size:14px">Menu</a>
      <a href="/reservas" style="color:rgba(255,255,255,0.8);text-decoration:none;font-size:14px">Reservas</a>
      <a href="/acceso" style="color:rgba(255,255,255,0.8);text-decoration:none;font-size:14px">Iniciar sesion</a>
    </div>
  </nav>
  <div style="height:64px"></div>
  <section style="padding:80px 24px;background:#faf7f0;${FS}">
    <div style="max-width:900px;margin:0 auto;display:grid;grid-template-columns:1fr 1fr;gap:64px">
      <div>
        <h1 style="font-size:40px;font-weight:400;color:#1a0a00;margin:0 0 20px;${F}">Visitanos</h1>
        <p style="color:#78716c;font-size:16px;line-height:1.7;margin:0 0 36px">Estamos ubicados en el corazon de la ciudad. Te esperamos de martes a domingo.</p>
        <div style="space-y:16px">
          <div style="display:flex;gap:14px;margin-bottom:20px"><span style="font-size:22px">📍</span><div><p style="margin:0;font-weight:600;color:#1a0a00">Direccion</p><p style="margin:4px 0 0;color:#78716c;font-size:14px">Av. Principal 123, Col. Centro</p></div></div>
          <div style="display:flex;gap:14px;margin-bottom:20px"><span style="font-size:22px">🕐</span><div><p style="margin:0;font-weight:600;color:#1a0a00">Horarios</p><p style="margin:4px 0 0;color:#78716c;font-size:14px">Mar–Dom: 1pm – 11pm</p></div></div>
          <div style="display:flex;gap:14px"><span style="font-size:22px">📞</span><div><p style="margin:0;font-weight:600;color:#1a0a00">Telefono</p><p style="margin:4px 0 0;color:#78716c;font-size:14px">55 1234-5678</p></div></div>
        </div>
      </div>
      <div>
        <div style="background:white;border-radius:16px;padding:32px;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
          <h2 style="margin:0 0 24px;font-size:20px;font-weight:700;color:#1a0a00">Envíanos un mensaje</h2>
          <div style="display:grid;gap:14px">
            <input placeholder="Tu nombre" style="border:1px solid #e5e7eb;border-radius:8px;padding:11px 14px;font-size:15px;outline:none;width:100%;box-sizing:border-box">
            <input type="email" placeholder="tu@correo.com" style="border:1px solid #e5e7eb;border-radius:8px;padding:11px 14px;font-size:15px;outline:none;width:100%;box-sizing:border-box">
            <textarea placeholder="Tu mensaje..." rows="4" style="border:1px solid #e5e7eb;border-radius:8px;padding:11px 14px;font-size:15px;outline:none;width:100%;box-sizing:border-box;resize:vertical"></textarea>
            <button style="background:#c2410c;color:white;border:none;border-radius:8px;padding:12px;font-size:15px;font-weight:700;cursor:pointer">Enviar mensaje</button>
          </div>
        </div>
      </div>
    </div>
  </section>
  <footer style="background:#1a0a00;color:rgba(255,255,255,0.7);padding:32px 40px;text-align:center;${FS}">
    <p style="margin:0;font-size:14px">Av. Principal 123 · 55 1234-5678 · <a href="mailto:hola@restaurante.com" style="color:#fbbf24;text-decoration:none">hola@restaurante.com</a></p>
    <p style="margin:16px 0 0;font-size:12px;color:rgba(255,255,255,0.4)">&copy; 2025 RestauranteName.</p>
  </footer>`,
        css: ``,
      },
    ],
  }
  ```

- [ ] **Step 2: Verificar sintaxis**

  ```bash
  node --check apps/desktop/src/website/atlasTemplates/templateRestaurante.js
  ```
  Expected: sin output (limpio).

- [ ] **Step 3: Commit**

  ```bash
  git add apps/desktop/src/website/atlasTemplates/templateRestaurante.js
  git commit -m "feat(website): migrate templateRestaurante to multi-page format"
  ```

---

## Task 2 — Migrar templateSpa.js

**Files:**
- Modify: `apps/desktop/src/website/atlasTemplates/templateSpa.js`

- [ ] **Step 1: Reemplazar el archivo**

  ```js
  const F = "font-family:Georgia,'Playfair Display',serif"
  const FS = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"

  export const templateSpa = {
    id: 'spa',
    label: 'Spa / Bienestar',
    category: 'bienestar',
    description: 'Perfecto para spas, centros de bienestar, yoga y belleza. Elegante y sereno.',
    color: '#065f46',
    pages: [
      {
        id: 'home',
        label: 'Inicio',
        routePath: '/',
        title: 'Inicio',
        required: true,
        html: `<!-- HTML existente del archivo actual — añadir antes de "Reservar cita":
  <a href="/acceso" style="color:#374151;text-decoration:none;font-size:14px;font-weight:500">Iniciar sesion</a>
  -->`,
        css: ``,
      },
      {
        id: 'servicios',
        label: 'Servicios',
        routePath: '/servicios',
        title: 'Nuestros Servicios',
        required: false,
        html: `
  <nav style="background:rgba(255,255,255,0.95);backdrop-filter:blur(12px);padding:0 40px;height:68px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(0,0,0,0.06);position:sticky;top:0;z-index:100;${FS}">
    <a href="/" style="font-size:20px;font-weight:300;color:#065f46;letter-spacing:0.08em;text-transform:uppercase;text-decoration:none">Serenity Spa</a>
    <div style="display:flex;gap:28px;align-items:center">
      <a href="/tratamientos" style="color:#374151;text-decoration:none;font-size:14px">Tratamientos</a>
      <a href="/precios" style="color:#374151;text-decoration:none;font-size:14px">Precios</a>
      <a href="/contacto" style="color:#374151;text-decoration:none;font-size:14px">Contacto</a>
      <a href="/acceso" style="color:#374151;text-decoration:none;font-size:14px">Iniciar sesion</a>
      <a href="/contacto" style="background:#065f46;color:white;text-decoration:none;font-size:14px;font-weight:600;padding:10px 24px;border-radius:999px">Reservar cita</a>
    </div>
  </nav>
  <section style="padding:80px 24px;background:white;${FS}">
    <div style="max-width:1100px;margin:0 auto">
      <div style="text-align:center;margin-bottom:64px">
        <p style="color:#065f46;font-size:12px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;margin:0 0 12px">Lo que ofrecemos</p>
        <h1 style="font-size:42px;font-weight:300;color:#1f2937;margin:0;${F}">Servicios de bienestar</h1>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:32px">
        <div style="text-align:center;padding:32px 24px;border-radius:16px;border:1px solid #d1fae5">
          <div style="font-size:40px;margin-bottom:16px">🧘</div>
          <h3 style="font-size:18px;font-weight:600;color:#1f2937;margin:0 0 12px">Yoga y meditacion</h3>
          <p style="font-size:14px;color:#6b7280;line-height:1.6;margin:0">Clases para todos los niveles. Encuentra tu equilibrio interior con nuestros instructores certificados.</p>
        </div>
        <div style="text-align:center;padding:32px 24px;border-radius:16px;border:1px solid #d1fae5">
          <div style="font-size:40px;margin-bottom:16px">💆</div>
          <h3 style="font-size:18px;font-weight:600;color:#1f2937;margin:0 0 12px">Masajes terapeuticos</h3>
          <p style="font-size:14px;color:#6b7280;line-height:1.6;margin:0">Relajacion profunda con tecnicas suecas, de tejido profundo y aromaterapia.</p>
        </div>
        <div style="text-align:center;padding:32px 24px;border-radius:16px;border:1px solid #d1fae5">
          <div style="font-size:40px;margin-bottom:16px">🌿</div>
          <h3 style="font-size:18px;font-weight:600;color:#1f2937;margin:0 0 12px">Tratamientos faciales</h3>
          <p style="font-size:14px;color:#6b7280;line-height:1.6;margin:0">Cuidado facial personalizado con productos naturales y organicos de alta calidad.</p>
        </div>
        <div style="text-align:center;padding:32px 24px;border-radius:16px;border:1px solid #d1fae5">
          <div style="font-size:40px;margin-bottom:16px">🛁</div>
          <h3 style="font-size:18px;font-weight:600;color:#1f2937;margin:0 0 12px">Banos termales</h3>
          <p style="font-size:14px;color:#6b7280;line-height:1.6;margin:0">Circuito de aguas termales con vapor, jacuzzi y tina fria para una experiencia completa.</p>
        </div>
        <div style="text-align:center;padding:32px 24px;border-radius:16px;border:1px solid #d1fae5">
          <div style="font-size:40px;margin-bottom:16px">✨</div>
          <h3 style="font-size:18px;font-weight:600;color:#1f2937;margin:0 0 12px">Exfoliaciones corporales</h3>
          <p style="font-size:14px;color:#6b7280;line-height:1.6;margin:0">Elimina celulas muertas y renueva tu piel con nuestras exfoliaciones con sales y scrubs.</p>
        </div>
        <div style="text-align:center;padding:32px 24px;border-radius:16px;border:1px solid #d1fae5">
          <div style="font-size:40px;margin-bottom:16px">💅</div>
          <h3 style="font-size:18px;font-weight:600;color:#1f2937;margin:0 0 12px">Manicure y pedicure</h3>
          <p style="font-size:14px;color:#6b7280;line-height:1.6;margin:0">Cuidado de manos y pies con productos premium y tecnicas de relajacion.</p>
        </div>
      </div>
    </div>
  </section>
  <footer style="background:#022c22;color:rgba(255,255,255,0.7);padding:40px;text-align:center;${FS}">
    <p style="margin:0 0 8px;font-size:18px;font-weight:300;color:white;letter-spacing:0.1em;text-transform:uppercase">Serenity Spa</p>
    <p style="margin:0;font-size:13px">contacto@serenityspa.com · 55 9876-5432</p>
    <p style="margin:20px 0 0;font-size:12px;color:rgba(255,255,255,0.4)">&copy; 2025 Serenity Spa.</p>
  </footer>`,
        css: ``,
      },
      {
        id: 'precios',
        label: 'Precios',
        routePath: '/precios',
        title: 'Precios y Paquetes',
        required: false,
        html: `
  <nav style="background:rgba(255,255,255,0.95);backdrop-filter:blur(12px);padding:0 40px;height:68px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(0,0,0,0.06);position:sticky;top:0;z-index:100;${FS}">
    <a href="/" style="font-size:20px;font-weight:300;color:#065f46;letter-spacing:0.08em;text-transform:uppercase;text-decoration:none">Serenity Spa</a>
    <div style="display:flex;gap:24px;align-items:center">
      <a href="/servicios" style="color:#374151;text-decoration:none;font-size:14px">Servicios</a>
      <a href="/contacto" style="color:#374151;text-decoration:none;font-size:14px">Contacto</a>
      <a href="/acceso" style="color:#374151;text-decoration:none;font-size:14px">Iniciar sesion</a>
      <a href="/contacto" style="background:#065f46;color:white;text-decoration:none;font-size:14px;font-weight:600;padding:10px 24px;border-radius:999px">Reservar</a>
    </div>
  </nav>
  <section style="padding:80px 24px;background:#f0fdf4;${FS}">
    <div style="max-width:900px;margin:0 auto">
      <div style="text-align:center;margin-bottom:60px">
        <h1 style="font-size:42px;font-weight:300;color:#1f2937;margin:0 0 16px;${F}">Paquetes y precios</h1>
        <p style="font-size:16px;color:#6b7280;margin:0">Invierte en tu bienestar. Todos los precios incluyen acceso al area termal.</p>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:24px">
        <div style="background:white;border-radius:20px;padding:32px 24px;text-align:center;border:2px solid #d1fae5">
          <p style="font-size:13px;font-weight:700;color:#065f46;letter-spacing:0.1em;text-transform:uppercase;margin:0 0 16px">Basico</p>
          <p style="font-size:52px;font-weight:700;color:#1f2937;margin:0;line-height:1">$650<span style="font-size:18px;font-weight:400;color:#6b7280">/sesion</span></p>
          <ul style="list-style:none;padding:0;margin:24px 0 32px;text-align:left;font-size:14px;color:#374151">
            <li style="padding:8px 0;border-bottom:1px solid #f1f5f9">✓ Masaje de 60 min</li>
            <li style="padding:8px 0;border-bottom:1px solid #f1f5f9">✓ Acceso termal 2h</li>
            <li style="padding:8px 0">✓ Kit de bienvenida</li>
          </ul>
          <a href="/contacto" style="display:block;background:#065f46;color:white;text-decoration:none;border-radius:999px;padding:12px;font-weight:600;font-size:15px">Reservar</a>
        </div>
        <div style="background:#065f46;border-radius:20px;padding:32px 24px;text-align:center;transform:scale(1.04)">
          <p style="font-size:13px;font-weight:700;color:#6ee7b7;letter-spacing:0.1em;text-transform:uppercase;margin:0 0 16px">Popular</p>
          <p style="font-size:52px;font-weight:700;color:white;margin:0;line-height:1">$1,200<span style="font-size:18px;font-weight:400;color:rgba(255,255,255,0.7)">/sesion</span></p>
          <ul style="list-style:none;padding:0;margin:24px 0 32px;text-align:left;font-size:14px;color:rgba(255,255,255,0.9)">
            <li style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.1)">✓ Masaje de 90 min</li>
            <li style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.1)">✓ Facial express</li>
            <li style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.1)">✓ Acceso termal 4h</li>
            <li style="padding:8px 0">✓ Snack saludable</li>
          </ul>
          <a href="/contacto" style="display:block;background:white;color:#065f46;text-decoration:none;border-radius:999px;padding:12px;font-weight:700;font-size:15px">Reservar</a>
        </div>
        <div style="background:white;border-radius:20px;padding:32px 24px;text-align:center;border:2px solid #d1fae5">
          <p style="font-size:13px;font-weight:700;color:#065f46;letter-spacing:0.1em;text-transform:uppercase;margin:0 0 16px">Premium</p>
          <p style="font-size:52px;font-weight:700;color:#1f2937;margin:0;line-height:1">$1,900<span style="font-size:18px;font-weight:400;color:#6b7280">/sesion</span></p>
          <ul style="list-style:none;padding:0;margin:24px 0 32px;text-align:left;font-size:14px;color:#374151">
            <li style="padding:8px 0;border-bottom:1px solid #f1f5f9">✓ Masaje de 2h</li>
            <li style="padding:8px 0;border-bottom:1px solid #f1f5f9">✓ Facial completo</li>
            <li style="padding:8px 0;border-bottom:1px solid #f1f5f9">✓ Exfoliacion corporal</li>
            <li style="padding:8px 0;border-bottom:1px solid #f1f5f9">✓ Acceso termal todo el dia</li>
            <li style="padding:8px 0">✓ Cena ligera incluida</li>
          </ul>
          <a href="/contacto" style="display:block;background:#065f46;color:white;text-decoration:none;border-radius:999px;padding:12px;font-weight:600;font-size:15px">Reservar</a>
        </div>
      </div>
    </div>
  </section>
  <footer style="background:#022c22;color:rgba(255,255,255,0.7);padding:40px;text-align:center;${FS}">
    <p style="margin:0 0 8px;font-size:18px;font-weight:300;color:white;letter-spacing:0.1em;text-transform:uppercase">Serenity Spa</p>
    <p style="margin:0;font-size:13px">contacto@serenityspa.com · 55 9876-5432</p>
    <p style="margin:20px 0 0;font-size:12px;color:rgba(255,255,255,0.4)">&copy; 2025 Serenity Spa.</p>
  </footer>`,
        css: ``,
      },
      {
        id: 'contacto',
        label: 'Contacto',
        routePath: '/contacto',
        title: 'Contacto y Reservas',
        required: false,
        html: `
  <nav style="background:rgba(255,255,255,0.95);backdrop-filter:blur(12px);padding:0 40px;height:68px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(0,0,0,0.06);position:sticky;top:0;z-index:100;${FS}">
    <a href="/" style="font-size:20px;font-weight:300;color:#065f46;letter-spacing:0.08em;text-transform:uppercase;text-decoration:none">Serenity Spa</a>
    <div style="display:flex;gap:24px;align-items:center">
      <a href="/servicios" style="color:#374151;text-decoration:none;font-size:14px">Servicios</a>
      <a href="/precios" style="color:#374151;text-decoration:none;font-size:14px">Precios</a>
      <a href="/acceso" style="color:#374151;text-decoration:none;font-size:14px">Iniciar sesion</a>
    </div>
  </nav>
  <section style="padding:80px 24px;background:white;${FS}">
    <div style="max-width:800px;margin:0 auto;text-align:center">
      <h1 style="font-size:42px;font-weight:300;color:#1f2937;margin:0 0 16px;${F}">Reserva tu cita</h1>
      <p style="font-size:16px;color:#6b7280;margin:0 0 48px">Comunicate con nosotros y te ayudamos a encontrar el tratamiento ideal.</p>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:24px;margin-bottom:48px">
        <div style="padding:24px;background:#f0fdf4;border-radius:12px"><p style="font-size:24px;margin:0 0 8px">📍</p><p style="margin:0;font-weight:600;color:#1f2937;font-size:14px">Ubicacion</p><p style="margin:4px 0 0;font-size:13px;color:#6b7280">Calle Tranquilidad 45, Col. Verde</p></div>
        <div style="padding:24px;background:#f0fdf4;border-radius:12px"><p style="font-size:24px;margin:0 0 8px">📞</p><p style="margin:0;font-weight:600;color:#1f2937;font-size:14px">Telefono</p><p style="margin:4px 0 0;font-size:13px;color:#6b7280">55 9876-5432</p></div>
        <div style="padding:24px;background:#f0fdf4;border-radius:12px"><p style="font-size:24px;margin:0 0 8px">🕐</p><p style="margin:0;font-weight:600;color:#1f2937;font-size:14px">Horarios</p><p style="margin:4px 0 0;font-size:13px;color:#6b7280">Lun–Dom: 9am – 8pm</p></div>
      </div>
      <div style="background:#f0fdf4;border-radius:20px;padding:40px">
        <div style="display:grid;gap:14px;max-width:480px;margin:0 auto">
          <input placeholder="Nombre completo" style="border:1px solid #a7f3d0;border-radius:10px;padding:12px 16px;font-size:15px;outline:none;width:100%;box-sizing:border-box;background:white">
          <input type="email" placeholder="Correo electronico" style="border:1px solid #a7f3d0;border-radius:10px;padding:12px 16px;font-size:15px;outline:none;width:100%;box-sizing:border-box;background:white">
          <input placeholder="Servicio de interes" style="border:1px solid #a7f3d0;border-radius:10px;padding:12px 16px;font-size:15px;outline:none;width:100%;box-sizing:border-box;background:white">
          <textarea placeholder="Notas adicionales..." rows="3" style="border:1px solid #a7f3d0;border-radius:10px;padding:12px 16px;font-size:15px;outline:none;width:100%;box-sizing:border-box;background:white;resize:vertical"></textarea>
          <button style="background:#065f46;color:white;border:none;border-radius:999px;padding:14px;font-size:15px;font-weight:600;cursor:pointer">Enviar solicitud</button>
        </div>
      </div>
    </div>
  </section>
  <footer style="background:#022c22;color:rgba(255,255,255,0.7);padding:40px;text-align:center;${FS}">
    <p style="margin:0 0 8px;font-size:18px;font-weight:300;color:white;letter-spacing:0.1em;text-transform:uppercase">Serenity Spa</p>
    <p style="margin:0;font-size:13px">contacto@serenityspa.com · 55 9876-5432</p>
    <p style="margin:20px 0 0;font-size:12px;color:rgba(255,255,255,0.4)">&copy; 2025 Serenity Spa.</p>
  </footer>`,
        css: ``,
      },
    ],
  }
  ```

  **NOTA sobre la página `home`:** El HTML de `home` es el HTML existente en el archivo actual. Solo añade `category: 'bienestar'` y el login link en el nav. El login link va antes de `"Reservar cita"`: `<a href="/acceso" style="color:#374151;text-decoration:none;font-size:14px;font-weight:500">Iniciar sesion</a>`

- [ ] **Step 2: Verificar sintaxis**

  ```bash
  node --check apps/desktop/src/website/atlasTemplates/templateSpa.js
  ```
  Expected: sin output.

- [ ] **Step 3: Commit**

  ```bash
  git add apps/desktop/src/website/atlasTemplates/templateSpa.js
  git commit -m "feat(website): migrate templateSpa to multi-page format"
  ```

---

## Tasks 3–6 — Migrar templateAgencia, templateEcommerce, templateServicios, templateNegocio

**Files:**
- Modify: `apps/desktop/src/website/atlasTemplates/templateAgencia.js`
- Modify: `apps/desktop/src/website/atlasTemplates/templateEcommerce.js`
- Modify: `apps/desktop/src/website/atlasTemplates/templateServicios.js`
- Modify: `apps/desktop/src/website/atlasTemplates/templateNegocio.js`

Aplica el mismo patrón de migración que Tasks 1–2. Para cada archivo:
1. Añade `category`
2. Envuelve el HTML existente como `pages[0]` con `required: true, routePath: '/', id: 'home'`
3. Añade el login link al nav del home (antes del CTA button)
4. Añade las páginas extra según la tabla del spec

- [ ] **Step 1: Migrar templateAgencia.js** — `category: 'tecnologia'`

  Páginas extra a crear:
  ```js
  // Patrón nav agencia (fondo azul oscuro similar al home):
  // color primario: #1e40af, texto links nav: rgba(255,255,255,0.8)
  // login link style: color:rgba(255,255,255,0.8)

  // PÁGINA: /servicios
  {
    id: 'servicios', label: 'Servicios', routePath: '/servicios', title: 'Nuestros Servicios', required: false,
    html: `
  <nav style="background:#0f172a;padding:0 40px;height:64px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
    <a href="/" style="font-size:20px;font-weight:800;color:white;text-decoration:none">AgenciaNombre</a>
    <div style="display:flex;gap:24px;align-items:center">
      <a href="/portafolio" style="color:rgba(255,255,255,0.8);text-decoration:none;font-size:14px">Portafolio</a>
      <a href="/equipo" style="color:rgba(255,255,255,0.8);text-decoration:none;font-size:14px">Equipo</a>
      <a href="/acceso" style="color:rgba(255,255,255,0.8);text-decoration:none;font-size:14px">Iniciar sesion</a>
      <a href="/contacto" style="background:#2563eb;color:white;text-decoration:none;font-size:14px;font-weight:700;padding:9px 22px;border-radius:8px">Contactar</a>
    </div>
  </nav>
  <section style="padding:80px 24px;background:white;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
    <div style="max-width:1100px;margin:0 auto">
      <div style="text-align:center;margin-bottom:60px"><p style="color:#2563eb;font-size:12px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;margin:0 0 12px">Lo que hacemos</p><h1 style="font-size:44px;font-weight:800;color:#0f172a;margin:0;letter-spacing:-0.02em">Servicios digitales</h1></div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:28px">
        <div style="padding:28px;border-radius:16px;border:1px solid #e2e8f0"><div style="width:48px;height:48px;background:#eff6ff;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:22px;margin-bottom:16px">🌐</div><h3 style="margin:0 0 10px;font-size:18px;font-weight:700;color:#0f172a">Desarrollo web</h3><p style="margin:0;font-size:14px;color:#64748b;line-height:1.6">Sitios y aplicaciones web de alto rendimiento con las tecnologias mas modernas.</p></div>
        <div style="padding:28px;border-radius:16px;border:1px solid #e2e8f0"><div style="width:48px;height:48px;background:#eff6ff;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:22px;margin-bottom:16px">📱</div><h3 style="margin:0 0 10px;font-size:18px;font-weight:700;color:#0f172a">Apps moviles</h3><p style="margin:0;font-size:14px;color:#64748b;line-height:1.6">Aplicaciones iOS y Android con experiencias de usuario excepcionales.</p></div>
        <div style="padding:28px;border-radius:16px;border:1px solid #e2e8f0"><div style="width:48px;height:48px;background:#eff6ff;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:22px;margin-bottom:16px">📊</div><h3 style="margin:0 0 10px;font-size:18px;font-weight:700;color:#0f172a">Estrategia digital</h3><p style="margin:0;font-size:14px;color:#64748b;line-height:1.6">SEO, SEM y marketing de contenidos para crecer tu presencia en linea.</p></div>
        <div style="padding:28px;border-radius:16px;border:1px solid #e2e8f0"><div style="width:48px;height:48px;background:#eff6ff;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:22px;margin-bottom:16px">🎨</div><h3 style="margin:0 0 10px;font-size:18px;font-weight:700;color:#0f172a">Diseno UX/UI</h3><p style="margin:0;font-size:14px;color:#64748b;line-height:1.6">Interfaces intuitivas y atractivas centradas en la experiencia del usuario.</p></div>
        <div style="padding:28px;border-radius:16px;border:1px solid #e2e8f0"><div style="width:48px;height:48px;background:#eff6ff;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:22px;margin-bottom:16px">⚡</div><h3 style="margin:0 0 10px;font-size:18px;font-weight:700;color:#0f172a">Automatizacion</h3><p style="margin:0;font-size:14px;color:#64748b;line-height:1.6">Optimizacion de procesos con IA y herramientas de automatizacion empresarial.</p></div>
        <div style="padding:28px;border-radius:16px;border:1px solid #e2e8f0"><div style="width:48px;height:48px;background:#eff6ff;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:22px;margin-bottom:16px">🔒</div><h3 style="margin:0 0 10px;font-size:18px;font-weight:700;color:#0f172a">Ciberseguridad</h3><p style="margin:0;font-size:14px;color:#64748b;line-height:1.6">Auditoria y proteccion de sistemas para mantener tu empresa segura.</p></div>
      </div>
    </div>
  </section>
  <footer style="background:#0f172a;color:rgba(255,255,255,0.6);padding:40px;text-align:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
    <p style="margin:0 0 8px;font-size:18px;font-weight:800;color:white">AgenciaNombre</p>
    <p style="margin:0;font-size:13px">hola@agencia.com · 55 0000-1111</p>
    <p style="margin:20px 0 0;font-size:12px;color:rgba(255,255,255,0.3)">&copy; 2025 AgenciaNombre.</p>
  </footer>`, css: ``
  },

  // PÁGINA: /portafolio
  {
    id: 'portafolio', label: 'Portafolio', routePath: '/portafolio', title: 'Portafolio', required: false,
    html: `
  <nav style="background:#0f172a;padding:0 40px;height:64px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
    <a href="/" style="font-size:20px;font-weight:800;color:white;text-decoration:none">AgenciaNombre</a>
    <div style="display:flex;gap:24px;align-items:center">
      <a href="/servicios" style="color:rgba(255,255,255,0.8);text-decoration:none;font-size:14px">Servicios</a>
      <a href="/acceso" style="color:rgba(255,255,255,0.8);text-decoration:none;font-size:14px">Iniciar sesion</a>
      <a href="/contacto" style="background:#2563eb;color:white;text-decoration:none;font-size:14px;font-weight:700;padding:9px 22px;border-radius:8px">Contactar</a>
    </div>
  </nav>
  <section style="padding:80px 24px;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
    <div style="max-width:1100px;margin:0 auto">
      <div style="text-align:center;margin-bottom:60px"><h1 style="font-size:44px;font-weight:800;color:#0f172a;margin:0;letter-spacing:-0.02em">Nuestro portafolio</h1><p style="font-size:17px;color:#64748b;margin:16px 0 0">Proyectos que hablan por si mismos.</p></div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:24px">
        <div style="border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.07)"><img src="https://placehold.co/600x400/1e40af/ffffff?text=Proyecto+1" style="width:100%;height:180px;object-fit:cover"><div style="padding:20px;background:white"><p style="margin:0;font-weight:700;color:#0f172a">E-commerce Fashion</p><p style="margin:4px 0 0;font-size:13px;color:#64748b">Desarrollo web · Diseno UI</p></div></div>
        <div style="border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.07)"><img src="https://placehold.co/600x400/1d4ed8/ffffff?text=Proyecto+2" style="width:100%;height:180px;object-fit:cover"><div style="padding:20px;background:white"><p style="margin:0;font-weight:700;color:#0f172a">App de delivery</p><p style="margin:4px 0 0;font-size:13px;color:#64748b">App movil · Backend</p></div></div>
        <div style="border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.07)"><img src="https://placehold.co/600x400/2563eb/ffffff?text=Proyecto+3" style="width:100%;height:180px;object-fit:cover"><div style="padding:20px;background:white"><p style="margin:0;font-weight:700;color:#0f172a">Dashboard analytics</p><p style="margin:4px 0 0;font-size:13px;color:#64748b">SaaS · Automatizacion</p></div></div>
        <div style="border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.07)"><img src="https://placehold.co/600x400/1e3a8a/ffffff?text=Proyecto+4" style="width:100%;height:180px;object-fit:cover"><div style="padding:20px;background:white"><p style="margin:0;font-weight:700;color:#0f172a">Portal corporativo</p><p style="margin:4px 0 0;font-size:13px;color:#64748b">Desarrollo web · CMS</p></div></div>
        <div style="border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.07)"><img src="https://placehold.co/600x400/1e40af/dbeafe?text=Proyecto+5" style="width:100%;height:180px;object-fit:cover"><div style="padding:20px;background:white"><p style="margin:0;font-weight:700;color:#0f172a">Plataforma educativa</p><p style="margin:4px 0 0;font-size:13px;color:#64748b">EdTech · UX/UI</p></div></div>
        <div style="border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.07)"><img src="https://placehold.co/600x400/1d4ed8/bfdbfe?text=Proyecto+6" style="width:100%;height:180px;object-fit:cover"><div style="padding:20px;background:white"><p style="margin:0;font-weight:700;color:#0f172a">Sistema de reservas</p><p style="margin:4px 0 0;font-size:13px;color:#64748b">App web · Integraciones</p></div></div>
      </div>
    </div>
  </section>
  <footer style="background:#0f172a;color:rgba(255,255,255,0.6);padding:40px;text-align:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
    <p style="margin:0 0 8px;font-size:18px;font-weight:800;color:white">AgenciaNombre</p>
    <p style="margin:0;font-size:13px">hola@agencia.com · 55 0000-1111</p>
    <p style="margin:20px 0 0;font-size:12px;color:rgba(255,255,255,0.3)">&copy; 2025 AgenciaNombre.</p>
  </footer>`, css: ``
  },

  // PÁGINA: /equipo — misma estructura de nav, grid de cards de equipo
  {
    id: 'equipo', label: 'Equipo', routePath: '/equipo', title: 'Nuestro Equipo', required: false,
    html: `
  <nav style="background:#0f172a;padding:0 40px;height:64px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
    <a href="/" style="font-size:20px;font-weight:800;color:white;text-decoration:none">AgenciaNombre</a>
    <div style="display:flex;gap:24px;align-items:center">
      <a href="/servicios" style="color:rgba(255,255,255,0.8);text-decoration:none;font-size:14px">Servicios</a>
      <a href="/portafolio" style="color:rgba(255,255,255,0.8);text-decoration:none;font-size:14px">Portafolio</a>
      <a href="/acceso" style="color:rgba(255,255,255,0.8);text-decoration:none;font-size:14px">Iniciar sesion</a>
      <a href="/contacto" style="background:#2563eb;color:white;text-decoration:none;font-size:14px;font-weight:700;padding:9px 22px;border-radius:8px">Contactar</a>
    </div>
  </nav>
  <section style="padding:80px 24px;background:white;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
    <div style="max-width:1000px;margin:0 auto">
      <div style="text-align:center;margin-bottom:60px"><h1 style="font-size:44px;font-weight:800;color:#0f172a;margin:0">El equipo</h1><p style="font-size:17px;color:#64748b;margin:16px 0 0">Personas apasionadas por la tecnologia y el diseno.</p></div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:28px">
        <div style="text-align:center"><img src="https://placehold.co/200x200/1e40af/ffffff?text=AM" style="width:80px;height:80px;border-radius:50%;object-fit:cover;margin-bottom:14px"><p style="margin:0;font-weight:700;color:#0f172a">Ana Martinez</p><p style="margin:4px 0 0;font-size:13px;color:#2563eb">CEO & Founder</p></div>
        <div style="text-align:center"><img src="https://placehold.co/200x200/1d4ed8/ffffff?text=CR" style="width:80px;height:80px;border-radius:50%;object-fit:cover;margin-bottom:14px"><p style="margin:0;font-weight:700;color:#0f172a">Carlos Ruiz</p><p style="margin:4px 0 0;font-size:13px;color:#2563eb">Lead Developer</p></div>
        <div style="text-align:center"><img src="https://placehold.co/200x200/2563eb/ffffff?text=SL" style="width:80px;height:80px;border-radius:50%;object-fit:cover;margin-bottom:14px"><p style="margin:0;font-weight:700;color:#0f172a">Sofia Lopez</p><p style="margin:4px 0 0;font-size:13px;color:#2563eb">UX Designer</p></div>
        <div style="text-align:center"><img src="https://placehold.co/200x200/1e3a8a/ffffff?text=MG" style="width:80px;height:80px;border-radius:50%;object-fit:cover;margin-bottom:14px"><p style="margin:0;font-weight:700;color:#0f172a">Miguel Garcia</p><p style="margin:4px 0 0;font-size:13px;color:#2563eb">Marketing</p></div>
      </div>
    </div>
  </section>
  <footer style="background:#0f172a;color:rgba(255,255,255,0.6);padding:40px;text-align:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
    <p style="margin:0 0 8px;font-size:18px;font-weight:800;color:white">AgenciaNombre</p>
    <p style="margin:0;font-size:13px">hola@agencia.com</p>
    <p style="margin:20px 0 0;font-size:12px;color:rgba(255,255,255,0.3)">&copy; 2025 AgenciaNombre.</p>
  </footer>`, css: ``
  },

  // PÁGINA: /contacto — fondo dark con formulario
  {
    id: 'contacto', label: 'Contacto', routePath: '/contacto', title: 'Contacto', required: false,
    html: `
  <nav style="background:#0f172a;padding:0 40px;height:64px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
    <a href="/" style="font-size:20px;font-weight:800;color:white;text-decoration:none">AgenciaNombre</a>
    <div style="display:flex;gap:24px;align-items:center">
      <a href="/servicios" style="color:rgba(255,255,255,0.8);text-decoration:none;font-size:14px">Servicios</a>
      <a href="/portafolio" style="color:rgba(255,255,255,0.8);text-decoration:none;font-size:14px">Portafolio</a>
      <a href="/acceso" style="color:rgba(255,255,255,0.8);text-decoration:none;font-size:14px">Iniciar sesion</a>
    </div>
  </nav>
  <section style="padding:80px 24px;background:white;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
    <div style="max-width:900px;margin:0 auto;display:grid;grid-template-columns:1fr 1fr;gap:64px;align-items:start">
      <div><h1 style="font-size:44px;font-weight:800;color:#0f172a;margin:0 0 20px;letter-spacing:-0.02em">Hablemos</h1><p style="font-size:16px;color:#64748b;line-height:1.7;margin:0 0 36px">Cuéntanos tu proyecto. Respondemos en menos de 24 horas.</p>
        <div style="display:flex;flex-direction:column;gap:20px">
          <div style="display:flex;gap:14px"><span style="font-size:20px">📧</span><div><p style="margin:0;font-weight:600;color:#0f172a">Email</p><p style="margin:4px 0 0;font-size:14px;color:#64748b">hola@agencia.com</p></div></div>
          <div style="display:flex;gap:14px"><span style="font-size:20px">📞</span><div><p style="margin:0;font-weight:600;color:#0f172a">Telefono</p><p style="margin:4px 0 0;font-size:14px;color:#64748b">55 0000-1111</p></div></div>
        </div>
      </div>
      <div style="background:#f8fafc;border-radius:20px;padding:32px">
        <div style="display:grid;gap:14px">
          <input placeholder="Tu nombre" style="border:1px solid #e2e8f0;border-radius:10px;padding:12px 16px;font-size:15px;outline:none;width:100%;box-sizing:border-box">
          <input type="email" placeholder="Correo electronico" style="border:1px solid #e2e8f0;border-radius:10px;padding:12px 16px;font-size:15px;outline:none;width:100%;box-sizing:border-box">
          <input placeholder="Empresa (opcional)" style="border:1px solid #e2e8f0;border-radius:10px;padding:12px 16px;font-size:15px;outline:none;width:100%;box-sizing:border-box">
          <textarea placeholder="Cuentanos sobre tu proyecto..." rows="4" style="border:1px solid #e2e8f0;border-radius:10px;padding:12px 16px;font-size:15px;outline:none;width:100%;box-sizing:border-box;resize:vertical"></textarea>
          <button style="background:#1e40af;color:white;border:none;border-radius:10px;padding:13px;font-size:15px;font-weight:700;cursor:pointer">Enviar mensaje</button>
        </div>
      </div>
    </div>
  </section>
  <footer style="background:#0f172a;color:rgba(255,255,255,0.6);padding:40px;text-align:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
    <p style="margin:0 0 8px;font-size:18px;font-weight:800;color:white">AgenciaNombre</p>
    <p style="margin:0;font-size:13px">hola@agencia.com · 55 0000-1111</p>
    <p style="margin:20px 0 0;font-size:12px;color:rgba(255,255,255,0.3)">&copy; 2025 AgenciaNombre.</p>
  </footer>`, css: ``
  },
  ```

- [ ] **Step 2: Migrar templateEcommerce.js** — `category: 'comercio'`, color: `#166534`

  Páginas extra:
  - `/productos` — grid de productos con precio, imagen, nombre, boton "Ver producto"
  - `/nosotros` — historia de la tienda, valores, equipo pequeño
  - `/contacto` — formulario + dirección + horarios

  Nav color: fondo `#14532d`, links blancos, CTA verde oscuro. Login link antes del CTA.

- [ ] **Step 3: Migrar templateServicios.js** — `category: 'negocios'`, color: `#7c3aed`

  Páginas extra:
  - `/servicios` — grid de 6 servicios con iconos y descripción
  - `/precios` — tabla de 3 planes pricing con features
  - `/clientes` — logos/testimonios de clientes
  - `/contacto` — formulario de contacto

  Nav color: fondo `#4c1d95`, links `rgba(255,255,255,0.8)`.

- [ ] **Step 4: Migrar templateNegocio.js** — `category: 'negocios'`, color: `#374151`

  Páginas extra:
  - `/servicios` — cards de servicios con iconos
  - `/nosotros` — historia, misión, equipo
  - `/contacto` — formulario + datos de contacto

  Nav color: fondo blanco `background:white`, links `#374151`. Login link antes del CTA.

- [ ] **Step 5: Verificar los 4 archivos**

  ```bash
  node --check apps/desktop/src/website/atlasTemplates/templateAgencia.js
  node --check apps/desktop/src/website/atlasTemplates/templateEcommerce.js
  node --check apps/desktop/src/website/atlasTemplates/templateServicios.js
  node --check apps/desktop/src/website/atlasTemplates/templateNegocio.js
  ```

- [ ] **Step 6: Commit**

  ```bash
  git add apps/desktop/src/website/atlasTemplates/templateAgencia.js \
          apps/desktop/src/website/atlasTemplates/templateEcommerce.js \
          apps/desktop/src/website/atlasTemplates/templateServicios.js \
          apps/desktop/src/website/atlasTemplates/templateNegocio.js
  git commit -m "feat(website): migrate remaining 4 templates to multi-page format"
  ```

---

## Task 4 — Crear templateClinica.js

**Files:**
- Create: `apps/desktop/src/website/atlasTemplates/templateClinica.js`

- [ ] **Step 1: Crear el archivo**

  ```js
  const FS = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"
  const FG = "font-family:Georgia,'Merriweather',serif"

  const navClinica = (active) => `
  <nav style="background:white;border-bottom:1px solid #e0f2fe;padding:0 40px;height:68px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100;${FS}">
    <a href="/" style="display:flex;align-items:center;gap:10px;text-decoration:none"><span style="width:36px;height:36px;background:#0e7490;border-radius:8px;display:flex;align-items:center;justify-content:center;color:white;font-weight:900;font-size:16px">+</span><span style="font-size:18px;font-weight:700;color:#0c4a6e">ClinicaNombre</span></a>
    <div style="display:flex;gap:24px;align-items:center">
      <a href="/especialidades" style="color:#374151;text-decoration:none;font-size:14px">Especialidades</a>
      <a href="/equipo" style="color:#374151;text-decoration:none;font-size:14px">Equipo</a>
      <a href="/citas" style="color:#374151;text-decoration:none;font-size:14px">Citas</a>
      <a href="/acceso" style="color:#374151;text-decoration:none;font-size:14px">Iniciar sesion</a>
      <a href="/citas" style="background:#0e7490;color:white;text-decoration:none;font-size:14px;font-weight:700;padding:9px 22px;border-radius:8px">Agendar cita</a>
    </div>
  </nav>`

  const footerClinica = `
  <footer style="background:#0c4a6e;color:rgba(255,255,255,0.7);padding:48px 40px;${FS}">
    <div style="max-width:1100px;margin:0 auto;display:grid;grid-template-columns:2fr 1fr 1fr;gap:48px">
      <div><p style="font-size:20px;font-weight:700;color:white;margin:0 0 12px">ClinicaNombre</p><p style="font-size:14px;line-height:1.6;margin:0">Comprometidos con tu salud y bienestar. Atendemos con calidez y profesionalismo.</p></div>
      <div><p style="font-weight:600;color:white;margin:0 0 14px;font-size:14px">Servicios</p><div style="display:flex;flex-direction:column;gap:8px;font-size:13px"><a href="/especialidades" style="color:rgba(255,255,255,0.7);text-decoration:none">Especialidades</a><a href="/equipo" style="color:rgba(255,255,255,0.7);text-decoration:none">Nuestro equipo</a><a href="/citas" style="color:rgba(255,255,255,0.7);text-decoration:none">Agendar cita</a></div></div>
      <div><p style="font-weight:600;color:white;margin:0 0 14px;font-size:14px">Contacto</p><p style="font-size:13px;margin:0 0 8px">📍 Av. Salud 456, Col. Medica</p><p style="font-size:13px;margin:0 0 8px">📞 55 2233-4455</p><p style="font-size:13px;margin:0">🕐 Lun–Sáb: 8am–8pm</p></div>
    </div>
    <div style="max-width:1100px;margin:24px auto 0;padding-top:24px;border-top:1px solid rgba(255,255,255,0.1);font-size:12px;color:rgba(255,255,255,0.4)">&copy; 2025 ClinicaNombre. Todos los derechos reservados.</div>
  </footer>`

  export const templateClinica = {
    id: 'clinica',
    label: 'Clinica / Salud',
    category: 'salud',
    description: 'Diseno profesional y confiable para clinicas, consultorios y centros medicos.',
    color: '#0e7490',
    pages: [
      {
        id: 'home',
        label: 'Inicio',
        routePath: '/',
        title: 'Inicio',
        required: true,
        html: `${navClinica('')}
  <section style="background:linear-gradient(135deg,#0c4a6e 0%,#0e7490 60%,#06b6d4 100%);padding:100px 24px 80px;${FS}">
    <div style="max-width:1100px;margin:0 auto;display:grid;grid-template-columns:1fr 1fr;gap:60px;align-items:center">
      <div>
        <span style="display:inline-block;background:rgba(255,255,255,0.1);color:#bae6fd;font-size:12px;font-weight:700;padding:5px 16px;border-radius:999px;margin-bottom:20px;letter-spacing:0.1em;text-transform:uppercase">Cuidamos tu salud</span>
        <h1 style="font-size:clamp(36px,5vw,58px);font-weight:800;color:white;line-height:1.1;margin:0 0 20px;letter-spacing:-0.02em">Tu salud, nuestra prioridad</h1>
        <p style="font-size:17px;color:#bae6fd;line-height:1.7;margin:0 0 36px">Atención médica de calidad con los mejores especialistas. Agenda tu cita hoy y recibe la atención que mereces.</p>
        <div style="display:flex;gap:14px;flex-wrap:wrap">
          <a href="/citas" style="background:white;color:#0e7490;font-size:15px;font-weight:700;padding:14px 36px;border-radius:10px;text-decoration:none">Agendar cita</a>
          <a href="/especialidades" style="background:rgba(255,255,255,0.1);color:white;font-size:15px;font-weight:600;padding:14px 36px;border-radius:10px;text-decoration:none;border:1px solid rgba(255,255,255,0.2)">Ver especialidades</a>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        <div style="background:rgba(255,255,255,0.1);border-radius:16px;padding:24px;text-align:center"><p style="font-size:36px;font-weight:800;color:white;margin:0">15+</p><p style="font-size:13px;color:#bae6fd;margin:6px 0 0">Especialidades</p></div>
        <div style="background:rgba(255,255,255,0.1);border-radius:16px;padding:24px;text-align:center"><p style="font-size:36px;font-weight:800;color:white;margin:0">25</p><p style="font-size:13px;color:#bae6fd;margin:6px 0 0">Medicos</p></div>
        <div style="background:rgba(255,255,255,0.1);border-radius:16px;padding:24px;text-align:center"><p style="font-size:36px;font-weight:800;color:white;margin:0">10k+</p><p style="font-size:13px;color:#bae6fd;margin:6px 0 0">Pacientes</p></div>
        <div style="background:rgba(255,255,255,0.1);border-radius:16px;padding:24px;text-align:center"><p style="font-size:36px;font-weight:800;color:white;margin:0">20</p><p style="font-size:13px;color:#bae6fd;margin:6px 0 0">Anos de exp.</p></div>
      </div>
    </div>
  </section>
  <section style="padding:80px 24px;background:white;${FS}">
    <div style="max-width:1100px;margin:0 auto">
      <h2 style="text-align:center;font-size:36px;font-weight:800;color:#0c4a6e;margin:0 0 48px">¿Por que elegirnos?</h2>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:28px">
        <div style="padding:28px;border-radius:16px;background:#f0f9ff;text-align:center"><p style="font-size:36px;margin:0 0 14px">🏥</p><h3 style="margin:0 0 10px;font-weight:700;color:#0c4a6e">Instalaciones modernas</h3><p style="font-size:14px;color:#64748b;margin:0;line-height:1.6">Equipamiento de ultima generacion para diagnosticos precisos y tratamientos efectivos.</p></div>
        <div style="padding:28px;border-radius:16px;background:#f0f9ff;text-align:center"><p style="font-size:36px;margin:0 0 14px">👨‍⚕️</p><h3 style="margin:0 0 10px;font-weight:700;color:#0c4a6e">Especialistas certificados</h3><p style="font-size:14px;color:#64748b;margin:0;line-height:1.6">Medicos con amplia experiencia y certificaciones nacionales e internacionales.</p></div>
        <div style="padding:28px;border-radius:16px;background:#f0f9ff;text-align:center"><p style="font-size:36px;margin:0 0 14px">📅</p><h3 style="margin:0 0 10px;font-weight:700;color:#0c4a6e">Citas rapidas</h3><p style="font-size:14px;color:#64748b;margin:0;line-height:1.6">Agenda en minutos por telefono o en linea. Sin largas esperas.</p></div>
      </div>
    </div>
  </section>
  ${footerClinica}`,
        css: ``,
      },
      {
        id: 'especialidades',
        label: 'Especialidades',
        routePath: '/especialidades',
        title: 'Especialidades Medicas',
        required: false,
        html: `${navClinica('/especialidades')}
  <section style="padding:80px 24px;background:#f0f9ff;${FS}">
    <div style="max-width:1100px;margin:0 auto">
      <div style="text-align:center;margin-bottom:60px"><h1 style="font-size:44px;font-weight:800;color:#0c4a6e;margin:0">Nuestras especialidades</h1><p style="font-size:17px;color:#64748b;margin:16px 0 0">Atención integral con especialistas en cada area.</p></div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:20px">
        <div style="background:white;border-radius:14px;padding:24px;text-align:center;border:1px solid #bae6fd"><p style="font-size:32px;margin:0 0 12px">❤️</p><p style="margin:0;font-weight:700;color:#0c4a6e;font-size:15px">Cardiologia</p></div>
        <div style="background:white;border-radius:14px;padding:24px;text-align:center;border:1px solid #bae6fd"><p style="font-size:32px;margin:0 0 12px">🧠</p><p style="margin:0;font-weight:700;color:#0c4a6e;font-size:15px">Neurologia</p></div>
        <div style="background:white;border-radius:14px;padding:24px;text-align:center;border:1px solid #bae6fd"><p style="font-size:32px;margin:0 0 12px">🦷</p><p style="margin:0;font-weight:700;color:#0c4a6e;font-size:15px">Odontologia</p></div>
        <div style="background:white;border-radius:14px;padding:24px;text-align:center;border:1px solid #bae6fd"><p style="font-size:32px;margin:0 0 12px">👁️</p><p style="margin:0;font-weight:700;color:#0c4a6e;font-size:15px">Oftalmologia</p></div>
        <div style="background:white;border-radius:14px;padding:24px;text-align:center;border:1px solid #bae6fd"><p style="font-size:32px;margin:0 0 12px">🦴</p><p style="margin:0;font-weight:700;color:#0c4a6e;font-size:15px">Ortopedia</p></div>
        <div style="background:white;border-radius:14px;padding:24px;text-align:center;border:1px solid #bae6fd"><p style="font-size:32px;margin:0 0 12px">🤰</p><p style="margin:0;font-weight:700;color:#0c4a6e;font-size:15px">Ginecologia</p></div>
        <div style="background:white;border-radius:14px;padding:24px;text-align:center;border:1px solid #bae6fd"><p style="font-size:32px;margin:0 0 12px">👶</p><p style="margin:0;font-weight:700;color:#0c4a6e;font-size:15px">Pediatria</p></div>
        <div style="background:white;border-radius:14px;padding:24px;text-align:center;border:1px solid #bae6fd"><p style="font-size:32px;margin:0 0 12px">🩺</p><p style="margin:0;font-weight:700;color:#0c4a6e;font-size:15px">Medicina general</p></div>
      </div>
    </div>
  </section>
  ${footerClinica}`,
        css: ``,
      },
      {
        id: 'equipo',
        label: 'Equipo medico',
        routePath: '/equipo',
        title: 'Nuestro Equipo Medico',
        required: false,
        html: `${navClinica('/equipo')}
  <section style="padding:80px 24px;background:white;${FS}">
    <div style="max-width:1100px;margin:0 auto">
      <div style="text-align:center;margin-bottom:60px"><h1 style="font-size:44px;font-weight:800;color:#0c4a6e;margin:0">Nuestros medicos</h1><p style="font-size:17px;color:#64748b;margin:16px 0 0">Especialistas comprometidos con tu bienestar.</p></div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:28px">
        <div style="text-align:center"><img src="https://placehold.co/200x200/0e7490/ffffff?text=Dr.+A" style="width:96px;height:96px;border-radius:50%;object-fit:cover;margin-bottom:14px;border:4px solid #e0f2fe"><p style="margin:0;font-weight:700;color:#0c4a6e">Dr. Alejandro Torres</p><p style="margin:4px 0 0;font-size:13px;color:#0e7490">Cardiologia</p></div>
        <div style="text-align:center"><img src="https://placehold.co/200x200/06b6d4/ffffff?text=Dra.+M" style="width:96px;height:96px;border-radius:50%;object-fit:cover;margin-bottom:14px;border:4px solid #e0f2fe"><p style="margin:0;font-weight:700;color:#0c4a6e">Dra. Maria Vega</p><p style="margin:4px 0 0;font-size:13px;color:#0e7490">Neurologia</p></div>
        <div style="text-align:center"><img src="https://placehold.co/200x200/0891b2/ffffff?text=Dr.+R" style="width:96px;height:96px;border-radius:50%;object-fit:cover;margin-bottom:14px;border:4px solid #e0f2fe"><p style="margin:0;font-weight:700;color:#0c4a6e">Dr. Roberto Salas</p><p style="margin:4px 0 0;font-size:13px;color:#0e7490">Ortopedia</p></div>
        <div style="text-align:center"><img src="https://placehold.co/200x200/0e7490/bae6fd?text=Dra.+P" style="width:96px;height:96px;border-radius:50%;object-fit:cover;margin-bottom:14px;border:4px solid #e0f2fe"><p style="margin:0;font-weight:700;color:#0c4a6e">Dra. Patricia Lima</p><p style="margin:4px 0 0;font-size:13px;color:#0e7490">Pediatria</p></div>
      </div>
    </div>
  </section>
  ${footerClinica}`,
        css: ``,
      },
      {
        id: 'citas',
        label: 'Citas',
        routePath: '/citas',
        title: 'Agendar Cita',
        required: false,
        html: `${navClinica('/citas')}
  <section style="padding:80px 24px;background:#f0f9ff;${FS}">
    <div style="max-width:640px;margin:0 auto">
      <div style="text-align:center;margin-bottom:48px"><h1 style="font-size:44px;font-weight:800;color:#0c4a6e;margin:0">Agenda tu cita</h1><p style="font-size:16px;color:#64748b;margin:14px 0 0">Completa el formulario y te contactamos a la brevedad.</p></div>
      <div style="background:white;border-radius:20px;padding:40px;box-shadow:0 4px 32px rgba(14,116,144,0.1)">
        <div style="display:grid;gap:16px">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
            <div><label style="display:block;font-size:13px;font-weight:600;color:#374151;margin-bottom:6px">Nombre</label><input placeholder="Tu nombre" style="width:100%;border:1px solid #bae6fd;border-radius:8px;padding:11px 14px;font-size:15px;outline:none;box-sizing:border-box"></div>
            <div><label style="display:block;font-size:13px;font-weight:600;color:#374151;margin-bottom:6px">Apellido</label><input placeholder="Apellido" style="width:100%;border:1px solid #bae6fd;border-radius:8px;padding:11px 14px;font-size:15px;outline:none;box-sizing:border-box"></div>
          </div>
          <div><label style="display:block;font-size:13px;font-weight:600;color:#374151;margin-bottom:6px">Especialidad</label><select style="width:100%;border:1px solid #bae6fd;border-radius:8px;padding:11px 14px;font-size:15px;outline:none;box-sizing:border-box;background:white"><option>Medicina general</option><option>Cardiologia</option><option>Neurologia</option><option>Ortopedia</option><option>Pediatria</option></select></div>
          <div><label style="display:block;font-size:13px;font-weight:600;color:#374151;margin-bottom:6px">Fecha preferida</label><input type="date" style="width:100%;border:1px solid #bae6fd;border-radius:8px;padding:11px 14px;font-size:15px;outline:none;box-sizing:border-box"></div>
          <div><label style="display:block;font-size:13px;font-weight:600;color:#374151;margin-bottom:6px">Telefono de contacto</label><input type="tel" placeholder="55 0000-0000" style="width:100%;border:1px solid #bae6fd;border-radius:8px;padding:11px 14px;font-size:15px;outline:none;box-sizing:border-box"></div>
          <div><label style="display:block;font-size:13px;font-weight:600;color:#374151;margin-bottom:6px">Motivo de consulta</label><textarea placeholder="Describe brevemente tu motivo de consulta..." rows="3" style="width:100%;border:1px solid #bae6fd;border-radius:8px;padding:11px 14px;font-size:15px;outline:none;box-sizing:border-box;resize:vertical"></textarea></div>
          <button style="background:#0e7490;color:white;border:none;border-radius:10px;padding:14px;font-size:16px;font-weight:700;cursor:pointer;margin-top:4px">Solicitar cita</button>
        </div>
      </div>
    </div>
  </section>
  ${footerClinica}`,
        css: ``,
      },
      {
        id: 'contacto',
        label: 'Contacto',
        routePath: '/contacto',
        title: 'Contacto',
        required: false,
        html: `${navClinica('/contacto')}
  <section style="padding:80px 24px;background:white;${FS}">
    <div style="max-width:900px;margin:0 auto;display:grid;grid-template-columns:1fr 1fr;gap:60px;align-items:start">
      <div><h1 style="font-size:42px;font-weight:800;color:#0c4a6e;margin:0 0 20px">Contactanos</h1><p style="font-size:16px;color:#64748b;line-height:1.7;margin:0 0 32px">Estamos aqui para ayudarte. Comunicate con nosotros.</p>
        <div style="display:flex;flex-direction:column;gap:20px">
          <div style="display:flex;gap:14px;align-items:flex-start"><span style="font-size:22px">📍</span><div><p style="margin:0;font-weight:600;color:#0c4a6e">Direccion</p><p style="margin:4px 0 0;font-size:14px;color:#64748b">Av. Salud 456, Col. Medica, Ciudad</p></div></div>
          <div style="display:flex;gap:14px;align-items:flex-start"><span style="font-size:22px">📞</span><div><p style="margin:0;font-weight:600;color:#0c4a6e">Telefono</p><p style="margin:4px 0 0;font-size:14px;color:#64748b">55 2233-4455</p></div></div>
          <div style="display:flex;gap:14px;align-items:flex-start"><span style="font-size:22px">📧</span><div><p style="margin:0;font-weight:600;color:#0c4a6e">Correo</p><p style="margin:4px 0 0;font-size:14px;color:#64748b">contacto@clinica.com</p></div></div>
          <div style="display:flex;gap:14px;align-items:flex-start"><span style="font-size:22px">🕐</span><div><p style="margin:0;font-weight:600;color:#0c4a6e">Horarios</p><p style="margin:4px 0 0;font-size:14px;color:#64748b">Lun–Sáb: 8am – 8pm · Dom: 9am – 3pm</p></div></div>
        </div>
      </div>
      <div style="background:#f0f9ff;border-radius:20px;padding:32px">
        <div style="display:grid;gap:14px">
          <input placeholder="Nombre completo" style="border:1px solid #bae6fd;border-radius:8px;padding:12px 14px;font-size:15px;outline:none;width:100%;box-sizing:border-box;background:white">
          <input type="email" placeholder="Correo electronico" style="border:1px solid #bae6fd;border-radius:8px;padding:12px 14px;font-size:15px;outline:none;width:100%;box-sizing:border-box;background:white">
          <textarea placeholder="Tu mensaje..." rows="4" style="border:1px solid #bae6fd;border-radius:8px;padding:12px 14px;font-size:15px;outline:none;width:100%;box-sizing:border-box;background:white;resize:vertical"></textarea>
          <button style="background:#0e7490;color:white;border:none;border-radius:8px;padding:13px;font-size:15px;font-weight:700;cursor:pointer">Enviar mensaje</button>
        </div>
      </div>
    </div>
  </section>
  ${footerClinica}`,
        css: ``,
      },
    ],
  }
  ```

- [ ] **Step 2: Verificar**

  ```bash
  node --check apps/desktop/src/website/atlasTemplates/templateClinica.js
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add apps/desktop/src/website/atlasTemplates/templateClinica.js
  git commit -m "feat(website): add templateClinica multi-page template"
  ```

---

## Tasks 5–9 — Crear templates restantes (Portfolio, Inmobiliaria, Blog, ONG, Educacion)

**Files:**
- Create: `apps/desktop/src/website/atlasTemplates/templatePortfolio.js`
- Create: `apps/desktop/src/website/atlasTemplates/templateInmobiliaria.js`
- Create: `apps/desktop/src/website/atlasTemplates/templateBlog.js`
- Create: `apps/desktop/src/website/atlasTemplates/templateOng.js`
- Create: `apps/desktop/src/website/atlasTemplates/templateEducacion.js`

Crea cada archivo siguiendo exactamente el mismo patrón que `templateClinica.js`:
1. Constantes de fuente `FS` (y `F` para serif si aplica)
2. Helper de nav con links activos e incluye `<a href="/acceso">Iniciar sesion</a>` antes del CTA
3. Helper de footer con 3 columnas (logo/desc, links, contacto)
4. Export con `id`, `label`, `category`, `description`, `color`, `pages[]`
5. `pages[0]` es `home` con `required: true`

- [ ] **Step 1: templatePortfolio.js** — `category: 'creativo'`, `color: '#be185d'`

  Paleta: fondo negro/gris oscuro, acentos rosa-fucsia `#be185d`, tipografía elegante.

  Páginas:
  - `home` (required): hero fullscreen con nombre y tagline, grid de proyectos destacados, CTA
  - `portafolio` (opcional): grid masonry de proyectos con categoria y nombre
  - `sobre-mi` (opcional): foto + bio + habilidades + experiencia
  - `servicios` (opcional): lista de servicios con precios aproximados
  - `contacto` (opcional): formulario minimalista + redes sociales

- [ ] **Step 2: templateInmobiliaria.js** — `category: 'comercio'`, `color: '#78350f'`

  Paleta: fondo blanco/crema, acentos marron/dorado, fotografías amplias.

  Páginas:
  - `home` (required): hero con buscador de propiedades, propiedades destacadas, CTA
  - `propiedades` (opcional): grid de propiedades con precio, m², habitaciones, ubicación
  - `nosotros` (opcional): historia de la agencia, valores, equipo de asesores
  - `blog` (opcional): artículos del mercado inmobiliario, grid 3 columnas
  - `contacto` (opcional): formulario + datos de la agencia + mapa placeholder

- [ ] **Step 3: templateBlog.js** — `category: 'medios'`, `color: '#1e293b'`

  Paleta: fondo blanco limpio, tipografía editorial, acentos oscuros.

  Páginas:
  - `home` (required): hero con artículo destacado, grid de artículos recientes, categorías
  - `articulos` (opcional): lista completa de artículos con filtro por categoría
  - `categorias` (opcional): grid de categorías con conteo de artículos
  - `nosotros` (opcional): historia del medio/blog, equipo editorial
  - `contacto` (opcional): formulario para colaboraciones + redes

- [ ] **Step 4: templateOng.js** — `category: 'social'`, `color: '#065f46'`

  Paleta: verde institucional, acentos amarillo/dorado, tono cálido y humano.

  Páginas:
  - `home` (required): hero con misión, impacto en números, proyectos activos, CTA donación
  - `mision` (opcional): historia, misión, visión, valores
  - `proyectos` (opcional): grid de proyectos con estado, beneficiarios y avance
  - `voluntarios` (opcional): cómo unirse, formulario de registro voluntario
  - `donaciones` (opcional): opciones de donación, confianza y transparencia
  - `contacto` (opcional): formulario + sede

- [ ] **Step 5: templateEducacion.js** — `category: 'educacion'`, `color: '#1d4ed8'`

  Paleta: azul universitario, blanco, acentos naranja/amarillo.

  Páginas:
  - `home` (required): hero con propuesta de valor, cursos destacados, estadísticas
  - `cursos` (opcional): catálogo de cursos con nivel, duración, precio
  - `instructores` (opcional): grid de instructores con especialidad y bio corta
  - `testimonios` (opcional): testimonios de estudiantes con foto y nombre
  - `contacto` (opcional): formulario + datos institucionales

- [ ] **Step 6: Verificar todos**

  ```bash
  node --check apps/desktop/src/website/atlasTemplates/templatePortfolio.js
  node --check apps/desktop/src/website/atlasTemplates/templateInmobiliaria.js
  node --check apps/desktop/src/website/atlasTemplates/templateBlog.js
  node --check apps/desktop/src/website/atlasTemplates/templateOng.js
  node --check apps/desktop/src/website/atlasTemplates/templateEducacion.js
  ```
  Expected: todos limpios.

- [ ] **Step 7: Commit**

  ```bash
  git add apps/desktop/src/website/atlasTemplates/templatePortfolio.js \
          apps/desktop/src/website/atlasTemplates/templateInmobiliaria.js \
          apps/desktop/src/website/atlasTemplates/templateBlog.js \
          apps/desktop/src/website/atlasTemplates/templateOng.js \
          apps/desktop/src/website/atlasTemplates/templateEducacion.js
  git commit -m "feat(website): add 5 new multi-page templates (portfolio, inmobiliaria, blog, ong, educacion)"
  ```

---

## Task 10 — Actualizar index.js

**Files:**
- Modify: `apps/desktop/src/website/atlasTemplates/index.js`

- [ ] **Step 1: Reemplazar el archivo**

  ```js
  import { templateRestaurante } from './templateRestaurante.js'
  import { templateSpa } from './templateSpa.js'
  import { templateAgencia } from './templateAgencia.js'
  import { templateEcommerce } from './templateEcommerce.js'
  import { templateServicios } from './templateServicios.js'
  import { templateNegocio } from './templateNegocio.js'
  import { templateClinica } from './templateClinica.js'
  import { templatePortfolio } from './templatePortfolio.js'
  import { templateInmobiliaria } from './templateInmobiliaria.js'
  import { templateBlog } from './templateBlog.js'
  import { templateOng } from './templateOng.js'
  import { templateEducacion } from './templateEducacion.js'

  export const allTemplates = [
    templateRestaurante,
    templateSpa,
    templateAgencia,
    templateEcommerce,
    templateServicios,
    templateNegocio,
    templateClinica,
    templatePortfolio,
    templateInmobiliaria,
    templateBlog,
    templateOng,
    templateEducacion,
  ]
  ```

- [ ] **Step 2: Verificar que todos los imports resuelven**

  ```bash
  node --check apps/desktop/src/website/atlasTemplates/index.js
  ```
  Expected: limpio.

- [ ] **Step 3: Verificar que cada template tiene el shape correcto**

  ```bash
  node -e "
    import('./apps/desktop/src/website/atlasTemplates/index.js').then(m => {
      const tpls = m.allTemplates
      console.log('Total templates:', tpls.length)
      tpls.forEach(t => {
        const issues = []
        if (!t.id) issues.push('missing id')
        if (!t.category) issues.push('missing category')
        if (!Array.isArray(t.pages)) issues.push('pages is not array')
        if (!t.pages?.find(p => p.required)) issues.push('no required page')
        if (issues.length) console.error(t.id || '?', '->', issues)
        else console.log('OK:', t.id, '(' + t.pages.length + ' pages)')
      })
    })
  "
  ```
  Expected: 12 templates, todos OK.

- [ ] **Step 4: Commit**

  ```bash
  git add apps/desktop/src/website/atlasTemplates/index.js
  git commit -m "feat(website): update templates index with 12 templates"
  ```

---

## Verification final Plan A

```bash
# Todos los archivos sintácticamente válidos
node --check apps/desktop/src/website/atlasTemplates/templateRestaurante.js
node --check apps/desktop/src/website/atlasTemplates/templateSpa.js
node --check apps/desktop/src/website/atlasTemplates/templateAgencia.js
node --check apps/desktop/src/website/atlasTemplates/templateEcommerce.js
node --check apps/desktop/src/website/atlasTemplates/templateServicios.js
node --check apps/desktop/src/website/atlasTemplates/templateNegocio.js
node --check apps/desktop/src/website/atlasTemplates/templateClinica.js
node --check apps/desktop/src/website/atlasTemplates/templatePortfolio.js
node --check apps/desktop/src/website/atlasTemplates/templateInmobiliaria.js
node --check apps/desktop/src/website/atlasTemplates/templateBlog.js
node --check apps/desktop/src/website/atlasTemplates/templateOng.js
node --check apps/desktop/src/website/atlasTemplates/templateEducacion.js
node --check apps/desktop/src/website/atlasTemplates/index.js
```
Expected: todos sin output.

## Plan B
Ver `docs/superpowers/plans/2026-05-30-website-templates-multipage-B.md` para:
- `TemplatePickerModal` standalone con 2 pasos + llamadas API
- `WebsiteGrapesEditor` actualizado (prop `siteId`)
- `WebsitePageEditorScreen` pasa `siteId`
- `WebsiteTemplatesScreen` (pantalla admin)
- `ModuleOutlet` + manifest actualizado
- `PublicClientLogin` + ruta `/acceso`
- Endpoint `GET /public/website/auth-check`
