# atlas.pfm — Phase 3 — Plan A (API: receipt capture + Groq vision) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upload a receipt photo, have a vision LLM (Groq / Llama vision by default, behind a swappable adapter) extract merchant / total / date / tax / line items, and turn the parsed result into a `PENDING`-then-confirmed `PfmMovement` — processed by a worker tick, not inline in the HTTP request.

**Architecture:** Continues Phase 2. `vision-service.js` is the repo's **first AI integration**: `createVisionService({ env })` returns `{ extractReceipt({ imageBase64, mimeType }) }`, with a `GroqVisionAdapter` calling Groq's OpenAI-compatible endpoint. All config from env; with no `GROQ_API_KEY` the module still boots and receipt upload returns 503. `receipts-service.js` owns the state machine `PROCESSING -> PARSED | FAILED -> CONFIRMED`. `POST /pfm/receipts` uploads the image through the existing `filesService.upload(...)` (bucket `atlas-files`, private) and creates the row; a worker tick `runPfmReceiptTick()` (~30 s) downloads the image, calls the adapter, and stores the parse. Confirm creates the movement and links the receipt.

**Tech Stack:** Node.js + Hono, Prisma 7 + PostgreSQL, Zod, `node --test` (mocked prisma + mocked `fetch`), Supabase Storage via `supabaseAdmin`, `apps/worker` setInterval ticks.

**Spec:** `docs/superpowers/specs/2026-08-31-atlas-pfm-design.md` (sections 3.7, 6). **Prereq:** Phases 1-2 merged.

**Environment note:** Task 1 applies a migration to the live Supabase DB via hand-written SQL + `pnpm exec prisma migrate deploy`. Task 3 documents new env vars; end-to-end vision testing needs a real `GROQ_API_KEY` in `.env` (the user supplies it) — every automated test in this plan mocks the network.

---

## File Structure

- `prisma/schema.prisma` — `PfmReceipt` model + enum `PfmReceiptStatus` (modify).
- `prisma/migrations/20260831020000_atlas_pfm_phase3/migration.sql` (create).
- `apps/api/src/services/vision-service.js` — adapter interface + `GroqVisionAdapter` (create).
- `apps/api/src/routes/pfm/receipts-service.js` — state machine, `processReceipt`, `confirmReceipt` (create).
- `apps/api/src/routes/pfm/receipts-routes.js` — multipart upload + list/detail/confirm/retry (create).
- `apps/api/src/routes/pfm/validators.js` — `confirmReceiptSchema` (modify).
- `apps/api/src/routes/pfm/index.js` — accept `supabaseAdmin` + `filesService`, compose receipts (modify).
- `apps/api/src/index.js` — pass `supabaseAdmin` + `filesService` into `createPfmRouter` (modify).
- `apps/worker/src/index.js` — `runPfmReceiptTick()` + interval (modify).
- `packages/sdk/src/index.js` — receipt methods (modify).
- `.env.example`, `CLAUDE.md`, `docs/superpowers/specs/2026-08-30-dependencies-secrets-shared-infra-audit.md` — new env vars (modify).
- Tests: `vision-service.test.js`, `receipts-service.test.js` (create).

---

## Task 1: Schema + migration

**Files:** `prisma/schema.prisma`, `prisma/migrations/20260831020000_atlas_pfm_phase3/migration.sql`

- [ ] **Step 1: Add to `prisma/schema.prisma`** — enum + model (after `PfmRecurringRule`):

```prisma
enum PfmReceiptStatus {
  PROCESSING
  PARSED
  FAILED
  CONFIRMED

  @@map("pfm_receipt_status")
}

model PfmReceipt {
  id          String           @id @default(uuid(7)) @db.Uuid
  companyId   String           @map("company_id") @db.Uuid
  ownerId     String           @map("owner_id") @db.Uuid
  fileId      String           @map("file_id") @db.Uuid
  status      PfmReceiptStatus  @default(PROCESSING)
  provider    String           @default("groq")
  model       String?
  rawResponse Json?            @map("raw_response")
  parsed      Json?
  movementId  String?          @map("movement_id") @db.Uuid
  errorReason String?          @map("error_reason")
  attempts    Int              @default(0)
  enabled     Boolean          @default(true)
  createdAt   DateTime         @default(now()) @map("created_at")
  updatedAt   DateTime         @updatedAt @map("updated_at")

  @@index([status, enabled])
  @@index([ownerId, createdAt])
  @@map("pfm_receipt")
}
```

- [ ] **Step 2** — `pnpm exec prisma validate` → `valid 🚀`.

- [ ] **Step 3: Write the migration SQL** at `prisma/migrations/20260831020000_atlas_pfm_phase3/migration.sql`:

