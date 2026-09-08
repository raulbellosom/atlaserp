import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { configureOffice, parseOfficeEnv, resolveOfficeConfig } from './office-config.mjs';

test('Office is optional and config separates the three networking paths', () => {
  assert.deepEqual(resolveOfficeConfig().profiles, []);
  const office = resolveOfficeConfig({ ATLAS_OFFICE_ENABLED: 'true' });
  assert.deepEqual(office.profiles, ['--profile', 'office']);
  assert.equal(office.env.COLLABORA_INTERNAL_URL, 'http://collabora:9980');
  assert.equal(office.env.ATLAS_WOPI_URL, 'http://api:4010');
  assert.equal(office.env.COLLABORA_PUBLIC_URL, 'http://localhost:9980');
  assert.ok(!JSON.stringify(office.compose).includes(office.env.ATLAS_WOPI_SECRET));
  assert.throws(() => resolveOfficeConfig({ ATLAS_OFFICE_ENABLED: 'true', COLLABORA_PUBLIC_URL: 'http://office.example.com' }));
  assert.throws(() => resolveOfficeConfig({ ATLAS_OFFICE_ENABLED: 'true', ATLAS_WOPI_SECRET: 'short' }));
});

test('both installers preserve stable secrets and Office settings across reruns and disable/enable', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'atlas-office-env-'));
  for (const mode of ['local', 'external']) {
    const envFile = path.join(dir, `.env.${mode}`);
    const composeEnvFile = path.join(dir, `.env.compose-${mode}`);
    await fs.writeFile(envFile, 'SUPABASE_URL=https://storage.example.com\nATLAS_OFFICE_ENABLED=true\n');
    const first = await configureOffice({ envFile, composeEnvFile, environment: {} });
    const again = await configureOffice({ envFile, composeEnvFile, environment: {} });
    assert.equal(again.env.ATLAS_WOPI_SECRET, first.env.ATLAS_WOPI_SECRET);
    await configureOffice({ envFile, environment: { ATLAS_OFFICE_ENABLED: 'false' } });
    const restored = await configureOffice({ envFile, environment: { ATLAS_OFFICE_ENABLED: 'true' } });
    assert.equal(restored.env.ATLAS_WOPI_SECRET, first.env.ATLAS_WOPI_SECRET);
    const saved = parseOfficeEnv(await fs.readFile(envFile, 'utf8'));
    assert.equal(saved.SUPABASE_URL, 'https://storage.example.com');
    assert.ok(!(await fs.readFile(composeEnvFile, 'utf8')).includes(first.env.ATLAS_WOPI_SECRET));
    await fs.unlink(envFile);
    await fs.unlink(composeEnvFile);
  }
  await fs.rmdir(dir);
});
