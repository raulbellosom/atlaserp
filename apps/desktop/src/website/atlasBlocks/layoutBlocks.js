const F = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"

export const layoutBlocks = [
  {
    id: 'two-columns',
    label: 'Imagen + Texto',
    category: 'Estructura',
    content: `<div style="padding:80px 24px;background:white;${F}">
  <div style="max-width:1100px;margin:0 auto;display:grid;grid-template-columns:1fr 1fr;gap:72px;align-items:center">
    <img src="https://placehold.co/600x450/e2e8f0/94a3b8?text=Tu+imagen" alt="Imagen" style="width:100%;border-radius:24px;display:block">
    <div>
      <span style="color:#6366f1;font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;display:block;margin-bottom:14px">Nosotros</span>
      <h2 style="font-size:clamp(26px,3.5vw,42px);font-weight:800;color:#0f172a;margin:0 0 20px;line-height:1.2;letter-spacing:-0.025em">Construido para quienes quieren crecer</h2>
      <p style="font-size:16px;color:#64748b;line-height:1.8;margin:0 0 28px">Desde los inicios hasta hoy, cada decision ha estado centrada en ofrecer la mejor experiencia posible a nuestros clientes.</p>
      <a href="#" style="display:inline-block;background:#4f46e5;color:white;font-size:15px;font-weight:600;padding:13px 30px;border-radius:10px;text-decoration:none">Saber mas &rarr;</a>
    </div>
  </div>
</div>`,
  },
  {
    id: 'three-columns',
    label: '3 Columnas',
    category: 'Estructura',
    content: `<div style="padding:80px 24px;background:#f8fafc;${F}">
  <div style="max-width:1100px;margin:0 auto">
    <div style="text-align:center;margin-bottom:60px">
      <h2 style="font-size:clamp(26px,4vw,44px);font-weight:800;color:#0f172a;margin:0 0 14px;letter-spacing:-0.025em">Nuestros servicios</h2>
      <p style="font-size:17px;color:#64748b;margin:0 auto;max-width:460px;line-height:1.7">Una suite completa de soluciones para llevar tu negocio al siguiente nivel.</p>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:24px">
      <div style="background:white;border-radius:20px;padding:32px;text-align:center;box-shadow:0 1px 4px rgba(0,0,0,0.04)">
        <div style="width:52px;height:52px;background:#ede9fe;border-radius:14px;margin:0 auto 18px;display:flex;align-items:center;justify-content:center;font-size:24px">&#127919;</div>
        <h3 style="font-size:18px;font-weight:700;color:#0f172a;margin:0 0 10px">Servicio uno</h3>
        <p style="font-size:14px;color:#64748b;line-height:1.7;margin:0">Descripcion clara del primer servicio y su valor para el cliente.</p>
      </div>
      <div style="background:white;border-radius:20px;padding:32px;text-align:center;box-shadow:0 1px 4px rgba(0,0,0,0.04)">
        <div style="width:52px;height:52px;background:#d1fae5;border-radius:14px;margin:0 auto 18px;display:flex;align-items:center;justify-content:center;font-size:24px">&#128161;</div>
        <h3 style="font-size:18px;font-weight:700;color:#0f172a;margin:0 0 10px">Servicio dos</h3>
        <p style="font-size:14px;color:#64748b;line-height:1.7;margin:0">Descripcion del segundo servicio con los beneficios que aporta.</p>
      </div>
      <div style="background:white;border-radius:20px;padding:32px;text-align:center;box-shadow:0 1px 4px rgba(0,0,0,0.04)">
        <div style="width:52px;height:52px;background:#fef3c7;border-radius:14px;margin:0 auto 18px;display:flex;align-items:center;justify-content:center;font-size:24px">&#128640;</div>
        <h3 style="font-size:18px;font-weight:700;color:#0f172a;margin:0 0 10px">Servicio tres</h3>
        <p style="font-size:14px;color:#64748b;line-height:1.7;margin:0">Descripcion del tercer servicio y por que vale la pena elegirlo.</p>
      </div>
    </div>
  </div>
</div>`,
  },
  {
    id: 'four-columns',
    label: '4 Columnas',
    category: 'Estructura',
    content: `<div style="padding:72px 24px;background:white;${F}">
  <div style="max-width:1100px;margin:0 auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:24px">
    <div style="border:2px solid #e2e8f0;border-radius:18px;padding:28px 24px;text-align:center">
      <div style="font-size:36px;margin-bottom:14px">&#127775;</div>
      <h4 style="font-size:16px;font-weight:700;color:#0f172a;margin:0 0 8px">Titulo uno</h4>
      <p style="font-size:14px;color:#64748b;line-height:1.65;margin:0">Descripcion breve y concreta del beneficio.</p>
    </div>
    <div style="border:2px solid #e2e8f0;border-radius:18px;padding:28px 24px;text-align:center">
      <div style="font-size:36px;margin-bottom:14px">&#128736;</div>
      <h4 style="font-size:16px;font-weight:700;color:#0f172a;margin:0 0 8px">Titulo dos</h4>
      <p style="font-size:14px;color:#64748b;line-height:1.65;margin:0">Descripcion breve y concreta del beneficio.</p>
    </div>
    <div style="border:2px solid #e2e8f0;border-radius:18px;padding:28px 24px;text-align:center">
      <div style="font-size:36px;margin-bottom:14px">&#128200;</div>
      <h4 style="font-size:16px;font-weight:700;color:#0f172a;margin:0 0 8px">Titulo tres</h4>
      <p style="font-size:14px;color:#64748b;line-height:1.65;margin:0">Descripcion breve y concreta del beneficio.</p>
    </div>
    <div style="border:2px solid #e2e8f0;border-radius:18px;padding:28px 24px;text-align:center">
      <div style="font-size:36px;margin-bottom:14px">&#128273;</div>
      <h4 style="font-size:16px;font-weight:700;color:#0f172a;margin:0 0 8px">Titulo cuatro</h4>
      <p style="font-size:14px;color:#64748b;line-height:1.65;margin:0">Descripcion breve y concreta del beneficio.</p>
    </div>
  </div>
</div>`,
  },
  {
    id: 'columns-asymm',
    label: 'Texto + Tarjeta',
    category: 'Estructura',
    content: `<div style="padding:80px 24px;background:#f8fafc;${F}">
  <div style="max-width:1100px;margin:0 auto;display:grid;grid-template-columns:3fr 2fr;gap:64px;align-items:center">
    <div>
      <span style="color:#6366f1;font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;display:block;margin-bottom:14px">Destacado</span>
      <h2 style="font-size:clamp(28px,4vw,46px);font-weight:800;color:#0f172a;margin:0 0 20px;line-height:1.15;letter-spacing:-0.025em">Una propuesta de valor que marca la diferencia</h2>
      <p style="font-size:17px;color:#64748b;line-height:1.8;margin:0 0 28px">Explica en detalle como tu producto o servicio resuelve el problema de tu cliente. Sencillo, claro y convincente.</p>
      <a href="#" style="display:inline-block;background:#0f172a;color:white;font-size:15px;font-weight:600;padding:14px 32px;border-radius:10px;text-decoration:none">Comenzar ahora</a>
    </div>
    <div style="background:white;border-radius:24px;padding:36px;box-shadow:0 4px 24px rgba(0,0,0,0.06)">
      <div style="width:48px;height:48px;background:linear-gradient(135deg,#4f46e5,#7c3aed);border-radius:14px;margin-bottom:20px"></div>
      <h3 style="font-size:20px;font-weight:800;color:#0f172a;margin:0 0 12px">Titulo de tarjeta</h3>
      <p style="font-size:15px;color:#64748b;line-height:1.7;margin:0 0 20px">Un mensaje clave en formato de tarjeta que resalta una caracteristica especial.</p>
      <div style="display:flex;flex-direction:column;gap:10px">
        <div style="display:flex;gap:10px;align-items:center"><span style="color:#22c55e;font-weight:700;font-size:15px">&#10003;</span><span style="font-size:14px;color:#334155">Caracteristica principal</span></div>
        <div style="display:flex;gap:10px;align-items:center"><span style="color:#22c55e;font-weight:700;font-size:15px">&#10003;</span><span style="font-size:14px;color:#334155">Otro punto de valor</span></div>
        <div style="display:flex;gap:10px;align-items:center"><span style="color:#22c55e;font-weight:700;font-size:15px">&#10003;</span><span style="font-size:14px;color:#334155">Garantia de resultados</span></div>
      </div>
    </div>
  </div>
</div>`,
  },
  {
    id: 'section-gradient-indigo',
    label: 'Fondo degradado morado',
    category: 'Estructura',
    content: `<section style="background:linear-gradient(135deg,#312e81 0%,#4f46e5 50%,#7c3aed 100%);padding:100px 24px;${F}">
  <div style="max-width:800px;margin:0 auto;text-align:center">
    <h2 style="font-size:clamp(28px,4.5vw,52px);font-weight:800;color:white;margin:0 0 20px;line-height:1.15;letter-spacing:-0.025em">Seccion con fondo degradado</h2>
    <p style="font-size:18px;color:rgba(255,255,255,0.8);line-height:1.75;margin:0 0 40px;max-width:540px;margin-left:auto;margin-right:auto">Usa esta seccion para destacar mensajes importantes, llamadas a la accion o datos relevantes sobre tu negocio.</p>
    <a href="#" style="display:inline-block;background:white;color:#4f46e5;font-size:16px;font-weight:700;padding:15px 40px;border-radius:12px;text-decoration:none">Accion principal</a>
  </div>
</section>`,
  },
  {
    id: 'section-gradient-warm',
    label: 'Fondo degradado calido',
    category: 'Estructura',
    content: `<section style="background:linear-gradient(135deg,#7c2d12 0%,#dc2626 40%,#f97316 100%);padding:100px 24px;${F}">
  <div style="max-width:800px;margin:0 auto;text-align:center">
    <h2 style="font-size:clamp(28px,4.5vw,52px);font-weight:800;color:white;margin:0 0 20px;line-height:1.15;letter-spacing:-0.025em">Ofertas y promociones especiales</h2>
    <p style="font-size:18px;color:rgba(255,255,255,0.85);line-height:1.75;margin:0 0 40px;max-width:540px;margin-left:auto;margin-right:auto">No pierdas esta oportunidad. Oferta valida por tiempo limitado para nuestros nuevos clientes.</p>
    <a href="#" style="display:inline-block;background:white;color:#dc2626;font-size:16px;font-weight:700;padding:15px 40px;border-radius:12px;text-decoration:none">Aprovechar oferta</a>
  </div>
</section>`,
  },
  {
    id: 'section-dark-overlay',
    label: 'Fondo oscuro con imagen',
    category: 'Estructura',
    content: `<section style="position:relative;padding:100px 24px;overflow:hidden;${F}">
  <div style="position:absolute;inset:0;background-image:url('https://placehold.co/1920x600/1e293b/334155?text=Imagen+de+fondo');background-size:cover;background-position:center"></div>
  <div style="position:absolute;inset:0;background:rgba(0,0,0,0.72)"></div>
  <div style="position:relative;z-index:1;max-width:760px;margin:0 auto;text-align:center">
    <h2 style="font-size:clamp(28px,4.5vw,52px);font-weight:800;color:white;margin:0 0 20px;line-height:1.15;letter-spacing:-0.025em">Seccion con imagen de fondo</h2>
    <p style="font-size:18px;color:rgba(255,255,255,0.8);line-height:1.75;margin:0 0 40px">Cambia la imagen de fondo para que coincida con la imagen de tu marca o negocio.</p>
    <a href="#" style="display:inline-block;background:white;color:#0f172a;font-size:16px;font-weight:700;padding:15px 40px;border-radius:12px;text-decoration:none">Ver mas</a>
  </div>
</section>`,
  },
  {
    id: 'divider-wave',
    label: 'Separador ola',
    category: 'Estructura',
    content: `<div style="background:#f8fafc;line-height:0;overflow:hidden">
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 80" preserveAspectRatio="none" style="display:block;width:100%;height:80px">
    <path d="M0,40 C360,80 1080,0 1440,40 L1440,80 L0,80 Z" fill="white"/>
  </svg>
</div>`,
  },
  {
    id: 'divider-angled',
    label: 'Separador diagonal',
    category: 'Estructura',
    content: `<div style="background:white;line-height:0;overflow:hidden">
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 60" preserveAspectRatio="none" style="display:block;width:100%;height:60px">
    <polygon points="0,0 1440,60 1440,60 0,60" fill="#f8fafc"/>
  </svg>
</div>`,
  },
]