```sql
-- atlas.pfm — Finanzas personales (Phase 3: receipt capture)

-- CreateEnum
CREATE TYPE "pfm_receipt_status" AS ENUM ('PROCESSING', 'PARSED', 'FAILED', 'CONFIRMED');

-- CreateTable
CREATE TABLE "pfm_receipt" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "company_id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "file_id" UUID NOT NULL,
    "status" "pfm_receipt_status" NOT NULL DEFAULT 'PROCESSING',
    "provider" TEXT NOT NULL DEFAULT 'groq',
    "model" TEXT,
    "raw_response" JSONB,
    "parsed" JSONB,
    "movement_id" UUID,
    "error_reason" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pfm_receipt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pfm_receipt_status_enabled_idx" ON "pfm_receipt"("status", "enabled");

-- CreateIndex
CREATE INDEX "pfm_receipt_owner_id_created_at_idx" ON "pfm_receipt"("owner_id", "created_at");
```

- [ ] **Step 4** — `pnpm exec prisma migrate deploy` → "successfully applied"; `pnpm db:generate` → OK.
- [ ] **Step 5** — verify: `node --input-type=module -e "import 'dotenv/config'; import pkg from '@prisma/client'; import { PrismaPg } from '@prisma/adapter-pg'; const p=new pkg.PrismaClient({adapter:new PrismaPg({connectionString:process.env.DATABASE_URL})}); console.log('receipts', await p.pfmReceipt.count()); await p.\$disconnect();"` → `receipts 0`.
- [ ] **Step 6** — `git add prisma/schema.prisma prisma/migrations && git commit -m "feat(pfm): PfmReceipt model + migration (phase 3)"`

---

## Task 2: `vision-service.js` (test first)

**Files:** `apps/api/src/services/vision-service.js`, `apps/api/src/services/__tests__/vision-service.test.js`

- [ ] **Step 1: Write the failing test**

```js
// apps/api/src/services/__tests__/vision-service.test.js
import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { createVisionService, VisionServiceError } from "../vision-service.js";

const IMG = Buffer.from("fake-jpeg").toString("base64");

function groqBody(content) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ model: "test-model", choices: [{ message: { content } }] }),
    text: async () => "",
  };
}

describe("vision-service", () => {
  it("throws a 503 VisionServiceError when GROQ_API_KEY is not set", async () => {
    const svc = createVisionService({ env: { PFM_VISION_PROVIDER: "groq" } });
    await assert.rejects(
      () => svc.extractReceipt({ imageBase64: IMG, mimeType: "image/jpeg" }),
      (e) => e instanceof VisionServiceError && e.status === 503,
    );
  });

  it("parses a JSON receipt payload from the model response", async () => {
    const fetchMock = mock.fn(async () =>
      groqBody(
        JSON.stringify({
          merchant: "OXXO",
          total: 89.5,
          currency: "MXN",
          date: "2026-08-15",
          taxAmount: 12.34,
          lines: [{ description: "Sabritas", amount: 20 }],
          confidence: 0.9,
        }),
      ),
    );
    const svc = createVisionService({
      env: { GROQ_API_KEY: "k", PFM_VISION_MODEL: "m" },
      fetchImpl: fetchMock,
    });
    const res = await svc.extractReceipt({ imageBase64: IMG, mimeType: "image/jpeg" });
    assert.equal(res.parsed.merchant, "OXXO");
    assert.equal(res.parsed.total, 89.5);
    assert.equal(res.parsed.currency, "MXN");
    assert.equal(res.model, "test-model");
    assert.equal(fetchMock.mock.callCount(), 1);
    const [url, opts] = fetchMock.mock.calls[0].arguments;
    assert.match(url, /groq\.com/);
    assert.match(opts.headers.Authorization, /^Bearer /);
  });

  it("tolerates a model that wraps JSON in prose / code fences", async () => {
    const fetchMock = mock.fn(async () =>
      groqBody('Aqui esta:\n```json\n{"merchant":"Rappi","total":150,"currency":"MXN","date":null,"taxAmount":null,"lines":[],"confidence":0.7}\n```'),
    );
    const svc = createVisionService({ env: { GROQ_API_KEY: "k" }, fetchImpl: fetchMock });
    const res = await svc.extractReceipt({ imageBase64: IMG, mimeType: "image/jpeg" });
    assert.equal(res.parsed.merchant, "Rappi");
    assert.equal(res.parsed.total, 150);
  });

  it("retries once on HTTP 429 then succeeds", async () => {
    let n = 0;
    const fetchMock = mock.fn(async () => {
      n += 1;
      if (n === 1) return { ok: false, status: 429, text: async () => "rate limited", json: async () => ({}) };
      return groqBody('{"merchant":"CFE","total":540,"currency":"MXN","date":null,"taxAmount":null,"lines":[],"confidence":0.8}');
    });
    const svc = createVisionService({
      env: { GROQ_API_KEY: "k", PFM_VISION_RETRY_DELAY_MS: "1" },
      fetchImpl: fetchMock,
    });
    const res = await svc.extractReceipt({ imageBase64: IMG, mimeType: "image/jpeg" });
    assert.equal(res.parsed.merchant, "CFE");
    assert.equal(fetchMock.mock.callCount(), 2);
  });

  it("throws VisionServiceError when the response is not JSON at all", async () => {
    const fetchMock = mock.fn(async () => groqBody("no pude leer el ticket"));
    const svc = createVisionService({ env: { GROQ_API_KEY: "k" }, fetchImpl: fetchMock });
    await assert.rejects(
      () => svc.extractReceipt({ imageBase64: IMG, mimeType: "image/jpeg" }),
      (e) => e instanceof VisionServiceError,
    );
  });
});
```

