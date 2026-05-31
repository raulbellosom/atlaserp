// --- Bloques existentes ---
import { ContactFormBlock }  from './contactFormBlock.jsx'
import { BlogIndexBlock }    from './blogIndexBlock.jsx'
import { ProductsGridBlock } from './productsGridBlock.jsx'
import { ProductCardBlock }  from './productCardBlock.jsx'
import { CartBlock }         from './cartBlock.jsx'
import { BookingFormBlock }  from './bookingFormBlock.jsx'

// --- Bloques universales nuevos ---
import { ServicesGridBlock }    from './servicesGridBlock.jsx'
import { TestimonialsBlock }    from './testimonialsBlock.jsx'
import { StatsBlock }           from './statsBlock.jsx'
import { GalleryBlock }         from './galleryBlock.jsx'
import { CtaBannerBlock }       from './ctaBannerBlock.jsx'
import { FeaturesSectionBlock } from './featuresSectionBlock.jsx'
import { TeamGridBlock }        from './teamGridBlock.jsx'

// --- Bloques específicos por giro ---
import { MenuGridBlock } from './menuGridBlock.jsx'

// --- Templates ---
import {
  restauranteTemplate,
  spaTemplate,
  tiendaTemplate,
  agenciaTemplate,
  negocioTemplate,
  allAtlasTemplates,
} from './templates/index.js'

export {
  restauranteTemplate,
  spaTemplate,
  tiendaTemplate,
  agenciaTemplate,
  negocioTemplate,
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
}

// ─── Builders por tipo de sitio ──────────────────────────────────────────────

/**
 * Devuelve el array de bloques para un tipo de sitio dado.
 * siteType: 'general' | 'informational' | 'ecommerce' | 'bookings' | 'restaurant'
 */
export function buildAtlasBlocks(siteType) {
  const blocks = [...universalAtlasBlocks]
  if (siteType === 'ecommerce')  blocks.push(...ecommerceAtlasBlocks)
  if (siteType === 'bookings')   blocks.push(...bookingsAtlasBlocks)
  if (siteType === 'restaurant') blocks.push(...restaurantAtlasBlocks)
  return blocks
}

/**
 * Devuelve los templates relevantes para un tipo de sitio dado.
 * Siempre incluye templates universales (agencia, negocio).
 * Añade los específicos según el siteType.
 */
export function buildAtlasTemplates(siteType) {
  const base = [agenciaTemplate, negocioTemplate]
  if (siteType === 'ecommerce')  return [...base, tiendaTemplate]
  if (siteType === 'bookings')   return [...base, spaTemplate, restauranteTemplate]
  if (siteType === 'restaurant') return [restauranteTemplate, ...base]
  // general / informational → todos excepto tienda
  return [restauranteTemplate, spaTemplate, agenciaTemplate, negocioTemplate]
}
