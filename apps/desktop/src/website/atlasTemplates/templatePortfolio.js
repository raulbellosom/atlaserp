const FS = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"

export const templatePortfolio = {
  id: 'portfolio',
  label: 'Portfolio Creativo',
  category: 'creativo',
  description: 'Ideal para fotografos, disenadores, ilustradores y creativos independientes.',
  color: '#be185d',
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
<nav style="background:#0f0a14;padding:0 40px;height:68px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100;${FS}">
  <span style="font-size:20px;font-weight:800;color:#be185d;letter-spacing:-0.02em">NombreCreativo</span>
  <div style="display:flex;gap:28px;align-items:center">
    <a href="/portafolio" style="color:rgba(255,255,255,0.7);text-decoration:none;font-size:14px;font-weight:500">Portafolio</a>
    <a href="/sobre-mi" style="color:rgba(255,255,255,0.7);text-decoration:none;font-size:14px;font-weight:500">Sobre mi</a>
    <a href="/servicios" style="color:rgba(255,255,255,0.7);text-decoration:none;font-size:14px;font-weight:500">Servicios</a>
    <a href="/contacto" style="color:rgba(255,255,255,0.7);text-decoration:none;font-size:14px;font-weight:500">Contacto</a>
    <a href="/acceso" style="color:rgba(255,255,255,0.7);text-decoration:none;font-size:14px;font-weight:500">Iniciar sesion</a>
    <a href="/contacto" style="background:#be185d;color:white;text-decoration:none;font-size:14px;font-weight:600;padding:10px 24px;border-radius:8px">Contactar</a>
  </div>
</nav>

<!-- HERO -->
<section style="background:#0f0a14;padding:120px 24px 100px;text-align:center;${FS}">
  <div style="max-width:780px;margin:0 auto">
    <div style="display:inline-block;background:rgba(190,24,93,0.15);border:1px solid rgba(190,24,93,0.4);border-radius:999px;padding:6px 20px;margin-bottom:28px">
      <span style="color:#f9a8d4;font-size:13px;font-weight:600;letter-spacing:0.08em">Disenador visual & fotografo</span>
    </div>
    <h1 style="font-size:clamp(42px,6vw,80px);font-weight:900;color:white;line-height:1.05;margin:0 0 24px;letter-spacing:-0.04em">NombreCreativo</h1>
    <p style="font-size:18px;color:rgba(255,255,255,0.65);line-height:1.75;margin:0 auto 44px;max-width:520px">Creo experiencias visuales que conectan marcas con personas. Diseno, fotografia e ilustracion al servicio de tu vision.</p>
    <div style="display:flex;gap:16px;justify-content:center;flex-wrap:wrap">
      <a href="/portafolio" style="background:#be185d;color:white;font-size:16px;font-weight:700;padding:15px 40px;border-radius:10px;text-decoration:none">Ver portafolio</a>
      <a href="/contacto" style="background:rgba(255,255,255,0.08);color:white;font-size:16px;font-weight:600;padding:15px 40px;border-radius:10px;text-decoration:none;border:2px solid rgba(255,255,255,0.2)">Contactar</a>
    </div>
  </div>
</section>

<!-- TRABAJOS DESTACADOS -->
<section style="background:#0f0a14;padding:80px 24px 100px;${FS}">
  <div style="max-width:1100px;margin:0 auto">
    <div style="text-align:center;margin-bottom:56px">
      <span style="color:#be185d;font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase">Trabajos recientes</span>
      <h2 style="font-size:clamp(28px,4vw,44px);font-weight:800;color:white;margin:12px 0 0;letter-spacing:-0.025em">Proyectos destacados</h2>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:28px">

      <div style="background:#1a1020;border-radius:20px;overflow:hidden">
        <img src="https://placehold.co/600x380/be185d/f9a8d4?text=Proyecto+01" alt="Proyecto 01" style="width:100%;display:block">
        <div style="padding:24px">
          <span style="display:inline-block;background:rgba(190,24,93,0.2);color:#f9a8d4;font-size:11px;font-weight:700;padding:4px 12px;border-radius:999px;letter-spacing:0.08em;margin-bottom:10px">DISENO</span>
          <h3 style="font-size:18px;font-weight:700;color:white;margin:0">Identidad visual Marca X</h3>
        </div>
      </div>

      <div style="background:#1a1020;border-radius:20px;overflow:hidden">
        <img src="https://placehold.co/600x380/7c0a2e/f9a8d4?text=Proyecto+02" alt="Proyecto 02" style="width:100%;display:block">
        <div style="padding:24px">
          <span style="display:inline-block;background:rgba(190,24,93,0.2);color:#f9a8d4;font-size:11px;font-weight:700;padding:4px 12px;border-radius:999px;letter-spacing:0.08em;margin-bottom:10px">FOTOGRAFIA</span>
          <h3 style="font-size:18px;font-weight:700;color:white;margin:0">Sesion editorial moda</h3>
        </div>
      </div>

      <div style="background:#1a1020;border-radius:20px;overflow:hidden">
        <img src="https://placehold.co/600x380/3b0764/f9a8d4?text=Proyecto+03" alt="Proyecto 03" style="width:100%;display:block">
        <div style="padding:24px">
          <span style="display:inline-block;background:rgba(190,24,93,0.2);color:#f9a8d4;font-size:11px;font-weight:700;padding:4px 12px;border-radius:999px;letter-spacing:0.08em;margin-bottom:10px">ILUSTRACION</span>
          <h3 style="font-size:18px;font-weight:700;color:white;margin:0">Coleccion de arte digital</h3>
        </div>
      </div>

    </div>
  </div>
</section>

<!-- HABILIDADES -->
<section style="background:#1a1020;padding:80px 24px;${FS}">
  <div style="max-width:900px;margin:0 auto;text-align:center">
    <span style="color:#be185d;font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase">Especialidades</span>
    <h2 style="font-size:clamp(26px,3.5vw,38px);font-weight:800;color:white;margin:12px 0 40px;letter-spacing:-0.025em">Lo que hago mejor</h2>
    <div style="display:flex;flex-wrap:wrap;gap:14px;justify-content:center">
      <span style="background:rgba(190,24,93,0.15);border:1px solid rgba(190,24,93,0.35);color:#f9a8d4;padding:10px 22px;border-radius:999px;font-size:14px;font-weight:600">Diseno de marca</span>
      <span style="background:rgba(190,24,93,0.15);border:1px solid rgba(190,24,93,0.35);color:#f9a8d4;padding:10px 22px;border-radius:999px;font-size:14px;font-weight:600">Fotografia comercial</span>
      <span style="background:rgba(190,24,93,0.15);border:1px solid rgba(190,24,93,0.35);color:#f9a8d4;padding:10px 22px;border-radius:999px;font-size:14px;font-weight:600">Ilustracion digital</span>
      <span style="background:rgba(190,24,93,0.15);border:1px solid rgba(190,24,93,0.35);color:#f9a8d4;padding:10px 22px;border-radius:999px;font-size:14px;font-weight:600">Diseno editorial</span>
      <span style="background:rgba(190,24,93,0.15);border:1px solid rgba(190,24,93,0.35);color:#f9a8d4;padding:10px 22px;border-radius:999px;font-size:14px;font-weight:600">Motion graphics</span>
      <span style="background:rgba(190,24,93,0.15);border:1px solid rgba(190,24,93,0.35);color:#f9a8d4;padding:10px 22px;border-radius:999px;font-size:14px;font-weight:600">Retoque digital</span>
    </div>
  </div>
</section>

<!-- FOOTER -->
<footer style="background:#0a0610;color:rgba(255,255,255,0.6);padding:48px 40px;${FS}">
  <div style="max-width:1100px;margin:0 auto;display:grid;grid-template-columns:2fr 1fr;gap:48px">
    <div>
      <span style="font-size:18px;font-weight:800;color:#be185d;display:block;margin-bottom:14px">NombreCreativo</span>
      <p style="font-size:14px;line-height:1.75;margin:0 0 0 0;max-width:320px">Disenador visual y fotografo freelance con mas de 8 anos de experiencia creando identidades memorables.</p>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:32px">
      <div>
        <h4 style="color:white;font-size:13px;font-weight:700;margin:0 0 16px;text-transform:uppercase;letter-spacing:0.08em">Paginas</h4>
        <ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:10px">
          <li><a href="/portafolio" style="color:rgba(255,255,255,0.6);text-decoration:none;font-size:14px">Portafolio</a></li>
          <li><a href="/sobre-mi" style="color:rgba(255,255,255,0.6);text-decoration:none;font-size:14px">Sobre mi</a></li>
          <li><a href="/servicios" style="color:rgba(255,255,255,0.6);text-decoration:none;font-size:14px">Servicios</a></li>
          <li><a href="/contacto" style="color:rgba(255,255,255,0.6);text-decoration:none;font-size:14px">Contacto</a></li>
        </ul>
      </div>
      <div>
        <h4 style="color:white;font-size:13px;font-weight:700;margin:0 0 16px;text-transform:uppercase;letter-spacing:0.08em">Contacto</h4>
        <div style="display:flex;flex-direction:column;gap:10px;font-size:14px">
          <span>hola@nombrecreativo.com</span>
          <span>+52 55 0000 0000</span>
          <span>Ciudad de Mexico</span>
        </div>
      </div>
    </div>
  </div>
  <div style="max-width:1100px;margin:32px auto 0;padding-top:24px;border-top:1px solid rgba(255,255,255,0.08);text-align:center;font-size:13px">
    &copy; 2025 NombreCreativo. Todos los derechos reservados.
  </div>
</footer>
`,
    },
    {
      id: 'portafolio',
      label: 'Portafolio',
      routePath: '/portafolio',
      title: 'Portafolio',
      required: false,
      css: '',
      html: `
<!-- NAV -->
<nav style="background:#0f0a14;padding:0 40px;height:68px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100;${FS}">
  <span style="font-size:20px;font-weight:800;color:#be185d;letter-spacing:-0.02em">NombreCreativo</span>
  <div style="display:flex;gap:28px;align-items:center">
    <a href="/" style="color:rgba(255,255,255,0.7);text-decoration:none;font-size:14px;font-weight:500">Inicio</a>
    <a href="/sobre-mi" style="color:rgba(255,255,255,0.7);text-decoration:none;font-size:14px;font-weight:500">Sobre mi</a>
    <a href="/servicios" style="color:rgba(255,255,255,0.7);text-decoration:none;font-size:14px;font-weight:500">Servicios</a>
    <a href="/contacto" style="color:rgba(255,255,255,0.7);text-decoration:none;font-size:14px;font-weight:500">Contacto</a>
    <a href="/acceso" style="color:rgba(255,255,255,0.7);text-decoration:none;font-size:14px;font-weight:500">Iniciar sesion</a>
    <a href="/contacto" style="background:#be185d;color:white;text-decoration:none;font-size:14px;font-weight:600;padding:10px 24px;border-radius:8px">Contactar</a>
  </div>
</nav>

<!-- ENCABEZADO -->
<section style="background:#0f0a14;padding:64px 24px 48px;text-align:center;${FS}">
  <div style="max-width:700px;margin:0 auto">
    <span style="color:#be185d;font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase">Trabajo creativo</span>
    <h1 style="font-size:clamp(32px,5vw,54px);font-weight:900;color:white;margin:12px 0 16px;letter-spacing:-0.03em">Portafolio</h1>
    <p style="font-size:16px;color:rgba(255,255,255,0.6);line-height:1.7;margin:0">Una seleccion de proyectos que reflejan mi enfoque creativo y atencion al detalle.</p>
  </div>
</section>

<!-- FILTROS -->
<section style="background:#0f0a14;padding:0 24px 48px;${FS}">
  <div style="max-width:1100px;margin:0 auto;display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
    <span style="background:#be185d;color:white;padding:9px 22px;border-radius:999px;font-size:14px;font-weight:600;cursor:pointer">Todos</span>
    <span style="background:rgba(255,255,255,0.07);color:rgba(255,255,255,0.7);padding:9px 22px;border-radius:999px;font-size:14px;font-weight:500;cursor:pointer;border:1px solid rgba(255,255,255,0.12)">Diseno</span>
    <span style="background:rgba(255,255,255,0.07);color:rgba(255,255,255,0.7);padding:9px 22px;border-radius:999px;font-size:14px;font-weight:500;cursor:pointer;border:1px solid rgba(255,255,255,0.12)">Fotografia</span>
    <span style="background:rgba(255,255,255,0.07);color:rgba(255,255,255,0.7);padding:9px 22px;border-radius:999px;font-size:14px;font-weight:500;cursor:pointer;border:1px solid rgba(255,255,255,0.12)">Ilustracion</span>
  </div>
</section>

<!-- GRID DE PROYECTOS -->
<section style="background:#0f0a14;padding:0 24px 100px;${FS}">
  <div style="max-width:1100px;margin:0 auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:28px">

    <div style="background:#1a1020;border-radius:20px;overflow:hidden">
      <img src="https://placehold.co/640x400/be185d/fce7f3?text=Proyecto+A" alt="Proyecto A" style="width:100%;display:block">
      <div style="padding:24px">
        <span style="display:inline-block;background:rgba(190,24,93,0.2);color:#f9a8d4;font-size:11px;font-weight:700;padding:4px 12px;border-radius:999px;margin-bottom:10px">DISENO</span>
        <h3 style="font-size:18px;font-weight:700;color:white;margin:0 0 8px">Branding corporativo</h3>
        <a href="#" style="color:#be185d;font-size:14px;font-weight:600;text-decoration:none">Ver proyecto &rarr;</a>
      </div>
    </div>

    <div style="background:#1a1020;border-radius:20px;overflow:hidden">
      <img src="https://placehold.co/640x400/7c0a2e/fce7f3?text=Proyecto+B" alt="Proyecto B" style="width:100%;display:block">
      <div style="padding:24px">
        <span style="display:inline-block;background:rgba(190,24,93,0.2);color:#f9a8d4;font-size:11px;font-weight:700;padding:4px 12px;border-radius:999px;margin-bottom:10px">FOTOGRAFIA</span>
        <h3 style="font-size:18px;font-weight:700;color:white;margin:0 0 8px">Campana publicitaria</h3>
        <a href="#" style="color:#be185d;font-size:14px;font-weight:600;text-decoration:none">Ver proyecto &rarr;</a>
      </div>
    </div>

    <div style="background:#1a1020;border-radius:20px;overflow:hidden">
      <img src="https://placehold.co/640x400/3b0764/fce7f3?text=Proyecto+C" alt="Proyecto C" style="width:100%;display:block">
      <div style="padding:24px">
        <span style="display:inline-block;background:rgba(190,24,93,0.2);color:#f9a8d4;font-size:11px;font-weight:700;padding:4px 12px;border-radius:999px;margin-bottom:10px">ILUSTRACION</span>
        <h3 style="font-size:18px;font-weight:700;color:white;margin:0 0 8px">Arte para portada editorial</h3>
        <a href="#" style="color:#be185d;font-size:14px;font-weight:600;text-decoration:none">Ver proyecto &rarr;</a>
      </div>
    </div>

    <div style="background:#1a1020;border-radius:20px;overflow:hidden">
      <img src="https://placehold.co/640x400/be185d/0f0a14?text=Proyecto+D" alt="Proyecto D" style="width:100%;display:block">
      <div style="padding:24px">
        <span style="display:inline-block;background:rgba(190,24,93,0.2);color:#f9a8d4;font-size:11px;font-weight:700;padding:4px 12px;border-radius:999px;margin-bottom:10px">DISENO</span>
        <h3 style="font-size:18px;font-weight:700;color:white;margin:0 0 8px">Empaque de producto</h3>
        <a href="#" style="color:#be185d;font-size:14px;font-weight:600;text-decoration:none">Ver proyecto &rarr;</a>
      </div>
    </div>

    <div style="background:#1a1020;border-radius:20px;overflow:hidden">
      <img src="https://placehold.co/640x400/7c0a2e/0f0a14?text=Proyecto+E" alt="Proyecto E" style="width:100%;display:block">
      <div style="padding:24px">
        <span style="display:inline-block;background:rgba(190,24,93,0.2);color:#f9a8d4;font-size:11px;font-weight:700;padding:4px 12px;border-radius:999px;margin-bottom:10px">FOTOGRAFIA</span>
        <h3 style="font-size:18px;font-weight:700;color:white;margin:0 0 8px">Retrato corporativo</h3>
        <a href="#" style="color:#be185d;font-size:14px;font-weight:600;text-decoration:none">Ver proyecto &rarr;</a>
      </div>
    </div>

    <div style="background:#1a1020;border-radius:20px;overflow:hidden">
      <img src="https://placehold.co/640x400/3b0764/0f0a14?text=Proyecto+F" alt="Proyecto F" style="width:100%;display:block">
      <div style="padding:24px">
        <span style="display:inline-block;background:rgba(190,24,93,0.2);color:#f9a8d4;font-size:11px;font-weight:700;padding:4px 12px;border-radius:999px;margin-bottom:10px">ILUSTRACION</span>
        <h3 style="font-size:18px;font-weight:700;color:white;margin:0 0 8px">Serie de personajes</h3>
        <a href="#" style="color:#be185d;font-size:14px;font-weight:600;text-decoration:none">Ver proyecto &rarr;</a>
      </div>
    </div>

  </div>
</section>

<!-- FOOTER -->
<footer style="background:#0a0610;color:rgba(255,255,255,0.6);padding:48px 40px;${FS}">
  <div style="max-width:1100px;margin:0 auto;display:grid;grid-template-columns:2fr 1fr;gap:48px">
    <div>
      <span style="font-size:18px;font-weight:800;color:#be185d;display:block;margin-bottom:14px">NombreCreativo</span>
      <p style="font-size:14px;line-height:1.75;margin:0;max-width:320px">Disenador visual y fotografo freelance con mas de 8 anos de experiencia creando identidades memorables.</p>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:32px">
      <div>
        <h4 style="color:white;font-size:13px;font-weight:700;margin:0 0 16px;text-transform:uppercase;letter-spacing:0.08em">Paginas</h4>
        <ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:10px">
          <li><a href="/portafolio" style="color:rgba(255,255,255,0.6);text-decoration:none;font-size:14px">Portafolio</a></li>
          <li><a href="/sobre-mi" style="color:rgba(255,255,255,0.6);text-decoration:none;font-size:14px">Sobre mi</a></li>
          <li><a href="/servicios" style="color:rgba(255,255,255,0.6);text-decoration:none;font-size:14px">Servicios</a></li>
          <li><a href="/contacto" style="color:rgba(255,255,255,0.6);text-decoration:none;font-size:14px">Contacto</a></li>
        </ul>
      </div>
      <div>
        <h4 style="color:white;font-size:13px;font-weight:700;margin:0 0 16px;text-transform:uppercase;letter-spacing:0.08em">Contacto</h4>
        <div style="display:flex;flex-direction:column;gap:10px;font-size:14px">
          <span>hola@nombrecreativo.com</span>
          <span>+52 55 0000 0000</span>
          <span>Ciudad de Mexico</span>
        </div>
      </div>
    </div>
  </div>
  <div style="max-width:1100px;margin:32px auto 0;padding-top:24px;border-top:1px solid rgba(255,255,255,0.08);text-align:center;font-size:13px">
    &copy; 2025 NombreCreativo. Todos los derechos reservados.
  </div>
</footer>
`,
    },
    {
      id: 'sobre-mi',
      label: 'Sobre mi',
      routePath: '/sobre-mi',
      title: 'Sobre mi',
      required: false,
      css: '',
      html: `
<!-- NAV -->
<nav style="background:#0f0a14;padding:0 40px;height:68px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100;${FS}">
  <span style="font-size:20px;font-weight:800;color:#be185d;letter-spacing:-0.02em">NombreCreativo</span>
  <div style="display:flex;gap:28px;align-items:center">
    <a href="/" style="color:rgba(255,255,255,0.7);text-decoration:none;font-size:14px;font-weight:500">Inicio</a>
    <a href="/portafolio" style="color:rgba(255,255,255,0.7);text-decoration:none;font-size:14px;font-weight:500">Portafolio</a>
    <a href="/servicios" style="color:rgba(255,255,255,0.7);text-decoration:none;font-size:14px;font-weight:500">Servicios</a>
    <a href="/contacto" style="color:rgba(255,255,255,0.7);text-decoration:none;font-size:14px;font-weight:500">Contacto</a>
    <a href="/acceso" style="color:rgba(255,255,255,0.7);text-decoration:none;font-size:14px;font-weight:500">Iniciar sesion</a>
    <a href="/contacto" style="background:#be185d;color:white;text-decoration:none;font-size:14px;font-weight:600;padding:10px 24px;border-radius:8px">Contactar</a>
  </div>
</nav>

<!-- BIO -->
<section style="background:#0f0a14;padding:80px 24px;${FS}">
  <div style="max-width:1100px;margin:0 auto;display:grid;grid-template-columns:1fr 1.4fr;gap:72px;align-items:center">
    <div>
      <img src="https://placehold.co/480x560/1a1020/be185d?text=Foto" alt="Foto de perfil" style="width:100%;border-radius:24px;display:block">
    </div>
    <div>
      <span style="color:#be185d;font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase">Quien soy</span>
      <h1 style="font-size:clamp(30px,4vw,48px);font-weight:900;color:white;margin:14px 0 24px;letter-spacing:-0.03em">Hola, soy NombreCreativo</h1>
      <p style="font-size:16px;color:rgba(255,255,255,0.7);line-height:1.8;margin:0 0 20px">Soy un disenador grafico y fotografo con base en Ciudad de Mexico. Desde el 2016 he colaborado con marcas locales e internacionales para crear identidades visuales que comunican con claridad y elegancia.</p>
      <p style="font-size:16px;color:rgba(255,255,255,0.7);line-height:1.8;margin:0 0 36px">Mi proceso combina investigacion, estrategia y ejecucion artesanal. Cada proyecto es una oportunidad de contar una historia unica a traves del diseno.</p>
      <a href="/contacto" style="background:#be185d;color:white;font-size:15px;font-weight:700;padding:14px 36px;border-radius:10px;text-decoration:none;display:inline-block">Trabajemos juntos</a>
    </div>
  </div>
</section>

<!-- VALORES -->
<section style="background:#1a1020;padding:80px 24px;${FS}">
  <div style="max-width:1100px;margin:0 auto">
    <div style="text-align:center;margin-bottom:56px">
      <span style="color:#be185d;font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase">Mi enfoque</span>
      <h2 style="font-size:clamp(26px,3.5vw,40px);font-weight:800;color:white;margin:12px 0 0;letter-spacing:-0.025em">Por que trabajar conmigo</h2>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:28px">
      <div style="background:#0f0a14;border-radius:20px;padding:36px">
        <div style="width:48px;height:48px;background:#be185d;border-radius:12px;display:flex;align-items:center;justify-content:center;color:white;font-size:18px;font-weight:800;margin-bottom:20px">C</div>
        <h3 style="font-size:18px;font-weight:700;color:white;margin:0 0 12px">Creatividad estrategica</h3>
        <p style="font-size:15px;color:rgba(255,255,255,0.6);line-height:1.7;margin:0">Cada decision estetica esta respaldada por objetivos de negocio concretos.</p>
      </div>
      <div style="background:#0f0a14;border-radius:20px;padding:36px">
        <div style="width:48px;height:48px;background:#be185d;border-radius:12px;display:flex;align-items:center;justify-content:center;color:white;font-size:18px;font-weight:800;margin-bottom:20px">P</div>
        <h3 style="font-size:18px;font-weight:700;color:white;margin:0 0 12px">Puntualidad y compromiso</h3>
        <p style="font-size:15px;color:rgba(255,255,255,0.6);line-height:1.7;margin:0">Entrego en tiempo y forma, con comunicacion clara en cada etapa del proyecto.</p>
      </div>
      <div style="background:#0f0a14;border-radius:20px;padding:36px">
        <div style="width:48px;height:48px;background:#be185d;border-radius:12px;display:flex;align-items:center;justify-content:center;color:white;font-size:18px;font-weight:800;margin-bottom:20px">D</div>
        <h3 style="font-size:18px;font-weight:700;color:white;margin:0 0 12px">Diseno de alto impacto</h3>
        <p style="font-size:15px;color:rgba(255,255,255,0.6);line-height:1.7;margin:0">Trabajo con atencion obsesiva al detalle para producir resultados que destacan.</p>
      </div>
    </div>
  </div>
</section>

<!-- FOOTER -->
<footer style="background:#0a0610;color:rgba(255,255,255,0.6);padding:48px 40px;${FS}">
  <div style="max-width:1100px;margin:0 auto;display:grid;grid-template-columns:2fr 1fr;gap:48px">
    <div>
      <span style="font-size:18px;font-weight:800;color:#be185d;display:block;margin-bottom:14px">NombreCreativo</span>
      <p style="font-size:14px;line-height:1.75;margin:0;max-width:320px">Disenador visual y fotografo freelance con mas de 8 anos de experiencia creando identidades memorables.</p>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:32px">
      <div>
        <h4 style="color:white;font-size:13px;font-weight:700;margin:0 0 16px;text-transform:uppercase;letter-spacing:0.08em">Paginas</h4>
        <ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:10px">
          <li><a href="/portafolio" style="color:rgba(255,255,255,0.6);text-decoration:none;font-size:14px">Portafolio</a></li>
          <li><a href="/sobre-mi" style="color:rgba(255,255,255,0.6);text-decoration:none;font-size:14px">Sobre mi</a></li>
          <li><a href="/servicios" style="color:rgba(255,255,255,0.6);text-decoration:none;font-size:14px">Servicios</a></li>
          <li><a href="/contacto" style="color:rgba(255,255,255,0.6);text-decoration:none;font-size:14px">Contacto</a></li>
        </ul>
      </div>
      <div>
        <h4 style="color:white;font-size:13px;font-weight:700;margin:0 0 16px;text-transform:uppercase;letter-spacing:0.08em">Contacto</h4>
        <div style="display:flex;flex-direction:column;gap:10px;font-size:14px">
          <span>hola@nombrecreativo.com</span>
          <span>+52 55 0000 0000</span>
          <span>Ciudad de Mexico</span>
        </div>
      </div>
    </div>
  </div>
  <div style="max-width:1100px;margin:32px auto 0;padding-top:24px;border-top:1px solid rgba(255,255,255,0.08);text-align:center;font-size:13px">
    &copy; 2025 NombreCreativo. Todos los derechos reservados.
  </div>
</footer>
`,
    },
    {
      id: 'servicios',
      label: 'Servicios',
      routePath: '/servicios',
      title: 'Servicios',
      required: false,
      css: '',
      html: `
<!-- NAV -->
<nav style="background:#0f0a14;padding:0 40px;height:68px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100;${FS}">
  <span style="font-size:20px;font-weight:800;color:#be185d;letter-spacing:-0.02em">NombreCreativo</span>
  <div style="display:flex;gap:28px;align-items:center">
    <a href="/" style="color:rgba(255,255,255,0.7);text-decoration:none;font-size:14px;font-weight:500">Inicio</a>
    <a href="/portafolio" style="color:rgba(255,255,255,0.7);text-decoration:none;font-size:14px;font-weight:500">Portafolio</a>
    <a href="/sobre-mi" style="color:rgba(255,255,255,0.7);text-decoration:none;font-size:14px;font-weight:500">Sobre mi</a>
    <a href="/contacto" style="color:rgba(255,255,255,0.7);text-decoration:none;font-size:14px;font-weight:500">Contacto</a>
    <a href="/acceso" style="color:rgba(255,255,255,0.7);text-decoration:none;font-size:14px;font-weight:500">Iniciar sesion</a>
    <a href="/contacto" style="background:#be185d;color:white;text-decoration:none;font-size:14px;font-weight:600;padding:10px 24px;border-radius:8px">Contactar</a>
  </div>
</nav>

<!-- ENCABEZADO -->
<section style="background:#0f0a14;padding:64px 24px 48px;text-align:center;${FS}">
  <div style="max-width:700px;margin:0 auto">
    <span style="color:#be185d;font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase">Lo que ofrezco</span>
    <h1 style="font-size:clamp(32px,5vw,54px);font-weight:900;color:white;margin:12px 0 16px;letter-spacing:-0.03em">Servicios creativos</h1>
    <p style="font-size:16px;color:rgba(255,255,255,0.6);line-height:1.7;margin:0">Soluciones visuales adaptadas a las necesidades de tu marca o proyecto personal.</p>
  </div>
</section>

<!-- TARJETAS DE SERVICIOS -->
<section style="background:#0f0a14;padding:0 24px 100px;${FS}">
  <div style="max-width:1000px;margin:0 auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(420px,1fr));gap:28px">

    <div style="background:#1a1020;border-radius:24px;padding:40px">
      <div style="width:52px;height:52px;background:#be185d;border-radius:14px;display:flex;align-items:center;justify-content:center;color:white;font-size:20px;font-weight:800;margin-bottom:22px">DM</div>
      <h3 style="font-size:22px;font-weight:800;color:white;margin:0 0 12px">Diseno de marca</h3>
      <p style="font-size:15px;color:rgba(255,255,255,0.6);line-height:1.75;margin:0 0 24px">Logotipo, paleta de colores, tipografia y manual de identidad visual completo para tu negocio.</p>
      <span style="color:#f9a8d4;font-size:14px;font-weight:600">Desde $8,500 MXN</span>
    </div>

    <div style="background:#1a1020;border-radius:24px;padding:40px">
      <div style="width:52px;height:52px;background:#be185d;border-radius:14px;display:flex;align-items:center;justify-content:center;color:white;font-size:20px;font-weight:800;margin-bottom:22px">FC</div>
      <h3 style="font-size:22px;font-weight:800;color:white;margin:0 0 12px">Fotografia comercial</h3>
      <p style="font-size:15px;color:rgba(255,255,255,0.6);line-height:1.75;margin:0 0 24px">Sesiones fotograficas para producto, gastronomia, arquitectura y retratos corporativos.</p>
      <span style="color:#f9a8d4;font-size:14px;font-weight:600">Desde $5,000 MXN</span>
    </div>

    <div style="background:#1a1020;border-radius:24px;padding:40px">
      <div style="width:52px;height:52px;background:#be185d;border-radius:14px;display:flex;align-items:center;justify-content:center;color:white;font-size:20px;font-weight:800;margin-bottom:22px">ID</div>
      <h3 style="font-size:22px;font-weight:800;color:white;margin:0 0 12px">Ilustracion digital</h3>
      <p style="font-size:15px;color:rgba(255,255,255,0.6);line-height:1.75;margin:0 0 24px">Ilustraciones a medida para libros, campanas publicitarias, packaging y contenido digital.</p>
      <span style="color:#f9a8d4;font-size:14px;font-weight:600">Desde $3,500 MXN</span>
    </div>

    <div style="background:#1a1020;border-radius:24px;padding:40px">
      <div style="width:52px;height:52px;background:#be185d;border-radius:14px;display:flex;align-items:center;justify-content:center;color:white;font-size:20px;font-weight:800;margin-bottom:22px">DE</div>
      <h3 style="font-size:22px;font-weight:800;color:white;margin:0 0 12px">Diseno editorial</h3>
      <p style="font-size:15px;color:rgba(255,255,255,0.6);line-height:1.75;margin:0 0 24px">Revistas, catalogos, anuarios y publicaciones impesas y digitales con diseno impecable.</p>
      <span style="color:#f9a8d4;font-size:14px;font-weight:600">Desde $6,000 MXN</span>
    </div>

  </div>
</section>

<!-- FOOTER -->
<footer style="background:#0a0610;color:rgba(255,255,255,0.6);padding:48px 40px;${FS}">
  <div style="max-width:1100px;margin:0 auto;display:grid;grid-template-columns:2fr 1fr;gap:48px">
    <div>
      <span style="font-size:18px;font-weight:800;color:#be185d;display:block;margin-bottom:14px">NombreCreativo</span>
      <p style="font-size:14px;line-height:1.75;margin:0;max-width:320px">Disenador visual y fotografo freelance con mas de 8 anos de experiencia creando identidades memorables.</p>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:32px">
      <div>
        <h4 style="color:white;font-size:13px;font-weight:700;margin:0 0 16px;text-transform:uppercase;letter-spacing:0.08em">Paginas</h4>
        <ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:10px">
          <li><a href="/portafolio" style="color:rgba(255,255,255,0.6);text-decoration:none;font-size:14px">Portafolio</a></li>
          <li><a href="/sobre-mi" style="color:rgba(255,255,255,0.6);text-decoration:none;font-size:14px">Sobre mi</a></li>
          <li><a href="/servicios" style="color:rgba(255,255,255,0.6);text-decoration:none;font-size:14px">Servicios</a></li>
          <li><a href="/contacto" style="color:rgba(255,255,255,0.6);text-decoration:none;font-size:14px">Contacto</a></li>
        </ul>
      </div>
      <div>
        <h4 style="color:white;font-size:13px;font-weight:700;margin:0 0 16px;text-transform:uppercase;letter-spacing:0.08em">Contacto</h4>
        <div style="display:flex;flex-direction:column;gap:10px;font-size:14px">
          <span>hola@nombrecreativo.com</span>
          <span>+52 55 0000 0000</span>
          <span>Ciudad de Mexico</span>
        </div>
      </div>
    </div>
  </div>
  <div style="max-width:1100px;margin:32px auto 0;padding-top:24px;border-top:1px solid rgba(255,255,255,0.08);text-align:center;font-size:13px">
    &copy; 2025 NombreCreativo. Todos los derechos reservados.
  </div>
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
<!-- NAV -->
<nav style="background:#0f0a14;padding:0 40px;height:68px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100;${FS}">
  <span style="font-size:20px;font-weight:800;color:#be185d;letter-spacing:-0.02em">NombreCreativo</span>
  <div style="display:flex;gap:28px;align-items:center">
    <a href="/" style="color:rgba(255,255,255,0.7);text-decoration:none;font-size:14px;font-weight:500">Inicio</a>
    <a href="/portafolio" style="color:rgba(255,255,255,0.7);text-decoration:none;font-size:14px;font-weight:500">Portafolio</a>
    <a href="/sobre-mi" style="color:rgba(255,255,255,0.7);text-decoration:none;font-size:14px;font-weight:500">Sobre mi</a>
    <a href="/servicios" style="color:rgba(255,255,255,0.7);text-decoration:none;font-size:14px;font-weight:500">Servicios</a>
    <a href="/acceso" style="color:rgba(255,255,255,0.7);text-decoration:none;font-size:14px;font-weight:500">Iniciar sesion</a>
    <a href="/contacto" style="background:#be185d;color:white;text-decoration:none;font-size:14px;font-weight:600;padding:10px 24px;border-radius:8px">Contactar</a>
  </div>
</nav>

<!-- FORMULARIO DE CONTACTO -->
<section style="background:#0f0a14;padding:80px 24px 120px;${FS}">
  <div style="max-width:620px;margin:0 auto">
    <div style="text-align:center;margin-bottom:48px">
      <span style="color:#be185d;font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase">Hablemos</span>
      <h1 style="font-size:clamp(32px,5vw,52px);font-weight:900;color:white;margin:12px 0 16px;letter-spacing:-0.03em">Iniciemos un proyecto</h1>
      <p style="font-size:16px;color:rgba(255,255,255,0.6);line-height:1.7;margin:0">Cuantame sobre tu proyecto y te respondere en menos de 24 horas.</p>
    </div>
    <form style="display:flex;flex-direction:column;gap:20px">
      <div>
        <label style="display:block;color:rgba(255,255,255,0.7);font-size:14px;font-weight:600;margin-bottom:8px">Nombre</label>
        <input type="text" placeholder="Tu nombre completo" style="width:100%;background:#1a1020;border:1px solid rgba(255,255,255,0.12);border-radius:10px;padding:14px 16px;color:white;font-size:15px;outline:none;box-sizing:border-box">
      </div>
      <div>
        <label style="display:block;color:rgba(255,255,255,0.7);font-size:14px;font-weight:600;margin-bottom:8px">Correo electronico</label>
        <input type="email" placeholder="tu@correo.com" style="width:100%;background:#1a1020;border:1px solid rgba(255,255,255,0.12);border-radius:10px;padding:14px 16px;color:white;font-size:15px;outline:none;box-sizing:border-box">
      </div>
      <div>
        <label style="display:block;color:rgba(255,255,255,0.7);font-size:14px;font-weight:600;margin-bottom:8px">Asunto</label>
        <input type="text" placeholder="Tipo de proyecto o consulta" style="width:100%;background:#1a1020;border:1px solid rgba(255,255,255,0.12);border-radius:10px;padding:14px 16px;color:white;font-size:15px;outline:none;box-sizing:border-box">
      </div>
      <div>
        <label style="display:block;color:rgba(255,255,255,0.7);font-size:14px;font-weight:600;margin-bottom:8px">Mensaje</label>
        <textarea placeholder="Describeme tu proyecto, fechas, presupuesto aproximado..." rows="6" style="width:100%;background:#1a1020;border:1px solid rgba(255,255,255,0.12);border-radius:10px;padding:14px 16px;color:white;font-size:15px;outline:none;resize:vertical;box-sizing:border-box"></textarea>
      </div>
      <button type="submit" style="background:#be185d;color:white;font-size:16px;font-weight:700;padding:16px 32px;border-radius:10px;border:none;cursor:pointer;width:100%">Enviar mensaje</button>
    </form>
  </div>
</section>

<!-- FOOTER -->
<footer style="background:#0a0610;color:rgba(255,255,255,0.6);padding:48px 40px;${FS}">
  <div style="max-width:1100px;margin:0 auto;display:grid;grid-template-columns:2fr 1fr;gap:48px">
    <div>
      <span style="font-size:18px;font-weight:800;color:#be185d;display:block;margin-bottom:14px">NombreCreativo</span>
      <p style="font-size:14px;line-height:1.75;margin:0;max-width:320px">Disenador visual y fotografo freelance con mas de 8 anos de experiencia creando identidades memorables.</p>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:32px">
      <div>
        <h4 style="color:white;font-size:13px;font-weight:700;margin:0 0 16px;text-transform:uppercase;letter-spacing:0.08em">Paginas</h4>
        <ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:10px">
          <li><a href="/portafolio" style="color:rgba(255,255,255,0.6);text-decoration:none;font-size:14px">Portafolio</a></li>
          <li><a href="/sobre-mi" style="color:rgba(255,255,255,0.6);text-decoration:none;font-size:14px">Sobre mi</a></li>
          <li><a href="/servicios" style="color:rgba(255,255,255,0.6);text-decoration:none;font-size:14px">Servicios</a></li>
          <li><a href="/contacto" style="color:rgba(255,255,255,0.6);text-decoration:none;font-size:14px">Contacto</a></li>
        </ul>
      </div>
      <div>
        <h4 style="color:white;font-size:13px;font-weight:700;margin:0 0 16px;text-transform:uppercase;letter-spacing:0.08em">Contacto</h4>
        <div style="display:flex;flex-direction:column;gap:10px;font-size:14px">
          <span>hola@nombrecreativo.com</span>
          <span>+52 55 0000 0000</span>
          <span>Ciudad de Mexico</span>
        </div>
      </div>
    </div>
  </div>
  <div style="max-width:1100px;margin:32px auto 0;padding-top:24px;border-top:1px solid rgba(255,255,255,0.08);text-align:center;font-size:13px">
    &copy; 2025 NombreCreativo. Todos los derechos reservados.
  </div>
</footer>
`,
    },
  ],
}
