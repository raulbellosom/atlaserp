import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createPwaInstallController } from '../usePwaInstall.js'

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
