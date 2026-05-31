import { defineBlock } from '@raulbellosom/atlas-web-builder'
import { getApiUrl } from '../../lib/runtimeConfig.js'

export const ContactFormBlock = defineBlock({
  type:     'ContactFormBlock',
  label:    'Formulario de contacto',
  category: 'atlas',
  defaultProps: {
    formId:         '',
    successMessage: 'Mensaje enviado correctamente',
    buttonLabel:    'Enviar',
  },
  fields: {
    formId:         { type: 'text',   label: 'ID del formulario' },
    successMessage: { type: 'text',   label: 'Mensaje de exito' },
    buttonLabel:    { type: 'text',   label: 'Texto del boton' },
  },
  render({ formId, successMessage, buttonLabel }) {
    if (!formId) {
      return (
        <div style={{ padding: '24px', background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '8px', textAlign: 'center' }}>
          <p style={{ color: '#94a3b8', fontSize: '14px' }}>Configura el ID del formulario en las propiedades</p>
        </div>
      )
    }
    const apiUrl = typeof getApiUrl === 'function' ? getApiUrl() : ''
    const handleSubmit = async (e) => {
      e.preventDefault()
      const data = Object.fromEntries(new FormData(e.target))
      try {
        const res = await fetch(`${apiUrl}/public/website/forms/${formId}/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })
        if (res.ok) {
          e.target.reset()
          const el = e.target.querySelector('[data-success]')
          if (el) { el.style.display = 'block'; setTimeout(() => { el.style.display = 'none' }, 5000) }
        }
      } catch { /* no-op */ }
    }
    return (
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '480px' }}>
        <input name="name"    required placeholder="Nombre"   style={{ padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '14px' }} />
        <input name="email"   required type="email" placeholder="Email" style={{ padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '14px' }} />
        <textarea name="message" required rows={4} placeholder="Mensaje" style={{ padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '14px', resize: 'vertical' }} />
        <button type="submit" style={{ padding: '10px 24px', background: 'var(--atlas-color-primary, #6D28D9)', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }}>
          {buttonLabel}
        </button>
        <p data-success style={{ display: 'none', color: '#16a34a', fontSize: '14px' }}>{successMessage}</p>
      </form>
    )
  },
})
