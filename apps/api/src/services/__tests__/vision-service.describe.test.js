// apps/api/src/services/__tests__/vision-service.describe.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { createVisionService } from "../vision-service.js";

function stubFetch(responseText) {
  return async () => ({
    ok: true,
    status: 200,
    json: async () => ({ model: "qwen/qwen3.6-27b", choices: [{ message: { content: responseText } }] }),
    text: async () => "",
  });
}

test("describeImage returns the model's prose description", async () => {
  const vs = createVisionService({ env: { GROQ_API_KEY: "k" }, fetchImpl: stubFetch("Una factura de CFE por $812.30.") });
  const out = await vs.describeImage({ imageBase64: "AAA", mimeType: "image/png", question: "¿Qué es esto?" });
  assert.equal(out.description, "Una factura de CFE por $812.30.");
});

test("describeImage without a key throws a 503 VisionServiceError", async () => {
  const vs = createVisionService({ env: {}, fetchImpl: stubFetch("x") });
  await assert.rejects(() => vs.describeImage({ imageBase64: "AAA", mimeType: "image/png" }), /no configurado|GROQ_API_KEY/);
});
