import { Hono } from 'hono'

export function createStorefrontAuthRoutes({ authService, storefrontAuthMiddleware }) {
  const app = new Hono()

  app.post('/register', async (c) => {
    const companySlug = c.req.header('X-Atlas-Company')
    if (!companySlug) return c.json({ error: 'Cabecera X-Atlas-Company requerida' }, 400)

    let body
    try { body = await c.req.json() } catch { return c.json({ error: 'Body JSON inválido' }, 400) }

    const { email, password, name, role = 'storefront_client' } = body
    if (!email || !password || !name) {
      return c.json({ error: 'email, password y name son requeridos' }, 422)
    }

    try {
      const user = await authService.register({ email, password, name, role, companySlug })
      return c.json({ data: user }, 201)
    } catch (err) {
      return c.json({ error: err.message }, err.status ?? 500)
    }
  })

  app.post('/login', async (c) => {
    const companySlug = c.req.header('X-Atlas-Company')
    if (!companySlug) return c.json({ error: 'Cabecera X-Atlas-Company requerida' }, 400)

    let body
    try { body = await c.req.json() } catch { return c.json({ error: 'Body JSON inválido' }, 400) }

    const { email, password } = body
    if (!email || !password) return c.json({ error: 'email y password son requeridos' }, 422)

    try {
      const result = await authService.login({ email, password, companySlug })
      return c.json({ data: result })
    } catch (err) {
      return c.json({ error: err.message }, err.status ?? 500)
    }
  })

  app.post('/refresh', async (c) => {
    let body
    try { body = await c.req.json() } catch { return c.json({ error: 'Body JSON inválido' }, 400) }

    const { refreshToken } = body
    if (!refreshToken) return c.json({ error: 'refreshToken requerido' }, 422)

    try {
      const result = await authService.refresh(refreshToken)
      return c.json({ data: result })
    } catch (err) {
      return c.json({ error: err.message }, err.status ?? 500)
    }
  })

  app.get('/me', storefrontAuthMiddleware, async (c) => {
    const { profile, companySlug } = c.get('storefrontUser')
    try {
      const user = await authService.me(profile.authUserId, companySlug)
      return c.json({ data: user })
    } catch (err) {
      return c.json({ error: err.message }, err.status ?? 500)
    }
  })

  app.post('/logout', storefrontAuthMiddleware, async (c) => {
    const authHeader = c.req.header('Authorization')
    const token = authHeader?.replace('Bearer ', '') ?? ''
    try {
      await authService.logout(token)
      return c.json({ data: { success: true } })
    } catch (err) {
      return c.json({ error: err.message }, err.status ?? 500)
    }
  })

  return app
}
