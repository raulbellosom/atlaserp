import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { withRunlyModuleFixture } from './lib/runly-module-fixture.js';
import { rehearseRunlyModuleKeys } from './lib/runly-module-rehearsal.js';

try {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--help') {
    console.log('Usage: node scripts/rehearse-runly-module-keys.mjs [--out report.json]\nRequires Docker and a cached postgres:18-alpine image. Creates and removes its own synthetic database. No existing database, .env, --database or --apply support.');
  } else {
    if (args.length && !(args.length === 2 && args[0] === '--out' && args[1] && !args[1].startsWith('--'))) {
      throw new Error('Use --help for the supported rehearsal arguments.');
    }
    const report = await withRunlyModuleFixture(rehearseRunlyModuleKeys);
    const content = `${JSON.stringify(report, null, 2)}\n`;
    if (args[1]) {
      const output = path.resolve(args[1]);
      await mkdir(path.dirname(output), { recursive: true });
      await writeFile(output, content);
    } else console.log(content.trimEnd());
  }
} catch (error) {
  // Never serialize a database row, connection object, or command environment.
  const code = typeof error?.code === 'string' && /^[A-Z0-9_]+$/.test(error.code) ? ` (${error.code})` : '';
  console.error(`Runly rehearsal failed${code}. Check Docker, the cached PostgreSQL image and --help.`);
  process.exitCode = 1;
}
