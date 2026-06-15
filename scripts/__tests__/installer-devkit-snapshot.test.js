import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

async function collectRelativeFiles(rootDir) {
  const result = []

  async function walk(currentDir) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true })
    for (const entry of entries) {
      const absolutePath = path.join(currentDir, entry.name)
      if (entry.isDirectory()) {
        await walk(absolutePath)
      } else {
        result.push(path.relative(rootDir, absolutePath).split(path.sep).join('/'))
      }
    }
  }

  await walk(rootDir)
  return result.sort((a, b) => a.localeCompare(b))
}

test('installer devkit snapshot stays in sync with the export generator', async () => {
  const mod = await import('../lib/ame3-devkit.js')
  const outDir = await fs.mkdtemp(path.join(os.tmpdir(), 'atlas-devkit-snapshot-'))
  await mod.exportAme3Devkit({ outDir })

  const snapshotDir = path.resolve('infra/installer/devkit-export')
  const exportedFiles = await collectRelativeFiles(outDir)
  const snapshotFiles = await collectRelativeFiles(snapshotDir)
  assert.deepEqual(snapshotFiles, exportedFiles, 'infra/installer/devkit-export must be refreshed from the exporter')

  const exportedContract = JSON.parse(await fs.readFile(path.join(outDir, 'capabilities.runtime.json'), 'utf8'))
  const snapshotContract = JSON.parse(await fs.readFile(path.join(snapshotDir, 'capabilities.runtime.json'), 'utf8'))
  delete exportedContract.generatedAt
  delete snapshotContract.generatedAt
  assert.deepEqual(snapshotContract, exportedContract)

  const exportedManifest = JSON.parse(await fs.readFile(path.join(outDir, 'manifest.json'), 'utf8'))
  const snapshotManifest = JSON.parse(await fs.readFile(path.join(snapshotDir, 'manifest.json'), 'utf8'))
  delete exportedManifest.generatedAt
  delete snapshotManifest.generatedAt
  assert.deepEqual(snapshotManifest, exportedManifest)

  for (const relativePath of [
    'README.md',
    'AGENTS.md',
    'prompt-starter.txt',
    'troubleshooting.md',
    'docs/ai-context/ame3-runtime-capabilities.md',
    'golden-path-module/module.manifest.js',
  ]) {
    const generatedContent = await fs.readFile(path.join(outDir, relativePath), 'utf8')
    const snapshotContent = await fs.readFile(path.join(snapshotDir, relativePath), 'utf8')
    assert.equal(snapshotContent, generatedContent, `${relativePath} in infra/installer/devkit-export is stale`)
  }

  await fs.rm(outDir, { recursive: true, force: true })
})
