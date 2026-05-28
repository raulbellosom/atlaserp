export function Hero({ headline, subheadline, ctaLabel, ctaHref, backgroundImage }) {
  return (
    <section
      className="w-full min-h-[480px] flex items-center justify-center bg-gray-900 text-white"
      style={backgroundImage ? { backgroundImage: `url(${backgroundImage})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}
    >
      <div className="max-w-3xl mx-auto px-6 text-center space-y-6">
        {headline    && <h1 className="text-4xl md:text-5xl font-bold">{headline}</h1>}
        {subheadline && <p className="text-lg md:text-xl text-gray-200">{subheadline}</p>}
        {ctaLabel    && (
          <a
            href={ctaHref || '#'}
            className="inline-block px-7 py-3 rounded-lg bg-white text-gray-900 font-semibold text-sm hover:bg-gray-100 transition-colors"
          >
            {ctaLabel}
          </a>
        )}
      </div>
    </section>
  )
}

Hero.fields = {
  headline:        { type: 'text',  label: 'Titulo principal' },
  subheadline:     { type: 'text',  label: 'Subtitulo' },
  ctaLabel:        { type: 'text',  label: 'Texto del boton' },
  ctaHref:         { type: 'text',  label: 'Enlace del boton' },
  backgroundImage: { type: 'text',  label: 'URL de imagen de fondo' },
}
