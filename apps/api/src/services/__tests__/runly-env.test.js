import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { readOfficeConfig } from '../office/config.js';
import { resolveModuleRoots } from '../module-root-resolver.js';
import { officeEnv } from './office-fixture.js';
import { resolveAppBaseUrl, resolveApiBaseUrl } from '../email-templates.js';
import { getConfiguredTimeZone } from '@runly/core';

test('email links use Runly URLs and retain legacy fallbacks', () => {
  assert.equal(resolveAppBaseUrl({ RUNLY_APP_URL: 'https://runly.example', ATLAS_APP_URL: 'https://legacy.example' }), 'https://runly.example');
  assert.equal(resolveAppBaseUrl({ ATLAS_APP_URL: 'https://legacy.example' }), 'https://legacy.example');
  assert.equal(resolveApiBaseUrl({ RUNLY_API_URL: 'https://api.runly.example', ATLAS_API_URL: 'https://api.legacy.example' }), 'https://api.runly.example');
  assert.equal(resolveApiBaseUrl({ VITE_RUNLY_API_URL: 'https://vite.runly.example' }), 'https://vite.runly.example');
});

test('time zone prefers Runly and keeps legacy configuration', t => {
  const keys = ['RUNLY_TIME_ZONE', 'ATLAS_TIME_ZONE'];
  const previous = keys.map(key => process.env[key]);
  t.after(() => keys.forEach((key, index) => { if (previous[index] === undefined) delete process.env[key]; else process.env[key] = previous[index]; }));
  delete process.env.RUNLY_TIME_ZONE;
  process.env.ATLAS_TIME_ZONE = 'America/Mexico_City';
  assert.equal(getConfiguredTimeZone(), 'America/Mexico_City');
  process.env.RUNLY_TIME_ZONE = 'UTC';
  assert.equal(getConfiguredTimeZone(), 'UTC');
});

test('Office accepts new configuration and gives explicit Runly values precedence', () => {
  const current = Object.fromEntries(Object.entries(officeEnv).map(([key, value]) => [key.replace(/^ATLAS_/, 'RUNLY_'), value]));
  assert.deepEqual(readOfficeConfig(current), readOfficeConfig(officeEnv));
  assert.deepEqual(readOfficeConfig({ ...officeEnv, RUNLY_OFFICE_ENABLED: 'false' }), { enabled: false });
  assert.throws(() => readOfficeConfig({ ...officeEnv, RUNLY_WOPI_SECRET: '' }));
  assert.equal(readOfficeConfig({ ...officeEnv, RUNLY_WOPI_URL: 'http://runly-api:4010' }).wopiUrl, 'http://runly-api:4010');
});

test('module root overrides accept both names without changing module identity', async () => {
  const root = process.cwd();
  const legacy = await resolveModuleRoots({ env: { ATLAS_PROJECT_ROOT: root, ATLAS_MODULES_DIR: path.join(root, 'legacy-fixture') } });
  const current = await resolveModuleRoots({ env: { RUNLY_PROJECT_ROOT: root, RUNLY_MODULES_DIR: path.join(root, 'current-fixture'), ATLAS_MODULES_DIR: legacy.customModulesDir } });
  assert.equal(current.projectRoot, legacy.projectRoot);
  assert.equal(current.customModulesDir, path.join(root, 'current-fixture'));
  assert.equal(current.officialModulesDir, legacy.officialModulesDir);
});
