import { isDeepStrictEqual } from 'node:util';
import { OFFICIAL_MODULE_KEY_PAIRS } from '../../packages/core/src/module-identity.js';
import { buildModuleKeyAudit } from './runly-module-audit.js';

// A laboratory proof, not a production migration. JSON/history/offline identity
// and full application read/write compatibility remain separate work.
export const REHEARSAL_COLUMNS = Object.freeze([
  ['atlas_module', 'key'], ['atlas_model', 'module_key'], ['atlas_view', 'module_key'],
  ['module_migration', 'module_key'], ['permission', 'module_key'], ['file_asset', 'module_key'],
].map(pair => Object.freeze(pair)));
export const REHEARSAL_TABLES = Object.freeze([
  ...REHEARSAL_COLUMNS.map(([table]) => table), 'company', 'company_module',
  'module_dependency', 'blueprint', 'role', 'role_permission', 'user_profile',
  'user_permission_grant', 'file_asset_share', 'audit_log', 'sync_cursor',
  'sync_mutation_log', 'user_preference',
].sort());
const replacements = new Map(OFFICIAL_MODULE_KEY_PAIRS.map(pair => [pair.legacy, pair.current]));
const identifier = value => `"${value.replaceAll('"', '""')}"`;
const fail = code => { throw Object.assign(new Error(code), { code }); };

export async function snapshotRehearsalRows(client) {
  const snapshot = {};
  for (const table of REHEARSAL_TABLES) {
    const { rows } = await client.query(`SELECT to_jsonb(t) AS value FROM public.${identifier(table)} t ORDER BY id`);
    snapshot[table] = rows.map(row => row.value);
  }
  return snapshot;
}

export async function rehearseRunlyModuleKeys(client) {
  // Only the fixture initializer creates this session-local marker. No CLI
  // accepts a connection string or offers a commit/apply operation.
  const { rows: marker } = await client.query("SELECT current_database() AS name, to_regclass('pg_temp.runly_module_key_fixture')::text AS marker");
  if (marker[0]?.name !== 'runly_module_key_rehearsal' || !marker[0]?.marker) fail('FIXTURE_REQUIRED');
  await client.query('BEGIN');
  try {
    await client.query("SET LOCAL statement_timeout = '10s'");
    await client.query("SET LOCAL lock_timeout = '1s'");
    await client.query("SET LOCAL idle_in_transaction_session_timeout = '15s'");
    await client.query(`LOCK TABLE ${REHEARSAL_TABLES.map(table => `public.${identifier(table)}`).join(', ')} IN SHARE ROW EXCLUSIVE MODE`);
    const before = await snapshotRehearsalRows(client);
    const catalog = new Set(before.atlas_module.map(row => row.key));
    const audit = buildModuleKeyAudit([...catalog]);
    if (audit.collisions.length) fail('MODULE_KEY_COLLISION');
    if (audit.unknownLegacyKeys.length) fail('UNKNOWN_LEGACY_MODULE');
    const journal = REHEARSAL_COLUMNS.map(([table, column]) => ({ table, column,
      rows: before[table].filter(row => replacements.has(row[column])).map(row => ({ id: row.id, before: row[column], after: replacements.get(row[column]) })),
    }));
    if (journal.some(entry => entry.rows.some(row => !catalog.has(row.before)))) fail('ORPHAN_MODULE_REFERENCE');
    const expected = structuredClone(before);
    for (const { table, column, rows } of journal) {
      const result = await client.query(`UPDATE public.${identifier(table)} AS target
        SET ${identifier(column)} = mapping.new_key
        FROM unnest($1::uuid[], $2::text[], $3::text[]) AS mapping(id, old_key, new_key)
        WHERE target.id = mapping.id AND target.${identifier(column)} = mapping.old_key`,
      [rows.map(row => row.id), rows.map(row => row.before), rows.map(row => row.after)]);
      if (result.rowCount !== rows.length) fail('FORWARD_ROW_COUNT_MISMATCH');
      for (const row of expected[table]) row[column] = replacements.get(row[column]) ?? row[column];
    }
    if (!isDeepStrictEqual(await snapshotRehearsalRows(client), expected)) fail('FORWARD_INVARIANT_FAILED');

    // Restore precisely the rows changed above, not every Runly-named row.
    for (const { table, column, rows } of [...journal].reverse()) {
      const result = await client.query(`UPDATE public.${identifier(table)} AS target
        SET ${identifier(column)} = mapping.old_key
        FROM unnest($1::uuid[], $2::text[], $3::text[]) AS mapping(id, old_key, new_key)
        WHERE target.id = mapping.id AND target.${identifier(column)} = mapping.new_key`,
      [rows.map(row => row.id), rows.map(row => row.before), rows.map(row => row.after)]);
      if (result.rowCount !== rows.length) fail('REVERSE_ROW_COUNT_MISMATCH');
    }
    if (!isDeepStrictEqual(await snapshotRehearsalRows(client), before)) fail('REVERSE_INVARIANT_FAILED');
    return { version: 1, mode: 'synthetic-postgres-rehearsal', dataConversionReady: false,
      persisted: false, reversalVerified: true, fixtureTables: REHEARSAL_TABLES.length,
      convertedColumns: journal.map(({ table, column, rows }) => ({ table, column, matchingRows: rows.length })),
      deferred: ['Full runtime read/write cutover', 'Semantic JSON/path conversion',
        'Audit and offline identity policy', 'Representative installation-copy rehearsal', 'Post-commit operational rollback'],
    };
  } finally {
    await client.query('ROLLBACK');
  }
}
