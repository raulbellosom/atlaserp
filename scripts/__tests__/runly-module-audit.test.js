import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Client } from 'pg';
import { buildModuleKeyAudit, auditRunlyModuleDatabase, auditRunlyModuleSource } from '../lib/runly-module-audit.js';

test('audit reports both-name collisions and unknown legacy keys without treating custom names as official', () => {
  const report = buildModuleKeyAudit(['atlas.core', 'runly.core', 'atlas.unknown', 'custom.fleet']);
  assert.deepEqual(report.collisions, [{ legacy: 'atlas.core', current: 'runly.core' }]);
  assert.deepEqual(report.unknownLegacyKeys, ['atlas.unknown']);
});

test('offline report describes schema references and explicitly leaves database readiness unknown', async () => {
  const report = await auditRunlyModuleSource(process.cwd());
  assert.equal(report.databaseInspected, false);
  assert.equal(report.dataConversionReady, false);
  assert.ok(report.schemaReferences.some(row => row.table === 'module_migration' && row.column === 'module_key'));
  assert.ok(report.schemaReferences.some(row => row.table === 'atlas_module' && row.column === 'manifest'));
  assert.ok(report.uuidRelations.some(row => row.table === 'company_module'));
});

test('failed database audits always roll back and do not offer a partial success report', async () => {
  const calls = [];
  const client = { query: async sql => { calls.push(sql); if (sql.includes('information_schema')) throw new Error('fixture failure'); return { rows: [] }; } };
  await assert.rejects(auditRunlyModuleDatabase(client), /fixture failure/);
  assert.match(calls[0], /READ ONLY/);
  assert.equal(calls.at(-1), 'ROLLBACK');
});

test('isolated PostgreSQL audit counts references, detects collisions and preserves every row', { skip: !process.env.RUNLY_AUDIT_TEST_DATABASE_URL }, async t => {
  const url = new URL(process.env.RUNLY_AUDIT_TEST_DATABASE_URL);
  assert.equal(url.hostname, '127.0.0.1');
  assert.equal(url.pathname, '/runly_audit_fixture');
  const client = new Client({ connectionString: url.toString() });
  await client.connect();
  t.after(() => client.end());
  await client.query(`
    CREATE TABLE atlas_module (id integer PRIMARY KEY, key text UNIQUE, manifest jsonb);
    CREATE TABLE permission (id integer PRIMARY KEY, module_id integer REFERENCES atlas_module(id), module_key text);
    CREATE TABLE user_preference (value jsonb);
    INSERT INTO atlas_module VALUES (1, 'atlas.core', '{"dependency":"atlas.company","secret":"fixture-hidden-value"}'), (2, 'runly.core', '{}'), (3, 'atlas.unknown', '{}');
    INSERT INTO permission VALUES (1, 1, 'atlas.core'), (2, 2, 'runly.core');
    INSERT INTO user_preference VALUES ('{"path":"/app/m/atlas.core/settings","unrelated":"keep"}');
  `);
  const snapshot = () => client.query("SELECT (SELECT json_agg(m) FROM atlas_module m) AS modules, (SELECT json_agg(p) FROM permission p) AS permissions, (SELECT json_agg(u) FROM user_preference u) AS preferences");
  const before = await snapshot();
  const statements = [];
  const wrapper = { query: async (sql, values) => {
    statements.push(sql);
    const result = await client.query(sql, values);
    if (sql.startsWith('BEGIN')) assert.equal((await client.query('SHOW transaction_read_only')).rows[0].transaction_read_only, 'on');
    return result;
  } };
  const report = await auditRunlyModuleDatabase(wrapper);
  assert.deepEqual(report.collisions, [{ legacy: 'atlas.core', current: 'runly.core' }]);
  assert.deepEqual(report.unknownLegacyKeys, ['atlas.unknown']);
  assert.equal(report.references.find(row => row.table_name === 'permission' && row.column_name === 'module_key').matchingRows, '2');
  assert.equal(report.references.find(row => row.table_name === 'user_preference').matchingRows, '1');
  assert.equal(report.foreignKeys[0].referencing_table, 'permission');
  assert.doesNotMatch(JSON.stringify(report), /fixture-hidden-value/);
  assert.deepEqual(await snapshot(), before);
  assert.equal(statements.at(-1), 'ROLLBACK');
  assert.ok(statements.every(sql => /^(BEGIN|SET LOCAL|\s*SELECT|ROLLBACK)/.test(sql)));
});