- [ ] **Step 2** — `node --test "apps/api/src/services/__tests__/vision-service.test.js"` → FAIL (module missing).

- [ ] **Step 3: Write `vision-service.js`**

```js
// apps/api/src/services/vision-service.js
//
// First AI integration in the repo. Vision LLM adapter for atlas.pfm receipt
// parsing. Provider + model + key all come from env; with no key the caller
// gets a 503 and the module still boots.

export class VisionServiceError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.name = "VisionServiceError";
    this.status = status;
  }
}

const RECEIPT_SYSTEM_PROMPT = [
  "Eres un extractor de datos de tickets de compra en español (México).",
  "Devuelve UNICAMENTE un objeto JSON valido, sin texto adicional, con esta forma:",
  '{"merchant": string|null, "total": number|null, "currency": string|null,',
  '"date": string|null (formato ISO YYYY-MM-DD), "taxAmount": number|null,',
  '"lines": [{"description": string, "amount": number}], "confidence": number (0..1)}',
  "Si un campo no es legible, usa null. La moneda por defecto es MXN.",
  "El total es el importe final pagado, con impuestos incluidos.",
].join(" ");

function extractJsonObject(text) {
  if (typeof text !== "string") return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}

function normalizeParsed(obj) {
  const num = (v) => {
    if (v == null) return null;
    const n = Number(String(v).replace(/[^0-9.-]/g, ""));
    return Number.isFinite(n) ? n : null;
  };
  return {
    merchant: obj.merchant ? String(obj.merchant).slice(0, 160) : null,
    total: num(obj.total),
    currency: obj.currency ? String(obj.currency).toUpperCase().slice(0, 8) : "MXN",
    date: /^\d{4}-\d{2}-\d{2}$/.test(String(obj.date ?? "")) ? obj.date : null,
    taxAmount: num(obj.taxAmount),
    lines: Array.isArray(obj.lines)
      ? obj.lines
          .slice(0, 50)
          .map((l) => ({ description: String(l?.description ?? "").slice(0, 200), amount: num(l?.amount) }))
      : [],
    confidence: num(obj.confidence) ?? null,
  };
}

function createGroqAdapter({ env, fetchImpl }) {
  const apiKey = env.GROQ_API_KEY;
  const baseUrl = (env.GROQ_BASE_URL || "https://api.groq.com").replace(/\/$/, "");
  const model = env.PFM_VISION_MODEL || "meta-llama/llama-4-scout-17b-16e-instruct";
  const timeoutMs = Number(env.PFM_VISION_TIMEOUT_MS) || 20000;
  const retryDelayMs = Number(env.PFM_VISION_RETRY_DELAY_MS) || 1500;
  const fetchFn = fetchImpl ?? globalThis.fetch;

  async function call({ imageBase64, mimeType }) {
    if (!apiKey) throw new VisionServiceError("OCR no configurado (falta GROQ_API_KEY).", 503);
    const body = {
      model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: RECEIPT_SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: "Extrae los datos de este ticket." },
            {
              type: "image_url",
              image_url: { url: `data:${mimeType || "image/jpeg"};base64,${imageBase64}` },
            },
          ],
        },
      ],
    };

    let lastErr;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, retryDelayMs));
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), timeoutMs);
      let res;
      try {
        res = await fetchFn(`${baseUrl}/openai/v1/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
      } catch (err) {
        lastErr = new VisionServiceError(`No se pudo contactar al servicio de vision: ${err.message}`);
        clearTimeout(t);
        continue;
      }
      clearTimeout(t);

      if (res.status === 429 || res.status >= 500) {
        lastErr = new VisionServiceError(`El servicio de vision respondio ${res.status}.`, 502);
        continue;
      }
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new VisionServiceError(`El servicio de vision rechazo la peticion (${res.status}): ${detail.slice(0, 200)}`);
      }

      const payload = await res.json();
      const content = payload?.choices?.[0]?.message?.content;
      const obj = extractJsonObject(content);
      if (!obj) {
        throw new VisionServiceError("El servicio de vision no devolvio un JSON legible.");
      }
      return { parsed: normalizeParsed(obj), rawResponse: payload, model: payload.model ?? model };
    }
    throw lastErr ?? new VisionServiceError("El servicio de vision no respondio.");
  }

  return { call };
}

