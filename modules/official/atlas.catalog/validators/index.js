import { z } from 'zod'

export const createCategorySchema = z.object({
  name:        z.string().min(1).max(120),
  slug:        z.string().min(1).max(120).regex(/^[a-z0-9-]+$/),
  description: z.string().max(500).optional(),
})

export const updateCategorySchema = createCategorySchema.partial()

export const createProductSchema = z.object({
  name:          z.string().min(1).max(200),
  slug:          z.string().min(1).max(200).regex(/^[a-z0-9-]+$/),
  description:   z.string().max(2000).optional(),
  price:         z.number().min(0),
  compare_price: z.number().min(0).optional().nullable(),
  currency:      z.string().length(3).default('USD'),
  stock:         z.number().int().min(0).default(0),
  track_stock:   z.boolean().default(false),
  cover_asset_id:z.string().uuid().optional().nullable(),
  images:        z.array(z.string().uuid()).default([]),
  category_id:   z.string().uuid().optional().nullable(),
  published:     z.boolean().default(false),
})

export const updateProductSchema = createProductSchema.partial()
