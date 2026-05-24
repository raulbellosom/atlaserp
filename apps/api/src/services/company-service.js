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
        companyType: company?.companyType ?? "",
        companyTypeName: company?.companyTypeName ?? "",
        industryKey: company?.industryKey ?? "",
        industryName: company?.industryName ?? "",
        companySize: company?.companySize ?? "",
        contactEmail: company?.contactEmail ?? "",
        phone: company?.phone ?? "",
        website: company?.website ?? "",
      };
    },

    async updateProfile(fields) {
      const companyId = await getCompanyId();
      await prisma.company.update({
        where: { id: companyId },
        data: {
          name: fields.name,
          legalName: fields.legalName || null,
          rfc: fields.rfc || null,
          companyType: fields.companyType || null,
          companyTypeName: fields.companyTypeName || null,
          industryKey: fields.industryKey || null,
          industryName: fields.industryName || null,
          companySize: fields.companySize || null,
          contactEmail: fields.contactEmail || null,
          phone: fields.phone || null,
          website: fields.website || null,
        },
      });
      return { companyId, ...fields };
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
