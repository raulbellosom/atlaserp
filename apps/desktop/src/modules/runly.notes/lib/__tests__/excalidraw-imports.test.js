import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

// Plan B depends on these named exports of @excalidraw/excalidraw. Its prod
// bundle uses bundler-only module resolution (extensionless roughjs import), so
// a raw `await import()` fails under plain Node even though Vite resolves it.
// Assert against the package's public .d.ts surface instead — still a real
// guardrail: a version bump that renames or drops one of these fails here.
test('@excalidraw/excalidraw still exports the symbols we use', () => {
  const require = createRequire(import.meta.url)
  // package.json "exports" hides ./package.json, so resolve the entry and walk up.
  let dts
  try {
    const entry = require.resolve('@excalidraw/excalidraw')
    // entry -> .../@excalidraw/excalidraw/dist/prod/index.js
    const pkgRoot = dirname(dirname(dirname(entry)))
    dts = join(pkgRoot, 'dist', 'types', 'excalidraw', 'index.d.ts')
  } catch (err) {
    assert.fail(`cannot resolve @excalidraw/excalidraw: ${err.message}`)
  }
  const src = readFileSync(dts, 'utf8')
  for (const sym of ['reconcileElements', 'exportToBlob', 'exportToSvg', 'Excalidraw']) {
    assert.ok(new RegExp(`\\b${sym}\\b`).test(src), `missing export: ${sym}`)
  }
})
