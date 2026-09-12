import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createCompanyService, CompanyServiceError } from "../company-service.js";

const COMPANY_A = "company-a";
const COMPANY_B = "company-b";

function makePrisma({ instanceConfigCompanyId = COMPANY_A, companies = {} } = {}) {
  const defaultCompany = (id) => ({ id, name: `Name for ${id}`, slug: id });
  return {
    instanceConfig: {
      findUnique: async ({ where }) =>
        where.key === "company_id" && instanceConfigCompanyId
          ? { key: "company_id", value: instanceConfigCompanyId }
          : null,
    },
    company: {
      findUnique: async ({ where }) => companies[where.id] ?? defaultCompany(where.id),
      update: async ({ where, data }) => ({ id: where.id, ...data }),
    },
    brandingConfig: {
      findFirst: async () => null,
      upsert: async ({ where, create }) => ({ ...create, companyId: where.companyId }),
    },
    fileAsset: {
      findFirst: async () => null,
      findUnique: async () => null,
    },
  };
}

describe("createCompanyService — active-company resolution", () => {
  describe("getProfile", () => {
    it("uses the explicitly passed activeCompanyId, not the instance_config singleton", async () => {
      const prisma = makePrisma({ instanceConfigCompanyId: COMPANY_A });
      const svc = createCompanyService({ prisma, supabaseAdmin: {} });
      const result = await svc.getProfile(COMPANY_B);
      assert.equal(result.companyId, COMPANY_B);
      assert.equal(result.name, `Name for ${COMPANY_B}`);
    });

    it("falls back to instance_config.company_id when no activeCompanyId is given (legacy callers)", async () => {
      const prisma = makePrisma({ instanceConfigCompanyId: COMPANY_A });
      const svc = createCompanyService({ prisma, supabaseAdmin: {} });
      const result = await svc.getProfile();
      assert.equal(result.companyId, COMPANY_A);
    });

    it("throws 404 when neither an activeCompanyId nor instance_config.company_id is available", async () => {
      const prisma = makePrisma({ instanceConfigCompanyId: null });
      const svc = createCompanyService({ prisma, supabaseAdmin: {} });
      await assert.rejects(
        () => svc.getProfile(),
        (err) => err instanceof CompanyServiceError && err.status === 404,
      );
    });
  });

  describe("updateProfile / getAddress / updateAddress / getBranding / updateBranding", () => {
    it("all operate on the passed activeCompanyId, scoped independently of the singleton", async () => {
      const prisma = makePrisma({ instanceConfigCompanyId: COMPANY_A });
      const svc = createCompanyService({ prisma, supabaseAdmin: {} });

      const profile = await svc.updateProfile({ name: "Acme B" }, COMPANY_B);
      assert.equal(profile.companyId, COMPANY_B);

      const address = await svc.getAddress(COMPANY_B);
      assert.equal(address.companyId, COMPANY_B);

      const addressUpdate = await svc.updateAddress({ city: "CDMX" }, COMPANY_B);
      assert.equal(addressUpdate.companyId, COMPANY_B);

      const branding = await svc.getBranding(COMPANY_B);
      assert.equal(branding.companyId, COMPANY_B);

      const brandingUpdate = await svc.updateBranding({ primaryColor: "#123456", logoFileId: null }, COMPANY_B);
      assert.equal(brandingUpdate.companyId, COMPANY_B);
    });
  });
});
