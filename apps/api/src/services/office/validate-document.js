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
