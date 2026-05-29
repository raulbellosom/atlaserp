const F = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"

export const textoBlocks = [
  {
    id: 'heading',
    label: 'Titulo centrado',
    category: 'Texto',
    content: `<div style="padding:64px 24px;text-align:center;${F}">
  <h2 style="font-size:clamp(32px,5vw,60px);font-weight:800;color:#0f172a;line-height:1.15;letter-spacing:-0.03em;margin:0 auto;max-width:800px">Tu titulo va aqui. Hazlo memorable.</h2>
  <p style="font-size:19px;color:#64748b;margin:20px auto 0;max-width:560px;line-height:1.7">Agrega un subtitulo opcional que refuerce el mensaje y guie al visitante.</p>
</div>`,
  },
  {
    id: 'heading-left',
    label: 'Titulo con insignia',
    category: 'Texto',
    content: `<div style="padding:64px 24px;${F}">
  <div style="max-width:860px;margin:0 auto">
    <span style="color:#6366f1;font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;display:block;margin-bottom:14px">Seccion</span>
    <h2 style="font-size:clamp(28px,4.5vw,52px);font-weight:800;color:#0f172a;line-height:1.15;letter-spacing:-0.03em;margin:0 0 18px;max-width:640px">Un titulo impactante que captura la atencion del lector.</h2>
    <p style="font-size:18px;color:#64748b;line-height:1.75;max-width:560px;margin:0">Texto complementario que amplia el mensaje principal y guia al lector hacia la accion deseada.</p>
  </div>
</div>`,
  },
  {
    id: 'text',
    label: 'Parrafo',
    category: 'Texto',
    content: `<div style="padding:40px 24px;${F}">
  <div style="max-width:740px;margin:0 auto">
    <p style="font-size:17px;color:#334155;line-height:1.9;margin:0">Escribe aqui el contenido de tu parrafo. Puedes editar este texto directamente haciendo doble clic sobre el. El texto puede ser tan largo como necesites y se adaptara automaticamente al ancho disponible sin romper el diseno.</p>
  </div>
</div>`,
  },
  {
    id: 'quote',
    label: 'Cita destacada',
    category: 'Texto',
    content: `<div style="padding:80px 24px;background:#f8fafc;${F}">
  <div style="max-width:760px;margin:0 auto;text-align:center">
    <div style="width:48px;height:4px;background:linear-gradient(90deg,#4f46e5,#7c3aed);border-radius:2px;margin:0 auto 32px"></div>
    <blockquote style="font-size:clamp(22px,3.2vw,34px);font-weight:700;color:#0f172a;line-height:1.45;margin:0 0 28px;font-style:italic;letter-spacing:-0.01em">"La excelencia no es un acto aislado, es el resultado de hacer bien las cosas cada dia."</blockquote>
    <cite style="font-size:15px;color:#6366f1;font-weight:600;font-style:normal">Nombre del autor &mdash; Cargo o empresa</cite>
  </div>
</div>`,
  },
  {
    id: 'list-features',
    label: 'Lista de ventajas',
    category: 'Texto',
    content: `<div style="padding:60px 24px;background:white;${F}">
  <div style="max-width:640px;margin:0 auto">
    <h3 style="font-size:26px;font-weight:800;color:#0f172a;margin:0 0 32px;letter-spacing:-0.02em">Por que elegirnos</h3>
    <ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:20px">
      <li style="display:flex;gap:14px;align-items:flex-start">
        <span style="width:26px;height:26px;min-width:26px;background:linear-gradient(135deg,#6366f1,#4f46e5);border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-size:13px;font-weight:700;margin-top:1px">&#10003;</span>
        <div><p style="font-weight:700;color:#0f172a;font-size:16px;margin:0 0 4px">Primer beneficio clave</p><p style="color:#64748b;font-size:14px;line-height:1.65;margin:0">Descripcion que explica el valor concreto de este beneficio para tu cliente ideal.</p></div>
      </li>
      <li style="display:flex;gap:14px;align-items:flex-start">
        <span style="width:26px;height:26px;min-width:26px;background:linear-gradient(135deg,#6366f1,#4f46e5);border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-size:13px;font-weight:700;margin-top:1px">&#10003;</span>
        <div><p style="font-weight:700;color:#0f172a;font-size:16px;margin:0 0 4px">Segundo beneficio diferenciador</p><p style="color:#64748b;font-size:14px;line-height:1.65;margin:0">Lo que te hace unico frente a la competencia. Sencillo, directo y convincente.</p></div>
      </li>
      <li style="display:flex;gap:14px;align-items:flex-start">
        <span style="width:26px;height:26px;min-width:26px;background:linear-gradient(135deg,#6366f1,#4f46e5);border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-size:13px;font-weight:700;margin-top:1px">&#10003;</span>
        <div><p style="font-weight:700;color:#0f172a;font-size:16px;margin:0 0 4px">Tercer beneficio de confianza</p><p style="color:#64748b;font-size:14px;line-height:1.65;margin:0">El argumento final que elimina la duda y lleva al visitante a tomar accion.</p></div>
      </li>
    </ul>
  </div>
</div>`,
  },
]
