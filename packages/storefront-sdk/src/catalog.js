function toQueryString(params) {
  if (!params) return ''
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) p.set(k, String(v))
  }
  const s = p.toString()
  return s ? `?${s}` : ''
}

export function createCatalogNamespace({ request }) {
  async function products(options = {}) {
    const res = await request('GET', `/public/catalog/products${toQueryString(options)}`)
    return res
  }

  async function getProduct(id) {
    const res = await request('GET', `/public/catalog/products/${encodeURIComponent(id)}`)
    return res.data
  }

  async function categories(options = {}) {
    const res = await request('GET', `/public/catalog/categories${toQueryString(options)}`)
    return res
  }

  return { products, getProduct, categories }
}
