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

  async function listBlogCategories({ companyId, siteId }) {
    return prisma.websiteBlogCategory.findMany({
      where: { companyId, siteId, enabled: true },
      orderBy: { name: 'asc' },
    })
  }

  async function createBlogCategory({ companyId, siteId, data }) {
    return prisma.websiteBlogCategory.create({
      data: { companyId, siteId, name: data.name, slug: data.slug, description: data.description ?? null },
    })
  }

  async function updateBlogCategory({ companyId, categoryId, data }) {
    const cat = await prisma.websiteBlogCategory.findFirst({ where: { id: categoryId, companyId } })
    if (!cat) throw notFound('Categoria')
    return prisma.websiteBlogCategory.update({ where: { id: categoryId }, data })
  }

  async function softDeleteBlogCategory({ companyId, categoryId }) {
    const cat = await prisma.websiteBlogCategory.findFirst({ where: { id: categoryId, companyId } })
    if (!cat) throw notFound('Categoria')
    return prisma.websiteBlogCategory.update({ where: { id: categoryId }, data: { enabled: false } })
  }

  async function listBlogPosts({ companyId, siteId, status, categoryId, page = 1, pageSize = 20 }) {
    const skip = (page - 1) * pageSize
    const where = {
      companyId,
      siteId,
      enabled: true,
      ...(status     && { status }),
      ...(categoryId && { categoryId }),
    }
    const [data, total] = await Promise.all([
      prisma.websiteBlogPost.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: { category: { select: { id: true, name: true } } },
      }),
      prisma.websiteBlogPost.count({ where }),
    ])
    return { data, total, page, pageSize }
  }

  async function getBlogPost({ companyId, postId }) {
    const post = await prisma.websiteBlogPost.findFirst({
      where: { id: postId, companyId, enabled: true },
      include: { category: true },
    })
    if (!post) throw notFound('Entrada de blog')
    return post
  }

  async function createBlogPost({ companyId, siteId, data, actorId }) {
    return prisma.websiteBlogPost.create({
      data: {
        companyId, siteId,
        title:        data.title,
        slug:         data.slug,
        categoryId:   data.categoryId ?? null,
        excerpt:      data.excerpt ?? null,
        featuredImage:data.featuredImage ?? null,
        seo:          data.seo ?? null,
        createdById:  actorId ?? null,
      },
    })
  }

  async function updateBlogPost({ companyId, postId, data, actorId }) {
    const post = await prisma.websiteBlogPost.findFirst({ where: { id: postId, companyId } })
    if (!post) throw notFound('Entrada de blog')
    return prisma.websiteBlogPost.update({
      where: { id: postId },
      data: { ...data, updatedById: actorId ?? null },
    })
  }

  async function saveBlogDraft({ companyId, postId, builderData, seo }) {
    const post = await prisma.websiteBlogPost.findFirst({ where: { id: postId, companyId } })
    if (!post) throw notFound('Entrada de blog')
    return prisma.websiteBlogPost.update({
      where: { id: postId },
      data: { draftBuilderData: builderData, ...(seo && { seo }) },
    })
  }

  async function publishBlogPost({ companyId, postId, actorId }) {
    const post = await prisma.websiteBlogPost.findFirst({ where: { id: postId, companyId } })
    if (!post) throw notFound('Entrada de blog')
    const updated = await prisma.websiteBlogPost.update({
      where: { id: postId },
      data: {
        status:              'published',
        publishedBuilderData: post.draftBuilderData,
        publishedAt:         new Date(),
        updatedById:         actorId ?? null,
      },
    })
    const site = await prisma.websiteSite.findFirst({ where: { id: post.siteId } })
    if (site) {
      await prisma.websitePublishedRender.upsert({
        where:  { siteId_path: { siteId: site.id, path: `/blog/${post.slug}` } },
        update: { updatedAt: new Date() },
        create: { companyId, siteId: site.id, sourceType: 'blog_post', sourceId: postId, path: `/blog/${post.slug}` },
      })
    }
    return updated
  }

  async function softDeleteBlogPost({ companyId, postId }) {
    const post = await prisma.websiteBlogPost.findFirst({ where: { id: postId, companyId } })
    if (!post) throw notFound('Entrada de blog')
    return prisma.websiteBlogPost.update({ where: { id: postId }, data: { enabled: false } })
  }

  async function listForms({ companyId, siteId }) {
    return prisma.websiteForm.findMany({
      where: { companyId, siteId, enabled: true },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { fields: true, submissions: true } } },
    })
  }

  async function getForm({ companyId, formId }) {
    const form = await prisma.websiteForm.findFirst({
      where: { id: formId, companyId, enabled: true },
      include: { fields: { where: { enabled: true }, orderBy: { sortOrder: 'asc' } } },
    })
    if (!form) throw notFound('Formulario')
    return form
  }

  async function createForm({ companyId, siteId, data }) {
    return prisma.websiteForm.create({
      data: {
        companyId, siteId,
        name:           data.name,
        description:    data.description ?? null,
        submitLabel:    data.submitLabel ?? 'Enviar',
        successMessage: data.successMessage ?? null,
        notifyEmail:    data.notifyEmail ?? null,
      },
    })
  }

  async function updateForm({ companyId, formId, data }) {
    const form = await prisma.websiteForm.findFirst({ where: { id: formId, companyId } })
    if (!form) throw notFound('Formulario')
    return prisma.websiteForm.update({ where: { id: formId }, data })
  }

  async function softDeleteForm({ companyId, formId }) {
    const form = await prisma.websiteForm.findFirst({ where: { id: formId, companyId } })
    if (!form) throw notFound('Formulario')
    return prisma.websiteForm.update({ where: { id: formId }, data: { enabled: false } })
  }

  async function createFormField({ companyId, formId, data }) {
    const form = await prisma.websiteForm.findFirst({ where: { id: formId, companyId } })
    if (!form) throw notFound('Formulario')
    return prisma.websiteFormField.create({
      data: {
        companyId, formId,
        label:       data.label,
        name:        data.name,
        fieldType:   data.fieldType ?? 'text',
        placeholder: data.placeholder ?? null,
        required:    data.required ?? false,
        options:     data.options ?? null,
        sortOrder:   data.sortOrder ?? 0,
      },
    })
  }

  async function updateFormField({ companyId, fieldId, data }) {
    const field = await prisma.websiteFormField.findFirst({ where: { id: fieldId, companyId } })
    if (!field) throw notFound('Campo')
    return prisma.websiteFormField.update({ where: { id: fieldId }, data })
  }

  async function softDeleteFormField({ companyId, fieldId }) {
    const field = await prisma.websiteFormField.findFirst({ where: { id: fieldId, companyId } })
    if (!field) throw notFound('Campo')
    return prisma.websiteFormField.update({ where: { id: fieldId }, data: { enabled: false } })
  }

  async function reorderFormFields({ companyId, items }) {
    return prisma.$transaction(
      items.map(({ id, sortOrder }) =>
        prisma.websiteFormField.update({ where: { id, companyId }, data: { sortOrder } })
      )
    )
  }

  async function listSubmissions({ companyId, formId, page = 1, pageSize = 20 }) {
    const skip = (page - 1) * pageSize
    const where = { formId, companyId }
    const [data, total] = await Promise.all([
      prisma.websiteFormSubmission.findMany({ where, orderBy: { submittedAt: 'desc' }, skip, take: pageSize }),
      prisma.websiteFormSubmission.count({ where }),
    ])
    return { data, total, page, pageSize }
  }

  async function deleteSubmission({ companyId, submissionId }) {
    const sub = await prisma.websiteFormSubmission.findFirst({ where: { id: submissionId, companyId } })
    if (!sub) throw notFound('Envio')
    return prisma.websiteFormSubmission.delete({ where: { id: submissionId } })
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
    listBlogCategories,
    createBlogCategory,
    updateBlogCategory,
    softDeleteBlogCategory,
    listBlogPosts,
    getBlogPost,
    createBlogPost,
    updateBlogPost,
    saveBlogDraft,
    publishBlogPost,
    softDeleteBlogPost,
    listForms,
    getForm,
    createForm,
    updateForm,
    softDeleteForm,
    createFormField,
    updateFormField,
    softDeleteFormField,
    reorderFormFields,
    listSubmissions,
    deleteSubmission,
  }
}
