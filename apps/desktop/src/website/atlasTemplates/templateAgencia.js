const FS = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"

export const templateAgencia = {
  id: 'agencia',
  label: 'Agencia / Portfolio',
  category: 'tecnologia',
  description: 'Para agencias digitales, estudios creativos y portfolios profesionales.',
  color: '#1e1b4b',
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
<nav style="position:fixed;top:0;left:0;right:0;z-index:100;background:rgba(15,10,30,0.88);backdrop-filter:blur(12px);padding:0 40px;height:64px;display:flex;align-items:center;justify-content:space-between;${FS}">
  <span style="font-size:20px;font-weight:800;color:white;letter-spacing:-0.03em">Studio<span style="color:#818cf8">.</span></span>
  <div style="display:flex;gap:28px;align-items:center">
    <a href="#trabajos" style="color:rgba(255,255,255,0.7);text-decoration:none;font-size:14px;font-weight:500">Trabajos</a>
    <a href="#servicios" style="color:rgba(255,255,255,0.7);text-decoration:none;font-size:14px;font-weight:500">Servicios</a>
    <a href="#equipo" style="color:rgba(255,255,255,0.7);text-decoration:none;font-size:14px;font-weight:500">Equipo</a>
    <a href="/acceso" style="color:rgba(255,255,255,0.7);text-decoration:none;font-size:14px;font-weight:500">Iniciar sesion</a>
    <a href="#contacto" style="background:#6366f1;color:white;text-decoration:none;font-size:14px;font-weight:700;padding:9px 22px;border-radius:8px">Contactar</a>
  </div>
</nav>

<!-- HERO -->
<section style="min-height:100vh;background:#0f0a1e;display:flex;align-items:center;padding:80px 24px;overflow:hidden;${FS}">
  <div style="max-width:1100px;margin:0 auto;width:100%">
    <div style="max-width:800px">
      <div style="display:inline-flex;align-items:center;gap:8px;background:#1e1b4b;border:1px solid #312e81;border-radius:999px;padding:6px 18px;margin-bottom:36px">
        <span style="width:7px;height:7px;background:#818cf8;border-radius:50%;display:inline-block"></span>
        <span style="color:#a5b4fc;font-size:13px;font-weight:500">Agencia digital creativa</span>
      </div>
      <h1 style="font-size:clamp(44px,7vw,88px);font-weight:900;color:white;line-height:1.0;margin:0 0 28px;letter-spacing:-0.04em">Creamos<br><span style="background:linear-gradient(135deg,#818cf8,#c084fc);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text">experiencias</span><br>digitales.</h1>
      <p style="font-size:19px;color:#94a3b8;line-height:1.7;margin:0 0 48px;max-width:540px">Diseno, desarrollo y estrategia que transforma negocios ordinarios en marcas extraordinarias.</p>
      <div style="display:flex;gap:14px;flex-wrap:wrap">
        <a href="#trabajos" style="background:#6366f1;color:white;font-size:16px;font-weight:700;padding:15px 36px;border-radius:10px;text-decoration:none">Ver trabajos</a>
        <a href="#contacto" style="background:rgba(255,255,255,0.06);color:white;font-size:16px;font-weight:600;padding:15px 36px;border-radius:10px;text-decoration:none;border:1px solid rgba(255,255,255,0.12)">Hablemos</a>
      </div>
    </div>
  </div>
</section>

<!-- SERVICIOS -->
<section id="servicios" style="padding:100px 24px;background:#f8fafc;${FS}">
  <div style="max-width:1100px;margin:0 auto">
    <div style="margin-bottom:64px">
      <span style="color:#6366f1;font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase">Servicios</span>
      <h2 style="font-size:clamp(28px,4.5vw,50px);font-weight:800;color:#0f172a;margin:14px 0 0;letter-spacing:-0.025em">Lo que hacemos mejor</h2>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:2px;background:#e2e8f0;border-radius:16px;overflow:hidden">
      <div style="background:white;padding:36px">
        <div style="font-size:28px;font-weight:900;color:#e2e8f0;margin-bottom:20px">01</div>
        <h3 style="font-size:20px;font-weight:700;color:#0f172a;margin:0 0 12px">Diseno UX/UI</h3>
        <p style="font-size:15px;color:#64748b;line-height:1.7;margin:0">Interfaces intuitivas y atractivas que convierten visitantes en clientes fieles.</p>
      </div>
      <div style="background:white;padding:36px">
        <div style="font-size:28px;font-weight:900;color:#e2e8f0;margin-bottom:20px">02</div>
        <h3 style="font-size:20px;font-weight:700;color:#0f172a;margin:0 0 12px">Desarrollo web</h3>
        <p style="font-size:15px;color:#64748b;line-height:1.7;margin:0">Sitios y aplicaciones rapidas, seguras y escalables con tecnologias modernas.</p>
      </div>
      <div style="background:white;padding:36px">
        <div style="font-size:28px;font-weight:900;color:#e2e8f0;margin-bottom:20px">03</div>
        <h3 style="font-size:20px;font-weight:700;color:#0f172a;margin:0 0 12px">Branding</h3>
        <p style="font-size:15px;color:#64748b;line-height:1.7;margin:0">Identidades visuales memorables que diferencian tu marca en el mercado.</p>
      </div>
      <div style="background:white;padding:36px">
        <div style="font-size:28px;font-weight:900;color:#e2e8f0;margin-bottom:20px">04</div>
        <h3 style="font-size:20px;font-weight:700;color:#0f172a;margin:0 0 12px">Marketing digital</h3>
        <p style="font-size:15px;color:#64748b;line-height:1.7;margin:0">Estrategias de crecimiento que generan resultados medibles y sostenibles.</p>
      </div>
    </div>
  </div>
</section>

<!-- TRABAJOS -->
<section id="trabajos" style="padding:100px 24px;background:white;${FS}">
  <div style="max-width:1100px;margin:0 auto">
    <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:56px;flex-wrap:wrap;gap:20px">
      <div>
        <span style="color:#6366f1;font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase">Portfolio</span>
        <h2 style="font-size:clamp(26px,4vw,44px);font-weight:800;color:#0f172a;margin:14px 0 0;letter-spacing:-0.025em">Trabajos recientes</h2>
      </div>
      <a href="/portafolio" style="color:#6366f1;font-size:15px;font-weight:600;text-decoration:none">Ver todos &rarr;</a>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(480px,1fr));gap:24px">
      <div style="border-radius:20px;overflow:hidden;background:#f8fafc;position:relative">
        <img src="https://placehold.co/700x420/312e81/a5b4fc?text=Proyecto+Alpha" style="width:100%;height:280px;object-fit:cover;display:block">
        <div style="padding:28px">
          <div style="display:flex;gap:8px;margin-bottom:12px">
            <span style="background:#ede9fe;color:#4f46e5;font-size:12px;font-weight:600;padding:4px 12px;border-radius:999px">Branding</span>
            <span style="background:#e0f2fe;color:#0284c7;font-size:12px;font-weight:600;padding:4px 12px;border-radius:999px">Web</span>
          </div>
          <h3 style="font-size:20px;font-weight:700;color:#0f172a;margin:0 0 8px">Proyecto Alpha</h3>
          <p style="font-size:14px;color:#64748b;margin:0">Rediseno completo de identidad y plataforma digital para empresa fintech.</p>
        </div>
      </div>
      <div style="border-radius:20px;overflow:hidden;background:#f8fafc;position:relative">
        <img src="https://placehold.co/700x420/064e3b/6ee7b7?text=Proyecto+Beta" style="width:100%;height:280px;object-fit:cover;display:block">
        <div style="padding:28px">
          <div style="display:flex;gap:8px;margin-bottom:12px">
            <span style="background:#dcfce7;color:#16a34a;font-size:12px;font-weight:600;padding:4px 12px;border-radius:999px">Ecommerce</span>
            <span style="background:#fef3c7;color:#d97706;font-size:12px;font-weight:600;padding:4px 12px;border-radius:999px">UX</span>
          </div>
          <h3 style="font-size:20px;font-weight:700;color:#0f172a;margin:0 0 8px">Proyecto Beta</h3>
          <p style="font-size:14px;color:#64748b;margin:0">Tienda en linea con experiencia de usuario optimizada y conversion incrementada.</p>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- CLIENTES -->
