export function WebsitePageRenderer({ page }) {
  const data = page?.publishedBuilderData

  if (!data || (!data.html && !data.gjsProjectData)) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center space-y-3 max-w-sm px-6">
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto">
            <span className="text-gray-400 text-xl">📄</span>
          </div>
          <h2 className="text-xl font-semibold text-gray-900">Pagina sin contenido</h2>
          <p className="text-gray-500 text-sm">Esta pagina aun no tiene contenido publicado.</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <link rel="stylesheet" href="https://cdn.tailwindcss.com" />
      {data.css && <style dangerouslySetInnerHTML={{ __html: data.css }} />}
      <div dangerouslySetInnerHTML={{ __html: data.html || '' }} />
    </>
  )
}
