const F = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"

const inputStyle = `width:100%;box-sizing:border-box;border:2px solid #e2e8f0;border-radius:10px;padding:12px 16px;font-size:15px;color:#0f172a;outline:none;transition:border-color 0.15s;background:white`
const labelStyle = `display:block;font-size:14px;font-weight:600;color:#374151;margin-bottom:6px`
const btnStyle = `width:100%;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:white;font-size:16px;font-weight:700;padding:15px;border:none;border-radius:12px;cursor:pointer;letter-spacing:-0.01em`

export const formsBlocks = [
  {
    id: 'form-contact-simple',
    label: 'Formulario simple',
    category: 'Formularios',
    content: `<section style="padding:80px 24px;background:#f8fafc;${F}">
  <div style="max-width:560px;margin:0 auto">
    <div style="text-align:center;margin-bottom:48px">
      <h2 style="font-size:clamp(26px,4vw,40px);font-weight:800;color:#0f172a;margin:0 0 12px;letter-spacing:-0.025em">Contactanos</h2>
      <p style="font-size:16px;color:#64748b;margin:0;line-height:1.7">Respondemos en menos de 24 horas. Estaremos encantados de ayudarte.</p>
    </div>
    <div style="background:white;border-radius:24px;padding:40px;box-shadow:0 2px 20px rgba(0,0,0,0.06)">
      <form>
        <div style="margin-bottom:20px">
          <label style="${labelStyle}">Nombre completo</label>
          <input type="text" placeholder="Tu nombre" style="${inputStyle}">
        </div>
        <div style="margin-bottom:20px">
          <label style="${labelStyle}">Correo electronico</label>
          <input type="email" placeholder="tu@correo.com" style="${inputStyle}">
        </div>
        <div style="margin-bottom:28px">
          <label style="${labelStyle}">Mensaje</label>
          <textarea placeholder="Cuentanos como podemos ayudarte..." rows="5" style="${inputStyle};resize:vertical;font-family:inherit"></textarea>
        </div>
        <button type="submit" style="${btnStyle}">Enviar mensaje</button>
        <p style="font-size:13px;color:#94a3b8;text-align:center;margin:14px 0 0">Al enviar aceptas nuestra politica de privacidad.</p>
      </form>
    </div>
  </div>
</section>`,
  },
  {
    id: 'form-contact-full',
    label: 'Formulario completo',
    category: 'Formularios',
    content: `<section style="padding:80px 24px;background:white;${F}">
  <div style="max-width:1100px;margin:0 auto;display:grid;grid-template-columns:1fr 1.6fr;gap:64px;align-items:start">
    <div>
      <h2 style="font-size:clamp(26px,3.5vw,40px);font-weight:800;color:#0f172a;margin:0 0 16px;line-height:1.2;letter-spacing:-0.025em">Hablemos de tu proyecto</h2>
      <p style="font-size:16px;color:#64748b;line-height:1.8;margin:0 0 32px">Completamos tu solicitud y nos pondremos en contacto contigo a la brevedad posible.</p>
      <div style="display:flex;flex-direction:column;gap:20px">
        <div style="display:flex;gap:14px;align-items:center">
          <div style="width:44px;height:44px;min-width:44px;background:#ede9fe;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:20px">&#128222;</div>
          <div><p style="font-weight:700;color:#0f172a;font-size:14px;margin:0 0 2px">Telefono</p><p style="color:#64748b;font-size:14px;margin:0">+1 (555) 000-0000</p></div>
        </div>
        <div style="display:flex;gap:14px;align-items:center">
          <div style="width:44px;height:44px;min-width:44px;background:#d1fae5;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:20px">&#128231;</div>
          <div><p style="font-weight:700;color:#0f172a;font-size:14px;margin:0 0 2px">Correo</p><p style="color:#64748b;font-size:14px;margin:0">hola@tunegocio.com</p></div>
        </div>
        <div style="display:flex;gap:14px;align-items:center">
          <div style="width:44px;height:44px;min-width:44px;background:#fef3c7;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:20px">&#128205;</div>
          <div><p style="font-weight:700;color:#0f172a;font-size:14px;margin:0 0 2px">Direccion</p><p style="color:#64748b;font-size:14px;margin:0">Calle Principal 123, Ciudad</p></div>
        </div>
      </div>
    </div>
    <div style="background:#f8fafc;border-radius:24px;padding:40px">
      <form>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
          <div>
            <label style="${labelStyle}">Nombre</label>
            <input type="text" placeholder="Tu nombre" style="${inputStyle}">
          </div>
          <div>
            <label style="${labelStyle}">Apellido</label>
            <input type="text" placeholder="Tu apellido" style="${inputStyle}">
          </div>
        </div>
        <div style="margin-bottom:16px">
          <label style="${labelStyle}">Correo electronico</label>
          <input type="email" placeholder="tu@correo.com" style="${inputStyle}">
        </div>
        <div style="margin-bottom:16px">
          <label style="${labelStyle}">Telefono</label>
          <input type="tel" placeholder="+1 (555) 000-0000" style="${inputStyle}">
        </div>
        <div style="margin-bottom:16px">
          <label style="${labelStyle}">Asunto</label>
          <select style="${inputStyle}">
            <option value="">Selecciona un tema</option>
            <option>Informacion general</option>
            <option>Cotizacion</option>
            <option>Soporte tecnico</option>
            <option>Otro</option>
          </select>
        </div>
        <div style="margin-bottom:28px">
          <label style="${labelStyle}">Mensaje</label>
          <textarea placeholder="Describe tu consulta o proyecto..." rows="5" style="${inputStyle};resize:vertical;font-family:inherit"></textarea>
        </div>
        <button type="submit" style="${btnStyle}">Enviar solicitud</button>
      </form>
    </div>
  </div>
</section>`,
  },
  {
    id: 'form-newsletter',
    label: 'Suscripcion newsletter',
    category: 'Formularios',
    content: `<section style="background:linear-gradient(135deg,#312e81,#4f46e5);padding:80px 24px;text-align:center;${F}">
  <div style="max-width:560px;margin:0 auto">
    <span style="display:inline-block;background:rgba(255,255,255,0.15);color:rgba(255,255,255,0.9);font-size:12px;font-weight:700;letter-spacing:0.14em;padding:5px 18px;border-radius:999px;margin-bottom:20px;text-transform:uppercase">Newsletter</span>
    <h2 style="font-size:clamp(24px,4vw,40px);font-weight:800;color:white;margin:0 0 14px;line-height:1.2;letter-spacing:-0.025em">Mantente al dia con nosotros</h2>
    <p style="font-size:16px;color:rgba(255,255,255,0.8);line-height:1.7;margin:0 0 36px">Recibe novedades, ofertas exclusivas y contenido de valor directamente en tu bandeja de entrada.</p>
    <form style="display:flex;gap:12px;max-width:460px;margin:0 auto;flex-wrap:wrap">
      <input type="email" placeholder="tu@correo.com" style="flex:1;min-width:220px;border:2px solid rgba(255,255,255,0.2);background:rgba(255,255,255,0.12);color:white;border-radius:10px;padding:14px 18px;font-size:15px;outline:none;placeholder-color:rgba(255,255,255,0.5)">
      <button type="submit" style="background:white;color:#4f46e5;font-size:15px;font-weight:700;padding:14px 28px;border:none;border-radius:10px;cursor:pointer;white-space:nowrap">Suscribirse</button>
    </form>
    <p style="font-size:13px;color:rgba(255,255,255,0.55);margin:14px 0 0">Sin spam. Cancela cuando quieras.</p>
  </div>
</section>`,
  },
  {
    id: 'form-booking',
    label: 'Formulario de reserva',
    category: 'Formularios',
    content: `<section style="padding:80px 24px;background:#f8fafc;${F}">
  <div style="max-width:700px;margin:0 auto">
    <div style="text-align:center;margin-bottom:48px">
      <h2 style="font-size:clamp(26px,4vw,42px);font-weight:800;color:#0f172a;margin:0 0 12px;letter-spacing:-0.025em">Reserva tu cita</h2>
      <p style="font-size:16px;color:#64748b;margin:0;line-height:1.7">Elige el dia y horario que mejor se adapte a tu agenda. Te confirmaremos en breve.</p>
    </div>
    <div style="background:white;border-radius:24px;padding:40px;box-shadow:0 2px 20px rgba(0,0,0,0.06)">
      <form>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
          <div>
            <label style="${labelStyle}">Nombre completo</label>
            <input type="text" placeholder="Tu nombre" style="${inputStyle}">
          </div>
          <div>
            <label style="${labelStyle}">Telefono</label>
            <input type="tel" placeholder="+1 (555) 000-0000" style="${inputStyle}">
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
          <div>
            <label style="${labelStyle}">Fecha</label>
            <input type="date" style="${inputStyle}">
          </div>
          <div>
            <label style="${labelStyle}">Hora</label>
            <select style="${inputStyle}">
              <option value="">Selecciona horario</option>
              <option>09:00 am</option>
              <option>10:00 am</option>
              <option>11:00 am</option>
              <option>12:00 pm</option>
              <option>02:00 pm</option>
              <option>03:00 pm</option>
              <option>04:00 pm</option>
              <option>05:00 pm</option>
            </select>
          </div>
        </div>
        <div style="margin-bottom:16px">
          <label style="${labelStyle}">Servicio</label>
          <select style="${inputStyle}">
            <option value="">Selecciona un servicio</option>
            <option>Servicio basico</option>
            <option>Servicio estandar</option>
            <option>Servicio premium</option>
          </select>
        </div>
        <div style="margin-bottom:28px">
          <label style="${labelStyle}">Notas adicionales</label>
          <textarea placeholder="Algun detalle que debamos saber..." rows="3" style="${inputStyle};resize:vertical;font-family:inherit"></textarea>
        </div>
        <button type="submit" style="${btnStyle}">Confirmar reserva</button>
      </form>
    </div>
  </div>
</section>`,
  },
]
