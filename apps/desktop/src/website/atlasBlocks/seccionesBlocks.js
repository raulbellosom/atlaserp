// All complex CSS values (clamp, linear-gradient, font-family with commas) live
// in embedded <style> tags — NOT in style="" attributes.
// GrapesJS's inline-style parser splits on commas and can misparse these values,
// causing sluggish/frozen editing.  CSS class rules are parsed correctly.

const BASE_CSS = `<style>
.afs{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
.amx{max-width:1100px;margin:0 auto}
.amx-sm{max-width:720px;margin:0 auto}
.amx-md{max-width:960px;margin:0 auto}
.atc{text-align:center}
.acard{background:white;border-radius:24px;padding:36px;box-shadow:0 1px 3px rgba(0,0,0,0.05),0 8px 24px rgba(0,0,0,0.04)}
.acard-sm{background:white;border-radius:22px;padding:32px;box-shadow:0 2px 16px rgba(0,0,0,0.05)}
.ah1{font-size:clamp(38px,6vw,72px);font-weight:800;color:white;line-height:1.1;margin:0 0 24px;letter-spacing:-0.03em}
.ah2{font-size:clamp(28px,4vw,48px);font-weight:800;color:#0f172a;margin:14px 0 18px;line-height:1.15;letter-spacing:-0.025em}
.ah2-lg{font-size:clamp(30px,4.5vw,52px);font-weight:800;color:white;line-height:1.15;margin:0 0 20px;letter-spacing:-0.025em}
.ah2-dark{font-size:clamp(28px,4vw,46px);font-weight:800;color:#0f172a;margin:14px 0 0;line-height:1.15;letter-spacing:-0.025em}
.abadge{display:inline-block;background:rgba(255,255,255,0.14);color:#c7d2fe;font-size:12px;font-weight:700;letter-spacing:0.12em;padding:6px 20px;border-radius:999px;margin-bottom:28px;text-transform:uppercase}
.abtn-white{background:white;color:#4338ca;font-size:16px;font-weight:700;padding:15px 36px;border-radius:12px;text-decoration:none;display:inline-block}
.abtn-ghost{background:rgba(255,255,255,0.12);color:white;font-size:16px;font-weight:600;padding:15px 36px;border-radius:12px;text-decoration:none;display:inline-block;border:2px solid rgba(255,255,255,0.3)}
.abtn-primary{display:inline-block;background:#4f46e5;color:white;font-size:15px;font-weight:600;padding:13px 30px;border-radius:10px;text-decoration:none}
.agrid3{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:28px}
.agrid4{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:48px}
.aicon-box{width:56px;height:56px;border-radius:16px;display:flex;align-items:center;justify-content:center;margin-bottom:24px;font-size:26px}
.astat-num{font-size:clamp(40px,6vw,64px);font-weight:900;color:white;margin:0;line-height:1;letter-spacing:-0.04em}
.apricing-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:24px;align-items:start}
.afaq-item{border-top:1px solid #e2e8f0;padding:28px 0}
.atestim-stars{color:#f59e0b;font-size:17px;letter-spacing:2px;margin-bottom:16px}
.aavatar{width:46px;height:46px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:17px;flex-shrink:0}
.ateam-img{width:88px;height:88px;border-radius:50%;object-fit:cover;margin:0 auto 18px;display:block}
.astep-num{width:72px;height:72px;border-radius:20px;display:flex;align-items:center;justify-content:center;margin:0 auto 24px;font-size:30px;font-weight:900;color:white}
</style>`

