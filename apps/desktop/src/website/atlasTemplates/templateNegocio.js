const FS = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"

export const templateNegocio = {
  id: 'negocio',
  label: 'Negocio General',
  description: 'Plantilla versatil para cualquier tipo de negocio local o empresa.',
  color: '#374151',
  html: `
<!-- NAV -->
<nav style="background:white;border-bottom:2px solid #f1f5f9;padding:0 40px;height:64px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100;${FS}">
  <span style="font-size:20px;font-weight:800;color:#0f172a;letter-spacing:-0.02em">MiNegocio</span>
  <div style="display:flex;gap:24px;align-items:center">
    <a href="#servicios" style="color:#374151;text-decoration:none;font-size:14px;font-weight:500">Servicios</a>
    <a href="#nosotros" style="color:#374151;text-decoration:none;font-size:14px;font-weight:500">Nosotros</a>
    <a href="#contacto" style="color:#374151;text-decoration:none;font-size:14px;font-weight:500">Contacto</a>
    <a href="#contacto" style="background:#0f172a;color:white;text-decoration:none;font-size:14px;font-weight:600;padding:9px 22px;border-radius:8px">Cotizar</a>
  </div>
</nav>

<!-- HERO -->
<section style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);padding:100px 24px;${FS}">
  <div style="max-width:1100px;margin:0 auto;display:grid;grid-template-columns:1fr 1fr;gap:72px;align-items:center">
    <div>
      <span style="display:inline-block;background:rgba(99,102,241,0.15);color:#818cf8;font-size:12px;font-weight:700;padding:5px 16px;border-radius:999px;margin-bottom:24px;letter-spacing:0.1em;text-transform:uppercase">Bienvenidos</span>
      <h1 style="font-size:clamp(34px,5vw,60px);font-weight:900;color:white;line-height:1.1;margin:0 0 22px;letter-spacing:-0.03em">Soluciones que hacen crecer tu negocio</h1>
      <p style="font-size:17px;color:#94a3b8;line-height:1.8;margin:0 0 36px">Ofrecemos servicios de calidad con un equipo comprometido con tus resultados y el exito de tu empresa.</p>
      <div style="display:flex;gap:14px;flex-wrap:wrap">
        <a href="#contacto" style="background:#6366f1;color:white;font-size:15px;font-weight:700;padding:14px 36px;border-radius:10px;text-decoration:none">Solicitar cotizacion</a>
        <a href="#servicios" style="background:rgba(255,255,255,0.08);color:white;font-size:15px;font-weight:600;padding:14px 36px;border-radius:10px;text-decoration:none;border:1px solid rgba(255,255,255,0.15)">Ver servicios</a>
      </div>
    </div>
    <div>
      <img src="https://placehold.co/600x480/1e293b/475569?text=Tu+imagen" style="width:100%;border-radius:20px;display:block">
    </div>
  </div>
</section>

<!-- SERVICIOS -->
<section id="servicios" style="padding:100px 24px;background:#f8fafc;${FS}">
  <div style="max-width:1100px;margin:0 auto">
    <div style="text-align:center;margin-bottom:64px">
      <span style="color:#6366f1;font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase">Servicios</span>
      <h2 style="font-size:clamp(26px,4vw,44px);font-weight:800;color:#0f172a;margin:14px 0 16px;letter-spacing:-0.025em">Lo que ofrecemos</h2>
      <p style="font-size:17px;color:#64748b;max-width:480px;margin:0 auto;line-height:1.7">Un portafolio completo de servicios disenados para satisfacer las necesidades de tu negocio.</p>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:24px">
      <div style="background:white;border-radius:20px;padding:36px;box-shadow:0 2px 12px rgba(0,0,0,0.05)">
        <div style="width:56px;height:56px;background:linear-gradient(135deg,#6366f1,#4f46e5);border-radius:16px;margin-bottom:22px;display:flex;align-items:center;justify-content:center;font-size:24px">&#127775;</div>
        <h3 style="font-size:19px;font-weight:700;color:#0f172a;margin:0 0 12px">Servicio principal</h3>
        <p style="font-size:15px;color:#64748b;line-height:1.7;margin:0 0 20px">Descripcion completa del servicio estrella de tu empresa y los beneficios que aporta.</p>
        <a href="#" style="color:#6366f1;font-size:14px;font-weight:600;text-decoration:none">Saber mas &rarr;</a>
      </div>
      <div style="background:white;border-radius:20px;padding:36px;box-shadow:0 2px 12px rgba(0,0,0,0.05)">
        <div style="width:56px;height:56px;background:linear-gradient(135deg,#06b6d4,#0284c7);border-radius:16px;margin-bottom:22px;display:flex;align-items:center;justify-content:center;font-size:24px">&#128161;</div>
        <h3 style="font-size:19px;font-weight:700;color:#0f172a;margin:0 0 12px">Servicio secundario</h3>
        <p style="font-size:15px;color:#64748b;line-height:1.7;margin:0 0 20px">El segundo servicio mas importante. Describe su valor y como complementa al anterior.</p>
        <a href="#" style="color:#0284c7;font-size:14px;font-weight:600;text-decoration:none">Saber mas &rarr;</a>
      </div>
      <div style="background:white;border-radius:20px;padding:36px;box-shadow:0 2px 12px rgba(0,0,0,0.05)">
        <div style="width:56px;height:56px;background:linear-gradient(135deg,#22c55e,#16a34a);border-radius:16px;margin-bottom:22px;display:flex;align-items:center;justify-content:center;font-size:24px">&#128200;</div>
        <h3 style="font-size:19px;font-weight:700;color:#0f172a;margin:0 0 12px">Servicio adicional</h3>
        <p style="font-size:15px;color:#64748b;line-height:1.7;margin:0 0 20px">Un tercer servicio que redondea tu oferta y atiende necesidades complementarias.</p>
        <a href="#" style="color:#16a34a;font-size:14px;font-weight:600;text-decoration:none">Saber mas &rarr;</a>
      </div>
    </div>
  </div>
</section>

<!-- SOBRE NOSOTROS -->
<section id="nosotros" style="padding:100px 24px;background:white;${FS}">
  <div style="max-width:1100px;margin:0 auto;display:grid;grid-template-columns:1fr 1fr;gap:80px;align-items:center">
    <div>
      <span style="color:#6366f1;font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;display:block;margin-bottom:16px">Quienes somos</span>
      <h2 style="font-size:clamp(26px,4vw,44px);font-weight:800;color:#0f172a;margin:0 0 22px;line-height:1.15;letter-spacing:-0.025em">Una empresa comprometida con tu exito</h2>
      <p style="font-size:16px;color:#64748b;line-height:1.8;margin:0 0 20px">Desde nuestros inicios, hemos trabajado con dedicacion para convertirnos en el socio de confianza que las empresas necesitan para crecer.</p>
      <p style="font-size:16px;color:#64748b;line-height:1.8;margin:0 0 36px">Nuestro equipo combina experiencia, innovacion y un genuino compromiso con los resultados de cada cliente.</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
        <div style="background:#f8fafc;border-radius:14px;padding:20px"><p style="font-size:30px;font-weight:900;color:#4f46e5;margin:0">+500</p><p style="font-size:13px;color:#64748b;margin:6px 0 0">Clientes satisfechos</p></div>
        <div style="background:#f8fafc;border-radius:14px;padding:20px"><p style="font-size:30px;font-weight:900;color:#4f46e5;margin:0">+10</p><p style="font-size:13px;color:#64748b;margin:6px 0 0">Anos de experiencia</p></div>
      </div>
    </div>
    <div>
      <img src="https://placehold.co/600x500/f1f5f9/94a3b8?text=Nuestro+equipo" style="width:100%;border-radius:24px;display:block">
    </div>
  </div>
</section>

<!-- TESTIMONIOS -->
<section style="padding:80px 24px;background:#f8fafc;${FS}">
  <div style="max-width:1000px;margin:0 auto">
    <div style="text-align:center;margin-bottom:52px">
      <h2 style="font-size:clamp(24px,4vw,40px);font-weight:800;color:#0f172a;margin:0;letter-spacing:-0.025em">Clientes que nos recomiendan</h2>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px">
      <div style="background:white;border-radius:20px;padding:28px;box-shadow:0 2px 12px rgba(0,0,0,0.04)">
        <div style="color:#f59e0b;font-size:16px;margin-bottom:14px">&#9733;&#9733;&#9733;&#9733;&#9733;</div>
        <p style="font-size:15px;color:#334155;line-height:1.7;margin:0 0 20px;font-style:italic">"Excelente servicio desde el primer dia. El equipo es profesional, rapido y siempre disponible para ayudarnos."</p>
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#4f46e5);display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:15px">R</div>
          <div><p style="font-weight:700;color:#0f172a;margin:0;font-size:14px">Roberto Silva</p><p style="color:#94a3b8;margin:0;font-size:13px">Gerente, EmpresaXYZ</p></div>
        </div>
      </div>
      <div style="background:white;border-radius:20px;padding:28px;box-shadow:0 2px 12px rgba(0,0,0,0.04)">
        <div style="color:#f59e0b;font-size:16px;margin-bottom:14px">&#9733;&#9733;&#9733;&#9733;&#9733;</div>
        <p style="font-size:15px;color:#334155;line-height:1.7;margin:0 0 20px;font-style:italic">"Increibles resultados en poco tiempo. Sin duda la mejor decision que tomamos para nuestra empresa este ano."</p>
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#22c55e,#16a34a);display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:15px">L</div>
          <div><p style="font-weight:700;color:#0f172a;margin:0;font-size:14px">Lucia Fernandez</p><p style="color:#94a3b8;margin:0;font-size:13px">CEO, StartupABC</p></div>
        </div>
      </div>
      <div style="background:white;border-radius:20px;padding:28px;box-shadow:0 2px 12px rgba(0,0,0,0.04)">
        <div style="color:#f59e0b;font-size:16px;margin-bottom:14px">&#9733;&#9733;&#9733;&#9733;&#9733;</div>
        <p style="font-size:15px;color:#334155;line-height:1.7;margin:0 0 20px;font-style:italic">"Lo que mas valoro es la transparencia y la comunicacion constante. Siempre supe como iba mi proyecto."</p>
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#f59e0b,#d97706);display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:15px">M</div>
          <div><p style="font-weight:700;color:#0f172a;margin:0;font-size:14px">Miguel Ortega</p><p style="color:#94a3b8;margin:0;font-size:13px">Director, NegociosPro</p></div>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- CONTACTO -->
<section id="contacto" style="padding:100px 24px;background:white;${FS}">
  <div style="max-width:1100px;margin:0 auto;display:grid;grid-template-columns:1fr 1.4fr;gap:72px;align-items:start">
    <div>
      <span style="color:#6366f1;font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;display:block;margin-bottom:16px">Contacto</span>
      <h2 style="font-size:clamp(24px,3.5vw,40px);font-weight:800;color:#0f172a;margin:0 0 18px;line-height:1.2;letter-spacing:-0.025em">Hablemos sobre tu proyecto</h2>
      <p style="font-size:16px;color:#64748b;line-height:1.8;margin:0 0 40px">Estamos listos para ayudarte. Contactanos y recibe una respuesta en menos de 24 horas.</p>
      <div style="display:flex;flex-direction:column;gap:20px">
        <div style="display:flex;gap:14px;align-items:center">
          <div style="width:44px;height:44px;min-width:44px;background:#ede9fe;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:20px">&#128222;</div>
          <div><p style="font-size:13px;color:#94a3b8;margin:0 0 2px">Telefono</p><p style="font-weight:600;color:#0f172a;font-size:15px;margin:0">+1 (555) 000-0000</p></div>
        </div>
        <div style="display:flex;gap:14px;align-items:center">
          <div style="width:44px;height:44px;min-width:44px;background:#dcfce7;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:20px">&#128231;</div>
          <div><p style="font-size:13px;color:#94a3b8;margin:0 0 2px">Correo</p><p style="font-weight:600;color:#0f172a;font-size:15px;margin:0">hola@minegocio.com</p></div>
        </div>
        <div style="display:flex;gap:14px;align-items:center">
          <div style="width:44px;height:44px;min-width:44px;background:#fef3c7;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:20px">&#128205;</div>
          <div><p style="font-size:13px;color:#94a3b8;margin:0 0 2px">Direccion</p><p style="font-weight:600;color:#0f172a;font-size:15px;margin:0">Calle Principal 123, Ciudad</p></div>
        </div>
      </div>
    </div>
    <div style="background:#f8fafc;border-radius:24px;padding:40px">
      <form style="display:flex;flex-direction:column;gap:16px">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
          <input type="text" placeholder="Tu nombre" style="border:2px solid #e2e8f0;background:white;border-radius:10px;padding:13px 16px;font-size:15px;outline:none">
          <input type="email" placeholder="tu@correo.com" style="border:2px solid #e2e8f0;background:white;border-radius:10px;padding:13px 16px;font-size:15px;outline:none">
        </div>
        <input type="tel" placeholder="Telefono" style="border:2px solid #e2e8f0;background:white;border-radius:10px;padding:13px 16px;font-size:15px;outline:none">
        <select style="border:2px solid #e2e8f0;background:white;border-radius:10px;padding:13px 16px;font-size:15px;outline:none;color:#374151">
          <option value="">Como podemos ayudarte?</option>
          <option>Informacion general</option>
          <option>Solicitar cotizacion</option>
          <option>Soporte</option>
          <option>Alianzas</option>
        </select>
        <textarea placeholder="Cuéntanos más sobre tu proyecto..." rows="4" style="border:2px solid #e2e8f0;background:white;border-radius:10px;padding:13px 16px;font-size:15px;outline:none;resize:vertical;font-family:inherit"></textarea>
        <button type="submit" style="background:#0f172a;color:white;font-size:16px;font-weight:700;padding:15px;border:none;border-radius:12px;cursor:pointer">Enviar mensaje</button>
      </form>
    </div>
  </div>
</section>

<!-- FOOTER -->
<footer style="background:#0f172a;padding:40px 24px;text-align:center;${FS}">
  <p style="color:rgba(255,255,255,0.35);font-size:14px;margin:0">&#169; 2025 MiNegocio &middot; Calle Principal 123 &middot; hola@minegocio.com</p>
</footer>
`,
}
