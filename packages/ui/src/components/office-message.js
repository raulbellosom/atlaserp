export function parseOfficeMessage(event, frameWindow, editorOrigin) {
  if (event.source !== frameWindow || event.origin !== editorOrigin) return null;
  try {
    const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
    return data && typeof data.MessageId === 'string' ? data : null;
  } catch { return null; }
}

export function officeErrorMessage(error) {
  try { return JSON.parse(error?.message)?.error || 'No se pudo abrir el editor.'; }
  catch { return error?.message || 'No se pudo abrir el editor. Revisa la conexión.'; }
}
