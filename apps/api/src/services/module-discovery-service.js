import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
// TODO(AME3): switch to '@atlas/module-engine' once the package is linked for API runtime resolution.
import {
  validateManifest,
  validateModel,
  validatePage,
  validateView,
} from '../../../../packages/module-engine/src/index.js'

const SOURCE_OFFICIAL = 'official'
const SOURCE_CUSTOM = 'custom'
const apiSourceDir = path.dirname(fileURLToPath(import.meta.url))

const RESERVED_CUSTOM_PREFIXES = ['atlas.', 'core.', 'system.', 'identity.']

function toErrorMessage(error) {
  if (!error) return 'Unknown error'
  if (typeof error === 'string') return error
  if (error instanceof Error) return error.message
  if (typeof error.message === 'string') return error.message
  try {
    return JSON.stringify(error)
  } catch {
    return String(error)
  }
}

function normalizeRootDir(rootDir) {
  return path.resolve(typeof rootDir === 'string' && rootDir.trim() ? rootDir : process.cwd())
}

async function isDirectory(targetPath) {
  try {
    const stats = await fs.stat(targetPath)
    return stats.isDirectory()
  } catch {
    return false
  }
}

async function inspectProjectRoot(candidateDir) {
  const normalizedDir = normalizeRootDir(candidateDir)
  const pnpmWorkspacePath = path.join(normalizedDir, 'pnpm-workspace.yaml')
  const packageJsonPath = path.join(normalizedDir, 'package.json')
  const modulesPath = path.join(normalizedDir, 'modules')
  const customModulesPath = path.join(modulesPath, SOURCE_CUSTOM)

  const pnpmWorkspaceExists = await pathExists(pnpmWorkspacePath)
  const packageJsonExists = await pathExists(packageJsonPath)
  const modulesDirExists = await isDirectory(modulesPath)
  const customModulesDirExists = await isDirectory(customModulesPath)
  const valid = pnpmWorkspaceExists && packageJsonExists && modulesDirExists

  return {
    projectRoot: normalizedDir,
    pnpmWorkspaceExists,
    packageJsonExists,
    modulesDirExists,
    customModulesDirExists,
    valid,
  }
}

async function findProjectRootUpward(startDir) {
  let current = normalizeRootDir(startDir)
  while (true) {
    const inspection = await inspectProjectRoot(current)
    if (inspection.valid) {
      return inspection
    }
    const parentDir = path.dirname(current)
    if (parentDir === current) {
      return null
    }
    current = parentDir
  }
}

export async function getDiscoveryRootInfo(options = {}) {
  const env = options.env ?? process.env
  const cwd = normalizeRootDir(options.cwd ?? process.cwd())
  const sourceDir = normalizeRootDir(options.sourceDir ?? apiSourceDir)

  const envRootRaw = typeof env.ATLAS_PROJECT_ROOT === 'string' ? env.ATLAS_PROJECT_ROOT.trim() : ''
  if (envRootRaw) {
    const envInspection = await inspectProjectRoot(envRootRaw)
    if (envInspection.valid) {
      return {
        cwd,
        projectRoot: envInspection.projectRoot,
        resolution: 'env',
        modulesDirExists: envInspection.modulesDirExists,
        customModulesDirExists: envInspection.customModulesDirExists,
      }
    }
  }

  const fromCwd = await findProjectRootUpward(cwd)
  if (fromCwd) {
    return {
      cwd,
      projectRoot: fromCwd.projectRoot,
      resolution: 'cwd-upward',
      modulesDirExists: fromCwd.modulesDirExists,
      customModulesDirExists: fromCwd.customModulesDirExists,
    }
  }

  const fromSourceDir = await findProjectRootUpward(sourceDir)
  if (fromSourceDir) {
    return {
      cwd,
      projectRoot: fromSourceDir.projectRoot,
      resolution: 'api-source-upward',
      modulesDirExists: fromSourceDir.modulesDirExists,
      customModulesDirExists: fromSourceDir.customModulesDirExists,
    }
  }

  throw new Error(
    `Project root not found. Expected pnpm-workspace.yaml, package.json, and modules/ starting from cwd (${cwd}) or API source (${sourceDir}).`
  )
}

