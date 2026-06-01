# Multi-Page Site Templates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the 5 site templates (Restaurante, Spa, Tienda, Agencia, Negocio) to generate 4–5 pre-filled pages each instead of 1, making the ERP templates screen genuinely useful for bootstrapping a complete website. Also improve UX feedback when pages are skipped.

**Architecture:** Each template file (`atlasBlocks/templates/*.js`) extracts its NavbarBlock and FooterBlock as shared module-level constants and adds a new named export (`*SitePages` array) of extra page builders. `atlasTemplates/index.js` is refactored: a new `buildPageData()` helper encapsulates the page object schema, and `wrapTemplate()` accepts the `sitePages` array. `WebsiteTemplatesScreen.jsx` gets minor copy changes for the "all pages skipped" scenario. `atlasBlocks/index.js` and `atlasBlocks/templates/index.js` are NOT touched — they only expose template objects for the web builder sidebar, not site-page definitions.

**Tech Stack:** Vanilla JS (no TS), React, TanStack Query, `@raulbellosom/atlas-web-builder` (`defineTemplate`, `serializePage`), block types: NavbarBlock · HeroBlock · FeaturesSectionBlock · ServicesGridBlock · MenuGridBlock · GalleryBlock · TestimonialsBlock · CtaBannerBlock · StatsBlock · TeamGridBlock · PricingBlock · ProductsGridBlock · FooterBlock.

---

### Task 1: Expand `restauranteTemplate.js` — 4 extra pages (menu, galería, nosotros, contacto)

**Files:**
- Modify: `apps/desktop/src/website/atlasBlocks/templates/restauranteTemplate.js`

- [ ] **Step 1: Replace the entire file**

```js
import { defineTemplate } from '@raulbellosom/atlas-web-builder'

const NAVBAR = {
  id: 'navbar',
  type: 'NavbarBlock',
  props: {
    variant: 'dark',
    brand: 'El Sabor',
    links: 'Inicio | /\nMenú | /menu\nGalería | /galeria\nNosotros | /nosotros\nContacto | /contacto',
    ctaLabel: 'Reservar mesa',
    ctaHref: '/contacto',
    ctaVariant: 'solid',
    sticky: true,
    height: '72',
  },
  children: {},
}

const FOOTER = {
  id: 'footer',
  type: 'FooterBlock',
  props: {
    variant: 'dark',
    brand: 'El Sabor',
    tagline: 'Cocina de autor con alma y tradición.',
    columns: 'Navegar | Navegar\nInicio | /\nMenú | /menu\nGalería | /galeria\nNosotros | /nosotros\n---\nContacto | Contacto\nReservaciones | /contacto\nWhatsApp | /\nInstagram | /\n---\nHorario | Horario\nLunes a Viernes | /\n1:00pm – 11:00pm | /\nSábados y Domingos | /\n12:00pm – 11:30pm | /',
    copyright: `© ${new Date().getFullYear()} El Sabor. Todos los derechos reservados.`,
    showBrand: true,
  },
  children: {},
}

export const restauranteTemplate = defineTemplate({
  id: 'atlas-restaurante',
  label: 'Restaurante',
  description: 'Sitio elegante para restaurantes y cafeterías con menú, galería y reservaciones.',
  category: 'restaurante',
  build() {
    return {
      rootIds: ['navbar', 'hero', 'features', 'menu', 'gallery', 'testimonials', 'booking', 'footer'],
      blocks: {
        navbar: NAVBAR,
        hero: {
          id: 'hero',
          type: 'HeroBlock',
          props: {
            variant: 'image-bg',
            title: 'Sabores que enamoran',
            subtitle: 'Cocina de autor con ingredientes frescos y recetas que conquistan el paladar. Una experiencia gastronómica que no olvidarás.',
            eyebrow: 'Bienvenidos a El Sabor',
            ctaLabel: 'Ver el menú',
            ctaHref: '/menu',
            ctaVariant: 'solid',
            ctaSecondLabel: 'Hacer reservación',
            ctaSecondHref: '/contacto',
            imageSrc: '',
            background: { kind: 'color', token: 'fg' },
            align: 'center',
            paddingY: '16',
            minHeight: '90vh',
            titleSize: '3xl',
            contentMaxWidth: '65ch',
          },
          children: {},
        },
        features: {
          id: 'features',
          type: 'ServicesGridBlock',
          props: {
            eyebrow: 'Por qué elegirnos',
            title: 'Una experiencia gastronómica única',
            subtitle: 'Cada visita es una ocasión especial. Nos comprometemos con la calidad en cada detalle.',
            columns: '3',
            services: 'Ingredientes frescos\nSeleccionamos los mejores productos locales de temporada para garantizar frescura y sabor incomparables.\n---\nChef de autor\nNuestro equipo culinario fusiona técnicas modernas con recetas tradicionales para crear platillos únicos.\n---\nAmbiente acogedor\nEspacios diseñados para que cada momento sea especial, ya sea una cita íntima o una reunión familiar.',
            cardStyle: 'minimal',
            align: 'center',
          },
          children: {},
        },
        menu: {
          id: 'menu',
          type: 'MenuGridBlock',
          props: {
            eyebrow: 'Lo que servimos',
            title: 'Nuestro Menú',
            subtitle: 'Platillos elaborados con pasión, perfectos para cada ocasión.',
            currency: '$',
            showPrices: true,
            columns: '2',
            menu: 'Entradas\nEnsalada de la Casa | Mixta con aderezo balsámico y queso manchego | 9.00\nSopa de Fideo Seco | Receta tradicional con chipotle y crema | 7.00\nCeviche de Camarón | Camarón fresco, limón, cilantro y chile | 13.00\nAgua de Jamaica | 500ml, flor de jamaica natural | 4.00\n---\nPlatos Fuertes\nFilete a las Brasas | 300g corte premium con guarnición a elegir | 32.00\nPollo en Mole Negro | Mole de 30 ingredientes con arroz y frijoles | 22.00\nPasta al Pesto | Fettuccine con pesto artesanal y parmesano | 18.00\nPescado a la Plancha | Filete del día con verduras asadas | 26.00\n---\nPostres\nFlan de Cajeta | Receta de la abuela, irresistible | 6.00\nPastel de Tres Leches | Esponjoso, húmedo y delicioso | 7.50\nHelado Artesanal | 3 bolas a elegir de nuestra carta | 5.00',
          },
          children: {},
        },
        gallery: {
          id: 'gallery',
          type: 'GalleryBlock',
          props: {
            eyebrow: 'Nuestro espacio',
            title: 'Galería',
            subtitle: 'Conoce el ambiente que hemos creado para ti.',
            columns: '3',
            gap: 'tight',
            aspectRatio: '4/3',
            image1: '', image2: '', image3: '',
            image4: '', image5: '', image6: '',
          },
          children: {},
        },
        testimonials: {
          id: 'testimonials',
          type: 'TestimonialsBlock',
          props: {
            eyebrow: 'Nuestros comensales',
            title: 'Lo que dicen quienes nos visitan',
            columns: '3',
            background: 'muted',
            testimonials: 'Valentina Cruz|Cliente frecuente|5\nSin duda el mejor restaurante de la ciudad. La comida es exquisita y el servicio impecable. Cada vez que vengo es una experiencia diferente y siempre sorprendente.\n---\nRoberto Sánchez|Empresario|5\nLlevé a un cliente importante y quedó encantado. El ambiente es elegante sin ser pretencioso. Los platillos llegaron perfectos y a tiempo. Regresaremos sin duda.\n---\nLaura Ibáñez|Foodie y blogger|4\nUna cocina honesta y llena de sabor. El mole negro es espectacular y el servicio muy atento. Un lugar que recomendaré siempre en mi blog.',
          },
          children: {},
        },
        booking: {
          id: 'booking',
          type: 'CtaBannerBlock',
          props: {
            eyebrow: 'Reservaciones',
            title: 'Haz tu reservación hoy',
            subtitle: 'Asegura tu lugar para vivir una experiencia gastronómica que no olvidarás. Disponible todos los días de 1pm a 11pm.',
            ctaLabel: 'Reservar mesa',
            ctaHref: '/contacto',
            ctaSecondLabel: 'Llamar ahora',
            ctaSecondHref: 'tel:+525500000000',
            variant: 'gradient-dark',
            size: 'normal',
            align: 'center',
          },
          children: {},
        },
        footer: FOOTER,
      },
    }
  },
})

export const restauranteSitePages = [
  {
    id: 'menu',
    label: 'Menu',
    routePath: '/menu',
    required: false,
    description: 'Nuestro menú completo con precios.',
    build: () => ({
      rootIds: ['navbar', 'hero', 'menu', 'booking', 'footer'],
      blocks: {
        navbar: NAVBAR,
        hero: {
          id: 'hero',
          type: 'HeroBlock',
          props: {
            variant: 'centered',
            title: 'Nuestro Menú',
            subtitle: 'Platillos elaborados con ingredientes frescos y pasión por la gastronomía de autor.',
            eyebrow: 'Lo que servimos',
            ctaLabel: '',
            ctaHref: '',
            ctaSecondLabel: '',
            ctaSecondHref: '',
            imageSrc: '',
            background: { kind: 'color', token: 'muted' },
            align: 'center',
            paddingY: '12',
            minHeight: '40vh',
            titleSize: '2xl',
            contentMaxWidth: '60ch',
          },
          children: {},
        },
        menu: {
          id: 'menu',
          type: 'MenuGridBlock',
          props: {
            eyebrow: 'Carta completa',
            title: 'Todo nuestro menú',
            subtitle: 'Cada platillo, elaborado con los mejores ingredientes de temporada.',
            currency: '$',
            showPrices: true,
            columns: '2',
            menu: 'Entradas\nEnsalada de la Casa | Mixta con aderezo balsámico y queso manchego | 9.00\nSopa de Fideo Seco | Receta tradicional con chipotle y crema | 7.00\nCeviche de Camarón | Camarón fresco, limón, cilantro y chile | 13.00\nAgua de Jamaica | 500ml, flor de jamaica natural | 4.00\n---\nPlatos Fuertes\nFilete a las Brasas | 300g corte premium con guarnición a elegir | 32.00\nPollo en Mole Negro | Mole de 30 ingredientes con arroz y frijoles | 22.00\nPasta al Pesto | Fettuccine con pesto artesanal y parmesano | 18.00\nPescado a la Plancha | Filete del día con verduras asadas | 26.00\n---\nPostres\nFlan de Cajeta | Receta de la abuela, irresistible | 6.00\nPastel de Tres Leches | Esponjoso, húmedo y delicioso | 7.50\nHelado Artesanal | 3 bolas a elegir de nuestra carta | 5.00\n---\nBebidas\nAgua de Fruta | Del día, 500ml | 4.00\nRefrescos | Varios sabores | 3.50\nVino de la Casa | Copa, blanco o tinto | 8.00\nCerveza Artesanal | Botella 355ml | 7.00',
          },
          children: {},
        },
        booking: {
          id: 'booking',
          type: 'CtaBannerBlock',
          props: {
            eyebrow: 'Reservaciones',
            title: 'Haz tu reservación hoy',
            subtitle: 'Asegura tu lugar para vivir una experiencia gastronómica que no olvidarás.',
            ctaLabel: 'Reservar mesa',
            ctaHref: '/contacto',
            ctaSecondLabel: 'Llamar ahora',
            ctaSecondHref: 'tel:+525500000000',
            variant: 'gradient-dark',
            size: 'compact',
            align: 'center',
          },
          children: {},
        },
        footer: FOOTER,
      },
    }),
  },
  {
    id: 'galeria',
    label: 'Galería',
    routePath: '/galeria',
    required: false,
    description: 'Galería de imágenes de nuestro espacio y platillos.',
    build: () => ({
      rootIds: ['navbar', 'hero', 'gallery', 'cta', 'footer'],
      blocks: {
        navbar: NAVBAR,
        hero: {
          id: 'hero',
          type: 'HeroBlock',
          props: {
            variant: 'centered',
            title: 'Galería',
            subtitle: 'Conoce el ambiente que hemos creado y los platillos que nos hacen únicos.',
            eyebrow: 'Nuestro espacio',
            ctaLabel: '',
            ctaHref: '',
            ctaSecondLabel: '',
            ctaSecondHref: '',
            imageSrc: '',
            background: { kind: 'color', token: 'muted' },
            align: 'center',
            paddingY: '12',
            minHeight: '40vh',
            titleSize: '2xl',
            contentMaxWidth: '55ch',
          },
          children: {},
        },
        gallery: {
          id: 'gallery',
          type: 'GalleryBlock',
          props: {
            eyebrow: 'Fotos del restaurante',
            title: 'El ambiente que te espera',
            subtitle: 'Espacios diseñados para momentos especiales y platillos que enamoran a la vista.',
            columns: '3',
            gap: 'normal',
            aspectRatio: '4/3',
            image1: '', image2: '', image3: '',
            image4: '', image5: '', image6: '',
          },
          children: {},
        },
        cta: {
          id: 'cta',
          type: 'CtaBannerBlock',
          props: {
            eyebrow: '',
            title: 'Visítanos pronto',
            subtitle: 'Haz tu reservación y vive la experiencia en persona.',
            ctaLabel: 'Reservar mesa',
            ctaHref: '/contacto',
            ctaSecondLabel: 'Ver el menú',
            ctaSecondHref: '/menu',
            variant: 'gradient-dark',
            size: 'compact',
            align: 'center',
          },
          children: {},
        },
        footer: FOOTER,
      },
    }),
  },
  {
    id: 'nosotros',
    label: 'Nosotros',
    routePath: '/nosotros',
    required: false,
    description: 'Nuestra historia y los valores del restaurante.',
    build: () => ({
      rootIds: ['navbar', 'hero', 'story', 'values', 'testimonials', 'cta', 'footer'],
      blocks: {
        navbar: NAVBAR,
        hero: {
          id: 'hero',
          type: 'HeroBlock',
          props: {
            variant: 'centered',
            title: 'Nuestra Historia',
            subtitle: 'Conoce la pasión, los valores y las personas que hacen de El Sabor un lugar especial.',
            eyebrow: 'Sobre nosotros',
            ctaLabel: 'Ver el menú',
            ctaHref: '/menu',
            ctaSecondLabel: 'Reservar',
            ctaSecondHref: '/contacto',
            imageSrc: '',
            background: { kind: 'color', token: 'bg' },
            align: 'center',
            paddingY: '14',
            minHeight: '50vh',
            titleSize: '2xl',
            contentMaxWidth: '60ch',
          },
          children: {},
        },
        story: {
          id: 'story',
          type: 'FeaturesSectionBlock',
          props: {
            eyebrow: 'Nuestra historia',
            title: 'Más de una década compartiendo sabores',
            subtitle: 'Nacimos de la pasión por la gastronomía y el deseo de crear un espacio donde cada visita sea memorable.',
            layout: 'grid-2',
            iconStyle: 'check',
            background: 'white',
            features: 'Fundados en 2012\nComenzamos como un pequeño bistró familiar con una misión: llevar cocina de autor accesible a nuestra comunidad.\n---\nIngredientes locales\nDesde el primer día apostamos por proveedores locales y productos de temporada para garantizar frescura y apoyar la economía local.\n---\nChef reconocido\nNuestro chef ejecutivo acumula más de 15 años de experiencia en cocinas de México, España e Italia.\n---\nPremio a la calidad\nFuimos reconocidos como uno de los mejores restaurantes de la región en 2022 y 2024.',
          },
          children: {},
        },
        values: {
          id: 'values',
          type: 'ServicesGridBlock',
          props: {
            eyebrow: 'Lo que nos mueve',
            title: 'Nuestros valores',
            subtitle: 'Principios que guían cada platillo que ponemos en tu mesa.',
            columns: '3',
            services: 'Calidad sin compromiso\nSeleccionamos los mejores ingredientes y aplicamos técnicas que garantizan un resultado excepcional en cada platillo.\n---\nServicio con calidez\nCreemos que una gran comida se complementa con un servicio atento, cálido y profesional en cada visita.\n---\nTradición e innovación\nRespetamos las recetas tradicionales mientras exploramos nuevas técnicas y sabores para mantenernos frescos y relevantes.',
            cardStyle: 'minimal',
            align: 'center',
          },
          children: {},
        },
        testimonials: {
          id: 'testimonials',
          type: 'TestimonialsBlock',
          props: {
            eyebrow: 'Nuestros comensales',
            title: 'Lo que dicen quienes nos visitan',
            columns: '3',
            background: 'muted',
            testimonials: 'Valentina Cruz|Cliente frecuente|5\nSin duda el mejor restaurante de la ciudad. La comida es exquisita y el servicio impecable. Cada vez que vengo es una experiencia diferente y siempre sorprendente.\n---\nRoberto Sánchez|Empresario|5\nLlevé a un cliente importante y quedó encantado. El ambiente es elegante sin ser pretencioso. Los platillos llegaron perfectos y a tiempo. Regresaremos sin duda.\n---\nLaura Ibáñez|Foodie y blogger|4\nUna cocina honesta y llena de sabor. El mole negro es espectacular y el servicio muy atento. Un lugar que recomendaré siempre en mi blog.',
          },
          children: {},
        },
        cta: {
          id: 'cta',
          type: 'CtaBannerBlock',
          props: {
            eyebrow: '',
            title: '¿Listo para visitarnos?',
            subtitle: 'Haz tu reservación y vive la experiencia.',
            ctaLabel: 'Reservar mesa',
            ctaHref: '/contacto',
            ctaSecondLabel: 'Ver el menú',
            ctaSecondHref: '/menu',
            variant: 'gradient-dark',
            size: 'compact',
            align: 'center',
          },
          children: {},
        },
        footer: FOOTER,
      },
    }),
  },
  {
    id: 'contacto',
    label: 'Contacto',
    routePath: '/contacto',
    required: false,
    description: 'Información de contacto y reservaciones.',
    build: () => ({
      rootIds: ['navbar', 'info', 'cta', 'footer'],
      blocks: {
        navbar: NAVBAR,
        info: {
          id: 'info',
          type: 'FeaturesSectionBlock',
          props: {
            eyebrow: 'Cómo encontrarnos',
            title: 'Información de contacto',
            subtitle: 'Estamos aquí para atenderte. Visítanos, llámanos o escríbenos.',
            layout: 'grid-3',
            iconStyle: 'check',
            background: 'white',
            features: 'Dirección\nCentro Histórico, Ciudad de México. A dos cuadras de la estación de metro.\n---\nHorario\nLunes a viernes: 1:00pm – 11:00pm\nSábados y domingos: 12:00pm – 11:30pm\n---\nTeléfono y WhatsApp\nLlámanos o escríbenos al +52 55 0000 0000. Respondemos en minutos.',
          },
          children: {},
        },
        cta: {
          id: 'cta',
          type: 'CtaBannerBlock',
          props: {
            eyebrow: 'Reservaciones',
            title: 'Haz tu reservación hoy',
            subtitle: 'Asegura tu lugar para vivir una experiencia gastronómica que no olvidarás.',
            ctaLabel: 'WhatsApp',
            ctaHref: 'https://wa.me/525500000000',
            ctaSecondLabel: 'Llamar ahora',
            ctaSecondHref: 'tel:+525500000000',
            variant: 'gradient-dark',
            size: 'large',
            align: 'center',
          },
          children: {},
        },
        footer: FOOTER,
      },
    }),
  },
]
```

