import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { BUNDLE_EXTERNALS } from '../../apps/api/src/services/module-bundler-service.js'
import { DEVKIT_EXPORT_REPO_PATH } from '../../infra/installer/lib/devkit-installer.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '..', '..')

const DEVKIT_DOC_FILES = [
  'docs/ai-context/ame3-modules.md',
  'docs/ai-context/ame3-runtime-capabilities.md',
  'docs/ai-context/atlas-storefront-sdk.md',
  'docs/02_module_system.md',
  'docs/03_core_modules.md',
  'docs/03_custom_modules.md',
  'docs/module-quality-standards.md',
  'docs/architecture/atlas-module-engine-v3.md',
  'docs/TASKS.md',
  'docs/superpowers/specs/2026-06-11-dist-auth-sdk-design.md',
  'docs/superpowers/specs/2026-06-14-storefront-capture-foundation-design.md',
  'docs/superpowers/specs/2026-06-14-growth-analytics-design.md',
  'docs/superpowers/specs/2026-06-14-growth-lead-inbox-design.md',
  'docs/superpowers/specs/2026-06-14-atlas-documents-template-engine-design.md',
]

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
    '- Import mistake: never import `toast` from `@atlas/ui`; use `import { toast } from \'sonner\'`.',
    '',
    '## Explicit Imports',
    '',
    `- Use \`import { toast } from 'sonner'\` for toast notifications.`,
    `- Never use \`import { toast } from '@atlas/ui'\` — that export does not exist in installer mode.`,
    `- Use \`@atlas/ui\` for UI primitives such as \`${contract.atlasUiExports.slice(0, 8).join('`, `')}\`.`,
    '',
  ].join('\n')
}

function buildReadme(runtimeContract) {
  return [
    '# Atlas ERP Dev Kit (AME3)',
    '',
    'This folder is generated from the Atlas ERP source repository and downloaded by the installer into `custom-modules/_atlas-devkit/`.',
    '',
    '## Start Here',
    '',
    '1. Read `AGENTS.md`.',
    '2. Read `docs/ai-context/ame3-modules.md`.',
    '3. Read `docs/ai-context/ame3-runtime-capabilities.md`.',
    '4. If generating code with AI, paste `prompt-starter.txt` first.',
    '5. If the module uses a CUSTOM view, compare it against `golden-path-module/` before debugging.',
    '',
    '## Important Files',
    '',
    '- `capabilities.runtime.json` — machine-readable contract for imports, UI exports, and CUSTOM requirements.',
    '- `troubleshooting.md` — common AME3 installer-mode failures and fixes.',
    '- `golden-path-module/` — minimal working module with CRUD + CUSTOM dashboard.',
    '- `docs/module-quality-standards.md` — shared UX and behavioral standards.',
    '',
    '## Non-Negotiable Import Rules',
    '',
    '- `toast` comes from `sonner`, not from `@atlas/ui`.',
    '- `@atlas/ui` is for UI components only.',
    `- Supported externals: ${runtimeContract.externals.join(', ')}`,
    '',
  ].join('\n')
}

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
  return uniqueSorted(result)
}

async function writeTextFile(targetDir, relativePath, content) {
  const destination = path.join(targetDir, relativePath)
  await fs.mkdir(path.dirname(destination), { recursive: true })
  await fs.writeFile(destination, content, 'utf8')
}

export async function buildAme3RuntimeContract() {
  const uiIndexSource = await readRepoFile('packages', 'ui', 'src', 'index.js')
  const runtimeDoc = await readRepoFile('docs', 'ai-context', 'ame3-runtime-capabilities.md')

  return {
    generatedAt: new Date().toISOString(),
    externals: uniqueSorted(BUNDLE_EXTERNALS),
    atlasUiExports: extractNamedExports(uiIndexSource),
    importRules: {
      toast: {
        module: 'sonner',
        symbol: 'toast',
        forbiddenModules: ['@atlas/ui'],
      },
      ui: {
        module: '@atlas/ui',
      },
    },
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
      'toast imported from @atlas/ui instead of sonner',
    ],
    promptStarter: extractPromptStarter(runtimeDoc),
  }
}

export async function exportAme3Devkit({ outDir }) {
  const targetDir = path.resolve(outDir)
  const fixtureSourceDir = path.join(REPO_ROOT, 'scripts', 'fixtures', 'ame3-devkit', 'custom.goldenpath')
  const fixtureTargetDir = path.join(targetDir, 'golden-path-module')
  const runtimeContract = await buildAme3RuntimeContract()

  await fs.rm(targetDir, { recursive: true, force: true }).catch(() => {})
  await fs.mkdir(targetDir, { recursive: true })

  await writeTextFile(targetDir, 'AGENTS.md', await readRepoFile('AGENTS.md'))
  await writeTextFile(targetDir, 'README.md', buildReadme(runtimeContract) + '\n')
  await writeTextFile(
    targetDir,
    'capabilities.runtime.json',
    JSON.stringify(runtimeContract, null, 2) + '\n'
  )
  await writeTextFile(targetDir, 'prompt-starter.txt', runtimeContract.promptStarter + '\n')
  await writeTextFile(targetDir, 'troubleshooting.md', buildTroubleshootingMarkdown(runtimeContract) + '\n')

  for (const relativePath of DEVKIT_DOC_FILES) {
    await writeTextFile(targetDir, relativePath, await readRepoFile(...relativePath.split('/')))
  }

  await copyDir(fixtureSourceDir, fixtureTargetDir)

  const manifest = {
    version: 1,
    generatedAt: runtimeContract.generatedAt,
    repoPath: DEVKIT_EXPORT_REPO_PATH,
    files: await collectRelativeFiles(targetDir),
  }

  await writeTextFile(targetDir, 'manifest.json', JSON.stringify(manifest, null, 2) + '\n')

  return {
    outDir: targetDir,
    files: manifest.files,
  }
}
