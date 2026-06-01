import { Hono } from 'hono'

export function createStorefrontConfigRoutes({ prisma }) {
  const app = new Hono()

  app.get('/realtime-config', async (c) => {
    const companySlug = c.req.header('X-Atlas-Company')
    if (!companySlug) return c.json({ error: 'Cabecera X-Atlas-Company requerida' }, 400)

    const company = await prisma.company.findUnique({ where: { slug: companySlug } })
    if (!company) return c.json({ error: 'Empresa no encontrada' }, 404)

    return c.json({
      data: {
        supabaseUrl: process.env.SUPABASE_URL,
        supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
        companyId: company.id,
      },
    })
  })

  app.get('/config', async (c) => {
    const companySlug = c.req.header('X-Atlas-Company')
    if (!companySlug) return c.json({ error: 'Cabecera X-Atlas-Company requerida' }, 400)

    const company = await prisma.company.findUnique({
      where: { slug: companySlug },
      include: { brandingConfig: true },
    })
    if (!company) return c.json({ error: 'Empresa no encontrada' }, 404)

    return c.json({
      data: {
        name: company.name,
        slug: company.slug,
        primaryColor: company.brandingConfig?.primaryColor ?? null,
        logoFileId: company.brandingConfig?.logoFileId ?? null,
      },
    })
  })

  return app
}