- [ ] **Step 2: Verify no syntax errors**

```bash
node --check apps/desktop/src/website/atlasBlocks/templates/restauranteTemplate.js
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/website/atlasBlocks/templates/restauranteTemplate.js
git commit -m "feat(website): expand restaurante template to 5 pages — menu, galería, nosotros, contacto"
```

---

### Task 2: Expand `spaTemplate.js` — 3 extra pages (servicios, equipo, contacto)

**Files:**
- Modify: `apps/desktop/src/website/atlasBlocks/templates/spaTemplate.js`

- [ ] **Step 1: Replace the entire file**

```js
import { defineTemplate } from '@raulbellosom/atlas-web-builder'

const NAVBAR = {
  id: 'navbar',
  type: 'NavbarBlock',
  props: {
    variant: 'light',
    brand: 'Serenity Spa',
    links: 'Inicio | /\nServicios | /servicios\nEquipo | /equipo\nContacto | /contacto',
    ctaLabel: 'Reservar cita',
    ctaHref: '/contacto',
    ctaVariant: 'solid',
    sticky: true,
    height: '68',
  },
  children: {},
}

const FOOTER = {
  id: 'footer',
  type: 'FooterBlock',
  props: {
    variant: 'light',
    brand: 'Serenity Spa',
    tagline: 'Bienestar integral para cuerpo, mente y espíritu.',
    columns: 'Servicios | Servicios\nMasajes | /servicios\nFaciales | /servicios\nAromaterapia | /servicios\nYoga | /servicios\n---\nInformación | Información\nNosotros | /\nEquipo | /equipo\nPolítica de privacidad | /\n---\nContacto | Contacto\nReservar cita | /contacto\nWhatsApp | /\nInstagram | /',
    copyright: `© ${new Date().getFullYear()} Serenity Spa. Todos los derechos reservados.`,
    showBrand: true,
  },
  children: {},
}

export const spaTemplate = defineTemplate({
  id: 'atlas-spa',
  label: 'Spa & Bienestar',
  description: 'Diseño suave y elegante para spas, salones de belleza, yoga y wellness.',
  category: 'belleza',
  build() {
    return {
      rootIds: ['navbar', 'hero', 'services', 'stats', 'features', 'testimonials', 'booking', 'team', 'footer'],
      blocks: {
        navbar: NAVBAR,
        hero: {
          id: 'hero',
          type: 'HeroBlock',
          props: {
            variant: 'split',
            title: 'Renueva tu cuerpo y mente',
            subtitle: 'Escápate del mundo y descubre el equilibrio perfecto entre relajación y bienestar. Tu momento de paz te espera.',
            eyebrow: 'Bienvenida a Serenity',
            ctaLabel: 'Ver servicios',
            ctaHref: '/servicios',
            ctaVariant: 'solid',
            ctaSecondLabel: 'Agenda una cita',
            ctaSecondHref: '/contacto',
            imageSrc: '',
            background: { kind: 'color', token: 'bg' },
            align: 'left',
            paddingY: '16',
            minHeight: '85vh',
            titleSize: '3xl',
            contentMaxWidth: '55ch',
          },
          children: {},
        },
        services: {
          id: 'services',
          type: 'ServicesGridBlock',
          props: {
            eyebrow: 'Lo que ofrecemos',
            title: 'Nuestros Servicios',
            subtitle: 'Cada tratamiento ha sido diseñado para brindarte una experiencia transformadora.',
            columns: '3',
            services: 'Masajes Terapéuticos\nTécnicas especializadas para aliviar tensiones, mejorar la circulación y restaurar tu bienestar físico y mental.\n---\nFaciales Premium\nTratamientos faciales con productos naturales de primera calidad para una piel radiante y rejuvenecida.\n---\nAromaterapia\nSesiones de relajación profunda con aceites esenciales puros que equilibran cuerpo, mente y espíritu.\n---\nYoga & Meditación\nClases guiadas para todos los niveles que te ayudarán a encontrar el centro y la calma interior.\n---\nHidroterapia\nCircuitos de agua con diferentes temperaturas que estimulan la circulación y eliminan toxinas.\n---\nNutrición Holística\nAsesoría personalizada para complementar tus tratamientos con hábitos alimenticios que transforman.',
            cardStyle: 'card',
            align: 'center',
          },
          children: {},
        },
        stats: {
          id: 'stats',
          type: 'StatsBlock',
          props: {
            eyebrow: '',
            title: '',
            stats: '5,000+\nClientes satisfechas\nConfían en nosotros\n---\n12 años\nDe experiencia\nEn bienestar integral\n---\n98%\nSatisfacción\nTasa de retorno\n---\n25+\nTratamientos\nEspecializados',
            background: 'primary',
            align: 'center',
          },
          children: {},
        },
        features: {
          id: 'features',
          type: 'FeaturesSectionBlock',
          props: {
            eyebrow: 'La diferencia Serenity',
            title: 'Una experiencia diseñada para ti',
            subtitle: 'Cada detalle de tu visita está pensado para que salgas renovada y con ganas de volver.',
            layout: 'grid-2',
            iconStyle: 'check',
            background: 'muted',
            features: 'Ambiente de total privacidad\nEspacios íntimos diseñados para que te desconectes completamente del mundo exterior.\n---\nProductos 100% naturales\nUtilizamos exclusivamente ingredientes orgánicos y cruelty-free en todos nuestros tratamientos.\n---\nTerapeutas certificadas\nNuestro equipo cuenta con certificaciones internacionales y años de experiencia especializada.\n---\nPersonalización total\nCada tratamiento se adapta a tus necesidades específicas, tipo de piel y objetivos de bienestar.\n---\nReservas fáciles\nAgenda tu cita en minutos a través de nuestra plataforma en línea, disponible 24/7.\n---\nSeguimiento continuo\nTe enviamos recordatorios y recomendaciones personalizadas para mantener tus resultados.',
          },
          children: {},
        },
        testimonials: {
          id: 'testimonials',
          type: 'TestimonialsBlock',
          props: {
            eyebrow: 'Experiencias reales',
            title: 'Lo que dicen nuestras clientas',
            columns: '3',
            background: 'white',
            testimonials: 'Mariana López|Clienta desde 2019|5\nSerenity Spa cambió completamente mi rutina de bienestar. Llevo 5 años visitándolas y cada vez la experiencia es mejor. El masaje de aromaterapia es mi favorito absoluto.\n---\nPatricia Ruiz|Empresaria|5\nUn oasis en medio de la ciudad. Vengo cada dos semanas y es lo que me mantiene equilibrada. Las terapeutas son expertas y muy profesionales. ¡Imprescindible!\n---\nAlejandra Torres|Médica|5\nComo profesional de la salud, aprecio la rigurosidad en sus protocolos y la calidad de sus productos. Me siento en muy buenas manos cada vez que vengo.',
          },
          children: {},
        },
        booking: {
          id: 'booking',
          type: 'CtaBannerBlock',
          props: {
            eyebrow: 'Agenda tu cita',
            title: 'Tu momento de paz comienza hoy',
            subtitle: 'Regálate el descanso que mereces. Primera consulta sin costo y 20% de descuento en tu primer tratamiento.',
            ctaLabel: 'Reservar ahora',
            ctaHref: '/contacto',
            ctaSecondLabel: 'WhatsApp',
            ctaSecondHref: 'https://wa.me/525500000000',
            variant: 'gradient-primary',
            size: 'normal',
            align: 'center',
          },
          children: {},
        },
        team: {
          id: 'team',
          type: 'TeamGridBlock',
          props: {
            eyebrow: 'Nuestras expertas',
            title: 'El equipo que cuida de ti',
            subtitle: 'Profesionales apasionadas y certificadas, dedicadas a tu bienestar.',
            columns: '3',
            layout: 'centered',
            team: 'Dra. Elena Vidal|Directora & Terapeuta Senior\nEspecialista en bienestar holístico con certificación internacional en terapias integrativas y más de 12 años de experiencia.\n---\nCarolina Jiménez|Esteticista Premium\nExperta en tratamientos faciales avanzados y técnicas de rejuvenecimiento no invasivo con productos de alta gama.\n---\nValeria Moreno|Instructora de Yoga\nCertificada en yoga terapéutico y meditación mindfulness. Imparte clases para todos los niveles con enfoque holístico.',
            photo1: '', photo2: '', photo3: '',
          },
          children: {},
        },
        footer: FOOTER,
      },
    }
  },
})

export const spaSitePages = [
  {
    id: 'servicios',
    label: 'Servicios',
    routePath: '/servicios',
    required: false,
    description: 'Catálogo completo de tratamientos y servicios.',
    build: () => ({
      rootIds: ['navbar', 'hero', 'services', 'features', 'booking', 'footer'],
      blocks: {
        navbar: NAVBAR,
        hero: {
          id: 'hero',
          type: 'HeroBlock',
          props: {
            variant: 'centered',
            title: 'Nuestros Servicios',
            subtitle: 'Cada tratamiento ha sido diseñado para brindarte una experiencia transformadora. Elige el que más necesitas.',
            eyebrow: 'Tratamientos especializados',
            ctaLabel: 'Reservar cita',
            ctaHref: '/contacto',
            ctaVariant: 'solid',
            ctaSecondLabel: '',
            ctaSecondHref: '',
            imageSrc: '',
            background: { kind: 'color', token: 'muted' },
            align: 'center',
            paddingY: '12',
            minHeight: '45vh',
            titleSize: '2xl',
            contentMaxWidth: '60ch',
          },
          children: {},
        },
        services: {
          id: 'services',
          type: 'ServicesGridBlock',
          props: {
            eyebrow: 'Todos nuestros tratamientos',
            title: 'Diseñados para tu bienestar',
            subtitle: 'Cada servicio está personalizado y llevado a cabo por especialistas certificadas.',
            columns: '3',
            services: 'Masajes Terapéuticos\nTécnicas especializadas para aliviar tensiones, mejorar la circulación y restaurar tu bienestar físico y mental. Duración: 60–90 min.\n---\nFaciales Premium\nTratamientos faciales con productos naturales de primera calidad para una piel radiante y rejuvenecida. Para todo tipo de piel.\n---\nAromaterapia\nSesiones de relajación profunda con aceites esenciales puros que equilibran cuerpo, mente y espíritu. Duración: 60 min.\n---\nYoga & Meditación\nClases guiadas para todos los niveles. Te ayudarán a encontrar el centro y la calma interior. Grupos pequeños o privadas.\n---\nHidroterapia\nCircuitos de agua con diferentes temperaturas que estimulan la circulación y eliminan toxinas. Incluye área húmeda completa.\n---\nNutrición Holística\nAsesoría personalizada para complementar tus tratamientos con hábitos alimenticios que transforman. Sesión de 45 min.',
            cardStyle: 'card',
            align: 'left',
          },
          children: {},
        },
        features: {
          id: 'features',
          type: 'FeaturesSectionBlock',
          props: {
            eyebrow: 'Por qué elegirnos',
            title: 'La diferencia Serenity',
            subtitle: 'No somos un spa más. Somos tu aliada en bienestar.',
            layout: 'grid-2',
            iconStyle: 'check',
            background: 'muted',
            features: 'Productos 100% naturales\nUtilizamos exclusivamente ingredientes orgánicos y cruelty-free en todos nuestros tratamientos sin excepción.\n---\nTerapeutas certificadas\nNuestro equipo cuenta con certificaciones internacionales y años de experiencia especializada en cada área.\n---\nPersonalización total\nCada tratamiento se adapta a tus necesidades específicas, tipo de piel y objetivos de bienestar.\n---\nReservas fáciles\nAgenda tu cita en minutos. Disponible 24/7 online o por WhatsApp.',
          },
          children: {},
        },
        booking: {
          id: 'booking',
          type: 'CtaBannerBlock',
          props: {
            eyebrow: 'Agenda tu cita',
            title: 'Tu momento de paz comienza hoy',
            subtitle: 'Primera consulta sin costo y 20% de descuento en tu primer tratamiento.',
            ctaLabel: 'Reservar ahora',
            ctaHref: '/contacto',
            ctaSecondLabel: 'WhatsApp',
            ctaSecondHref: 'https://wa.me/525500000000',
            variant: 'gradient-primary',
            size: 'normal',
            align: 'center',
          },
          children: {},
        },
        footer: FOOTER,
      },
    }),
  },
  {
    id: 'equipo',
    label: 'Equipo',
    routePath: '/equipo',
    required: false,
    description: 'Conoce al equipo de expertas que cuidan de ti.',
    build: () => ({
      rootIds: ['navbar', 'hero', 'team', 'testimonials', 'booking', 'footer'],
      blocks: {
        navbar: NAVBAR,
        hero: {
          id: 'hero',
          type: 'HeroBlock',
          props: {
            variant: 'centered',
            title: 'Nuestro Equipo',
            subtitle: 'Profesionales apasionadas, certificadas y dedicadas a tu bienestar en cada visita.',
            eyebrow: 'Las manos que cuidan de ti',
            ctaLabel: 'Reservar cita',
            ctaHref: '/contacto',
            ctaVariant: 'solid',
            ctaSecondLabel: '',
            ctaSecondHref: '',
            imageSrc: '',
            background: { kind: 'color', token: 'muted' },
            align: 'center',
            paddingY: '12',
            minHeight: '45vh',
            titleSize: '2xl',
            contentMaxWidth: '58ch',
          },
          children: {},
        },
        team: {
          id: 'team',
          type: 'TeamGridBlock',
          props: {
            eyebrow: 'Nuestras especialistas',
            title: 'El equipo que cuida de ti',
            subtitle: 'Cada miembro de nuestro equipo está certificada y apasionada por el bienestar.',
            columns: '3',
            layout: 'card',
            team: 'Dra. Elena Vidal|Directora & Terapeuta Senior\nEspecialista en bienestar holístico con certificación internacional en terapias integrativas y más de 12 años de experiencia.\n---\nCarolina Jiménez|Esteticista Premium\nExperta en tratamientos faciales avanzados y técnicas de rejuvenecimiento no invasivo con productos de alta gama.\n---\nValeria Moreno|Instructora de Yoga\nCertificada en yoga terapéutico y meditación mindfulness. Imparte clases para todos los niveles con enfoque holístico.\n---\nSofía Ramírez|Terapeuta en Hidroterapia\nEspecialista en circuitos de agua, baños de inmersión y terapias de contraste para la recuperación y el bienestar.\n---\nAna Gutiérrez|Nutrióloga Holística\nLicenciada en nutrición con enfoque en alimentación consciente y planes personalizados para complementar los tratamientos del spa.\n---\nLorena Castro|Masajista Deportiva\nCertificada en técnicas de masaje deportivo, relajación profunda y liberación miofascial para atletas y personas activas.',
            photo1: '', photo2: '', photo3: '', photo4: '', photo5: '', photo6: '',
          },
          children: {},
        },
        testimonials: {
          id: 'testimonials',
          type: 'TestimonialsBlock',
          props: {
            eyebrow: 'Experiencias reales',
            title: 'Lo que dicen nuestras clientas',
            columns: '3',
            background: 'muted',
            testimonials: 'Mariana López|Clienta desde 2019|5\nSerenity Spa cambió completamente mi rutina de bienestar. Llevo 5 años visitándolas y cada vez la experiencia es mejor. El masaje de aromaterapia es mi favorito absoluto.\n---\nPatricia Ruiz|Empresaria|5\nUn oasis en medio de la ciudad. Vengo cada dos semanas y es lo que me mantiene equilibrada. Las terapeutas son expertas y muy profesionales.\n---\nAlejandra Torres|Médica|5\nComo profesional de la salud, aprecio la rigurosidad en sus protocolos y la calidad de sus productos. Me siento en muy buenas manos cada vez que vengo.',
          },
          children: {},
        },
        booking: {
          id: 'booking',
          type: 'CtaBannerBlock',
          props: {
            eyebrow: '',
            title: 'Elige a tu terapeuta favorita',
            subtitle: 'Reserva tu cita y dinos con quién prefieres trabajar.',
            ctaLabel: 'Reservar ahora',
            ctaHref: '/contacto',
            ctaSecondLabel: 'WhatsApp',
            ctaSecondHref: 'https://wa.me/525500000000',
            variant: 'gradient-primary',
            size: 'compact',
            align: 'center',
          },
          children: {},
        },
        footer: FOOTER,
      },
    }),
  },
  {
    id: 'contacto',
    label: 'Contacto',
    routePath: '/contacto',
    required: false,
    description: 'Agenda tu cita e información de contacto.',
    build: () => ({
      rootIds: ['navbar', 'info', 'cta', 'footer'],
      blocks: {
        navbar: NAVBAR,
        info: {
          id: 'info',
          type: 'FeaturesSectionBlock',
          props: {
            eyebrow: 'Cómo encontrarnos',
            title: 'Información de contacto',
            subtitle: 'Estamos aquí para atenderte. Visítanos, llámanos o escríbenos.',
            layout: 'grid-3',
            iconStyle: 'check',
            background: 'white',
            features: 'Dirección\nColonia Polanco, Ciudad de México. En un ambiente de total privacidad y tranquilidad.\n---\nHorario\nLunes a sábado: 9:00am – 8:00pm\nDomingos: 10:00am – 5:00pm\n---\nTeléfono y WhatsApp\nLlámanos o escríbenos al +52 55 0000 0000 para agendar tu cita de manera rápida.',
          },
          children: {},
        },
        cta: {
          id: 'cta',
          type: 'CtaBannerBlock',
          props: {
            eyebrow: 'Agenda tu cita',
            title: 'Tu momento de paz comienza hoy',
            subtitle: 'Primera consulta sin costo y 20% de descuento en tu primer tratamiento.',
            ctaLabel: 'WhatsApp',
            ctaHref: 'https://wa.me/525500000000',
            ctaSecondLabel: 'Llamar ahora',
            ctaSecondHref: 'tel:+525500000000',
            variant: 'gradient-primary',
            size: 'large',
            align: 'center',
          },
          children: {},
        },
        footer: FOOTER,
      },
    }),
  },
]
```

