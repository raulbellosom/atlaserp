import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { OFFICIAL_MODULE_KEY_PAIRS } from '../../packages/core/src/module-identity.js';

const keys = OFFICIAL_MODULE_KEY_PAIRS.flatMap(pair => [pair.legacy, pair.current]);
const keySet = new Set(keys);
const candidatePattern = `(^|[^[:alnum:]_])(?:${keys.map(key => key.replaceAll('.', '\\.')).join('|')})([^[:alnum:]_]|$)`;
const isCandidateColumn = (name, type) => ['json', 'jsonb'].includes(type) || ['text', 'character varying'].includes(type) && /(?:key|path|url|route|href|scope)$/.test(name);
const identifier = value => `"${String(value).replaceAll('"', '""')}"`;

export function buildModuleKeyAudit(moduleKeys = []) {
  const present = new Set(moduleKeys);
  return {
    pairs: OFFICIAL_MODULE_KEY_PAIRS.map(pair => ({ ...pair, legacyPresent: present.has(pair.legacy), currentPresent: present.has(pair.current) })),
    collisions: OFFICIAL_MODULE_KEY_PAIRS.filter(pair => present.has(pair.legacy) && present.has(pair.current)),
    unknownLegacyKeys: [...present].filter(key => key.startsWith('atlas.') && !keySet.has(key)).sort(),
  };
}

export async function auditRunlyModuleDatabase(client) {
  await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY');
  try {
    await client.query("SET LOCAL statement_timeout = '10s'");
    await client.query("SET LOCAL lock_timeout = '1s'");
    const { rows: columns } = await client.query(`
      SELECT c.table_name, c.column_name, c.data_type
      FROM information_schema.columns c
      JOIN information_schema.tables t USING (table_catalog, table_schema, table_name)
      WHERE c.table_schema = 'public' AND t.table_type = 'BASE TABLE'
      ORDER BY c.table_name, c.ordinal_position
    `);
    const hasCatalog = columns.some(c => c.table_name === 'atlas_module' && c.column_name === 'key');
    if (!hasCatalog) throw new Error('Missing public.atlas_module catalog; database audit is incomplete.');
    const { rows: modules } = await client.query('SELECT key FROM public.atlas_module ORDER BY key');
    const identities = buildModuleKeyAudit(modules.map(row => row.key));
    const { rows: foreignKeys } = await client.query(`
      SELECT conrelid::regclass::text AS referencing_table, conname AS constraint_name
      FROM pg_constraint WHERE contype = 'f' AND confrelid = to_regclass('public.atlas_module')
      ORDER BY referencing_table, constraint_name
    `);
    const references = [];
    for (const column of columns.filter(c => isCandidateColumn(c.column_name, c.data_type))) {
      const table = `public.${identifier(column.table_name)}`;
      const name = identifier(column.column_name);
      const exact = column.column_name === 'module_key' || column.table_name === 'atlas_module' && column.column_name === 'key';
      const predicate = exact ? `${name} = ANY($1::text[])` : `${name}::text ~ $1`;
      const { rows } = await client.query(`SELECT count(*)::text AS count FROM ${table} WHERE ${predicate}`, [exact ? keys : candidatePattern]);
      references.push({ ...column, classification: exact ? 'exact-module-key' : 'candidate-needs-review', matchingRows: rows[0].count });
    }
    return { version: 1, mode: 'database-read-only', dataConversionReady: false, ...identities, foreignKeys, references,
      notes: ['Counts contain no row payloads.', 'JSON/path/key matches require semantic review; they are not replacement instructions.', 'Persistent conversion and complete runtime cutover remain stage 4b.'] };
  } finally {
    await client.query('ROLLBACK');
  }
}

export async function auditRunlyModuleSource(root) {
  const schema = await fs.readFile(path.join(root, 'prisma/schema.prisma'), 'utf8');
  const schemaReferences = [];
  const uuidRelations = [];
  for (const match of schema.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)) {
    const [, model, body] = match;
    const table = body.match(/@@map\("([^"]+)"\)/)?.[1] ?? model;
    for (const line of body.split('\n')) {
      const field = line.trim().match(/^(\w+)\s+(String|Json)\??\s*(.*)/);
      if (!field) continue;
      const [, name, type, attributes] = field;
      const column = attributes.match(/@map\("([^"]+)"\)/)?.[1] ?? name;
      if (isCandidateColumn(column, type === 'Json' ? 'jsonb' : 'text')) schemaReferences.push({ model, table, column, classification: column === 'module_key' || table === 'atlas_module' && column === 'key' ? 'exact-module-key' : 'candidate-needs-review' });
    }
    if (/\bAtlasModule[?\s].*@relation\(/.test(body)) uuidRelations.push({ model, table, action: 'preserve-module-uuid' });
  }
  const files = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
  const sourceReferences = [];
  const pattern = new RegExp(`\\b(?:${keys.map(key => key.replaceAll('.', '\\.')).join('|')})(?![\\w])`, 'g');
  for (const file of files) {
    if (!/^(apps|packages|scripts|infra|prisma)\//.test(file) || /(?:\/devkit-export\/|\/gen\/|prisma\/migrations\/)/.test(file) || !/\.(js|jsx|mjs|json|rs|prisma|yml|yaml)$/.test(file)) continue;
    const content = await fs.readFile(path.join(root, file), 'utf8');
    const counts = {};
    for (const [key] of content.matchAll(pattern)) counts[key] = (counts[key] ?? 0) + 1;
    if (Object.keys(counts).length) sourceReferences.push({ file, counts });
  }
  return { version: 1, mode: 'source-only', dataConversionReady: false, databaseInspected: false,
    pairs: OFFICIAL_MODULE_KEY_PAIRS, schemaReferences, uuidRelations, sourceReferences,
    notes: ['Tracked source inventory only; custom/untracked module trees and deployed bundles require separate review.', 'Database counts and collisions are unknown until an explicit read-only database audit.', 'No records, routes in saved JSON, permission keys, migration checksums, or physical tables were renamed.'] };
}
