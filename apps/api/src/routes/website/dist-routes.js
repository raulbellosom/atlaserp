import { Hono } from 'hono'
import { createDistUploadService } from '../../services/dist-upload-service.js'
import { invalidateCache } from '../../services/dist-serve-service.js'

const VALID_SOURCE_TYPES = new Set(['none', 'builder', 'dist'])

const SITE_SOURCE_SELECT = {
  id: true, name: true, sourceType: true,
  distUploadedAt: true, distFileCount: true, distHasPrerender: true,
}

export function createDistRoutes({ prisma, supabaseAdmin, requirePermission }) {
  const app = new Hono()
  const uploadService = createDistUploadService({ prisma, supabaseAdmin })

  app.get(
    '/website/sites/:siteId',
    requirePermission('website.site.read'),
    async (c) => {
      try {
        const { siteId } = c.req.param()
        const companyId = c.get('companyId')
        const site = await prisma.websiteSite.findFirst({
          where: { id: siteId, companyId, enabled: true },
          select: SITE_SOURCE_SELECT,
        })
        if (!site) return c.json({ error: 'Sitio no encontrado' }, 404)
        return c.json({ data: site })
      } catch (err) {
        return c.json({ error: err.message }, 500)
      }
    }
  )

  app.patch(
    '/website/sites/:siteId',
    requirePermission('website.site.update'),
    async (c) => {
      try {
        const { siteId } = c.req.param()
        const companyId = c.get('companyId')
        const body = await c.req.json().catch(() => ({}))
        const { sourceType } = body
        if (!sourceType || !VALID_SOURCE_TYPES.has(sourceType)) {
          return c.json({ error: 'sourceType debe ser none, builder o dist' }, 422)
        }
        const exists = await prisma.websiteSite.findFirst({
          where: { id: siteId, companyId, enabled: true },
          select: { id: true },
        })
        if (!exists) return c.json({ error: 'Sitio no encontrado' }, 404)
        const updated = await prisma.websiteSite.update({
          where: { id: siteId },
          data: { sourceType },
          select: SITE_SOURCE_SELECT,
        })
        invalidateCache(companyId)
        return c.json({ data: updated })
      } catch (err) {
        return c.json({ error: err.message }, 500)
      }
    }
  )

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