export function createVisionService({ env = process.env, fetchImpl } = {}) {
  const provider = (env.PFM_VISION_PROVIDER || "groq").toLowerCase();
  const adapter =
    provider === "groq"
      ? createGroqAdapter({ env, fetchImpl })
      : (() => {
          throw new VisionServiceError(`Proveedor de vision no soportado: ${provider}`, 500);
        })();

  return {
    provider,
    async extractReceipt({ imageBase64, mimeType }) {
      return adapter.call({ imageBase64, mimeType });
    },
  };
}
```

- [ ] **Step 4** — `node --test "apps/api/src/services/__tests__/vision-service.test.js"` → PASS (6).
- [ ] **Step 5** — `git add apps/api/src/services/vision-service.js apps/api/src/services/__tests__/vision-service.test.js && git commit -m "feat: vision-service (first AI integration) with Groq adapter"`

---

## Task 3: Env vars + docs

**Files:** `.env.example`, `CLAUDE.md`, `docs/superpowers/specs/2026-08-30-dependencies-secrets-shared-infra-audit.md`

- [ ] **Step 1: Append to `.env.example`** (after the Google OAuth block):

```
# atlas.pfm — receipt OCR (vision LLM). Optional: without GROQ_API_KEY the
# module still runs and receipt upload returns 503 (UI falls back to manual entry).
PFM_VISION_PROVIDER=groq
GROQ_API_KEY=
GROQ_BASE_URL=https://api.groq.com
PFM_VISION_MODEL=meta-llama/llama-4-scout-17b-16e-instruct
PFM_VISION_TIMEOUT_MS=20000
```

- [ ] **Step 2: `CLAUDE.md`** — in the "First-time setup" fenced block, add `GROQ_API_KEY` to the "Fill in ..." line:

Change `# Fill in SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL, DIRECT_URL, JWT_SECRET`
to `# Fill in SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL, DIRECT_URL, JWT_SECRET; GROQ_API_KEY optional (atlas.pfm receipt OCR)`.

- [ ] **Step 3: secrets-audit doc** — under its key list, add a row: `GROQ_API_KEY` — optional; used by `apps/api/src/services/vision-service.js` for `atlas.pfm` receipt OCR; absent → feature degrades to manual entry. Not required for boot.

- [ ] **Step 4** — `git add .env.example CLAUDE.md docs/superpowers/specs/2026-08-30-dependencies-secrets-shared-infra-audit.md && git commit -m "docs(pfm): document GROQ_API_KEY + PFM_VISION_* env vars"`

---

## Task 4: `receipts-service.js` (test first)

**Files:** `apps/api/src/routes/pfm/receipts-service.js`, `apps/api/src/routes/pfm/__tests__/receipts-service.test.js`

- [ ] **Step 1: Write the failing test**

```js
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
        update: async ({ data }) => ({ id: RECEIPT, ...data }),
      },
      fileAsset: { findUnique: async () => ({ id: FILE, bucket: "atlas-files", objectKey: "k", mimeType: "image/jpeg" }) },
      ...over.prisma,
    },
    vision: {
      extractReceipt: async () => ({
        parsed: { merchant: "OXXO", total: 89.5, currency: "MXN", date: "2026-08-15", taxAmount: null, lines: [], confidence: 0.9 },
        rawResponse: { ok: true },
        model: "m",
      }),
      ...over.vision,
    },
    supabaseAdmin: {
      storage: {
        from: () => ({ download: async () => ({ data: { arrayBuffer: async () => new ArrayBuffer(8) }, error: null }) }),
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
        extractReceipt: async () => {
          throw new Error("modelo no disponible");
        },
      },
      prisma: {
        pfmReceipt: {
          findUnique: async () => ({ id: RECEIPT, fileId: FILE, status: "PROCESSING", attempts: 2 }),
          update: async ({ data }) => ((updated = data), { id: RECEIPT, ...data }),
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
          findFirst: async () => ({ id: RECEIPT, companyId: COMPANY, ownerId: OWNER, fileId: FILE, status: "PARSED" }),
          update: async ({ data }) => ((receiptPatch = data), { id: RECEIPT, ...data }),
        },
      },
    });
    const svc = createReceiptsService(d);
    await svc.confirmReceipt({
      companyId: COMPANY,
      actorId: OWNER,
      receiptId: RECEIPT,
      data: { walletId: WALLET, direction: "EXPENSE", amount: 89.5, occurredOn: "2026-08-15", categoryId: null },
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
```

- [ ] **Step 2** — run → FAIL (module missing).

- [ ] **Step 3: Write `receipts-service.js`**

