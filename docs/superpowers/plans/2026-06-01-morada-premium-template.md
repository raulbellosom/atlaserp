# Morada Premium Template Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 4 new premium block types (SplitFeature, Marquee, BentoGrid, Quote) and a full "Morada" home-décor store template (5 pages) that showcases them.

**Architecture:** Each new block is a standalone `defineBlock()` file in `atlasBlocks/`. All 4 are added to `universalAtlasBlocks` so every site type gets them. The Morada template follows the existing pattern: `moradaTemplate.js` exports `moradaTemplate` (for web builder sidebar) + `moradaSitePages` (for ERP templates screen). Barrel files (`atlasBlocks/templates/index.js` and `atlasTemplates/index.js`) wire it all together.

**Tech Stack:** Vanilla JS (no TS), React JSX, `@raulbellosom/atlas-web-builder` (`defineBlock`, `defineTemplate`), inline styles (no Tailwind — blocks render in the web builder renderer which is decoupled from the app's Tailwind).

---

## Block API cheat-sheet (read before implementing any task)

```js
import { defineBlock } from '@raulbellosom/atlas-web-builder'

export const MyBlock = defineBlock({
  type:     'MyBlock',          // unique string, PascalCase
  label:    'Mi bloque',        // shown in editor UI
  category: 'atlas',
  defaultProps: { prop1: 'value' },
  fields: {
    prop1: { type: 'text',     label: 'Etiqueta' },
    prop2: { type: 'textarea', label: 'Texto largo' },
    prop3: { type: 'select',   label: 'Opción', options: [{ value: 'a', label: 'A' }] },
    prop4: { type: 'image',    label: 'Imagen' },
  },
  groups: [
    { label: 'Sección', fields: ['prop1', 'prop2'] },
  ],
  render({ prop1, prop2, prop3, prop4 }) {
    return <section style={{ ... }}>...</section>
  },
})
```

**CSS variables available inside render:** `var(--atlas-color-primary)`, `var(--atlas-color-bg)`, `var(--atlas-color-fg)`, `var(--atlas-color-muted)`, `var(--atlas-font-sans)`.

**Morada brand constants (use these hardcoded in block renders):**
- Cream bg: `#FAF7F2` · Foreground: `#1A1410` · Terracotta: `#B5603A` · Muted: `#8C7E72` · Cream section: `#EDE5D8`

---

### Task 1: Create `SplitFeatureBlock`

**Files:**
- Create: `apps/desktop/src/website/atlasBlocks/splitFeatureBlock.jsx`

- [ ] **Step 1: Write the file**

```jsx
import { defineBlock } from '@raulbellosom/atlas-web-builder'

export const SplitFeatureBlock = defineBlock({
  type:     'SplitFeatureBlock',
  label:    'Sección dividida imagen + texto',
  category: 'atlas',
  defaultProps: {
    variant:     'image-right',
    eyebrow:     'Nuestra historia',
    title:       'Diseño con propósito',
    body:        'Cada pieza que ofrecemos pasa por un proceso de selección riguroso. Buscamos objetos que tengan historia, que estén hechos para durar y que mejoren la vida diaria.',
    ctaLabel:    'Conocer más',
    ctaHref:     '#',
    imageSrc:    '',
    imageAlt:    '',
    background:  'white',
    imageHeight: 'full',
  },
  fields: {
    variant:     { type: 'select', label: 'Posición de imagen', options: [{ value: 'image-left', label: 'Imagen izquierda' }, { value: 'image-right', label: 'Imagen derecha' }] },
    eyebrow:     { type: 'text',   label: 'Antetítulo' },
    title:       { type: 'text',   label: 'Título' },
    body:        { type: 'textarea', label: 'Cuerpo de texto' },
    ctaLabel:    { type: 'text',   label: 'Texto del enlace (dejar vacío para ocultar)' },
    ctaHref:     { type: 'text',   label: 'URL del enlace' },
    imageSrc:    { type: 'image',  label: 'Imagen' },
    imageAlt:    { type: 'text',   label: 'Texto alternativo' },
    background:  { type: 'select', label: 'Fondo', options: [{ value: 'white', label: 'Blanco' }, { value: 'cream', label: 'Crema' }, { value: 'dark', label: 'Oscuro' }] },
    imageHeight: { type: 'select', label: 'Estilo de imagen', options: [{ value: 'full', label: 'Sin margen (llena la mitad)' }, { value: 'contained', label: 'Con margen y esquinas redondeadas' }] },
  },
  groups: [
    { label: 'Contenido', fields: ['eyebrow', 'title', 'body', 'ctaLabel', 'ctaHref'] },
    { label: 'Imagen',    fields: ['imageSrc', 'imageAlt', 'variant', 'imageHeight'] },
    { label: 'Estilo',    fields: ['background'] },
  ],
  render({ variant, eyebrow, title, body, ctaLabel, ctaHref, imageSrc, imageAlt, background, imageHeight }) {
    const isImgLeft = variant === 'image-left'
    const isDark    = background === 'dark'
    const bgMap     = { white: '#FFFFFF', cream: '#EDE5D8', dark: '#1A1410' }
    const bg        = bgMap[background] || '#FFFFFF'
    const fg        = isDark ? '#FAF7F2' : '#1A1410'
    const isContained = imageHeight === 'contained'

    const imgBox = (
      <div key="img" style={{ flex: '1 1 55%', minWidth: '300px', overflow: 'hidden', minHeight: '500px', position: 'relative' }}>
        {imageSrc ? (
          <img
            src={imageSrc} alt={imageAlt || ''}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block',
              ...(isContained ? { padding: '40px', boxSizing: 'border-box', borderRadius: '16px' } : {}) }}
          />
        ) : (
          <div style={{ width: '100%', height: '100%', minHeight: '500px', background: '#C9B99A', display: 'flex', alignItems: 'center', justifyContent: 'center',
            ...(isContained ? { margin: '40px', width: 'calc(100% - 80px)', borderRadius: '16px' } : {}) }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#FAF7F2" strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          </div>
        )}
      </div>
    )

    const textBox = (
      <div key="text" style={{ flex: '1 1 45%', minWidth: '280px', padding: '80px 64px', display: 'flex', flexDirection: 'column', justifyContent: 'center', boxSizing: 'border-box' }}>
        {eyebrow && (
          <p style={{ fontFamily: 'var(--atlas-font-sans)', fontSize: '12px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#B5603A', margin: '0 0 16px' }}>
            {eyebrow}
          </p>
        )}
        {title && (
          <h2 style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontSize: 'clamp(28px, 3vw, 44px)', fontWeight: 400, color: fg, margin: '0 0 24px', lineHeight: 1.2 }}>
            {title}
          </h2>
        )}
        {body && (
          <p style={{ fontFamily: 'var(--atlas-font-sans)', fontSize: '17px', lineHeight: 1.75, color: '#8C7E72', margin: '0 0 32px' }}>
            {body}
          </p>
        )}
        {ctaLabel && (
          <a href={ctaHref || '#'} style={{ fontFamily: 'var(--atlas-font-sans)', fontSize: '15px', fontWeight: 600, color: fg, textDecoration: 'underline', textUnderlineOffset: '4px', textDecorationColor: '#B5603A', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            {ctaLabel} →
          </a>
        )}
      </div>
    )

    return (
      <section style={{ background: bg, display: 'flex', flexWrap: 'wrap' }}>
        {isImgLeft ? [imgBox, textBox] : [textBox, imgBox]}
      </section>
    )
  },
})
```

- [ ] **Step 2: Syntax check**

```bash
node --check apps/desktop/src/website/atlasBlocks/splitFeatureBlock.jsx
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/website/atlasBlocks/splitFeatureBlock.jsx
git commit -m "feat(website): SplitFeatureBlock — full-width image+text alternating section"
```

---

### Task 2: Create `MarqueeBlock`

**Files:**
- Create: `apps/desktop/src/website/atlasBlocks/marqueeBlock.jsx`

- [ ] **Step 1: Write the file**

```jsx
import { defineBlock } from '@raulbellosom/atlas-web-builder'

const MARQUEE_STYLE = `@keyframes atlas-marquee { 0% { transform: translateX(0) } 100% { transform: translateX(-50%) } }`

export const MarqueeBlock = defineBlock({
  type:     'MarqueeBlock',
  label:    'Cinta animada (marquee)',
  category: 'atlas',
  defaultProps: {
    items:      'Sala · Comedor · Recámara · Jardín · Baño · Estudio',
    speed:      'normal',
    background: 'dark',
    size:       'md',
  },
  fields: {
    items:      { type: 'text',   label: 'Texto (separado por · o cualquier separador)' },
    speed:      { type: 'select', label: 'Velocidad', options: [{ value: 'slow', label: 'Lento (60s)' }, { value: 'normal', label: 'Normal (35s)' }, { value: 'fast', label: 'Rápido (20s)' }] },
    background: { type: 'select', label: 'Fondo', options: [{ value: 'dark', label: 'Oscuro' }, { value: 'cream', label: 'Crema' }, { value: 'primary', label: 'Terracota' }] },
    size:       { type: 'select', label: 'Tamaño de texto', options: [{ value: 'sm', label: 'Pequeño' }, { value: 'md', label: 'Mediano' }, { value: 'lg', label: 'Grande' }] },
  },
  groups: [
    { label: 'Contenido', fields: ['items'] },
    { label: 'Estilo',    fields: ['background', 'size', 'speed'] },
  ],
  render({ items, speed, background, size }) {
    const speedMap = { slow: 60, normal: 35, fast: 20 }
    const duration = speedMap[speed] || 35
    const sizeMap  = { sm: '13px', md: '16px', lg: '22px' }
    const fontSize = sizeMap[size] || '16px'
    const bgMap    = { dark: '#1A1410', cream: '#EDE5D8', primary: '#B5603A' }
    const bg       = bgMap[background] || '#1A1410'
    const fg       = background === 'cream' ? '#1A1410' : '#FAF7F2'
    const content  = `${items || 'Sala · Comedor · Recámara'}  ·  `
    const textStyle = {
      fontFamily: 'var(--atlas-font-sans)',
      fontSize,
      color: fg,
      textTransform: 'uppercase',
      letterSpacing: '0.1em',
      padding: '0 24px',
      whiteSpace: 'nowrap',
    }

    return (
      <div style={{ background: bg, overflow: 'hidden', paddingBlock: '14px' }}>
        <style>{MARQUEE_STYLE}</style>
        <div style={{
          display: 'flex',
          width: 'max-content',
          animation: `atlas-marquee ${duration}s linear infinite`,
        }}>
          <span style={textStyle}>{content}</span>
          <span style={textStyle}>{content}</span>
        </div>
      </div>
    )
  },
})
```

- [ ] **Step 2: Syntax check**

```bash
node --check apps/desktop/src/website/atlasBlocks/marqueeBlock.jsx
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/website/atlasBlocks/marqueeBlock.jsx
git commit -m "feat(website): MarqueeBlock — infinite scrolling ticker with CSS animation"
```

---

### Task 3: Create `BentoGridBlock`

**Files:**
- Create: `apps/desktop/src/website/atlasBlocks/bentoGridBlock.jsx`

- [ ] **Step 1: Write the file**

```jsx
import { defineBlock } from '@raulbellosom/atlas-web-builder'

function parseBentoItems(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return []
  return raw
    .split('---')
    .map((b) => b.trim())
    .filter(Boolean)
    .map((b) => {
      const lines = b.split('\n').map((l) => l.trim()).filter(Boolean)
      return { title: lines[0] || '', desc: lines[1] || '', size: lines[2] || 'normal' }
    })
    .filter((s) => s.title)
    .slice(0, 6)
}

export const BentoGridBlock = defineBlock({
  type:     'BentoGridBlock',
  label:    'Cuadrícula editorial (Bento)',
  category: 'atlas',
  defaultProps: {
    items: 'Sala de estar\nSofás, mesas y textiles que definen el corazón del hogar.\nlarge\n---\nComedor\nMesas y sillas para los momentos que importan.\nnormal\n---\nJardín\nPiezas que llevan el diseño al exterior.\ntall\n---\nRecámara\nTextiles y objetos para el descanso.\nnormal',
    background: 'cream',
  },
  fields: {
    items:      { type: 'textarea', label: 'Celdas (título, descripción, tamaño — separados por ---)\nTamaños: normal | wide | tall | large' },
    background: { type: 'select',   label: 'Fondo', options: [{ value: 'cream', label: 'Crema' }, { value: 'white', label: 'Blanco' }, { value: 'dark', label: 'Oscuro' }] },
  },
  groups: [
    { label: 'Contenido', fields: ['items'] },
    { label: 'Estilo',    fields: ['background'] },
  ],
  render({ items, background }) {
    const parsed = parseBentoItems(items)
    const isDark = background === 'dark'
    const bgMap  = { white: '#FFFFFF', cream: '#FAF7F2', dark: '#1A1410' }
    const bg     = bgMap[background] || '#FAF7F2'
    const fg     = isDark ? '#FAF7F2' : '#1A1410'

    const cellBgs = isDark
      ? ['#2A2420', '#1F1B18']
      : background === 'cream'
        ? ['#FAF7F2', '#EDE5D8']
        : ['#FFFFFF', '#FAF7F2']

    const sizeMap = {
      normal: { gridColumn: 'span 1', gridRow: 'span 1' },
      wide:   { gridColumn: 'span 2', gridRow: 'span 1' },
      tall:   { gridColumn: 'span 1', gridRow: 'span 2' },
      large:  { gridColumn: 'span 2', gridRow: 'span 2' },
    }

    return (
      <section style={{ background: bg, padding: '80px 24px' }}>
        <div style={{
          maxWidth: '1200px',
          marginInline: 'auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gridAutoRows: '220px',
          gridAutoFlow: 'dense',
          gap: '16px',
        }}>
          {parsed.map((item, i) => {
            const sizeStyle = sizeMap[item.size] || sizeMap.normal
            const isLarge   = item.size === 'large' || item.size === 'tall'
            return (
              <div key={i} style={{
                ...sizeStyle,
                background: cellBgs[i % 2],
                borderRadius: '20px',
                padding: isLarge ? '40px' : '28px',
                boxSizing: 'border-box',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
              }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#B5603A', marginBottom: '24px', flexShrink: 0 }} />
                <h3 style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontSize: isLarge ? '28px' : '18px', fontWeight: 400, color: fg, margin: '0 0 12px', lineHeight: 1.2 }}>
                  {item.title}
                </h3>
                <p style={{ fontFamily: 'var(--atlas-font-sans)', fontSize: '14px', lineHeight: 1.65, color: '#8C7E72', margin: 0 }}>
                  {item.desc}
                </p>
              </div>
            )
          })}
        </div>
      </section>
    )
  },
})
```

- [ ] **Step 2: Syntax check**

```bash
node --check apps/desktop/src/website/atlasBlocks/bentoGridBlock.jsx
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/website/atlasBlocks/bentoGridBlock.jsx
git commit -m "feat(website): BentoGridBlock — editorial mixed-size grid with terracotta accent"
```

---

### Task 4: Create `QuoteBlock`

**Files:**
- Create: `apps/desktop/src/website/atlasBlocks/quoteBlock.jsx`

- [ ] **Step 1: Write the file**

```jsx
import { defineBlock } from '@raulbellosom/atlas-web-builder'

export const QuoteBlock = defineBlock({
  type:     'QuoteBlock',
  label:    'Cita editorial',
  category: 'atlas',
  defaultProps: {
    quote:       'Un hogar no se construye con paredes. Se construye con los objetos que elegimos, las texturas que tocamos y la luz que dejamos entrar.',
    attribution: '— Morada',
    background:  'cream',
    size:        'large',
    ornament:    'true',
  },
  fields: {
    quote:       { type: 'textarea', label: 'Cita' },
    attribution: { type: 'text',    label: 'Atribución (autor, fuente)' },
    background:  { type: 'select',  label: 'Fondo', options: [{ value: 'cream', label: 'Crema' }, { value: 'white', label: 'Blanco' }, { value: 'dark', label: 'Oscuro' }] },
    size:        { type: 'select',  label: 'Tamaño', options: [{ value: 'normal', label: 'Normal' }, { value: 'large', label: 'Grande' }] },
    ornament:    { type: 'select',  label: 'Mostrar comillas decorativas', options: [{ value: 'true', label: 'Sí' }, { value: 'false', label: 'No' }] },
  },
  groups: [
    { label: 'Contenido', fields: ['quote', 'attribution'] },
    { label: 'Estilo',    fields: ['background', 'size', 'ornament'] },
  ],
  render({ quote, attribution, background, size, ornament }) {
    const isLarge   = size === 'large'
    const isDark    = background === 'dark'
    const bgMap     = { white: '#FFFFFF', cream: '#EDE5D8', dark: '#1A1410' }
    const bg        = bgMap[background] || '#EDE5D8'
    const fg        = isDark ? '#FAF7F2' : '#1A1410'
    const showOrnament = ornament === 'true' || ornament === true

    return (
      <section style={{ background: bg, padding: isLarge ? '100px 24px' : '72px 24px' }}>
        <div style={{ maxWidth: '760px', marginInline: 'auto', textAlign: 'center', position: 'relative' }}>
          {showOrnament && (
            <div style={{
              position: 'absolute',
              top: '-60px',
              left: '-20px',
              fontSize: '180px',
              lineHeight: 1,
              color: '#B5603A',
              opacity: 0.12,
              fontFamily: 'Georgia, "Times New Roman", serif',
              userSelect: 'none',
              pointerEvents: 'none',
              zIndex: 0,
            }}>
              &ldquo;
            </div>
          )}
          <p style={{
            fontFamily: 'Georgia, "Times New Roman", serif',
            fontSize: isLarge ? 'clamp(28px, 4vw, 52px)' : '28px',
            fontWeight: 400,
            lineHeight: 1.45,
            color: fg,
            margin: 0,
            position: 'relative',
            zIndex: 1,
          }}>
            {quote}
          </p>
          {attribution && (
            <p style={{
              fontFamily: 'var(--atlas-font-sans)',
              fontSize: '13px',
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              color: '#8C7E72',
              marginTop: '32px',
              marginBottom: 0,
            }}>
              {attribution}
            </p>
          )}
        </div>
      </section>
    )
  },
})
```

- [ ] **Step 2: Syntax check**

```bash
node --check apps/desktop/src/website/atlasBlocks/quoteBlock.jsx
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/website/atlasBlocks/quoteBlock.jsx
git commit -m "feat(website): QuoteBlock — large editorial pull-quote with decorative ornament"
```

---

### Task 5: Register the 4 new blocks in `atlasBlocks/index.js`

**Files:**
- Modify: `apps/desktop/src/website/atlasBlocks/index.js`

- [ ] **Step 1: Replace the entire file with the updated version**

```js
// --- Bloques existentes ---
import { ContactFormBlock }  from './contactFormBlock.jsx'
import { BlogIndexBlock }    from './blogIndexBlock.jsx'
import { ProductsGridBlock } from './productsGridBlock.jsx'
import { ProductCardBlock }  from './productCardBlock.jsx'
import { CartBlock }         from './cartBlock.jsx'
import { BookingFormBlock }  from './bookingFormBlock.jsx'

// --- Bloques universales ---
import { ServicesGridBlock }    from './servicesGridBlock.jsx'
import { TestimonialsBlock }    from './testimonialsBlock.jsx'
import { StatsBlock }           from './statsBlock.jsx'
import { GalleryBlock }         from './galleryBlock.jsx'
import { CtaBannerBlock }       from './ctaBannerBlock.jsx'
import { FeaturesSectionBlock } from './featuresSectionBlock.jsx'
import { TeamGridBlock }        from './teamGridBlock.jsx'

// --- Bloques premium ---
import { SplitFeatureBlock } from './splitFeatureBlock.jsx'
import { MarqueeBlock }      from './marqueeBlock.jsx'
import { BentoGridBlock }    from './bentoGridBlock.jsx'
import { QuoteBlock }        from './quoteBlock.jsx'

// --- Bloques específicos por giro ---
import { MenuGridBlock } from './menuGridBlock.jsx'

// --- Templates ---
import {
  restauranteTemplate,
  spaTemplate,
  tiendaTemplate,
  agenciaTemplate,
  negocioTemplate,
  moradaTemplate,
  allAtlasTemplates,
} from './templates/index.js'

export {
  restauranteTemplate,
  spaTemplate,
  tiendaTemplate,
  agenciaTemplate,
  negocioTemplate,
  moradaTemplate,
  allAtlasTemplates,
}

// ─── Grupos por categoría ────────────────────────────────────────────────────

export const universalAtlasBlocks = [
  ContactFormBlock,
  BlogIndexBlock,
  ServicesGridBlock,
  TestimonialsBlock,
  StatsBlock,
  GalleryBlock,
  CtaBannerBlock,
  FeaturesSectionBlock,
  TeamGridBlock,
  SplitFeatureBlock,
  MarqueeBlock,
  BentoGridBlock,
  QuoteBlock,
]

export const ecommerceAtlasBlocks = [
  ProductsGridBlock,
  ProductCardBlock,
  CartBlock,
]

export const bookingsAtlasBlocks = [
  BookingFormBlock,
]

export const restaurantAtlasBlocks = [
  MenuGridBlock,
]

// ─── Re-exports individuales para uso directo ────────────────────────────────

export {
  ContactFormBlock,
  BlogIndexBlock,
  ProductsGridBlock,
  ProductCardBlock,
  CartBlock,
  BookingFormBlock,
  ServicesGridBlock,
  TestimonialsBlock,
  StatsBlock,
  GalleryBlock,
  CtaBannerBlock,
  FeaturesSectionBlock,
  TeamGridBlock,
  MenuGridBlock,
  SplitFeatureBlock,
  MarqueeBlock,
  BentoGridBlock,
  QuoteBlock,
}

// ─── Builders por tipo de sitio ──────────────────────────────────────────────

export function buildAtlasBlocks(siteType) {
  const blocks = [...universalAtlasBlocks]
  if (siteType === 'ecommerce')  blocks.push(...ecommerceAtlasBlocks)
  if (siteType === 'bookings')   blocks.push(...bookingsAtlasBlocks)
  if (siteType === 'restaurant') blocks.push(...restaurantAtlasBlocks)
  return blocks
}

export function buildAtlasTemplates(siteType) {
  const base = [agenciaTemplate, negocioTemplate]
  if (siteType === 'ecommerce')  return [...base, tiendaTemplate, moradaTemplate]
  if (siteType === 'bookings')   return [...base, spaTemplate, restauranteTemplate]
  if (siteType === 'restaurant') return [restauranteTemplate, ...base]
  return [restauranteTemplate, spaTemplate, agenciaTemplate, negocioTemplate, moradaTemplate]
}
```

- [ ] **Step 2: Verify no syntax errors**

```bash
node --check apps/desktop/src/website/atlasBlocks/index.js
```

Expected: no output. Note: the import of `moradaTemplate` will fail until Task 6 creates the template file — that's expected.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/website/atlasBlocks/index.js
git commit -m "feat(website): register SplitFeature, Marquee, BentoGrid, Quote in universalAtlasBlocks"
```

---

### Task 6: Create `moradaTemplate.js`

**Files:**
- Create: `apps/desktop/src/website/atlasBlocks/templates/moradaTemplate.js`

- [ ] **Step 1: Write the file**

```js
import { defineTemplate } from '@raulbellosom/atlas-web-builder'

const NAVBAR = {
  id: 'navbar',
  type: 'NavbarBlock',
  props: {
    variant:    'light',
    brand:      'Morada',
    links:      'Inicio | /\nColección | /coleccion\nNosotros | /nosotros\nCuidados | /cuidados\nContacto | /contacto',
    ctaLabel:   'Ver colección',
    ctaHref:    '/coleccion',
    ctaVariant: 'solid',
    sticky:     true,
    height:     '68',
  },
  children: {},
}

const FOOTER = {
  id: 'footer',
  type: 'FooterBlock',
  props: {
    variant:  'dark',
    brand:    'Morada',
    tagline:  'Objetos que dan vida al hogar.',
    columns:  'Colecciones | Colecciones\nSala | /coleccion\nComedor | /coleccion\nRecámara | /coleccion\nJardín | /coleccion\n---\nMorada | Morada\nNuestra historia | /nosotros\nGuía de cuidados | /cuidados\nContacto | /contacto\n---\nAyuda | Ayuda\nEnvíos y devoluciones | /\nPreguntas frecuentes | /\nPolítica de privacidad | /',
    copyright: `© ${new Date().getFullYear()} Morada. Todos los derechos reservados.`,
    showBrand: true,
  },
  children: {},
}

export const moradaTemplate = defineTemplate({
  id:          'atlas-morada',
  label:       'Morada',
  description: 'Tienda de hogar y decoración con estética warm lifestyle. Diseño editorial con bloques premium.',
  category:    'hogar',
  build() {
    return {
      rootIds: ['navbar', 'hero', 'marquee', 'split1', 'products', 'bento', 'split2', 'quote', 'gallery', 'testimonials', 'cta', 'footer'],
      blocks: {
        navbar: NAVBAR,
        hero: {
          id: 'hero', type: 'HeroBlock',
          props: {
            variant:         'centered',
            title:           'Objetos que dan vida al hogar',
            subtitle:        'Piezas seleccionadas por su diseño, durabilidad y el modo en que transforman los espacios.',
            eyebrow:         'Nueva colección',
            ctaLabel:        'Explorar colección',
            ctaHref:         '/coleccion',
            ctaVariant:      'solid',
            ctaSecondLabel:  'Nuestra historia',
            ctaSecondHref:   '/nosotros',
            imageSrc:        '',
            background:      { kind: 'color', token: 'muted' },
            align:           'center',
            paddingY:        '16',
            minHeight:       '90vh',
            titleSize:       '3xl',
            contentMaxWidth: '65ch',
          },
          children: {},
        },
        marquee: {
          id: 'marquee', type: 'MarqueeBlock',
          props: { items: 'Sala · Comedor · Recámara · Jardín · Baño · Estudio · Terraza', speed: 'normal', background: 'dark', size: 'md' },
          children: {},
        },
        split1: {
          id: 'split1', type: 'SplitFeatureBlock',
          props: {
            variant:     'image-right',
            eyebrow:     'Nuestra curaduría',
            title:       'Diseño con propósito',
            body:        'Cada pieza que ofrecemos pasa por un proceso de selección riguroso. Buscamos objetos que tengan historia, que estén hechos para durar y que mejoren la vida diaria de quienes los habitan.',
            ctaLabel:    'Conocer más',
            ctaHref:     '/nosotros',
            imageSrc:    '',
            imageAlt:    'Sala de estar curada por Morada',
            background:  'white',
            imageHeight: 'full',
          },
          children: {},
        },
        products: {
          id: 'products', type: 'ProductsGridBlock',
          props: { categoryId: '', limit: 8, columns: '4', showPrice: true, showAddToCart: true },
          children: {},
        },
        bento: {
          id: 'bento', type: 'BentoGridBlock',
          props: {
            items:      'Sala de estar\nSofás, mesas y textiles que definen el corazón del hogar.\nlarge\n---\nComedor\nMesas y sillas para los momentos que importan.\nnormal\n---\nJardín\nPiezas que llevan el diseño al exterior.\ntall\n---\nRecámara\nTextiles y objetos para el descanso.\nnormal',
            background: 'cream',
          },
          children: {},
        },
        split2: {
          id: 'split2', type: 'SplitFeatureBlock',
          props: {
            variant:     'image-left',
            eyebrow:     'Calidad sin compromiso',
            title:       'Materiales que duran',
            body:        'Trabajamos directamente con artesanos y fabricantes que comparten nuestra visión: crear piezas que envejecen bien, que mejoran con el uso y que no terminan en la basura a los dos años.',
            ctaLabel:    'Guía de cuidados',
            ctaHref:     '/cuidados',
            imageSrc:    '',
            imageAlt:    'Detalle de materiales naturales',
            background:  'cream',
            imageHeight: 'full',
          },
          children: {},
        },
        quote: {
          id: 'quote', type: 'QuoteBlock',
          props: {
            quote:       'Un hogar no se construye con paredes. Se construye con los objetos que elegimos, las texturas que tocamos y la luz que dejamos entrar.',
            attribution: '— Morada',
            background:  'cream',
            size:        'large',
            ornament:    'true',
          },
          children: {},
        },
        gallery: {
          id: 'gallery', type: 'GalleryBlock',
          props: {
            eyebrow:     'Espacios Morada',
            title:       'Interiorismo con nuestras piezas',
            subtitle:    'Ambientes reales decorados con nuestra colección.',
            columns:     '3',
            gap:         'normal',
            aspectRatio: '4/3',
            image1: '', image2: '', image3: '',
            image4: '', image5: '', image6: '',
          },
          children: {},
        },
        testimonials: {
          id: 'testimonials', type: 'TestimonialsBlock',
          props: {
            eyebrow:      'Lo que dicen nuestros clientes',
            title:        'Hogares que confían en Morada',
            columns:      '3',
            background:   'white',
            testimonials: 'Valentina M.|Diseñadora de interiores|5\nLlevo 3 años recomendando Morada a mis clientes. La calidad es consistente, el servicio impecable y la curaduría está muy bien pensada. Siempre encuentro algo que encaja perfectamente.\n---\nJavier R.|Arquitecto|5\nLa mesa de comedor que compré tiene ya cuatro años y sigue igual de hermosa. Eso es lo que más valoro: objetos que envejecen bien y no te hacen sentir que compraste algo efímero.\n---\nSofía L.|Cliente frecuente|5\nEmpecé comprando un cojín y ya llevo seis piezas en casa. Lo que más me gusta es que todo combina — hay una coherencia visual en la colección que facilita mucho decorar.',
          },
          children: {},
        },
        cta: {
          id: 'cta', type: 'CtaBannerBlock',
          props: {
            eyebrow:       'Comunidad Morada',
            title:         'Suscríbete y recibe 10% en tu primera compra',
            subtitle:      'Acceso anticipado a nuevas colecciones, guías de interiorismo y descuentos exclusivos.',
            ctaLabel:      'Suscribirme',
            ctaHref:       '#newsletter',
            ctaSecondLabel: '',
            ctaSecondHref:  '',
            variant:       'gradient-dark',
            size:          'normal',
            align:         'center',
          },
          children: {},
        },
        footer: FOOTER,
      },
    }
  },
})

export const moradaSitePages = [
  {
    id:          'coleccion',
    label:       'Colección',
    routePath:   '/coleccion',
    required:    false,
    description: 'Catálogo completo de productos.',
    build: () => ({
      rootIds: ['navbar', 'hero', 'categories', 'products', 'cta', 'footer'],
      blocks: {
        navbar: NAVBAR,
        hero: {
          id: 'hero', type: 'HeroBlock',
          props: {
            variant: 'centered', title: 'Nuestra Colección',
            subtitle: 'Piezas seleccionadas para transformar cualquier espacio.',
            eyebrow: 'Catálogo completo',
            ctaLabel: '', ctaHref: '', ctaSecondLabel: '', ctaSecondHref: '',
            imageSrc: '', background: { kind: 'color', token: 'muted' },
            align: 'center', paddingY: '12', minHeight: '40vh', titleSize: '2xl', contentMaxWidth: '55ch',
          },
          children: {},
        },
        categories: {
          id: 'categories', type: 'ServicesGridBlock',
          props: {
            eyebrow: 'Explorar por espacio', title: 'Encuentra tu estilo', subtitle: '',
            columns: '4', cardStyle: 'bordered', align: 'center',
            services: 'Sala\nSofás, mesas, textiles y accesorios para el corazón del hogar.\n---\nComedor\nMesas, sillas y complementos para los momentos que importan.\n---\nRecámara\nRopa de cama, lámparas y objetos para el descanso.\n---\nJardín & Terraza\nPiezas que llevan el diseño al exterior.',
          },
          children: {},
        },
        products: {
          id: 'products', type: 'ProductsGridBlock',
          props: { categoryId: '', limit: 12, columns: '4', showPrice: true, showAddToCart: true },
          children: {},
        },
        cta: {
          id: 'cta', type: 'CtaBannerBlock',
          props: {
            eyebrow: '', title: '¿No encuentras lo que buscas?',
            subtitle: 'Cuéntanos qué necesitas y te ayudamos a encontrar la pieza perfecta.',
            ctaLabel: 'Contactarnos', ctaHref: '/contacto',
            ctaSecondLabel: '', ctaSecondHref: '',
            variant: 'gradient-dark', size: 'compact', align: 'center',
          },
          children: {},
        },
        footer: FOOTER,
      },
    }),
  },
  {
    id:          'nosotros',
    label:       'Nosotros',
    routePath:   '/nosotros',
    required:    false,
    description: 'La historia y valores detrás de Morada.',
    build: () => ({
      rootIds: ['navbar', 'hero', 'split1', 'split2', 'quote', 'stats', 'footer'],
      blocks: {
        navbar: NAVBAR,
        hero: {
          id: 'hero', type: 'HeroBlock',
          props: {
            variant: 'centered', title: 'Nuestra Historia',
            subtitle: 'Morada nació de la convicción de que un objeto bien hecho puede cambiar la manera en que vivimos.',
            eyebrow: 'Sobre nosotros',
            ctaLabel: 'Ver colección', ctaHref: '/coleccion', ctaVariant: 'solid',
            ctaSecondLabel: '', ctaSecondHref: '', imageSrc: '',
            background: { kind: 'color', token: 'bg' },
            align: 'center', paddingY: '14', minHeight: '55vh', titleSize: '2xl', contentMaxWidth: '60ch',
          },
          children: {},
        },
        split1: {
          id: 'split1', type: 'SplitFeatureBlock',
          props: {
            variant: 'image-right', eyebrow: 'El origen', title: 'Cómo empezamos',
            body: 'Fundada en 2016 por dos diseñadores hartos de que las tiendas de hogar vendiesen lo mismo: muebles que se ven bien en foto y mal en casa. Empezamos visitando ferias y talleres, seleccionando a mano cada pieza.',
            ctaLabel: '', ctaHref: '', imageSrc: '', imageAlt: 'Fundadores de Morada en un taller artesanal',
            background: 'white', imageHeight: 'contained',
          },
          children: {},
        },
        split2: {
          id: 'split2', type: 'SplitFeatureBlock',
          props: {
            variant: 'image-left', eyebrow: 'Nuestra filosofía', title: 'Compra menos, compra mejor',
            body: 'Creemos en el consumo consciente. Por eso cada pieza de Morada está diseñada para durar décadas, no temporadas. Trabajamos con artesanos y fabricantes que comparten esta visión y que pagan salarios justos.',
            ctaLabel: 'Guía de cuidados', ctaHref: '/cuidados',
            imageSrc: '', imageAlt: 'Taller de artesanos colaboradores',
            background: 'cream', imageHeight: 'contained',
          },
          children: {},
        },
        quote: {
          id: 'quote', type: 'QuoteBlock',
          props: {
            quote: 'Cada objeto que elegimos para tu hogar ha pasado por nuestras manos primero. Si no lo tendríamos en casa, no lo vendemos.',
            attribution: '— Fundadores de Morada',
            background: 'white', size: 'large', ornament: 'true',
          },
          children: {},
        },
        stats: {
          id: 'stats', type: 'StatsBlock',
          props: {
            eyebrow: 'Morada en números', title: 'Una trayectoria construida pieza a pieza',
            stats: '8 años\nCurando hogares\nDesde 2016\n---\n3,200+\nClientes\nEn 12 países\n---\n180+\nArtesanos\nColaboradores activos\n---\n0\nPiezas rápidas\nSolo diseño duradero',
            background: 'muted', align: 'center',
          },
          children: {},
        },
        footer: FOOTER,
      },
    }),
  },
  {
    id:          'cuidados',
    label:       'Cuidados',
    routePath:   '/cuidados',
    required:    false,
    description: 'Guía de cuidado y mantenimiento de los materiales.',
    build: () => ({
      rootIds: ['navbar', 'hero', 'bento', 'split', 'cta', 'footer'],
      blocks: {
        navbar: NAVBAR,
        hero: {
          id: 'hero', type: 'HeroBlock',
          props: {
            variant: 'centered', title: 'Guía de Cuidados',
            subtitle: 'Con el cuidado correcto, tus piezas Morada durarán toda la vida.',
            eyebrow: 'Materiales & cuidados',
            ctaLabel: '', ctaHref: '', ctaSecondLabel: '', ctaSecondHref: '', imageSrc: '',
            background: { kind: 'color', token: 'muted' },
            align: 'center', paddingY: '12', minHeight: '40vh', titleSize: '2xl', contentMaxWidth: '55ch',
          },
          children: {},
        },
        bento: {
          id: 'bento', type: 'BentoGridBlock',
          props: {
            items: 'Madera maciza\nLimpia con paño seco. Evita la humedad directa. Aceita cada 6 meses con aceite de teca.\nlarge\n---\nLino & algodón\nLavado a máquina en frío. Plancha en húmedo. Lava por separado las primeras veces.\nnormal\n---\nCerámica\nLavado a mano recomendado. Evita cambios bruscos de temperatura.\nnormal\n---\nCuero natural\nLimpia con paño ligeramente húmedo. Acondiciona dos veces al año con crema de cuero.\nwide',
            background: 'cream',
          },
          children: {},
        },
        split: {
          id: 'split', type: 'SplitFeatureBlock',
          props: {
            variant: 'image-right', eyebrow: 'Nuestra garantía', title: 'Si algo falla, lo arreglamos',
            body: 'Todas las piezas Morada tienen garantía mínima de 2 años. Si algo falla por un defecto de fabricación, lo reparamos o reemplazamos sin preguntas. Creemos en los objetos que duran.',
            ctaLabel: 'Contactar soporte', ctaHref: '/contacto',
            imageSrc: '', imageAlt: '', background: 'white', imageHeight: 'contained',
          },
          children: {},
        },
        cta: {
          id: 'cta', type: 'CtaBannerBlock',
          props: {
            eyebrow: '', title: '¿Tienes alguna duda sobre el cuidado de tu pieza?',
            subtitle: 'Escríbenos y te respondemos en menos de 24 horas.',
            ctaLabel: 'Escribirnos', ctaHref: '/contacto',
            ctaSecondLabel: '', ctaSecondHref: '',
            variant: 'gradient-dark', size: 'compact', align: 'center',
          },
          children: {},
        },
        footer: FOOTER,
      },
    }),
  },
  {
    id:          'contacto',
    label:       'Contacto',
    routePath:   '/contacto',
    required:    false,
    description: 'Información de contacto y atención al cliente.',
    build: () => ({
      rootIds: ['navbar', 'info', 'cta', 'footer'],
      blocks: {
        navbar: NAVBAR,
        info: {
          id: 'info', type: 'FeaturesSectionBlock',
          props: {
            eyebrow: 'Estamos aquí', title: 'Hablemos',
            subtitle: 'Resolvemos tus dudas sobre productos, envíos, garantías y más.',
            layout: 'grid-3', iconStyle: 'check', background: 'white',
            features: 'Correo electrónico\nhola@morada.mx — Para consultas, pedidos especiales y colaboraciones.\n---\nWhatsApp\n+52 55 0000 0000 — Lunes a sábado, 9am–7pm. Te respondemos en minutos.\n---\nEnvíos\nEntregamos en toda la República Mexicana. Envío gratis en pedidos mayores a $1,500.',
          },
          children: {},
        },
        cta: {
          id: 'cta', type: 'CtaBannerBlock',
          props: {
            eyebrow: 'Atención personalizada', title: 'Cuéntanos qué necesitas',
            subtitle: 'Nuestro equipo te ayuda a encontrar la pieza perfecta para tu espacio.',
            ctaLabel: 'WhatsApp', ctaHref: 'https://wa.me/525500000000',
            ctaSecondLabel: 'Enviar correo', ctaSecondHref: 'mailto:hola@morada.mx',
            variant: 'gradient-dark', size: 'large', align: 'center',
          },
          children: {},
        },
        footer: FOOTER,
      },
    }),
  },
]
```

- [ ] **Step 2: Syntax check**

```bash
node --check apps/desktop/src/website/atlasBlocks/templates/moradaTemplate.js
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/website/atlasBlocks/templates/moradaTemplate.js
git commit -m "feat(website): Morada template — warm lifestyle home décor, 5 pages, 4 premium blocks"
```

---

### Task 7: Wire barrel files and verify

**Files:**
- Modify: `apps/desktop/src/website/atlasBlocks/templates/index.js`
- Modify: `apps/desktop/src/website/atlasTemplates/index.js`

- [ ] **Step 1: Update `atlasBlocks/templates/index.js`**

Replace the entire file:

```js
export { restauranteTemplate } from './restauranteTemplate.js'
export { spaTemplate }         from './spaTemplate.js'
export { tiendaTemplate }      from './tiendaTemplate.js'
export { agenciaTemplate }     from './agenciaTemplate.js'
export { negocioTemplate }     from './negocioTemplate.js'
export { moradaTemplate }      from './moradaTemplate.js'

import { restauranteTemplate } from './restauranteTemplate.js'
import { spaTemplate }         from './spaTemplate.js'
import { tiendaTemplate }      from './tiendaTemplate.js'
import { agenciaTemplate }     from './agenciaTemplate.js'
import { negocioTemplate }     from './negocioTemplate.js'
import { moradaTemplate }      from './moradaTemplate.js'

export const allAtlasTemplates = [
  restauranteTemplate,
  spaTemplate,
  tiendaTemplate,
  agenciaTemplate,
  negocioTemplate,
  moradaTemplate,
]
```

- [ ] **Step 2: Update `atlasTemplates/index.js`**

Replace the entire file:

```js
import { restauranteTemplate, restauranteSitePages } from '../atlasBlocks/templates/restauranteTemplate.js'
import { spaTemplate,         spaSitePages }         from '../atlasBlocks/templates/spaTemplate.js'
import { tiendaTemplate,      tiendaSitePages }      from '../atlasBlocks/templates/tiendaTemplate.js'
import { agenciaTemplate,     agenciaSitePages }     from '../atlasBlocks/templates/agenciaTemplate.js'
import { negocioTemplate,     negocioSitePages }     from '../atlasBlocks/templates/negocioTemplate.js'
import { moradaTemplate,      moradaSitePages }      from '../atlasBlocks/templates/moradaTemplate.js'

const CATEGORY_COLORS = {
  restaurante: '#92400e',
  belleza:     '#9d174d',
  ecommerce:   '#065f46',
  agencia:     '#1e3a8a',
  negocio:     '#4c1d95',
  hogar:       '#7C5A3E',
}

function buildPageData(templateId, pageId, label, routePath, description, { rootIds, blocks }) {
  return {
    schemaVersion: 1,
    id:         `page_${templateId}_${pageId}`,
    slug:       routePath,
    title:      label,
    visibility: 'public',
    regions: {
      main: { id: `region_${templateId}_${pageId}`, children: rootIds },
    },
    blocks,
    seo: { title: label, description, canonical: null, ogImageAssetId: null },
    updatedAt: new Date().toISOString(),
  }
}

function wrapTemplate(tpl, sitePages = []) {
  const homeData = tpl.build()
  return {
    id:          tpl.id,
    label:       tpl.label,
    description: tpl.description,
    color:       CATEGORY_COLORS[tpl.category] || '#334155',
    pages: [
      {
        id:        'home',
        label:     'Inicio',
        routePath: '/',
        required:  true,
        page:      buildPageData(tpl.id, 'home', 'Inicio', '/', tpl.description, homeData),
      },
      ...sitePages.map((p) => ({
        id:        p.id,
        label:     p.label,
        routePath: p.routePath,
        required:  p.required ?? false,
        page:      buildPageData(tpl.id, p.id, p.label, p.routePath, p.description ?? '', p.build()),
      })),
    ],
  }
}

export const allTemplates = [
  wrapTemplate(restauranteTemplate, restauranteSitePages),
  wrapTemplate(spaTemplate,        spaSitePages),
  wrapTemplate(tiendaTemplate,     tiendaSitePages),
  wrapTemplate(agenciaTemplate,    agenciaSitePages),
  wrapTemplate(negocioTemplate,    negocioSitePages),
  wrapTemplate(moradaTemplate,     moradaSitePages),
]
```

- [ ] **Step 3: Syntax check both files**

```bash
node --check apps/desktop/src/website/atlasBlocks/templates/index.js
node --check apps/desktop/src/website/atlasTemplates/index.js
```

Expected: no output for either.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/website/atlasBlocks/templates/index.js apps/desktop/src/website/atlasTemplates/index.js
git commit -m "feat(website): wire Morada template into barrel files — appears in ERP templates screen"
```

- [ ] **Step 5: Smoke test**

Start the dev server and navigate to `http://localhost:5173/app/m/atlas.website/templates`. You should see 6 template cards including "Morada" with a warm brown color. Click it — the preview route `/app/m/atlas.website/templates/atlas-morada/preview` should render:

1. Left panel: 5 page checkboxes (Inicio requerida + Colección, Nosotros, Cuidados, Contacto opcionales)
2. Right panel: live render of the Morada homepage — NavbarBlock at top, HeroBlock, MarqueeBlock (dark ticker scrolling), SplitFeatureBlock, ProductsGridBlock, BentoGridBlock, SplitFeatureBlock, QuoteBlock, GalleryBlock, TestimonialsBlock, CtaBannerBlock, FooterBlock

If the right panel shows `Vista previa no disponible` it means `serializePage(p.page)` threw — check that all block `type` strings match the registered block `type` fields exactly (case-sensitive: `MarqueeBlock`, `SplitFeatureBlock`, `BentoGridBlock`, `QuoteBlock`).

---

## Self-Review

**Spec coverage:**

| Spec requirement | Covered by |
|---|---|
| SplitFeatureBlock with variant, eyebrow, title, body, ctaLabel, ctaHref, imageSrc, imageAlt, background, imageHeight | Task 1 |
| MarqueeBlock with items, speed, background, size | Task 2 |
| BentoGridBlock with items (title/desc/size), background; size: normal/wide/tall/large | Task 3 |
| QuoteBlock with quote, attribution, background, size, ornament | Task 4 |
| 4 blocks added to universalAtlasBlocks | Task 5 |
| moradaTemplate added to buildAtlasTemplates for ecommerce + general | Task 5 |
| Morada homepage: 12 blocks including all 4 new ones | Task 6 |
| 4 extra pages: /coleccion, /nosotros, /cuidados, /contacto | Task 6 |
| NAVBAR/FOOTER constants shared across all pages | Task 6 |
| hogar color `#7C5A3E` in CATEGORY_COLORS | Task 7 |
| moradaTemplate in allAtlasTemplates barrel | Task 7 |
| moradaTemplate + moradaSitePages in allTemplates | Task 7 |

**Placeholder scan:** None found. All code blocks are complete.

**Type consistency:** Block `type` strings used in moradaTemplate.js (`MarqueeBlock`, `SplitFeatureBlock`, `BentoGridBlock`, `QuoteBlock`) match exactly the `type:` field in Tasks 1-4. `wrapTemplate` signature unchanged from existing code — `moradaTemplate` + `moradaSitePages` match the expected pattern.
