import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import {
  createFormSchema, updateFormSchema,
  createFormFieldSchema, updateFormFieldSchema, reorderFieldsSchema,
} from './validators.js'
import { WebsiteServiceError } from './service-helpers.js'

export function createFormsRouter({ websiteSvc, requirePermission }) {
  const app = new Hono()

  app.get('/forms', requirePermission('website.pages.read'), async (c) => {
    const companyId = c.get('companyId')
    const siteId    = c.req.query('siteId')
    if (!siteId) return c.json({ data: [] })
    const forms = await websiteSvc.listForms({ companyId, siteId })
    return c.json({ data: forms })
  })

  app.post(
    '/forms',
    requirePermission('website.pages.create'),
    zValidator('json', createFormSchema),
    async (c) => {
      const companyId = c.get('companyId')
      const data      = c.req.valid('json')
      try {
        const form = await websiteSvc.createForm({ companyId, siteId: data.siteId, data })
        return c.json(form, 201)
      } catch (err) {
        if (err instanceof WebsiteServiceError) return c.json({ error: err.message }, err.status)
        throw err
      }
    },
  )

  app.get('/forms/:id', requirePermission('website.pages.read'), async (c) => {
    const companyId = c.get('companyId')
    try {
      const form = await websiteSvc.getForm({ companyId, formId: c.req.param('id') })
      return c.json(form)
    } catch (err) {
      if (err instanceof WebsiteServiceError) return c.json({ error: err.message }, err.status)
      throw err
    }
  })

  app.patch(
    '/forms/:id',
    requirePermission('website.pages.update'),
    zValidator('json', updateFormSchema),
    async (c) => {
      const companyId = c.get('companyId')
      const data      = c.req.valid('json')
      try {
        const form = await websiteSvc.updateForm({ companyId, formId: c.req.param('id'), data })
        return c.json(form)
      } catch (err) {
        if (err instanceof WebsiteServiceError) return c.json({ error: err.message }, err.status)
        throw err
      }
    },
  )

  app.delete('/forms/:id', requirePermission('website.pages.delete'), async (c) => {
    const companyId = c.get('companyId')
    try {
      await websiteSvc.softDeleteForm({ companyId, formId: c.req.param('id') })
      return c.json({ success: true })
    } catch (err) {
      if (err instanceof WebsiteServiceError) return c.json({ error: err.message }, err.status)
      throw err
    }
  })

  // ─── Fields ─────────────────────────────────────────────────────────────────

  app.post(
    '/forms/:id/fields',
    requirePermission('website.pages.update'),
    zValidator('json', createFormFieldSchema),
    async (c) => {
      const companyId = c.get('companyId')
      const data      = c.req.valid('json')
      try {
        const field = await websiteSvc.createFormField({ companyId, formId: c.req.param('id'), data })
        return c.json(field, 201)
      } catch (err) {
        if (err instanceof WebsiteServiceError) return c.json({ error: err.message }, err.status)
        throw err
      }
    },
  )

  app.post(
    '/forms/:id/fields/reorder',
    requirePermission('website.pages.update'),
    zValidator('json', reorderFieldsSchema),
    async (c) => {
      const companyId = c.get('companyId')
      const { items } = c.req.valid('json')
      await websiteSvc.reorderFormFields({ companyId, items })
      return c.json({ success: true })
    },
  )

  app.patch(
    '/form-fields/:fieldId',
    requirePermission('website.pages.update'),
    zValidator('json', updateFormFieldSchema),
    async (c) => {
      const companyId = c.get('companyId')
      const data      = c.req.valid('json')
      try {
        const field = await websiteSvc.updateFormField({ companyId, fieldId: c.req.param('fieldId'), data })
        return c.json(field)
      } catch (err) {
        if (err instanceof WebsiteServiceError) return c.json({ error: err.message }, err.status)
        throw err
      }
    },
  )

  app.delete('/form-fields/:fieldId', requirePermission('website.pages.update'), async (c) => {
    const companyId = c.get('companyId')
    try {
      await websiteSvc.softDeleteFormField({ companyId, fieldId: c.req.param('fieldId') })
      return c.json({ success: true })
    } catch (err) {
      if (err instanceof WebsiteServiceError) return c.json({ error: err.message }, err.status)
      throw err
    }
  })

  // ─── Submissions ─────────────────────────────────────────────────────────────

  app.get('/forms/:id/submissions', requirePermission('website.pages.read'), async (c) => {
    const companyId = c.get('companyId')
    const { page, pageSize } = c.req.query()
    try {
      const result = await websiteSvc.listSubmissions({
        companyId,
        formId:   c.req.param('id'),
        page:     parseInt(page     ?? '1',  10),
        pageSize: parseInt(pageSize ?? '20', 10),
      })
      return c.json(result)
    } catch (err) {
      if (err instanceof WebsiteServiceError) return c.json({ error: err.message }, err.status)
      throw err
    }
  })

  app.delete('/forms/:id/submissions/:subId', requirePermission('website.pages.delete'), async (c) => {
    const companyId = c.get('companyId')
    try {
      await websiteSvc.deleteSubmission({ companyId, submissionId: c.req.param('subId') })
      return c.json({ success: true })
    } catch (err) {
      if (err instanceof WebsiteServiceError) return c.json({ error: err.message }, err.status)
      throw err
    }
  })

  return app
}
