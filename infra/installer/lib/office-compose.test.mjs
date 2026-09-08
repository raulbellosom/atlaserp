import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('Compose validates local/external with Office enabled/disabled and Linux networking', async t => {
  if (spawnSync('docker', ['compose', 'version']).status !== 0) return t.skip('Docker Compose is not installed.');
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'atlas-office-compose-'));
  const source = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const names = ['docker-compose.yml', 'docker-compose.linux.yml', '.env', '.env.local', '.env.external'];
  try {
    for (const name of names) {
      if (name.endsWith('.yml')) await fs.copyFile(path.join(source, name), path.join(dir, name));
      else await fs.writeFile(path.join(dir, name), '# isolated compose validation\n');
    }
    for (const mode of ['local', 'external']) for (const office of [false, true]) for (const linux of [false, true]) {
      const args = ['compose', '--project-directory', dir, '-f', path.join(dir, 'docker-compose.yml'), ...(linux ? ['-f', path.join(dir, 'docker-compose.linux.yml')] : []), '--profile', mode, ...(office ? ['--profile', 'office'] : []), 'config', '--format', 'json'];
      const result = spawnSync('docker', args, { encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr);
      const config = JSON.parse(result.stdout);
      assert.equal(Boolean(config.services.collabora), office);
      if (office) {
        assert.equal(config.services.collabora.image, 'collabora/code:26.04.2.4.1');
        assert.equal(config.services.collabora.ports[0].host_ip, '127.0.0.1');
        assert.ok(config.services.collabora.environment.content_security_policy.includes('http://tauri.localhost'));
      }
      assert.ok(config.services[`atlas-api-${mode}`]);
    }
  } finally { for (const name of names) await fs.unlink(path.join(dir, name)); await fs.rmdir(dir); }
});
