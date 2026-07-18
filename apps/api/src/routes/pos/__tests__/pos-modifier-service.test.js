import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createPosModifierService } from "../pos-modifier-service.js";
import { PosServiceError } from "../service-helpers.js";

function makePrisma() {
  const groups = new Map();
  const options = new Map();
  const audits = [];
  let groupSeq = 0;
  let optionSeq = 0;

  function matchesGroup(row, where) {
    if (where.id !== undefined && row.id !== where.id) return false;
    if (where.companyId !== undefined && row.companyId !== where.companyId) return false;
    if (where.productId !== undefined && row.productId !== where.productId) return false;
    if (where.name !== undefined && row.name !== where.name) return false;
    if (where.enabled !== undefined && row.enabled !== where.enabled) return false;
    return true;
  }

  function matchesOption(row, where) {
    if (where.id !== undefined && row.id !== where.id) return false;
    if (where.companyId !== undefined && row.companyId !== where.companyId) return false;
    if (where.groupId !== undefined && row.groupId !== where.groupId) return false;
    if (where.enabled !== undefined && row.enabled !== where.enabled) return false;
    return true;
  }

  const prisma = {
    groups,
    options,
    audits,
    posModifierGroup: {
      findFirst: async ({ where }) => [...groups.values()].find((r) => matchesGroup(r, where)) ?? null,
      findMany: async ({ where, orderBy }) => {
        let rows = [...groups.values()].filter((r) => matchesGroup(r, where));
        if (orderBy?.position) {
          rows = rows.slice().sort((a, b) => a.position - b.position);
        }
        return rows;
      },
      create: async ({ data }) => {
        const row = {
          id: `group-${++groupSeq}`,
          enabled: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data,
        };
        groups.set(row.id, row);
        return row;
      },
      update: async ({ where, data }) => {
        const row = { ...groups.get(where.id), ...data };
        groups.set(where.id, row);
        return row;
      },
    },
    posModifierOption: {
      findFirst: async ({ where }) => [...options.values()].find((r) => matchesOption(r, where)) ?? null,
      findMany: async ({ where, orderBy }) => {
        let rows = [...options.values()].filter((r) => matchesOption(r, where));
        if (orderBy?.position) {
          rows = rows.slice().sort((a, b) => a.position - b.position);
        }
        return rows;
      },
      create: async ({ data }) => {
        const row = {
          id: `option-${++optionSeq}`,
          enabled: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data,
        };
        options.set(row.id, row);
        return row;
      },
      update: async ({ where, data }) => {
        const row = { ...options.get(where.id), ...data };
        options.set(where.id, row);
        return row;
      },
    },
    auditLog: { create: async ({ data }) => audits.push(data) },
  };

  async function addGroup(companyId, productId, groupData, optionsData = []) {
    const group = await prisma.posModifierGroup.create({
      data: {
        companyId,
        productId,
        name: groupData.name,
        minSelect: groupData.minSelect ?? 0,
        maxSelect: groupData.maxSelect ?? 1,
        required: groupData.required ?? false,
        position: groupData.position ?? 0,
        enabled: groupData.enabled ?? true,
      },
    });
    const createdOptions = [];
    for (const optionData of optionsData) {
      const option = await prisma.posModifierOption.create({
        data: {
          companyId,
          groupId: group.id,
          name: optionData.name,
          priceDelta: optionData.priceDelta ?? 0,
          position: optionData.position ?? 0,
          enabled: optionData.enabled ?? true,
        },
      });
      createdOptions.push(option);
    }
    return { group, options: createdOptions };
  }

  return { prisma, addGroup };
}