- [ ] **Step 2: Verify no syntax errors**

```bash
node --check apps/desktop/src/website/atlasBlocks/templates/spaTemplate.js
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/website/atlasBlocks/templates/spaTemplate.js
git commit -m "feat(website): expand spa template to 4 pages — servicios, equipo, contacto"
```

---

### Task 3: Expand `tiendaTemplate.js` — 3 extra pages (productos, nosotros, contacto)

**Files:**
- Modify: `apps/desktop/src/website/atlasBlocks/templates/tiendaTemplate.js`

- [ ] **Step 1: Replace the entire file**

```js
import { defineTemplate } from '@raulbellosom/atlas-web-builder'

const NAVBAR = {
  id: 'navbar',
  type: 'NavbarBlock',
  props: {
    variant: 'light',
    brand: 'Mi Tienda',
    links: 'Inicio | /\nProductos | /productos\nNosotros | /nosotros\nContacto | /contacto',
    ctaLabel: 'Ver carrito',
    ctaHref: '#carrito',
    ctaVariant: 'outline',
    sticky: true,
    height: '64',
  },
  children: {},
}

const FOOTER = {
  id: 'footer',
  type: 'FooterBlock',
  props: {
    variant: 'dark',
    brand: 'Mi Tienda',
    tagline: 'Calidad, estilo y confianza en cada compra.',
    columns: 'Comprar | Comprar\nTodos los productos | /productos\nNovedades | /productos\nOfertas | /productos\n---\nAyuda | Ayuda\nEnvíos y devoluciones | /\nPreguntas frecuentes | /\nContacto | /contacto\n---\nLegal | Legal\nTérminos y condiciones | /\nPolítica de privacidad | /\nCookies | /',
    copyright: `© ${new Date().getFullYear()} Mi Tienda. Todos los derechos reservados.`,
    showBrand: true,
  },
  children: {},
}

export const tiendaTemplate = defineTemplate({
  id: 'atlas-tienda',
  label: 'Tienda en línea',
  description: 'Plantilla de e-commerce moderna con grilla de productos, banner promocional y reseñas.',
  category: 'ecommerce',
  build() {
    return {
      rootIds: ['navbar', 'hero', 'features', 'products', 'promo', 'categories', 'testimonials', 'cta', 'footer'],
      blocks: {
        navbar: NAVBAR,
        hero: {
          id: 'hero',
          type: 'HeroBlock',
          props: {
            variant: 'split',
            title: 'Calidad que se siente diferente',
            subtitle: 'Descubre nuestra colección cuidadosamente seleccionada. Envíos rápidos, devoluciones sin preguntas y garantía de satisfacción.',
            eyebrow: 'Nueva colección 2025',
            ctaLabel: 'Comprar ahora',
            ctaHref: '/productos',
            ctaVariant: 'solid',
            ctaSecondLabel: 'Ver novedades',
            ctaSecondHref: '/productos',
            imageSrc: '',
            background: { kind: 'color', token: 'muted' },
            align: 'left',
            paddingY: '16',
            minHeight: '80vh',
            titleSize: '3xl',
            contentMaxWidth: '55ch',
          },
          children: {},
        },
        features: {
          id: 'features',
          type: 'FeaturesSectionBlock',
          props: {
            eyebrow: '',
            title: '',
            subtitle: '',
            layout: 'grid-3',
            iconStyle: 'check',
            background: 'white',
            features: 'Envío gratis desde $500\nEn pedidos superiores a $500 pesos, el envío es completamente gratuito a todo el país.\n---\nDevoluciones sin costo\nSi no estás satisfecho, devuelve tu compra en 30 días sin ningún cargo adicional.\n---\nPago seguro garantizado\nTodas las transacciones están protegidas con encriptación SSL de 256 bits.',
          },
          children: {},
        },
        products: {
          id: 'products',
          type: 'ProductsGridBlock',
          props: {
            categoryId: '',
            limit: 8,
            columns: '4',
            showPrice: true,
            showAddToCart: true,
          },
          children: {},
        },
        promo: {
          id: 'promo',
          type: 'CtaBannerBlock',
          props: {
            eyebrow: 'Oferta especial',
            title: '20% de descuento en tu primera compra',
            subtitle: 'Usa el código BIENVENIDO al finalizar tu compra. Válido por tiempo limitado.',
            ctaLabel: 'Usar descuento',
            ctaHref: '/productos',
            ctaSecondLabel: 'Ver condiciones',
            ctaSecondHref: '#',
            variant: 'gradient-primary',
            size: 'compact',
            align: 'center',
          },
          children: {},
        },
        categories: {
          id: 'categories',
          type: 'ServicesGridBlock',
          props: {
            eyebrow: 'Explorar por categoría',
            title: 'Encuentra exactamente lo que buscas',
            subtitle: 'Organizamos nuestro catálogo para que encuentres lo que necesitas en segundos.',
            columns: '4',
            services: 'Nuevos ingresos\nLo último en llegar a nuestra tienda, seleccionado con los más altos estándares de calidad.\n---\nMás vendidos\nLos productos favoritos de nuestros clientes. Los más comprados y mejor valorados.\n---\nOfertas y descuentos\nLas mejores oportunidades de la semana. Precios especiales por tiempo limitado.\n---\nEdición limitada\nColecciones exclusivas disponibles en cantidades muy limitadas.',
            cardStyle: 'bordered',
            align: 'center',
          },
          children: {},
        },
        testimonials: {
          id: 'testimonials',
          type: 'TestimonialsBlock',
          props: {
            eyebrow: 'Reseñas verificadas',
            title: 'Miles de clientes felices',
            columns: '3',
            background: 'muted',
            testimonials: 'Diana Flores|Cliente verificada|5\nLa calidad del producto superó mis expectativas. El empaque es hermoso y llegó en perfectas condiciones. Definitivamente volveré a comprar y recomendaré a mis amigas.\n---\nMiguel Herrera|Comprador frecuente|5\nEl servicio al cliente es excelente. Tuve un pequeño problema con mi pedido y lo resolvieron en menos de 24 horas. Profesionalismo total.\n---\nIsabel Navarro|Primera compra|4\nFue mi primera compra en línea aquí y quedé muy satisfecha. El proceso fue sencillo, seguro y el producto llegó antes de lo esperado.',
          },
          children: {},
        },
        cta: {
          id: 'cta',
          type: 'CtaBannerBlock',
          props: {
            eyebrow: '',
            title: 'Suscríbete y obtén 10% de descuento',
            subtitle: 'Regístrate en nuestro boletín y sé el primero en enterarte de nuevos productos, ofertas exclusivas y promociones especiales.',
            ctaLabel: 'Suscribirme',
            ctaHref: '#newsletter',
            ctaSecondLabel: '',
            ctaSecondHref: '',
            variant: 'dark',
            size: 'compact',
            align: 'center',
          },
          children: {},
        },
        footer: FOOTER,
      },
    }
  },
})

export const tiendaSitePages = [
  {
    id: 'productos',
    label: 'Productos',
    routePath: '/productos',
    required: false,
    description: 'Catálogo completo de productos.',
    build: () => ({
      rootIds: ['navbar', 'hero', 'categories', 'products', 'promo', 'footer'],
      blocks: {
        navbar: NAVBAR,
        hero: {
          id: 'hero',
          type: 'HeroBlock',
          props: {
            variant: 'centered',
            title: 'Todos nuestros productos',
            subtitle: 'Descubre nuestra colección completa, seleccionada con los más altos estándares de calidad.',
            eyebrow: 'Catálogo',
            ctaLabel: '',
            ctaHref: '',
            ctaSecondLabel: '',
            ctaSecondHref: '',
            imageSrc: '',
            background: { kind: 'color', token: 'muted' },
            align: 'center',
            paddingY: '10',
            minHeight: '35vh',
            titleSize: '2xl',
            contentMaxWidth: '60ch',
          },
          children: {},
        },
        categories: {
          id: 'categories',
          type: 'ServicesGridBlock',
          props: {
            eyebrow: 'Categorías',
            title: 'Explora por categoría',
            subtitle: '',
            columns: '4',
            services: 'Nuevos ingresos\nLo último en llegar a nuestra tienda.\n---\nMás vendidos\nLos favoritos de nuestros clientes.\n---\nOfertas\nPrecios especiales por tiempo limitado.\n---\nEdición limitada\nColecciones exclusivas y únicas.',
            cardStyle: 'bordered',
            align: 'center',
          },
          children: {},
        },
        products: {
          id: 'products',
          type: 'ProductsGridBlock',
          props: {
            categoryId: '',
            limit: 12,
            columns: '4',
            showPrice: true,
            showAddToCart: true,
          },
          children: {},
        },
        promo: {
          id: 'promo',
          type: 'CtaBannerBlock',
          props: {
            eyebrow: 'Oferta especial',
            title: '20% de descuento en tu primera compra',
            subtitle: 'Usa el código BIENVENIDO al finalizar tu compra.',
            ctaLabel: 'Usar descuento',
            ctaHref: '#',
            ctaSecondLabel: '',
            ctaSecondHref: '',
            variant: 'gradient-primary',
            size: 'compact',
            align: 'center',
          },
          children: {},
        },
        footer: FOOTER,
      },
    }),
  },
  {
    id: 'nosotros',
    label: 'Nosotros',
    routePath: '/nosotros',
    required: false,
    description: 'Nuestra historia y compromiso con la calidad.',
    build: () => ({
      rootIds: ['navbar', 'hero', 'story', 'testimonials', 'cta', 'footer'],
      blocks: {
        navbar: NAVBAR,
        hero: {
          id: 'hero',
          type: 'HeroBlock',
          props: {
            variant: 'centered',
            title: 'Nuestra Historia',
            subtitle: 'Conoce los valores y el compromiso que hay detrás de cada producto que ofrecemos.',
            eyebrow: 'Sobre Mi Tienda',
            ctaLabel: 'Ver productos',
            ctaHref: '/productos',
            ctaVariant: 'solid',
            ctaSecondLabel: '',
            ctaSecondHref: '',
            imageSrc: '',
            background: { kind: 'color', token: 'bg' },
            align: 'center',
            paddingY: '14',
            minHeight: '50vh',
            titleSize: '2xl',
            contentMaxWidth: '60ch',
          },
          children: {},
        },
        story: {
          id: 'story',
          type: 'FeaturesSectionBlock',
          props: {
            eyebrow: 'Quiénes somos',
            title: 'Calidad y confianza en cada compra',
            subtitle: 'Somos una tienda en línea fundada con la misión de ofrecer productos de alta calidad a precios justos.',
            layout: 'grid-2',
            iconStyle: 'check',
            background: 'white',
            features: 'Fundados en 2018\nNacimos de la necesidad de llevar productos de calidad directamente a los consumidores, sin intermediarios innecesarios.\n---\nSelección rigurosa\nCada producto que ofrecemos pasa por un proceso estricto de selección y control de calidad antes de llegar a ti.\n---\nEnvíos rápidos\nTrabajamos con los mejores operadores logísticos para garantizar que tu pedido llegue en tiempo y perfectas condiciones.\n---\nAtención personalizada\nNuestro equipo de atención al cliente está disponible para resolver cualquier duda antes, durante y después de tu compra.',
          },
          children: {},
        },
        testimonials: {
          id: 'testimonials',
          type: 'TestimonialsBlock',
          props: {
            eyebrow: 'Lo que dicen nuestros clientes',
            title: 'Miles de clientes felices',
            columns: '3',
            background: 'muted',
            testimonials: 'Diana Flores|Cliente verificada|5\nLa calidad del producto superó mis expectativas. El empaque es hermoso y llegó en perfectas condiciones.\n---\nMiguel Herrera|Comprador frecuente|5\nEl servicio al cliente es excelente. Tuve un pequeño problema con mi pedido y lo resolvieron en menos de 24 horas.\n---\nIsabel Navarro|Primera compra|4\nFue mi primera compra en línea aquí y quedé muy satisfecha. El proceso fue sencillo y el producto llegó antes de lo esperado.',
          },
          children: {},
        },
        cta: {
          id: 'cta',
          type: 'CtaBannerBlock',
          props: {
            eyebrow: '',
            title: '¿Listo para comprar?',
            subtitle: 'Descubre nuestra colección y encuentra exactamente lo que buscas.',
            ctaLabel: 'Ver productos',
            ctaHref: '/productos',
            ctaSecondLabel: 'Contactarnos',
            ctaSecondHref: '/contacto',
            variant: 'gradient-primary',
            size: 'compact',
            align: 'center',
          },
          children: {},
        },
        footer: FOOTER,
      },
    }),
  },
  {
    id: 'contacto',
    label: 'Contacto',
    routePath: '/contacto',
    required: false,
    description: 'Atención al cliente e información de contacto.',
    build: () => ({
      rootIds: ['navbar', 'info', 'cta', 'footer'],
      blocks: {
        navbar: NAVBAR,
        info: {
          id: 'info',
          type: 'FeaturesSectionBlock',
          props: {
            eyebrow: 'Estamos para ayudarte',
            title: 'Atención al cliente',
            subtitle: 'Resolvemos tus dudas sobre pedidos, envíos, devoluciones y más.',
            layout: 'grid-3',
            iconStyle: 'check',
            background: 'white',
            features: 'Correo electrónico\nEscríbenos a hola@mitienda.com. Respondemos en menos de 24 horas hábiles.\n---\nWhatsApp\nChatea con nosotros al +52 55 0000 0000. Atención de lunes a sábado, 9am–7pm.\n---\nDevoluciones\nSi tu compra no cumple tus expectativas, la devuelves en 30 días sin costo. Garantía total.',
          },
          children: {},
        },
        cta: {
          id: 'cta',
          type: 'CtaBannerBlock',
          props: {
            eyebrow: '',
            title: '¿Tienes alguna duda?',
            subtitle: 'Nuestro equipo está listo para ayudarte a encontrar el producto perfecto.',
            ctaLabel: 'WhatsApp',
            ctaHref: 'https://wa.me/525500000000',
            ctaSecondLabel: 'Ver productos',
            ctaSecondHref: '/productos',
            variant: 'dark',
            size: 'normal',
            align: 'center',
          },
          children: {},
        },
        footer: FOOTER,
      },
    }),
  },
]
```

