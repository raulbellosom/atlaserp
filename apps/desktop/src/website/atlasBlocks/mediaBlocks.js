const F = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"

export const mediaBlocks = [
  {
    id: 'image',
    label: 'Imagen',
    category: 'Media',
    content: `<div style="padding:32px 24px;background:white;${F}">
  <div style="max-width:1100px;margin:0 auto">
    <img src="https://placehold.co/1200x500/e2e8f0/94a3b8?text=Doble+clic+para+cambiar+imagen" alt="Imagen" style="width:100%;border-radius:20px;display:block">
    <p style="font-size:13px;color:#94a3b8;text-align:center;margin:12px 0 0;font-style:italic">Descripcion de la imagen (opcional)</p>
  </div>
</div>`,
  },
  {
    id: 'image-text',
    label: 'Imagen + Texto',
    category: 'Media',
    content: `<div style="padding:80px 24px;background:white;${F}">
  <div style="max-width:1100px;margin:0 auto;display:grid;grid-template-columns:1fr 1fr;gap:56px;align-items:center">
    <img src="https://placehold.co/600x450/e2e8f0/94a3b8?text=Tu+imagen" alt="Imagen" style="width:100%;border-radius:20px;display:block">
    <div>
      <h2 style="font-size:clamp(26px,3.5vw,40px);font-weight:800;color:#0f172a;margin:0 0 16px;line-height:1.2;letter-spacing:-0.025em">Tu titulo aqui</h2>
      <p style="font-size:16px;color:#64748b;line-height:1.8;margin:0 0 28px">Describe tu mensaje principal. Puedes contar una historia, explicar un beneficio o presentar tu producto de forma visual y atractiva.</p>
      <a href="#" style="display:inline-block;background:#4f46e5;color:white;font-size:15px;font-weight:600;padding:13px 30px;border-radius:10px;text-decoration:none">Saber mas &rarr;</a>
    </div>
  </div>
</div>`,
  },
  {
    id: 'gallery-grid',
    label: 'Galeria 3 columnas',
    category: 'Media',
    content: `<style>.atlas-gallery-item{overflow:hidden;border-radius:16px}.atlas-gallery-item img{transition:transform 0.4s ease;display:block;width:100%;height:100%;object-fit:cover}.atlas-gallery-item:hover img{transform:scale(1.06)}</style>
<section style="padding:80px 24px;background:#f8fafc;${F}">
  <div style="max-width:1100px;margin:0 auto">
    <div style="text-align:center;margin-bottom:52px">
      <h2 style="font-size:clamp(26px,4vw,44px);font-weight:800;color:#0f172a;margin:0 0 12px;letter-spacing:-0.025em">Galeria de fotos</h2>
      <p style="font-size:17px;color:#64748b;margin:0">Reemplaza estas imagenes con las tuyas propias desde el gestor de archivos.</p>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px">
      <div class="atlas-gallery-item" style="aspect-ratio:4/3"><img src="https://placehold.co/600x450/ddd6fe/7c3aed?text=Foto+1" alt="Foto 1"></div>
      <div class="atlas-gallery-item" style="aspect-ratio:4/3"><img src="https://placehold.co/600x450/bbf7d0/059669?text=Foto+2" alt="Foto 2"></div>
      <div class="atlas-gallery-item" style="aspect-ratio:4/3"><img src="https://placehold.co/600x450/fed7aa/ea580c?text=Foto+3" alt="Foto 3"></div>
      <div class="atlas-gallery-item" style="aspect-ratio:4/3"><img src="https://placehold.co/600x450/bfdbfe/2563eb?text=Foto+4" alt="Foto 4"></div>
      <div class="atlas-gallery-item" style="aspect-ratio:4/3"><img src="https://placehold.co/600x450/fce7f3/be185d?text=Foto+5" alt="Foto 5"></div>
      <div class="atlas-gallery-item" style="aspect-ratio:4/3"><img src="https://placehold.co/600x450/e0f2fe/0369a1?text=Foto+6" alt="Foto 6"></div>
    </div>
  </div>
</section>`,
  },
  {
    id: 'gallery-masonry',
    label: 'Galeria masonry',
    category: 'Media',
    content: `<style>.atlas-masonry-item{break-inside:avoid;margin-bottom:16px;border-radius:16px;overflow:hidden}.atlas-masonry-item img{width:100%;display:block;transition:transform 0.4s ease}.atlas-masonry-item:hover img{transform:scale(1.04)}</style>
<section style="padding:80px 24px;background:white;${F}">
  <div style="max-width:1100px;margin:0 auto">
    <div style="text-align:center;margin-bottom:52px">
      <h2 style="font-size:clamp(26px,4vw,44px);font-weight:800;color:#0f172a;margin:0 0 12px;letter-spacing:-0.025em">Galeria de trabajos</h2>
      <p style="font-size:17px;color:#64748b;margin:0">Una seleccion de nuestros mejores proyectos y creaciones.</p>
    </div>
    <div style="columns:3;column-gap:16px">
      <div class="atlas-masonry-item"><img src="https://placehold.co/500x700/ddd6fe/7c3aed?text=Foto+A" alt="A"></div>
      <div class="atlas-masonry-item"><img src="https://placehold.co/500x400/bbf7d0/059669?text=Foto+B" alt="B"></div>
      <div class="atlas-masonry-item"><img src="https://placehold.co/500x550/fce7f3/be185d?text=Foto+C" alt="C"></div>
      <div class="atlas-masonry-item"><img src="https://placehold.co/500x400/bfdbfe/2563eb?text=Foto+D" alt="D"></div>
      <div class="atlas-masonry-item"><img src="https://placehold.co/500x600/fed7aa/ea580c?text=Foto+E" alt="E"></div>
      <div class="atlas-masonry-item"><img src="https://placehold.co/500x350/e0f2fe/0369a1?text=Foto+F" alt="F"></div>
    </div>
  </div>
</section>`,
  },
  {
    id: 'carousel-images',
    label: 'Carrusel de imagenes',
    category: 'Media',
    content: `<style>
.atlas-carousel{position:relative;overflow:hidden;border-radius:20px}
.atlas-carousel-track{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;-ms-overflow-style:none}
.atlas-carousel-track::-webkit-scrollbar{display:none}
.atlas-carousel-slide{min-width:100%;scroll-snap-align:start;aspect-ratio:16/7;position:relative;flex-shrink:0}
.atlas-carousel-slide img{width:100%;height:100%;object-fit:cover;display:block}
.atlas-carousel-btn{position:absolute;top:50%;transform:translateY(-50%);background:rgba(255,255,255,0.92);border:none;width:44px;height:44px;border-radius:50%;cursor:pointer;font-size:18px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 12px rgba(0,0,0,0.15);z-index:10;transition:background 0.2s}
.atlas-carousel-btn:hover{background:white}
.atlas-carousel-prev{left:16px}
.atlas-carousel-next{right:16px}
.atlas-carousel-dots{display:flex;justify-content:center;gap:8px;margin-top:16px}
.atlas-carousel-dot{width:8px;height:8px;border-radius:50%;background:#cbd5e1;border:none;cursor:pointer;padding:0;transition:background 0.2s,transform 0.2s}
.atlas-carousel-dot.active{background:#4f46e5;transform:scale(1.3)}
</style>
<section style="padding:60px 24px;background:white;${F}">
  <div style="max-width:1100px;margin:0 auto">
    <div class="atlas-carousel">
      <div class="atlas-carousel-track" id="atlas-ct-1">
        <div class="atlas-carousel-slide"><img src="https://placehold.co/1200x500/312e81/a5b4fc?text=Diapositiva+1" alt="1"></div>
        <div class="atlas-carousel-slide"><img src="https://placehold.co/1200x500/064e3b/6ee7b7?text=Diapositiva+2" alt="2"></div>
        <div class="atlas-carousel-slide"><img src="https://placehold.co/1200x500/7c2d12/fca5a5?text=Diapositiva+3" alt="3"></div>
      </div>
      <button class="atlas-carousel-btn atlas-carousel-prev" onclick="(function(b){var t=b.closest('.atlas-carousel').querySelector('.atlas-carousel-track');t.scrollBy({left:-t.offsetWidth,behavior:'smooth'})})(this)">&#8592;</button>
      <button class="atlas-carousel-btn atlas-carousel-next" onclick="(function(b){var t=b.closest('.atlas-carousel').querySelector('.atlas-carousel-track');t.scrollBy({left:t.offsetWidth,behavior:'smooth'})})(this)">&#8594;</button>
    </div>
    <div class="atlas-carousel-dots">
      <button class="atlas-carousel-dot active"></button>
      <button class="atlas-carousel-dot"></button>
      <button class="atlas-carousel-dot"></button>
    </div>
  </div>
</section>`,
  },
  {
    id: 'video-embed',
    label: 'Video',
    category: 'Media',
    content: `<section style="padding:80px 24px;background:#0f172a;${F}">
  <div style="max-width:900px;margin:0 auto">
    <div style="text-align:center;margin-bottom:40px">
      <h2 style="font-size:clamp(24px,3.5vw,40px);font-weight:800;color:white;margin:0 0 12px;letter-spacing:-0.025em">Conoce nuestra historia</h2>
      <p style="font-size:16px;color:#94a3b8;margin:0">Dos minutos que te cambiaran la perspectiva.</p>
    </div>
    <div style="position:relative;padding-bottom:56.25%;height:0;border-radius:20px;overflow:hidden;box-shadow:0 24px 80px rgba(0,0,0,0.5)">
      <iframe
        src="https://www.youtube.com/embed/dQw4w9WgXcQ"
        title="Video"
        frameborder="0"
        allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture"
        allowfullscreen
        style="position:absolute;top:0;left:0;width:100%;height:100%">
      </iframe>
    </div>
    <p style="font-size:13px;color:#475569;text-align:center;margin:16px 0 0">Reemplaza la URL del video con la tuya de YouTube o Vimeo.</p>
  </div>
</section>`,
  },
  {
    id: 'hero-full-image',
    label: 'Imagen hero completa',
    category: 'Media',
    content: `<div style="position:relative;overflow:hidden;${F}">
  <img src="https://placehold.co/1440x600/1e293b/475569?text=Imagen+panoramica" alt="Hero" style="width:100%;display:block;max-height:600px;object-fit:cover">
  <div style="position:absolute;inset:0;background:linear-gradient(to right,rgba(0,0,0,0.7) 0%,rgba(0,0,0,0.1) 60%,rgba(0,0,0,0) 100%)"></div>
  <div style="position:absolute;inset:0;display:flex;align-items:center;padding:0 64px">
    <div style="max-width:500px">
      <h2 style="font-size:clamp(28px,4.5vw,54px);font-weight:800;color:white;line-height:1.1;margin:0 0 18px;letter-spacing:-0.025em">Texto sobre imagen</h2>
      <p style="font-size:17px;color:rgba(255,255,255,0.85);line-height:1.7;margin:0 0 28px">Agrega un texto impactante sobre tu imagen panoramica.</p>
      <a href="#" style="display:inline-block;background:white;color:#0f172a;font-size:15px;font-weight:700;padding:13px 32px;border-radius:10px;text-decoration:none">Ver mas</a>
    </div>
  </div>
</div>`,
  },
]
