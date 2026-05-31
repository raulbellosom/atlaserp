import { Hono } from 'hono'

const ERP_PREFIXES = ['atlas.', 'website.', 'contacts.', 'hr.', 'finance.', 'fleet.']

export function createPublicWebsiteRouter({ prisma, supabaseAdmin }) {
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

  app.get('/blog', async (c) => {
    try {
      const { siteId, limit = '10', offset = '0' } = c.req.query()
      if (!siteId) return c.json({ data: [] })
      const limitNum  = Math.min(parseInt(limit)  || 10, 50)
      const offsetNum = Math.max(parseInt(offset) || 0, 0)
      const rows = await prisma.$queryRaw`
        SELECT id, title, slug, excerpt, cover_asset_id, updated_at
        FROM website_page
        WHERE site_id   = ${siteId}::uuid
          AND page_type = 'blog_post'
          AND status    = 'published'
          AND enabled   = true
        ORDER BY updated_at DESC
        LIMIT ${limitNum} OFFSET ${offsetNum}
      `
      return c.json({ data: rows })
    } catch (err) {
      if (err?.message?.includes('does not exist') || err?.code === '42P01') return c.json({ data: [] })
      return c.json({ data: [] }, 500)
    }
  })

  app.get('/auth-check', async (c) => {
    const authHeader = c.req.header('Authorization')
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!token) return c.json({ error: 'Token requerido' }, 401)

    try {
      const { data, error } = await supabaseAdmin.auth.getUser(token)
      if (error || !data?.user) return c.json({ error: 'Token invalido o expirado' }, 401)

      const authUserId = data.user.id
      const profile = await prisma.userProfile.findUnique({ where: { authUserId } })
      if (!profile) return c.json({ canAccessErp: false })

      const memberships = await prisma.membership.findMany({
        where: { userId: profile.id, enabled: true },
        include: {
          role: {
            include: {
              permissions: {
                where: { permission: { active: true } },
                include: { permission: { select: { key: true } } },
              },
            },
          },
        },
      })

      const hasErpAccess = memberships.some((m) =>
        m.role?.permissions?.some((rp) =>
          ERP_PREFIXES.some((prefix) => rp.permission?.key?.startsWith(prefix))
        )
      )

      return c.json({ canAccessErp: hasErpAccess })
    } catch (err) {
      console.error('[public/website/auth-check]', err?.message)
      return c.json({ error: 'Error interno' }, 500)
    }
  })

  return app
}

export function createPublicCatalogRouter({ prisma }) {
  const app = new Hono()

  async function getActiveCompanyId() {
    const company = await prisma.company.findFirst({
      where: { enabled: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    })
    return company?.id ?? null
  }

  app.get('/categories', async (c) => {
    try {
      const companyId = await getActiveCompanyId()
      if (!companyId) return c.json({ data: [] })
      const rows = await prisma.$queryRaw`
        SELECT id, name, slug, description
        FROM catalog_category
        WHERE company_id = ${companyId}::uuid AND enabled = true
        ORDER BY name ASC
      `
      return c.json({ data: rows })
    } catch (err) {
      if (err?.message?.includes('does not exist') || err?.code === '42P01') return c.json({ data: [] })
      console.error('[public/catalog/categories]', err?.message)
      return c.json({ data: [] }, 500)
    }
  })

  app.get('/products', async (c) => {
    try {
      const companyId = await getActiveCompanyId()
      if (!companyId) return c.json({ data: [] })
      const { categoryId, limit = '20' } = c.req.query()
      const limitNum = Math.min(Math.max(parseInt(limit) || 20, 1), 100)
      let rows
      if (categoryId) {
        rows = await prisma.$queryRaw`
          SELECT id, name, slug, description, price, compare_price, currency,
                 stock, track_stock, cover_asset_id, images, category_id
          FROM catalog_product
          WHERE company_id = ${companyId}::uuid
            AND enabled = true AND published = true
            AND category_id = ${categoryId}::uuid
          ORDER BY created_at DESC
          LIMIT ${limitNum}
        `
      } else {
        rows = await prisma.$queryRaw`
          SELECT id, name, slug, description, price, compare_price, currency,
                 stock, track_stock, cover_asset_id, images, category_id
          FROM catalog_product
          WHERE company_id = ${companyId}::uuid
            AND enabled = true AND published = true
          ORDER BY created_at DESC
          LIMIT ${limitNum}
        `
      }
      return c.json({ data: rows })
    } catch (err) {
      if (err?.message?.includes('does not exist') || err?.code === '42P01') return c.json({ data: [] })
      console.error('[public/catalog/products]', err?.message)
      return c.json({ data: [] }, 500)
    }
  })

  return app
}
