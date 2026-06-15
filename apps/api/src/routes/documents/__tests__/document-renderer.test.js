import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createDocumentRenderPlan,
  renderDocumentPdf,
  resolveDocumentPath,
} from "../document-renderer.js";

const ONE_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

const branding = {
  companyName: "Atlas Pruebas",
  taxId: "ATP010101AA1",
  phone: "555-0101",
  email: "hola@example.com",
  website: "https://example.com",
  addressLines: ["Ciudad de Mexico"],
  primaryColor: "#0F766E",
  logoBuffer: null,
};

const data = {
  lead: {
    name: "Ada Lovelace",
    email: null,
    amount: 1234.5,
    signature: ONE_PIXEL_PNG,
  },
  company: {
    logo: ONE_PIXEL_PNG,
  },
  submissions: [
    {
      formName: "Contacto",
      submittedAt: new Date("2026-06-10T12:00:00.000Z"),
    },
  ],
};

test("resolves only safe own-property document paths", () => {
  assert.equal(resolveDocumentPath(data, "lead.name"), "Ada Lovelace");
  assert.equal(resolveDocumentPath(data, "lead.missing"), undefined);
  assert.equal(resolveDocumentPath(data, "__proto__.polluted"), undefined);
  assert.equal(resolveDocumentPath(data, "lead.constructor.name"), undefined);
});

test("builds a deterministic plan for every block type and optional values", () => {
  const plan = createDocumentRenderPlan({
    data,
    blocks: [
      { id: "h", type: "heading", text: "Lead {{lead.name}}", level: 1 },
      {
        id: "p",
        type: "paragraph",
        text: "Correo: {{lead.email}}",
      },
      {
        id: "f",
        type: "fields",
        columns: 2,
        fields: [
          { label: "Nombre", value: "{{lead.name}}" },
          { label: "Correo", value: "{{lead.email}}" },
        ],
      },
      {
        id: "t",
        type: "table",
        collection: "submissions",
        columns: [
          { label: "Formulario", value: "formName" },
          { label: "Fecha", value: "submittedAt" },
        ],
        maxRows: 100,
      },
      {
        id: "total",
        type: "totals",
        rows: [{ label: "Total", value: "{{lead.amount}}" }],
      },
      {
        id: "img",
        type: "image",
        source: "{{company.logo}}",
        width: 100,
        align: "left",
      },
      { id: "d", type: "divider", thickness: 1, color: "#0F766E" },
      { id: "s", type: "spacer", height: 20 },
      {
        id: "sig",
        type: "signature",
        source: "{{lead.signature}}",
        label: "Firma",
      },
      { id: "pb", type: "pageBreak" },
    ],
  });

  assert.equal(plan[0].text, "Lead Ada Lovelace");
  assert.equal(plan[1].text, "Correo: -");
  assert.deepEqual(
    plan[2].fields.map((field) => field.value),
    ["Ada Lovelace", "-"],
  );
  assert.equal(plan[3].rows[0][0], "Contacto");
  assert.match(plan[3].rows[0][1], /2026/);
  assert.match(plan[4].rows[0].value, /1[,.]234/);
  assert.equal(plan[5].source, ONE_PIXEL_PNG);
  assert.equal(plan[8].source, ONE_PIXEL_PNG);
  assert.equal(plan[9].type, "pageBreak");
});

test("renders branded multipage PDFs with tables and explicit page breaks", async () => {
  const rows = Array.from({ length: 120 }, (_, index) => ({
    formName: `Formulario ${index + 1}`,
    submittedAt: new Date("2026-06-10T12:00:00.000Z"),
  }));
  const result = await renderDocumentPdf({
    title: "Resumen de lead",
    subtitle: "Version 3",
    folio: "LEAD-001",
    branding,
    generatedAt: new Date("2026-06-14T12:00:00.000Z"),
    data: { ...data, submissions: rows },
    blocks: [
      { id: "h", type: "heading", text: "{{lead.name}}", level: 1 },
      {
        id: "table",
        type: "table",
        title: "Envios",
        collection: "submissions",
        columns: [
          { label: "Formulario", value: "formName" },
          { label: "Fecha", value: "submittedAt" },
        ],
        maxRows: 120,
      },
      { id: "break", type: "pageBreak" },
      { id: "end", type: "paragraph", text: "Fin del documento" },
    ],
  });

  assert.ok(Buffer.isBuffer(result.buffer));
  assert.equal(result.buffer.subarray(0, 4).toString(), "%PDF");
  assert.ok(result.buffer.length > 3000);
  assert.ok(result.pageCount >= 4);
  assert.deepEqual(result.warnings, []);
});

test("renders supported images and signatures and warns for remote images", async () => {
  const supported = await renderDocumentPdf({
    title: "Imagenes",
    branding,
    generatedAt: new Date("2026-06-14T12:00:00.000Z"),
    data,
    blocks: [
      {
        id: "logo",
        type: "image",
        source: "{{company.logo}}",
        width: 80,
        align: "center",
      },
      {
        id: "signature",
        type: "signature",
        source: "{{lead.signature}}",
        label: "Firma autorizada",
      },
    ],
  });
  assert.equal(supported.pageCount, 1);
  assert.deepEqual(supported.warnings, []);

  const unsupported = await renderDocumentPdf({
    title: "Imagen remota",
    branding,
    generatedAt: new Date("2026-06-14T12:00:00.000Z"),
    data: { imageUrl: "https://attacker.invalid/image.png" },
    blocks: [
      {
        id: "remote",
        type: "image",
        source: "{{imageUrl}}",
        width: 80,
        align: "left",
      },
    ],
  });
  assert.deepEqual(unsupported.warnings, [
    {
      blockId: "remote",
      code: "unsupported_image",
    },
  ]);
});

test("paginates long paragraphs without losing the PDF contract", async () => {
  const result = await renderDocumentPdf({
    title: "Texto largo",
    branding,
    generatedAt: new Date("2026-06-14T12:00:00.000Z"),
    data: {},
    blocks: [
      {
        id: "long",
        type: "paragraph",
        text: Array.from({ length: 2500 }, () => "contenido").join(" "),
      },
    ],
  });

  assert.ok(result.pageCount > 1);
  assert.equal(result.buffer.subarray(0, 4).toString(), "%PDF");
});
