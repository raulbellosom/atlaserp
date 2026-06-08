import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  buildReleaseTag,
  readDesktopVersion,
  resolveInstallerPath,
} from '../publish-release.mjs'
import { ATLAS_DESKTOP_RELEASE_ASSET_NAME } from '../../src/lib/appConfig.js'

test('buildReleaseTag prefixes versions once', () => {
  assert.equal(buildReleaseTag('0.1.0'), 'v0.1.0')
  assert.equal(buildReleaseTag('v0.1.0'), 'v0.1.0')
})

test('readDesktopVersion reads version from tauri config', () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'atlas-release-version-'))
  const srcTauriDir = path.join(tempDir, 'src-tauri')
  mkdirSync(srcTauriDir, { recursive: true })
  writeFileSync(
    path.join(srcTauriDir, 'tauri.conf.json'),
    JSON.stringify({ version: '1.2.3' }),
  )

  assert.equal(readDesktopVersion(tempDir), '1.2.3')
})

test('resolveInstallerPath points to fixed NSIS asset path', () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'atlas-release-installer-'))
  const nsisDir = path.join(tempDir, 'src-tauri', 'target', 'release', 'bundle', 'nsis')
  mkdirSync(nsisDir, { recursive: true })
  const installerPath = path.join(nsisDir, ATLAS_DESKTOP_RELEASE_ASSET_NAME)
  writeFileSync(installerPath, 'installer')

  assert.equal(resolveInstallerPath(tempDir), installerPath)
})