export async function resolveProjectRoot(options = {}) {
  const info = await getDiscoveryRootInfo(options)
  return info.projectRoot
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function toRequiredString(value, label) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label} must be a non-empty string`)
  }
  return value.trim()
}

function toRecordError(code, error, extra = {}) {
  return {
    code,
    message: toErrorMessage(error),
    ...extra,
  }
}

function toPosixPath(value) {
  return value.split(path.sep).join('/')
}

function relativePath(rootDir, absolutePath) {
  return toPosixPath(path.relative(rootDir, absolutePath))
}

function isWithinPath(parentPath, childPath) {
  const rel = path.relative(parentPath, childPath)
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath)
    return true
  } catch {
    return false
  }
}

async function ensureInsideRoot(rootPath, candidatePath, label) {
  const rootReal = await fs.realpath(rootPath)
  const candidateReal = await fs.realpath(candidatePath)
  if (!isWithinPath(rootReal, candidateReal)) {
    throw new Error(`${label} resolves outside the allowed discovery root`)
  }
  return candidateReal
}

async function resolveDeclaredModuleFile({ moduleDir, declaredPath, label }) {
  const safeModuleDir = path.resolve(moduleDir)
  const safeDeclaredPath = toRequiredString(declaredPath, label)
  const normalized = safeDeclaredPath.replaceAll('\\', '/')

  if (path.isAbsolute(safeDeclaredPath)) {
    throw new Error(`${label} must be a relative path inside moduleDir`)
  }
  if (normalized.includes('\0')) {
    throw new Error(`${label} contains invalid null byte`)
  }
  if (normalized.split('/').includes('..')) {
    throw new Error(`${label} must not contain traversal segments`)
  }

  const resolvedPath = path.resolve(safeModuleDir, safeDeclaredPath)
  if (!isWithinPath(safeModuleDir, resolvedPath)) {
    throw new Error(`${label} resolves outside moduleDir`)
  }
  if (!(await pathExists(resolvedPath))) {
    throw new Error(`${label} not found: ${safeDeclaredPath}`)
  }
  return ensureInsideRoot(safeModuleDir, resolvedPath, label)
}

function readManifestReferencePaths({ manifest, key, label }) {
  const value = manifest?.[key]
  if (value === undefined || value === null) return []
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array when provided`)
  }

  return value.map((entry, index) => {
    if (typeof entry === 'string') {
      return toRequiredString(entry, `${label}[${index}]`)
    }
    if (isPlainObject(entry) && typeof entry.path === 'string') {
      return toRequiredString(entry.path, `${label}[${index}].path`)
    }
    throw new Error(`${label}[${index}] must be a string path or { path } object`)
  })
}

function extractObjectExports(moduleNamespace) {
  if (!isPlainObject(moduleNamespace)) return []

  const values = []
  if (isPlainObject(moduleNamespace.default)) {
    values.push(moduleNamespace.default)
  }

  for (const [exportName, exportValue] of Object.entries(moduleNamespace)) {
    if (exportName === 'default') continue
    if (isPlainObject(exportValue)) {
      values.push(exportValue)
    }
  }

  return values
}

function toPageAsView(pageDeclaration) {
  return {
    key: pageDeclaration.key,
    kind: 'PAGE',
    type: 'PAGE',
    title: pageDeclaration.title,
    schema: {
      ...pageDeclaration,
      page: {
        ...pageDeclaration,
      },
    },
    enabled: true,
  }
}

async function importLocalModule(filePath) {
  return import(pathToFileURL(filePath).href)
}

function looksLikePageDeclaration(value) {
  if (!isPlainObject(value)) return false
  return (
    typeof value.path === 'string' &&
    value.path.startsWith('/') &&
    typeof value.title === 'string' &&
    !isPlainObject(value.schema)
  )
}

export function validateDiscoveredModule(record) {
  const errors = []
  if (!isPlainObject(record)) {
    return { valid: false, errors: ['record must be a plain object'] }
  }

  if (!record.key || typeof record.key !== 'string') {
    errors.push('manifest key is required')
  }

  if (!record.manifest || !isPlainObject(record.manifest)) {
    errors.push('manifest must be a plain object')
  } else {
    const manifestValidation = validateManifest(record.manifest)
    if (!manifestValidation.valid) {
      errors.push(...manifestValidation.errors)
    }

    const key = record.manifest.key
    if (record.source === SOURCE_OFFICIAL) {
      if (typeof key !== 'string' || !key.startsWith('atlas.')) {
        errors.push('official modules must use the atlas.* namespace')
      }
    }

    if (record.source === SOURCE_CUSTOM) {
      const reserved = RESERVED_CUSTOM_PREFIXES.find((prefix) => key?.startsWith(prefix))
      if (reserved) {
        errors.push(
          `custom/community modules cannot use reserved namespace "${reserved}" (key: ${key})`
        )
      }
    }
  }

  return { valid: errors.length === 0, errors }
}

