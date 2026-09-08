import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { getOfficeFormat } from '@atlas/core';
import { OfficeError } from './errors.js';

export async function readBoundedBody(body, limit) {
  if (!body) return Buffer.alloc(0);
  const reader = body.getReader();
  const chunks = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) throw new OfficeError('El archivo supera el tamaño permitido.', 413, 'file_too_large');
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks, size);
  } catch (error) { await reader.cancel().catch(() => {}); throw error; }
  finally { reader.releaseLock(); }
}

export function createCollaboraProvider({ config, fetchImpl = fetch, now = Date.now }) {
  let cache;
  let pending;
  async function discover() {
    if (cache?.until > now()) {
      if (cache.error) throw cache.error;
      return cache.actions;
    }
    if (pending) return pending;
    pending = (async () => {
      try {
        const response = await fetchImpl(`${config.internalUrl}/hosting/discovery`, { signal: AbortSignal.timeout(5000), redirect: 'error' });
        if (!response.ok) throw new Error();
        const xml = (await readBoundedBody(response.body, 1024 * 1024)).toString('utf8');
        if (/<!DOCTYPE|<!ENTITY/i.test(xml) || XMLValidator.validate(xml) !== true) throw new Error();
        const parsed = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', isArray: (name) => ['net-zone', 'app', 'action'].includes(name) }).parse(xml);
        const actions = parsed['wopi-discovery']?.['net-zone']?.flatMap(zone => (zone.app ?? []).flatMap(app => app.action ?? []));
        if (!actions?.length) throw new Error();
        cache = { until: now() + 300000, actions };
        return actions;
      } catch {
        const error = new OfficeError('Collabora no está disponible. Puedes descargar el archivo y reintentar.', 503, 'office_unavailable');
        cache = { until: now() + 15000, error };
        throw error;
      } finally { pending = null; }
    })();
    return pending;
  }
  async function isAvailable() {
    try { await discover(); return true; } catch { return false; }
  }
  async function createSession({ file, mode, wopiSrc }) {
    const format = getOfficeFormat(file);
    const actions = await discover();
    // CODE commonly advertises edit only; permission=readonly plus CheckFileInfo
    // provides view access without granting any WOPI write capability.
    const action = actions.find(a => a.ext === format?.extension && a.name === mode)
      ?? actions.find(a => a.ext === format?.extension && a.name === 'edit');
    if (!action?.urlsrc) throw new OfficeError('Formato no disponible en este editor.', 415, 'unsupported_format');
    const discovered = new URL(action.urlsrc.replace(/<[^>]*>/g, ''));
    if (!['http:', 'https:'].includes(discovered.protocol) || discovered.username || discovered.password || !discovered.pathname.startsWith('/browser/')) throw new OfficeError('Discovery contiene una URL de editor inválida.', 503, 'office_unavailable');
    const editor = new URL(discovered.pathname + discovered.search, config.publicUrl);
    editor.searchParams.set('WOPISrc', wopiSrc);
    editor.searchParams.set('lang', 'es');
    if (mode === 'view') editor.searchParams.set('permission', 'readonly');
    return { editorUrl: editor.href, editorOrigin: editor.origin, provider: 'collabora' };
  }
  return { isAvailable, createSession, supports: getOfficeFormat };
}
