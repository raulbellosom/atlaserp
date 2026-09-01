import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import JSZip from 'jszip'
import { createModulesRouter } from '../modules.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..', '..')

test('POST /modules/:key/upload recibe multipart, extrae el ZIP y responde con el módulo', async (t) => {
  const modulesDir = await fs.mkdtemp(path.join(REPO_ROOT, '.tmp-module-upload-route-'))
  const previousModulesDir = process.env.ATLAS_MODULES_DIR
  process.env.ATLAS_MODULES_DIR = modulesDir

  t.after(async () => {
    if (typeof previousModulesDir === 'string') process.env.ATLAS_MODULES_DIR = previousModulesDir
    else delete process.env.ATLAS_MODULES_DIR

    const resolved = path.resolve(modulesDir)
    assert.ok(resolved.startsWith(REPO_ROOT + path.sep))
    assert.ok(path.basename(resolved).startsWith('.tmp-module-upload-route-'))
    await fs.rm(resolved, { recursive: true, force: true })
  })

  const zip = new JSZip()
  zip.file('custom.uploadroute/module.manifest.js', `
    import { defineAtlasModule } from '@atlas/module-engine'
    export default defineAtlasModule({
      key: 'custom.uploadroute',
      name: 'Prueba de carga',
      version: '0.1.0',
      kind: 'FEATURE',
      icon: 'Package',
      color: '#2563EB',
      pwa: { shortName: 'Carga', startPath: '/inicio' },
      dependencies: [],
      models: [],
      views: [],
      permissions: [],
      navigation: [],
    })
  `)
  zip.file('custom.uploadroute/README.md', '# Prueba')
  const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })

  const permissionCalls = []
  const app = createModulesRouter({
    prisma: {
      atlasModule: { findUnique: async () => null },
    },
    authMiddleware: async (_c, next) => next(),
    requirePermission: (permission) => async (_c, next) => {
      permissionCalls.push(permission)
      await next()
    },
  })

  const form = new FormData()
  form.append('file', new Blob([buffer], { type: 'application/zip' }), 'custom.uploadroute.zip')
  const response = await app.fetch(new Request('http://localhost/custom.uploadroute/upload', {
    method: 'POST',
    body: form,
  }))
  const body = await response.json()

  assert.equal(response.status, 200)
  assert.equal(body.data.moduleKey, 'custom.uploadroute')
  assert.equal(body.data.fileCount, 2)
  assert.equal(body.data.syncResult.error.code, 'MODULE_NOT_FOUND_AFTER_SYNC')
  assert.deepEqual(permissionCalls, ['core.modules.upload'])
  await fs.access(path.join(modulesDir, 'custom.uploadroute', 'module.manifest.js'))
})
