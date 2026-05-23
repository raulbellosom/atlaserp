import { test } from 'node:test'
import assert from 'node:assert/strict'
import { moduleDryRunSchema, moduleUninstallSchema } from '../index.js'

test('moduleDryRunSchema accepts purge-owned-tables mode', () => {
  const parsed = moduleDryRunSchema.parse({ mode: 'purge-owned-tables' })
  assert.equal(parsed.mode, 'purge-owned-tables')
})

test('moduleUninstallSchema requires ACEPTO for purge-owned-tables mode', () => {
  const success = moduleUninstallSchema.safeParse({
    mode: 'purge-owned-tables',
    confirmation: 'ACEPTO',
  })
  assert.equal(success.success, true)

  const fail = moduleUninstallSchema.safeParse({ mode: 'purge-owned-tables' })
  assert.equal(fail.success, false)
})
