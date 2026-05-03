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

export const setupInitializeSchema = z.object({
  adminFirstName: z.string().min(1),
  adminLastName: z.string().min(1),
  adminEmail: z.string().email(),
  adminPassword: z.string().min(8),
  companyName: z.string().min(2),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  legalName: z.string().optional(),
  rfc: z.string().optional(),
  companyType: z.string().optional(),
  companyTypeName: z.string().optional(),
  companySize: z.string().optional(),
  country: z.string().optional(),
  state: z.string().optional(),
  city: z.string().optional(),
  street: z.string().optional(),
  extNumber: z.string().optional(),
  intNumber: z.string().optional(),
  postalCode: z.string().optional(),
})
