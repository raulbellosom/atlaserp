import { Hono } from 'hono'

export function createPublicWebsiteRouter({ prisma }) {
  const app = new Hono()

  app.get('/resolve', async (c) => {
    try {
      const instanceConfig = await prisma.instanceConfig.findUnique({
        where: { key: 'initialized' },
      })
      if (!instanceConfig || instanceConfig.value !== 'true') {
        return c.json({ initialized: false })
      }

      const routePath = c.req.query('path') || '/'

      const company = await prisma.company.findFirst({
        where: { enabled: true },
        orderBy: { createdAt: 'asc' },
      })
      if (!company) {
        return c.json({ initialized: true, site: null, page: null, theme: null, menus: [] })
      }

      const sites = await prisma.$queryRaw`
        SELECT id, name, domain, status, theme_id
        FROM website_site
        WHERE company_id = ${company.id}
          AND enabled = true
        ORDER BY created_at ASC
        LIMIT 1
      `
      const site = sites[0] ?? null
      if (!site) {
        return c.json({ initialized: true, site: null, page: null, theme: null, menus: [] })
      }

      const pages = await prisma.$queryRaw`
        SELECT id, title, slug, route_path, status, published_builder_data, seo
        FROM website_page
        WHERE company_id = ${company.id}
          AND site_id = ${site.id}
          AND route_path = ${routePath}
          AND status = 'published'
          AND enabled = true
        LIMIT 1
      `
      const page = pages[0] ?? null

      let theme = null
      if (site.theme_id) {
        const themes = await prisma.$queryRaw`
          SELECT tokens, typography, layout, custom_css
          FROM website_theme
          WHERE id = ${site.theme_id} AND enabled = true
          LIMIT 1
        `
        theme = themes[0] ?? null
      }

      const menus = await prisma.$queryRaw`
        SELECT
          m.id, m.name, m.location,
          COALESCE(
            json_agg(
              json_build_object(
                'id',         mi.id,
                'label',      mi.label,
                'url',        mi.url,
                'page_id',    mi.page_id,
                'target',     mi.target,
                'sort_order', mi.sort_order,
                'parent_id',  mi.parent_id
              ) ORDER BY mi.sort_order
            ) FILTER (WHERE mi.id IS NOT NULL),
            '[]'::json
          ) AS items
        FROM website_menu m
        LEFT JOIN website_menu_item mi
          ON mi.menu_id = m.id AND mi.enabled = true
        WHERE m.company_id = ${company.id}
          AND m.site_id = ${site.id}
          AND m.enabled = true
        GROUP BY m.id, m.name, m.location
      `

      return c.json({
        initialized: true,
        site: { id: site.id, name: site.name, domain: site.domain },
        page: page
          ? {
              id:                   page.id,
              title:                page.title,
              slug:                 page.slug,
              routePath:            page.route_path,
              status:               page.status,
              publishedBuilderData: page.published_builder_data ?? {},
              seo:                  page.seo ?? {},
            }
          : null,
        theme,
        menus,
      })
    } catch (err) {
      if (err?.message?.includes('does not exist') || err?.code === '42P01') {
        return c.json({ initialized: true, site: null, page: null, theme: null, menus: [] })
      }
      console.error('[public/website/resolve]', err?.message)
      return c.json({ initialized: true, site: null, page: null, theme: null, menus: [] }, 500)
    }
  })

  app.post('/forms/:formId/submit', async (c) => {
    const { formId } = c.req.param()
    const body = await c.req.json().catch(() => ({}))

    try {
      const form = await prisma.websiteForm.findFirst({
        where: { id: formId, enabled: true },
        include: { fields: { where: { enabled: true } } },
      })
      if (!form) return c.json({ error: 'Formulario no encontrado' }, 404)

      const missing = form.fields.filter((f) => f.required && !body[f.name])
      if (missing.length > 0) {
        return c.json({ error: 'Campos requeridos incompletos', fields: missing.map((f) => f.name) }, 422)
      }

      await prisma.websiteFormSubmission.create({
        data: {
          companyId:   form.companyId,
          formId:      form.id,
          data:        body,
          submitterIp: c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? null,
        },
      })

      return c.json({ success: true, message: form.successMessage ?? 'Gracias por tu mensaje.' })
    } catch (err) {
      console.error('[public/website/forms/submit]', err?.message)
      return c.json({ error: 'Error al procesar el envio' }, 500)
    }
  })

  return app
}
