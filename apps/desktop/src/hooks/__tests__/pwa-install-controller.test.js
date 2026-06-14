import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  clearPwaInstallMarker,
  createPwaInstallController,
  createPwaInstallReloadUrl,
} from '../usePwaInstall.js'

function createPromptEvent() {
  return {
    prevented: false,
    prompted: 0,
    preventDefault() {
      this.prevented = true
    },
    async prompt() {
      this.prompted += 1
    },
    userChoice: Promise.resolve({ outcome: 'accepted' }),
  }
}

test('clears a captured install prompt when module identity changes', () => {
  const availability = []
  const controller = createPwaInstallController({
    moduleKey: 'atlas.inventory',
    onAvailabilityChange: (value) => availability.push(value),
  })
  const event = createPromptEvent()

  controller.capture(event)
  controller.setModuleKey('atlas.projects')

  assert.equal(event.prevented, true)
  assert.equal(controller.canInstall(), false)
  assert.deepEqual(availability, [true, false])
})

test('prompts only for the module that captured the event', async () => {
  const controller = createPwaInstallController({
    moduleKey: 'atlas.inventory',
    onAvailabilityChange() {},
  })
  const event = createPromptEvent()

  controller.capture(event)
  await controller.install()

  assert.equal(event.prompted, 1)
  assert.equal(controller.canInstall(), false)
})

test('reloads the document before installing a different SPA module', async () => {
  const navigations = []
  const controller = createPwaInstallController({
    moduleKey: 'atlas.calendar',
    documentModuleKey: 'atlas.projects',
    onAvailabilityChange() {},
    onManualReadyChange() {},
    navigateForInstall: (url) => navigations.push(url),
    currentUrl:
      'https://atlas.example.com/app/m/atlas.calendar/calendar?view=month#today',
  })

  const result = await controller.install()

  assert.deepEqual(result, { outcome: 'reload' })
  assert.equal(
    navigations[0],
    'https://atlas.example.com/app/m/atlas.calendar/calendar?view=month&pwa-install=1#today',
  )
})

test('marks manual installation ready when the document identity matches', async () => {
  const manualReadiness = []
  const controller = createPwaInstallController({
    moduleKey: 'atlas.calendar',
    documentModuleKey: 'atlas.calendar',
    onAvailabilityChange() {},
    onManualReadyChange: (value) => manualReadiness.push(value),
    navigateForInstall() {
      throw new Error('matching identities must not reload')
    },
    currentUrl: 'https://atlas.example.com/app/m/atlas.calendar/calendar',
  })

  const result = await controller.install()

  assert.deepEqual(result, { outcome: 'manual' })
  assert.deepEqual(manualReadiness, [true])
})

test('adds and removes only the temporary install marker', () => {
  const source =
    'https://atlas.example.com/app/m/atlas.calendar/calendar?view=month#today'
  const prepared = createPwaInstallReloadUrl(source)

  assert.equal(
    prepared,
    'https://atlas.example.com/app/m/atlas.calendar/calendar?view=month&pwa-install=1#today',
  )
  assert.equal(
    clearPwaInstallMarker(prepared),
    '/app/m/atlas.calendar/calendar?view=month#today',
  )
})
