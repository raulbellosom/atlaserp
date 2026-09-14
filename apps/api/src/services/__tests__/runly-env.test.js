import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { readOfficeConfig } from '../office/config.js';
import { resolveModuleRoots } from '../module-root-resolver.js';
import { officeEnv } from './office-fixture.js';
import { resolveAppBaseUrl, resolveApiBaseUrl } from '../email-templates.js';
import { getConfiguredTimeZone } from '@runly/core';

test('email links use RUNLY_ environment variables', () => {
  assert.equal(resolveAppBaseUrl({ RUNLY_APP_URL: 'https://runly.example' }), 'https://runly.example');
  assert.equal(resolveApiBaseUrl({ RUNLY_API_URL: 'https://api.runly.example' }), 'https://api.runly.example');
  assert.equal(resolveApiBaseUrl({ VITE_RUNLY_API_URL: 'https://vite.runly.example' }), 'https://vite.runly.example');
});

test('time zone reads RUNLY_TIME_ZONE', t => {
  const previous = process.env.RUNLY_TIME_ZONE;
  t.after(() => { if (previous === undefined) delete process.env.RUNLY_TIME_ZONE; else process.env.RUNLY_TIME_ZONE = previous; });
  process.env.RUNLY_TIME_ZONE = 'America/Mexico_City';
  assert.equal(getConfiguredTimeZone(), 'America/Mexico_City');
  process.env.RUNLY_TIME_ZONE = 'UTC';
  assert.equal(getConfiguredTimeZone(), 'UTC');
});

test('Office reads RUNLY_ configuration', () => {
  assert.deepEqual(readOfficeConfig({ ...officeEnv, RUNLY_OFFICE_ENABLED: 'false' }), { enabled: false });
  assert.throws(() => readOfficeConfig({ ...officeEnv, RUNLY_WOPI_SECRET: '' }));
  assert.equal(readOfficeConfig({ ...officeEnv, RUNLY_WOPI_URL: 'http://runly-api:4010' }).wopiUrl, 'http://runly-api:4010');
});

test('module root overrides use RUNLY_PROJECT_ROOT / RUNLY_MODULES_DIR', async () => {
  const root = process.cwd();
  const result = await resolveModuleRoots({ env: { RUNLY_PROJECT_ROOT: root, RUNLY_MODULES_DIR: path.join(root, 'current-fixture') } });
  assert.equal(result.projectRoot, root);
  assert.equal(result.customModulesDir, path.join(root, 'current-fixture'));
});