<section style="padding:60px 24px;background:#f8fafc;${FS}">
  <div style="max-width:900px;margin:0 auto;text-align:center">
    <p style="color:#94a3b8;font-size:13px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;margin:0 0 36px">Empresas que confian en nosotros</p>
    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:20px;align-items:center">
      <div style="background:white;border-radius:12px;padding:16px;height:56px;display:flex;align-items:center;justify-content:center"><span style="font-size:16px;font-weight:800;color:#cbd5e1">BRAND1</span></div>
      <div style="background:white;border-radius:12px;padding:16px;height:56px;display:flex;align-items:center;justify-content:center"><span style="font-size:16px;font-weight:800;color:#cbd5e1">BRAND2</span></div>
      <div style="background:white;border-radius:12px;padding:16px;height:56px;display:flex;align-items:center;justify-content:center"><span style="font-size:16px;font-weight:800;color:#cbd5e1">BRAND3</span></div>
      <div style="background:white;border-radius:12px;padding:16px;height:56px;display:flex;align-items:center;justify-content:center"><span style="font-size:16px;font-weight:800;color:#cbd5e1">BRAND4</span></div>
      <div style="background:white;border-radius:12px;padding:16px;height:56px;display:flex;align-items:center;justify-content:center"><span style="font-size:16px;font-weight:800;color:#cbd5e1">BRAND5</span></div>
    </div>
  </div>
