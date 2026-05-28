import { Render } from '@measured/puck'
import '@measured/puck/puck.css'
import { atlasWebsiteConfig } from './atlasWebsiteConfig.js'

export function WebsitePageRenderer({ page, theme, menus }) {
  if (!page?.publishedBuilderData || !page.publishedBuilderData.content) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <p className="text-sm text-gray-400">Esta pagina no tiene contenido publicado aun.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white" data-page-id={page.id}>
      <Render config={atlasWebsiteConfig} data={page.publishedBuilderData} />
    </div>
  )
}
