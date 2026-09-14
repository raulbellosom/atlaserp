#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditRunlyModuleDatabase, auditRunlyModuleSource } from './lib/runly-module-audit.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);

async function main() {
  if (args.includes('--help')) {
    console.log('Usage: node scripts/audit-runly-module-keys.mjs [--database] [--out report.json]\nDefault: offline tracked source/schema inventory. Database mode requires RUNLY_MIGRATION_DATABASE_URL and only reads aggregates. No --apply mode.');
    return;
  }
  let database = false;
  let out;
  for (let index = 0; index < args.length; index++) {
    if (args[index] === '--database') database = true;
    else if (args[index] === '--out' && args[index + 1] && !args[index + 1].startsWith('--')) out = args[++index];
    else throw new Error('Invalid audit arguments; use --help.');
  }
  let report;
  if (database) {
    const connectionString = process.env.RUNLY_MIGRATION_DATABASE_URL;
    if (!connectionString) throw new Error('Set RUNLY_MIGRATION_DATABASE_URL explicitly; .env is never loaded by this audit.');
    const { Client } = await import('pg');
    const client = new Client({ connectionString, application_name: 'runly-module-key-audit', connectionTimeoutMillis: 5000 });
    try {
      await client.connect();
      report = await auditRunlyModuleDatabase(client);
    } catch {
      // Connection/SQL errors can contain connection details or row payloads.
      throw new Error('Database audit did not complete; check access, schema and query timeouts. No conversion was attempted.');
    } finally { await client.end(); }
  } else report = await auditRunlyModuleSource(root);
  const text = JSON.stringify(report, null, 2) + '\n';
  if (out) {
    await fs.mkdir(path.dirname(path.resolve(out)), { recursive: true });
    await fs.writeFile(out, text, 'utf8');
    console.log(`Audit written to ${out} (${report.mode}; conversion pending).`);
  } else process.stdout.write(text);
  if (report.collisions?.length || report.unknownLegacyKeys?.length) process.exitCode = 2;
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