export async function loadModuleManifest({ manifestPath, source }) {
  const safeManifestPath = path.resolve(manifestPath)

  if (path.basename(safeManifestPath) !== 'module.manifest.js') {
    return {
      key: null,
      manifest: null,
      status: 'ERROR',
      error: toRecordError('INVALID_MANIFEST_PATH', 'manifest filename must be module.manifest.js'),
    }
  }

  try {
    const manifestModule = await importLocalModule(safeManifestPath)
    const manifest = manifestModule?.default

    if (!isPlainObject(manifest)) {
      return {
        key: null,
        manifest: null,
        status: 'ERROR',
        error: toRecordError('INVALID_MANIFEST_EXPORT', 'module manifest default export must be an object'),
      }
    }

    const validation = validateManifest(manifest)
    if (!validation.valid) {
      return {
        key: typeof manifest.key === 'string' ? manifest.key : null,
        manifest,
        status: 'ERROR',
        error: toRecordError('INVALID_MANIFEST', validation.errors.join('; ')),
      }
    }

    return {
      key: manifest.key,
      manifest,
      source,
      status: 'VALID',
      error: null,
    }
  } catch (error) {
    const importMessage = toErrorMessage(error)
    const packageResolutionHint = importMessage.includes("@atlas/module-engine")
      ? ' Module package resolution must be fixed through workspace/dependency linking; discovery does not rewrite source imports.'
      : ''
    return {
      key: null,
      manifest: null,
      status: 'ERROR',
      error: toRecordError('MANIFEST_IMPORT_FAILED', `${importMessage}${packageResolutionHint}`),
    }
  }
}

export async function loadModuleModels({ moduleDir, manifest }) {
  const safeModuleDir = path.resolve(moduleDir)
  const modelRefs = readManifestReferencePaths({
    manifest,
    key: 'models',
    label: 'manifest.models',
  })

  const models = []
  for (const modelRef of modelRefs) {
    const modelPath = await resolveDeclaredModuleFile({
      moduleDir: safeModuleDir,
      declaredPath: modelRef,
      label: `manifest.models path "${modelRef}"`,
    })

    const modelModule = await importLocalModule(modelPath)
    const declarations = extractObjectExports(modelModule)
    if (!declarations.length) {
      throw new Error(`Model declaration file exported no plain objects: ${modelRef}`)
    }

    for (const declaration of declarations) {
      const validation = validateModel(declaration)
      if (!validation.valid) {
        throw new Error(
          `Invalid model declaration in ${modelRef} for module ${manifest?.key ?? 'unknown'}: ${validation.errors.join('; ')}`
        )
      }
      models.push(declaration)
    }
  }

  return models
}

export async function loadModuleViews({ moduleDir, manifest }) {
  const safeModuleDir = path.resolve(moduleDir)
  const viewRefs = readManifestReferencePaths({
    manifest,
    key: 'views',
    label: 'manifest.views',
  }).map((declaredPath) => ({ declaredPath, type: 'view' }))
  const pageRefs = readManifestReferencePaths({
    manifest,
    key: 'pages',
    label: 'manifest.pages',
  }).map((declaredPath) => ({ declaredPath, type: 'page' }))
  const declarationRefs = [...viewRefs, ...pageRefs]

  const views = []
  for (const ref of declarationRefs) {
    const viewPath = await resolveDeclaredModuleFile({
      moduleDir: safeModuleDir,
      declaredPath: ref.declaredPath,
      label: `manifest.${ref.type === 'page' ? 'pages' : 'views'} path "${ref.declaredPath}"`,
    })

    const viewModule = await importLocalModule(viewPath)
    const declarations = extractObjectExports(viewModule)
    if (!declarations.length) {
      throw new Error(`View/page declaration file exported no plain objects: ${ref.declaredPath}`)
    }

    for (const declaration of declarations) {
      if (ref.type === 'page' || looksLikePageDeclaration(declaration)) {
        const pageValidation = validatePage(declaration)
        if (!pageValidation.valid) {
          throw new Error(
            `Invalid page declaration in ${ref.declaredPath} for module ${manifest?.key ?? 'unknown'}: ${pageValidation.errors.join('; ')}`
          )
        }
        views.push(toPageAsView(declaration))
        continue
      }

      const viewValidation = validateView(declaration)
      if (!viewValidation.valid) {
        throw new Error(
          `Invalid view declaration in ${ref.declaredPath} for module ${manifest?.key ?? 'unknown'}: ${viewValidation.errors.join('; ')}`
        )
      }

      views.push({
        ...declaration,
        type: declaration.type ?? declaration.kind,
      })
    }
  }

  return views
}

