export function createAtlasClient({ baseUrl }) {
  async function request(path, options = {}) {
    const response = await fetch(`${baseUrl}${path}`, {
      headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) },
      ...options
    })
    if (!response.ok) {
      const text = await response.text()
      throw new Error(text || `Atlas API error ${response.status}`)
    }
    return response.json()
  }

  return {
    health: () => request('/health'),
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
    }
  }
}
