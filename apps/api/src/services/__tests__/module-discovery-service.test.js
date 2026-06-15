import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { discoverModules, loadModuleMigrations } from '../module-discovery-service.js'

test('loadModuleMigrations fails fast when manifest checksum does not match SQL file', async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'atlas-discovery-'))
  const moduleDir = path.join(tempRoot, 'custom.sample')
  const migrationsDir = path.join(moduleDir, 'migrations')
  await fs.mkdir(migrationsDir, { recursive: true })

  const migrationPath = path.join(migrationsDir, 'V001_init.sql')
  await fs.writeFile(migrationPath, 'CREATE TABLE IF NOT EXISTS "demo" ("id" UUID);\n', 'utf8')

  await assert.rejects(
    () =>
      loadModuleMigrations({
        moduleDir,
        manifest: {
          migrations: [
            {
              path: './migrations/V001_init.sql',
              checksum: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            },
          ],
        },
      }),
    (error) => {
      assert.equal(error?.code, 'MANIFEST_MIGRATION_CHECKSUM_MISMATCH')
      assert.ok(String(error?.message ?? '').includes('Checksum mismatch'))
      return true
    }
  )

  await fs.rm(tempRoot, { recursive: true, force: true })
})

test('discoverModules reads custom modules from ATLAS_MODULES_DIR when provided', async () => {
  const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'atlas-discovery-project-'))
  const externalCustomRoot = path.join(projectRoot, 'custom-modules')
  const previousModulesDir = process.env.ATLAS_MODULES_DIR

  await fs.writeFile(path.join(projectRoot, 'pnpm-workspace.yaml'), 'packages:\n  - "apps/*"\n', 'utf8')
  await fs.writeFile(path.join(projectRoot, 'package.json'), '{"name":"tmp","type":"module"}', 'utf8')
  await fs.mkdir(path.join(projectRoot, 'modules', 'official'), { recursive: true })
  await fs.mkdir(path.join(externalCustomRoot, 'custom.externaldemo', 'models'), { recursive: true })
  await fs.mkdir(path.join(externalCustomRoot, 'custom.externaldemo', 'views'), { recursive: true })
  await fs.writeFile(
    path.join(externalCustomRoot, 'custom.externaldemo', 'module.manifest.js'),
    `export default {
      key: 'custom.externaldemo',
      name: 'Externo Demo',
      version: '0.1.0',
      kind: 'FEATURE',
      icon: 'Boxes',
      color: '#2563eb',
      pwa: { shortName: 'Demo', startPath: '/demo' },
      dependencies: [{ key: 'atlas.core' }],
      models: ['./models/demo.model.js'],
      views: ['./views/demo.table.js'],
      permissions: [{ key: 'externaldemo.demo.read', name: 'Ver demo' }],
      navigation: [{ label: 'Demo', path: '/app/m/custom.externaldemo/demo', icon: 'Boxes', permissionKey: 'externaldemo.demo.read', layout: 'main' }],
      lifecycle: {
        installable: true,
        uninstallable: true,
        resettable: true,
        supportsDataPurge: true,
        defaultUninstallPolicy: 'purge-owned-tables',
        ownedModels: ['externaldemo.demo'],
        ownedTables: ['externaldemo_demo'],
      },
    }`,
    'utf8'
  )
  await fs.writeFile(
    path.join(externalCustomRoot, 'custom.externaldemo', 'models', 'demo.model.js'),
    `export default {
      key: 'demo',
      name: 'externaldemo.demo',
      label: 'Demo',
      tableName: 'externaldemo_demo',
      companyScoped: true,
      softDelete: true,
      fields: [{ name: 'name', type: 'text', label: 'Nombre', required: true }],
    }`,
    'utf8'
  )
  await fs.writeFile(
    path.join(externalCustomRoot, 'custom.externaldemo', 'views', 'demo.table.js'),
    `export default {
      key: 'externaldemo.demo.table',
      kind: 'TABLE',
      schema: {
        entity: 'demo',
        component: 'AtlasTable',
        columns: [{ field: 'name', label: 'Nombre' }],
      },
    }`,
    'utf8'
  )

  process.env.ATLAS_MODULES_DIR = externalCustomRoot
  const records = await discoverModules({ rootDir: projectRoot })
  const record = records.find((entry) => entry.key === 'custom.externaldemo')

  assert.ok(record, 'custom.externaldemo should be discovered from ATLAS_MODULES_DIR')
  assert.equal(record?.status, 'VALID')
  assert.equal(record?.source, 'custom')

  if (typeof previousModulesDir === 'string') {
    process.env.ATLAS_MODULES_DIR = previousModulesDir
  } else {
    delete process.env.ATLAS_MODULES_DIR
  }
  await fs.rm(projectRoot, { recursive: true, force: true })
})
