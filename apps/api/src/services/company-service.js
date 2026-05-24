/**
 * company-service.js
 * Business logic for Company profile, address, and branding configuration.
 */

export class CompanyServiceError extends Error {
  constructor(message, status = 500) {
    super(message);
    this.status = status;
  }
}

const COMPANY_TYPE_VALUES = [
  "sa_de_cv",
  "srl_de_cv",
  "sa",
  "srl",
  "sc",
  "ac",
  "sapi_de_cv",
  "otro",
];

const COMPANY_SIZE_VALUES = ["micro", "small", "medium", "large", "corporate"];

const INDUSTRY_VALUES = [
  "tecnologia",
  "software",
  "manufactura",
  "retail",
  "salud",
  "educacion",
  "logistica",
  "construccion",
  "servicios_profesionales",
  "contabilidad",
  "financiero",
  "agroindustria",
  "hospitalidad",
  "marketing",
  "inmobiliario",
  "mineria",
  "ong",
  "otro",
];

const COMPANY_TYPE_ALIASES = {
  "sa de cv": "sa_de_cv",
  "sociedad anonima de capital variable": "sa_de_cv",
  "srl de cv": "srl_de_cv",
  "sociedad de responsabilidad limitada de capital variable": "srl_de_cv",
  "sociedad anonima": "sa",
  "sociedad de responsabilidad limitada": "srl",
  "sociedad cooperativa": "sc",
  "asociacion civil": "ac",
  "sapi de cv": "sapi_de_cv",
};

const COMPANY_SIZE_ALIASES = {
  "micro 1 a 10 empleados": "micro",
  "micro 1 10": "micro",
  "pequena 11 a 50 empleados": "small",
  "small 11 a 50 empleados": "small",
  "mediana 51 a 200 empleados": "medium",
  "medium 51 a 200 empleados": "medium",
  "grande 201 a 500 empleados": "large",
  "large 201 a 500 empleados": "large",
  "corporativo mas de 500 empleados": "corporate",
  "corporativo 500": "corporate",
};

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeEnumValue(value, validValues, aliases = {}) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (validValues.includes(raw)) return raw;
  const normalized = normalizeText(raw);
  if (!normalized) return "";
  if (Object.prototype.hasOwnProperty.call(aliases, normalized)) {
    return aliases[normalized];
  }
  const exact = validValues.find((v) => normalizeText(v) === normalized);
  return exact ?? raw;
}

export function createCompanyService({ prisma, supabaseAdmin }) {
  async function getCompanyId() {
    const record = await prisma.instanceConfig.findUnique({
      where: { key: "company_id" },
    });
    if (!record?.value) {
      throw new CompanyServiceError("No hay empresa activa configurada.", 404);
    }
    return record.value;
  }

  async function getSignedLogoUrl(logoFileId) {
    if (!logoFileId) return null;
    const fileAsset = await prisma.fileAsset.findUnique({
      where: { id: logoFileId },
    });
    if (!fileAsset) return null;
    const { data } = await supabaseAdmin.storage
      .from(fileAsset.bucket)
      .createSignedUrl(fileAsset.objectKey, 3600);
    return data?.signedUrl ?? null;
  }

  return {
    // ── Profile ──────────────────────────────────────────────────────────────

    async getProfile() {
      const companyId = await getCompanyId();
      const company = await prisma.company.findUnique({
        where: { id: companyId },
      });
      return {
        companyId,
        name: company?.name ?? "",
        legalName: company?.legalName ?? "",
        rfc: company?.rfc ?? "",
        companyType: normalizeEnumValue(
          company?.companyType,
          COMPANY_TYPE_VALUES,
          COMPANY_TYPE_ALIASES,
        ),
        companyTypeName: company?.companyTypeName ?? "",
        industryKey: normalizeEnumValue(
          company?.industryKey,
          INDUSTRY_VALUES,
        ),
        industryName: company?.industryName ?? "",
        companySize: normalizeEnumValue(
          company?.companySize,
          COMPANY_SIZE_VALUES,
          COMPANY_SIZE_ALIASES,
        ),
        contactEmail: company?.contactEmail ?? "",
        phone: company?.phone ?? "",
        website: company?.website ?? "",
      };
    },

    async updateProfile(fields) {
      const companyId = await getCompanyId();
      const companyType = normalizeEnumValue(
        fields.companyType,
        COMPANY_TYPE_VALUES,
        COMPANY_TYPE_ALIASES,
      );
      const industryKey = normalizeEnumValue(
        fields.industryKey,
        INDUSTRY_VALUES,
      );
      const companySize = normalizeEnumValue(
        fields.companySize,
        COMPANY_SIZE_VALUES,
        COMPANY_SIZE_ALIASES,
      );
      await prisma.company.update({
        where: { id: companyId },
        data: {
          name: fields.name,
          legalName: fields.legalName || null,
          rfc: fields.rfc || null,
          companyType: companyType || null,
          companyTypeName: fields.companyTypeName || null,
          industryKey: industryKey || null,
          industryName: fields.industryName || null,
          companySize: companySize || null,
          contactEmail: fields.contactEmail || null,
          phone: fields.phone || null,
          website: fields.website || null,
        },
      });
      return {
        companyId,
        ...fields,
        companyType,
        industryKey,
        companySize,
      };
    },

    // ── Address ──────────────────────────────────────────────────────────────

    async getAddress() {
      const companyId = await getCompanyId();
      const company = await prisma.company.findUnique({
        where: { id: companyId },
      });
      return {
        companyId,
        country: company?.country ?? "",
        state: company?.state ?? "",
        city: company?.city ?? "",
        colony: company?.colony ?? "",
        street: company?.street ?? "",
        extNumber: company?.extNumber ?? "",
        intNumber: company?.intNumber ?? "",
        postalCode: company?.postalCode ?? "",
      };
    },

    async updateAddress(fields) {
      const companyId = await getCompanyId();
      await prisma.company.update({
        where: { id: companyId },
        data: {
          country: fields.country || null,
          state: fields.state || null,
          city: fields.city || null,
          colony: fields.colony || null,
          street: fields.street || null,
          extNumber: fields.extNumber || null,
          intNumber: fields.intNumber || null,
          postalCode: fields.postalCode || null,
        },
      });
      return { companyId, ...fields };
    },

    // ── Branding ─────────────────────────────────────────────────────────────

    async getBranding() {
      const companyId = await getCompanyId();
      const branding = await prisma.brandingConfig.findFirst({
        where: { companyId },
      });
      const logoUrl = await getSignedLogoUrl(branding?.logoFileId ?? null);
      return {
        companyId,
        primaryColor: branding?.primaryColor ?? "#0A7BFF",
        logoFileId: branding?.logoFileId ?? null,
        logoUrl,
      };
    },

    async updateBranding({ primaryColor, logoFileId }, companyId) {
      // Validate logo ownership if provided
      if (logoFileId) {
        const logoAsset = await prisma.fileAsset.findFirst({
          where: {
            id: logoFileId,
            enabled: true,
            OR: [
              { entityId: companyId },
              { moduleKey: "atlas.company", entityType: "BrandingConfig" },
            ],
          },
        });
        if (!logoAsset) {
          throw new CompanyServiceError(
            "El archivo de logotipo no es válido para esta empresa.",
            400,
          );
        }
      }

      await prisma.brandingConfig.upsert({
        where: { companyId },
        update: { primaryColor, logoFileId },
        create: { companyId, primaryColor, logoFileId },
      });

      const logoUrl = await getSignedLogoUrl(logoFileId);
      return { companyId, primaryColor, logoFileId, logoUrl };
    },
  };
}
