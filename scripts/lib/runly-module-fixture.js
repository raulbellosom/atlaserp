import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { Client } from 'pg';
import { OFFICIAL_MODULE_KEY_PAIRS } from '../../packages/core/src/module-identity.js';

const execute = promisify(execFile);
const docker = (...args) => execute('docker', args, { timeout: 30000, windowsHide: true });

export async function seedRunlyModuleFixture(client) {
  await client.query(await readFile(new URL('../fixtures/runly-module-keys.sql', import.meta.url), 'utf8'));
  await client.query(`INSERT INTO company(name) VALUES ('Synthetic A'), ('Synthetic B');
    INSERT INTO user_profile DEFAULT VALUES;
    INSERT INTO role(company_id) SELECT id FROM company`);
  await client.query(`INSERT INTO atlas_module(key, manifest, lifecycle_config, bundle_hash)
    SELECT key, jsonb_build_object('key', key, 'dependencies', jsonb_build_array('atlas.core'),
      'navigation', jsonb_build_array(jsonb_build_object('path', '/app/m/' || key || '/settings'))),
      '{"dev":{"migrationSignature":"preserve-checksum"}}', 'preserve-bundle-hash'
    FROM unnest($1::text[]) AS keys(key)`, [OFFICIAL_MODULE_KEY_PAIRS.map(pair => pair.legacy).concat('custom.fleet', 'customer.atlas.core')]);
  await client.query(`
    INSERT INTO company_module(company_id, module_id, enabled, config)
      SELECT c.id, m.id, c.name = 'Synthetic A', '{"module":"atlas.core"}' FROM company c CROSS JOIN atlas_module m;
    INSERT INTO module_dependency(module_id, dependency_id, version_range)
      SELECT m.id, c.id, '^1.0.0' FROM atlas_module m JOIN atlas_module c ON c.key = 'atlas.core' WHERE m.id <> c.id;
    INSERT INTO blueprint(key, module_id, schema) SELECT key || '.settings', id, manifest FROM atlas_module;
    INSERT INTO atlas_model(module_key, name, table_name, schema)
      SELECT key, key || '.record', replace(key, '.', '_') || '_record', manifest FROM atlas_module;
    INSERT INTO atlas_view(module_key, key, model_name, schema)
      SELECT module_key, module_key || '.table', name, schema FROM atlas_model;
    INSERT INTO module_migration(module_key, filename, checksum)
      SELECT key, 'manifest__001.sql', 'unchanged-sql-checksum' FROM atlas_module;
    INSERT INTO permission(key, module_id, module_key) SELECT key || '.read', id, key FROM atlas_module;
    INSERT INTO role_permission(role_id, permission_id) SELECT r.id, p.id FROM role r CROSS JOIN permission p;
    INSERT INTO user_permission_grant(user_id, company_id, permission_id)
      SELECT u.id, c.id, p.id FROM user_profile u CROSS JOIN company c CROSS JOIN permission p;
    INSERT INTO file_asset(module_key, bucket, object_key, entity_type, entity_id, uploaded_by_id, metadata)
      SELECT m.key, 'atlas-files', 'atlas/' || m.key || '/document.pdf', m.key || '.record', m.id, u.id,
      '{"literal":"fixture-hidden-value", "moduleKey":"atlas.files"}' FROM atlas_module m CROSS JOIN user_profile u;
    INSERT INTO file_asset_share(file_id, user_id, role)
      SELECT f.id, u.id, 'VIEWER' FROM file_asset f CROSS JOIN user_profile u;
    INSERT INTO audit_log(module_key, payload) SELECT key, manifest FROM atlas_module;
    INSERT INTO sync_cursor(company_id, module_key, entity_type, cursor)
      SELECT c.id, m.key, 'record', now() FROM company c CROSS JOIN atlas_module m;
    INSERT INTO sync_mutation_log(module_key, record_id) SELECT key, id FROM atlas_module;
    INSERT INTO user_preference(value) VALUES ('{"path":"/app/m/atlas.core/settings?module=atlas.files#tab", "text":"Atlas customer text"}');
  `);
}

// No external URL argument or .env loading: this helper owns the entire database.
export async function withRunlyModuleFixture(callback) {
  const { stdout } = await docker('run', '--pull=never', '--rm', '--detach',
    '--publish', '127.0.0.1::5432', '--env', 'POSTGRES_PASSWORD=runly_fixture_only',
    '--env', 'POSTGRES_DB=runly_module_key_rehearsal', '--tmpfs', '/var/lib/postgresql', 'postgres:18-alpine');
  const containerId = stdout.trim();
  if (!/^[a-f0-9]{64}$/.test(containerId)) throw new Error('Docker did not return a valid owned container ID.');
  let client;
  try {
    let ready = false;
    for (let attempt = 0; attempt < 40; attempt++) {
      try { await docker('exec', containerId, 'pg_isready', '-U', 'postgres', '-d', 'runly_module_key_rehearsal'); ready = true; break; }
      catch { await delay(250); }
    }
    if (!ready) throw new Error('Temporary PostgreSQL did not become ready.');
    const { stdout: binding } = await docker('port', containerId, '5432/tcp');
    const match = binding.trim().match(/^127\.0\.0\.1:(\d+)$/);
    if (!match) throw new Error('Unexpected temporary PostgreSQL port binding.');
    client = new Client({ host: '127.0.0.1', port: Number(match[1]), user: 'postgres',
      password: 'runly_fixture_only', database: 'runly_module_key_rehearsal',
      application_name: 'runly-key-rehearsal-fixture', connectionTimeoutMillis: 5000 });
    await client.connect();
    await seedRunlyModuleFixture(client);
    return await callback(client);
  } finally {
    try { if (client) await client.end(); }
    finally { await docker('stop', '--time', '1', containerId); }
  }
}
