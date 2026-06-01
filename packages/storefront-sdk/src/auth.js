export function createAuthNamespace({ request, session }) {
  async function register({ email, password, name, role = 'storefront_client' }) {
    const res = await request('POST', '/public/storefront/auth/register', { email, password, name, role })
    return res.data
  }

  async function login({ email, password }) {
    const res = await request('POST', '/public/storefront/auth/login', { email, password })
    const { user, token, refreshToken, expiresAt } = res.data
    session.set({ user, token, refreshToken, expiresAt })
    return res.data
  }

  async function refresh() {
    const current = session.get()
    if (!current?.refreshToken) throw new Error('No hay sesión activa para refrescar')
    const res = await request('POST', '/public/storefront/auth/refresh', { refreshToken: current.refreshToken })
    const { token, refreshToken, expiresAt } = res.data
    session.set({ ...current, token, refreshToken, expiresAt })
    return res.data
  }

  async function me() {
    const res = await request('GET', '/public/storefront/auth/me')
    return res.data
  }

  async function logout() {
    await request('POST', '/public/storefront/auth/logout')
    session.clear()
  }

  function getSession() {
    return session.get()
  }

  function onAuthStateChange(fn) {
    return session.subscribe(fn)
  }

  return { register, login, refresh, me, logout, getSession, onAuthStateChange }
}
