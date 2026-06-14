function defaultRandomId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

function requireFormId(formId) {
  if (!formId) throw new TypeError('forms: formId es requerido')
  return encodeURIComponent(formId)
}

export function createFormsNamespace({
  request,
  siteId,
  getAnalyticsContext = () => null,
  analytics = null,
  randomId = defaultRandomId,
}) {
  const siteHeaders = siteId ? { 'X-Atlas-Site': siteId } : {}

  async function get(formId) {
    const response = await request(
      'GET',
      `/public/storefront/v1/forms/${requireFormId(formId)}`,
      null,
      { headers: siteHeaders },
    )
    const form = response?.data ?? response
    analytics?.track?.('form_view', { formId })
    return form
  }

  async function submit(formId, values, options = {}) {
    const context = getAnalyticsContext?.() ?? {}
    const idempotencyKey = options.idempotencyKey ?? randomId()
    try {
      const response = await request(
        'POST',
        `/public/storefront/v1/forms/${requireFormId(formId)}/submissions`,
        {
          values: values ?? {},
          ...(context.visitorId ? { visitorId: context.visitorId } : {}),
          ...(context.sessionId ? { sessionId: context.sessionId } : {}),
          ...(options.turnstileToken
            ? { turnstileToken: options.turnstileToken }
            : {}),
          honeypot: options.honeypot ?? '',
        },
        {
          headers: {
            ...siteHeaders,
            'Idempotency-Key': idempotencyKey,
          },
        },
      )
      const result = response?.data ?? response
      analytics?.track?.('form_submit', {
        formId,
        ...(result?.submissionId ? { submissionId: result.submissionId } : {}),
      })
      return result
    } catch (error) {
      analytics?.track?.('form_submit_error', {
        formId,
        code: error?.code ?? 'UNKNOWN',
      })
      throw error
    }
  }

  return Object.freeze({ get, submit })
}
