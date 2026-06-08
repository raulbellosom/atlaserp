import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import {
  ATLAS_DESKTOP_RELEASE_ASSET_NAME,
  ATLAS_GITHUB_REPO,
} from '../src/lib/appConfig.js'

export const DEFAULT_RELEASE_NOTES = 'Atlas ERP Desktop universal installer'

function runGh(args, options = {}) {
  const result = spawnSync('gh', args, {
    stdio: options.captureOutput ? 'pipe' : 'inherit',
    encoding: 'utf8',
    cwd: options.cwd,
  })

  if (result.error) {
    throw result.error
  }

  return result
}

export function readDesktopVersion(desktopDir) {
  const tauriConfigPath = path.join(desktopDir, 'src-tauri', 'tauri.conf.json')
  const tauriConfig = JSON.parse(readFileSync(tauriConfigPath, 'utf8'))
  const version = tauriConfig.version?.trim()

  if (!version) {
    throw new Error(`No version found in ${tauriConfigPath}`)
  }

  return version
}

export function buildReleaseTag(version) {
  return version.startsWith('v') ? version : `v${version}`
}

export function resolveInstallerPath(desktopDir) {
  const installerPath = path.join(
    desktopDir,
    'src-tauri',
    'target',
    'release',
    'bundle',
    'nsis',
    ATLAS_DESKTOP_RELEASE_ASSET_NAME,
  )

  if (!existsSync(installerPath)) {
    throw new Error(
      `Installer not found: ${installerPath}. Run "pnpm --filter @atlas/desktop build" first.`,
    )
  }

  return installerPath
}

export function releaseExists(tag, repo) {
  const result = runGh(['release', 'view', tag, '--repo', repo], {
    captureOutput: true,
  })
  return result.status === 0
}

export function publishRelease({
  desktopDir,
  repo = ATLAS_GITHUB_REPO,
  releaseNotes = DEFAULT_RELEASE_NOTES,
} = {}) {
  const version = readDesktopVersion(desktopDir)
  const tag = buildReleaseTag(version)
  const installerPath = resolveInstallerPath(desktopDir)
  const assetSpec = `${installerPath}#${ATLAS_DESKTOP_RELEASE_ASSET_NAME}`

  if (releaseExists(tag, repo)) {
    const uploadResult = runGh(
      ['release', 'upload', tag, assetSpec, '--repo', repo, '--clobber'],
      { cwd: desktopDir },
    )

    if (uploadResult.status !== 0) {
      throw new Error(`Failed to upload installer for ${tag}`)
    }

    const latestResult = runGh(['release', 'edit', tag, '--repo', repo, '--latest'])

    if (latestResult.status !== 0) {
      throw new Error(`Failed to mark ${tag} as latest`)
    }

    return { tag, installerPath, action: 'updated' }
  }

  const createResult = runGh(
    [
      'release',
      'create',
      tag,
      assetSpec,
      '--repo',
      repo,
      '--title',
      tag,
      '--notes',
      releaseNotes,
      '--latest',
    ],
    { cwd: desktopDir },
  )

  if (createResult.status !== 0) {
    throw new Error(`Failed to create release ${tag}`)
  }

  return { tag, installerPath, action: 'created' }
}

const currentFilePath = fileURLToPath(import.meta.url)
const currentDir = path.dirname(currentFilePath)
const desktopDir = path.resolve(currentDir, '..')

if (process.argv[1] === currentFilePath) {
  const result = publishRelease({ desktopDir })
  console.log(
    `Release ${result.tag} ${result.action}. Asset ready at ${result.installerPath}`,
  )
}
