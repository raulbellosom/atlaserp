const FS = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"

export const templateOng = {
  id: 'ong',
  label: 'ONG / Fundacion',
  category: 'social',
  description: 'Para organizaciones sin fines de lucro, fundaciones y proyectos sociales.',
  color: '#065f46',
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
<nav style="background:white;border-bottom:1px solid #d1fae5;padding:0 40px;height:68px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100;${FS}">
  <span style="font-size:20px;font-weight:800;color:#065f46;letter-spacing:-0.02em">FundacionEsperanza</span>
  <div style="display:flex;gap:28px;align-items:center">
    <a href="/mision" style="color:#374151;text-decoration:none;font-size:14px;font-weight:500">Mision</a>
    <a href="/proyectos" style="color:#374151;text-decoration:none;font-size:14px;font-weight:500">Proyectos</a>
    <a href="/voluntarios" style="color:#374151;text-decoration:none;font-size:14px;font-weight:500">Voluntarios</a>
    <a href="/donaciones" style="color:#374151;text-decoration:none;font-size:14px;font-weight:500">Donaciones</a>
    <a href="/contacto" style="color:#374151;text-decoration:none;font-size:14px;font-weight:500">Contacto</a>
    <a href="/acceso" style="color:#374151;text-decoration:none;font-size:14px;font-weight:500">Iniciar sesion</a>
    <a href="/donaciones" style="background:#065f46;color:white;text-decoration:none;font-size:14px;font-weight:600;padding:10px 24px;border-radius:8px">Donar ahora</a>
  </div>
</nav>

<!-- HERO -->
<section style="background:linear-gradient(135deg,#022c22 0%,#065f46 100%);padding:100px 24px 80px;text-align:center;${FS}">
  <div style="max-width:820px;margin:0 auto">
    <div style="display:inline-block;background:rgba(251,191,36,0.15);border:1px solid rgba(251,191,36,0.35);border-radius:999px;padding:6px 20px;margin-bottom:28px">
      <span style="color:#fbbf24;font-size:13px;font-weight:600;letter-spacing:0.08em">Organizacion sin fines de lucro</span>
    </div>
    <h1 style="font-size:clamp(38px,5.5vw,68px);font-weight:800;color:white;line-height:1.1;margin:0 0 22px;letter-spacing:-0.03em">Transformando vidas, construyendo futuro</h1>
    <p style="font-size:18px;color:rgba(255,255,255,0.8);line-height:1.75;margin:0 auto 44px;max-width:600px">Trabajamos junto a comunidades vulnerables para crear oportunidades reales de educacion, salud y desarrollo sostenible.</p>
    <div style="display:flex;gap:16px;justify-content:center;flex-wrap:wrap">
      <a href="/donaciones" style="background:#fbbf24;color:#022c22;font-size:16px;font-weight:800;padding:15px 40px;border-radius:10px;text-decoration:none">Donar ahora</a>
      <a href="/proyectos" style="background:rgba(255,255,255,0.12);color:white;font-size:16px;font-weight:600;padding:15px 40px;border-radius:10px;text-decoration:none;border:2px solid rgba(255,255,255,0.25)">Ver proyectos</a>
    </div>
  </div>
</section>

<!-- IMPACTO -->
<section style="background:#f0fdf4;padding:80px 24px;${FS}">
  <div style="max-width:1100px;margin:0 auto">
    <div style="text-align:center;margin-bottom:52px">
      <span style="color:#065f46;font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase">Nuestro impacto</span>
      <h2 style="font-size:clamp(26px,3.5vw,40px);font-weight:800;color:#022c22;margin:12px 0 0;letter-spacing:-0.025em">Numeros que importan</h2>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:2px;background:#d1fae5;border-radius:20px;overflow:hidden">
      <div style="background:#f0fdf4;padding:48px 24px;text-align:center">
        <div style="font-size:48px;font-weight:900;color:#065f46;margin-bottom:8px">12,400</div>
        <div style="font-size:15px;color:#374151;font-weight:600">Beneficiarios directos</div>
      </div>
      <div style="background:#f0fdf4;padding:48px 24px;text-align:center">
        <div style="font-size:48px;font-weight:900;color:#065f46;margin-bottom:8px">38</div>
        <div style="font-size:15px;color:#374151;font-weight:600">Proyectos activos</div>
      </div>
      <div style="background:#f0fdf4;padding:48px 24px;text-align:center">
        <div style="font-size:48px;font-weight:900;color:#065f46;margin-bottom:8px">120+</div>
        <div style="font-size:15px;color:#374151;font-weight:600">Voluntarios activos</div>
      </div>
    </div>
  </div>
</section>

<!-- PROYECTOS ACTIVOS -->
<section style="padding:80px 24px;background:white;${FS}">
  <div style="max-width:1100px;margin:0 auto">
    <div style="text-align:center;margin-bottom:52px">
      <span style="color:#065f46;font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase">En marcha</span>
      <h2 style="font-size:clamp(26px,3.5vw,40px);font-weight:800;color:#022c22;margin:12px 0 0;letter-spacing:-0.025em">Proyectos en curso</h2>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:28px">
      <div style="background:#f0fdf4;border-radius:20px;padding:32px">
        <span style="display:inline-block;background:#065f46;color:white;font-size:11px;font-weight:700;padding:4px 12px;border-radius:999px;margin-bottom:16px">ACTIVO</span>
        <h3 style="font-size:18px;font-weight:700;color:#022c22;margin:0 0 10px">Escuelas Comunitarias</h3>
        <p style="font-size:14px;color:#374151;line-height:1.7;margin:0 0 16px">Construccion y equipamiento de aulas en zonas rurales de escasos recursos con acceso limitado a educacion formal.</p>
        <span style="font-size:13px;color:#065f46;font-weight:600">840 ninos beneficiados</span>
      </div>
      <div style="background:#f0fdf4;border-radius:20px;padding:32px">
        <span style="display:inline-block;background:#065f46;color:white;font-size:11px;font-weight:700;padding:4px 12px;border-radius:999px;margin-bottom:16px">ACTIVO</span>
        <h3 style="font-size:18px;font-weight:700;color:#022c22;margin:0 0 10px">Acceso al Agua Potable</h3>
        <p style="font-size:14px;color:#374151;line-height:1.7;margin:0 0 16px">Instalacion de sistemas de captacion y purificacion de agua en comunidades sin acceso a red de distribucion.</p>
        <span style="font-size:13px;color:#065f46;font-weight:600">3,200 familias impactadas</span>
      </div>
      <div style="background:#f0fdf4;border-radius:20px;padding:32px">
        <span style="display:inline-block;background:#fbbf24;color:#022c22;font-size:11px;font-weight:700;padding:4px 12px;border-radius:999px;margin-bottom:16px">EN PROGRESO</span>
        <h3 style="font-size:18px;font-weight:700;color:#022c22;margin:0 0 10px">Microempresas Rurales</h3>
        <p style="font-size:14px;color:#374151;line-height:1.7;margin:0 0 16px">Capacitacion en habilidades empresariales y micro-financiamiento para emprendedoras en comunidades indigenas.</p>
        <span style="font-size:13px;color:#065f46;font-weight:600">560 mujeres emprendedoras</span>
      </div>
    </div>
  </div>
</section>

<!-- CTA DONACION -->
<section style="padding:80px 24px;background:#022c22;text-align:center;${FS}">
  <div style="max-width:680px;margin:0 auto">
    <h2 style="font-size:clamp(26px,3.5vw,42px);font-weight:800;color:white;margin:0 0 16px;letter-spacing:-0.025em">Tu aporte cambia vidas</h2>
    <p style="font-size:17px;color:rgba(255,255,255,0.75);line-height:1.75;margin:0 0 36px">Con tan solo $100 pesos al mes puedes garantizar materiales escolares para un nino durante un ano completo.</p>
    <a href="/donaciones" style="background:#fbbf24;color:#022c22;font-size:16px;font-weight:800;padding:16px 48px;border-radius:10px;text-decoration:none;display:inline-block">Hacer una donacion</a>
  </div>
</section>

<!-- FOOTER -->
<footer style="background:#022c22;border-top:1px solid rgba(255,255,255,0.08);color:rgba(255,255,255,0.65);padding:48px 40px;${FS}">
  <div style="max-width:1100px;margin:0 auto;display:grid;grid-template-columns:2fr 1fr 1fr;gap:48px">
    <div>
      <span style="font-size:18px;font-weight:800;color:white;display:block;margin-bottom:14px">FundacionEsperanza</span>
      <p style="font-size:14px;line-height:1.75;margin:0;max-width:300px">Organizacion sin fines de lucro comprometida con el desarrollo humano sostenible en comunidades vulnerables.</p>
    </div>
    <div>
      <h4 style="color:white;font-size:13px;font-weight:700;margin:0 0 16px;text-transform:uppercase;letter-spacing:0.08em">Paginas</h4>
      <ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:10px">
        <li><a href="/mision" style="color:rgba(255,255,255,0.65);text-decoration:none;font-size:14px">Mision</a></li>
        <li><a href="/proyectos" style="color:rgba(255,255,255,0.65);text-decoration:none;font-size:14px">Proyectos</a></li>
        <li><a href="/voluntarios" style="color:rgba(255,255,255,0.65);text-decoration:none;font-size:14px">Voluntarios</a></li>
        <li><a href="/donaciones" style="color:rgba(255,255,255,0.65);text-decoration:none;font-size:14px">Donaciones</a></li>
        <li><a href="/contacto" style="color:rgba(255,255,255,0.65);text-decoration:none;font-size:14px">Contacto</a></li>
      </ul>
    </div>
    <div>
      <h4 style="color:white;font-size:13px;font-weight:700;margin:0 0 16px;text-transform:uppercase;letter-spacing:0.08em">Contacto</h4>
      <div style="display:flex;flex-direction:column;gap:10px;font-size:14px">
        <span>Calle 5 de Mayo 200, CDMX</span>
        <span>Tel: (55) 3333-0000</span>
        <span>contacto@fundacionesperanza.org</span>
      </div>
    </div>
  </div>
  <div style="max-width:1100px;margin:32px auto 0;padding-top:24px;border-top:1px solid rgba(255,255,255,0.1);text-align:center;font-size:13px">
    &copy; 2025 FundacionEsperanza. Todos los derechos reservados.
  </div>
</footer>
`,
    },
    {
      id: 'mision',
      label: 'Mision',
      routePath: '/mision',
      title: 'Mision y Vision',
      required: false,
      css: '',
      html: `
<!-- NAV -->
<nav style="background:white;border-bottom:1px solid #d1fae5;padding:0 40px;height:68px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100;${FS}">
  <span style="font-size:20px;font-weight:800;color:#065f46;letter-spacing:-0.02em">FundacionEsperanza</span>
  <div style="display:flex;gap:28px;align-items:center">
    <a href="/" style="color:#374151;text-decoration:none;font-size:14px;font-weight:500">Inicio</a>
    <a href="/proyectos" style="color:#374151;text-decoration:none;font-size:14px;font-weight:500">Proyectos</a>
    <a href="/voluntarios" style="color:#374151;text-decoration:none;font-size:14px;font-weight:500">Voluntarios</a>
    <a href="/donaciones" style="color:#374151;text-decoration:none;font-size:14px;font-weight:500">Donaciones</a>
    <a href="/contacto" style="color:#374151;text-decoration:none;font-size:14px;font-weight:500">Contacto</a>
    <a href="/acceso" style="color:#374151;text-decoration:none;font-size:14px;font-weight:500">Iniciar sesion</a>
    <a href="/donaciones" style="background:#065f46;color:white;text-decoration:none;font-size:14px;font-weight:600;padding:10px 24px;border-radius:8px">Donar ahora</a>
  </div>
</nav>

<!-- MISION / VISION / VALORES -->
<section style="padding:80px 24px;background:white;${FS}">
  <div style="max-width:1000px;margin:0 auto">
    <div style="text-align:center;margin-bottom:64px">
      <span style="color:#065f46;font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase">Quienes somos</span>
      <h1 style="font-size:clamp(30px,4.5vw,52px);font-weight:800;color:#022c22;margin:12px 0 0;letter-spacing:-0.025em">Mision, vision y valores</h1>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:28px;margin-bottom:80px">
      <div style="background:#f0fdf4;border-radius:20px;padding:36px">
        <div style="width:48px;height:48px;background:#065f46;border-radius:12px;display:flex;align-items:center;justify-content:center;color:white;font-size:18px;font-weight:800;margin-bottom:18px">M</div>
        <h3 style="font-size:18px;font-weight:800;color:#022c22;margin:0 0 12px">Mision</h3>
        <p style="font-size:15px;color:#374151;line-height:1.75;margin:0">Generar oportunidades de desarrollo integral para comunidades en situacion de vulnerabilidad, promoviendo su autonomia y bienestar sostenible.</p>
      </div>
      <div style="background:#f0fdf4;border-radius:20px;padding:36px">
        <div style="width:48px;height:48px;background:#065f46;border-radius:12px;display:flex;align-items:center;justify-content:center;color:white;font-size:18px;font-weight:800;margin-bottom:18px">V</div>
        <h3 style="font-size:18px;font-weight:800;color:#022c22;margin:0 0 12px">Vision</h3>
        <p style="font-size:15px;color:#374151;line-height:1.75;margin:0">Un mundo donde cada persona, sin importar su origen, tenga acceso a las condiciones basicas para vivir con dignidad y desarrollar su maximo potencial.</p>
      </div>
      <div style="background:#f0fdf4;border-radius:20px;padding:36px">
        <div style="width:48px;height:48px;background:#065f46;border-radius:12px;display:flex;align-items:center;justify-content:center;color:white;font-size:18px;font-weight:800;margin-bottom:18px">P</div>
        <h3 style="font-size:18px;font-weight:800;color:#022c22;margin:0 0 12px">Principios</h3>
        <p style="font-size:15px;color:#374151;line-height:1.75;margin:0">Transparencia absoluta, respeto a la dignidad humana, enfoque participativo y colaboracion con comunidades como agentes de su propio cambio.</p>
      </div>
    </div>

    <!-- HISTORIA / LINEA DE TIEMPO -->
    <h2 style="font-size:clamp(24px,3vw,36px);font-weight:800;color:#022c22;margin:0 0 48px;letter-spacing:-0.025em">Nuestra historia</h2>
    <div style="display:flex;flex-direction:column;gap:0">

      <div style="display:grid;grid-template-columns:120px 1fr;gap:32px;align-items:flex-start;padding-bottom:40px">
        <div style="text-align:right">
          <span style="font-size:20px;font-weight:900;color:#065f46">2010</span>
        </div>
        <div style="border-left:3px solid #d1fae5;padding-left:32px">
          <h4 style="font-size:17px;font-weight:700;color:#022c22;margin:0 0 8px">Fundacion de la organizacion</h4>
          <p style="font-size:15px;color:#374151;line-height:1.7;margin:0">Un grupo de 5 voluntarios fundo FundacionEsperanza con el primer proyecto de educacion en el estado de Oaxaca.</p>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:120px 1fr;gap:32px;align-items:flex-start;padding-bottom:40px">
        <div style="text-align:right">
          <span style="font-size:20px;font-weight:900;color:#065f46">2016</span>
        </div>
        <div style="border-left:3px solid #d1fae5;padding-left:32px">
          <h4 style="font-size:17px;font-weight:700;color:#022c22;margin:0 0 8px">Expansion nacional</h4>
          <p style="font-size:15px;color:#374151;line-height:1.7;margin:0">Ampliamos operaciones a 8 estados del pais y lanzamos el programa de acceso a agua potable que beneficio a mas de 10,000 personas.</p>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:120px 1fr;gap:32px;align-items:flex-start">
        <div style="text-align:right">
          <span style="font-size:20px;font-weight:900;color:#065f46">2023</span>
        </div>
        <div style="border-left:3px solid #d1fae5;padding-left:32px">
          <h4 style="font-size:17px;font-weight:700;color:#022c22;margin:0 0 8px">Reconocimiento internacional</h4>
          <p style="font-size:15px;color:#374151;line-height:1.7;margin:0">Recibimos el premio ONU a la Excelencia en Desarrollo Comunitario y firmamos alianzas estrategicas con organizaciones de 12 paises.</p>
        </div>
      </div>

    </div>
  </div>
</section>

<!-- FOOTER -->
<footer style="background:#022c22;border-top:1px solid rgba(255,255,255,0.08);color:rgba(255,255,255,0.65);padding:48px 40px;${FS}">
  <div style="max-width:1100px;margin:0 auto;display:grid;grid-template-columns:2fr 1fr 1fr;gap:48px">
    <div>
      <span style="font-size:18px;font-weight:800;color:white;display:block;margin-bottom:14px">FundacionEsperanza</span>
      <p style="font-size:14px;line-height:1.75;margin:0;max-width:300px">Organizacion sin fines de lucro comprometida con el desarrollo humano sostenible en comunidades vulnerables.</p>
    </div>
    <div>
      <h4 style="color:white;font-size:13px;font-weight:700;margin:0 0 16px;text-transform:uppercase;letter-spacing:0.08em">Paginas</h4>
      <ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:10px">
        <li><a href="/mision" style="color:rgba(255,255,255,0.65);text-decoration:none;font-size:14px">Mision</a></li>
        <li><a href="/proyectos" style="color:rgba(255,255,255,0.65);text-decoration:none;font-size:14px">Proyectos</a></li>
        <li><a href="/voluntarios" style="color:rgba(255,255,255,0.65);text-decoration:none;font-size:14px">Voluntarios</a></li>
        <li><a href="/donaciones" style="color:rgba(255,255,255,0.65);text-decoration:none;font-size:14px">Donaciones</a></li>
        <li><a href="/contacto" style="color:rgba(255,255,255,0.65);text-decoration:none;font-size:14px">Contacto</a></li>
      </ul>
    </div>
    <div>
      <h4 style="color:white;font-size:13px;font-weight:700;margin:0 0 16px;text-transform:uppercase;letter-spacing:0.08em">Contacto</h4>
      <div style="display:flex;flex-direction:column;gap:10px;font-size:14px">
        <span>Calle 5 de Mayo 200, CDMX</span>
        <span>Tel: (55) 3333-0000</span>
        <span>contacto@fundacionesperanza.org</span>
      </div>
    </div>
  </div>
  <div style="max-width:1100px;margin:32px auto 0;padding-top:24px;border-top:1px solid rgba(255,255,255,0.1);text-align:center;font-size:13px">
    &copy; 2025 FundacionEsperanza. Todos los derechos reservados.
  </div>
</footer>
`,
    },
    {
      id: 'proyectos',
      label: 'Proyectos',
      routePath: '/proyectos',
      title: 'Proyectos',
      required: false,
      css: '',
      html: `
<!-- NAV -->
<nav style="background:white;border-bottom:1px solid #d1fae5;padding:0 40px;height:68px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100;${FS}">
  <span style="font-size:20px;font-weight:800;color:#065f46;letter-spacing:-0.02em">FundacionEsperanza</span>
  <div style="display:flex;gap:28px;align-items:center">
    <a href="/" style="color:#374151;text-decoration:none;font-size:14px;font-weight:500">Inicio</a>
    <a href="/mision" style="color:#374151;text-decoration:none;font-size:14px;font-weight:500">Mision</a>
    <a href="/voluntarios" style="color:#374151;text-decoration:none;font-size:14px;font-weight:500">Voluntarios</a>
    <a href="/donaciones" style="color:#374151;text-decoration:none;font-size:14px;font-weight:500">Donaciones</a>
    <a href="/contacto" style="color:#374151;text-decoration:none;font-size:14px;font-weight:500">Contacto</a>
    <a href="/acceso" style="color:#374151;text-decoration:none;font-size:14px;font-weight:500">Iniciar sesion</a>
    <a href="/donaciones" style="background:#065f46;color:white;text-decoration:none;font-size:14px;font-weight:600;padding:10px 24px;border-radius:8px">Donar ahora</a>
  </div>
</nav>

<!-- ENCABEZADO -->
<section style="background:#f0fdf4;padding:64px 24px 48px;text-align:center;${FS}">
  <div style="max-width:700px;margin:0 auto">
    <span style="color:#065f46;font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase">Accion en campo</span>
    <h1 style="font-size:clamp(30px,4.5vw,50px);font-weight:800;color:#022c22;margin:12px 0 16px;letter-spacing:-0.025em">Nuestros proyectos</h1>
    <p style="font-size:16px;color:#374151;line-height:1.7;margin:0">Cada proyecto representa la colaboracion entre voluntarios, donantes y comunidades locales para crear cambios reales y duraderos.</p>
  </div>
</section>

<!-- PROYECTOS -->
<section style="padding:60px 24px 100px;background:white;${FS}">
  <div style="max-width:1100px;margin:0 auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(480px,1fr));gap:32px">

    <div style="background:#f0fdf4;border-radius:20px;padding:36px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px">
        <h3 style="font-size:20px;font-weight:800;color:#022c22;margin:0">Escuelas Comunitarias</h3>
        <span style="background:#065f46;color:white;font-size:11px;font-weight:700;padding:4px 12px;border-radius:999px;white-space:nowrap;margin-left:12px">Activo</span>
      </div>
      <p style="font-size:15px;color:#374151;line-height:1.7;margin:0 0 18px">Construccion y equipamiento de 12 aulas en zonas rurales de Oaxaca y Chiapas, incluyendo materiales, mobiliario y capacitacion docente.</p>
      <div style="font-size:14px;color:#065f46;font-weight:600;margin-bottom:12px">840 ninos beneficiados</div>
      <div style="background:#d1fae5;border-radius:999px;height:8px;overflow:hidden;margin-bottom:6px">
        <div style="background:#065f46;height:100%;width:72%"></div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:12px;color:#64748b">
        <span>72% completado</span><span>Meta: 2025</span>
      </div>
    </div>

    <div style="background:#f0fdf4;border-radius:20px;padding:36px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px">
        <h3 style="font-size:20px;font-weight:800;color:#022c22;margin:0">Acceso al Agua Potable</h3>
        <span style="background:#065f46;color:white;font-size:11px;font-weight:700;padding:4px 12px;border-radius:999px;white-space:nowrap;margin-left:12px">Activo</span>
      </div>
      <p style="font-size:15px;color:#374151;line-height:1.7;margin:0 0 18px">Instalacion de sistemas de captacion pluvial y filtros de purificacion en 45 comunidades sin acceso a red de distribucion de agua potable.</p>
      <div style="font-size:14px;color:#065f46;font-weight:600;margin-bottom:12px">3,200 familias impactadas</div>
      <div style="background:#d1fae5;border-radius:999px;height:8px;overflow:hidden;margin-bottom:6px">
        <div style="background:#065f46;height:100%;width:88%"></div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:12px;color:#64748b">
        <span>88% completado</span><span>Meta: 2025</span>
      </div>
    </div>

    <div style="background:#f0fdf4;border-radius:20px;padding:36px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px">
        <h3 style="font-size:20px;font-weight:800;color:#022c22;margin:0">Microempresas Rurales</h3>
        <span style="background:#fbbf24;color:#022c22;font-size:11px;font-weight:700;padding:4px 12px;border-radius:999px;white-space:nowrap;margin-left:12px">En progreso</span>
      </div>
      <p style="font-size:15px;color:#374151;line-height:1.7;margin:0 0 18px">Programa de capacitacion empresarial y microcreditos para mujeres emprendedoras en comunidades indigenas de 5 estados.</p>
      <div style="font-size:14px;color:#065f46;font-weight:600;margin-bottom:12px">560 mujeres emprendedoras</div>
      <div style="background:#d1fae5;border-radius:999px;height:8px;overflow:hidden;margin-bottom:6px">
        <div style="background:#fbbf24;height:100%;width:45%"></div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:12px;color:#64748b">
        <span>45% completado</span><span>Meta: 2026</span>
      </div>
    </div>

    <div style="background:#f0fdf4;border-radius:20px;padding:36px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px">
        <h3 style="font-size:20px;font-weight:800;color:#022c22;margin:0">Huertos Urbanos Comunitarios</h3>
        <span style="background:#d1fae5;color:#065f46;font-size:11px;font-weight:700;padding:4px 12px;border-radius:999px;white-space:nowrap;margin-left:12px">Completado</span>
      </div>
      <p style="font-size:15px;color:#374151;line-height:1.7;margin:0 0 18px">Creacion de 28 huertos urbanos en colonias de alta densidad para mejorar seguridad alimentaria y cohesion comunitaria.</p>
      <div style="font-size:14px;color:#065f46;font-weight:600;margin-bottom:12px">1,800 familias participantes</div>
      <div style="background:#d1fae5;border-radius:999px;height:8px;overflow:hidden;margin-bottom:6px">
        <div style="background:#065f46;height:100%;width:100%"></div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:12px;color:#64748b">
        <span>100% completado</span><span>Concluido 2024</span>
      </div>
    </div>

  </div>
</section>

<!-- FOOTER -->
<footer style="background:#022c22;border-top:1px solid rgba(255,255,255,0.08);color:rgba(255,255,255,0.65);padding:48px 40px;${FS}">
  <div style="max-width:1100px;margin:0 auto;display:grid;grid-template-columns:2fr 1fr 1fr;gap:48px">
    <div>
      <span style="font-size:18px;font-weight:800;color:white;display:block;margin-bottom:14px">FundacionEsperanza</span>
      <p style="font-size:14px;line-height:1.75;margin:0;max-width:300px">Organizacion sin fines de lucro comprometida con el desarrollo humano sostenible en comunidades vulnerables.</p>
    </div>
    <div>
      <h4 style="color:white;font-size:13px;font-weight:700;margin:0 0 16px;text-transform:uppercase;letter-spacing:0.08em">Paginas</h4>
      <ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:10px">
        <li><a href="/mision" style="color:rgba(255,255,255,0.65);text-decoration:none;font-size:14px">Mision</a></li>
        <li><a href="/proyectos" style="color:rgba(255,255,255,0.65);text-decoration:none;font-size:14px">Proyectos</a></li>
        <li><a href="/voluntarios" style="color:rgba(255,255,255,0.65);text-decoration:none;font-size:14px">Voluntarios</a></li>
        <li><a href="/donaciones" style="color:rgba(255,255,255,0.65);text-decoration:none;font-size:14px">Donaciones</a></li>
        <li><a href="/contacto" style="color:rgba(255,255,255,0.65);text-decoration:none;font-size:14px">Contacto</a></li>
      </ul>
    </div>
    <div>
      <h4 style="color:white;font-size:13px;font-weight:700;margin:0 0 16px;text-transform:uppercase;letter-spacing:0.08em">Contacto</h4>
      <div style="display:flex;flex-direction:column;gap:10px;font-size:14px">
        <span>Calle 5 de Mayo 200, CDMX</span>
        <span>Tel: (55) 3333-0000</span>
        <span>contacto@fundacionesperanza.org</span>
      </div>
    </div>
  </div>
  <div style="max-width:1100px;margin:32px auto 0;padding-top:24px;border-top:1px solid rgba(255,255,255,0.1);text-align:center;font-size:13px">
    &copy; 2025 FundacionEsperanza. Todos los derechos reservados.
  </div>
</footer>
`,
    },
    {
      id: 'voluntarios',
      label: 'Voluntarios',
      routePath: '/voluntarios',
      title: 'Ser Voluntario',
      required: false,
      css: '',
      html: `
<!-- NAV -->
<nav style="background:white;border-bottom:1px solid #d1fae5;padding:0 40px;height:68px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100;${FS}">
  <span style="font-size:20px;font-weight:800;color:#065f46;letter-spacing:-0.02em">FundacionEsperanza</span>
  <div style="display:flex;gap:28px;align-items:center">
    <a href="/" style="color:#374151;text-decoration:none;font-size:14px;font-weight:500">Inicio</a>
    <a href="/mision" style="color:#374151;text-decoration:none;font-size:14px;font-weight:500">Mision</a>
    <a href="/proyectos" style="color:#374151;text-decoration:none;font-size:14px;font-weight:500">Proyectos</a>
    <a href="/donaciones" style="color:#374151;text-decoration:none;font-size:14px;font-weight:500">Donaciones</a>
    <a href="/contacto" style="color:#374151;text-decoration:none;font-size:14px;font-weight:500">Contacto</a>
    <a href="/acceso" style="color:#374151;text-decoration:none;font-size:14px;font-weight:500">Iniciar sesion</a>
    <a href="/donaciones" style="background:#065f46;color:white;text-decoration:none;font-size:14px;font-weight:600;padding:10px 24px;border-radius:8px">Donar ahora</a>
  </div>
</nav>

<!-- POR QUE SER VOLUNTARIO -->
<section style="padding:80px 24px;background:#f0fdf4;${FS}">
  <div style="max-width:1100px;margin:0 auto;text-align:center">
    <span style="color:#065f46;font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase">Suma tu energia</span>
    <h1 style="font-size:clamp(30px,4.5vw,52px);font-weight:800;color:#022c22;margin:12px 0 20px;letter-spacing:-0.025em">Se parte del cambio</h1>
    <p style="font-size:17px;color:#374151;line-height:1.75;margin:0 auto 56px;max-width:600px">El voluntariado es una de las formas mas poderosas de contribuir al bienestar colectivo. Tu tiempo y habilidades pueden transformar vidas.</p>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:24px">
      <div style="background:white;border-radius:18px;padding:32px">
        <div style="width:48px;height:48px;background:#065f46;border-radius:12px;display:flex;align-items:center;justify-content:center;color:white;font-size:18px;font-weight:800;margin:0 auto 16px">I</div>
        <h3 style="font-size:17px;font-weight:700;color:#022c22;margin:0 0 10px">Impacto real</h3>
        <p style="font-size:14px;color:#374151;line-height:1.7;margin:0">Tu trabajo llega directamente a las comunidades. Veras el cambio que generates con tus propias manos.</p>
      </div>
      <div style="background:white;border-radius:18px;padding:32px">
        <div style="width:48px;height:48px;background:#065f46;border-radius:12px;display:flex;align-items:center;justify-content:center;color:white;font-size:18px;font-weight:800;margin:0 auto 16px">A</div>
        <h3 style="font-size:17px;font-weight:700;color:#022c22;margin:0 0 10px">Aprende y crece</h3>
        <p style="font-size:14px;color:#374151;line-height:1.7;margin:0">Desarrolla habilidades de liderazgo, trabajo en equipo y gestion de proyectos sociales en entornos reales.</p>
      </div>
      <div style="background:white;border-radius:18px;padding:32px">
        <div style="width:48px;height:48px;background:#065f46;border-radius:12px;display:flex;align-items:center;justify-content:center;color:white;font-size:18px;font-weight:800;margin:0 auto 16px">C</div>
        <h3 style="font-size:17px;font-weight:700;color:#022c22;margin:0 0 10px">Comunidad global</h3>
        <p style="font-size:14px;color:#374151;line-height:1.7;margin:0">Conecta con personas comprometidas de todo el mundo que comparten tu vision de un futuro mejor.</p>
      </div>
    </div>
  </div>
</section>

<!-- FORMULARIO DE VOLUNTARIADO -->
<section style="padding:80px 24px 100px;background:white;${FS}">
  <div style="max-width:680px;margin:0 auto">
    <h2 style="font-size:clamp(24px,3.5vw,38px);font-weight:800;color:#022c22;margin:0 0 36px;text-align:center;letter-spacing:-0.025em">Registrate como voluntario</h2>
    <form style="display:flex;flex-direction:column;gap:20px">
      <div>
        <label style="display:block;font-size:14px;font-weight:600;color:#022c22;margin-bottom:8px">Nombre completo</label>
        <input type="text" placeholder="Tu nombre" style="width:100%;background:#f0fdf4;border:1px solid #d1fae5;border-radius:10px;padding:13px 16px;font-size:15px;outline:none;box-sizing:border-box">
      </div>
      <div>
        <label style="display:block;font-size:14px;font-weight:600;color:#022c22;margin-bottom:8px">Correo electronico</label>
        <input type="email" placeholder="tu@correo.com" style="width:100%;background:#f0fdf4;border:1px solid #d1fae5;border-radius:10px;padding:13px 16px;font-size:15px;outline:none;box-sizing:border-box">
      </div>
      <div>
        <label style="display:block;font-size:14px;font-weight:600;color:#022c22;margin-bottom:8px">Habilidades e intereses</label>
        <textarea placeholder="Cuantanos sobre tu experiencia, habilidades o areas en las que te gustaria contribuir..." rows="4" style="width:100%;background:#f0fdf4;border:1px solid #d1fae5;border-radius:10px;padding:13px 16px;font-size:15px;outline:none;resize:vertical;box-sizing:border-box"></textarea>
      </div>
      <div>
        <label style="display:block;font-size:14px;font-weight:600;color:#022c22;margin-bottom:8px">Disponibilidad</label>
        <select style="width:100%;background:#f0fdf4;border:1px solid #d1fae5;border-radius:10px;padding:13px 16px;font-size:15px;outline:none;box-sizing:border-box;color:#022c22">
          <option value="">Selecciona tu disponibilidad</option>
          <option value="fines">Fines de semana</option>
          <option value="tardes">Tardes entre semana</option>
          <option value="completo">Tiempo completo (verano/sabbatico)</option>
          <option value="remoto">Solo en remoto</option>
        </select>
      </div>
      <button type="submit" style="background:#065f46;color:white;font-size:16px;font-weight:700;padding:15px;border-radius:10px;border:none;cursor:pointer">Quiero ser voluntario</button>
    </form>
  </div>
</section>

<!-- FOOTER -->
<footer style="background:#022c22;border-top:1px solid rgba(255,255,255,0.08);color:rgba(255,255,255,0.65);padding:48px 40px;${FS}">
  <div style="max-width:1100px;margin:0 auto;display:grid;grid-template-columns:2fr 1fr 1fr;gap:48px">
    <div>
      <span style="font-size:18px;font-weight:800;color:white;display:block;margin-bottom:14px">FundacionEsperanza</span>
      <p style="font-size:14px;line-height:1.75;margin:0;max-width:300px">Organizacion sin fines de lucro comprometida con el desarrollo humano sostenible en comunidades vulnerables.</p>
    </div>
    <div>
      <h4 style="color:white;font-size:13px;font-weight:700;margin:0 0 16px;text-transform:uppercase;letter-spacing:0.08em">Paginas</h4>
      <ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:10px">
        <li><a href="/mision" style="color:rgba(255,255,255,0.65);text-decoration:none;font-size:14px">Mision</a></li>
        <li><a href="/proyectos" style="color:rgba(255,255,255,0.65);text-decoration:none;font-size:14px">Proyectos</a></li>
        <li><a href="/voluntarios" style="color:rgba(255,255,255,0.65);text-decoration:none;font-size:14px">Voluntarios</a></li>
        <li><a href="/donaciones" style="color:rgba(255,255,255,0.65);text-decoration:none;font-size:14px">Donaciones</a></li>
        <li><a href="/contacto" style="color:rgba(255,255,255,0.65);text-decoration:none;font-size:14px">Contacto</a></li>
      </ul>
    </div>
    <div>
      <h4 style="color:white;font-size:13px;font-weight:700;margin:0 0 16px;text-transform:uppercase;letter-spacing:0.08em">Contacto</h4>
      <div style="display:flex;flex-direction:column;gap:10px;font-size:14px">
        <span>Calle 5 de Mayo 200, CDMX</span>
        <span>Tel: (55) 3333-0000</span>
        <span>contacto@fundacionesperanza.org</span>
      </div>
    </div>
  </div>
  <div style="max-width:1100px;margin:32px auto 0;padding-top:24px;border-top:1px solid rgba(255,255,255,0.1);text-align:center;font-size:13px">
    &copy; 2025 FundacionEsperanza. Todos los derechos reservados.
  </div>
</footer>
`,
    },
    {
      id: 'donaciones',
      label: 'Donaciones',
      routePath: '/donaciones',
      title: 'Donaciones',
      required: false,
      css: '',
      html: `
<!-- NAV -->
<nav style="background:white;border-bottom:1px solid #d1fae5;padding:0 40px;height:68px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100;${FS}">
  <span style="font-size:20px;font-weight:800;color:#065f46;letter-spacing:-0.02em">FundacionEsperanza</span>
  <div style="display:flex;gap:28px;align-items:center">
    <a href="/" style="color:#374151;text-decoration:none;font-size:14px;font-weight:500">Inicio</a>
    <a href="/mision" style="color:#374151;text-decoration:none;font-size:14px;font-weight:500">Mision</a>
    <a href="/proyectos" style="color:#374151;text-decoration:none;font-size:14px;font-weight:500">Proyectos</a>
    <a href="/voluntarios" style="color:#374151;text-decoration:none;font-size:14px;font-weight:500">Voluntarios</a>
    <a href="/contacto" style="color:#374151;text-decoration:none;font-size:14px;font-weight:500">Contacto</a>
    <a href="/acceso" style="color:#374151;text-decoration:none;font-size:14px;font-weight:500">Iniciar sesion</a>
    <a href="/donaciones" style="background:#065f46;color:white;text-decoration:none;font-size:14px;font-weight:600;padding:10px 24px;border-radius:8px">Donar ahora</a>
  </div>
</nav>

<!-- TIERS DE DONACION -->
<section style="padding:80px 24px;background:#f0fdf4;${FS}">
  <div style="max-width:1100px;margin:0 auto;text-align:center">
    <span style="color:#065f46;font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase">Haz la diferencia</span>
    <h1 style="font-size:clamp(30px,4.5vw,52px);font-weight:800;color:#022c22;margin:12px 0 16px;letter-spacing:-0.025em">Elige tu nivel de apoyo</h1>
    <p style="font-size:16px;color:#374151;line-height:1.7;margin:0 auto 56px;max-width:540px">Cada donacion, sin importar el monto, tiene un impacto concreto en la vida de miles de personas.</p>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:24px;margin-bottom:56px">

      <div style="background:white;border-radius:24px;padding:40px;text-align:left;border:2px solid #d1fae5">
        <div style="font-size:36px;font-weight:900;color:#065f46;margin-bottom:8px">$100</div>
        <div style="font-size:14px;color:#64748b;margin-bottom:20px">MXN / mes</div>
        <h3 style="font-size:18px;font-weight:700;color:#022c22;margin:0 0 12px">Amigo</h3>
        <p style="font-size:14px;color:#374151;line-height:1.7;margin:0 0 24px">Cubre materiales escolares para 1 nino durante un mes completo de clases.</p>
        <a href="#monto-libre" style="display:block;text-align:center;background:#f0fdf4;color:#065f46;font-size:15px;font-weight:700;padding:12px;border-radius:10px;text-decoration:none;border:2px solid #065f46">Seleccionar</a>
      </div>

      <div style="background:#065f46;border-radius:24px;padding:40px;text-align:left;position:relative">
        <div style="position:absolute;top:-14px;left:50%;transform:translateX(-50%);background:#fbbf24;color:#022c22;font-size:11px;font-weight:800;padding:5px 16px;border-radius:999px;white-space:nowrap">MAS POPULAR</div>
        <div style="font-size:36px;font-weight:900;color:#fbbf24;margin-bottom:8px">$500</div>
        <div style="font-size:14px;color:rgba(255,255,255,0.7);margin-bottom:20px">MXN / mes</div>
        <h3 style="font-size:18px;font-weight:700;color:white;margin:0 0 12px">Aliado</h3>
        <p style="font-size:14px;color:rgba(255,255,255,0.8);line-height:1.7;margin:0 0 24px">Garantiza agua potable para una familia durante un ano. Impacto directo y duradero.</p>
        <a href="#monto-libre" style="display:block;text-align:center;background:#fbbf24;color:#022c22;font-size:15px;font-weight:700;padding:12px;border-radius:10px;text-decoration:none">Seleccionar</a>
      </div>

      <div style="background:white;border-radius:24px;padding:40px;text-align:left;border:2px solid #d1fae5">
        <div style="font-size:36px;font-weight:900;color:#065f46;margin-bottom:8px">$1,000</div>
        <div style="font-size:14px;color:#64748b;margin-bottom:20px">MXN / mes</div>
        <h3 style="font-size:18px;font-weight:700;color:#022c22;margin:0 0 12px">Campeon</h3>
        <p style="font-size:14px;color:#374151;line-height:1.7;margin:0 0 24px">Financia el salario de un docente comunitario durante un mes completo. Educacion que transforma.</p>
        <a href="#monto-libre" style="display:block;text-align:center;background:#f0fdf4;color:#065f46;font-size:15px;font-weight:700;padding:12px;border-radius:10px;text-decoration:none;border:2px solid #065f46">Seleccionar</a>
      </div>

    </div>

    <div id="monto-libre" style="background:white;border-radius:20px;padding:36px;max-width:520px;margin:0 auto;text-align:left">
      <h3 style="font-size:18px;font-weight:700;color:#022c22;margin:0 0 20px;text-align:center">O elige tu monto</h3>
      <form style="display:flex;flex-direction:column;gap:16px">
        <input type="number" placeholder="Monto en MXN" min="10" style="width:100%;background:#f0fdf4;border:1px solid #d1fae5;border-radius:10px;padding:13px 16px;font-size:16px;outline:none;box-sizing:border-box">
        <button type="submit" style="background:#065f46;color:white;font-size:16px;font-weight:700;padding:15px;border-radius:10px;border:none;cursor:pointer">Donar ahora</button>
      </form>
    </div>
  </div>
</section>

<!-- TRANSPARENCIA -->
<section style="padding:80px 24px 100px;background:white;${FS}">
  <div style="max-width:800px;margin:0 auto;text-align:center">
    <h2 style="font-size:clamp(24px,3vw,36px);font-weight:800;color:#022c22;margin:0 0 16px;letter-spacing:-0.025em">Tu donacion esta protegida</h2>
    <p style="font-size:16px;color:#374151;line-height:1.75;margin:0 0 40px;max-width:600px;margin-left:auto;margin-right:auto">Publicamos informes anuales de impacto y estados financieros auditados. Cada peso donado esta destinado a programas, no a gastos administrativos superiores al 12%.</p>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:24px">
      <div style="background:#f0fdf4;border-radius:16px;padding:24px">
        <div style="font-size:28px;font-weight:900;color:#065f46;margin-bottom:6px">88%</div>
        <div style="font-size:13px;color:#374151;font-weight:600">Va a programas</div>
      </div>
      <div style="background:#f0fdf4;border-radius:16px;padding:24px">
        <div style="font-size:28px;font-weight:900;color:#065f46;margin-bottom:6px">100%</div>
        <div style="font-size:13px;color:#374151;font-weight:600">Auditado anualmente</div>
      </div>
      <div style="background:#f0fdf4;border-radius:16px;padding:24px">
        <div style="font-size:28px;font-weight:900;color:#065f46;margin-bottom:6px">15 anos</div>
        <div style="font-size:13px;color:#374151;font-weight:600">De transparencia</div>
      </div>
    </div>
  </div>
</section>

<!-- FOOTER -->
<footer style="background:#022c22;border-top:1px solid rgba(255,255,255,0.08);color:rgba(255,255,255,0.65);padding:48px 40px;${FS}">
  <div style="max-width:1100px;margin:0 auto;display:grid;grid-template-columns:2fr 1fr 1fr;gap:48px">
    <div>
      <span style="font-size:18px;font-weight:800;color:white;display:block;margin-bottom:14px">FundacionEsperanza</span>
      <p style="font-size:14px;line-height:1.75;margin:0;max-width:300px">Organizacion sin fines de lucro comprometida con el desarrollo humano sostenible en comunidades vulnerables.</p>
    </div>
    <div>
      <h4 style="color:white;font-size:13px;font-weight:700;margin:0 0 16px;text-transform:uppercase;letter-spacing:0.08em">Paginas</h4>
      <ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:10px">
        <li><a href="/mision" style="color:rgba(255,255,255,0.65);text-decoration:none;font-size:14px">Mision</a></li>
        <li><a href="/proyectos" style="color:rgba(255,255,255,0.65);text-decoration:none;font-size:14px">Proyectos</a></li>
        <li><a href="/voluntarios" style="color:rgba(255,255,255,0.65);text-decoration:none;font-size:14px">Voluntarios</a></li>
        <li><a href="/donaciones" style="color:rgba(255,255,255,0.65);text-decoration:none;font-size:14px">Donaciones</a></li>
        <li><a href="/contacto" style="color:rgba(255,255,255,0.65);text-decoration:none;font-size:14px">Contacto</a></li>
      </ul>
    </div>
    <div>
      <h4 style="color:white;font-size:13px;font-weight:700;margin:0 0 16px;text-transform:uppercase;letter-spacing:0.08em">Contacto</h4>
      <div style="display:flex;flex-direction:column;gap:10px;font-size:14px">
        <span>Calle 5 de Mayo 200, CDMX</span>
        <span>Tel: (55) 3333-0000</span>
        <span>contacto@fundacionesperanza.org</span>
      </div>
    </div>
  </div>
  <div style="max-width:1100px;margin:32px auto 0;padding-top:24px;border-top:1px solid rgba(255,255,255,0.1);text-align:center;font-size:13px">
    &copy; 2025 FundacionEsperanza. Todos los derechos reservados.
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
<nav style="background:white;border-bottom:1px solid #d1fae5;padding:0 40px;height:68px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100;${FS}">
  <span style="font-size:20px;font-weight:800;color:#065f46;letter-spacing:-0.02em">FundacionEsperanza</span>
  <div style="display:flex;gap:28px;align-items:center">
    <a href="/" style="color:#374151;text-decoration:none;font-size:14px;font-weight:500">Inicio</a>
    <a href="/mision" style="color:#374151;text-decoration:none;font-size:14px;font-weight:500">Mision</a>
    <a href="/proyectos" style="color:#374151;text-decoration:none;font-size:14px;font-weight:500">Proyectos</a>
    <a href="/voluntarios" style="color:#374151;text-decoration:none;font-size:14px;font-weight:500">Voluntarios</a>
    <a href="/donaciones" style="color:#374151;text-decoration:none;font-size:14px;font-weight:500">Donaciones</a>
    <a href="/acceso" style="color:#374151;text-decoration:none;font-size:14px;font-weight:500">Iniciar sesion</a>
    <a href="/donaciones" style="background:#065f46;color:white;text-decoration:none;font-size:14px;font-weight:600;padding:10px 24px;border-radius:8px">Donar ahora</a>
  </div>
</nav>

<!-- CONTACTO -->
<section style="padding:80px 24px 100px;background:white;${FS}">
  <div style="max-width:1100px;margin:0 auto;display:grid;grid-template-columns:1fr 1.3fr;gap:72px">
    <div>
      <span style="color:#065f46;font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase">Hablemos</span>
      <h1 style="font-size:clamp(28px,4vw,44px);font-weight:800;color:#022c22;margin:14px 0 28px;letter-spacing:-0.025em">Ponerse en contacto</h1>
      <div style="display:flex;flex-direction:column;gap:22px">
        <div style="display:flex;gap:16px;align-items:flex-start">
          <div style="width:44px;height:44px;background:#f0fdf4;border-radius:10px;display:flex;align-items:center;justify-content:center;color:#065f46;font-size:16px;font-weight:800;flex-shrink:0">U</div>
          <div>
            <div style="font-size:14px;font-weight:700;color:#022c22;margin-bottom:4px">Ubicacion</div>
            <div style="font-size:14px;color:#374151;line-height:1.6">Calle 5 de Mayo 200<br>Col. Centro, CDMX, Mexico</div>
          </div>
        </div>
        <div style="display:flex;gap:16px;align-items:flex-start">
          <div style="width:44px;height:44px;background:#f0fdf4;border-radius:10px;display:flex;align-items:center;justify-content:center;color:#065f46;font-size:16px;font-weight:800;flex-shrink:0">T</div>
          <div>
            <div style="font-size:14px;font-weight:700;color:#022c22;margin-bottom:4px">Telefono</div>
            <div style="font-size:14px;color:#374151">(55) 3333-0000</div>
          </div>
        </div>
        <div style="display:flex;gap:16px;align-items:flex-start">
          <div style="width:44px;height:44px;background:#f0fdf4;border-radius:10px;display:flex;align-items:center;justify-content:center;color:#065f46;font-size:16px;font-weight:800;flex-shrink:0">@</div>
          <div>
            <div style="font-size:14px;font-weight:700;color:#022c22;margin-bottom:4px">Correo</div>
            <div style="font-size:14px;color:#374151">contacto@fundacionesperanza.org</div>
          </div>
        </div>
      </div>
    </div>
    <div style="background:#f0fdf4;border-radius:24px;padding:40px">
      <h2 style="font-size:20px;font-weight:800;color:#022c22;margin:0 0 28px">Envianos un mensaje</h2>
      <form style="display:flex;flex-direction:column;gap:18px">
        <div>
          <label style="display:block;font-size:14px;font-weight:600;color:#022c22;margin-bottom:8px">Nombre</label>
          <input type="text" placeholder="Tu nombre completo" style="width:100%;background:white;border:1px solid #d1fae5;border-radius:10px;padding:13px 16px;font-size:15px;outline:none;box-sizing:border-box">
        </div>
        <div>
          <label style="display:block;font-size:14px;font-weight:600;color:#022c22;margin-bottom:8px">Correo electronico</label>
          <input type="email" placeholder="tu@correo.com" style="width:100%;background:white;border:1px solid #d1fae5;border-radius:10px;padding:13px 16px;font-size:15px;outline:none;box-sizing:border-box">
        </div>
        <div>
          <label style="display:block;font-size:14px;font-weight:600;color:#022c22;margin-bottom:8px">Mensaje</label>
          <textarea placeholder="Tu consulta, propuesta de alianza o comentario..." rows="5" style="width:100%;background:white;border:1px solid #d1fae5;border-radius:10px;padding:13px 16px;font-size:15px;outline:none;resize:vertical;box-sizing:border-box"></textarea>
        </div>
        <button type="submit" style="background:#065f46;color:white;font-size:16px;font-weight:700;padding:15px;border-radius:10px;border:none;cursor:pointer">Enviar mensaje</button>
      </form>
    </div>
  </div>
</section>

<!-- FOOTER -->
<footer style="background:#022c22;border-top:1px solid rgba(255,255,255,0.08);color:rgba(255,255,255,0.65);padding:48px 40px;${FS}">
  <div style="max-width:1100px;margin:0 auto;display:grid;grid-template-columns:2fr 1fr 1fr;gap:48px">
    <div>
      <span style="font-size:18px;font-weight:800;color:white;display:block;margin-bottom:14px">FundacionEsperanza</span>
      <p style="font-size:14px;line-height:1.75;margin:0;max-width:300px">Organizacion sin fines de lucro comprometida con el desarrollo humano sostenible en comunidades vulnerables.</p>
    </div>
    <div>
      <h4 style="color:white;font-size:13px;font-weight:700;margin:0 0 16px;text-transform:uppercase;letter-spacing:0.08em">Paginas</h4>
      <ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:10px">
        <li><a href="/mision" style="color:rgba(255,255,255,0.65);text-decoration:none;font-size:14px">Mision</a></li>
        <li><a href="/proyectos" style="color:rgba(255,255,255,0.65);text-decoration:none;font-size:14px">Proyectos</a></li>
        <li><a href="/voluntarios" style="color:rgba(255,255,255,0.65);text-decoration:none;font-size:14px">Voluntarios</a></li>
        <li><a href="/donaciones" style="color:rgba(255,255,255,0.65);text-decoration:none;font-size:14px">Donaciones</a></li>
        <li><a href="/contacto" style="color:rgba(255,255,255,0.65);text-decoration:none;font-size:14px">Contacto</a></li>
      </ul>
    </div>
    <div>
      <h4 style="color:white;font-size:13px;font-weight:700;margin:0 0 16px;text-transform:uppercase;letter-spacing:0.08em">Contacto</h4>
      <div style="display:flex;flex-direction:column;gap:10px;font-size:14px">
        <span>Calle 5 de Mayo 200, CDMX</span>
        <span>Tel: (55) 3333-0000</span>
        <span>contacto@fundacionesperanza.org</span>
      </div>
    </div>
  </div>
  <div style="max-width:1100px;margin:32px auto 0;padding-top:24px;border-top:1px solid rgba(255,255,255,0.1);text-align:center;font-size:13px">
    &copy; 2025 FundacionEsperanza. Todos los derechos reservados.
  </div>
</footer>
`,
    },
  ],
}
