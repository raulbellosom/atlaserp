import { Hono } from 'hono'
import { createDistUploadService } from '../../services/dist-upload-service.js'

export function createDistRoutes({ prisma, supabaseAdmin, requirePermission }) {
  const app = new Hono()
  const uploadService = createDistUploadService({ prisma, supabaseAdmin })

  app.post(
    '/website/sites/:siteId/dist/upload',
    requirePermission('website.dist.upload'),
    async (c) => {
      try {
        const { siteId } = c.req.param()
        const body = await c.req.parseBody()
        const file = body.file

        if (!file || typeof file.arrayBuffer !== 'function') {
          return c.json({ error: 'Campo "file" requerido' }, 422)
        }

        const site = await prisma.$queryRaw`
          SELECT ws.id, c.slug as company_slug
          FROM website_site ws
          JOIN company c ON c.id = ws.company_id
          WHERE ws.id = ${siteId}::uuid AND ws.enabled = true
          LIMIT 1
        `
        if (!site[0]) return c.json({ error: 'Sitio no encontrado' }, 404)

        const buffer = await file.arrayBuffer()
        const result = await uploadService.uploadDist({
          siteId,
          fileBuffer: buffer,
          fileName: file.name,
          companySlug: site[0].company_slug,
        })

        return c.json({ data: result }, 201)
      } catch (err) {
        return c.json({ error: err.message }, err.status ?? 500)
      }
    }
  )

  app.delete(
    '/website/sites/:siteId/dist',
    requirePermission('website.dist.upload'),
    async (c) => {
      try {
        const { siteId } = c.req.param()
        const site = await prisma.$queryRaw`
          SELECT ws.id, c.slug as company_slug
          FROM website_site ws
          JOIN company c ON c.id = ws.company_id
          WHERE ws.id = ${siteId}::uuid AND ws.enabled = true
          LIMIT 1
        `
        if (!site[0]) return c.json({ error: 'Sitio no encontrado' }, 404)

        await uploadService.deleteDist({ siteId, companySlug: site[0].company_slug })
        return c.json({ data: { success: true } })
      } catch (err) {
        return c.json({ error: err.message }, err.status ?? 500)
      }
    }
  )

  return app
}