- [ ] **Step 2: Verify no syntax errors**

```bash
node --check apps/desktop/src/website/atlasBlocks/templates/tiendaTemplate.js
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/website/atlasBlocks/templates/tiendaTemplate.js
git commit -m "feat(website): expand tienda template to 4 pages — productos, nosotros, contacto"
```

---

### Task 4: Expand `agenciaTemplate.js` — 4 extra pages (servicios, portafolio, equipo, contacto)

**Files:**
- Modify: `apps/desktop/src/website/atlasBlocks/templates/agenciaTemplate.js`

- [ ] **Step 1: Replace the entire file**

```js
import { defineTemplate } from '@raulbellosom/atlas-web-builder'

const NAVBAR = {
  id: 'navbar',
  type: 'NavbarBlock',
  props: {
    variant: 'dark',
    brand: 'Nexus Studio',
    links: 'Inicio | /\nServicios | /servicios\nPortafolio | /portafolio\nEquipo | /equipo\nContacto | /contacto',
    ctaLabel: 'Hablemos',
    ctaHref: '/contacto',
    ctaVariant: 'solid',
    sticky: true,
    height: '68',
  },
  children: {},
}

const FOOTER = {
  id: 'footer',
  type: 'FooterBlock',
  props: {
    variant: 'dark',
    brand: 'Nexus Studio',
    tagline: 'Creatividad, estrategia y tecnología al servicio de tu marca.',
    columns: 'Servicios | Servicios\nBranding | /servicios\nDiseño Web | /servicios\nMarketing Digital | /servicios\nDesarrollo | /servicios\n---\nAgencia | Agencia\nNosotros | /\nPortafolio | /portafolio\nEquipo | /equipo\n---\nContacto | Contacto\nHablemos | /contacto\nLinkedIn | /\nInstagram | /',
    copyright: `© ${new Date().getFullYear()} Nexus Studio. Todos los derechos reservados.`,
    showBrand: true,
  },
  children: {},
}

export const agenciaTemplate = defineTemplate({
  id: 'atlas-agencia',
  label: 'Agencia & Portafolio',
  description: 'Plantilla bold y profesional para agencias creativas, estudios de diseño y portafolios.',
  category: 'agencia',
  build() {
    return {
      rootIds: ['navbar', 'hero', 'services', 'stats', 'gallery', 'features', 'team', 'testimonials', 'contact', 'footer'],
      blocks: {
        navbar: NAVBAR,
        hero: {
          id: 'hero',
          type: 'HeroBlock',
          props: {
            variant: 'centered',
            title: 'Creamos experiencias digitales que transforman negocios',
            subtitle: 'Agencia creativa especializada en branding, diseño web y estrategia digital. Transformamos tus ideas en resultados medibles.',
            eyebrow: 'Agencia creativa',
            ctaLabel: 'Ver portafolio',
            ctaHref: '/portafolio',
            ctaVariant: 'solid',
            ctaSecondLabel: 'Hablemos de tu proyecto',
            ctaSecondHref: '/contacto',
            imageSrc: '',
            background: { kind: 'color', token: 'fg' },
            align: 'center',
            paddingY: '16',
            minHeight: '88vh',
            titleSize: '3xl',
            contentMaxWidth: '70ch',
          },
          children: {},
        },
        services: {
          id: 'services',
          type: 'ServicesGridBlock',
          props: {
            eyebrow: 'Nuestras especialidades',
            title: 'Lo que hacemos mejor',
            subtitle: 'Combinamos estrategia, diseño y tecnología para crear soluciones digitales que impulsan tu negocio.',
            columns: '3',
            services: 'Branding & Identidad\nCreamos marcas memorables con personalidad propia. Desde la estrategia hasta el manual de identidad completo.\n---\nDiseño Web\nSitios web modernos, rápidos y optimizados para convertir visitantes en clientes. Mobile-first siempre.\n---\nMarketing Digital\nEstrategias 360° que combinan SEO, redes sociales y publicidad pagada para maximizar tu alcance.\n---\nDiseño UX/UI\nInterfases intuitivas y atractivas que mejoran la experiencia del usuario y aumentan la conversión.\n---\nDesarrollo a Medida\nAplicaciones web y móviles construidas con las tecnologías más modernas del mercado.\n---\nConsultoría Estratégica\nAnálisis profundo de tu negocio digital con recomendaciones accionables y medibles.',
            cardStyle: 'card',
            align: 'left',
          },
          children: {},
        },
        stats: {
          id: 'stats',
          type: 'StatsBlock',
          props: {
            eyebrow: '',
            title: '',
            stats: '200+\nProyectos entregados\nEn 5 años\n---\n50+\nClientes activos\nEn 8 países\n---\n98%\nTasa de retención\nClientes satisfechos\n---\n15\nPremios ganados\nReconocimientos internacionales',
            background: 'dark',
            align: 'center',
          },
          children: {},
        },
        gallery: {
          id: 'gallery',
          type: 'GalleryBlock',
          props: {
            eyebrow: 'Portafolio selecto',
            title: 'Proyectos que hablan por sí solos',
            subtitle: 'Una muestra de nuestro trabajo más reciente.',
            columns: '3',
            gap: 'normal',
            aspectRatio: '4/3',
            image1: '', image2: '', image3: '',
            image4: '', image5: '', image6: '',
          },
          children: {},
        },
        features: {
          id: 'features',
          type: 'FeaturesSectionBlock',
          props: {
            eyebrow: 'Nuestra metodología',
            title: 'Cómo trabajamos contigo',
            subtitle: 'Un proceso claro, transparente y orientado a resultados en cada etapa.',
            layout: 'grid-3',
            iconStyle: 'number',
            background: 'muted',
            features: 'Descubrimiento\nIniciamos con una sesión profunda para entender tu negocio, tus objetivos y a tu audiencia ideal.\n---\nEstrategia & Propuesta\nDesarrollamos un plan detallado con tiempos, entregables y métricas de éxito claras.\n---\nDiseño & Prototipado\nCreamos wireframes y prototipos interactivos para validar la dirección antes de producción.\n---\nDesarrollo & Producción\nNuestro equipo técnico da vida al diseño con código limpio, rápido y escalable.\n---\nPruebas & Lanzamiento\nRevisamos cada detalle antes del lanzamiento para garantizar una experiencia impecable.\n---\nSoporte & Crecimiento\nNo desaparecemos después del lanzamiento. Te acompañamos en el crecimiento continuo.',
          },
          children: {},
        },
        team: {
          id: 'team',
          type: 'TeamGridBlock',
          props: {
            eyebrow: 'El equipo creativo',
            title: 'Las mentes detrás de Nexus',
            subtitle: 'Diseñadores, estrategas y desarrolladores apasionados por crear cosas extraordinarias.',
            columns: '4',
            layout: 'card',
            team: 'Andrés Villanueva|Director Creativo\nMás de 12 años liderando proyectos de branding y diseño digital para marcas en Europa y América Latina.\n---\nValeria Cruz|Directora de Estrategia\nEspecialista en marketing digital con MBA y experiencia en consultoras globales de primer nivel.\n---\nJorge Medina|Lead Developer\nDesarrollador full-stack apasionado por el código limpio y las arquitecturas modernas y escalables.\n---\nNatalia Ríos|UX Designer\nEspecialista en investigación de usuarios y diseño centrado en la experiencia y la conversión.',
            photo1: '', photo2: '', photo3: '', photo4: '',
          },
          children: {},
        },
        testimonials: {
          id: 'testimonials',
          type: 'TestimonialsBlock',
          props: {
            eyebrow: 'Clientes que confían en nosotros',
            title: 'Resultados que hablan',
            columns: '3',
            background: 'white',
            testimonials: 'Ricardo Blanco|CEO, FinTech México|5\nNexus transformó completamente nuestra presencia digital. En 3 meses duplicamos el tráfico orgánico y aumentamos nuestras conversiones en un 180%.\n---\nCristina Pacheco|Directora de Marketing, Retailmex|5\nEl rebrand que hicieron para nuestra marca fue exactamente lo que necesitábamos. Moderno, coherente y con una identidad visual poderosa.\n---\nSamuel Orozco|Fundador, EduTech|5\nConfiamos en Nexus para desarrollar nuestra plataforma educativa desde cero. Entregaron a tiempo, dentro del presupuesto y con una calidad excepcional.',
          },
          children: {},
        },
        contact: {
          id: 'contact',
          type: 'CtaBannerBlock',
          props: {
            eyebrow: 'Siguiente paso',
            title: '¿Listo para transformar tu negocio digital?',
            subtitle: 'Cuéntanos tu proyecto. Respondemos en menos de 24 horas con una propuesta sin compromiso.',
            ctaLabel: 'Iniciar proyecto',
            ctaHref: '/contacto',
            ctaSecondLabel: 'Enviar WhatsApp',
            ctaSecondHref: 'https://wa.me/525500000000',
            variant: 'gradient-dark',
            size: 'large',
            align: 'center',
          },
          children: {},
        },
        footer: FOOTER,
      },
    }
  },
})

export const agenciaSitePages = [
  {
    id: 'servicios',
    label: 'Servicios',
    routePath: '/servicios',
    required: false,
    description: 'Servicios y especialidades de la agencia.',
    build: () => ({
      rootIds: ['navbar', 'hero', 'services', 'methodology', 'cta', 'footer'],
      blocks: {
        navbar: NAVBAR,
        hero: {
          id: 'hero',
          type: 'HeroBlock',
          props: {
            variant: 'centered',
            title: 'Nuestros Servicios',
            subtitle: 'Soluciones creativas y tecnológicas que impulsan el crecimiento de tu negocio digital.',
            eyebrow: 'Lo que hacemos',
            ctaLabel: 'Iniciar proyecto',
            ctaHref: '/contacto',
            ctaVariant: 'solid',
            ctaSecondLabel: 'Ver portafolio',
            ctaSecondHref: '/portafolio',
            imageSrc: '',
            background: { kind: 'color', token: 'fg' },
            align: 'center',
            paddingY: '14',
            minHeight: '50vh',
            titleSize: '2xl',
            contentMaxWidth: '65ch',
          },
          children: {},
        },
        services: {
          id: 'services',
          type: 'ServicesGridBlock',
          props: {
            eyebrow: 'Especialidades',
            title: 'Todo lo que necesita tu marca digital',
            subtitle: 'Cada servicio está diseñado para generar resultados reales y medibles para tu negocio.',
            columns: '3',
            services: 'Branding & Identidad\nCreamos marcas memorables con personalidad propia. Estrategia de marca, naming, logotipo y manual de identidad completo.\n---\nDiseño Web\nSitios web modernos, rápidos y optimizados para convertir visitantes en clientes. Mobile-first y SEO-ready desde el día uno.\n---\nMarketing Digital\nEstrategias 360° que combinan SEO, contenidos, redes sociales y publicidad pagada para maximizar tu alcance y ROI.\n---\nDiseño UX/UI\nInterfases intuitivas y atractivas que mejoran la experiencia del usuario y aumentan la tasa de conversión.\n---\nDesarrollo a Medida\nAplicaciones web y móviles construidas con tecnologías modernas, seguras y escalables según tu negocio.\n---\nConsultoría Estratégica\nAuditoría de tu presencia digital actual, identificación de oportunidades y hoja de ruta accionable con métricas claras.',
            cardStyle: 'card',
            align: 'left',
          },
          children: {},
        },
        methodology: {
          id: 'methodology',
          type: 'FeaturesSectionBlock',
          props: {
            eyebrow: 'Cómo trabajamos',
            title: 'Un proceso claro de inicio a fin',
            subtitle: 'Sin sorpresas. Cada etapa tiene entregables claros y comunicación constante.',
            layout: 'grid-3',
            iconStyle: 'number',
            background: 'muted',
            features: 'Descubrimiento\nSesión inicial para entender tu negocio, competencia, objetivos y audiencia ideal.\n---\nEstrategia\nPlan detallado con tiempos, entregables, responsables y métricas de éxito.\n---\nDiseño\nWireframes y prototipos interactivos validados contigo antes de pasar a producción.\n---\nDesarrollo\nImplementación con código limpio, revisiones constantes y pruebas rigurosas.\n---\nLanzamiento\nDeployment, pruebas finales y entrega con documentación completa.\n---\nSoporte\nAcompañamiento post-lanzamiento, métricas y mejora continua.',
          },
          children: {},
        },
        cta: {
          id: 'cta',
          type: 'CtaBannerBlock',
          props: {
            eyebrow: '',
            title: '¿Listo para transformar tu negocio digital?',
            subtitle: 'Cuéntanos tu proyecto. Respondemos en menos de 24 horas con una propuesta sin compromiso.',
            ctaLabel: 'Iniciar proyecto',
            ctaHref: '/contacto',
            ctaSecondLabel: 'WhatsApp',
            ctaSecondHref: 'https://wa.me/525500000000',
            variant: 'gradient-dark',
            size: 'normal',
            align: 'center',
          },
          children: {},
        },
        footer: FOOTER,
      },
    }),
  },
  {
    id: 'portafolio',
    label: 'Portafolio',
    routePath: '/portafolio',
    required: false,
    description: 'Proyectos y trabajos realizados.',
    build: () => ({
      rootIds: ['navbar', 'hero', 'gallery', 'testimonials', 'cta', 'footer'],
      blocks: {
        navbar: NAVBAR,
        hero: {
          id: 'hero',
          type: 'HeroBlock',
          props: {
            variant: 'centered',
            title: 'Nuestro Portafolio',
            subtitle: 'Proyectos que demuestran nuestra capacidad creativa, técnica y estratégica.',
            eyebrow: 'Trabajo selecto',
            ctaLabel: 'Iniciar proyecto',
            ctaHref: '/contacto',
            ctaVariant: 'solid',
            ctaSecondLabel: '',
            ctaSecondHref: '',
            imageSrc: '',
            background: { kind: 'color', token: 'fg' },
            align: 'center',
            paddingY: '14',
            minHeight: '45vh',
            titleSize: '2xl',
            contentMaxWidth: '60ch',
          },
          children: {},
        },
        gallery: {
          id: 'gallery',
          type: 'GalleryBlock',
          props: {
            eyebrow: 'Proyectos recientes',
            title: 'Trabajo que habla por sí solo',
            subtitle: 'Una selección de los proyectos de los que estamos más orgullosos.',
            columns: '3',
            gap: 'normal',
            aspectRatio: '4/3',
            image1: '', image2: '', image3: '',
            image4: '', image5: '', image6: '',
          },
          children: {},
        },
        testimonials: {
          id: 'testimonials',
          type: 'TestimonialsBlock',
          props: {
            eyebrow: 'Clientes que confían en nosotros',
            title: 'Resultados que hablan',
            columns: '3',
            background: 'muted',
            testimonials: 'Ricardo Blanco|CEO, FinTech México|5\nNexus transformó completamente nuestra presencia digital. En 3 meses duplicamos el tráfico orgánico y aumentamos las conversiones en un 180%. Un equipo extraordinario.\n---\nCristina Pacheco|Directora de Marketing, Retailmex|5\nEl rebrand que hicieron para nuestra marca fue exactamente lo que necesitábamos. Moderno, coherente y con una identidad visual poderosa que conecta con nuestra audiencia.\n---\nSamuel Orozco|Fundador, EduTech|5\nConfiamos en Nexus para desarrollar nuestra plataforma educativa desde cero. Entregaron a tiempo, dentro del presupuesto y con una calidad excepcional.',
          },
          children: {},
        },
        cta: {
          id: 'cta',
          type: 'CtaBannerBlock',
          props: {
            eyebrow: '',
            title: '¿Tu proyecto podría ser el próximo?',
            subtitle: 'Cuéntanos tu idea y construyamos algo extraordinario juntos.',
            ctaLabel: 'Iniciar proyecto',
            ctaHref: '/contacto',
            ctaSecondLabel: 'Ver servicios',
            ctaSecondHref: '/servicios',
            variant: 'gradient-dark',
            size: 'compact',
            align: 'center',
          },
          children: {},
        },
        footer: FOOTER,
      },
    }),
  },
  {
    id: 'equipo',
    label: 'Equipo',
    routePath: '/equipo',
    required: false,
    description: 'El equipo creativo detrás de la agencia.',
    build: () => ({
      rootIds: ['navbar', 'hero', 'team', 'cta', 'footer'],
      blocks: {
        navbar: NAVBAR,
        hero: {
          id: 'hero',
          type: 'HeroBlock',
          props: {
            variant: 'centered',
            title: 'El Equipo',
            subtitle: 'Diseñadores, estrategas y desarrolladores apasionados por crear cosas extraordinarias.',
            eyebrow: 'Las mentes detrás de Nexus',
            ctaLabel: 'Iniciar proyecto',
            ctaHref: '/contacto',
            ctaVariant: 'solid',
            ctaSecondLabel: '',
            ctaSecondHref: '',
            imageSrc: '',
            background: { kind: 'color', token: 'fg' },
            align: 'center',
            paddingY: '14',
            minHeight: '45vh',
            titleSize: '2xl',
            contentMaxWidth: '60ch',
          },
          children: {},
        },
        team: {
          id: 'team',
          type: 'TeamGridBlock',
          props: {
            eyebrow: 'Nuestro equipo',
            title: 'Las personas detrás de cada proyecto',
            subtitle: 'Un equipo multidisciplinar comprometido con la excelencia en cada entrega.',
            columns: '4',
            layout: 'card',
            team: 'Andrés Villanueva|Director Creativo\nMás de 12 años liderando proyectos de branding y diseño digital para marcas en Europa y América Latina.\n---\nValeria Cruz|Directora de Estrategia\nEspecialista en marketing digital con MBA y experiencia en consultoras globales de primer nivel.\n---\nJorge Medina|Lead Developer\nDesarrollador full-stack apasionado por el código limpio y las arquitecturas modernas y escalables.\n---\nNatalia Ríos|UX Designer\nEspecialista en investigación de usuarios y diseño centrado en la experiencia y la conversión.',
            photo1: '', photo2: '', photo3: '', photo4: '',
          },
          children: {},
        },
        cta: {
          id: 'cta',
          type: 'CtaBannerBlock',
          props: {
            eyebrow: '',
            title: '¿Quieres trabajar con nosotros?',
            subtitle: 'Estamos creciendo y buscamos talentos apasionados por el diseño y la tecnología.',
            ctaLabel: 'Contáctanos',
            ctaHref: '/contacto',
            ctaSecondLabel: 'Ver proyectos',
            ctaSecondHref: '/portafolio',
            variant: 'gradient-dark',
            size: 'compact',
            align: 'center',
          },
          children: {},
        },
        footer: FOOTER,
      },
    }),
  },
  {
    id: 'contacto',
    label: 'Contacto',
    routePath: '/contacto',
    required: false,
    description: 'Inicia tu proyecto o envíanos un mensaje.',
    build: () => ({
      rootIds: ['navbar', 'info', 'cta', 'footer'],
      blocks: {
        navbar: NAVBAR,
        info: {
          id: 'info',
          type: 'FeaturesSectionBlock',
          props: {
            eyebrow: 'Hablemos',
            title: 'Inicia tu proyecto hoy',
            subtitle: 'Respondemos en menos de 24 horas con una propuesta sin compromiso.',
            layout: 'grid-3',
            iconStyle: 'check',
            background: 'white',
            features: 'Correo electrónico\nhola@nexusstudio.com — para proyectos, propuestas y consultas generales.\n---\nWhatsApp\n+52 55 0000 0000 — para consultas rápidas y seguimiento de proyectos activos.\n---\nLinkedIn\nSíguenos en LinkedIn para ver nuestros proyectos más recientes y actualizaciones del equipo.',
          },
          children: {},
        },
        cta: {
          id: 'cta',
          type: 'CtaBannerBlock',
          props: {
            eyebrow: 'Siguiente paso',
            title: '¿Listo para transformar tu negocio digital?',
            subtitle: 'Cuéntanos tu proyecto. Sin compromiso, solo una conversación honesta sobre cómo podemos ayudarte.',
            ctaLabel: 'WhatsApp',
            ctaHref: 'https://wa.me/525500000000',
            ctaSecondLabel: 'Ver portafolio',
            ctaSecondHref: '/portafolio',
            variant: 'gradient-dark',
            size: 'large',
            align: 'center',
          },
          children: {},
        },
        footer: FOOTER,
      },
    }),
  },
]
```