```js
// apps/api/src/routes/pfm/receipts-service.js
import { PfmServiceError, isTableNotFoundError } from "./service-helpers.js";

const NOT_INSTALLED = "El modulo de finanzas personales no esta instalado.";
const MAX_ATTEMPTS = 3;

export function createReceiptsService({ prisma, vision, supabaseAdmin, movements, wallets, filesService }) {
  async function createReceipt({ companyId, actorId, fileId }) {
    try {
      return await prisma.pfmReceipt.create({
        data: { companyId, ownerId: actorId, fileId, status: "PROCESSING", provider: vision?.provider ?? "groq" },
      });
    } catch (err) {
      if (isTableNotFoundError(err)) throw new PfmServiceError(NOT_INSTALLED, 503);
      throw err;
    }
  }

  async function listReceipts({ companyId, actorId }) {
    if (!actorId) throw new PfmServiceError("Se requiere un usuario autenticado.", 401);
    try {
      const rows = await prisma.pfmReceipt.findMany({
        where: { companyId, ownerId: actorId, enabled: true },
        orderBy: { createdAt: "desc" },
        take: 100,
      });
      return { data: rows.map(shape) };
    } catch (err) {
      if (isTableNotFoundError(err)) throw new PfmServiceError(NOT_INSTALLED, 503);
      throw err;
    }
  }

  async function getReceipt({ companyId, actorId, receiptId }) {
    const row = await prisma.pfmReceipt.findFirst({
      where: { id: receiptId, companyId, ownerId: actorId, enabled: true },
    });
    if (!row) throw new PfmServiceError("Ticket no encontrado.", 404);
    return shape(row);
  }

  // Worker entrypoint — one receipt.
  async function processReceipt({ receiptId }) {
    const receipt = await prisma.pfmReceipt.findUnique({ where: { id: receiptId } });
    if (!receipt || receipt.status !== "PROCESSING") return { skipped: true };
    const attempts = (receipt.attempts ?? 0) + 1;
    try {
      const file = await prisma.fileAsset.findUnique({ where: { id: receipt.fileId } });
      if (!file) throw new Error("archivo del ticket no encontrado");
      const dl = await supabaseAdmin.storage.from(file.bucket).download(file.objectKey);
      if (dl.error || !dl.data) throw new Error("no se pudo descargar la imagen del ticket");
      const buf = Buffer.from(await dl.data.arrayBuffer());
      const { parsed, rawResponse, model } = await vision.extractReceipt({
        imageBase64: buf.toString("base64"),
        mimeType: file.mimeType || "image/jpeg",
      });
      await prisma.pfmReceipt.update({
        where: { id: receiptId },
        data: { status: "PARSED", parsed, rawResponse, model, attempts, errorReason: null },
      });
      return { status: "PARSED" };
    } catch (err) {
      const finalFail = attempts >= MAX_ATTEMPTS;
      await prisma.pfmReceipt.update({
        where: { id: receiptId },
        data: {
          status: finalFail ? "FAILED" : "PROCESSING",
          attempts,
          errorReason: String(err?.message ?? err).slice(0, 500),
        },
      });
      return { status: finalFail ? "FAILED" : "PROCESSING" };
    }
  }

  async function confirmReceipt({ companyId, actorId, receiptId, data }) {
    const receipt = await prisma.pfmReceipt.findFirst({
      where: { id: receiptId, companyId, ownerId: actorId, enabled: true },
    });
    if (!receipt) throw new PfmServiceError("Ticket no encontrado.", 404);
    if (receipt.status === "CONFIRMED") throw new PfmServiceError("Este ticket ya fue registrado.", 409);
    const movement = await movements.createMovement({
      companyId,
      actorId,
      walletId: data.walletId,
      data: {
        direction: data.direction,
        amount: data.amount,
        occurredOn: data.occurredOn,
        categoryId: data.categoryId ?? null,
        merchant: data.merchant ?? null,
        note: data.note ?? null,
        receiptId,
        status: "POSTED",
      },
    });
    const updated = await prisma.pfmReceipt.update({
      where: { id: receiptId },
      data: { status: "CONFIRMED", movementId: movement.id },
    });
    return { receipt: shape(updated), movementId: movement.id };
  }

  async function retryReceipt({ companyId, actorId, receiptId }) {
    const receipt = await prisma.pfmReceipt.findFirst({
      where: { id: receiptId, companyId, ownerId: actorId, enabled: true },
    });
    if (!receipt) throw new PfmServiceError("Ticket no encontrado.", 404);
    if (receipt.status !== "FAILED") throw new PfmServiceError("Solo se puede reintentar un ticket con error.", 409);
    const updated = await prisma.pfmReceipt.update({
      where: { id: receiptId },
      data: { status: "PROCESSING", attempts: 0, errorReason: null },
    });
    return shape(updated);
  }

  async function processPendingBatch({ limit = 5 } = {}) {
    let rows;
    try {
      rows = await prisma.pfmReceipt.findMany({
        where: { status: "PROCESSING", enabled: true, attempts: { lt: MAX_ATTEMPTS } },
        orderBy: { createdAt: "asc" },
        take: limit,
        select: { id: true },
      });
    } catch (err) {
      if (isTableNotFoundError(err)) return { processed: 0 };
      throw err;
    }
    let processed = 0;
    for (const r of rows) {
      try {
        await processReceipt({ receiptId: r.id });
        processed += 1;
      } catch (err) {
        console.error("[atlas.pfm] processReceipt failed", r.id, err?.message ?? err);
      }
    }
    return { processed };
  }

  return {
    createReceipt,
    listReceipts,
    getReceipt,
    processReceipt,
    processPendingBatch,
    confirmReceipt,
    retryReceipt,
  };
}

function shape(row) {
  return {
    id: row.id,
    fileId: row.fileId ?? row.file_id,
    status: row.status,
    provider: row.provider,
    model: row.model ?? null,
    parsed: row.parsed ?? null,
    movementId: row.movementId ?? row.movement_id ?? null,
    errorReason: row.errorReason ?? row.error_reason ?? null,
    attempts: row.attempts ?? 0,
    createdAt: row.createdAt ?? row.created_at,
  };
}
```

