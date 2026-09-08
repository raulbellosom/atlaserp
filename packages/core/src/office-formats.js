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
