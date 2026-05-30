const FS = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"

export const templateInmobiliaria = {
  id: 'inmobiliaria',
  label: 'Inmobiliaria',
  category: 'comercio',
  description: 'Para agencias inmobiliarias, asesores y desarrolladoras de bienes raices.',
  color: '#78350f',
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
<nav style="background:white;border-bottom:1px solid #fde68a;padding:0 40px;height:68px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100;${FS}">
  <span style="font-size:20px;font-weight:800;color:#78350f;letter-spacing:-0.02em">InmobiliariaPlus</span>
  <div style="display:flex;gap:28px;align-items:center">
    <a href="/propiedades" style="color:#44403c;text-decoration:none;font-size:14px;font-weight:500">Propiedades</a>
    <a href="/nosotros" style="color:#44403c;text-decoration:none;font-size:14px;font-weight:500">Nosotros</a>
    <a href="/blog" style="color:#44403c;text-decoration:none;font-size:14px;font-weight:500">Blog</a>
    <a href="/contacto" style="color:#44403c;text-decoration:none;font-size:14px;font-weight:500">Contacto</a>
    <a href="/acceso" style="color:#44403c;text-decoration:none;font-size:14px;font-weight:500">Iniciar sesion</a>
    <a href="/contacto" style="background:#78350f;color:white;text-decoration:none;font-size:14px;font-weight:600;padding:10px 24px;border-radius:8px">Contactar</a>
  </div>
</nav>

<!-- HERO -->
<section style="background:linear-gradient(135deg,#1c1008 0%,#3c1a07 100%);padding:100px 24px 80px;${FS}">
  <div style="max-width:1100px;margin:0 auto;text-align:center">
    <div style="display:inline-block;background:rgba(253,230,138,0.12);border:1px solid rgba(253,230,138,0.3);border-radius:999px;padding:6px 20px;margin-bottom:28px">
      <span style="color:#fde68a;font-size:13px;font-weight:600;letter-spacing:0.08em">Tu hogar ideal te espera</span>
    </div>
    <h1 style="font-size:clamp(38px,5.5vw,68px);font-weight:800;color:white;line-height:1.1;margin:0 0 22px;letter-spacing:-0.03em">Encuentra tu propiedad perfecta</h1>
    <p style="font-size:18px;color:rgba(255,255,255,0.8);line-height:1.75;margin:0 auto 44px;max-width:560px">Casas, departamentos y terrenos en las mejores ubicaciones. Asesoramiento experto para la decision mas importante de tu vida.</p>
    <div style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:16px;padding:20px 24px;max-width:680px;margin:0 auto;display:flex;gap:12px;align-items:center">
      <input type="text" placeholder="Busca por colonia, ciudad o tipo de propiedad..." style="flex:1;background:transparent;border:none;color:white;font-size:15px;outline:none">
      <button type="button" style="background:#78350f;color:white;font-size:14px;font-weight:700;padding:12px 28px;border-radius:10px;border:none;cursor:pointer;white-space:nowrap">Buscar</button>
    </div>
  </div>
</section>

<!-- PROPIEDADES DESTACADAS -->
<section style="padding:80px 24px;background:white;${FS}">
  <div style="max-width:1100px;margin:0 auto">
    <div style="text-align:center;margin-bottom:56px">
      <span style="color:#78350f;font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase">Seleccion premium</span>
      <h2 style="font-size:clamp(28px,4vw,44px);font-weight:800;color:#1c1a18;margin:12px 0 0;letter-spacing:-0.025em">Propiedades destacadas</h2>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:28px">

      <div style="background:white;border:1px solid #e7e5e4;border-radius:20px;overflow:hidden">
        <div style="position:relative">
          <img src="https://placehold.co/640x380/d97706/fff7ed?text=Casa+Residencial" alt="Casa residencial" style="width:100%;display:block">
          <span style="position:absolute;top:16px;left:16px;background:#78350f;color:white;font-size:11px;font-weight:700;padding:4px 12px;border-radius:999px">CASA</span>
        </div>
        <div style="padding:24px">
          <div style="font-size:22px;font-weight:800;color:#78350f;margin-bottom:6px">$4,500,000 MXN</div>
          <h3 style="font-size:16px;font-weight:700;color:#1c1a18;margin:0 0 12px">Casa en fraccionamiento Bosques</h3>
          <div style="display:flex;gap:20px;font-size:13px;color:#78716c">
            <span>280 m2</span>
            <span>3 recamaras</span>
            <span>2 banos</span>
          </div>
        </div>
      </div>

      <div style="background:white;border:1px solid #e7e5e4;border-radius:20px;overflow:hidden">
        <div style="position:relative">
          <img src="https://placehold.co/640x380/92400e/fff7ed?text=Departamento+Moderno" alt="Departamento moderno" style="width:100%;display:block">
          <span style="position:absolute;top:16px;left:16px;background:#78350f;color:white;font-size:11px;font-weight:700;padding:4px 12px;border-radius:999px">DEPARTAMENTO</span>
        </div>
        <div style="padding:24px">
          <div style="font-size:22px;font-weight:800;color:#78350f;margin-bottom:6px">$2,800,000 MXN</div>
          <h3 style="font-size:16px;font-weight:700;color:#1c1a18;margin:0 0 12px">Departamento Centro Historico</h3>
          <div style="display:flex;gap:20px;font-size:13px;color:#78716c">
            <span>95 m2</span>
            <span>2 recamaras</span>
            <span>1 bano</span>
          </div>
        </div>
      </div>

      <div style="background:white;border:1px solid #e7e5e4;border-radius:20px;overflow:hidden">
        <div style="position:relative">
          <img src="https://placehold.co/640x380/78350f/fff7ed?text=Terreno+Comercial" alt="Terreno comercial" style="width:100%;display:block">
          <span style="position:absolute;top:16px;left:16px;background:#78350f;color:white;font-size:11px;font-weight:700;padding:4px 12px;border-radius:999px">TERRENO</span>
        </div>
        <div style="padding:24px">
          <div style="font-size:22px;font-weight:800;color:#78350f;margin-bottom:6px">$1,200,000 MXN</div>
          <h3 style="font-size:16px;font-weight:700;color:#1c1a18;margin:0 0 12px">Terreno zona industrial norte</h3>
          <div style="display:flex;gap:20px;font-size:13px;color:#78716c">
            <span>500 m2</span>
            <span>Uso mixto</span>
          </div>
        </div>
      </div>

    </div>
  </div>
</section>

<!-- POR QUE ELEGIRNOS -->
<section style="padding:80px 24px;background:#fef3c7;${FS}">
  <div style="max-width:1100px;margin:0 auto">
    <div style="text-align:center;margin-bottom:56px">
      <span style="color:#92400e;font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase">Nuestra diferencia</span>
      <h2 style="font-size:clamp(28px,4vw,44px);font-weight:800;color:#1c1a18;margin:12px 0 0;letter-spacing:-0.025em">Por que elegirnos</h2>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:28px">
      <div style="background:white;border-radius:20px;padding:36px">
        <div style="width:52px;height:52px;background:#78350f;border-radius:14px;display:flex;align-items:center;justify-content:center;color:white;font-size:20px;font-weight:800;margin-bottom:20px">E</div>
        <h3 style="font-size:18px;font-weight:700;color:#1c1a18;margin:0 0 12px">Experiencia comprobada</h3>
        <p style="font-size:15px;color:#57534e;line-height:1.7;margin:0">Mas de 15 anos en el mercado inmobiliario con mas de 2,000 transacciones exitosas en todo el pais.</p>
      </div>
      <div style="background:white;border-radius:20px;padding:36px">
        <div style="width:52px;height:52px;background:#78350f;border-radius:14px;display:flex;align-items:center;justify-content:center;color:white;font-size:20px;font-weight:800;margin-bottom:20px">A</div>
        <h3 style="font-size:18px;font-weight:700;color:#1c1a18;margin:0 0 12px">Asesoria personalizada</h3>
        <p style="font-size:15px;color:#57534e;line-height:1.7;margin:0">Cada cliente recibe atencion dedicada. Encontramos la propiedad que se adapta exactamente a tu necesidad y presupuesto.</p>
      </div>
      <div style="background:white;border-radius:20px;padding:36px">
        <div style="width:52px;height:52px;background:#78350f;border-radius:14px;display:flex;align-items:center;justify-content:center;color:white;font-size:20px;font-weight:800;margin-bottom:20px">S</div>
        <h3 style="font-size:18px;font-weight:700;color:#1c1a18;margin:0 0 12px">Soporte legal incluido</h3>
        <p style="font-size:15px;color:#57534e;line-height:1.7;margin:0">Nuestro equipo juridico te acompana en todo el proceso de escrituracion y tramites notariales sin costo adicional.</p>
      </div>
    </div>
  </div>
</section>

<!-- FOOTER -->
<footer style="background:#1c1008;color:rgba(255,255,255,0.65);padding:48px 40px;${FS}">
  <div style="max-width:1100px;margin:0 auto;display:grid;grid-template-columns:2fr 1fr 1fr;gap:48px">
    <div>
      <span style="font-size:18px;font-weight:800;color:#fde68a;display:block;margin-bottom:14px">InmobiliariaPlus</span>
      <p style="font-size:14px;line-height:1.75;margin:0;max-width:300px">Agencia inmobiliaria con presencia nacional, especializada en propiedades residenciales y comerciales.</p>
    </div>
    <div>
      <h4 style="color:white;font-size:13px;font-weight:700;margin:0 0 16px;text-transform:uppercase;letter-spacing:0.08em">Paginas</h4>
      <ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:10px">
        <li><a href="/propiedades" style="color:rgba(255,255,255,0.65);text-decoration:none;font-size:14px">Propiedades</a></li>
        <li><a href="/nosotros" style="color:rgba(255,255,255,0.65);text-decoration:none;font-size:14px">Nosotros</a></li>
        <li><a href="/blog" style="color:rgba(255,255,255,0.65);text-decoration:none;font-size:14px">Blog</a></li>
        <li><a href="/contacto" style="color:rgba(255,255,255,0.65);text-decoration:none;font-size:14px">Contacto</a></li>
      </ul>
    </div>
    <div>
      <h4 style="color:white;font-size:13px;font-weight:700;margin:0 0 16px;text-transform:uppercase;letter-spacing:0.08em">Contacto</h4>
      <div style="display:flex;flex-direction:column;gap:10px;font-size:14px">
        <span>Av. Reforma 500, CDMX</span>
        <span>Tel: (55) 5555-0000</span>
        <span>info@inmobiliariaplus.com</span>
        <span>Lun-Sab 9:00 - 19:00</span>
      </div>
    </div>
  </div>
  <div style="max-width:1100px;margin:32px auto 0;padding-top:24px;border-top:1px solid rgba(255,255,255,0.1);text-align:center;font-size:13px">
    &copy; 2025 InmobiliariaPlus. Todos los derechos reservados.
  </div>
</footer>
`,
    },
    {
      id: 'propiedades',
      label: 'Propiedades',
      routePath: '/propiedades',
      title: 'Propiedades',
      required: false,
      css: '',
      html: `
<!-- NAV -->
<nav style="background:white;border-bottom:1px solid #fde68a;padding:0 40px;height:68px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100;${FS}">
  <span style="font-size:20px;font-weight:800;color:#78350f;letter-spacing:-0.02em">InmobiliariaPlus</span>
  <div style="display:flex;gap:28px;align-items:center">
    <a href="/" style="color:#44403c;text-decoration:none;font-size:14px;font-weight:500">Inicio</a>
    <a href="/nosotros" style="color:#44403c;text-decoration:none;font-size:14px;font-weight:500">Nosotros</a>
    <a href="/blog" style="color:#44403c;text-decoration:none;font-size:14px;font-weight:500">Blog</a>
    <a href="/contacto" style="color:#44403c;text-decoration:none;font-size:14px;font-weight:500">Contacto</a>
    <a href="/acceso" style="color:#44403c;text-decoration:none;font-size:14px;font-weight:500">Iniciar sesion</a>
    <a href="/contacto" style="background:#78350f;color:white;text-decoration:none;font-size:14px;font-weight:600;padding:10px 24px;border-radius:8px">Contactar</a>
  </div>
</nav>

<!-- ENCABEZADO -->
<section style="background:#fef3c7;padding:64px 24px 48px;${FS}">
  <div style="max-width:1100px;margin:0 auto;text-align:center">
    <span style="color:#92400e;font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase">Catalogo completo</span>
    <h1 style="font-size:clamp(30px,4.5vw,50px);font-weight:800;color:#1c1a18;margin:12px 0 16px;letter-spacing:-0.025em">Propiedades disponibles</h1>
    <p style="font-size:16px;color:#57534e;max-width:520px;margin:0 auto;line-height:1.7">Explora nuestra seleccion de casas, departamentos y terrenos en las mejores ubicaciones del pais.</p>
  </div>
</section>

<!-- GRID DE PROPIEDADES -->
<section style="padding:60px 24px 100px;background:white;${FS}">
  <div style="max-width:1100px;margin:0 auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:28px">

    <div style="background:white;border:1px solid #e7e5e4;border-radius:20px;overflow:hidden">
      <div style="position:relative">
        <img src="https://placehold.co/640x380/d97706/fff7ed?text=Propiedad+01" alt="Propiedad 01" style="width:100%;display:block">
        <span style="position:absolute;top:16px;left:16px;background:#78350f;color:white;font-size:11px;font-weight:700;padding:4px 12px;border-radius:999px">CASA</span>
      </div>
      <div style="padding:24px">
        <div style="font-size:20px;font-weight:800;color:#78350f;margin-bottom:6px">$3,800,000 MXN</div>
        <h3 style="font-size:16px;font-weight:700;color:#1c1a18;margin:0 0 10px">Casa con jardin en zona norte</h3>
        <div style="display:flex;gap:16px;font-size:13px;color:#78716c;margin-bottom:16px">
          <span>220 m2</span><span>3 rec</span><span>2 ban</span>
        </div>
        <a href="#" style="display:block;text-align:center;background:#78350f;color:white;padding:10px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600">Ver detalle</a>
      </div>
    </div>

    <div style="background:white;border:1px solid #e7e5e4;border-radius:20px;overflow:hidden">
      <div style="position:relative">
        <img src="https://placehold.co/640x380/92400e/fff7ed?text=Propiedad+02" alt="Propiedad 02" style="width:100%;display:block">
        <span style="position:absolute;top:16px;left:16px;background:#78350f;color:white;font-size:11px;font-weight:700;padding:4px 12px;border-radius:999px">DEPTO</span>
      </div>
      <div style="padding:24px">
        <div style="font-size:20px;font-weight:800;color:#78350f;margin-bottom:6px">$1,950,000 MXN</div>
        <h3 style="font-size:16px;font-weight:700;color:#1c1a18;margin:0 0 10px">Departamento en torre ejecutiva</h3>
        <div style="display:flex;gap:16px;font-size:13px;color:#78716c;margin-bottom:16px">
          <span>75 m2</span><span>2 rec</span><span>1 ban</span>
        </div>
        <a href="#" style="display:block;text-align:center;background:#78350f;color:white;padding:10px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600">Ver detalle</a>
      </div>
    </div>

    <div style="background:white;border:1px solid #e7e5e4;border-radius:20px;overflow:hidden">
      <div style="position:relative">
        <img src="https://placehold.co/640x380/78350f/fef3c7?text=Propiedad+03" alt="Propiedad 03" style="width:100%;display:block">
        <span style="position:absolute;top:16px;left:16px;background:#78350f;color:white;font-size:11px;font-weight:700;padding:4px 12px;border-radius:999px">TERRENO</span>
      </div>
      <div style="padding:24px">
        <div style="font-size:20px;font-weight:800;color:#78350f;margin-bottom:6px">$2,100,000 MXN</div>
        <h3 style="font-size:16px;font-weight:700;color:#1c1a18;margin:0 0 10px">Terreno en zona residencial sur</h3>
        <div style="display:flex;gap:16px;font-size:13px;color:#78716c;margin-bottom:16px">
          <span>650 m2</span><span>Uso habitacional</span>
        </div>
        <a href="#" style="display:block;text-align:center;background:#78350f;color:white;padding:10px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600">Ver detalle</a>
      </div>
    </div>

    <div style="background:white;border:1px solid #e7e5e4;border-radius:20px;overflow:hidden">
      <div style="position:relative">
        <img src="https://placehold.co/640x380/b45309/fef3c7?text=Propiedad+04" alt="Propiedad 04" style="width:100%;display:block">
        <span style="position:absolute;top:16px;left:16px;background:#78350f;color:white;font-size:11px;font-weight:700;padding:4px 12px;border-radius:999px">CASA</span>
      </div>
      <div style="padding:24px">
        <div style="font-size:20px;font-weight:800;color:#78350f;margin-bottom:6px">$6,200,000 MXN</div>
        <h3 style="font-size:16px;font-weight:700;color:#1c1a18;margin:0 0 10px">Casa de lujo con alberca</h3>
        <div style="display:flex;gap:16px;font-size:13px;color:#78716c;margin-bottom:16px">
          <span>450 m2</span><span>5 rec</span><span>4 ban</span>
        </div>
        <a href="#" style="display:block;text-align:center;background:#78350f;color:white;padding:10px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600">Ver detalle</a>
      </div>
    </div>

    <div style="background:white;border:1px solid #e7e5e4;border-radius:20px;overflow:hidden">
      <div style="position:relative">
        <img src="https://placehold.co/640x380/d97706/1c1008?text=Propiedad+05" alt="Propiedad 05" style="width:100%;display:block">
        <span style="position:absolute;top:16px;left:16px;background:#78350f;color:white;font-size:11px;font-weight:700;padding:4px 12px;border-radius:999px">DEPTO</span>
      </div>
      <div style="padding:24px">
        <div style="font-size:20px;font-weight:800;color:#78350f;margin-bottom:6px">$3,400,000 MXN</div>
        <h3 style="font-size:16px;font-weight:700;color:#1c1a18;margin:0 0 10px">Penthouse con terraza privada</h3>
        <div style="display:flex;gap:16px;font-size:13px;color:#78716c;margin-bottom:16px">
          <span>180 m2</span><span>3 rec</span><span>2 ban</span>
        </div>
        <a href="#" style="display:block;text-align:center;background:#78350f;color:white;padding:10px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600">Ver detalle</a>
      </div>
    </div>

    <div style="background:white;border:1px solid #e7e5e4;border-radius:20px;overflow:hidden">
      <div style="position:relative">
        <img src="https://placehold.co/640x380/92400e/1c1008?text=Propiedad+06" alt="Propiedad 06" style="width:100%;display:block">
        <span style="position:absolute;top:16px;left:16px;background:#78350f;color:white;font-size:11px;font-weight:700;padding:4px 12px;border-radius:999px">LOCAL</span>
      </div>
      <div style="padding:24px">
        <div style="font-size:20px;font-weight:800;color:#78350f;margin-bottom:6px">$1,750,000 MXN</div>
        <h3 style="font-size:16px;font-weight:700;color:#1c1a18;margin:0 0 10px">Local comercial en avenida principal</h3>
        <div style="display:flex;gap:16px;font-size:13px;color:#78716c;margin-bottom:16px">
          <span>120 m2</span><span>Uso comercial</span>
        </div>
        <a href="#" style="display:block;text-align:center;background:#78350f;color:white;padding:10px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600">Ver detalle</a>
      </div>
    </div>

  </div>
</section>

<!-- FOOTER -->
<footer style="background:#1c1008;color:rgba(255,255,255,0.65);padding:48px 40px;${FS}">
  <div style="max-width:1100px;margin:0 auto;display:grid;grid-template-columns:2fr 1fr 1fr;gap:48px">
    <div>
      <span style="font-size:18px;font-weight:800;color:#fde68a;display:block;margin-bottom:14px">InmobiliariaPlus</span>
      <p style="font-size:14px;line-height:1.75;margin:0;max-width:300px">Agencia inmobiliaria con presencia nacional, especializada en propiedades residenciales y comerciales.</p>
    </div>
    <div>
      <h4 style="color:white;font-size:13px;font-weight:700;margin:0 0 16px;text-transform:uppercase;letter-spacing:0.08em">Paginas</h4>
      <ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:10px">
        <li><a href="/propiedades" style="color:rgba(255,255,255,0.65);text-decoration:none;font-size:14px">Propiedades</a></li>
        <li><a href="/nosotros" style="color:rgba(255,255,255,0.65);text-decoration:none;font-size:14px">Nosotros</a></li>
        <li><a href="/blog" style="color:rgba(255,255,255,0.65);text-decoration:none;font-size:14px">Blog</a></li>
        <li><a href="/contacto" style="color:rgba(255,255,255,0.65);text-decoration:none;font-size:14px">Contacto</a></li>
      </ul>
    </div>
    <div>
      <h4 style="color:white;font-size:13px;font-weight:700;margin:0 0 16px;text-transform:uppercase;letter-spacing:0.08em">Contacto</h4>
      <div style="display:flex;flex-direction:column;gap:10px;font-size:14px">
        <span>Av. Reforma 500, CDMX</span>
        <span>Tel: (55) 5555-0000</span>
        <span>info@inmobiliariaplus.com</span>
        <span>Lun-Sab 9:00 - 19:00</span>
      </div>
    </div>
  </div>
  <div style="max-width:1100px;margin:32px auto 0;padding-top:24px;border-top:1px solid rgba(255,255,255,0.1);text-align:center;font-size:13px">
    &copy; 2025 InmobiliariaPlus. Todos los derechos reservados.
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
<nav style="background:white;border-bottom:1px solid #fde68a;padding:0 40px;height:68px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100;${FS}">
  <span style="font-size:20px;font-weight:800;color:#78350f;letter-spacing:-0.02em">InmobiliariaPlus</span>
  <div style="display:flex;gap:28px;align-items:center">
    <a href="/" style="color:#44403c;text-decoration:none;font-size:14px;font-weight:500">Inicio</a>
    <a href="/propiedades" style="color:#44403c;text-decoration:none;font-size:14px;font-weight:500">Propiedades</a>
    <a href="/blog" style="color:#44403c;text-decoration:none;font-size:14px;font-weight:500">Blog</a>
    <a href="/contacto" style="color:#44403c;text-decoration:none;font-size:14px;font-weight:500">Contacto</a>
    <a href="/acceso" style="color:#44403c;text-decoration:none;font-size:14px;font-weight:500">Iniciar sesion</a>
    <a href="/contacto" style="background:#78350f;color:white;text-decoration:none;font-size:14px;font-weight:600;padding:10px 24px;border-radius:8px">Contactar</a>
  </div>
</nav>

<!-- HISTORIA -->
<section style="padding:80px 24px;background:white;${FS}">
  <div style="max-width:1100px;margin:0 auto;display:grid;grid-template-columns:1fr 1fr;gap:72px;align-items:center">
    <div>
      <span style="color:#92400e;font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase">Nuestra historia</span>
      <h1 style="font-size:clamp(28px,4vw,46px);font-weight:800;color:#1c1a18;margin:14px 0 24px;letter-spacing:-0.025em">Mas de 15 anos construyendo suenos</h1>
      <p style="font-size:16px;color:#57534e;line-height:1.8;margin:0 0 18px">InmobiliariaPlus nacio en 2009 con una vision clara: transformar la experiencia de comprar y vender propiedades en Mexico, haciendola mas simple, transparente y humana.</p>
      <p style="font-size:16px;color:#57534e;line-height:1.8;margin:0">Hoy contamos con oficinas en las principales ciudades del pais y un equipo de mas de 60 asesores certificados que han ayudado a miles de familias a encontrar su hogar ideal.</p>
    </div>
    <div>
      <img src="https://placehold.co/560x480/d97706/fff7ed?text=Equipo+Inmobiliaria" alt="Equipo de trabajo" style="width:100%;border-radius:24px;display:block">
    </div>
  </div>
</section>

<!-- VALORES -->
<section style="padding:72px 24px;background:#fef3c7;${FS}">
  <div style="max-width:1100px;margin:0 auto">
    <div style="text-align:center;margin-bottom:52px">
      <h2 style="font-size:clamp(26px,3.5vw,40px);font-weight:800;color:#1c1a18;margin:0;letter-spacing:-0.025em">Nuestros valores</h2>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:24px">
      <div style="background:white;border-radius:16px;padding:28px;text-align:center">
        <div style="width:48px;height:48px;background:#78350f;border-radius:12px;margin:0 auto 16px;display:flex;align-items:center;justify-content:center;color:white;font-size:18px;font-weight:800">H</div>
        <h3 style="font-size:16px;font-weight:700;color:#1c1a18;margin:0 0 8px">Honestidad</h3>
        <p style="font-size:14px;color:#57534e;line-height:1.65;margin:0">Transparencia total en cada operacion.</p>
      </div>
      <div style="background:white;border-radius:16px;padding:28px;text-align:center">
        <div style="width:48px;height:48px;background:#78350f;border-radius:12px;margin:0 auto 16px;display:flex;align-items:center;justify-content:center;color:white;font-size:18px;font-weight:800">C</div>
        <h3 style="font-size:16px;font-weight:700;color:#1c1a18;margin:0 0 8px">Compromiso</h3>
        <p style="font-size:14px;color:#57534e;line-height:1.65;margin:0">Dedicacion plena a cada cliente.</p>
      </div>
      <div style="background:white;border-radius:16px;padding:28px;text-align:center">
        <div style="width:48px;height:48px;background:#78350f;border-radius:12px;margin:0 auto 16px;display:flex;align-items:center;justify-content:center;color:white;font-size:18px;font-weight:800">P</div>
        <h3 style="font-size:16px;font-weight:700;color:#1c1a18;margin:0 0 8px">Profesionalismo</h3>
        <p style="font-size:14px;color:#57534e;line-height:1.65;margin:0">Asesores certificados y en constante formacion.</p>
      </div>
    </div>
  </div>
</section>

<!-- ASESORES -->
<section style="padding:72px 24px 100px;background:white;${FS}">
  <div style="max-width:1100px;margin:0 auto">
    <div style="text-align:center;margin-bottom:52px">
      <h2 style="font-size:clamp(26px,3.5vw,40px);font-weight:800;color:#1c1a18;margin:0;letter-spacing:-0.025em">Nuestros asesores</h2>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:28px">
      <div style="text-align:center">
        <img src="https://placehold.co/200x200/d97706/fff7ed?text=Asesor+01" alt="Asesor 01" style="width:120px;height:120px;border-radius:50%;margin:0 auto 16px;display:block;object-fit:cover">
        <h4 style="font-size:16px;font-weight:700;color:#1c1a18;margin:0 0 4px">Laura Mendez</h4>
        <p style="font-size:13px;color:#78716c;margin:0">Especialista en zona norte</p>
      </div>
      <div style="text-align:center">
        <img src="https://placehold.co/200x200/92400e/fff7ed?text=Asesor+02" alt="Asesor 02" style="width:120px;height:120px;border-radius:50%;margin:0 auto 16px;display:block;object-fit:cover">
        <h4 style="font-size:16px;font-weight:700;color:#1c1a18;margin:0 0 4px">Carlos Ruiz</h4>
        <p style="font-size:13px;color:#78716c;margin:0">Propiedades comerciales</p>
      </div>
      <div style="text-align:center">
        <img src="https://placehold.co/200x200/78350f/fef3c7?text=Asesor+03" alt="Asesor 03" style="width:120px;height:120px;border-radius:50%;margin:0 auto 16px;display:block;object-fit:cover">
        <h4 style="font-size:16px;font-weight:700;color:#1c1a18;margin:0 0 4px">Sofia Vega</h4>
        <p style="font-size:13px;color:#78716c;margin:0">Zona residencial sur</p>
      </div>
      <div style="text-align:center">
        <img src="https://placehold.co/200x200/b45309/fef3c7?text=Asesor+04" alt="Asesor 04" style="width:120px;height:120px;border-radius:50%;margin:0 auto 16px;display:block;object-fit:cover">
        <h4 style="font-size:16px;font-weight:700;color:#1c1a18;margin:0 0 4px">Diego Torres</h4>
        <p style="font-size:13px;color:#78716c;margin:0">Desarrollos inmobiliarios</p>
      </div>
    </div>
  </div>
</section>

<!-- FOOTER -->
<footer style="background:#1c1008;color:rgba(255,255,255,0.65);padding:48px 40px;${FS}">
  <div style="max-width:1100px;margin:0 auto;display:grid;grid-template-columns:2fr 1fr 1fr;gap:48px">
    <div>
      <span style="font-size:18px;font-weight:800;color:#fde68a;display:block;margin-bottom:14px">InmobiliariaPlus</span>
      <p style="font-size:14px;line-height:1.75;margin:0;max-width:300px">Agencia inmobiliaria con presencia nacional, especializada en propiedades residenciales y comerciales.</p>
    </div>
    <div>
      <h4 style="color:white;font-size:13px;font-weight:700;margin:0 0 16px;text-transform:uppercase;letter-spacing:0.08em">Paginas</h4>
      <ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:10px">
        <li><a href="/propiedades" style="color:rgba(255,255,255,0.65);text-decoration:none;font-size:14px">Propiedades</a></li>
        <li><a href="/nosotros" style="color:rgba(255,255,255,0.65);text-decoration:none;font-size:14px">Nosotros</a></li>
        <li><a href="/blog" style="color:rgba(255,255,255,0.65);text-decoration:none;font-size:14px">Blog</a></li>
        <li><a href="/contacto" style="color:rgba(255,255,255,0.65);text-decoration:none;font-size:14px">Contacto</a></li>
      </ul>
    </div>
    <div>
      <h4 style="color:white;font-size:13px;font-weight:700;margin:0 0 16px;text-transform:uppercase;letter-spacing:0.08em">Contacto</h4>
      <div style="display:flex;flex-direction:column;gap:10px;font-size:14px">
        <span>Av. Reforma 500, CDMX</span>
        <span>Tel: (55) 5555-0000</span>
        <span>info@inmobiliariaplus.com</span>
        <span>Lun-Sab 9:00 - 19:00</span>
      </div>
    </div>
  </div>
  <div style="max-width:1100px;margin:32px auto 0;padding-top:24px;border-top:1px solid rgba(255,255,255,0.1);text-align:center;font-size:13px">
    &copy; 2025 InmobiliariaPlus. Todos los derechos reservados.
  </div>
</footer>
`,
    },
    {
      id: 'blog',
      label: 'Blog',
      routePath: '/blog',
      title: 'Blog Inmobiliario',
      required: false,
      css: '',
      html: `
<!-- NAV -->
<nav style="background:white;border-bottom:1px solid #fde68a;padding:0 40px;height:68px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100;${FS}">
  <span style="font-size:20px;font-weight:800;color:#78350f;letter-spacing:-0.02em">InmobiliariaPlus</span>
  <div style="display:flex;gap:28px;align-items:center">
    <a href="/" style="color:#44403c;text-decoration:none;font-size:14px;font-weight:500">Inicio</a>
    <a href="/propiedades" style="color:#44403c;text-decoration:none;font-size:14px;font-weight:500">Propiedades</a>
    <a href="/nosotros" style="color:#44403c;text-decoration:none;font-size:14px;font-weight:500">Nosotros</a>
    <a href="/contacto" style="color:#44403c;text-decoration:none;font-size:14px;font-weight:500">Contacto</a>
    <a href="/acceso" style="color:#44403c;text-decoration:none;font-size:14px;font-weight:500">Iniciar sesion</a>
    <a href="/contacto" style="background:#78350f;color:white;text-decoration:none;font-size:14px;font-weight:600;padding:10px 24px;border-radius:8px">Contactar</a>
  </div>
</nav>

<!-- ENCABEZADO -->
<section style="background:#fef3c7;padding:64px 24px 48px;text-align:center;${FS}">
  <div style="max-width:700px;margin:0 auto">
    <span style="color:#92400e;font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase">Consejos y noticias</span>
    <h1 style="font-size:clamp(30px,4.5vw,50px);font-weight:800;color:#1c1a18;margin:12px 0 16px;letter-spacing:-0.025em">Blog inmobiliario</h1>
    <p style="font-size:16px;color:#57534e;line-height:1.7;margin:0">Articulos, guias y tendencias del mercado inmobiliario para ayudarte a tomar mejores decisiones.</p>
  </div>
</section>

<!-- ARTICULOS -->
<section style="padding:60px 24px 100px;background:white;${FS}">
  <div style="max-width:1000px;margin:0 auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(440px,1fr));gap:32px">

    <div style="background:white;border:1px solid #e7e5e4;border-radius:20px;overflow:hidden">
      <img src="https://placehold.co/600x280/d97706/fff7ed?text=Articulo+01" alt="Articulo 01" style="width:100%;display:block">
      <div style="padding:28px">
        <div style="display:flex;gap:12px;align-items:center;margin-bottom:14px">
          <span style="background:#fef3c7;color:#92400e;font-size:11px;font-weight:700;padding:4px 10px;border-radius:999px">MERCADO</span>
          <span style="font-size:13px;color:#78716c">15 mayo 2025</span>
        </div>
        <h3 style="font-size:18px;font-weight:700;color:#1c1a18;margin:0 0 10px">Tendencias del mercado inmobiliario 2025</h3>
        <p style="font-size:14px;color:#57534e;line-height:1.7;margin:0 0 18px">Un analisis detallado de las zonas con mayor plusvalia y los tipos de propiedad con mejor rentabilidad este ano.</p>
        <a href="#" style="color:#78350f;font-size:14px;font-weight:600;text-decoration:none">Leer mas &rarr;</a>
      </div>
    </div>

    <div style="background:white;border:1px solid #e7e5e4;border-radius:20px;overflow:hidden">
      <img src="https://placehold.co/600x280/92400e/fff7ed?text=Articulo+02" alt="Articulo 02" style="width:100%;display:block">
      <div style="padding:28px">
        <div style="display:flex;gap:12px;align-items:center;margin-bottom:14px">
          <span style="background:#fef3c7;color:#92400e;font-size:11px;font-weight:700;padding:4px 10px;border-radius:999px">GUIA</span>
          <span style="font-size:13px;color:#78716c">8 mayo 2025</span>
        </div>
        <h3 style="font-size:18px;font-weight:700;color:#1c1a18;margin:0 0 10px">Como obtener un credito hipotecario sin complicaciones</h3>
        <p style="font-size:14px;color:#57534e;line-height:1.7;margin:0 0 18px">Pasos esenciales para preparar tu documentacion y aumentar tus posibilidades de aprobacion.</p>
        <a href="#" style="color:#78350f;font-size:14px;font-weight:600;text-decoration:none">Leer mas &rarr;</a>
      </div>
    </div>

    <div style="background:white;border:1px solid #e7e5e4;border-radius:20px;overflow:hidden">
      <img src="https://placehold.co/600x280/78350f/fef3c7?text=Articulo+03" alt="Articulo 03" style="width:100%;display:block">
      <div style="padding:28px">
        <div style="display:flex;gap:12px;align-items:center;margin-bottom:14px">
          <span style="background:#fef3c7;color:#92400e;font-size:11px;font-weight:700;padding:4px 10px;border-radius:999px">CONSEJOS</span>
          <span style="font-size:13px;color:#78716c">1 mayo 2025</span>
        </div>
        <h3 style="font-size:18px;font-weight:700;color:#1c1a18;margin:0 0 10px">5 errores al comprar tu primera casa</h3>
        <p style="font-size:14px;color:#57534e;line-height:1.7;margin:0 0 18px">Aprende de los errores mas comunes de los compradores primerizos y evita sorpresas desagradables.</p>
        <a href="#" style="color:#78350f;font-size:14px;font-weight:600;text-decoration:none">Leer mas &rarr;</a>
      </div>
    </div>

    <div style="background:white;border:1px solid #e7e5e4;border-radius:20px;overflow:hidden">
      <img src="https://placehold.co/600x280/b45309/fef3c7?text=Articulo+04" alt="Articulo 04" style="width:100%;display:block">
      <div style="padding:28px">
        <div style="display:flex;gap:12px;align-items:center;margin-bottom:14px">
          <span style="background:#fef3c7;color:#92400e;font-size:11px;font-weight:700;padding:4px 10px;border-radius:999px">INVERSION</span>
          <span style="font-size:13px;color:#78716c">24 abr 2025</span>
        </div>
        <h3 style="font-size:18px;font-weight:700;color:#1c1a18;margin:0 0 10px">Invertir en bienes raices: guia para principiantes</h3>
        <p style="font-size:14px;color:#57534e;line-height:1.7;margin:0 0 18px">Todo lo que necesitas saber para comenzar a construir patrimonio a traves de propiedades inmuebles.</p>
        <a href="#" style="color:#78350f;font-size:14px;font-weight:600;text-decoration:none">Leer mas &rarr;</a>
      </div>
    </div>

  </div>
</section>

<!-- FOOTER -->
<footer style="background:#1c1008;color:rgba(255,255,255,0.65);padding:48px 40px;${FS}">
  <div style="max-width:1100px;margin:0 auto;display:grid;grid-template-columns:2fr 1fr 1fr;gap:48px">
    <div>
      <span style="font-size:18px;font-weight:800;color:#fde68a;display:block;margin-bottom:14px">InmobiliariaPlus</span>
      <p style="font-size:14px;line-height:1.75;margin:0;max-width:300px">Agencia inmobiliaria con presencia nacional, especializada en propiedades residenciales y comerciales.</p>
    </div>
    <div>
      <h4 style="color:white;font-size:13px;font-weight:700;margin:0 0 16px;text-transform:uppercase;letter-spacing:0.08em">Paginas</h4>
      <ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:10px">
        <li><a href="/propiedades" style="color:rgba(255,255,255,0.65);text-decoration:none;font-size:14px">Propiedades</a></li>
        <li><a href="/nosotros" style="color:rgba(255,255,255,0.65);text-decoration:none;font-size:14px">Nosotros</a></li>
        <li><a href="/blog" style="color:rgba(255,255,255,0.65);text-decoration:none;font-size:14px">Blog</a></li>
        <li><a href="/contacto" style="color:rgba(255,255,255,0.65);text-decoration:none;font-size:14px">Contacto</a></li>
      </ul>
    </div>
    <div>
      <h4 style="color:white;font-size:13px;font-weight:700;margin:0 0 16px;text-transform:uppercase;letter-spacing:0.08em">Contacto</h4>
      <div style="display:flex;flex-direction:column;gap:10px;font-size:14px">
        <span>Av. Reforma 500, CDMX</span>
        <span>Tel: (55) 5555-0000</span>
        <span>info@inmobiliariaplus.com</span>
        <span>Lun-Sab 9:00 - 19:00</span>
      </div>
    </div>
  </div>
  <div style="max-width:1100px;margin:32px auto 0;padding-top:24px;border-top:1px solid rgba(255,255,255,0.1);text-align:center;font-size:13px">
    &copy; 2025 InmobiliariaPlus. Todos los derechos reservados.
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
<nav style="background:white;border-bottom:1px solid #fde68a;padding:0 40px;height:68px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100;${FS}">
  <span style="font-size:20px;font-weight:800;color:#78350f;letter-spacing:-0.02em">InmobiliariaPlus</span>
  <div style="display:flex;gap:28px;align-items:center">
    <a href="/" style="color:#44403c;text-decoration:none;font-size:14px;font-weight:500">Inicio</a>
    <a href="/propiedades" style="color:#44403c;text-decoration:none;font-size:14px;font-weight:500">Propiedades</a>
    <a href="/nosotros" style="color:#44403c;text-decoration:none;font-size:14px;font-weight:500">Nosotros</a>
    <a href="/blog" style="color:#44403c;text-decoration:none;font-size:14px;font-weight:500">Blog</a>
    <a href="/acceso" style="color:#44403c;text-decoration:none;font-size:14px;font-weight:500">Iniciar sesion</a>
    <a href="/contacto" style="background:#78350f;color:white;text-decoration:none;font-size:14px;font-weight:600;padding:10px 24px;border-radius:8px">Contactar</a>
  </div>
</nav>

<!-- CONTACTO -->
<section style="padding:80px 24px 100px;background:white;${FS}">
  <div style="max-width:1100px;margin:0 auto;display:grid;grid-template-columns:1fr 1.4fr;gap:72px">
    <div>
      <span style="color:#92400e;font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase">Estamos aqui</span>
      <h1 style="font-size:clamp(28px,4vw,44px);font-weight:800;color:#1c1a18;margin:14px 0 28px;letter-spacing:-0.025em">Ponerse en contacto</h1>
      <div style="display:flex;flex-direction:column;gap:24px">
        <div style="display:flex;gap:16px;align-items:flex-start">
          <div style="width:44px;height:44px;background:#fef3c7;border-radius:10px;display:flex;align-items:center;justify-content:center;color:#78350f;font-size:16px;font-weight:800;flex-shrink:0">U</div>
          <div>
            <div style="font-size:14px;font-weight:700;color:#1c1a18;margin-bottom:4px">Ubicacion</div>
            <div style="font-size:14px;color:#57534e;line-height:1.6">Av. Reforma 500, Piso 8<br>Col. Juarez, CDMX, Mexico</div>
          </div>
        </div>
        <div style="display:flex;gap:16px;align-items:flex-start">
          <div style="width:44px;height:44px;background:#fef3c7;border-radius:10px;display:flex;align-items:center;justify-content:center;color:#78350f;font-size:16px;font-weight:800;flex-shrink:0">H</div>
          <div>
            <div style="font-size:14px;font-weight:700;color:#1c1a18;margin-bottom:4px">Horarios</div>
            <div style="font-size:14px;color:#57534e;line-height:1.6">Lunes a Sabado: 9:00 - 19:00<br>Domingo: cerrado</div>
          </div>
        </div>
        <div style="display:flex;gap:16px;align-items:flex-start">
          <div style="width:44px;height:44px;background:#fef3c7;border-radius:10px;display:flex;align-items:center;justify-content:center;color:#78350f;font-size:16px;font-weight:800;flex-shrink:0">T</div>
          <div>
            <div style="font-size:14px;font-weight:700;color:#1c1a18;margin-bottom:4px">Telefono</div>
            <div style="font-size:14px;color:#57534e">(55) 5555-0000</div>
          </div>
        </div>
        <div style="display:flex;gap:16px;align-items:flex-start">
          <div style="width:44px;height:44px;background:#fef3c7;border-radius:10px;display:flex;align-items:center;justify-content:center;color:#78350f;font-size:16px;font-weight:800;flex-shrink:0">@</div>
          <div>
            <div style="font-size:14px;font-weight:700;color:#1c1a18;margin-bottom:4px">Correo</div>
            <div style="font-size:14px;color:#57534e">info@inmobiliariaplus.com</div>
          </div>
        </div>
      </div>
    </div>
    <div>
      <div style="background:#fef3c7;border-radius:24px;padding:40px">
        <h2 style="font-size:22px;font-weight:800;color:#1c1a18;margin:0 0 28px">Enviar mensaje</h2>
        <form style="display:flex;flex-direction:column;gap:18px">
          <div>
            <label style="display:block;font-size:14px;font-weight:600;color:#1c1a18;margin-bottom:8px">Nombre completo</label>
            <input type="text" placeholder="Tu nombre" style="width:100%;background:white;border:1px solid #e7e5e4;border-radius:10px;padding:13px 16px;font-size:15px;outline:none;box-sizing:border-box">
          </div>
          <div>
            <label style="display:block;font-size:14px;font-weight:600;color:#1c1a18;margin-bottom:8px">Correo electronico</label>
            <input type="email" placeholder="tu@correo.com" style="width:100%;background:white;border:1px solid #e7e5e4;border-radius:10px;padding:13px 16px;font-size:15px;outline:none;box-sizing:border-box">
          </div>
          <div>
            <label style="display:block;font-size:14px;font-weight:600;color:#1c1a18;margin-bottom:8px">Mensaje</label>
            <textarea placeholder="Describe la propiedad que buscas o tu consulta..." rows="5" style="width:100%;background:white;border:1px solid #e7e5e4;border-radius:10px;padding:13px 16px;font-size:15px;outline:none;resize:vertical;box-sizing:border-box"></textarea>
          </div>
          <button type="submit" style="background:#78350f;color:white;font-size:16px;font-weight:700;padding:15px;border-radius:10px;border:none;cursor:pointer">Enviar consulta</button>
        </form>
      </div>
    </div>
  </div>
</section>

<!-- FOOTER -->
<footer style="background:#1c1008;color:rgba(255,255,255,0.65);padding:48px 40px;${FS}">
  <div style="max-width:1100px;margin:0 auto;display:grid;grid-template-columns:2fr 1fr 1fr;gap:48px">
    <div>
      <span style="font-size:18px;font-weight:800;color:#fde68a;display:block;margin-bottom:14px">InmobiliariaPlus</span>
      <p style="font-size:14px;line-height:1.75;margin:0;max-width:300px">Agencia inmobiliaria con presencia nacional, especializada en propiedades residenciales y comerciales.</p>
    </div>
    <div>
      <h4 style="color:white;font-size:13px;font-weight:700;margin:0 0 16px;text-transform:uppercase;letter-spacing:0.08em">Paginas</h4>
      <ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:10px">
        <li><a href="/propiedades" style="color:rgba(255,255,255,0.65);text-decoration:none;font-size:14px">Propiedades</a></li>
        <li><a href="/nosotros" style="color:rgba(255,255,255,0.65);text-decoration:none;font-size:14px">Nosotros</a></li>
        <li><a href="/blog" style="color:rgba(255,255,255,0.65);text-decoration:none;font-size:14px">Blog</a></li>
        <li><a href="/contacto" style="color:rgba(255,255,255,0.65);text-decoration:none;font-size:14px">Contacto</a></li>
      </ul>
    </div>
    <div>
      <h4 style="color:white;font-size:13px;font-weight:700;margin:0 0 16px;text-transform:uppercase;letter-spacing:0.08em">Contacto</h4>
      <div style="display:flex;flex-direction:column;gap:10px;font-size:14px">
        <span>Av. Reforma 500, CDMX</span>
        <span>Tel: (55) 5555-0000</span>
        <span>info@inmobiliariaplus.com</span>
        <span>Lun-Sab 9:00 - 19:00</span>
      </div>
    </div>
  </div>
  <div style="max-width:1100px;margin:32px auto 0;padding-top:24px;border-top:1px solid rgba(255,255,255,0.1);text-align:center;font-size:13px">
    &copy; 2025 InmobiliariaPlus. Todos los derechos reservados.
  </div>
</footer>
`,
    },
  ],
}
