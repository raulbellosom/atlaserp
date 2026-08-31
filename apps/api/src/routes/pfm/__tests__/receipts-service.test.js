// apps/api/src/routes/pfm/__tests__/receipts-service.test.js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createReceiptsService } from "../receipts-service.js";
import { PfmServiceError } from "../service-helpers.js";

const COMPANY = "01900000-0000-7000-8000-000000000401";
const OWNER = "01900000-0000-7000-8000-000000000402";
const OTHER = "01900000-0000-7000-8000-000000000403";
const RECEIPT = "01900000-0000-7000-8000-000000000404";
const FILE = "01900000-0000-7000-8000-000000000405";
const WALLET = "01900000-0000-7000-8000-000000000406";

function baseDeps(over = {}) {
  return {
    prisma: {
      pfmReceipt: {
        create: async ({ data }) => ({ id: RECEIPT, ...data }),
        findFirst: async () => ({
          id: RECEIPT,
          companyId: COMPANY,
          ownerId: OWNER,
          fileId: FILE,
          status: "PARSED",
          attempts: 1,
          parsed: { merchant: "OXXO", total: 89.5, date: "2026-08-15" },
        }),
        findUnique: async () => ({ id: RECEIPT, fileId: FILE, status: "PROCESSING", attempts: 0 }),
        update: async ({ data }) => ({ id: RECEIPT, ...data }),
      },
      fileAsset: {
        findUnique: async () => ({
          id: FILE,
          bucket: "atlas-files",
          objectKey: "k",
          mimeType: "image/jpeg",
        }),
      },
      ...over.prisma,
    },
    vision: {
      provider: "groq",
      extractReceipt: async () => ({
        parsed: {
          merchant: "OXXO",
          total: 89.5,
          currency: "MXN",
          date: "2026-08-15",
          taxAmount: null,
          lines: [],
          confidence: 0.9,
        },
        rawResponse: { ok: true },
        model: "m",
      }),
      ...over.vision,
    },
    supabaseAdmin: {
      storage: {
        from: () => ({
          download: async () => ({
            data: { arrayBuffer: async () => new ArrayBuffer(8) },
            error: null,
          }),
        }),
      },
      ...over.supabaseAdmin,
    },
    movements: {
      createMovement: async ({ data }) => ({ id: "mov1", ...data }),
      ...over.movements,
    },
    wallets: { canWriteWallet: async () => true, ...over.wallets },
  };
}

describe("receipts-service", () => {
  it("getReceipt is not a cross-tenant leak (404 for a different owner)", async () => {
    const d = baseDeps({ prisma: { pfmReceipt: { findFirst: async () => null } } });
    const svc = createReceiptsService(d);
    await assert.rejects(
      () => svc.getReceipt({ companyId: COMPANY, actorId: OTHER, receiptId: RECEIPT }),
      (e) => e instanceof PfmServiceError && e.status === 404,
    );
  });

  it("processReceipt moves PROCESSING -> PARSED and stores parsed + model, bumping attempts", async () => {
    let updated = null;
    const d = baseDeps({
      prisma: {
        pfmReceipt: {
          findUnique: async () => ({ id: RECEIPT, fileId: FILE, status: "PROCESSING", attempts: 0 }),
          update: async ({ data }) => ((updated = data), { id: RECEIPT, ...data }),
        },
        fileAsset: {
          findUnique: async () => ({ id: FILE, bucket: "atlas-files", objectKey: "k", mimeType: "image/jpeg" }),
        },
      },
    });
    const svc = createReceiptsService(d);
    await svc.processReceipt({ receiptId: RECEIPT });
    assert.equal(updated.status, "PARSED");
    assert.equal(updated.parsed.merchant, "OXXO");
    assert.equal(updated.attempts, 1);
  });

  it("processReceipt moves PROCESSING -> FAILED with errorReason when the adapter throws", async () => {
    let updated = null;
    const d = baseDeps({
      vision: {
        provider: "groq",
        extractReceipt: async () => {
          throw new Error("modelo no disponible");
        },
      },
      prisma: {
        pfmReceipt: {
          findUnique: async () => ({ id: RECEIPT, fileId: FILE, status: "PROCESSING", attempts: 2 }),
          update: async ({ data }) => ((updated = data), { id: RECEIPT, ...data }),
        },
        fileAsset: {
          findUnique: async () => ({ id: FILE, bucket: "atlas-files", objectKey: "k", mimeType: "image/jpeg" }),
        },
      },
    });
    const svc = createReceiptsService(d);
    await svc.processReceipt({ receiptId: RECEIPT });
    assert.equal(updated.status, "FAILED");
    assert.match(updated.errorReason, /modelo no disponible/);
    assert.equal(updated.attempts, 3);
  });

  it("confirmReceipt creates the movement and marks the receipt CONFIRMED + movementId", async () => {
    let movement = null;
    let receiptPatch = null;
    const d = baseDeps({
      movements: {
        createMovement: async (args) => ((movement = args), { id: "mov1" }),
      },
      prisma: {
        pfmReceipt: {
          findFirst: async () => ({
            id: RECEIPT,
            companyId: COMPANY,
            ownerId: OWNER,
            fileId: FILE,
            status: "PARSED",
          }),
          update: async ({ data }) => ((receiptPatch = data), { id: RECEIPT, ...data }),
        },
      },
    });
    const svc = createReceiptsService(d);
    await svc.confirmReceipt({
      companyId: COMPANY,
      actorId: OWNER,
      receiptId: RECEIPT,
      data: {
        walletId: WALLET,
        direction: "EXPENSE",
        amount: 89.5,
        occurredOn: "2026-08-15",
        categoryId: null,
      },
    });
    assert.equal(movement.walletId, WALLET);
    assert.equal(movement.data.receiptId, RECEIPT);
    assert.equal(receiptPatch.status, "CONFIRMED");
    assert.equal(receiptPatch.movementId, "mov1");
  });

  it("retryReceipt resets a FAILED receipt to PROCESSING with attempts 0", async () => {
    let patch = null;
    const d = baseDeps({
      prisma: {
        pfmReceipt: {
          findFirst: async () => ({ id: RECEIPT, companyId: COMPANY, ownerId: OWNER, status: "FAILED" }),
          update: async ({ data }) => ((patch = data), { id: RECEIPT, ...data }),
        },
      },
    });
    const svc = createReceiptsService(d);
    await svc.retryReceipt({ companyId: COMPANY, actorId: OWNER, receiptId: RECEIPT });
    assert.equal(patch.status, "PROCESSING");
    assert.equal(patch.attempts, 0);
    assert.equal(patch.errorReason, null);
  });
});
