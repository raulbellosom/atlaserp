import { z } from "zod";

export const moduleInstallSchema = z.object({
  manifest: z
    .object({
      key: z.string().min(3),
      name: z.string().min(2),
      version: z.string().min(1),
      core: z.boolean().optional(),
      uninstallable: z.boolean().optional(),
      dependencies: z
        .array(
          z.object({
            key: z.string(),
            optional: z.boolean().optional(),
            versionRange: z.string().optional(),
          }),
        )
        .optional(),
      navigation: z
        .array(
          z
            .object({
              label: z.string(),
              path: z.string(),
              icon: z.string().optional(),
              layout: z.string().optional(),
              permissionKey: z.string().optional(),
            })
            .passthrough(),
        )
        .optional(),
      permissions: z
        .array(
          z.object({
            key: z.string(),
            name: z.string(),
            description: z.string().optional(),
          }),
        )
        .optional(),
      acl: z
        .object({
          module: z.string().optional().nullable(),
          actions: z.record(z.string()).optional(),
          models: z
            .record(
              z.object({
                read: z.string().optional(),
                create: z.string().optional(),
                update: z.string().optional(),
                delete: z.string().optional(),
              }),
            )
            .optional(),
        })
        .optional(),
      blueprints: z.array(z.any()).optional(),
    })
    .passthrough(),
});

export const contactCreateSchema = z.object({
  type: z.enum(["customer", "supplier", "person", "company"]),
  name: z.string().min(2),
  legalName: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  taxId: z.string().optional(),
  notesMarkdown: z.string().max(5000).optional().or(z.literal("")),
  metadata: z.record(z.any()).optional(),
});

const hrEmployeeBaseSchema = z.object({
  employeeCode: z.string().trim().max(40).optional().or(z.literal("")),
  userProfileId: z.string().cuid().optional().nullable(),
  supervisorEmployeeId: z.string().cuid().optional().nullable(),
  departmentId: z.string().cuid().optional().nullable(),
  jobTitleId: z.string().cuid().optional().nullable(),
  profileImageFileId: z.string().cuid().optional().nullable(),
  firstName: z.string().trim().min(1, "El nombre es obligatorio."),
  lastName: z.string().trim().min(1, "Los apellidos son obligatorios."),
  workEmail: z.string().email().optional().or(z.literal("")),
  personalEmail: z.string().email().optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  emergencyContactName: z.string().trim().max(140).optional().or(z.literal("")),
  emergencyContactPhone: z.string().trim().max(40).optional().or(z.literal("")),
  jobTitle: z.string().trim().max(120).optional().or(z.literal("")),
  department: z.string().trim().max(120).optional().or(z.literal("")),
  managerName: z.string().trim().max(140).optional().or(z.literal("")),
  employmentType: z
    .enum(["full_time", "part_time", "contractor", "intern"])
    .optional(),
  workLocation: z.string().trim().max(120).optional().or(z.literal("")),
  hireDate: z.string().datetime().optional().or(z.literal("")),
  terminationDate: z.string().datetime().optional().or(z.literal("")),
  status: z.enum(["active", "inactive", "vacation", "terminated"]).default("active"),
  notesMarkdown: z.string().max(10000).optional().or(z.literal("")),
  metadata: z.record(z.any()).optional(),
});

function validateEmployeeDates(value, ctx) {
  if (!value.hireDate || !value.terminationDate) return;
  const hireDate = new Date(value.hireDate);
  const terminationDate = new Date(value.terminationDate);
  if (terminationDate < hireDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["terminationDate"],
      message: "La fecha de baja no puede ser anterior al ingreso.",
    });
  }
}

function validateEmployeeRelations(value, ctx) {
  if (
    value.supervisorEmployeeId &&
    value.supervisorEmployeeId === value.userProfileId
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["supervisorEmployeeId"],
      message: "El supervisor no puede ser la misma cuenta vinculada.",
    });
  }
}

export const hrEmployeeCreateSchema = hrEmployeeBaseSchema.superRefine(
  (value, ctx) => {
    validateEmployeeDates(value, ctx);
    validateEmployeeRelations(value, ctx);
  },
);

export const hrEmployeeUpdateSchema = hrEmployeeBaseSchema
  .partial()
  .superRefine((value, ctx) => {
    validateEmployeeDates(value, ctx);
    validateEmployeeRelations(value, ctx);
  });

export const hrEmployeeEnabledSchema = z.object({
  enabled: z.boolean(),
});

export const hrCatalogCreateSchema = z.object({
  name: z.string().trim().min(2, "El nombre es obligatorio.").max(120),
  description: z.string().trim().max(300).optional().or(z.literal("")),
});

export const hrCatalogUpdateSchema = hrCatalogCreateSchema.partial();

