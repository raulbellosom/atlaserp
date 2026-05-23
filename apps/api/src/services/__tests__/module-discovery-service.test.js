import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { loadModuleMigrations } from '../module-discovery-service.js'

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
