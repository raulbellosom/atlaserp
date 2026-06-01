import { StorefrontError } from './storefront-error.js'
import { createRequestCore } from './core/request.js'
import { createSessionStore } from './core/session.js'
import { createAuthNamespace } from './auth.js'
import { createFilesNamespace } from './files.js'
import { createCatalogNamespace } from './catalog.js'
import { createDiscoveryNamespace } from './discovery.js'
import { createRealtimeNamespace } from './realtime.js'

export { StorefrontError }

export function createStorefrontClient({ baseUrl, company, onSessionChange, initialSession }) {
  if (!baseUrl) throw new Error('createStorefrontClient: baseUrl es requerido')
  if (!company) throw new Error('createStorefrontClient: company es requerido')

  const session = createSessionStore({ initialSession, onSessionChange })

  const _request = createRequestCore({
    baseUrl,
    company,
    getSession: () => session.get(),
  })

  async function request(method, path, body = null, options = {}) {
    return _request(method, path, body, options)
  }

  const auth = createAuthNamespace({ request: _request, session })
  const files = createFilesNamespace({ request: _request })
  const catalog = createCatalogNamespace({ request: _request })
  const discovery = createDiscoveryNamespace({ request: _request })
  const realtime = createRealtimeNamespace({ request: _request })

  return Object.freeze({ auth, files, catalog, discovery, realtime, request })
}
