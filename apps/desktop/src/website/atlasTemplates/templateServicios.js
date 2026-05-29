const FS = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"

export const templateServicios = {
  id: 'servicios',
  label: 'Servicios Profesionales',
  description: 'Para consultorias, despachos legales, contadores y profesionales.',
  color: '#1e3a5f',
  html: `
<!-- NAV -->
<nav style="background:white;border-bottom:1px solid #e2e8f0;padding:0 40px;height:68px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100;${FS}">
  <span style="font-size:20px;font-weight:800;color:#1e3a5f;letter-spacing:-0.025em">ConsultingPro</span>
  <div style="display:flex;gap:28px;align-items:center">
    <a href="#servicios" style="color:#374151;text-decoration:none;font-size:14px;font-weight:500">Servicios</a>
    <a href="#nosotros" style="color:#374151;text-decoration:none;font-size:14px;font-weight:500">Nosotros</a>
    <a href="#equipo" style="color:#374151;text-decoration:none;font-size:14px;font-weight:500">Equipo</a>
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
        <div style="width:52px;height:52px;background:#eff6ff;border-radius:14px;margin-bottom:20px;display:flex;align-items:center;justify-content:center;font-size:24px">&#128200;</div>
        <h3 style="font-size:19px;font-weight:700;color:#1e3a5f;margin:0 0 12px">Consultoria estrategica</h3>
        <p style="font-size:15px;color:#64748b;line-height:1.7;margin:0">Planificacion y ejecucion de estrategias que impulsan el crecimiento sostenible.</p>
      </div>
      <div style="background:white;border-radius:20px;padding:36px;border-top:4px solid #0891b2;box-shadow:0 2px 12px rgba(0,0,0,0.04)">
        <div style="width:52px;height:52px;background:#ecfeff;border-radius:14px;margin-bottom:20px;display:flex;align-items:center;justify-content:center;font-size:24px">&#128220;</div>
        <h3 style="font-size:19px;font-weight:700;color:#1e3a5f;margin:0 0 12px">Asesoria legal</h3>
        <p style="font-size:15px;color:#64748b;line-height:1.7;margin:0">Proteccion juridica integral para tu empresa y tus operaciones comerciales.</p>
      </div>
      <div style="background:white;border-radius:20px;padding:36px;border-top:4px solid #7c3aed;box-shadow:0 2px 12px rgba(0,0,0,0.04)">
        <div style="width:52px;height:52px;background:#f5f3ff;border-radius:14px;margin-bottom:20px;display:flex;align-items:center;justify-content:center;font-size:24px">&#128176;</div>
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
}