</section>

<!-- CONTACTO -->
<section id="contacto" style="padding:100px 24px;background:#0f0a1e;${FS}">
  <div style="max-width:560px;margin:0 auto;text-align:center">
    <span style="color:#818cf8;font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase">Hablemos</span>
    <h2 style="font-size:clamp(28px,4.5vw,50px);font-weight:800;color:white;margin:16px 0 14px;letter-spacing:-0.025em">Tienes un proyecto en mente?</h2>
    <p style="font-size:16px;color:#64748b;line-height:1.7;margin:0 0 48px">Cuentanos tu idea y construimos algo increible juntos.</p>
    <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:20px;padding:36px">
      <form style="display:flex;flex-direction:column;gap:14px">
        <input type="text" placeholder="Nombre" style="border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.06);color:white;border-radius:10px;padding:13px 16px;font-size:15px;outline:none">
        <input type="email" placeholder="Email" style="border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.06);color:white;border-radius:10px;padding:13px 16px;font-size:15px;outline:none">
        <textarea placeholder="Cuentame tu proyecto..." rows="4" style="border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.06);color:white;border-radius:10px;padding:13px 16px;font-size:15px;outline:none;resize:vertical;font-family:inherit"></textarea>
        <button type="submit" style="background:linear-gradient(135deg,#4f46e5,#7c3aed);color:white;font-size:16px;font-weight:700;padding:15px;border:none;border-radius:10px;cursor:pointer">Enviar mensaje</button>
      </form>
    </div>
  </div>
</section>

