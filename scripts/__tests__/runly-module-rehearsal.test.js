import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { withRunlyModuleFixture } from '../lib/runly-module-fixture.js';
import { rehearseRunlyModuleKeys, snapshotRehearsalRows, REHEARSAL_COLUMNS } from '../lib/runly-module-rehearsal.js';

test('rehearsal CLI rejects existing-database/apply options before accessing Docker', () => {
  for (const args of [['--apply'], ['--database'], ['--out'], ['--help', '--apply']]) {
    const result = spawnSync(process.execPath, ['scripts/rehearse-runly-module-keys.mjs', ...args], { encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Runly rehearsal failed/);
  }
});

test('rehearsal requires the explicit synthetic database and session marker', async () => {
  for (const row of [{ name: 'customer', marker: 'runly_module_key_fixture' }, { name: 'runly_module_key_rehearsal', marker: null }]) {
    const calls = [];
    const client = { query: async sql => { calls.push(sql); return { rows: [row] }; } };
    await assert.rejects(rehearseRunlyModuleKeys(client), { code: 'FIXTURE_REQUIRED' });
    assert.equal(calls.length, 1);
  }
});

test('PostgreSQL conversion and reversal preserve identity and recover from failures', { skip: process.env.RUNLY_REHEARSAL_TEST_DOCKER !== '1' }, async t => {
  await withRunlyModuleFixture(async client => {
    await t.test('all 21 pairs convert and reverse with complete row and foreign-key preservation', async () => {
      const before = await snapshotRehearsalRows(client);
      const statements = [];
      const report = await rehearseRunlyModuleKeys({ query: async (sql, values) => {
        statements.push(sql);
        return client.query(sql, values);
      } });
      assert.equal(report.reversalVerified, true);
      assert.equal(report.dataConversionReady, false);
      assert.equal(report.persisted, false);
      assert.equal(report.convertedColumns.length, 6);
      assert.ok(report.convertedColumns.every(entry => entry.matchingRows === 21));
      assert.doesNotMatch(JSON.stringify(report), /fixture-hidden-value|document\.pdf|preserve-checksum/);
      assert.equal(statements.filter(sql => sql.startsWith('UPDATE')).length, 12);
      assert.equal(statements.at(-1), 'ROLLBACK');
      assert.ok(!statements.some(sql => /COMMIT/.test(sql)));
      assert.deepEqual(await snapshotRehearsalRows(client), before);
    });

    await t.test('already-current rows are excluded from the inverse journal', async () => {
      for (const [table, column] of REHEARSAL_COLUMNS) {
        await client.query(`UPDATE public."${table}" SET "${column}" = 'runly.core' WHERE "${column}" = 'atlas.core'`);
      }
      try {
        const before = await snapshotRehearsalRows(client);
        const report = await rehearseRunlyModuleKeys(client);
        assert.ok(report.convertedColumns.every(entry => entry.matchingRows === 20));
        assert.deepEqual(await snapshotRehearsalRows(client), before);
      } finally {
        for (const [table, column] of REHEARSAL_COLUMNS) {
          await client.query(`UPDATE public."${table}" SET "${column}" = 'atlas.core' WHERE "${column}" = 'runly.core'`);
        }
      }
    });

    for (const [key, code] of [['runly.core', 'MODULE_KEY_COLLISION'], ['atlas.unknown', 'UNKNOWN_LEGACY_MODULE']]) {
      await t.test(`${code} blocks conversion without merging rows`, async () => {
        const { rows } = await client.query("INSERT INTO atlas_module(key, manifest) VALUES ($1, '{}') RETURNING id", [key]);
        try {
          const before = await snapshotRehearsalRows(client);
          await assert.rejects(rehearseRunlyModuleKeys(client), { code });
          assert.deepEqual(await snapshotRehearsalRows(client), before);
        } finally { await client.query('DELETE FROM atlas_module WHERE id = $1', [rows[0].id]); }
      });
    }

    await t.test('orphan references block conversion', async () => {
      await client.query("UPDATE atlas_module SET key = 'custom.detached' WHERE key = 'atlas.core'");
      try {
        const before = await snapshotRehearsalRows(client);
        await assert.rejects(rehearseRunlyModuleKeys(client), { code: 'ORPHAN_MODULE_REFERENCE' });
        assert.deepEqual(await snapshotRehearsalRows(client), before);
      } finally { await client.query("UPDATE atlas_module SET key = 'atlas.core' WHERE key = 'custom.detached'"); }
    });

    await t.test('migration-history unique conflicts roll back earlier updates', async () => {
      const { rows } = await client.query("INSERT INTO module_migration(module_key, filename, checksum) VALUES ('runly.core', 'manifest__001.sql', 'existing') RETURNING id");
      try {
        const before = await snapshotRehearsalRows(client);
        await assert.rejects(rehearseRunlyModuleKeys(client), { code: '23505' });
        assert.deepEqual(await snapshotRehearsalRows(client), before);
      } finally { await client.query('DELETE FROM module_migration WHERE id = $1', [rows[0].id]); }
    });

    await t.test('unexpected changes to protected fields fail invariants and roll back', async () => {
      const before = await snapshotRehearsalRows(client);
      let changed = false;
      const wrapped = { query: async (sql, values) => {
        const result = await client.query(sql, values);
        if (!changed && sql.startsWith('UPDATE')) {
          changed = true;
          await client.query("UPDATE atlas_module SET bundle_hash = 'unexpected-trigger-like-change' WHERE key = 'runly.core'");
        }
        return result;
      } };
      await assert.rejects(rehearseRunlyModuleKeys(wrapped), { code: 'FORWARD_INVARIANT_FAILED' });
      assert.deepEqual(await snapshotRehearsalRows(client), before);
    });

    await t.test('inverse updates refuse changed identities and outer rollback recovers', async () => {
      const before = await snapshotRehearsalRows(client);
      let changed = false;
      const wrapped = { query: async (sql, values) => {
        if (!changed && sql.startsWith('UPDATE') && sql.includes('= mapping.new_key', sql.indexOf('WHERE'))) {
          changed = true;
          await client.query("UPDATE file_asset SET module_key = 'custom.changed' WHERE module_key = 'runly.core'");
        }
        return client.query(sql, values);
      } };
      await assert.rejects(rehearseRunlyModuleKeys(wrapped), { code: 'REVERSE_ROW_COUNT_MISMATCH' });
      assert.equal(changed, true);
      assert.deepEqual(await snapshotRehearsalRows(client), before);
    });
  });
});
