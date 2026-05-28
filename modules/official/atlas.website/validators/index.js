import { z } from 'zod'

export const createPageSchema = z.object({
  siteId:    z.string().uuid(),
  title:     z.string().min(1).max(255),
  slug:      z.string().min(1).max(255).regex(/^[a-z0-9-]+$/),
  routePath: z.string().min(1).max(512).startsWith('/'),
  pageType:  z.enum(['page', 'landing', 'system']).default('page'),
  visibility:z.enum(['public', 'authenticated', 'private']).default('public'),
  seo:       z.record(z.unknown()).optional(),
})

export const updatePageSchema = z.object({
  title:      z.string().min(1).max(255).optional(),
  slug:       z.string().min(1).max(255).regex(/^[a-z0-9-]+$/).optional(),
  routePath:  z.string().min(1).max(512).startsWith('/').optional(),
  visibility: z.enum(['public', 'authenticated', 'private']).optional(),
  seo:        z.record(z.unknown()).optional(),
})

export const saveDraftSchema = z.object({
  builderData: z.record(z.unknown()),
  seo:         z.record(z.unknown()).optional(),
})

export const createSiteSchema = z.object({
  name:          z.string().min(1).max(255),
  domain:        z.string().optional(),
  defaultLocale: z.string().default('es'),
})

export const updateSiteSchema = z.object({
  name:           z.string().min(1).max(255).optional(),
  domain:         z.string().optional(),
  status:         z.enum(['draft', 'published', 'maintenance']).optional(),
  homepagePageId: z.string().uuid().optional().nullable(),
  themeId:        z.string().uuid().optional().nullable(),
  settings:       z.record(z.unknown()).optional(),
  seoDefaults:    z.record(z.unknown()).optional(),
})
