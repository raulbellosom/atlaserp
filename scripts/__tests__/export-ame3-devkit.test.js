import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

async function importDevkitTools() {
  try {
    return await import('../lib/ame3-devkit.js')
  } catch (error) {
    return { __importError: error }
  }
}

test('AME3 devkit helpers derive machine-readable capabilities from code and export a devkit bundle', async () => {
  const mod = await importDevkitTools()
  assert.ok(!mod.__importError, mod.__importError?.message ?? 'scripts/lib/ame3-devkit.js must exist')
  assert.equal(typeof mod.buildAme3RuntimeContract, 'function', 'buildAme3RuntimeContract must be exported')
  assert.equal(typeof mod.exportAme3Devkit, 'function', 'exportAme3Devkit must be exported')

  const contract = await mod.buildAme3RuntimeContract()
  assert.ok(Array.isArray(contract.externals), 'runtime contract must include externals[]')
  assert.ok(contract.externals.includes('sonner'), 'runtime contract must include sonner external')
  assert.ok(Array.isArray(contract.atlasUiExports), 'runtime contract must include atlasUiExports[]')
  assert.ok(contract.atlasUiExports.includes('PageHeader'), 'runtime contract must include PageHeader export')
  assert.ok(Array.isArray(contract.customView.requiredFiles), 'runtime contract must describe CUSTOM view required files')
  assert.ok(contract.customView.requiredFiles.includes('components/index.js'))

  const outDir = await fs.mkdtemp(path.join(os.tmpdir(), 'atlas-devkit-export-'))
  await mod.exportAme3Devkit({ outDir })

  const capabilitiesPath = path.join(outDir, 'capabilities.runtime.json')
  const docsPath = path.join(outDir, 'ame3-runtime-capabilities.md')
  const promptPath = path.join(outDir, 'prompt-starter.txt')
  const goldenPathManifest = path.join(outDir, 'golden-path-module', 'module.manifest.js')

  const capabilities = JSON.parse(await fs.readFile(capabilitiesPath, 'utf8'))
  assert.ok(capabilities.externals.includes('react'))
  assert.ok(capabilities.atlasUiExports.includes('Button'))
  assert.ok(capabilities.customView.requiredFiles.includes('views/dashboard.custom.js'))
  assert.match(await fs.readFile(docsPath, 'utf8'), /CUSTOM/i)
  assert.match(await fs.readFile(promptPath, 'utf8'), /Read `AGENTS\.md`/i)
  assert.match(await fs.readFile(goldenPathManifest, 'utf8'), /custom\.goldenpath/)

  await fs.rm(outDir, { recursive: true, force: true })
})
