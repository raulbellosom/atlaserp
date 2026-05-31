// apps/api/src/routes/website/checkout-routes.js
import { Hono } from 'hono'
import Stripe from 'stripe'
import { decryptPassword } from '../../services/smtp-service.js'

export function createPublicCheckoutRouter({ prisma }) {
  const app = new Hono()

  app.post('/checkout', async (c) => {
    const siteId = c.req.header('X-Site-Id')
    const body   = await c.req.json().catch(() => ({}))
    const { items } = body

    if (!siteId || !items?.length) {
      return c.json({ error: 'Faltan siteId o items' }, 400)
    }

    try {
      const sites = await prisma.$queryRaw`
        SELECT stripe_secret_key, stripe_currency, stripe_success_message
        FROM website_site
        WHERE id = ${siteId}::uuid AND enabled = true
        LIMIT 1
      `
      const site = sites[0]
      if (!site?.stripe_secret_key) {
        return c.json({ error: 'Stripe no configurado para este sitio' }, 400)
      }

      const secretKey = decryptPassword(site.stripe_secret_key)
      const stripe    = new Stripe(secretKey, { apiVersion: '2024-12-18.acacia' })

      const lineItems = items.map((item) => ({
        price_data: {
          currency:     (site.stripe_currency ?? 'usd').toLowerCase(),
          product_data: { name: item.name },
          unit_amount:  Math.round(item.price * 100),
        },
        quantity: item.qty,
      }))

      const origin = c.req.header('Origin') ?? ''

      const session = await stripe.checkout.sessions.create({
        mode:        'payment',
        line_items:  lineItems,
        success_url: `${origin}/gracias?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url:  `${origin}/`,
      })

      return c.json({ url: session.url })
    } catch (err) {
      console.error('[public/website/checkout]', err?.message)
      return c.json({ error: err.message }, 500)
    }
  })

  return app
}
