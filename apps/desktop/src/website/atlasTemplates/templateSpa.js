const F = "font-family:Georgia,'Playfair Display',serif"
const FS = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"

export const templateSpa = {
  id: 'spa',
  label: 'Spa / Bienestar',
  description: 'Perfecto para spas, centros de bienestar, yoga y belleza. Elegante y sereno.',
  color: '#065f46',
  html: `
<!-- NAV -->
<nav style="position:fixed;top:0;left:0;right:0;z-index:100;background:rgba(255,255,255,0.92);backdrop-filter:blur(12px);padding:0 40px;height:68px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(0,0,0,0.06);${FS}">
  <span style="font-size:20px;font-weight:300;color:#065f46;letter-spacing:0.08em;text-transform:uppercase">Serenity Spa</span>
  <div style="display:flex;gap:28px;align-items:center">
    <a href="#servicios" style="color:#374151;text-decoration:none;font-size:14px;font-weight:500">Servicios</a>
    <a href="#galeria" style="color:#374151;text-decoration:none;font-size:14px;font-weight:500">Galeria</a>
    <a href="#equipo" style="color:#374151;text-decoration:none;font-size:14px;font-weight:500">Equipo</a>
    <a href="#reservar" style="background:#065f46;color:white;text-decoration:none;font-size:14px;font-weight:600;padding:10px 24px;border-radius:999px">Reservar cita</a>
  </div>
</nav>

<!-- HERO -->
<section style="min-height:100vh;position:relative;display:flex;align-items:center;justify-content:center;padding:80px 24px;overflow:hidden;${F}">
  <div style="position:absolute;inset:0;background-image:url('https://placehold.co/1920x1080/d1fae5/6ee7b7?text=Ambiente+spa');background-size:cover;background-position:center"></div>
  <div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(255,255,255,0.15) 0%,rgba(6,95,70,0.6) 100%)"></div>
  <div style="position:relative;z-index:1;text-align:center;max-width:700px">
    <p style="font-size:13px;color:#d1fae5;letter-spacing:0.2em;text-transform:uppercase;margin:0 0 20px;${FS}">Bienvenida al equilibrio</p>
    <h1 style="font-size:clamp(44px,6.5vw,80px);font-weight:300;color:white;line-height:1.08;margin:0 0 24px">Encuentra tu<br><em style="font-style:italic">paz interior</em></h1>
    <p style="font-size:18px;color:rgba(255,255,255,0.88);line-height:1.75;margin:0 0 44px;max-width:480px;margin-left:auto;margin-right:auto;${FS}">Un santuario de tranquilidad donde el cuerpo y la mente se renuevan en perfecta armonia.</p>
    <a href="#reservar" style="display:inline-block;background:white;color:#065f46;font-size:16px;font-weight:700;padding:16px 44px;border-radius:999px;text-decoration:none;${FS}">Reservar mi experiencia</a>
  </div>
</section>

<!-- SERVICIOS -->
<section id="servicios" style="padding:100px 24px;background:white;${FS}">
  <div style="max-width:1100px;margin:0 auto">
    <div style="text-align:center;margin-bottom:64px">
      <p style="color:#065f46;font-size:13px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;margin:0 0 12px">Nuestros servicios</p>
      <h2 style="font-size:clamp(30px,4.5vw,50px);font-weight:300;color:#0f172a;margin:0;${F}">Rituales de bienestar</h2>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:24px">
      <div style="background:#f0fdf4;border-radius:20px;padding:36px;text-align:center">
        <div style="width:56px;height:56px;background:#d1fae5;border-radius:16px;margin:0 auto 20px;display:flex;align-items:center;justify-content:center;font-size:26px">&#128148;</div>
        <h3 style="font-size:19px;font-weight:700;color:#0f172a;margin:0 0 10px">Masaje relajante</h3>
        <p style="font-size:14px;color:#64748b;line-height:1.7;margin:0 0 16px">60 o 90 minutos de pura relajacion con aceites esenciales premium.</p>
        <span style="color:#065f46;font-size:18px;font-weight:700">desde $75</span>
      </div>
      <div style="background:#f0fdf4;border-radius:20px;padding:36px;text-align:center">
        <div style="width:56px;height:56px;background:#d1fae5;border-radius:16px;margin:0 auto 20px;display:flex;align-items:center;justify-content:center;font-size:26px">&#127774;</div>
        <h3 style="font-size:19px;font-weight:700;color:#0f172a;margin:0 0 10px">Facial renovador</h3>
        <p style="font-size:14px;color:#64748b;line-height:1.7;margin:0 0 16px">Tratamiento profundo que revitaliza y rejuvenece tu piel naturalmente.</p>
        <span style="color:#065f46;font-size:18px;font-weight:700">desde $90</span>
      </div>
      <div style="background:#f0fdf4;border-radius:20px;padding:36px;text-align:center">
        <div style="width:56px;height:56px;background:#d1fae5;border-radius:16px;margin:0 auto 20px;display:flex;align-items:center;justify-content:center;font-size:26px">&#127774;</div>
        <h3 style="font-size:19px;font-weight:700;color:#0f172a;margin:0 0 10px">Piedras calientes</h3>
        <p style="font-size:14px;color:#64748b;line-height:1.7;margin:0 0 16px">Terapia termal con piedras volcanicas para liberar tension profunda.</p>
        <span style="color:#065f46;font-size:18px;font-weight:700">desde $110</span>
      </div>
      <div style="background:#f0fdf4;border-radius:20px;padding:36px;text-align:center">
        <div style="width:56px;height:56px;background:#d1fae5;border-radius:16px;margin:0 auto 20px;display:flex;align-items:center;justify-content:center;font-size:26px">&#128300;</div>
        <h3 style="font-size:19px;font-weight:700;color:#0f172a;margin:0 0 10px">Aromaterapia</h3>
        <p style="font-size:14px;color:#64748b;line-height:1.7;margin:0 0 16px">Una experiencia sensorial completa con los mejores aceites esenciales.</p>
        <span style="color:#065f46;font-size:18px;font-weight:700">desde $80</span>
      </div>
    </div>
  </div>
</section>

<!-- GALERIA -->
<section id="galeria" style="padding:72px 24px;background:#f0fdf4;${FS}">
  <div style="max-width:1100px;margin:0 auto">
    <div style="text-align:center;margin-bottom:48px">
      <h2 style="font-size:clamp(28px,4vw,44px);font-weight:300;color:#0f172a;margin:0;${F}">Nuestro espacio</h2>
    </div>
    <div style="display:grid;grid-template-columns:2fr 1fr 1fr;grid-template-rows:1fr 1fr;gap:12px;height:520px">
      <img src="https://placehold.co/800x520/bbf7d0/065f46?text=Sala+principal" style="width:100%;height:100%;object-fit:cover;border-radius:16px;display:block;grid-row:span 2">
      <img src="https://placehold.co/400x250/a7f3d0/047857?text=Cabina+1" style="width:100%;height:100%;object-fit:cover;border-radius:16px;display:block">
      <img src="https://placehold.co/400x250/6ee7b7/065f46?text=Cabina+2" style="width:100%;height:100%;object-fit:cover;border-radius:16px;display:block">
      <img src="https://placehold.co/400x250/34d399/047857?text=Relax" style="width:100%;height:100%;object-fit:cover;border-radius:16px;display:block">
      <img src="https://placehold.co/400x250/10b981/064e3b?text=Lounge" style="width:100%;height:100%;object-fit:cover;border-radius:16px;display:block">
    </div>
  </div>
</section>

<!-- RESERVAR -->
<section id="reservar" style="padding:100px 24px;background:white;${FS}">
  <div style="max-width:620px;margin:0 auto;text-align:center">
    <p style="color:#065f46;font-size:13px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;margin:0 0 12px">Agenda tu cita</p>
    <h2 style="font-size:clamp(28px,4vw,44px);font-weight:300;color:#0f172a;margin:0 0 14px;${F}">Reserva tu experiencia</h2>
    <p style="font-size:16px;color:#64748b;margin:0 0 48px;line-height:1.7">Elige el servicio y el horario que mas te convenga. Te confirmaremos en breve.</p>
    <div style="background:#f0fdf4;border-radius:24px;padding:40px;border:2px solid #d1fae5">
      <form style="display:flex;flex-direction:column;gap:16px">
        <select style="border:2px solid #d1fae5;background:white;color:#0f172a;border-radius:10px;padding:13px 16px;font-size:15px;outline:none">
          <option value="">Selecciona un servicio</option>
          <option>Masaje relajante (60 min) - $75</option>
          <option>Masaje relajante (90 min) - $105</option>
          <option>Facial renovador - $90</option>
          <option>Piedras calientes - $110</option>
          <option>Aromaterapia - $80</option>
        </select>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
          <input type="text" placeholder="Nombre completo" style="border:2px solid #d1fae5;background:white;border-radius:10px;padding:13px 16px;font-size:15px;outline:none">
          <input type="tel" placeholder="Telefono" style="border:2px solid #d1fae5;background:white;border-radius:10px;padding:13px 16px;font-size:15px;outline:none">
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
          <input type="date" style="border:2px solid #d1fae5;background:white;border-radius:10px;padding:13px 16px;font-size:15px;outline:none">
          <select style="border:2px solid #d1fae5;background:white;color:#0f172a;border-radius:10px;padding:13px 16px;font-size:15px;outline:none">
            <option>09:00 am</option><option>10:00 am</option><option>11:00 am</option><option>12:00 pm</option><option>02:00 pm</option><option>03:00 pm</option><option>04:00 pm</option>
          </select>
        </div>
        <button type="submit" style="background:#065f46;color:white;font-size:16px;font-weight:700;padding:15px;border:none;border-radius:10px;cursor:pointer">Confirmar reserva</button>
      </form>
    </div>
  </div>
</section>

<!-- FOOTER -->
<footer style="background:#064e3b;padding:40px 24px;text-align:center;${FS}">
  <p style="color:rgba(255,255,255,0.5);font-size:14px;margin:0">&#169; 2025 Serenity Spa &middot; Calle del Bienestar 456 &middot; contacto@serenityspa.com</p>
</footer>
`,
}
