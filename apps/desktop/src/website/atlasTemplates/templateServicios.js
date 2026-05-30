const FS = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"

export const templateServicios = {
  id: 'servicios',
  label: 'Servicios Profesionales',
  category: 'negocios',
  description: 'Para consultorias, despachos legales, contadores y profesionales.',
  color: '#1e3a5f',
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
<nav style="background:white;border-bottom:1px solid #e2e8f0;padding:0 40px;height:68px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100;${FS}">
  <span style="font-size:20px;font-weight:800;color:#1e3a5f;letter-spacing:-0.025em">ConsultingPro</span>
  <div style="display:flex;gap:28px;align-items:center">
    <a href="#servicios" style="color:#374151;text-decoration:none;font-size:14px;font-weight:500">Servicios</a>
    <a href="#nosotros" style="color:#374151;text-decoration:none;font-size:14px;font-weight:500">Nosotros</a>
    <a href="#equipo" style="color:#374151;text-decoration:none;font-size:14px;font-weight:500">Equipo</a>
    <a href="/acceso" style="color:#374151;text-decoration:none;font-size:14px;font-weight:500">Iniciar sesion</a>
    <a href="#contacto" style="background:#1e3a5f;color:white;text-decoration:none;font-size:14px;font-weight:600;padding:9px 22px;border-radius:8px">Consulta gratuita</a>
  </div>
</nav>

<!-- HERO -->
<section style="background:white;padding:100px 24px;${FS}">
  <div style="max-width:1100px;margin:0 auto;display:grid;grid-template-columns:1fr 1fr;gap:80px;align-items:center">
    <div>
      <div style="display:inline-flex;align-items:center;gap:8px;background:#eff6ff;border-radius:999px;padding:6px 16px;margin-bottom:28px">
        <div style="width:8px;height:8px;background:#2563eb;border-radius:50%"></div>
        <span style="color:#1d4ed8;font-size:13px;font-weight:600">+15 anos de experiencia</span>
      </div>
      <h1 style="font-size:clamp(34px,4.5vw,58px);font-weight:900;color:#1e3a5f;line-height:1.1;margin:0 0 22px;letter-spacing:-0.03em">Soluciones profesionales para tu empresa</h1>
      <p style="font-size:17px;color:#64748b;line-height:1.8;margin:0 0 36px">Te acompanamos en cada decision estrategica con expertise, rigor y un enfoque orientado a resultados tangibles.</p>
      <div style="display:flex;gap:16px;flex-wrap:wrap">
        <a href="#contacto" style="background:#1e3a5f;color:white;font-size:15px;font-weight:700;padding:15px 36px;border-radius:10px;text-decoration:none">Consulta sin costo</a>
        <a href="#servicios" style="background:#f1f5f9;color:#1e3a5f;font-size:15px;font-weight:600;padding:15px 36px;border-radius:10px;text-decoration:none">Nuestros servicios</a>
      </div>
    </div>
    <div>
      <img src="https://placehold.co/600x480/1e3a5f/93c5fd?text=Profesionales" style="width:100%;border-radius:24px;display:block">
    </div>
  </div>
</section>

<!-- STATS -->
<section style="padding:60px 24px;background:#1e3a5f;${FS}">
  <div style="max-width:900px;margin:0 auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:40px;text-align:center">
    <div><p style="font-size:52px;font-weight:900;color:white;margin:0;letter-spacing:-0.04em">+250</p><p style="font-size:14px;color:#93c5fd;margin:8px 0 0;font-weight:500">Empresas asesoradas</p></div>
    <div><p style="font-size:52px;font-weight:900;color:white;margin:0;letter-spacing:-0.04em">98%</p><p style="font-size:14px;color:#93c5fd;margin:8px 0 0;font-weight:500">Tasa de exito</p></div>
    <div><p style="font-size:52px;font-weight:900;color:white;margin:0;letter-spacing:-0.04em">15+</p><p style="font-size:14px;color:#93c5fd;margin:8px 0 0;font-weight:500">Anos de experiencia</p></div>
    <div><p style="font-size:52px;font-weight:900;color:white;margin:0;letter-spacing:-0.04em">48h</p><p style="font-size:14px;color:#93c5fd;margin:8px 0 0;font-weight:500">Tiempo de respuesta</p></div>
  </div>
</section>

<!-- SERVICIOS -->
<section id="servicios" style="padding:100px 24px;background:#f8fafc;${FS}">
  <div style="max-width:1100px;margin:0 auto">
    <div style="text-align:center;margin-bottom:64px">
      <span style="color:#2563eb;font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase">Areas de practica</span>
      <h2 style="font-size:clamp(26px,4vw,44px);font-weight:800;color:#1e3a5f;margin:14px 0 0;letter-spacing:-0.025em">Expertise que marca la diferencia</h2>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:20px">
      <div style="background:white;border-radius:20px;padding:36px;border-top:4px solid #2563eb;box-shadow:0 2px 12px rgba(0,0,0,0.04)">
        <div style="width:52px;height:52px;background:#eff6ff;border-radius:14px;margin-bottom:20px;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:800;color:#1e3a5f">E</div>
        <h3 style="font-size:19px;font-weight:700;color:#1e3a5f;margin:0 0 12px">Consultoria estrategica</h3>
        <p style="font-size:15px;color:#64748b;line-height:1.7;margin:0">Planificacion y ejecucion de estrategias que impulsan el crecimiento sostenible.</p>
      </div>
      <div style="background:white;border-radius:20px;padding:36px;border-top:4px solid #0891b2;box-shadow:0 2px 12px rgba(0,0,0,0.04)">
        <div style="width:52px;height:52px;background:#ecfeff;border-radius:14px;margin-bottom:20px;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:800;color:#0891b2">L</div>
        <h3 style="font-size:19px;font-weight:700;color:#1e3a5f;margin:0 0 12px">Asesoria legal</h3>
        <p style="font-size:15px;color:#64748b;line-height:1.7;margin:0">Proteccion juridica integral para tu empresa y tus operaciones comerciales.</p>
      </div>
      <div style="background:white;border-radius:20px;padding:36px;border-top:4px solid #7c3aed;box-shadow:0 2px 12px rgba(0,0,0,0.04)">
        <div style="width:52px;height:52px;background:#f5f3ff;border-radius:14px;margin-bottom:20px;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:800;color:#7c3aed">F</div>
        <h3 style="font-size:19px;font-weight:700;color:#1e3a5f;margin:0 0 12px">Gestion financiera</h3>
        <p style="font-size:15px;color:#64748b;line-height:1.7;margin:0">Optimizacion de recursos, contabilidad y planificacion financiera empresarial.</p>
      </div>
    </div>
  </div>
</section>

<!-- EQUIPO -->
<section id="equipo" style="padding:100px 24px;background:white;${FS}">
  <div style="max-width:1000px;margin:0 auto">
    <div style="text-align:center;margin-bottom:64px">
      <span style="color:#2563eb;font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase">Nuestros especialistas</span>
      <h2 style="font-size:clamp(26px,4vw,44px);font-weight:800;color:#1e3a5f;margin:14px 0 0;letter-spacing:-0.025em">Expertos a tu servicio</h2>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:28px">
      <div style="text-align:center">
        <img src="https://placehold.co/120x120/dbeafe/1e3a5f?text=LM" style="width:96px;height:96px;border-radius:50%;object-fit:cover;margin:0 auto 16px;display:block">
        <h3 style="font-size:17px;font-weight:700;color:#1e3a5f;margin:0 0 4px">Lic. Laura Morales</h3>
        <p style="font-size:13px;color:#2563eb;font-weight:600;margin:0 0 10px">Directora General</p>
        <p style="font-size:14px;color:#64748b;line-height:1.6;margin:0">Especialista en derecho corporativo y estrategia empresarial.</p>
      </div>
      <div style="text-align:center">
        <img src="https://placehold.co/120x120/eff6ff/1e3a5f?text=PV" style="width:96px;height:96px;border-radius:50%;object-fit:cover;margin:0 auto 16px;display:block">
        <h3 style="font-size:17px;font-weight:700;color:#1e3a5f;margin:0 0 4px">CPA Pablo Vargas</h3>
        <p style="font-size:13px;color:#2563eb;font-weight:600;margin:0 0 10px">Director Financiero</p>
        <p style="font-size:14px;color:#64748b;line-height:1.6;margin:0">Experto en finanzas corporativas y planeacion fiscal.</p>
      </div>
      <div style="text-align:center">
        <img src="https://placehold.co/120x120/bfdbfe/1e3a5f?text=SR" style="width:96px;height:96px;border-radius:50%;object-fit:cover;margin:0 auto 16px;display:block">
        <h3 style="font-size:17px;font-weight:700;color:#1e3a5f;margin:0 0 4px">MBA Sofia Reyes</h3>
        <p style="font-size:13px;color:#2563eb;font-weight:600;margin:0 0 10px">Directora de Estrategia</p>
        <p style="font-size:14px;color:#64748b;line-height:1.6;margin:0">Especialista en transformacion organizacional y crecimiento.</p>
      </div>
    </div>
  </div>
</section>

<!-- CONTACTO -->
<section id="contacto" style="padding:100px 24px;background:#f8fafc;${FS}">
  <div style="max-width:700px;margin:0 auto;text-align:center">
    <span style="color:#2563eb;font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase">Contacto</span>
    <h2 style="font-size:clamp(26px,4vw,44px);font-weight:800;color:#1e3a5f;margin:16px 0 14px;letter-spacing:-0.025em">Solicita tu consulta gratuita</h2>
    <p style="font-size:16px;color:#64748b;margin:0 0 48px;line-height:1.7">Sin compromiso. Nos ponemos en contacto contigo en menos de 24 horas habiles.</p>
    <div style="background:white;border-radius:24px;padding:40px;box-shadow:0 4px 24px rgba(0,0,0,0.07)">
      <form style="display:flex;flex-direction:column;gap:16px">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
          <input type="text" placeholder="Nombre" style="border:2px solid #e2e8f0;border-radius:10px;padding:13px 16px;font-size:15px;outline:none">
          <input type="text" placeholder="Empresa" style="border:2px solid #e2e8f0;border-radius:10px;padding:13px 16px;font-size:15px;outline:none">
        </div>
        <input type="email" placeholder="Email corporativo" style="border:2px solid #e2e8f0;border-radius:10px;padding:13px 16px;font-size:15px;outline:none">
        <input type="tel" placeholder="Telefono" style="border:2px solid #e2e8f0;border-radius:10px;padding:13px 16px;font-size:15px;outline:none">
        <select style="border:2px solid #e2e8f0;border-radius:10px;padding:13px 16px;font-size:15px;outline:none;color:#374151">
          <option value="">Area de interes</option>
          <option>Consultoria estrategica</option>
          <option>Asesoria legal</option>
          <option>Gestion financiera</option>
          <option>Otro</option>
        </select>
        <textarea placeholder="Describe brevemente tu necesidad..." rows="4" style="border:2px solid #e2e8f0;border-radius:10px;padding:13px 16px;font-size:15px;outline:none;resize:vertical;font-family:inherit"></textarea>
        <button type="submit" style="background:#1e3a5f;color:white;font-size:16px;font-weight:700;padding:15px;border:none;border-radius:12px;cursor:pointer">Solicitar consulta gratuita</button>
      </form>
    </div>
  </div>
</section>

<!-- FOOTER -->
<footer style="background:#1e3a5f;padding:40px 24px;text-align:center;${FS}">
  <p style="color:rgba(255,255,255,0.4);font-size:14px;margin:0">&#169; 2025 ConsultingPro &middot; Tu exito, nuestra mision</p>
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
<nav style="background:#4c1d95;padding:0 40px;height:64px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <a href="/" style="font-size:20px;font-weight:800;color:white;text-decoration:none;letter-spacing:-0.02em">ConsultingPro</a>
  <div style="display:flex;gap:24px;align-items:center">
    <a href="/" style="color:rgba(255,255,255,0.8);text-decoration:none;font-size:14px">Inicio</a>
    <a href="/precios" style="color:rgba(255,255,255,0.8);text-decoration:none;font-size:14px">Precios</a>
    <a href="/clientes" style="color:rgba(255,255,255,0.8);text-decoration:none;font-size:14px">Clientes</a>
    <a href="/acceso" style="color:rgba(255,255,255,0.8);text-decoration:none;font-size:14px">Iniciar sesion</a>
    <a href="/contacto" style="background:#7c3aed;color:white;text-decoration:none;font-size:14px;font-weight:700;padding:9px 22px;border-radius:8px">Consulta gratuita</a>
  </div>
</nav>
<section style="padding:80px 24px;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:1100px;margin:0 auto">
    <div style="text-align:center;margin-bottom:60px">
      <p style="color:#7c3aed;font-size:12px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;margin:0 0 12px">Lo que ofrecemos</p>
      <h1 style="font-size:44px;font-weight:800;color:#0f172a;margin:0;letter-spacing:-0.02em">Nuestros servicios</h1>
      <p style="font-size:17px;color:#64748b;margin:16px 0 0">Soluciones profesionales adaptadas a las necesidades de tu empresa.</p>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:24px">
      <div style="background:white;border-radius:20px;padding:32px;box-shadow:0 2px 12px rgba(0,0,0,0.05);border-top:4px solid #7c3aed">
        <div style="width:48px;height:48px;background:#f5f3ff;border-radius:12px;display:flex;align-items:center;justify-content:center;margin-bottom:18px;font-size:18px;font-weight:800;color:#7c3aed">E</div>
        <h3 style="font-size:18px;font-weight:700;color:#0f172a;margin:0 0 10px">Consultoria estrategica</h3>
        <p style="font-size:14px;color:#64748b;line-height:1.6;margin:0">Definimos junto contigo la hoja de ruta para alcanzar tus objetivos de negocio a largo plazo.</p>
      </div>
      <div style="background:white;border-radius:20px;padding:32px;box-shadow:0 2px 12px rgba(0,0,0,0.05);border-top:4px solid #6d28d9">
        <div style="width:48px;height:48px;background:#f5f3ff;border-radius:12px;display:flex;align-items:center;justify-content:center;margin-bottom:18px;font-size:18px;font-weight:800;color:#6d28d9">F</div>
        <h3 style="font-size:18px;font-weight:700;color:#0f172a;margin:0 0 10px">Asesoria financiera</h3>
        <p style="font-size:14px;color:#64748b;line-height:1.6;margin:0">Optimizacion de recursos, analisis de costos y planificacion financiera para maximizar resultados.</p>
      </div>
      <div style="background:white;border-radius:20px;padding:32px;box-shadow:0 2px 12px rgba(0,0,0,0.05);border-top:4px solid #7c3aed">
        <div style="width:48px;height:48px;background:#f5f3ff;border-radius:12px;display:flex;align-items:center;justify-content:center;margin-bottom:18px;font-size:18px;font-weight:800;color:#7c3aed">L</div>
        <h3 style="font-size:18px;font-weight:700;color:#0f172a;margin:0 0 10px">Asesoria legal</h3>
        <p style="font-size:14px;color:#64748b;line-height:1.6;margin:0">Proteccion juridica integral: contratos, compliance, propiedad intelectual y disputas comerciales.</p>
      </div>
      <div style="background:white;border-radius:20px;padding:32px;box-shadow:0 2px 12px rgba(0,0,0,0.05);border-top:4px solid #6d28d9">
        <div style="width:48px;height:48px;background:#f5f3ff;border-radius:12px;display:flex;align-items:center;justify-content:center;margin-bottom:18px;font-size:18px;font-weight:800;color:#6d28d9">R</div>
        <h3 style="font-size:18px;font-weight:700;color:#0f172a;margin:0 0 10px">Recursos humanos</h3>
        <p style="font-size:14px;color:#64748b;line-height:1.6;margin:0">Reclutamiento, evaluacion de desempeno, cultura organizacional y gestion del talento.</p>
      </div>
      <div style="background:white;border-radius:20px;padding:32px;box-shadow:0 2px 12px rgba(0,0,0,0.05);border-top:4px solid #7c3aed">
        <div style="width:48px;height:48px;background:#f5f3ff;border-radius:12px;display:flex;align-items:center;justify-content:center;margin-bottom:18px;font-size:18px;font-weight:800;color:#7c3aed">T</div>
        <h3 style="font-size:18px;font-weight:700;color:#0f172a;margin:0 0 10px">Transformacion digital</h3>
        <p style="font-size:14px;color:#64748b;line-height:1.6;margin:0">Implementacion de tecnologia y procesos digitales para modernizar tu operacion.</p>
      </div>
      <div style="background:white;border-radius:20px;padding:32px;box-shadow:0 2px 12px rgba(0,0,0,0.05);border-top:4px solid #6d28d9">
        <div style="width:48px;height:48px;background:#f5f3ff;border-radius:12px;display:flex;align-items:center;justify-content:center;margin-bottom:18px;font-size:18px;font-weight:800;color:#6d28d9">A</div>
        <h3 style="font-size:18px;font-weight:700;color:#0f172a;margin:0 0 10px">Auditoria</h3>
        <p style="font-size:14px;color:#64748b;line-height:1.6;margin:0">Revision exhaustiva de procesos, riesgos operativos y cumplimiento normativo empresarial.</p>
      </div>
    </div>
  </div>
</section>
<footer style="background:#4c1d95;color:rgba(255,255,255,0.6);padding:40px;text-align:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <p style="margin:0 0 8px;font-size:18px;font-weight:800;color:white">ConsultingPro</p>
  <p style="margin:0;font-size:13px">contacto@consultingpro.com &middot; 55 0000-3333</p>
  <p style="margin:20px 0 0;font-size:12px;color:rgba(255,255,255,0.3)">&copy; 2025 ConsultingPro. Tu exito, nuestra mision.</p>
</footer>
`,
    },
    {
      id: 'precios',
      label: 'Precios',
      routePath: '/precios',
      title: 'Precios',
      required: false,
      css: '',
      html: `
<nav style="background:#4c1d95;padding:0 40px;height:64px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <a href="/" style="font-size:20px;font-weight:800;color:white;text-decoration:none;letter-spacing:-0.02em">ConsultingPro</a>
  <div style="display:flex;gap:24px;align-items:center">
    <a href="/" style="color:rgba(255,255,255,0.8);text-decoration:none;font-size:14px">Inicio</a>
    <a href="/servicios" style="color:rgba(255,255,255,0.8);text-decoration:none;font-size:14px">Servicios</a>
    <a href="/clientes" style="color:rgba(255,255,255,0.8);text-decoration:none;font-size:14px">Clientes</a>
    <a href="/acceso" style="color:rgba(255,255,255,0.8);text-decoration:none;font-size:14px">Iniciar sesion</a>
    <a href="/contacto" style="background:#7c3aed;color:white;text-decoration:none;font-size:14px;font-weight:700;padding:9px 22px;border-radius:8px">Consulta gratuita</a>
  </div>
</nav>
<section style="padding:80px 24px;background:white;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:1100px;margin:0 auto">
    <div style="text-align:center;margin-bottom:60px">
      <p style="color:#7c3aed;font-size:12px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;margin:0 0 12px">Planes</p>
      <h1 style="font-size:44px;font-weight:800;color:#0f172a;margin:0;letter-spacing:-0.02em">Planes y precios</h1>
      <p style="font-size:17px;color:#64748b;margin:16px 0 0">Elige el plan que mejor se adapta a tu empresa.</p>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:24px;align-items:start">
      <div style="background:#f8fafc;border-radius:24px;padding:36px;border:1px solid #e2e8f0">
        <p style="font-size:12px;font-weight:700;color:#7c3aed;letter-spacing:0.12em;text-transform:uppercase;margin:0 0 12px">Basico</p>
        <p style="font-size:44px;font-weight:900;color:#0f172a;margin:0"><span style="font-size:20px;font-weight:700;vertical-align:top;line-height:1.8">$</span>199</p>
        <p style="font-size:14px;color:#64748b;margin:4px 0 28px">por mes</p>
        <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:32px">
          <div style="display:flex;gap:10px;align-items:center"><div style="width:18px;height:18px;background:#ede9fe;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;color:#7c3aed;flex-shrink:0">V</div><p style="margin:0;font-size:14px;color:#374151">2 consultas mensuales</p></div>
          <div style="display:flex;gap:10px;align-items:center"><div style="width:18px;height:18px;background:#ede9fe;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;color:#7c3aed;flex-shrink:0">V</div><p style="margin:0;font-size:14px;color:#374151">Reporte mensual</p></div>
          <div style="display:flex;gap:10px;align-items:center"><div style="width:18px;height:18px;background:#ede9fe;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;color:#7c3aed;flex-shrink:0">V</div><p style="margin:0;font-size:14px;color:#374151">Soporte por email</p></div>
          <div style="display:flex;gap:10px;align-items:center"><div style="width:18px;height:18px;background:#f1f5f9;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;color:#94a3b8;flex-shrink:0">-</div><p style="margin:0;font-size:14px;color:#94a3b8">Asesor dedicado</p></div>
          <div style="display:flex;gap:10px;align-items:center"><div style="width:18px;height:18px;background:#f1f5f9;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;color:#94a3b8;flex-shrink:0">-</div><p style="margin:0;font-size:14px;color:#94a3b8">Proyectos especiales</p></div>
        </div>
        <a href="/contacto" style="display:block;text-align:center;background:white;color:#7c3aed;border:2px solid #7c3aed;font-size:15px;font-weight:700;padding:13px;border-radius:12px;text-decoration:none">Empezar</a>
      </div>
      <div style="background:#4c1d95;border-radius:24px;padding:36px;position:relative;box-shadow:0 16px 48px rgba(124,58,237,0.3)">
        <div style="position:absolute;top:-12px;left:50%;transform:translateX(-50%);background:#7c3aed;color:white;font-size:11px;font-weight:800;padding:4px 18px;border-radius:999px;white-space:nowrap">MAS POPULAR</div>
        <p style="font-size:12px;font-weight:700;color:#c4b5fd;letter-spacing:0.12em;text-transform:uppercase;margin:0 0 12px">Pro</p>
        <p style="font-size:44px;font-weight:900;color:white;margin:0"><span style="font-size:20px;font-weight:700;vertical-align:top;line-height:1.8">$</span>499</p>
        <p style="font-size:14px;color:rgba(255,255,255,0.6);margin:4px 0 28px">por mes</p>
        <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:32px">
          <div style="display:flex;gap:10px;align-items:center"><div style="width:18px;height:18px;background:rgba(255,255,255,0.2);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;color:white;flex-shrink:0">V</div><p style="margin:0;font-size:14px;color:rgba(255,255,255,0.9)">8 consultas mensuales</p></div>
          <div style="display:flex;gap:10px;align-items:center"><div style="width:18px;height:18px;background:rgba(255,255,255,0.2);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;color:white;flex-shrink:0">V</div><p style="margin:0;font-size:14px;color:rgba(255,255,255,0.9)">Reporte semanal</p></div>
          <div style="display:flex;gap:10px;align-items:center"><div style="width:18px;height:18px;background:rgba(255,255,255,0.2);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;color:white;flex-shrink:0">V</div><p style="margin:0;font-size:14px;color:rgba(255,255,255,0.9)">Soporte prioritario</p></div>
          <div style="display:flex;gap:10px;align-items:center"><div style="width:18px;height:18px;background:rgba(255,255,255,0.2);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;color:white;flex-shrink:0">V</div><p style="margin:0;font-size:14px;color:rgba(255,255,255,0.9)">Asesor dedicado</p></div>
          <div style="display:flex;gap:10px;align-items:center"><div style="width:18px;height:18px;background:rgba(255,255,255,0.15);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;color:rgba(255,255,255,0.4);flex-shrink:0">-</div><p style="margin:0;font-size:14px;color:rgba(255,255,255,0.4)">Proyectos especiales</p></div>
        </div>
        <a href="/contacto" style="display:block;text-align:center;background:white;color:#4c1d95;font-size:15px;font-weight:700;padding:13px;border-radius:12px;text-decoration:none">Contratar Pro</a>
      </div>
      <div style="background:#f8fafc;border-radius:24px;padding:36px;border:1px solid #e2e8f0">
        <p style="font-size:12px;font-weight:700;color:#7c3aed;letter-spacing:0.12em;text-transform:uppercase;margin:0 0 12px">Enterprise</p>
        <p style="font-size:44px;font-weight:900;color:#0f172a;margin:0">A medida</p>
        <p style="font-size:14px;color:#64748b;margin:4px 0 28px">cotizacion personalizada</p>
        <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:32px">
          <div style="display:flex;gap:10px;align-items:center"><div style="width:18px;height:18px;background:#ede9fe;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;color:#7c3aed;flex-shrink:0">V</div><p style="margin:0;font-size:14px;color:#374151">Consultas ilimitadas</p></div>
          <div style="display:flex;gap:10px;align-items:center"><div style="width:18px;height:18px;background:#ede9fe;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;color:#7c3aed;flex-shrink:0">V</div><p style="margin:0;font-size:14px;color:#374151">Reportes en tiempo real</p></div>
          <div style="display:flex;gap:10px;align-items:center"><div style="width:18px;height:18px;background:#ede9fe;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;color:#7c3aed;flex-shrink:0">V</div><p style="margin:0;font-size:14px;color:#374151">Soporte 24/7</p></div>
          <div style="display:flex;gap:10px;align-items:center"><div style="width:18px;height:18px;background:#ede9fe;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;color:#7c3aed;flex-shrink:0">V</div><p style="margin:0;font-size:14px;color:#374151">Equipo dedicado</p></div>
          <div style="display:flex;gap:10px;align-items:center"><div style="width:18px;height:18px;background:#ede9fe;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;color:#7c3aed;flex-shrink:0">V</div><p style="margin:0;font-size:14px;color:#374151">Proyectos especiales</p></div>
        </div>
        <a href="/contacto" style="display:block;text-align:center;background:#4c1d95;color:white;font-size:15px;font-weight:700;padding:13px;border-radius:12px;text-decoration:none">Solicitar cotizacion</a>
      </div>
    </div>
  </div>
</section>
<footer style="background:#4c1d95;color:rgba(255,255,255,0.6);padding:40px;text-align:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <p style="margin:0 0 8px;font-size:18px;font-weight:800;color:white">ConsultingPro</p>
  <p style="margin:0;font-size:13px">contacto@consultingpro.com &middot; 55 0000-3333</p>
  <p style="margin:20px 0 0;font-size:12px;color:rgba(255,255,255,0.3)">&copy; 2025 ConsultingPro. Tu exito, nuestra mision.</p>
</footer>
`,
    },
    {
      id: 'clientes',
      label: 'Clientes',
      routePath: '/clientes',
      title: 'Clientes',
      required: false,
      css: '',
      html: `
<nav style="background:#4c1d95;padding:0 40px;height:64px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <a href="/" style="font-size:20px;font-weight:800;color:white;text-decoration:none;letter-spacing:-0.02em">ConsultingPro</a>
  <div style="display:flex;gap:24px;align-items:center">
    <a href="/" style="color:rgba(255,255,255,0.8);text-decoration:none;font-size:14px">Inicio</a>
    <a href="/servicios" style="color:rgba(255,255,255,0.8);text-decoration:none;font-size:14px">Servicios</a>
    <a href="/precios" style="color:rgba(255,255,255,0.8);text-decoration:none;font-size:14px">Precios</a>
    <a href="/acceso" style="color:rgba(255,255,255,0.8);text-decoration:none;font-size:14px">Iniciar sesion</a>
    <a href="/contacto" style="background:#7c3aed;color:white;text-decoration:none;font-size:14px;font-weight:700;padding:9px 22px;border-radius:8px">Consulta gratuita</a>
  </div>
</nav>
<section style="padding:80px 24px;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:1000px;margin:0 auto">
    <div style="text-align:center;margin-bottom:60px">
      <p style="color:#7c3aed;font-size:12px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;margin:0 0 12px">Testimonios</p>
      <h1 style="font-size:44px;font-weight:800;color:#0f172a;margin:0;letter-spacing:-0.02em">Lo que dicen nuestros clientes</h1>
      <p style="font-size:17px;color:#64748b;margin:16px 0 0">Empresas que confiaron en nosotros y transformaron sus resultados.</p>
    </div>
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:24px">
      <div style="background:white;border-radius:20px;padding:32px;box-shadow:0 2px 16px rgba(0,0,0,0.06)">
        <div style="display:flex;gap:4px;margin-bottom:16px">
          <span style="font-size:13px;font-weight:700;color:#7c3aed;letter-spacing:2px">5 / 5</span>
        </div>
        <p style="font-size:15px;color:#334155;line-height:1.7;margin:0 0 24px;font-style:italic">"ConsultingPro transformo la estructura financiera de nuestra empresa. En seis meses redujimos costos un 22% y aumentamos el margen operativo significativamente."</p>
        <div style="display:flex;gap:12px;align-items:center">
          <div style="width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,#7c3aed,#4c1d95);display:flex;align-items:center;justify-content:center;color:white;font-weight:700">R</div>
          <div><p style="font-weight:700;color:#0f172a;margin:0;font-size:14px">Ricardo Montoya</p><p style="color:#94a3b8;margin:0;font-size:13px">Director General, GrupoIndustrial</p></div>
        </div>
      </div>
      <div style="background:white;border-radius:20px;padding:32px;box-shadow:0 2px 16px rgba(0,0,0,0.06)">
        <div style="display:flex;gap:4px;margin-bottom:16px">
          <span style="font-size:13px;font-weight:700;color:#7c3aed;letter-spacing:2px">5 / 5</span>
        </div>
        <p style="font-size:15px;color:#334155;line-height:1.7;margin:0 0 24px;font-style:italic">"El equipo juridico nos ayudo a estructurar contratos que protegen a la empresa. Ahora operamos con mucha mas confianza en cada acuerdo comercial."</p>
        <div style="display:flex;gap:12px;align-items:center">
          <div style="width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,#6d28d9,#7c3aed);display:flex;align-items:center;justify-content:center;color:white;font-weight:700">V</div>
          <div><p style="font-weight:700;color:#0f172a;margin:0;font-size:14px">Valeria Castillo</p><p style="color:#94a3b8;margin:0;font-size:13px">CEO, Innovatech Solutions</p></div>
        </div>
      </div>
      <div style="background:white;border-radius:20px;padding:32px;box-shadow:0 2px 16px rgba(0,0,0,0.06)">
        <div style="display:flex;gap:4px;margin-bottom:16px">
          <span style="font-size:13px;font-weight:700;color:#7c3aed;letter-spacing:2px">5 / 5</span>
        </div>
        <p style="font-size:15px;color:#334155;line-height:1.7;margin:0 0 24px;font-style:italic">"La consultoria estrategica nos permitio entrar a dos nuevos mercados con una hoja de ruta clara. Los resultados superaron nuestras expectativas iniciales."</p>
        <div style="display:flex;gap:12px;align-items:center">
          <div style="width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,#7c3aed,#6d28d9);display:flex;align-items:center;justify-content:center;color:white;font-weight:700">A</div>
          <div><p style="font-weight:700;color:#0f172a;margin:0;font-size:14px">Alejandro Herrera</p><p style="color:#94a3b8;margin:0;font-size:13px">Fundador, ExpansionMX</p></div>
        </div>
      </div>
      <div style="background:white;border-radius:20px;padding:32px;box-shadow:0 2px 16px rgba(0,0,0,0.06)">
        <div style="display:flex;gap:4px;margin-bottom:16px">
          <span style="font-size:13px;font-weight:700;color:#7c3aed;letter-spacing:2px">5 / 5</span>
        </div>
        <p style="font-size:15px;color:#334155;line-height:1.7;margin:0 0 24px;font-style:italic">"El proceso de transformacion digital fue impecable. Pasamos de procesos manuales a una operacion automatizada y eficiente en menos de tres meses."</p>
        <div style="display:flex;gap:12px;align-items:center">
          <div style="width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,#4c1d95,#6d28d9);display:flex;align-items:center;justify-content:center;color:white;font-weight:700">C</div>
          <div><p style="font-weight:700;color:#0f172a;margin:0;font-size:14px">Carmen Rosales</p><p style="color:#94a3b8;margin:0;font-size:13px">COO, LogiMex</p></div>
        </div>
      </div>
    </div>
  </div>
</section>
<footer style="background:#4c1d95;color:rgba(255,255,255,0.6);padding:40px;text-align:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <p style="margin:0 0 8px;font-size:18px;font-weight:800;color:white">ConsultingPro</p>
  <p style="margin:0;font-size:13px">contacto@consultingpro.com &middot; 55 0000-3333</p>
  <p style="margin:20px 0 0;font-size:12px;color:rgba(255,255,255,0.3)">&copy; 2025 ConsultingPro. Tu exito, nuestra mision.</p>
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
<nav style="background:#4c1d95;padding:0 40px;height:64px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <a href="/" style="font-size:20px;font-weight:800;color:white;text-decoration:none;letter-spacing:-0.02em">ConsultingPro</a>
  <div style="display:flex;gap:24px;align-items:center">
    <a href="/" style="color:rgba(255,255,255,0.8);text-decoration:none;font-size:14px">Inicio</a>
    <a href="/servicios" style="color:rgba(255,255,255,0.8);text-decoration:none;font-size:14px">Servicios</a>
    <a href="/precios" style="color:rgba(255,255,255,0.8);text-decoration:none;font-size:14px">Precios</a>
    <a href="/acceso" style="color:rgba(255,255,255,0.8);text-decoration:none;font-size:14px">Iniciar sesion</a>
  </div>
</nav>
<section style="padding:80px 24px;background:white;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:900px;margin:0 auto;display:grid;grid-template-columns:1fr 1fr;gap:64px;align-items:start">
    <div>
      <h1 style="font-size:44px;font-weight:800;color:#0f172a;margin:0 0 20px;letter-spacing:-0.02em">Solicita tu consulta</h1>
      <p style="font-size:16px;color:#64748b;line-height:1.7;margin:0 0 36px">Primera consulta sin costo. Respondemos en menos de 24 horas habiles.</p>
      <div style="display:flex;flex-direction:column;gap:20px">
        <div style="display:flex;gap:14px">
          <div style="width:44px;height:44px;background:#f5f3ff;border-radius:12px;display:flex;align-items:center;justify-content:center;font-weight:800;color:#7c3aed;flex-shrink:0">@</div>
          <div><p style="margin:0;font-weight:700;color:#0f172a">Email</p><p style="margin:4px 0 0;font-size:14px;color:#64748b">contacto@consultingpro.com</p></div>
        </div>
        <div style="display:flex;gap:14px">
          <div style="width:44px;height:44px;background:#f5f3ff;border-radius:12px;display:flex;align-items:center;justify-content:center;font-weight:800;color:#7c3aed;flex-shrink:0">T</div>
          <div><p style="margin:0;font-weight:700;color:#0f172a">Telefono</p><p style="margin:4px 0 0;font-size:14px;color:#64748b">55 0000-3333</p></div>
        </div>
        <div style="display:flex;gap:14px">
          <div style="width:44px;height:44px;background:#f5f3ff;border-radius:12px;display:flex;align-items:center;justify-content:center;font-weight:800;color:#7c3aed;flex-shrink:0">H</div>
          <div><p style="margin:0;font-weight:700;color:#0f172a">Horario</p><p style="margin:4px 0 0;font-size:14px;color:#64748b">Lunes a Viernes, 9:00 - 18:00</p></div>
        </div>
      </div>
    </div>
    <div style="background:#f8fafc;border-radius:20px;padding:32px">
      <div style="display:grid;gap:14px">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
          <input placeholder="Nombre" style="border:2px solid #e2e8f0;border-radius:10px;padding:12px 16px;font-size:15px;outline:none;width:100%;box-sizing:border-box">
          <input placeholder="Empresa" style="border:2px solid #e2e8f0;border-radius:10px;padding:12px 16px;font-size:15px;outline:none;width:100%;box-sizing:border-box">
        </div>
        <input type="email" placeholder="Email corporativo" style="border:2px solid #e2e8f0;border-radius:10px;padding:12px 16px;font-size:15px;outline:none;width:100%;box-sizing:border-box">
        <input type="tel" placeholder="Telefono" style="border:2px solid #e2e8f0;border-radius:10px;padding:12px 16px;font-size:15px;outline:none;width:100%;box-sizing:border-box">
        <select style="border:2px solid #e2e8f0;border-radius:10px;padding:12px 16px;font-size:15px;outline:none;width:100%;box-sizing:border-box;color:#374151">
          <option value="">Area de interes</option>
          <option>Consultoria estrategica</option>
          <option>Asesoria financiera</option>
          <option>Asesoria legal</option>
          <option>Recursos humanos</option>
          <option>Transformacion digital</option>
          <option>Auditoria</option>
        </select>
        <textarea placeholder="Describe brevemente tu necesidad..." rows="4" style="border:2px solid #e2e8f0;border-radius:10px;padding:12px 16px;font-size:15px;outline:none;width:100%;box-sizing:border-box;resize:vertical"></textarea>
        <button type="submit" style="background:#4c1d95;color:white;border:none;border-radius:10px;padding:13px;font-size:15px;font-weight:700;cursor:pointer">Solicitar consulta gratuita</button>
      </div>
    </div>
  </div>
</section>
<footer style="background:#4c1d95;color:rgba(255,255,255,0.6);padding:40px;text-align:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <p style="margin:0 0 8px;font-size:18px;font-weight:800;color:white">ConsultingPro</p>
  <p style="margin:0;font-size:13px">contacto@consultingpro.com &middot; 55 0000-3333</p>
  <p style="margin:20px 0 0;font-size:12px;color:rgba(255,255,255,0.3)">&copy; 2025 ConsultingPro. Tu exito, nuestra mision.</p>
</footer>
`,
    },
  ],
}
