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
  assert.equal(getOfficeFormat({ originalName: 'a\\b.csv', mimeType: 'text/csv' }), null);
  assert.equal(getOfficeFormat({ originalName: 'a\nb.csv', mimeType: 'text/csv' }), null);
});

test('returned shape carries extension, kind and label', () => {
  const f = getOfficeFormat({ originalName: 'q.csv', mimeType: 'text/csv' });
  assert.equal(f.extension, 'csv');
  assert.equal(f.label, 'CSV');
});
