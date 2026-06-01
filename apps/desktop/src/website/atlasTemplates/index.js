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
