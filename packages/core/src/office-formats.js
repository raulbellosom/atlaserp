export const OFFICE_FORMATS = Object.freeze({
  docx: { mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', part: 'word/document.xml', contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml', label: 'Documento' },
  xlsx: { mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', part: 'xl/workbook.xml', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml', label: 'Hoja de cálculo' },
  pptx: { mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', part: 'ppt/presentation.xml', contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml', label: 'Presentación' },
});

export function getOfficeFormat(file) {
  const name = file?.originalName ?? file?.fileName ?? '';
  if (/[\\/\x00-\x1f]/.test(name)) return null;
  const extension = name.split('.').pop().toLowerCase();
  const format = OFFICE_FORMATS[extension];
  return format && file?.mimeType === format.mimeType ? { extension, ...format } : null;
}
