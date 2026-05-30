const FS = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"

export const templateBlog = {
  id: 'blog',
  label: 'Blog / Noticias',
  category: 'medios',
  description: 'Diseno editorial limpio para blogs, medios digitales y publicaciones.',
  color: '#1e293b',
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
  <span style="font-size:20px;font-weight:900;color:#0f172a;letter-spacing:-0.03em">ElBlog</span>
  <div style="display:flex;gap:28px;align-items:center">
    <a href="/articulos" style="color:#475569;text-decoration:none;font-size:14px;font-weight:500">Articulos</a>
    <a href="/categorias" style="color:#475569;text-decoration:none;font-size:14px;font-weight:500">Categorias</a>
    <a href="/nosotros" style="color:#475569;text-decoration:none;font-size:14px;font-weight:500">Nosotros</a>
    <a href="/contacto" style="color:#475569;text-decoration:none;font-size:14px;font-weight:500">Contacto</a>
    <a href="/acceso" style="color:#475569;text-decoration:none;font-size:14px;font-weight:500">Iniciar sesion</a>
    <a href="#suscribirse" style="background:#1e293b;color:white;text-decoration:none;font-size:14px;font-weight:600;padding:10px 24px;border-radius:8px">Suscribirse</a>
  </div>
</nav>

<!-- ARTICULO DESTACADO -->
<section style="padding:72px 40px 0;background:white;${FS}">
  <div style="max-width:1100px;margin:0 auto">
    <div style="display:grid;grid-template-columns:1.1fr 1fr;gap:64px;align-items:center">
      <div>
        <span style="display:inline-block;background:#f1f5f9;color:#1e293b;font-size:11px;font-weight:700;padding:5px 12px;border-radius:999px;letter-spacing:0.08em;margin-bottom:16px">TECNOLOGIA</span>
        <h1 style="font-size:clamp(28px,3.5vw,46px);font-weight:900;color:#0f172a;line-height:1.15;margin:0 0 18px;letter-spacing:-0.03em">El futuro de la inteligencia artificial en los medios digitales</h1>
        <p style="font-size:16px;color:#475569;line-height:1.8;margin:0 0 28px">Como las herramientas de IA estan redefiniendo la produccion de contenido, la curaduria editorial y la experiencia del lector en 2025.</p>
        <div style="display:flex;gap:16px;align-items:center;margin-bottom:28px">
          <img src="https://placehold.co/40x40/1e293b/f8fafc?text=A" alt="Autor" style="width:40px;height:40px;border-radius:50%">
          <div>
            <div style="font-size:14px;font-weight:700;color:#0f172a">Ana Garcia</div>
            <div style="font-size:13px;color:#64748b">20 mayo 2025</div>
          </div>
        </div>
        <a href="#" style="background:#1e293b;color:white;font-size:15px;font-weight:700;padding:14px 32px;border-radius:10px;text-decoration:none;display:inline-block">Leer articulo</a>
      </div>
      <div>
        <img src="https://placehold.co/600x420/1e293b/f8fafc?text=Articulo+Destacado" alt="Articulo destacado" style="width:100%;border-radius:20px;display:block">
      </div>
    </div>
  </div>
</section>

<!-- ARTICULOS RECIENTES -->
<section style="padding:80px 40px;background:#f8fafc;${FS}">
  <div style="max-width:1100px;margin:0 auto">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:40px">
      <h2 style="font-size:clamp(22px,3vw,34px);font-weight:900;color:#0f172a;margin:0;letter-spacing:-0.025em">Articulos recientes</h2>
      <a href="/articulos" style="color:#1e293b;font-size:14px;font-weight:600;text-decoration:none;border-bottom:2px solid #1e293b;padding-bottom:2px">Ver todos</a>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:28px">

      <div style="background:white;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0">
        <img src="https://placehold.co/480x240/334155/f8fafc?text=Articulo+1" alt="Articulo 1" style="width:100%;display:block">
        <div style="padding:20px">
          <span style="display:inline-block;background:#f1f5f9;color:#475569;font-size:11px;font-weight:700;padding:3px 10px;border-radius:999px;margin-bottom:10px">CULTURA</span>
          <h3 style="font-size:16px;font-weight:700;color:#0f172a;margin:0 0 8px;line-height:1.35">El renacimiento de la lectura lenta en la era de la informacion</h3>
          <span style="font-size:12px;color:#94a3b8">12 mayo 2025</span>
        </div>
      </div>

      <div style="background:white;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0">
        <img src="https://placehold.co/480x240/475569/f8fafc?text=Articulo+2" alt="Articulo 2" style="width:100%;display:block">
        <div style="padding:20px">
          <span style="display:inline-block;background:#f1f5f9;color:#475569;font-size:11px;font-weight:700;padding:3px 10px;border-radius:999px;margin-bottom:10px">SOCIEDAD</span>
          <h3 style="font-size:16px;font-weight:700;color:#0f172a;margin:0 0 8px;line-height:1.35">Ciudades del futuro: urbanismo sostenible en America Latina</h3>
          <span style="font-size:12px;color:#94a3b8">8 mayo 2025</span>
        </div>
      </div>

      <div style="background:white;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0">
        <img src="https://placehold.co/480x240/64748b/f8fafc?text=Articulo+3" alt="Articulo 3" style="width:100%;display:block">
        <div style="padding:20px">
          <span style="display:inline-block;background:#f1f5f9;color:#475569;font-size:11px;font-weight:700;padding:3px 10px;border-radius:999px;margin-bottom:10px">ECONOMIA</span>
          <h3 style="font-size:16px;font-weight:700;color:#0f172a;margin:0 0 8px;line-height:1.35">Finanzas personales: como construir un fondo de emergencia</h3>
          <span style="font-size:12px;color:#94a3b8">3 mayo 2025</span>
        </div>
      </div>

      <div style="background:white;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0">
        <img src="https://placehold.co/480x240/0f172a/f8fafc?text=Articulo+4" alt="Articulo 4" style="width:100%;display:block">
        <div style="padding:20px">
          <span style="display:inline-block;background:#f1f5f9;color:#475569;font-size:11px;font-weight:700;padding:3px 10px;border-radius:999px;margin-bottom:10px">CIENCIA</span>
          <h3 style="font-size:16px;font-weight:700;color:#0f172a;margin:0 0 8px;line-height:1.35">Avances en medicina regenerativa que cambiaran la salud humana</h3>
          <span style="font-size:12px;color:#94a3b8">28 abr 2025</span>
        </div>
      </div>

    </div>
  </div>
</section>

<!-- CATEGORIAS -->
<section id="suscribirse" style="padding:80px 40px;background:white;${FS}">
  <div style="max-width:1100px;margin:0 auto;text-align:center">
    <h2 style="font-size:clamp(22px,3vw,34px);font-weight:900;color:#0f172a;margin:0 0 40px;letter-spacing:-0.025em">Explora por categoria</h2>
    <div style="display:flex;flex-wrap:wrap;gap:12px;justify-content:center;margin-bottom:72px">
      <a href="/categorias" style="background:#f1f5f9;color:#1e293b;padding:12px 24px;border-radius:999px;font-size:14px;font-weight:600;text-decoration:none;border:1px solid #e2e8f0">Tecnologia</a>
      <a href="/categorias" style="background:#f1f5f9;color:#1e293b;padding:12px 24px;border-radius:999px;font-size:14px;font-weight:600;text-decoration:none;border:1px solid #e2e8f0">Cultura</a>
      <a href="/categorias" style="background:#f1f5f9;color:#1e293b;padding:12px 24px;border-radius:999px;font-size:14px;font-weight:600;text-decoration:none;border:1px solid #e2e8f0">Sociedad</a>
      <a href="/categorias" style="background:#f1f5f9;color:#1e293b;padding:12px 24px;border-radius:999px;font-size:14px;font-weight:600;text-decoration:none;border:1px solid #e2e8f0">Economia</a>
      <a href="/categorias" style="background:#f1f5f9;color:#1e293b;padding:12px 24px;border-radius:999px;font-size:14px;font-weight:600;text-decoration:none;border:1px solid #e2e8f0">Ciencia</a>
      <a href="/categorias" style="background:#f1f5f9;color:#1e293b;padding:12px 24px;border-radius:999px;font-size:14px;font-weight:600;text-decoration:none;border:1px solid #e2e8f0">Arte</a>
    </div>
    <div style="background:#0f172a;border-radius:24px;padding:56px 40px">
      <h3 style="font-size:clamp(22px,3vw,32px);font-weight:900;color:white;margin:0 0 12px;letter-spacing:-0.025em">Recibe nuestros mejores articulos</h3>
      <p style="font-size:16px;color:#94a3b8;margin:0 0 32px">Suscribete y te enviamos los articulos mas importantes directamente a tu correo.</p>
      <form style="display:flex;gap:12px;max-width:480px;margin:0 auto">
        <input type="email" placeholder="tu@correo.com" style="flex:1;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:10px;padding:13px 16px;color:white;font-size:15px;outline:none">
        <button type="submit" style="background:#1e293b;color:white;font-size:14px;font-weight:700;padding:13px 28px;border-radius:10px;border:2px solid rgba(255,255,255,0.2);cursor:pointer;white-space:nowrap">Suscribirse</button>
      </form>
    </div>
  </div>
</section>

<!-- FOOTER -->
<footer style="background:#0f172a;color:rgba(255,255,255,0.65);padding:48px 40px;${FS}">
  <div style="max-width:1100px;margin:0 auto;display:grid;grid-template-columns:2fr 1fr 1fr;gap:48px">
    <div>
      <span style="font-size:18px;font-weight:900;color:white;display:block;margin-bottom:14px;letter-spacing:-0.02em">ElBlog</span>
      <p style="font-size:14px;line-height:1.75;margin:0;max-width:300px">Periodismo digital independiente con enfoque en tecnologia, cultura y sociedad contemporanea.</p>
    </div>
    <div>
      <h4 style="color:white;font-size:13px;font-weight:700;margin:0 0 16px;text-transform:uppercase;letter-spacing:0.08em">Secciones</h4>
      <ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:10px">
        <li><a href="/articulos" style="color:rgba(255,255,255,0.65);text-decoration:none;font-size:14px">Articulos</a></li>
        <li><a href="/categorias" style="color:rgba(255,255,255,0.65);text-decoration:none;font-size:14px">Categorias</a></li>
        <li><a href="/nosotros" style="color:rgba(255,255,255,0.65);text-decoration:none;font-size:14px">Nosotros</a></li>
        <li><a href="/contacto" style="color:rgba(255,255,255,0.65);text-decoration:none;font-size:14px">Contacto</a></li>
      </ul>
    </div>
    <div>
      <h4 style="color:white;font-size:13px;font-weight:700;margin:0 0 16px;text-transform:uppercase;letter-spacing:0.08em">Contacto</h4>
      <div style="display:flex;flex-direction:column;gap:10px;font-size:14px">
        <span>hola@elblog.com</span>
        <span>Ciudad de Mexico</span>
      </div>
    </div>
  </div>
  <div style="max-width:1100px;margin:32px auto 0;padding-top:24px;border-top:1px solid rgba(255,255,255,0.1);text-align:center;font-size:13px">
    &copy; 2025 ElBlog. Todos los derechos reservados.
  </div>
</footer>
`,
    },
    {
      id: 'articulos',
      label: 'Articulos',
      routePath: '/articulos',
      title: 'Todos los Articulos',
      required: false,
      css: '',
      html: `
<!-- NAV -->
<nav style="background:white;border-bottom:1px solid #e2e8f0;padding:0 40px;height:68px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100;${FS}">
  <span style="font-size:20px;font-weight:900;color:#0f172a;letter-spacing:-0.03em">ElBlog</span>
  <div style="display:flex;gap:28px;align-items:center">
    <a href="/" style="color:#475569;text-decoration:none;font-size:14px;font-weight:500">Inicio</a>
    <a href="/categorias" style="color:#475569;text-decoration:none;font-size:14px;font-weight:500">Categorias</a>
    <a href="/nosotros" style="color:#475569;text-decoration:none;font-size:14px;font-weight:500">Nosotros</a>
    <a href="/contacto" style="color:#475569;text-decoration:none;font-size:14px;font-weight:500">Contacto</a>
    <a href="/acceso" style="color:#475569;text-decoration:none;font-size:14px;font-weight:500">Iniciar sesion</a>
    <a href="/" style="background:#1e293b;color:white;text-decoration:none;font-size:14px;font-weight:600;padding:9px 22px;border-radius:8px">Suscribirse</a>
  </div>
</nav>

<!-- ENCABEZADO -->
<section style="background:#f8fafc;padding:64px 40px 48px;${FS}">
  <div style="max-width:1100px;margin:0 auto">
    <h1 style="font-size:clamp(28px,4vw,46px);font-weight:900;color:#0f172a;margin:0 0 12px;letter-spacing:-0.03em">Todos los articulos</h1>
    <p style="font-size:16px;color:#64748b;margin:0">Explora toda nuestra biblioteca de contenido editorial.</p>
  </div>
</section>

<!-- LISTA DE ARTICULOS -->
<section style="padding:60px 40px 100px;background:white;${FS}">
  <div style="max-width:1100px;margin:0 auto;display:flex;flex-direction:column;gap:36px">

    <div style="display:grid;grid-template-columns:320px 1fr;gap:32px;align-items:center;padding-bottom:36px;border-bottom:1px solid #f1f5f9">
      <img src="https://placehold.co/320x210/1e293b/f8fafc?text=Articulo+A" alt="Articulo A" style="width:100%;border-radius:14px;display:block">
      <div>
        <div style="display:flex;gap:12px;align-items:center;margin-bottom:12px">
          <span style="background:#f1f5f9;color:#475569;font-size:11px;font-weight:700;padding:3px 10px;border-radius:999px">TECNOLOGIA</span>
          <span style="font-size:13px;color:#94a3b8">18 mayo 2025</span>
        </div>
        <h2 style="font-size:22px;font-weight:800;color:#0f172a;margin:0 0 10px;letter-spacing:-0.02em;line-height:1.3">El impacto de los modelos de lenguaje en el periodismo</h2>
        <p style="font-size:15px;color:#475569;line-height:1.75;margin:0 0 18px">Una exploracion profunda de como los LLMs estan transformando la investigacion periodistica, la verificacion de datos y la produccion de noticias.</p>
        <a href="#" style="color:#1e293b;font-size:14px;font-weight:700;text-decoration:none;border-bottom:2px solid #1e293b;padding-bottom:2px">Leer articulo &rarr;</a>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:320px 1fr;gap:32px;align-items:center;padding-bottom:36px;border-bottom:1px solid #f1f5f9">
      <img src="https://placehold.co/320x210/334155/f8fafc?text=Articulo+B" alt="Articulo B" style="width:100%;border-radius:14px;display:block">
      <div>
        <div style="display:flex;gap:12px;align-items:center;margin-bottom:12px">
          <span style="background:#f1f5f9;color:#475569;font-size:11px;font-weight:700;padding:3px 10px;border-radius:999px">CULTURA</span>
          <span style="font-size:13px;color:#94a3b8">14 mayo 2025</span>
        </div>
        <h2 style="font-size:22px;font-weight:800;color:#0f172a;margin:0 0 10px;letter-spacing:-0.02em;line-height:1.3">Literatura latinoamericana: voces que deben leerse en 2025</h2>
        <p style="font-size:15px;color:#475569;line-height:1.75;margin:0 0 18px">Una seleccion de los autores mas relevantes del panorama literario contemporaneo de America Latina.</p>
        <a href="#" style="color:#1e293b;font-size:14px;font-weight:700;text-decoration:none;border-bottom:2px solid #1e293b;padding-bottom:2px">Leer articulo &rarr;</a>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:320px 1fr;gap:32px;align-items:center;padding-bottom:36px;border-bottom:1px solid #f1f5f9">
      <img src="https://placehold.co/320x210/475569/f8fafc?text=Articulo+C" alt="Articulo C" style="width:100%;border-radius:14px;display:block">
      <div>
        <div style="display:flex;gap:12px;align-items:center;margin-bottom:12px">
          <span style="background:#f1f5f9;color:#475569;font-size:11px;font-weight:700;padding:3px 10px;border-radius:999px">ECONOMIA</span>
          <span style="font-size:13px;color:#94a3b8">9 mayo 2025</span>
        </div>
        <h2 style="font-size:22px;font-weight:800;color:#0f172a;margin:0 0 10px;letter-spacing:-0.02em;line-height:1.3">Criptomonedas en 2025: entre la regulacion y la adopcion masiva</h2>
        <p style="font-size:15px;color:#475569;line-height:1.75;margin:0 0 18px">Analisis del estado actual del mercado cripto y las perspectivas regulatorias a nivel global.</p>
        <a href="#" style="color:#1e293b;font-size:14px;font-weight:700;text-decoration:none;border-bottom:2px solid #1e293b;padding-bottom:2px">Leer articulo &rarr;</a>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:320px 1fr;gap:32px;align-items:center;padding-bottom:36px;border-bottom:1px solid #f1f5f9">
      <img src="https://placehold.co/320x210/64748b/f8fafc?text=Articulo+D" alt="Articulo D" style="width:100%;border-radius:14px;display:block">
      <div>
        <div style="display:flex;gap:12px;align-items:center;margin-bottom:12px">
          <span style="background:#f1f5f9;color:#475569;font-size:11px;font-weight:700;padding:3px 10px;border-radius:999px">SOCIEDAD</span>
          <span style="font-size:13px;color:#94a3b8">5 mayo 2025</span>
        </div>
        <h2 style="font-size:22px;font-weight:800;color:#0f172a;margin:0 0 10px;letter-spacing:-0.02em;line-height:1.3">Bienestar mental en el trabajo remoto: mitos y realidades</h2>
        <p style="font-size:15px;color:#475569;line-height:1.75;margin:0 0 18px">Investigacion sobre el impacto del teletrabajo en la salud mental y estrategias comprobadas para mejorarla.</p>
        <a href="#" style="color:#1e293b;font-size:14px;font-weight:700;text-decoration:none;border-bottom:2px solid #1e293b;padding-bottom:2px">Leer articulo &rarr;</a>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:320px 1fr;gap:32px;align-items:center;padding-bottom:36px;border-bottom:1px solid #f1f5f9">
      <img src="https://placehold.co/320x210/0f172a/f8fafc?text=Articulo+E" alt="Articulo E" style="width:100%;border-radius:14px;display:block">
      <div>
        <div style="display:flex;gap:12px;align-items:center;margin-bottom:12px">
          <span style="background:#f1f5f9;color:#475569;font-size:11px;font-weight:700;padding:3px 10px;border-radius:999px">CIENCIA</span>
          <span style="font-size:13px;color:#94a3b8">29 abr 2025</span>
        </div>
        <h2 style="font-size:22px;font-weight:800;color:#0f172a;margin:0 0 10px;letter-spacing:-0.02em;line-height:1.3">Exploracion espacial privada: la nueva carrera al cosmos</h2>
        <p style="font-size:15px;color:#475569;line-height:1.75;margin:0 0 18px">El auge de las empresas privadas en la exploracion espacial y sus implicaciones para la humanidad.</p>
        <a href="#" style="color:#1e293b;font-size:14px;font-weight:700;text-decoration:none;border-bottom:2px solid #1e293b;padding-bottom:2px">Leer articulo &rarr;</a>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:320px 1fr;gap:32px;align-items:center">
      <img src="https://placehold.co/320x210/1e293b/e2e8f0?text=Articulo+F" alt="Articulo F" style="width:100%;border-radius:14px;display:block">
      <div>
        <div style="display:flex;gap:12px;align-items:center;margin-bottom:12px">
          <span style="background:#f1f5f9;color:#475569;font-size:11px;font-weight:700;padding:3px 10px;border-radius:999px">ARTE</span>
          <span style="font-size:13px;color:#94a3b8">22 abr 2025</span>
        </div>
        <h2 style="font-size:22px;font-weight:800;color:#0f172a;margin:0 0 10px;letter-spacing:-0.02em;line-height:1.3">Arte generativo: cuando el algoritmo se convierte en artista</h2>
        <p style="font-size:15px;color:#475569;line-height:1.75;margin:0 0 18px">Una mirada critica al arte creado con inteligencia artificial y su lugar en el mundo del arte contemporaneo.</p>
        <a href="#" style="color:#1e293b;font-size:14px;font-weight:700;text-decoration:none;border-bottom:2px solid #1e293b;padding-bottom:2px">Leer articulo &rarr;</a>
      </div>
    </div>

  </div>
</section>

<!-- FOOTER -->
<footer style="background:#0f172a;color:rgba(255,255,255,0.65);padding:48px 40px;${FS}">
  <div style="max-width:1100px;margin:0 auto;display:grid;grid-template-columns:2fr 1fr 1fr;gap:48px">
    <div>
      <span style="font-size:18px;font-weight:900;color:white;display:block;margin-bottom:14px;letter-spacing:-0.02em">ElBlog</span>
      <p style="font-size:14px;line-height:1.75;margin:0;max-width:300px">Periodismo digital independiente con enfoque en tecnologia, cultura y sociedad contemporanea.</p>
    </div>
    <div>
      <h4 style="color:white;font-size:13px;font-weight:700;margin:0 0 16px;text-transform:uppercase;letter-spacing:0.08em">Secciones</h4>
      <ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:10px">
        <li><a href="/articulos" style="color:rgba(255,255,255,0.65);text-decoration:none;font-size:14px">Articulos</a></li>
        <li><a href="/categorias" style="color:rgba(255,255,255,0.65);text-decoration:none;font-size:14px">Categorias</a></li>
        <li><a href="/nosotros" style="color:rgba(255,255,255,0.65);text-decoration:none;font-size:14px">Nosotros</a></li>
        <li><a href="/contacto" style="color:rgba(255,255,255,0.65);text-decoration:none;font-size:14px">Contacto</a></li>
      </ul>
    </div>
    <div>
      <h4 style="color:white;font-size:13px;font-weight:700;margin:0 0 16px;text-transform:uppercase;letter-spacing:0.08em">Contacto</h4>
      <div style="display:flex;flex-direction:column;gap:10px;font-size:14px">
        <span>hola@elblog.com</span>
        <span>Ciudad de Mexico</span>
      </div>
    </div>
  </div>
  <div style="max-width:1100px;margin:32px auto 0;padding-top:24px;border-top:1px solid rgba(255,255,255,0.1);text-align:center;font-size:13px">
    &copy; 2025 ElBlog. Todos los derechos reservados.
  </div>
</footer>
`,
    },
    {
      id: 'categorias',
      label: 'Categorias',
      routePath: '/categorias',
      title: 'Categorias',
      required: false,
      css: '',
      html: `
<!-- NAV -->
<nav style="background:white;border-bottom:1px solid #e2e8f0;padding:0 40px;height:68px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100;${FS}">
  <span style="font-size:20px;font-weight:900;color:#0f172a;letter-spacing:-0.03em">ElBlog</span>
  <div style="display:flex;gap:28px;align-items:center">
    <a href="/" style="color:#475569;text-decoration:none;font-size:14px;font-weight:500">Inicio</a>
    <a href="/articulos" style="color:#475569;text-decoration:none;font-size:14px;font-weight:500">Articulos</a>
    <a href="/nosotros" style="color:#475569;text-decoration:none;font-size:14px;font-weight:500">Nosotros</a>
    <a href="/contacto" style="color:#475569;text-decoration:none;font-size:14px;font-weight:500">Contacto</a>
    <a href="/acceso" style="color:#475569;text-decoration:none;font-size:14px;font-weight:500">Iniciar sesion</a>
    <a href="/" style="background:#1e293b;color:white;text-decoration:none;font-size:14px;font-weight:600;padding:9px 22px;border-radius:8px">Suscribirse</a>
  </div>
</nav>

<!-- ENCABEZADO -->
<section style="background:#f8fafc;padding:64px 40px 48px;text-align:center;${FS}">
  <div style="max-width:700px;margin:0 auto">
    <h1 style="font-size:clamp(28px,4vw,46px);font-weight:900;color:#0f172a;margin:0 0 12px;letter-spacing:-0.03em">Categorias</h1>
    <p style="font-size:16px;color:#64748b;line-height:1.7;margin:0">Encuentra articulos organizados por tematica para una lectura mas enfocada.</p>
  </div>
</section>

<!-- GRID DE CATEGORIAS -->
<section style="padding:60px 40px 100px;background:white;${FS}">
  <div style="max-width:1100px;margin:0 auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:24px">

    <div style="background:#f1f5f9;border-radius:20px;padding:36px">
      <div style="width:48px;height:48px;background:#1e293b;border-radius:12px;display:flex;align-items:center;justify-content:center;color:white;font-size:16px;font-weight:800;margin-bottom:18px">Te</div>
      <h3 style="font-size:20px;font-weight:800;color:#0f172a;margin:0 0 8px">Tecnologia</h3>
      <p style="font-size:14px;color:#64748b;margin:0 0 14px;line-height:1.65">IA, software, hardware y tendencias digitales.</p>
      <span style="font-size:13px;color:#94a3b8;font-weight:600">24 articulos</span>
    </div>

    <div style="background:#f1f5f9;border-radius:20px;padding:36px">
      <div style="width:48px;height:48px;background:#1e293b;border-radius:12px;display:flex;align-items:center;justify-content:center;color:white;font-size:16px;font-weight:800;margin-bottom:18px">Cu</div>
      <h3 style="font-size:20px;font-weight:800;color:#0f172a;margin:0 0 8px">Cultura</h3>
      <p style="font-size:14px;color:#64748b;margin:0 0 14px;line-height:1.65">Literatura, cine, musica y expresion artistica.</p>
      <span style="font-size:13px;color:#94a3b8;font-weight:600">18 articulos</span>
    </div>

    <div style="background:#f1f5f9;border-radius:20px;padding:36px">
      <div style="width:48px;height:48px;background:#1e293b;border-radius:12px;display:flex;align-items:center;justify-content:center;color:white;font-size:16px;font-weight:800;margin-bottom:18px">So</div>
      <h3 style="font-size:20px;font-weight:800;color:#0f172a;margin:0 0 8px">Sociedad</h3>
      <p style="font-size:14px;color:#64748b;margin:0 0 14px;line-height:1.65">Tendencias sociales, bienestar y vida contemporanea.</p>
      <span style="font-size:13px;color:#94a3b8;font-weight:600">31 articulos</span>
    </div>

    <div style="background:#f1f5f9;border-radius:20px;padding:36px">
      <div style="width:48px;height:48px;background:#1e293b;border-radius:12px;display:flex;align-items:center;justify-content:center;color:white;font-size:16px;font-weight:800;margin-bottom:18px">Ec</div>
      <h3 style="font-size:20px;font-weight:800;color:#0f172a;margin:0 0 8px">Economia</h3>
      <p style="font-size:14px;color:#64748b;margin:0 0 14px;line-height:1.65">Finanzas, mercados, emprendimiento y negocios.</p>
      <span style="font-size:13px;color:#94a3b8;font-weight:600">22 articulos</span>
    </div>

    <div style="background:#f1f5f9;border-radius:20px;padding:36px">
      <div style="width:48px;height:48px;background:#1e293b;border-radius:12px;display:flex;align-items:center;justify-content:center;color:white;font-size:16px;font-weight:800;margin-bottom:18px">Ci</div>
      <h3 style="font-size:20px;font-weight:800;color:#0f172a;margin:0 0 8px">Ciencia</h3>
      <p style="font-size:14px;color:#64748b;margin:0 0 14px;line-height:1.65">Investigacion cientifica, medicina y espacio.</p>
      <span style="font-size:13px;color:#94a3b8;font-weight:600">15 articulos</span>
    </div>

    <div style="background:#f1f5f9;border-radius:20px;padding:36px">
      <div style="width:48px;height:48px;background:#1e293b;border-radius:12px;display:flex;align-items:center;justify-content:center;color:white;font-size:16px;font-weight:800;margin-bottom:18px">Ar</div>
      <h3 style="font-size:20px;font-weight:800;color:#0f172a;margin:0 0 8px">Arte</h3>
      <p style="font-size:14px;color:#64748b;margin:0 0 14px;line-height:1.65">Diseno, ilustracion, arte digital y fotografia.</p>
      <span style="font-size:13px;color:#94a3b8;font-weight:600">12 articulos</span>
    </div>

  </div>
</section>

<!-- FOOTER -->
<footer style="background:#0f172a;color:rgba(255,255,255,0.65);padding:48px 40px;${FS}">
  <div style="max-width:1100px;margin:0 auto;display:grid;grid-template-columns:2fr 1fr 1fr;gap:48px">
    <div>
      <span style="font-size:18px;font-weight:900;color:white;display:block;margin-bottom:14px;letter-spacing:-0.02em">ElBlog</span>
      <p style="font-size:14px;line-height:1.75;margin:0;max-width:300px">Periodismo digital independiente con enfoque en tecnologia, cultura y sociedad contemporanea.</p>
    </div>
    <div>
      <h4 style="color:white;font-size:13px;font-weight:700;margin:0 0 16px;text-transform:uppercase;letter-spacing:0.08em">Secciones</h4>
      <ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:10px">
        <li><a href="/articulos" style="color:rgba(255,255,255,0.65);text-decoration:none;font-size:14px">Articulos</a></li>
        <li><a href="/categorias" style="color:rgba(255,255,255,0.65);text-decoration:none;font-size:14px">Categorias</a></li>
        <li><a href="/nosotros" style="color:rgba(255,255,255,0.65);text-decoration:none;font-size:14px">Nosotros</a></li>
        <li><a href="/contacto" style="color:rgba(255,255,255,0.65);text-decoration:none;font-size:14px">Contacto</a></li>
      </ul>
    </div>
    <div>
      <h4 style="color:white;font-size:13px;font-weight:700;margin:0 0 16px;text-transform:uppercase;letter-spacing:0.08em">Contacto</h4>
      <div style="display:flex;flex-direction:column;gap:10px;font-size:14px">
        <span>hola@elblog.com</span>
        <span>Ciudad de Mexico</span>
      </div>
    </div>
  </div>
  <div style="max-width:1100px;margin:32px auto 0;padding-top:24px;border-top:1px solid rgba(255,255,255,0.1);text-align:center;font-size:13px">
    &copy; 2025 ElBlog. Todos los derechos reservados.
  </div>
</footer>
`,
    },
    {
      id: 'nosotros',
      label: 'Nosotros',
      routePath: '/nosotros',
      title: 'Nosotros',
      required: false,
      css: '',
      html: `
<!-- NAV -->
<nav style="background:white;border-bottom:1px solid #e2e8f0;padding:0 40px;height:68px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100;${FS}">
  <span style="font-size:20px;font-weight:900;color:#0f172a;letter-spacing:-0.03em">ElBlog</span>
  <div style="display:flex;gap:28px;align-items:center">
    <a href="/" style="color:#475569;text-decoration:none;font-size:14px;font-weight:500">Inicio</a>
    <a href="/articulos" style="color:#475569;text-decoration:none;font-size:14px;font-weight:500">Articulos</a>
    <a href="/categorias" style="color:#475569;text-decoration:none;font-size:14px;font-weight:500">Categorias</a>
    <a href="/contacto" style="color:#475569;text-decoration:none;font-size:14px;font-weight:500">Contacto</a>
    <a href="/acceso" style="color:#475569;text-decoration:none;font-size:14px;font-weight:500">Iniciar sesion</a>
    <a href="/" style="background:#1e293b;color:white;text-decoration:none;font-size:14px;font-weight:600;padding:9px 22px;border-radius:8px">Suscribirse</a>
  </div>
</nav>

<!-- EQUIPO EDITORIAL -->
<section style="padding:80px 40px;background:white;${FS}">
  <div style="max-width:900px;margin:0 auto;text-align:center">
    <span style="color:#64748b;font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase">Quienes somos</span>
    <h1 style="font-size:clamp(28px,4vw,46px);font-weight:900;color:#0f172a;margin:14px 0 24px;letter-spacing:-0.03em">El equipo editorial</h1>
    <p style="font-size:17px;color:#475569;line-height:1.8;margin:0 auto;max-width:640px">ElBlog nacio con la mision de llevar periodismo independiente, riguroso y accesible a los lectores hispanohablantes. Somos un equipo pequeno con grandes ideas y profundo respeto por la verdad.</p>
  </div>
</section>

<!-- EQUIPO -->
<section style="padding:0 40px 80px;background:white;${FS}">
  <div style="max-width:900px;margin:0 auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:36px">

    <div style="text-align:center">
      <img src="https://placehold.co/180x180/1e293b/f8fafc?text=AP" alt="Ana Perez" style="width:120px;height:120px;border-radius:50%;margin:0 auto 16px;display:block;object-fit:cover">
      <h4 style="font-size:17px;font-weight:800;color:#0f172a;margin:0 0 4px">Ana Perez</h4>
      <p style="font-size:13px;color:#64748b;margin:0">Directora editorial</p>
    </div>

    <div style="text-align:center">
      <img src="https://placehold.co/180x180/334155/f8fafc?text=MR" alt="Miguel Ramirez" style="width:120px;height:120px;border-radius:50%;margin:0 auto 16px;display:block;object-fit:cover">
      <h4 style="font-size:17px;font-weight:800;color:#0f172a;margin:0 0 4px">Miguel Ramirez</h4>
      <p style="font-size:13px;color:#64748b;margin:0">Editor de tecnologia</p>
    </div>

    <div style="text-align:center">
      <img src="https://placehold.co/180x180/475569/f8fafc?text=LV" alt="Lucia Vargas" style="width:120px;height:120px;border-radius:50%;margin:0 auto 16px;display:block;object-fit:cover">
      <h4 style="font-size:17px;font-weight:800;color:#0f172a;margin:0 0 4px">Lucia Vargas</h4>
      <p style="font-size:13px;color:#64748b;margin:0">Editora de cultura</p>
    </div>

  </div>
</section>

<!-- MISION -->
<section style="padding:80px 40px;background:#f8fafc;${FS}">
  <div style="max-width:760px;margin:0 auto;text-align:center">
    <h2 style="font-size:clamp(24px,3.5vw,38px);font-weight:900;color:#0f172a;margin:0 0 20px;letter-spacing:-0.025em">Nuestra mision</h2>
    <p style="font-size:17px;color:#475569;line-height:1.85;margin:0 0 28px">Creemos que el acceso a informacion de calidad es un derecho fundamental. Por eso producimos contenido sin sesgos politicos, sin clickbait y sin publicidad invasiva. Solo periodismo honesto, bien investigado y bien escrito.</p>
    <a href="/contacto" style="background:#1e293b;color:white;font-size:15px;font-weight:700;padding:14px 36px;border-radius:10px;text-decoration:none;display:inline-block">Contactar al equipo</a>
  </div>
</section>

<!-- FOOTER -->
<footer style="background:#0f172a;color:rgba(255,255,255,0.65);padding:48px 40px;${FS}">
  <div style="max-width:1100px;margin:0 auto;display:grid;grid-template-columns:2fr 1fr 1fr;gap:48px">
    <div>
      <span style="font-size:18px;font-weight:900;color:white;display:block;margin-bottom:14px;letter-spacing:-0.02em">ElBlog</span>
      <p style="font-size:14px;line-height:1.75;margin:0;max-width:300px">Periodismo digital independiente con enfoque en tecnologia, cultura y sociedad contemporanea.</p>
    </div>
    <div>
      <h4 style="color:white;font-size:13px;font-weight:700;margin:0 0 16px;text-transform:uppercase;letter-spacing:0.08em">Secciones</h4>
      <ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:10px">
        <li><a href="/articulos" style="color:rgba(255,255,255,0.65);text-decoration:none;font-size:14px">Articulos</a></li>
        <li><a href="/categorias" style="color:rgba(255,255,255,0.65);text-decoration:none;font-size:14px">Categorias</a></li>
        <li><a href="/nosotros" style="color:rgba(255,255,255,0.65);text-decoration:none;font-size:14px">Nosotros</a></li>
        <li><a href="/contacto" style="color:rgba(255,255,255,0.65);text-decoration:none;font-size:14px">Contacto</a></li>
      </ul>
    </div>
    <div>
      <h4 style="color:white;font-size:13px;font-weight:700;margin:0 0 16px;text-transform:uppercase;letter-spacing:0.08em">Contacto</h4>
      <div style="display:flex;flex-direction:column;gap:10px;font-size:14px">
        <span>hola@elblog.com</span>
        <span>Ciudad de Mexico</span>
      </div>
    </div>
  </div>
  <div style="max-width:1100px;margin:32px auto 0;padding-top:24px;border-top:1px solid rgba(255,255,255,0.1);text-align:center;font-size:13px">
    &copy; 2025 ElBlog. Todos los derechos reservados.
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
<nav style="background:white;border-bottom:1px solid #e2e8f0;padding:0 40px;height:68px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100;${FS}">
  <span style="font-size:20px;font-weight:900;color:#0f172a;letter-spacing:-0.03em">ElBlog</span>
  <div style="display:flex;gap:28px;align-items:center">
    <a href="/" style="color:#475569;text-decoration:none;font-size:14px;font-weight:500">Inicio</a>
    <a href="/articulos" style="color:#475569;text-decoration:none;font-size:14px;font-weight:500">Articulos</a>
    <a href="/categorias" style="color:#475569;text-decoration:none;font-size:14px;font-weight:500">Categorias</a>
    <a href="/nosotros" style="color:#475569;text-decoration:none;font-size:14px;font-weight:500">Nosotros</a>
    <a href="/acceso" style="color:#475569;text-decoration:none;font-size:14px;font-weight:500">Iniciar sesion</a>
    <a href="/" style="background:#1e293b;color:white;text-decoration:none;font-size:14px;font-weight:600;padding:9px 22px;border-radius:8px">Suscribirse</a>
  </div>
</nav>

<!-- FORMULARIO -->
<section style="padding:80px 40px 120px;background:white;${FS}">
  <div style="max-width:640px;margin:0 auto">
    <div style="text-align:center;margin-bottom:48px">
      <span style="color:#64748b;font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase">Escribenos</span>
      <h1 style="font-size:clamp(28px,4vw,44px);font-weight:900;color:#0f172a;margin:12px 0 16px;letter-spacing:-0.03em">Contactar al equipo</h1>
      <p style="font-size:16px;color:#64748b;line-height:1.7;margin:0">Tienes una propuesta, una correccion o quieres colaborar con nosotros? Envianos un mensaje.</p>
    </div>
    <form style="display:flex;flex-direction:column;gap:20px">
      <div>
        <label style="display:block;font-size:14px;font-weight:600;color:#0f172a;margin-bottom:8px">Nombre</label>
        <input type="text" placeholder="Tu nombre" style="width:100%;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:13px 16px;font-size:15px;outline:none;box-sizing:border-box">
      </div>
      <div>
        <label style="display:block;font-size:14px;font-weight:600;color:#0f172a;margin-bottom:8px">Correo electronico</label>
        <input type="email" placeholder="tu@correo.com" style="width:100%;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:13px 16px;font-size:15px;outline:none;box-sizing:border-box">
      </div>
      <div>
        <label style="display:block;font-size:14px;font-weight:600;color:#0f172a;margin-bottom:8px">Asunto</label>
        <select style="width:100%;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:13px 16px;font-size:15px;outline:none;box-sizing:border-box;color:#0f172a">
          <option value="">Selecciona un tema</option>
          <option value="colaboracion">Propuesta de colaboracion</option>
          <option value="correccion">Correccion de articulo</option>
          <option value="publicidad">Publicidad</option>
          <option value="otro">Otro</option>
        </select>
      </div>
      <div>
        <label style="display:block;font-size:14px;font-weight:600;color:#0f172a;margin-bottom:8px">Mensaje</label>
        <textarea placeholder="Cuentanos mas sobre tu consulta o propuesta..." rows="6" style="width:100%;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:13px 16px;font-size:15px;outline:none;resize:vertical;box-sizing:border-box"></textarea>
      </div>
      <button type="submit" style="background:#1e293b;color:white;font-size:16px;font-weight:700;padding:15px;border-radius:10px;border:none;cursor:pointer">Enviar mensaje</button>
    </form>
  </div>
</section>

<!-- FOOTER -->
<footer style="background:#0f172a;color:rgba(255,255,255,0.65);padding:48px 40px;${FS}">
  <div style="max-width:1100px;margin:0 auto;display:grid;grid-template-columns:2fr 1fr 1fr;gap:48px">
    <div>
      <span style="font-size:18px;font-weight:900;color:white;display:block;margin-bottom:14px;letter-spacing:-0.02em">ElBlog</span>
      <p style="font-size:14px;line-height:1.75;margin:0;max-width:300px">Periodismo digital independiente con enfoque en tecnologia, cultura y sociedad contemporanea.</p>
    </div>
    <div>
      <h4 style="color:white;font-size:13px;font-weight:700;margin:0 0 16px;text-transform:uppercase;letter-spacing:0.08em">Secciones</h4>
      <ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:10px">
        <li><a href="/articulos" style="color:rgba(255,255,255,0.65);text-decoration:none;font-size:14px">Articulos</a></li>
        <li><a href="/categorias" style="color:rgba(255,255,255,0.65);text-decoration:none;font-size:14px">Categorias</a></li>
        <li><a href="/nosotros" style="color:rgba(255,255,255,0.65);text-decoration:none;font-size:14px">Nosotros</a></li>
        <li><a href="/contacto" style="color:rgba(255,255,255,0.65);text-decoration:none;font-size:14px">Contacto</a></li>
      </ul>
    </div>
    <div>
      <h4 style="color:white;font-size:13px;font-weight:700;margin:0 0 16px;text-transform:uppercase;letter-spacing:0.08em">Contacto</h4>
      <div style="display:flex;flex-direction:column;gap:10px;font-size:14px">
        <span>hola@elblog.com</span>
        <span>Ciudad de Mexico</span>
      </div>
    </div>
  </div>
  <div style="max-width:1100px;margin:32px auto 0;padding-top:24px;border-top:1px solid rgba(255,255,255,0.1);text-align:center;font-size:13px">
    &copy; 2025 ElBlog. Todos los derechos reservados.
  </div>
</footer>
`,
    },
  ],
}
