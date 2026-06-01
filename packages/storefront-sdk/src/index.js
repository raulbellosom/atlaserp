import { StorefrontError } from './storefront-error.js'
import { createRequestCore } from './core/request.js'
import { createSessionStore } from './core/session.js'
import { createAuthNamespace } from './auth.js'
import { createFilesNamespace } from './files.js'
import { createCatalogNamespace } from './catalog.js'
import { createDiscoveryNamespace } from './discovery.js'
import { createRealtimeNamespace } from './realtime.js'

export { StorefrontError }

/**
 * Create a stateful storefront SDK client instance.
 *
 * One instance per app. The client manages auth state in memory.
 * Persist session across page loads via `onSessionChange` + `initialSession`.
 *
 * @param {object} options
 * @param {string} options.baseUrl - ERP instance URL (e.g. 'https://erp.acme.mx')
 * @param {string} options.company - Company slug registered in the ERP
 * @param {function} [options.onSessionChange] - Called with session object on login/logout. Use to persist to localStorage.
 * @param {object|null} [options.initialSession] - Previously persisted session to restore on init.
 * @returns {{ auth, files, catalog, discovery, realtime, request }} Frozen SDK client
 *
 * @example
 * const sdk = createStorefrontClient({
 *   baseUrl: 'https://erp.acme.mx',
 *   company: 'acme',
 *   onSessionChange: (s) => localStorage.setItem('sf', JSON.stringify(s)),
 *   initialSession: JSON.parse(localStorage.getItem('sf') ?? 'null'),
 * })
 */
export function createStorefrontClient({ baseUrl, company, onSessionChange, initialSession }) {
  if (!baseUrl) throw new Error('createStorefrontClient: baseUrl es requerido')
  if (!company) throw new Error('createStorefrontClient: company es requerido')

  const session = createSessionStore({ initialSession, onSessionChange })

  const _request = createRequestCore({
    baseUrl,
    company,
    getSession: () => session.get(),
  })

  async function _requestWithRefresh(method, path, body = null, options = {}) {
    try {
      return await _request(method, path, body, options)
    } catch (err) {
      const current = session.get()
      if (
        err?.code === 'UNAUTHORIZED' &&
        current?.refreshToken &&
        !options._retry
      ) {
        try {
          const refreshRes = await _request(
            'POST',
            '/public/storefront/auth/refresh',
            { refreshToken: current.refreshToken },
            { _retry: true }
          )
          const { token, refreshToken, expiresAt } = refreshRes.data
          session.set({ ...current, token, refreshToken, expiresAt })
          return await _request(method, path, body, { ...options, _retry: true })
        } catch {
          session.clear()
          throw err
        }
      }
      throw err
    }
  }

  const auth = createAuthNamespace({ request: _requestWithRefresh, session })
  const files = createFilesNamespace({ request: _requestWithRefresh })
  const catalog = createCatalogNamespace({ request: _requestWithRefresh })
  const discovery = createDiscoveryNamespace({ request: _requestWithRefresh })
  const realtime = createRealtimeNamespace({ request: _requestWithRefresh })

  async function request(method, path, body = null, options = {}) {
    return _requestWithRefresh(method, path, body, options)
  }

  return Object.freeze({ auth, files, catalog, discovery, realtime, request })
}
