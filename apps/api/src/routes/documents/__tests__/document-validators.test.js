import assert from "node:assert/strict";
import { test } from "node:test";

import {
  documentBlocksSchema,
  validateDocumentBindings,
} from "../document-validators.js";

const providerSchema = {
  sourceType: "growth.lead",
  fields: [
    { path: "lead.name", label: "Nombre", type: "string" },
    { path: "lead.email", label: "Correo", type: "string" },
    { path: "summary.submissionCount", label: "Envios", type: "number" },
    { path: "company.logoUrl", label: "Logotipo", type: "image" },
    { path: "lead.signatureUrl", label: "Firma", type: "image" },
  ],
  collections: [
    {
      path: "submissions",
      label: "Envios",
      fields: [
        { path: "formName", label: "Formulario", type: "string" },
        { path: "submittedAt", label: "Fecha", type: "datetime" },
      ],
    },
  ],
};

test("accepts every controlled document block type", () => {
  const blocks = [
    { id: "title", type: "heading", text: "Lead {{lead.name}}", level: 1 },
    { id: "intro", type: "paragraph", text: "Correo: {{lead.email}}" },
    {
      id: "fields",
      type: "fields",
      columns: 2,
      fields: [{ label: "Nombre", value: "{{lead.name}}" }],
    },
    {
      id: "table",
      type: "table",
      collection: "submissions",
      columns: [
        { label: "Formulario", value: "formName" },
        { label: "Fecha", value: "submittedAt" },
      ],
    },
    {
      id: "totals",
      type: "totals",
      rows: [{ label: "Envios", value: "{{summary.submissionCount}}" }],
    },
    {
      id: "logo",
      type: "image",
      source: "{{company.logoUrl}}",
      width: 120,
      align: "right",
    },
    { id: "rule", type: "divider", thickness: 1, color: "#0F766E" },
    { id: "space", type: "spacer", height: 24 },
    {
      id: "signature",
      type: "signature",
      source: "{{lead.signatureUrl}}",
      label: "Firma",
    },
    { id: "break", type: "pageBreak" },
  ];

  assert.equal(documentBlocksSchema.safeParse(blocks).success, true);
  assert.deepEqual(validateDocumentBindings({ blocks, providerSchema }), []);
});

test("rejects unknown blocks and unsafe settings", () => {
  assert.equal(
    documentBlocksSchema.safeParse([
      { id: "unknown", type: "html", html: "<script>alert(1)</script>" },
    ]).success,
    false,
  );
  assert.equal(
    documentBlocksSchema.safeParse([
      { id: "heading", type: "heading", text: "Titulo", level: 8 },
    ]).success,
    false,
  );
  assert.equal(
    documentBlocksSchema.safeParse([
      { id: "space", type: "spacer", height: 5000 },
    ]).success,
    false,
  );
  assert.equal(
    documentBlocksSchema.safeParse([
      {
        id: "logo",
        type: "image",
        source: "https://attacker.invalid/logo.png",
      },
    ]).success,
    false,
  );
});

test("reports unknown bindings without evaluating expressions", () => {
  const blocks = [
    {
      id: "intro",
      type: "paragraph",
      text: "{{lead.name}} / {{lead.name.toUpperCase()}} / {{lead.secret}}",
    },
  ];

  assert.equal(documentBlocksSchema.safeParse(blocks).success, false);

  const validBlocks = [
    { id: "intro", type: "paragraph", text: "{{lead.secret}}" },
  ];
  assert.deepEqual(validateDocumentBindings({ blocks: validBlocks, providerSchema }), [
    {
      blockId: "intro",
      path: "lead.secret",
      code: "unknown_binding",
    },
  ]);
});

test("validates table collections and relative column paths", () => {
  assert.deepEqual(
    validateDocumentBindings({
      blocks: [
        {
          id: "table",
          type: "table",
          title: "{{lead.secret}}",
          collection: "activities",
          columns: [{ label: "Tipo", value: "activityType" }],
        },
      ],
      providerSchema,
    }),
    [
      {
        blockId: "table",
        path: "activities",
        code: "unknown_collection",
      },
      {
        blockId: "table",
        path: "lead.secret",
        code: "unknown_binding",
      },
    ],
  );

  assert.deepEqual(
    validateDocumentBindings({
      blocks: [
        {
          id: "table",
          type: "table",
          collection: "submissions",
          columns: [{ label: "Valores", value: "data.secret" }],
        },
      ],
      providerSchema,
    }),
    [
      {
        blockId: "table",
        path: "submissions.data.secret",
        code: "unknown_collection_field",
      },
    ],
  );
});
