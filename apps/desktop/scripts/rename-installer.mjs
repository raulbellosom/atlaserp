import { renameSync, rmSync, existsSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ATLAS_DESKTOP_RELEASE_ASSET_NAME } from '../src/lib/appConfig.js'

export const FIXED_INSTALLER_NAME = ATLAS_DESKTOP_RELEASE_ASSET_NAME

export function resolveInstallerPaths(baseDir) {
  const nsisDir = path.join(baseDir, 'src-tauri', 'target', 'release', 'bundle', 'nsis')
  const fixedInstallerPath = path.join(nsisDir, FIXED_INSTALLER_NAME)

  const setupCandidates = readdirSync(nsisDir)
    .filter((name) => name.toLowerCase().endsWith('-setup.exe'))
    .filter((name) => name !== FIXED_INSTALLER_NAME)
    .map((name) => ({
      name,
      fullPath: path.join(nsisDir, name),
      mtimeMs: statSync(path.join(nsisDir, name)).mtimeMs,
    }))
    .sort((left, right) => right.mtimeMs - left.mtimeMs)

  return {
    nsisDir,
    fixedInstallerPath,
    sourceInstallerPath: setupCandidates[0]?.fullPath ?? null,
  }
}

export function renameInstaller(baseDir) {
  const { nsisDir, fixedInstallerPath, sourceInstallerPath } =
    resolveInstallerPaths(baseDir)

  if (!existsSync(nsisDir)) {
    throw new Error(`NSIS bundle directory not found: ${nsisDir}`)
  }

  if (!sourceInstallerPath) {
    if (existsSync(fixedInstallerPath)) {
      return fixedInstallerPath
    }
    throw new Error(`No NSIS setup executable found in ${nsisDir}`)
  }

  if (existsSync(fixedInstallerPath)) {
    rmSync(fixedInstallerPath, { force: true })
  }

  renameSync(sourceInstallerPath, fixedInstallerPath)
  return fixedInstallerPath
}

const currentFilePath = fileURLToPath(import.meta.url)
const currentDir = path.dirname(currentFilePath)
const desktopDir = path.resolve(currentDir, '..')

if (process.argv[1] === currentFilePath) {
  const installerPath = renameInstaller(desktopDir)
  console.log(`Installer renamed to: ${installerPath}`)
}
