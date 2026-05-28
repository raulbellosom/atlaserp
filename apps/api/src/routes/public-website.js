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
          AND status = 'published'
        ORDER BY created_at ASC
        LIMIT 1
      `
      const site = sites[0] ?? null
      if (!site) {
        return c.json({ initialized: true, site: null, page: null, theme: null, menus: [] })
      }

      const pages = await prisma.$queryRaw`
        SELECT id, title, route_path, published_builder_data, seo
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
              routePath:            page.route_path,
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

  return app
}
