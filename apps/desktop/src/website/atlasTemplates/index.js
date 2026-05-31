import { allAtlasTemplates } from '../atlasBlocks/templates/index.js'

const CATEGORY_COLORS = {
  restaurante: '#92400e',
  belleza:     '#9d174d',
  ecommerce:   '#065f46',
  agencia:     '#1e3a8a',
  negocio:     '#4c1d95',
}

function wrapTemplate(tpl) {
  const { rootIds, blocks } = tpl.build()
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
        page: {
          schemaVersion: 1,
          id:         `page_${tpl.id}_home`,
          slug:       '/',
          title:      'Inicio',
          visibility: 'public',
          regions: {
            main: { id: `region_${tpl.id}_main`, children: rootIds },
          },
          blocks,
          seo: {
            title:          tpl.label,
            description:    tpl.description,
            canonical:      null,
            ogImageAssetId: null,
          },
          updatedAt: new Date().toISOString(),
        },
      },
    ],
  }
}

export const allTemplates = allAtlasTemplates.map(wrapTemplate)
