import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import JSZip from 'jszip'
import { validateAndExtractZip } from '../module-upload-service.js'

async function temporaryModulesDir(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'atlas-module-upload-'))
  t.after(async () => {
    const resolved = path.resolve(directory)
    assert.ok(resolved.startsWith(path.resolve(os.tmpdir()) + path.sep))
    await fs.rm(resolved, { recursive: true, force: true })
  })
  return directory
}

async function zipBuffer(entries) {
  const zip = new JSZip()
  for (const [name, content] of Object.entries(entries)) zip.file(name, content)
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
}

test('extrae un módulo cuyo manifiesto está en la raíz del ZIP', async (t) => {
  const modulesDir = await temporaryModulesDir(t)
  const buffer = await zipBuffer({
    'module.manifest.js': "export default { key: 'custom.uploadtest' }",
    'api/index.js': 'export default function createRouter() {}',
  })

  const result = await validateAndExtractZip('custom.uploadtest', buffer, modulesDir)

  assert.equal(result.fileCount, 2)
  assert.equal(
    await fs.readFile(path.join(modulesDir, 'custom.uploadtest', 'api', 'index.js'), 'utf8'),
    'export default function createRouter() {}',
  )
})

test('acepta un único directorio contenedor y no lo duplica al extraer', async (t) => {
  const modulesDir = await temporaryModulesDir(t)
  const buffer = await zipBuffer({
    'custom.uploadtest/module.manifest.js': "export default { key: 'custom.uploadtest' }",
    'custom.uploadtest/components/index.js': 'export async function register() {}',
  })

  const result = await validateAndExtractZip('custom.uploadtest', buffer, modulesDir)

  assert.equal(result.fileCount, 2)
  await fs.access(path.join(modulesDir, 'custom.uploadtest', 'components', 'index.js'))
  await assert.rejects(fs.access(path.join(modulesDir, 'custom.uploadtest', 'custom.uploadtest')))
})

test('normaliza rutas con backslash creadas por herramientas ZIP de Windows', async (t) => {
  const modulesDir = await temporaryModulesDir(t)
  const buffer = await zipBuffer({
    'custom.uploadtest\\module.manifest.js': "export default { key: 'custom.uploadtest' }",
    'custom.uploadtest\\api\\index.js': 'export default function createRouter() {}',
  })

  const result = await validateAndExtractZip('custom.uploadtest', buffer, modulesDir)

  assert.equal(result.fileCount, 2)
  await fs.access(path.join(modulesDir, 'custom.uploadtest', 'api', 'index.js'))
})

test('bloquea traversal expresado con separadores de Windows', async (t) => {
  const modulesDir = await temporaryModulesDir(t)
  const buffer = await zipBuffer({
    'custom.uploadtest\\module.manifest.js': "export default { key: 'custom.uploadtest' }",
    'custom.uploadtest\\..\\outside.js': 'contenido no permitido',
  })

  await assert.rejects(
    validateAndExtractZip('custom.uploadtest', buffer, modulesDir),
    (error) => error.message === 'PATH_TRAVERSAL_DETECTED' && error.statusCode === 422,
  )
})

test('rechaza un ZIP cuya clave no coincide con la solicitada', async (t) => {
  const modulesDir = await temporaryModulesDir(t)
  const buffer = await zipBuffer({
    'module.manifest.js': "export default { key: 'custom.other' }",
  })

  await assert.rejects(
    validateAndExtractZip('custom.uploadtest', buffer, modulesDir),
    (error) => {
      assert.equal(error.message, 'MANIFEST_KEY_MISMATCH')
      assert.equal(error.statusCode, 422)
      assert.deepEqual(error.details, { expected: 'custom.uploadtest', found: 'custom.other' })
      return true
    },
  )
})

test('rechaza estructuras ambiguas con más de una carpeta raíz', async (t) => {
  const modulesDir = await temporaryModulesDir(t)
  const buffer = await zipBuffer({
    'custom.uploadtest/module.manifest.js': "export default { key: 'custom.uploadtest' }",
    'otro/readme.txt': 'archivo ajeno',
  })

  await assert.rejects(
    validateAndExtractZip('custom.uploadtest', buffer, modulesDir),
    (error) => error.message === 'AMBIGUOUS_ZIP_STRUCTURE' && error.statusCode === 422,
  )
})

test('rechaza contenido que no sea ZIP', async (t) => {
  const modulesDir = await temporaryModulesDir(t)
  await assert.rejects(
    validateAndExtractZip('custom.uploadtest', Buffer.from('no es un zip'), modulesDir),
    (error) => error.message === 'INVALID_ZIP' && error.statusCode === 422,
  )
})