export const hrCatalogEnabledSchema = z.object({
  enabled: z.boolean(),
});

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
  companyIndustryKey: z.string().optional(),
  companyIndustryName: z.string().optional(),
  companySize: z.string().optional(),
  contactEmail: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  website: z.string().optional(),
  country: z.string().optional(),
  state: z.string().optional(),
  city: z.string().optional(),
  street: z.string().optional(),
  extNumber: z.string().optional(),
  intNumber: z.string().optional(),
  postalCode: z.string().optional(),
});

export const companyProfileSchema = z.object({
  name: z.string().min(2),
  legalName: z.string().optional(),
  rfc: z.string().optional(),
  companyType: z.string().optional(),
  companyTypeName: z.string().optional(),
  industryKey: z.string().optional(),
  industryName: z.string().optional(),
  companySize: z.string().optional(),
  contactEmail: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  website: z.string().optional(),
});

export const companyAddressSchema = z.object({
  country: z.string().optional(),
  state: z.string().optional(),
  city: z.string().optional(),
  street: z.string().optional(),
  extNumber: z.string().optional(),
  intNumber: z.string().optional(),
  postalCode: z.string().optional(),
});

export const companyBrandingSchema = z.object({
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  logoFileId: z.string().nullable().optional(),
});

export const notificationCreateSchema = z.object({
  userId: z.string().min(1),
  companyId: z.string().optional(),
  kind: z.enum(["info", "warning", "error", "success"]).default("info"),
  title: z.string().min(1),
  body: z.string().optional(),
  link: z.string().optional(),
});

const currencySchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, "Moneda invalida. Usa codigo ISO de 3 letras.");

export const financeAccountCreateSchema = z.object({
  code: z.string().trim().min(1, "El codigo de cuenta es obligatorio.").max(24),
  name: z
    .string()
    .trim()
    .min(2, "El nombre de cuenta es obligatorio.")
    .max(140),
  type: z.string().trim().min(1, "El tipo de cuenta es obligatorio.").max(60),
  currency: currencySchema.default("MXN"),
  initialBalance: z.coerce.number().finite().default(0),
});

export const financeAccountUpdateSchema = financeAccountCreateSchema.partial();

export const financeEntryLineSchema = z.object({
  accountId: z.string().trim().min(1, "La cuenta es obligatoria."),
  contactId: z.string().trim().min(1).optional(),
  debit: z.coerce.number().finite().min(0).default(0),
  credit: z.coerce.number().finite().min(0).default(0),
  currency: currencySchema.optional(),
  note: z.string().trim().max(280).optional(),
});

export const financeEntryCreateSchema = z.object({
  occurredAt: z.string().datetime().optional(),
  concept: z.string().trim().min(1, "El concepto es obligatorio.").max(280),
  reference: z.string().trim().max(140).optional(),
  currency: currencySchema.default("MXN"),
  sourceType: z
    .enum(["manual", "income", "expense", "transfer"])
    .default("manual"),
  lines: z
    .array(financeEntryLineSchema)
    .min(2, "La poliza debe tener al menos dos lineas."),
});

export const financeEntryEnabledSchema = z.object({
  enabled: z.boolean(),
});

export const financeAccountEnabledSchema = z.object({
  enabled: z.boolean(),
});

export const financeFxRateCreateSchema = z
  .object({
    baseCurrency: currencySchema,
    quoteCurrency: currencySchema,
    rateDate: z.string().trim().min(1, "La fecha de tipo de cambio es obligatoria."),
    rate: z.coerce.number().finite().positive("La tasa debe ser mayor a cero."),
    source: z.string().trim().min(1).max(40).optional().default("manual"),
  })
  .superRefine((value, ctx) => {
    if (value.baseCurrency === value.quoteCurrency) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["quoteCurrency"],
        message: "La moneda base y la moneda destino deben ser distintas.",
      });
    }
  });

export const financeFxRateEnabledSchema = z.object({
  enabled: z.boolean(),
});

const financeDirectionSchema = z.enum(["AR", "AP"]);
const financeDocTypeSchema = z.enum([
  "INVOICE",
  "CREDIT_NOTE",
  "DEBIT_NOTE",
  "ADVANCE",
  "PAYMENT",
]);
const financeDocStatusSchema = z.enum(["OPEN", "PARTIAL", "PAID", "VOID"]);
const financeTaxKindSchema = z.enum(["TRANSFER", "WITHHOLDING"]);
const financeApplicationStatusSchema = z.enum(["APPLIED", "REVERSED"]);

const dateLikeSchema = z.union([
  z.string().datetime(),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
]);

export const financeDocumentCreateSchema = z.object({
  direction: financeDirectionSchema,
  docType: financeDocTypeSchema,
  contactId: z.string().cuid().optional().nullable(),
  currency: currencySchema.default("MXN"),
  issueDate: dateLikeSchema,
  dueDate: dateLikeSchema.optional().nullable(),
  reference: z.string().trim().max(120).optional().nullable(),
  notesMarkdown: z.string().max(5000).optional().nullable(),
  subtotalAmount: z.coerce.number().finite().positive().optional(),
  totalAmount: z.coerce.number().finite().positive(),
  taxLines: z
    .array(
      z.object({
        taxRateId: z.string().cuid(),
        baseAmount: z.coerce.number().finite().positive().optional(),
      }),
    )
    .max(20)
    .optional(),
  metadata: z.record(z.any()).optional(),
});

