export function WebsitePageRenderer({ page, theme, menus }) {
  if (!page?.publishedBuilderData || !Object.keys(page.publishedBuilderData).length) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <p className="text-sm text-gray-400">Esta pagina no tiene contenido publicado aun.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white" data-page-id={page.id}>
      <p className="p-8 text-sm text-gray-400 text-center">
        Renderizador Puck pendiente — datos recibidos correctamente.
      </p>
    </div>
  )
}
