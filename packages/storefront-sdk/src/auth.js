/**
 * Factory for the sdk.auth namespace.
 * @param {{ request: Function, session: object }} deps
 * @returns {{ register, login, refresh, me, logout, getSession, onAuthStateChange }}
 */
export function createAuthNamespace({ request, session }) {
  /**
   * Register a new storefront user.
   * @param {{ email: string, password: string, name: string, role?: string }} params
   * @returns {Promise<{ id, displayName, firstName, lastName, email, phone, bio, role }>}
   */
  async function register({ email, password, name, role = 'storefront_client' }) {
    const res = await request('POST', '/public/storefront/auth/register', { email, password, name, role })
    return res.data
  }

  /**
   * Log in with email and password. Stores session internally.
   * @param {{ email: string, password: string }} params
   * @returns {Promise<{ user, token, refreshToken, expiresAt }>}
   */
  async function login({ email, password }) {
    const res = await request('POST', '/public/storefront/auth/login', { email, password })
    const { user, token, refreshToken, expiresAt } = res.data
    session.set({ user, token, refreshToken, expiresAt })
    return res.data
  }

  /**
   * Refresh the access token using the stored refreshToken.
   * @returns {Promise<{ token, refreshToken, expiresAt }>}
   */
  async function refresh() {
    const current = session.get()
    if (!current?.refreshToken) throw new Error('No hay sesión activa para refrescar')
    const res = await request('POST', '/public/storefront/auth/refresh', { refreshToken: current.refreshToken })
    const { token, refreshToken, expiresAt } = res.data
    session.set({ ...current, token, refreshToken, expiresAt })
    return res.data
  }

  /**
   * Fetch the authenticated user's profile.
   * @returns {Promise<{ id, displayName, firstName, lastName, email, phone, bio, role }>}
   */
  async function me() {
    const res = await request('GET', '/public/storefront/auth/me')
    return res.data
  }

  /**
   * Log out and clear the stored session.
   * @returns {Promise<void>}
   */
  async function logout() {
    await request('POST', '/public/storefront/auth/logout')
    session.clear()
  }

  /**
   * Get current session synchronously.
   * @returns {{ user, token, refreshToken, expiresAt }|null}
   */
  function getSession() {
    return session.get()
  }

  /**
   * Subscribe to session changes.
   * @param {function} fn - Called with session or null on every change
   * @returns {function} Unsubscribe function
   */
  function onAuthStateChange(fn) {
    return session.subscribe(fn)
  }

  return { register, login, refresh, me, logout, getSession, onAuthStateChange }
}