describe("pos-modifier-service", () => {
  it("createGroup rejects duplicate name per product with 409", async () => {
    const { prisma } = makePrisma();
    const svc = createPosModifierService({ prisma });
    await svc.createGroup({
      companyId: "co-1",
      actorId: "user-1",
      productId: "product-1",
      data: { name: "Salsa", minSelect: 1, maxSelect: 2, required: true },
    });
    await assert.rejects(
      () =>
        svc.createGroup({
          companyId: "co-1",
          actorId: "user-1",
          productId: "product-1",
          data: { name: "Salsa", minSelect: 0, maxSelect: 1 },
        }),
      (err) => err instanceof PosServiceError && err.status === 409,
    );
  });

  it("listForProduct returns enabled groups with enabled options ordered by position", async () => {
    const { prisma, addGroup } = makePrisma();
    const svc = createPosModifierService({ prisma });
    await addGroup(
      "co-1",
      "product-1",
      { name: "Salsa", minSelect: 1, maxSelect: 2, required: true, position: 1 },
      [
        { name: "Verde", priceDelta: 0, position: 0 },
        { name: "Roja", priceDelta: 0, position: 1, enabled: false },
      ],
    );
    await addGroup(
      "co-1",
      "product-1",
      { name: "Tamaño", minSelect: 1, maxSelect: 1, required: true, position: 0, enabled: false },
      [{ name: "Grande", priceDelta: 5, position: 0 }],
    );

    const result = await svc.listForProduct({ companyId: "co-1", productId: "product-1" });

    assert.equal(result.length, 1);
    assert.equal(result[0].name, "Salsa");
    assert.equal(result[0].options.length, 1);
    assert.equal(result[0].options[0].name, "Verde");
  });

  it("resolveSelection prices and snapshots a valid selection", async () => {
    const { prisma, addGroup } = makePrisma();
    const svc = createPosModifierService({ prisma });
    const { options } = await addGroup(
      "co-1",
      "product-1",
      { name: "Salsa", minSelect: 1, maxSelect: 2, required: true },
      [
        { name: "Verde", priceDelta: 0, position: 0 },
        { name: "Roja", priceDelta: 0, position: 1 },
        { name: "Extra queso", priceDelta: 10, position: 2 },
      ],
    );
    const [verde, , queso] = options;

    const result = await svc.resolveSelection({
      companyId: "co-1",
      productId: "product-1",
      optionIds: [verde.id, queso.id],
    });

    assert.equal(result.totalDelta, 10);
    assert.equal(result.snapshots.length, 2);
    assert.deepEqual(result.snapshots[0], {
      optionId: verde.id,
      groupName: "Salsa",
      optionName: "Verde",
      priceDelta: 0,
    });
    assert.deepEqual(result.snapshots[1], {
      optionId: queso.id,
      groupName: "Salsa",
      optionName: "Extra queso",
      priceDelta: 10,
    });
  });

  it("resolveSelection rejects missing required group with Spanish 400", async () => {
    const { prisma, addGroup } = makePrisma();
    const svc = createPosModifierService({ prisma });
    await addGroup(
      "co-1",
      "product-1",
      { name: "Salsa", minSelect: 1, maxSelect: 2, required: true },
      [{ name: "Verde", priceDelta: 0, position: 0 }],
    );

    await assert.rejects(
      () => svc.resolveSelection({ companyId: "co-1", productId: "product-1", optionIds: [] }),
      (err) =>
        err instanceof PosServiceError &&
        err.status === 400 &&
        err.message.includes("Faltan modificadores requeridos: Salsa."),
    );
  });

  it("resolveSelection rejects out-of-range count with min/max message", async () => {
    const { prisma, addGroup } = makePrisma();
    const svc = createPosModifierService({ prisma });
    const { options } = await addGroup(
      "co-1",
      "product-1",
      { name: "Salsa", minSelect: 1, maxSelect: 2, required: true },
      [
        { name: "Verde", priceDelta: 0, position: 0 },
        { name: "Roja", priceDelta: 0, position: 1 },
        { name: "Extra queso", priceDelta: 10, position: 2 },
      ],
    );

    await assert.rejects(
      () =>
        svc.resolveSelection({
          companyId: "co-1",
          productId: "product-1",
          optionIds: options.map((o) => o.id),
        }),
      (err) =>
        err instanceof PosServiceError &&
        err.status === 400 &&
        err.message.includes("mín") &&
        err.message.includes("máx"),
    );
  });

  it("resolveSelection rejects an option from another product/company with 404", async () => {
    const { prisma, addGroup } = makePrisma();
    const svc = createPosModifierService({ prisma });
    await addGroup(
      "co-1",
      "product-1",
      { name: "Salsa", minSelect: 1, maxSelect: 2, required: true },
      [{ name: "Verde", priceDelta: 0, position: 0 }],
    );
    const { options: otherOptions } = await addGroup(
      "co-2",
      "product-2",
      { name: "Salsa", minSelect: 0, maxSelect: 1 },
      [{ name: "Picante", priceDelta: 0, position: 0 }],
    );

    await assert.rejects(
      () =>
        svc.resolveSelection({
          companyId: "co-1",
          productId: "product-1",
          optionIds: [otherOptions[0].id],
        }),
      (err) => err instanceof PosServiceError && err.status === 404,
    );
  });

  it("resolveSelection skips a required group whose options are all disabled", async () => {
    const { prisma, addGroup } = makePrisma();
    const svc = createPosModifierService({ prisma });
    await addGroup(
      "co-1",
      "product-1",
      { name: "Salsa", minSelect: 1, maxSelect: 2, required: true },
      [{ name: "Verde", priceDelta: 0, position: 0, enabled: false }],
    );

    const result = await svc.resolveSelection({ companyId: "co-1", productId: "product-1", optionIds: [] });

    assert.equal(result.totalDelta, 0);
    assert.deepEqual(result.snapshots, []);
  });
});