- [ ] **Step 4** — run → PASS (5).
- [ ] **Step 5** — `git add apps/api/src/routes/pfm/receipts-service.js apps/api/src/routes/pfm/__tests__/receipts-service.test.js && git commit -m "feat(pfm): receipts service state machine (PROCESSING/PARSED/FAILED/CONFIRMED)"`

---

## Task 5: `confirmReceiptSchema` + `receipts-routes.js`

**Files:** `apps/api/src/routes/pfm/validators.js` (modify), `apps/api/src/routes/pfm/receipts-routes.js` (create)

- [ ] **Step 1: Append to `validators.js`**

```js
// ── Receipts (Phase 3) ───────────────────────────────────────────────────────

export const confirmReceiptSchema = z.object({
  walletId: z.string().uuid(),
  direction: z.enum(["EXPENSE", "INCOME"]),
  amount: z.number().positive().max(9_999_999_999),
  occurredOn: isoDateSchema,
  categoryId: z.string().uuid().optional().nullable(),
  merchant: z.string().max(160).optional().nullable(),
  note: z.string().max(500).optional().nullable(),
});
```

- [ ] **Step 2: Write `receipts-routes.js`**

```js
// apps/api/src/routes/pfm/receipts-routes.js
import { Hono } from "hono";
import { confirmReceiptSchema } from "./validators.js";
import {
  PfmServiceError,
  getCompanyId,
  getActorId,
  getValidationErrorMessage,
} from "./service-helpers.js";

function handleError(c, err, fallback) {
  if (err instanceof PfmServiceError) return c.json({ error: err.message }, err.status);
  if (process.env.NODE_ENV !== "production") console.error("[atlas.pfm]", err);
  return c.json({ error: fallback }, 500);
}

// `filesService` is the shared createFilesService({ prisma, supabaseAdmin }) instance.
export function createReceiptsRouter({ requirePermission, requireAnyPermission, receipts, filesService, visionConfigured }) {
  const app = new Hono();

  app.get(
    "/pfm/receipts",
    requireAnyPermission(["pfm.receipts.read", "pfm.receipts.manage"]),
    async (c) => {
      try {
        return c.json(
          await receipts.listReceipts({ companyId: getCompanyId(c), actorId: getActorId(c) }),
        );
      } catch (err) {
        return handleError(c, err, "No se pudieron listar los tickets.");
      }
    },
  );

  app.get(
    "/pfm/receipts/:id",
    requireAnyPermission(["pfm.receipts.read", "pfm.receipts.manage"]),
    async (c) => {
      try {
        return c.json({
          data: await receipts.getReceipt({
            companyId: getCompanyId(c),
            actorId: getActorId(c),
            receiptId: c.req.param("id"),
          }),
        });
      } catch (err) {
        return handleError(c, err, "No se pudo obtener el ticket.");
      }
    },
  );

  app.post("/pfm/receipts", requirePermission("pfm.receipts.manage"), async (c) => {
    try {
      if (!visionConfigured()) {
        return c.json(
          { error: "El lector de tickets con IA no esta configurado. Registra el gasto manualmente." },
          503,
        );
      }
      const form = await c.req.formData();
      const file = form.get("file");
      if (!file || typeof file === "string") {
        return c.json({ error: "Adjunta la foto del ticket." }, 400);
      }
      const authUserId = c.get("userContext")?.authUserId ?? c.get("userId");
      const asset = await filesService.upload({
        authUserId,
        file,
        fields: { moduleKey: "atlas.pfm", entityType: "PfmReceipt", visibility: "PRIVATE" },
      });
      const receipt = await receipts.createReceipt({
        companyId: getCompanyId(c),
        actorId: getActorId(c),
        fileId: asset.id ?? asset.data?.id,
      });
      return c.json({ data: { receiptId: receipt.id, status: receipt.status } }, 201);
    } catch (err) {
      return handleError(c, err, "No se pudo subir el ticket.");
    }
  });

  app.patch("/pfm/receipts/:id/confirm", requirePermission("pfm.receipts.manage"), async (c) => {
    try {
      const parsed = confirmReceiptSchema.safeParse(await c.req.json());
      if (!parsed.success) return c.json({ error: getValidationErrorMessage(parsed.error) }, 400);
      return c.json({
        data: await receipts.confirmReceipt({
          companyId: getCompanyId(c),
          actorId: getActorId(c),
          receiptId: c.req.param("id"),
          data: parsed.data,
        }),
      });
    } catch (err) {
      return handleError(c, err, "No se pudo registrar el ticket.");
    }
  });

  app.patch("/pfm/receipts/:id/retry", requirePermission("pfm.receipts.manage"), async (c) => {
    try {
      return c.json({
        data: await receipts.retryReceipt({
          companyId: getCompanyId(c),
          actorId: getActorId(c),
          receiptId: c.req.param("id"),
        }),
      });
    } catch (err) {
      return handleError(c, err, "No se pudo reintentar el ticket.");
    }
  });

  return app;
}
```

