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
  await assert.rejects(validateOfficeDocument(Buffer.from([0x61, 0x2c, 0x62, 0x00, 0x0a]), OFFICE_FORMATS.csv), status(415));
  await assert.rejects(validateOfficeDocument(Buffer.from([0xff, 0xfe, 0x00, 0x41]), OFFICE_FORMATS.csv), status(415));
  await assert.rejects(validateOfficeDocument(Buffer.alloc(11 * 1024 * 1024, 0x2c), OFFICE_FORMATS.csv), status(415));
});

test('text kind: rejects too many lines and an over-long line', async () => {
  await assert.rejects(validateOfficeDocument(Buffer.from('x\n'.repeat(1_000_001)), OFFICE_FORMATS.csv), status(415));
  await assert.rejects(validateOfficeDocument(Buffer.from('a'.repeat(600 * 1024)), OFFICE_FORMATS.csv), status(415));
});
