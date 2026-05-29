export function buildGrapesConfig(container, { token = null, apiUrl = 'http://localhost:4010' } = {}) {
  return {
    container,
    height: '100%',
    width: 'auto',
    fromElement: false,
    storageManager: false,

    canvas: {
      styles: ['https://cdn.tailwindcss.com'],
    },

    deviceManager: {
      devices: [
        { name: 'Desktop', width: '' },
        { name: 'Tablet', width: '768px', widthMedia: '768px' },
        { name: 'Mobile', width: '375px', widthMedia: '375px' },
      ],
    },

    // ── Asset Manager (atlas.files integration) ─────────────────────────────
    assetManager: {
      assets: [],
      uploadText: 'Arrastra imagenes aqui o haz clic para subir desde tu dispositivo',
      addBtnText: 'Agregar URL de imagen',
      inputPlaceholder: 'https://...',

      // Custom upload → sends file to atlas.files, returns the signed URL
      uploadFile: token
        ? async (ev, clb) => {
            const files = ev.dataTransfer ? ev.dataTransfer.files : ev.target?.files
            if (!files?.length) return
            try {
              const fd = new FormData()
              fd.append('file', files[0])
              fd.append('moduleKey', 'atlas.website')
              fd.append('entityType', 'media')

              const uploadRes = await fetch(`${apiUrl}/files`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: fd,
              })
              if (!uploadRes.ok) throw new Error(`Upload failed: HTTP ${uploadRes.status}`)
              const uploadData = await uploadRes.json()
              const fileId = uploadData.data?.id ?? uploadData.id

              const urlRes = await fetch(`${apiUrl}/files/${fileId}/signed-url`, {
                headers: { Authorization: `Bearer ${token}` },
              })
              if (!urlRes.ok) throw new Error('Could not get signed URL')
              const urlData = await urlRes.json()
              const src = urlData.data?.signedUrl ?? urlData.signedUrl
              if (src) clb([src])
            } catch (err) {
              console.error('[atlas-files] upload error:', err.message)
            }
          }
        : undefined,
    },

    styleManager: {
      sectors: [
        {
          name: 'Dimension',
          open: false,
          properties: ['width', 'height', 'max-width', 'min-height', 'margin', 'padding'],
        },
        {
          name: 'Tipografia',
          open: false,
          properties: ['font-family', 'font-size', 'font-weight', 'color', 'line-height', 'text-align', 'letter-spacing'],
        },
        {
          name: 'Fondo',
          open: false,
          properties: ['background-color', 'background', 'opacity'],
        },
        {
          name: 'Bordes',
          open: false,
          properties: ['border-radius', 'border', 'box-shadow'],
        },
      ],
    },

    blockManager: {
      blocks: [
        // ─── Secciones ───────────────────────────────────────────────────────
        {
          id: 'hero-gradient',
          label: 'Hero degradado',
          category: 'Secciones',
          content: `
<section style="min-height:100vh;background:linear-gradient(135deg,#312e81 0%,#4f46e5 55%,#7c3aed 100%);display:flex;align-items:center;justify-content:center;padding:60px 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:720px;text-align:center">
    <span style="display:inline-block;background:rgba(255,255,255,0.14);color:#c7d2fe;font-size:12px;font-weight:700;letter-spacing:0.12em;padding:6px 20px;border-radius:999px;margin-bottom:28px;text-transform:uppercase">Nuevo en 2024</span>
    <h1 style="font-size:clamp(38px,6vw,72px);font-weight:800;color:white;line-height:1.1;margin:0 0 24px;letter-spacing:-0.03em">La plataforma que <em style="color:#a5b4fc;font-style:normal">transforma</em> tu negocio</h1>
    <p style="font-size:20px;color:rgba(255,255,255,0.75);line-height:1.7;margin:0 0 44px;max-width:540px;margin-left:auto;margin-right:auto">Gestiona cada aspecto de tu empresa desde un solo lugar. Simple, potente y disenado para crecer contigo.</p>
    <div style="display:flex;gap:16px;justify-content:center;flex-wrap:wrap">
      <a href="#" style="background:white;color:#4338ca;font-size:16px;font-weight:700;padding:15px 36px;border-radius:12px;text-decoration:none;display:inline-block;letter-spacing:-0.01em">Comenzar gratis</a>
      <a href="#" style="background:rgba(255,255,255,0.12);color:white;font-size:16px;font-weight:600;padding:15px 36px;border-radius:12px;text-decoration:none;display:inline-block;border:2px solid rgba(255,255,255,0.3)">Ver demo &rarr;</a>
    </div>
  </div>
</section>`,
        },
        {
          id: 'hero-dark',
          label: 'Hero oscuro',
          category: 'Secciones',
          content: `
<section style="min-height:100vh;background:#0f172a;display:flex;align-items:center;justify-content:center;padding:60px 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:760px;text-align:center">
    <div style="display:inline-flex;align-items:center;gap:8px;background:#1e293b;border:1px solid #334155;border-radius:999px;padding:6px 16px;margin-bottom:32px">
      <span style="width:8px;height:8px;background:#22c55e;border-radius:50%;display:inline-block"></span>
      <span style="color:#94a3b8;font-size:13px;font-weight:500">Disponible ahora</span>
    </div>
    <h1 style="font-size:clamp(36px,5.5vw,68px);font-weight:900;color:white;line-height:1.1;margin:0 0 24px;letter-spacing:-0.03em">El sistema ERP que tu empresa necesitaba</h1>
    <p style="font-size:19px;color:#94a3b8;line-height:1.7;margin:0 0 48px;max-width:560px;margin-left:auto;margin-right:auto">Automatiza procesos, reduce errores y enfoca a tu equipo en lo que realmente importa.</p>
    <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
      <a href="#" style="background:#6366f1;color:white;font-size:16px;font-weight:700;padding:15px 36px;border-radius:10px;text-decoration:none;display:inline-block">Solicitar acceso</a>
      <a href="#" style="background:transparent;color:#e2e8f0;font-size:16px;font-weight:500;padding:15px 36px;border-radius:10px;text-decoration:none;display:inline-block;border:1px solid #334155">Conocer mas</a>
    </div>
  </div>
</section>`,
        },
        {
          id: 'features',
          label: 'Caracteristicas',
          category: 'Secciones',
          content: `
<section style="padding:100px 24px;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:1100px;margin:0 auto">
    <div style="text-align:center;margin-bottom:72px">
      <span style="color:#6366f1;font-size:13px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase">Por que elegirnos</span>
      <h2 style="font-size:clamp(28px,4vw,48px);font-weight:800;color:#0f172a;margin:14px 0 18px;line-height:1.15;letter-spacing:-0.025em">Todo lo que necesitas,<br>en un solo lugar</h2>
      <p style="font-size:18px;color:#64748b;max-width:500px;margin:0 auto;line-height:1.7">Herramientas disenadas para que tu equipo trabaje mas rapido y con mayor claridad.</p>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:28px">
      <div style="background:white;border-radius:24px;padding:36px;box-shadow:0 1px 3px rgba(0,0,0,0.05),0 8px 24px rgba(0,0,0,0.04)">
        <div style="width:56px;height:56px;background:linear-gradient(135deg,#818cf8,#4f46e5);border-radius:16px;display:flex;align-items:center;justify-content:center;margin-bottom:24px;font-size:26px">&#x26A1;</div>
        <h3 style="font-size:20px;font-weight:700;color:#0f172a;margin:0 0 12px">Velocidad extrema</h3>
        <p style="font-size:15px;color:#64748b;line-height:1.7;margin:0">Respuestas en milisegundos. Tu equipo no espera, el negocio no se detiene nunca.</p>
      </div>
      <div style="background:white;border-radius:24px;padding:36px;box-shadow:0 1px 3px rgba(0,0,0,0.05),0 8px 24px rgba(0,0,0,0.04)">
        <div style="width:56px;height:56px;background:linear-gradient(135deg,#34d399,#059669);border-radius:16px;display:flex;align-items:center;justify-content:center;margin-bottom:24px;font-size:26px">&#x1F6E1;</div>
        <h3 style="font-size:20px;font-weight:700;color:#0f172a;margin:0 0 12px">Seguridad total</h3>
        <p style="font-size:15px;color:#64748b;line-height:1.7;margin:0">Datos protegidos con cifrado bancario. Cumple con todas las normativas internacionales.</p>
      </div>
      <div style="background:white;border-radius:24px;padding:36px;box-shadow:0 1px 3px rgba(0,0,0,0.05),0 8px 24px rgba(0,0,0,0.04)">
        <div style="width:56px;height:56px;background:linear-gradient(135deg,#fb923c,#ea580c);border-radius:16px;display:flex;align-items:center;justify-content:center;margin-bottom:24px;font-size:26px">&#x1F4CA;</div>
        <h3 style="font-size:20px;font-weight:700;color:#0f172a;margin:0 0 12px">Analitica avanzada</h3>
        <p style="font-size:15px;color:#64748b;line-height:1.7;margin:0">Reportes en tiempo real para tomar decisiones basadas en datos, no en suposiciones.</p>
      </div>
    </div>
  </div>
</section>`,
        },
        {
          id: 'cta',
          label: 'Llamada a accion',
          category: 'Secciones',
          content: `
<section style="background:linear-gradient(135deg,#1e1b4b 0%,#312e81 100%);padding:100px 24px;text-align:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:640px;margin:0 auto">
    <h2 style="font-size:clamp(30px,4.5vw,52px);font-weight:800;color:white;line-height:1.15;margin:0 0 20px;letter-spacing:-0.025em">Listo para dar el siguiente paso?</h2>
    <p style="font-size:18px;color:#c7d2fe;line-height:1.7;margin:0 0 44px;max-width:480px;margin-left:auto;margin-right:auto">Unete a cientos de empresas que ya confian en nuestra plataforma para crecer.</p>
    <a href="#" style="display:inline-block;background:#6366f1;color:white;font-size:17px;font-weight:700;padding:17px 48px;border-radius:14px;text-decoration:none;letter-spacing:-0.01em">Solicitar una demo gratuita</a>
    <p style="font-size:14px;color:#818cf8;margin:20px 0 0">Sin tarjeta de credito &middot; Cancela cuando quieras</p>
  </div>
</section>`,
        },
        {
          id: 'testimonials',
          label: 'Testimonios',
          category: 'Secciones',
          content: `
<section style="padding:100px 24px;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:1100px;margin:0 auto">
    <div style="text-align:center;margin-bottom:64px">
      <span style="color:#6366f1;font-size:13px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase">Testimonios</span>
      <h2 style="font-size:clamp(28px,4vw,46px);font-weight:800;color:#0f172a;margin:14px 0 0;line-height:1.15;letter-spacing:-0.025em">Lo que dicen nuestros clientes</h2>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:24px">
      <div style="background:white;border-radius:22px;padding:32px;box-shadow:0 2px 16px rgba(0,0,0,0.05)">
        <div style="color:#f59e0b;font-size:18px;letter-spacing:2px;margin-bottom:16px">&#9733;&#9733;&#9733;&#9733;&#9733;</div>
        <p style="font-size:16px;color:#334155;line-height:1.75;margin:0 0 24px;font-style:italic">"Desde que implementamos esta plataforma, nuestra productividad aumento un 40%. El soporte es increible."</p>
        <div style="display:flex;align-items:center;gap:12px">
          <div style="width:46px;height:46px;border-radius:50%;background:linear-gradient(135deg,#818cf8,#4f46e5);display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:17px;flex-shrink:0">A</div>
          <div><p style="font-weight:700;color:#0f172a;margin:0;font-size:15px">Ana Garcia</p><p style="color:#94a3b8;margin:0;font-size:13px">Directora, Empresa ABC</p></div>
        </div>
      </div>
      <div style="background:white;border-radius:22px;padding:32px;box-shadow:0 2px 16px rgba(0,0,0,0.05)">
        <div style="color:#f59e0b;font-size:18px;letter-spacing:2px;margin-bottom:16px">&#9733;&#9733;&#9733;&#9733;&#9733;</div>
        <p style="font-size:16px;color:#334155;line-height:1.75;margin:0 0 24px;font-style:italic">"La mejor decision que tomamos como empresa. El ROI fue visible desde el primer mes de uso."</p>
        <div style="display:flex;align-items:center;gap:12px">
          <div style="width:46px;height:46px;border-radius:50%;background:linear-gradient(135deg,#34d399,#059669);display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:17px;flex-shrink:0">C</div>
          <div><p style="font-weight:700;color:#0f172a;margin:0;font-size:15px">Carlos Mendez</p><p style="color:#94a3b8;margin:0;font-size:13px">CEO, StartupXYZ</p></div>
        </div>
      </div>
      <div style="background:white;border-radius:22px;padding:32px;box-shadow:0 2px 16px rgba(0,0,0,0.05)">
        <div style="color:#f59e0b;font-size:18px;letter-spacing:2px;margin-bottom:16px">&#9733;&#9733;&#9733;&#9733;&#9733;</div>
        <p style="font-size:16px;color:#334155;line-height:1.75;margin:0 0 24px;font-style:italic">"Increiblemente facil de usar. Nuestro equipo lo adopto desde el primer dia sin capacitacion."</p>
        <div style="display:flex;align-items:center;gap:12px">
          <div style="width:46px;height:46px;border-radius:50%;background:linear-gradient(135deg,#fb923c,#ea580c);display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:17px;flex-shrink:0">M</div>
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
          content: `
<section style="padding:80px 24px;background:linear-gradient(135deg,#312e81 0%,#4f46e5 100%);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:960px;margin:0 auto;text-align:center">
    <h2 style="font-size:clamp(24px,3.5vw,38px);font-weight:800;color:white;margin:0 0 12px;letter-spacing:-0.02em">Numeros que hablan por si solos</h2>
    <p style="font-size:17px;color:#c7d2fe;margin:0 0 60px">Miles de empresas ya confian en nosotros</p>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:48px">
      <div><p style="font-size:clamp(40px,6vw,64px);font-weight:900;color:white;margin:0;line-height:1;letter-spacing:-0.04em">5,000+</p><p style="font-size:15px;color:#a5b4fc;margin:10px 0 0;font-weight:500">Empresas activas</p></div>
      <div><p style="font-size:clamp(40px,6vw,64px);font-weight:900;color:white;margin:0;line-height:1;letter-spacing:-0.04em">99.9%</p><p style="font-size:15px;color:#a5b4fc;margin:10px 0 0;font-weight:500">Uptime garantizado</p></div>
      <div><p style="font-size:clamp(40px,6vw,64px);font-weight:900;color:white;margin:0;line-height:1;letter-spacing:-0.04em">24/7</p><p style="font-size:15px;color:#a5b4fc;margin:10px 0 0;font-weight:500">Soporte tecnico</p></div>
      <div><p style="font-size:clamp(40px,6vw,64px);font-weight:900;color:white;margin:0;line-height:1;letter-spacing:-0.04em">4.9&#9733;</p><p style="font-size:15px;color:#a5b4fc;margin:10px 0 0;font-weight:500">Calificacion promedio</p></div>
    </div>
  </div>
</section>`,
        },
        {
          id: 'faq',
          label: 'Preguntas frecuentes',
          category: 'Secciones',
          content: `
<section style="padding:100px 24px;background:white;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:720px;margin:0 auto">
    <div style="text-align:center;margin-bottom:64px">
      <span style="color:#6366f1;font-size:13px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase">FAQ</span>
      <h2 style="font-size:clamp(28px,4vw,46px);font-weight:800;color:#0f172a;margin:14px 0 0;line-height:1.15;letter-spacing:-0.025em">Preguntas frecuentes</h2>
    </div>
    <div>
      <div style="border-top:1px solid #e2e8f0;padding:28px 0">
        <h3 style="font-size:18px;font-weight:700;color:#0f172a;margin:0 0 12px">Como funciona el periodo de prueba?</h3>
        <p style="font-size:15px;color:#64748b;line-height:1.75;margin:0">Tienes 14 dias para probar todas las funcionalidades sin ninguna restriccion. No se requiere tarjeta de credito.</p>
      </div>
      <div style="border-top:1px solid #e2e8f0;padding:28px 0">
        <h3 style="font-size:18px;font-weight:700;color:#0f172a;margin:0 0 12px">Puedo cambiar de plan en cualquier momento?</h3>
        <p style="font-size:15px;color:#64748b;line-height:1.75;margin:0">Si, puedes actualizar o degradar tu plan cuando quieras. Los cambios se aplican de forma inmediata.</p>
      </div>
      <div style="border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;padding:28px 0">
        <h3 style="font-size:18px;font-weight:700;color:#0f172a;margin:0 0 12px">Mis datos estan seguros?</h3>
        <p style="font-size:15px;color:#64748b;line-height:1.75;margin:0">Usamos cifrado AES-256 y backups automaticos cada hora. Tu informacion siempre esta protegida.</p>
      </div>
    </div>
  </div>
</section>`,
        },
        {
          id: 'pricing',
          label: 'Precios',
          category: 'Secciones',
          content: `
<section style="padding:100px 24px;background:white;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:960px;margin:0 auto">
    <div style="text-align:center;margin-bottom:64px">
      <span style="color:#6366f1;font-size:13px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase">Precios</span>
      <h2 style="font-size:clamp(28px,4vw,46px);font-weight:800;color:#0f172a;margin:14px 0 16px;letter-spacing:-0.025em">Planes simples y transparentes</h2>
      <p style="font-size:17px;color:#64748b;margin:0">Sin costos ocultos. Cancela cuando quieras.</p>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:24px;align-items:start">
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
        <p style="margin:0 0 28px"><span style="font-size:36px;font-weight:900;color:#0f172a">Personalizado</span></p>
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

        // ─── Estructura ──────────────────────────────────────────────────────
        {
          id: 'two-columns',
          label: 'Imagen + Texto',
          category: 'Estructura',
          content: `
<div style="padding:80px 24px;background:white;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:1100px;margin:0 auto;display:grid;grid-template-columns:1fr 1fr;gap:72px;align-items:center">
    <div style="background:linear-gradient(135deg,#ede9fe,#ddd6fe);border-radius:24px;aspect-ratio:4/3;display:flex;align-items:center;justify-content:center;font-size:64px">&#x1F5BC;</div>
    <div>
      <span style="color:#6366f1;font-size:13px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase">Nosotros</span>
      <h2 style="font-size:clamp(28px,3.5vw,42px);font-weight:800;color:#0f172a;margin:14px 0 20px;line-height:1.2">Construido para equipos que quieren crecer</h2>
      <p style="font-size:16px;color:#64748b;line-height:1.8;margin:0 0 28px">Desde startups hasta grandes empresas, nuestra plataforma se adapta a las necesidades de cualquier equipo.</p>
      <a href="#" style="display:inline-block;background:#4f46e5;color:white;font-size:15px;font-weight:600;padding:13px 30px;border-radius:10px;text-decoration:none">Saber mas &rarr;</a>
    </div>
  </div>
</div>`,
        },
        {
          id: 'three-columns',
          label: '3 Columnas',
          category: 'Estructura',
          content: `
<div style="padding:80px 24px;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:1100px;margin:0 auto">
    <div style="text-align:center;margin-bottom:60px">
      <h2 style="font-size:clamp(28px,4vw,44px);font-weight:800;color:#0f172a;margin:0 0 16px">Nuestros servicios</h2>
      <p style="font-size:17px;color:#64748b;margin:0 auto;max-width:480px;line-height:1.7">Una suite completa de herramientas para digitalizar tu negocio.</p>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:24px">
      <div style="background:white;border-radius:20px;padding:32px;text-align:center"><div style="font-size:44px;margin-bottom:16px">&#x1F3AF;</div><h3 style="font-size:18px;font-weight:700;color:#0f172a;margin:0 0 10px">Servicio uno</h3><p style="font-size:14px;color:#64748b;line-height:1.7;margin:0">Descripcion del primer servicio.</p></div>
      <div style="background:white;border-radius:20px;padding:32px;text-align:center"><div style="font-size:44px;margin-bottom:16px">&#x1F4A1;</div><h3 style="font-size:18px;font-weight:700;color:#0f172a;margin:0 0 10px">Servicio dos</h3><p style="font-size:14px;color:#64748b;line-height:1.7;margin:0">Descripcion del segundo servicio.</p></div>
      <div style="background:white;border-radius:20px;padding:32px;text-align:center"><div style="font-size:44px;margin-bottom:16px">&#x1F680;</div><h3 style="font-size:18px;font-weight:700;color:#0f172a;margin:0 0 10px">Servicio tres</h3><p style="font-size:14px;color:#64748b;line-height:1.7;margin:0">Descripcion del tercer servicio.</p></div>
    </div>
  </div>
</div>`,
        },

        // ─── Texto ───────────────────────────────────────────────────────────
        {
          id: 'heading',
          label: 'Titulo',
          category: 'Texto',
          content: `<div style="padding:64px 24px;text-align:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"><h2 style="font-size:clamp(32px,5vw,60px);font-weight:800;color:#0f172a;line-height:1.15;letter-spacing:-0.03em;margin:0 auto;max-width:800px">Tu titulo va aqui. Hazlo memorable.</h2><p style="font-size:19px;color:#64748b;margin:20px auto 0;max-width:560px;line-height:1.7">Agrega un subtitulo opcional para dar mas contexto.</p></div>`,
        },
        {
          id: 'text',
          label: 'Parrafo',
          category: 'Texto',
          content: `<div style="padding:40px 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"><div style="max-width:740px;margin:0 auto"><p style="font-size:17px;color:#334155;line-height:1.9;margin:0">Escribe aqui el contenido de tu parrafo. Puedes editar este texto directamente haciendo doble clic sobre el.</p></div></div>`,
        },

        // ─── Media ───────────────────────────────────────────────────────────
        {
          id: 'image',
          label: 'Imagen',
          category: 'Media',
          content: `
<div style="padding:32px 24px;background:white;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:1100px;margin:0 auto">
    <img src="https://placehold.co/1200x500/e2e8f0/94a3b8?text=Doble+clic+para+cambiar+imagen" alt="Imagen" style="width:100%;border-radius:20px;display:block" />
    <p style="font-size:13px;color:#94a3b8;text-align:center;margin:12px 0 0;font-style:italic">Descripcion de la imagen (opcional)</p>
  </div>
</div>`,
        },
        {
          id: 'image-text',
          label: 'Imagen + Texto',
          category: 'Media',
          content: `
<div style="padding:80px 24px;background:white;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:1100px;margin:0 auto;display:grid;grid-template-columns:1fr 1fr;gap:56px;align-items:center">
    <img src="https://placehold.co/600x450/e2e8f0/94a3b8?text=Tu+imagen" alt="Imagen" style="width:100%;border-radius:20px;display:block" />
    <div>
      <h2 style="font-size:clamp(26px,3.5vw,40px);font-weight:800;color:#0f172a;margin:0 0 16px;line-height:1.2">Tu titulo aqui</h2>
      <p style="font-size:16px;color:#64748b;line-height:1.8;margin:0 0 28px">Describe tu mensaje principal. Puedes contar una historia, explicar un beneficio o presentar tu producto de forma visual.</p>
      <a href="#" style="display:inline-block;background:#4f46e5;color:white;font-size:15px;font-weight:600;padding:13px 30px;border-radius:10px;text-decoration:none">Saber mas &rarr;</a>
    </div>
  </div>
</div>`,
        },
      ],
    },
  }
}
