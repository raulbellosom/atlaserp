import { z } from 'zod'

export const moduleInstallSchema = z.object({
  manifest: z.object({
    key: z.string().min(3),
    name: z.string().min(2),
    version: z.string().min(1),
    core: z.boolean().optional(),
    uninstallable: z.boolean().optional(),
    dependencies: z.array(z.object({
      key: z.string(),
      optional: z.boolean().optional(),
      versionRange: z.string().optional()
    })).optional(),
    permissions: z.array(z.object({
      key: z.string(),
      name: z.string(),
      description: z.string().optional()
    })).optional(),
    blueprints: z.array(z.any()).optional()
  }).passthrough()
})

export const contactCreateSchema = z.object({
  type: z.enum(['customer', 'supplier', 'person', 'company']),
  name: z.string().min(2),
  legalName: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  taxId: z.string().optional(),
  metadata: z.record(z.any()).optional()
})
