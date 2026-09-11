import { createAtlasClient } from '@atlas/sdk'
import { getApiUrl, setApiUrl } from './runtimeConfig.js'

let currentAtlasClient = null

// Module-level ref, not React state: the SDK client is a plain singleton
// created outside any component, so it needs a stable getter it can call on
// every request rather than a value baked in at construction time. Plan 2's
// ActiveCompanyProvider calls setActiveCompanyId() whenever the user switches
// companies; this file has no React/company-list knowledge of its own.
// See docs/superpowers/specs/2026-09-10-multi-tenant-architecture-design.md §6.1
let _activeCompanyId = null

export function setActiveCompanyId(companyId) {
  _activeCompanyId = companyId || null
}

export function getActiveCompanyId() {
  return _activeCompanyId
}

export function initAtlasClient(url) {
  if (url) {
    setApiUrl(url)
  }
  currentAtlasClient = createAtlasClient({ baseUrl: getApiUrl(), getActiveCompanyId })
  return currentAtlasClient
}

export function getAtlasClient() {
  if (!currentAtlasClient) {
    currentAtlasClient = createAtlasClient({ baseUrl: getApiUrl(), getActiveCompanyId })
  }
  return currentAtlasClient
}

export const atlas = new Proxy(
  {},
  {
    get(_target, prop) {
      return Reflect.get(getAtlasClient(), prop)
    },
  },
)
