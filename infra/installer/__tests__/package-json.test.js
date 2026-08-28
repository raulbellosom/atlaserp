import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'

test('installer package.json exposes simple cross-platform scripts for local, external, docs, and stop flows', async () => {
  const packageJsonPath = path.resolve('infra/installer/package.json')
  const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'))
  const scripts = packageJson.scripts ?? {}

  assert.equal(packageJson.name, 'atlaserp-installer')
  assert.equal(packageJson.private, true)
  assert.equal(packageJson.type, 'module')

  assert.equal(scripts['atlas:local'], 'node ./setup-local.mjs')
  assert.equal(scripts['atlas:local:docs'], 'node ./setup-local.mjs --docs-only')
  assert.equal(scripts['atlas:external'], 'node ./setup-external.mjs')
  assert.equal(scripts['atlas:external:docs'], 'node ./setup-external.mjs --docs-only')
  assert.equal(scripts['atlas:stop:local'], 'node ./stop-local.mjs')
  assert.equal(scripts['atlas:stop:external'], 'node ./stop-external.mjs')
})

test('installer README advertises npm script shortcuts after bootstrap download', async () => {
  const readme = await fs.readFile(path.resolve('infra/installer/README.md'), 'utf8')

  assert.match(readme, /npm run atlas:local/i, 'installer README must advertise npm run atlas:local')
  assert.match(readme, /npm\.cmd run atlas:local/i, 'installer README must show npm.cmd for PowerShell users')
  assert.match(readme, /npm run atlas:external/i, 'installer README must advertise npm run atlas:external')
  assert.match(readme, /npm run atlas:local:docs/i, 'installer README must advertise npm run atlas:local:docs')
})

test('installer quick-start docs use bootstrap scripts instead of hardcoded file lists or fixed drive paths', async () => {
  const installerReadme = await fs.readFile(path.resolve('infra/installer/README.md'), 'utf8')
  const rootReadme = await fs.readFile(path.resolve('README.md'), 'utf8')

  assert.match(installerReadme, /bootstrap-local\.ps1/i, 'installer README must expose a PowerShell bootstrap script')
  assert.match(installerReadme, /bootstrap-local\.sh/i, 'installer README must expose a shell bootstrap script')
  assert.doesNotMatch(installerReadme, /mkdir\s+C:\\atlaserp-installer/i, 'installer README must not force a fixed C: path')

  assert.match(rootReadme, /bootstrap-local\.ps1/i, 'root README must expose the PowerShell bootstrap script')
  assert.doesNotMatch(rootReadme, /mkdir\s+C:\\atlaserp-installer/i, 'root README must not force a fixed C: path')
})

test('bootstrap entry scripts download every local library imported by setup', async () => {
  const setupLocal = await fs.readFile(path.resolve('infra/installer/setup-local.mjs'), 'utf8')
  const setupExternal = await fs.readFile(path.resolve('infra/installer/setup-external.mjs'), 'utf8')
  const bootstrapLocal = await fs.readFile(path.resolve('infra/installer/bootstrap-local.sh'), 'utf8')
  const bootstrapExternal = await fs.readFile(path.resolve('infra/installer/bootstrap-external.sh'), 'utf8')

  for (const [setup, bootstrap, label] of [
    [setupLocal, bootstrapLocal, 'local'],
    [setupExternal, bootstrapExternal, 'external'],
  ]) {
    const imports = [...setup.matchAll(/from\s+["']\.\/(lib\/[^"']+)["']/g)]
      .map((match) => match[1])
    assert.ok(imports.length > 0, `${label} setup must declare its shared installer libraries`)
    for (const importedFile of imports) {
      assert.ok(
        bootstrap.includes(importedFile),
        `${label} bootstrap must download imported file ${importedFile}`
      )
    }
  }
})

test('bootstrap scripts download the full installer file set for local and external flows', async () => {
  const bootstrapLocalPs1 = await fs.readFile(path.resolve('infra/installer/bootstrap-local.ps1'), 'utf8')
  const bootstrapLocalSh = await fs.readFile(path.resolve('infra/installer/bootstrap-local.sh'), 'utf8')
  const bootstrapExternalPs1 = await fs.readFile(path.resolve('infra/installer/bootstrap-external.ps1'), 'utf8')
  const bootstrapExternalSh = await fs.readFile(path.resolve('infra/installer/bootstrap-external.sh'), 'utf8')

  for (const content of [bootstrapLocalPs1, bootstrapLocalSh]) {
    assert.match(content, /docker-compose\.yml/i)
    assert.match(content, /package\.json/i)
    assert.match(content, /setup-local\.mjs/i)
    assert.match(content, /stop-local\.mjs/i)
  }

  for (const content of [bootstrapExternalPs1, bootstrapExternalSh]) {
    assert.match(content, /docker-compose\.yml/i)
    assert.match(content, /package\.json/i)
    assert.match(content, /setup-external\.mjs/i)
    assert.match(content, /stop-external\.mjs/i)
    assert.match(content, /\.env\.external\.example/i)
  }
})

test('every file referenced by the bootstrap scripts exists in infra/installer', async () => {
  const requiredFiles = [
    'docker-compose.yml',
    'docker-compose.linux.yml',
    'lib/devkit-installer.mjs',
    'package.json',
    'setup-local.mjs',
    'setup-local.ps1',
    'setup-local.sh',
    'stop-local.mjs',
    'stop-local.ps1',
    'stop-local.sh',
    'setup-external.mjs',
    'setup-external.sh',
    'stop-external.mjs',
    'stop-external.ps1',
    'stop-external.sh',
    '.env.external.example',
  ]

  for (const relativePath of requiredFiles) {
    await fs.access(path.resolve('infra/installer', relativePath))
  }
})
