const BUCKET = 'atlas-website'
const ASSET_EXTENSIONS = new Set([
  'js', 'mjs', 'css', 'png', 'jpg', 'jpeg', 'webp', 'svg', 'ico',
  'woff', 'woff2', 'ttf', 'eot', 'map', 'json', 'txt', 'xml', 'pdf',
])
const HTML_CACHE = new Map()
const HTML_CACHE_TTL = 5 * 60 * 1000
const HTML_CACHE_MAX = 500

export function isAssetPath(urlPath) {
  const lastSegment = urlPath.split('/').pop() ?? ''
  const dot = lastSegment.lastIndexOf('.')
  if (dot === -1) return false
  const ext = lastSegment.slice(dot + 1).toLowerCase()
  return ASSET_EXTENSIONS.has(ext)
}

export function resolveHtmlCandidates(companySlug, urlPath) {
  const clean = urlPath.replace(/^\/+/, '').replace(/\/+$/, '')
  const base = `dist/${companySlug}/`
  const fallback = `${base}index.html`
  if (!clean) return [fallback, fallback, fallback]
  return [
    `${base}${clean}/index.html`,
    `${base}${clean}.html`,
    fallback,
  ]
}

export function injectSeoTags(html, seoDefaults) {
  if (!seoDefaults) return html
  const tags = []

  if (seoDefaults.title && !html.includes('<title>')) {
    tags.push(`<title>${escapeHtml(seoDefaults.title)}</title>`)
  }
  if (seoDefaults.description && !html.includes('name="description"')) {
    tags.push(`<meta name="description" content="${escapeHtml(seoDefaults.description)}" />`)
  }
  if (seoDefaults.ogTitle && !html.includes('property="og:title"')) {
    tags.push(`<meta property="og:title" content="${escapeHtml(seoDefaults.ogTitle)}" />`)
  }
  if (seoDefaults.ogDescription && !html.includes('property="og:description"')) {
    tags.push(`<meta property="og:description" content="${escapeHtml(seoDefaults.ogDescription)}" />`)
  }
  if (seoDefaults.ogImage && !html.includes('property="og:image"')) {
    tags.push(`<meta property="og:image" content="${escapeHtml(seoDefaults.ogImage)}" />`)
  }
  if (seoDefaults.robots && !html.includes('name="robots"')) {
    tags.push(`<meta name="robots" content="${escapeHtml(seoDefaults.robots)}" />`)
  }
  if (seoDefaults.canonical && !html.includes('rel="canonical"')) {
    tags.push(`<link rel="canonical" href="${escapeHtml(seoDefaults.canonical)}" />`)
  }

  if (tags.length === 0) return html
  return html.replace('<head>', `<head>\n  ${tags.join('\n  ')}`)
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function getCacheKey(companyId, urlPath) {
  return `${companyId}:${urlPath}`
}

function getCached(key) {
  const entry = HTML_CACHE.get(key)
  if (!entry) return null
  if (Date.now() - entry.cachedAt > HTML_CACHE_TTL) { HTML_CACHE.delete(key); return null }
  return entry.html
}

function setCache(key, html) {
  if (HTML_CACHE.size >= HTML_CACHE_MAX) {
    const firstKey = HTML_CACHE.keys().next().value
    HTML_CACHE.delete(firstKey)
  }
  HTML_CACHE.set(key, { html, cachedAt: Date.now() })
}

export function invalidateCache(companyId) {
  for (const key of HTML_CACHE.keys()) {
    if (key.startsWith(`${companyId}:`)) HTML_CACHE.delete(key)
  }
}

let _primaryCompanyCache = null
let _primaryCompanyCachedAt = 0
const COMPANY_CACHE_TTL = 60_000

export function invalidatePrimaryCache() {
  _primaryCompanyCache = null
  _primaryCompanyCachedAt = 0
}

export function createDistServeService({ prisma, supabaseAdmin }) {
  async function getPrimaryCompany() {
    if (_primaryCompanyCache && Date.now() - _primaryCompanyCachedAt < COMPANY_CACHE_TTL) {
      return _primaryCompanyCache
    }
    const config = await prisma.instanceConfig.findUnique({ where: { key: 'primary_company_id' } })
    if (!config) return null

    const rows = await prisma.$queryRaw`
      SELECT ws.id, ws.source_type, ws.seo_defaults, ws.company_id,
             c.slug as company_slug
      FROM website_site ws
      JOIN company c ON c.id = ws.company_id
      WHERE ws.company_id = ${config.value}::uuid
        AND ws.enabled = true
      LIMIT 1
    `
    const site = rows[0] ?? null
    _primaryCompanyCache = site
    _primaryCompanyCachedAt = Date.now()
    return site
  }

  async function serve(c, urlPath) {
    const site = await getPrimaryCompany()

    if (!site) {
      return c.json({ error: 'Sitio no configurado' }, 404)
    }

    const sourceType = site.source_type

    if (sourceType === 'none') {
      return c.json({ error: 'Sitio no disponible' }, 404)
    }

    if (sourceType === 'builder') {
      return null // signal to caller: delegate to existing builder handler
    }

    // source_type === 'dist'
    if (isAssetPath(urlPath)) {
      const objectKey = `dist/${site.company_slug}${urlPath}`
      const publicUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${objectKey}`
      return c.redirect(publicUrl, 302)
    }

    // HTML route
    const cacheKey = getCacheKey(site.company_id, urlPath)
    const cached = getCached(cacheKey)
    if (cached) {
      return c.html(cached)
    }

    const candidates = resolveHtmlCandidates(site.company_slug, urlPath)
    let html = null

    for (const objectKey of [...new Set(candidates)]) {
      const { data, error } = await supabaseAdmin.storage.from(BUCKET).download(objectKey)
      if (!error && data) {
        html = await data.text()
        break
      }
    }

    if (!html) {
      return c.json({ error: 'Pagina no encontrada' }, 404)
    }

    const injected = injectSeoTags(html, site.seo_defaults)
    setCache(cacheKey, injected)

    c.header('Cache-Control', 'public, max-age=300')
    return c.html(injected)
  }

  return { serve, invalidatePrimaryCache }
}
