import fs from 'node:fs/promises';
import { randomBytes } from 'node:crypto';

export const CODE_IMAGE = 'collabora/code:26.04.2.4.1';
export const OFFICE_ENV_KEYS = ['ATLAS_OFFICE_ENABLED', 'COLLABORA_INTERNAL_URL', 'COLLABORA_PUBLIC_URL', 'ATLAS_WOPI_URL', 'ATLAS_OFFICE_HOST_ORIGIN', 'ATLAS_OFFICE_ADDITIONAL_ORIGINS', 'ATLAS_WOPI_SECRET', 'ATLAS_WOPI_TOKEN_SECONDS'];

export function parseOfficeEnv(text = '') {
  return Object.fromEntries(text.split(/\r?\n/).filter(line => /^[A-Z_]+=/.test(line)).map(line => {
    const index = line.indexOf('=');
    return [line.slice(0, index), line.slice(index + 1).trim().replace(/^(['"])(.*)\1$/, '$2')];
  }));
}

export function resolveOfficeConfig(values = {}) {
  const enabled = values.ATLAS_OFFICE_ENABLED === 'true';
  if (!enabled) return { enabled: false, env: { ATLAS_OFFICE_ENABLED: 'false', ...Object.fromEntries(OFFICE_ENV_KEYS.filter(key => key !== 'ATLAS_OFFICE_ENABLED' && values[key] !== undefined).map(key => [key, values[key]])) }, profiles: [], compose: {} };
  const env = {
    ATLAS_OFFICE_ENABLED: 'true',
    COLLABORA_INTERNAL_URL: values.COLLABORA_INTERNAL_URL || 'http://collabora:9980',
    COLLABORA_PUBLIC_URL: values.COLLABORA_PUBLIC_URL || 'http://localhost:9980',
    ATLAS_WOPI_URL: values.ATLAS_WOPI_URL || 'http://api:4010',
    ATLAS_OFFICE_HOST_ORIGIN: values.ATLAS_OFFICE_HOST_ORIGIN || 'http://localhost:5173',
    ATLAS_OFFICE_ADDITIONAL_ORIGINS: values.ATLAS_OFFICE_ADDITIONAL_ORIGINS ?? 'http://tauri.localhost,https://tauri.localhost,tauri://localhost',
    ATLAS_WOPI_SECRET: values.ATLAS_WOPI_SECRET || randomBytes(48).toString('base64url'),
    ATLAS_WOPI_TOKEN_SECONDS: values.ATLAS_WOPI_TOKEN_SECONDS || '28800',
  };
  for (const key of ['COLLABORA_INTERNAL_URL', 'COLLABORA_PUBLIC_URL', 'ATLAS_WOPI_URL', 'ATLAS_OFFICE_HOST_ORIGIN']) {
    const u = new URL(env[key]);
    if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password || u.search || u.hash || u.pathname !== '/') throw new Error(`Invalid Office origin: ${key}`);
    if (['COLLABORA_PUBLIC_URL', 'ATLAS_OFFICE_HOST_ORIGIN'].includes(key) && u.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(u.hostname)) throw new Error(`HTTPS required for ${key}`);
    env[key] = u.origin;
  }
  if (Buffer.byteLength(env.ATLAS_WOPI_SECRET) < 32 || !/^[A-Za-z0-9_+/=-]+$/.test(env.ATLAS_WOPI_SECRET)) throw new Error('ATLAS_WOPI_SECRET must contain at least 32 bytes, using base64/base64url characters.');
  const ttl = Number(env.ATLAS_WOPI_TOKEN_SECONDS);
  if (!Number.isInteger(ttl) || ttl < 300 || ttl > 28800) throw new Error('ATLAS_WOPI_TOKEN_SECONDS must be 300..28800.');
  const publicUrl = new URL(env.COLLABORA_PUBLIC_URL);
  const origins = env.ATLAS_OFFICE_ADDITIONAL_ORIGINS.split(',').map(s => s.trim()).filter(Boolean);
  for (const origin of origins) {
    if (['http://tauri.localhost', 'https://tauri.localhost', 'tauri://localhost'].includes(origin)) continue;
    const url = new URL(origin);
    if (url.protocol !== 'https:' || url.origin !== origin) throw new Error('Invalid ATLAS_OFFICE_ADDITIONAL_ORIGINS');
  }
  return {
    enabled, env, profiles: ['--profile', 'office'],
    compose: {
      COLLABORA_WOPI_HOST: env.ATLAS_WOPI_URL,
      COLLABORA_CONTENT_SECURITY_POLICY: `frame-ancestors ${[env.ATLAS_OFFICE_HOST_ORIGIN, ...origins].join(' ')};`,
      COLLABORA_EXTRA_PARAMS: `--o:ssl.enable=false --o:ssl.termination=${publicUrl.protocol === 'https:'} --o:server_name=${publicUrl.host} --o:logging.level=warning --o:logging.anonymize.anonymize_user_data=true`,
    },
  };
}

export function renderOfficeEnv(office) {
  return Object.entries(office.env).map(([key, value]) => `${key}=${value}`).join('\n') + '\n';
}

export async function configureOffice({ envFile, composeEnvFile, environment = process.env }) {
  const text = await fs.readFile(envFile, 'utf8');
  const stored = parseOfficeEnv(text);
  const values = Object.fromEntries(OFFICE_ENV_KEYS.map(key => [key, environment[key] ?? stored[key]]));
  const office = resolveOfficeConfig(values);
  const preserved = text.split(/\r?\n/).filter(line => !OFFICE_ENV_KEYS.some(key => line.startsWith(`${key}=`))).join('\n');
  await fs.writeFile(envFile, preserved.trimEnd() + '\n\n# Optional Office\n' + renderOfficeEnv(office), { mode: 0o600 });
  try { await fs.chmod(envFile, 0o600); } catch { /* Windows ACLs apply. */ }
  if (composeEnvFile && office.enabled) {
    // Only public networking configuration enters Compose interpolation, never the signing key.
    await fs.appendFile(composeEnvFile, '\n' + Object.entries(office.compose).map(([key, value]) => `${key}=${value}`).join('\n') + '\n');
  }
  return office;
}

export async function checkOfficeRuntime(office, fetchImpl = fetch) {
  if (!office.enabled) return;
  try {
    const response = await fetchImpl('http://127.0.0.1:9980/hosting/discovery', { signal: AbortSignal.timeout(5000), redirect: 'error' });
    if (!response.ok) throw new Error();
    console.log('Office: CODE discovery is reachable. Verify the public URL and WebSocket through your proxy.');
  } catch { console.warn('Office: CODE is still starting or unavailable. Atlas remains usable; check docker compose --profile office ps.'); }
}
