import { createAtlasClient } from '@runly/sdk'
import { getApiUrl, setApiUrl } from './runtimeConfig.js'

let currentAtlasClient = null

// Must match ActiveCompanyProvider.jsx's STORAGE_KEY — duplicated rather than
// imported to avoid a circular import (that file already imports this one).
const ACTIVE_COMPANY_STORAGE_KEY = 'runly-active-company'
// Pre-rebrand key. Read-only fallback here (no write/migration): this file
// only seeds the initial in-memory value before React mounts.
// ActiveCompanyProvider.jsx owns the actual one-time migration on read.
const LEGACY_ACTIVE_COMPANY_STORAGE_KEY = 'atlas-active-company'

function readPersistedCompanyId() {
  try {
    if (typeof localStorage === 'undefined') return null
    return (
      localStorage.getItem(ACTIVE_COMPANY_STORAGE_KEY) ??
      localStorage.getItem(LEGACY_ACTIVE_COMPANY_STORAGE_KEY)
    )
  } catch {
    return null
  }
}

// Module-level ref, not React state: the SDK client is a plain singleton
// created outside any component, so it needs a stable getter it can call on
// every request rather than a value baked in at construction time. Plan 2's
// ActiveCompanyProvider calls setActiveCompanyId() whenever the user switches
// companies; this file has no React/company-list knowledge of its own.
// See docs/superpowers/specs/2026-09-10-multi-tenant-architecture-design.md §6.1
//
// Seeded from localStorage (not hardcoded null): in dev, a Vite HMR reload of
// this file — or of anything importing it, which is nearly every screen —
// re-runs this top-level code with a fresh `let`, wiping the in-memory value
// while ActiveCompanyProvider's React state (and its effect that would
// normally call setActiveCompanyId again) is untouched and never refires.
// That silently dropped X-Atlas-Company-Id from every request until a full
// reload or a company switch, surfacing as random company_required errors.
// Reading the persisted value back on every module (re-)eval self-heals it.
let _activeCompanyId = readPersistedCompanyId()

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
