// apps/api/src/routes/website/forms-public-routes.js
import { Hono } from 'hono'
import { createSmtpService } from '../../services/smtp-service.js'

export function createPublicFormsRouter({ prisma }) {
  const app = new Hono()

  app.post('/forms/:formId/submit', async (c) => {
    const { formId } = c.req.param()
    const body = await c.req.json().catch(() => ({}))

    try {
      const forms = await prisma.$queryRaw`
        SELECT id, notification_email, fields, site_id, company_id
        FROM website_form
        WHERE id = ${formId}::uuid AND enabled = true
        LIMIT 1
      `
      const form = forms[0]
      if (!form) return c.json({ error: 'Formulario no encontrado' }, 404)

      await prisma.$queryRaw`
        INSERT INTO website_form_submission (form_id, company_id, data)
        VALUES (${form.id}::uuid, ${form.company_id}::uuid, ${JSON.stringify(body)}::jsonb)
      `

      if (form.notification_email) {
        try {
          const smtpSvc = createSmtpService({ prisma })
          const rows = Object.entries(body)
            .map(([k, v]) => `<tr><td style="padding:4px 8px;font-weight:600">${k}</td><td style="padding:4px 8px">${v}</td></tr>`)
            .join('')
          await smtpSvc.sendEmail({
            to:      form.notification_email,
            subject: 'Nuevo mensaje del formulario de contacto',
            html:    `<p>Nuevo envio recibido.</p><table border="1" cellpadding="4" style="border-collapse:collapse">${rows}</table>`,
            text:    Object.entries(body).map(([k, v]) => `${k}: ${v}`).join('\n'),
          })
        } catch { /* SMTP not configured or error - submission saved anyway */ }
      }

      return c.json({ ok: true })
    } catch (err) {
      if (err?.message?.includes('does not exist') || err?.code === '42P01') {
        return c.json({ error: 'Formulario no disponible' }, 503)
      }
      console.error('[public/website/forms/submit]', err?.message)
      return c.json({ error: 'Error interno' }, 500)
    }
  })

  return app
}
