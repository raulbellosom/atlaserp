export function createStorefrontMiddleware({ prisma, supabaseAdmin }) {
  async function getRegistrableRoles() {
    const config = await prisma.instanceConfig.findUnique({
      where: { key: 'storefront.registrable_roles' },
    })
    if (!config) return ['storefront_client', 'storefront_vendor']
    try { return JSON.parse(config.value) } catch { return [] }
  }

  async function _baseAuthMiddleware(c, next, { requireStorefrontRole }) {
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

    let membership
    if (requireStorefrontRole) {
      const allowedRoles = await getRegistrableRoles()
      membership = profile.memberships.find(
        m => m.role != null && m.company.slug === companySlug && allowedRoles.includes(m.role.key)
      )
    } else {
      // Exact slug match first; fall back to any active membership so ERP admin
      // users can reach /me even when the company slug differs from the header.
      membership = profile.memberships.find(
        m => m.role != null && m.company.slug === companySlug
      ) ?? profile.memberships.find(m => m.role != null)
    }

    if (!membership) {
      return c.json({ error: 'Sin membresía en esta empresa' }, 403)
    }

    c.set('storefrontUser', { profile, membership, role: membership.role, companySlug })
    await next()
  }

  // Requires the user to have a storefront role (storefront_client, storefront_vendor).
  function storefrontAuthMiddleware(c, next) {
    return _baseAuthMiddleware(c, next, { requireStorefrontRole: true })
  }

  // Accepts any authenticated user with an active membership — used for /me.
  function anyAuthMiddleware(c, next) {
    return _baseAuthMiddleware(c, next, { requireStorefrontRole: false })
  }

  return { storefrontAuthMiddleware, anyAuthMiddleware }
}
