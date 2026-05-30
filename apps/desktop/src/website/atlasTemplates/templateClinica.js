const FS = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"

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
      css: '',
      html: `
<!-- NAV -->
<nav style="background:white;border-bottom:1px solid #e0f2fe;padding:0 40px;height:68px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100;${FS}">
  <div style="display:flex;align-items:center;gap:10px">
    <div style="width:34px;height:34px;background:#0e7490;border-radius:8px;display:flex;align-items:center;justify-content:center;color:white;font-size:20px;font-weight:300;line-height:1">+</div>
    <span style="font-size:19px;font-weight:700;color:#0c4a6e;letter-spacing:-0.02em">ClinicaNombre</span>
  </div>
  <div style="display:flex;gap:28px;align-items:center">
    <a href="/especialidades" style="color:#374151;text-decoration:none;font-size:14px;font-weight:500">Especialidades</a>
    <a href="/equipo" style="color:#374151;text-decoration:none;font-size:14px;font-weight:500">Equipo</a>
    <a href="/citas" style="color:#374151;text-decoration:none;font-size:14px;font-weight:500">Citas</a>
    <a href="/contacto" style="color:#374151;text-decoration:none;font-size:14px;font-weight:500">Contacto</a>
    <a href="/acceso" style="color:#374151;text-decoration:none;font-size:14px;font-weight:500">Iniciar sesion</a>
    <a href="/citas" style="background:#0e7490;color:white;text-decoration:none;font-size:14px;font-weight:600;padding:10px 24px;border-radius:8px">Agendar cita</a>
  </div>
</nav>

<!-- HERO -->
<section style="background:linear-gradient(135deg,#0c4a6e 0%,#0e7490 100%);padding:100px 24px 80px;${FS}">
  <div style="max-width:1100px;margin:0 auto;text-align:center">
    <div style="display:inline-block;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.25);border-radius:999px;padding:6px 20px;margin-bottom:28px">
      <span style="color:#bae6fd;font-size:13px;font-weight:600;letter-spacing:0.08em">Centro medico especializado</span>
    </div>
    <h1 style="font-size:clamp(38px,5.5vw,68px);font-weight:800;color:white;line-height:1.1;margin:0 0 22px;letter-spacing:-0.03em">Tu salud, nuestra prioridad</h1>
    <p style="font-size:18px;color:rgba(255,255,255,0.85);line-height:1.75;margin:0 auto 44px;max-width:580px">Atendemos a nuestros pacientes con excelencia clinica, tecnologia avanzada y un equipo de especialistas comprometidos con tu bienestar.</p>
    <div style="display:flex;gap:16px;justify-content:center;flex-wrap:wrap;margin-bottom:72px">
      <a href="/citas" style="background:white;color:#0e7490;font-size:16px;font-weight:700;padding:15px 40px;border-radius:10px;text-decoration:none">Agendar cita</a>
      <a href="/especialidades" style="background:rgba(255,255,255,0.12);color:white;font-size:16px;font-weight:600;padding:15px 40px;border-radius:10px;text-decoration:none;border:2px solid rgba(255,255,255,0.3)">Ver especialidades</a>
    </div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:2px;background:rgba(255,255,255,0.12);border-radius:16px;overflow:hidden;max-width:720px;margin:0 auto">
      <div style="background:rgba(255,255,255,0.08);padding:28px 16px;text-align:center">
        <div style="font-size:32px;font-weight:900;color:white;margin-bottom:4px">15+</div>
        <div style="font-size:13px;color:#bae6fd;font-weight:500">Especialidades</div>
      </div>
      <div style="background:rgba(255,255,255,0.08);padding:28px 16px;text-align:center">
        <div style="font-size:32px;font-weight:900;color:white;margin-bottom:4px">25</div>
        <div style="font-size:13px;color:#bae6fd;font-weight:500">Medicos</div>
      </div>
      <div style="background:rgba(255,255,255,0.08);padding:28px 16px;text-align:center">
        <div style="font-size:32px;font-weight:900;color:white;margin-bottom:4px">10k+</div>
        <div style="font-size:13px;color:#bae6fd;font-weight:500">Pacientes</div>
      </div>
      <div style="background:rgba(255,255,255,0.08);padding:28px 16px;text-align:center">
        <div style="font-size:32px;font-weight:900;color:white;margin-bottom:4px">20</div>
        <div style="font-size:13px;color:#bae6fd;font-weight:500">Anos</div>
      </div>
    </div>
  </div>
</section>

<!-- POR QUE ELEGIRNOS -->
<section style="padding:100px 24px;background:white;${FS}">
  <div style="max-width:1100px;margin:0 auto">
    <div style="text-align:center;margin-bottom:64px">
      <span style="color:#0e7490;font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase">Por que elegirnos</span>
      <h2 style="font-size:clamp(28px,4vw,44px);font-weight:800;color:#0c4a6e;margin:14px 0 16px;letter-spacing:-0.025em">Comprometidos con tu bienestar</h2>
      <p style="font-size:17px;color:#64748b;max-width:520px;margin:0 auto;line-height:1.7">Combinamos tecnologia de vanguardia con un trato humano y cercano para ofrecerte la mejor atencion medica.</p>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:28px">
      <div style="background:#f0f9ff;border-radius:20px;padding:36px">
        <div style="width:52px;height:52px;background:#0e7490;border-radius:14px;display:flex;align-items:center;justify-content:center;color:white;font-size:20px;font-weight:800;margin-bottom:20px">I</div>
        <h3 style="font-size:19px;font-weight:700;color:#0c4a6e;margin:0 0 12px">Instalaciones modernas</h3>
        <p style="font-size:15px;color:#475569;line-height:1.7;margin:0">Contamos con equipamiento de ultima generacion y espacios disenados para la comodidad del paciente.</p>
      </div>
      <div style="background:#f0f9ff;border-radius:20px;padding:36px">
        <div style="width:52px;height:52px;background:#0e7490;border-radius:14px;display:flex;align-items:center;justify-content:center;color:white;font-size:20px;font-weight:800;margin-bottom:20px">E</div>
        <h3 style="font-size:19px;font-weight:700;color:#0c4a6e;margin:0 0 12px">Especialistas certificados</h3>
        <p style="font-size:15px;color:#475569;line-height:1.7;margin:0">Nuestro equipo medico cuenta con certificaciones nacionales e internacionales y amplia experiencia clinica.</p>
      </div>
      <div style="background:#f0f9ff;border-radius:20px;padding:36px">
        <div style="width:52px;height:52px;background:#0e7490;border-radius:14px;display:flex;align-items:center;justify-content:center;color:white;font-size:20px;font-weight:800;margin-bottom:20px">C</div>
        <h3 style="font-size:19px;font-weight:700;color:#0c4a6e;margin:0 0 12px">Citas rapidas</h3>
        <p style="font-size:15px;color:#475569;line-height:1.7;margin:0">Agenda tu consulta en minutos por telefono o en linea. Minimos tiempos de espera y atencion puntual.</p>
      </div>
    </div>
  </div>
</section>

<!-- FOOTER -->
<footer style="background:#0c4a6e;color:rgba(255,255,255,0.7);padding:48px 40px;${FS}">
  <div style="max-width:1100px;margin:0 auto;display:grid;grid-template-columns:2fr 1fr 1fr;gap:48px">
    <div>
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
        <div style="width:32px;height:32px;background:rgba(255,255,255,0.15);border-radius:7px;display:flex;align-items:center;justify-content:center;color:white;font-size:18px;font-weight:300">+</div>
        <span style="font-size:17px;font-weight:700;color:white">ClinicaNombre</span>
      </div>
      <p style="font-size:14px;line-height:1.75;margin:0;max-width:300px">Centro medico especializado dedicado a brindar atencion de calidad con calidez humana.</p>
    </div>
    <div>
      <h4 style="color:white;font-size:14px;font-weight:700;margin:0 0 18px;text-transform:uppercase;letter-spacing:0.08em">Servicios</h4>
      <ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:10px">
        <li><a href="/especialidades" style="color:rgba(255,255,255,0.7);text-decoration:none;font-size:14px">Especialidades</a></li>
        <li><a href="/equipo" style="color:rgba(255,255,255,0.7);text-decoration:none;font-size:14px">Equipo medico</a></li>
        <li><a href="/citas" style="color:rgba(255,255,255,0.7);text-decoration:none;font-size:14px">Agendar cita</a></li>
        <li><a href="/contacto" style="color:rgba(255,255,255,0.7);text-decoration:none;font-size:14px">Contacto</a></li>
      </ul>
    </div>
    <div>
      <h4 style="color:white;font-size:14px;font-weight:700;margin:0 0 18px;text-transform:uppercase;letter-spacing:0.08em">Contacto</h4>
      <div style="display:flex;flex-direction:column;gap:10px;font-size:14px">
        <span>Av. Principal 123, Ciudad</span>
        <span>Tel: (55) 1234-5678</span>
        <span>info@clinicanombre.com</span>
        <span>Lun-Vie 8:00 - 20:00</span>
      </div>
    </div>
  </div>
  <div style="max-width:1100px;margin:32px auto 0;padding-top:24px;border-top:1px solid rgba(255,255,255,0.12);text-align:center;font-size:13px">
    &copy; 2025 ClinicaNombre. Todos los derechos reservados.
  </div>
</footer>
`,
    },
    {
      id: 'especialidades',
      label: 'Especialidades',
      routePath: '/especialidades',
      title: 'Especialidades Medicas',
      required: false,
      css: '',
      html: `
<!-- NAV -->
<nav style="background:white;border-bottom:1px solid #e0f2fe;padding:0 40px;height:68px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100;${FS}">
  <div style="display:flex;align-items:center;gap:10px">
    <div style="width:34px;height:34px;background:#0e7490;border-radius:8px;display:flex;align-items:center;justify-content:center;color:white;font-size:20px;font-weight:300;line-height:1">+</div>
    <span style="font-size:19px;font-weight:700;color:#0c4a6e;letter-spacing:-0.02em">ClinicaNombre</span>
  </div>
  <div style="display:flex;gap:28px;align-items:center">
    <a href="/" style="color:#374151;text-decoration:none;font-size:14px;font-weight:500">Inicio</a>
    <a href="/equipo" style="color:#374151;text-decoration:none;font-size:14px;font-weight:500">Equipo</a>
    <a href="/citas" style="color:#374151;text-decoration:none;font-size:14px;font-weight:500">Citas</a>
    <a href="/contacto" style="color:#374151;text-decoration:none;font-size:14px;font-weight:500">Contacto</a>
    <a href="/acceso" style="color:#374151;text-decoration:none;font-size:14px;font-weight:500">Iniciar sesion</a>
    <a href="/citas" style="background:#0e7490;color:white;text-decoration:none;font-size:14px;font-weight:600;padding:10px 24px;border-radius:8px">Agendar cita</a>
  </div>
</nav>

<!-- ENCABEZADO -->
<section style="background:#f0f9ff;padding:64px 40px;${FS}">
  <div style="max-width:1100px;margin:0 auto;text-align:center">
    <span style="color:#0e7490;font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase">Centro medico</span>
    <h1 style="font-size:clamp(30px,4.5vw,50px);font-weight:800;color:#0c4a6e;margin:12px 0 16px;letter-spacing:-0.025em">Especialidades medicas</h1>
    <p style="font-size:17px;color:#64748b;max-width:560px;margin:0 auto;line-height:1.7">Contamos con un amplio equipo de especialistas en las principales ramas de la medicina para atender todas tus necesidades de salud.</p>
  </div>
</section>

<!-- GRID DE ESPECIALIDADES -->
<section style="padding:72px 40px;background:white;${FS}">
  <div style="max-width:1100px;margin:0 auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:24px">

    <div style="background:white;border:2px solid #bae6fd;border-radius:16px;padding:32px 24px;text-align:center;transition:box-shadow 0.2s">
      <div style="width:56px;height:56px;background:#0e7490;border-radius:14px;display:flex;align-items:center;justify-content:center;color:white;font-size:22px;font-weight:800;margin:0 auto 18px">Ca</div>
      <h3 style="font-size:17px;font-weight:700;color:#0c4a6e;margin:0 0 8px">Cardiologia</h3>
      <p style="font-size:13px;color:#64748b;line-height:1.65;margin:0">Diagnostico y tratamiento de enfermedades del corazon y sistema cardiovascular.</p>
    </div>

    <div style="background:white;border:2px solid #bae6fd;border-radius:16px;padding:32px 24px;text-align:center">
      <div style="width:56px;height:56px;background:#0e7490;border-radius:14px;display:flex;align-items:center;justify-content:center;color:white;font-size:22px;font-weight:800;margin:0 auto 18px">Ne</div>
      <h3 style="font-size:17px;font-weight:700;color:#0c4a6e;margin:0 0 8px">Neurologia</h3>
      <p style="font-size:13px;color:#64748b;line-height:1.65;margin:0">Atencion integral del sistema nervioso central y periferico.</p>
    </div>

    <div style="background:white;border:2px solid #bae6fd;border-radius:16px;padding:32px 24px;text-align:center">
      <div style="width:56px;height:56px;background:#0e7490;border-radius:14px;display:flex;align-items:center;justify-content:center;color:white;font-size:22px;font-weight:800;margin:0 auto 18px">Od</div>
      <h3 style="font-size:17px;font-weight:700;color:#0c4a6e;margin:0 0 8px">Odontologia</h3>
      <p style="font-size:13px;color:#64748b;line-height:1.65;margin:0">Salud bucodental completa: prevencion, estetica y cirugia dental.</p>
    </div>

    <div style="background:white;border:2px solid #bae6fd;border-radius:16px;padding:32px 24px;text-align:center">
      <div style="width:56px;height:56px;background:#0e7490;border-radius:14px;display:flex;align-items:center;justify-content:center;color:white;font-size:22px;font-weight:800;margin:0 auto 18px">Of</div>
      <h3 style="font-size:17px;font-weight:700;color:#0c4a6e;margin:0 0 8px">Oftalmologia</h3>
      <p style="font-size:13px;color:#64748b;line-height:1.65;margin:0">Cuidado y tratamiento de la salud visual con tecnologia de punta.</p>
    </div>

    <div style="background:white;border:2px solid #bae6fd;border-radius:16px;padding:32px 24px;text-align:center">
      <div style="width:56px;height:56px;background:#0e7490;border-radius:14px;display:flex;align-items:center;justify-content:center;color:white;font-size:22px;font-weight:800;margin:0 auto 18px">Or</div>
      <h3 style="font-size:17px;font-weight:700;color:#0c4a6e;margin:0 0 8px">Ortopedia</h3>
      <p style="font-size:13px;color:#64748b;line-height:1.65;margin:0">Tratamiento de lesiones y enfermedades del aparato locomotor.</p>
    </div>

    <div style="background:white;border:2px solid #bae6fd;border-radius:16px;padding:32px 24px;text-align:center">
      <div style="width:56px;height:56px;background:#0e7490;border-radius:14px;display:flex;align-items:center;justify-content:center;color:white;font-size:22px;font-weight:800;margin:0 auto 18px">Gi</div>
      <h3 style="font-size:17px;font-weight:700;color:#0c4a6e;margin:0 0 8px">Ginecologia</h3>
      <p style="font-size:13px;color:#64748b;line-height:1.65;margin:0">Salud integral de la mujer en todas las etapas de su vida.</p>
    </div>

    <div style="background:white;border:2px solid #bae6fd;border-radius:16px;padding:32px 24px;text-align:center">
      <div style="width:56px;height:56px;background:#0e7490;border-radius:14px;display:flex;align-items:center;justify-content:center;color:white;font-size:22px;font-weight:800;margin:0 auto 18px">Pe</div>
      <h3 style="font-size:17px;font-weight:700;color:#0c4a6e;margin:0 0 8px">Pediatria</h3>
      <p style="font-size:13px;color:#64748b;line-height:1.65;margin:0">Atencion medica especializada para ninos y adolescentes.</p>
    </div>

    <div style="background:white;border:2px solid #bae6fd;border-radius:16px;padding:32px 24px;text-align:center">
      <div style="width:56px;height:56px;background:#0e7490;border-radius:14px;display:flex;align-items:center;justify-content:center;color:white;font-size:22px;font-weight:800;margin:0 auto 18px">MG</div>
      <h3 style="font-size:17px;font-weight:700;color:#0c4a6e;margin:0 0 8px">Medicina general</h3>
      <p style="font-size:13px;color:#64748b;line-height:1.65;margin:0">Consulta general, prevencion y seguimiento de pacientes de todas las edades.</p>
    </div>

  </div>
</section>

<!-- CTA -->
<section style="background:#f0f9ff;padding:72px 40px;text-align:center;${FS}">
  <div style="max-width:600px;margin:0 auto">
    <h2 style="font-size:clamp(24px,3.5vw,38px);font-weight:800;color:#0c4a6e;margin:0 0 16px">Lista para agendar tu cita?</h2>
    <p style="font-size:16px;color:#64748b;line-height:1.7;margin:0 0 32px">Nuestros especialistas estan disponibles para atenderte. Reserva tu consulta de forma rapida y sencilla.</p>
    <a href="/citas" style="background:#0e7490;color:white;font-size:16px;font-weight:700;padding:15px 40px;border-radius:10px;text-decoration:none;display:inline-block">Agendar cita ahora</a>
  </div>
</section>

<!-- FOOTER -->
<footer style="background:#0c4a6e;color:rgba(255,255,255,0.7);padding:48px 40px;${FS}">
  <div style="max-width:1100px;margin:0 auto;display:grid;grid-template-columns:2fr 1fr 1fr;gap:48px">
    <div>
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
        <div style="width:32px;height:32px;background:rgba(255,255,255,0.15);border-radius:7px;display:flex;align-items:center;justify-content:center;color:white;font-size:18px;font-weight:300">+</div>
        <span style="font-size:17px;font-weight:700;color:white">ClinicaNombre</span>
      </div>
      <p style="font-size:14px;line-height:1.75;margin:0;max-width:300px">Centro medico especializado dedicado a brindar atencion de calidad con calidez humana.</p>
    </div>
    <div>
      <h4 style="color:white;font-size:14px;font-weight:700;margin:0 0 18px;text-transform:uppercase;letter-spacing:0.08em">Servicios</h4>
      <ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:10px">
        <li><a href="/especialidades" style="color:rgba(255,255,255,0.7);text-decoration:none;font-size:14px">Especialidades</a></li>
        <li><a href="/equipo" style="color:rgba(255,255,255,0.7);text-decoration:none;font-size:14px">Equipo medico</a></li>
        <li><a href="/citas" style="color:rgba(255,255,255,0.7);text-decoration:none;font-size:14px">Agendar cita</a></li>
        <li><a href="/contacto" style="color:rgba(255,255,255,0.7);text-decoration:none;font-size:14px">Contacto</a></li>
      </ul>
    </div>
    <div>
      <h4 style="color:white;font-size:14px;font-weight:700;margin:0 0 18px;text-transform:uppercase;letter-spacing:0.08em">Contacto</h4>
      <div style="display:flex;flex-direction:column;gap:10px;font-size:14px">
        <span>Av. Principal 123, Ciudad</span>
        <span>Tel: (55) 1234-5678</span>
        <span>info@clinicanombre.com</span>
        <span>Lun-Vie 8:00 - 20:00</span>
      </div>
    </div>
  </div>
  <div style="max-width:1100px;margin:32px auto 0;padding-top:24px;border-top:1px solid rgba(255,255,255,0.12);text-align:center;font-size:13px">
    &copy; 2025 ClinicaNombre. Todos los derechos reservados.
  </div>
</footer>
`,
    },
    {
      id: 'equipo',
      label: 'Equipo medico',
      routePath: '/equipo',
      title: 'Nuestro Equipo Medico',
      required: false,
      css: '',
      html: `
<!-- NAV -->
<nav style="background:white;border-bottom:1px solid #e0f2fe;padding:0 40px;height:68px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100;${FS}">
  <div style="display:flex;align-items:center;gap:10px">
    <div style="width:34px;height:34px;background:#0e7490;border-radius:8px;display:flex;align-items:center;justify-content:center;color:white;font-size:20px;font-weight:300;line-height:1">+</div>
    <span style="font-size:19px;font-weight:700;color:#0c4a6e;letter-spacing:-0.02em">ClinicaNombre</span>
  </div>
  <div style="display:flex;gap:28px;align-items:center">
    <a href="/" style="color:#374151;text-decoration:none;font-size:14px;font-weight:500">Inicio</a>
    <a href="/especialidades" style="color:#374151;text-decoration:none;font-size:14px;font-weight:500">Especialidades</a>
    <a href="/citas" style="color:#374151;text-decoration:none;font-size:14px;font-weight:500">Citas</a>
    <a href="/contacto" style="color:#374151;text-decoration:none;font-size:14px;font-weight:500">Contacto</a>
    <a href="/acceso" style="color:#374151;text-decoration:none;font-size:14px;font-weight:500">Iniciar sesion</a>
    <a href="/citas" style="background:#0e7490;color:white;text-decoration:none;font-size:14px;font-weight:600;padding:10px 24px;border-radius:8px">Agendar cita</a>
  </div>
</nav>

<!-- ENCABEZADO -->
<section style="background:#f0f9ff;padding:64px 40px;${FS}">
  <div style="max-width:1100px;margin:0 auto;text-align:center">
    <span style="color:#0e7490;font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase">Profesionales de la salud</span>
    <h1 style="font-size:clamp(30px,4.5vw,50px);font-weight:800;color:#0c4a6e;margin:12px 0 16px;letter-spacing:-0.025em">Nuestro equipo medico</h1>
    <p style="font-size:17px;color:#64748b;max-width:560px;margin:0 auto;line-height:1.7">Un equipo de medicos altamente calificados y comprometidos con tu salud, listos para brindarte la mejor atencion.</p>
  </div>
</section>

<!-- GRID DOCTORES -->
<section style="padding:72px 40px;background:white;${FS}">
  <div style="max-width:1100px;margin:0 auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:32px">

    <div style="background:white;border:1px solid #e0f2fe;border-radius:20px;overflow:hidden;box-shadow:0 2px 12px rgba(14,116,144,0.07)">
      <img src="https://placehold.co/400x300/0e7490/bae6fd?text=Dr.+Garcia" style="width:100%;display:block;aspect-ratio:4/3;object-fit:cover">
      <div style="padding:24px">
        <h3 style="font-size:18px;font-weight:700;color:#0c4a6e;margin:0 0 6px">Dr. Carlos Garcia</h3>
        <span style="display:inline-block;background:#f0f9ff;color:#0e7490;font-size:12px;font-weight:600;padding:4px 12px;border-radius:999px">Cardiologia</span>
        <p style="font-size:14px;color:#64748b;line-height:1.65;margin:14px 0 0">Especialista con 15 anos de experiencia en cardiologia intervencionista y prevencion cardiovascular.</p>
      </div>
    </div>

    <div style="background:white;border:1px solid #e0f2fe;border-radius:20px;overflow:hidden;box-shadow:0 2px 12px rgba(14,116,144,0.07)">
      <img src="https://placehold.co/400x300/0c4a6e/93c5fd?text=Dra.+Martinez" style="width:100%;display:block;aspect-ratio:4/3;object-fit:cover">
      <div style="padding:24px">
        <h3 style="font-size:18px;font-weight:700;color:#0c4a6e;margin:0 0 6px">Dra. Laura Martinez</h3>
        <span style="display:inline-block;background:#f0f9ff;color:#0e7490;font-size:12px;font-weight:600;padding:4px 12px;border-radius:999px">Neurologia</span>
        <p style="font-size:14px;color:#64748b;line-height:1.65;margin:14px 0 0">Neurologa con especializacion en epilepsia y trastornos del sueno. Formacion en Estados Unidos y Europa.</p>
      </div>
    </div>

    <div style="background:white;border:1px solid #e0f2fe;border-radius:20px;overflow:hidden;box-shadow:0 2px 12px rgba(14,116,144,0.07)">
      <img src="https://placehold.co/400x300/164e63/67e8f9?text=Dr.+Lopez" style="width:100%;display:block;aspect-ratio:4/3;object-fit:cover">
      <div style="padding:24px">
        <h3 style="font-size:18px;font-weight:700;color:#0c4a6e;margin:0 0 6px">Dr. Miguel Lopez</h3>
        <span style="display:inline-block;background:#f0f9ff;color:#0e7490;font-size:12px;font-weight:600;padding:4px 12px;border-radius:999px">Pediatria</span>
        <p style="font-size:14px;color:#64748b;line-height:1.65;margin:14px 0 0">Pediatra dedicado a la salud integral de los ninos, con enfoque en nutricion y desarrollo infantil.</p>
      </div>
    </div>

    <div style="background:white;border:1px solid #e0f2fe;border-radius:20px;overflow:hidden;box-shadow:0 2px 12px rgba(14,116,144,0.07)">
      <img src="https://placehold.co/400x300/0e7490/e0f2fe?text=Dra.+Torres" style="width:100%;display:block;aspect-ratio:4/3;object-fit:cover">
      <div style="padding:24px">
        <h3 style="font-size:18px;font-weight:700;color:#0c4a6e;margin:0 0 6px">Dra. Sofia Torres</h3>
        <span style="display:inline-block;background:#f0f9ff;color:#0e7490;font-size:12px;font-weight:600;padding:4px 12px;border-radius:999px">Ginecologia</span>
        <p style="font-size:14px;color:#64748b;line-height:1.65;margin:14px 0 0">Ginecologa especializada en medicina reproductiva y salud femenina integral a lo largo de la vida.</p>
      </div>
    </div>

  </div>
</section>

<!-- FOOTER -->
<footer style="background:#0c4a6e;color:rgba(255,255,255,0.7);padding:48px 40px;${FS}">
  <div style="max-width:1100px;margin:0 auto;display:grid;grid-template-columns:2fr 1fr 1fr;gap:48px">
    <div>
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
        <div style="width:32px;height:32px;background:rgba(255,255,255,0.15);border-radius:7px;display:flex;align-items:center;justify-content:center;color:white;font-size:18px;font-weight:300">+</div>
        <span style="font-size:17px;font-weight:700;color:white">ClinicaNombre</span>
      </div>
      <p style="font-size:14px;line-height:1.75;margin:0;max-width:300px">Centro medico especializado dedicado a brindar atencion de calidad con calidez humana.</p>
    </div>
    <div>
      <h4 style="color:white;font-size:14px;font-weight:700;margin:0 0 18px;text-transform:uppercase;letter-spacing:0.08em">Servicios</h4>
      <ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:10px">
        <li><a href="/especialidades" style="color:rgba(255,255,255,0.7);text-decoration:none;font-size:14px">Especialidades</a></li>
        <li><a href="/equipo" style="color:rgba(255,255,255,0.7);text-decoration:none;font-size:14px">Equipo medico</a></li>
        <li><a href="/citas" style="color:rgba(255,255,255,0.7);text-decoration:none;font-size:14px">Agendar cita</a></li>
        <li><a href="/contacto" style="color:rgba(255,255,255,0.7);text-decoration:none;font-size:14px">Contacto</a></li>
      </ul>
    </div>
    <div>
      <h4 style="color:white;font-size:14px;font-weight:700;margin:0 0 18px;text-transform:uppercase;letter-spacing:0.08em">Contacto</h4>
      <div style="display:flex;flex-direction:column;gap:10px;font-size:14px">
        <span>Av. Principal 123, Ciudad</span>
        <span>Tel: (55) 1234-5678</span>
        <span>info@clinicanombre.com</span>
        <span>Lun-Vie 8:00 - 20:00</span>
      </div>
    </div>
  </div>
  <div style="max-width:1100px;margin:32px auto 0;padding-top:24px;border-top:1px solid rgba(255,255,255,0.12);text-align:center;font-size:13px">
    &copy; 2025 ClinicaNombre. Todos los derechos reservados.
  </div>
</footer>
`,
    },
    {
      id: 'citas',
      label: 'Citas',
      routePath: '/citas',
      title: 'Agendar Cita',
      required: false,
      css: '',
      html: `
<!-- NAV -->
<nav style="background:white;border-bottom:1px solid #e0f2fe;padding:0 40px;height:68px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100;${FS}">
  <div style="display:flex;align-items:center;gap:10px">
    <div style="width:34px;height:34px;background:#0e7490;border-radius:8px;display:flex;align-items:center;justify-content:center;color:white;font-size:20px;font-weight:300;line-height:1">+</div>
    <span style="font-size:19px;font-weight:700;color:#0c4a6e;letter-spacing:-0.02em">ClinicaNombre</span>
  </div>
  <div style="display:flex;gap:28px;align-items:center">
    <a href="/" style="color:#374151;text-decoration:none;font-size:14px;font-weight:500">Inicio</a>
    <a href="/especialidades" style="color:#374151;text-decoration:none;font-size:14px;font-weight:500">Especialidades</a>
    <a href="/equipo" style="color:#374151;text-decoration:none;font-size:14px;font-weight:500">Equipo</a>
    <a href="/contacto" style="color:#374151;text-decoration:none;font-size:14px;font-weight:500">Contacto</a>
    <a href="/acceso" style="color:#374151;text-decoration:none;font-size:14px;font-weight:500">Iniciar sesion</a>
    <a href="/citas" style="background:#0e7490;color:white;text-decoration:none;font-size:14px;font-weight:600;padding:10px 24px;border-radius:8px">Agendar cita</a>
  </div>
</nav>

<!-- ENCABEZADO -->
<section style="background:#f0f9ff;padding:64px 40px;${FS}">
  <div style="max-width:1100px;margin:0 auto;text-align:center">
    <span style="color:#0e7490;font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase">Reserva en linea</span>
    <h1 style="font-size:clamp(30px,4.5vw,50px);font-weight:800;color:#0c4a6e;margin:12px 0 16px;letter-spacing:-0.025em">Agendar cita</h1>
    <p style="font-size:17px;color:#64748b;max-width:520px;margin:0 auto;line-height:1.7">Completa el formulario y nos pondremos en contacto contigo para confirmar tu cita en el horario que prefieras.</p>
  </div>
</section>

<!-- FORMULARIO DE CITA -->
<section style="padding:72px 24px;background:white;${FS}">
  <div style="max-width:640px;margin:0 auto;background:white;border-radius:20px;box-shadow:0 4px 32px rgba(14,116,144,0.10);padding:48px 40px">
    <h2 style="font-size:22px;font-weight:800;color:#0c4a6e;margin:0 0 32px">Solicitar cita medica</h2>

    <form style="display:grid;gap:0">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px">
      <div>
        <label style="display:block;font-size:13px;font-weight:600;color:#374151;margin-bottom:6px">Nombre</label>
        <input type="text" placeholder="Tu nombre" style="width:100%;padding:11px 14px;border:1.5px solid #bae6fd;border-radius:8px;font-size:15px;color:#0c4a6e;outline:none;box-sizing:border-box;${FS}">
      </div>
      <div>
        <label style="display:block;font-size:13px;font-weight:600;color:#374151;margin-bottom:6px">Apellido</label>
        <input type="text" placeholder="Tu apellido" style="width:100%;padding:11px 14px;border:1.5px solid #bae6fd;border-radius:8px;font-size:15px;color:#0c4a6e;outline:none;box-sizing:border-box;${FS}">
      </div>
    </div>

    <div style="margin-bottom:20px">
      <label style="display:block;font-size:13px;font-weight:600;color:#374151;margin-bottom:6px">Especialidad</label>
      <select style="width:100%;padding:11px 14px;border:1.5px solid #bae6fd;border-radius:8px;font-size:15px;color:#0c4a6e;outline:none;box-sizing:border-box;background:white;${FS}">
        <option value="">Selecciona una especialidad</option>
        <option value="cardiologia">Cardiologia</option>
        <option value="neurologia">Neurologia</option>
        <option value="odontologia">Odontologia</option>
        <option value="oftalmologia">Oftalmologia</option>
        <option value="ortopedia">Ortopedia</option>
        <option value="ginecologia">Ginecologia</option>
        <option value="pediatria">Pediatria</option>
        <option value="medicina-general">Medicina general</option>
      </select>
    </div>

    <div style="margin-bottom:20px">
      <label style="display:block;font-size:13px;font-weight:600;color:#374151;margin-bottom:6px">Fecha preferida</label>
      <input type="date" style="width:100%;padding:11px 14px;border:1.5px solid #bae6fd;border-radius:8px;font-size:15px;color:#0c4a6e;outline:none;box-sizing:border-box;${FS}">
    </div>

    <div style="margin-bottom:20px">
      <label style="display:block;font-size:13px;font-weight:600;color:#374151;margin-bottom:6px">Telefono</label>
      <input type="tel" placeholder="(55) 1234-5678" style="width:100%;padding:11px 14px;border:1.5px solid #bae6fd;border-radius:8px;font-size:15px;color:#0c4a6e;outline:none;box-sizing:border-box;${FS}">
    </div>

    <div style="margin-bottom:32px">
      <label style="display:block;font-size:13px;font-weight:600;color:#374151;margin-bottom:6px">Motivo de consulta</label>
      <textarea rows="4" placeholder="Describe brevemente el motivo de tu consulta..." style="width:100%;padding:11px 14px;border:1.5px solid #bae6fd;border-radius:8px;font-size:15px;color:#0c4a6e;outline:none;resize:vertical;box-sizing:border-box;${FS}"></textarea>
    </div>

    <button type="submit" style="width:100%;background:#0e7490;color:white;font-size:16px;font-weight:700;padding:15px 24px;border-radius:10px;border:none;cursor:pointer;${FS}">Solicitar cita</button>

    <p style="text-align:center;font-size:13px;color:#94a3b8;margin:16px 0 0;line-height:1.6">Te contactaremos en un plazo de 24 horas para confirmar tu cita.</p>
    </form>
  </div>
</section>

<!-- FOOTER -->
<footer style="background:#0c4a6e;color:rgba(255,255,255,0.7);padding:48px 40px;${FS}">
  <div style="max-width:1100px;margin:0 auto;display:grid;grid-template-columns:2fr 1fr 1fr;gap:48px">
    <div>
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
        <div style="width:32px;height:32px;background:rgba(255,255,255,0.15);border-radius:7px;display:flex;align-items:center;justify-content:center;color:white;font-size:18px;font-weight:300">+</div>
        <span style="font-size:17px;font-weight:700;color:white">ClinicaNombre</span>
      </div>
      <p style="font-size:14px;line-height:1.75;margin:0;max-width:300px">Centro medico especializado dedicado a brindar atencion de calidad con calidez humana.</p>
    </div>
    <div>
      <h4 style="color:white;font-size:14px;font-weight:700;margin:0 0 18px;text-transform:uppercase;letter-spacing:0.08em">Servicios</h4>
      <ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:10px">
        <li><a href="/especialidades" style="color:rgba(255,255,255,0.7);text-decoration:none;font-size:14px">Especialidades</a></li>
        <li><a href="/equipo" style="color:rgba(255,255,255,0.7);text-decoration:none;font-size:14px">Equipo medico</a></li>
        <li><a href="/citas" style="color:rgba(255,255,255,0.7);text-decoration:none;font-size:14px">Agendar cita</a></li>
        <li><a href="/contacto" style="color:rgba(255,255,255,0.7);text-decoration:none;font-size:14px">Contacto</a></li>
      </ul>
    </div>
    <div>
      <h4 style="color:white;font-size:14px;font-weight:700;margin:0 0 18px;text-transform:uppercase;letter-spacing:0.08em">Contacto</h4>
      <div style="display:flex;flex-direction:column;gap:10px;font-size:14px">
        <span>Av. Principal 123, Ciudad</span>
        <span>Tel: (55) 1234-5678</span>
        <span>info@clinicanombre.com</span>
        <span>Lun-Vie 8:00 - 20:00</span>
      </div>
    </div>
  </div>
  <div style="max-width:1100px;margin:32px auto 0;padding-top:24px;border-top:1px solid rgba(255,255,255,0.12);text-align:center;font-size:13px">
    &copy; 2025 ClinicaNombre. Todos los derechos reservados.
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
<nav style="background:white;border-bottom:1px solid #e0f2fe;padding:0 40px;height:68px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100;${FS}">
  <div style="display:flex;align-items:center;gap:10px">
    <div style="width:34px;height:34px;background:#0e7490;border-radius:8px;display:flex;align-items:center;justify-content:center;color:white;font-size:20px;font-weight:300;line-height:1">+</div>
    <span style="font-size:19px;font-weight:700;color:#0c4a6e;letter-spacing:-0.02em">ClinicaNombre</span>
  </div>
  <div style="display:flex;gap:28px;align-items:center">
    <a href="/" style="color:#374151;text-decoration:none;font-size:14px;font-weight:500">Inicio</a>
    <a href="/especialidades" style="color:#374151;text-decoration:none;font-size:14px;font-weight:500">Especialidades</a>
    <a href="/equipo" style="color:#374151;text-decoration:none;font-size:14px;font-weight:500">Equipo</a>
    <a href="/citas" style="color:#374151;text-decoration:none;font-size:14px;font-weight:500">Citas</a>
    <a href="/acceso" style="color:#374151;text-decoration:none;font-size:14px;font-weight:500">Iniciar sesion</a>
    <a href="/citas" style="background:#0e7490;color:white;text-decoration:none;font-size:14px;font-weight:600;padding:10px 24px;border-radius:8px">Agendar cita</a>
  </div>
</nav>

<!-- ENCABEZADO -->
<section style="background:#f0f9ff;padding:64px 40px;${FS}">
  <div style="max-width:1100px;margin:0 auto;text-align:center">
    <span style="color:#0e7490;font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase">Estamos aqui para ayudarte</span>
    <h1 style="font-size:clamp(30px,4.5vw,50px);font-weight:800;color:#0c4a6e;margin:12px 0 16px;letter-spacing:-0.025em">Contacto</h1>
    <p style="font-size:17px;color:#64748b;max-width:520px;margin:0 auto;line-height:1.7">Escribenos o llamanos. Estamos disponibles para resolver todas tus dudas y orientarte en tu atencion medica.</p>
  </div>
</section>

<!-- CONTENIDO 2 COLUMNAS -->
<section style="padding:72px 40px;background:white;${FS}">
  <div style="max-width:1100px;margin:0 auto;display:grid;grid-template-columns:1fr 1fr;gap:64px;align-items:start">

    <!-- INFORMACION DE CONTACTO -->
    <div>
      <h2 style="font-size:22px;font-weight:800;color:#0c4a6e;margin:0 0 32px">Informacion de contacto</h2>

      <div style="display:flex;flex-direction:column;gap:28px">
        <div>
          <div style="font-size:13px;font-weight:700;color:#0e7490;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px">Direccion</div>
          <p style="font-size:15px;color:#374151;margin:0;line-height:1.65">Av. Principal 123, Col. Centro<br>Ciudad, CP 06600</p>
        </div>

        <div>
          <div style="font-size:13px;font-weight:700;color:#0e7490;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px">Telefono</div>
          <p style="font-size:15px;color:#374151;margin:0;line-height:1.65">(55) 1234-5678<br>(55) 8765-4321</p>
        </div>

        <div>
          <div style="font-size:13px;font-weight:700;color:#0e7490;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px">Correo electronico</div>
          <p style="font-size:15px;color:#374151;margin:0;line-height:1.65">info@clinicanombre.com<br>citas@clinicanombre.com</p>
        </div>

        <div>
          <div style="font-size:13px;font-weight:700;color:#0e7490;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px">Horario de atencion</div>
          <div style="font-size:15px;color:#374151;line-height:1.85">
            <div style="display:flex;justify-content:space-between;max-width:280px"><span>Lunes - Viernes</span><span style="color:#0e7490;font-weight:600">8:00 - 20:00</span></div>
            <div style="display:flex;justify-content:space-between;max-width:280px"><span>Sabado</span><span style="color:#0e7490;font-weight:600">9:00 - 14:00</span></div>
            <div style="display:flex;justify-content:space-between;max-width:280px"><span>Domingo</span><span style="color:#94a3b8;font-weight:600">Cerrado</span></div>
          </div>
        </div>

        <div style="background:#f0f9ff;border-left:4px solid #0e7490;border-radius:0 12px 12px 0;padding:18px 20px">
          <div style="font-size:13px;font-weight:700;color:#0e7490;margin-bottom:4px">Urgencias</div>
          <p style="font-size:14px;color:#374151;margin:0;line-height:1.6">Para urgencias medicas llama al <strong>(55) 9999-0000</strong> disponible las 24 horas.</p>
        </div>
      </div>
    </div>

    <!-- FORMULARIO DE CONTACTO -->
    <form style="background:#f0f9ff;border-radius:20px;padding:40px">
      <h2 style="font-size:20px;font-weight:800;color:#0c4a6e;margin:0 0 28px">Envianos un mensaje</h2>

      <div style="margin-bottom:20px">
        <label style="display:block;font-size:13px;font-weight:600;color:#374151;margin-bottom:6px">Nombre completo</label>
        <input type="text" placeholder="Tu nombre completo" style="width:100%;padding:11px 14px;border:1.5px solid #bae6fd;border-radius:8px;font-size:15px;color:#0c4a6e;outline:none;box-sizing:border-box;background:white;${FS}">
      </div>

      <div style="margin-bottom:20px">
        <label style="display:block;font-size:13px;font-weight:600;color:#374151;margin-bottom:6px">Correo electronico</label>
        <input type="email" placeholder="tu@correo.com" style="width:100%;padding:11px 14px;border:1.5px solid #bae6fd;border-radius:8px;font-size:15px;color:#0c4a6e;outline:none;box-sizing:border-box;background:white;${FS}">
      </div>

      <div style="margin-bottom:28px">
        <label style="display:block;font-size:13px;font-weight:600;color:#374151;margin-bottom:6px">Mensaje</label>
        <textarea rows="5" placeholder="Escribe tu consulta o mensaje aqui..." style="width:100%;padding:11px 14px;border:1.5px solid #bae6fd;border-radius:8px;font-size:15px;color:#0c4a6e;outline:none;resize:vertical;box-sizing:border-box;background:white;${FS}"></textarea>
      </div>

      <button type="submit" style="width:100%;background:#0e7490;color:white;font-size:16px;font-weight:700;padding:14px 24px;border-radius:10px;border:none;cursor:pointer;${FS}">Enviar mensaje</button>
    </form>

  </div>
</section>

<!-- FOOTER -->
<footer style="background:#0c4a6e;color:rgba(255,255,255,0.7);padding:48px 40px;${FS}">
  <div style="max-width:1100px;margin:0 auto;display:grid;grid-template-columns:2fr 1fr 1fr;gap:48px">
    <div>
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
        <div style="width:32px;height:32px;background:rgba(255,255,255,0.15);border-radius:7px;display:flex;align-items:center;justify-content:center;color:white;font-size:18px;font-weight:300">+</div>
        <span style="font-size:17px;font-weight:700;color:white">ClinicaNombre</span>
      </div>
      <p style="font-size:14px;line-height:1.75;margin:0;max-width:300px">Centro medico especializado dedicado a brindar atencion de calidad con calidez humana.</p>
    </div>
    <div>
      <h4 style="color:white;font-size:14px;font-weight:700;margin:0 0 18px;text-transform:uppercase;letter-spacing:0.08em">Servicios</h4>
      <ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:10px">
        <li><a href="/especialidades" style="color:rgba(255,255,255,0.7);text-decoration:none;font-size:14px">Especialidades</a></li>
        <li><a href="/equipo" style="color:rgba(255,255,255,0.7);text-decoration:none;font-size:14px">Equipo medico</a></li>
        <li><a href="/citas" style="color:rgba(255,255,255,0.7);text-decoration:none;font-size:14px">Agendar cita</a></li>
        <li><a href="/contacto" style="color:rgba(255,255,255,0.7);text-decoration:none;font-size:14px">Contacto</a></li>
      </ul>
    </div>
    <div>
      <h4 style="color:white;font-size:14px;font-weight:700;margin:0 0 18px;text-transform:uppercase;letter-spacing:0.08em">Contacto</h4>
      <div style="display:flex;flex-direction:column;gap:10px;font-size:14px">
        <span>Av. Principal 123, Ciudad</span>
        <span>Tel: (55) 1234-5678</span>
        <span>info@clinicanombre.com</span>
        <span>Lun-Vie 8:00 - 20:00</span>
      </div>
    </div>
  </div>
  <div style="max-width:1100px;margin:32px auto 0;padding-top:24px;border-top:1px solid rgba(255,255,255,0.12);text-align:center;font-size:13px">
    &copy; 2025 ClinicaNombre. Todos los derechos reservados.
  </div>
</footer>
`,
    },
  ],
}