export const financeDocumentUpdateSchema = z.object({
  dueDate: dateLikeSchema.optional().nullable(),
  reference: z.string().trim().max(120).optional().nullable(),
  notesMarkdown: z.string().max(5000).optional().nullable(),
  metadata: z.record(z.any()).optional(),
  status: financeDocStatusSchema.optional(),
});

export const financeDocumentEnabledSchema = z.object({
  enabled: z.boolean(),
});

export const financeDocumentReminderSchema = z.object({
  message: z.string().trim().max(280).optional().nullable(),
});

export const financeDocumentBulkReminderSchema = z.object({
  documentIds: z.array(z.string().cuid()).min(1).max(200),
  message: z.string().trim().max(280).optional().nullable(),
});

export const financeApplicationLineSchema = z.object({
  targetDocumentId: z.string().cuid(),
  amount: z.coerce.number().finite().positive(),
});

export const financeApplicationPreviewSchema = z.object({
  targetDocumentIds: z.array(z.string().cuid()).min(1).max(300).optional(),
  lines: z.array(financeApplicationLineSchema).min(1).max(300).optional(),
  allocationMode: z.enum(["fifo", "manual"]).default("fifo"),
  applyDate: dateLikeSchema.optional(),
});

export const financeApplicationApplySchema = z.object({
  lines: z.array(financeApplicationLineSchema).min(1).max(300),
  note: z.string().max(500).optional().nullable(),
  applyDate: dateLikeSchema.optional(),
});

export const financeApplicationListQuerySchema = z.object({
  direction: financeDirectionSchema.optional(),
  status: financeApplicationStatusSchema.optional(),
  sourceDocumentId: z.string().cuid().optional(),
  targetDocumentId: z.string().cuid().optional(),
  contactId: z.string().cuid().optional(),
  from: dateLikeSchema.optional(),
  to: dateLikeSchema.optional(),
  limit: z.coerce.number().int().min(1).max(300).optional(),
});

export const financeApplicationReverseSchema = z.object({
  reason: z.string().trim().max(500).optional().nullable(),
});

export const financeDocumentListQuerySchema = z.object({
  direction: financeDirectionSchema.optional(),
  docType: financeDocTypeSchema.optional(),
  status: financeDocStatusSchema.optional(),
  contactId: z.string().cuid().optional(),
  q: z.string().trim().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(300).optional(),
});

export const financeAgingQuerySchema = z.object({
  direction: financeDirectionSchema.optional(),
  contactId: z.string().cuid().optional(),
  asOf: dateLikeSchema.optional(),
  currency: currencySchema.optional(),
});

export const financeTaxRateCreateSchema = z.object({
  key: z
    .string()
    .trim()
    .min(2, "La clave del impuesto es obligatoria.")
    .max(40),
  name: z
    .string()
    .trim()
    .min(2, "El nombre del impuesto es obligatorio.")
    .max(120),
  kind: financeTaxKindSchema,
  rate: z.coerce.number().finite().min(0, "La tasa no puede ser negativa."),
  direction: financeDirectionSchema.optional().nullable(),
  metadata: z.record(z.any()).optional(),
});

export const financeTaxRateEnabledSchema = z.object({
  enabled: z.boolean(),
});

export const financeTaxRateListQuerySchema = z.object({
  kind: financeTaxKindSchema.optional(),
  direction: financeDirectionSchema.optional(),
  enabled: z
    .union([z.boolean(), z.enum(["true", "false"])])
    .transform((value) =>
      typeof value === "boolean" ? value : value === "true",
    )
    .optional(),
  q: z.string().trim().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(300).optional(),
});

export const fileRenameSchema = z.object({
  originalName: z
    .string()
    .trim()
    .min(1, "El nombre del archivo es obligatorio.")
    .max(180, "El nombre del archivo no puede exceder 180 caracteres.")
    .regex(
      /^[^\x00-\x1F\x7F\x80-\x9F\\/:*?"<>|]+$/,
      "El nombre del archivo contiene caracteres no permitidos.",
    ),
});

export const createUserSchema = z.object({
  firstName: z.string().min(1, "El nombre es obligatorio."),
  lastName: z.string().min(1, "Los apellidos son obligatorios."),
  email: z.string().email("Correo electrónico inválido."),
  password: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres."),
  roleId: z.string().cuid().optional(),
});

export const fileBulkDownloadSchema = z.object({
  fileIds: z
    .array(
      z.string().trim().min(1, "Cada identificador de archivo es obligatorio."),
    )
    .min(1, "Debes seleccionar al menos un archivo.")
    .max(50, "No puedes seleccionar más de 50 archivos."),
  mode: z.enum(["direct", "zip"]),
});
