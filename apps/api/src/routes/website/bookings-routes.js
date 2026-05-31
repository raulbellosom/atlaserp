// apps/api/src/routes/website/bookings-routes.js
import { Hono } from 'hono'

export function createPublicBookingsRouter({ prisma }) {
  const app = new Hono()

  app.post('/bookings', async (c) => {
    const body = await c.req.json().catch(() => ({}))
    const { name, email, phone, date, time, notes, calendarId, serviceDuration } = body

    if (!calendarId || !name || !email || !date || !time) {
      return c.json({ error: 'Faltan campos requeridos' }, 400)
    }

    try {
      const startAt = new Date(`${date}T${time}:00.000Z`)
      const endAt   = new Date(startAt.getTime() + (Number(serviceDuration) || 60) * 60_000)

      const title = `Reservacion: ${name}`
      const desc  = [
        `Email: ${email}`,
        phone ? `Tel: ${phone}` : null,
        notes ? `Notas: ${notes}` : null,
      ].filter(Boolean).join('\n')

      // calendar_event columns: id, calendar_id, title, description,
      // start_at, end_at, all_day, location, video_url, color,
      // recurrence_rule, source_module, source_entity_id, enabled,
      // created_at, updated_at
      await prisma.$queryRaw`
        INSERT INTO calendar_event (calendar_id, title, description, start_at, end_at, source_module)
        VALUES (
          ${calendarId}::uuid, ${title}, ${desc},
          ${startAt}, ${endAt}, 'website'
        )
      `

      return c.json({ ok: true })
    } catch (err) {
      if (err?.message?.includes('does not exist') || err?.code === '42P01') {
        return c.json({ error: 'Calendario no disponible' }, 503)
      }
      console.error('[public/website/bookings]', err?.message)
      return c.json({ error: 'Error interno' }, 500)
    }
  })

  return app
}
