// Base CSS for atlas block custom classes.
// Injected by WebsitePageRenderer so hover/transition effects always work in
// the public view, regardless of how GrapesJS serializes embedded <style> tags.
export const ATLAS_BLOCKS_BASE_CSS = `
/* Gallery grid */
.atlas-gallery-item{overflow:hidden;border-radius:16px}
.atlas-gallery-item img{transition:transform 0.4s ease;display:block;width:100%;height:100%;object-fit:cover}
.atlas-gallery-item:hover img{transform:scale(1.06)}

/* Masonry gallery */
.atlas-masonry-item{break-inside:avoid;margin-bottom:16px;border-radius:16px;overflow:hidden}
.atlas-masonry-item img{width:100%;display:block;transition:transform 0.4s ease}
.atlas-masonry-item:hover img{transform:scale(1.04)}

/* Carousel */
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

/* Product cards */
.atlas-product-card{transition:transform 0.25s ease,box-shadow 0.25s ease}
.atlas-product-card:hover{transform:translateY(-4px);box-shadow:0 12px 40px rgba(0,0,0,0.12)}
.atlas-product-btn{transition:background 0.2s}
.atlas-product-btn:hover{background:#3730a3 !important}

/* Category cards */
.atlas-cat-card{position:relative;border-radius:20px;overflow:hidden;cursor:pointer;transition:transform 0.3s ease}
.atlas-cat-card:hover{transform:scale(1.02)}
.atlas-cat-card img{width:100%;height:100%;object-fit:cover;display:block;transition:transform 0.5s ease}
.atlas-cat-card:hover img{transform:scale(1.08)}

/* Navbar dropdowns — hover with dead-zone fix + close delay */
.atlas-nav-item{position:relative}
.atlas-nav-dropdown{
  position:absolute;top:100%;left:0;
  padding-top:8px;          /* transparent bridge — no hover dead-zone */
  visibility:hidden;opacity:0;pointer-events:none;
  transition:opacity 0.18s ease,visibility 0.18s ease;
  transition-delay:0.15s;   /* delay close so user has time to reach panel */
  z-index:200
}
.atlas-nav-item:hover .atlas-nav-dropdown{
  visibility:visible;opacity:1;pointer-events:auto;
  transition-delay:0s
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
.atlas-nav-dd-label{display:flex;align-items:center;gap:4px;font-size:14px;font-weight:500;cursor:default}
.dd-caret{font-size:9px;opacity:0.45;transition:transform 0.2s ease;display:inline-block}
.atlas-nav-item:hover .dd-caret{transform:rotate(180deg)}
`
