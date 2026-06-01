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
  status:     z.enum(['draft', 'published', 'archived']).optional(),
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
  siteType:      z.enum(['website', 'ecommerce', 'blog', 'landing']).default('website'),
})

export const updateSiteSchema = z.object({
  name:                  z.string().min(1).max(255).optional(),
  domain:                z.string().optional(),
  status:                z.enum(['draft', 'published', 'maintenance']).optional(),
  siteType:              z.enum(['website', 'ecommerce', 'blog', 'landing']).optional(),
  homepagePageId:        z.string().uuid().optional().nullable(),
  themeId:               z.string().uuid().optional().nullable(),
  settings:              z.record(z.unknown()).optional(),
  seoDefaults:           z.record(z.unknown()).optional(),
  stripePublishableKey:  z.string().optional().nullable(),
  stripeSecretKey:       z.string().optional().nullable(),
  stripeSuccessMessage:  z.string().optional().nullable(),
})

export const createMenuSchema = z.object({
  siteId:   z.string().uuid(),
  name:     z.string().min(1).max(255),
  location: z.string().default('header'),
})

export const updateMenuSchema = z.object({
  name:     z.string().min(1).max(255).optional(),
  location: z.string().optional(),
})

export const createMenuItemSchema = z.object({
  label:     z.string().min(1).max(255),
  url:       z.string().optional().nullable(),
  pageId:    z.string().uuid().optional().nullable(),
  parentId:  z.string().uuid().optional().nullable(),
  target:    z.enum(['_self', '_blank']).default('_self'),
  icon:      z.string().optional().nullable(),
  sortOrder: z.number().int().default(0),
})

export const updateMenuItemSchema = z.object({
  label:     z.string().min(1).max(255).optional(),
  url:       z.string().optional().nullable(),
  pageId:    z.string().uuid().optional().nullable(),
  parentId:  z.string().uuid().optional().nullable(),
  target:    z.enum(['_self', '_blank']).optional(),
  icon:      z.string().optional().nullable(),
  sortOrder: z.number().int().optional(),
})

export const reorderItemsSchema = z.object({
  items: z.array(z.object({ id: z.string().uuid(), sortOrder: z.number().int() })),
})

export const createThemeSchema = z.object({
  siteId:     z.string().uuid(),
  name:       z.string().min(1).max(255),
  tokens:     z.record(z.unknown()).optional(),
  typography: z.record(z.unknown()).optional(),
  layout:     z.record(z.unknown()).optional(),
  customCss:  z.string().optional().nullable(),
  isDefault:  z.boolean().default(false),
})

export const updateThemeSchema = z.object({
  name:       z.string().min(1).max(255).optional(),
  tokens:     z.record(z.unknown()).optional(),
  typography: z.record(z.unknown()).optional(),
  layout:     z.record(z.unknown()).optional(),
  customCss:  z.string().optional().nullable(),
  isDefault:  z.boolean().optional(),
})

export const createBlogCategorySchema = z.object({
  siteId:      z.string().uuid(),
  name:        z.string().min(1).max(255),
  slug:        z.string().min(1).max(255).regex(/^[a-z0-9-]+$/),
  description: z.string().optional(),
})

export const createBlogPostSchema = z.object({
  siteId:        z.string().uuid(),
  categoryId:    z.string().uuid().optional().nullable(),
  title:         z.string().min(1).max(255),
  slug:          z.string().min(1).max(255).regex(/^[a-z0-9-]+$/),
  excerpt:       z.string().optional(),
  featuredImage: z.string().optional().nullable(),
  seo:           z.record(z.unknown()).optional(),
})

export const updateBlogPostSchema = z.object({
  categoryId:    z.string().uuid().optional().nullable(),
  title:         z.string().min(1).max(255).optional(),
  slug:          z.string().min(1).max(255).regex(/^[a-z0-9-]+$/).optional(),
  excerpt:       z.string().optional(),
  featuredImage: z.string().optional().nullable(),
  seo:           z.record(z.unknown()).optional(),
})

export const saveBlogDraftSchema = z.object({
  builderData: z.record(z.unknown()),
  seo:         z.record(z.unknown()).optional(),
})

export const createFormSchema = z.object({
  siteId:         z.string().uuid(),
  name:           z.string().min(1).max(255),
  description:    z.string().optional(),
  submitLabel:    z.string().optional(),
  successMessage: z.string().optional(),
  notifyEmail:    z.string().email().optional().nullable(),
})

export const updateFormSchema = z.object({
  name:           z.string().min(1).max(255).optional(),
  description:    z.string().optional(),
  submitLabel:    z.string().optional(),
  successMessage: z.string().optional(),
  notifyEmail:    z.string().email().optional().nullable(),
})

export const createFormFieldSchema = z.object({
  label:       z.string().min(1).max(255),
  name:        z.string().min(1).max(100).regex(/^[a-z_][a-z0-9_]*$/),
  fieldType:   z.enum(['text', 'email', 'phone', 'textarea', 'select', 'checkbox', 'number', 'date']).default('text'),
  placeholder: z.string().optional(),
  required:    z.boolean().default(false),
  options:     z.array(z.string()).optional().nullable(),
  sortOrder:   z.number().int().default(0),
})

export const updateFormFieldSchema = z.object({
  label:       z.string().min(1).max(255).optional(),
  name:        z.string().min(1).max(100).regex(/^[a-z_][a-z0-9_]*$/).optional(),
  fieldType:   z.enum(['text', 'email', 'phone', 'textarea', 'select', 'checkbox', 'number', 'date']).optional(),
  placeholder: z.string().optional(),
  required:    z.boolean().optional(),
  options:     z.array(z.string()).optional().nullable(),
  sortOrder:   z.number().int().optional(),
})

export const reorderFieldsSchema = z.object({
  items: z.array(z.object({ id: z.string().uuid(), sortOrder: z.number().int() })),
})
