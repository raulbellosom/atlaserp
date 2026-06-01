export function createStorefrontMiddleware({ prisma, supabaseAdmin }) {
  async function getRegistrableRoles() {
    const config = await prisma.instanceConfig.findUnique({
      where: { key: 'storefront.registrable_roles' },
    })
    if (!config) return ['storefront_client', 'storefront_vendor']
    try { return JSON.parse(config.value) } catch { return [] }
  }

  async function storefrontAuthMiddleware(c, next) {
    const authHeader = c.req.header('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ error: 'No autorizado' }, 401)
    }
    const token = authHeader.replace('Bearer ', '')

    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
    if (error || !user) {
      return c.json({ error: 'Token inválido o expirado' }, 401)
    }

    const companySlug = c.req.header('X-Atlas-Company')
    if (!companySlug) {
      return c.json({ error: 'Cabecera X-Atlas-Company requerida' }, 400)
    }

    const profile = await prisma.userProfile.findUnique({
      where: { authUserId: user.id },
      include: {
        memberships: {
          where: { enabled: true },
          include: { role: true, company: { select: { id: true, slug: true } } },
        },
      },
    })
    if (!profile) {
      return c.json({ error: 'Perfil no encontrado' }, 401)
    }

    const allowedRoles = await getRegistrableRoles()
    const membership = profile.memberships.find(
      m => m.role != null && m.company.slug === companySlug && allowedRoles.includes(m.role.key)
    )
    if (!membership) {
      return c.json({ error: 'Sin acceso a esta plataforma' }, 403)
    }

    c.set('storefrontUser', { profile, membership, role: membership.role, companySlug })
    await next()
  }

  return { storefrontAuthMiddleware }
}
