import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'

const DOCS_TO_VALIDATE = [
  path.resolve('docs/03_custom_modules.md'),
  path.resolve('docs/ai-context/ame3-modules.md'),
  path.resolve('docs/ai-context/ame3-runtime-capabilities.md'),
]

test('AME3 docs do not use the legacy two-argument defineView signature', async () => {
  for (const docPath of DOCS_TO_VALIDATE) {
    const content = await fs.readFile(docPath, 'utf8')
    assert.doesNotMatch(
      content,
      /defineView\(\s*['"`][^'"`]+['"`]\s*,\s*\{/,
      `${path.basename(docPath)} still contains a legacy defineView('key', { ... }) example`
    )
  }
})

test('installer-facing AME3 docs include CUSTOM view troubleshooting and explicit toast import guidance', async () => {
  const runtimeDoc = await fs.readFile(path.resolve('docs/ai-context/ame3-runtime-capabilities.md'), 'utf8')

  assert.match(runtimeDoc, /sonner/i, 'runtime capabilities doc must mention sonner for toast imports')
  assert.match(runtimeDoc, /\btoast\b/, 'runtime capabilities doc must mention toast explicitly')
  assert.match(
    runtimeDoc,
    /never import\s+toast\s+from\s+[`'"]@atlas\/ui[`'"]|toast.*[`'"]sonner[`'"].*not.*@atlas\/ui/i,
    'runtime capabilities doc must explicitly forbid importing toast from @atlas/ui'
  )
  assert.match(runtimeDoc, /components\/index\.js/i, 'runtime capabilities doc must mention components/index.js')
  assert.match(runtimeDoc, /stale bundle cache|bundle cache/i, 'runtime capabilities doc must mention stale bundle cache troubleshooting')
  assert.match(runtimeDoc, /unsupported import|imports? permitidos/i, 'runtime capabilities doc must mention unsupported imports troubleshooting')
})
