const _rc =
  (typeof window !== 'undefined' ? window.__ATLAS_RUNTIME_CONFIG__ : null) ?? {}

export const runtimeConfig = _rc

export function getApiUrl() {
  return (
    _rc.ATLAS_API_URL ||
    import.meta.env.VITE_ATLAS_API_URL ||
    'http://localhost:4010'
  )
}