<!-- FOOTER -->
<footer style="background:#060412;padding:36px 24px;text-align:center;${FS}">
  <p style="color:rgba(255,255,255,0.3);font-size:14px;margin:0">&#169; 2025 Studio &middot; Tu socio de transformacion digital</p>
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
<nav style="background:#0f172a;padding:0 40px;height:64px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <a href="/" style="font-size:20px;font-weight:800;color:white;text-decoration:none">AgenciaNombre</a>
  <div style="display:flex;gap:24px;align-items:center">
    <a href="/" style="color:rgba(255,255,255,0.8);text-decoration:none;font-size:14px">Inicio</a>
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
      <div style="padding:28px;border-radius:16px;border:1px solid #e2e8f0"><div style="width:48px;height:48px;background:#eff6ff;border-radius:12px;display:flex;align-items:center;justify-content:center;margin-bottom:16px;font-size:18px;font-weight:800;color:#1e40af">W</div><h3 style="margin:0 0 10px;font-size:18px;font-weight:700;color:#0f172a">Desarrollo web</h3><p style="margin:0;font-size:14px;color:#64748b;line-height:1.6">Sitios y aplicaciones de alto rendimiento con las tecnologias mas modernas del mercado.</p></div>
      <div style="padding:28px;border-radius:16px;border:1px solid #e2e8f0"><div style="width:48px;height:48px;background:#eff6ff;border-radius:12px;display:flex;align-items:center;justify-content:center;margin-bottom:16px;font-size:18px;font-weight:800;color:#1e40af">A</div><h3 style="margin:0 0 10px;font-size:18px;font-weight:700;color:#0f172a">Apps moviles</h3><p style="margin:0;font-size:14px;color:#64748b;line-height:1.6">Aplicaciones iOS y Android con experiencias de usuario excepcionales y alto impacto.</p></div>
      <div style="padding:28px;border-radius:16px;border:1px solid #e2e8f0"><div style="width:48px;height:48px;background:#eff6ff;border-radius:12px;display:flex;align-items:center;justify-content:center;margin-bottom:16px;font-size:18px;font-weight:800;color:#1e40af">D</div><h3 style="margin:0 0 10px;font-size:18px;font-weight:700;color:#0f172a">Diseno UX/UI</h3><p style="margin:0;font-size:14px;color:#64748b;line-height:1.6">Interfaces intuitivas y atractivas centradas en la experiencia del usuario final.</p></div>
      <div style="padding:28px;border-radius:16px;border:1px solid #e2e8f0"><div style="width:48px;height:48px;background:#eff6ff;border-radius:12px;display:flex;align-items:center;justify-content:center;margin-bottom:16px;font-size:18px;font-weight:800;color:#1e40af">M</div><h3 style="margin:0 0 10px;font-size:18px;font-weight:700;color:#0f172a">Marketing digital</h3><p style="margin:0;font-size:14px;color:#64748b;line-height:1.6">SEO, SEM y estrategias de contenidos para aumentar tu presencia y ventas en linea.</p></div>
      <div style="padding:28px;border-radius:16px;border:1px solid #e2e8f0"><div style="width:48px;height:48px;background:#eff6ff;border-radius:12px;display:flex;align-items:center;justify-content:center;margin-bottom:16px;font-size:18px;font-weight:800;color:#1e40af">I</div><h3 style="margin:0 0 10px;font-size:18px;font-weight:700;color:#0f172a">Integraciones</h3><p style="margin:0;font-size:14px;color:#64748b;line-height:1.6">Conectamos tus sistemas y herramientas para automatizar procesos y ahorrar tiempo.</p></div>
      <div style="padding:28px;border-radius:16px;border:1px solid #e2e8f0"><div style="width:48px;height:48px;background:#eff6ff;border-radius:12px;display:flex;align-items:center;justify-content:center;margin-bottom:16px;font-size:18px;font-weight:800;color:#1e40af">S</div><h3 style="margin:0 0 10px;font-size:18px;font-weight:700;color:#0f172a">Soporte tecnico</h3><p style="margin:0;font-size:14px;color:#64748b;line-height:1.6">Mantenimiento, soporte y evolucion continua de tus plataformas digitales.</p></div>
    </div>
  </div>
</section>
<footer style="background:#0f172a;color:rgba(255,255,255,0.6);padding:40px;text-align:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <p style="margin:0 0 8px;font-size:18px;font-weight:800;color:white">AgenciaNombre</p>
  <p style="margin:0;font-size:13px">hola@agencia.com &middot; 55 0000-1111</p>
  <p style="margin:20px 0 0;font-size:12px;color:rgba(255,255,255,0.3)">&copy; 2025 AgenciaNombre.</p>
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
<nav style="background:#0f172a;padding:0 40px;height:64px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <a href="/" style="font-size:20px;font-weight:800;color:white;text-decoration:none">AgenciaNombre</a>
  <div style="display:flex;gap:24px;align-items:center">
    <a href="/" style="color:rgba(255,255,255,0.8);text-decoration:none;font-size:14px">Inicio</a>
    <a href="/servicios" style="color:rgba(255,255,255,0.8);text-decoration:none;font-size:14px">Servicios</a>
    <a href="/acceso" style="color:rgba(255,255,255,0.8);text-decoration:none;font-size:14px">Iniciar sesion</a>
    <a href="/contacto" style="background:#2563eb;color:white;text-decoration:none;font-size:14px;font-weight:700;padding:9px 22px;border-radius:8px">Contactar</a>
  </div>
