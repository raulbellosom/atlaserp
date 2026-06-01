# Morada — Premium Store Template Design

## Goal

Create a premium warm-lifestyle home decor store template ("Morada") for `atlas.website`, backed by 4 new reusable block types. The result must be the highest-quality template in the system — cohesive, editorial, elegant.

## Aesthetic

- **Style**: warm lifestyle — organic, close, aspirational but approachable
- **Products**: home & décor (furniture, textiles, objects)
- **Color palette** (hardcoded in block render, overridable via CSS vars):
  - Background: `#FAF7F2` (warm cream)
  - Foreground: `#1A1410` (dark warm brown)
  - Primary/accent: `#B5603A` (terracotta)
  - Muted: `#8C7E72` (warm gray)
  - Dark section: `#1A1410`
  - Cream section: `#EDE5D8`

## New Blocks

All 4 live in `apps/desktop/src/website/atlasBlocks/` and are registered in `universalAtlasBlocks` inside `atlasBlocks/index.js`.

---

### 1. `SplitFeatureBlock`

Full-width section: image fills one half (~55%), text fills the other (~45%).

**File**: `splitFeatureBlock.jsx`

**Props / fields**:

| Prop | Type | Default | Options |
|------|------|---------|---------|
| `variant` | select | `image-right` | `image-left`, `image-right` |
| `eyebrow` | text | `Nuestra historia` | — |
| `title` | text | `Diseño con propósito` | — |
| `body` | textarea | placeholder text | — |
| `ctaLabel` | text | `Conocer más` | — |
| `ctaHref` | text | `#` | — |
| `imageSrc` | image | `''` | — |
| `imageAlt` | text | `''` | — |
| `background` | select | `white` | `white`, `cream`, `dark` |
| `imageHeight` | select | `full` | `full` (image fills the half with no padding), `contained` (image with padding, rounded) |

**Render behavior**:
- Desktop: 2-column flex, image side has `overflow: hidden`, text side has `padding: 80px 64px`
- `full` imageHeight: image is `object-fit: cover`, `height: 100%`, no border-radius
- `contained` imageHeight: image has `border-radius: 16px`, `margin: 40px`, `object-fit: cover`
- Mobile (< 768px): stacks vertically, image always on top
- `dark` background: text switches to white, CTA inverts
- CTA: underline link style, not a pill button — more editorial

---

### 2. `MarqueeBlock`

Horizontal infinite-scroll ticker with CSS animation only.

**File**: `marqueeBlock.jsx`

**Props / fields**:

| Prop | Type | Default | Options |
|------|------|---------|---------|
| `items` | text | `Sala · Comedor · Recámara · Jardín · Baño · Estudio` | — |
| `speed` | select | `normal` | `slow` (60s), `normal` (35s), `fast` (20s) |
| `background` | select | `dark` | `cream`, `dark`, `primary` |
| `size` | select | `md` | `sm` (13px), `md` (16px), `lg` (22px) |

**Render behavior**:
- Outer: `overflow: hidden`, fixed height (~56px for md)
- Inner: flex row with two identical copies of the items string (for seamless loop)
- CSS animation: `@keyframes marquee { from { transform: translateX(0) } to { transform: translateX(-50%) } }`
- Animation injected as `<style>` tag inside the component (scoped with unique class)
- `primary` background: terracotta `#B5603A`, white text
- `dark` background: `#1A1410`, white text
- `cream` background: `#EDE5D8`, dark text
- Text: uppercase, letter-spacing `0.1em`

---

### 3. `BentoGridBlock`

CSS grid editorial layout with mixed-size cells.

**File**: `bentoGridBlock.jsx`

**Props / fields**:

| Prop | Type | Default | Options |
|------|------|---------|---------|
| `items` | textarea | 4 items with `---` separator | — |
| `background` | select | `cream` | `white`, `cream`, `dark` |

**Item format** (per `---` block):
```
Sala de estar
Descubre nuestra colección de sofás y mesas de centro.
large
```
Line 1: title. Line 2: description. Line 3: size hint (`normal` \| `wide` \| `tall` \| `large`).

**Grid layout** (3 cols × 2 rows):
- `large` → `grid-column: span 2; grid-row: span 2` (2×2, max one per grid)
- `wide` → `grid-column: span 2; grid-row: span 1` (2×1)
- `tall` → `grid-column: span 1; grid-row: span 2` (1×2)
- `normal` → `grid-column: span 1; grid-row: span 1` (1×1)

**Cell design**:
- Background alternates between `#FAF7F2` and `#EDE5D8` for cream bg; `#fff` and `#F5F0EA` for white bg
- Border-radius: `20px`
- Padding: `40px` (large cells), `28px` (normal cells)
- Title: `20px`, weight `700`, dark
- Description: `14px`, muted color
- Accent dot (8px circle, terracotta) top-left of each cell

**Render behavior**:
- `display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px`
- Max 6 items rendered (remaining ignored)
- Mobile: all cells collapse to `span 1` (single column)

---

### 4. `QuoteBlock`

Large editorial pull-quote, centered.

**File**: `quoteBlock.jsx`

**Props / fields**:

| Prop | Type | Default | Options |
|------|------|---------|---------|
| `quote` | textarea | placeholder quote | — |
| `attribution` | text | `— Morada` | — |
| `background` | select | `cream` | `white`, `cream`, `dark` |
| `size` | select | `large` | `normal` (28px), `large` (clamp 32px→52px) |
| `ornament` | select | `true` | `true`, `false` |

**Render behavior**:
- Section padding: `100px 24px` (large), `72px 24px` (normal)
- Max-width: `760px`, centered
- Ornament: decorative `"` rendered as a background element, `#B5603A` color, `font-size: 160px`, `opacity: 0.15`, absolutely positioned top-left of text area
- Attribution: `font-size: 13px`, `letter-spacing: 0.15em`, uppercase, muted color, `margin-top: 28px`
- `dark` background: text white, ornament white, attribution warm-gray

---

## Template: Morada

**Template file**: `apps/desktop/src/website/atlasBlocks/templates/moradaTemplate.js`

**Exported as**: `moradaTemplate` (added to `allAtlasTemplates` in `atlasBlocks/templates/index.js`)

**Site pages exported as**: `moradaSitePages` (imported by `atlasTemplates/index.js`)

**Category**: `hogar` — color `#7C5A3E` (warm brown)

---

### Homepage blocks (12)

| # | Block | Key props |
|---|-------|-----------|
| 1 | `NavbarBlock` | variant: `light`, brand: `Morada`, links to real routes, CTA: "Ver colección" → `/coleccion` |
| 2 | `HeroBlock` | variant: `image-bg`, title: "Objetos que dan vida al hogar", subtitle, CTA: `/coleccion`, minHeight: `95vh`, background: `{kind:'color',token:'fg'}` |
| 3 | `MarqueeBlock` | background: `dark`, items: `Sala · Comedor · Recámara · Jardín · Baño · Estudio`, speed: `normal`, size: `md` |
| 4 | `SplitFeatureBlock` | variant: `image-right`, title: "Diseño con propósito", body: curatorial story, background: `white`, imageHeight: `full` |
| 5 | `ProductsGridBlock` | limit: 8, columns: 4, showPrice: true, showAddToCart: true |
| 6 | `BentoGridBlock` | 4 items (Sala: large, Comedor: normal, Jardín: tall, Recámara: normal), background: `cream` |
| 7 | `SplitFeatureBlock` | variant: `image-left`, title: "Materiales que duran", body: quality/sustainability story, background: `cream`, imageHeight: `full` |
| 8 | `QuoteBlock` | size: `large`, ornament: `true`, background: `cream`, brand manifesto quote |
| 9 | `GalleryBlock` | 6 images, columns: 3, gap: `normal`, aspectRatio: `4/3` |
| 10 | `TestimonialsBlock` | 3 reseñas, columns: 3, background: `white` |
| 11 | `CtaBannerBlock` | title: "Suscríbete…", variant: `gradient-dark`, size: `normal` |
| 12 | `FooterBlock` | variant: `dark`, 3 columns, tagline de marca |

---

### Extra pages (4)

**`/coleccion`** — Catálogo completo:
NavbarBlock → HeroBlock (centered, small) → ServicesGridBlock (categorías) → ProductsGridBlock (12 items) → CtaBannerBlock → FooterBlock

**`/nosotros`** — Historia de la marca:
NavbarBlock → HeroBlock (centered) → SplitFeatureBlock (image-right: fundación) → SplitFeatureBlock (image-left: materiales) → QuoteBlock → StatsBlock → FooterBlock

**`/cuidados`** — Guía de cuidado de productos:
NavbarBlock → HeroBlock (centered, small) → BentoGridBlock (materiales: madera, lino, cerámica, cuero) → SplitFeatureBlock → CtaBannerBlock → FooterBlock

**`/contacto`** — Contacto:
NavbarBlock → FeaturesSectionBlock (info: dirección, horario, WhatsApp) → CtaBannerBlock → FooterBlock

---

## File Manifest

| File | Action |
|------|--------|
| `atlasBlocks/splitFeatureBlock.jsx` | Create |
| `atlasBlocks/marqueeBlock.jsx` | Create |
| `atlasBlocks/bentoGridBlock.jsx` | Create |
| `atlasBlocks/quoteBlock.jsx` | Create |
| `atlasBlocks/index.js` | Modify — add 4 blocks to imports, `universalAtlasBlocks`, and re-exports |
| `atlasBlocks/templates/moradaTemplate.js` | Create |
| `atlasBlocks/templates/index.js` | Modify — export `moradaTemplate` + add to `allAtlasTemplates` |
| `atlasTemplates/index.js` | Modify — import `moradaTemplate` + `moradaSitePages`, add to `allTemplates` |
| `atlasTemplates/templateRestaurante.js` | No change (legacy file, separate from new template system) |

## Implementation Order

1. Build the 4 block files (independent of each other)
2. Register in `atlasBlocks/index.js`
3. Build `moradaTemplate.js` (depends on blocks being registered for preview)
4. Update barrel files (`templates/index.js`, `atlasTemplates/index.js`)
5. Verify preview in `/app/m/atlas.website/templates/atlas-morada/preview`