- [ ] **Step 3** — `node --check` both; run `node --test "apps/api/src/routes/pfm/__tests__/*.test.js"` (all still pass).
- [ ] **Step 4** — `git add apps/api/src/routes/pfm/validators.js apps/api/src/routes/pfm/receipts-routes.js && git commit -m "feat(pfm): receipt upload + confirm + retry routes"`

---

## Task 6: Wire `index.js` (API router) + `apps/api/src/index.js`

**Files:** `apps/api/src/routes/pfm/index.js` (modify), `apps/api/src/index.js` (modify)

- [ ] **Step 1: `apps/api/src/routes/pfm/index.js`** — accept `supabaseAdmin` + `filesService`, compose receipts:

```js
import { createReceiptsService } from "./receipts-service.js";
import { createReceiptsRouter } from "./receipts-routes.js";
import { createVisionService } from "../../services/vision-service.js";
```

Signature: `export function createPfmRouter({ prisma, requirePermission, requireAnyPermission, supabaseAdmin, filesService })`.

Inside, after `recurring`:

```js
  const vision = createVisionService({ env: process.env });
  const receipts = createReceiptsService({
    prisma,
    vision,
    supabaseAdmin,
    movements,
    wallets,
    filesService,
  });
```

Mount (guard so tests without `filesService` still build):

```js
  if (filesService) {
    app.route(
      "/",
      createReceiptsRouter({
        requirePermission,
        requireAnyPermission: anyPermission,
        receipts,
        filesService,
        visionConfigured: () => Boolean(process.env.GROQ_API_KEY),
      }),
    );
  }
```

Add `receipts` to `app.pfmServices`.

- [ ] **Step 2: `apps/api/src/index.js`** — the mount line becomes:

```js
mountWithAuth(app, createPfmRouter({ prisma, requirePermission, requireAnyPermission, supabaseAdmin, filesService }));
```

(`filesService` is already constructed in `apps/api/src/index.js` — confirm with `grep -n "filesService = createFilesService" apps/api/src/index.js`; if the local variable has a different name, use that.)

- [ ] **Step 3** — `node --check` both; boot smoke test:
```bash
node -e "import('./apps/api/src/routes/pfm/index.js').then(m => { const a = m.createPfmRouter({ prisma:{}, requirePermission:()=>(c,n)=>n(), requireAnyPermission:()=>(c,n)=>n() }); console.log('ok', typeof a.fetch, !!a.pfmServices?.receipts); })"
```
Expected: `ok function true`

- [ ] **Step 4** — `git add apps/api/src/routes/pfm/index.js apps/api/src/index.js && git commit -m "feat(pfm): compose receipts service + router"`

---

## Task 7: Worker tick

**Files:** `apps/worker/src/index.js` (modify)

- [ ] **Step 1: Imports** (near the other pfm imports):

```js
import pkgSupabase from '@supabase/supabase-js'
import { createFilesService } from '../../api/src/services/files-service.js'
import { createVisionService } from '../../api/src/services/vision-service.js'
import { createMovementsService as createPfmMovementsService } from '../../api/src/routes/pfm/wallets-service.js'  // NOTE: movements-service.js
import { createReceiptsService as createPfmReceiptsService } from '../../api/src/routes/pfm/receipts-service.js'
```

Correct that third import to `import { createMovementsService as createPfmMovementsService } from '../../api/src/routes/pfm/movements-service.js'`.

- [ ] **Step 2: Construct** (near `pfmRecurringService`):

```js
const workerSupabaseAdmin = pkgSupabase.createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)
const pfmWallets = createPfmWalletsService({ prisma })
const pfmReceiptsService = createPfmReceiptsService({
  prisma,
  vision: createVisionService({ env: process.env }),
  supabaseAdmin: workerSupabaseAdmin,
  movements: createPfmMovementsService({ prisma, wallets: pfmWallets }),
  wallets: pfmWallets,
})
const PFM_RECEIPT_INTERVAL_MS = 30 * 1000
```

(`createPfmWalletsService` is already imported in Phase 2 Task 8 — reuse it.)

- [ ] **Step 3: Tick + schedule**

```js
async function runPfmReceiptTick() {
  if (!process.env.GROQ_API_KEY) return
  try {
    const result = await pfmReceiptsService.processPendingBatch({ limit: 5 })
    if ((result?.processed ?? 0) > 0) {
      console.log(`[worker] pfm receipts ${formatLogTimestamp()} processed=${result.processed}`)
    }
  } catch (err) {
    console.error('[worker] pfm receipt tick failed:', err?.message ?? err)
    if (isConnectionError(err)) await reconnect()
  }
}

runPfmReceiptTick()
setInterval(() => {
  runPfmReceiptTick()
}, PFM_RECEIPT_INTERVAL_MS)
```

