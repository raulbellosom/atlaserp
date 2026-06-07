const _rc =
  (typeof window !== 'undefined' ? window.__ATLAS_RUNTIME_CONFIG__ : null) ?? {}
const _viteEnv =
  typeof import.meta !== 'undefined' && import.meta?.env ? import.meta.env : {}

export const runtimeConfig = _rc

export function getConfiguredApiUrl() {
  return _rc.ATLAS_API_URL || _viteEnv.VITE_ATLAS_API_URL || ''
}

function normalizeApiUrl(url) {
  const raw = String(url ?? '').trim()
  return raw.replace(/\/+$/, '')
}

let currentApiUrl =
  normalizeApiUrl(getConfiguredApiUrl()) || 'http://localhost:4010'

export function getApiUrl() {
  return currentApiUrl
}

export function setApiUrl(url) {
  const normalizedUrl = normalizeApiUrl(url)
  if (normalizedUrl) {
    currentApiUrl = normalizedUrl
  }
}

export function clearApiUrl() {
  currentApiUrl =
    normalizeApiUrl(getConfiguredApiUrl()) || 'http://localhost:4010'
}