- [ ] **Step 2: Verify no syntax errors**

```bash
node --check apps/desktop/src/website/atlasBlocks/templates/agenciaTemplate.js
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/website/atlasBlocks/templates/agenciaTemplate.js
git commit -m "feat(website): expand agencia template to 5 pages — servicios, portafolio, equipo, contacto"
```

---

### Task 5: Expand `negocioTemplate.js` — 3 extra pages (servicios, nosotros, contacto)

**Files:**
- Modify: `apps/desktop/src/website/atlasBlocks/templates/negocioTemplate.js`

- [ ] **Step 1: Replace the entire file**

```js
import { defineTemplate } from '@raulbellosom/atlas-web-builder'

const NAVBAR = {
  id: 'navbar',
  type: 'NavbarBlock',
  props: {
    variant: 'light',
    brand: 'Empresa',
    links: 'Inicio | /\nServicios | /servicios\nNosotros | /nosotros\nContacto | /contacto',
    ctaLabel: 'Solicitar demo',
    ctaHref: '/contacto',
    ctaVariant: 'solid',
    sticky: true,
    height: '64',
  },
  children: {},
}

const FOOTER = {
  id: 'footer',
  type: 'FooterBlock',
  props: {
    variant: 'light',
    brand: 'Empresa',
    tagline: 'Tu aliado estratégico para el crecimiento empresarial.',
    columns: 'Servicios | Servicios\nConsultoría | /servicios\nOptimización | /servicios\nCapacitación | /servicios\nTransformación Digital | /servicios\n---\nEmpresa | Empresa\nNosotros | /nosotros\nCasos de éxito | /\nContacto | /contacto\n---\nLegal | Legal\nPolítica de privacidad | /\nTérminos | /',
    copyright: `© ${new Date().getFullYear()} Empresa. Todos los derechos reservados.`,
    showBrand: true,
  },
  children: {},
}

export const negocioTemplate = defineTemplate({
  id: 'atlas-negocio',
  label: 'Negocio & Servicios',
  description: 'Plantilla versátil para empresas de servicios, consultoras, despachos y negocios B2B.',
  category: 'negocio',
  build() {
    return {
      rootIds: ['navbar', 'hero', 'features', 'services', 'stats', 'testimonials', 'pricing', 'cta', 'footer'],
      blocks: {
        navbar: NAVBAR,
        hero: {
          id: 'hero',
          type: 'HeroBlock',
          props: {
            variant: 'centered',
            title: 'Soluciones que impulsan tu negocio al siguiente nivel',
            subtitle: 'Ofrecemos servicios especializados con metodología probada para ayudar a empresas como la tuya a crecer de forma sostenible y eficiente.',
            eyebrow: 'Más de 10 años de experiencia',
            ctaLabel: 'Comenzar ahora',
            ctaHref: '/contacto',
            ctaVariant: 'solid',
            ctaSecondLabel: 'Conocer más',
            ctaSecondHref: '/servicios',
            imageSrc: '',
            background: { kind: 'color', token: 'bg' },
            align: 'center',
            paddingY: '16',
            minHeight: '80vh',
            titleSize: '3xl',
            contentMaxWidth: '70ch',
          },
          children: {},
        },
        features: {
          id: 'features',
          type: 'FeaturesSectionBlock',
          props: {
            eyebrow: 'Por qué elegirnos',
            title: 'La ventaja de trabajar con nosotros',
            subtitle: 'No somos proveedores, somos aliados estratégicos de tu crecimiento.',
            layout: 'grid-3',
            iconStyle: 'check',
            background: 'white',
            features: 'Metodología comprobada\nAplicamos procesos validados en más de 200 proyectos para garantizar resultados consistentes y medibles.\n---\nEquipo senior dedicado\nTu cuenta es atendida por profesionales con experiencia real en tu industria, no por juniors.\n---\nComunicación transparente\nReportes semanales, acceso a tablero en tiempo real y comunicación directa con tu equipo asignado.\n---\nSin contratos forzosos\nMes a mes. Creemos tanto en nuestro trabajo que no necesitamos atarte con contratos largos.\n---\nEnfoque en ROI\nCada decisión que tomamos está orientada a generar retorno real y medible sobre tu inversión.\n---\nEscalabilidad inmediata\nCrecemos contigo. Nuestros servicios se adaptan al tamaño y ritmo de tu empresa en cada etapa.',
          },
          children: {},
        },
        services: {
          id: 'services',
          type: 'ServicesGridBlock',
          props: {
            eyebrow: 'Nuestros servicios',
            title: 'Soluciones integrales para tu empresa',
            subtitle: 'Cada servicio está diseñado para resolver un problema real y generar valor tangible.',
            columns: '3',
            services: 'Consultoría Estratégica\nAnálisis profundo de tu modelo de negocio con un plan de acción claro, priorizado y con métricas de seguimiento.\n---\nOptimización de Procesos\nIdentificamos cuellos de botella, eliminamos ineficiencias y automatizamos tareas para reducir costos operativos.\n---\nCapacitación Empresarial\nProgramas de formación personalizados para equipos comerciales, directivos y operativos de tu organización.\n---\nTransformación Digital\nAcompañamos tu proceso de digitalización desde la estrategia hasta la implementación de herramientas tecnológicas.\n---\nGestión de Proyectos\nDirigimos proyectos complejos con metodologías ágiles, garantizando entregas en tiempo, forma y presupuesto.\n---\nAuditoria Financiera\nRevisión integral de la salud financiera de tu empresa con recomendaciones para optimizar recursos y rentabilidad.',
            cardStyle: 'card',
            align: 'left',
          },
          children: {},
        },
        stats: {
          id: 'stats',
          type: 'StatsBlock',
          props: {
            eyebrow: 'Nuestros números',
            title: 'Resultados que respaldan nuestra trayectoria',
            stats: '10+ años\nEn el mercado\nAyudando empresas a crecer\n---\n350+\nEmpresas asesoradas\nEn diversos sectores\n---\n$50M+\nEn ahorros generados\nPara nuestros clientes\n---\n97%\nRenovación de contratos\nClientes que continúan',
            background: 'white',
            align: 'center',
          },
          children: {},
        },
        testimonials: {
          id: 'testimonials',
          type: 'TestimonialsBlock',
          props: {
            eyebrow: 'Casos de éxito',
            title: 'Empresas que crecieron con nosotros',
            columns: '3',
            background: 'muted',
            testimonials: 'Fernando Lozano|Director General, Grupo Lozano|5\nEn 6 meses logramos reducir nuestros costos operativos en un 28% sin sacrificar calidad. El equipo de consultoría entendió perfectamente nuestra industria y entregó soluciones prácticas.\n---\nMónica Valdez|CFO, Distribuidora Valdez|5\nLa reestructura financiera que implementaron nos permitió acceder a crédito preferencial por primera vez en 15 años. Un trabajo excepcional, metódico y transparente en todo momento.\n---\nGustavo Aranda|CEO, Tech Startup|5\nNos acompañaron desde el MVP hasta la Serie A. Su experiencia en scale-ups fue fundamental para ordenar nuestra operación y escalar sin perder el control.',
          },
          children: {},
        },
        pricing: {
          id: 'pricing',
          type: 'PricingBlock',
          props: {
            eyebrow: 'Planes y precios',
            title: 'Elige el plan que mejor se adapte a tu empresa',
            subtitle: 'Sin sorpresas, sin cargos ocultos. Precio claro desde el primer día.',
            currency: '$',
            period: 'mes',
            plans: 'Starter\nIdeal para pequeñas empresas y emprendedores\n4,500\nConsultoría mensual (4 hrs)\nDiagnóstico inicial incluido\nReporte mensual de avance\nSoporte por email\n---\nProfesional\nPara empresas en crecimiento activo\n12,000\nConsultoría mensual (16 hrs)\nGestión de 1 proyecto activo\nTablero de métricas en tiempo real\nSoporte WhatsApp prioritario\nCapacitación trimestral\n---\nEnterprise\nPara organizaciones con necesidades complejas\nA medida\nConsultoría ilimitada\nEquipo dedicado senior\nProyectos simultáneos ilimitados\nIntegración con tus sistemas\nSLA con tiempos de respuesta garantizados',
          },
          children: {},
        },
        cta: {
          id: 'cta',
          type: 'CtaBannerBlock',
          props: {
            eyebrow: '',
            title: '¿Hablamos de tu empresa?',
            subtitle: 'Agenda una sesión de diagnóstico gratuita de 45 minutos. Sin compromiso, solo valor.',
            ctaLabel: 'Agendar sesión gratuita',
            ctaHref: '/contacto',
            ctaSecondLabel: 'Descargar brochure',
            ctaSecondHref: '#',
            variant: 'gradient-primary',
            size: 'normal',
            align: 'center',
          },
          children: {},
        },
        footer: FOOTER,
      },
    }
  },
})

export const negocioSitePages = [
  {
    id: 'servicios',
    label: 'Servicios',
    routePath: '/servicios',
    required: false,
    description: 'Catálogo de servicios y planes disponibles.',
    build: () => ({
      rootIds: ['navbar', 'hero', 'services', 'pricing', 'cta', 'footer'],
      blocks: {
        navbar: NAVBAR,
        hero: {
          id: 'hero',
          type: 'HeroBlock',
          props: {
            variant: 'centered',
            title: 'Nuestros Servicios',
            subtitle: 'Soluciones especializadas con metodología probada para impulsar el crecimiento de tu empresa.',
            eyebrow: 'Qué ofrecemos',
            ctaLabel: 'Agendar sesión',
            ctaHref: '/contacto',
            ctaVariant: 'solid',
            ctaSecondLabel: '',
            ctaSecondHref: '',
            imageSrc: '',
            background: { kind: 'color', token: 'bg' },
            align: 'center',
            paddingY: '14',
            minHeight: '45vh',
            titleSize: '2xl',
            contentMaxWidth: '65ch',
          },
          children: {},
        },
        services: {
          id: 'services',
          type: 'ServicesGridBlock',
          props: {
            eyebrow: 'Soluciones disponibles',
            title: 'Servicios diseñados para empresas como la tuya',
            subtitle: 'Cada servicio genera valor tangible y resultados medibles desde el primer mes.',
            columns: '3',
            services: 'Consultoría Estratégica\nAnálisis profundo de tu modelo de negocio con un plan de acción claro, priorizado y con métricas de seguimiento. Desde 4 horas/mes.\n---\nOptimización de Procesos\nIdentificamos cuellos de botella, eliminamos ineficiencias y automatizamos tareas para reducir costos operativos hasta un 30%.\n---\nCapacitación Empresarial\nProgramas de formación personalizados para equipos comerciales, directivos y operativos. Presencial o en línea.\n---\nTransformación Digital\nAcompañamos tu proceso de digitalización desde la estrategia hasta la implementación de herramientas tecnológicas adecuadas.\n---\nGestión de Proyectos\nDirigimos proyectos complejos con metodologías ágiles garantizando entregas en tiempo, forma y dentro del presupuesto.\n---\nAuditoria Financiera\nRevisión integral de la salud financiera con recomendaciones concretas para optimizar recursos y aumentar la rentabilidad.',
            cardStyle: 'card',
            align: 'left',
          },
          children: {},
        },
        pricing: {
          id: 'pricing',
          type: 'PricingBlock',
          props: {
            eyebrow: 'Inversión',
            title: 'Planes claros y sin sorpresas',
            subtitle: 'Elige el plan que mejor se adapta a tu etapa y necesidades actuales.',
            currency: '$',
            period: 'mes',
            plans: 'Starter\nIdeal para pequeñas empresas y emprendedores\n4,500\nConsultoría mensual (4 hrs)\nDiagnóstico inicial incluido\nReporte mensual de avance\nSoporte por email\n---\nProfesional\nPara empresas en crecimiento activo\n12,000\nConsultoría mensual (16 hrs)\nGestión de 1 proyecto activo\nTablero de métricas en tiempo real\nSoporte WhatsApp prioritario\nCapacitación trimestral\n---\nEnterprise\nPara organizaciones con necesidades complejas\nA medida\nConsultoría ilimitada\nEquipo dedicado senior\nProyectos simultáneos ilimitados\nIntegración con tus sistemas\nSLA con tiempos de respuesta garantizados',
          },
          children: {},
        },
        cta: {
          id: 'cta',
          type: 'CtaBannerBlock',
          props: {
            eyebrow: '',
            title: '¿Hablamos de tu empresa?',
            subtitle: 'Agenda una sesión de diagnóstico gratuita de 45 minutos. Sin compromiso, solo valor.',
            ctaLabel: 'Agendar sesión gratuita',
            ctaHref: '/contacto',
            ctaSecondLabel: '',
            ctaSecondHref: '',
            variant: 'gradient-primary',
            size: 'compact',
            align: 'center',
          },
          children: {},
        },
        footer: FOOTER,
      },
    }),
  },
  {
    id: 'nosotros',
    label: 'Nosotros',
    routePath: '/nosotros',
    required: false,
    description: 'Historia, valores y trayectoria de la empresa.',
    build: () => ({
      rootIds: ['navbar', 'hero', 'story', 'stats', 'testimonials', 'cta', 'footer'],
      blocks: {
        navbar: NAVBAR,
        hero: {
          id: 'hero',
          type: 'HeroBlock',
          props: {
            variant: 'centered',
            title: 'Sobre Nosotros',
            subtitle: 'Conoce la historia, los valores y el equipo detrás de más de 10 años de resultados comprobados.',
            eyebrow: 'Quiénes somos',
            ctaLabel: 'Ver servicios',
            ctaHref: '/servicios',
            ctaVariant: 'solid',
            ctaSecondLabel: 'Agendar sesión',
            ctaSecondHref: '/contacto',
            imageSrc: '',
            background: { kind: 'color', token: 'bg' },
            align: 'center',
            paddingY: '14',
            minHeight: '50vh',
            titleSize: '2xl',
            contentMaxWidth: '65ch',
          },
          children: {},
        },
        story: {
          id: 'story',
          type: 'FeaturesSectionBlock',
          props: {
            eyebrow: 'Nuestra historia',
            title: 'Más de una década generando resultados',
            subtitle: 'Nacimos de la convicción de que las empresas merecen aliados estratégicos reales, no proveedores de servicios genéricos.',
            layout: 'grid-2',
            iconStyle: 'check',
            background: 'white',
            features: 'Fundados en 2014\nComenzamos como una firma boutique de consultoría con foco en empresas medianas del sector industrial y servicios.\n---\nCrecimiento sostenido\nDesde 2018 expandimos nuestras capacidades hacia transformación digital y capacitación, atendiendo hoy a más de 350 empresas.\n---\nEquipo multidisciplinar\nContamos con especialistas en finanzas, operaciones, marketing, tecnología y recursos humanos bajo un mismo techo.\n---\nPresencia nacional\nOperamos en 12 ciudades de México con equipos locales que conocen profundamente cada mercado regional.',
          },
          children: {},
        },
        stats: {
          id: 'stats',
          type: 'StatsBlock',
          props: {
            eyebrow: 'En números',
            title: 'Una trayectoria que habla por sí sola',
            stats: '10+ años\nEn el mercado\nAyudando empresas a crecer\n---\n350+\nEmpresas asesoradas\nEn diversos sectores\n---\n$50M+\nEn ahorros generados\nPara nuestros clientes\n---\n97%\nRenovación de contratos\nClientes que continúan',
            background: 'muted',
            align: 'center',
          },
          children: {},
        },
        testimonials: {
          id: 'testimonials',
          type: 'TestimonialsBlock',
          props: {
            eyebrow: 'Casos de éxito',
            title: 'Empresas que crecieron con nosotros',
            columns: '3',
            background: 'white',
            testimonials: 'Fernando Lozano|Director General, Grupo Lozano|5\nEn 6 meses logramos reducir nuestros costos operativos en un 28% sin sacrificar calidad. El equipo entendió perfectamente nuestra industria.\n---\nMónica Valdez|CFO, Distribuidora Valdez|5\nLa reestructura financiera nos permitió acceder a crédito preferencial por primera vez en 15 años. Un trabajo excepcional y transparente.\n---\nGustavo Aranda|CEO, Tech Startup|5\nNos acompañaron desde el MVP hasta la Serie A. Su experiencia fue fundamental para ordenar nuestra operación y escalar sin perder el control.',
          },
          children: {},
        },
        cta: {
          id: 'cta',
          type: 'CtaBannerBlock',
          props: {
            eyebrow: '',
            title: '¿Hablamos de tu empresa?',
            subtitle: 'Sesión de diagnóstico gratuita de 45 minutos. Sin compromiso, solo valor.',
            ctaLabel: 'Agendar sesión',
            ctaHref: '/contacto',
            ctaSecondLabel: 'Ver servicios',
            ctaSecondHref: '/servicios',
            variant: 'gradient-primary',
            size: 'compact',
            align: 'center',
          },
          children: {},
        },
        footer: FOOTER,
      },
    }),
  },
  {
    id: 'contacto',
    label: 'Contacto',
    routePath: '/contacto',
    required: false,
    description: 'Agenda una sesión o envíanos un mensaje.',
    build: () => ({
      rootIds: ['navbar', 'info', 'cta', 'footer'],
      blocks: {
        navbar: NAVBAR,
        info: {
          id: 'info',
          type: 'FeaturesSectionBlock',
          props: {
            eyebrow: 'Hablemos',
            title: 'Agenda tu sesión de diagnóstico',
            subtitle: 'Respondemos en menos de 24 horas. Sin compromiso, solo una conversación honesta.',
            layout: 'grid-3',
            iconStyle: 'check',
            background: 'white',
            features: 'Correo electrónico\nhola@empresa.com — para consultas, propuestas y solicitudes de diagnóstico empresarial.\n---\nWhatsApp\n+52 55 0000 0000 — para consultas rápidas y seguimiento de proyectos activos de lunes a viernes.\n---\nLinkedIn\nSíguenos para ver casos de éxito, artículos y las últimas novedades de nuestros servicios.',
          },
          children: {},
        },
        cta: {
          id: 'cta',
          type: 'CtaBannerBlock',
          props: {
            eyebrow: 'Diagnóstico gratuito',
            title: '45 minutos que pueden cambiar tu empresa',
            subtitle: 'Sesión de diagnóstico sin costo. Analizamos tu situación y te decimos honestamente si podemos ayudarte.',
            ctaLabel: 'WhatsApp',
            ctaHref: 'https://wa.me/525500000000',
            ctaSecondLabel: 'Enviar correo',
            ctaSecondHref: 'mailto:hola@empresa.com',
            variant: 'gradient-primary',
            size: 'large',
            align: 'center',
          },
          children: {},
        },
        footer: FOOTER,
      },
    }),
  },
]
```

