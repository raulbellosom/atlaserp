import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Will be imported once service exists
let computeSourceHash

describe('module-bundler-service', () => {
  describe('computeSourceHash', () => {
    let tmpDir

    before(async () => {
      tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'atlas-bundler-test-'))
      await fs.writeFile(path.join(tmpDir, 'index.js'), 'export function register() {}')
      await fs.writeFile(path.join(tmpDir, 'Comp.jsx'), 'export default function Comp() { return null }')
    })

    after(async () => {
      await fs.rm(tmpDir, { recursive: true, force: true })
    })

    it('returns a 64-char hex string', async () => {
      ;({ computeSourceHash } = await import('../module-bundler-service.js'))
      const hash = await computeSourceHash(tmpDir)
      assert.match(hash, /^[0-9a-f]{64}$/)
    })

    it('returns the same hash on repeated calls', async () => {
      const h1 = await computeSourceHash(tmpDir)
      const h2 = await computeSourceHash(tmpDir)
      assert.equal(h1, h2)
    })

    it('returns a different hash when a file changes', async () => {
      const before = await computeSourceHash(tmpDir)
      await fs.writeFile(path.join(tmpDir, 'index.js'), 'export function register() { /* changed */ }')
      const after = await computeSourceHash(tmpDir)
      assert.notEqual(before, after)
    })
  })
})
