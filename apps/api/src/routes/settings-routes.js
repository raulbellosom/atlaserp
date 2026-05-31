import { Hono } from 'hono'
import { z } from 'zod'
import { encryptPassword, createSmtpService } from '../services/smtp-service.js'

const smtpSchema = z.object({
  host:       z.string().min(1),
  port:       z.number().int().min(1).max(65535).default(587),
  user:       z.string().min(1),
  pass:       z.string().optional(),
  from_name:  z.string().optional(),
  from_email: z.string().email().optional(),
  tls:        z.boolean().default(false),
})

export function createSettingsRouter({ prisma, requirePermission }) {
  const app = new Hono()

  app.get('/settings/smtp', requirePermission('platform.settings.manage'), async (c) => {
    try {
      const rows = await prisma.instanceConfig.findMany({
        where: {
          key: {
            in: ['smtp.host', 'smtp.port', 'smtp.user',
                 'smtp.from_name', 'smtp.from_email', 'smtp.tls'],
          },
        },
      })
      const cfg = Object.fromEntries(rows.map((r) => [r.key, r.value]))
      return c.json({
        data: {
          host:       cfg['smtp.host']       ?? '',
          port:       Number(cfg['smtp.port'] ?? 587),
          user:       cfg['smtp.user']       ?? '',
          from_name:  cfg['smtp.from_name']  ?? '',
          from_email: cfg['smtp.from_email'] ?? '',
          tls:        cfg['smtp.tls'] === 'true',
          configured: Boolean(cfg['smtp.host'] && cfg['smtp.user']),
        },
      })
    } catch (err) {
      console.error('[GET /settings/smtp]', err?.message)
      return c.json({ error: 'Internal error' }, 500)
    }
  })

  app.post('/settings/smtp', requirePermission('platform.settings.manage'), async (c) => {
    try {
      const body = await c.req.json()
      const parsed = smtpSchema.safeParse(body)
      if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400)
      const data = parsed.data

      const entries = [
        { key: 'smtp.host',       value: data.host },
        { key: 'smtp.port',       value: String(data.port) },
        { key: 'smtp.user',       value: data.user },
        { key: 'smtp.from_name',  value: data.from_name  ?? '' },
        { key: 'smtp.from_email', value: data.from_email ?? '' },
        { key: 'smtp.tls',        value: String(data.tls) },
      ]

      if (data.pass) {
        entries.push({ key: 'smtp.pass', value: encryptPassword(data.pass) })
      }

      await Promise.all(
        entries.map((e) =>
          prisma.instanceConfig.upsert({
            where:  { key: e.key },
            create: { key: e.key, value: e.value },
            update: { value: e.value },
          }),
        ),
      )

      return c.json({ ok: true })
    } catch (err) {
      console.error('[POST /settings/smtp]', err?.message)
      return c.json({ error: 'Internal error' }, 500)
    }
  })

  app.post('/settings/smtp/test', requirePermission('platform.settings.manage'), async (c) => {
    try {
      const smtpSvc = createSmtpService({ prisma })
      const userId  = c.get('userId') ?? c.get('user')?.id

      const userProfile = await prisma.userProfile.findFirst({
        where: { id: userId },
        select: { email: true },
      })

      await smtpSvc.sendEmail({
        to:      userProfile?.email ?? 'test@example.com',
        subject: 'Atlas ERP — Prueba de SMTP',
        html:    '<p>La configuracion SMTP funciona correctamente.</p>',
        text:    'La configuracion SMTP funciona correctamente.',
      })
      return c.json({ ok: true })
    } catch (err) {
      return c.json({ error: err.message }, 400)
    }
  })

  return app
}