- [ ] **Step 2: Verify no syntax errors**

```bash
node --check apps/desktop/src/website/atlasBlocks/templates/negocioTemplate.js
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/website/atlasBlocks/templates/negocioTemplate.js
git commit -m "feat(website): expand negocio template to 4 pages — servicios, nosotros, contacto"
```

---

### Task 6: Refactor `atlasTemplates/index.js` — multi-page `wrapTemplate` and updated imports

**Files:**
- Modify: `apps/desktop/src/website/atlasTemplates/index.js`

- [ ] **Step 1: Replace the entire file**

```js
import { restauranteTemplate, restauranteSitePages } from '../atlasBlocks/templates/restauranteTemplate.js'
import { spaTemplate,         spaSitePages }         from '../atlasBlocks/templates/spaTemplate.js'
import { tiendaTemplate,      tiendaSitePages }      from '../atlasBlocks/templates/tiendaTemplate.js'
import { agenciaTemplate,     agenciaSitePages }     from '../atlasBlocks/templates/agenciaTemplate.js'
import { negocioTemplate,     negocioSitePages }     from '../atlasBlocks/templates/negocioTemplate.js'

const CATEGORY_COLORS = {
  restaurante: '#92400e',
  belleza:     '#9d174d',
  ecommerce:   '#065f46',
  agencia:     '#1e3a8a',
  negocio:     '#4c1d95',
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
]
```

