import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { withRunlyEnvAliases, mergeRunlyEnvText } from './env-compat.mjs';
import { configureOffice, parseOfficeEnv } from './office-config.mjs';
import { configureFirebase } from './firebase-config.mjs';

test('Runly wins within a source, process wins across sources, empty and false stay explicit', () => {
  const values = withRunlyEnvAliases({ RUNLY_API_URL: 'stored', ATLAS_API_URL: 'old' }, { ATLAS_API_URL: 'process' });
  assert.equal(values.RUNLY_API_URL, 'process');
  assert.equal(values.ATLAS_API_URL, 'process');
  const explicit = withRunlyEnvAliases({ RUNLY_OFFICE_ENABLED: 'false', ATLAS_OFFICE_ENABLED: 'true', RUNLY_WOPI_SECRET: '', ATLAS_WOPI_SECRET: 'old', VITE_RUNLY_API_URL: 'new', VITE_ATLAS_API_URL: 'old' });
  assert.equal(explicit.ATLAS_OFFICE_ENABLED, 'false');
  assert.equal(explicit.ATLAS_WOPI_SECRET, '');
  assert.equal(explicit.VITE_ATLAS_API_URL, 'new');
});

test('local env refresh keeps saved settings and secrets and canonicalizes once', () => {
  const generated = '# fresh\nATLAS_TIME_ZONE=UTC\nATLAS_API_PORT=4010\nRUNLY_SUPABASE_PUBLIC_URL=\nSUPABASE_URL=http://fresh\n';
  const saved = 'ATLAS_TIME_ZONE=UTC\nRUNLY_TIME_ZONE=America/Mexico_City\nATLAS_WOPI_SECRET="stable-secret"\nRUNLY_API_URL=https://runly.example\nATLAS_INTERNAL_SECRET="another-secret"\n';
  const refreshed = mergeRunlyEnvText(generated, saved, { ATLAS_API_PORT: '4020', RUNLY_SUPABASE_PUBLIC_URL: 'https://supabase.fixture.example' });
  const values = parseOfficeEnv(refreshed);
  assert.equal(values.RUNLY_TIME_ZONE, 'America/Mexico_City');
  assert.equal(values.RUNLY_API_PORT, '4020');
  assert.equal(values.RUNLY_WOPI_SECRET, 'stable-secret');
  assert.equal(values.RUNLY_INTERNAL_SECRET, 'another-secret');
  assert.equal(values.RUNLY_API_URL, 'https://runly.example');
  assert.equal(values.RUNLY_SUPABASE_PUBLIC_URL, 'https://supabase.fixture.example');
  assert.equal(values.SUPABASE_URL, 'http://fresh');
  assert.doesNotMatch(refreshed, /^ATLAS_/m);
  assert.deepEqual(parseOfficeEnv(mergeRunlyEnvText(generated, refreshed)), values);
});

test('Office preserves a legacy secret across canonical writes and process overrides', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'runly-env-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const envFile = path.join(dir, '.env.fixture');
  const secret = 'fixture-only-secret-'.repeat(3);
  await fs.writeFile(envFile, `ATLAS_OFFICE_ENABLED=true\nATLAS_WOPI_SECRET=${secret}\n`);
  await configureOffice({ envFile, environment: {} });
  let content = await fs.readFile(envFile, 'utf8');
  assert.match(content, /^RUNLY_WOPI_SECRET=/m);
  assert.doesNotMatch(content, /^ATLAS_WOPI_SECRET=/m);
  await configureOffice({ envFile, environment: { ATLAS_OFFICE_ENABLED: 'false' } });
  const enabled = await configureOffice({ envFile, environment: { RUNLY_OFFICE_ENABLED: 'true' } });
  assert.equal(enabled.env.ATLAS_WOPI_SECRET, secret);
  content = await fs.readFile(envFile, 'utf8');
  await configureOffice({ envFile, environment: {} });
  assert.equal(await fs.readFile(envFile, 'utf8'), content);
});

test('Firebase respects canonical false and does not append a competing legacy default', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'runly-firebase-env-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const envFile = path.join(dir, '.env.fixture');
  await fs.writeFile(envFile, 'RUNLY_FCM_ENABLED=false\nATLAS_FCM_ENABLED=true\n');
  assert.equal((await configureFirebase({ envFile })).enabled, false);
  const once = await fs.readFile(envFile, 'utf8');
  await configureFirebase({ envFile });
  assert.equal(await fs.readFile(envFile, 'utf8'), once);
});
