export function Section({ children, backgroundColor, paddingY }) {
  return (
    <section
      style={{ backgroundColor: backgroundColor || 'transparent' }}
      className={`w-full ${paddingY || 'py-16'}`}
    >
      <div className="max-w-6xl mx-auto px-6">{children}</div>
    </section>
  )
}

Section.fields = {
  backgroundColor: { type: 'text', label: 'Color de fondo (hex/css)' },
  paddingY:        { type: 'text', label: 'Padding vertical (clase Tailwind)' },
}
