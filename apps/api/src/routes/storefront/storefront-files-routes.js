import { Hono } from 'hono'

export function createStorefrontFilesRoutes({ filesService, storefrontAuthMiddleware, resolveAuthenticatedProfile }) {
  const app = new Hono()

  app.post('/upload', storefrontAuthMiddleware, async (c) => {
    const { profile, role } = c.get('storefrontUser')

    const formData = await c.req.formData()
    const file = formData.get('file')
    if (!file || typeof file.arrayBuffer !== 'function') {
      return c.json({ error: 'Campo "file" requerido' }, 422)
    }

    const visibility = formData.get('visibility') ?? 'PUBLIC'
    const entityType = formData.get('entityType') ?? null
    const entityId = formData.get('entityId') ?? null
    const buffer = await file.arrayBuffer()

    try {
      const asset = await filesService.upload({
        file: Buffer.from(buffer),
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: buffer.byteLength,
        visibility,
        entityType,
        entityId,
        uploadedById: profile.id,
        roleKey: role.key,
      })
      return c.json({ data: asset }, 201)
    } catch (err) {
      return c.json({ error: err.message }, err.status ?? 500)
    }
  })

  app.get('/:id/url', async (c) => {
    const { id } = c.req.param()
    // Deliberately unauthenticated at the route level — PUBLIC storefront
    // assets (product images etc.) must stay reachable by anonymous
    // visitors. requesterId is resolved on a best-effort basis: a missing
    // or invalid token is treated as anonymous, not as an error, so a stale
    // token never blocks loading a public asset. filesService.getUrl is what
    // actually enforces that a PRIVATE asset requires requesterId to match
    // its uploader.
    let requesterId = null
    try {
      requesterId = await resolveAuthenticatedProfile(c)
    } catch {
      requesterId = null
    }
    try {
      const result = await filesService.getUrl(id, { requesterId })
      return c.json({ data: result })
    } catch (err) {
      return c.json({ error: err.message }, err.status ?? 500)
    }
  })

  app.delete('/:id', storefrontAuthMiddleware, async (c) => {
    const { id } = c.req.param()
    const { profile } = c.get('storefrontUser')
    try {
      const result = await filesService.deleteFile(id, profile.id)
      return c.json({ data: result })
    } catch (err) {
      return c.json({ error: err.message }, err.status ?? 500)
    }
  })

  return app
}
