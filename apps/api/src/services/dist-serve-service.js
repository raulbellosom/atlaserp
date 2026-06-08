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

const ATLAS_PATH_RE = /^\/(app|api|public|p|auth)\//i
const ASSET_ATTR_RE = /\b(href|src|content)="(\/(?!\/)[^"]*\.[a-zA-Z0-9]{1,10}[^"]*)"/g
// Matches href="/path" or href="/path?q=1" but NOT hrefs with file extensions (those are assets)
const NAV_LINK_RE  = /\bhref="(\/(?!\/|#)[^"#?]*)([^"]*)"/g
const HAS_EXT_RE   = /\.[a-zA-Z0-9]{1,10}(\?|$)/

export function rewriteDistHtml(html, storageBase, basePath = '/public/site') {
  // Step 1: rewrite root-relative ASSET paths (js/css/svg/png…) to full CDN URLs
  const withAssets = html.replace(ASSET_ATTR_RE, (match, attr, path) => {
    if (ATLAS_PATH_RE.test(path)) return match
    return `${attr}="${storageBase}${path}"`
  })

  // Step 2: rewrite root-relative NAVIGATION links (no extension = HTML routes like /about-us)
  // After step 1, asset hrefs are already CDN absolute so they won't match the extension guard.
  const withNavLinks = withAssets.replace(NAV_LINK_RE, (match, path, rest) => {
    if (ATLAS_PATH_RE.test(path)) return match
    if (HAS_EXT_RE.test(path)) return match   // still an asset that slipped through
    return `href="${basePath}${path}${rest}"`
  })

  // Step 3: inject importmap so dynamic import('/_astro/…') inside loaded modules
  // resolves to CDN instead of the API origin.
  const importMap = JSON.stringify({
    imports: {
      '/_astro/': `${storageBase}/_astro/`,
      // Next.js / React static export chunks live at /_next/
      '/_next/':  `${storageBase}/_next/`,
    },
  })
  const importMapTag = `<script type="importmap">${importMap}</script>`

  return withNavLinks.replace(/(<head(?:[^>]*)>)/i, `$1\n  ${importMapTag}`)
}

export function injectErpBadge(html, erpPath = '/app/') {
  const badge = `<div id="atlas-erp-badge" style="position:fixed;bottom:20px;right:20px;z-index:2147483647;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;"><a href="${erpPath}" style="display:inline-flex;align-items:center;gap:8px;background:rgba(15,15,30,0.88);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);color:#e2e8f0;padding:9px 16px;border-radius:100px;text-decoration:none;font-size:12px;font-weight:600;letter-spacing:0.03em;box-shadow:0 4px 20px rgba(0,0,0,0.45),0 0 0 1px rgba(255,255,255,0.08);" onmouseover="this.style.background='rgba(99,102,241,0.92)';this.style.boxShadow='0 4px 24px rgba(99,102,241,0.55),0 0 0 1px rgba(99,102,241,0.4)'" onmouseout="this.style.background='rgba(15,15,30,0.88)';this.style.boxShadow='0 4px 20px rgba(0,0,0,0.45),0 0 0 1px rgba(255,255,255,0.08)'"><svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0"><rect width="14" height="14" rx="3.5" fill="#6366f1"/><path d="M3.5 7h7M7 3.5v7" stroke="white" stroke-width="1.5" stroke-linecap="round"/></svg>Atlas ERP</a></div>`
  if (html.includes('</body>')) {
    return html.replace('</body>', `${badge}\n</body>`)
  }
  return html + badge
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

    const storageBase = `${process.env.SUPABASE_URL}/storage/v1/object/public/${BUCKET}/dist/${site.company_slug}`
    const injected = injectSeoTags(html, site.seo_defaults)
    const rewritten = rewriteDistHtml(injected, storageBase)
    const final = injectErpBadge(rewritten)
    setCache(cacheKey, final)

    c.header('Cache-Control', 'public, max-age=300')
    return c.html(final)
  }

  return { serve, invalidatePrimaryCache }
}
