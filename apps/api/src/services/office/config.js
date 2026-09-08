import { OfficeError } from './errors.js';

export function readOfficeConfig(env = process.env) {
  if (env.ATLAS_OFFICE_ENABLED !== 'true') return { enabled: false };
  const url = (key) => {
    try {
      const value = new URL(env[key]);
      if (!['http:', 'https:'].includes(value.protocol) || value.username || value.password || value.search || value.hash || value.pathname !== '/') throw new Error();
      return value.origin;
    } catch { throw new OfficeError(`Configuración Office inválida: ${key}.`, 503, 'office_configuration'); }
  };
  const config = {
    enabled: true,
    internalUrl: url('COLLABORA_INTERNAL_URL'),
    publicUrl: url('COLLABORA_PUBLIC_URL'),
    wopiUrl: url('ATLAS_WOPI_URL'),
    hostOrigin: url('ATLAS_OFFICE_HOST_ORIGIN'),
    secret: env.ATLAS_WOPI_SECRET,
    tokenSeconds: Number(env.ATLAS_WOPI_TOKEN_SECONDS || 28800),
    maxBytes: 10 * 1024 * 1024,
  };
  const additionalOrigins = (env.ATLAS_OFFICE_ADDITIONAL_ORIGINS ?? 'http://tauri.localhost,https://tauri.localhost,tauri://localhost').split(',').map(s => s.trim()).filter(Boolean);
  config.hostOrigins = [config.hostOrigin, ...additionalOrigins];
  for (const origin of additionalOrigins) {
    if (['http://tauri.localhost', 'https://tauri.localhost', 'tauri://localhost'].includes(origin)) continue;
    try {
      const u = new URL(origin);
      if (u.protocol !== 'https:' || u.origin !== origin) throw new Error();
    } catch { throw new OfficeError('Origen adicional Office inválido.', 503, 'office_configuration'); }
  }
  if (!config.secret || Buffer.byteLength(config.secret) < 32 || !Number.isInteger(config.tokenSeconds) || config.tokenSeconds < 300 || config.tokenSeconds > 28800) {
    throw new OfficeError('Configura un secreto WOPI de al menos 32 bytes y una sesión entre 300 y 28800 segundos.', 503, 'office_configuration');
  }
  for (const value of [config.publicUrl, config.hostOrigin]) {
    const u = new URL(value);
    if (u.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(u.hostname)) throw new OfficeError('Office requiere HTTPS fuera de localhost.', 503, 'office_configuration');
  }
  return config;
}
