import { WebsiteServiceError, notFound, conflict } from './service-helpers.js'

export { WebsiteServiceError }

export function createWebsiteService({ prisma }) {
  async function getSite({ companyId }) {
    return prisma.websiteSite.findFirst({
      where: { companyId, enabled: true },
      orderBy: { createdAt: 'asc' },
    })
  }

  async function createSite({ companyId, data, actorId }) {
    const created = await prisma.websiteSite.create({
      data: {
        companyId,
        name: data.name,
        domain: data.domain ?? null,
        defaultLocale: data.defaultLocale ?? 'es',
        status: 'draft',
        enabled: true,
      },
    })
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
    const before = await prisma.websiteSite.findFirst({
      where: { id: siteId, companyId },
    })
    if (!before) throw notFound('Sitio')

    const after = await prisma.websiteSite.update({
      where: { id: siteId },
      data: {
        ...(data.name        !== undefined && { name:           data.name }),
        ...(data.domain      !== undefined && { domain:         data.domain }),
        ...(data.status      !== undefined && { status:         data.status }),
        ...(data.homepagePageId !== undefined && { homepagePageId: data.homepagePageId }),
        ...(data.themeId     !== undefined && { themeId:        data.themeId }),
        ...(data.settings    !== undefined && { settings:       data.settings }),
        ...(data.seoDefaults !== undefined && { seoDefaults:    data.seoDefaults }),
      },
    })
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
    const skip = (page - 1) * pageSize
    const [data, total] = await Promise.all([
      prisma.websitePage.findMany({
        where: { companyId, siteId, enabled: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        select: {
          id: true,
          title: true,
          slug: true,
          routePath: true,
          status: true,
          pageType: true,
          visibility: true,
          publishedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.websitePage.count({ where: { companyId, siteId, enabled: true } }),
    ])
    return { data, total, page, pageSize }
  }

  async function getPage({ companyId, pageId }) {
    const page = await prisma.websitePage.findFirst({
      where: { id: pageId, companyId, enabled: true },
    })
    if (!page) throw notFound('Pagina')
    return page
  }

  async function createPage({ companyId, siteId, data, actorId }) {
    const existing = await prisma.websitePage.findFirst({
      where: { companyId, siteId, routePath: data.routePath, enabled: true },
      select: { id: true },
    })
    if (existing) throw conflict(`La ruta "${data.routePath}" ya esta en uso.`)

    const created = await prisma.websitePage.create({
      data: {
        companyId,
        siteId,
        title: data.title,
        slug: data.slug,
        routePath: data.routePath,
        status: 'draft',
        pageType: data.pageType ?? 'page',
        visibility: data.visibility ?? 'public',
        draftBuilderData: {},
        seo: data.seo ?? {},
        createdById: actorId ?? null,
        updatedById: actorId ?? null,
        enabled: true,
      },
    })
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
    const after = await prisma.websitePage.update({
      where: { id: pageId },
      data: {
        ...(data.title      !== undefined && { title:      data.title }),
        ...(data.slug       !== undefined && { slug:       data.slug }),
        ...(data.routePath  !== undefined && { routePath:  data.routePath }),
        ...(data.visibility !== undefined && { visibility: data.visibility }),
        ...(data.seo        !== undefined && { seo:        data.seo }),
        updatedById: actorId ?? null,
      },
    })
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
    const after = await prisma.websitePage.update({
      where: { id: pageId },
      data: {
        draftBuilderData: builderData,
        ...(seo !== undefined && { seo }),
        updatedById: actorId ?? null,
      },
    })
    await prisma.auditLog.create({
      data: {
        actorId: actorId ?? null,
        moduleKey: 'atlas.website',
        entityType: 'website.page',
        entityId: pageId,
        action: 'page.save_draft',
        before: JSON.stringify({ draftBuilderData: before.draftBuilderData }),
        after:  JSON.stringify({ draftBuilderData: after.draftBuilderData }),
      },
    })
    return after
  }

  async function publishPage({ companyId, pageId, actorId }) {
    const before = await getPage({ companyId, pageId })

    const maxVersion = await prisma.websitePageVersion.aggregate({
      where: { pageId, companyId },
      _max: { versionNumber: true },
    })
    const nextVersion = (maxVersion._max.versionNumber ?? 0) + 1

    await prisma.websitePageVersion.create({
      data: {
        companyId,
        pageId,
        versionNumber: nextVersion,
        builderData: before.draftBuilderData ?? {},
        seo: before.seo ?? {},
        status: 'published',
        createdById: actorId ?? null,
      },
    })

    const after = await prisma.websitePage.update({
      where: { id: pageId },
      data: {
        publishedBuilderData: before.draftBuilderData,
        status: 'published',
        publishedAt: new Date(),
        updatedById: actorId ?? null,
      },
    })

    await prisma.websitePublishedRender.upsert({
      where: { siteId_path: { siteId: after.siteId, path: after.routePath } },
      create: {
        companyId,
        siteId: after.siteId,
        sourceType: 'page',
        sourceId: pageId,
        path: after.routePath,
        statusCode: 200,
        publishedAt: new Date(),
      },
      update: {
        sourceId: pageId,
        sourceType: 'page',
        statusCode: 200,
        publishedAt: new Date(),
      },
    })

    await prisma.auditLog.create({
      data: {
        actorId: actorId ?? null,
        moduleKey: 'atlas.website',
        entityType: 'website.page',
        entityId: pageId,
        action: 'page.publish',
        before: JSON.stringify({ status: before.status }),
        after:  JSON.stringify({ status: 'published', publishedAt: after.publishedAt }),
      },
    })
    return after
  }

  async function softDeletePage({ companyId, pageId, actorId }) {
    const before = await getPage({ companyId, pageId })
    await prisma.websitePage.update({
      where: { id: pageId },
      data: { enabled: false },
    })
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
    return prisma.websiteTheme.findMany({
      where: { companyId, siteId, enabled: true },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
      select: { id: true, name: true, isDefault: true, tokens: true, typography: true, layout: true, customCss: true },
    })
  }

  async function listMenus({ companyId, siteId }) {
    return prisma.$queryRaw`
      SELECT m.id, m.name, m.location,
        COALESCE(
          json_agg(
            json_build_object(
              'id', mi.id, 'label', mi.label, 'url', mi.url,
              'page_id', mi.page_id, 'target', mi.target,
              'sort_order', mi.sort_order, 'parent_id', mi.parent_id,
              'icon', mi.icon
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

  async function createMenu({ companyId, siteId, data }) {
    return prisma.websiteMenu.create({
      data: { companyId, siteId, name: data.name, location: data.location ?? 'header' },
    })
  }

  async function updateMenu({ companyId, menuId, data }) {
    const menu = await prisma.websiteMenu.findFirst({ where: { id: menuId, companyId } })
    if (!menu) throw notFound('Menu')
    return prisma.websiteMenu.update({ where: { id: menuId }, data })
  }

  async function softDeleteMenu({ companyId, menuId }) {
    const menu = await prisma.websiteMenu.findFirst({ where: { id: menuId, companyId } })
    if (!menu) throw notFound('Menu')
    return prisma.websiteMenu.update({ where: { id: menuId }, data: { enabled: false } })
  }

  async function createMenuItem({ companyId, menuId, data }) {
    const menu = await prisma.websiteMenu.findFirst({ where: { id: menuId, companyId } })
    if (!menu) throw notFound('Menu')
    return prisma.websiteMenuItem.create({
      data: {
        companyId,
        menuId,
        label:     data.label,
        url:       data.url ?? null,
        pageId:    data.pageId ?? null,
        parentId:  data.parentId ?? null,
        target:    data.target ?? '_self',
        icon:      data.icon ?? null,
        sortOrder: data.sortOrder ?? 0,
      },
    })
  }

  async function updateMenuItem({ companyId, itemId, data }) {
    const item = await prisma.websiteMenuItem.findFirst({ where: { id: itemId, companyId } })
    if (!item) throw notFound('Elemento de menu')
    return prisma.websiteMenuItem.update({ where: { id: itemId }, data })
  }

  async function softDeleteMenuItem({ companyId, itemId }) {
    const item = await prisma.websiteMenuItem.findFirst({ where: { id: itemId, companyId } })
    if (!item) throw notFound('Elemento de menu')
    return prisma.websiteMenuItem.update({ where: { id: itemId }, data: { enabled: false } })
  }

  async function reorderMenuItems({ companyId, items }) {
    return prisma.$transaction(
      items.map(({ id, sortOrder }) =>
        prisma.websiteMenuItem.update({ where: { id, companyId }, data: { sortOrder } })
      )
    )
  }

  async function getTheme({ companyId, themeId }) {
    return prisma.websiteTheme.findFirst({ where: { id: themeId, companyId, enabled: true } })
  }

  async function createTheme({ companyId, siteId, data }) {
    if (data.isDefault) {
      await prisma.websiteTheme.updateMany({
        where: { companyId, siteId },
        data: { isDefault: false },
      })
    }
    return prisma.websiteTheme.create({
      data: {
        companyId,
        siteId,
        name:      data.name,
        tokens:    data.tokens    ?? {},
        typography:data.typography ?? {},
        layout:    data.layout    ?? {},
        customCss: data.customCss ?? null,
        isDefault: data.isDefault ?? false,
      },
    })
  }

  async function updateTheme({ companyId, themeId, data }) {
    const theme = await prisma.websiteTheme.findFirst({ where: { id: themeId, companyId } })
    if (!theme) throw notFound('Tema')
    if (data.isDefault) {
      await prisma.websiteTheme.updateMany({
        where: { companyId, siteId: theme.siteId, id: { not: themeId } },
        data: { isDefault: false },
      })
    }
    return prisma.websiteTheme.update({ where: { id: themeId }, data })
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
    createMenu,
    updateMenu,
    softDeleteMenu,
    createMenuItem,
    updateMenuItem,
    softDeleteMenuItem,
    reorderMenuItems,
    getTheme,
    createTheme,
    updateTheme,
  }
}