async function discoverModulesBySource({ rootDir, source }) {
  const safeRootDir = normalizeRootDir(rootDir)
  const sourceRoot = path.resolve(safeRootDir, 'modules', source)

  if (!(await pathExists(sourceRoot))) {
    return []
  }

  const sourceRootReal = await fs.realpath(sourceRoot)
  if (!isWithinPath(safeRootDir, sourceRootReal)) {
    throw new Error(`Discovery source root for ${source} resolves outside rootDir`)
  }

  const entries = await fs.readdir(sourceRoot, { withFileTypes: true })
  const directories = entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b))

  const records = []
  for (const dirName of directories) {
    const moduleDir = path.join(sourceRoot, dirName)
    const manifestPath = path.join(moduleDir, 'module.manifest.js')

    if (!(await pathExists(manifestPath))) {
      continue
    }

    try {
      const moduleDirReal = await ensureInsideRoot(sourceRoot, moduleDir, 'module directory')
      const manifestReal = await ensureInsideRoot(moduleDirReal, manifestPath, 'module manifest')

      const loadedManifest = await loadModuleManifest({ manifestPath: manifestReal, source })
      const baseRecord = {
        key: loadedManifest.key ?? null,
        manifest: loadedManifest.manifest ?? null,
        source,
        localPath: relativePath(safeRootDir, moduleDirReal),
        moduleDir: moduleDirReal,
        status: loadedManifest.status,
        error: loadedManifest.error,
        models: [],
        views: [],
      }

      if (loadedManifest.status === 'ERROR') {
        records.push(baseRecord)
        continue
      }

      try {
        baseRecord.models = await loadModuleModels({
          moduleDir: moduleDirReal,
          manifest: loadedManifest.manifest,
        })
        baseRecord.views = await loadModuleViews({
          moduleDir: moduleDirReal,
          manifest: loadedManifest.manifest,
        })
      } catch (error) {
        baseRecord.status = 'ERROR'
        baseRecord.error = toRecordError('DECLARATION_LOAD_FAILED', error)
        records.push(baseRecord)
        continue
      }

      const validation = validateDiscoveredModule(baseRecord)
      if (!validation.valid) {
        baseRecord.status = 'ERROR'
        baseRecord.error = toRecordError('INVALID_DISCOVERED_MODULE', validation.errors.join('; '))
      }

      records.push(baseRecord)
    } catch (error) {
      records.push({
        key: null,
        manifest: null,
        source,
        localPath: relativePath(safeRootDir, moduleDir),
        moduleDir: path.resolve(moduleDir),
        status: 'ERROR',
        error: toRecordError('DISCOVERY_IO_ERROR', error),
        models: [],
        views: [],
      })
    }
  }

  return records
}

function applyDuplicateKeyPolicy(records) {
  const grouped = new Map()
  for (let i = 0; i < records.length; i += 1) {
    const key = records[i].key
    if (typeof key !== 'string' || !key.trim()) continue
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key).push(i)
  }

  for (const [key, indices] of grouped.entries()) {
    if (indices.length < 2) continue

    const winnerIndex =
      indices.find((idx) => records[idx].source === SOURCE_OFFICIAL) ??
      indices[0]

    for (const idx of indices) {
      if (idx === winnerIndex) continue
      records[idx].status = 'ERROR'
      records[idx].error = toRecordError(
        'DUPLICATE_MODULE_KEY',
        `Duplicate module key "${key}" detected. ${records[winnerIndex].source} module at ${records[winnerIndex].localPath} takes precedence.`,
        {
          key,
          winnerSource: records[winnerIndex].source,
          winnerPath: records[winnerIndex].localPath,
        }
      )
    }
  }

  return records
}

export async function discoverOfficialModules({ rootDir }) {
  return discoverModulesBySource({ rootDir, source: SOURCE_OFFICIAL })
}

export async function discoverCustomModules({ rootDir }) {
  return discoverModulesBySource({ rootDir, source: SOURCE_CUSTOM })
}

export async function discoverModules({ rootDir }) {
  const safeRootDir = normalizeRootDir(rootDir)
  const official = await discoverOfficialModules({ rootDir: safeRootDir })
  const custom = await discoverCustomModules({ rootDir: safeRootDir })
  return applyDuplicateKeyPolicy([...official, ...custom])
}
