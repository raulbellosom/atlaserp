const FS = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"

export const templateEducacion = {
  id: 'educacion',
  label: 'Educacion / Academia',
  category: 'educacion',
  description: 'Para academias, cursos en linea, escuelas y plataformas educativas.',
  color: '#1d4ed8',
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
<nav style="background:white;border-bottom:1px solid #dbeafe;padding:0 40px;height:68px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100;${FS}">
  <span style="font-size:20px;font-weight:800;color:#1d4ed8;letter-spacing:-0.02em">AcademiaPlus</span>
  <div style="display:flex;gap:28px;align-items:center">
    <a href="/cursos" style="color:#374151;text-decoration:none;font-size:14px;font-weight:500">Cursos</a>
    <a href="/instructores" style="color:#374151;text-decoration:none;font-size:14px;font-weight:500">Instructores</a>
    <a href="/testimonios" style="color:#374151;text-decoration:none;font-size:14px;font-weight:500">Testimonios</a>
    <a href="/contacto" style="color:#374151;text-decoration:none;font-size:14px;font-weight:500">Contacto</a>
    <a href="/acceso" style="color:#374151;text-decoration:none;font-size:14px;font-weight:500">Iniciar sesion</a>
    <a href="/contacto" style="background:#1d4ed8;color:white;text-decoration:none;font-size:14px;font-weight:600;padding:10px 24px;border-radius:8px">Inscribirse</a>
  </div>
</nav>

<!-- HERO -->
<section style="background:linear-gradient(135deg,#1e3a8a 0%,#1d4ed8 100%);padding:100px 24px 80px;text-align:center;${FS}">
  <div style="max-width:820px;margin:0 auto">
    <div style="display:inline-block;background:rgba(234,88,12,0.2);border:1px solid rgba(234,88,12,0.4);border-radius:999px;padding:6px 20px;margin-bottom:28px">
      <span style="color:#fdba74;font-size:13px;font-weight:600;letter-spacing:0.08em">Plataforma educativa certificada</span>
    </div>
    <h1 style="font-size:clamp(38px,5.5vw,72px);font-weight:900;color:white;line-height:1.05;margin:0 0 22px;letter-spacing:-0.04em">Aprende sin limites</h1>
    <p style="font-size:18px;color:rgba(255,255,255,0.8);line-height:1.75;margin:0 auto 44px;max-width:600px">Cursos en linea con instructores expertos, material actualizado y certificados reconocidos. Avanza a tu ritmo desde cualquier lugar.</p>
    <div style="display:flex;gap:16px;justify-content:center;flex-wrap:wrap;margin-bottom:72px">
      <a href="/cursos" style="background:white;color:#1d4ed8;font-size:16px;font-weight:800;padding:15px 40px;border-radius:10px;text-decoration:none">Ver cursos</a>
      <a href="/contacto" style="background:rgba(255,255,255,0.12);color:white;font-size:16px;font-weight:600;padding:15px 40px;border-radius:10px;text-decoration:none;border:2px solid rgba(255,255,255,0.3)">Inscribirse</a>
    </div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:2px;background:rgba(255,255,255,0.1);border-radius:16px;overflow:hidden;max-width:720px;margin:0 auto">
      <div style="background:rgba(255,255,255,0.08);padding:28px 16px;text-align:center">
        <div style="font-size:30px;font-weight:900;color:white;margin-bottom:4px">500+</div>
        <div style="font-size:13px;color:#bfdbfe;font-weight:500">Estudiantes</div>
      </div>
      <div style="background:rgba(255,255,255,0.08);padding:28px 16px;text-align:center">
        <div style="font-size:30px;font-weight:900;color:white;margin-bottom:4px">20</div>
        <div style="font-size:13px;color:#bfdbfe;font-weight:500">Cursos</div>
      </div>
      <div style="background:rgba(255,255,255,0.08);padding:28px 16px;text-align:center">
        <div style="font-size:30px;font-weight:900;color:white;margin-bottom:4px">10</div>
        <div style="font-size:13px;color:#bfdbfe;font-weight:500">Instructores</div>
      </div>
      <div style="background:rgba(255,255,255,0.08);padding:28px 16px;text-align:center">
        <div style="font-size:30px;font-weight:900;color:white;margin-bottom:4px">95%</div>
        <div style="font-size:13px;color:#bfdbfe;font-weight:500">Satisfaccion</div>
      </div>
    </div>
  </div>
</section>

<!-- CURSOS DESTACADOS -->
<section style="padding:80px 24px;background:white;${FS}">
  <div style="max-width:1100px;margin:0 auto">
    <div style="text-align:center;margin-bottom:52px">
      <span style="color:#1d4ed8;font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase">Formacion de calidad</span>
      <h2 style="font-size:clamp(26px,3.5vw,40px);font-weight:800;color:#1e3a8a;margin:12px 0 0;letter-spacing:-0.025em">Cursos mas populares</h2>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:28px">

      <div style="background:white;border:1px solid #dbeafe;border-radius:20px;overflow:hidden">
        <img src="https://placehold.co/600x280/1d4ed8/eff6ff?text=Desarrollo+Web" alt="Desarrollo Web" style="width:100%;display:block">
        <div style="padding:24px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
            <span style="background:#eff6ff;color:#1d4ed8;font-size:11px;font-weight:700;padding:3px 10px;border-radius:999px">BASICO</span>
            <span style="font-size:16px;font-weight:800;color:#ea580c">$1,200 MXN</span>
          </div>
          <h3 style="font-size:17px;font-weight:700;color:#1e3a8a;margin:0 0 6px">Desarrollo web desde cero</h3>
          <p style="font-size:13px;color:#64748b;margin:0 0 14px">HTML, CSS y JavaScript para principiantes. 40 horas de contenido.</p>
          <a href="/cursos" style="display:block;text-align:center;background:#1d4ed8;color:white;padding:10px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600">Ver curso</a>
        </div>
      </div>

      <div style="background:white;border:1px solid #dbeafe;border-radius:20px;overflow:hidden">
        <img src="https://placehold.co/600x280/1e3a8a/eff6ff?text=Diseno+UX" alt="Diseno UX" style="width:100%;display:block">
        <div style="padding:24px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
            <span style="background:#fff7ed;color:#ea580c;font-size:11px;font-weight:700;padding:3px 10px;border-radius:999px">INTERMEDIO</span>
            <span style="font-size:16px;font-weight:800;color:#ea580c">$2,400 MXN</span>
          </div>
          <h3 style="font-size:17px;font-weight:700;color:#1e3a8a;margin:0 0 6px">Diseno UX/UI profesional</h3>
          <p style="font-size:13px;color:#64748b;margin:0 0 14px">Figma, prototipado y principios de experiencia de usuario. 60 horas.</p>
          <a href="/cursos" style="display:block;text-align:center;background:#1d4ed8;color:white;padding:10px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600">Ver curso</a>
        </div>
      </div>

      <div style="background:white;border:1px solid #dbeafe;border-radius:20px;overflow:hidden">
        <img src="https://placehold.co/600x280/ea580c/fff7ed?text=Marketing+Digital" alt="Marketing Digital" style="width:100%;display:block">
        <div style="padding:24px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
            <span style="background:#eff6ff;color:#1d4ed8;font-size:11px;font-weight:700;padding:3px 10px;border-radius:999px">AVANZADO</span>
            <span style="font-size:16px;font-weight:800;color:#ea580c">$3,800 MXN</span>
          </div>
          <h3 style="font-size:17px;font-weight:700;color:#1e3a8a;margin:0 0 6px">Marketing digital avanzado</h3>
          <p style="font-size:13px;color:#64748b;margin:0 0 14px">SEO, SEM, redes sociales y analisis de datos. 80 horas certificadas.</p>
          <a href="/cursos" style="display:block;text-align:center;background:#1d4ed8;color:white;padding:10px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600">Ver curso</a>
        </div>
      </div>

    </div>
  </div>
</section>

<!-- FOOTER -->
<footer style="background:#1e3a8a;color:rgba(255,255,255,0.65);padding:48px 40px;${FS}">
  <div style="max-width:1100px;margin:0 auto;display:grid;grid-template-columns:2fr 1fr 1fr;gap:48px">
    <div>
      <span style="font-size:18px;font-weight:800;color:white;display:block;margin-bottom:14px">AcademiaPlus</span>
      <p style="font-size:14px;line-height:1.75;margin:0;max-width:300px">Plataforma educativa en linea con cursos certificados en tecnologia, diseno, negocios y mas.</p>
    </div>
    <div>
      <h4 style="color:white;font-size:13px;font-weight:700;margin:0 0 16px;text-transform:uppercase;letter-spacing:0.08em">Paginas</h4>
      <ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:10px">
        <li><a href="/cursos" style="color:rgba(255,255,255,0.65);text-decoration:none;font-size:14px">Cursos</a></li>
        <li><a href="/instructores" style="color:rgba(255,255,255,0.65);text-decoration:none;font-size:14px">Instructores</a></li>
        <li><a href="/testimonios" style="color:rgba(255,255,255,0.65);text-decoration:none;font-size:14px">Testimonios</a></li>
        <li><a href="/contacto" style="color:rgba(255,255,255,0.65);text-decoration:none;font-size:14px">Contacto</a></li>
      </ul>
    </div>
    <div>
      <h4 style="color:white;font-size:13px;font-weight:700;margin:0 0 16px;text-transform:uppercase;letter-spacing:0.08em">Contacto</h4>
      <div style="display:flex;flex-direction:column;gap:10px;font-size:14px">
        <span>info@academiaplus.mx</span>
        <span>Tel: (55) 4444-0000</span>
        <span>Lun-Vie 8:00 - 20:00</span>
      </div>
    </div>
  </div>
  <div style="max-width:1100px;margin:32px auto 0;padding-top:24px;border-top:1px solid rgba(255,255,255,0.12);text-align:center;font-size:13px">
    &copy; 2025 AcademiaPlus. Todos los derechos reservados.
  </div>
</footer>
`,
    },
    {
      id: 'cursos',
      label: 'Cursos',
      routePath: '/cursos',
      title: 'Catalogo de Cursos',
      required: false,
      css: '',
      html: `
<!-- NAV -->
<nav style="background:white;border-bottom:1px solid #dbeafe;padding:0 40px;height:68px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100;${FS}">
  <span style="font-size:20px;font-weight:800;color:#1d4ed8;letter-spacing:-0.02em">AcademiaPlus</span>
  <div style="display:flex;gap:28px;align-items:center">
    <a href="/" style="color:#374151;text-decoration:none;font-size:14px;font-weight:500">Inicio</a>
    <a href="/instructores" style="color:#374151;text-decoration:none;font-size:14px;font-weight:500">Instructores</a>
    <a href="/testimonios" style="color:#374151;text-decoration:none;font-size:14px;font-weight:500">Testimonios</a>
    <a href="/contacto" style="color:#374151;text-decoration:none;font-size:14px;font-weight:500">Contacto</a>
    <a href="/acceso" style="color:#374151;text-decoration:none;font-size:14px;font-weight:500">Iniciar sesion</a>
    <a href="/contacto" style="background:#1d4ed8;color:white;text-decoration:none;font-size:14px;font-weight:600;padding:10px 24px;border-radius:8px">Inscribirse</a>
  </div>
</nav>

<!-- ENCABEZADO -->
<section style="background:#eff6ff;padding:64px 24px 48px;text-align:center;${FS}">
  <div style="max-width:700px;margin:0 auto">
    <span style="color:#1d4ed8;font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase">Formacion profesional</span>
    <h1 style="font-size:clamp(30px,4.5vw,50px);font-weight:800;color:#1e3a8a;margin:12px 0 16px;letter-spacing:-0.025em">Catalogo de cursos</h1>
    <p style="font-size:16px;color:#475569;line-height:1.7;margin:0">Explora nuestra oferta educativa y elige el curso que impulse tu carrera profesional.</p>
  </div>
</section>

<!-- GRID DE CURSOS -->
<section style="padding:60px 24px 100px;background:white;${FS}">
  <div style="max-width:1100px;margin:0 auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:28px">

    <div style="background:white;border:1px solid #dbeafe;border-radius:20px;overflow:hidden">
      <img src="https://placehold.co/600x260/1d4ed8/eff6ff?text=Desarrollo+Web" alt="Desarrollo Web" style="width:100%;display:block">
      <div style="padding:24px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <span style="background:#eff6ff;color:#1d4ed8;font-size:11px;font-weight:700;padding:3px 10px;border-radius:999px">BASICO</span>
          <span style="font-size:16px;font-weight:800;color:#ea580c">$1,200 MXN</span>
        </div>
        <h3 style="font-size:17px;font-weight:700;color:#1e3a8a;margin:0 0 6px">Desarrollo web desde cero</h3>
        <p style="font-size:13px;color:#64748b;margin:0 0 6px">HTML, CSS y JavaScript para principiantes.</p>
        <p style="font-size:13px;color:#94a3b8;margin:0 0 16px">40 horas de contenido</p>
        <a href="#" style="display:block;text-align:center;background:#1d4ed8;color:white;padding:10px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600">Ver curso</a>
      </div>
    </div>

    <div style="background:white;border:1px solid #dbeafe;border-radius:20px;overflow:hidden">
      <img src="https://placehold.co/600x260/1e3a8a/eff6ff?text=Python+Datos" alt="Python" style="width:100%;display:block">
      <div style="padding:24px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <span style="background:#fff7ed;color:#ea580c;font-size:11px;font-weight:700;padding:3px 10px;border-radius:999px">INTERMEDIO</span>
          <span style="font-size:16px;font-weight:800;color:#ea580c">$2,100 MXN</span>
        </div>
        <h3 style="font-size:17px;font-weight:700;color:#1e3a8a;margin:0 0 6px">Python para ciencia de datos</h3>
        <p style="font-size:13px;color:#64748b;margin:0 0 6px">Pandas, NumPy, visualizacion y ML basico.</p>
        <p style="font-size:13px;color:#94a3b8;margin:0 0 16px">55 horas de contenido</p>
        <a href="#" style="display:block;text-align:center;background:#1d4ed8;color:white;padding:10px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600">Ver curso</a>
      </div>
    </div>

    <div style="background:white;border:1px solid #dbeafe;border-radius:20px;overflow:hidden">
      <img src="https://placehold.co/600x260/ea580c/fff7ed?text=UX+Design" alt="UX Design" style="width:100%;display:block">
      <div style="padding:24px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <span style="background:#fff7ed;color:#ea580c;font-size:11px;font-weight:700;padding:3px 10px;border-radius:999px">INTERMEDIO</span>
          <span style="font-size:16px;font-weight:800;color:#ea580c">$2,400 MXN</span>
        </div>
        <h3 style="font-size:17px;font-weight:700;color:#1e3a8a;margin:0 0 6px">Diseno UX/UI con Figma</h3>
        <p style="font-size:13px;color:#64748b;margin:0 0 6px">Prototipado, sistemas de diseno y pruebas.</p>
        <p style="font-size:13px;color:#94a3b8;margin:0 0 16px">60 horas de contenido</p>
        <a href="#" style="display:block;text-align:center;background:#1d4ed8;color:white;padding:10px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600">Ver curso</a>
      </div>
    </div>

    <div style="background:white;border:1px solid #dbeafe;border-radius:20px;overflow:hidden">
      <img src="https://placehold.co/600x260/7c3aed/ede9fe?text=Marketing+Digital" alt="Marketing Digital" style="width:100%;display:block">
      <div style="padding:24px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <span style="background:#f0fdf4;color:#065f46;font-size:11px;font-weight:700;padding:3px 10px;border-radius:999px">AVANZADO</span>
          <span style="font-size:16px;font-weight:800;color:#ea580c">$3,800 MXN</span>
        </div>
        <h3 style="font-size:17px;font-weight:700;color:#1e3a8a;margin:0 0 6px">Marketing digital avanzado</h3>
        <p style="font-size:13px;color:#64748b;margin:0 0 6px">SEO, SEM, redes sociales y analitica.</p>
        <p style="font-size:13px;color:#94a3b8;margin:0 0 16px">80 horas de contenido</p>
        <a href="#" style="display:block;text-align:center;background:#1d4ed8;color:white;padding:10px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600">Ver curso</a>
      </div>
    </div>

    <div style="background:white;border:1px solid #dbeafe;border-radius:20px;overflow:hidden">
      <img src="https://placehold.co/600x260/0d9488/ccfbf1?text=Excel+Avanzado" alt="Excel" style="width:100%;display:block">
      <div style="padding:24px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <span style="background:#eff6ff;color:#1d4ed8;font-size:11px;font-weight:700;padding:3px 10px;border-radius:999px">BASICO</span>
          <span style="font-size:16px;font-weight:800;color:#ea580c">$900 MXN</span>
        </div>
        <h3 style="font-size:17px;font-weight:700;color:#1e3a8a;margin:0 0 6px">Excel y hojas de calculo</h3>
        <p style="font-size:13px;color:#64748b;margin:0 0 6px">Formulas, tablas dinamicas y automatizacion.</p>
        <p style="font-size:13px;color:#94a3b8;margin:0 0 16px">30 horas de contenido</p>
        <a href="#" style="display:block;text-align:center;background:#1d4ed8;color:white;padding:10px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600">Ver curso</a>
      </div>
    </div>

    <div style="background:white;border:1px solid #dbeafe;border-radius:20px;overflow:hidden">
      <img src="https://placehold.co/600x260/b91c1c/fef2f2?text=Liderazgo" alt="Liderazgo" style="width:100%;display:block">
      <div style="padding:24px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <span style="background:#f0fdf4;color:#065f46;font-size:11px;font-weight:700;padding:3px 10px;border-radius:999px">AVANZADO</span>
          <span style="font-size:16px;font-weight:800;color:#ea580c">$4,500 MXN</span>
        </div>
        <h3 style="font-size:17px;font-weight:700;color:#1e3a8a;margin:0 0 6px">Liderazgo y gestion de equipos</h3>
        <p style="font-size:13px;color:#64748b;margin:0 0 6px">Habilidades directivas para equipos modernos.</p>
        <p style="font-size:13px;color:#94a3b8;margin:0 0 16px">45 horas de contenido</p>
        <a href="#" style="display:block;text-align:center;background:#1d4ed8;color:white;padding:10px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600">Ver curso</a>
      </div>
    </div>

  </div>
</section>

<!-- FOOTER -->
<footer style="background:#1e3a8a;color:rgba(255,255,255,0.65);padding:48px 40px;${FS}">
  <div style="max-width:1100px;margin:0 auto;display:grid;grid-template-columns:2fr 1fr 1fr;gap:48px">
    <div>
      <span style="font-size:18px;font-weight:800;color:white;display:block;margin-bottom:14px">AcademiaPlus</span>
      <p style="font-size:14px;line-height:1.75;margin:0;max-width:300px">Plataforma educativa en linea con cursos certificados en tecnologia, diseno, negocios y mas.</p>
    </div>
    <div>
      <h4 style="color:white;font-size:13px;font-weight:700;margin:0 0 16px;text-transform:uppercase;letter-spacing:0.08em">Paginas</h4>
      <ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:10px">
        <li><a href="/cursos" style="color:rgba(255,255,255,0.65);text-decoration:none;font-size:14px">Cursos</a></li>
        <li><a href="/instructores" style="color:rgba(255,255,255,0.65);text-decoration:none;font-size:14px">Instructores</a></li>
        <li><a href="/testimonios" style="color:rgba(255,255,255,0.65);text-decoration:none;font-size:14px">Testimonios</a></li>
        <li><a href="/contacto" style="color:rgba(255,255,255,0.65);text-decoration:none;font-size:14px">Contacto</a></li>
      </ul>
    </div>
    <div>
      <h4 style="color:white;font-size:13px;font-weight:700;margin:0 0 16px;text-transform:uppercase;letter-spacing:0.08em">Contacto</h4>
      <div style="display:flex;flex-direction:column;gap:10px;font-size:14px">
        <span>info@academiaplus.mx</span>
        <span>Tel: (55) 4444-0000</span>
        <span>Lun-Vie 8:00 - 20:00</span>
      </div>
    </div>
  </div>
  <div style="max-width:1100px;margin:32px auto 0;padding-top:24px;border-top:1px solid rgba(255,255,255,0.12);text-align:center;font-size:13px">
    &copy; 2025 AcademiaPlus. Todos los derechos reservados.
  </div>
</footer>
`,
    },
    {
      id: 'instructores',
      label: 'Instructores',
      routePath: '/instructores',
      title: 'Nuestros Instructores',
      required: false,
      css: '',
      html: `
<!-- NAV -->
<nav style="background:white;border-bottom:1px solid #dbeafe;padding:0 40px;height:68px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100;${FS}">
  <span style="font-size:20px;font-weight:800;color:#1d4ed8;letter-spacing:-0.02em">AcademiaPlus</span>
  <div style="display:flex;gap:28px;align-items:center">
    <a href="/" style="color:#374151;text-decoration:none;font-size:14px;font-weight:500">Inicio</a>
    <a href="/cursos" style="color:#374151;text-decoration:none;font-size:14px;font-weight:500">Cursos</a>
    <a href="/testimonios" style="color:#374151;text-decoration:none;font-size:14px;font-weight:500">Testimonios</a>
    <a href="/contacto" style="color:#374151;text-decoration:none;font-size:14px;font-weight:500">Contacto</a>
    <a href="/acceso" style="color:#374151;text-decoration:none;font-size:14px;font-weight:500">Iniciar sesion</a>
    <a href="/contacto" style="background:#1d4ed8;color:white;text-decoration:none;font-size:14px;font-weight:600;padding:10px 24px;border-radius:8px">Inscribirse</a>
  </div>
</nav>

<!-- ENCABEZADO -->
<section style="background:#eff6ff;padding:64px 24px 48px;text-align:center;${FS}">
  <div style="max-width:700px;margin:0 auto">
    <span style="color:#1d4ed8;font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase">Aprende de los mejores</span>
    <h1 style="font-size:clamp(30px,4.5vw,50px);font-weight:800;color:#1e3a8a;margin:12px 0 16px;letter-spacing:-0.025em">Nuestros instructores</h1>
    <p style="font-size:16px;color:#475569;line-height:1.7;margin:0">Profesionales con amplia experiencia en la industria y pasion por compartir su conocimiento.</p>
  </div>
</section>

<!-- GRID DE INSTRUCTORES -->
<section style="padding:60px 24px 100px;background:white;${FS}">
  <div style="max-width:1100px;margin:0 auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:36px">

    <div style="background:white;border:1px solid #dbeafe;border-radius:20px;padding:32px;text-align:center">
      <img src="https://placehold.co/200x200/1d4ed8/eff6ff?text=CM" alt="Carlos Mendez" style="width:100px;height:100px;border-radius:50%;margin:0 auto 16px;display:block;object-fit:cover">
      <h4 style="font-size:18px;font-weight:700;color:#1e3a8a;margin:0 0 4px">Carlos Mendez</h4>
      <p style="font-size:14px;color:#1d4ed8;font-weight:600;margin:0 0 10px">Desarrollo web</p>
      <p style="font-size:13px;color:#64748b;line-height:1.65;margin:0">Ingeniero de software con 12 anos en empresas tecnologicas de Silicon Valley.</p>
    </div>

    <div style="background:white;border:1px solid #dbeafe;border-radius:20px;padding:32px;text-align:center">
      <img src="https://placehold.co/200x200/1e3a8a/eff6ff?text=LR" alt="Laura Rios" style="width:100px;height:100px;border-radius:50%;margin:0 auto 16px;display:block;object-fit:cover">
      <h4 style="font-size:18px;font-weight:700;color:#1e3a8a;margin:0 0 4px">Laura Rios</h4>
      <p style="font-size:14px;color:#1d4ed8;font-weight:600;margin:0 0 10px">Diseno UX/UI</p>
      <p style="font-size:13px;color:#64748b;line-height:1.65;margin:0">Directora de diseno en agencia global con clientes en 20 paises.</p>
    </div>

    <div style="background:white;border:1px solid #dbeafe;border-radius:20px;padding:32px;text-align:center">
      <img src="https://placehold.co/200x200/ea580c/fff7ed?text=JG" alt="Jorge Gomez" style="width:100px;height:100px;border-radius:50%;margin:0 auto 16px;display:block;object-fit:cover">
      <h4 style="font-size:18px;font-weight:700;color:#1e3a8a;margin:0 0 4px">Jorge Gomez</h4>
      <p style="font-size:14px;color:#1d4ed8;font-weight:600;margin:0 0 10px">Ciencia de datos</p>
      <p style="font-size:13px;color:#64748b;line-height:1.65;margin:0">Data scientist con doctorado en estadistica aplicada y 8 anos de experiencia.</p>
    </div>

    <div style="background:white;border:1px solid #dbeafe;border-radius:20px;padding:32px;text-align:center">
      <img src="https://placehold.co/200x200/7c3aed/ede9fe?text=MV" alt="Maria Villanueva" style="width:100px;height:100px;border-radius:50%;margin:0 auto 16px;display:block;object-fit:cover">
      <h4 style="font-size:18px;font-weight:700;color:#1e3a8a;margin:0 0 4px">Maria Villanueva</h4>
      <p style="font-size:14px;color:#1d4ed8;font-weight:600;margin:0 0 10px">Marketing digital</p>
      <p style="font-size:13px;color:#64748b;line-height:1.65;margin:0">Estratega de marketing con certificaciones Google, Meta y HubSpot.</p>
    </div>

  </div>
</section>

<!-- FOOTER -->
<footer style="background:#1e3a8a;color:rgba(255,255,255,0.65);padding:48px 40px;${FS}">
  <div style="max-width:1100px;margin:0 auto;display:grid;grid-template-columns:2fr 1fr 1fr;gap:48px">
    <div>
      <span style="font-size:18px;font-weight:800;color:white;display:block;margin-bottom:14px">AcademiaPlus</span>
      <p style="font-size:14px;line-height:1.75;margin:0;max-width:300px">Plataforma educativa en linea con cursos certificados en tecnologia, diseno, negocios y mas.</p>
    </div>
    <div>
      <h4 style="color:white;font-size:13px;font-weight:700;margin:0 0 16px;text-transform:uppercase;letter-spacing:0.08em">Paginas</h4>
      <ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:10px">
        <li><a href="/cursos" style="color:rgba(255,255,255,0.65);text-decoration:none;font-size:14px">Cursos</a></li>
        <li><a href="/instructores" style="color:rgba(255,255,255,0.65);text-decoration:none;font-size:14px">Instructores</a></li>
        <li><a href="/testimonios" style="color:rgba(255,255,255,0.65);text-decoration:none;font-size:14px">Testimonios</a></li>
        <li><a href="/contacto" style="color:rgba(255,255,255,0.65);text-decoration:none;font-size:14px">Contacto</a></li>
      </ul>
    </div>
    <div>
      <h4 style="color:white;font-size:13px;font-weight:700;margin:0 0 16px;text-transform:uppercase;letter-spacing:0.08em">Contacto</h4>
      <div style="display:flex;flex-direction:column;gap:10px;font-size:14px">
        <span>info@academiaplus.mx</span>
        <span>Tel: (55) 4444-0000</span>
        <span>Lun-Vie 8:00 - 20:00</span>
      </div>
    </div>
  </div>
  <div style="max-width:1100px;margin:32px auto 0;padding-top:24px;border-top:1px solid rgba(255,255,255,0.12);text-align:center;font-size:13px">
    &copy; 2025 AcademiaPlus. Todos los derechos reservados.
  </div>
</footer>
`,
    },
    {
      id: 'testimonios',
      label: 'Testimonios',
      routePath: '/testimonios',
      title: 'Testimonios de Estudiantes',
      required: false,
      css: '',
      html: `
<!-- NAV -->
<nav style="background:white;border-bottom:1px solid #dbeafe;padding:0 40px;height:68px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100;${FS}">
  <span style="font-size:20px;font-weight:800;color:#1d4ed8;letter-spacing:-0.02em">AcademiaPlus</span>
  <div style="display:flex;gap:28px;align-items:center">
    <a href="/" style="color:#374151;text-decoration:none;font-size:14px;font-weight:500">Inicio</a>
    <a href="/cursos" style="color:#374151;text-decoration:none;font-size:14px;font-weight:500">Cursos</a>
    <a href="/instructores" style="color:#374151;text-decoration:none;font-size:14px;font-weight:500">Instructores</a>
    <a href="/contacto" style="color:#374151;text-decoration:none;font-size:14px;font-weight:500">Contacto</a>
    <a href="/acceso" style="color:#374151;text-decoration:none;font-size:14px;font-weight:500">Iniciar sesion</a>
    <a href="/contacto" style="background:#1d4ed8;color:white;text-decoration:none;font-size:14px;font-weight:600;padding:10px 24px;border-radius:8px">Inscribirse</a>
  </div>
</nav>

<!-- ENCABEZADO -->
<section style="background:#eff6ff;padding:64px 24px 48px;text-align:center;${FS}">
  <div style="max-width:700px;margin:0 auto">
    <span style="color:#1d4ed8;font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase">Historias reales</span>
    <h1 style="font-size:clamp(30px,4.5vw,50px);font-weight:800;color:#1e3a8a;margin:12px 0 16px;letter-spacing:-0.025em">Lo que dicen nuestros estudiantes</h1>
    <p style="font-size:16px;color:#475569;line-height:1.7;margin:0">Mas de 500 estudiantes han transformado sus carreras con AcademiaPlus. Conoce sus historias.</p>
  </div>
</section>

<!-- GRID DE TESTIMONIOS -->
<section style="padding:60px 24px 100px;background:white;${FS}">
  <div style="max-width:1100px;margin:0 auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:28px">

    <div style="background:#eff6ff;border-radius:20px;padding:32px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px">
        <div style="display:flex;gap:12px;align-items:center">
          <img src="https://placehold.co/48x48/1d4ed8/eff6ff?text=AM" alt="Ana M" style="width:48px;height:48px;border-radius:50%">
          <div>
            <div style="font-size:15px;font-weight:700;color:#1e3a8a">Ana Martinez</div>
            <div style="font-size:12px;color:#64748b">Desarrollo web</div>
          </div>
        </div>
        <span style="font-size:13px;font-weight:700;color:#1d4ed8">5/5</span>
      </div>
      <p style="font-size:15px;color:#374151;line-height:1.75;margin:0">"Tome el curso de desarrollo web sin saber nada de programacion. A los 3 meses consegui mi primer trabajo como junior developer. Increible la calidad del contenido y el seguimiento del instructor."</p>
    </div>

    <div style="background:#eff6ff;border-radius:20px;padding:32px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px">
        <div style="display:flex;gap:12px;align-items:center">
          <img src="https://placehold.co/48x48/1e3a8a/eff6ff?text=LG" alt="Luis G" style="width:48px;height:48px;border-radius:50%">
          <div>
            <div style="font-size:15px;font-weight:700;color:#1e3a8a">Luis Garcia</div>
            <div style="font-size:12px;color:#64748b">Ciencia de datos</div>
          </div>
        </div>
        <span style="font-size:13px;font-weight:700;color:#1d4ed8">5/5</span>
      </div>
      <p style="font-size:15px;color:#374151;line-height:1.75;margin:0">"El curso de Python para datos es brutalmente practico. Cada ejercicio replica situaciones reales. Hoy trabajo como analista en una fintech y uso lo aprendido todos los dias."</p>
    </div>

    <div style="background:#eff6ff;border-radius:20px;padding:32px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px">
        <div style="display:flex;gap:12px;align-items:center">
          <img src="https://placehold.co/48x48/ea580c/fff7ed?text=SC" alt="Sofia C" style="width:48px;height:48px;border-radius:50%">
          <div>
            <div style="font-size:15px;font-weight:700;color:#1e3a8a">Sofia Castro</div>
            <div style="font-size:12px;color:#64748b">Diseno UX/UI</div>
          </div>
        </div>
        <span style="font-size:13px;font-weight:700;color:#1d4ed8">5/5</span>
      </div>
      <p style="font-size:15px;color:#374151;line-height:1.75;margin:0">"Laura es una instructora excepcional. Explica con claridad, da retroalimentacion rapida y el material esta muy bien estructurado. Ahora trabajo de forma independiente como disenadora UX."</p>
    </div>

    <div style="background:#eff6ff;border-radius:20px;padding:32px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px">
        <div style="display:flex;gap:12px;align-items:center">
          <img src="https://placehold.co/48x48/7c3aed/ede9fe?text=RH" alt="Roberto H" style="width:48px;height:48px;border-radius:50%">
          <div>
            <div style="font-size:15px;font-weight:700;color:#1e3a8a">Roberto Herrera</div>
            <div style="font-size:12px;color:#64748b">Marketing digital</div>
          </div>
        </div>
        <span style="font-size:13px;font-weight:700;color:#1d4ed8">4/5</span>
      </div>
      <p style="font-size:15px;color:#374151;line-height:1.75;margin:0">"El curso de marketing es muy completo. Me permitio redisear toda la estrategia digital de mi empresa familiar y triplicar las ventas en linea en menos de un semestre."</p>
    </div>

    <div style="background:#eff6ff;border-radius:20px;padding:32px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px">
        <div style="display:flex;gap:12px;align-items:center">
          <img src="https://placehold.co/48x48/0d9488/ccfbf1?text=PT" alt="Patricia T" style="width:48px;height:48px;border-radius:50%">
          <div>
            <div style="font-size:15px;font-weight:700;color:#1e3a8a">Patricia Torres</div>
            <div style="font-size:12px;color:#64748b">Excel avanzado</div>
          </div>
        </div>
        <span style="font-size:13px;font-weight:700;color:#1d4ed8">5/5</span>
      </div>
      <p style="font-size:15px;color:#374151;line-height:1.75;margin:0">"Pensaba que Excel era solo para sumar. Ahora automatizo reportes completos que antes me tomaban medio dia. Fue la mejor inversion para mi carrera administrativa."</p>
    </div>

    <div style="background:#eff6ff;border-radius:20px;padding:32px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px">
        <div style="display:flex;gap:12px;align-items:center">
          <img src="https://placehold.co/48x48/b91c1c/fef2f2?text=DM" alt="Diego M" style="width:48px;height:48px;border-radius:50%">
          <div>
            <div style="font-size:15px;font-weight:700;color:#1e3a8a">Diego Morales</div>
            <div style="font-size:12px;color:#64748b">Liderazgo</div>
          </div>
        </div>
        <span style="font-size:13px;font-weight:700;color:#1d4ed8">5/5</span>
      </div>
      <p style="font-size:15px;color:#374151;line-height:1.75;margin:0">"El curso de liderazgo transformo la forma en que gestiono a mi equipo. Menos conflictos, mejor comunicacion y resultados notablemente mejores. Lo recomiendo a cualquier jefe."</p>
    </div>

  </div>
</section>

<!-- FOOTER -->
<footer style="background:#1e3a8a;color:rgba(255,255,255,0.65);padding:48px 40px;${FS}">
  <div style="max-width:1100px;margin:0 auto;display:grid;grid-template-columns:2fr 1fr 1fr;gap:48px">
    <div>
      <span style="font-size:18px;font-weight:800;color:white;display:block;margin-bottom:14px">AcademiaPlus</span>
      <p style="font-size:14px;line-height:1.75;margin:0;max-width:300px">Plataforma educativa en linea con cursos certificados en tecnologia, diseno, negocios y mas.</p>
    </div>
    <div>
      <h4 style="color:white;font-size:13px;font-weight:700;margin:0 0 16px;text-transform:uppercase;letter-spacing:0.08em">Paginas</h4>
      <ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:10px">
        <li><a href="/cursos" style="color:rgba(255,255,255,0.65);text-decoration:none;font-size:14px">Cursos</a></li>
        <li><a href="/instructores" style="color:rgba(255,255,255,0.65);text-decoration:none;font-size:14px">Instructores</a></li>
        <li><a href="/testimonios" style="color:rgba(255,255,255,0.65);text-decoration:none;font-size:14px">Testimonios</a></li>
        <li><a href="/contacto" style="color:rgba(255,255,255,0.65);text-decoration:none;font-size:14px">Contacto</a></li>
      </ul>
    </div>
    <div>
      <h4 style="color:white;font-size:13px;font-weight:700;margin:0 0 16px;text-transform:uppercase;letter-spacing:0.08em">Contacto</h4>
      <div style="display:flex;flex-direction:column;gap:10px;font-size:14px">
        <span>info@academiaplus.mx</span>
        <span>Tel: (55) 4444-0000</span>
        <span>Lun-Vie 8:00 - 20:00</span>
      </div>
    </div>
  </div>
  <div style="max-width:1100px;margin:32px auto 0;padding-top:24px;border-top:1px solid rgba(255,255,255,0.12);text-align:center;font-size:13px">
    &copy; 2025 AcademiaPlus. Todos los derechos reservados.
  </div>
</footer>
`,
    },
    {
      id: 'contacto',
      label: 'Contacto',
      routePath: '/contacto',
      title: 'Contacto e Inscripciones',
      required: false,
      css: '',
      html: `
<!-- NAV -->
<nav style="background:white;border-bottom:1px solid #dbeafe;padding:0 40px;height:68px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100;${FS}">
  <span style="font-size:20px;font-weight:800;color:#1d4ed8;letter-spacing:-0.02em">AcademiaPlus</span>
  <div style="display:flex;gap:28px;align-items:center">
    <a href="/" style="color:#374151;text-decoration:none;font-size:14px;font-weight:500">Inicio</a>
    <a href="/cursos" style="color:#374151;text-decoration:none;font-size:14px;font-weight:500">Cursos</a>
    <a href="/instructores" style="color:#374151;text-decoration:none;font-size:14px;font-weight:500">Instructores</a>
    <a href="/testimonios" style="color:#374151;text-decoration:none;font-size:14px;font-weight:500">Testimonios</a>
    <a href="/acceso" style="color:#374151;text-decoration:none;font-size:14px;font-weight:500">Iniciar sesion</a>
    <a href="/contacto" style="background:#1d4ed8;color:white;text-decoration:none;font-size:14px;font-weight:600;padding:10px 24px;border-radius:8px">Inscribirse</a>
  </div>
</nav>

<!-- CONTACTO -->
<section style="padding:80px 24px 100px;background:white;${FS}">
  <div style="max-width:1100px;margin:0 auto;display:grid;grid-template-columns:1fr 1.3fr;gap:72px">
    <div>
      <span style="color:#1d4ed8;font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase">Estamos aqui</span>
      <h1 style="font-size:clamp(28px,4vw,44px);font-weight:800;color:#1e3a8a;margin:14px 0 28px;letter-spacing:-0.025em">Contacto e inscripciones</h1>
      <div style="display:flex;flex-direction:column;gap:22px">
        <div style="display:flex;gap:16px;align-items:flex-start">
          <div style="width:44px;height:44px;background:#eff6ff;border-radius:10px;display:flex;align-items:center;justify-content:center;color:#1d4ed8;font-size:16px;font-weight:800;flex-shrink:0">@</div>
          <div>
            <div style="font-size:14px;font-weight:700;color:#1e3a8a;margin-bottom:4px">Correo</div>
            <div style="font-size:14px;color:#475569">info@academiaplus.mx</div>
          </div>
        </div>
        <div style="display:flex;gap:16px;align-items:flex-start">
          <div style="width:44px;height:44px;background:#eff6ff;border-radius:10px;display:flex;align-items:center;justify-content:center;color:#1d4ed8;font-size:16px;font-weight:800;flex-shrink:0">T</div>
          <div>
            <div style="font-size:14px;font-weight:700;color:#1e3a8a;margin-bottom:4px">Telefono</div>
            <div style="font-size:14px;color:#475569">(55) 4444-0000</div>
          </div>
        </div>
        <div style="display:flex;gap:16px;align-items:flex-start">
          <div style="width:44px;height:44px;background:#eff6ff;border-radius:10px;display:flex;align-items:center;justify-content:center;color:#1d4ed8;font-size:16px;font-weight:800;flex-shrink:0">H</div>
          <div>
            <div style="font-size:14px;font-weight:700;color:#1e3a8a;margin-bottom:4px">Horarios de atencion</div>
            <div style="font-size:14px;color:#475569;line-height:1.6">Lunes a Viernes: 8:00 - 20:00<br>Sabado: 9:00 - 14:00</div>
          </div>
        </div>
      </div>
    </div>
    <div style="background:#eff6ff;border-radius:24px;padding:40px">
      <h2 style="font-size:20px;font-weight:800;color:#1e3a8a;margin:0 0 28px">Solicitar informacion</h2>
      <form style="display:flex;flex-direction:column;gap:18px">
        <div>
          <label style="display:block;font-size:14px;font-weight:600;color:#1e3a8a;margin-bottom:8px">Nombre completo</label>
          <input type="text" placeholder="Tu nombre" style="width:100%;background:white;border:1px solid #dbeafe;border-radius:10px;padding:13px 16px;font-size:15px;outline:none;box-sizing:border-box">
        </div>
        <div>
          <label style="display:block;font-size:14px;font-weight:600;color:#1e3a8a;margin-bottom:8px">Correo electronico</label>
          <input type="email" placeholder="tu@correo.com" style="width:100%;background:white;border:1px solid #dbeafe;border-radius:10px;padding:13px 16px;font-size:15px;outline:none;box-sizing:border-box">
        </div>
        <div>
          <label style="display:block;font-size:14px;font-weight:600;color:#1e3a8a;margin-bottom:8px">Curso de interes</label>
          <input type="text" placeholder="Nombre del curso que te interesa" style="width:100%;background:white;border:1px solid #dbeafe;border-radius:10px;padding:13px 16px;font-size:15px;outline:none;box-sizing:border-box">
        </div>
        <div>
          <label style="display:block;font-size:14px;font-weight:600;color:#1e3a8a;margin-bottom:8px">Mensaje</label>
          <textarea placeholder="Dudas, preguntas sobre el temario o solicitud de informacion..." rows="4" style="width:100%;background:white;border:1px solid #dbeafe;border-radius:10px;padding:13px 16px;font-size:15px;outline:none;resize:vertical;box-sizing:border-box"></textarea>
        </div>
        <button type="submit" style="background:#1d4ed8;color:white;font-size:16px;font-weight:700;padding:15px;border-radius:10px;border:none;cursor:pointer">Enviar solicitud</button>
      </form>
    </div>
  </div>
</section>

<!-- FOOTER -->
<footer style="background:#1e3a8a;color:rgba(255,255,255,0.65);padding:48px 40px;${FS}">
  <div style="max-width:1100px;margin:0 auto;display:grid;grid-template-columns:2fr 1fr 1fr;gap:48px">
    <div>
      <span style="font-size:18px;font-weight:800;color:white;display:block;margin-bottom:14px">AcademiaPlus</span>
      <p style="font-size:14px;line-height:1.75;margin:0;max-width:300px">Plataforma educativa en linea con cursos certificados en tecnologia, diseno, negocios y mas.</p>
    </div>
    <div>
      <h4 style="color:white;font-size:13px;font-weight:700;margin:0 0 16px;text-transform:uppercase;letter-spacing:0.08em">Paginas</h4>
      <ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:10px">
        <li><a href="/cursos" style="color:rgba(255,255,255,0.65);text-decoration:none;font-size:14px">Cursos</a></li>
        <li><a href="/instructores" style="color:rgba(255,255,255,0.65);text-decoration:none;font-size:14px">Instructores</a></li>
        <li><a href="/testimonios" style="color:rgba(255,255,255,0.65);text-decoration:none;font-size:14px">Testimonios</a></li>
        <li><a href="/contacto" style="color:rgba(255,255,255,0.65);text-decoration:none;font-size:14px">Contacto</a></li>
      </ul>
    </div>
    <div>
      <h4 style="color:white;font-size:13px;font-weight:700;margin:0 0 16px;text-transform:uppercase;letter-spacing:0.08em">Contacto</h4>
      <div style="display:flex;flex-direction:column;gap:10px;font-size:14px">
        <span>info@academiaplus.mx</span>
        <span>Tel: (55) 4444-0000</span>
        <span>Lun-Vie 8:00 - 20:00</span>
      </div>
    </div>
  </div>
  <div style="max-width:1100px;margin:32px auto 0;padding-top:24px;border-top:1px solid rgba(255,255,255,0.12);text-align:center;font-size:13px">
    &copy; 2025 AcademiaPlus. Todos los derechos reservados.
  </div>
</footer>
`,
    },
  ],
}
