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
      groqBody(
        'Aqui esta:\n```json\n{"merchant":"Rappi","total":150,"currency":"MXN","date":null,"taxAmount":null,"lines":[],"confidence":0.7}\n```',
      ),
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
      if (n === 1)
        return { ok: false, status: 429, text: async () => "rate limited", json: async () => ({}) };
      return groqBody(
        '{"merchant":"CFE","total":540,"currency":"MXN","date":null,"taxAmount":null,"lines":[],"confidence":0.8}',
      );
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
