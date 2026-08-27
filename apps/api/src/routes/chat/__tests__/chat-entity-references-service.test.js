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

  it("resolves a contact reference's subtitle from phone, preferring it over email", async () => {
    const deps = {
      contactsService: { getById: async () => ({ id: "contact-1", name: "Ada Lovelace", phone: "555-0100", email: "ada@example.com" }) },
      filesService: {}, hrService: {}, ledgerService: {}, prisma: {},
    };
    const service = createChatEntityReferencesService(deps);
    const result = await service.resolveEntityRefs({
      authUserId: "auth-1",
      entityRefs: [{ entityType: "contact", recordId: "contact-1" }],
    });
    assert.equal(result[0].subtitle, "555-0100");
  });

  it("falls back to email for a contact reference's subtitle when there's no phone", async () => {
    const deps = {
      contactsService: { getById: async () => ({ id: "contact-1", name: "Ada Lovelace", email: "ada@example.com" }) },
      filesService: {}, hrService: {}, ledgerService: {}, prisma: {},
    };
    const service = createChatEntityReferencesService(deps);
    const result = await service.resolveEntityRefs({
      authUserId: "auth-1",
      entityRefs: [{ entityType: "contact", recordId: "contact-1" }],
    });
    assert.equal(result[0].subtitle, "ada@example.com");
  });

  it("resolves a file reference with originalName as title, includes mimeType and sizeBytes", async () => {
    const deps = {
      filesService: { getById: async () => ({ id: "file-1", originalName: "contrato.pdf", mimeType: "application/pdf", sizeBytes: 12345 }) },
      contactsService: {}, hrService: {}, ledgerService: {}, prisma: {},
    };
    const service = createChatEntityReferencesService(deps);
    const result = await service.resolveEntityRefs({
      authUserId: "auth-1",
      entityRefs: [{ entityType: "file", recordId: "file-1" }],
    });
    assert.deepEqual(result[0], {
      entityType: "file", recordId: "file-1", title: "contrato.pdf", subtitle: null,
      url: "/app/m/atlas.files/files/file-1", mimeType: "application/pdf", sizeBytes: 12345,
    });
  });

  it("resolves a file reference with null mimeType and sizeBytes when not provided", async () => {
    const deps = {
      filesService: { getById: async () => ({ id: "file-1", originalName: "data.csv" }) },
      contactsService: {}, hrService: {}, ledgerService: {}, prisma: {},
    };
    const service = createChatEntityReferencesService(deps);
    const result = await service.resolveEntityRefs({
      authUserId: "auth-1",
      entityRefs: [{ entityType: "file", recordId: "file-1" }],
    });
    assert.deepEqual(result[0], {
      entityType: "file", recordId: "file-1", title: "data.csv", subtitle: null,
      url: "/app/m/atlas.files/files/file-1", mimeType: null, sizeBytes: null,
    });
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
    assert.equal(result[0].subtitle, null);
    assert.equal(result[0].photoFileId, null);
  });

  it("resolves an hr_employee reference's subtitle and photo from the richer row shape", async () => {
    const deps = {
      hrService: { getEmployee: async () => ({
        id: "emp-1", firstName: "Grace", lastName: "Hopper",
        jobTitleRef: { id: "jt-1", name: "Ingeniera de Software" },
        departmentRef: { id: "d-1", name: "Ingenieria" },
        profileImageFileId: "file-photo-1",
        userProfile: { id: "up-1", avatarFileId: "file-avatar-1" },
      }) },
      contactsService: {}, filesService: {}, ledgerService: {}, prisma: {},
    };
    const service = createChatEntityReferencesService(deps);
    const result = await service.resolveEntityRefs({
      authUserId: "auth-1",
      entityRefs: [{ entityType: "hr_employee", recordId: "emp-1" }],
    });
    // Prefers jobTitleRef over the plain department, and the employee's own
    // profileImageFileId over the linked account's avatar.
    assert.equal(result[0].subtitle, "Ingeniera de Software");
    assert.equal(result[0].photoFileId, "file-photo-1");
  });

  it("falls back to userProfile.avatarFileId and department when hr_employee has no jobTitleRef/photo of its own", async () => {
    const deps = {
      hrService: { getEmployee: async () => ({
        id: "emp-1", firstName: "Grace", lastName: "Hopper",
        department: "Ingenieria",
        userProfile: { id: "up-1", avatarFileId: "file-avatar-1" },
      }) },
      contactsService: {}, filesService: {}, ledgerService: {}, prisma: {},
    };
    const service = createChatEntityReferencesService(deps);
    const result = await service.resolveEntityRefs({
      authUserId: "auth-1",
      entityRefs: [{ entityType: "hr_employee", recordId: "emp-1" }],
    });
    assert.equal(result[0].subtitle, "Ingenieria");
    assert.equal(result[0].photoFileId, "file-avatar-1");
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
    assert.equal(result[0].subtitle, "BBVA");
    assert.equal(result[0].currency, null);
    assert.equal(result[0].balance, null);
  });

  it("resolves a ledger_account reference's masked account number, currency, and balance from the raw-query row shape", async () => {
    const prisma = {
      userProfile: { findUnique: async () => ({ id: "profile-1" }) },
      membership: { findFirst: async () => ({ companyId: "company-1" }) },
    };
    const deps = {
      ledgerService: { getAccount: async () => ({
        id: "acct-1", name: "Cuenta principal", bank: "BBVA",
        account_number: "0123456789", currency: "MXN", current_balance: "1250.50",
      }) },
      contactsService: {}, filesService: {}, hrService: {}, prisma,
    };
    const service = createChatEntityReferencesService(deps);
    const result = await service.resolveEntityRefs({
      authUserId: "auth-1",
      entityRefs: [{ entityType: "ledger_account", recordId: "acct-1" }],
    });
    assert.equal(result[0].subtitle, "BBVA · ····6789");
    assert.equal(result[0].currency, "MXN");
    assert.equal(result[0].balance, 1250.5);
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
