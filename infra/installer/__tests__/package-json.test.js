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

test('installer README tells bootstrap users to download package.json and advertises npm script shortcuts', async () => {
  const readme = await fs.readFile(path.resolve('infra/installer/README.md'), 'utf8')

  assert.match(readme, /package\.json/i, 'installer README must tell users to download package.json')
  assert.match(readme, /npm run atlas:local/i, 'installer README must advertise npm run atlas:local')
  assert.match(readme, /npm\.cmd run atlas:local/i, 'installer README must show npm.cmd for PowerShell users')
  assert.match(readme, /npm run atlas:external/i, 'installer README must advertise npm run atlas:external')
  assert.match(readme, /npm run atlas:local:docs/i, 'installer README must advertise npm run atlas:local:docs')
})

test('bootstrap entry scripts remain standalone downloads without hidden local imports', async () => {
  const setupLocal = await fs.readFile(path.resolve('infra/installer/setup-local.mjs'), 'utf8')
  const setupExternal = await fs.readFile(path.resolve('infra/installer/setup-external.mjs'), 'utf8')

  assert.doesNotMatch(
    setupLocal,
    /from\s+["']\.\/lib\//,
    'setup-local.mjs must not depend on extra local files that bootstrap users do not download'
  )
  assert.doesNotMatch(
    setupExternal,
    /from\s+["']\.\/lib\//,
    'setup-external.mjs must not depend on extra local files that bootstrap users do not download'
  )
})
