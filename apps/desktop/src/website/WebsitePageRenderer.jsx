import { AtlasWebBuilderProvider, AtlasWebRenderer, baseBlocks, defineTheme, defaultTheme, parsePage } from '@raulbellosom/atlas-web-builder'
import '@raulbellosom/atlas-web-builder/styles'
import {
  universalAtlasBlocks,
  ecommerceAtlasBlocks,
  bookingsAtlasBlocks,
  restaurantAtlasBlocks,
} from './atlasBlocks/index.js'

const ALL_BLOCKS = [
  ...baseBlocks,
  ...universalAtlasBlocks,
  ...ecommerceAtlasBlocks,
  ...bookingsAtlasBlocks,
  ...restaurantAtlasBlocks,
]

export function WebsitePageRenderer({ page, theme }) {
  const resolvedTheme = theme?.tokens
    ? defineTheme({
        ...defaultTheme,
        id: 'atlas-site',
        name: 'Site Theme',
        tokens: { ...defaultTheme.tokens, ...theme.tokens },
      })
    : defaultTheme

  if (!page?.publishedBuilderData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <p className="text-sm text-gray-400">Esta pagina no tiene contenido publicado aun.</p>
      </div>
    )
  }

  let parsedPage
  try {
    parsedPage =
      typeof page.publishedBuilderData === 'string'
        ? parsePage(page.publishedBuilderData)
        : parsePage(JSON.stringify(page.publishedBuilderData))
  } catch {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <p className="text-sm text-gray-400">Esta pagina no tiene contenido publicado aun.</p>
      </div>
    )
  }

  return (
    <AtlasWebBuilderProvider blocks={ALL_BLOCKS} theme={resolvedTheme}>
      <AtlasWebRenderer page={parsedPage} mode="public" />
    </AtlasWebBuilderProvider>
  )
}
