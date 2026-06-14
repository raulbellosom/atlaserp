export function validateRegistrableRole(role, allowedRoles) {
  if (!role || !Array.isArray(allowedRoles) || allowedRoles.length === 0) return false
  return allowedRoles.includes(role)
}

export function buildStorefrontUserProfile(profile, role) {
  return {
    id: profile.id,
    displayName: profile.displayName,
    firstName: profile.firstName,
    lastName: profile.lastName,
    email: profile.email,
    phone: profile.phone ?? null,
    bio: profile.bio ?? null,
    role: role.key,
  }
}

export function createStorefrontAuthService({ prisma, supabaseAdmin, supabaseAnon }) {
  async function getRegistrableRoles() {
    const config = await prisma.instanceConfig.findUnique({
      where: { key: 'storefront.registrable_roles' },
    })
    if (!config) return ['storefront_client', 'storefront_vendor']
    try { return JSON.parse(config.value) } catch { return [] }
  }

  async function register({ email, password, name, role, companySlug }) {
    const allowedRoles = await getRegistrableRoles()
    if (!validateRegistrableRole(role, allowedRoles)) {
      throw Object.assign(new Error('Rol no permitido para registro'), { code: 'FORBIDDEN', status: 403 })
    }

    const company = await prisma.company.findUnique({ where: { slug: companySlug } })
    if (!company) {
      throw Object.assign(new Error('Empresa no encontrada'), { code: 'NOT_FOUND', status: 404 })
    }

    const dbRole = await prisma.role.findUnique({ where: { key: role } })
    if (!dbRole) {
      throw Object.assign(new Error('Rol no existe en el sistema'), { code: 'NOT_FOUND', status: 404 })
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
    if (authError) {
      const isDuplicate = authError.message?.toLowerCase().includes('already')
      throw Object.assign(new Error(isDuplicate ? 'El correo ya está registrado' : authError.message), {
        code: isDuplicate ? 'VALIDATION_ERROR' : 'UNKNOWN',
        status: isDuplicate ? 422 : 500,
      })
    }

    const authUserId = authData.user.id
    try {
      const profile = await prisma.userProfile.create({
        data: {
          authUserId,
          displayName: name,
          firstName: name.split(' ')[0] ?? name,
          lastName: name.split(' ').slice(1).join(' ') || '',
          email,
        },
      })
      await prisma.membership.create({
        data: { userId: profile.id, companyId: company.id, roleId: dbRole.id },
      })
      return buildStorefrontUserProfile(profile, dbRole)
    } catch (err) {
      await supabaseAdmin.auth.admin.deleteUser(authUserId).catch(() => {})
      throw Object.assign(new Error('Error al crear el perfil'), { code: 'UNKNOWN', status: 500 })
    }
  }

  async function login({ email, password, companySlug }) {
    const { data, error } = await supabaseAnon.auth.signInWithPassword({ email, password })
    if (error) {
      throw Object.assign(new Error('Credenciales incorrectas'), { code: 'UNAUTHORIZED', status: 401 })
    }

    const profile = await prisma.userProfile.findUnique({
      where: { email },
      include: {
        memberships: {
          where: { enabled: true },
          include: { role: true, company: { select: { slug: true } } },
        },
      },
    })
    if (!profile) {
      throw Object.assign(new Error('Perfil no encontrado'), { code: 'NOT_FOUND', status: 404 })
    }

    const allowedRoles = await getRegistrableRoles()
    const membership = profile.memberships.find(
      m => m.role != null && m.company.slug === companySlug && allowedRoles.includes(m.role.key)
    )
    if (!membership) {
      throw Object.assign(new Error('Sin acceso a esta plataforma'), { code: 'FORBIDDEN', status: 403 })
    }

    return {
      user: buildStorefrontUserProfile(profile, membership.role),
      token: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresAt: data.session.expires_at,
    }
  }

  async function me(authUserId, companySlug) {
    const profile = await prisma.userProfile.findUnique({
      where: { authUserId },
      include: {
        memberships: {
          where: { enabled: true },
          include: { role: true, company: { select: { slug: true } } },
        },
      },
    })
    if (!profile) {
      throw Object.assign(new Error('Perfil no encontrado'), { code: 'NOT_FOUND', status: 404 })
    }
    // Find membership for this company regardless of role (ERP users are welcome)
    const membership = profile.memberships.find(
      m => m.role != null && m.company.slug === companySlug
    )
    if (!membership) {
      throw Object.assign(new Error('Sin membresía en esta empresa'), { code: 'FORBIDDEN', status: 403 })
    }
    return buildStorefrontUserProfile(profile, membership.role)
  }

  async function refresh(refreshToken) {
    const { data, error } = await supabaseAnon.auth.refreshSession({ refresh_token: refreshToken })
    if (error) {
      throw Object.assign(new Error('Token de refresco inválido'), { code: 'UNAUTHORIZED', status: 401 })
    }
    return {
      token: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresAt: data.session.expires_at,
    }
  }

  async function logout(token) {
    if (token) {
      const { data } = await supabaseAdmin.auth.getUser(token).catch(() => ({ data: {} }))
      const userId = data?.user?.id
      if (userId) {
        await supabaseAdmin.auth.admin.signOut(userId).catch(() => {})
      }
    }
    return { success: true }
  }

  return { register, login, me, refresh, logout }
}
