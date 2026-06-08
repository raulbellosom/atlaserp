import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, existsSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { FIXED_INSTALLER_NAME, renameInstaller } from '../rename-installer.mjs'

test('renameInstaller renames latest NSIS setup executable to fixed name', () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'atlas-installer-'))
  const nsisDir = path.join(tempDir, 'src-tauri', 'target', 'release', 'bundle', 'nsis')
  mkdirSync(nsisDir, { recursive: true })

  const oldInstaller = path.join(nsisDir, 'Atlas ERP_0.1.0_x64-setup.exe')
  writeFileSync(oldInstaller, 'installer')

  const renamedPath = renameInstaller(tempDir)

  assert.equal(path.basename(renamedPath), FIXED_INSTALLER_NAME)
  assert.equal(existsSync(renamedPath), true)
  assert.equal(existsSync(oldInstaller), false)
})
