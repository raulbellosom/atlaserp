import { useState } from 'react'

const DEFAULT_ITEMS = [
  { question: '¿Como funciona?', answer: 'Aqui va la respuesta.' },
]

export function FAQ({ title, items }) {
  const faqs = (items && items.length > 0) ? items : DEFAULT_ITEMS
  const [open, setOpen] = useState(null)

  return (
    <div className="space-y-6">
      {title && <h2 className="text-3xl font-semibold text-center text-gray-900">{title}</h2>}
      <div className="space-y-3">
        {faqs.map((faq, i) => (
          <div key={i} className="rounded-xl border border-gray-200 overflow-hidden">
            <button
              className="w-full text-left px-5 py-4 font-medium text-gray-900 flex justify-between items-center"
              onClick={() => setOpen(open === i ? null : i)}
            >
              {faq.question}
              <span className="text-gray-400">{open === i ? '−' : '+'}</span>
            </button>
            {open === i && (
              <div className="px-5 pb-4 text-sm text-gray-600">{faq.answer}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

FAQ.fields = {
  title: { type: 'text', label: 'Titulo de la seccion' },
  items: {
    type:       'array',
    label:      'Preguntas',
    arrayFields: {
      question: { type: 'text',     label: 'Pregunta' },
      answer:   { type: 'textarea', label: 'Respuesta' },
    },
  },
}
