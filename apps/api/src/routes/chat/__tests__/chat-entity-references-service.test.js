import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createChatEntityReferencesService } from "../chat-entity-references-service.js";

describe("chat-entity-references-service — resolveEntityRefs", () => {
  it("resolves a contact reference via contactsService.getById", async () => {
    const deps = {
      contactsService: { getById: async ({ authUserId, id }) => {
        assert.equal(authUserId, "auth-1");
        assert.equal(id, "contact-1");
        return { id: "contact-1", name: "Ada Lovelace" };
      } },
      filesService: {}, hrService: {}, ledgerService: {}, prisma: {},
    };
    const service = createChatEntityReferencesService(deps);
    const result = await service.resolveEntityRefs({
      authUserId: "auth-1",
      entityRefs: [{ entityType: "contact", recordId: "contact-1" }],
    });
    assert.deepEqual(result, [{
      entityType: "contact", recordId: "contact-1", title: "Ada Lovelace",
      subtitle: null, url: "/app/m/atlas.contacts/contacts/contact-1",
    }]);
  });

  it("resolves a file reference with originalName as title", async () => {
    const deps = {
      filesService: { getById: async () => ({ id: "file-1", originalName: "contrato.pdf" }) },
      contactsService: {}, hrService: {}, ledgerService: {}, prisma: {},
    };
    const service = createChatEntityReferencesService(deps);
    const result = await service.resolveEntityRefs({
      authUserId: "auth-1",
      entityRefs: [{ entityType: "file", recordId: "file-1" }],
    });
    assert.equal(result[0].title, "contrato.pdf");
    assert.equal(result[0].url, "/app/m/atlas.files/files/file-1");
  });

  it("resolves an hr_employee reference joining first/last name", async () => {
    const deps = {
      hrService: { getEmployee: async () => ({ id: "emp-1", firstName: "Grace", lastName: "Hopper" }) },
      contactsService: {}, filesService: {}, ledgerService: {}, prisma: {},
    };
    const service = createChatEntityReferencesService(deps);
    const result = await service.resolveEntityRefs({
      authUserId: "auth-1",
      entityRefs: [{ entityType: "hr_employee", recordId: "emp-1" }],
    });
    assert.equal(result[0].title, "Grace Hopper");
    assert.equal(result[0].url, "/app/m/atlas.hr/hr/employees/emp-1");
  });

  it("resolves a ledger_account reference, deriving companyId/actorId from authUserId (not passing authUserId through)", async () => {
    const prisma = {
      userProfile: { findUnique: async () => ({ id: "profile-1" }) },
      membership: { findFirst: async () => ({ companyId: "company-1" }) },
    };
    let capturedArgs = null;
    const deps = {
      ledgerService: { getAccount: async (args) => {
        capturedArgs = args;
        return { id: "acct-1", name: "Cuenta principal", bank: "BBVA" };
      } },
      contactsService: {}, filesService: {}, hrService: {}, prisma,
    };
    const service = createChatEntityReferencesService(deps);
    const result = await service.resolveEntityRefs({
      authUserId: "auth-1",
      entityRefs: [{ entityType: "ledger_account", recordId: "acct-1" }],
    });
    assert.deepEqual(capturedArgs, { companyId: "company-1", accountId: "acct-1", actorId: "profile-1" });
    assert.equal(result[0].title, "Cuenta principal · BBVA");
    assert.equal(result[0].url, "/app/m/atlas.ledger/accounts/acct-1");
  });

  it("drops (does not throw) a reference the caller can't resolve", async () => {
    const deps = {
      contactsService: { getById: async () => { const e = new Error("no"); e.status = 404; throw e; } },
      filesService: {}, hrService: {}, ledgerService: {}, prisma: {},
    };
    const service = createChatEntityReferencesService(deps);
    const result = await service.resolveEntityRefs({
      authUserId: "auth-1",
      entityRefs: [{ entityType: "contact", recordId: "contact-1" }],
    });
    assert.deepEqual(result, []);
  });

  it("drops an unknown entityType without throwing", async () => {
    const deps = { contactsService: {}, filesService: {}, hrService: {}, ledgerService: {}, prisma: {} };
    const service = createChatEntityReferencesService(deps);
    const result = await service.resolveEntityRefs({
      authUserId: "auth-1",
      entityRefs: [{ entityType: "totally_unknown", recordId: "x" }],
    });
    assert.deepEqual(result, []);
  });

  it("resolves multiple refs in parallel (Promise.all), not sequentially", async () => {
    const order = [];
    const deps = {
      contactsService: { getById: async () => { order.push("contact-start"); await new Promise((r) => setTimeout(r, 10)); order.push("contact-end"); return { id: "c1", name: "C" }; } },
      filesService: { getById: async () => { order.push("file-start"); order.push("file-end"); return { id: "f1", originalName: "F" }; } },
      hrService: {}, ledgerService: {}, prisma: {},
    };
    const service = createChatEntityReferencesService(deps);
    await service.resolveEntityRefs({
      authUserId: "auth-1",
      entityRefs: [{ entityType: "contact", recordId: "c1" }, { entityType: "file", recordId: "f1" }],
    });
    // If sequential, file wouldn't start until contact fully finished — this
    // proves they overlap.
    assert.deepEqual(order, ["contact-start", "file-start", "file-end", "contact-end"]);
  });
});