- [ ] **Step 2: Verify no syntax errors**

```bash
node --check apps/desktop/src/website/atlasTemplates/index.js
```

Expected: no output.

- [ ] **Step 3: Verify the wrapped templates have correct page counts**

```bash
node -e "
import('./apps/desktop/src/website/atlasTemplates/index.js').then(m => {
  m.allTemplates.forEach(t => console.log(t.label, '-', t.pages.length, 'páginas:', t.pages.map(p => p.routePath).join(', ')))
})
"
```

Expected output (page counts may vary by template):
```
Restaurante - 5 páginas: /, /menu, /galeria, /nosotros, /contacto
Spa & Bienestar - 4 páginas: /, /servicios, /equipo, /contacto
Tienda en línea - 4 páginas: /, /productos, /nosotros, /contacto
Agencia & Portafolio - 5 páginas: /, /servicios, /portafolio, /equipo, /contacto
Negocio & Servicios - 4 páginas: /, /servicios, /nosotros, /contacto
```

If the import fails (ESM in Node.js without `--input-type`), it's acceptable — the syntax check in Step 2 is the authoritative check. Proceed to Step 4.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/website/atlasTemplates/index.js
git commit -m "refactor(website): wrapTemplate supports multi-page sitePages — buildPageData helper"
```

---

### Task 7: UX — improve `WebsiteTemplatesScreen` feedback when pages are skipped

**Files:**
- Modify: `apps/desktop/src/modules/atlas.website/screens/WebsiteTemplatesScreen.jsx`

- [ ] **Step 1: Read the current file to confirm line numbers**

Read `apps/desktop/src/modules/atlas.website/screens/WebsiteTemplatesScreen.jsx` and locate:
1. The `onSuccess` handler (around line 102–113) — the `toast.success` call
2. The page selection panel footer — the paragraph about no site configured (around line 203–207)

- [ ] **Step 2: Improve the success toast when 0 pages were created**

In the `onSuccess` handler, the current last line is:

```js
if (firstPageId) {
  navigate(`/app/m/atlas.website/pages/${firstPageId}/editor`)
} else {
  navigate('/app/m/atlas.website/pages')
}
```

Change it so that when `created === 0` (all pages skipped), the toast is more descriptive and we stay on the templates page instead of navigating away:

```js
if (created === 0) {
  toast.info('Todas las páginas ya existen. Edítalas directamente desde Páginas.')
} else if (firstPageId) {
  navigate(`/app/m/atlas.website/pages/${firstPageId}/editor`)
} else {
  navigate('/app/m/atlas.website/pages')
}
```

- [ ] **Step 3: Add a skip-warning note in the page selection panel**

In the page selection panel, just before the closing `</div>` of the panel (after the button row, around line 219), add a hint paragraph. The current button row ends with:

```jsx
<div className="flex justify-end pt-2 border-t border-[hsl(var(--border))]">
  <Button
    onClick={() => applyMutation.mutate()}
    disabled={applyMutation.isPending || selectedPageIds.length === 0 || !site}
  >
    {applyMutation.isPending
      ? 'Creando paginas...'
      : `Aplicar — ${selectedPageIds.length} pagina${selectedPageIds.length !== 1 ? 's' : ''}`}
  </Button>
