import fs from 'node:fs/promises'
import path from 'node:path'

const DEFAULT_CUSTOM_RELATIVE_DIR = path.join('modules', 'custom')
const DEFAULT_OFFICIAL_RELATIVE_DIR = path.join('modules', 'official')

function normalizeRootDir(rootDir) {
  return path.resolve(typeof rootDir === 'string' && rootDir.trim() ? rootDir : process.cwd())
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath)
    return true
  } catch {
    return false
  }
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
  const projectRoot = normalizeRootDir(candidateDir)
  const modulesDir = path.join(projectRoot, 'modules')
  const officialModulesDir = path.join(projectRoot, DEFAULT_OFFICIAL_RELATIVE_DIR)
  const customModulesDir = path.join(projectRoot, DEFAULT_CUSTOM_RELATIVE_DIR)
  const pnpmWorkspacePath = path.join(projectRoot, 'pnpm-workspace.yaml')
  const packageJsonPath = path.join(projectRoot, 'package.json')

  const pnpmWorkspaceExists = await pathExists(pnpmWorkspacePath)
  const packageJsonExists = await pathExists(packageJsonPath)
  const modulesDirExists = await isDirectory(modulesDir)
  const officialModulesDirExists = await isDirectory(officialModulesDir)
  const customModulesDirExists = await isDirectory(customModulesDir)

  return {
    projectRoot,
    pnpmWorkspaceExists,
    packageJsonExists,
    modulesDirExists,
    officialModulesDirExists,
    customModulesDirExists,
    valid: pnpmWorkspaceExists && packageJsonExists && modulesDirExists,
  }
}

async function findProjectRootUpward(startDir) {
  let current = normalizeRootDir(startDir)
  while (true) {
    const inspection = await inspectProjectRoot(current)
    if (inspection.valid) return inspection
    const parentDir = path.dirname(current)
    if (parentDir === current) return null
    current = parentDir
  }
}

export async function resolveProjectRootInfo(options = {}) {
  const env = options.env ?? process.env
  const cwd = normalizeRootDir(options.cwd ?? process.cwd())
  const sourceDir = normalizeRootDir(options.sourceDir ?? cwd)
  const explicitRoot = options.rootDir ? normalizeRootDir(options.rootDir) : null

  if (explicitRoot) {
    const inspection = await inspectProjectRoot(explicitRoot)
    if (!inspection.valid) {
      throw new Error(
        `Project root not found at explicit root (${explicitRoot}). Expected pnpm-workspace.yaml, package.json, and modules/.`
      )
    }
    return {
      cwd,
      projectRoot: inspection.projectRoot,
      resolution: 'explicit-root',
      modulesDirExists: inspection.modulesDirExists,
      customModulesDirExists: inspection.customModulesDirExists,
      officialModulesDirExists: inspection.officialModulesDirExists,
    }
  }

  const envRootRaw = typeof env.ATLAS_PROJECT_ROOT === 'string' ? env.ATLAS_PROJECT_ROOT.trim() : ''
  if (envRootRaw) {
    const inspection = await inspectProjectRoot(envRootRaw)
    if (inspection.valid) {
      return {
        cwd,
        projectRoot: inspection.projectRoot,
        resolution: 'env',
        modulesDirExists: inspection.modulesDirExists,
        customModulesDirExists: inspection.customModulesDirExists,
        officialModulesDirExists: inspection.officialModulesDirExists,
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
      officialModulesDirExists: fromCwd.officialModulesDirExists,
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
      officialModulesDirExists: fromSourceDir.officialModulesDirExists,
    }
  }

  throw new Error(
    `Project root not found. Expected pnpm-workspace.yaml, package.json, and modules/ starting from cwd (${cwd}) or API source (${sourceDir}).`
  )
}

export async function resolveModuleRoots(options = {}) {
  const env = options.env ?? process.env
  const projectRootInfo = await resolveProjectRootInfo(options)
  const projectRoot = projectRootInfo.projectRoot
  const officialModulesDir = path.join(projectRoot, DEFAULT_OFFICIAL_RELATIVE_DIR)
  const envCustomRoot = typeof env.ATLAS_MODULES_DIR === 'string' ? env.ATLAS_MODULES_DIR.trim() : ''
  const customModulesDir = envCustomRoot
    ? path.resolve(envCustomRoot)
    : path.join(projectRoot, DEFAULT_CUSTOM_RELATIVE_DIR)

  return {
    ...projectRootInfo,
    officialModulesDir,
    officialModulesDirExists: await isDirectory(officialModulesDir),
    customModulesDir,
    customModulesDirExists: await isDirectory(customModulesDir),
    customModulesSource: envCustomRoot ? 'env' : 'project',
  }
}

export function describeCustomModulesMapping(roots) {
  const customRoot = roots?.customModulesDir ?? '<custom-modules-root>'
  return [
    'Installer mode mapping:',
    'host custom-modules/ -> container ATLAS_MODULES_DIR (for example /app/modules/custom).',
    `Active custom root: ${customRoot}.`,
    'Source mode fallback: <projectRoot>/modules/custom.',
  ].join(' ')
}
