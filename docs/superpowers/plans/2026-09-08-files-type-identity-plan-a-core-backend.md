# Plan A — Core + backend Office (CSV / binarios heredados)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que `@atlas/core` sea la fuente de verdad de tipos de archivo y que el backend Office valide y sirva `.csv`, `.xls`, `.doc`, `.ppt` además de los OOXML actuales, sin regresiones.

**Architecture:** Tabla `FILE_KINDS` + helpers en `@atlas/core`; `getOfficeFormat` gana discriminador `kind: ooxml|binary|text` conservando el `mimeType` canónico singular por compatibilidad; `validateOfficeDocument` despacha por `kind` (ZIP OOXML actual / magic CFBF / UTF-8 con topes anti-DoS); la creación de documentos en blanco se restringe a OOXML.

**Tech Stack:** JavaScript ESM, Node.js built-in test runner (`node --test`), Prisma where-objects, `yauzl`, `fast-xml-parser`.

**Spec:** `docs/superpowers/specs/2026-09-08-files-type-identity-and-more-office-formats-design.md`

---

## Notas de contexto para quien implementa

- **No hay TypeScript.** JS puro, ESM (`import`/`export`).
- Tests: `node --test <ruta>`. No hay Vitest/Jest. `assert` de `node:assert/strict`.
- `@atlas/core` se consume tanto desde `apps/api` como desde `apps/desktop`. Es un workspace pnpm; los cambios se ven sin rebuild.
- **Compatibilidad crítica:** estos sitios leen `OFFICE_FORMATS[x].mimeType` (singular) y **deben seguir funcionando**:
  - `apps/api/src/services/files-service.js:31` — `Object.values(OFFICE_FORMATS).map(f => f.mimeType)` alimenta la allowlist de subida.
  - `apps/api/src/services/files/workspace.js:114,130,145` — creación de documentos en blanco.
  - `apps/api/src/services/__tests__/office-fixture.js` — `mimeType: OFFICE_FORMATS.docx.mimeType`.
  - `apps/api/src/services/__tests__/office-wopi.test.js:183,196` y `files-workspace.test.js:11`.
  Por eso cada entrada de `OFFICE_FORMATS` **conserva `mimeType` (string canónico)** y **añade** `mimeTypes` (array) + `kind`.
- Al añadir `ppt`/`doc`/`xls`/`csv` a `OFFICE_FORMATS`, sus `mimeType` canónicos entran solos en la allowlist de subida (incluye `application/vnd.ms-powerpoint`, hoy bloqueado). No hace falta editar la allowlist a mano.

---

## Task A1: Tabla `FILE_KINDS` y helpers en `@atlas/core`

**Files:**
- Create: `packages/core/src/file-kinds.js`
- Create: `packages/core/src/__tests__/file-kinds.test.js`
- Modify: `packages/core/src/index.js`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/__tests__/file-kinds.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fileKindOf,
  fileKindLabel,
  fileKindAccent,
  fileKindWhereClauses,
} from '../file-kinds.js';

