import { createClient } from '@supabase/supabase-js'
import { StorefrontError } from './storefront-error.js'
import { createRequestCore } from './core/request.js'
import { createSupabaseSessionAdapter } from './core/session.js'
import { createAuthNamespace } from './auth.js'
import { createFilesNamespace } from './files.js'
import { createCatalogNamespace } from './catalog.js'
import { createDiscoveryNamespace } from './discovery.js'
import { createRealtimeNamespace } from './realtime.js'
import { createAnalyticsNamespace } from './analytics.js'
import { createFormsNamespace } from './forms.js'

export { StorefrontError }

/**
 * @param {object} options
 * @param {string} options.baseUrl        - Atlas ERP instance URL
 * @param {string} options.company        - Company slug (sent as X-Atlas-Company on every request)
 * @param {string} options.supabaseUrl    - Supabase project URL (window.ATLAS_CONFIG.supabaseUrl in production)
 * @param {string} options.supabaseAnonKey - Supabase anon key (window.ATLAS_CONFIG.supabaseAnonKey in production)
 * @param {string} [options.siteId]       - Website site ID for analytics and public forms
 * @param {function} [options.onSessionChange] - Called with session or null on every auth state change
 * @returns {{ auth, files, catalog, discovery, realtime, analytics, forms, request }}
 *
 * @example
 * const cfg = (typeof window !== 'undefined' && window.ATLAS_CONFIG) ? window.ATLAS_CONFIG : {}
 * const sdk = createStorefrontClient({
 *   baseUrl:         cfg.apiUrl         ?? import.meta.env.VITE_ERP_URL,
 *   company:         cfg.company         ?? import.meta.env.VITE_ERP_COMPANY,
 *   supabaseUrl:     cfg.supabaseUrl     ?? import.meta.env.VITE_SUPABASE_URL,
 *   supabaseAnonKey: cfg.supabaseAnonKey ?? import.meta.env.VITE_SUPABASE_ANON_KEY,
 * })
 */
export function createStorefrontClient({
  baseUrl,
  company,
  siteId,
  supabaseUrl,
  supabaseAnonKey,
  onSessionChange,
}) {
  if (!baseUrl)         throw new Error('createStorefrontClient: baseUrl es requerido')
  if (!company)         throw new Error('createStorefrontClient: company es requerido')
  if (!supabaseUrl)     throw new Error('createStorefrontClient: supabaseUrl es requerido')
  if (!supabaseAnonKey) throw new Error('createStorefrontClient: supabaseAnonKey es requerido')

  const supabase = createClient(supabaseUrl, supabaseAnonKey)

  const session = createSupabaseSessionAdapter({ supabase, onSessionChange })

  const _request = createRequestCore({
    baseUrl,
    company,
    getSession: () => session.get(),
  })

  // Shared promise to deduplicate concurrent refresh attempts
  let _refreshPromise = null

  async function _doRefreshOnce() {
    if (_refreshPromise) return _refreshPromise
    const current = session.get()
    if (!current?.refreshToken) return { data: {}, error: new Error('no refresh token') }
    _refreshPromise = supabase.auth.refreshSession({ refresh_token: current.refreshToken })
      .finally(() => { _refreshPromise = null })
    return _refreshPromise
  }

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
        const { data, error } = await _doRefreshOnce().catch(() => ({ data: null, error: true }))
        if (error || !data?.session || !session.get()) {
          try { await supabase.auth.signOut() } catch { /* best-effort */ }
          throw err
        }
        return _request(method, path, body, { ...options, _retry: true })
      }
      throw err
    }
  }

  const auth      = createAuthNamespace({ supabase, request: _requestWithRefresh, session })
  const files     = createFilesNamespace({ request: _requestWithRefresh })
  const catalog   = createCatalogNamespace({ request: _requestWithRefresh })
  const discovery = createDiscoveryNamespace({ request: _requestWithRefresh })
  const realtime  = createRealtimeNamespace({ request: _requestWithRefresh })
  const resolvedSiteId =
    siteId ??
    (typeof window !== 'undefined' ? window.ATLAS_CONFIG?.siteId : null)
  const analytics = createAnalyticsNamespace({
    request: _requestWithRefresh,
    baseUrl,
    company,
    siteId: resolvedSiteId,
  })
  const forms = createFormsNamespace({
    request: _requestWithRefresh,
    siteId: resolvedSiteId,
    analytics,
    getAnalyticsContext: () => analytics._getContext(),
  })

  async function request(method, path, body = null, options = {}) {
    return _requestWithRefresh(method, path, body, options)
  }

  return Object.freeze({
    auth,
    files,
    catalog,
    discovery,
    realtime,
    analytics,
    forms,
    request,
  })
}
