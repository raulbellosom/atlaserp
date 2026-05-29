const F = "font-family:Georgia,'Playfair Display',serif"
const FS = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"

export const templateRestaurante = {
  id: 'restaurante',
  label: 'Restaurante',
  description: 'Ideal para restaurantes, cafes y bares. Incluye menu, galeria y reservas.',
  color: '#92400e',
  html: `
<!-- NAV -->
<nav style="position:fixed;top:0;left:0;right:0;z-index:100;background:rgba(15,10,5,0.85);backdrop-filter:blur(12px);padding:0 40px;height:64px;display:flex;align-items:center;justify-content:space-between;${FS}">
  <span style="font-size:22px;font-weight:800;color:white;letter-spacing:-0.02em">RestauranteName</span>
  <div style="display:flex;gap:28px;align-items:center">
    <a href="#menu" style="color:rgba(255,255,255,0.8);text-decoration:none;font-size:14px;font-weight:500">Menu</a>
    <a href="#nosotros" style="color:rgba(255,255,255,0.8);text-decoration:none;font-size:14px;font-weight:500">Nosotros</a>
    <a href="#galeria" style="color:rgba(255,255,255,0.8);text-decoration:none;font-size:14px;font-weight:500">Galeria</a>
    <a href="#reservar" style="background:#c2410c;color:white;text-decoration:none;font-size:14px;font-weight:700;padding:9px 22px;border-radius:8px">Reservar</a>
  </div>
</nav>

<!-- HERO -->
<section style="min-height:100vh;position:relative;display:flex;align-items:center;justify-content:center;padding:80px 24px;overflow:hidden;${F}">
  <div style="position:absolute;inset:0;background-image:url('https://placehold.co/1920x1080/1a0a00/3d1a00?text=Foto+del+restaurante');background-size:cover;background-position:center"></div>
  <div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,0.3) 0%,rgba(0,0,0,0.72) 100%)"></div>
  <div style="position:relative;z-index:1;text-align:center;max-width:800px">
    <p style="font-size:14px;color:#fbbf24;letter-spacing:0.2em;text-transform:uppercase;margin:0 0 18px;${FS}">Desde 1998 &middot; Ciudad</p>
    <h1 style="font-size:clamp(48px,7vw,90px);font-weight:400;color:white;line-height:1.05;margin:0 0 24px;letter-spacing:-0.02em">El sabor autentico<br><em>de nuestra tierra</em></h1>
    <p style="font-size:18px;color:rgba(255,255,255,0.82);line-height:1.7;margin:0 0 48px;max-width:500px;margin-left:auto;margin-right:auto;${FS}">Una cocina que honra las tradiciones y abraza la creatividad. Cada plato, una historia.</p>
    <div style="display:flex;gap:16px;justify-content:center;flex-wrap:wrap">
      <a href="#menu" style="background:#c2410c;color:white;font-size:16px;font-weight:700;padding:16px 40px;border-radius:10px;text-decoration:none;${FS}">Ver el menu</a>
      <a href="#reservar" style="background:rgba(255,255,255,0.12);color:white;font-size:16px;font-weight:600;padding:16px 40px;border-radius:10px;text-decoration:none;border:2px solid rgba(255,255,255,0.35);${FS}">Hacer reserva</a>
    </div>
  </div>
</section>

<!-- MENU HIGHLIGHTS -->
<section id="menu" style="padding:100px 24px;background:#faf7f0;${FS}">
  <div style="max-width:1100px;margin:0 auto">
    <div style="text-align:center;margin-bottom:64px">
      <p style="color:#c2410c;font-size:13px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;margin:0 0 12px">Nuestro menu</p>
      <h2 style="font-size:clamp(32px,4.5vw,54px);font-weight:400;color:#1c0a00;margin:0;${F}">Platos que enamoran</h2>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:28px">
      <div style="background:white;border-radius:20px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.06)">
        <img src="https://placehold.co/500x320/8b4513/f5deb3?text=Plato+Estrella" alt="Plato 1" style="width:100%;height:220px;object-fit:cover;display:block">
        <div style="padding:24px">
          <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:10px">
            <h3 style="font-size:20px;font-weight:700;color:#1c0a00;margin:0">Plato estrella</h3>
            <span style="font-size:20px;font-weight:700;color:#c2410c">$28</span>
          </div>
          <p style="font-size:14px;color:#92400e;margin:0">Descripcion del plato con sus ingredientes principales y forma de preparacion artesanal.</p>
        </div>
      </div>
      <div style="background:white;border-radius:20px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.06)">
        <img src="https://placehold.co/500x320/5d4037/ffe0b2?text=Especialidad" alt="Plato 2" style="width:100%;height:220px;object-fit:cover;display:block">
        <div style="padding:24px">
          <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:10px">
            <h3 style="font-size:20px;font-weight:700;color:#1c0a00;margin:0">La especialidad</h3>
            <span style="font-size:20px;font-weight:700;color:#c2410c">$34</span>
          </div>
          <p style="font-size:14px;color:#92400e;margin:0">Preparado con ingredientes de temporada seleccionados cada manana en el mercado local.</p>
        </div>
      </div>
      <div style="background:white;border-radius:20px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.06)">
        <img src="https://placehold.co/500x320/4e342e/ffccbc?text=Postre+Favorito" alt="Postre" style="width:100%;height:220px;object-fit:cover;display:block">
        <div style="padding:24px">
          <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:10px">
            <h3 style="font-size:20px;font-weight:700;color:#1c0a00;margin:0">El postre favorito</h3>
            <span style="font-size:20px;font-weight:700;color:#c2410c">$12</span>
          </div>
          <p style="font-size:14px;color:#92400e;margin:0">Un final perfecto para tu experiencia gastronomica. Hecho a mano por nuestros reposteros.</p>
        </div>
      </div>
    </div>
    <div style="text-align:center;margin-top:40px">
      <a href="#" style="display:inline-block;background:#1c0a00;color:#fbbf24;font-size:15px;font-weight:700;padding:15px 40px;border-radius:10px;text-decoration:none">Menu completo &rarr;</a>
    </div>
  </div>
</section>

<!-- GALERIA -->
<section id="galeria" style="padding:80px 24px;background:white;${FS}">
  <div style="max-width:1100px;margin:0 auto">
    <div style="text-align:center;margin-bottom:52px">
      <p style="color:#c2410c;font-size:13px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;margin:0 0 12px">Galeria</p>
      <h2 style="font-size:clamp(28px,4vw,46px);font-weight:400;color:#1c0a00;margin:0;${F}">Vive la experiencia</h2>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px">
      <img src="https://placehold.co/400x300/8b4513/f5deb3?text=Foto+1" style="width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:12px;display:block">
      <img src="https://placehold.co/400x300/5d4037/ffe0b2?text=Foto+2" style="width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:12px;display:block">
      <img src="https://placehold.co/400x300/4e342e/ffccbc?text=Foto+3" style="width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:12px;display:block">
      <img src="https://placehold.co/400x300/3e2723/efebe9?text=Foto+4" style="width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:12px;display:block">
      <img src="https://placehold.co/400x300/bf360c/ffccbc?text=Foto+5" style="width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:12px;display:block">
      <img src="https://placehold.co/400x300/6d4c41/d7ccc8?text=Foto+6" style="width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:12px;display:block">
    </div>
  </div>
</section>

<!-- RESERVAS -->
<section id="reservar" style="padding:100px 24px;background:#1c0a00;${FS}">
  <div style="max-width:640px;margin:0 auto;text-align:center">
    <p style="color:#fbbf24;font-size:13px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;margin:0 0 12px">Reservaciones</p>
    <h2 style="font-size:clamp(28px,4vw,46px);font-weight:400;color:white;margin:0 0 16px;${F}">Reserva tu mesa</h2>
    <p style="font-size:16px;color:rgba(255,255,255,0.65);line-height:1.7;margin:0 0 48px">Te esperamos para una velada inolvidable. Confirmaremos tu reserva en menos de 1 hora.</p>
    <div style="background:rgba(255,255,255,0.06);border-radius:20px;padding:40px;border:1px solid rgba(255,255,255,0.1)">
      <form style="display:flex;flex-direction:column;gap:16px">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
          <input type="text" placeholder="Tu nombre" style="border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.08);color:white;border-radius:10px;padding:13px 16px;font-size:15px;outline:none">
          <input type="tel" placeholder="Telefono" style="border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.08);color:white;border-radius:10px;padding:13px 16px;font-size:15px;outline:none">
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px">
          <input type="date" style="border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.08);color:white;border-radius:10px;padding:13px 16px;font-size:15px;outline:none">
          <select style="border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.08);color:white;border-radius:10px;padding:13px 16px;font-size:15px;outline:none"><option style="background:#1c0a00">7:00 pm</option><option style="background:#1c0a00">8:00 pm</option><option style="background:#1c0a00">9:00 pm</option></select>
          <select style="border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.08);color:white;border-radius:10px;padding:13px 16px;font-size:15px;outline:none"><option style="background:#1c0a00">2 personas</option><option style="background:#1c0a00">4 personas</option><option style="background:#1c0a00">6 personas</option></select>
        </div>
        <button type="submit" style="background:#c2410c;color:white;font-size:16px;font-weight:700;padding:15px;border:none;border-radius:10px;cursor:pointer">Confirmar reserva</button>
      </form>
    </div>
  </div>
</section>

<!-- FOOTER -->
<footer style="background:#0a0400;padding:40px 24px;text-align:center;${FS}">
  <p style="color:rgba(255,255,255,0.4);font-size:14px;margin:0">&#169; 2025 RestauranteName &middot; Calle Principal 123, Ciudad &middot; Tel: +1 (555) 000-0000</p>
</footer>
`,
}
