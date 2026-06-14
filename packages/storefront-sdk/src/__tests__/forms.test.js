import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createFormsNamespace } from '../forms.js'
import { StorefrontError } from '../storefront-error.js'

describe('createFormsNamespace', () => {
  it('fetches public definitions with the site scope', async () => {
    const calls = []
    const forms = createFormsNamespace({
      siteId: 'site-1',
      request: async (...args) => {
        calls.push(args)
        return { data: { id: 'form-1', fields: [] } }
      },
    })

    assert.deepEqual(await forms.get('form-1'), { id: 'form-1', fields: [] })
    assert.equal(calls[0][0], 'GET')
    assert.equal(calls[0][1], '/public/storefront/v1/forms/form-1')
    assert.equal(calls[0][3].headers['X-Atlas-Site'], 'site-1')
  })

  it('submits with idempotency and analytics identifiers', async () => {
    const calls = []
    const forms = createFormsNamespace({
      siteId: 'site-1',
      getAnalyticsContext: () => ({
        visitorId: 'visitor-1',
        sessionId: 'session-1',
      }),
      request: async (...args) => {
        calls.push(args)
        return { data: { submissionId: 'submission-1', leadId: 'lead-1' } }
      },
      analytics: {
        track: (name, properties) => calls.push(['track', name, properties]),
      },
      randomId: () => 'submission-key',
    })

    const result = await forms.submit(
      'form-1',
      { email: 'ana@example.com' },
      { turnstileToken: 'captcha', honeypot: '' },
    )

    assert.equal(result.submissionId, 'submission-1')
    assert.equal(calls[0][3].headers['Idempotency-Key'], 'submission-key')
    assert.deepEqual(calls[0][2], {
      values: { email: 'ana@example.com' },
      visitorId: 'visitor-1',
      sessionId: 'session-1',
      turnstileToken: 'captcha',
      honeypot: '',
    })
    assert.deepEqual(calls[1], [
      'track',
      'form_submit',
      { formId: 'form-1', submissionId: 'submission-1' },
    ])
  })

  it('preserves typed errors and never sends form values to analytics', async () => {
    const tracked = []
    const validationError = new StorefrontError(
      'Formulario invalido',
      'VALIDATION_ERROR',
      422,
      { email: ['Correo invalido'] },
    )
    const forms = createFormsNamespace({
      siteId: 'site-1',
      request: async () => {
        throw validationError
      },
      analytics: {
        track: (name, properties) => tracked.push({ name, properties }),
      },
    })

    await assert.rejects(
      () => forms.submit('form-1', { email: 'private@example.com' }),
      (error) => error === validationError,
    )
    assert.equal(JSON.stringify(tracked).includes('private@example.com'), false)
    assert.deepEqual(tracked, [
      {
        name: 'form_submit_error',
        properties: { formId: 'form-1', code: 'VALIDATION_ERROR' },
      },
    ])
  })
})
