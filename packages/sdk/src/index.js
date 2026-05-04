export function createAtlasClient({ baseUrl }) {
  async function request(path, options = {}) {
    const isFormData = options.body instanceof FormData
    let response
    try {
      response = await fetch(`${baseUrl}${path}`, {
        headers: isFormData
          ? (options.headers ?? {})
          : { 'Content-Type': 'application/json', ...(options.headers ?? {}) },
        ...options
      })
    } catch {
      throw new Error(`No se pudo conectar con la API (${baseUrl}). Verifica que el backend esté corriendo (tip: ejecuta "pnpm start").`)
    }
    if (!response.ok) {
      const text = await response.text()
      let parsedError = ''
      try {
        const parsed = JSON.parse(text)
        parsedError = parsed?.error ?? ''
      } catch {
        // Fall through to plain-text fallback.
      }
      throw new Error(parsedError || text || `Atlas API error ${response.status}`)
    }
    return response.json()
  }

  return {
    health: () => request('/health'),
    instance: {
      status: () => request('/instance/status')
    },
    setup: {
      initialize: (formData) => request('/setup/initialize', { method: 'POST', body: formData })
    },
    auth: {
      me: (token) => request('/user/me', { headers: { Authorization: `Bearer ${token}` } })
    },
    modules: {
      list: () => request('/modules'),
      install: (manifest) => request('/modules/install', { method: 'POST', body: JSON.stringify({ manifest }) }),
      uninstall: (key) => request(`/modules/${encodeURIComponent(key)}`, { method: 'DELETE' })
    },
    blueprints: {
      list: () => request('/blueprints')
    },
    contacts: {
      list: () => request('/contacts'),
      create: (data) => request('/contacts', { method: 'POST', body: JSON.stringify(data) })
    },
    branding: {
      get: (token) => request('/branding', { headers: { Authorization: `Bearer ${token}` } })
    },
    memberships: {
      me: (token) => request('/memberships/me', { headers: { Authorization: `Bearer ${token}` } })
    },
    notifications: {
      list: (token, params = {}) => {
        const qs = new URLSearchParams(params).toString()
        return request(`/notifications${qs ? `?${qs}` : ''}`, { headers: { Authorization: `Bearer ${token}` } })
      },
      markRead: (token, id) =>
        request(`/notifications/${encodeURIComponent(id)}/read`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } }),
      markAllRead: (token) =>
        request('/notifications/read-all', { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
    }
  }
}
