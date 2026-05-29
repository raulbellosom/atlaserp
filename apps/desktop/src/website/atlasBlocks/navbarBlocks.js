const FS = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"

// Shared dropdown CSS used by all navbar blocks.
// Key techniques:
//   1. padding-top (not margin-top) on dropdown — no hover dead-zone between link and panel
//   2. visibility/opacity with transition-delay on close — 150ms grace period to reach panel
//   3. Transparent padding area is still inside the element so :hover stays active
const DROPDOWN_CSS = `
.atlas-nav-item{position:relative}
.atlas-nav-dropdown{
  position:absolute;top:100%;left:0;
  padding-top:8px;           /* transparent bridge — mouse stays within :hover area */
  visibility:hidden;opacity:0;pointer-events:none;
  transition:opacity 0.18s ease,visibility 0.18s ease;
  transition-delay:0.15s;    /* delay close so user has time to reach the panel */
  z-index:200
}
.atlas-nav-item:hover .atlas-nav-dropdown{
  visibility:visible;opacity:1;pointer-events:auto;
  transition-delay:0s         /* show immediately */
}
.atlas-nav-dd-box{
  background:white;border-radius:12px;
  box-shadow:0 8px 32px rgba(0,0,0,0.13);
  border:1px solid #f1f5f9;padding:8px;min-width:210px
}
.atlas-nav-dd-box a{
  display:block;padding:9px 14px;color:#334155;
  text-decoration:none;font-size:14px;border-radius:8px;
  transition:background 0.12s
}
.atlas-nav-dd-box a:hover{background:#f8fafc;color:#0f172a}
.atlas-nav-dd-divider{height:1px;background:#f1f5f9;margin:6px 0}
.atlas-nav-dd-label{
  display:flex;align-items:center;gap:4px;
  font-size:14px;font-weight:500;cursor:default
}
.dd-caret{
  font-size:9px;opacity:0.45;
  transition:transform 0.2s ease;display:inline-block
}
.atlas-nav-item:hover .dd-caret{transform:rotate(180deg)}
`

