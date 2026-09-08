import yauzl from 'yauzl';
import { XMLParser } from 'fast-xml-parser';
import { OfficeError } from './errors.js';

export function validateOfficeDocument(bytes, format) {
  return new Promise((resolve, reject) => {
    const invalid = () => new OfficeError('El contenido no corresponde a un documento Office compatible.', 415, 'invalid_document');
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
