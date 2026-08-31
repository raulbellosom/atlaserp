// apps/api/src/routes/pfm/__tests__/categories-service.test.js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createCategoriesService } from "../categories-service.js";

const COMPANY = "01900000-0000-7000-8000-0000000000b1";
const ACTOR = "01900000-0000-7000-8000-0000000000b2";
const OTHER = "01900000-0000-7000-8000-0000000000b3";

describe("categories-service", () => {
  it("listCategories returns system + own categories and masks another user's personal ones", async () => {
    const prisma = {
      pfmCategory: {
        findMany: async () => [
          { id: "c1", name: "Comida", kind: "EXPENSE", color: "#f97316", ownerId: null },
          { id: "c2", name: "Terapia", kind: "EXPENSE", color: "#ec4899", ownerId: ACTOR },
          { id: "c3", name: "Apuestas", kind: "EXPENSE", color: "#111111", ownerId: OTHER },
        ],
      },
    };
    const service = createCategoriesService({ prisma });
    const { data } = await service.listCategories({
      companyId: COMPANY,
      actorId: ACTOR,
      includeShared: true,
    });
    const byId = Object.fromEntries(data.map((c) => [c.id, c]));
    assert.equal(byId.c1.name, "Comida");
    assert.equal(byId.c2.name, "Terapia");
    assert.equal(byId.c3.name, "Personal", "another user's personal category name is masked");
    assert.equal(byId.c3.color, "#9ca3af", "masked category uses a neutral color");
  });

  it("createCategory always stamps the actor as ownerId (never a system category)", async () => {
    let created = null;
    const prisma = {
      pfmCategory: {
        create: async ({ data }) => {
          created = data;
          return { id: "new", ...data };
        },
      },
    };
    const service = createCategoriesService({ prisma });
    await service.createCategory({
      companyId: COMPANY,
      actorId: ACTOR,
      data: { name: "Mascotas", kind: "EXPENSE", color: null, icon: null, parentId: null },
    });
    assert.equal(created.ownerId, ACTOR);
    assert.equal(created.companyId, COMPANY);
  });
});
