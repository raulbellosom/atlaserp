import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { BUNDLE_EXTERNALS } from '../../apps/api/src/services/module-bundler-service.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '..', '..')

function uniqueSorted(values) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b))
}

async function readRepoFile(...relativeParts) {
  return fs.readFile(path.join(REPO_ROOT, ...relativeParts), 'utf8')
}

async function copyDir(sourceDir, targetDir) {
  await fs.mkdir(targetDir, { recursive: true })
  const entries = await fs.readdir(sourceDir, { withFileTypes: true })
  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name)
    const targetPath = path.join(targetDir, entry.name)
    if (entry.isDirectory()) {
      await copyDir(sourcePath, targetPath)
    } else {
      await fs.copyFile(sourcePath, targetPath)
    }
  }
}

function extractNamedExports(source) {
  const exports = []
  const matches = source.matchAll(/export\s*\{([^}]+)\}\s*from\s*["'][^"']+["']/g)
  for (const match of matches) {
    const specifiers = String(match[1] ?? '')
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
    for (const specifier of specifiers) {
      if (specifier.includes(' as ')) {
        exports.push(specifier.split(/\s+as\s+/i).at(-1)?.trim())
      } else {
        exports.push(specifier)
      }
    }
  }
  return uniqueSorted(exports.filter(Boolean))
}

function extractPromptStarter(source) {
  const heading = '## AI Assistant Prompt Starter'
  const start = source.indexOf(heading)
  if (start === -1) {
    return [
      'Read `AGENTS.md`, `docs/ai-context/ame3-modules.md`, and `docs/ai-context/ame3-runtime-capabilities.md` first.',
      'Follow AME3 rules exactly.',
    ].join('\n')
  }

  const block = source.slice(start).split('\n')
  const promptLines = []
  for (const line of block) {
    if (promptLines.length === 0) {
      if (line.startsWith('> ')) promptLines.push(line.slice(2))
      continue
    }
    if (!line.startsWith('>') && line.trim() !== '') break
    promptLines.push(line.replace(/^>\s?/, ''))
  }
  return promptLines.join('\n').trim()
}

function buildTroubleshootingMarkdown(contract) {
  return [
    '# AME3 Troubleshooting',
    '',
    '## Common Failures',
    '',
    '- Missing `components/index.js`: the dynamic bundle cannot register your React components.',
    '- Bad registry key: `schema.component` must match `<moduleKey>:<ComponentName>` exactly.',
    '- Missing bundle build: run module install or sync and verify `GET /modules/<key>/bundle.js` returns 200.',
    '- Wrong file extension: module UI files must be `.jsx`, not `.tsx`.',
    '- Unsupported import: stay within the documented externals and allowed bundled dependencies.',
    '- Stale bundle cache: force a rebuild with `POST /modules/<key>/sync` and reload the page.',
    '',
    '## Explicit Imports',
    '',
    `- Use \`import { toast } from 'sonner'\` for toast notifications.`,
    `- Use \`@atlas/ui\` for UI primitives such as \`${contract.atlasUiExports.slice(0, 8).join('`, `')}\`.`,
    '',
  ].join('\n')
}

export async function buildAme3RuntimeContract() {
  const uiIndexSource = await readRepoFile('packages', 'ui', 'src', 'index.js')
  const runtimeDoc = await readRepoFile('docs', 'ai-context', 'ame3-runtime-capabilities.md')

  return {
    generatedAt: new Date().toISOString(),
    externals: uniqueSorted(BUNDLE_EXTERNALS),
    atlasUiExports: extractNamedExports(uiIndexSource),
    customView: {
      defineViewSignature: 'defineView({ key, kind: "CUSTOM", schema: { path, component, title } })',
      requiredFiles: [
        'views/dashboard.custom.js',
        'components/index.js',
        'components/ModuleDashboard.jsx',
      ],
      registryKeyPattern: '<moduleKey>:<ComponentName>',
      requiredSchemaFields: ['path', 'component', 'title'],
    },
    troubleshooting: [
      'missing components/index.js',
      'bad registry key',
      'missing bundle build',
      'wrong file extension',
      'unsupported import',
      'stale bundle cache',
    ],
    promptStarter: extractPromptStarter(runtimeDoc),
  }
}

export async function exportAme3Devkit({ outDir }) {
  const targetDir = path.resolve(outDir)
  const fixtureSourceDir = path.join(REPO_ROOT, 'scripts', 'fixtures', 'ame3-devkit', 'custom.goldenpath')
  const fixtureTargetDir = path.join(targetDir, 'golden-path-module')
  await fs.mkdir(targetDir, { recursive: true })

  const runtimeContract = await buildAme3RuntimeContract()
  const moduleGuide = await readRepoFile('docs', 'ai-context', 'ame3-modules.md')
  const runtimeGuide = await readRepoFile('docs', 'ai-context', 'ame3-runtime-capabilities.md')

  await Promise.all([
    fs.writeFile(path.join(targetDir, 'capabilities.runtime.json'), JSON.stringify(runtimeContract, null, 2), 'utf8'),
    fs.writeFile(path.join(targetDir, 'ame3-modules.md'), moduleGuide, 'utf8'),
    fs.writeFile(path.join(targetDir, 'ame3-runtime-capabilities.md'), runtimeGuide, 'utf8'),
    fs.writeFile(path.join(targetDir, 'prompt-starter.txt'), runtimeContract.promptStarter + '\n', 'utf8'),
    fs.writeFile(path.join(targetDir, 'troubleshooting.md'), buildTroubleshootingMarkdown(runtimeContract), 'utf8'),
    copyDir(fixtureSourceDir, fixtureTargetDir),
  ])

  return {
    outDir: targetDir,
    files: [
      'capabilities.runtime.json',
      'ame3-modules.md',
      'ame3-runtime-capabilities.md',
      'prompt-starter.txt',
      'troubleshooting.md',
      'golden-path-module/',
    ],
  }
}