</div>
```

Add a hint note ABOVE the button row `<div>` (so it appears between the checkbox list and the button):

```jsx
<p className="text-xs text-[hsl(var(--muted-foreground))]">
  Si una ruta ya existe, esa pagina sera omitida. Puedes editarla desde Paginas.
</p>
<div className="flex justify-end pt-2 border-t border-[hsl(var(--border))]">
  <Button
    onClick={() => applyMutation.mutate()}
    disabled={applyMutation.isPending || selectedPageIds.length === 0 || !site}
  >
    {applyMutation.isPending
      ? 'Creando paginas...'
      : `Aplicar — ${selectedPageIds.length} pagina${selectedPageIds.length !== 1 ? 's' : ''}`}
  </Button>
</div>
```

- [ ] **Step 4: Verify no syntax errors**

```bash
node --check apps/desktop/src/modules/atlas.website/screens/WebsiteTemplatesScreen.jsx
```

Expected: no output (or ESM-related note — the file is JSX, syntax check is best-effort).

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/modules/atlas.website/screens/WebsiteTemplatesScreen.jsx
git commit -m "ux(website): clearer feedback when template pages are skipped — stay on screen + info toast"
```

---

## Self-Review

**Spec coverage check:**

| Requirement | Covered by |
|---|---|
| Each template generates 4–5 pages instead of 1 | Tasks 1–6 |
| Homepage navbar uses route links (not hash anchors) | Tasks 1–5 (NAVBAR constant uses `/menu`, `/servicios` etc.) |
| Shared navbar/footer as constants (DRY) | Tasks 1–5 (NAVBAR + FOOTER module-level constants) |
| `atlasBlocks/templates/index.js` unchanged | Not touched (only individual template files change) |
| `atlasBlocks/index.js` unchanged | Not touched |
| `buildPageData()` helper encapsulates page schema | Task 6 |
| UX: no silent failure when all pages exist | Task 7 (info toast + stay on page) |
| UX: hint about skipped routes | Task 7 (hint paragraph) |

**Placeholder scan:** None found. All code blocks are complete.

**Type consistency:** The `sitePages` array items consistently have `{ id, label, routePath, required, description, build }`. `wrapTemplate()` in Task 6 reads all these fields. `buildPageData()` in Task 6 matches the schema used by the original `wrapTemplate()`. `WebsiteTemplatesScreen.jsx` reads `tpl.pages[*].{id, label, routePath, required, page}` — all present in the wrapped output.