test('fileKindOf resolves by exact mime type', () => {
  assert.equal(fileKindOf({ originalName: 'a.pdf', mimeType: 'application/pdf' }), 'pdf');
  assert.equal(fileKindOf({ originalName: 'a.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), 'doc');
  assert.equal(fileKindOf({ originalName: 'a.xls', mimeType: 'application/vnd.ms-excel' }), 'sheet');
});

test('fileKindOf resolves by mime prefix', () => {
  assert.equal(fileKindOf({ originalName: 'p.heic', mimeType: 'image/heic' }), 'image');
  assert.equal(fileKindOf({ originalName: 'clip.mkv', mimeType: 'video/x-matroska' }), 'video');
  assert.equal(fileKindOf({ originalName: 'song.flac', mimeType: 'audio/flac' }), 'audio');
});

test('fileKindOf falls back to extension when mime is generic or empty', () => {
  assert.equal(fileKindOf({ originalName: 'ledger.csv', mimeType: 'text/plain' }), 'csv');
  assert.equal(fileKindOf({ originalName: 'ledger.csv', mimeType: 'application/octet-stream' }), 'csv');
  assert.equal(fileKindOf({ originalName: 'ledger.csv', mimeType: '' }), 'csv');
  assert.equal(fileKindOf({ originalName: 'data.tsv', mimeType: '' }), 'csv');
  assert.equal(fileKindOf({ originalName: 'notes.md', mimeType: '' }), 'text');
  assert.equal(fileKindOf({ originalName: 'archive.zip', mimeType: 'application/octet-stream' }), 'archive');
});

test('fileKindOf: csv wins over sheet/text even with a spreadsheet mime', () => {
  assert.equal(fileKindOf({ originalName: 'x.csv', mimeType: 'application/vnd.ms-excel' }), 'csv');
});

test('fileKindOf: text kind excludes csv/tsv', () => {
  assert.equal(fileKindOf({ originalName: 'x.csv', mimeType: 'text/csv' }), 'csv');
});

test('fileKindOf returns generic for the unknown', () => {
  assert.equal(fileKindOf({ originalName: 'firmware.bin', mimeType: 'application/octet-stream' }), 'generic');
  assert.equal(fileKindOf({}), 'generic');
});

test('fileKindLabel and fileKindAccent', () => {
  assert.equal(fileKindLabel('csv'), 'CSV');
  assert.equal(fileKindLabel('presentation'), 'Presentación');
  assert.equal(fileKindLabel('nonsense'), 'Archivo');
  assert.match(fileKindAccent('sheet'), /^#[0-9a-f]{6}$/i);
  assert.notEqual(fileKindAccent('doc', { dark: true }), fileKindAccent('doc', { dark: false }));
});

test('fileKindWhereClauses exposes a csv clause and keeps csv out of sheet/text', () => {
  const clauses = fileKindWhereClauses();
  assert.ok(clauses.csv, 'csv clause exists');
  const sheetJson = JSON.stringify(clauses.sheet);
  assert.ok(!sheetJson.includes('text/csv'), 'sheet no longer matches text/csv');
  const textJson = JSON.stringify(clauses.text);
  assert.ok(textJson.includes('text/csv'), 'text still explicitly excludes text/csv');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test packages/core/src/__tests__/file-kinds.test.js`
Expected: FAIL — `Cannot find module '../file-kinds.js'`.

- [ ] **Step 3: Create `packages/core/src/file-kinds.js`**

```js
// Single source of truth for file-type classification, shared by the API
// (Prisma where-clauses) and the desktop app (list rendering + filters).

export const FILE_KINDS = Object.freeze({
  image: { label: 'Imagen', accent: '#0d9488', accentDark: '#2dd4bf', mimePrefixes: ['image/'], mimeTypes: [], extensions: [] },
  video: { label: 'Video', accent: '#7c3aed', accentDark: '#a78bfa', mimePrefixes: ['video/'], mimeTypes: [], extensions: [] },
  audio: { label: 'Audio', accent: '#db2777', accentDark: '#f472b6', mimePrefixes: ['audio/'], mimeTypes: [], extensions: [] },
  pdf: { label: 'PDF', accent: '#dc2626', accentDark: '#f87171', mimePrefixes: [], mimeTypes: ['application/pdf'], extensions: ['pdf'] },
  csv: {
    label: 'CSV', accent: '#0f7b6c', accentDark: '#5bbfae',
    mimePrefixes: [], mimeTypes: ['text/csv', 'application/csv'], extensions: ['csv', 'tsv'],
  },
  sheet: {
    label: 'Hoja de cálculo', accent: '#107c41', accentDark: '#57c78e',
    mimePrefixes: ['application/vnd.openxmlformats-officedocument.spreadsheetml'],
    mimeTypes: ['application/vnd.ms-excel'], extensions: ['xlsx', 'xls'],
  },
  doc: {
    label: 'Documento', accent: '#185abd', accentDark: '#6aa5f8',
    mimePrefixes: ['application/vnd.openxmlformats-officedocument.wordprocessingml'],
    mimeTypes: ['application/msword'], extensions: ['docx', 'doc'],
  },
  presentation: {
    label: 'Presentación', accent: '#b7472a', accentDark: '#f69d82',
    mimePrefixes: ['application/vnd.openxmlformats-officedocument.presentationml'],
    mimeTypes: ['application/vnd.ms-powerpoint'], extensions: ['pptx', 'ppt'],
  },
  archive: {
    label: 'Comprimido', accent: '#a16207', accentDark: '#d4a017',
    mimePrefixes: [],
    mimeTypes: ['application/zip', 'application/x-7z-compressed', 'application/x-rar-compressed', 'application/gzip', 'application/x-tar'],
    extensions: ['zip', '7z', 'rar', 'gz', 'tar'],
  },
  text: {
    label: 'Texto', accent: '#475569', accentDark: '#94a3b8',
    mimePrefixes: ['text/'], mimeTypes: ['application/json'], extensions: ['txt', 'md', 'log', 'json'],
  },
  generic: { label: 'Archivo', accent: '#64748b', accentDark: '#94a3b8', mimePrefixes: [], mimeTypes: [], extensions: [] },
});

// Evaluation priority. csv before sheet/text so a .csv with a spreadsheet or
// text/plain mime still lands on csv. generic is the fallback, never matched here.
const KIND_PRIORITY = ['image', 'video', 'audio', 'pdf', 'csv', 'sheet', 'doc', 'presentation', 'archive', 'text'];

function extensionOf(name = '') {
  const clean = String(name || '').trim().toLowerCase();
  const dot = clean.lastIndexOf('.');
  return dot > 0 && dot < clean.length - 1 ? clean.slice(dot + 1) : '';
}

export function fileKindOf(file = {}) {
  const mime = String(file?.mimeType || '').toLowerCase().split(';')[0].trim();
  const ext = extensionOf(file?.originalName ?? file?.fileName ?? file?.name ?? '');
  const genericMime = !mime || mime === 'application/octet-stream';

  for (const kind of KIND_PRIORITY) {
    const def = FILE_KINDS[kind];
    if (kind === 'text' && (ext === 'csv' || ext === 'tsv')) continue;
    if (!genericMime && def.mimeTypes.includes(mime)) return kind;
    if (!genericMime && def.mimePrefixes.some((p) => mime.startsWith(p))) return kind;
    if (ext && def.extensions.includes(ext)) return kind;
  }
  return 'generic';
}

export function fileKindLabel(kind) {
  return FILE_KINDS[kind]?.label ?? FILE_KINDS.generic.label;
}

export function fileKindAccent(kind, { dark = false } = {}) {
  const def = FILE_KINDS[kind] ?? FILE_KINDS.generic;
  return dark ? def.accentDark : def.accent;
}

// Prisma where-clause per kind, MIME-only (the DB has no separate extension
// column; the server keeps its historical mime-only selectivity, the client
// additionally uses the extension fallback in fileKindOf).
export function fileKindWhereClauses() {
  const mimeClause = (def) => {
    const parts = [
      ...def.mimeTypes.map((m) => ({ mimeType: m })),
      ...def.mimePrefixes.map((p) => ({ mimeType: { startsWith: p } })),
    ];
    return parts.length === 1 ? parts[0] : { OR: parts };
  };
  const clauses = {};
  for (const [kind, def] of Object.entries(FILE_KINDS)) {
    if (kind === 'generic') continue;
    if (kind === 'text') {
      clauses.text = {
        AND: [
          { OR: [{ mimeType: { startsWith: 'text/' } }, { mimeType: 'application/json' }] },
          { NOT: { mimeType: 'text/csv' } },
        ],
      };
      continue;
    }
    clauses[kind] = mimeClause(def);
  }
  return clauses;
}
```

- [ ] **Step 4: Export from `packages/core/src/index.js`**

Add after the `office-formats.js` line:

```js
export * from './file-kinds.js'
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --test packages/core/src/__tests__/file-kinds.test.js`
Expected: PASS (all tests).

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/file-kinds.js packages/core/src/__tests__/file-kinds.test.js packages/core/src/index.js
git commit -m "feat(core): FILE_KINDS table + fileKindOf/label/accent/whereClauses"
```

---

## Task A2: `getOfficeFormat` con discriminador `kind` y formatos nuevos

**Files:**
- Modify: `packages/core/src/office-formats.js`
- Create: `packages/core/src/__tests__/office-formats.test.js`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/__tests__/office-formats.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OFFICE_FORMATS, getOfficeFormat } from '../office-formats.js';

test('every catalog entry keeps a canonical singular mimeType and declares a kind', () => {
  for (const [ext, format] of Object.entries(OFFICE_FORMATS)) {
    assert.equal(typeof format.mimeType, 'string', `${ext}.mimeType`);
    assert.ok(Array.isArray(format.mimeTypes) && format.mimeTypes.includes(format.mimeType), `${ext}.mimeTypes`);
    assert.ok(['ooxml', 'binary', 'text'].includes(format.kind), `${ext}.kind`);
  }
});

test('OOXML formats: exact mime required', () => {
  assert.equal(getOfficeFormat({ originalName: 'a.docx', mimeType: OFFICE_FORMATS.docx.mimeType })?.kind, 'ooxml');
  assert.equal(getOfficeFormat({ originalName: 'a.docx', mimeType: 'text/plain' }), null);
});

test('legacy binary formats resolve by their canonical mime', () => {
  assert.equal(getOfficeFormat({ originalName: 'a.doc', mimeType: 'application/msword' })?.kind, 'binary');
  assert.equal(getOfficeFormat({ originalName: 'a.xls', mimeType: 'application/vnd.ms-excel' })?.kind, 'binary');
  assert.equal(getOfficeFormat({ originalName: 'a.ppt', mimeType: 'application/vnd.ms-powerpoint' })?.kind, 'binary');
  assert.equal(getOfficeFormat({ originalName: 'a.doc', mimeType: 'application/pdf' }), null);
});

test('csv resolves for its mime set and for empty/generic mime, but not for a concrete mismatch', () => {
  for (const mime of ['text/csv', 'application/csv', 'application/vnd.ms-excel', 'text/plain', '', 'application/octet-stream']) {
    assert.equal(getOfficeFormat({ originalName: 'ledger.csv', mimeType: mime })?.kind, 'text', `mime=${mime}`);
  }
  assert.equal(getOfficeFormat({ originalName: 'ledger.csv', mimeType: 'application/pdf' }), null);
  assert.equal(getOfficeFormat({ originalName: 'ledger.csv', mimeType: 'image/png' }), null);
});

test('rejects unsupported extensions and unsafe names', () => {
  assert.equal(getOfficeFormat({ originalName: 'a.exe', mimeType: 'application/octet-stream' }), null);
  assert.equal(getOfficeFormat({ originalName: '../a.docx', mimeType: OFFICE_FORMATS.docx.mimeType }), null);
  assert.equal(getOfficeFormat({ originalName: 'a .csv', mimeType: 'text/csv' }), null);
});

test('returned shape carries extension, kind and label', () => {
  const f = getOfficeFormat({ originalName: 'q.csv', mimeType: 'text/csv' });
  assert.equal(f.extension, 'csv');
  assert.equal(f.label, 'CSV');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test packages/core/src/__tests__/office-formats.test.js`
Expected: FAIL — `getOfficeFormat` returns `null` for `.doc`/`.csv`, and entries have no `kind`.

- [ ] **Step 3: Rewrite `packages/core/src/office-formats.js`**

```js
export const OFFICE_FORMATS = Object.freeze({
  docx: {
    kind: 'ooxml', extension: 'docx', label: 'Documento',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    mimeTypes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    part: 'word/document.xml',
    contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml',
  },
  xlsx: {
    kind: 'ooxml', extension: 'xlsx', label: 'Hoja de cálculo',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    mimeTypes: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    part: 'xl/workbook.xml',
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml',
  },
  pptx: {
    kind: 'ooxml', extension: 'pptx', label: 'Presentación',
    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    mimeTypes: ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
    part: 'ppt/presentation.xml',
    contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml',
  },
  doc: {
    kind: 'binary', extension: 'doc', label: 'Documento',
    mimeType: 'application/msword', mimeTypes: ['application/msword'],
  },
  xls: {
    kind: 'binary', extension: 'xls', label: 'Hoja de cálculo',
    mimeType: 'application/vnd.ms-excel', mimeTypes: ['application/vnd.ms-excel'],
  },
  ppt: {
    kind: 'binary', extension: 'ppt', label: 'Presentación',
    mimeType: 'application/vnd.ms-powerpoint', mimeTypes: ['application/vnd.ms-powerpoint'],
  },
  csv: {
    kind: 'text', extension: 'csv', label: 'CSV',
    mimeType: 'text/csv',
    mimeTypes: ['text/csv', 'application/csv', 'application/vnd.ms-excel', 'text/plain'],
    acceptEmptyMime: true,
  },
});

export function getOfficeFormat(file) {
  const name = file?.originalName ?? file?.fileName ?? '';
  if (/[\\/\x00-\x1f]/.test(name)) return null;
  const extension = name.split('.').pop().toLowerCase();
  const format = OFFICE_FORMATS[extension];
  if (!format) return null;

  const mime = String(file?.mimeType ?? '').toLowerCase().split(';')[0].trim();
  const genericMime = !mime || mime === 'application/octet-stream';

  if (format.kind === 'text') {
    const ok = format.mimeTypes.includes(mime) || (genericMime && format.acceptEmptyMime);
    return ok ? { extension, ...format } : null;
  }
  // ooxml + binary: browser reports these reliably, require an exact match.
  return format.mimeTypes.includes(mime) ? { extension, ...format } : null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test packages/core/src/__tests__/office-formats.test.js`
Expected: PASS.

- [ ] **Step 5: Run the core suite for regressions**

Run: `node --test packages/core/src/__tests__/`
Expected: PASS (time, file-kinds, office-formats).

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/office-formats.js packages/core/src/__tests__/office-formats.test.js
git commit -m "feat(core): getOfficeFormat kind dispatch + csv/xls/doc/ppt"
```

---

## Task A3: Validación por `kind` (binario CFBF + texto UTF-8)

**Files:**
- Modify: `apps/api/src/services/office/validate-document.js`
- Create: `apps/api/src/services/__tests__/office-validate.test.js`

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/services/__tests__/office-validate.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { OFFICE_FORMATS } from '@atlas/core';
import { validateOfficeDocument } from '../office/validate-document.js';

const status = (n) => (e) => e.status === n;
const CFBF = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);

function cfbfBuffer(size = 2048) {
  const b = Buffer.alloc(size, 0x20);
  CFBF.copy(b, 0);
  return b;
}

test('binary kind: accepts a CFBF/OLE2 header, rejects non-CFBF', async () => {
  await validateOfficeDocument(cfbfBuffer(), OFFICE_FORMATS.doc);
  await assert.rejects(validateOfficeDocument(Buffer.from('%PDF-1.4\n%%EOF'), OFFICE_FORMATS.doc), status(415));
  await assert.rejects(validateOfficeDocument(await new JSZip().generateAsync({ type: 'nodebuffer' }), OFFICE_FORMATS.xls), status(415));
  await assert.rejects(validateOfficeDocument(Buffer.alloc(0), OFFICE_FORMATS.ppt), status(415));
  await assert.rejects(validateOfficeDocument(Buffer.from([0xd0, 0xcf, 0x11]), OFFICE_FORMATS.doc), status(415));
});

test('text kind: accepts UTF-8 csv (with or without BOM), rejects binary / invalid utf-8 / oversize', async () => {
  await validateOfficeDocument(Buffer.from('a,b,c\n1,2,3\n', 'utf8'), OFFICE_FORMATS.csv);
  await validateOfficeDocument(Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('x,y\n1,2\n')]), OFFICE_FORMATS.csv);
  await assert.rejects(validateOfficeDocument(Buffer.from('a,b\n \n'), OFFICE_FORMATS.csv), status(415));
  await assert.rejects(validateOfficeDocument(Buffer.from([0xff, 0xfe, 0x00, 0x41]), OFFICE_FORMATS.csv), status(415));
  await assert.rejects(validateOfficeDocument(Buffer.alloc(11 * 1024 * 1024, 0x2c), OFFICE_FORMATS.csv), status(415));
});

test('text kind: rejects too many lines and an over-long line', async () => {
  await assert.rejects(validateOfficeDocument(Buffer.from('x\n'.repeat(1_000_001)), OFFICE_FORMATS.csv), status(415));
  await assert.rejects(validateOfficeDocument(Buffer.from('a'.repeat(600 * 1024)), OFFICE_FORMATS.csv), status(415));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test apps/api/src/services/__tests__/office-validate.test.js`
Expected: FAIL — `validateOfficeDocument` runs the yauzl path for every format and rejects the CFBF/CSV buffers with a zip error (or resolves unexpectedly).

- [ ] **Step 3: Rewrite `apps/api/src/services/office/validate-document.js`**

Keep the existing OOXML implementation but rename it and add a dispatcher + two validators. Full file:

```js
import yauzl from 'yauzl';
import { XMLParser } from 'fast-xml-parser';
import { OfficeError } from './errors.js';

const MAX_TEXT_BYTES = 10 * 1024 * 1024;
const MAX_TEXT_LINES = 1_000_000;
const MAX_LINE_BYTES = 512 * 1024;
const CFBF_MAGIC = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);

function invalid() {
  return new OfficeError('El contenido no corresponde a un documento Office compatible.', 415, 'invalid_document');
}

export function validateOfficeDocument(bytes, format) {
  if (format?.kind === 'binary') return validateBinaryOfficeDocument(bytes, format);
  if (format?.kind === 'text') return validateTextOfficeDocument(bytes, format);
  return validateOoxmlOfficeDocument(bytes, format);
}

export async function validateBinaryOfficeDocument(bytes, _format) {
  if (!Buffer.isBuffer(bytes)) bytes = Buffer.from(bytes);
  if (bytes.length < 512 || bytes.length > MAX_TEXT_BYTES) throw invalid();
  if (!bytes.subarray(0, 8).equals(CFBF_MAGIC)) throw invalid();
}

export async function validateTextOfficeDocument(bytes, _format) {
  if (!Buffer.isBuffer(bytes)) bytes = Buffer.from(bytes);
  if (bytes.length < 1 || bytes.length > MAX_TEXT_BYTES) throw invalid();
  if (bytes.includes(0)) throw invalid();
  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(bytes);
  } catch {
    throw invalid();
  }
  let lines = 1;
  let lineBytes = 0;
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] === 0x0a) {
      lines++;
      lineBytes = 0;
      if (lines > MAX_TEXT_LINES) throw invalid();
    } else if (bytes[i] !== 0x0d) {
      lineBytes++;
      if (lineBytes > MAX_LINE_BYTES) throw invalid();
    }
  }
  return text;
}

export function validateOoxmlOfficeDocument(bytes, format) {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(bytes, { lazyEntries: true, strictFileNames: true }, (error, zip) => {
      if (error || !zip) return reject(invalid());
      let expanded = 0;
      let actualExpanded = 0;
      let entries = 0;
      let contentTypes;
      const names = new Set();
      let failed = false;
      const fail = () => { if (!failed) { failed = true; zip.close(); reject(invalid()); } };
      zip.on('error', fail);
      zip.on('end', () => {
        if (failed) return;
        try {
          if (!names.has(format.part) || !names.has('_rels/.rels') || !contentTypes || /<!DOCTYPE|<!ENTITY/i.test(contentTypes)) throw new Error();
          const parsed = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', isArray: (name) => name === 'Override' }).parse(contentTypes);
          if (!parsed.Types?.Override?.some(p => p.PartName === `/${format.part}` && p.ContentType === format.contentType)) throw new Error();
          resolve();
        } catch { fail(); }
      });
      zip.on('entry', entry => {
        expanded += entry.uncompressedSize;
        entries++;
        if (expanded > 128 * 1024 * 1024 || entries > 10000 || names.has(entry.fileName) || entry.generalPurposeBitFlag & 1 || /vbaProject\.bin$/i.test(entry.fileName)) return fail();
        names.add(entry.fileName);
        if (entry.fileName.endsWith('/')) return zip.readEntry();
        const isManifest = entry.fileName === '[Content_Types].xml';
        if (isManifest && entry.uncompressedSize > 256 * 1024) return fail();
        zip.openReadStream(entry, (err, stream) => {
          if (err) return fail();
          const chunks = [];
          let length = 0;
          stream.on('error', fail);
          stream.on('data', chunk => {
            length += chunk.length;
            actualExpanded += chunk.length;
            if (actualExpanded > 128 * 1024 * 1024 || length > entry.uncompressedSize || (isManifest && length > 256 * 1024)) { stream.destroy(); fail(); }
            else if (isManifest) chunks.push(chunk);
          });
          stream.on('end', () => { if (!failed) { if (isManifest) contentTypes = Buffer.concat(chunks).toString('utf8'); zip.readEntry(); } });
        });
      });
      zip.readEntry();
    });
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test apps/api/src/services/__tests__/office-validate.test.js`
Expected: PASS.

- [ ] **Step 5: Regression — existing OOXML validation tests**

Run: `node --test apps/api/src/services/__tests__/office-wopi.test.js`
Expected: the `catalog enforces extension/MIME...` test now FAILS (it loops all `OFFICE_FORMATS` through `officeBytes`, which only builds OOXML). That is fixed in Task A5. Every other test in the file must still PASS. Note the failure and continue.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/services/office/validate-document.js apps/api/src/services/__tests__/office-validate.test.js
git commit -m "feat(office): dispatch validation by format kind (binary CFBF, text UTF-8)"
```

---

## Task A4: Restringir creación de documentos en blanco a OOXML

**Files:**
- Modify: `apps/api/src/services/files/workspace.js` (around lines 85-95)
- Modify: `apps/api/src/services/__tests__/files-workspace.test.js` (the "blank document templates" test, ~line 10)

- [ ] **Step 1: Read the current guard**

Run: `sed -n '80,120p' apps/api/src/services/files/workspace.js`
Expected: a check like `if (!Object.hasOwn(OFFICE_FORMATS, format) || ...)` that rejects unknown blank-document formats.

- [ ] **Step 2: Update the guard to require `kind === 'ooxml'`**

Change the condition that validates `format` so a non-OOXML entry is rejected. Replace:

```js
      !Object.hasOwn(OFFICE_FORMATS, format) ||
```

with:

```js
      !Object.hasOwn(OFFICE_FORMATS, format) ||
      OFFICE_FORMATS[format].kind !== 'ooxml' ||
```

(Keep every other clause of that `if` intact.)

- [ ] **Step 3: Update the blank-templates test to only loop OOXML formats**

In `apps/api/src/services/__tests__/files-workspace.test.js`, the first test loops `Object.entries(OFFICE_FORMATS)`. Change the loop header to skip non-OOXML:

```js
  for (const [extension, format] of Object.entries(OFFICE_FORMATS)) {
    if (format.kind !== 'ooxml') continue;
    await validateOfficeDocument(
      await readFile(
        new URL(`../files/templates/blank.${extension}`, import.meta.url),
      ),
      { ...format, extension },
    );
  }
```

- [ ] **Step 4: Run the test**

Run: `node --test apps/api/src/services/__tests__/files-workspace.test.js`
Expected: PASS (the DB-backed test stays skipped without `FILES_TEST_DATABASE_URL`).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/services/files/workspace.js apps/api/src/services/__tests__/files-workspace.test.js
git commit -m "feat(files): blank-document creation stays OOXML-only"
```

---

## Task A5: `fileKindWhere` desde core + arreglar test de catálogo

**Files:**
- Modify: `apps/api/src/services/files/query.js`
- Modify: `apps/api/src/services/__tests__/office-wopi.test.js` (the `catalog enforces extension/MIME...` test)

- [ ] **Step 1: Write/adjust the failing test — query.js side**

Append to `apps/api/src/services/__tests__/office-validate.test.js` (same file, keeps query coverage close to the other kind logic) — or create `apps/api/src/services/__tests__/files-query.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileKindWhere } from '../files/query.js';

test('fileKindWhere gains a csv clause and drops csv from sheet', () => {
  assert.ok(JSON.stringify(fileKindWhere('csv')).includes('text/csv'));
  assert.ok(!JSON.stringify(fileKindWhere('sheet')).includes('text/csv'));
  assert.deepEqual(fileKindWhere('nonsense'), {});
  // generic is still "none of the known kinds"
  assert.ok(JSON.stringify(fileKindWhere('generic')).includes('NOT'));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test apps/api/src/services/__tests__/files-query.test.js`
Expected: FAIL — `fileKindWhere('csv')` returns `{}`.

- [ ] **Step 3: Rewrite `apps/api/src/services/files/query.js`**

```js
import { fileKindWhereClauses } from '@atlas/core';

const KINDS = fileKindWhereClauses();

export function fileKindWhere(kind) {
  if (kind === 'generic') return { NOT: { OR: Object.values(KINDS) } };
  return KINDS[kind] ?? {};
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test apps/api/src/services/__tests__/files-query.test.js`
Expected: PASS.

- [ ] **Step 5: Fix the `catalog enforces extension/MIME...` test in `office-wopi.test.js`**

Replace that test body so it only feeds OOXML bytes to `validateOfficeDocument`, and asserts the new kinds resolve via `getOfficeFormat`:

```js
test('catalog enforces extension/MIME and archive content types for all MVP formats', async () => {
  for (const [extension, format] of Object.entries(OFFICE_FORMATS)) {
    assert.ok(getOfficeFormat({ originalName: `a.${extension}`, mimeType: format.mimeType }), `${extension} resolves`);
    if (format.kind === 'ooxml') {
      await validateOfficeDocument(await officeBytes(extension), format);
    }
  }
  assert.equal(getOfficeFormat({ originalName: '../a.docx', mimeType: OFFICE_FORMATS.docx.mimeType }), null);
  await assert.rejects(validateOfficeDocument(await officeBytes('xlsx'), OFFICE_FORMATS.docx), status(415));
});
```

- [ ] **Step 6: Run the office suites**

Run: `node --test apps/api/src/services/__tests__/office-wopi.test.js apps/api/src/services/__tests__/office-postgres.test.js apps/api/src/services/__tests__/files-workspace.test.js`
Expected: PASS (DB-gated tests skip).

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/services/files/query.js apps/api/src/services/__tests__/files-query.test.js apps/api/src/services/__tests__/office-wopi.test.js
git commit -m "feat(files): fileKindWhere derives from core FILE_KINDS + csv kind"
```

---

## Task A6: Suite completa + allowlist check + commit final

**Files:** none (verification only)

- [ ] **Step 1: Confirm the upload allowlist picked up the new canonical mimes**

Run: `node -e "import('@atlas/core').then(({OFFICE_FORMATS}) => console.log(Object.values(OFFICE_FORMATS).map(f => f.mimeType)))"`
Expected: array includes `application/msword`, `application/vnd.ms-excel`, `application/vnd.ms-powerpoint`, `text/csv`. `files-service.js:31` spreads exactly this into `ALLOWED_EXACT_MIME_TYPES`, so `.ppt` uploads are now allowed with no further edit.

- [ ] **Step 2: Run the full core + API service suites**

Run: `node --test packages/core/src/__tests__/ && node --test apps/api/src/services/__tests__/`
Expected: PASS (pre-existing DB-gated tests skip; no new failures).

- [ ] **Step 3: Lint**

Run: `pnpm lint`
Expected: clean (no `toISOString` guardrail hits — none of this touches dates).

- [ ] **Step 4: Security review**

Run: `/security-review`
Address anything it flags in the CSV mime-loosening, CFBF path, or text DoS caps. Re-run the affected suite after any fix and commit separately.

- [ ] **Step 5: Commit any fixups**

```bash
git add -A
git commit -m "chore(office): address security-review notes for csv/legacy formats"
```

---

## Self-review notes

- **Spec §4.1** — `FILE_KINDS` + `fileKindOf`/`Label`/`Accent`/`WhereClauses`: Task A1. Consumer migration of `getFileKind` is Plan B (Task B2); `query.js` is Task A5.
- **Spec §4.2** — `getOfficeFormat` rewrite: Task A2. `mimeType` kept singular for compat (deviation from spec's array-only sketch, documented in "Notas de contexto").
- **Spec §4.3** — validation dispatch: Task A3; blank-doc restriction: Task A4; allowlist `.ppt`: auto via A2 (verified in A6 Step 1).
- **Spec §7** — core tests A1/A2; `validateBinary`/`validateText` A3; `fileKindWhere('csv')` A5; `authorize` over `.csv`/`.doc` fixtures and `putFile` objectKey extension: **covered indirectly** — `access.js` calls the new `getOfficeFormat` unchanged, and `putFile` already uses `format.extension`; add explicit fixture coverage only if `/security-review` asks. `isAllowedMimeType('application/vnd.ms-powerpoint')` verified in A6 Step 1.
- **Spec §8** — `/security-review` is Task A6 Step 4.
- Type consistency: `format.kind`, `format.mimeType`, `format.mimeTypes`, `format.extension`, `format.part`, `format.contentType`, `format.acceptEmptyMime` used consistently across A2/A3/A4/A5.