- [ ] **Step 4** — `node --check apps/worker/src/index.js`.
- [ ] **Step 5** — `git add apps/worker/src/index.js && git commit -m "feat(pfm): worker tick processes pending receipts"`

---

## Task 8: SDK

**Files:** `packages/sdk/src/index.js` (modify — `pfm` group)

- [ ] **Step 1: Add**

```js
      listReceipts: (token) =>
        request("/pfm/receipts", { headers: withAuthHeaders(token) }),
      getReceipt: (id, token) =>
        request(`/pfm/receipts/${encodeURIComponent(id)}`, { headers: withAuthHeaders(token) }),
      uploadReceipt: (formData, token) =>
        request("/pfm/receipts", {
          method: "POST",
          headers: withAuthHeaders(token),
          body: formData,
        }),
      confirmReceipt: (id, data, token) =>
        request(`/pfm/receipts/${encodeURIComponent(id)}/confirm`, {
          method: "PATCH",
          headers: withAuthHeaders(token),
          body: JSON.stringify(data),
        }),
      retryReceipt: (id, token) =>
        request(`/pfm/receipts/${encodeURIComponent(id)}/retry`, {
          method: "PATCH",
          headers: withAuthHeaders(token),
        }),
```

Note: `uploadReceipt` passes a `FormData` body — confirm `request`/`withAuthHeaders` do not force `Content-Type: application/json` for it. If they do, add a `requestForm` helper alongside `request` that omits the JSON content-type (mirror how `packages/sdk` handles `files.upload` — `grep -n "FormData\|multipart\|files:.*upload" packages/sdk/src/index.js`).

- [ ] **Step 2** — `node --check packages/sdk/src/index.js`; `node --test "packages/sdk/src/__tests__/*.test.js"` (22 pass / 1 pre-existing fail).
- [ ] **Step 3** — `git add packages/sdk/src/index.js && git commit -m "feat(pfm): SDK receipt methods"`

---

## Task 9: Sweep + live check

- [ ] **Step 1** — `node --test "apps/api/src/routes/pfm/__tests__/*.test.js"` and `node --test "apps/api/src/services/__tests__/vision-service.test.js"` → all PASS (Phase 1-2's 33 + receipts 5 + vision 6 = 44).
- [ ] **Step 2** — `pnpm build` → success.
- [ ] **Step 3 (live, no GROQ key)** — start `pnpm dev:api`; `curl -s -X POST http://localhost:4010/pfm/receipts` with a token but no key set → expect `503` and the "manual entry" message. Confirms graceful degradation.
- [ ] **Step 4 (live, WITH GROQ key — only if the user has added one)** — upload a real receipt image via a small script through `filesService` + `receipts.createReceipt` + `receipts.processReceipt`; assert `status` becomes `PARSED` and `parsed.total` is a number; then `confirmReceipt` and assert a `POSTED` `PfmMovement` with `receiptId` set. Clean up.
- [ ] **Step 5** — `git add -A && git commit -m "chore(pfm): phase 3 plan a sweep"`

---

## Self-Review

- **Spec coverage:** §3.7 `PfmReceipt` (all fields, `attempts`, status machine) → Tasks 1, 4. §6 `vision-service` (`createVisionService({ env })`, `GroqVisionAdapter`, OpenAI-compatible endpoint, base64 data-URI image part, `response_format` json_object, Spanish prompt + MXN default + "null if not legible", retry-once on 429/5xx, no key → 503) → Task 2. §6 env config (`PFM_VISION_PROVIDER`, `GROQ_API_KEY`, `GROQ_BASE_URL`, `PFM_VISION_MODEL`, `PFM_VISION_TIMEOUT_MS`) documented in `.env.example` + `CLAUDE.md` + secrets-audit → Task 3. §6.1 flow: upload to `atlas.files` private bucket (no Groq call in the request) → Task 5; worker tick downloads + calls + stores (`attempts++` every attempt) → Task 7; `PARSED` → confirm creates `POSTED` `PfmMovement` + links receipt → Task 4; `FAILED` → retry resets to `PROCESSING` attempts 0 → Task 4. SDK → Task 8.
- **Placeholder scan:** none. Task 7 Step 1 deliberately shows a wrong import then the corrected line (a real gotcha: `movements-service.js`, not `wallets-service.js`); Task 8 Step 1 flags the `FormData` content-type check with a concrete `grep` to resolve it.
- **Type consistency:** `createReceiptsService({ prisma, vision, supabaseAdmin, movements, wallets, filesService })` matches between service, `index.js`, worker, and the test's `baseDeps`. `vision.extractReceipt({ imageBase64, mimeType })` returns `{ parsed, rawResponse, model }` — consumed identically by `processReceipt`. `movements.createMovement({ companyId, actorId, walletId, data })` is the Phase 1 signature (data carries `receiptId`, `status`). `receipts.confirmReceipt(...).data` shape (`{ receipt, movementId }`) is what the SDK/Plan B consume. Permission keys `pfm.receipts.read` / `pfm.receipts.manage` already in the Phase 1 catalog + manifest.
