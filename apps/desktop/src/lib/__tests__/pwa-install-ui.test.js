import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getMobilePwaInstallMode } from '../pwaInstallUi.js'

test('requires preparing an iOS module before showing Share instructions', () => {
  assert.equal(
    getMobilePwaInstallMode({
      platform: 'ios',
      standalone: false,
      activeModuleKey: 'atlas.calendar',
      canInstall: false,
      manualInstallReady: false,
    }),
    'prepare',
  )
  assert.equal(
    getMobilePwaInstallMode({
      platform: 'ios',
      standalone: false,
      activeModuleKey: 'atlas.calendar',
      canInstall: false,
      manualInstallReady: true,
    }),
    'instructions',
  )
})

test('keeps native Android prompts and hides module install outside modules', () => {
  assert.equal(
    getMobilePwaInstallMode({
      platform: 'android',
      standalone: false,
      activeModuleKey: 'atlas.projects',
      canInstall: true,
      manualInstallReady: false,
    }),
    'prompt',
  )
  assert.equal(
    getMobilePwaInstallMode({
      platform: 'ios',
      standalone: false,
      activeModuleKey: null,
      canInstall: false,
      manualInstallReady: false,
    }),
    null,
  )
})
