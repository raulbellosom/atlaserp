import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createModulesRouter } from '../modules.js';
import { resolvePersistedModuleKey } from '../../services/module-key-alias.js';

function fixture({ rows = [{ id: 'fixture-core', key: 'atlas.core', core: true, enabled: true, status: 'INSTALLED', dependencies: [] }], authenticated = true, permitted = true } = {}) {
  const queries = [];
  const permissions = [];
  const prisma = {
    atlasModule: { findUnique: async ({ where }) => { queries.push(where.key); return rows.find(row => row.key === where.key) ?? null; } },
    permission: { count: async () => 0 },
    moduleDependency: { findMany: async () => [] },
  };
  const app = createModulesRouter({ prisma,
    authMiddleware: (c, next) => authenticated ? next() : c.json({ error: 'Unauthorized' }, 401),
    requirePermission: key => (c, next) => { permissions.push(key); return permitted ? next() : c.json({ error: 'Forbidden' }, 403); },
  });
  return { app, queries, permissions, prisma };
}

test('Runly lifecycle route resolves the same persisted record through existing permission middleware', async () => {
  const f = fixture();
  const current = await f.app.request('/runly.core/lifecycle');
  const legacy = await f.app.request('/atlas.core/lifecycle');
  assert.equal(current.status, 200);
  assert.deepEqual(await current.json(), await legacy.json());
  assert.ok(f.permissions.every(key => key === 'core.modules.read'));
  assert.deepEqual(f.queries, ['runly.core', 'atlas.core', 'atlas.core', 'atlas.core', 'atlas.core']);
});

test('alias requests cannot bypass authentication or permissions', async () => {
  for (const options of [{ authenticated: false }, { permitted: false }]) {
    const f = fixture(options);
    for (const key of ['runly.core', 'atlas.core']) {
      assert.equal((await f.app.request(`/${key}/lifecycle`)).status, options.authenticated === false ? 401 : 403);
    }
    assert.deepEqual(f.queries, []);
  }
});

test('persisted exact matches win and unknown/custom keys never alias', async () => {
  const f = fixture({ rows: [{ key: 'runly.core' }, { key: 'atlas.core' }] });
  assert.equal(await resolvePersistedModuleKey(f.prisma, 'runly.core'), 'runly.core');
  assert.equal(await resolvePersistedModuleKey(f.prisma, 'atlas.core'), 'atlas.core');
  assert.equal(await resolvePersistedModuleKey(f.prisma, 'custom.fleet'), 'custom.fleet');
  assert.equal(await resolvePersistedModuleKey(f.prisma, 'runly.unknown'), 'runly.unknown');
  assert.deepEqual(f.queries, ['runly.core', 'atlas.core']);
});

test('legacy lifecycle requests resolve the same UUID when only the Runly record exists', async () => {
  const f = fixture({ rows: [{ id: 'preserved-module-id', key: 'runly.core', core: true, enabled: true, status: 'INSTALLED', dependencies: [] }] });
  const legacy = await f.app.request('/atlas.core/lifecycle');
  const current = await f.app.request('/runly.core/lifecycle');
  assert.equal(legacy.status, 200);
  assert.deepEqual(await legacy.json(), await current.json());
  assert.deepEqual(f.queries.slice(0, 3), ['atlas.core', 'runly.core', 'runly.core']);
});

test('missing official records preserve the requested key and lookup errors propagate', async () => {
  const f = fixture({ rows: [] });
  for (const key of ['atlas.core', 'runly.core']) {
    assert.equal(await resolvePersistedModuleKey(f.prisma, key), key);
    assert.equal((await f.app.request(`/${key}/lifecycle`)).status, 404);
  }
  const prisma = { atlasModule: { findUnique: async () => { throw new Error('database unavailable'); } } };
  await assert.rejects(resolvePersistedModuleKey(prisma, 'atlas.core'), /database unavailable/);
});
