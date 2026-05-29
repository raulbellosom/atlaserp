const FS = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"

export const footerBlocks = [
  {
    id: 'footer-simple',
    label: 'Footer simple',
    category: 'Pie de pagina',
    content: `<footer style="background:#0f172a;padding:64px 40px 32px;${FS}">
  <div style="max-width:1100px;margin:0 auto">
    <div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:48px;margin-bottom:48px">
      <!-- Brand column -->
      <div>
        <a href="/" style="font-size:20px;font-weight:800;color:white;text-decoration:none;letter-spacing:-0.025em;display:block;margin-bottom:14px">MiMarca</a>
        <p style="font-size:14px;color:#64748b;line-height:1.75;margin:0 0 20px;max-width:260px">Tu empresa de confianza para soluciones integrales. Calidad y compromiso en cada proyecto.</p>
        <div style="display:flex;gap:10px">
          <a href="#" style="width:36px;height:36px;background:#1e293b;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#94a3b8;text-decoration:none;font-size:14px">f</a>
          <a href="#" style="width:36px;height:36px;background:#1e293b;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#94a3b8;text-decoration:none;font-size:14px">in</a>
          <a href="#" style="width:36px;height:36px;background:#1e293b;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#94a3b8;text-decoration:none;font-size:14px">tw</a>
          <a href="#" style="width:36px;height:36px;background:#1e293b;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#94a3b8;text-decoration:none;font-size:14px">ig</a>
        </div>
      </div>
      <!-- Links columns -->
      <div>
        <h4 style="font-size:13px;font-weight:700;color:white;margin:0 0 16px;letter-spacing:0.08em;text-transform:uppercase">Empresa</h4>
        <ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:10px">
          <li><a href="#" style="color:#64748b;text-decoration:none;font-size:14px;transition:color 0.15s">Sobre nosotros</a></li>
          <li><a href="#" style="color:#64748b;text-decoration:none;font-size:14px">Equipo</a></li>
          <li><a href="#" style="color:#64748b;text-decoration:none;font-size:14px">Blog</a></li>
          <li><a href="#" style="color:#64748b;text-decoration:none;font-size:14px">Empleo</a></li>
        </ul>
      </div>
      <div>
        <h4 style="font-size:13px;font-weight:700;color:white;margin:0 0 16px;letter-spacing:0.08em;text-transform:uppercase">Servicios</h4>
        <ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:10px">
          <li><a href="#" style="color:#64748b;text-decoration:none;font-size:14px">Servicio uno</a></li>
          <li><a href="#" style="color:#64748b;text-decoration:none;font-size:14px">Servicio dos</a></li>
          <li><a href="#" style="color:#64748b;text-decoration:none;font-size:14px">Servicio tres</a></li>
          <li><a href="#" style="color:#64748b;text-decoration:none;font-size:14px">Ver todo</a></li>
        </ul>
      </div>
      <div>
        <h4 style="font-size:13px;font-weight:700;color:white;margin:0 0 16px;letter-spacing:0.08em;text-transform:uppercase">Contacto</h4>
        <ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:10px">
          <li style="color:#64748b;font-size:14px">Calle Principal 123</li>
          <li><a href="tel:+15550000000" style="color:#64748b;text-decoration:none;font-size:14px">+1 (555) 000-0000</a></li>
          <li><a href="mailto:hola@mimarca.com" style="color:#64748b;text-decoration:none;font-size:14px">hola@mimarca.com</a></li>
          <li style="color:#64748b;font-size:14px">Lun-Vie: 9am - 6pm</li>
        </ul>
      </div>
    </div>
    <div style="border-top:1px solid #1e293b;padding-top:24px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
      <p style="font-size:13px;color:#334155;margin:0">&#169; 2025 MiMarca. Todos los derechos reservados.</p>
      <div style="display:flex;gap:20px">
        <a href="#" style="font-size:13px;color:#334155;text-decoration:none">Privacidad</a>
        <a href="#" style="font-size:13px;color:#334155;text-decoration:none">Terminos</a>
        <a href="#" style="font-size:13px;color:#334155;text-decoration:none">Cookies</a>
      </div>
    </div>
  </div>
</footer>`,
  },
  {
    id: 'footer-light',
    label: 'Footer claro',
    category: 'Pie de pagina',
    content: `<footer style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:64px 40px 32px;${FS}">
  <div style="max-width:1100px;margin:0 auto">
    <div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:48px;margin-bottom:48px">
      <div>
        <a href="/" style="font-size:20px;font-weight:800;color:#0f172a;text-decoration:none;letter-spacing:-0.025em;display:block;margin-bottom:14px">MiMarca</a>
        <p style="font-size:14px;color:#64748b;line-height:1.75;margin:0 0 20px;max-width:260px">Descripcion breve de tu empresa y la propuesta de valor que la hace unica.</p>
        <div style="display:flex;gap:10px">
          <a href="#" style="width:36px;height:36px;background:white;border:1px solid #e2e8f0;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#64748b;text-decoration:none;font-size:13px;font-weight:600">f</a>
          <a href="#" style="width:36px;height:36px;background:white;border:1px solid #e2e8f0;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#64748b;text-decoration:none;font-size:13px;font-weight:600">in</a>
          <a href="#" style="width:36px;height:36px;background:white;border:1px solid #e2e8f0;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#64748b;text-decoration:none;font-size:13px;font-weight:600">tw</a>
          <a href="#" style="width:36px;height:36px;background:white;border:1px solid #e2e8f0;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#64748b;text-decoration:none;font-size:13px;font-weight:600">ig</a>
        </div>
      </div>
      <div>
        <h4 style="font-size:13px;font-weight:700;color:#0f172a;margin:0 0 16px;letter-spacing:0.06em;text-transform:uppercase">Empresa</h4>
        <ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:10px">
          <li><a href="#" style="color:#64748b;text-decoration:none;font-size:14px">Sobre nosotros</a></li>
          <li><a href="#" style="color:#64748b;text-decoration:none;font-size:14px">Equipo</a></li>
          <li><a href="#" style="color:#64748b;text-decoration:none;font-size:14px">Blog</a></li>
          <li><a href="#" style="color:#64748b;text-decoration:none;font-size:14px">Carreras</a></li>
        </ul>
      </div>
      <div>
        <h4 style="font-size:13px;font-weight:700;color:#0f172a;margin:0 0 16px;letter-spacing:0.06em;text-transform:uppercase">Servicios</h4>
        <ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:10px">
          <li><a href="#" style="color:#64748b;text-decoration:none;font-size:14px">Servicio principal</a></li>
          <li><a href="#" style="color:#64748b;text-decoration:none;font-size:14px">Servicio dos</a></li>
          <li><a href="#" style="color:#64748b;text-decoration:none;font-size:14px">Servicio tres</a></li>
          <li><a href="#" style="color:#64748b;text-decoration:none;font-size:14px">Precios</a></li>
        </ul>
      </div>
      <div>
        <h4 style="font-size:13px;font-weight:700;color:#0f172a;margin:0 0 16px;letter-spacing:0.06em;text-transform:uppercase">Soporte</h4>
        <ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:10px">
          <li><a href="#" style="color:#64748b;text-decoration:none;font-size:14px">Contacto</a></li>
          <li><a href="#" style="color:#64748b;text-decoration:none;font-size:14px">Preguntas frecuentes</a></li>
          <li><a href="#" style="color:#64748b;text-decoration:none;font-size:14px">Documentacion</a></li>
          <li><a href="#" style="color:#64748b;text-decoration:none;font-size:14px">Estado del sistema</a></li>
        </ul>
      </div>
    </div>
    <div style="border-top:1px solid #e2e8f0;padding-top:24px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
      <p style="font-size:13px;color:#94a3b8;margin:0">&#169; 2025 MiMarca. Todos los derechos reservados.</p>
      <div style="display:flex;gap:20px">
        <a href="#" style="font-size:13px;color:#94a3b8;text-decoration:none">Privacidad</a>
        <a href="#" style="font-size:13px;color:#94a3b8;text-decoration:none">Terminos</a>
        <a href="#" style="font-size:13px;color:#94a3b8;text-decoration:none">Cookies</a>
      </div>
    </div>
  </div>
</footer>`,
  },
  {
    id: 'footer-minimal',
    label: 'Footer minimalista',
    category: 'Pie de pagina',
    content: `<footer style="background:white;border-top:2px solid #f1f5f9;padding:40px 24px;${FS}">
  <div style="max-width:1000px;margin:0 auto;text-align:center">
    <a href="/" style="font-size:22px;font-weight:900;color:#0f172a;text-decoration:none;letter-spacing:-0.03em;display:inline-block;margin-bottom:20px">MARCA</a>
    <div style="display:flex;gap:28px;justify-content:center;flex-wrap:wrap;margin-bottom:24px">
      <a href="#" style="color:#64748b;text-decoration:none;font-size:14px">Inicio</a>
      <a href="#" style="color:#64748b;text-decoration:none;font-size:14px">Servicios</a>
      <a href="#" style="color:#64748b;text-decoration:none;font-size:14px">Nosotros</a>
      <a href="#" style="color:#64748b;text-decoration:none;font-size:14px">Blog</a>
      <a href="#" style="color:#64748b;text-decoration:none;font-size:14px">Contacto</a>
      <a href="#" style="color:#64748b;text-decoration:none;font-size:14px">Privacidad</a>
    </div>
    <p style="font-size:13px;color:#94a3b8;margin:0">&#169; 2025 MiMarca &middot; Hecho con dedicacion</p>
  </div>
</footer>`,
  },
  {
    id: 'footer-cta',
    label: 'Footer con CTA',
    category: 'Pie de pagina',
    content: `<footer style="background:#0f172a;${FS}">
  <!-- CTA superior -->
  <div style="padding:80px 40px;text-align:center;border-bottom:1px solid #1e293b">
    <div style="max-width:600px;margin:0 auto">
      <h2 style="font-size:clamp(26px,4vw,44px);font-weight:800;color:white;margin:0 0 14px;letter-spacing:-0.025em">Listo para empezar?</h2>
      <p style="font-size:16px;color:#64748b;line-height:1.7;margin:0 0 36px">Unete a cientos de empresas que ya confian en nosotros para crecer.</p>
      <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
        <a href="#" style="background:#6366f1;color:white;font-size:15px;font-weight:700;padding:14px 36px;border-radius:10px;text-decoration:none">Comenzar ahora</a>
        <a href="#" style="background:#1e293b;color:white;font-size:15px;font-weight:600;padding:14px 36px;border-radius:10px;text-decoration:none;border:1px solid #334155">Hablar con ventas</a>
      </div>
    </div>
  </div>
  <!-- Nav inferior -->
  <div style="padding:40px 40px 32px;max-width:1100px;margin:0 auto">
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:20px;margin-bottom:32px">
      <a href="/" style="font-size:18px;font-weight:800;color:white;text-decoration:none">MiMarca</a>
      <div style="display:flex;gap:24px;flex-wrap:wrap">
        <a href="#" style="font-size:14px;color:#64748b;text-decoration:none">Privacidad</a>
        <a href="#" style="font-size:14px;color:#64748b;text-decoration:none">Terminos</a>
        <a href="#" style="font-size:14px;color:#64748b;text-decoration:none">Cookies</a>
        <a href="#" style="font-size:14px;color:#64748b;text-decoration:none">Soporte</a>
      </div>
    </div>
    <p style="font-size:13px;color:#334155;margin:0">&#169; 2025 MiMarca. Todos los derechos reservados.</p>
  </div>
</footer>`,
  },
  {
    id: 'sidebar-layout',
    label: 'Contenido + Sidebar',
    category: 'Pie de pagina',
    content: `<div style="padding:72px 24px;background:white;${FS}">
  <div style="max-width:1100px;margin:0 auto;display:grid;grid-template-columns:1fr 320px;gap:48px;align-items:start">
    <!-- Main content -->
    <div>
      <h1 style="font-size:clamp(26px,4vw,44px);font-weight:800;color:#0f172a;margin:0 0 20px;letter-spacing:-0.025em">Titulo del articulo o pagina principal</h1>
      <p style="font-size:16px;color:#64748b;line-height:1.85;margin:0 0 18px">Aqui va el contenido principal de la pagina. Puede ser un articulo de blog, una descripcion detallada de un servicio, o cualquier texto largo que necesite estar acompanado de una barra lateral con informacion relevante adicional.</p>
      <p style="font-size:16px;color:#64748b;line-height:1.85;margin:0 0 18px">Puedes agregar mas parrafos, imagenes, listas y otros elementos de contenido en esta columna principal. El diseno se adaptara automaticamente al espacio disponible.</p>
      <p style="font-size:16px;color:#64748b;line-height:1.85;margin:0">Sigue agregando tu contenido aqui. La sidebar permanecera visible a la derecha mientras el usuario lee el articulo.</p>
    </div>
    <!-- Sidebar -->
    <div style="display:flex;flex-direction:column;gap:20px">
      <!-- Widget 1: Categories -->
      <div style="background:#f8fafc;border-radius:16px;padding:24px">
        <h3 style="font-size:15px;font-weight:700;color:#0f172a;margin:0 0 16px;letter-spacing:0.04em;text-transform:uppercase">Categorias</h3>
        <ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:10px">
          <li style="display:flex;justify-content:space-between;align-items:center">
            <a href="#" style="color:#64748b;text-decoration:none;font-size:14px">Novedades</a>
            <span style="background:#e2e8f0;color:#64748b;font-size:12px;font-weight:600;padding:2px 8px;border-radius:999px">12</span>
          </li>
          <li style="display:flex;justify-content:space-between;align-items:center">
            <a href="#" style="color:#64748b;text-decoration:none;font-size:14px">Guias</a>
            <span style="background:#e2e8f0;color:#64748b;font-size:12px;font-weight:600;padding:2px 8px;border-radius:999px">8</span>
          </li>
          <li style="display:flex;justify-content:space-between;align-items:center">
            <a href="#" style="color:#64748b;text-decoration:none;font-size:14px">Tutoriales</a>
            <span style="background:#e2e8f0;color:#64748b;font-size:12px;font-weight:600;padding:2px 8px;border-radius:999px">5</span>
          </li>
          <li style="display:flex;justify-content:space-between;align-items:center">
            <a href="#" style="color:#64748b;text-decoration:none;font-size:14px">Recursos</a>
            <span style="background:#e2e8f0;color:#64748b;font-size:12px;font-weight:600;padding:2px 8px;border-radius:999px">9</span>
          </li>
        </ul>
      </div>
      <!-- Widget 2: CTA -->
      <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);border-radius:16px;padding:24px;text-align:center">
        <h3 style="font-size:16px;font-weight:700;color:white;margin:0 0 10px">Recibe nuestro newsletter</h3>
        <p style="font-size:13px;color:rgba(255,255,255,0.8);margin:0 0 16px;line-height:1.6">Novedades y recursos directamente en tu correo.</p>
        <input type="email" placeholder="tu@correo.com" style="width:100%;box-sizing:border-box;border:none;background:rgba(255,255,255,0.15);color:white;border-radius:8px;padding:10px 14px;font-size:13px;outline:none;margin-bottom:10px">
        <button style="width:100%;background:white;color:#4f46e5;font-size:13px;font-weight:700;padding:10px;border:none;border-radius:8px;cursor:pointer">Suscribirse</button>
      </div>
      <!-- Widget 3: Recent posts -->
      <div style="background:#f8fafc;border-radius:16px;padding:24px">
        <h3 style="font-size:15px;font-weight:700;color:#0f172a;margin:0 0 16px;letter-spacing:0.04em;text-transform:uppercase">Recientes</h3>
        <div style="display:flex;flex-direction:column;gap:14px">
          <a href="#" style="display:flex;gap:12px;align-items:center;text-decoration:none">
            <div style="width:56px;height:56px;min-width:56px;background:#e2e8f0;border-radius:10px"></div>
            <div><p style="font-weight:600;color:#0f172a;font-size:13px;margin:0 0 3px;line-height:1.4">Titulo del articulo reciente</p><p style="color:#94a3b8;font-size:12px;margin:0">12 May 2025</p></div>
          </a>
          <a href="#" style="display:flex;gap:12px;align-items:center;text-decoration:none">
            <div style="width:56px;height:56px;min-width:56px;background:#e2e8f0;border-radius:10px"></div>
            <div><p style="font-weight:600;color:#0f172a;font-size:13px;margin:0 0 3px;line-height:1.4">Otro articulo del blog</p><p style="color:#94a3b8;font-size:12px;margin:0">5 May 2025</p></div>
          </a>
        </div>
      </div>
    </div>
  </div>
</div>`,
  },
]