</nav>
<section style="padding:80px 24px;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:1100px;margin:0 auto">
    <div style="text-align:center;margin-bottom:60px"><h1 style="font-size:44px;font-weight:800;color:#0f172a;margin:0;letter-spacing:-0.02em">Nuestro portafolio</h1><p style="font-size:17px;color:#64748b;margin:16px 0 0">Proyectos que demuestran nuestro compromiso con la calidad.</p></div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:24px">
      <div style="border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.07)"><img src="https://placehold.co/600x400/1e40af/ffffff?text=E-commerce" style="width:100%;height:180px;object-fit:cover"><div style="padding:20px;background:white"><p style="margin:0;font-weight:700;color:#0f172a">Tienda Fashion</p><p style="margin:4px 0 0;font-size:13px;color:#64748b">Desarrollo web &middot; UI Design</p></div></div>
      <div style="border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.07)"><img src="https://placehold.co/600x400/1d4ed8/ffffff?text=App+Movil" style="width:100%;height:180px;object-fit:cover"><div style="padding:20px;background:white"><p style="margin:0;font-weight:700;color:#0f172a">App de delivery</p><p style="margin:4px 0 0;font-size:13px;color:#64748b">iOS &middot; Android &middot; Backend</p></div></div>
      <div style="border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.07)"><img src="https://placehold.co/600x400/2563eb/ffffff?text=Dashboard" style="width:100%;height:180px;object-fit:cover"><div style="padding:20px;background:white"><p style="margin:0;font-weight:700;color:#0f172a">Dashboard analytics</p><p style="margin:4px 0 0;font-size:13px;color:#64748b">SaaS &middot; Data viz</p></div></div>
      <div style="border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.07)"><img src="https://placehold.co/600x400/1e3a8a/ffffff?text=Portal" style="width:100%;height:180px;object-fit:cover"><div style="padding:20px;background:white"><p style="margin:0;font-weight:700;color:#0f172a">Portal corporativo</p><p style="margin:4px 0 0;font-size:13px;color:#64748b">CMS &middot; Intranet</p></div></div>
      <div style="border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.07)"><img src="https://placehold.co/600x400/1e40af/dbeafe?text=EdTech" style="width:100%;height:180px;object-fit:cover"><div style="padding:20px;background:white"><p style="margin:0;font-weight:700;color:#0f172a">Plataforma educativa</p><p style="margin:4px 0 0;font-size:13px;color:#64748b">EdTech &middot; LMS</p></div></div>
      <div style="border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.07)"><img src="https://placehold.co/600x400/1d4ed8/bfdbfe?text=Reservas" style="width:100%;height:180px;object-fit:cover"><div style="padding:20px;background:white"><p style="margin:0;font-weight:700;color:#0f172a">Sistema de reservas</p><p style="margin:4px 0 0;font-size:13px;color:#64748b">Web app &middot; API</p></div></div>
    </div>
  </div>
</section>
<footer style="background:#0f172a;color:rgba(255,255,255,0.6);padding:40px;text-align:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <p style="margin:0 0 8px;font-size:18px;font-weight:800;color:white">AgenciaNombre</p>
  <p style="margin:0;font-size:13px">hola@agencia.com &middot; 55 0000-1111</p>
  <p style="margin:20px 0 0;font-size:12px;color:rgba(255,255,255,0.3)">&copy; 2025 AgenciaNombre.</p>
</footer>
`,
    },
    {
      id: 'equipo',
      label: 'Equipo',
      routePath: '/equipo',
      title: 'Equipo',
      required: false,
      css: '',
      html: `
<nav style="background:#0f172a;padding:0 40px;height:64px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <a href="/" style="font-size:20px;font-weight:800;color:white;text-decoration:none">AgenciaNombre</a>
  <div style="display:flex;gap:24px;align-items:center">
    <a href="/" style="color:rgba(255,255,255,0.8);text-decoration:none;font-size:14px">Inicio</a>
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
      <div style="text-align:center"><img src="https://placehold.co/200x200/1e40af/ffffff?text=AM" style="width:80px;height:80px;border-radius:50%;object-fit:cover;margin-bottom:14px"><p style="margin:0;font-weight:700;color:#0f172a">Ana Martinez</p><p style="margin:4px 0 0;font-size:13px;color:#2563eb">CEO &amp; Founder</p></div>
      <div style="text-align:center"><img src="https://placehold.co/200x200/1d4ed8/ffffff?text=CR" style="width:80px;height:80px;border-radius:50%;object-fit:cover;margin-bottom:14px"><p style="margin:0;font-weight:700;color:#0f172a">Carlos Ruiz</p><p style="margin:4px 0 0;font-size:13px;color:#2563eb">Lead Developer</p></div>
      <div style="text-align:center"><img src="https://placehold.co/200x200/2563eb/ffffff?text=SL" style="width:80px;height:80px;border-radius:50%;object-fit:cover;margin-bottom:14px"><p style="margin:0;font-weight:700;color:#0f172a">Sofia Lopez</p><p style="margin:4px 0 0;font-size:13px;color:#2563eb">UX Designer</p></div>
      <div style="text-align:center"><img src="https://placehold.co/200x200/1e3a8a/ffffff?text=MG" style="width:80px;height:80px;border-radius:50%;object-fit:cover;margin-bottom:14px"><p style="margin:0;font-weight:700;color:#0f172a">Miguel Garcia</p><p style="margin:4px 0 0;font-size:13px;color:#2563eb">Marketing</p></div>
    </div>
  </div>