export const seccionesBlocks = [
  // ─── Heroes ──────────────────────────────────────────────────────────────
  {
    id: 'hero-gradient',
    label: 'Hero degradado',
    category: 'Secciones',
    content: `${BASE_CSS}
<section class="afs" style="min-height:100vh;background:linear-gradient(135deg,#312e81 0%,#4f46e5 55%,#7c3aed 100%);display:flex;align-items:center;justify-content:center;padding:60px 24px">
  <div style="max-width:720px;text-align:center">
    <span class="abadge">Nuevo en 2025</span>
    <h1 class="ah1">La plataforma que <em style="color:#a5b4fc;font-style:normal">transforma</em> tu negocio</h1>
    <p style="font-size:20px;color:rgba(255,255,255,0.75);line-height:1.7;margin:0 0 44px;max-width:540px;margin-left:auto;margin-right:auto">Gestiona cada aspecto de tu empresa desde un solo lugar. Simple, potente y disenado para crecer contigo.</p>
    <div style="display:flex;gap:16px;justify-content:center;flex-wrap:wrap">
      <a href="#" class="abtn-white">Comenzar gratis</a>
      <a href="#" class="abtn-ghost">Ver demo &rarr;</a>
    </div>
  </div>
</section>`,
  },
  {
    id: 'hero-dark',
    label: 'Hero oscuro',
    category: 'Secciones',
    content: `${BASE_CSS}
<section class="afs" style="min-height:100vh;background:#0f172a;display:flex;align-items:center;justify-content:center;padding:60px 24px">
  <div style="max-width:760px;text-align:center">
    <div style="display:inline-flex;align-items:center;gap:8px;background:#1e293b;border:1px solid #334155;border-radius:999px;padding:6px 16px;margin-bottom:32px">
      <span style="width:8px;height:8px;background:#22c55e;border-radius:50%;display:inline-block"></span>
      <span style="color:#94a3b8;font-size:13px;font-weight:500">Disponible ahora</span>
    </div>
    <h1 style="font-size:clamp(36px,5.5vw,68px);font-weight:900;color:white;line-height:1.1;margin:0 0 24px;letter-spacing:-0.03em">El sistema que tu empresa necesitaba</h1>
    <p style="font-size:19px;color:#94a3b8;line-height:1.7;margin:0 0 48px;max-width:560px;margin-left:auto;margin-right:auto">Automatiza procesos, reduce errores y enfoca a tu equipo en lo que realmente importa.</p>
    <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
      <a href="#" style="background:#6366f1;color:white;font-size:16px;font-weight:700;padding:15px 36px;border-radius:10px;text-decoration:none;display:inline-block">Solicitar acceso</a>
      <a href="#" style="background:transparent;color:#e2e8f0;font-size:16px;font-weight:500;padding:15px 36px;border-radius:10px;text-decoration:none;display:inline-block;border:1px solid #334155">Conocer mas</a>
    </div>
  </div>
</section>`,
  },
  {
    id: 'hero-image-bg',
    label: 'Hero imagen de fondo',
    category: 'Secciones',
    content: `${BASE_CSS}
<style>.ahero-bg{position:absolute;inset:0;background-image:url('https://placehold.co/1920x1080/1e293b/334155?text=Doble+clic+para+cambiar');background-size:cover;background-position:center}.ahero-overlay{position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,0.25) 0%,rgba(0,0,0,0.68) 100%)}</style>
<section class="afs" style="min-height:100vh;position:relative;display:flex;align-items:center;justify-content:center;padding:80px 24px;overflow:hidden">
  <div class="ahero-bg"></div>
  <div class="ahero-overlay"></div>
  <div style="position:relative;z-index:1;max-width:760px;text-align:center">
    <span style="display:inline-block;background:rgba(255,255,255,0.15);color:rgba(255,255,255,0.92);font-size:12px;font-weight:700;letter-spacing:0.14em;padding:6px 20px;border-radius:999px;margin-bottom:28px;text-transform:uppercase;border:1px solid rgba(255,255,255,0.25)">Bienvenidos</span>
    <h1 class="ah1" style="text-shadow:0 2px 20px rgba(0,0,0,0.3)">Una experiencia que no olvidaras</h1>
    <p style="font-size:19px;color:rgba(255,255,255,0.82);line-height:1.7;margin:0 0 48px;max-width:540px;margin-left:auto;margin-right:auto">Descubre todo lo que tenemos para ofrecerte. Calidad, compromiso y pasion en cada detalle.</p>
    <div style="display:flex;gap:16px;justify-content:center;flex-wrap:wrap">
      <a href="#" class="abtn-white">Conocer mas</a>
      <a href="#" class="abtn-ghost" style="border:2px solid rgba(255,255,255,0.35)">Contactar</a>
    </div>
  </div>
</section>`,
  },
  {
    id: 'hero-split',
    label: 'Hero dividido',
    category: 'Secciones',
    content: `${BASE_CSS}
<style>.ahero-split-img{background-image:url('https://placehold.co/960x1080/1e293b/334155?text=Doble+clic');background-size:cover;background-position:center;min-height:50vh}</style>
<section class="afs" style="min-height:100vh;display:grid;grid-template-columns:1fr 1fr;overflow:hidden">
  <div class="ahero-split-img"></div>
  <div style="display:flex;align-items:center;padding:60px 56px;background:white">
    <div>
      <span style="color:#6366f1;font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;display:block;margin-bottom:18px">Sobre nosotros</span>
      <h1 style="font-size:clamp(30px,4vw,54px);font-weight:900;color:#0f172a;line-height:1.1;margin:0 0 22px;letter-spacing:-0.03em">Somos mas que un servicio</h1>
      <p style="font-size:17px;color:#64748b;line-height:1.8;margin:0 0 16px">Llevamos anos perfeccionando cada aspecto de lo que hacemos para ofrecerte una experiencia verdaderamente excepcional.</p>
      <p style="font-size:17px;color:#64748b;line-height:1.8;margin:0 0 40px">Nuestro equipo esta completamente dedicado a superar tus expectativas.</p>
      <a href="#" class="abtn-primary" style="background:linear-gradient(135deg,#4f46e5,#7c3aed);font-size:16px;font-weight:700;padding:15px 36px;border-radius:12px">Conocer mas &rarr;</a>
    </div>
  </div>
</section>`,
  },
  {
    id: 'hero-minimal',
    label: 'Hero minimalista',
    category: 'Secciones',
    content: `${BASE_CSS}
<style>.agrad-text{background:linear-gradient(135deg,#4f46e5,#7c3aed);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}</style>
<section class="afs" style="min-height:100vh;background:white;display:flex;align-items:center;justify-content:center;padding:60px 24px">
  <div style="max-width:900px;text-align:center">
    <p style="font-size:14px;font-weight:600;color:#6366f1;letter-spacing:0.12em;text-transform:uppercase;margin:0 0 24px">Bienvenido</p>
    <h1 style="font-size:clamp(44px,7.5vw,100px);font-weight:900;color:#0f172a;line-height:1.0;margin:0 0 32px;letter-spacing:-0.05em">Haz crecer<br><span class="agrad-text">tu negocio</span></h1>
    <p style="font-size:clamp(17px,2vw,20px);color:#64748b;line-height:1.75;margin:0 0 48px;max-width:560px;margin-left:auto;margin-right:auto">La solucion mas elegante para empresas que buscan crecer con inteligencia y estilo.</p>
    <div style="display:flex;gap:14px;justify-content:center;align-items:center;flex-wrap:wrap">
      <a href="#" style="background:#0f172a;color:white;font-size:16px;font-weight:700;padding:16px 40px;border-radius:12px;text-decoration:none;display:inline-block">Empezar ahora</a>
      <a href="#" style="color:#4f46e5;font-size:16px;font-weight:600;text-decoration:none;display:inline-flex;align-items:center;gap:6px">Ver como funciona <span style="font-size:20px;line-height:1">&#9654;</span></a>
    </div>
  </div>
</section>`,
  },

  // ─── Secciones de contenido ───────────────────────────────────────────────
  {
    id: 'features',
    label: 'Caracteristicas',
    category: 'Secciones',
    content: `${BASE_CSS}
<style>
.aicon-violet{background:linear-gradient(135deg,#818cf8,#4f46e5)}
.aicon-green{background:linear-gradient(135deg,#34d399,#059669)}
.aicon-orange{background:linear-gradient(135deg,#fb923c,#ea580c)}
</style>
<section class="afs" style="padding:100px 24px;background:#f8fafc">
  <div class="amx">
    <div class="atc" style="margin-bottom:72px">
      <span style="color:#6366f1;font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase">Por que elegirnos</span>
      <h2 class="ah2">Todo lo que necesitas en un solo lugar</h2>
      <p style="font-size:18px;color:#64748b;max-width:500px;margin:0 auto;line-height:1.7">Herramientas disenadas para que tu equipo trabaje mas rapido.</p>
    </div>
    <div class="agrid3">
      <div class="acard">
        <div class="aicon-box aicon-violet">&#9889;</div>
        <h3 style="font-size:20px;font-weight:700;color:#0f172a;margin:0 0 12px">Velocidad extrema</h3>
        <p style="font-size:15px;color:#64748b;line-height:1.7;margin:0">Respuestas en milisegundos. Tu equipo no espera, el negocio no se detiene.</p>
      </div>
      <div class="acard">
        <div class="aicon-box aicon-green">&#128737;</div>
        <h3 style="font-size:20px;font-weight:700;color:#0f172a;margin:0 0 12px">Seguridad total</h3>
        <p style="font-size:15px;color:#64748b;line-height:1.7;margin:0">Datos protegidos con cifrado bancario. Cumple con todas las normativas.</p>
      </div>
      <div class="acard">
        <div class="aicon-box aicon-orange">&#128202;</div>
        <h3 style="font-size:20px;font-weight:700;color:#0f172a;margin:0 0 12px">Analitica avanzada</h3>
        <p style="font-size:15px;color:#64748b;line-height:1.7;margin:0">Reportes en tiempo real para tomar decisiones basadas en datos reales.</p>
      </div>
    </div>
  </div>
</section>`,
  },
  {
    id: 'about-section',
    label: 'Sobre nosotros',
    category: 'Secciones',
    content: `${BASE_CSS}
<section class="afs" style="padding:100px 24px;background:white">
  <div class="amx" style="display:grid;grid-template-columns:1fr 1fr;gap:80px;align-items:center">
    <div>
      <img src="https://placehold.co/600x450/e2e8f0/94a3b8?text=Nuestra+historia" alt="Nosotros" style="width:100%;border-radius:24px;display:block">
    </div>
    <div>
      <span style="color:#6366f1;font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;display:block;margin-bottom:16px">Quienes somos</span>
      <h2 class="ah2-dark">Una historia construida con dedicacion</h2>
      <p style="font-size:17px;color:#64748b;line-height:1.8;margin:0 0 20px">Comenzamos con una vision clara: ofrecer el mejor servicio posible. Con los anos, hemos crecido y perfeccionado cada aspecto de nuestra operacion.</p>
      <p style="font-size:17px;color:#64748b;line-height:1.8;margin:0 0 36px">Hoy somos lideres en nuestro sector, con cientos de clientes satisfechos.</p>
      <div style="display:flex;gap:40px;flex-wrap:wrap">
        <div><p style="font-size:36px;font-weight:900;color:#4f46e5;margin:0;letter-spacing:-0.03em">500+</p><p style="font-size:13px;color:#64748b;margin:4px 0 0">Clientes felices</p></div>
        <div><p style="font-size:36px;font-weight:900;color:#4f46e5;margin:0;letter-spacing:-0.03em">98%</p><p style="font-size:13px;color:#64748b;margin:4px 0 0">Satisfaccion</p></div>
        <div><p style="font-size:36px;font-weight:900;color:#4f46e5;margin:0;letter-spacing:-0.03em">+10</p><p style="font-size:13px;color:#64748b;margin:4px 0 0">Anos de exp.</p></div>
      </div>
    </div>
  </div>
</section>`,
  },
  {
    id: 'team-cards',
    label: 'Equipo',
    category: 'Secciones',
    content: `${BASE_CSS}
<section class="afs" style="padding:100px 24px;background:#f8fafc">
  <div class="amx">
    <div class="atc" style="margin-bottom:64px">
      <span style="color:#6366f1;font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase">El equipo</span>
      <h2 class="ah2-dark">Las personas detras del proyecto</h2>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:24px">
      <div class="acard-sm" style="text-align:center">
        <img src="https://placehold.co/120x120/ddd6fe/7c3aed?text=AM" alt="Ana" class="ateam-img">
        <h3 style="font-size:18px;font-weight:700;color:#0f172a;margin:0 0 4px">Ana Martinez</h3>
        <p style="font-size:13px;color:#6366f1;font-weight:600;margin:0 0 12px">Directora General</p>
        <p style="font-size:14px;color:#64748b;line-height:1.65;margin:0">Liderando el crecimiento estrategico con vision y determinacion.</p>
      </div>
      <div class="acard-sm" style="text-align:center">
        <img src="https://placehold.co/120x120/bbf7d0/059669?text=CR" alt="Carlos" class="ateam-img">
        <h3 style="font-size:18px;font-weight:700;color:#0f172a;margin:0 0 4px">Carlos Ruiz</h3>
        <p style="font-size:13px;color:#059669;font-weight:600;margin:0 0 12px">Director Tecnico</p>
        <p style="font-size:14px;color:#64748b;line-height:1.65;margin:0">Arquitecto de soluciones innovadoras orientadas al futuro.</p>
      </div>
      <div class="acard-sm" style="text-align:center">
        <img src="https://placehold.co/120x120/fed7aa/ea580c?text=ML" alt="Maria" class="ateam-img">
        <h3 style="font-size:18px;font-weight:700;color:#0f172a;margin:0 0 4px">Maria Lopez</h3>
        <p style="font-size:13px;color:#ea580c;font-weight:600;margin:0 0 12px">Jefa de Diseno</p>
        <p style="font-size:14px;color:#64748b;line-height:1.65;margin:0">Creando experiencias visuales que enamoran a los usuarios.</p>
      </div>
      <div class="acard-sm" style="text-align:center">
        <img src="https://placehold.co/120x120/bfdbfe/2563eb?text=JP" alt="Juan" class="ateam-img">
        <h3 style="font-size:18px;font-weight:700;color:#0f172a;margin:0 0 4px">Juan Perez</h3>
        <p style="font-size:13px;color:#2563eb;font-weight:600;margin:0 0 12px">Gerente Comercial</p>
        <p style="font-size:14px;color:#64748b;line-height:1.65;margin:0">Construyendo relaciones duraderas con cada cliente.</p>
      </div>
    </div>
  </div>
</section>`,
  },
  {
    id: 'process-steps',
    label: 'Pasos del proceso',
    category: 'Secciones',
    content: `${BASE_CSS}
<style>
.astep-1{background:linear-gradient(135deg,#4f46e5,#7c3aed)}
.astep-2{background:linear-gradient(135deg,#06b6d4,#0284c7)}
.astep-3{background:linear-gradient(135deg,#22c55e,#16a34a)}
</style>
<section class="afs" style="padding:100px 24px;background:white">
  <div class="amx-md">
    <div class="atc" style="margin-bottom:72px">
      <span style="color:#6366f1;font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase">Como funciona</span>
      <h2 class="ah2-dark">Tres pasos para empezar</h2>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:40px">
      <div class="atc">
        <div class="astep-num astep-1">1</div>
        <h3 style="font-size:19px;font-weight:700;color:#0f172a;margin:0 0 12px">Registrate gratis</h3>
        <p style="font-size:15px;color:#64748b;line-height:1.7;margin:0">Crea tu cuenta en menos de 2 minutos. Sin tarjeta de credito ni compromisos.</p>
      </div>
      <div class="atc">
        <div class="astep-num astep-2">2</div>
        <h3 style="font-size:19px;font-weight:700;color:#0f172a;margin:0 0 12px">Configura tu cuenta</h3>
        <p style="font-size:15px;color:#64748b;line-height:1.7;margin:0">Personaliza la plataforma segun las necesidades especificas de tu negocio.</p>
      </div>
      <div class="atc">
        <div class="astep-num astep-3">3</div>
        <h3 style="font-size:19px;font-weight:700;color:#0f172a;margin:0 0 12px">Empieza a crecer</h3>
        <p style="font-size:15px;color:#64748b;line-height:1.7;margin:0">Lanza, mide y optimiza. Los resultados se ven desde el primer dia.</p>
      </div>
    </div>
  </div>
</section>`,
  },
  {
    id: 'logos-cloud',
    label: 'Logos de clientes',
    category: 'Secciones',
    content: `${BASE_CSS}
<section class="afs" style="padding:72px 24px;background:#f8fafc">
  <div class="amx-md atc">
    <p style="font-size:14px;font-weight:600;color:#94a3b8;letter-spacing:0.12em;text-transform:uppercase;margin:0 0 40px">Empresas que confian en nosotros</p>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:24px;align-items:center">
      <div style="background:white;border-radius:14px;padding:20px;display:flex;align-items:center;justify-content:center;height:64px;box-shadow:0 1px 4px rgba(0,0,0,0.04)"><span style="font-size:18px;font-weight:800;color:#cbd5e1;letter-spacing:-0.03em">EMPRESA</span></div>
      <div style="background:white;border-radius:14px;padding:20px;display:flex;align-items:center;justify-content:center;height:64px;box-shadow:0 1px 4px rgba(0,0,0,0.04)"><span style="font-size:18px;font-weight:800;color:#cbd5e1;letter-spacing:-0.03em">BRAND</span></div>
      <div style="background:white;border-radius:14px;padding:20px;display:flex;align-items:center;justify-content:center;height:64px;box-shadow:0 1px 4px rgba(0,0,0,0.04)"><span style="font-size:18px;font-weight:800;color:#cbd5e1;letter-spacing:-0.03em">CORP</span></div>
      <div style="background:white;border-radius:14px;padding:20px;display:flex;align-items:center;justify-content:center;height:64px;box-shadow:0 1px 4px rgba(0,0,0,0.04)"><span style="font-size:18px;font-weight:800;color:#cbd5e1;letter-spacing:-0.03em">LOGO</span></div>
      <div style="background:white;border-radius:14px;padding:20px;display:flex;align-items:center;justify-content:center;height:64px;box-shadow:0 1px 4px rgba(0,0,0,0.04)"><span style="font-size:18px;font-weight:800;color:#cbd5e1;letter-spacing:-0.03em">GROUP</span></div>
    </div>
  </div>
</section>`,
  },
  {
    id: 'cta',
    label: 'Llamada a accion',
    category: 'Secciones',
    content: `${BASE_CSS}
<style>.acta-bg{background:linear-gradient(135deg,#1e1b4b 0%,#312e81 100%)}</style>
<section class="afs acta-bg" style="padding:100px 24px;text-align:center">
  <div style="max-width:640px;margin:0 auto">
    <h2 class="ah2-lg">Listo para dar el siguiente paso?</h2>
    <p style="font-size:18px;color:#c7d2fe;line-height:1.7;margin:0 0 44px;max-width:480px;margin-left:auto;margin-right:auto">Unete a cientos de empresas que ya confian en nuestra plataforma para crecer.</p>
    <a href="#" style="display:inline-block;background:#6366f1;color:white;font-size:17px;font-weight:700;padding:17px 48px;border-radius:14px;text-decoration:none">Solicitar una demo gratuita</a>
    <p style="font-size:14px;color:#818cf8;margin:20px 0 0">Sin tarjeta de credito &middot; Cancela cuando quieras</p>
  </div>
</section>`,
  },
  {
    id: 'testimonials',
    label: 'Testimonios',
    category: 'Secciones',
    content: `${BASE_CSS}
<section class="afs" style="padding:100px 24px;background:#f8fafc">
  <div class="amx">
    <div class="atc" style="margin-bottom:64px">
      <span style="color:#6366f1;font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase">Testimonios</span>
      <h2 class="ah2-dark">Lo que dicen nuestros clientes</h2>
    </div>
    <div class="agrid3">
      <div class="acard-sm">
        <div class="atestim-stars">&#9733;&#9733;&#9733;&#9733;&#9733;</div>
        <p style="font-size:16px;color:#334155;line-height:1.75;margin:0 0 24px;font-style:italic">"Desde que implementamos esta plataforma, nuestra productividad aumento un 40%. El soporte es increible."</p>
        <div style="display:flex;align-items:center;gap:12px">
          <div class="aavatar" style="background:linear-gradient(135deg,#818cf8,#4f46e5)">A</div>
          <div><p style="font-weight:700;color:#0f172a;margin:0;font-size:15px">Ana Garcia</p><p style="color:#94a3b8;margin:0;font-size:13px">Directora, Empresa ABC</p></div>
        </div>
      </div>
      <div class="acard-sm">
        <div class="atestim-stars">&#9733;&#9733;&#9733;&#9733;&#9733;</div>
        <p style="font-size:16px;color:#334155;line-height:1.75;margin:0 0 24px;font-style:italic">"La mejor decision que tomamos como empresa. El ROI fue visible desde el primer mes de uso."</p>
        <div style="display:flex;align-items:center;gap:12px">
          <div class="aavatar" style="background:linear-gradient(135deg,#34d399,#059669)">C</div>
          <div><p style="font-weight:700;color:#0f172a;margin:0;font-size:15px">Carlos Mendez</p><p style="color:#94a3b8;margin:0;font-size:13px">CEO, StartupXYZ</p></div>
        </div>
      </div>
      <div class="acard-sm">
        <div class="atestim-stars">&#9733;&#9733;&#9733;&#9733;&#9733;</div>
        <p style="font-size:16px;color:#334155;line-height:1.75;margin:0 0 24px;font-style:italic">"Increiblemente facil de usar. Nuestro equipo lo adopto desde el primer dia sin capacitacion."</p>
        <div style="display:flex;align-items:center;gap:12px">
          <div class="aavatar" style="background:linear-gradient(135deg,#fb923c,#ea580c)">M</div>
          <div><p style="font-weight:700;color:#0f172a;margin:0;font-size:15px">Maria Torres</p><p style="color:#94a3b8;margin:0;font-size:13px">COO, Negocios Pro</p></div>
        </div>
      </div>
    </div>
  </div>
</section>`,
  },
  {
    id: 'stats',
    label: 'Estadisticas',
    category: 'Secciones',
    content: `${BASE_CSS}
<style>.astats-bg{background:linear-gradient(135deg,#312e81 0%,#4f46e5 100%)}</style>
<section class="afs astats-bg" style="padding:80px 24px">
  <div class="amx-md atc">
    <h2 style="font-size:clamp(24px,3.5vw,38px);font-weight:800;color:white;margin:0 0 12px;letter-spacing:-0.02em">Numeros que hablan por si solos</h2>
    <p style="font-size:17px;color:#c7d2fe;margin:0 0 60px">Miles de empresas ya confian en nosotros</p>
    <div class="agrid4">
      <div><p class="astat-num">5,000+</p><p style="font-size:15px;color:#a5b4fc;margin:10px 0 0;font-weight:500">Empresas activas</p></div>
      <div><p class="astat-num">99.9%</p><p style="font-size:15px;color:#a5b4fc;margin:10px 0 0;font-weight:500">Uptime garantizado</p></div>
      <div><p class="astat-num">24/7</p><p style="font-size:15px;color:#a5b4fc;margin:10px 0 0;font-weight:500">Soporte tecnico</p></div>
      <div><p class="astat-num">4.9&#9733;</p><p style="font-size:15px;color:#a5b4fc;margin:10px 0 0;font-weight:500">Calificacion promedio</p></div>
    </div>
  </div>
</section>`,
  },
  {
    id: 'faq',
    label: 'Preguntas frecuentes',
    category: 'Secciones',
    content: `${BASE_CSS}
<section class="afs" style="padding:100px 24px;background:white">
  <div class="amx-sm">
    <div class="atc" style="margin-bottom:64px">
      <span style="color:#6366f1;font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase">FAQ</span>
      <h2 class="ah2-dark">Preguntas frecuentes</h2>
    </div>
    <div class="afaq-item">
      <h3 style="font-size:18px;font-weight:700;color:#0f172a;margin:0 0 12px">Como funciona el periodo de prueba?</h3>
      <p style="font-size:15px;color:#64748b;line-height:1.75;margin:0">Tienes 14 dias para probar todas las funcionalidades sin ninguna restriccion. No se requiere tarjeta de credito.</p>
    </div>
    <div class="afaq-item">
      <h3 style="font-size:18px;font-weight:700;color:#0f172a;margin:0 0 12px">Puedo cambiar de plan en cualquier momento?</h3>
      <p style="font-size:15px;color:#64748b;line-height:1.75;margin:0">Si, puedes actualizar o degradar tu plan cuando quieras. Los cambios se aplican de forma inmediata.</p>
    </div>
    <div class="afaq-item" style="border-bottom:1px solid #e2e8f0">
      <h3 style="font-size:18px;font-weight:700;color:#0f172a;margin:0 0 12px">Mis datos estan seguros?</h3>
      <p style="font-size:15px;color:#64748b;line-height:1.75;margin:0">Usamos cifrado AES-256 y backups automaticos cada hora. Tu informacion siempre esta protegida.</p>
    </div>
  </div>
</section>`,
  },
  {
    id: 'pricing',
    label: 'Precios',
    category: 'Secciones',
    content: `${BASE_CSS}
<section class="afs" style="padding:100px 24px;background:white">
  <div class="amx-md">
    <div class="atc" style="margin-bottom:64px">
      <span style="color:#6366f1;font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase">Precios</span>
      <h2 class="ah2-dark">Planes simples y transparentes</h2>
      <p style="font-size:17px;color:#64748b;margin:0">Sin costos ocultos. Cancela cuando quieras.</p>
    </div>
    <div class="apricing-grid">
      <div style="border:2px solid #e2e8f0;border-radius:24px;padding:36px">
        <h3 style="font-size:20px;font-weight:700;color:#0f172a;margin:0 0 8px">Basico</h3>
        <p style="margin:0 0 28px"><span style="font-size:48px;font-weight:900;color:#0f172a;letter-spacing:-0.04em">$29</span><span style="color:#94a3b8;font-size:16px">/mes</span></p>
        <ul style="list-style:none;padding:0;margin:0 0 32px;display:flex;flex-direction:column;gap:12px">
          <li style="display:flex;gap:10px;font-size:15px;color:#334155;align-items:center"><span style="color:#22c55e;font-weight:700">&#10003;</span>5 usuarios</li>
          <li style="display:flex;gap:10px;font-size:15px;color:#334155;align-items:center"><span style="color:#22c55e;font-weight:700">&#10003;</span>10 GB almacenamiento</li>
        </ul>
        <a href="#" style="display:block;text-align:center;background:#f1f5f9;color:#0f172a;font-weight:600;font-size:15px;padding:14px;border-radius:12px;text-decoration:none">Empezar gratis</a>
      </div>
      <div style="border:2px solid #4f46e5;border-radius:24px;padding:36px;background:#fafaff;position:relative">
        <div style="position:absolute;top:-14px;left:50%;transform:translateX(-50%);background:#4f46e5;color:white;font-size:11px;font-weight:800;padding:4px 18px;border-radius:99px;white-space:nowrap">MAS POPULAR</div>
        <h3 style="font-size:20px;font-weight:700;color:#0f172a;margin:0 0 8px">Profesional</h3>
        <p style="margin:0 0 28px"><span style="font-size:48px;font-weight:900;color:#4f46e5;letter-spacing:-0.04em">$79</span><span style="color:#94a3b8;font-size:16px">/mes</span></p>
        <ul style="list-style:none;padding:0;margin:0 0 32px;display:flex;flex-direction:column;gap:12px">
          <li style="display:flex;gap:10px;font-size:15px;color:#334155;align-items:center"><span style="color:#22c55e;font-weight:700">&#10003;</span>25 usuarios</li>
          <li style="display:flex;gap:10px;font-size:15px;color:#334155;align-items:center"><span style="color:#22c55e;font-weight:700">&#10003;</span>100 GB almacenamiento</li>
          <li style="display:flex;gap:10px;font-size:15px;color:#334155;align-items:center"><span style="color:#22c55e;font-weight:700">&#10003;</span>Soporte prioritario</li>
        </ul>
        <a href="#" style="display:block;text-align:center;background:#4f46e5;color:white;font-weight:700;font-size:15px;padding:14px;border-radius:12px;text-decoration:none">Empezar ahora</a>
      </div>
      <div style="border:2px solid #e2e8f0;border-radius:24px;padding:36px">
        <h3 style="font-size:20px;font-weight:700;color:#0f172a;margin:0 0 8px">Enterprise</h3>
        <p style="margin:0 0 28px"><span style="font-size:32px;font-weight:900;color:#0f172a">Personalizado</span></p>
        <ul style="list-style:none;padding:0;margin:0 0 32px;display:flex;flex-direction:column;gap:12px">
          <li style="display:flex;gap:10px;font-size:15px;color:#334155;align-items:center"><span style="color:#22c55e;font-weight:700">&#10003;</span>Usuarios ilimitados</li>
          <li style="display:flex;gap:10px;font-size:15px;color:#334155;align-items:center"><span style="color:#22c55e;font-weight:700">&#10003;</span>Almacenamiento ilimitado</li>
        </ul>
        <a href="#" style="display:block;text-align:center;background:#f1f5f9;color:#0f172a;font-weight:600;font-size:15px;padding:14px;border-radius:12px;text-decoration:none">Contactar ventas</a>
      </div>
    </div>
  </div>
</section>`,
  },
  {
    id: 'contact-info',
    label: 'Informacion de contacto',
    category: 'Secciones',
    content: `${BASE_CSS}
<section class="afs" style="padding:80px 24px;background:#f8fafc">
  <div class="amx-md">
    <div class="atc" style="margin-bottom:56px">
      <h2 class="ah2-dark">Donde encontrarnos</h2>
      <p style="font-size:17px;color:#64748b;margin:0">Estamos aqui para ayudarte. No dudes en contactarnos.</p>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:20px">
      <div style="background:white;border-radius:20px;padding:32px;text-align:center;box-shadow:0 2px 12px rgba(0,0,0,0.04)">
        <div style="width:52px;height:52px;background:#ede9fe;border-radius:14px;margin:0 auto 18px;display:flex;align-items:center;justify-content:center;font-size:24px">&#128205;</div>
        <h3 style="font-size:16px;font-weight:700;color:#0f172a;margin:0 0 8px">Direccion</h3>
        <p style="font-size:15px;color:#64748b;line-height:1.7;margin:0">Calle Principal 123<br>Ciudad, Estado 00000</p>
      </div>
      <div style="background:white;border-radius:20px;padding:32px;text-align:center;box-shadow:0 2px 12px rgba(0,0,0,0.04)">
        <div style="width:52px;height:52px;background:#d1fae5;border-radius:14px;margin:0 auto 18px;display:flex;align-items:center;justify-content:center;font-size:24px">&#128222;</div>
        <h3 style="font-size:16px;font-weight:700;color:#0f172a;margin:0 0 8px">Telefono</h3>
        <p style="font-size:15px;color:#64748b;line-height:1.7;margin:0">+1 (555) 000-0000<br>Lunes a viernes 9am-6pm</p>
      </div>
      <div style="background:white;border-radius:20px;padding:32px;text-align:center;box-shadow:0 2px 12px rgba(0,0,0,0.04)">
        <div style="width:52px;height:52px;background:#fef3c7;border-radius:14px;margin:0 auto 18px;display:flex;align-items:center;justify-content:center;font-size:24px">&#128231;</div>
        <h3 style="font-size:16px;font-weight:700;color:#0f172a;margin:0 0 8px">Correo electronico</h3>
        <p style="font-size:15px;color:#64748b;line-height:1.7;margin:0">hola@tunegocio.com<br>Respondemos en 24 hrs</p>
      </div>
    </div>
  </div>
</section>`,
  },
]
