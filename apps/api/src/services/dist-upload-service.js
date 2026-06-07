const BUCKET = 'atlas-website'
const MAX_BYTES = 100 * 1024 * 1024

const MIME_MAP = {
  html: 'text/html', css: 'text/css', js: 'application/javascript',
  mjs: 'application/javascript', json: 'application/json',
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  webp: 'image/webp', svg: 'image/svg+xml', ico: 'image/x-icon',
  woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf',
  txt: 'text/plain', xml: 'application/xml', map: 'application/json',
}

export function getMimeType(filename) {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  return MIME_MAP[ext] ?? 'application/octet-stream'
}

export function findRootPrefix(filePaths) {
  if (filePaths.includes('index.html')) return ''
  const wrapped = filePaths.find(p => {
    const parts = p.split('/')
    return parts.length === 2 && parts[1] === 'index.html'
  })
  if (wrapped) return wrapped.slice(0, wrapped.lastIndexOf('/') + 1)
  return null
}

export function detectPrerender(relativePaths) {
  return relativePaths.some(p => p.endsWith('.html') && p !== 'index.html')
}

export function createDistUploadService({ prisma, supabaseAdmin }) {
  async function uploadDist({ siteId, fileBuffer, fileName, companySlug }) {
    if (fileBuffer.byteLength > MAX_BYTES) {
      throw Object.assign(new Error('El archivo supera el limite de 100MB'), { status: 413 })
    }

    const JSZip = (await import('jszip')).default
    const zip = await JSZip.loadAsync(fileBuffer)

    const allPaths = Object.keys(zip.files).filter(k => !zip.files[k].dir)
    const rootPrefix = findRootPrefix(allPaths)
    if (rootPrefix === null) {
      throw Object.assign(
        new Error('El zip debe contener un index.html en la raiz o en una carpeta de primer nivel'),
        { status: 422 }
      )
    }

    const storagePrefix = `dist/${companySlug}/`
    const manifest = []

    for (const [zipPath, entry] of Object.entries(zip.files)) {
      if (entry.dir) continue
      const relative = zipPath.slice(rootPrefix.length)
      if (!relative) continue

      const content = await entry.async('nodebuffer')
      const objectKey = `${storagePrefix}${relative}`

      const { error } = await supabaseAdmin.storage
        .from(BUCKET)
        .upload(objectKey, content, { contentType: getMimeType(relative), upsert: true })

      if (error) {
        throw Object.assign(
          new Error(`Error al subir ${relative}: ${error.message}`),
          { status: 500 }
        )
      }
      manifest.push(objectKey)
    }

    const relativePaths = manifest.map(k => k.slice(storagePrefix.length))
    const hasPrerender = detectPrerender(relativePaths)
    const now = new Date()

    // Save original zip for build history / download
    const safeFileName = (fileName ?? 'build.zip').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80)
    const zipKey = `dist/${companySlug}/builds/${now.toISOString().replace(/[:.]/g, '-')}_${safeFileName}`
    await supabaseAdmin.storage
      .from(BUCKET)
      .upload(zipKey, Buffer.from(fileBuffer), { contentType: 'application/zip', upsert: false })
      .catch(() => {})

    await prisma.$executeRaw`
      UPDATE website_site
      SET source_type        = 'dist',
          dist_uploaded_at   = ${now},
          dist_file_count    = ${manifest.length},
          dist_has_prerender = ${hasPrerender},
          dist_manifest      = ${JSON.stringify(manifest)}::jsonb
      WHERE id = ${siteId}::uuid
    `

    return { fileCount: manifest.length, hasPrerender, uploadedAt: now }
  }

  async function deleteDist({ siteId, companySlug }) {
    const site = await prisma.$queryRaw`
      SELECT dist_manifest FROM website_site WHERE id = ${siteId}::uuid
    `
    const manifest = site[0]?.dist_manifest ?? []

    if (manifest.length > 0) {
      await supabaseAdmin.storage.from(BUCKET).remove(manifest)
    }

    await prisma.$executeRaw`
      UPDATE website_site
      SET source_type        = 'builder',
          dist_uploaded_at   = NULL,
          dist_file_count    = NULL,
          dist_has_prerender = NULL,
          dist_manifest      = NULL
      WHERE id = ${siteId}::uuid
    `
  }

  async function listBuilds({ companySlug }) {
    const prefix = `dist/${companySlug}/builds`
    const { data, error } = await supabaseAdmin.storage
      .from(BUCKET)
      .list(prefix, { limit: 20, sortBy: { column: 'created_at', order: 'desc' } })
    if (error || !data) return []
    const publicBase = `${process.env.SUPABASE_URL}/storage/v1/object/public/${BUCKET}`
    return data
      .filter((f) => !f.id?.endsWith('/') && f.name.endsWith('.zip'))
      .map((f) => ({
        key:         `${prefix}/${f.name}`,
        name:        f.name,
        displayName: f.name.replace(/^\d{4}-\d{2}-\d{2}T[\d-]+Z_/, ''),
        size:        f.metadata?.size ?? null,
        uploadedAt:  f.created_at ?? null,
        downloadUrl: `${publicBase}/${prefix}/${encodeURIComponent(f.name)}`,
      }))
  }

  async function deleteBuildZip({ companySlug, buildName }) {
    const key = `dist/${companySlug}/builds/${buildName}`
    const { error } = await supabaseAdmin.storage.from(BUCKET).remove([key])
    if (error) throw Object.assign(new Error(error.message), { status: 500 })
  }

  return { uploadDist, deleteDist, listBuilds, deleteBuildZip }
}
