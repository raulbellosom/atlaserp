import { WebsiteServiceError, notFound, conflict } from './service-helpers.js'

export { WebsiteServiceError }

export function createWebsiteService({ prisma }) {
  async function getSite({ companyId }) {
    const rows = await prisma.$queryRaw`
      SELECT id, name, domain, status, homepage_page_id, theme_id, settings, seo_defaults
      FROM website_site
      WHERE company_id = ${companyId} AND enabled = true
      ORDER BY created_at ASC
      LIMIT 1
    `
    return rows[0] ?? null
  }

  async function createSite({ companyId, data, actorId }) {
    const rows = await prisma.$queryRaw`
      INSERT INTO website_site
        (company_id, name, domain, default_locale, status, enabled, created_at, updated_at)
      VALUES
        (${companyId}, ${data.name}, ${data.domain ?? null}, ${data.defaultLocale ?? 'es'},
         'draft', true, NOW(), NOW())
      RETURNING *
    `
    const created = rows[0]
    await prisma.auditLog.create({
      data: {
        actorId: actorId ?? null,
        moduleKey: 'atlas.website',
        entityType: 'website.site',
        entityId: created.id,
        action: 'site.create',
        before: null,
        after: JSON.stringify(created),
      },
    })
    return created
  }

  async function updateSite({ companyId, siteId, data, actorId }) {
    const before = await prisma.$queryRaw`
      SELECT * FROM website_site WHERE id = ${siteId} AND company_id = ${companyId}
    `.then(r => r[0] ?? null)
    if (!before) throw notFound('Sitio')

    const rows = await prisma.$queryRaw`
      UPDATE website_site SET
        name            = COALESCE(${data.name ?? null},           name),
        domain          = COALESCE(${data.domain ?? null},         domain),
        status          = COALESCE(${data.status ?? null},         status),
        homepage_page_id= COALESCE(${data.homepagePageId ?? null}, homepage_page_id),
        theme_id        = COALESCE(${data.themeId ?? null},        theme_id),
        settings        = COALESCE(${data.settings ? JSON.stringify(data.settings) : null}::jsonb, settings),
        seo_defaults    = COALESCE(${data.seoDefaults ? JSON.stringify(data.seoDefaults) : null}::jsonb, seo_defaults),
        updated_at      = NOW()
      WHERE id = ${siteId} AND company_id = ${companyId}
      RETURNING *
    `
    const after = rows[0]
    await prisma.auditLog.create({
      data: {
        actorId: actorId ?? null,
        moduleKey: 'atlas.website',
        entityType: 'website.site',
        entityId: siteId,
        action: 'site.update',
        before: JSON.stringify(before),
        after: JSON.stringify(after),
      },
    })
    return after
  }

  async function listPages({ companyId, siteId, page = 1, pageSize = 30 }) {
    const offset = (page - 1) * pageSize
    const rows = await prisma.$queryRaw`
      SELECT id, title, slug, route_path, status, page_type, visibility,
             published_at, created_at, updated_at
      FROM website_page
      WHERE company_id = ${companyId}
        AND site_id = ${siteId}
        AND enabled = true
      ORDER BY created_at DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `
    const countRows = await prisma.$queryRaw`
      SELECT COUNT(*) AS total FROM website_page
      WHERE company_id = ${companyId} AND site_id = ${siteId} AND enabled = true
    `
    return { data: rows, total: Number(countRows[0]?.total ?? 0), page, pageSize }
  }

  async function getPage({ companyId, pageId }) {
    const rows = await prisma.$queryRaw`
      SELECT * FROM website_page
      WHERE id = ${pageId} AND company_id = ${companyId} AND enabled = true
      LIMIT 1
    `
    if (!rows[0]) throw notFound('Pagina')
    return rows[0]
  }

  async function createPage({ companyId, siteId, data, actorId }) {
    const existing = await prisma.$queryRaw`
      SELECT id FROM website_page
      WHERE company_id = ${companyId}
        AND site_id = ${siteId}
        AND route_path = ${data.routePath}
        AND enabled = true
      LIMIT 1
    `
    if (existing[0]) throw conflict(`La ruta "${data.routePath}" ya esta en uso.`)

    const rows = await prisma.$queryRaw`
      INSERT INTO website_page
        (company_id, site_id, title, slug, route_path, status, page_type,
         visibility, draft_builder_data, seo, created_by_id, updated_by_id,
         enabled, created_at, updated_at)
      VALUES
        (${companyId}, ${siteId}, ${data.title}, ${data.slug}, ${data.routePath},
         'draft', ${data.pageType ?? 'page'}, ${data.visibility ?? 'public'},
         '{}'::jsonb, ${data.seo ? JSON.stringify(data.seo) : '{}'}::jsonb,
         ${actorId ?? null}, ${actorId ?? null},
         true, NOW(), NOW())
      RETURNING *
    `
    const created = rows[0]
    await prisma.auditLog.create({
      data: {
        actorId: actorId ?? null,
        moduleKey: 'atlas.website',
        entityType: 'website.page',
        entityId: created.id,
        action: 'page.create',
        before: null,
        after: JSON.stringify(created),
      },
    })
    return created
  }

  async function updatePage({ companyId, pageId, data, actorId }) {
    const before = await getPage({ companyId, pageId })
    const rows = await prisma.$queryRaw`
      UPDATE website_page SET
        title       = COALESCE(${data.title ?? null},      title),
        slug        = COALESCE(${data.slug ?? null},       slug),
        route_path  = COALESCE(${data.routePath ?? null},  route_path),
        visibility  = COALESCE(${data.visibility ?? null}, visibility),
        seo         = COALESCE(${data.seo ? JSON.stringify(data.seo) : null}::jsonb, seo),
        updated_by_id = ${actorId ?? null},
        updated_at  = NOW()
      WHERE id = ${pageId} AND company_id = ${companyId}
      RETURNING *
    `
    const after = rows[0]
    await prisma.auditLog.create({
      data: {
        actorId: actorId ?? null,
        moduleKey: 'atlas.website',
        entityType: 'website.page',
        entityId: pageId,
        action: 'page.update',
        before: JSON.stringify(before),
        after: JSON.stringify(after),
      },
    })
    return after
  }

  async function saveDraft({ companyId, pageId, builderData, seo, actorId }) {
    const before = await getPage({ companyId, pageId })
    const rows = await prisma.$queryRaw`
      UPDATE website_page SET
        draft_builder_data = ${JSON.stringify(builderData)}::jsonb,
        seo                = COALESCE(${seo ? JSON.stringify(seo) : null}::jsonb, seo),
        updated_by_id      = ${actorId ?? null},
        updated_at         = NOW()
      WHERE id = ${pageId} AND company_id = ${companyId}
      RETURNING *
    `
    const after = rows[0]
    await prisma.auditLog.create({
      data: {
        actorId: actorId ?? null,
        moduleKey: 'atlas.website',
        entityType: 'website.page',
        entityId: pageId,
        action: 'page.save_draft',
        before: JSON.stringify({ draft_builder_data: before.draft_builder_data }),
        after:  JSON.stringify({ draft_builder_data: after.draft_builder_data }),
      },
    })
    return after
  }

  async function publishPage({ companyId, pageId, actorId }) {
    const before = await getPage({ companyId, pageId })

    const versionRows = await prisma.$queryRaw`
      SELECT COALESCE(MAX(version_number), 0) + 1 AS next_version
      FROM website_page_version
      WHERE page_id = ${pageId} AND company_id = ${companyId}
    `
    const nextVersion = Number(versionRows[0]?.next_version ?? 1)

    await prisma.$queryRaw`
      INSERT INTO website_page_version
        (company_id, page_id, version_number, builder_data, seo, status, created_by_id, created_at)
      VALUES
        (${companyId}, ${pageId}, ${nextVersion},
         ${JSON.stringify(before.draft_builder_data ?? {})}::jsonb,
         ${JSON.stringify(before.seo ?? {})}::jsonb,
         'published', ${actorId ?? null}, NOW())
    `

    const rows = await prisma.$queryRaw`
      UPDATE website_page SET
        published_builder_data = draft_builder_data,
        status                 = 'published',
        published_at           = NOW(),
        updated_by_id          = ${actorId ?? null},
        updated_at             = NOW()
      WHERE id = ${pageId} AND company_id = ${companyId}
      RETURNING *
    `
    const after = rows[0]

    await prisma.$queryRaw`
      INSERT INTO website_published_render
        (company_id, site_id, source_type, source_id, path, status_code,
         published_at, updated_at)
      VALUES
        (${companyId}, ${after.site_id}, 'page', ${pageId},
         ${after.route_path}, 200, NOW(), NOW())
      ON CONFLICT (site_id, path) DO UPDATE SET
        source_id    = EXCLUDED.source_id,
        source_type  = EXCLUDED.source_type,
        status_code  = 200,
        published_at = NOW(),
        updated_at   = NOW()
    `

    await prisma.auditLog.create({
      data: {
        actorId: actorId ?? null,
        moduleKey: 'atlas.website',
        entityType: 'website.page',
        entityId: pageId,
        action: 'page.publish',
        before: JSON.stringify({ status: before.status }),
        after:  JSON.stringify({ status: 'published', published_at: after.published_at }),
      },
    })
    return after
  }

  async function softDeletePage({ companyId, pageId, actorId }) {
    const before = await getPage({ companyId, pageId })
    await prisma.$queryRaw`
      UPDATE website_page SET enabled = false, updated_at = NOW()
      WHERE id = ${pageId} AND company_id = ${companyId}
    `
    await prisma.auditLog.create({
      data: {
        actorId: actorId ?? null,
        moduleKey: 'atlas.website',
        entityType: 'website.page',
        entityId: pageId,
        action: 'page.delete',
        before: JSON.stringify(before),
        after: null,
      },
    })
  }

  async function listThemes({ companyId, siteId }) {
    return prisma.$queryRaw`
      SELECT id, name, is_default, tokens, typography, layout, custom_css
      FROM website_theme
      WHERE company_id = ${companyId} AND site_id = ${siteId} AND enabled = true
      ORDER BY is_default DESC, name ASC
    `
  }

  async function listMenus({ companyId, siteId }) {
    return prisma.$queryRaw`
      SELECT m.id, m.name, m.location,
        COALESCE(
          json_agg(
            json_build_object(
              'id', mi.id, 'label', mi.label, 'url', mi.url,
              'page_id', mi.page_id, 'target', mi.target,
              'sort_order', mi.sort_order, 'parent_id', mi.parent_id
            ) ORDER BY mi.sort_order
          ) FILTER (WHERE mi.id IS NOT NULL),
          '[]'::json
        ) AS items
      FROM website_menu m
      LEFT JOIN website_menu_item mi ON mi.menu_id = m.id AND mi.enabled = true
      WHERE m.company_id = ${companyId} AND m.site_id = ${siteId} AND m.enabled = true
      GROUP BY m.id, m.name, m.location
    `
  }

  return {
    getSite,
    createSite,
    updateSite,
    listPages,
    getPage,
    createPage,
    updatePage,
    saveDraft,
    publishPage,
    softDeletePage,
    listThemes,
    listMenus,
  }
}