export const navbarBlocks = [
  {
    id: 'nav-simple',
    label: 'Navbar simple',
    category: 'Navegacion',
    content: `<style>
.atlas-nav-simple{
  position:sticky;top:0;z-index:100;
  background:white;border-bottom:1px solid #f1f5f9;
  height:64px;display:flex;align-items:center;
  justify-content:space-between;padding:0 40px;${FS}
}
.atlas-nav-simple a{
  text-decoration:none;color:#374151;font-size:14px;
  font-weight:500;transition:color 0.15s
}
.atlas-nav-simple a:hover{color:#4f46e5}
.atlas-nav-simple .nav-links{display:flex;gap:28px;align-items:center}
</style>
<nav class="atlas-nav-simple">
  <a href="/" style="font-size:20px;font-weight:800;color:#0f172a;letter-spacing:-0.025em">MiMarca</a>
  <div class="nav-links">
    <a href="#">Inicio</a>
    <a href="#">Servicios</a>
    <a href="#">Nosotros</a>
    <a href="#">Contacto</a>
    <a href="#" style="background:#4f46e5;color:white !important;padding:9px 22px;border-radius:8px;font-weight:600">Cotizar</a>
  </div>
</nav>`,
  },
  {
    id: 'nav-dark',
    label: 'Navbar oscuro',
    category: 'Navegacion',
    content: `<style>
.atlas-nav-dark{
  position:sticky;top:0;z-index:100;background:#0f172a;
  height:64px;display:flex;align-items:center;
  justify-content:space-between;padding:0 40px;${FS}
}
.atlas-nav-dark a{
  text-decoration:none;color:rgba(255,255,255,0.75);
  font-size:14px;font-weight:500;transition:color 0.15s
}
.atlas-nav-dark a:hover{color:white}
.atlas-nav-dark .nav-links{display:flex;gap:28px;align-items:center}
</style>
<nav class="atlas-nav-dark">
  <a href="/" style="font-size:20px;font-weight:800;color:white;letter-spacing:-0.025em">MiMarca</a>
  <div class="nav-links">
    <a href="#">Inicio</a>
    <a href="#">Servicios</a>
    <a href="#">Nosotros</a>
    <a href="#">Blog</a>
    <a href="#" style="background:#6366f1;color:white !important;padding:9px 22px;border-radius:8px;font-weight:600">Empezar</a>
  </div>
</nav>`,
  },
  {
    id: 'nav-transparent',
    label: 'Navbar transparente',
    category: 'Navegacion',
    content: `<style>
.atlas-nav-transparent{
  position:absolute;top:0;left:0;right:0;z-index:100;
  background:transparent;height:72px;
  display:flex;align-items:center;
  justify-content:space-between;padding:0 48px;${FS}
}
.atlas-nav-transparent a{
  text-decoration:none;color:rgba(255,255,255,0.85);
  font-size:14px;font-weight:500;transition:color 0.15s
}
.atlas-nav-transparent a:hover{color:white}
.atlas-nav-transparent .nav-links{display:flex;gap:28px;align-items:center}
</style>
<nav class="atlas-nav-transparent">
  <a href="/" style="font-size:20px;font-weight:800;color:white;letter-spacing:-0.025em">MiMarca</a>
  <div class="nav-links">
    <a href="#">Inicio</a>
    <a href="#">Servicios</a>
    <a href="#">Galeria</a>
    <a href="#">Contacto</a>
    <a href="#" style="background:rgba(255,255,255,0.15);color:white !important;padding:9px 22px;border-radius:8px;font-weight:600;border:1px solid rgba(255,255,255,0.3)">Reservar</a>
  </div>
</nav>`,
  },
  {
    id: 'nav-with-dropdown',
    label: 'Navbar con dropdowns',
    category: 'Navegacion',
    content: `<style>
${DROPDOWN_CSS}
.atlas-nav-dd{
  position:sticky;top:0;z-index:100;background:white;
  border-bottom:1px solid #e2e8f0;height:64px;
  display:flex;align-items:center;
  justify-content:space-between;padding:0 40px;${FS}
}
.atlas-nav-dd .nav-links{display:flex;gap:4px;align-items:center}
.atlas-nav-dd .atlas-nav-item > a,
.atlas-nav-dd .atlas-nav-item > span{
  color:#374151;font-size:14px;font-weight:500;
  padding:8px 12px;border-radius:8px;
  transition:background 0.12s;cursor:pointer
}
.atlas-nav-dd .atlas-nav-item > a:hover,
.atlas-nav-dd .atlas-nav-item > span:hover{background:#f8fafc;color:#0f172a}
.atlas-nav-dd a{text-decoration:none}
</style>
<nav class="atlas-nav-dd">
  <a href="/" style="font-size:20px;font-weight:800;color:#0f172a;letter-spacing:-0.025em">MiMarca</a>
  <div class="nav-links">
    <!-- Servicios dropdown -->
    <div class="atlas-nav-item">
      <span class="atlas-nav-dd-label">Servicios <span class="dd-caret">&#9660;</span></span>
      <div class="atlas-nav-dropdown">
        <div class="atlas-nav-dd-box">
          <a href="#">Consultoria estrategica</a>
          <a href="#">Gestion de proyectos</a>
          <a href="#">Auditoria y control</a>
          <a href="#">Capacitacion empresarial</a>
          <div class="atlas-nav-dd-divider"></div>
          <a href="#" style="color:#6366f1;font-weight:600">Ver todos los servicios &rarr;</a>
        </div>
      </div>
    </div>
    <!-- Empresa dropdown -->
    <div class="atlas-nav-item">
      <span class="atlas-nav-dd-label">Empresa <span class="dd-caret">&#9660;</span></span>
      <div class="atlas-nav-dropdown">
        <div class="atlas-nav-dd-box">
          <a href="#">Quienes somos</a>
          <a href="#">Nuestro equipo</a>
          <a href="#">Casos de exito</a>
          <a href="#">Blog</a>
        </div>
      </div>
    </div>
    <!-- Recursos dropdown -->
    <div class="atlas-nav-item">
      <span class="atlas-nav-dd-label">Recursos <span class="dd-caret">&#9660;</span></span>
      <div class="atlas-nav-dropdown">
        <div class="atlas-nav-dd-box">
          <a href="#">Documentacion</a>
          <a href="#">Guias y tutoriales</a>
          <a href="#">Webinars</a>
          <a href="#">Preguntas frecuentes</a>
        </div>
      </div>
    </div>
    <a href="#" style="color:#374151;font-size:14px;font-weight:500;padding:8px 12px">Precios</a>
    <a href="#" style="background:#4f46e5;color:white;padding:9px 22px;border-radius:8px;font-weight:600;font-size:14px;margin-left:8px">Contactar</a>
  </div>
</nav>`,
  },
  {
    id: 'nav-centered',
    label: 'Navbar logo centrado',
    category: 'Navegacion',
    content: `<style>
.atlas-nav-centered{
  position:sticky;top:0;z-index:100;background:white;
  border-bottom:1px solid #f1f5f9;padding:0 40px;
  height:68px;display:flex;align-items:center;
  justify-content:space-between;${FS}
}
.atlas-nav-centered a{text-decoration:none;color:#374151;font-size:14px;font-weight:500;transition:color 0.15s}
.atlas-nav-centered a:hover{color:#0f172a}
.atlas-nav-centered .nav-left,.atlas-nav-centered .nav-right{display:flex;gap:24px;align-items:center}
</style>
<nav class="atlas-nav-centered">
  <div class="nav-left">
    <a href="#">Inicio</a>
    <a href="#">Servicios</a>
    <a href="#">Nosotros</a>
  </div>
  <a href="/" style="font-size:22px;font-weight:900;color:#0f172a;letter-spacing:-0.03em">MARCA</a>
  <div class="nav-right">
    <a href="#">Blog</a>
    <a href="#">Contacto</a>
    <a href="#" style="background:#0f172a;color:white;padding:9px 20px;border-radius:8px;font-weight:600;font-size:14px">Reservar</a>
  </div>
</nav>`,
  },
  {
    id: 'nav-mega-menu',
    label: 'Navbar mega menu',
    category: 'Navegacion',
    content: `<style>
${DROPDOWN_CSS}
.atlas-nav-mega{
  position:sticky;top:0;z-index:100;background:white;
  border-bottom:1px solid #e2e8f0;height:64px;
  display:flex;align-items:center;
  justify-content:space-between;padding:0 40px;${FS}
}
.atlas-nav-mega .nav-links{display:flex;gap:4px;align-items:center}
.atlas-nav-mega .atlas-nav-item > a,
.atlas-nav-mega .atlas-nav-item > span{
  color:#374151;font-size:14px;font-weight:500;
  padding:8px 12px;border-radius:8px;
  transition:background 0.12s;cursor:pointer
}
.atlas-nav-mega .atlas-nav-item > a:hover,
.atlas-nav-mega .atlas-nav-item > span:hover{background:#f8fafc;color:#0f172a}
.atlas-nav-mega a{text-decoration:none}
/* Mega panel overrides — wider, grid layout */
.atlas-nav-mega .atlas-mega-panel{min-width:500px;left:-100px}
.atlas-mega-grid{display:grid;grid-template-columns:1fr 1fr;gap:4px}
.atlas-mega-item{padding:12px 14px;border-radius:10px;transition:background 0.12s;cursor:pointer}
.atlas-mega-item:hover{background:#f8fafc}
.atlas-mega-item h4{font-size:14px;font-weight:700;color:#0f172a;margin:0 0 3px}
.atlas-mega-item p{font-size:13px;color:#64748b;margin:0;line-height:1.4}
</style>
<nav class="atlas-nav-mega">
  <a href="/" style="font-size:20px;font-weight:800;color:#0f172a;letter-spacing:-0.025em">MiMarca</a>
  <div class="nav-links">
    <!-- Mega menu -->
    <div class="atlas-nav-item">
      <span class="atlas-nav-dd-label">Productos <span class="dd-caret">&#9660;</span></span>
      <div class="atlas-nav-dropdown atlas-mega-panel">
        <div class="atlas-nav-dd-box" style="min-width:500px">
          <div class="atlas-mega-grid">
            <a href="#" style="text-decoration:none"><div class="atlas-mega-item">
              <h4>Producto Alpha</h4><p>Descripcion concisa del primer producto o servicio.</p>
            </div></a>
            <a href="#" style="text-decoration:none"><div class="atlas-mega-item">
              <h4>Producto Beta</h4><p>Descripcion concisa del segundo producto o servicio.</p>
            </div></a>
            <a href="#" style="text-decoration:none"><div class="atlas-mega-item">
              <h4>Producto Gamma</h4><p>Descripcion del tercer elemento del catalogo.</p>
            </div></a>
            <a href="#" style="text-decoration:none"><div class="atlas-mega-item">
              <h4>Ver catalogo completo</h4><p>Explora todos nuestros productos y soluciones.</p>
            </div></a>
          </div>
        </div>
      </div>
    </div>
    <!-- Regular dropdown -->
    <div class="atlas-nav-item">
      <span class="atlas-nav-dd-label">Soluciones <span class="dd-caret">&#9660;</span></span>
      <div class="atlas-nav-dropdown">
        <div class="atlas-nav-dd-box">
          <a href="#">Para empresas</a>
          <a href="#">Para equipos</a>
          <a href="#">Para freelancers</a>
        </div>
      </div>
    </div>
    <a href="#" style="color:#374151;font-size:14px;font-weight:500;padding:8px 12px">Precios</a>
    <a href="#" style="color:#374151;font-size:14px;font-weight:500;padding:8px 12px">Blog</a>
    <a href="#" style="background:#4f46e5;color:white;padding:9px 22px;border-radius:8px;font-weight:600;font-size:14px;margin-left:8px;text-decoration:none">Empezar gratis</a>
  </div>
</nav>`,
  },
]