</section>
<footer style="background:#0f172a;color:rgba(255,255,255,0.6);padding:40px;text-align:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <p style="margin:0 0 8px;font-size:18px;font-weight:800;color:white">AgenciaNombre</p>
  <p style="margin:0;font-size:13px">hola@agencia.com &middot; 55 0000-1111</p>
  <p style="margin:20px 0 0;font-size:12px;color:rgba(255,255,255,0.3)">&copy; 2025 AgenciaNombre.</p>
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
<nav style="background:#0f172a;padding:0 40px;height:64px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <a href="/" style="font-size:20px;font-weight:800;color:white;text-decoration:none">AgenciaNombre</a>
  <div style="display:flex;gap:24px;align-items:center">
    <a href="/" style="color:rgba(255,255,255,0.8);text-decoration:none;font-size:14px">Inicio</a>
    <a href="/servicios" style="color:rgba(255,255,255,0.8);text-decoration:none;font-size:14px">Servicios</a>
    <a href="/portafolio" style="color:rgba(255,255,255,0.8);text-decoration:none;font-size:14px">Portafolio</a>
    <a href="/acceso" style="color:rgba(255,255,255,0.8);text-decoration:none;font-size:14px">Iniciar sesion</a>
  </div>
</nav>
<section style="padding:80px 24px;background:white;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:900px;margin:0 auto;display:grid;grid-template-columns:1fr 1fr;gap:64px;align-items:start">
    <div><h1 style="font-size:44px;font-weight:800;color:#0f172a;margin:0 0 20px;letter-spacing:-0.02em">Hablemos</h1><p style="font-size:16px;color:#64748b;line-height:1.7;margin:0 0 36px">Cuentanos tu proyecto. Respondemos en menos de 24 horas.</p>
      <div style="display:flex;flex-direction:column;gap:20px">
        <div style="display:flex;gap:14px"><div style="width:40px;height:40px;background:#eff6ff;border-radius:10px;display:flex;align-items:center;justify-content:center;font-weight:700;color:#1e40af;flex-shrink:0">@</div><div><p style="margin:0;font-weight:600;color:#0f172a">Email</p><p style="margin:4px 0 0;font-size:14px;color:#64748b">hola@agencia.com</p></div></div>
        <div style="display:flex;gap:14px"><div style="width:40px;height:40px;background:#eff6ff;border-radius:10px;display:flex;align-items:center;justify-content:center;font-weight:700;color:#1e40af;flex-shrink:0">T</div><div><p style="margin:0;font-weight:600;color:#0f172a">Telefono</p><p style="margin:4px 0 0;font-size:14px;color:#64748b">55 0000-1111</p></div></div>
      </div>
    </div>
    <div style="background:#f8fafc;border-radius:20px;padding:32px">
      <div style="display:grid;gap:14px">
        <input placeholder="Tu nombre" style="border:1px solid #e2e8f0;border-radius:10px;padding:12px 16px;font-size:15px;outline:none;width:100%;box-sizing:border-box">
        <input type="email" placeholder="Correo electronico" style="border:1px solid #e2e8f0;border-radius:10px;padding:12px 16px;font-size:15px;outline:none;width:100%;box-sizing:border-box">
        <input placeholder="Empresa (opcional)" style="border:1px solid #e2e8f0;border-radius:10px;padding:12px 16px;font-size:15px;outline:none;width:100%;box-sizing:border-box">
        <textarea placeholder="Cuentanos sobre tu proyecto..." rows="4" style="border:1px solid #e2e8f0;border-radius:10px;padding:12px 16px;font-size:15px;outline:none;width:100%;box-sizing:border-box;resize:vertical"></textarea>
        <button type="submit" style="background:#1e40af;color:white;border:none;border-radius:10px;padding:13px;font-size:15px;font-weight:700;cursor:pointer">Enviar mensaje</button>
      </div>
    </div>
  </div>
</section>
<footer style="background:#0f172a;color:rgba(255,255,255,0.6);padding:40px;text-align:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <p style="margin:0 0 8px;font-size:18px;font-weight:800;color:white">AgenciaNombre</p>
  <p style="margin:0;font-size:13px">hola@agencia.com &middot; 55 0000-1111</p>
  <p style="margin:20px 0 0;font-size:12px;color:rgba(255,255,255,0.3)">&copy; 2025 AgenciaNombre.</p>
</footer>
`,
    },
  ],
}
