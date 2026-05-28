export function BlogPostsBlock({ title, count }) {
  return (
    <div className="rounded-xl border-2 border-dashed border-gray-200 p-8 text-center space-y-2">
      {title && <h3 className="font-semibold text-gray-900">{title}</h3>}
      <p className="text-sm text-gray-400">Ultimas {count || 3} entradas — disponible con atlas.blog</p>
    </div>
  )
}

BlogPostsBlock.fields = {
  title: { type: 'text',   label: 'Titulo' },
  count: { type: 'number', label: 'Cantidad de posts' },
}
